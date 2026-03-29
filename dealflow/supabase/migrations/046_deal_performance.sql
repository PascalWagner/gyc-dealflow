-- Migration 046: Add skipped_from_stage for deal performance tracking
-- When an LP skips a deal, record which stage they were in before skipping.
-- This enables accurate cumulative funnel counting for GP deal performance.

ALTER TABLE user_deal_stages
ADD COLUMN IF NOT EXISTS skipped_from_stage TEXT;

-- Add a comment for documentation
COMMENT ON COLUMN user_deal_stages.skipped_from_stage IS
  'The stage the LP was in before skipping. Only populated when stage = skipped.';
