-- Migration 021: Deal sponsors join table
-- Supports multiple sponsors per deal with distinct roles (operator vs capital raiser)

create table deal_sponsors (
  id            uuid primary key default gen_random_uuid(),
  deal_id       uuid not null references opportunities(id) on delete cascade,
  company_id    uuid not null references management_companies(id) on delete cascade,
  role          text not null check (role in ('operator', 'capital_raiser', 'co_gp', 'property_manager')),
  is_primary    boolean default false,
  display_order integer default 0,
  created_at    timestamptz default now(),
  unique(deal_id, company_id, role)
);

create index idx_deal_sponsors_deal on deal_sponsors(deal_id);
create index idx_deal_sponsors_company on deal_sponsors(company_id);

-- RLS: everyone can read, service role can write
alter table deal_sponsors enable row level security;

create policy "deal_sponsors_read" on deal_sponsors
  for select using (true);

create policy "deal_sponsors_write" on deal_sponsors
  for all using (true) with check (true);

-- Backfill: seed from existing management_company_id on opportunities
-- Every current deal's company becomes role='operator', is_primary=true
insert into deal_sponsors (deal_id, company_id, role, is_primary, display_order)
select id, management_company_id, 'operator', true, 0
from opportunities
where management_company_id is not null
on conflict do nothing;
