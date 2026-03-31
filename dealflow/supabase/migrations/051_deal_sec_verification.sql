-- Deal-level SEC / Issuer verification state
-- Persists the review-stage decision so publish gating can read it later.

create table if not exists deal_sec_verification (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references opportunities(id) on delete cascade,
  status text not null default 'pending',
  reason_code text default '',
  reason_note text default '',
  determination_source text default '',
  sec_filing_id uuid references sec_filings(id) on delete set null,
  match_confidence numeric,
  matched_cik text default '',
  matched_accession_number text default '',
  matched_entity_name text default '',
  last_checked_at timestamptz,
  verified_at timestamptz,
  resolution_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_deal_sec_verification_opportunity
  on deal_sec_verification(opportunity_id);

create index if not exists idx_deal_sec_verification_status
  on deal_sec_verification(status);

create index if not exists idx_deal_sec_verification_sec_filing
  on deal_sec_verification(sec_filing_id);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'deal_sec_verification_status_check'
  ) then
    alter table deal_sec_verification
      add constraint deal_sec_verification_status_check
      check (status in ('pending', 'needs_review', 'verified', 'have_not_filed_yet', 'not_applicable'));
  end if;
end $$;

alter table deal_sec_verification enable row level security;

drop trigger if exists set_deal_sec_verification_updated_at on deal_sec_verification;

create trigger set_deal_sec_verification_updated_at
  before update on deal_sec_verification
  for each row execute function moddatetime(updated_at);

insert into deal_sec_verification (
  opportunity_id,
  status,
  reason_code,
  reason_note,
  determination_source,
  sec_filing_id,
  match_confidence,
  matched_cik,
  matched_accession_number,
  matched_entity_name,
  last_checked_at,
  verified_at,
  resolution_snapshot
)
select
  sec_filings.opportunity_id,
  'verified',
  'backfill_existing_sec_filing',
  '',
  'backfill',
  sec_filings.id,
  1,
  coalesce(sec_filings.cik, ''),
  coalesce(sec_filings.accession_number, ''),
  coalesce(sec_filings.entity_name, ''),
  now(),
  now(),
  jsonb_build_object(
    'backfill', true,
    'accessionNumber', sec_filings.accession_number,
    'entityName', sec_filings.entity_name,
    'cik', sec_filings.cik
  )
from sec_filings
where sec_filings.opportunity_id is not null
  and sec_filings.is_latest_amendment = true
on conflict (opportunity_id) do update
set
  status = excluded.status,
  reason_code = excluded.reason_code,
  determination_source = excluded.determination_source,
  sec_filing_id = excluded.sec_filing_id,
  match_confidence = excluded.match_confidence,
  matched_cik = excluded.matched_cik,
  matched_accession_number = excluded.matched_accession_number,
  matched_entity_name = excluded.matched_entity_name,
  last_checked_at = excluded.last_checked_at,
  verified_at = excluded.verified_at,
  resolution_snapshot = excluded.resolution_snapshot,
  updated_at = now();
