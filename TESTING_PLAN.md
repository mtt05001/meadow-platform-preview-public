# Meadow Platform — Migration Testing Plan

## Pre-requisites

### 1. Move hardcoded GHL config to env vars

These are currently hardcoded in `lib/ghl.ts` and need env var overrides:

| Config | Current | Env var to add |
|--------|---------|----------------|
| Location ID | `A4AjOJ6RQgzEHxtmZsOr` (has env fallback) | `GHL_LOCATION_ID` (already done) |
| Webhook URL | Hardcoded on line 166 | `GHL_APPROVE_WEBHOOK_URL` (fallback exists but shouldn't) |
| Prep 1 date field | `47Nj5tCxZy6Zhze9m9c8` | `GHL_FIELD_PREP1_DATE` |
| Prep 2 date field | `RHZA1YmoHFAJlAbYrLvw` | `GHL_FIELD_PREP2_DATE` |
| Journey date field | `1amX2K1pwdx2r39wwd9d` | `GHL_FIELD_JOURNEY_DATE` |
| HI status field | `JD7nHdPbcHWnEh2OEhhI` | `GHL_FIELD_HI_STATUS` |
| OHA status field | `onZ8dloJ0Ho6JQpCt8PI` | `GHL_FIELD_OHA_STATUS` |
| Lead facilitator field | `H4LM6jbUwR1woLSj2kzV` | `GHL_FIELD_LEAD_FACILITATOR` |
| Facilitator email field | `l9dFoho2FPShAznPUrM9` | `GHL_FIELD_FACILITATOR_EMAIL` |
| HI URL field | `pypItuyHO6POQ2NpoTcZ` | `GHL_FIELD_HI_URL` |

Remove the hardcoded webhook fallback — if the env var isn't set, it should fail loudly, not silently POST to a stale URL.

### 2. Set up GHL sandbox

1. Go to [GHL Marketplace Developer Portal](https://marketplace.gohighlevel.com)
2. Navigate to Testing → + Create App Test Account
3. In the sandbox location:
   - Recreate the same custom fields (Prep 1, Prep 2, Journey, HI status, OHA status, Lead Facilitator, Facilitator email, HI URL)
   - Note the new field IDs — these go in `.env.local` as the sandbox values
   - Create a webhook trigger for approval automation
   - Create 3-5 test contacts with opportunities
4. Generate a sandbox PIT (Private Integration Token)
5. Sandbox lasts 6 months from creation

### 3. Add dry-run mode to approve endpoint

Add `dry_run: true` param to `POST /api/intakes/[id]/approve`. When enabled:
- Runs all logic (GHL contact lookup, opportunity search, payload assembly)
- Logs what *would* happen (webhook payload, note body, DB update)
- Returns the full payload in the response
- Does NOT fire the webhook, does NOT add the note, does NOT update DB

This lets us validate the entire flow without sending an irreversible email.

---

## Test layers

### Layer 1: Pure functions (no external dependencies)

**What:** Risk engine — extract, scan, score, tier assignment.

**How:** Unit tests with fixture Jotform submission JSON.

**Test cases:**
- [ ] Green tier: healthy 35yo, no meds, no flags
- [ ] Yellow tier: soft score 2-4 (e.g., age 24 + moderate alcohol)
- [ ] Red tier (hard flag): patient on lithium
- [ ] Red tier (soft score): 2+ psych meds → auto-score 10
- [ ] Edge case: missing/malformed Jotform fields (empty answers, null values)
- [ ] Edge case: medication matrix with fewer than 5 columns per row

**Risk if broken:** None — deterministic, no side effects.

---

### Layer 2: Database CRUD

**What:** All 6 DB functions against Supabase.

**How:** Point at real Supabase instance, use test records with obvious fake names (e.g., "TEST_John_Doe").

**Test cases:**
- [ ] `upsertIntake` — insert new record, verify all 22 columns
- [ ] `upsertIntake` — upsert existing record, verify ON CONFLICT updates
- [ ] `getIntakes` — list all, with status filter, with limit/offset
- [ ] `getIntakeById` — existing ID, non-existent ID (should return null)
- [ ] `updateIntakeFields` — partial update (e.g., just `status`)
- [ ] `updateIntakeFields` — attempt to update `id` column (should be rejected by whitelist)
- [ ] `updateIntakeFields` — attempt to update non-existent column (should be filtered out)
- [ ] `deleteIntake` — delete test record, verify gone
- [ ] `getLastUpdated` — returns valid timestamp

**Cleanup:** Delete all TEST_ records after test run.

**Risk if broken:** Low — contained to DB.

---

### Layer 3: AI generation

**What:** Claude API call + response parsing.

**How:** Call `generateAiOutput` with a test ClientData object.

**Test cases:**
- [ ] Valid client data → response contains `===SEPARATOR===`
- [ ] Response parses into email + risk_stratification (both non-empty)
- [ ] Email doesn't contain OUTPUT 1 header
- [ ] Risk strat doesn't contain OUTPUT 2 header
- [ ] Subject line is stripped from email
- [ ] `model` and `generated_at` are populated in result

**Cost:** ~$0.02 per call. Run sparingly.

**Risk if broken:** Low — generates text, no side effects.

---

### Layer 4: GHL reads (sandbox)

**What:** Contact search + opportunity lookup.

**How:** Point at GHL sandbox with sandbox PIT.

**Test cases:**
- [ ] `searchContact` — known email → returns contact
- [ ] `searchContact` — unknown email → returns null with error message
- [ ] `getOpportunityWithFacilitator` — contact with opportunity → returns opp + facilitator email
- [ ] `getOpportunityWithFacilitator` — contact without opportunity → returns null

**Risk if broken:** None — read-only on sandbox.

---

### Layer 5: GHL writes (sandbox)

**What:** Notes, opportunity updates, webhook trigger.

**How:** Point at GHL sandbox. Verify results in GHL UI.

**Test cases:**
- [ ] `addNote` — adds note to test contact, visible in GHL UI
- [ ] `updateOpportunityField` — sets HI status on test opportunity, visible in GHL UI
- [ ] `updateOpportunityField` — sets HI URL on test opportunity
- [ ] `triggerWebhook` — fires sandbox webhook, check GHL automation logs
- [ ] `triggerWebhook` — verify webhook payload matches expected schema

**Risk if broken:** Low — sandbox only, no real patients.

---

### Layer 6: Gmail send

**What:** Email delivery via service account delegation.

**How:** Use `POST /api/test-email` with team email addresses.

**Test cases:**
- [ ] Send to Mike's email — verify delivery, from address, formatting
- [ ] Send to Gonza's email — verify CC works
- [ ] Send with HTML content (medication guidance sample) — verify rendering
- [ ] Send with empty body — should still deliver

**Risk if broken:** Medium — sends real email, but to known addresses.

---

### Layer 7: Jotform sync

**What:** Pull submissions, process through risk engine, upsert to DB.

**How:** Run `POST /api/intakes/sync-jotform` against real Jotform (read-only) + real DB.

**Test cases:**
- [ ] Sync with no new submissions → `new_count: 0`
- [ ] Sync with new submission → intake created in DB with all fields populated
- [ ] Sync idempotent — running twice doesn't duplicate records
- [ ] AI output attached to new intake (email + risk_strat)
- [ ] Risk tier matches expected for the submission's data

**Risk if broken:** Medium — writes to real DB, costs ~$0.02/submission for AI.

---

### Layer 8: Full approve flow (sandbox + dry-run)

**What:** The complete approval pipeline end-to-end.

**How:** Two passes:

**Pass 1 — Dry run (sandbox):**
- [ ] Call approve with `dry_run: true` on a test intake
- [ ] Verify response contains full webhook payload
- [ ] Verify GHL contact was found
- [ ] Verify facilitator email was extracted
- [ ] Verify DB was NOT updated
- [ ] Verify webhook was NOT fired

**Pass 2 — Live run (sandbox):**
- [ ] Call approve without dry_run on a test intake (GHL pointed at sandbox)
- [ ] Verify webhook fired (check sandbox automation logs)
- [ ] Verify GHL note was added to test contact
- [ ] Verify DB status = "approved", approved_by and approved_at set
- [ ] Verify response includes facilitator_email

**Risk if broken:** Low on sandbox. High on production — this sends irreversible email.

---

### Layer 9: GHL data backfill

**What:** `POST /api/intakes/sync-ghl` pulls prep dates + facilitator from GHL into DB.

**How:** Point at sandbox GHL with test contacts that have opportunity custom fields set.

**Test cases:**
- [ ] Intake with matching GHL contact → prep1_date and facilitator updated in DB
- [ ] Intake with no GHL contact → skipped, no error
- [ ] Intake with contact but no opportunity → skipped, no error
- [ ] Bulk sync (all intakes) → only intakes with email are processed

**Risk if broken:** Low — writes to DB only, GHL is read-only here.

---

## Go-live checklist

After all layers pass:

- [ ] Set production env vars on Vercel (all GHL field IDs, webhook URL, API keys)
- [ ] Remove hardcoded fallback values from code
- [ ] Verify Clerk auth blocks unauthenticated requests to all non-public routes
- [ ] Run one full sync-jotform against production DB — verify intakes match old platform
- [ ] Have Tracy do a side-by-side review: old UI vs new UI for 2-3 intakes
- [ ] Do one real approval with Tracy watching — verify patient gets correct email
- [ ] Monitor GHL for 24h — check notes, opportunity fields, webhook logs
- [ ] Decommission old platform (stop crons on Mike's laptop, archive old Vercel deployment)
