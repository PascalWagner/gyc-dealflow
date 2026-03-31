export const DEAL_SUBMISSION_INTENTS = ['interested', 'invested'];
export const DEAL_SUBMISSION_SURFACES = ['deal_flow', 'dashboard', 'portfolio', 'admin'];
export const DEAL_SUBMITTER_ROLES = ['admin', 'gp', 'lp', 'unknown'];
export const DEAL_SUBMISSION_KINDS = ['new_deal', 'existing_deal_link', 'document_upload'];

export const DEAL_SUBMISSION_INTENT_LABELS = {
	interested: 'Evaluating',
	invested: 'Already Invested'
};

export const DEAL_SUBMISSION_SURFACE_LABELS = {
	deal_flow: 'Deal Flow',
	dashboard: 'Dashboard',
	portfolio: 'Portfolio',
	admin: 'Admin'
};

export const DEAL_SUBMITTER_ROLE_LABELS = {
	admin: 'Admin',
	gp: 'GP',
	lp: 'LP',
	unknown: 'Unknown'
};

function normalizeToken(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

export function normalizeSubmissionIntent(value, fallback = 'interested') {
	const normalized = normalizeToken(value);
	if (normalized === 'already_invested') return 'invested';
	if (normalized === 'existing_investment') return 'invested';
	if (normalized === 'interested_in_deal') return 'interested';
	return DEAL_SUBMISSION_INTENTS.includes(normalized) ? normalized : fallback;
}

export function normalizeSubmissionSurface(value, fallback = 'deal_flow') {
	const normalized = normalizeToken(value);
	if (normalized === 'deals') return 'deal_flow';
	if (normalized === 'portfolio_page') return 'portfolio';
	return DEAL_SUBMISSION_SURFACES.includes(normalized) ? normalized : fallback;
}

export function normalizeSubmitterRole(value, fallback = 'unknown') {
	const normalized = normalizeToken(value);
	return DEAL_SUBMITTER_ROLES.includes(normalized) ? normalized : fallback;
}

export function normalizeSubmissionKind(value, fallback = 'document_upload') {
	const normalized = normalizeToken(value);
	if (normalized === 'new') return 'new_deal';
	if (normalized === 'existing') return 'existing_deal_link';
	return DEAL_SUBMISSION_KINDS.includes(normalized) ? normalized : fallback;
}

export function getDefaultSubmissionIntent(surface = 'deal_flow') {
	return normalizeSubmissionSurface(surface) === 'portfolio' ? 'invested' : 'interested';
}

export function getSubmissionStage(intent = 'interested') {
	return normalizeSubmissionIntent(intent) === 'invested' ? 'invested' : 'review';
}

export function getSubmissionIntentDescription(intent = 'interested') {
	const normalized = normalizeSubmissionIntent(intent);
	if (normalized === 'invested') {
		return 'This will add the deal to Invested and My Portfolio while the deal itself goes through your normal review process.';
	}
	return 'This will add the deal to Review so you can track it while the team runs the normal deal review process.';
}

export function getSubmissionSuccessCopy({
	intent = 'interested',
	entrySurface = 'deal_flow',
	createdNewDeal = true,
	dealName = 'This deal'
} = {}) {
	const normalizedIntent = normalizeSubmissionIntent(intent);
	const normalizedSurface = normalizeSubmissionSurface(entrySurface);
	const isInvested = normalizedIntent === 'invested';
	const subject = String(dealName || 'This deal').trim() || 'This deal';

	if (isInvested) {
		return {
			eyebrow: 'Added To Invested',
			title: createdNewDeal ? `${subject} was added to your invested deals.` : `${subject} is now in your invested deals.`,
			body: 'It is visible in Invested and My Portfolio right away with a pending review state while the deal goes through the normal review queue.',
			primaryAction: 'navigate',
			primaryHref: normalizedSurface === 'portfolio' ? '/app/portfolio' : '/app/deals?tab=invested',
			primaryLabel: normalizedSurface === 'portfolio' ? 'Go to Portfolio' : 'Go to Invested',
			secondaryAction: normalizedSurface === 'portfolio' ? 'reset' : 'navigate',
			secondaryHref: '/app/portfolio',
			secondaryLabel: normalizedSurface === 'portfolio' ? 'Add Another Deal' : 'View My Portfolio'
		};
	}

	return {
		eyebrow: 'Submitted For Review',
		title: createdNewDeal ? `${subject} was added to your Deal Flow.` : `${subject} was added to Review.`,
		body: 'It now appears in Review with a pending review state while the team runs the standard deal review process.',
		primaryAction: 'navigate',
		primaryHref: '/app/deals?tab=review',
		primaryLabel: 'Go to Review',
		secondaryAction: 'navigate',
		secondaryHref: normalizedSurface === 'dashboard' ? '/app/dashboard' : '/app/deals',
		secondaryLabel: normalizedSurface === 'dashboard' ? 'Back to Dashboard' : 'Back to Deal Flow'
	};
}

export function getPendingReviewBadgeLabel(lifecycleStatus = '') {
	const normalized = normalizeToken(lifecycleStatus);
	if (normalized === 'published') return '';
	if (normalized === 'approved') return 'Approved · Not Published';
	if (normalized === 'do_not_publish') return 'Not Approved';
	return 'Pending Review';
}
