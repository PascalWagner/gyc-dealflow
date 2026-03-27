-- 049: Idempotency guard and release gate helpers

-- Unique constraint: only one running digest at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_runs_single_running
  ON weekly_digest_runs(status) WHERE status = 'running';

-- Unique constraint: one delivery per user per run
CREATE UNIQUE INDEX IF NOT EXISTS idx_digest_deliveries_run_user
  ON weekly_digest_deliveries(run_id, email);

-- Helper: check if a digest was already sent to an email within N hours (default 24)
CREATE OR REPLACE FUNCTION digest_recently_sent(p_email text, p_hours integer DEFAULT 24)
RETURNS boolean
LANGUAGE sql STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM weekly_digest_deliveries
    WHERE email = p_email
      AND status = 'sent'
      AND created_at > now() - make_interval(hours => p_hours)
  );
$$;
