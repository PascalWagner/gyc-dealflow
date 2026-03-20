-- Add archived column for soft-delete functionality
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/nntzqyufmtypfjpusflm/sql
ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS archived boolean DEFAULT false;

-- Index for fast filtering of non-archived deals
CREATE INDEX IF NOT EXISTS idx_opportunities_archived ON opportunities (archived) WHERE archived = true;
