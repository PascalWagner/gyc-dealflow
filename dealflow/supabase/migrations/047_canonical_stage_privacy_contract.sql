-- 047: Canonical stage privacy contract
-- Fixes deal_stage_counts view to use post-040 stage names
-- Adds email_digest_enabled + deal_alerts_enabled notification columns to user_profiles
-- Applied: 2026-03-27

-- 1. Recreate deal_stage_counts view with canonical (post-040) stage names
--    CASCADE is needed because deal_social_proof_counts (created outside migrations,
--    not used by app code) depends on this view.
DROP VIEW IF EXISTS deal_stage_counts CASCADE;
CREATE VIEW deal_stage_counts AS
SELECT
  deal_id,
  count(*) FILTER (WHERE stage = 'saved')    AS interested,
  count(*) FILTER (WHERE stage = 'vetting')  AS duediligence,
  count(*) FILTER (WHERE stage = 'invested') AS portfolio
FROM user_deal_stages
GROUP BY deal_id;

-- 2. Add notification columns to user_profiles
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS email_digest_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS deal_alerts_enabled  boolean NOT NULL DEFAULT true;
