alter table if exists user_portfolio
  add column if not exists actual_year_1_cash_flow numeric,
  add column if not exists actual_year_1_depreciation numeric;
