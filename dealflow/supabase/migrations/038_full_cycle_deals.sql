-- Add full_cycle_deals count to management_companies
-- Tracks how many deals a manager has successfully completed (full cycle: acquire → operate → exit)

ALTER TABLE management_companies
  ADD COLUMN IF NOT EXISTS full_cycle_deals integer;

COMMENT ON COLUMN management_companies.full_cycle_deals IS 'Number of deals that have gone full cycle (acquired, operated, and exited)';

-- Update the deals_with_operators view to include the new field
CREATE OR REPLACE VIEW deals_with_operators AS
SELECT
  o.*,
  mc.operator_name,
  mc.ceo,
  mc.website AS mc_website,
  mc.linkedin_ceo AS mc_linkedin,
  mc.invest_clearly_profile AS mc_invest_clearly,
  mc.founding_year AS mc_founding_year,
  mc.type AS mc_type,
  mc.total_investors AS mc_total_investors,
  mc.asset_classes AS mc_asset_classes,
  mc.full_cycle_deals AS mc_full_cycle_deals
FROM opportunities o
LEFT JOIN management_companies mc ON o.management_company_id = mc.id;
