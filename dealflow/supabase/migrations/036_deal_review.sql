-- GP Deal Review: adds columns for deal lifecycle and GP review tracking

-- Track when GP confirms extracted data is accurate
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS gp_reviewed_at timestamptz;

-- Missing columns that the extraction prompt produces but weren't in the schema
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS redemption text DEFAULT '';
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS tax_form text DEFAULT '';
