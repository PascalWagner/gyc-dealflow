alter table opportunities
	add column if not exists review_field_evidence jsonb not null default '{}'::jsonb;

comment on column opportunities.review_field_evidence is
	'Field-level source provenance for deal review values, keyed by review field id.';
