-- ============================================================================
-- 047: Reconcile intro_requests historical migration drift
-- ============================================================================
-- Historical debt:
--   - 025_intro_requests.sql created the base table
--   - 042_intro_requests.sql expanded the intended shape but could not amend
--     already-created tables on environments where 025 had already run
--
-- This migration is forward-only and idempotent. It brings intro_requests to
-- the current application contract without rewriting historical migrations.

alter table intro_requests
  add column if not exists email_to text,
  add column if not exists email_type text,
  add column if not exists email_sent boolean default false,
  add column if not exists resend_error text,
  add column if not exists ghl_synced boolean default false,
  add column if not exists ghl_contact_id text,
  add column if not exists log jsonb;

update intro_requests
set
  email_sent = coalesce(email_sent, false),
  ghl_synced = coalesce(ghl_synced, false)
where email_sent is null or ghl_synced is null;

do $$
declare
  existing_constraint record;
begin
  for existing_constraint in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'intro_requests'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.intro_requests drop constraint if exists %I', existing_constraint.conname);
  end loop;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'intro_requests'
      and con.conname = 'intro_requests_status_check'
  ) then
    execute $status$
      alter table public.intro_requests
        add constraint intro_requests_status_check
        check (status in ('pending', 'completed', 'declined', 'email_sent', 'email_failed'))
    $status$;
  end if;
end $$;

create index if not exists idx_intro_requests_user on intro_requests(user_id);
create index if not exists idx_intro_requests_status on intro_requests(status);
create index if not exists idx_intro_requests_created on intro_requests(created_at desc);

alter table intro_requests enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'intro_requests'
      and policyname = 'Users can view own intro requests'
  ) then
    execute $policy$
      create policy "Users can view own intro requests"
        on intro_requests for select
        using (auth.uid() = user_id)
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'intro_requests'
      and policyname = 'Service role full access'
  ) then
    execute $policy$
      create policy "Service role full access"
        on intro_requests for all
        using (auth.role() = 'service_role')
    $policy$;
  end if;
end $$;
