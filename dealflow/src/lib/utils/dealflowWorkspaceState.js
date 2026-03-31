const BUY_BOX_DEAL_TYPES = new Set([
	'fund',
	'syndication',
	'reit',
	'1031 exchange',
	'joint venture',
	'note/debt',
	'other'
]);

export const DEALFLOW_UI_SCROLL_TABS = ['filter', 'review', 'connect', 'decide', 'invested', 'skipped'];
export const DEALFLOW_UI_STAGE_TABS = new Set(DEALFLOW_UI_SCROLL_TABS);

export const DEALFLOW_STAGE_CONTENT = {
	filter: {
		title: 'Filter',
		text: 'Browse new opportunities. Move strong deals to Review, or skip what does not fit.'
	},
	review: {
		title: 'Review',
		text: 'Take a closer look at shortlisted deals. Move the strongest ones forward.'
	},
	connect: {
		title: 'Connect',
		text: 'Connect with the operator and collect the details you need to move forward.'
	},
	decide: {
		title: 'Decide',
		text: 'Compare deals and decide which ones to invest in.'
	},
	invested: {
		title: 'Invested',
		text: 'Track the deals you’ve invested in and keep your portfolio organized.'
	},
	skipped: {
		title: 'Skipped',
		text: 'Keep track of deals you skipped without cluttering your active pipeline.'
	}
};

function normalizeStageTab(value) {
	const normalized = String(value || '').trim().toLowerCase();
	return DEALFLOW_UI_STAGE_TABS.has(normalized) ? normalized : 'filter';
}

function normalizeString(value, fallback = '') {
	return String(value ?? fallback);
}

function toFiniteNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function emptyDealflowScrollPositions() {
	return Object.fromEntries(DEALFLOW_UI_SCROLL_TABS.map((tab) => [tab, 0]));
}

export function normalizeDealflowUiState(value) {
	const nextState = value && typeof value === 'object' ? value : {};
	const nextScrollPositions = emptyDealflowScrollPositions();

	for (const tab of DEALFLOW_UI_SCROLL_TABS) {
		const rawValue = Number(nextState.scrollPositions?.[tab] || 0);
		nextScrollPositions[tab] = Number.isFinite(rawValue) ? Math.max(0, Math.round(rawValue)) : 0;
	}

	return {
		currentTab: normalizeStageTab(nextState.currentTab),
		search: normalizeString(nextState.search),
		assetClass: normalizeString(nextState.assetClass),
		dealType: normalizeString(nextState.dealType),
		strategy: normalizeString(nextState.strategy),
		status: normalizeString(nextState.status),
		maxInvest: normalizeString(nextState.maxInvest),
		maxLockup: normalizeString(nextState.maxLockup),
		distributions: normalizeString(nextState.distributions),
		minIRR: normalizeString(nextState.minIRR),
		sortBy: normalizeString(nextState.sortBy || 'newest', 'newest'),
		showArchived: Boolean(nextState.showArchived),
		buyBoxApplied: Boolean(nextState.buyBoxApplied),
		compareIds: Array.isArray(nextState.compareIds) ? nextState.compareIds : [],
		viewMode: normalizeString(nextState.viewMode || 'grid', 'grid'),
		scrollPositions: nextScrollPositions
	};
}

export function buildDealflowUiStateSnapshot({
	currentTab = 'filter',
	search = '',
	assetClass = '',
	dealType = '',
	strategy = '',
	status = '',
	maxInvest = '',
	maxLockup = '',
	distributions = '',
	minIRR = '',
	sortBy = 'newest',
	showArchived = false,
	buyBoxApplied = false,
	compareIds = [],
	viewMode = 'grid',
	scrollPositions = emptyDealflowScrollPositions()
} = {}) {
	return {
		currentTab: normalizeStageTab(currentTab),
		search: normalizeString(search),
		assetClass: normalizeString(assetClass),
		dealType: normalizeString(dealType),
		strategy: normalizeString(strategy),
		status: normalizeString(status),
		maxInvest: normalizeString(maxInvest),
		maxLockup: normalizeString(maxLockup),
		distributions: normalizeString(distributions),
		minIRR: normalizeString(minIRR),
		sortBy: normalizeString(sortBy || 'newest', 'newest'),
		showArchived: Boolean(showArchived),
		buyBoxApplied: Boolean(buyBoxApplied),
		compareIds: Array.isArray(compareIds) ? compareIds : [],
		viewMode: normalizeString(viewMode || 'grid', 'grid'),
		scrollPositions: normalizeDealflowUiState({ scrollPositions }).scrollPositions,
		updatedAt: Date.now()
	};
}

export function getBuyBoxCheckSize(inputBuyBox) {
	const directCheckSize = Number(inputBuyBox?.checkSize);
	if (Number.isFinite(directCheckSize) && directCheckSize > 0) return directCheckSize;

	const investableCapital = String(inputBuyBox?.investableCapital || inputBuyBox?._capitalRange || '').trim();
	if (!investableCapital.includes('-')) return 0;

	const rangeParts = investableCapital
		.split('-')
		.map((part) => toFiniteNumber(parseInt(part, 10)))
		.filter(Number.isFinite);

	return rangeParts[rangeParts.length - 1] || 0;
}

function normalizeMatchValue(value) {
	return String(value || '').trim().toLowerCase();
}

export function getBuyBoxSelections(inputBuyBox) {
	const combinedSelections = [
		...(Array.isArray(inputBuyBox?.strategies) ? inputBuyBox.strategies : []),
		...(Array.isArray(inputBuyBox?.dealTypes) ? inputBuyBox.dealTypes : [])
	]
		.map(normalizeMatchValue)
		.filter(Boolean);

	return {
		dealTypes: combinedSelections.filter((value) => BUY_BOX_DEAL_TYPES.has(value)),
		strategies: combinedSelections.filter((value) => !BUY_BOX_DEAL_TYPES.has(value))
	};
}
