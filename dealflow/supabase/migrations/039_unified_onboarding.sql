-- ============================================================================
-- 039: Unified Onboarding — new fields for LP deal count + onboarding tracking
-- ============================================================================

-- LP deals count: number of deals the user has invested in as an LP (self-reported)
ALTER TABLE user_buy_box ADD COLUMN IF NOT EXISTS lp_deals_count integer;

-- Onboarding completion timestamp (universal onboarding, not wizard)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz;
