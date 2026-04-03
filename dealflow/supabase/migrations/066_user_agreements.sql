CREATE TABLE IF NOT EXISTS user_agreements (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agreement_type      TEXT NOT NULL DEFAULT 'platform_tos'
                      CHECK (agreement_type IN ('platform_tos')),
  agreement_version   TEXT NOT NULL DEFAULT '1.0',
  accepted_tos        BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_privacy    BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_disclaimer BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address          TEXT,
  user_agent          TEXT,
  agreement_text_hash TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_agreements_user ON user_agreements(user_id);
ALTER TABLE user_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own agreements"
  ON user_agreements FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM user_profiles WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Users insert own agreements"
  ON user_agreements FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Fast-path column on profiles to avoid extra API call
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS tos_accepted_version TEXT DEFAULT NULL;
