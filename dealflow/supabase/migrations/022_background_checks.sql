-- Background Check Results
-- Stores cached results from public record searches (SEC, FINRA, OFAC, CourtListener)
-- Linked to management companies and individual persons

create table background_checks (
  id                    uuid primary key default gen_random_uuid(),
  management_company_id uuid references management_companies(id) on delete cascade,
  person_name           text not null,           -- "Hugh D. Cohen"
  company_name          text,                    -- "Cohen Investment Group"

  -- Search status
  status                text default 'pending',  -- pending, running, completed, error
  run_at                timestamptz,
  error_message         text,

  -- SEC EDGAR results
  sec_filings_count     integer default 0,
  sec_total_raised      numeric,                 -- sum of total_amount_sold across all filings
  sec_entities          jsonb default '[]',      -- [{entityName, cik, filingDate, amount, exemption}]
  sec_status            text default 'pending',  -- pending, clear, flagged, not_found, error

  -- FINRA BrokerCheck results
  finra_found           boolean default false,
  finra_disclosures     integer default 0,       -- number of disclosure events
  finra_employments     integer default 0,
  finra_details         jsonb default '{}',      -- {registrations, disclosures, employmentHistory}
  finra_status          text default 'pending',

  -- SEC IAPD (Investment Adviser)
  iapd_found            boolean default false,
  iapd_firm_count       integer default 0,
  iapd_disclosures      integer default 0,
  iapd_details          jsonb default '{}',
  iapd_status           text default 'pending',

  -- OFAC/SDN sanctions
  ofac_found            boolean default false,
  ofac_matches          jsonb default '[]',
  ofac_status           text default 'pending',

  -- CourtListener (federal court records)
  court_cases_count     integer default 0,
  court_bankruptcies    integer default 0,
  court_details         jsonb default '[]',      -- [{caseName, court, dateFiled, type}]
  court_status          text default 'pending',

  -- Overall summary
  overall_status        text default 'pending',  -- clear, flagged, needs_review
  flags                 jsonb default '[]',      -- [{source, severity, message}]
  summary               text,                    -- Human-readable summary

  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index idx_bg_mc on background_checks(management_company_id);
create index idx_bg_person on background_checks(person_name);
create index idx_bg_status on background_checks(status);

-- RLS
alter table background_checks enable row level security;

-- Academy members and above can read background checks
create policy "Background checks readable by authenticated users"
  on background_checks for select using (true);

-- Only service role can write

-- Updated_at trigger
create trigger set_background_checks_updated_at
  before update on background_checks
  for each row execute function moddatetime(updated_at);
