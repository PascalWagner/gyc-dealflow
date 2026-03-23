-- Migration 042: Create intro_requests table for tracking introduction requests
-- Stores every intro request so Pascal can see history and follow up

CREATE TABLE IF NOT EXISTS intro_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  user_email text NOT NULL,
  deal_id uuid,
  deal_name text NOT NULL,
  operator_name text NOT NULL,
  operator_ceo text,
  message text,
  status text NOT NULL DEFAULT 'pending',
  email_to text,
  email_type text,
  email_sent boolean DEFAULT false,
  resend_error text,
  ghl_synced boolean DEFAULT false,
  ghl_contact_id text,
  log jsonb,
  created_at timestamptz DEFAULT now()
);

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
