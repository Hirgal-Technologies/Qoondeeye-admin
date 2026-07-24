# Qoondeeye Admin

Internal analytics dashboard for Qoondeeye. Next.js 16 (App Router) + Tailwind v4 +
Supabase.

See [qoondeeye-admin-ui-plan.md](./qoondeeye-admin-ui-plan.md) for the implementation
plan and [qoondeeye-admin-ui-docs.md](./qoondeeye-admin-ui-docs.md) for the route
architecture, component APIs, access-control model, quality checklist, and remaining work.

## Setup

1. `pnpm install`
2. Copy `.env.example` to `.env` and fill in:
   - `SUPABASE_URL` / `SUPABASE_KEY` — same names as the mobile app uses, from Supabase
     dashboard → Project Settings → API (`SUPABASE_KEY` is the anon key).
   - `SUPABASE_SERVICE_ROLE_KEY` — same page, **server-only**, never commit or expose
     to the client. Route Handlers use this to run aggregate queries that bypass RLS.
3. Apply the SQL migrations in `supabase/migrations/` against your Supabase project
   (SQL editor or `supabase db push`), **in order**:
   - `0001_admin_foundation.sql` — `admin_users` + `audit_log`, safe to run as-is.
   - `0002_analytics_views.sql` — rollup views. **This one assumes table/column names**
     (see the header comment in the file) because it was written without direct
     access to the production schema. Check it against your actual `transactions`/
     `budgets`/`accounts`/`subscriptions`/`loans` tables and adjust before running.
4. Add yourself to `admin_users` (after creating a Supabase Auth user for yourself):
   ```sql
   insert into admin_users (id, email, role) values ('<your-auth-uid>', 'you@qoondeeye.com', 'admin');
   ```
5. `pnpm dev` → http://localhost:3000 redirects to `/login`.

## Architecture

- **Auth**: Supabase Auth (email/password) + `admin_users` table. The dashboard
  layout and every protected Route Handler verify the signed-in admin and required
  role server-side.
- **Data access**: the browser never talks to Supabase directly. All reads go through
  `app/api/**/route.ts` Route Handlers, which call typed functions in `lib/data/*.ts`
  using the service-role client (`lib/supabase/admin.ts`).
- **Theme**: semantic shadcn-style HSL variables in `app/globals.css`, including a
  true-black dark theme. Tailwind v4 tokens map directly to those semantic roles.
- **Charts**: `components/charts/*` (Recharts) + `components/dashboard/ChartCard.tsx`
  (loading/empty/error/retry wrapper, fetched via `lib/hooks/useApiData.ts`). Chart
  series use the same neutral light/dark token system.
- **CSV export**: `GET /api/export/csv?source=<key>&...` — `lib/api/export-registry.ts`
  maps a `source` key to the same data-access function each chart uses, so exports
  always match what's on screen.
- **Support access**: `/dashboard/support` requires support/admin role, a reason,
  explicit authorization confirmation, and an audit event before returning limited
  read-only identity details.

## Known gaps / what's deferred

- **`0002_analytics_views.sql` assumptions**: written against guessed table/column
  names. Verify before applying.
- **DAU/MAU/retention proxy**: no dedicated sessions/events table exists yet, so
  "active" is approximated as "logged a transaction." Swap for real session telemetry
  if/when it exists.
- **System health (Phase 3)**: `sync_events`, `ocr_events`, `error_logs` tables don't
  exist yet — those endpoints will error until the mobile app emits that telemetry
  and the tables are created.
- **Support scope**: only audited, read-only identity lookup is implemented. Per-user
  financial drill-down remains intentionally unavailable.
- **Rollup performance**: Phase 1.2 called for materialized rollup tables refreshed
  on a schedule; the current data-access layer queries live tables directly (fine at
  current scale, revisit if dashboard load times degrade).
