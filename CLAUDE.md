# CLAUDE.md — Meadow Platform

## What this is

Meadow Medicine is a physician-led psilocybin therapy practice in Portland, Oregon. This is the Health Intake Review platform — used by staff to review, triage, and approve patient health intake submissions.

**Medical Director:** Dr. Tracy Townsend
**Operations:** Mike Townsend
**Developer:** Gonza

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** Clerk (with role-based access via `publicMetadata`)
- **Styling:** Tailwind CSS v4
- **UI components:** shadcn/ui
- **Database:** Postgres (Supabase) via `pg` Pool
- **Hosting:** Vercel
- **AI:** Anthropic Claude API (`claude-sonnet-4-5-20250929`) — one call per intake

## Key integrations

- **GoHighLevel** — CRM, source of truth for clients. Location ID: `A4AjOJ6RQgzEHxtmZsOr`
- **Jotform** — Health intake form submissions (form `243226217742049`)
- **Gmail API** — Sends medication guidance emails via service account delegation
- **Anthropic Claude** — Generates medication guidance email + risk stratification

## Repo structure

```
app/
├── api/                          # API routes
│   ├── intakes/                  # CRUD, sync, approve, PDF, email
│   ├── admin/users/              # User management (list, invite, role change)
│   ├── facilitator/              # Facilitator client list
│   └── test-email/               # Email testing endpoint
├── admin/page.tsx                # Admin user management (invite, roles)
├── intakes/                      # Pages
│   ├── page.tsx                  # Queue (needs review + completed)
│   └── [id]/
│       ├── page.tsx              # Detail view (edit risk strat + email)
│       └── readonly/page.tsx     # Facilitator readonly view
├── sign-in/                      # Clerk sign-in
├── layout.tsx                    # Root layout (Nunito font, ClerkProvider)
├── globals.css                   # Tailwind + Quill styles
└── page.tsx                      # Redirects to /intakes
components/
├── providers.tsx                 # QueryClientProvider (React Query)
├── intake-card.tsx               # Card with archive/delete/view actions
├── quill-editor.tsx              # Rich text editor wrapper
├── risk-tier-badge.tsx           # Green/yellow/red badge
└── ui/                           # shadcn/ui primitives
lib/
├── auth.ts                       # Role helpers (getUserRole, isAdmin, getRoleFromClaims)
├── api-client.ts                 # Client-side apiFetch + ApiError
├── api-utils.ts                  # Server-side getErrorMessage + apiError
├── db.ts                         # Postgres CRUD (parameterized queries)
├── ai.ts                         # Claude API call for risk strat + email
├── risk-engine.ts                # Deterministic triage (hard flags + soft score)
├── ghl.ts                        # GoHighLevel API helpers
├── gmail.ts                      # Gmail send via service account
├── jotform.ts                    # Jotform submission fetcher
├── types.ts                      # TypeScript types
└── utils.ts                      # cn() helper
proxy.ts                          # Clerk auth middleware (role-based route protection)
types/globals.d.ts                # Session claims type (role in publicMetadata)
scripts/migrate-clerk-users.ts    # Dev→prod Clerk user migration
```

## Roles & access control

Auth uses Clerk `publicMetadata.role` exposed via session claims. Enforced in `proxy.ts` middleware.

| Role | Default | Access |
|---|---|---|
| `admin` | No | Everything — intakes, clients, mission control, admin page, all API routes |
| `facilitator` | No | `/clients`, `/api/clients`, `/api/facilitator` only |
| `client` | **Yes** (no metadata = client) | Nothing — placeholder for future client portal |

- Roles are set in Clerk user `publicMetadata`: `{ "role": "admin" }`
- Session token must be customized in Clerk Dashboard: `{ "metadata": "{{user.public_metadata}}" }`
- Role helpers live in `lib/auth.ts` — `getUserRole()`, `isAdmin()`, `getRoleFromClaims()`
- Nav links filter by role (see `components/nav.tsx`)
- Admin page (`/admin`) allows inviting users and changing roles via Clerk Backend API
- Public routes (readonly intake, PDF, webhook, sign-in) bypass role checks

## The risk engine

1. **Extract** — Parse Jotform submission JSON into structured client data
2. **Hard scan** — Regex match against ~100 condition patterns + ~130 medication names. Deterministic.
3. **Soft score** — Point system (age, substance use, med count). 0-10 scale. Deterministic.
4. **Risk tier** — `hard_flags → red`, `soft >= 5 → red`, `soft >= 2 → yellow`, else `green`. Deterministic.
5. **Claude call** — One API call. Generates client email + internal risk strat. This is the only AI step.

## GHL custom field IDs (opportunity-level)

| Field | ID |
|---|---|
| Prep 1 date | `47Nj5tCxZy6Zhze9m9c8` |
| Prep 2 date | `RHZA1YmoHFAJlAbYrLvw` |
| Journey date | `1amX2K1pwdx2r39wwd9d` |
| HI status | `JD7nHdPbcHWnEh2OEhhI` |
| OHA status | `onZ8dloJ0Ho6JQpCt8PI` |
| Lead Facilitator | `H4LM6jbUwR1woLSj2kzV` |
| Facilitator email | `l9dFoho2FPShAznPUrM9` |
| HI URL | `pypItuyHO6POQ2NpoTcZ` |

## Environment variables

All secrets go in `.env.local` (never committed):

```
POSTGRES_URL=
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=
ANTHROPIC_API_KEY=
GHL_API_KEY=
JOTFORM_API_KEY=
GOOGLE_SERVICE_ACCOUNT_EMAIL=
GOOGLE_PRIVATE_KEY=
GMAIL_DELEGATE_EMAIL=
```

## Commands

```bash
# Install dependencies
pnpm install

# Local dev
pnpm dev

# Type check
npx tsc --noEmit

# Deploy (via Vercel CLI or git push)
vercel
```

## Error handling & data fetching conventions

- **Server-side errors:** API routes use `apiError(getErrorMessage(e))` from `lib/api-utils.ts`. All error responses are `{ error: string }` with an HTTP status code.
- **Client-side fetching:** Use `apiFetch<T>()` from `lib/api-client.ts`. It throws `ApiError` (with `.status`) on non-2xx responses, auto-sets JSON headers.
- **React Query:** All data fetching uses `@tanstack/react-query`. Provider is in `components/providers.tsx`, wrapped in `app/layout.tsx`.
  - **Queries:** `useQuery({ queryKey: [...], queryFn: () => apiFetch(...) })`
  - **Mutations:** `useMutation({ mutationFn, onSuccess, onError })` — use `isPending` for loading states
  - **Invalidation:** After mutations, call `queryClient.invalidateQueries({ queryKey: [...] })`
  - **Query keys:** `['intakes']` for list, `['intake', id]` for detail
- **No manual loading booleans** — use `isLoading` / `isPending` from React Query hooks

## Production safety — READ THIS

**All environments (including Vercel preview deployments) are connected to production GHL, production database, and production Gmail.** There is no staging environment. This means any code that runs on a preview deployment can modify real patient data or send real emails.

### Dangerous files (require review by Gonza before merging)

| File | Risk |
|---|---|
| `lib/ghl.ts` — `addNote()`, `updateOpportunity()`, `triggerWebhook()` | Writes to production GHL (notes, opportunity fields, webhooks) |
| `lib/db.ts` — `upsertIntake()`, `updateIntakeFields()`, `claimIntakeForSending()`, `deleteIntake()`, `upsertClientCache()`, `insertFeedback()` | Writes to / deletes from the production database |
| `lib/gmail.ts` — `sendEmail()` | Sends real emails to real patients |
| `app/api/intakes/[id]/approve/route.ts` | Full approve flow: DB + GHL webhook + email |
| `app/api/intakes/[id]/resend-email/route.ts` | Sends email to patients |
| `app/api/intakes/[id]/actions/route.ts` | Archive/delete intakes |
| `app/api/test-email/route.ts` | Sends test emails |
| `proxy.ts` | Auth middleware — breaking this could lock everyone out or expose data |

### Rules for Claude Code

- **Never** modify the dangerous files listed above without explicitly confirming with the user that they understand the production implications.
- **Never** add new API routes that perform POST/PUT/DELETE to GHL, the database, or Gmail without flagging the risk.
- **Never** modify or delete environment variable references — these are production secrets.
- When in doubt about whether a change could affect production data, **stop and ask**.
- Prefer UI-only changes (components, pages, styles) which are always safe.

### Safe areas (no production risk)

- UI components (`components/`)
- Page layouts and styling (`app/**/page.tsx`, `globals.css`)
- Read-only display logic
- Types (`lib/types.ts`)
- Utility functions (`lib/utils.ts`)
- Tailwind config, `package.json` (dependency additions)

### Contributor workflow

All changes go through pull requests — never push directly to `main`.

```bash
# Start a new change
git checkout main && git pull
git checkout -b your-name/description

# After making changes
git add <files>
git commit -m "What you changed"
git push -u origin your-name/description

# Open a PR (Claude Code can do this for you)
gh pr create --title "What you changed" --body "Description"
```

Vercel will create a preview deployment for every PR. Use the preview URL to test. Gonza reviews and merges.

## GHL API gotchas

- Opportunity fields use `fieldValue`/`fieldValueString`; Contact fields use `value`
- Old pipeline IDs silently fail
- Calendar timestamps are epoch milliseconds
