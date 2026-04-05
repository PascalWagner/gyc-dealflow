-- Migration 073: sponsor deduplication guardrails
--
-- Enables pg_trgm for fuzzy similarity search so deal-create can detect
-- near-duplicate management_company rows before silently inserting a new one.
-- Also adds a case-insensitive unique index to block exact duplicates at the DB level.
--
-- Before applying in production, verify no duplicates remain:
--   SELECT lower(trim(operator_name)), count(*)
--   FROM management_companies
--   GROUP BY lower(trim(operator_name))
--   HAVING count(*) > 1;
-- This should return 0 rows. The table was cleaned manually on 2026-04-05.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS management_companies_operator_name_trgm
  ON management_companies USING gin (operator_name gin_trgm_ops);

CREATE UNIQUE INDEX IF NOT EXISTS management_companies_operator_name_unique
  ON management_companies (lower(trim(operator_name)));

-- RPC function used by api/deal-create.js Phase B similarity check.
-- Returns the top N management_companies that fuzzy-match p_name above p_threshold.
CREATE OR REPLACE FUNCTION find_similar_sponsors(
  p_name      text,
  p_threshold float8 DEFAULT 0.45,
  p_limit     int    DEFAULT 3
)
RETURNS TABLE (
  id            uuid,
  operator_name text,
  website       text,
  type          text
)
LANGUAGE sql
STABLE
AS $$
  SELECT id, operator_name, website, type
  FROM management_companies
  WHERE similarity(operator_name, p_name) > p_threshold
  ORDER BY similarity(operator_name, p_name) DESC
  LIMIT p_limit;
$$;
