/**
 * review-events-helper.test.mjs
 *
 * Unit tests for logReviewEvent and logReviewEvents from api/_review-events.js
 *
 * Key contract: audit failures must not throw — they log and return gracefully.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { logReviewEvent, logReviewEvents } from '../api/_review-events.js';

// ── Supabase mock factory ─────────────────────────────────────────────────────

function makeSupabase({ insertError = null } = {}) {
	const calls = [];
	return {
		calls,
		from(table) {
			return {
				insert(rows) {
					calls.push({ table, rows });
					return Promise.resolve({ error: insertError, data: null });
				}
			};
		}
	};
}

// ── logReviewEvent ────────────────────────────────────────────────────────────

test('logReviewEvent: inserts the correct row shape', async () => {
	const sb = makeSupabase();
	await logReviewEvent(sb, {
		opportunityId: 'deal-1',
		fieldKey: 'targetIRR',
		eventType: 'admin_save',
		actorType: 'admin',
		actorEmail: 'admin@example.com',
		actorName: 'Admin User',
		previousValue: 0.12,
		nextValue: 0.15,
		metadata: { source: 'test' }
	});

	assert.equal(sb.calls.length, 1);
	const row = sb.calls[0].rows;
	assert.equal(row.opportunity_id, 'deal-1');
	assert.equal(row.field_key, 'targetIRR');
	assert.equal(row.event_type, 'admin_save');
	assert.equal(row.actor_email, 'admin@example.com');
	assert.equal(row.previous_value, 0.12);
	assert.equal(row.next_value, 0.15);
	assert.deepEqual(row.metadata, { source: 'test' });
});

test('logReviewEvent: does not throw when insert fails', async () => {
	const sb = makeSupabase({ insertError: { message: 'DB connection refused' } });

	// Must not throw
	await assert.doesNotReject(
		logReviewEvent(sb, {
			opportunityId: 'deal-1',
			fieldKey: 'targetIRR',
			eventType: 'admin_save',
			actorType: 'admin',
			actorEmail: 'admin@example.com',
			actorName: 'Admin',
			previousValue: null,
			nextValue: 0.15,
			metadata: null
		}),
		'logReviewEvent should not throw on DB error'
	);
});

test('logReviewEvent: uses empty string for fieldKey when null passed', async () => {
	const sb = makeSupabase();
	await logReviewEvent(sb, {
		opportunityId: 'deal-1',
		fieldKey: null,
		eventType: 'reconciliation_dismissed',
		actorType: 'admin',
		actorEmail: 'admin@example.com',
		actorName: '',
		previousValue: null,
		nextValue: null,
		metadata: null
	});
	assert.equal(sb.calls[0].rows.field_key, '', 'null fieldKey should be coerced to empty string (NOT NULL constraint)');
});

// ── logReviewEvents ───────────────────────────────────────────────────────────

test('logReviewEvents: batch-inserts all provided rows', async () => {
	const sb = makeSupabase();
	const rows = [
		{ opportunity_id: 'deal-1', field_key: 'targetIRR', event_type: 'admin_save', actor_type: 'admin', actor_email: 'a@b.com', actor_name: '', previous_value: null, next_value: 0.15, metadata: null },
		{ opportunity_id: 'deal-1', field_key: 'holdPeriod', event_type: 'admin_save', actor_type: 'admin', actor_email: 'a@b.com', actor_name: '', previous_value: null, next_value: 5, metadata: null }
	];

	const err = await logReviewEvents(sb, rows);

	assert.equal(err, null, 'should return null on success');
	assert.equal(sb.calls.length, 1);
	assert.deepEqual(sb.calls[0].rows, rows);
});

test('logReviewEvents: does not throw when insert fails, returns the error', async () => {
	const dbError = { message: 'constraint violation' };
	const sb = makeSupabase({ insertError: dbError });

	let returnedError;
	await assert.doesNotReject(async () => {
		returnedError = await logReviewEvents(sb, [
			{ opportunity_id: 'deal-1', field_key: 'targetIRR', event_type: 'admin_save' }
		]);
	}, 'logReviewEvents should not throw');

	assert.equal(returnedError, dbError, 'should return the error so callers can propagate if needed');
});

test('logReviewEvents: returns null and skips insert for empty array', async () => {
	const sb = makeSupabase();
	const err = await logReviewEvents(sb, []);
	assert.equal(err, null);
	assert.equal(sb.calls.length, 0, 'no insert call should be made for empty array');
});

test('logReviewEvents: returns null and skips insert when called with no args', async () => {
	const sb = makeSupabase();
	const err = await logReviewEvents(sb);
	assert.equal(err, null);
	assert.equal(sb.calls.length, 0);
});

test('logReviewEvents: caller can re-throw the returned error (script use case)', async () => {
	const dbError = { message: 'insert failed' };
	const sb = makeSupabase({ insertError: dbError });

	await assert.rejects(async () => {
		const err = await logReviewEvents(sb, [{ opportunity_id: 'deal-1', field_key: 'f', event_type: 'e' }]);
		if (err) throw err;
	}, { message: 'insert failed' }, 'caller can re-throw the returned error');
});
