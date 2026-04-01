-- Persist a deal-level review snapshot of LP-facing team contacts.
-- This lets deal review retain the exact edited contacts even if the
-- management-company contact store is unavailable or still converging.

alter table opportunities
  add column if not exists team_contacts jsonb not null default '[]'::jsonb;

comment on column opportunities.team_contacts is
  'Deal-review snapshot of LP-facing team contacts used during onboarding and validation.';
