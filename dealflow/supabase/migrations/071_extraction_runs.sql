-- 071_extraction_runs.sql
--
-- Adds the extraction_runs table, which tracks each enrichment pipeline
-- execution against a deal. This enables:
--
--   • Provenance: link aiValue entries back to the run that produced them
--     via extractionRunId stored on each review_field_state entry.
--   • Deduplication: skip re-extraction when a complete or partial run
--     already exists for the same deck_submissions document.
--   • Resumability: partial failures are recorded so the UI can surface
--     which secondary steps failed without losing primary extracted fields.
--   • History: multiple runs per deal are preserved for reconciliation.
--
-- See deal-review-audit.md §3.2 (The missing layer: extraction runs)
--     and §6.1 Workstream 4 (Extraction cascade resilience).

CREATE TABLE IF NOT EXISTS extraction_runs (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id           uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  triggered_by      text        NOT NULL,
    -- 'upload' | 'manual' | 'system'
  document_ref      uuid        REFERENCES deck_submissions(id),
    -- the specific deck_submission that triggered this run; null when
    -- triggered manually without an explicit document reference
  started_at        timestamptz NOT NULL DEFAULT now(),
  completed_at      timestamptz,
  status            text        NOT NULL DEFAULT 'running',
    -- 'running'  → in progress
    -- 'complete' → all attempted steps succeeded
    -- 'partial'  → primary extraction succeeded, some secondary steps failed
    -- 'failed'   → primary extraction threw an exception
  fields_extracted  jsonb       DEFAULT '{}',
    -- snapshot of { fieldKey: extractedValue } captured at completion;
    -- allows diffing against a later run without re-running extraction
  extraction_source text,
    -- primary AI model that produced the fields:
    -- 'gemini' | 'anthropic' | 'openai' | 'claude-pdf' | 'claude-text' | 'grok'
  error_detail      text,
    -- human-readable summary when status = 'partial' or 'failed';
    -- for 'partial': lists which secondary steps failed and why
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- Fast lookup: "what runs exist for this deal, most recent first?"
CREATE INDEX IF NOT EXISTS extraction_runs_deal_id_created_at_idx
  ON extraction_runs (deal_id, created_at DESC);
