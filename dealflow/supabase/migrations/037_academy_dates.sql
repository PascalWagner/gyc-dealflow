-- Add academy membership date tracking
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS academy_start timestamptz,
  ADD COLUMN IF NOT EXISTS academy_end   timestamptz;

-- Default academy_end to Dec 31 2026 for existing academy members
UPDATE user_profiles
  SET academy_end = '2026-12-31T23:59:59Z'
  WHERE tier = 'academy' AND academy_end IS NULL;
