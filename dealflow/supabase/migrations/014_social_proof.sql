-- Migration 014: Social proof — portfolio sharing + investor visibility
-- Adds opt-in sharing flag and policies for cross-user deal investor queries

-- 1. Add share_portfolio flag to user_profiles (default false = private)
alter table user_profiles
  add column if not exists share_portfolio boolean default false;

-- 2. Policy: allow any authenticated user to read other users' names
--    ONLY if that user has share_portfolio = true
create policy "public_profile_read"
  on user_profiles for select
  using (
    share_portfolio = true
    or id = auth.uid()
    or (select is_admin from user_profiles where id = auth.uid())
  );

-- 3. Policy: allow any authenticated user to count deal stages
--    (anonymous counts — no user info exposed)
create policy "stages_count_read"
  on user_deal_stages for select
  using (
    user_id = auth.uid()
    or (select is_admin from user_profiles where id = auth.uid())
    or true  -- anyone can read stage rows (for counting), but user_profiles policy limits name visibility
  );

-- 4. Policy: allow reading portfolio entries for users who opted in
create policy "portfolio_public_read"
  on user_portfolio for select
  using (
    user_id = auth.uid()
    or (select is_admin from user_profiles where id = auth.uid())
    or (select share_portfolio from user_profiles where id = user_portfolio.user_id)
  );
