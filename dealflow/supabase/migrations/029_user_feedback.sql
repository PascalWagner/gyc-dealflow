-- User feedback storage (submitted via Send Feedback button)
CREATE TABLE IF NOT EXISTS user_feedback (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_email text NOT NULL,
  user_name text,
  type text NOT NULL CHECK (type IN ('bug', 'feature', 'question', 'other')),
  message text NOT NULL,
  screenshot_url text,
  page text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE user_feedback ENABLE ROW LEVEL SECURITY;

-- Service role can do everything
CREATE POLICY "Service role full access on user_feedback"
  ON user_feedback FOR ALL
  USING (auth.role() = 'service_role');

-- Index for admin listing (newest first)
CREATE INDEX idx_user_feedback_created ON user_feedback(created_at DESC);
