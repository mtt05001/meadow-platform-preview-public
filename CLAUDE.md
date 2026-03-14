# CLAUDE.md — Meadow Platform

## What this is

Meadow Medicine is a physician-led psilocybin therapy practice in Portland, Oregon. This is the Health Intake Review platform — used by staff to review, triage, and approve patient health intake submissions.

**Medical Director:** Dr. Tracy Townsend
**Operations:** Mike Townsend
**Developer:** Gonza

## Tech stack

- **Framework:** Next.js 16 (App Router)
- **Auth:** Clerk
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
│   ├── facilitator/              # Facilitator client list
│   └── test-email/               # Email testing endpoint
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
proxy.ts                          # Clerk auth middleware
```

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

## GHL API gotchas

- Opportunity fields use `fieldValue`/`fieldValueString`; Contact fields use `value`
- Old pipeline IDs silently fail
- Calendar timestamps are epoch milliseconds
