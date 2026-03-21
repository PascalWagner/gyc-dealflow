-- API Keys for public v1 API access
-- Agents and integrations authenticate with these keys instead of JWTs

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_hash TEXT NOT NULL UNIQUE,           -- SHA-256 hash of the API key (never store plaintext)
  key_prefix TEXT NOT NULL,                -- First 8 chars for identification (e.g. "gyc_k1_a")
  name TEXT NOT NULL,                      -- Human-readable label (e.g. "Acme Wealth Advisor Bot")
  owner_email TEXT NOT NULL,               -- Who owns this key
  tier TEXT NOT NULL DEFAULT 'free'        -- 'free' | 'pro' | 'enterprise'
    CHECK (tier IN ('free', 'pro', 'enterprise')),
  rate_limit_per_min INT NOT NULL DEFAULT 30,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['deals:read', 'operators:read'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMPTZ,
  request_count BIGINT NOT NULL DEFAULT 0,
  metadata JSONB DEFAULT '{}',            -- Flexible: company name, use case, etc.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ                  -- NULL = never expires
);

-- Index for fast key lookup
CREATE INDEX idx_api_keys_hash ON api_keys (key_hash) WHERE is_active = true;
CREATE INDEX idx_api_keys_owner ON api_keys (owner_email);

-- Log every API call for analytics & billing
CREATE TABLE api_request_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID REFERENCES api_keys(id),
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET',
  query_params JSONB,
  response_status INT,
  response_time_ms INT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partition-friendly index for time-range queries
CREATE INDEX idx_api_log_created ON api_request_log (created_at DESC);
CREATE INDEX idx_api_log_key ON api_request_log (api_key_id, created_at DESC);

-- RLS: only admins can manage API keys
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_request_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage api_keys" ON api_keys
  FOR ALL USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

CREATE POLICY "Admins read api_request_log" ON api_request_log
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- Service role can always access (for serverless functions)
CREATE POLICY "Service role api_keys" ON api_keys
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role api_request_log" ON api_request_log
  FOR ALL USING (auth.role() = 'service_role');
