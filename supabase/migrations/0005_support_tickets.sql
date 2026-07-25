-- Support tickets: case tracking for the support-tools dashboard page.
-- Writes go through the service-role key from Route Handlers (same pattern
-- as admin_users / audit_log), so no insert/update policy is granted here.

create table if not exists public.support_tickets (
  id bigint generated always as identity primary key,
  subject text not null,
  description text not null,
  status text not null default 'open' check (status in ('open', 'pending', 'resolved', 'closed')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  requester_email text not null,
  requester_user_id uuid references auth.users (id) on delete set null,
  assignee_id uuid references public.admin_users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists support_tickets_status_idx on public.support_tickets (status);
create index if not exists support_tickets_assignee_id_idx on public.support_tickets (assignee_id);
create index if not exists support_tickets_created_at_idx on public.support_tickets (created_at desc);

alter table public.support_tickets enable row level security;

-- Admins and support staff can read the ticket queue.
create policy "support_tickets_select_support_or_admin"
  on public.support_tickets for select
  to authenticated
  using (
    exists (
      select 1 from public.admin_users au
      where au.id = auth.uid() and au.role in ('admin', 'support')
    )
  );
