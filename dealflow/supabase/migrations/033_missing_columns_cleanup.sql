-- ============================================================================
-- 033: Add missing columns that were created manually or never migrated
-- ============================================================================

-- diversification_pref: active wizard step, was added via SQL Editor manually
alter table user_buy_box add column if not exists diversification_pref text;

-- notif_frequency: referenced in userdata.js but never had a migration
alter table user_profiles add column if not exists notif_frequency text default 'weekly';

-- income_gap: computed (target - current income), was GHL-only
alter table user_goals add column if not exists income_gap numeric;

-- monthly_goal: the monthly passive income goal from goals_complete event, was GHL-only
alter table user_goals add column if not exists monthly_goal numeric;
