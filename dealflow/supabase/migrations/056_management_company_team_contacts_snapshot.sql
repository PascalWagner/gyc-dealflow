-- Persist a full fallback snapshot of team contacts on management_companies.
-- This keeps operator lead / IR contact edits durable even before the
-- dedicated management_company_contacts table is available in every environment.

alter table management_companies
  add column if not exists team_contacts jsonb not null default '[]'::jsonb;

comment on column management_companies.team_contacts is
  'Fallback JSON snapshot of LP-facing team contacts when the normalized contacts table is unavailable.';
