-- ============================================================================
-- 032: Drop dead v1/v2 wizard columns from user_buy_box
-- ============================================================================
-- These columns were from the original buy box wizard. Data was migrated
-- to v3 columns in migration 031 where mappable. The remaining columns
-- had no v3 equivalent (the v3 wizard simplified these away).

-- Data already migrated in 031:
--   capital_ready → capital_readiness
--   fund_source → trigger_event
--   deal_structure → operator_focus

alter table user_buy_box drop column if exists capital_ready;
alter table user_buy_box drop column if exists fund_source;
alter table user_buy_box drop column if exists deal_structure;

-- No v3 equivalent (removed from wizard):
alter table user_buy_box drop column if exists check_size;
alter table user_buy_box drop column if exists urgency;
alter table user_buy_box drop column if exists entity;
alter table user_buy_box drop column if exists min_cash_yield;
alter table user_buy_box drop column if exists min_irr;
alter table user_buy_box drop column if exists instruments;
alter table user_buy_box drop column if exists operator_size;
alter table user_buy_box drop column if exists redemption;
alter table user_buy_box drop column if exists operator_strategy;
alter table user_buy_box drop column if exists financial_reporting;
