import test from 'node:test';
import assert from 'node:assert/strict';

import {
	resolveSummaryReadinessLabel,
	resolveSummaryReadinessTone
} from '../src/lib/utils/reviewSummaryState.js';

test('approved lifecycle keeps the summary badge in an approved state', () => {
	assert.equal(
		resolveSummaryReadinessLabel({
			currentLifecycleStatus: 'approved',
			summaryPublishReady: false,
			summaryEvidencePending: false
		}),
		'Approved'
	);
	assert.equal(
		resolveSummaryReadinessTone({
			currentLifecycleStatus: 'approved',
			summaryPublishReady: false,
			summaryEvidencePending: false
		}),
		'ready'
	);
});

test('published lifecycle keeps the summary badge in a published state', () => {
	assert.equal(
		resolveSummaryReadinessLabel({
			currentLifecycleStatus: 'published',
			summaryPublishReady: false,
			summaryEvidencePending: false
		}),
		'Published'
	);
	assert.equal(
		resolveSummaryReadinessTone({
			currentLifecycleStatus: 'published',
			summaryPublishReady: false,
			summaryEvidencePending: false
		}),
		'ready'
	);
});

test('citation loading still takes precedence over lifecycle label', () => {
	assert.equal(
		resolveSummaryReadinessLabel({
			currentLifecycleStatus: 'approved',
			summaryPublishReady: false,
			summaryEvidencePending: true
		}),
		'Checking citations...'
	);
	assert.equal(
		resolveSummaryReadinessTone({
			currentLifecycleStatus: 'approved',
			summaryPublishReady: false,
			summaryEvidencePending: true
		}),
		'pending'
	);
});
