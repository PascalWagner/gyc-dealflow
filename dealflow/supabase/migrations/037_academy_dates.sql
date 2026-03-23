-- Add academy membership date tracking and billing preferences
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS academy_start timestamptz,
  ADD COLUMN IF NOT EXISTS academy_end   timestamptz,
  ADD COLUMN IF NOT EXISTS auto_renew    boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS card_last4    text,
  ADD COLUMN IF NOT EXISTS card_brand    text;

-- Default academy_end to Dec 31 2026 for existing academy members
UPDATE user_profiles
  SET academy_end = '2026-12-31T23:59:59Z'
  WHERE tier = 'academy' AND academy_end IS NULL;
