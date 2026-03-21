-- GP Login: allow operators/sponsors to log in and manage their own profile
-- Adds GP-specific columns to user_profiles and management_companies

-- ============================================================================
-- 1. EXTEND USER PROFILES with GP fields
-- ============================================================================
alter table user_profiles
  add column gp_type text,                                  -- 'founder', 'sponsor', 'operator'
  add column management_company_id uuid
    references management_companies(id) on delete set null,
  add column gp_verified boolean default false;

create index idx_profile_mc on user_profiles(management_company_id)
  where management_company_id is not null;

-- ============================================================================
-- 2. EXTEND MANAGEMENT COMPANIES with GP self-service fields
-- ============================================================================
alter table management_companies
  add column authorized_emails text[] default '{}',         -- emails allowed to manage this operator's deals
  add column booking_url text;                              -- calendar booking link for the GP

-- ============================================================================
-- 3. RLS: GPs can update their own management company's authorized_emails and booking_url
-- ============================================================================
create policy "mc_gp_update" on management_companies for update
  using (
    id in (
      select management_company_id
      from user_profiles
      where id = auth.uid()
        and gp_verified = true
        and management_company_id is not null
    )
  )
  with check (
    id in (
      select management_company_id
      from user_profiles
      where id = auth.uid()
        and gp_verified = true
        and management_company_id is not null
    )
  );
