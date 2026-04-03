import { normalizeLifecycleStatus } from './dealWorkflow.js';

const FULL_REVIEW_ACCESS_LIFECYCLES = new Set(['approved', 'published', 'do_not_publish']);

export function preservesFullReviewAccessForLifecycle(lifecycleStatus = '') {
	return FULL_REVIEW_ACCESS_LIFECYCLES.has(normalizeLifecycleStatus(lifecycleStatus, 'draft'));
}

export function canPreviewDealReviewSummary({
	allowSummaryPreview = false,
	lifecycleStatus = '',
	hasSourceDocuments = false,
	secCanAdvance = false,
	teamContactsValid = false
} = {}) {
	if (preservesFullReviewAccessForLifecycle(lifecycleStatus)) {
		return true;
	}

	if (!allowSummaryPreview) {
		return false;
	}

	return hasSourceDocuments || secCanAdvance || teamContactsValid;
}

export function resolveSummaryLifecycleSyncTarget({
	currentLifecycleStatus = '',
	summaryPublishReady = false,
	summaryEvidencePending = false
} = {}) {
	const currentLifecycle = normalizeLifecycleStatus(currentLifecycleStatus, 'draft');
	if (summaryEvidencePending) return null;
	if (currentLifecycle === 'published' || currentLifecycle === 'do_not_publish') return null;
	if (currentLifecycle === 'approved' && !summaryPublishReady) return null;

	const desiredLifecycle = summaryPublishReady ? 'approved' : 'in_review';
	return desiredLifecycle === currentLifecycle ? null : desiredLifecycle;
}

export function resolveSummaryReadinessTone({
	summaryPublishReady = false,
	summaryEvidencePending = false
} = {}) {
	if (summaryEvidencePending) return 'pending';
	return summaryPublishReady ? 'ready' : 'blocked';
}

export function resolveSummaryReadinessLabel({
	summaryPublishReady = false,
	summaryEvidencePending = false
} = {}) {
	if (summaryEvidencePending) return 'Checking citations...';
	return summaryPublishReady ? 'Ready to publish' : 'Still blocked';
}
