-- ============================================================================
-- 048: Reconcile onboarding/activity lineage from duplicate 031 migrations
-- ============================================================================
--
-- This migration is the forward-only repair for the overlapping 031 lineage:
-- - 031_activity_columns_and_v1v2_migration.sql
-- - 031_portfolio_plans.sql
--
-- It keeps the useful schema and activity backfills from 031 while explicitly
-- *not* repeating the historical goals -> buy_box sync. Goals are now
-- canonical in user_goals and are composed into buy-box reads at the API layer.

-- 1. Ensure activity/profile columns exist in environments that may have taken
--    a partial or out-of-order historical migration path.
alter table if exists user_profiles add column if not exists last_activity_date timestamptz;
alter table if exists user_profiles add column if not exists deals_viewed_count integer default 0;
alter table if exists user_profiles add column if not exists deals_saved_count integer default 0;
alter table if exists user_profiles add column if not exists sessions_count integer default 0;
alter table if exists user_profiles add column if not exists buy_box_complete boolean default false;
alter table if exists user_profiles add column if not exists funnel_status text default 'new';

-- 2. Reconcile buy-box naming/backfill fields from the legacy v1/v2 wizard.
update user_buy_box
set capital_readiness = capital_ready
where capital_readiness is null
  and capital_ready is not null
  and capital_ready != '';

update user_buy_box
set trigger_event = fund_source
where trigger_event is null
  and fund_source is not null
  and fund_source != '';

update user_buy_box
set operator_focus = deal_structure
where operator_focus is null
  and deal_structure is not null
  and deal_structure != '';

update user_buy_box
set branch = case
  when goal ilike '%cash flow%' or goal ilike '%income%' then 'cashflow'
  when goal ilike '%tax%' then 'tax'
  when goal ilike '%growth%' or goal ilike '%wealth%' or goal ilike '%equity%' then 'growth'
  else 'cashflow'
end
where branch is null
  and goal is not null
  and goal != '';

-- 3. Re-seed activity/profile aggregates from the event stream.
with event_rollup as (
  select
    user_id,
    count(*) filter (where event = 'deal_viewed')::integer as deals_viewed_count,
    count(*) filter (where event = 'deal_saved')::integer as deals_saved_count,
    count(*) filter (where event = 'session_start')::integer as sessions_count,
    bool_or(event = 'wizard_complete') as buy_box_complete,
    bool_or(event = 'call_booked') as has_call_booked,
    count(*) filter (where event = 'deal_saved')::integer as saved_events,
    bool_or(event = 'wizard_complete') as completed_wizard,
    bool_or(event in ('page_view', 'deal_viewed')) as has_explored,
    max(created_at) as last_activity_date
  from user_events
  group by user_id
)
update user_profiles p
set
  deals_viewed_count = coalesce(r.deals_viewed_count, 0),
  deals_saved_count = coalesce(r.deals_saved_count, 0),
  sessions_count = coalesce(r.sessions_count, 0),
  buy_box_complete = coalesce(r.buy_box_complete, false),
  last_activity_date = coalesce(r.last_activity_date, p.last_activity_date),
  funnel_status = case
    when r.has_call_booked then 'call-booked'
    when coalesce(r.saved_events, 0) >= 3 then 'high-intent'
    when r.completed_wizard then 'qualified'
    when r.has_explored then 'exploring'
    else coalesce(nullif(p.funnel_status, ''), 'new')
  end
from event_rollup r
where p.id = r.user_id;

-- 4. Preserve the older direct seed from completed buy-box rows for users who
--    may not have the relevant user_events history.
update user_profiles p
set buy_box_complete = true
from user_buy_box b
where b.user_id = p.id
  and b.completed_at is not null
  and coalesce(p.buy_box_complete, false) = false;

-- NOTE:
-- We intentionally do not repeat the historical user_goals -> user_buy_box sync
-- here. That coupling has been deprecated in favor of a composed read model.
