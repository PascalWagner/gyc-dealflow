-- Fix: Foundations Portfolio: Multifamily was incorrectly tagged as Lending
UPDATE opportunities
SET asset_class = 'Multi Family'
WHERE name ILIKE '%Foundations Portfolio%Multifamily%'
  AND asset_class = 'Lending';
