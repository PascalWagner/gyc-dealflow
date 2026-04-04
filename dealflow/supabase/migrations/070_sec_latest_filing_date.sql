-- 070_sec_latest_filing_date.sql
--
-- Adds sec_latest_filing_date to opportunities so the Deal Analysis Legitimacy
-- section can show "Latest Filing" (the date of the most recent SEC filing
-- that the displayed Capital Raised / Investors figures are sourced from)
-- alongside "First Sale" (when the offering first opened).
--
-- Populated automatically by buildDealUpdatesFromSecFiling whenever any
-- SEC filing sync runs (api/_sec-edgar.js). Backfilled here for existing deals.

ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS sec_latest_filing_date date;

-- Backfill from existing sec_filings: for each deal with a linked filing,
-- pull the filing_date of the is_latest_amendment = true row.
UPDATE opportunities o
SET sec_latest_filing_date = sf.filing_date
FROM sec_filings sf
WHERE sf.opportunity_id = o.id
  AND sf.is_latest_amendment = true
  AND sf.filing_date IS NOT NULL
  AND o.sec_latest_filing_date IS NULL;
