-- Migration 041: Add phone, location, and granular privacy controls to user_profiles
-- Supports: Profile tab (phone/location), Privacy & Sharing tab (4 activity toggles)

-- Profile fields (synced to GHL on save)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS location text;

-- Granular privacy toggles (replaces the single share_portfolio boolean)
-- Each controls visibility of a specific activity type on deal pages
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_saved boolean NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_dd boolean NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS share_invested boolean NOT NULL DEFAULT false;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS allow_follows boolean NOT NULL DEFAULT false;

-- Migrate existing share_portfolio → share_invested (closest equivalent)
UPDATE user_profiles SET share_invested = share_portfolio WHERE share_portfolio = true;
