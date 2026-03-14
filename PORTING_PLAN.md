# Meadow Platform — Full Porting Plan

Everything from the old platform must be ported. This document tracks what's done, what's left, and how to build each piece.

## Status Overview

| Old Page | Purpose | Status | Priority |
|----------|---------|--------|----------|
| `index.html` | Health Intake Review (queue + detail + Quill + approve) | **DONE** | — |
| `facilitator.html` | Client List dashboard (table + drawer + GHL data) | **NOT PORTED** | P0 |
| `static-index.html` | Simplified readonly intake view | **DONE** (as `/intakes/[id]/readonly`) | — |
| `meadow-metrics/index.html` | Business metrics (funnel, ads, conversions) | **NOT PORTED** | P1 |
| `mission-control/index.html` | 5-day ops forecast (events, alerts, facilitator load) | **NOT PORTED** | P1 |
| `mission-control/agents.html` | AI team org chart | **SKIP** — informational only | — |
| `vercel-reports/` | Static markdown reports | **SKIP** — not operational | — |

---

## P0: Client List (`facilitator.html`)

### What it is

A table of ALL clients in the GHL "Standard Journey" pipeline, showing their session dates, pipeline stage, HI/OHA status, facilitator assignment, and health intake risk data. Clicking a row opens a slide-out drawer with full details.

**This is read-only — no mutations, just display.**

### Data sources

The client list merges data from two systems:

| Data | Source | How it's fetched |
|------|--------|-----------------|
| Name, email, phone | GHL contact (from opp search) | `GET /opportunities/search` |
| Pipeline stage | GHL opp `pipelineStageId` | Mapped via `STAGE_MAP` |
| Session dates (prep1, prep2, ip_prep, journey, ip_integ, integ1, integ2) | GHL opp custom fields | `GET /opportunities/{id}` per opp |
| Facilitator name + email | GHL opp custom fields | Same individual fetch |
| HI status, OHA status | GHL opp custom fields | Same individual fetch |
| Risk tier, hard/soft contraindications, soft score | Intake DB (`intakes` table) | Merged by email |
| Edited risk strat, approved_by, approved_at | Intake DB | Merged by email |
| Intake ID, risk strat link, HI link | Derived from intake DB | Constructed URLs |

### GHL Custom Fields — FULL list needed

Current `GHL_FIELDS` in `lib/ghl.ts` is missing several. Here's the complete set:

```typescript
export const GHL_FIELDS = {
  // Session dates
  PREP1_DATE: "47Nj5tCxZy6Zhze9m9c8",
  PREP2_DATE: "RHZA1YmoHFAJlAbYrLvw",
  IP_PREP_DATE: "BfOJM06jZJEVzM8IZWvF",      // NEW — In-Person Prep
  JOURNEY_DATE: "1amX2K1pwdx2r39wwd9d",
  IP_INTEG_DATE: "MqIrwgUFNNja5XI3zVmk",      // NEW — In-Person Integration
  INTEG1_DATE: "DkOFs5E0bvSEw9NkAYyv",        // NEW
  INTEG2_DATE: "vCu9ljd1boLc1iTYqEoD",        // NEW

  // Status fields
  HI_STATUS: "JD7nHdPbcHWnEh2OEhhI",
  OHA_STATUS: "onZ8dloJ0Ho6JQpCt8PI",

  // People
  LEAD_FACILITATOR: "H4LM6jbUwR1woLSj2kzV",
  FACILITATOR_EMAIL: "l9dFoho2FPShAznPUrM9",
  PHONE_OPP: "fWDDWkgGC79IssdGjIei",          // NEW — phone fallback on opp

  // Links
  HI_URL: "pypItuyHO6POQ2NpoTcZ",
} as const;
```

### GHL Pipeline Stage Map

The "Standard Journey" pipeline (`b1raXFqNeALdRrsQwPD5`) has 16 stages:

```typescript
export const PIPELINE_ID = "b1raXFqNeALdRrsQwPD5";

export const STAGE_MAP: Record<string, { order: number; name: string; group: string }> = {
  "59b0882d-8ba7-414e-8b30-ba8eb8b81758": { order: 1,  name: "Onboarding",              group: "onboarding" },
  "f9d83167-1471-4291-a333-2dd12d3a670f": { order: 2,  name: "Ready for Prep 1",        group: "prep" },
  "7c56c2e0-bff4-4419-aa62-e7c72428d7d4": { order: 3,  name: "Not Ready for Prep 2",    group: "prep" },
  "a5a89180-55de-4220-94bc-478fa29d6a5d": { order: 4,  name: "Ready for Prep 2",        group: "prep" },
  "7878a11b-7d13-4ccc-913c-2262611714ab": { order: 5,  name: "Not Ready for Journey",   group: "journey" },
  "44edcee2-3bb7-45f2-a21a-c440a09721cb": { order: 6,  name: "Ready for Journey",       group: "journey" },
  "009dcf45-59bd-4c34-8c29-c8ab0ddba95c": { order: 7,  name: "Not Ready for Integ 1",   group: "integration" },
  "81d12d23-826f-42f2-808d-64200c162c93": { order: 8,  name: "Ready for Integ 1",       group: "integration" },
  "d32a2495-436c-4ffd-8d13-6df809c3bd53": { order: 9,  name: "Not Ready for Integ 2",   group: "integration" },
  "e6759ec7-9904-46d3-8e79-244fcdd43636": { order: 10, name: "Ready for Integ 2",       group: "integration" },
  "6d864314-a081-45a7-a523-0ba96a3d4094": { order: 11, name: "Feedback Invite",          group: "done" },
  "0fb7dbb8-ff89-4d20-9e34-68edd167b37c": { order: 12, name: "Ready for Debrief",       group: "done" },
  "4467861d-8e0a-487b-baef-960c8e464d33": { order: 13, name: "Group Call Email",         group: "done" },
  "1fb21912-70df-4887-ae6c-a3b8996a5cc4": { order: 14, name: "Journey Done",            group: "done" },
  "4bf4ea07-0c39-46ca-a71c-85812aa53c48": { order: 15, name: "Refunded",                group: "done" },
  "3428066c-efac-4bd1-b3e0-4b1d19c1ac74": { order: 16, name: "Coaching",                group: "done" },
};
```

### The N+1 GHL API problem

GHL's `/opportunities/search` returns opps but with **null custom field values**. To get session dates, facilitator, statuses, we must fetch each opp individually via `GET /opportunities/{id}`. With 50-200 clients and rate limiting (0.15s per call), this takes 30-70 seconds.

**Solution: Cache in DB.**

- `POST /api/clients/sync` — fetches all pipeline opps from GHL, merges with intakes from DB, stores in a `client_cache` table (or a single JSON row). Takes 30-70s so it runs as a background job (Vercel Cron or manual trigger).
- `GET /api/clients` — reads from cache. Sub-100ms.

### Improvements over old logic

1. **Status normalization** — old code had inconsistent `""` vs `"None"` vs `"Pending"`. New code uses a proper enum: `"none" | "sent" | "signed" | "created" | "reviewed"`.

2. **Email merge with logging** — when a GHL client email doesn't match any intake, log a warning instead of silently returning empty intake data.

3. **`hi_link` and `risk_strat_link` were identical** — deduplicate into a single `intake_url` field.

4. **`chart_status` was just `oha_status` with a fallback** — keep this but normalize consistently.

### Files to create

| File | Purpose |
|------|---------|
| `lib/ghl.ts` | Add `STAGE_MAP`, `PIPELINE_ID`, new custom field IDs, `fetchPipelineOpportunities()`, `fetchOpportunityDetails()` |
| `lib/types.ts` | Add `Client` type |
| `app/api/clients/route.ts` | `GET` — read cached client list from DB |
| `app/api/clients/sync/route.ts` | `POST` — full GHL fetch + intake merge + cache write |
| `app/clients/page.tsx` | Table UI with search, filters, sortable columns |
| `components/client-drawer.tsx` | Slide-out detail panel (overview, sessions, risk card, contraindications) |

### UI features to port (from `facilitator.html`)

- **Table columns**: #, Name (+ facilitator sub-line), Stage (badge), Email, Phone, Prep 1, Prep 2, In-Person Prep, Journey, In-Person Integ, Integ 1, Integ 2, HI Status, Chart Status, Risk Strat link, HI Link
- **Search**: by name, email, facilitator
- **Filters**: by Stage group (Onboarding/Prep/Journey/Integration/Done), by HI Status (Reviewed/Signed/Sent/None)
- **Sortable columns**: click header to sort asc/desc
- **Slide-out drawer**: click row → right panel slides in with:
  - Overview (stage badge, facilitator, HI status, chart status)
  - Session schedule grid (7 date cards)
  - Risk tier card (color-coded, with score bar)
  - Hard contraindications list
  - Soft risk factors list
  - Clinical notes / edited risk strat
  - Approval metadata (who, when)
  - Links to risk strat + HI readonly pages
- **Tab navigation**: List (active), Board (stub), Health Intakes (link to `/intakes`), Payouts (stub), Calendar (stub), Schedule (stub)

---

## P1: Metrics Dashboard (`meadow-metrics/index.html`)

### What it is

Business analytics dashboard showing funnel metrics, ad performance, and conversion data across time periods.

### Data source

Loaded from `metrics.json` — a static file built by a cron on Mike's laptop. Contains pre-computed metrics for 7-day and 30-day windows.

The metrics data includes:
- **Overall**: Applications, Disqualified, Discovery Calls, Consults, Closed, Contract Value, Cash Collected
- **Meta Ads**: All the above + Ad Spend, Cost/Discovery, Cost/Consult, ROAS, conversion rates
- **Apply Form**: Applications through conversion funnel + rates
- **Daily funnel chart**: Applications, Discovery Scheduled, Consults Scheduled, Closed (per day)

### What needs to happen

1. **Figure out where `metrics.json` comes from** — there must be a script that computes it from GHL pipeline data + Meta Ads API. Find it in the old cron scripts.
2. **Build API route**: `GET /api/metrics?period=7d|30d` — either compute live or serve cached.
3. **Build page**: `/metrics/page.tsx` — metric cards grid + Chart.js line chart.
4. **Styling**: Dark teal/purple theme (distinct from the green platform theme).

### Files to create

| File | Purpose |
|------|---------|
| `app/api/metrics/route.ts` | Serve metrics data (from cache or computed) |
| `app/metrics/page.tsx` | Metrics dashboard UI |

---

## P1: Mission Control (`mission-control/index.html`)

### What it is

Operational command center showing a 5-day client event forecast. Shows every upcoming session (journeys, preps, integrations, consults) with client readiness indicators.

### Data source

Built by `mission-control/api/refresh.js` (or inline data). Pulls from:
- GHL calendar events (next 5 days)
- GHL opportunity custom fields (HI/OHA status, facilitator)
- Cross-references with intake data for risk tier

### Features

- **Stats bar**: Count of Journeys, In-Person sessions, Preps, Consults, Alerts, Total
- **5-day forecast cards**: Day-by-day view with:
  - Event rows: time, client name, event type badge (Journey/Room/Prep/Integration/Consult), facilitator, readiness pills (HI + OHA status)
  - Color-coded status dots
- **Sidebar**:
  - Integrity alerts (e.g., "Client has journey tomorrow but HI not reviewed")
  - Facilitator load chart (sessions per facilitator for the 5-day window)
  - Status legend

### What needs to happen

1. **GHL Calendar API integration** — fetch events for next 5 days. Need GHL calendar IDs.
2. **Cross-reference with opps** — for each event's contact, look up their opportunity for HI/OHA status.
3. **Build alert engine** — detect issues like "Journey in <24h but HI not reviewed".
4. **Build API**: `GET /api/mission-control` — returns the 5-day forecast.
5. **Build page**: `/mission-control/page.tsx` — forecast cards + sidebar.

### Files to create

| File | Purpose |
|------|---------|
| `lib/ghl-calendar.ts` | GHL Calendar API helpers |
| `app/api/mission-control/route.ts` | 5-day forecast endpoint |
| `app/mission-control/page.tsx` | Mission control UI |

---

## Shared work needed across all pages

### Navigation

The old platform had a nav bar with tabs. The new platform needs a consistent nav:
- **Health Intakes** → `/intakes`
- **Clients** → `/clients`
- **Mission Control** → `/mission-control`
- **Metrics** → `/metrics`

### GHL field config

All GHL custom field IDs need to move to env vars (deferred from earlier session but required before the client list works against a sandbox).

### DB schema additions

For the client cache:
```sql
CREATE TABLE client_cache (
  id TEXT PRIMARY KEY DEFAULT 'latest',
  data JSONB NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW()
);
```

Or simpler: just a `cache` table with key-value pairs.

---

## Implementation Order

1. **Client List (P0)** — this is the biggest gap. Do it first.
   - a. Add missing GHL fields + pipeline constants to `lib/ghl.ts`
   - b. Add GHL pipeline fetch functions
   - c. Add `Client` type to `lib/types.ts`
   - d. Build `POST /api/clients/sync` (GHL fetch + intake merge + cache)
   - e. Build `GET /api/clients` (read from cache)
   - f. Build `/clients/page.tsx` (table + search + filters + sort)
   - g. Build `components/client-drawer.tsx` (slide-out detail panel)
   - h. Add nav bar across all pages

2. **Mission Control (P1)** — second most useful for daily ops.
   - a. Build GHL calendar helpers
   - b. Build alert engine
   - c. Build API + page

3. **Metrics Dashboard (P1)** — useful but less urgent.
   - a. Find/audit the metrics computation script
   - b. Build API + page
