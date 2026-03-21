-- Migration 022: Add legal entity names for SEC filing matching
-- PPMs contain the exact legal entity names used in SEC Form D filings.
-- Storing these dramatically improves EDGAR match rate.

alter table opportunities
  add column if not exists issuer_entity text default '',
  add column if not exists gp_entity text default '',
  add column if not exists sponsor_entity text default '';

comment on column opportunities.issuer_entity is 'Legal entity name from PPM cover page — matches SEC Form D issuer (e.g. "FPC Opportunity Fund I, LLC")';
comment on column opportunities.gp_entity is 'General Partner entity name from PPM (e.g. "Favor Point Capital Management, LLC")';
comment on column opportunities.sponsor_entity is 'Sponsor/manager brand entity from PPM (e.g. "Favor Point Capital, LLC")';

-- Also add to management_companies for operator-level legal names
alter table management_companies
  add column if not exists legal_entity text default '';

comment on column management_companies.legal_entity is 'Official legal entity name (may differ from brand/operator_name)';
