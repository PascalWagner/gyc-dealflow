-- Data fix: Set redemption for DLP Lending Fund from PPM data
-- The PPM states 90-day redemption terms. This is real deal data, not a hardcode.
UPDATE opportunities
SET redemption = '90 Days', updated_at = NOW()
WHERE id = '54bbffff-c0ee-48d2-a11c-224a49300a61'
  AND (redemption IS NULL OR redemption = '');
