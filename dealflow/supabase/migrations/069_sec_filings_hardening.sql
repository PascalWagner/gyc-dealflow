-- 069_sec_filings_hardening.sql
--
-- Enforces the invariant that at most one row per CIK in sec_filings has
-- is_latest_amendment = true, at the database level.
--
-- WHY: Application code (fetchAllFilingsForCIK) had a bug where every filing
-- in a loop was set to is_latest_amendment = true, leaving the oldest filing
-- with the flag because each iteration cleared all previous flags and set the
-- current one. The unique partial index below makes this class of bug
-- impossible: a second UPDATE setting a different row to true for the same CIK
-- will fail with a constraint violation before it can land.
--
-- Also adds sec_data_refreshed_at to opportunities so we can track staleness
-- and power a weekly cron refresh.

-- Unique partial index: at most one is_latest_amendment = true per CIK.
-- If application code tries to set two rows to true for the same CIK,
-- Postgres throws a unique constraint violation.
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_latest_per_cik
  ON sec_filings(cik)
  WHERE is_latest_amendment = true;

-- Staleness tracking column on opportunities.
-- Set by refreshSecFilingsForDeal() and dlp-sec-backfill.mjs after a sync.
-- Used by refresh-sec-filings.mjs to skip recently refreshed deals.
ALTER TABLE opportunities
  ADD COLUMN IF NOT EXISTS sec_data_refreshed_at timestamptz;

-- Repair any existing rows that have multiple is_latest_amendment = true
-- for the same CIK (the bug may have already run in production).
-- For each CIK, keep only the newest filing_date as true; set all others false.
DO $$
DECLARE
  r RECORD;
  newest_id uuid;
BEGIN
  FOR r IN
    SELECT cik
    FROM sec_filings
    WHERE is_latest_amendment = true
    GROUP BY cik
    HAVING count(*) > 1
  LOOP
    -- Find the newest filing for this CIK
    SELECT id INTO newest_id
    FROM sec_filings
    WHERE cik = r.cik
      AND filing_date IS NOT NULL
    ORDER BY filing_date DESC
    LIMIT 1;

    IF newest_id IS NOT NULL THEN
      -- Clear all, then set only the newest
      UPDATE sec_filings SET is_latest_amendment = false WHERE cik = r.cik;
      UPDATE sec_filings SET is_latest_amendment = true  WHERE id = newest_id;
    END IF;
  END LOOP;
END $$;
