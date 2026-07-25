-- Analytics performance: indexes, SQL aggregates, and a daily activity rollup.
-- Apply after 0001–0003. Service-role only — revoke public execute below.

-- ---------------------------------------------------------------------------
-- Indexes (no CONCURRENTLY: migration runners wrap statements in a transaction)
-- ---------------------------------------------------------------------------

create index if not exists expenses_date_idx
  on public.expenses (date);

create index if not exists expenses_user_id_date_idx
  on public.expenses (user_id, date);

create index if not exists profiles_created_at_idx
  on public.profiles (created_at);

-- ---------------------------------------------------------------------------
-- Nightly-style rollup: O(days) trend reads once populated
-- ---------------------------------------------------------------------------

create table if not exists public.daily_activity (
  date date primary key,
  dau integer not null default 0,
  volume numeric not null default 0,
  entries integer not null default 0,
  refreshed_at timestamptz not null default now()
);

create index if not exists daily_activity_date_idx
  on public.daily_activity (date);

alter table public.daily_activity enable row level security;

-- Distinct users per day — needed for accurate trailing MAU from the rollup.
create table if not exists public.daily_active_users (
  date date not null,
  user_id uuid not null,
  primary key (date, user_id)
);

create index if not exists daily_active_users_date_idx
  on public.daily_active_users (date);

alter table public.daily_active_users enable row level security;

create or replace function public.refresh_daily_activity(
  p_from date default (current_date - 90),
  p_to date default current_date
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.daily_active_users
  where date between p_from and p_to;

  insert into public.daily_active_users (date, user_id)
  select distinct e.date::date, e.user_id
  from public.expenses e
  where e.date between p_from and p_to;

  insert into public.daily_activity (date, dau, volume, entries, refreshed_at)
  select
    e.date::date,
    count(distinct e.user_id)::integer,
    coalesce(sum(e.amount), 0),
    count(*)::integer,
    now()
  from public.expenses e
  where e.date between p_from and p_to
  group by 1
  on conflict (date) do update set
    dau = excluded.dau,
    volume = excluded.volume,
    entries = excluded.entries,
    refreshed_at = excluded.refreshed_at;
end;
$$;

revoke all on function public.refresh_daily_activity(date, date) from public;
grant execute on function public.refresh_daily_activity(date, date) to service_role;

-- ---------------------------------------------------------------------------
-- Aggregate RPCs — compute in Postgres; Node only receives the result shape
-- ---------------------------------------------------------------------------

create or replace function public.admin_overview_summary()
returns json
language sql
stable
security definer
set search_path = public
as $$
  with bounds as (
    select
      (now() - interval '7 days') as since_7d,
      (now() - interval '30 days') as since_30d,
      (current_date - 1) as since_1d_date,
      (current_date - 30) as since_30d_date
  ),
  volume_30d as (
    select
      coalesce(sum(e.amount), 0) as total_volume,
      count(*)::integer as total_count
    from public.expenses e, bounds b
    where e.date >= b.since_30d_date
  )
  select json_build_object(
    'totalUsers', (select count(*)::integer from public.profiles),
    'newUsers7d', (
      select count(*)::integer
      from public.profiles p, bounds b
      where p.created_at >= b.since_7d
    ),
    'newUsers30d', (
      select count(*)::integer
      from public.profiles p, bounds b
      where p.created_at >= b.since_30d
    ),
    'dau', (
      select count(distinct e.user_id)::integer
      from public.expenses e, bounds b
      where e.date >= b.since_1d_date
    ),
    'mau', (
      select count(distinct e.user_id)::integer
      from public.expenses e, bounds b
      where e.date >= b.since_30d_date
    ),
    'totalTransactionVolume30d', (select total_volume from volume_30d),
    'totalTransactionCount30d', (select total_count from volume_30d)
  );
$$;

revoke all on function public.admin_overview_summary() from public;
grant execute on function public.admin_overview_summary() to service_role;

create or replace function public.admin_active_users_trend(p_from date, p_to date)
returns table(date date, dau bigint, mau bigint)
language sql
stable
security definer
set search_path = public
as $$
  with activity as (
    select distinct e.user_id, e.date::date as day
    from public.expenses e
    where e.date >= (p_from - 29) and e.date <= p_to
  ),
  days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  )
  select
    d.day as date,
    (
      select count(distinct a.user_id)
      from activity a
      where a.day = d.day
    ) as dau,
    (
      select count(distinct a.user_id)
      from activity a
      where a.day between (d.day - 29) and d.day
    ) as mau
  from days d
  order by 1;
$$;

revoke all on function public.admin_active_users_trend(date, date) from public;
grant execute on function public.admin_active_users_trend(date, date) to service_role;

-- Prefer the rollup when it covers the requested window (after refresh_daily_activity).
create or replace function public.admin_active_users_trend_from_rollup(
  p_from date,
  p_to date
)
returns table(date date, dau bigint, mau bigint)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select generate_series(p_from, p_to, interval '1 day')::date as day
  )
  select
    d.day as date,
    coalesce(
      (select da.dau::bigint from public.daily_activity da where da.date = d.day),
      0
    ) as dau,
    (
      select count(distinct dau.user_id)
      from public.daily_active_users dau
      where dau.date between (d.day - 29) and d.day
    ) as mau
  from days d
  order by 1;
$$;

revoke all on function public.admin_active_users_trend_from_rollup(date, date) from public;
grant execute on function public.admin_active_users_trend_from_rollup(date, date) to service_role;

create or replace function public.admin_retention_curve(p_cohort_window_days integer default 30)
returns table(day integer, retention_pct double precision)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cohort_since timestamptz := now() - ((p_cohort_window_days + 30) || ' days')::interval;
begin
  return query
  with cohort as (
    select p.id, p.created_at
    from public.profiles p
    where p.created_at >= cohort_since
  ),
  last_activity as (
    select e.user_id, max(e.date::date) as last_date
    from public.expenses e
    where e.user_id in (select id from cohort)
    group by e.user_id
  ),
  days as (
    select unnest(array[1, 7, 30]) as day
  )
  select
    d.day,
    case
      when count(*) filter (
        where c.created_at + (d.day || ' days')::interval <= now()
      ) = 0 then 0::double precision
      else (
        count(*) filter (
          where c.created_at + (d.day || ' days')::interval <= now()
            and la.last_date is not null
            and la.last_date >= (c.created_at::date + d.day)
        )::double precision
        / count(*) filter (
          where c.created_at + (d.day || ' days')::interval <= now()
        )::double precision
      )
    end as retention_pct
  from days d
  cross join cohort c
  left join last_activity la on la.user_id = c.id
  group by d.day
  order by d.day;
end;
$$;

revoke all on function public.admin_retention_curve(integer) from public;
grant execute on function public.admin_retention_curve(integer) to service_role;
