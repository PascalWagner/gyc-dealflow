-- 072_reconciliation_tasks.sql
--
-- Adds the reconciliation_tasks table, which represents the work item
-- created when a new extraction run produces values that differ from
-- existing reviewed data on a deal.
--
-- Lifecycle:
--   'pending'     → conflict detected; awaiting reviewer decision
--   'in_progress' → reviewer has opened the reconciliation view
--   'resolved'    → reviewer accepted/rejected each conflicting field
--   'dismissed'   → reviewer dismissed without resolving (conflict ignored)
--
-- conflict_fields is a JSONB array of objects, each describing one
-- conflicting field:
--   {
--     fieldKey:        string,   -- reviewFieldState key (e.g. "targetIRR")
--     currentValue:    any,      -- value currently in review_field_state.aiValue
--     currentSource:   string,   -- aiSource from the existing review_field_state entry
--     extractedValue:  any,      -- value returned by the new extraction run
--     extractionRunId: uuid,     -- links back to the extraction_runs row
--     autoResolved:    boolean   -- always false for conflict entries
--   }
--
-- Auto-resolved fields (new extractions for fields with no existing value)
-- are applied immediately and never appear here.
--
-- See deal-review-audit.md §3.5 (Re-Upload / Re-Extraction Model)
--     and §6.1 Workstream 6 (Reconciliation flow)

CREATE TABLE IF NOT EXISTS reconciliation_tasks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id             uuid        NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  extraction_run_id   uuid        NOT NULL REFERENCES extraction_runs(id),
  status              text        NOT NULL DEFAULT 'pending',
    -- 'pending' | 'in_progress' | 'resolved' | 'dismissed'
  conflict_fields     jsonb       NOT NULL DEFAULT '[]',
    -- array of { fieldKey, currentValue, currentSource,
    --            extractedValue, extractionRunId, autoResolved }
  resolved_by         text,
    -- email of the admin who resolved / dismissed
  resolved_at         timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- Primary operational query: "show pending reconciliation tasks for this deal"
CREATE INDEX IF NOT EXISTS reconciliation_tasks_deal_id_status_idx
  ON reconciliation_tasks (deal_id, status);

-- Traceability: look up the reconciliation task for a given extraction run
CREATE INDEX IF NOT EXISTS reconciliation_tasks_extraction_run_id_idx
  ON reconciliation_tasks (extraction_run_id);
