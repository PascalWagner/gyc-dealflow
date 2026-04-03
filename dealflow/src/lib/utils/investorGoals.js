export const GOAL_LABEL_TO_TYPE = Object.freeze({
	'cash flow (income now)': 'passive_income',
	'equity growth (wealth later)': 'build_wealth',
	'tax optimization (tax shield now)': 'reduce_taxes'
});

export const GOAL_TYPE_TO_BRANCH = Object.freeze({
	passive_income: 'cashflow',
	build_wealth: 'growth',
	reduce_taxes: 'tax'
});

export const GOAL_LABEL_TO_BRANCH = Object.freeze({
	'cash flow (income now)': 'cashflow',
	'equity growth (wealth later)': 'growth',
	'tax optimization (tax shield now)': 'tax'
});

export const BRANCH_TO_GOAL_LABEL = Object.freeze({
	cashflow: 'Cash Flow (income now)',
	growth: 'Equity Growth (wealth later)',
	tax: 'Tax Optimization (tax shield now)'
});

function normalizeGoalValue(value) {
	return String(value || '').trim().toLowerCase();
}

export function normalizeGoalBranchValue(value) {
	const normalized = normalizeGoalValue(value);
	if (!normalized) return '';
	if (GOAL_LABEL_TO_BRANCH[normalized]) return GOAL_LABEL_TO_BRANCH[normalized];
	if (GOAL_TYPE_TO_BRANCH[normalized]) return GOAL_TYPE_TO_BRANCH[normalized];
	if (normalized === 'cashflow' || normalized === 'cash_flow' || normalized === 'cash flow' || normalized.includes('cash')) return 'cashflow';
	if (normalized === 'growth' || normalized.includes('growth') || normalized.includes('equity')) return 'growth';
	if (normalized === 'tax' || normalized.includes('tax')) return 'tax';
	return '';
}

export function goalLabelForBranch(value) {
	const branch = normalizeGoalBranchValue(value);
	return BRANCH_TO_GOAL_LABEL[branch] || '';
}

export function goalTypeForValue(value) {
	const normalized = normalizeGoalValue(value);
	if (!normalized) return '';
	if (GOAL_LABEL_TO_TYPE[normalized]) return GOAL_LABEL_TO_TYPE[normalized];
	if (GOAL_TYPE_TO_BRANCH[normalized]) return normalized;

	const branch = normalizeGoalBranchValue(normalized);
	if (!branch) return '';
	if (branch === 'growth') return 'build_wealth';
	if (branch === 'tax') return 'reduce_taxes';
	return 'passive_income';
}

const RANGE_TO_CAPITAL = Object.freeze({
	'<$100k': 50000,
	'$100k - $249k': 175000,
	'$100k-$249k': 175000,
	'$249k - $499k': 375000,
	'$249k-$499k': 375000,
	'$250k - $499k': 375000,
	'$250k-$499k': 375000,
	'$250k - $1m': 625000,
	'$250k-$1m': 625000,
	'$500k - $999k': 750000,
	'$500k-$999k': 750000,
	'$1m+': 2000000,
	'$1m +': 2000000,
	'$1m or more': 2000000
});

export function rangeLabelToCapital(label) {
	const normalized = String(label || '').trim();
	if (!normalized) return 0;
	const mapped = RANGE_TO_CAPITAL[normalized] ?? RANGE_TO_CAPITAL[normalized.toLowerCase()];
	return mapped || Number(normalized) || 0;
}

export function capitalToRangeLabel(num) {
	const amount = Number(num);
	if (!amount || Number.isNaN(amount)) return null;
	if (amount < 100000) return '<$100k';
	if (amount < 250000) return '$100k - $249k';
	if (amount < 500000) return '$249k - $499k';
	if (amount < 1000000) return '$500k - $999k';
	return '$1M+';
}
