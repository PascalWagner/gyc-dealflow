-- Migration 019: Add investment criteria and portfolio snapshot to operators
-- These fields store structured data extracted from deck/PPM documents

alter table management_companies
  add column if not exists investment_criteria jsonb default '[]'::jsonb,
  add column if not exists portfolio_snapshot jsonb default '[]'::jsonb;

-- investment_criteria stores an array of criteria items:
-- [
--   { "icon": "building", "text": "2,500-15,000 sq ft A, B, or C buildings" },
--   { "icon": "percent", "text": "+7.5 cap rate, +8.0% cash on cash projection" },
--   ...
-- ]
--
-- portfolio_snapshot stores an array of portfolio properties:
-- [
--   { "name": "Building 1", "location": "Windsor, CO", "affiliate": "Colorado Dental Prop., LLC", "sqft": 3448, "leaseTerm": 10, "purchasePrice": 900000, "noi": 79300, "capRate": 8.8, "noiCurrent": 92728, "estimatedValue": 1363650, "projectedIRR": 30.1 },
--   ...
-- ]

comment on column management_companies.investment_criteria is 'Structured buy box criteria extracted from deck/PPM — array of {icon, text} objects';
comment on column management_companies.portfolio_snapshot is 'Existing portfolio properties extracted from deck/PPM — array of property objects';
