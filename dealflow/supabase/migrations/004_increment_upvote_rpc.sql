-- Atomic upvote increment function for deal_qa
-- Prevents race conditions when multiple users upvote simultaneously
-- Run in Supabase SQL Editor

CREATE OR REPLACE FUNCTION increment_upvote(row_id uuid)
RETURNS integer
LANGUAGE sql
AS $$
  UPDATE deal_qa
  SET upvotes = COALESCE(upvotes, 0) + 1,
      updated_at = now()
  WHERE id = row_id
  RETURNING upvotes;
$$;
