// Shared audit event helper for review_field_events.
//
// All write paths that produce review field events should go through this module.
// Audit failures are logged but never thrown — they must not block the primary write.
//
// Two entry points:
//   logReviewEvent(supabase, row)    — single event with camelCase params
//   logReviewEvents(supabase, rows)  — batch insert of pre-built snake_case rows

/**
 * Insert a single review_field_events row.
 * Params are camelCase and mapped to snake_case DB columns.
 *
 * fieldKey: '' (empty string) for task-level events — NOT NULL constraint in DB.
 * Never throws. Logs error to console on failure.
 */
export async function logReviewEvent(supabase, {
  opportunityId,
  fieldKey = '',
  eventType,
  actorType,
  actorEmail,
  actorName,
  previousValue,
  nextValue,
  metadata
}) {
  const { error } = await supabase
    .from('review_field_events')
    .insert({
      opportunity_id: opportunityId,
      field_key: fieldKey ?? '',
      event_type: eventType,
      actor_type: actorType,
      actor_email: String(actorEmail || ''),
      actor_name: String(actorName || ''),
      previous_value: previousValue ?? null,
      next_value: nextValue ?? null,
      metadata: metadata ?? null
    });

  if (error) {
    console.error('[review-events] failed to log event', {
      eventType,
      opportunityId,
      fieldKey: fieldKey ?? '',
      message: error.message
    });
  }
}

/**
 * Batch-insert pre-built review_field_events rows (snake_case keys).
 * Used by call sites that already build event rows in the DB column format.
 *
 * Never throws. Logs a warning on failure and returns the error (or null)
 * so callers that need to propagate failures (e.g. scripts) can do so.
 *
 * @returns {object|null} The Supabase error, or null on success.
 */
export async function logReviewEvents(supabase, events = []) {
  if (!Array.isArray(events) || events.length === 0) return null;

  try {
    const { error } = await supabase
      .from('review_field_events')
      .insert(events);

    if (error) {
      console.warn('[review-events] batch insert failed', {
        count: events.length,
        message: error.message
      });
      return error;
    }
    return null;
  } catch (err) {
    console.warn('[review-events] batch insert threw', {
      count: events.length,
      message: err?.message || 'unknown_error'
    });
    return err;
  }
}
