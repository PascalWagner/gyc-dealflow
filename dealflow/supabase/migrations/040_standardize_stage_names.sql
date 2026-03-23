-- Standardize pipeline stage names: allow both legacy and new names
-- Legacy: new, interested, duediligence, portfolio, ready
-- New:    browse, saved, vetting, diligence, decision, invested, passed
--
-- The frontend already uses new names; this migration:
-- 1. Expands the constraint to accept all valid names
-- 2. Migrates existing legacy rows to new names

-- Step 1: Drop old constraint and add one that accepts all names
ALTER TABLE user_deal_stages DROP CONSTRAINT IF EXISTS user_deal_stages_stage_check;
ALTER TABLE user_deal_stages ADD CONSTRAINT user_deal_stages_stage_check
  CHECK (stage IN ('browse', 'saved', 'vetting', 'diligence', 'decision', 'invested', 'passed',
                   'new', 'interested', 'duediligence', 'portfolio', 'ready'));

-- Step 2: Migrate legacy stage names to new names
UPDATE user_deal_stages SET stage = 'browse'    WHERE stage = 'new';
UPDATE user_deal_stages SET stage = 'saved'     WHERE stage = 'interested';
UPDATE user_deal_stages SET stage = 'vetting'   WHERE stage = 'duediligence';
UPDATE user_deal_stages SET stage = 'invested'  WHERE stage = 'portfolio';
UPDATE user_deal_stages SET stage = 'decision'  WHERE stage = 'ready';

-- Step 3: Tighten constraint to only new names
ALTER TABLE user_deal_stages DROP CONSTRAINT IF EXISTS user_deal_stages_stage_check;
ALTER TABLE user_deal_stages ADD CONSTRAINT user_deal_stages_stage_check
  CHECK (stage IN ('browse', 'saved', 'vetting', 'diligence', 'decision', 'invested', 'passed'));
