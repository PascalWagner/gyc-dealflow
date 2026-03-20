-- Investment Memos: persistent research records per user per deal
-- Stores thesis, risks, reflections, and DD answers snapshot

create table investment_memos (
  id              uuid primary key default gen_random_uuid(),
  user_email      text not null,
  deal_id         text not null,                    -- matches opportunity ID
  deal_name       text default '',                  -- denormalized for quick reads

  -- User-written fields
  thesis          text default '',                  -- why they're investing
  risks           text default '',                  -- key risks identified
  reflection      text default '',                  -- post-investment journal

  -- Snapshots at time of memo creation/update
  buy_box_match   jsonb default '{}',               -- { criteria: [...], matched: N, total: N }
  dd_answers      jsonb default '{}',               -- snapshot of DD checklist answers
  deal_snapshot   jsonb default '{}',               -- key metrics at time of memo

  -- Metadata
  stage           text default 'ready',             -- stage when memo was created/updated
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Indexes
create index idx_memos_user on investment_memos(user_email);
create index idx_memos_deal on investment_memos(deal_id);
create unique index idx_memos_user_deal on investment_memos(user_email, deal_id);

-- Auto-update timestamp
create or replace function update_memo_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_memo_updated
  before update on investment_memos
  for each row execute function update_memo_timestamp();

-- RLS
alter table investment_memos enable row level security;

-- Users can read/write their own memos
create policy "memos_own_read" on investment_memos for select
  using (true);  -- Admin reads all; frontend filters by email
create policy "memos_own_insert" on investment_memos for insert
  with check (true);
create policy "memos_own_update" on investment_memos for update
  using (true);
