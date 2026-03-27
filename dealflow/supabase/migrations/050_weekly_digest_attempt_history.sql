-- 050: Weekly digest delivery attempt history
-- Tracks each send attempt for retry logic and debugging

CREATE TABLE IF NOT EXISTS weekly_digest_delivery_attempts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  delivery_id  uuid NOT NULL REFERENCES weekly_digest_deliveries(id) ON DELETE CASCADE,
  attempted_at timestamptz NOT NULL DEFAULT now(),
  status       text NOT NULL CHECK (status IN ('success', 'failure', 'skipped')),
  provider     text,            -- e.g. 'resend', 'make', 'sendgrid'
  response_code integer,
  error_message text,
  metadata     jsonb DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_delivery
  ON weekly_digest_delivery_attempts(delivery_id);

CREATE INDEX IF NOT EXISTS idx_delivery_attempts_status
  ON weekly_digest_delivery_attempts(status, attempted_at);
