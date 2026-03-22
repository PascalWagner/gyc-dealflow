-- Add investor relations contact fields to management_companies
-- Separate from CEO — this is the person LPs should talk to
ALTER TABLE management_companies
  ADD COLUMN IF NOT EXISTS ir_contact_name  text DEFAULT '',
  ADD COLUMN IF NOT EXISTS ir_contact_email text DEFAULT '';
