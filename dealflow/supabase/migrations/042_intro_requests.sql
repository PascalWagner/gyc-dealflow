-- Migration 042: Extend intro_requests with the richer request tracking shape
-- Migration 025 created the table; this one adds the fields needed by the newer flow.

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_intro_requests_user ON intro_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_intro_requests_status ON intro_requests(status);
CREATE INDEX IF NOT EXISTS idx_intro_requests_created ON intro_requests(created_at DESC);

-- RLS: service role can do everything, users can read their own
ALTER TABLE intro_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own intro requests"
  ON intro_requests FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access"
  ON intro_requests FOR ALL
  USING (auth.role() = 'service_role');
