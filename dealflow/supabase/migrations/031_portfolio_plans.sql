-- ============================================================================
-- 031: Portfolio Plans — structured investment blueprint per user
-- ============================================================================
-- Stores the user's portfolio allocation plan generated from the onboarding
-- wizard. The plan divides their capital into "buckets" (Income, Growth,
-- Diversifier, Tax Shield) with target allocations, deal counts, and criteria.
-- As the user invests, slots within buckets are filled by linking to
-- user_portfolio records.
--
-- The buckets column is JSONB because:
--   1. Buckets are always loaded/saved as a unit (no partial queries)
--   2. The schema may evolve (new fields per bucket) without migrations
--   3. Ordering matters and JSONB arrays preserve it
--   4. One query loads the full plan — no joins

create table if not exists user_portfolio_plans (
  id                   uuid primary key default gen_random_uuid(),
  user_id              uuid not null references auth.users(id) on delete cascade,

  -- Top-level plan parameters
  total_capital        integer not null default 0,
  check_size           integer not null default 100000,
  target_annual_income integer,
  target_irr           numeric(5,2),
  target_tax_offset    integer,

  -- The plan: array of allocation buckets (see below for structure)
  buckets              jsonb not null default '[]'::jsonb,

  -- How the plan was created
  generated_from       text not null default 'wizard'
                       check (generated_from in ('wizard', 'manual', 'adjusted')),

  created_at           timestamptz default now(),
  updated_at           timestamptz default now(),

  -- One plan per user
  constraint unique_user_portfolio_plan unique (user_id)
);

-- Indexes
create index if not exists idx_portfolio_plans_user on user_portfolio_plans(user_id);

-- RLS
alter table user_portfolio_plans enable row level security;

create policy "Users read own plan"
  on user_portfolio_plans for select
  using (user_id = auth.uid() or is_admin());

create policy "Users insert own plan"
  on user_portfolio_plans for insert
  with check (user_id = auth.uid());

create policy "Users update own plan"
  on user_portfolio_plans for update
  using (user_id = auth.uid());

create policy "Users delete own plan"
  on user_portfolio_plans for delete
  using (user_id = auth.uid());

-- Auto-update timestamp
create trigger update_portfolio_plans_updated_at
  before update on user_portfolio_plans
  for each row execute function update_updated_at();

-- Add diversification preference to buy box
alter table user_buy_box
  add column if not exists diversification_pref text
  check (diversification_pref in ('focused', 'balanced', 'wide'));

comment on column user_buy_box.diversification_pref
  is 'How user wants to spread capital: focused (1-2 classes), balanced (3-4), wide (max diversification)';

comment on table user_portfolio_plans
  is 'Structured portfolio blueprint per user — allocation buckets with deal slots';

-- ============================================================================
-- BUCKETS JSONB STRUCTURE (for reference — not enforced by schema):
-- ============================================================================
-- [
--   {
--     "id": "income",
--     "label": "Income",
--     "pct": 60,
--     "capital": 600000,
--     "target_deals": 6,
--     "criteria": {
--       "asset_classes": ["Multi-Family", "Lending", "Self Storage"],
--       "strategies": ["Income", "Lending"],
--       "min_coc": 0.08,
--       "min_irr": null,
--       "distribution_freq": ["Monthly", "Quarterly"]
--     },
--     "filled_by": ["uuid-of-portfolio-item-1", "uuid-of-portfolio-item-2"]
--   },
--   ...
-- ]
