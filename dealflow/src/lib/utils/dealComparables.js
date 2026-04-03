const COMPARABLE_METRICS = ['targetIRR', 'preferredReturn', 'equityMultiple', 'investmentMinimum', 'holdPeriod'];

export function getComparableDealScore(deal = {}) {
	return COMPARABLE_METRICS.reduce((score, key) => score + (hasComparableValue(deal?.[key]) ? 1 : 0), 0);
}

export function isComparableDealEligible(deal = {}, minScore = 3) {
	return getComparableDealScore(deal) >= minScore;
}

export function filterComparableDeals(deals = [], minScore = 3) {
	if (!Array.isArray(deals) || deals.length === 0) return [];
	return deals.filter((deal) => isComparableDealEligible(deal, minScore));
}

function hasComparableValue(value) {
	if (value === null || value === undefined) return false;
	if (typeof value === 'number') return Number.isFinite(value);

	if (typeof value === 'string') {
		const normalized = value.trim();
		if (!normalized) return false;
		return !/^(unknown|n\/a|na|none|---|—)$/i.test(normalized);
	}

	if (Array.isArray(value)) return value.length > 0;
	return true;
}
