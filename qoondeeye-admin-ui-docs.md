# Qoondeeye Admin UI Architecture and Component Guide

## Architecture summary

### Routes

- `/login` — public admin authentication.
- `/dashboard` — executive overview.
- `/dashboard/users` — acquisition, authentication, churn, and cohort retention.
- `/dashboard/finance` — anonymized financial activity.
- `/dashboard/system` — operational telemetry and incident groups.
- `/dashboard/reports` — standard and saved report entry point.
- `/dashboard/exports` — administrator-only aggregate CSV catalog.
- `/dashboard/support` — support/admin-only audited user lookup.
- `/dashboard/audit` — administrator-only audit event history.
- `/dashboard/settings` — current admin access and workspace readiness.
- `/api/**` — session-protected aggregate analytics, export, audit, and support handlers.

### Component hierarchy

`app/layout.tsx` owns fonts, metadata, and the early theme bootstrap. The server-rendered dashboard
layout resolves the authenticated admin and redirects unauthorized sessions before rendering
`DashboardShell`. The shell owns navigation, global date range, theme, command search, notifications,
profile state, mobile drawer state, and the responsive content boundary.

Pages compose `PageHeading`, `StatTile`, `ChartCard`, chart primitives, and `StatePanel`. Recharts
components receive transformed view models rather than database rows. Support and audit pages add
server-side role checks in addition to navigation visibility.

### Data flow

```text
Supabase
→ server-only data function
→ authenticated Route Handler
→ safe `{ data, error }` response
→ `useApiData` loading/error/success state
→ page view model
→ reusable metric/chart/table component
```

The browser never receives the Supabase service-role key and does not query Supabase directly.
General financial views expose only aggregate values. Support lookup accepts a user ID and a
minimum-length reason in a POST body, confirms support/admin permission, records the audit event, and
then returns a small read-only identity view.

### Server/client boundaries and state ownership

- Server: dashboard access checks, role checks, Supabase reads, support lookup, audit writes, CSV
  generation, metadata, and initial route composition.
- Client: chart rendering, API state, date-range selection, theme, navigation drawers/menus, search,
  table filtering, login, and support-form interaction.
- Global client state is intentionally limited to the dashboard date range. Everything else remains
  local to the component that owns the interaction.

### Access control

The dashboard layout confirms the Supabase session and membership in `admin_users` before rendering
protected UI. Each Route Handler repeats the appropriate authorization check. `viewer < support <
admin` is centralized in `lib/permissions.ts`; hiding a navigation item is never treated as the
security boundary.

## Main component APIs

### Metric card

```tsx
<StatTile
  label="Day 7 retention"
  value="42.6%"
  sublabel="Eligible signup cohorts"
  icon={ChartNoAxesCombined}
  tooltip="Share of eligible cohorts active on or after day seven."
  change={{ value: "3.2%", direction: "up", label: "vs. prior period" }}
  isLoading={false}
  error={null}
/>
```

The card supports a formatted value, context, trend, semantic icon, tooltip, critical state, loading
skeleton, and safe error state.

### Chart card

```tsx
<ChartCard<SignupPoint[]>
  title="Signup trend"
  description="New profiles created"
  summary="Line chart of daily signups."
  url="/api/users/signups"
  exportSource="users/signups"
>
  {(data) => <LineTrendChart data={data} xKey="date" yKey="count" />}
</ChartCard>
```

`ChartCard<T>` owns fetching, reserved loading space, empty/error behavior, retry, accessible title and
summary, and optional CSV action. The render function receives endpoint data only after a successful
non-empty response.

### Loading, empty, and error states

```tsx
<ChartSkeleton />

<StatePanel
  title="No new users"
  description="Try a wider date range."
/>

<StatePanel
  kind="error"
  title="Chart unavailable"
  description="We couldn’t load this data. Try again."
  actionLabel="Retry"
  onAction={retry}
/>
```

### Permission-gated component

```tsx
const identity = await getAdminSession();
if (!identity) redirect("/login");

if (!hasRole(identity, "admin")) {
  return (
    <StatePanel
      kind="permission"
      title="Administrator permission required"
      description="Your current role cannot view this module."
    />
  );
}
```

### Data-table pattern

Tables use native `table`, `caption`, scoped headers, semantic cells, a minimum readable width, and an
`overflow-x-auto` wrapper. Page-specific tables keep their columns explicit until sorting,
pagination, or column visibility warrants introducing TanStack Table.

## Implemented files

### Planning and documentation

- `qoondeeye-admin-ui-plan.md` — required implementation plan.
- `qoondeeye-admin-ui-docs.md` — architecture, component APIs, files, and quality record.
- `design-system/qoondeeye-admin/MASTER.md` — generated UI/UX guidance.
- `design-system/qoondeeye-admin/pages/dashboard.md` — generated dashboard overrides.
- `README.md` — project setup and architecture entry point.

### Application and theme

- `app/globals.css` — exact semantic HSL light/dark tokens, Tailwind v4 mapping, chart aliases, focus,
  skeleton, and reduced-motion rules.
- `app/layout.tsx` — admin metadata, no-index policy, fonts, and theme bootstrap.
- `app/(auth)/login/page.tsx` — accessible secure sign-in experience.
- `app/dashboard/page.tsx` — executive overview.
- `app/dashboard/users/page.tsx` — user analytics and cohort table.
- `app/dashboard/finance/page.tsx` — aggregate financial analytics.
- `app/dashboard/system/page.tsx` — health metrics and incident table.
- `app/dashboard/reports/page.tsx` — report catalog.
- `app/dashboard/exports/page.tsx` — administrator export catalog.
- `app/dashboard/support/page.tsx` — server-side support permission boundary.
- `app/dashboard/audit/page.tsx` — server-side audit permission boundary.
- `app/dashboard/settings/page.tsx` — workspace/access settings.

### Reusable components

- `components/dashboard/DashboardShell.tsx` — responsive shell, navigation, header, drawer, command
  menu, notifications, and profile menu.
- `components/dashboard/DashboardFilters.tsx` — global date-range context.
- `components/dashboard/ThemeToggle.tsx` — persisted light/dark theme control.
- `components/dashboard/PageHeading.tsx` — consistent page header.
- `components/dashboard/StatTile.tsx` — metric loading/error/trend system.
- `components/dashboard/ChartCard.tsx` — chart state and export wrapper.
- `components/dashboard/ExportButton.tsx` — accessible CSV action.
- `components/dashboard/SupportLookup.tsx` — reasoned, confirmed, audited lookup form.
- `components/dashboard/AuditLogTable.tsx` — filterable audit history table.
- `components/states/StatePanel.tsx` — loading, empty, error, retry, and permission feedback.
- `components/charts/LineTrendChart.tsx` — accessible single/multi-series trend chart.
- `components/charts/BarDistributionChart.tsx` — vertical/horizontal comparison chart.
- `components/charts/PieBreakdownChart.tsx` — restrained donut breakdown.

### Data, APIs, and utilities

- `lib/hooks/useApiData.ts` — abortable fetching, safe errors, and retry.
- `lib/data/overview.ts` and `app/api/overview/active-users/route.ts` — DAU/trailing-MAU trend.
- `lib/data/finance.ts` and `app/api/finance/income-expenses/route.ts` — income/expense comparison.
- `lib/data/audit.ts` and `app/api/audit/logs/route.ts` — audit history.
- `app/api/support/lookup/route.ts` — permission-checked, validated, audited support lookup.
- `lib/formatters.ts` — shared number, currency, percentage, and date formatting.
- `lib/csv.ts` — pure CSV serializer.
- `lib/date-range.ts` — stable date-range calculation.
- `lib/permissions.ts` — centralized role hierarchy.
- `lib/auth/session.ts` — now consumes the shared permission helper.
- `lib/api/export-registry.ts` and `app/api/export/csv/route.ts` — shared CSV serializer extraction.
- `tests/core-utils.test.ts` — built-in Node tests for formatting, CSV, roles, and date ranges.
- `package.json` / `pnpm-lock.yaml` — Lucide icons and the test command.
- `tsconfig.json` — test-compatible TypeScript import setting.
- `eslint.config.mjs` — excludes local Cursor skill bundles from application linting.

## Quality checklist

- [x] Next.js production build and strict TypeScript pass.
- [x] ESLint passes with no application warnings.
- [x] Built-in Node test suite passes.
- [x] Responsive rules cover 375, 768, 1024, 1280, and 1440px layouts.
- [x] Light and `.dark:root` themes use the requested semantic HSL values.
- [x] Keyboard focus, landmarks, labels, table semantics, and reduced motion are implemented.
- [x] Metric, chart, and table loading states reserve layout space.
- [x] Context-specific empty, error, no-results, and permission states are implemented.
- [x] Supabase service credentials remain server-only.
- [x] General analytics pages contain aggregate/anonymized data only.
- [x] Support lookup requires role, reason, confirmation, and an audit event.

## Remaining work

- Replace the ledger-activity DAU/MAU and retention proxy when dedicated session telemetry ships.
- Connect mobile sync, OCR, authentication-error, API-latency, and storage event sources.
- Confirm production Supabase table/column assumptions in migration `0002_analytics_views.sql`.
- Add saved-report persistence and scheduling.
- Define and implement the policy for audit-log CSV export.
- Add browser-based end-to-end coverage when the project adopts an E2E runner.
