-- SEC EDGAR Form D Integration
-- Stores parsed Form D filings and related persons for cross-fund tracking

-- ============================================================================
-- 1. SEC FILINGS (one row per Form D filing, including amendments)
-- ============================================================================
create table sec_filings (
  id                    uuid primary key default gen_random_uuid(),
  opportunity_id        uuid references opportunities(id) on delete set null,
  management_company_id uuid references management_companies(id) on delete set null,

  -- EDGAR identifiers
  cik                   text not null,
  accession_number      text not null unique,
  filing_date           date,
  filing_type           text default 'D',           -- 'D' or 'D/A'
  is_latest_amendment   boolean default true,

  -- Primary Issuer
  entity_name           text,
  entity_type           text,                        -- 'Limited Liability Company', etc.
  jurisdiction          text,
  year_of_inc           integer,
  issuer_phone          text,
  issuer_street         text,
  issuer_city           text,
  issuer_state          text,
  issuer_zip            text,

  -- Offering Data
  industry_group        text,
  issuer_size           text,                        -- revenue range string
  federal_exemptions    text[],                      -- e.g. {'06c'} or {'06b'}
  date_of_first_sale    date,
  is_equity             boolean,
  is_debt               boolean,
  is_pooled_fund        boolean,
  minimum_investment    numeric,
  total_offering_amount numeric,
  total_amount_sold     numeric,
  total_remaining       numeric,
  total_investors       integer,
  has_non_accredited    boolean default false,

  -- Commissions & proceeds
  sales_commissions     numeric,
  finders_fees          numeric,
  gross_proceeds_used   numeric,
  proceeds_clarification text,

  -- Raw data
  raw_xml               text,
  edgar_url             text,

  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index idx_sec_cik on sec_filings(cik);
create index idx_sec_opp on sec_filings(opportunity_id);
create index idx_sec_mc on sec_filings(management_company_id);

-- ============================================================================
-- 2. RELATED PERSONS (people from Form D filings, tracked across funds)
-- ============================================================================
create table related_persons (
  id                    uuid primary key default gen_random_uuid(),
  sec_filing_id         uuid not null references sec_filings(id) on delete cascade,
  management_company_id uuid references management_companies(id) on delete set null,

  first_name            text not null,
  last_name             text not null,
  street                text,
  city                  text,
  state                 text,
  zip                   text,

  relationships         text[],                      -- {'Director', 'Executive Officer'}
  relationship_clarification text,                   -- 'General Partner', 'Managing Member'

  created_at            timestamptz default now()
);

create index idx_rp_filing on related_persons(sec_filing_id);
create index idx_rp_mc on related_persons(management_company_id);
create index idx_rp_name on related_persons(last_name, first_name);

-- ============================================================================
-- 3. ALTER EXISTING TABLES
-- ============================================================================

-- Add SEC fields to opportunities
alter table opportunities
  add column if not exists sec_cik text default '',
  add column if not exists date_of_first_sale date,
  add column if not exists total_amount_sold numeric,
  add column if not exists total_investors integer,
  add column if not exists is_506b boolean default false;

-- Add headquarters to management_companies
alter table management_companies
  add column if not exists hq_city text default '',
  add column if not exists hq_state text default '',
  add column if not exists hq_zip text default '';

-- ============================================================================
-- 4. RLS POLICIES
-- ============================================================================
alter table sec_filings enable row level security;
alter table related_persons enable row level security;

-- SEC filings are public data (anyone can read)
create policy "SEC filings are publicly readable"
  on sec_filings for select using (true);

-- Related persons are publicly readable
create policy "Related persons are publicly readable"
  on related_persons for select using (true);

-- Only service role can write (API endpoints use service key)

-- ============================================================================
-- 5. UPDATED_AT TRIGGER
-- ============================================================================
create trigger set_sec_filings_updated_at
  before update on sec_filings
  for each row execute function moddatetime(updated_at);
