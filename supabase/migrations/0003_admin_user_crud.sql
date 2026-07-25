-- Preserve the identity of an audit actor after their dashboard access is revoked.
-- This allows admin_users rows to be deleted without deleting audit history.

-- Existing projects may already have admin_users with a narrower role check.
-- Normalize it to the role model used by the dashboard CRUD and permissions.
alter table public.admin_users
  drop constraint if exists admin_users_role_check;

alter table public.admin_users
  add constraint admin_users_role_check
  check (role in ('admin', 'support', 'viewer'));

-- Some existing projects created admin_users independently of the foundation
-- migration. Keep this migration safe for those projects as well.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references public.admin_users (id) on delete set null,
  actor_email text not null,
  actor_role text not null,
  action text not null,
  target_user_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_log
  add column if not exists actor_email text,
  add column if not exists actor_role text;

update public.audit_log log
set
  actor_email = coalesce(log.actor_email, admin.email),
  actor_role = coalesce(log.actor_role, admin.role)
from public.admin_users admin
where log.actor_id = admin.id
  and (log.actor_email is null or log.actor_role is null);

alter table public.audit_log
  alter column actor_email set not null,
  alter column actor_role set not null,
  alter column actor_id drop not null;

alter table public.audit_log
  drop constraint if exists audit_log_actor_id_fkey;

alter table public.audit_log
  add constraint audit_log_actor_id_fkey
  foreign key (actor_id)
  references public.admin_users (id)
  on delete set null;

create index if not exists audit_log_actor_id_idx
  on public.audit_log (actor_id);
create index if not exists audit_log_target_user_id_idx
  on public.audit_log (target_user_id);
create index if not exists audit_log_created_at_idx
  on public.audit_log (created_at desc);

alter table public.audit_log enable row level security;

drop policy if exists "audit_log_select_admin_only"
  on public.audit_log;

create policy "audit_log_select_admin_only"
  on public.audit_log for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users admin
      where admin.id = auth.uid() and admin.role = 'admin'
    )
  );
