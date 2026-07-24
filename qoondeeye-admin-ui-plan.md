# Qoondeeye Admin UI Implementation Plan

## Scope and constraints

This implementation upgrades the existing Next.js 16 App Router dashboard without replacing its
Supabase authentication, server-side authorization, aggregate data functions, Route Handlers, or
CSV export flow. The first delivery focuses on the shared design system, application shell, overview,
user analytics, financial activity, and system health vertical slices. Support tooling remains gated
until its audit and reason-for-access workflow can be backed by real server-side persistence.

The generated UI/UX Pro Max guidance is advisory. Where it conflicts with the product brief, the
product brief wins: Qoondeeye uses the requested shadcn-style neutral HSL palette, the existing Geist
type family, restrained motion, and compact dashboard sizing rather than the generated blue palette,
oversized editorial typography, or landing-page patterns.

## Design direction

- Calm, high-contrast fintech interface built from semantic HSL tokens.
- Light mode uses white surfaces, near-black type, and quiet neutral layers.
- Dark mode uses true-black page chrome with slightly lifted cards and popovers.
- Destructive red is the only persistent chromatic semantic color. Success and warning use
  restrained, accessible status tokens only where state needs them.
- Cards use a consistent `0.5rem` radius, one-pixel borders, and very subtle shadows.
- Charts use neutral value ramps and distinguish series through contrast, line style, labels, and
  accessible summaries rather than decorative color.

## Page structure

- Root layout: fonts, metadata, semantic tokens, and theme bootstrap.
- Login: focused admin sign-in with security notice and inline error/loading feedback.
- Dashboard layout: server-side session/role gate wrapping a client-side shell.
- Dashboard shell:
  - collapsible desktop sidebar;
  - mobile navigation drawer;
  - active-route state and role-aware unavailable items;
  - sticky header with breadcrumb/title, date-range control, search trigger, notification control,
    theme switcher, and profile menu;
  - responsive main content container.
- Overview: page heading, eight KPI cards, user-growth/activity charts, retention, financial trend,
  and system-health summary.
- User analytics: headline KPIs, signup/auth breakdown, cohort retention table, and segment insight.
- Financial activity: aggregated-only KPIs and charts with a visible privacy notice.
- System health: severity summary, sync/OCR trends, incidents/errors table, and instrumentation notice.

## Component architecture

- `components/layout`: shell, sidebar/navigation, header, and page heading.
- `components/dashboard`: metric cards, chart cards, status summary, toolbar, and export actions.
- `components/charts`: Recharts presentation components with semantic tokens and text summaries.
- `components/states`: reusable loading, empty, error, and permission states.
- `components/ui`: small primitives such as theme toggle, buttons, badges, and tooltips when useful.
- `lib`: server-only data/auth stays separate from client presentation; formatters, routes, and
  permission definitions are centralized.

Reusable components expose focused TypeScript props and never accept raw Supabase responses. Server
components own authentication and privileged data boundaries. Client components are limited to
navigation state, theme selection, filters, charts, retry/export actions, and menus.

## Responsive behavior

- `>=1280px`: expanded sidebar and multi-column KPI/chart grid.
- `1024px`: collapsible sidebar with two- to four-column metric grids.
- `768px`: icon sidebar or mobile-style control density; tables scroll horizontally.
- `375px`: drawer navigation, stacked content, compact header, full-width controls, and charts with
  a minimum readable height.
- Interactive controls maintain a minimum 44px target. Main content has adaptive gutters and no
  horizontal page overflow.

## Accessibility requirements

- Semantic landmarks, heading order, table headers/captions, and form labels.
- `aria-current` for active navigation and `aria-expanded`/`aria-controls` for drawers and menus.
- Visible two-pixel focus rings using the semantic ring token.
- Non-color status labels with icons/text; chart sections include screen-reader summaries.
- Escape closes drawers/menus, overlays restore focus, and background scrolling is prevented.
- Reduced-motion disables nonessential transitions and chart animation.
- Text and controls target WCAG 2.1 AA contrast in both themes.

## Loading, empty, error, and permission states

- Metric cards reserve value space and render matching skeletons.
- Chart cards reserve chart height and expose specific empty/error copy plus retry.
- Tables render skeleton rows, no-results guidance, and horizontal overflow on small screens.
- Session errors redirect to login; unauthorized modules render a permission state without leaking
  protected data.
- System telemetry failures are explained as unavailable instrumentation rather than raw database
  errors.
- Support tools remain hidden/locked for insufficient roles and are not exposed as a visual-only
  permission gate.

## Implementation sequence

1. Replace legacy color variables with exact semantic HSL tokens and Tailwind v4 mappings.
2. Add shared route, permission, formatter, UI-state, metric, and heading primitives.
3. Rebuild the responsive dashboard shell, mobile drawer, theme control, and role-aware navigation.
4. Upgrade shared chart cards and Recharts primitives for accessible loading/empty/error behavior.
5. Recompose the overview dashboard into the complete executive summary.
6. Upgrade user analytics, financial activity, and system health using the shared primitives.
7. Refine login, dark mode, keyboard behavior, and responsive layouts.
8. Add focused unit tests only if an existing test runner is available; otherwise document the gap.
9. Run type/build and lint validation, fix regressions, and update architecture documentation.

