-- Add onboarding completion and TOS acceptance timestamps
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tos_accepted_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill: mark existing users who have onboarding data as completed
-- Users with onboarding_role set have been through onboarding
UPDATE user_profiles SET onboarding_completed_at = COALESCE(updated_at, created_at, NOW())
WHERE onboarding_completed_at IS NULL
  AND (full_name IS NOT NULL AND full_name != '');
