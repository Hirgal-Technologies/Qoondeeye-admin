-- Analytics rollup views for the admin dashboard.
--
-- Written against the confirmed production schema (queried via
-- information_schema.columns), not the earlier guessed one. Real shape:
--   public.profiles              (id uuid, email, full_name, user_type, created_at, ...)
--                                 — no auth-method column; provider comes from
--                                 Supabase Auth itself (auth.admin.listUsers()).
--   public.expenses              (id, user_id, amount, category, date,
--                                 entry_type text ['expense'|'income'|'transfer'],
--                                 is_recurring, recurrence_interval, account_id, ...)
--                                 — the single unified ledger table; there is no
--                                 separate `transactions` table.
--   public.accounts              (id, user_id, account_type, name, amount, currency, ...)
--   public.budgets                (id, user_id, account_id, category, amount, period,
--                                 start_date, end_date, is_active, ...)
--   public.budget_period_history (id, user_id, budget_id, account_id, category,
--                                 amount, period_start, period_end, spent, status)
--                                 — already tracks limit (amount) vs spent per period.
--
-- lib/data/*.ts currently queries these tables directly (not these views).
-- These views exist for the Phase 1.2 rollup-table plan; wire them in if/when
-- live-query performance becomes a problem.

create or replace view public.mv_daily_signups as
select
  date_trunc('day', created_at)::date as date,
  count(*) as count
from public.profiles
group by 1;

create or replace view public.mv_daily_transaction_rollup as
select
  date as date,
  entry_type as type,
  sum(amount) as volume,
  count(*) as count
from public.expenses
group by 1, 2;

create or replace view public.mv_category_rollup as
select
  date as date,
  category,
  sum(amount) as volume
from public.expenses
where entry_type = 'expense'
group by 1, 2;

create or replace view public.mv_budget_adherence_rollup as
select
  period_start as date,
  avg((spent > amount)::int)::numeric as pct_over,
  avg((spent <= amount)::int)::numeric as pct_under,
  avg(spent / nullif(amount, 0)) as avg_utilization
from public.budget_period_history
group by 1;
