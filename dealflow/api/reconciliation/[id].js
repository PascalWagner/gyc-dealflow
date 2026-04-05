// Vercel Serverless Function: Reconciliation Task Resolution
//
//   GET  /api/reconciliation/:id  — load a reconciliation task with its conflict fields
//   POST /api/reconciliation/:id  — resolve: apply per-field decisions to review_field_state
//   PATCH /api/reconciliation/:id — dismiss: mark task as dismissed without resolving
//
// Auth: admin-only (Bearer token verified against ADMIN_EMAILS).

import { getAdminClient, setCors, verifyAdmin } from '../_supabase.js';
import { captureApiError } from '../_sentry.js';
import {
  buildAdminReviewFieldStateEntry,
  buildAiReviewFieldStateEntry,
  getReviewFieldDbColumn,
  normalizeReviewFieldStateMap
} from '../../src/lib/utils/reviewFieldState.js';

// ── Pure resolution logic (exported for unit testing) ───────────────────────

/**
 * Apply reviewer decisions to review_field_state.  Pure function — no I/O.
 *
 * @param {object} reviewFieldState   Current review_field_state map from the DB
 * @param {Array}  conflictFields     conflict_fields array from the reconciliation_task row
 * @param {Array}  decisions          Array of { fieldKey, action, manualValue? }
 *   action: 'keep_current' | 'use_extracted' | 'edit_manual'
 * @param {{ actor?: object, at?: string }} options
 * @returns {{ nextReviewFieldState, eventRows, appliedFields }}
 */
export function applyReconciliationDecisions(
  reviewFieldState,
  conflictFields,
  decisions,
  { actor = {}, at = new Date().toISOString() } = {}
) {
  const normalized = normalizeReviewFieldStateMap(reviewFieldState || {});
  const nextReviewFieldState = { ...normalized };
  const eventRows = [];
  const appliedFields = [];

  const conflictMap = Object.fromEntries(
    (conflictFields || []).map((f) => [f.fieldKey, f])
  );

  for (const decision of decisions || []) {
    const { fieldKey, action, manualValue } = decision;
    if (!fieldKey || !action) continue;

    if (action === 'keep_current') {
      // No change — reviewer chose to keep the existing value
      continue;
    }

    const existingEntry = normalized[fieldKey] || {};
    const conflictField = conflictMap[fieldKey];

    if (action === 'use_extracted' && conflictField) {
      // Write the newly extracted value as the authoritative aiValue.
      // overwriteAdmin=true clears any existing admin override so the
      // extracted value is the resolved final value.
      nextReviewFieldState[fieldKey] = buildAiReviewFieldStateEntry(existingEntry, {
        nextValue: conflictField.extractedValue,
        overwriteAdmin: true,
        source: 'ai_extraction',
        at,
        extractionRunId: conflictField.extractionRunId || ''
      });
      appliedFields.push(fieldKey);
    }

    if (action === 'edit_manual') {
      // Write a manual (admin override) value.
      nextReviewFieldState[fieldKey] = buildAdminReviewFieldStateEntry(existingEntry, {
        nextValue: manualValue,
        fallbackValue: existingEntry.aiValue,
        actor,
        at
      });
      appliedFields.push(fieldKey);
      // Log to review_field_events (opportunity_id added by caller)
      eventRows.push({
        field_key: fieldKey,
        event_type: 'admin_save',
        actor_type: 'admin',
        actor_email: String(actor?.email || ''),
        actor_name: String(actor?.name || ''),
        previous_value: existingEntry.aiValue ?? null,
        next_value: manualValue,
        metadata: { source: 'reconciliation' }
      });
    }
  }

  return { nextReviewFieldState, eventRows, appliedFields };
}

// ── Helper ───────────────────────────────────────────────────────────────────

function isUuid(value) {
  return /^[0-9a-f-]{36}$/i.test(String(value || '').trim());
}

async function loadTask(supabase, id) {
  const { data, error } = await supabase
    .from('reconciliation_tasks')
    .select('id, deal_id, status, conflict_fields, created_at, resolved_by, resolved_at')
    .eq('id', id)
    .single();
  return { task: data || null, error };
}

// ── Handler ──────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!isUuid(id)) {
    return res.status(400).json({ error: 'Invalid reconciliation task ID' });
  }
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { authorized, user } = await verifyAdmin(req);
  if (!authorized) {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const supabase = getAdminClient();

  // ── GET: load the task ──────────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { task, error } = await loadTask(supabase, id);
    if (error) {
      console.error('[reconciliation/get] load failed', { id, message: error.message });
      return res.status(500).json({ error: 'Failed to load reconciliation task' });
    }
    if (!task) {
      return res.status(404).json({ error: 'Reconciliation task not found' });
    }
    return res.status(200).json({ task });
  }

  // ── PATCH: dismiss ──────────────────────────────────────────────────────────
  if (req.method === 'PATCH') {
    const { action } = req.body || {};
    if (action !== 'dismiss') {
      return res.status(400).json({ error: 'Invalid action. Valid: dismiss' });
    }

    const { task, error: loadError } = await loadTask(supabase, id);
    if (loadError || !task) {
      return res.status(404).json({ error: 'Reconciliation task not found' });
    }
    if (task.status !== 'pending' && task.status !== 'in_progress') {
      return res.status(409).json({
        error: `Cannot dismiss a task with status '${task.status}'`,
        status: task.status
      });
    }

    const actorEmail = String(user?.email || '').toLowerCase();
    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('reconciliation_tasks')
      .update({ status: 'dismissed', resolved_by: actorEmail, resolved_at: now })
      .eq('id', id);

    if (updateError) {
      console.error('[reconciliation/dismiss] update failed', { id, message: updateError.message });
      return res.status(500).json({ error: 'Failed to dismiss reconciliation task' });
    }
    return res.status(200).json({ success: true, status: 'dismissed' });
  }

  // ── POST: resolve ───────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const { decisions } = req.body || {};
    if (!Array.isArray(decisions) || decisions.length === 0) {
      return res.status(400).json({ error: 'decisions array is required' });
    }

    const VALID_ACTIONS = new Set(['keep_current', 'use_extracted', 'edit_manual']);
    for (const d of decisions) {
      if (!d.fieldKey || !VALID_ACTIONS.has(d.action)) {
        return res.status(400).json({
          error: `Invalid decision: fieldKey and action ('keep_current' | 'use_extracted' | 'edit_manual') required`,
          received: d
        });
      }
    }

    // Load task
    const { task, error: loadError } = await loadTask(supabase, id);
    if (loadError || !task) {
      return res.status(404).json({ error: 'Reconciliation task not found' });
    }
    if (task.status === 'resolved') {
      return res.status(409).json({
        error: 'already_resolved',
        message: `This reconciliation was already resolved by ${task.resolved_by || 'another admin'} at ${task.resolved_at || ''}`,
        resolvedBy: task.resolved_by || '',
        resolvedAt: task.resolved_at || '',
        status: task.status
      });
    }
    if (task.status === 'dismissed') {
      return res.status(409).json({ error: 'Task was dismissed', status: task.status });
    }

    const dealId = task.deal_id;
    const conflictFields = Array.isArray(task.conflict_fields) ? task.conflict_fields : [];

    // Load current deal
    const { data: dealRow, error: dealError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', dealId)
      .single();

    if (dealError || !dealRow) {
      return res.status(404).json({ error: 'Deal not found for this reconciliation task' });
    }

    const availableColumns = new Set(Object.keys(dealRow));
    const actorEmail = String(user?.email || '').trim().toLowerCase();
    const actorName = String(
      user?.user_metadata?.full_name || user?.user_metadata?.name || ''
    ).trim();
    const actor = { email: actorEmail, name: actorName };
    const now = new Date().toISOString();

    // Apply decisions (pure)
    const { nextReviewFieldState, eventRows, appliedFields } = applyReconciliationDecisions(
      dealRow.review_field_state,
      conflictFields,
      decisions,
      { actor, at: now }
    );

    // Build materialized column updates for changed fields
    const materializedUpdates = { review_field_state: nextReviewFieldState, updated_at: now };
    for (const fieldKey of appliedFields) {
      const columnName = getReviewFieldDbColumn(fieldKey);
      if (!columnName || !availableColumns.has(columnName)) continue;
      const resolvedEntry = nextReviewFieldState[fieldKey];
      // Resolve the final value from the updated entry
      const finalValue = resolvedEntry?.adminOverrideActive
        ? resolvedEntry.adminOverrideValue
        : resolvedEntry?.aiValuePresent
          ? resolvedEntry.aiValue
          : dealRow[columnName];
      materializedUpdates[columnName] = finalValue;
    }

    if (availableColumns.has('review_state_version')) {
      materializedUpdates.review_state_version = Number(dealRow.review_state_version || 0) + 1;
    }

    // Write deal update
    const { error: dealUpdateError } = await supabase
      .from('opportunities')
      .update(materializedUpdates)
      .eq('id', dealId);

    if (dealUpdateError) {
      console.error('[reconciliation/resolve] deal update failed', {
        id,
        dealId,
        message: dealUpdateError.message
      });
      captureApiError(new Error(dealUpdateError.message), {
        endpoint: `POST /api/reconciliation/${id}`,
        dealId,
        taskId: id
      });
      return res.status(500).json({ error: 'Failed to apply decisions to deal' });
    }

    // Insert review_field_events for edit_manual decisions
    if (eventRows.length > 0) {
      const fullEventRows = eventRows.map((row) => ({
        ...row,
        opportunity_id: dealId
      }));
      const { error: eventsError } = await supabase
        .from('review_field_events')
        .insert(fullEventRows);
      if (eventsError) {
        // Non-fatal — audit log failure should not fail resolution
        console.warn('[reconciliation/resolve] review_field_events insert failed (non-fatal)', {
          message: eventsError.message,
          count: fullEventRows.length
        });
      }
    }

    // Mark task resolved
    const { error: resolveError } = await supabase
      .from('reconciliation_tasks')
      .update({
        status: 'resolved',
        resolved_by: actorEmail,
        resolved_at: now
      })
      .eq('id', id);

    if (resolveError) {
      // Non-fatal — the deal was already updated; just log
      console.warn('[reconciliation/resolve] task status update failed (non-fatal)', {
        id,
        message: resolveError.message
      });
    }

    console.info('[reconciliation/resolve] task resolved', {
      id,
      dealId,
      appliedFields,
      editManualCount: eventRows.length,
      resolvedBy: actorEmail
    });

    return res.status(200).json({
      success: true,
      status: 'resolved',
      applied_fields: appliedFields,
      conflict_count: conflictFields.length
    });
  }
}
