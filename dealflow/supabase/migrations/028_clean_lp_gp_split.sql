-- Clean up lp_gp_split values that aren't actual splits (e.g. "Debt fund – 1.5% asset mgmt fee")
-- Valid values match the pattern "XX/XX" (two numbers separated by a slash)
UPDATE opportunities
SET lp_gp_split = NULL
WHERE lp_gp_split IS NOT NULL
  AND lp_gp_split != ''
  AND lp_gp_split !~ '^\d+\s*/\s*\d+$';
