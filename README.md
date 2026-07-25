# Qoondeeye Admin

Internal analytics dashboard for Qoondeeye.

**Stack:** Next.js 16 (App Router) · Tailwind v4 · Supabase

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in:
   - `SUPABASE_URL` / `SUPABASE_KEY` — from Supabase → Project Settings → API (`SUPABASE_KEY` is the anon key).
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, **server-only**. Never expose to the client.
3. Apply SQL migrations in `supabase/migrations/` **in order**:
   - `0001_admin_foundation.sql` — `admin_users` + `audit_log`
   - `0002_analytics_views.sql` — rollup views (verify table/column names against your schema first)
   - `0003_admin_user_crud.sql` — audit actor snapshots required for safe access revocation
   - `0004_analytics_performance.sql` — indexes, SQL aggregate RPCs, `daily_activity` rollup
4. Add yourself to `admin_users` after creating a Supabase Auth user:
   ```sql
   insert into admin_users (id, email, role)
   values ('<your-auth-uid>', 'you@qoondeeye.com', 'admin');
   ```
5. `pnpm dev` → http://localhost:3000 redirects to `/login`

## Project layout

| Path | Purpose |
|------|---------|
| `app/` | Routes, layouts, and API handlers |
| `components/` | Dashboard UI, charts, navigation, and shared states |
| `features/` | Feature contracts, use cases, and server-only query modules |
| `lib/` | Cross-cutting API, auth, Supabase, hooks, and utilities |
| `supabase/` | SQL migrations |
| `design-system/` | Design tokens and page specs |
| `docs/` | Architecture notes and UI plan |
| `tests/` | Unit tests |

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Local development server |
| `pnpm build` | Production build |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint |
| `pnpm test` | Unit tests |

## Architecture

- **Auth** — Supabase Auth + `admin_users`. Dashboard layout and protected Route Handlers verify admin role server-side.
- **Data** — Browser never talks to Supabase. Thin `app/api/**` adapters call server-only feature query modules with the service-role client.
- **Theme** — Semantic HSL tokens in `app/globals.css` (light + true-black dark).
- **Charts** — `components/charts/*` + `ChartCard` with loading/empty/error via `useApiData`.
- **CSV export** — `GET /api/export/csv?source=<key>` uses the same data functions as the charts.
- **Support** — `/dashboard/support` requires role, reason, confirmation, and an audit event.

More detail: [docs/clean-architecture.md](./docs/clean-architecture.md) · [docs/ui-architecture.md](./docs/ui-architecture.md) · [docs/performance.md](./docs/performance.md) · [docs/ui-plan.md](./docs/ui-plan.md)

## Known gaps

- `0002_analytics_views.sql` was written against assumed schema — verify before applying.
- DAU/MAU/retention use transaction activity as a proxy until real session telemetry exists.
- System health endpoints need `sync_events` / `ocr_events` / `error_logs` from the mobile app.
- Support is identity lookup only — no per-user financial drill-down.
- Apply `0004_analytics_performance.sql`, then run `refresh_daily_activity` on a schedule for O(days) trend reads. See [docs/performance.md](./docs/performance.md).
