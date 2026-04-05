// Shared Reconciliation Utilities
//
// Provides conflict detection between a new extraction run and existing
// reviewed data on a deal.  Split into:
//
//   normalizeValueForComparison(value)
//     Pure normalization — converts any extracted/stored value to a
//     canonical form for equality comparison.  Ensures that "0.10" and
//     0.1 are not flagged as different, and that null / "" / undefined
//     are treated as absent.
//
//   computeConflictsFromState(reviewFieldState, fieldsExtracted, extractionRunId)
//     Pure computation — no I/O.  Accepts the raw review_field_state map
//     and the fields_extracted snapshot from an extraction_runs row, and
//     returns { conflicts, autoResolved, protected }.
//
//   computeExtractionConflicts(dealId, extractionRunId, supabase)
//     Async wrapper that loads the deal + run from the DB and delegates to
//     computeConflictsFromState.
//
// See deal-review-audit.md §3.5 (Re-Upload / Re-Extraction Model)

import { normalizeReviewFieldStateMap } from '../src/lib/utils/reviewFieldState.js';

// ── Value normalization ───────────────────────────────────────────────────────

/**
 * Normalize a stored or extracted value to a canonical form suitable for
 * equality comparison between two values that should represent the same thing.
 *
 * Rules (matching buildDealReviewPayload semantics):
 *  - null / undefined / "" → null  (all mean "absent")
 *  - number → number (NaN/Infinity → null)
 *  - numeric string (e.g. "0.10", "1,500") → Number  (strips commas first)
 *  - string → trimmed lowercase
 *  - array → sorted, joined with NULL byte
 *  - object → JSON.stringify (order-sensitive, but objects are rare in field values)
 */
export function normalizeValueForComparison(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'boolean') return value;

  if (Array.isArray(value)) {
    const items = value
      .map((v) => String(v ?? '').trim())
      .filter(Boolean)
      .sort();
    return items.length === 0 ? null : items.join('\x00');
  }

  if (value !== null && typeof value === 'object') {
    return JSON.stringify(value);
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  // String: try numeric coercion before falling back to lowercase string
  const trimmed = String(value).trim();
  if (trimmed === '') return null;
  if (/^-?[\d,]+(?:\.\d+)?$/.test(trimmed)) {
    const asNum = Number(trimmed.replace(/,/g, ''));
    if (Number.isFinite(asNum)) return asNum;
  }
  return trimmed.toLowerCase();
}

// ── Pure conflict computation ─────────────────────────────────────────────────

/**
 * Categorize each field in fieldsExtracted into one of three buckets:
 *
 *   conflicts     — field has an existing aiValue that differs from the new
 *                   extraction (normalized).  Requires reviewer decision.
 *   autoResolved  — field has no existing value (aiValuePresent=false and no
 *                   adminOverride).  Safe to apply immediately without review.
 *   protected     — field has adminOverrideActive=true.  Never touched by any
 *                   extraction, regardless of value.
 *
 * Fields where the normalized values are identical are silently skipped
 * (no entry in any bucket).
 *
 * @param {object} reviewFieldState   Raw review_field_state map from the DB
 * @param {object} fieldsExtracted    fields_extracted snapshot from extraction_runs
 * @param {string} extractionRunId    UUID of the source extraction run
 * @returns {{ conflicts: object[], autoResolved: object[], protected: object[] }}
 */
export function computeConflictsFromState(reviewFieldState, fieldsExtracted, extractionRunId) {
  const normalized = normalizeReviewFieldStateMap(reviewFieldState || {});
  const extracted = fieldsExtracted && typeof fieldsExtracted === 'object' ? fieldsExtracted : {};

  const conflicts = [];
  const autoResolved = [];
  const protectedFields = [];

  for (const [fieldKey, extractedValue] of Object.entries(extracted)) {
    const entry = normalized[fieldKey];

    // Protected: admin override is active — never flag, never overwrite
    if (entry?.adminOverrideActive === true) {
      protectedFields.push({
        fieldKey,
        extractedValue,
        adminOverrideValue: entry.adminOverrideValue ?? null
      });
      continue;
    }

    // No existing AI value: safe to apply without review
    if (!entry || !entry.aiValuePresent) {
      autoResolved.push({
        fieldKey,
        extractedValue,
        extractionRunId: extractionRunId || '',
        autoResolved: true
      });
      continue;
    }

    // Existing AI value: compare after normalization
    const existingNorm = normalizeValueForComparison(entry.aiValue);
    const extractedNorm = normalizeValueForComparison(extractedValue);

    if (existingNorm === extractedNorm) {
      // Same value (possibly different format) — no conflict
      continue;
    }

    conflicts.push({
      fieldKey,
      currentValue: entry.aiValue,
      currentSource: String(entry.aiSource || 'ai_extraction'),
      extractedValue,
      extractionRunId: extractionRunId || '',
      autoResolved: false
    });
  }

  return { conflicts, autoResolved, protected: protectedFields };
}

// ── Async wrapper ────────────────────────────────────────────────────────────

/**
 * Load deal + extraction run from the DB and compute conflicts.
 *
 * @param {string} dealId            UUID of the deal
 * @param {string} extractionRunId   UUID of the extraction_runs row
 * @param {object} supabase          Supabase admin client
 * @returns {Promise<{ conflicts, autoResolved, protected }>}
 */
export async function computeExtractionConflicts(dealId, extractionRunId, supabase) {
  const [dealResult, runResult] = await Promise.all([
    supabase
      .from('opportunities')
      .select('review_field_state')
      .eq('id', dealId)
      .single(),
    supabase
      .from('extraction_runs')
      .select('fields_extracted')
      .eq('id', extractionRunId)
      .single()
  ]);

  if (dealResult.error || !dealResult.data) {
    throw new Error(
      `computeExtractionConflicts: deal not found (${dealId}): ${dealResult.error?.message || 'no data'}`
    );
  }
  if (runResult.error || !runResult.data) {
    throw new Error(
      `computeExtractionConflicts: extraction run not found (${extractionRunId}): ${runResult.error?.message || 'no data'}`
    );
  }

  return computeConflictsFromState(
    dealResult.data.review_field_state,
    runResult.data.fields_extracted,
    extractionRunId
  );
}
