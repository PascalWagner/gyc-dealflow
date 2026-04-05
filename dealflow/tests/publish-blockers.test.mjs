/**
 * publish-blockers.test.mjs
 *
 * Unit tests for the publishBlockers logic (WS14).
 *
 * Tests the derived publishBlockers array and canPublish condition from
 * deal-review/+page.svelte, extracted as a pure function for testability.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── Pure logic mirror ─────────────────────────────────────────────────────────
// Mirrors the publishBlockers $derived.by() and canPublish $derived() exactly.

function computePublishBlockers({
	publishReadinessCounts = { missing: 0, missingCitations: 0, total: 0, complete: 0 },
	publishReadinessGroups = [],
	reconciliationTaskId = null,
	secCanAdvance = true
} = {}) {
	const blockers = [];

	// Missing required fields
	const missingCount = publishReadinessCounts.missing;
	if (missingCount > 0) {
		const firstStage = publishReadinessGroups.find((g) => g.fields.some((f) => f.isMissing))?.stageId || '';
		blockers.push({
			reason: `${missingCount} required field${missingCount === 1 ? '' : 's'} must be filled`,
			stage: firstStage,
			severity: 'error'
		});
	}

	// Missing required citations
	const citCount = publishReadinessCounts.missingCitations;
	if (citCount > 0) {
		const firstStage = publishReadinessGroups.find(
			(g) => g.fields.some((f) => f.requiresCitation && !f.hasCitation && !f.isMissing)
		)?.stageId || '';
		blockers.push({
			reason: `${citCount} field${citCount === 1 ? '' : 's'} missing required citation`,
			stage: firstStage,
			severity: 'error'
		});
	}

	// Pending reconciliation task
	if (reconciliationTaskId) {
		blockers.push({
			reason: 'Unreviewed extraction differences must be resolved',
			stage: '',
			severity: 'error'
		});
	}

	// SEC verification incomplete
	if (!secCanAdvance) {
		blockers.push({
			reason: 'SEC verification is incomplete',
			stage: 'sec',
			severity: 'error'
		});
	}

	return blockers;
}

function computeCanPublish({ summaryPublishReady = true, publishBlockers = [] } = {}) {
	return summaryPublishReady && publishBlockers.filter((b) => b.severity === 'error').length === 0;
}

// ── SEC blocker tests ─────────────────────────────────────────────────────────

test('publishBlockers includes SEC entry when secCanAdvance is false', () => {
	const blockers = computePublishBlockers({ secCanAdvance: false });
	const secBlocker = blockers.find((b) => b.stage === 'sec');
	assert.ok(secBlocker, 'SEC blocker should be present');
	assert.equal(secBlocker.reason, 'SEC verification is incomplete');
	assert.equal(secBlocker.severity, 'error');
});

test('publishBlockers does NOT include SEC entry when secCanAdvance is true', () => {
	const blockers = computePublishBlockers({ secCanAdvance: true });
	const secBlocker = blockers.find((b) => b.stage === 'sec');
	assert.equal(secBlocker, undefined, 'SEC blocker should not be present');
});

test('SEC blocker has stage key "sec" for [Fix →] navigation', () => {
	const blockers = computePublishBlockers({ secCanAdvance: false });
	const secBlocker = blockers.find((b) => b.reason.includes('SEC'));
	assert.equal(secBlocker?.stage, 'sec');
});

// ── canPublish tests ──────────────────────────────────────────────────────────

test('canPublish is false when an error-severity blocker exists', () => {
	const blockers = computePublishBlockers({ secCanAdvance: false });
	const result = computeCanPublish({ summaryPublishReady: true, publishBlockers: blockers });
	assert.equal(result, false, 'publish should be blocked when SEC is incomplete');
});

test('canPublish is true when no error blockers and summaryPublishReady is true', () => {
	const blockers = computePublishBlockers({ secCanAdvance: true });
	const result = computeCanPublish({ summaryPublishReady: true, publishBlockers: blockers });
	assert.equal(result, true, 'publish should be allowed when all blockers clear');
});

test('canPublish is false when summaryPublishReady is false (fields not complete)', () => {
	const blockers = computePublishBlockers({ secCanAdvance: true });
	const result = computeCanPublish({ summaryPublishReady: false, publishBlockers: blockers });
	assert.equal(result, false);
});

test('canPublish is false when both summaryPublishReady is false AND error blockers exist', () => {
	const blockers = computePublishBlockers({ secCanAdvance: false });
	const result = computeCanPublish({ summaryPublishReady: false, publishBlockers: blockers });
	assert.equal(result, false);
});

// ── Missing fields / citations ────────────────────────────────────────────────

test('publishBlockers includes missing fields entry with stage link', () => {
	const groups = [
		{ stageId: 'sponsor', fields: [{ isMissing: true, requiresCitation: false, hasCitation: false }] }
	];
	const blockers = computePublishBlockers({
		publishReadinessCounts: { missing: 2, missingCitations: 0, total: 5, complete: 3 },
		publishReadinessGroups: groups
	});
	const fieldBlocker = blockers.find((b) => b.reason.includes('must be filled'));
	assert.ok(fieldBlocker, 'missing fields blocker should exist');
	assert.equal(fieldBlocker.stage, 'sponsor', 'stage should link to first stage with missing fields');
	assert.equal(fieldBlocker.severity, 'error');
});

test('publishBlockers includes citation entry when citations missing', () => {
	const groups = [
		{
			stageId: 'returns',
			fields: [{ isMissing: false, requiresCitation: true, hasCitation: false }]
		}
	];
	const blockers = computePublishBlockers({
		publishReadinessCounts: { missing: 0, missingCitations: 1, total: 3, complete: 3 },
		publishReadinessGroups: groups
	});
	const citBlocker = blockers.find((b) => b.reason.includes('citation'));
	assert.ok(citBlocker, 'citation blocker should exist');
	assert.equal(citBlocker.stage, 'returns');
	assert.equal(citBlocker.severity, 'error');
});

// ── Reconciliation blocker ────────────────────────────────────────────────────

test('publishBlockers includes reconciliation entry when task is pending', () => {
	const blockers = computePublishBlockers({ reconciliationTaskId: 'abc-123' });
	const recon = blockers.find((b) => b.reason.includes('extraction differences'));
	assert.ok(recon, 'reconciliation blocker should exist');
	assert.equal(recon.severity, 'error');
});

test('publishBlockers does NOT include reconciliation entry when no task', () => {
	const blockers = computePublishBlockers({ reconciliationTaskId: null });
	const recon = blockers.find((b) => b.reason.includes('extraction differences'));
	assert.equal(recon, undefined);
});

// ── Empty state ───────────────────────────────────────────────────────────────

test('publishBlockers is empty when all conditions are clear', () => {
	const blockers = computePublishBlockers({
		publishReadinessCounts: { missing: 0, missingCitations: 0, total: 5, complete: 5 },
		publishReadinessGroups: [],
		reconciliationTaskId: null,
		secCanAdvance: true
	});
	assert.equal(blockers.length, 0);
});

// ── Multiple blockers ─────────────────────────────────────────────────────────

test('publishBlockers can contain multiple error entries simultaneously', () => {
	const blockers = computePublishBlockers({
		publishReadinessCounts: { missing: 3, missingCitations: 1, total: 5, complete: 2 },
		publishReadinessGroups: [
			{ stageId: 'intake', fields: [{ isMissing: true, requiresCitation: true, hasCitation: false }] }
		],
		reconciliationTaskId: 'task-id',
		secCanAdvance: false
	});
	const errors = blockers.filter((b) => b.severity === 'error');
	assert.equal(errors.length, 4, 'all four blocker types should be present');
});
