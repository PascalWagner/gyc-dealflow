-- ============================================================================
-- 060: Settings membership billing cleanup
-- ============================================================================
-- Adds explicit lifetime + external billing metadata to subscriptions and
-- backfills Pascal's lifetime Academy record so settings no longer relies on
-- inferred dates.

alter table subscriptions
  add column if not exists is_lifetime boolean not null default false,
  add column if not exists billing_provider text,
  add column if not exists external_subscription_id text,
  add column if not exists external_product_id text,
  add column if not exists external_price_id text,
  add column if not exists billing_management_url text;

update subscriptions
set is_lifetime = false
where is_lifetime is null;

create unique index if not exists idx_subscriptions_external_subscription_id
  on subscriptions(external_subscription_id)
  where external_subscription_id is not null;

with pascal as (
  select id
  from user_profiles
  where lower(email) = 'info@pascalwagner.com'
  limit 1
),
updated_pascal as (
  update subscriptions s
  set
    status = 'active',
    start_date = '2023-01-01T00:00:00+00:00'::timestamptz,
    end_date = null,
    renewal_date = null,
    is_lifetime = true,
    billing_provider = coalesce(s.billing_provider, 'manual'),
    external_subscription_id = null,
    external_product_id = null,
    external_price_id = null,
    billing_management_url = null,
    updated_at = now()
  where s.user_id = (select id from pascal)
    and s.product_type = 'academy'
  returning s.id
)
insert into subscriptions (
  user_id,
  product_type,
  status,
  start_date,
  end_date,
  renewal_date,
  is_lifetime,
  billing_provider,
  external_subscription_id,
  external_product_id,
  external_price_id,
  billing_management_url,
  created_at,
  updated_at
)
select
  pascal.id,
  'academy',
  'active',
  '2023-01-01T00:00:00+00:00'::timestamptz,
  null,
  null,
  true,
  'manual',
  null,
  null,
  null,
  null,
  now(),
  now()
from pascal
where not exists (select 1 from updated_pascal);
