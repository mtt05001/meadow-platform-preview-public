# Meadow Platform — Business Flow & Data Operations

## People

| Role | Interface | What they do |
|------|-----------|--------------|
| **Patient** | Jotform | Fills out health intake questionnaire |
| **Tracy (Doctor)** | `/intakes` | Reviews intakes, edits medication guidance, approves & sends |
| **Facilitator** | `/intakes/[id]/readonly` | Sees assigned client's risk strat + approval status |
| **Mike (Ops)** | Admin (TBD) | Triggers syncs, manages pipeline |
| **GHL** | Webhooks + API | Stores contacts, sends emails, tracks pipeline stages |

---

## The Flow (Current — what's actually wired up)

### 1. Patient submits intake (Jotform)

Form ID: `243226217742049`. Contains: demographics, medical history, psychiatric history, medications, supplements, substance use, lifestyle, purpose, obstacles, fears, sleep patterns.

### 2. Sync pulls new submissions (`POST /api/intakes/sync-jotform`)

Triggered manually (or via future cron). For each new submission:

1. `extractClientData()` — parses Jotform JSON into structured ClientData
2. `scanHardContraindications()` — regex match ~100 conditions + ~130 meds → auto-red if any match
3. `scoreSoftContraindications()` — point system (age, substance use, med count) → 0-10 scale
4. `assignRiskTier()` — hard flags → red, soft ≥5 → red, soft ≥2 → yellow, else green
5. `generateAiOutput()` — **Claude API call** → client email + internal risk strat
6. `upsertIntake()` — **DB INSERT** (or update on conflict)

**This is the only place new intakes enter the system.**

### 3. Tracy reviews intakes (`/intakes`)

**Queue view:**
- "Needs Review" (pending) and "Review Complete" (approved/archived)
- Cards show: name, risk tier, email, prep 1 date, facilitator, status
- Can archive (soft-delete) or delete (hard-delete) from cards

**Detail view (`/intakes/[id]`):**
- Left panel: risk stratification (Quill rich text editor)
- Right panel: medication guidance email (Quill rich text editor)
- Tracy edits both, then approves

### 4. Tracy approves (`POST /api/intakes/[id]/approve`)

1. Looks up patient in GHL by email → gets contact ID
2. Finds opportunity → extracts facilitator email from custom fields
3. **POSTs to GHL webhook** with edited email, risk strat, approver info, facilitator email
4. GHL automation sends the medication guidance email to patient (CC's facilitator)
5. Writes `[HI_APPROVAL]` note to GHL contact (fire-and-forget)
6. **DB UPDATE** → status = "approved", approved_by, approved_at

### 5. Facilitator views readonly (`/intakes/[id]/readonly`)

Public route (no auth). Shows: client info, risk strat, approval badge, PDF link.

### 6. GHL data backfill (`POST /api/intakes/sync-ghl`)

Triggered manually. For each intake in DB:
- Searches GHL contact by email
- Pulls prep1 date + facilitator from opportunity custom fields
- **DB UPDATE** → prep1_date, facilitator

---

## Data Ownership

```
Jotform ──raw submissions──→ Platform DB ──approval──→ GHL
                                  ↑                      │
                                  └──sync-ghl──facilitator, prep dates──┘
```

| Data | Source of truth | Stored in | Flows to |
|------|----------------|-----------|----------|
| Patient intake answers | **Jotform** | DB (copied at sync) | — |
| Risk tier, hard flags, soft score | **DB** (computed at sync) | DB | — |
| AI-generated email + risk strat | **DB** (generated at sync) | DB | GHL (at approval via webhook) |
| Tracy's edits to email/risk strat | **DB** | DB | GHL (at approval via webhook) |
| Approval status | **DB** | DB | GHL (note + webhook) |
| Facilitator assignment | **GHL** | DB (cached via sync-ghl) | — |
| Prep 1 date | **GHL** | DB (cached via sync-ghl) | — |
| Contact info, pipeline stage | **GHL** | Never copied | Queried live at approval time |

**Key rule:** DB is authoritative for processing state (risk, AI, edits, approval). GHL is authoritative for relationship state (facilitator, dates, pipeline). Jotform is authoritative for raw patient input.

### How data got into the current DB (history)

The old platform used JSON files on Mike's laptop as the primary store. A cron job (`sync_health_intakes.sh`) ran 2x/day:
1. Fetch Jotform → process through risk engine → save as JSON files
2. `refresh_data.py` copies JSONs to `meadow-platform/intakes/` + builds `data.json`
3. Deploy static files to Vercel

In March 2026, Supabase was bolted on. Reads were migrated, some writes were migrated (approve, archive, save edits), but **new intake creation was never migrated** — `db.upsert_intake()` existed but nothing called it. The 98 rows in Supabase were likely seeded manually from the JSON files (no migration script exists in git).

The new platform fixes this: `POST /api/intakes/sync-jotform` calls `upsertIntake()`, so new intakes are written to DB. The cron on Mike's laptop can be killed once the new platform is live.

---

## The Flow (Target — what needs to change)

| Current | Target | Priority |
|---------|--------|----------|
| No full backfill — sync only fetches 20 recent | One-time full Jotform backfill + increase ongoing limit | High |
| Approve fires webhook before DB write | Swap order: DB "sending" → webhook → DB "approved" | High |
| Jotform sync is manual | Jotform webhook or Vercel Cron triggers sync automatically | High |
| No auth on any endpoint | Clerk auth on all routes except readonly | High |
| Approver name typed into text input | Approver pulled from Clerk session (no spoofing) | High |
| Hard delete removes medical records forever | Soft delete only (set status, never DELETE FROM) | High |
| Readonly route is fully public | Readonly route uses signed/expiring token | Medium |
| GHL sync is manual | Vercel Cron runs daily | Medium |
| No audit log | Log all mutations (who, what, when) | Medium |
| Email HTML not sanitized | DOMPurify before storing/sending | Medium |
| Feedback stored in localStorage | Feedback stored in DB | Low |
| No role-based access | Clerk roles: admin, reviewer, facilitator | Low |

---

## Data Operations Reference

### Database Reads

| Function | SQL | Called by |
|----------|-----|----------|
| `getIntakes(limit?, offset?, status?)` | `SELECT [22 cols] FROM intakes [WHERE status=$1] ORDER BY created_at DESC LIMIT $N OFFSET $N` | `GET /api/intakes`, `POST /api/intakes/sync-ghl`, `POST /api/intakes/sync-jotform` |
| `getIntakeById(id)` | `SELECT [22 cols] FROM intakes WHERE id=$1` | `GET /api/intakes/[id]`, `POST /api/intakes/[id]/save-email-draft` |
| `getLastUpdated()` | `SELECT MAX(updated_at) FROM intakes` | `GET /api/intakes` |

### Database Writes

| Function | SQL | Called by | What changes |
|----------|-----|----------|--------------|
| `upsertIntake(payload)` | `INSERT INTO intakes (22 cols) ... ON CONFLICT (id) DO UPDATE SET ...` | `POST /api/intakes/sync-jotform` | Creates new intake with all data (client, AI output, risk assessment, jotform raw) |
| `updateIntakeFields(id, fields)` | `UPDATE intakes SET {fields}, updated_at=NOW() WHERE id=$1` | 6 endpoints (see below) | Partial update, column-whitelisted |
| `deleteIntake(id)` | `DELETE FROM intakes WHERE id=$1` | `POST /api/intakes/[id]/actions` (action=delete) | **Hard delete — row gone forever** |

#### Every call to `updateIntakeFields`:

| Endpoint | Fields written | Purpose |
|----------|---------------|---------|
| `POST /api/intakes/[id]/actions` (archive) | `status="archived"` | Soft-delete intake |
| `POST /api/intakes/[id]/approve` | `status="approved"`, `approved_by`, `approved_at` | Mark approved after GHL webhook succeeds |
| `POST /api/intakes/[id]/mark-approved` | `status="approved"`, `approved_by`, `approved_at` | Lightweight approval (no GHL, no email) |
| `POST /api/intakes/[id]/save-email-draft` | `ai_output` (JSON with updated email field) | Persist email edits from Quill |
| `POST /api/intakes/[id]/save-risk-strat` | `edited_risk_strat` | Persist risk strat edits from Quill |
| `POST /api/intakes/sync-ghl` | `prep1_date`, `facilitator` | Backfill GHL data into intakes |

### External API Reads

| Function | Service | Method | What it does | Called by |
|----------|---------|--------|-------------|----------|
| `searchContact(email)` | GHL | `POST /contacts/search` | Find GHL contact by email | approve, sync-ghl, facilitator |
| `getOpportunityWithFacilitator(contactId)` | GHL | `POST /opportunities/search` | Get opportunity + facilitator email from custom fields | approve, sync-ghl, facilitator |
| `fetchRecentSubmissions(formId?, limit?)` | Jotform | `GET /form/{id}/submissions` | Pull latest 20 submissions | sync-jotform |
| `fetchSubmissionPdf(submissionId)` | Jotform | `GET /submission/{id}/pdf` | Get PDF of original form submission | `GET /api/intakes/[id]/pdf` |

### External API Writes (mutations that leave the system)

| Function | Service | Method | What it does | Called by | Reversible? |
|----------|---------|--------|-------------|----------|-------------|
| `triggerWebhook(payload)` | GHL | `POST {webhook_url}` | Triggers GHL automation → **sends email to patient** | approve | **NO — email is sent** |
| `addNote(contactId, body)` | GHL | `POST /contacts/{id}/notes` | Writes `[HI_APPROVAL]` note on contact | approve (fire-and-forget) | No (but harmless) |
| `sendEmail(to, subject, html)` | Gmail | `gmail.users.messages.send` | Sends email via service account delegation | test-email | **NO — email is sent** |
| `generateAiOutput(clientData)` | Anthropic | `POST messages.create` | Claude generates email + risk strat (costs ~$0.02/call) | sync-jotform | N/A (read-like, but costs money) |

### Sync reliability

Each sync has different failure characteristics and needs different handling:

#### sync-jotform (Jotform → DB) — low risk

If it fails, new intakes just don't appear yet. No inconsistency — Jotform still has the data. Retry on next cron run.

**Current limitation:** Only fetches 20 most recent submissions. Works at current volume (~100 total intakes) but will miss submissions if >20 arrive between sync runs. Needs a full backfill mode for initial migration and a higher limit or pagination for ongoing use.

**Schedule:** Vercel Cron every 15 minutes (or Jotform webhook for real-time).

#### sync-ghl (GHL → DB) — low risk

If it fails, DB shows stale facilitator/dates. GHL is authoritative for this data — DB is just a cache. Retry on next cron run.

**Schedule:** Vercel Cron once daily (facilitator/date assignments don't change frequently).

#### approve (DB → GHL) — HIGH risk, needs careful ordering

**Current (dangerous):**
```
1. Fire GHL webhook   ← email sent to patient (IRREVERSIBLE)
2. Update DB          ← status = "approved"
```
If step 2 fails: patient got the email but DB says "pending". Inconsistent.

**Target (safe):**
```
1. Update DB          ← status = "sending"     (we know approval started)
2. Fire GHL webhook   ← email sent to patient
3. Update DB          ← status = "approved"     (done)
```

Failure scenarios:
- **Step 1 fails:** Nothing happened. Show error, let Tracy retry.
- **Step 2 fails:** DB says "sending", no email sent. Safe to retry the webhook. UI shows "sending" status so Tracy knows it's in progress.
- **Step 3 fails after step 2:** DB says "sending", email was sent. A cleanup job (or Vercel Cron) finds "sending" records older than 5 minutes and marks them "approved" — if the webhook returned 200, the email went out.

This is a lightweight outbox pattern. No message queue needed — just a transitional status and a periodic cleanup.

#### addNote (fire-and-forget) — no risk

The GHL note after approval is non-critical. If it fails, we log and move on. The note is for audit trail convenience, not data integrity.

---

## Endpoint Summary

| Endpoint | Method | Reads | Writes | External |
|----------|--------|-------|--------|----------|
| `/api/intakes` | GET | DB: getIntakes, getLastUpdated | — | — |
| `/api/intakes/[id]` | GET | DB: getIntakeById | — | — |
| `/api/intakes/[id]/pdf` | GET | — | — | Jotform: fetchSubmissionPdf |
| `/api/intakes/[id]/actions` | POST | — | DB: updateIntakeFields OR deleteIntake | — |
| `/api/intakes/[id]/approve` | POST | — | DB: updateIntakeFields | GHL: searchContact, getOpp, triggerWebhook, addNote |
| `/api/intakes/[id]/mark-approved` | POST | — | DB: updateIntakeFields | — |
| `/api/intakes/[id]/save-email-draft` | POST | DB: getIntakeById | DB: updateIntakeFields | — |
| `/api/intakes/[id]/save-risk-strat` | POST | — | DB: updateIntakeFields | — |
| `/api/intakes/sync-ghl` | POST | DB: getIntakes | DB: updateIntakeFields (bulk) | GHL: searchContact, getOpp (per intake) |
| `/api/intakes/sync-jotform` | POST | DB: getIntakes | DB: upsertIntake (per new sub) | Jotform: fetchRecent; Anthropic: generateAiOutput |
| `/api/facilitator` | POST | — | — | GHL: searchContact, getOpp |
| `/api/test-email` | POST | — | — | Gmail: sendEmail |

---

## GHL Custom Field IDs (opportunity-level)

| Field | ID | Used in |
|---|---|---|
| Prep 1 date | `47Nj5tCxZy6Zhze9m9c8` | sync-ghl |
| Prep 2 date | `RHZA1YmoHFAJlAbYrLvw` | — |
| Journey date | `1amX2K1pwdx2r39wwd9d` | — |
| HI status | `JD7nHdPbcHWnEh2OEhhI` | updateOpportunityField (unused) |
| OHA status | `onZ8dloJ0Ho6JQpCt8PI` | — |
| Lead Facilitator | `H4LM6jbUwR1woLSj2kzV` | — |
| Facilitator email | `l9dFoho2FPShAznPUrM9` | — |
| HI URL | `pypItuyHO6POQ2NpoTcZ` | updateOpportunityField (unused) |

## What changed from the old platform

| Before (vanilla HTML + Python) | After (Next.js + Postgres) |
|------|------|
| JSON files deployed as static assets | Postgres (Supabase) — data never in the build |
| AI processing runs on Mike's laptop | `sync-jotform` endpoint does extraction + AI in one call |
| `refresh_data.py` cron rebuilds data.json | Direct DB reads, no intermediate file |
| `deploy.sh` with hardcoded Vercel token | Standard Vercel git deploy |
| No auth, CORS * everywhere | Clerk auth on all routes (readonly excluded) |
| Email draft saves to local filesystem (broken on Vercel) | `save-email-draft` writes to DB |
| Approval status read back from GHL notes on next cron | Approval written directly to DB |
| Facilitator page pulls from `clients.json` static file | Facilitator page hits GHL API directly |
