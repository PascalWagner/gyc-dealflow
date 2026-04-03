alter table opportunities
	add column if not exists review_field_state jsonb not null default '{}'::jsonb,
	add column if not exists review_state_version bigint not null default 0,
	add column if not exists historical_return_2015 numeric,
	add column if not exists historical_return_2016 numeric,
	add column if not exists historical_return_2017 numeric,
	add column if not exists historical_return_2018 numeric,
	add column if not exists historical_return_2019 numeric,
	add column if not exists historical_return_2020 numeric,
	add column if not exists historical_return_2021 numeric,
	add column if not exists historical_return_2022 numeric,
	add column if not exists historical_return_2023 numeric,
	add column if not exists historical_return_2024 numeric,
	add column if not exists historical_return_2025 numeric;

comment on column opportunities.review_field_state is
	'Per-field review state with ai_value, admin_override_value, final_value, and audit metadata.';

comment on column opportunities.review_state_version is
	'Optimistic concurrency counter for deal-review saves so stale writes fail instead of silently winning.';

create table if not exists review_field_events (
	id uuid primary key default gen_random_uuid(),
	opportunity_id uuid not null references opportunities(id) on delete cascade,
	field_key text not null,
	event_type text not null,
	actor_type text not null,
	actor_email text default '',
	actor_name text default '',
	previous_value jsonb,
	next_value jsonb,
	metadata jsonb not null default '{}'::jsonb,
	created_at timestamptz not null default now()
);

create index if not exists idx_review_field_events_opportunity_created
	on review_field_events(opportunity_id, created_at desc);

create index if not exists idx_review_field_events_field_key
	on review_field_events(field_key, created_at desc);
