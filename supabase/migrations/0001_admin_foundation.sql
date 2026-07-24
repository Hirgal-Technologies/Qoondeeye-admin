-- Admin dashboard foundation: admin_users + audit_log.
-- Safe to run standalone; does not touch any existing consumer tables.

create table if not exists public.admin_users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  role text not null default 'viewer' check (role in ('admin', 'support', 'viewer')),
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

-- An admin can read the admin_users roster (needed by the dashboard UI to
-- show "who else has access"). Writes are service-role only (no policy below
-- grants insert/update/delete to authenticated users).
create policy "admin_users_select_self_or_admin"
  on public.admin_users for select
  to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.admin_users au
      where au.id = auth.uid() and au.role = 'admin'
    )
  );

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid not null references public.admin_users (id),
  action text not null,
  target_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists audit_log_actor_id_idx on public.audit_log (actor_id);
create index if not exists audit_log_target_user_id_idx on public.audit_log (target_user_id);
create index if not exists audit_log_created_at_idx on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

-- Only admins can read the audit log; all writes go through the service-role
-- key from Route Handlers, so no insert policy is granted here.
create policy "audit_log_select_admin_only"
  on public.audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.id = auth.uid() and au.role = 'admin'
    )
  );
