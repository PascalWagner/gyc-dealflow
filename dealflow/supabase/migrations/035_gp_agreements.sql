-- ============================================================================
-- 035: GP Agreements — track operator acceptance of platform terms
-- ============================================================================
-- Stores a signed record every time a GP accepts the Operator Listing Agreement.
-- Each row is immutable (append-only) — if terms change, the GP must re-accept
-- and a new row is created with the updated version.
--
-- This table serves as the legal audit trail for:
--   1. Platform Terms of Service acceptance
--   2. Operator Listing Agreement (permission to display deals, share with LPs)
--   3. Data accuracy representation
--   4. Presentation recording & distribution consent
--   5. 506(b) vs 506(c) compliance acknowledgment

CREATE TABLE IF NOT EXISTS gp_agreements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  management_company_id UUID REFERENCES management_companies(id) ON DELETE SET NULL,

  -- What they accepted
  agreement_version     TEXT NOT NULL DEFAULT '1.0',
  offering_type         TEXT NOT NULL DEFAULT '506c'
                        CHECK (offering_type IN ('506b', '506c', 'reg_a', 'other')),

  -- Individual consent flags (all must be true to proceed)
  accepted_tos          BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_listing      BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_data_accuracy BOOLEAN NOT NULL DEFAULT FALSE,
  accepted_recording    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Legal metadata (for defensibility)
  accepted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address            TEXT,
  user_agent            TEXT,
  signatory_name        TEXT NOT NULL,     -- typed name as e-signature
  signatory_email       TEXT NOT NULL,
  signatory_title       TEXT,              -- e.g. "Managing Partner"

  -- Full text of the agreement at time of signing (snapshot)
  agreement_text_hash   TEXT,              -- SHA-256 of the agreement text shown

  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gp_agreements_user ON gp_agreements(user_id);
CREATE INDEX IF NOT EXISTS idx_gp_agreements_company ON gp_agreements(management_company_id);

-- RLS: Users can read their own agreements, admins can read all
ALTER TABLE gp_agreements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own agreements"
  ON gp_agreements FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Users insert own agreements"
  ON gp_agreements FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No update/delete — agreements are immutable audit records

COMMENT ON TABLE gp_agreements IS 'Immutable audit trail of GP operator agreement acceptances. Append-only — new version = new row.';
