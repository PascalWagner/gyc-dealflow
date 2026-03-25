export const CANONICAL_DB_STAGES = [
	'filter',
	'review',
	'connect',
	'decide',
	'invested',
	'skipped'
];

export const PIPELINE_UI_STAGES = ['filter', 'review', 'connect', 'decide'];
export const OUTCOME_UI_STAGES = ['invested', 'skipped'];
export const ALL_UI_STAGES = [...PIPELINE_UI_STAGES, ...OUTCOME_UI_STAGES];

export const LEGACY_STAGE_MAP = {
	new: 'filter',
	browse: 'filter',
	filter: 'filter',
	interested: 'review',
	saved: 'review',
	vetting: 'review',
	review: 'review',
	duediligence: 'connect',
	dd: 'connect',
	diligence: 'connect',
	connect: 'connect',
	ready: 'decide',
	decision: 'decide',
	decide: 'decide',
	invested: 'invested',
	portfolio: 'invested',
	passed: 'skipped',
	skipped: 'skipped'
};

export const STAGE_META = {
	filter: { label: 'Filter', color: 'var(--primary)', icon: '🔍' },
	review: { label: 'Review', color: '#3b82f6', icon: '📋' },
	connect: { label: 'Connect', color: '#f97316', icon: '🤝' },
	decide: { label: 'Decide', color: '#a855f7', icon: '⭐' },
	invested: { label: 'Invested', color: '#059669', icon: '💰' },
	skipped: { label: 'Skipped', color: 'var(--text-muted)', icon: '👋' }
};

export function normalizeStage(stage, fallback = 'filter') {
	const normalized = String(stage || '').trim().toLowerCase();
	if (!normalized) return fallback;
	const mapped = LEGACY_STAGE_MAP[normalized] || normalized;
	return CANONICAL_DB_STAGES.includes(mapped) ? mapped : fallback;
}

export function getUiStage(stage, fallback = 'filter') {
	return normalizeStage(stage, fallback);
}

export function stageLabel(stage) {
	return STAGE_META[normalizeStage(stage)]?.label || STAGE_META.filter.label;
}

export function isReviewingStage(stage) {
	const normalized = normalizeStage(stage);
	return ['review', 'connect', 'decide'].includes(normalized);
}

export function isInvestedStage(stage) {
	return normalizeStage(stage) === 'invested';
}

export function createCanonicalStageCounts(seed = 0) {
	return Object.fromEntries(CANONICAL_DB_STAGES.map((stage) => [stage, seed]));
}

export function normalizeStageCounts(row = {}) {
	const counts = createCanonicalStageCounts(0);
	for (const stage of CANONICAL_DB_STAGES) {
		counts[stage] = Number(row?.[stage] || 0);
	}
	return {
		...counts,
		reviewing: counts.review + counts.connect + counts.decide
	};
}

export function toUiStageCounts(row = {}) {
	const counts = normalizeStageCounts(row);
	return {
		filter: counts.filter,
		review: counts.review,
		connect: counts.connect,
		decide: counts.decide,
		invested: counts.invested,
		skipped: counts.skipped
	};
}

export function normalizeShareActivity(profile = {}, fallback = true) {
	if (typeof profile?.share_activity === 'boolean') return profile.share_activity;
	if (typeof profile?.sharePortfolio === 'boolean') return profile.sharePortfolio;

	const legacyFlags = [
		profile?.share_saved,
		profile?.share_dd,
		profile?.share_invested,
		profile?.share_portfolio,
		profile?.sharePortfolio
	].filter((value) => typeof value === 'boolean');

	if (legacyFlags.length > 0) {
		return legacyFlags.some(Boolean);
	}

	return fallback;
}

export function normalizePrivacyProfile(profile = {}) {
	const shareActivity = normalizeShareActivity(profile, true);
	return {
		...profile,
		share_activity: shareActivity,
		sharePortfolio: shareActivity,
		share_portfolio: shareActivity,
		share_saved: shareActivity,
		share_dd: shareActivity,
		share_invested: shareActivity,
		allow_follows: profile?.allow_follows !== false
	};
}

export function normalizePrivacyUpdate(fields = {}) {
	const next = { ...fields };
	if ('sharePortfolio' in next && !('share_portfolio' in next)) {
		next.share_portfolio = next.sharePortfolio;
	}

	if ('share_activity' in next) {
		const shareActivity = next.share_activity !== false;
		next.share_activity = shareActivity;
		next.share_portfolio = shareActivity;
		next.share_saved = shareActivity;
		next.share_dd = shareActivity;
		next.share_invested = shareActivity;
		delete next.sharePortfolio;
		return next;
	}

	const hasLegacyPrivacyField = ['sharePortfolio', 'share_portfolio', 'share_saved', 'share_dd', 'share_invested'].some(
		(key) => key in next
	);
	if (hasLegacyPrivacyField) {
		const shareActivity = normalizeShareActivity(next, true);
		next.share_activity = shareActivity;
		next.share_portfolio = shareActivity;
		next.share_saved = shareActivity;
		next.share_dd = shareActivity;
		next.share_invested = shareActivity;
	}

	delete next.sharePortfolio;

	return next;
}

export const CANONICAL_OFFERING_TYPES = ['506(b)', '506(c)', 'Regulation A', 'Regulation D', 'Other'];

const OFFERING_TYPE_ALIASES = {
	'06b': '506(b)',
	'06c': '506(c)',
	'506(b)': '506(b)',
	'506(c)': '506(c)',
	'506b': '506(b)',
	'506c': '506(c)',
	'reg d 506(b)': '506(b)',
	'reg d 506(c)': '506(c)',
	'reg d 506b': '506(b)',
	'reg d 506c': '506(c)',
	'regulation d 506(b)': '506(b)',
	'regulation d 506(c)': '506(c)',
	'regulation d 506b': '506(b)',
	'regulation d 506c': '506(c)',
	'reg a': 'Regulation A',
	'reg a+': 'Regulation A',
	'reg_a': 'Regulation A',
	'reg d': 'Regulation D',
	'reg_d': 'Regulation D',
	'regulation a': 'Regulation A',
	'regulation d': 'Regulation D',
	other: 'Other',
	unknown: 'Other'
};

export function normalizeOfferingType(value, { empty = '' } = {}) {
	const normalized = String(value || '').trim();
	if (!normalized) return empty;

	const exactMatch = OFFERING_TYPE_ALIASES[normalized.toLowerCase()];
	if (exactMatch) return exactMatch;
	if (CANONICAL_OFFERING_TYPES.includes(normalized)) return normalized;

	return normalized;
}

export function normalizeDealComplianceFields(fields = {}) {
	let offeringType = normalizeOfferingType(
		fields.offering_type ?? fields.offeringType,
		{ empty: '' }
	);

	if (!offeringType && (fields.is_506b === true || fields.is506b === true)) {
		offeringType = '506(b)';
	}

	const is506b = offeringType
		? offeringType === '506(b)'
		: fields.is_506b === true || fields.is506b === true;

	return {
		...fields,
		offering_type: offeringType,
		offeringType,
		is_506b: is506b,
		is506b
	};
}
