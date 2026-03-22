-- ============================================================================
-- 031: Activity tracking columns + v1/v2 wizard data migration
-- ============================================================================

-- 1. Add activity tracking columns to user_profiles
--    (These were GHL-only; now Supabase is the source of truth)
alter table user_profiles add column if not exists last_activity_date timestamptz;
alter table user_profiles add column if not exists deals_viewed_count integer default 0;
alter table user_profiles add column if not exists deals_saved_count integer default 0;
alter table user_profiles add column if not exists sessions_count integer default 0;
alter table user_profiles add column if not exists buy_box_complete boolean default false;
alter table user_profiles add column if not exists funnel_status text default 'new';

-- 2. Migrate v1/v2 buy box data to v3 columns
--    Only fill v3 columns where they are currently empty

-- capital_ready → capital_readiness
update user_buy_box
  set capital_readiness = capital_ready
  where capital_readiness is null
    and capital_ready is not null
    and capital_ready != '';

-- fund_source → trigger_event (same concept, different name)
update user_buy_box
  set trigger_event = fund_source
  where trigger_event is null
    and fund_source is not null
    and fund_source != '';

-- deal_structure → operator_focus (specialist/diversified preference)
update user_buy_box
  set operator_focus = deal_structure
  where operator_focus is null
    and deal_structure is not null
    and deal_structure != '';

-- net_worth → also populate the net_worth data if missing
-- (net_worth column already existed in v1, no migration needed)

-- goal → branch (derive branch from goal text)
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

-- 3. Seed buy_box_complete from user_buy_box.completed_at
update user_profiles p
  set buy_box_complete = true
  from user_buy_box b
  where b.user_id = p.id
    and b.completed_at is not null;

-- 4. Seed activity counters from user_events aggregate
-- deals_viewed_count
update user_profiles p
  set deals_viewed_count = sub.cnt
  from (
    select user_id, count(*) as cnt
    from user_events
    where event = 'deal_viewed'
    group by user_id
  ) sub
  where p.id = sub.user_id;

-- deals_saved_count
update user_profiles p
  set deals_saved_count = sub.cnt
  from (
    select user_id, count(*) as cnt
    from user_events
    where event = 'deal_saved'
    group by user_id
  ) sub
  where p.id = sub.user_id;

-- sessions_count
update user_profiles p
  set sessions_count = sub.cnt
  from (
    select user_id, count(*) as cnt
    from user_events
    where event = 'session_start'
    group by user_id
  ) sub
  where p.id = sub.user_id;

-- last_activity_date
update user_profiles p
  set last_activity_date = sub.latest
  from (
    select user_id, max(created_at) as latest
    from user_events
    group by user_id
  ) sub
  where p.id = sub.user_id;

-- 5. Sync user_goals data into user_buy_box where buy_box is missing it
-- baseline_income from goals.current_income
update user_buy_box b
  set baseline_income = g.current_income::text
  from user_goals g
  where g.user_id = b.user_id
    and b.baseline_income is null
    and g.current_income is not null
    and g.current_income > 0;

-- target_cashflow from goals.target_income
update user_buy_box b
  set target_cashflow = g.target_income::text
  from user_goals g
  where g.user_id = b.user_id
    and b.target_cashflow is null
    and g.target_income is not null
    and g.target_income > 0;

-- taxable_income from goals.tax_reduction
update user_buy_box b
  set taxable_income = g.tax_reduction::text
  from user_goals g
  where g.user_id = b.user_id
    and b.taxable_income is null
    and g.tax_reduction is not null
    and g.tax_reduction > 0;
