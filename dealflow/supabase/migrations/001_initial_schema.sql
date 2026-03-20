-- GYC Dealflow: Complete Supabase Schema
-- Migrating from Airtable + GHL + Google Drive → Supabase (Postgres + Auth + Storage)
--
-- Run this in the Supabase SQL Editor or via `supabase db push`

-- ============================================================================
-- 1. MANAGEMENT COMPANIES (operators/sponsors)
-- ============================================================================
create table management_companies (
  id            uuid primary key default gen_random_uuid(),
  airtable_id   text unique,                          -- for migration mapping
  operator_name text not null,
  ceo           text default '',
  website       text default '',
  linkedin_ceo  text default '',
  invest_clearly_profile text default '',
  founding_year integer,
  type          text default '',                      -- e.g. 'Fund Manager', 'Syndicator'
  asset_classes text[] default '{}',                  -- multi-select → array
  total_investors integer,
  last_updated  timestamptz default now(),
  created_at    timestamptz default now()
);

create index idx_mc_operator_name on management_companies(operator_name);

-- ============================================================================
-- 2. OPPORTUNITIES (deals)
-- ============================================================================
create table opportunities (
  id                    uuid primary key default gen_random_uuid(),
  airtable_id           text unique,                  -- for migration mapping
  deal_number           integer,
  investment_name       text not null,
  asset_class           text default '',
  deal_type             text default '',
  status                text default '',
  added_date            date,
  location              text default '',
  property_address      text default '',

  -- Financial metrics
  target_irr            numeric,                      -- stored as decimal (0.15 = 15%)
  equity_multiple       numeric,
  preferred_return      numeric,
  cash_on_cash          numeric,
  investment_minimum    numeric default 0,
  lp_gp_split           text default '',
  hold_period_years     numeric,

  -- Investment structure
  offering_type         text default '',
  offering_size         numeric,
  investing_geography   text default '',
  investment_strategy   text default '',
  instrument            text default '',

  -- Deal characteristics
  distributions         text default '',
  financials            text default '',              -- 'audited' / 'unaudited'
  available_to          text default '',
  investment_objective  text default '',
  sponsor_in_deal_pct   numeric,
  fees                  text[] default '{}',
  first_yr_depreciation text default '',
  strategy              text default '',
  vertical_integration  boolean default false,
  debt_position         text default '',
  fund_aum              numeric,
  loan_count            integer,
  avg_loan_ltv          numeric,

  -- Documents (Supabase Storage paths)
  deck_url              text default '',
  ppm_url               text default '',
  sub_agreement_url     text default '',

  -- Share class support (self-referencing)
  parent_deal_id        uuid references opportunities(id) on delete set null,
  share_class_label     text,

  -- Operator (foreign key)
  management_company_id uuid references management_companies(id) on delete set null,

  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);

create index idx_opp_status on opportunities(status);
create index idx_opp_asset_class on opportunities(asset_class);
create index idx_opp_parent on opportunities(parent_deal_id);
create index idx_opp_mc on opportunities(management_company_id);
create index idx_opp_added on opportunities(added_date desc);

-- ============================================================================
-- 3. USER PROFILES
-- Supabase Auth handles login. This table extends auth.users with app-specific data.
-- ============================================================================
create table user_profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique not null,
  full_name       text default '',
  tier            text default 'free' check (tier in ('free', 'academy', 'alumni', 'investor')),
  is_admin        boolean default false,
  ghl_contact_id  text,                              -- link back to GHL for CRM sync
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

create index idx_profile_email on user_profiles(email);
create index idx_profile_tier on user_profiles(tier);

-- ============================================================================
-- 4. BUY BOX PREFERENCES
-- Moved from GHL custom fields → proper table. Still syncs to GHL for automations.
-- ============================================================================
create table user_buy_box (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references user_profiles(id) on delete cascade,
  trigger_event         text,
  check_size            text,
  net_worth             text,
  capital_ready         text,
  urgency               text,
  asset_classes         text[] default '{}',
  entity                text,
  min_cash_yield        text,
  min_irr               text,
  instruments           text[] default '{}',
  lockup                text,
  deal_structure        text,
  strategies            text[] default '{}',
  operator_size         text,
  redemption            text,
  distributions         text,
  operator_strategy     text,
  financial_reporting   text,
  accreditation         text,
  goal                  text,
  fund_source           text,
  completed_at          timestamptz,                  -- when wizard was finished
  updated_at            timestamptz default now(),
  unique(user_id)                                     -- one buy box per user
);

-- ============================================================================
-- 5. USER DEAL STAGES (pipeline tracking)
-- ============================================================================
create table user_deal_stages (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references user_profiles(id) on delete cascade,
  deal_id     uuid not null references opportunities(id) on delete cascade,
  stage       text not null check (stage in ('interested', 'duediligence', 'portfolio')),
  notes       text default '',
  updated_at  timestamptz default now(),
  unique(user_id, deal_id)                            -- one stage per user per deal
);

create index idx_stages_user on user_deal_stages(user_id);
create index idx_stages_deal on user_deal_stages(deal_id);
create index idx_stages_stage on user_deal_stages(stage);

-- ============================================================================
-- 6. USER PORTFOLIO
-- ============================================================================
create table user_portfolio (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references user_profiles(id) on delete cascade,
  deal_id               uuid references opportunities(id) on delete set null,
  investment_name       text default '',
  sponsor               text default '',
  asset_class           text default '',
  amount_invested       numeric,
  date_invested         date,
  status                text default '',
  target_irr            numeric,
  distributions_received numeric default 0,
  hold_period           numeric,
  investing_entity      text default '',
  entity_invested_into  text default '',
  notes                 text default '',
  updated_at            timestamptz default now(),
  created_at            timestamptz default now()
);

create index idx_portfolio_user on user_portfolio(user_id);

-- ============================================================================
-- 7. USER GOALS
-- ============================================================================
create table user_goals (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references user_profiles(id) on delete cascade,
  goal_type         text,
  current_income    numeric,
  target_income     numeric,
  capital_available numeric,
  timeline          text,
  tax_reduction     numeric,
  updated_at        timestamptz default now(),
  unique(user_id)                                     -- one goal record per user
);

-- ============================================================================
-- 8. USER TAX DOCS
-- ============================================================================
create table user_tax_docs (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references user_profiles(id) on delete cascade,
  tax_year              text,
  investment_name       text default '',
  investing_entity      text default '',
  entity_invested_into  text default '',
  form_type             text default '',
  upload_status         text default '',
  date_received         date,
  file_url              text default '',              -- Supabase Storage path
  portal_url            text default '',
  contact_name          text default '',
  contact_email         text default '',
  contact_phone         text default '',
  notes                 text default '',
  updated_at            timestamptz default now(),
  created_at            timestamptz default now()
);

create index idx_taxdocs_user on user_tax_docs(user_id);

-- ============================================================================
-- 9. DD CHECKLIST (shared/community)
-- ============================================================================
create table dd_checklist (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid not null references opportunities(id) on delete cascade,
  item_index      integer not null,
  item_text       text default '',
  checked_by_id   uuid references user_profiles(id) on delete set null,
  checked_by_email text default '',
  checked_by_name text default '',
  checked_at      timestamptz default now(),
  unique(deal_id, item_index)                         -- one check per item per deal
);

create index idx_dd_deal on dd_checklist(deal_id);

-- ============================================================================
-- 10. DECK SUBMISSIONS
-- ============================================================================
create table deck_submissions (
  id              uuid primary key default gen_random_uuid(),
  deal_id         uuid references opportunities(id) on delete set null,
  deal_name       text default '',
  deck_url        text default '',                    -- Supabase Storage path
  notes           text default '',
  submitted_by_id uuid references user_profiles(id) on delete set null,
  submitted_by_name text default '',
  submitted_by_email text default '',
  created_at      timestamptz default now()
);

-- ============================================================================
-- 11. USER EVENTS (analytics/funnel tracking)
-- Replaces GHL custom field counters with a proper event log.
-- ============================================================================
create table user_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references user_profiles(id) on delete cascade,
  event       text not null,                          -- 'wizard_complete', 'deal_viewed', etc.
  data        jsonb default '{}',                     -- flexible payload
  created_at  timestamptz default now()
);

create index idx_events_user on user_events(user_id);
create index idx_events_type on user_events(event);
create index idx_events_created on user_events(created_at desc);

-- ============================================================================
-- 12. ROW-LEVEL SECURITY (RLS)
-- This is the killer feature: security enforced at the database level.
-- ============================================================================

-- Enable RLS on all tables
alter table management_companies enable row level security;
alter table opportunities enable row level security;
alter table user_profiles enable row level security;
alter table user_buy_box enable row level security;
alter table user_deal_stages enable row level security;
alter table user_portfolio enable row level security;
alter table user_goals enable row level security;
alter table user_tax_docs enable row level security;
alter table dd_checklist enable row level security;
alter table deck_submissions enable row level security;
alter table user_events enable row level security;

-- Helper: check if current user is admin
create or replace function is_admin()
returns boolean as $$
  select coalesce(
    (select is_admin from user_profiles where id = auth.uid()),
    false
  );
$$ language sql security definer stable;

-- MANAGEMENT COMPANIES: everyone can read, admins can write
create policy "mc_read" on management_companies for select using (true);
create policy "mc_admin_insert" on management_companies for insert with check (is_admin());
create policy "mc_admin_update" on management_companies for update using (is_admin());
create policy "mc_admin_delete" on management_companies for delete using (is_admin());

-- OPPORTUNITIES: everyone can read, admins can write
create policy "opp_read" on opportunities for select using (true);
create policy "opp_admin_insert" on opportunities for insert with check (is_admin());
create policy "opp_admin_update" on opportunities for update using (is_admin());
create policy "opp_admin_delete" on opportunities for delete using (is_admin());

-- USER PROFILES: users see own profile, admins see all
create policy "profile_own_read" on user_profiles for select
  using (id = auth.uid() or is_admin());
create policy "profile_own_update" on user_profiles for update
  using (id = auth.uid());
create policy "profile_insert" on user_profiles for insert
  with check (id = auth.uid());

-- BUY BOX: users see/edit own, admins see all
create policy "buybox_own" on user_buy_box for select
  using (user_id = auth.uid() or is_admin());
create policy "buybox_own_insert" on user_buy_box for insert
  with check (user_id = auth.uid());
create policy "buybox_own_update" on user_buy_box for update
  using (user_id = auth.uid());

-- DEAL STAGES: users see/edit own, admins see all
create policy "stages_own" on user_deal_stages for select
  using (user_id = auth.uid() or is_admin());
create policy "stages_own_insert" on user_deal_stages for insert
  with check (user_id = auth.uid());
create policy "stages_own_update" on user_deal_stages for update
  using (user_id = auth.uid());
create policy "stages_own_delete" on user_deal_stages for delete
  using (user_id = auth.uid());

-- PORTFOLIO: users see/edit own, admins see all
create policy "portfolio_own" on user_portfolio for select
  using (user_id = auth.uid() or is_admin());
create policy "portfolio_own_insert" on user_portfolio for insert
  with check (user_id = auth.uid());
create policy "portfolio_own_update" on user_portfolio for update
  using (user_id = auth.uid());
create policy "portfolio_own_delete" on user_portfolio for delete
  using (user_id = auth.uid());

-- GOALS: users see/edit own
create policy "goals_own" on user_goals for select
  using (user_id = auth.uid() or is_admin());
create policy "goals_own_insert" on user_goals for insert
  with check (user_id = auth.uid());
create policy "goals_own_update" on user_goals for update
  using (user_id = auth.uid());

-- TAX DOCS: users see/edit own (sensitive!)
create policy "taxdocs_own" on user_tax_docs for select
  using (user_id = auth.uid() or is_admin());
create policy "taxdocs_own_insert" on user_tax_docs for insert
  with check (user_id = auth.uid());
create policy "taxdocs_own_update" on user_tax_docs for update
  using (user_id = auth.uid());
create policy "taxdocs_own_delete" on user_tax_docs for delete
  using (user_id = auth.uid());

-- DD CHECKLIST: everyone authenticated can read and write (shared/community)
create policy "dd_read" on dd_checklist for select using (true);
create policy "dd_insert" on dd_checklist for insert with check (auth.uid() is not null);
create policy "dd_update" on dd_checklist for update using (auth.uid() is not null);
create policy "dd_delete" on dd_checklist for delete using (auth.uid() is not null);

-- DECK SUBMISSIONS: users can insert, admins can see all
create policy "deck_sub_insert" on deck_submissions for insert
  with check (auth.uid() is not null);
create policy "deck_sub_read" on deck_submissions for select
  using (submitted_by_id = auth.uid() or is_admin());

-- EVENTS: users see own, admins see all
create policy "events_own" on user_events for select
  using (user_id = auth.uid() or is_admin());
create policy "events_insert" on user_events for insert
  with check (user_id = auth.uid());

-- ============================================================================
-- 13. STORAGE BUCKETS
-- ============================================================================
-- Run these via Supabase Dashboard or API (not pure SQL):
--   supabase storage create deal-decks --public=false
--   supabase storage create tax-docs --public=false
--
-- Storage policies (set in dashboard):
--   deal-decks: authenticated users can upload, admins can read all
--   tax-docs: users can only read/write their own folder (path = user_id/*)

-- ============================================================================
-- 14. USEFUL VIEWS
-- ============================================================================

-- Deals with operator info joined (replaces the multi-table Airtable fetch)
create or replace view deals_with_operators as
select
  o.*,
  mc.operator_name,
  mc.ceo,
  mc.website as mc_website,
  mc.linkedin_ceo as mc_linkedin,
  mc.invest_clearly_profile as mc_invest_clearly,
  mc.founding_year as mc_founding_year,
  mc.type as mc_type,
  mc.total_investors as mc_total_investors,
  mc.asset_classes as mc_asset_classes
from opportunities o
left join management_companies mc on o.management_company_id = mc.id;

-- Deal stage counts (replaces /api/deal-stats)
create or replace view deal_stage_counts as
select
  deal_id,
  count(*) filter (where stage = 'interested') as interested,
  count(*) filter (where stage = 'duediligence') as duediligence,
  count(*) filter (where stage = 'portfolio') as portfolio
from user_deal_stages
group by deal_id;

-- ============================================================================
-- 15. AUTO-UPDATE timestamps
-- ============================================================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_opp_updated before update on opportunities
  for each row execute function update_updated_at();
create trigger trg_profile_updated before update on user_profiles
  for each row execute function update_updated_at();
create trigger trg_buybox_updated before update on user_buy_box
  for each row execute function update_updated_at();
create trigger trg_stages_updated before update on user_deal_stages
  for each row execute function update_updated_at();
create trigger trg_portfolio_updated before update on user_portfolio
  for each row execute function update_updated_at();
create trigger trg_goals_updated before update on user_goals
  for each row execute function update_updated_at();
create trigger trg_taxdocs_updated before update on user_tax_docs
  for each row execute function update_updated_at();

-- ============================================================================
-- 16. REALTIME (enable for tables that benefit from live updates)
-- ============================================================================
-- Enable in Supabase Dashboard → Database → Replication:
--   dd_checklist (live DD checklist updates)
--   user_deal_stages (live deal interest counters)
--   opportunities (live deal updates when admin edits)
