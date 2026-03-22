-- Strategy cleanup: standardize to 5 valid strategies
-- Valid: Lending, Buy & Hold, Value-Add, Distressed, Development

-- Remove invalid strategy values
UPDATE opportunities SET strategy = '' WHERE strategy IN ('Core-Plus', 'Opportunistic');

-- Clear incorrect strategy on Foundations Portfolio: Multifamily
UPDATE opportunities SET strategy = ''
WHERE id = 'f4ee1f37-c78f-47bf-8eb1-42238f765b34' AND strategy = 'Lending';

-- NOTE: 405 deals with blank strategies were classified via scripts/classify-strategies.py
-- using keyword heuristics on investment_name, investment_strategy, asset_class, and instrument.
-- Run that script separately if re-seeding the database.
