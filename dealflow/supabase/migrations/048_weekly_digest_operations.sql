-- 048: Weekly digest operations tables
-- Tracks digest runs and per-user deliveries for observability and idempotency

-- 1. Digest run log — one row per weekly invocation
CREATE TABLE IF NOT EXISTS weekly_digest_runs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  status       text NOT NULL DEFAULT 'running'
                 CHECK (status IN ('running', 'completed', 'failed')),
  total_users  integer,
  digests_sent integer,
  error_message text,
  metadata     jsonb DEFAULT '{}'::jsonb
);

-- 2. Per-user delivery log — one row per user per run
CREATE TABLE IF NOT EXISTS weekly_digest_deliveries (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id       uuid NOT NULL REFERENCES weekly_digest_runs(id) ON DELETE CASCADE,
  user_id      uuid,
  email        text NOT NULL,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  subject      text,
  match_count  integer DEFAULT 0,
  error_message text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_digest_deliveries_run_id ON weekly_digest_deliveries(run_id);
CREATE INDEX IF NOT EXISTS idx_digest_deliveries_email  ON weekly_digest_deliveries(email);
