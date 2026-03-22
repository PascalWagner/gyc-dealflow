-- Cache for Census Bureau + BLS market intelligence data
-- Keyed by zip code, refreshed when stale (>30 days)

CREATE TABLE IF NOT EXISTS market_data_cache (
  zip TEXT PRIMARY KEY,
  data JSONB NOT NULL,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for stale cache cleanup
CREATE INDEX IF NOT EXISTS idx_market_data_cache_fetched ON market_data_cache (fetched_at);

COMMENT ON TABLE market_data_cache IS 'Caches Census ACS + BLS QCEW market data by zip code. Refreshed when older than 30 days.';
