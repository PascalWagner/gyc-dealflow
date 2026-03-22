-- Expand user_deal_stages stage check to include all pipeline stages
-- Old constraint only allowed: interested, duediligence, portfolio
-- New constraint adds: new, passed, decision, diligence

ALTER TABLE user_deal_stages DROP CONSTRAINT IF EXISTS user_deal_stages_stage_check;
ALTER TABLE user_deal_stages ADD CONSTRAINT user_deal_stages_stage_check
  CHECK (stage IN ('new', 'interested', 'duediligence', 'diligence', 'decision', 'portfolio', 'passed'));
