-- ============================================================================
-- 051: Management company team contacts
-- Stores multiple sponsor/operator team contacts for onboarding and LP introductions.
-- Legacy management_companies.ir_contact_* and booking_url remain as compatibility fields.
-- ============================================================================

create table if not exists management_company_contacts (
  id                    uuid primary key default gen_random_uuid(),
  management_company_id uuid not null references management_companies(id) on delete cascade,
  first_name            text not null default '',
  last_name             text not null default '',
  email                 text not null default '',
  phone                 text default '',
  role                  text default '',
  linkedin_url          text default '',
  is_primary            boolean not null default false,
  is_investor_relations boolean not null default false,
  calendar_url          text default '',
  display_order         integer not null default 0,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index if not exists idx_management_company_contacts_company
  on management_company_contacts (management_company_id, display_order, created_at);

create unique index if not exists idx_management_company_contacts_primary
  on management_company_contacts (management_company_id)
  where is_primary = true;

create unique index if not exists idx_management_company_contacts_company_email
  on management_company_contacts (management_company_id, lower(email))
  where nullif(btrim(email), '') is not null;

comment on table management_company_contacts is 'Multiple people associated with a sponsor/operator for LP introductions and onboarding.';
comment on column management_company_contacts.is_primary is 'Exactly one contact per management company should be marked primary.';
comment on column management_company_contacts.is_investor_relations is 'Marks contacts who can receive investor-introduction workflows.';
comment on column management_company_contacts.calendar_url is 'Person-specific booking link when the contact wants meetings scheduled directly.';

alter table management_company_contacts enable row level security;

create policy "management_company_contacts_read" on management_company_contacts
  for select using (true);

create policy "management_company_contacts_write" on management_company_contacts
  for all using (is_admin()) with check (is_admin());

drop trigger if exists trg_management_company_contacts_updated on management_company_contacts;
create trigger trg_management_company_contacts_updated
  before update on management_company_contacts
  for each row execute function update_updated_at();
