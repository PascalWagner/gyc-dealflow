import { buildGoalProjection } from '$lib/utils/dealAnalysis.js';
import { normalizeGoalBranchValue } from '$lib/utils/investorGoals.js';

const COMPLETENESS_KEYS = [
	'investmentName',
	'assetClass',
	'dealType',
	'strategy',
	'investmentStrategy',
	'targetIRR',
	'preferredReturn',
	'cashOnCash',
	'investmentMinimum',
	'holdPeriod',
	'offeringType',
	'offeringSize',
	'distributions',
	'lpGpSplit',
	'fees',
	'financials',
	'investingGeography',
	'instrument',
	'deckUrl',
	'ppmUrl',
	'secCik',
	'managementCompanyId',
	'purchasePrice',
	'status'
];

const DISTRIBUTION_RANK = {
	monthly: 1,
	quarterly: 2,
	'semi-annually': 3,
	annually: 4
};

export function getDealCompleteness(deal) {
	let filled = 0;
	for (const key of COMPLETENESS_KEYS) {
		const value = deal?.[key];
		if (value !== null && value !== undefined && value !== '' && value !== 0 && !(Array.isArray(value) && value.length === 0)) {
			filled++;
		}
	}
	return Math.round((filled / COMPLETENESS_KEYS.length) * 100);
}

export function isDealStale(deal) {
	if (!deal) return false;
	if (deal.isStale) return true;

	const status = String(deal.status || '').toLowerCase();
	if (['closed', 'fully funded', 'completed'].includes(status)) return true;

	if (status !== 'evergreen' && deal.addedDate) {
		const months = (Date.now() - new Date(deal.addedDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
		const dealType = String(deal.dealType || '').toLowerCase();
		if (dealType === 'syndication' && months > 18) return true;
		if (months > 24) return true;
	}

	return false;
}

export function buildBuyBoxLite(deal) {
	if (!deal) return null;
	const signals = [];
	if (deal.preferredReturn) signals.push(formatDealMetric(deal.preferredReturn, 'pct') + ' pref');
	if (deal.cashOnCash) signals.push(formatDealMetric(deal.cashOnCash, 'pct') + ' CoC');
	if (deal.distributions && deal.distributions !== 'Unknown') signals.push(deal.distributions + ' distributions');

	const isStrong = signals.length > 0;
	return {
		label: isStrong ? 'Cash Flow Potential' : 'Cash Flow Needs Review',
		status: isStrong ? 'Aligned' : 'Needs more detail',
		description: isStrong
			? signals.join(' • ')
			: 'Create your account to save this deal, set your preferences, and unlock a fuller Buy Box match.'
	};
}

export function normalizeGoalBranch(value) {
	return normalizeGoalBranchValue(value) || null;
}

export function resolveGoalBranch({ userGoal, buyBox } = {}) {
	return (
		normalizeGoalBranch(userGoal)
		|| normalizeGoalBranch(buyBox?._branch)
		|| normalizeGoalBranch(buyBox?.goal)
	);
}

export function parseTargetAmount(text) {
	if (!text) return null;

	const cleaned = String(text).replace(/\/yr|\/mo|\+/gi, '').trim();
	if (!cleaned) return null;

	const rangeParts = cleaned.split('-').map((part) => part.trim()).filter(Boolean);
	const lowerBound = rangeParts[0] || cleaned;
	const upperBound = rangeParts[1] || '';
	const lowerMatch = lowerBound.match(/\$?([\d,.]+)\s*(k|m|b)?/i);
	if (!lowerMatch) return null;

	const inheritedSuffix = lowerMatch[2] || upperBound.match(/\$?[\d,.]+\s*(k|m|b)/i)?.[1] || '';
	const numericValue = parseFloat(lowerMatch[1].replace(/,/g, ''));
	if (!Number.isFinite(numericValue)) return null;

	return numericValue * suffixToMultiplier(inheritedSuffix);
}

export function formatTargetDisplay(amount, branch) {
	const formatted = formatGoalMoney(amount);
	if (branch === 'cashflow' || branch === 'tax') return formatted + '/yr';
	return formatted;
}

export function buildGoalProgress({ deal, buyBox, userGoal, goalBranch = resolveGoalBranch({ userGoal, buyBox }) } = {}) {
	if (!buyBox || !goalBranch) return null;

	let targetRaw = null;
	let currentRaw = 0;

	if (goalBranch === 'cashflow') {
		targetRaw = parseTargetAmount(buyBox.targetCashFlow || buyBox.targetIncome);
		currentRaw = parseTargetAmount(buyBox.baselineIncome) || 0;
	} else if (goalBranch === 'growth') {
		targetRaw = parseTargetAmount(buyBox.growthCapital || buyBox.targetGrowth);
	} else if (goalBranch === 'tax') {
		targetRaw = parseTargetAmount(buyBox.taxableIncome || buyBox.targetTaxSavings);
	}

	if (!targetRaw || targetRaw <= 0) return null;

	const pct = Math.min(100, Math.max(0, Math.round((currentRaw / targetRaw) * 100)));
	const projection = deal ? buildGoalProjection(deal, goalBranch, deal?.investmentMinimum) : null;

	let dealContribution = 0;
	if (projection) {
		if (goalBranch === 'cashflow') dealContribution = projection.annual || 0;
		else if (goalBranch === 'tax') dealContribution = projection.writeOff || 0;
		else if (goalBranch === 'growth') dealContribution = projection.gain || 0;
	}

	const pctAfter = Math.min(100, Math.max(0, Math.round(((currentRaw + dealContribution) / targetRaw) * 100)));

	return {
		target: formatTargetDisplay(targetRaw, goalBranch),
		targetRaw,
		current: formatGoalMoney(currentRaw),
		currentRaw,
		pct,
		pctAfter
	};
}

export function buildBuyBoxChecks(deal, buyBox) {
	if (!deal || !buyBox) return [];

	const checks = [];
	if (buyBox.assetClasses?.length > 0) {
		checks.push({
			label: 'Asset Class',
			match: buyBox.assetClasses.includes(deal.assetClass),
			want: buyBox.assetClasses.join(', '),
			got: deal.assetClass || '---'
		});
	}
	if (buyBox.checkSize) {
		checks.push({
			label: 'Check Size',
			match: (deal.investmentMinimum || 0) <= buyBox.checkSize,
			want: 'Up to ' + formatShortMoney(buyBox.checkSize),
			got: formatDealMetric(deal.investmentMinimum, 'money')
		});
	}
	if (buyBox.minIRR) {
		const buyBoxIRR = parseFloat(buyBox.minIRR);
		const dealIRR = deal.targetIRR || 0;
		const dealIRRpct = dealIRR <= 1 ? dealIRR * 100 : dealIRR;
		const buyBoxIRRpct = buyBoxIRR <= 1 ? buyBoxIRR * 100 : buyBoxIRR;
		checks.push({
			label: 'Target Return',
			match: dealIRRpct >= buyBoxIRRpct,
			want: buyBoxIRRpct.toFixed(1) + '%+',
			got: dealIRRpct ? dealIRRpct.toFixed(1) + '%' : '---'
		});
	}
	if (buyBox.strategies?.length > 0) {
		checks.push({
			label: 'Strategy',
			match: buyBox.strategies.includes(deal.strategy),
			want: buyBox.strategies.join(', '),
			got: deal.strategy || '---'
		});
	}
	if (buyBox.maxLockup) {
		const maxLock = parseFloat(buyBox.maxLockup);
		const holdYears = parseFloat(deal.holdPeriod) || 0;
		checks.push({
			label: 'Hold Period',
			match: holdYears <= maxLock,
			want: maxLock + ' yrs max',
			got: deal.holdPeriod ? formatHoldPeriod(deal.holdPeriod) : '---'
		});
	}
	if (buyBox.distributions && deal.distributions && deal.distributions !== 'Unknown') {
		const buyBoxDistributionRank = DISTRIBUTION_RANK[String(buyBox.distributions || '').toLowerCase()] || 99;
		const dealDistributionRank = DISTRIBUTION_RANK[String(deal.distributions || '').toLowerCase()] || 99;
		checks.push({
			label: 'Distributions',
			match: dealDistributionRank <= buyBoxDistributionRank,
			want: buyBox.distributions,
			got: deal.distributions
		});
	}
	if (buyBox.goal || buyBox._branch) {
		const branch = normalizeGoalBranch(buyBox._branch || buyBox.goal) || '';
		let goalMatch = false;
		let goalGot = '';

		if (branch === 'cashflow') {
			const hasDistribution = deal.distributions && deal.distributions !== 'Unknown' && deal.distributions !== 'None';
			goalMatch = !!(hasDistribution || deal.cashOnCash > 0 || deal.preferredReturn > 0);
			const parts = [];
			if (deal.preferredReturn > 0) parts.push(formatDealMetric(deal.preferredReturn, 'pct') + ' pref');
			if (deal.cashOnCash > 0) parts.push(formatDealMetric(deal.cashOnCash, 'pct') + ' CoC');
			if (hasDistribution) parts.push(deal.distributions.toLowerCase() + ' dist.');
			goalGot = goalMatch ? parts.join(', ') : 'No regular income';
		} else if (branch === 'tax') {
			goalMatch = !!deal.firstYrDepreciation;
			goalGot = deal.firstYrDepreciation ? deal.firstYrDepreciation + ' yr-1 depr.' : 'No depreciation data';
		} else if (branch === 'growth') {
			goalMatch = !!(deal.equityMultiple >= 1.5 || (deal.targetIRR && (deal.targetIRR > 1 ? deal.targetIRR : deal.targetIRR * 100) >= 15));
			const growthParts = [];
			if (deal.equityMultiple) growthParts.push(formatDealMetric(deal.equityMultiple, 'multiple') + ' multiple');
			if (deal.targetIRR) growthParts.push(formatDealMetric(deal.targetIRR, 'pct') + ' IRR');
			goalGot = growthParts.length > 0 ? growthParts.join(' / ') : 'No growth metrics';
		}

		const goalLabels = {
			cashflow: 'Income / Cash Flow',
			tax: 'Tax Benefits',
			growth: 'Growth / Appreciation'
		};

		checks.push({
			label: 'Goal Alignment',
			match: goalMatch,
			want: goalLabels[branch] || branch,
			got: goalGot || '---'
		});
	}
	if (buyBox.capital90Day) {
		const capital = parseFloat(buyBox.capital90Day);
		if (capital && deal.investmentMinimum) {
			checks.push({
				label: 'Capital Fit',
				match: deal.investmentMinimum <= capital,
				want: 'Up to ' + formatShortMoney(capital) + ' (90-day)',
				got: formatDealMetric(deal.investmentMinimum, 'money') + ' min'
			});
		}
	}

	return checks;
}

export function summarizeBuyBoxScore(checks = []) {
	if (checks.length === 0) return { matched: 0, total: 0, pct: 0 };
	const matched = checks.filter((check) => check.match).length;
	const total = checks.length;
	return { matched, total, pct: Math.round((matched / total) * 100) };
}

function suffixToMultiplier(suffix) {
	const normalized = String(suffix || '').trim().toLowerCase();
	if (normalized === 'k') return 1000;
	if (normalized === 'm') return 1000000;
	if (normalized === 'b') return 1000000000;
	return 1;
}

function formatGoalMoney(value) {
	if (!value || Number.isNaN(value)) return '$0';
	if (value >= 1e6) return '$' + (value / 1e6).toFixed(1) + 'M';
	if (value >= 1e3) return '$' + Math.round(value / 1e3).toLocaleString() + 'K';
	return '$' + Math.round(value).toLocaleString();
}

function formatShortMoney(value) {
	const numericValue = parseFloat(value);
	if (!numericValue) return '---';
	if (numericValue >= 1e6) return '$' + (numericValue / 1e6).toFixed(1) + 'M';
	if (numericValue >= 1e3) return '$' + (numericValue / 1e3).toFixed(0) + 'K';
	return '$' + numericValue.toLocaleString();
}

function formatDealMetric(value, type) {
	if (value === undefined || value === null || value === '') return '---';
	if (type === 'pct') {
		const numericValue = typeof value === 'number' ? value : parseFloat(value);
		if (Number.isNaN(numericValue)) return '---';
		return (numericValue > 1 ? numericValue : numericValue * 100).toFixed(1) + '%';
	}
	if (type === 'money') {
		const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : value;
		if (Number.isNaN(numericValue)) return '---';
		if (numericValue === 0) return '$0';
		if (numericValue >= 1e9) return '$' + (numericValue / 1e9).toFixed(1) + 'B';
		if (numericValue >= 1e6) return '$' + (numericValue / 1e6).toFixed(1) + 'M';
		if (numericValue >= 1e3) return '$' + (numericValue / 1e3).toFixed(0) + 'K';
		return '$' + numericValue.toLocaleString();
	}
	if (type === 'multiple') {
		const numericValue = typeof value === 'number' ? value : parseFloat(value);
		if (Number.isNaN(numericValue)) return '---';
		return numericValue.toFixed(2) + 'x';
	}
	return String(value);
}

function formatHoldPeriod(value) {
	if (!value) return '---';
	if (typeof value === 'string' && value.toLowerCase().includes('open')) return 'Open-ended';
	const numericValue = parseFloat(value);
	if (Number.isNaN(numericValue)) return String(value);
	if (numericValue === 1) return '1 Year';
	return numericValue + ' Years';
}
