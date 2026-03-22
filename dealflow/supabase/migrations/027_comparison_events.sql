-- Track comparison and decision-stage events for LP analytics
CREATE TABLE IF NOT EXISTS user_comparison_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id),
  event_type  text NOT NULL,
  deal_ids    text[] DEFAULT '{}',
  deal_count  integer DEFAULT 0,
  metadata    jsonb DEFAULT '{}',
  created_at  timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE user_comparison_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own comparison events"
  ON user_comparison_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role full access on comparison events"
  ON user_comparison_events FOR ALL
  USING (auth.role() = 'service_role');

-- Indexes
CREATE INDEX idx_comp_events_user ON user_comparison_events(user_id);
CREATE INDEX idx_comp_events_type ON user_comparison_events(event_type);
CREATE INDEX idx_comp_events_created ON user_comparison_events(created_at DESC);
