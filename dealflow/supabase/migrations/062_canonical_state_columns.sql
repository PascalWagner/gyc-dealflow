alter table user_profiles
	add column if not exists avatar_url text,
	add column if not exists accredited_status text,
	add column if not exists investable_capital text,
	add column if not exists investment_experience text;

alter table opportunities
	add column if not exists review_field_evidence jsonb not null default '{}'::jsonb,
	add column if not exists team_contacts jsonb not null default '[]'::jsonb,
	add column if not exists sec_verification_state text,
	add column if not exists current_fund_size bigint,
	add column if not exists current_avg_loan_ltv numeric,
	add column if not exists max_allowed_ltv numeric,
	add column if not exists current_leverage numeric,
	add column if not exists max_allowed_leverage numeric,
	add column if not exists fund_founded_year integer,
	add column if not exists firm_founded_year integer,
	add column if not exists risk_tags jsonb not null default '[]'::jsonb;

comment on column opportunities.review_field_evidence is
	'Field-level source provenance for deal review values, keyed by review field id.';
