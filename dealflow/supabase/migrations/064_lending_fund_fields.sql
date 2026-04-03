-- 064: Add lending fund fields from fund report data
-- Total loans under management, avg LTC, performance fee, inception date, fund term, equity commitments

alter table opportunities
	add column if not exists total_loans_under_mgmt bigint,
	add column if not exists avg_loan_ltc numeric,
	add column if not exists performance_fee_pct numeric,
	add column if not exists inception_date date,
	add column if not exists fund_term text,
	add column if not exists equity_commitments bigint;
