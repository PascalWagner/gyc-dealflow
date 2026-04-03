import test from 'node:test';
import assert from 'node:assert/strict';

import {
	canPreviewDealReviewSummary,
	preservesFullReviewAccessForLifecycle,
	resolveSummaryLifecycleSyncTarget,
	resolveSummaryReadinessLabel,
	resolveSummaryReadinessTone
} from '../src/lib/utils/reviewSummaryState.js';

test('approved deals keep full review access', () => {
	assert.equal(preservesFullReviewAccessForLifecycle('approved'), true);
	assert.equal(preservesFullReviewAccessForLifecycle('published'), true);
	assert.equal(preservesFullReviewAccessForLifecycle('in_review'), false);
});

test('approved deals can open summary without explicit summary flag when gates are otherwise valid', () => {
	assert.equal(canPreviewDealReviewSummary({
		allowSummaryPreview: false,
		lifecycleStatus: 'approved',
		hasSourceDocuments: true,
		secCanAdvance: true,
		teamContactsValid: true
	}), true);

	assert.equal(canPreviewDealReviewSummary({
		allowSummaryPreview: false,
		lifecycleStatus: 'approved',
		hasSourceDocuments: true,
		secCanAdvance: false,
		teamContactsValid: true
	}), false);
});

test('summary lifecycle sync never silently downgrades approved deals during reload checks', () => {
	assert.equal(resolveSummaryLifecycleSyncTarget({
		currentLifecycleStatus: 'approved',
		summaryPublishReady: false,
		summaryEvidencePending: false
	}), null);

	assert.equal(resolveSummaryLifecycleSyncTarget({
		currentLifecycleStatus: 'approved',
		summaryPublishReady: false,
		summaryEvidencePending: true
	}), null);
});

test('summary lifecycle sync still promotes in-review deals when everything is publish ready', () => {
	assert.equal(resolveSummaryLifecycleSyncTarget({
		currentLifecycleStatus: 'in_review',
		summaryPublishReady: true,
		summaryEvidencePending: false
	}), 'approved');
});

test('summary readiness stays pending until citation loading resolves', () => {
	assert.equal(resolveSummaryReadinessTone({
		summaryPublishReady: true,
		summaryEvidencePending: true
	}), 'pending');

	assert.equal(resolveSummaryReadinessLabel({
		summaryPublishReady: true,
		summaryEvidencePending: true
	}), 'Checking citations...');
});
