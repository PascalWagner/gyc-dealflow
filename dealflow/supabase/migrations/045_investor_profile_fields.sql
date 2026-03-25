-- Migration 045: Persist investor profile fields on user_profiles
-- Supports the settings investor profile tab in the Svelte app.

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS accredited_status text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS investable_capital text;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS investment_experience text;
