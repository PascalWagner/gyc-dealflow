-- ============================================================================
-- STAKE LISTINGS (Secondaries Marketplace)
-- Allows LPs to list their existing portfolio positions for sale.
-- Foundation for a secondaries platform / on-chain liquidity.
-- ============================================================================

create table stake_listings (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users(id) on delete cascade,
  portfolio_id      uuid references user_portfolio(id) on delete set null,
  deal_id           uuid references opportunities(id) on delete set null,

  -- Listing details
  investment_name   text not null,
  sponsor           text default '',
  asset_class       text default '',
  amount_invested   numeric default 0,
  asking_price      numeric,                -- null = "open to offers"
  reason            text default '',        -- why selling (optional)
  notes             text default '',        -- additional context

  -- Status workflow
  status            text not null default 'active'
                    check (status in ('active', 'pending_review', 'sold', 'withdrawn')),

  -- Contact
  contact_email     text default '',
  contact_phone     text default '',
  anonymous         boolean default false,  -- hide identity from browsers

  -- Timestamps
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  sold_at           timestamptz
);

create index idx_stake_listings_user on stake_listings(user_id);
create index idx_stake_listings_status on stake_listings(status);
create index idx_stake_listings_deal on stake_listings(deal_id);
create index idx_stake_listings_created on stake_listings(created_at desc);

-- RLS: users can manage their own listings, everyone can read active ones
alter table stake_listings enable row level security;

create policy "Users can read active stake listings"
  on stake_listings for select
  using (status = 'active' or auth.uid() = user_id);

create policy "Users can insert their own stake listings"
  on stake_listings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own stake listings"
  on stake_listings for update
  using (auth.uid() = user_id);

create policy "Users can delete their own stake listings"
  on stake_listings for delete
  using (auth.uid() = user_id);
