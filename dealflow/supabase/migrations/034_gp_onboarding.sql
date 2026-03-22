-- ============================================================================
-- 034: GP Onboarding — track GP onboarding progress + presentation interest
-- ============================================================================

-- Onboarding role (GP vs LP) — first fork in the experience
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS onboarding_role text
    CHECK (onboarding_role IN ('lp', 'gp'));

-- GP onboarding progress (0-6, maps to wizard steps)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS gp_onboarding_step integer DEFAULT 0;

-- Whether the GP has completed onboarding
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS gp_onboarding_complete boolean DEFAULT false;

-- Presentation interest (weekly webinar)
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS presentation_interest boolean DEFAULT null;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS presentation_interest_date timestamptz;

-- Company logo URL
ALTER TABLE management_companies
  ADD COLUMN IF NOT EXISTS logo_url text;

-- Index for quick lookup of incomplete GP onboardings (admin reporting)
CREATE INDEX IF NOT EXISTS idx_gp_onboarding_incomplete
  ON user_profiles(gp_onboarding_step)
  WHERE onboarding_role = 'gp' AND gp_onboarding_complete = false;
