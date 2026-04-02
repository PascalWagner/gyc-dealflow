-- ============================================================================
-- 058: Introduce normalized subscriptions table for membership products
-- ============================================================================
-- Academy access dates should no longer live on user_profiles. This migration
-- adds a reusable subscriptions table and backfills Academy rows from existing
-- profile data for a safe forward-only transition.

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  product_type text not null,
  status text not null default 'active',
  start_date timestamptz not null,
  end_date timestamptz,
  renewal_date timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table subscriptions
  add column if not exists product_type text,
  add column if not exists status text,
  add column if not exists start_date timestamptz,
  add column if not exists end_date timestamptz,
  add column if not exists renewal_date timestamptz,
  add column if not exists created_at timestamptz default now(),
  add column if not exists updated_at timestamptz default now();

update subscriptions
set
  status = coalesce(nullif(status, ''), 'active'),
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where
  status is null
  or status = ''
  or created_at is null
  or updated_at is null;

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
      and rel.relname = 'subscriptions'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%status%'
  loop
    execute format('alter table public.subscriptions drop constraint if exists %I', existing_constraint.conname);
  end loop;

  if not exists (
    select 1
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'subscriptions'
      and con.conname = 'subscriptions_status_check'
  ) then
    execute $constraint$
      alter table public.subscriptions
        add constraint subscriptions_status_check
        check (status in ('active', 'canceled', 'expired', 'trial', 'paused', 'pending'))
    $constraint$;
  end if;
end $$;

create index if not exists idx_subscriptions_user_product
  on subscriptions(user_id, product_type);

create index if not exists idx_subscriptions_lookup
  on subscriptions(user_id, product_type, status, start_date desc);

create unique index if not exists idx_subscriptions_one_active_per_product
  on subscriptions(user_id, product_type)
  where status in ('active', 'trial');

alter table subscriptions enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Users read own subscriptions'
  ) then
    execute $policy$
      create policy "Users read own subscriptions"
        on subscriptions for select
        using (user_id = auth.uid() or is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Users update own subscriptions'
  ) then
    execute $policy$
      create policy "Users update own subscriptions"
        on subscriptions for update
        using (user_id = auth.uid() or is_admin())
    $policy$;
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'subscriptions'
      and policyname = 'Service role full subscription access'
  ) then
    execute $policy$
      create policy "Service role full subscription access"
        on subscriptions for all
        using (auth.role() = 'service_role')
    $policy$;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'update_subscriptions_updated_at'
  ) then
    create trigger update_subscriptions_updated_at
      before update on subscriptions
      for each row execute function update_updated_at();
  end if;
end $$;

insert into subscriptions (
  user_id,
  product_type,
  status,
  start_date,
  end_date,
  renewal_date,
  created_at,
  updated_at
)
select
  up.id as user_id,
  'academy' as product_type,
  case
    when up.academy_end is not null and up.academy_end < now() then 'expired'
    when coalesce(up.academy_start, up.created_at, now()) > now() then 'trial'
    else 'active'
  end as status,
  coalesce(up.academy_start, up.created_at, now()) as start_date,
  up.academy_end as end_date,
  case
    when coalesce(up.auto_renew, true) and up.academy_end is not null and up.academy_end >= now()
      then up.academy_end
    else null
  end as renewal_date,
  coalesce(up.created_at, now()) as created_at,
  now() as updated_at
from user_profiles up
where
  (
    up.academy_start is not null
    or up.academy_end is not null
    or up.tier in ('academy', 'alumni', 'investor')
  )
  and not exists (
    select 1
    from subscriptions s
    where s.user_id = up.id
      and s.product_type = 'academy'
  );
