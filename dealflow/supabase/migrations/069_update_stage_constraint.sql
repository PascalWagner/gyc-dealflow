-- Migration 069: Align user_deal_stages stage constraint with current CANONICAL_DB_STAGES
--
-- Background:
--   Migration 040 standardized stage names to: browse, saved, vetting, diligence, decision, invested, passed
--   The frontend (dealflow-contract.js CANONICAL_DB_STAGES) was subsequently updated to use:
--     filter, review, connect, decide, invested, skipped
--   This mismatch caused every deal stage action (except 'invested') to fail with a check
--   constraint violation → 500 "Internal server error" in the UI.
--
-- This migration:
--   1. Drops the old constraint
--   2. Migrates any existing rows with old stage names to the new canonical names
--   3. Adds the new constraint matching CANONICAL_DB_STAGES exactly

-- Step 1: Drop the old constraint
ALTER TABLE user_deal_stages DROP CONSTRAINT IF EXISTS user_deal_stages_stage_check;

-- Step 2: Migrate any lingering rows with old stage names
UPDATE user_deal_stages SET stage = 'filter'   WHERE stage IN ('browse', 'new');
UPDATE user_deal_stages SET stage = 'review'   WHERE stage IN ('saved', 'vetting', 'interested');
UPDATE user_deal_stages SET stage = 'connect'  WHERE stage IN ('diligence', 'duediligence', 'dd');
UPDATE user_deal_stages SET stage = 'decide'   WHERE stage IN ('decision', 'ready');
UPDATE user_deal_stages SET stage = 'invested' WHERE stage IN ('portfolio');
UPDATE user_deal_stages SET stage = 'skipped'  WHERE stage IN ('passed');

-- Step 3: Add the new constraint matching CANONICAL_DB_STAGES in dealflow-contract.js
ALTER TABLE user_deal_stages ADD CONSTRAINT user_deal_stages_stage_check
  CHECK (stage IN ('filter', 'review', 'connect', 'decide', 'invested', 'skipped'));
