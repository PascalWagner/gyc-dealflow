-- Introduction request tracking
CREATE TABLE IF NOT EXISTS intro_requests (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id),
  user_email text NOT NULL,
  deal_id uuid,
  deal_name text NOT NULL,
  operator_name text NOT NULL,
  operator_ceo text,
  message text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'declined')),
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE intro_requests ENABLE ROW LEVEL SECURITY;

-- Users can see their own requests
CREATE POLICY "Users can view own intro requests"
  ON intro_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can do everything
CREATE POLICY "Service role full access on intro_requests"
  ON intro_requests FOR ALL
  USING (auth.role() = 'service_role');

-- Index for admin queries
CREATE INDEX idx_intro_requests_created ON intro_requests(created_at DESC);
