-- Co-investment invite links
CREATE TABLE IF NOT EXISTS invite_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  deal_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  inviter_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  inviter_email TEXT NOT NULL,
  inviter_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invite_links_code ON invite_links(code);
CREATE INDEX idx_invite_links_inviter ON invite_links(inviter_user_id);
CREATE INDEX idx_invite_links_deal ON invite_links(deal_id);

-- Invite conversions (tracks when invitees sign up)
CREATE TABLE IF NOT EXISTS invite_conversions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  invite_link_id UUID NOT NULL REFERENCES invite_links(id) ON DELETE CASCADE,
  invitee_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invitee_email TEXT,
  converted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_invite_conversions_link ON invite_conversions(invite_link_id);

-- GP deal claims
CREATE TABLE IF NOT EXISTS deal_claims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  claimer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claimer_email TEXT NOT NULL,
  claimer_name TEXT NOT NULL,
  company_name TEXT,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

CREATE INDEX idx_deal_claims_deal ON deal_claims(deal_id);
CREATE INDEX idx_deal_claims_status ON deal_claims(status);
