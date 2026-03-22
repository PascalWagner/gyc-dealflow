-- ============================================================================
-- 030: Add missing onboarding wizard columns to user_buy_box
-- ============================================================================
-- Many wizard fields were only persisted in localStorage. This adds proper
-- database columns so they survive across devices/sessions and can be queried.

-- Goal & branch
alter table user_buy_box add column if not exists branch text;
alter table user_buy_box add column if not exists baseline_income text;
alter table user_buy_box add column if not exists target_cashflow text;
alter table user_buy_box add column if not exists taxable_income text;
alter table user_buy_box add column if not exists taxable_income_baseline text;
alter table user_buy_box add column if not exists growth_priority text;

-- Investor profile
alter table user_buy_box add column if not exists income_structure text;
alter table user_buy_box add column if not exists re_professional text;

-- Capital & risk
alter table user_buy_box add column if not exists max_loss_pct text;
alter table user_buy_box add column if not exists capital_12mo text;
alter table user_buy_box add column if not exists capital_90day text;
alter table user_buy_box add column if not exists capital_readiness text;
alter table user_buy_box add column if not exists operator_focus text;

-- LP Network
alter table user_buy_box add column if not exists share_portfolio boolean default false;

-- Add comments for clarity
comment on column user_buy_box.branch is 'Onboarding goal branch: cashflow, growth, or tax';
comment on column user_buy_box.baseline_income is 'Current annual passive income at time of onboarding';
comment on column user_buy_box.target_cashflow is '12-month passive income target (cashflow branch)';
comment on column user_buy_box.taxable_income is 'How much taxable income to offset (tax branch target)';
comment on column user_buy_box.taxable_income_baseline is 'Annual taxable income baseline (tax branch)';
comment on column user_buy_box.growth_priority is 'Risk/return preference: max_return, balanced, preservation (growth branch)';
comment on column user_buy_box.income_structure is 'Income source: w2, self_employed, mixed, passive';
comment on column user_buy_box.re_professional is 'RE Professional status: yes, no, unsure';
comment on column user_buy_box.max_loss_pct is 'Max comfortable loss per deal as pct of net worth';
comment on column user_buy_box.capital_12mo is '12-month deployable capital range';
comment on column user_buy_box.capital_90day is '90-day deployable capital range';
comment on column user_buy_box.capital_readiness is 'Timeline to first investment: now, 30days, 90days, exploring';
comment on column user_buy_box.operator_focus is 'Operator preference: specialist, diversified, both';
comment on column user_buy_box.share_portfolio is 'LP Network opt-in flag';
