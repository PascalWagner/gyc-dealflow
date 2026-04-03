import { isDebtOrLendingDeal } from './dealReturns.js';

const EQUITY_COMPARABLE_METRICS = [
	{ key: 'targetIRR', label: 'Target IRR', type: 'pct' },
	{ key: 'preferredReturn', label: 'Pref Return', type: 'pct' },
	{ key: 'equityMultiple', label: 'Eq Multiple', type: 'multiple' },
	{ key: 'investmentMinimum', label: 'Minimum', type: 'money' },
	{ key: 'holdPeriod', label: 'Hold Period', type: 'hold' }
];

const LENDING_COMPARABLE_METRICS = [
	{ key: 'targetIRR', label: 'Target Yield', type: 'pct' },
	{ key: 'distributions', label: 'Distributions', type: 'text' },
	{ key: 'investmentMinimum', label: 'Minimum', type: 'money' },
	{ key: 'holdPeriod', label: 'Lockup', type: 'hold' },
	{ keys: ['managerAUM', 'fundAUM'], label: 'Manager AUM', type: 'money' }
];

export function getComparableMetricConfig(referenceDeal = {}) {
	return isDebtOrLendingDeal(referenceDeal) ? LENDING_COMPARABLE_METRICS : EQUITY_COMPARABLE_METRICS;
}

export function getComparableMetricValue(deal = {}, metric = {}) {
	if (metric?.getValue) return metric.getValue(deal);
	if (Array.isArray(metric?.keys)) {
		for (const key of metric.keys) {
			if (hasComparableValue(deal?.[key])) return deal[key];
		}
		return null;
	}
	return deal?.[metric?.key] ?? null;
}

export function getComparableDealScore(deal = {}, referenceDeal = {}) {
	return getComparableMetricConfig(referenceDeal).reduce(
		(score, metric) => score + (hasComparableValue(getComparableMetricValue(deal, metric)) ? 1 : 0),
		0
	);
}

export function isComparableDealEligible(deal = {}, referenceDeal = {}, minScore = 3) {
	return getComparableDealScore(deal, referenceDeal) >= minScore;
}

export function filterComparableDeals(deals = [], referenceDeal = {}, minScore = 3) {
	if (!Array.isArray(deals) || deals.length === 0) return [];
	return deals.filter((deal) => isComparableDealEligible(deal, referenceDeal, minScore));
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
