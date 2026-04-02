export const STEP = {
	GOAL: 'goal',
	EXPERIENCE: 'experience',
	RE_PRO: 're-professional',
	BASELINE: 'starting-point',
	ASSETS: 'asset-classes',
	STRATEGIES: 'strategies',
	RISK: 'risk-tolerance',
	ACCREDITATION: 'accreditation',
	CF_TARGET: 'income-target',
	GROWTH_TARGET: 'growth-target',
	TAX_TARGET: 'tax-target',
	GROWTH_PRIORITY: 'growth-priority',
	TAX_BASELINE: 'tax-baseline',
	NET_WORTH: 'net-worth',
	CAPITAL: 'capital',
	SOURCE: 'source',
	READINESS: 'readiness',
	DIVERSIFICATION: 'diversification',
	OPERATOR_FOCUS: 'operator-focus',
	LOCKUP: 'lockup',
	DISTRIBUTIONS: 'distributions',
	PLAN: 'plan',
	LP_NETWORK: 'lp-network',
	PROFILE_REVIEW: 'profile-review',
	COMPLETION: 'completion'
};

export const STEP_SEQUENCE = {
	free: [
		STEP.GOAL,
		STEP.EXPERIENCE,
		STEP.RE_PRO,
		STEP.BASELINE,
		STEP.ASSETS,
		STEP.STRATEGIES,
		STEP.RISK,
		STEP.ACCREDITATION
	],
	paid_cashflow: [
		STEP.CF_TARGET,
		STEP.NET_WORTH,
		STEP.CAPITAL,
		STEP.SOURCE,
		STEP.READINESS,
		STEP.DIVERSIFICATION,
		STEP.OPERATOR_FOCUS,
		STEP.LOCKUP,
		STEP.DISTRIBUTIONS,
		STEP.PLAN,
		STEP.LP_NETWORK,
		STEP.PROFILE_REVIEW,
		STEP.COMPLETION
	],
	paid_growth: [
		STEP.GROWTH_TARGET,
		STEP.GROWTH_PRIORITY,
		STEP.NET_WORTH,
		STEP.TAX_BASELINE,
		STEP.CAPITAL,
		STEP.SOURCE,
		STEP.READINESS,
		STEP.DIVERSIFICATION,
		STEP.OPERATOR_FOCUS,
		STEP.LOCKUP,
		STEP.DISTRIBUTIONS,
		STEP.PLAN,
		STEP.LP_NETWORK,
		STEP.PROFILE_REVIEW,
		STEP.COMPLETION
	],
	paid_tax: [
		STEP.TAX_TARGET,
		STEP.TAX_BASELINE,
		STEP.NET_WORTH,
		STEP.CAPITAL,
		STEP.SOURCE,
		STEP.READINESS,
		STEP.DIVERSIFICATION,
		STEP.OPERATOR_FOCUS,
		STEP.LOCKUP,
		STEP.DISTRIBUTIONS,
		STEP.PLAN,
		STEP.LP_NETWORK,
		STEP.PROFILE_REVIEW,
		STEP.COMPLETION
	]
};

export const PHASE_NAMES = ['You', 'Goal', 'Finances', 'Preferences', 'My Plan'];

const STEP_TO_PHASE = {
	[STEP.GOAL]: 0,
	[STEP.EXPERIENCE]: 0,
	[STEP.RE_PRO]: 0,
	[STEP.BASELINE]: 0,
	[STEP.ASSETS]: 0,
	[STEP.STRATEGIES]: 0,
	[STEP.RISK]: 0,
	[STEP.ACCREDITATION]: 0,
	[STEP.CF_TARGET]: 1,
	[STEP.GROWTH_TARGET]: 1,
	[STEP.TAX_TARGET]: 1,
	[STEP.TAX_BASELINE]: 1,
	[STEP.NET_WORTH]: 2,
	[STEP.GROWTH_PRIORITY]: 2,
	[STEP.CAPITAL]: 2,
	[STEP.SOURCE]: 2,
	[STEP.READINESS]: 2,
	[STEP.DIVERSIFICATION]: 3,
	[STEP.OPERATOR_FOCUS]: 3,
	[STEP.LOCKUP]: 3,
	[STEP.DISTRIBUTIONS]: 3,
	[STEP.PLAN]: 4,
	[STEP.LP_NETWORK]: 4,
	[STEP.PROFILE_REVIEW]: 4,
	[STEP.COMPLETION]: 4
};

export const GOAL_CARDS = [
	{
		branch: 'cashflow',
		title: 'Replace my income',
		description: 'Monthly checks that cover real bills - mortgage, school, car - from day one',
		icon: '💰',
		goalValue: 'Cash Flow (income now)'
	},
	{
		branch: 'tax',
		title: 'Keep more of what I make',
		description: "I'm tired of writing six-figure checks to the IRS - depreciation and write-offs can fix that",
		icon: '🏦',
		goalValue: 'Tax Optimization (tax shield now)'
	},
	{
		branch: 'growth',
		title: 'Build generational wealth',
		description: 'I want my money compounding while I sleep - 2x or more through value-add and development',
		icon: '🚀',
		goalValue: 'Equity Growth (wealth later)'
	}
];

export const CAPITAL_OPTIONS = [
	{ value: '$0', label: '$0 - just learning for now', description: 'Build your watchlist and learn the landscape first' },
	{ value: '$1-$49k', label: '$1 - $49K', description: 'Enough for one deal at a lower minimum' },
	{ value: '$50k-$99k', label: '$50K - $99K', description: 'One to two deals at typical minimums' },
	{ value: '$100k-$249k', label: '$100K - $249K', description: 'Two to four deals - real diversification starts here' },
	{ value: '$250k-$499k', label: '$250K - $499K', description: 'A well-diversified portfolio across asset classes' },
	{ value: '$500k-$999k', label: '$500K - $999K', description: 'Serious deployment - you can build a full portfolio' },
	{ value: '$1m+', label: '$1M+', description: 'Institutional-level capital with negotiating leverage' }
];

export const READINESS_OPTIONS = [
	{ value: 'now', label: 'Ready now', description: 'Capital is liquid and waiting', icon: '⚡' },
	{ value: '30days', label: 'Within 30 days', description: 'Just need the right deal', icon: '🎯' },
	{ value: '90days', label: '1-3 months', description: 'Still moving funds around', icon: '🔄' },
	{ value: 'exploring', label: 'Just exploring', description: 'Learning first, investing later', icon: '📚' }
];

export const SOURCE_OPTIONS = [
	{ value: 'business_exit', label: 'Sold a business', description: 'Looking to redeploy proceeds into passive investments', icon: '🏢' },
	{ value: 'property_sale', label: 'Sold / refinanced property', description: 'Capital from a real estate transaction', icon: '🏠' },
	{ value: 'inheritance', label: 'Inheritance / windfall', description: 'Received a lump sum and want to put it to work', icon: '🎁' },
	{ value: 'savings', label: 'Savings over time', description: 'Built up capital through disciplined saving', icon: '💰' },
	{ value: '1031', label: '1031 exchange', description: 'Need to identify replacement property within 45 days', icon: '🔄' },
	{ value: 'w2_income', label: 'W-2 / professional income', description: 'Investing a portion of ongoing earnings', icon: '💼' },
	{ value: 'other', label: 'Something else', description: 'Retirement accounts, trust distributions, etc.', icon: '✨' }
];

export const RE_PRO_OPTIONS = [
	{ value: 'yes', label: 'Yes, I qualify', description: 'I or my spouse meet the hours requirement' },
	{ value: 'no', label: "No, I don't qualify", description: 'I have a full-time job outside of real estate' },
	{ value: 'unsure', label: "I'm not sure", description: "I'd like to figure this out with my CPA" }
];

export const GROWTH_PRIORITY_OPTIONS = [
	{ value: 'max_return', label: 'Highest projected returns', description: "I'll accept longer lockups and less liquidity for maximum upside", icon: '🚀' },
	{ value: 'balanced', label: 'Balanced - some cash now, some growth', description: 'A mix of income-producing and appreciation-focused deals', icon: '⚖️' },
	{ value: 'preservation', label: 'Capital preservation first', description: "Protect my principal - I'll take lower returns for less risk", icon: '🛡️' }
];

export const LOSS_TOLERANCE_OPTIONS = [
	{ value: '10', label: '1-2% of net worth', description: 'Very conservative', low: 0.01, high: 0.02 },
	{ value: '20', label: '3-5% of net worth', description: 'Moderate risk', low: 0.03, high: 0.05 },
	{ value: '33', label: '5-10% of net worth', description: 'Concentrated', low: 0.05, high: 0.1 },
	{ value: '50', label: '10%+ of net worth', description: 'High conviction', low: 0.1, high: 0.15 },
	{ value: 'no_limit', label: 'No limit', description: "I'll decide deal by deal", low: 0, high: 0 }
];

export const DIVERSIFICATION_OPTIONS = [
	{ value: 'focused', label: 'Focused', description: 'Concentrate in 1-2 asset classes you know well. Fewer deals, deeper expertise.', icon: '🎯' },
	{ value: 'balanced', label: 'Balanced', description: 'Spread across 3-4 types for diversification. Most investors start here.', icon: '⚖️' },
	{ value: 'wide', label: 'Maximum Diversification', description: 'Spread across as many types as possible. Lower concentration risk, more to manage.', icon: '🌐' }
];

export const OPERATOR_FOCUS_OPTIONS = [
	{ value: 'specialist', label: 'Specialists Only', description: 'I want operators laser-focused on one asset class' },
	{ value: 'diversified', label: 'Prefer Diversified', description: 'I like firms that can deploy across multiple strategies' },
	{ value: 'both', label: 'Open to Both', description: "I'll evaluate any operator based on their track record" }
];

export const LOCKUP_OPTIONS = [
	{ value: 'flexible', label: 'Flexible', description: 'Lending funds and open-ended vehicles' },
	{ value: '1', label: '1 year', description: 'Bridge loans, short-duration credit' },
	{ value: '3', label: '3 years', description: 'Most syndications and value-add deals' },
	{ value: '5', label: '5 years', description: 'Stabilized assets, longer hold syndications' },
	{ value: '5+', label: '5+ years', description: 'Development, ground-up, opportunistic' }
];

export const DISTRIBUTION_OPTIONS = [
	{ value: 'Monthly', label: 'Monthly or more often', description: 'Mostly lending funds and stabilized assets' },
	{ value: 'Quarterly', label: 'Quarterly or more often', description: 'Opens up most syndications and funds' },
	{ value: 'Annual', label: 'Annually or more often', description: 'Includes development and growth deals' },
	{ value: 'Any', label: "No minimum - I'm flexible", description: 'Includes at-exit and event-driven payouts' }
];

export const ACCREDITATION_OPTIONS = [
	{ value: 'net_worth', label: 'Net worth over $1M', description: 'Individual or joint net worth exceeding $1M, excluding your primary residence (SEC Rule 501)' },
	{ value: 'income', label: 'Income over $200K', description: 'Earned $200K+ individually (or $300K+ jointly) in each of the past 2 years, with reasonable expectation of the same this year' },
	{ value: 'licensed', label: 'Licensed professional', description: 'Hold a Series 7, Series 65, or Series 82 license in good standing' },
	{ value: 'entity', label: 'Through an entity', description: 'Invest via an LLC, trust, family office, or fund with $5M+ in assets' }
];

export const NETWORK_BENEFITS = [
	{ icon: '🔍', title: 'Due diligence sharing', description: 'See which deals other experienced LPs are in. If someone you trust invested, that is a signal.' },
	{ icon: '🤝', title: 'Co-investor introductions', description: 'Connect with LPs in your deals to compare notes, ask questions, and build relationships.' },
	{ icon: '📊', title: 'Deal validation', description: 'A deal with 5 other LPs from this network is very different from one with zero. Social proof matters.' },
	{ icon: '👥', title: 'Negotiating leverage', description: 'Group capital gets better terms. LPs who invest together can negotiate preferred allocations and fee discounts.' }
];

export const STAGE_QUERY_MAP = {
	goal: STEP.GOAL,
	experience: STEP.EXPERIENCE,
	're-professional': STEP.RE_PRO,
	'starting-point': STEP.BASELINE,
	'asset-classes': STEP.ASSETS,
	strategies: STEP.STRATEGIES,
	'risk-tolerance': STEP.RISK,
	accreditation: STEP.ACCREDITATION,
	'income-target': STEP.CF_TARGET,
	'growth-target': STEP.GROWTH_TARGET,
	'tax-target': STEP.TAX_TARGET,
	'growth-priority': STEP.GROWTH_PRIORITY,
	'tax-baseline': STEP.TAX_BASELINE,
	'net-worth': STEP.NET_WORTH,
	capital: STEP.CAPITAL,
	source: STEP.SOURCE,
	readiness: STEP.READINESS,
	diversification: STEP.DIVERSIFICATION,
	'operator-focus': STEP.OPERATOR_FOCUS,
	lockup: STEP.LOCKUP,
	distributions: STEP.DISTRIBUTIONS,
	plan: STEP.PLAN,
	'lp-network': STEP.LP_NETWORK,
	'profile-review': STEP.PROFILE_REVIEW,
	completion: STEP.COMPLETION
};

const STEP_TO_STAGE = Object.fromEntries(
	Object.entries(STAGE_QUERY_MAP).map(([stage, step]) => [step, stage])
);

export const ASSET_CLASS_OPTIONS = {
	'Multi-Family': {
		icon: '🏢',
		label: 'Multi-Family',
		oneLiner: 'Apartment complexes (50-300+ units)',
		yieldRange: '6-10%',
		holdYears: '3-7',
		cashflow: { fit: 'good' },
		tax: { fit: 'great' },
		growth: { fit: 'great' }
	},
	'Self Storage': {
		icon: '📦',
		label: 'Self Storage',
		oneLiner: 'Storage facilities with month-to-month tenants',
		yieldRange: '8-12%',
		holdYears: '3-5',
		cashflow: { fit: 'good' },
		tax: { fit: 'good' },
		growth: { fit: 'great' }
	},
	Industrial: {
		icon: '🏭',
		label: 'Industrial',
		oneLiner: 'Warehouses, logistics, and distribution centers',
		yieldRange: '6-9%',
		holdYears: '5-10',
		cashflow: { fit: 'good' },
		tax: { fit: 'okay' },
		growth: { fit: 'good' }
	},
	'Hotels/Hospitality': {
		icon: '🏨',
		label: 'Hotels / Hospitality',
		oneLiner: 'Hotels, resorts, and short-term lodging',
		yieldRange: '8-15%',
		holdYears: '3-5',
		cashflow: { fit: 'okay' },
		tax: { fit: 'good' },
		growth: { fit: 'good' }
	},
	'Single Family': {
		icon: '🏡',
		label: 'Single Family',
		oneLiner: 'Build-to-rent communities and SFR portfolios',
		yieldRange: '5-8%',
		holdYears: '5-10',
		cashflow: { fit: 'good' },
		tax: { fit: 'good' },
		growth: { fit: 'good' }
	},
	'RV/Mobile Home Parks': {
		icon: '🏕️',
		label: 'Mobile Home Parks',
		oneLiner: 'Manufactured housing communities (you own the land)',
		yieldRange: '8-12%',
		holdYears: '3-7',
		cashflow: { fit: 'good' },
		tax: { fit: 'good' },
		growth: { fit: 'great' }
	},
	Retail: {
		icon: '🛍️',
		label: 'Retail',
		oneLiner: 'Shopping centers, strip malls, and NNN-leased retail',
		yieldRange: '6-9%',
		holdYears: '5-10',
		cashflow: { fit: 'good' },
		tax: { fit: 'okay' },
		growth: { fit: 'okay' }
	},
	'Medical Receivables': {
		icon: '🏥',
		label: 'Medical Receivables',
		oneLiner: 'Short-term loans backed by healthcare invoices',
		yieldRange: '8-12%',
		holdYears: '1-2',
		cashflow: { fit: 'great' },
		tax: { fit: 'poor' },
		growth: { fit: 'poor' }
	},
	'Oil & Gas / Energy': {
		icon: '⛽',
		label: 'Oil & Gas / Energy',
		oneLiner: 'Drilling programs, royalties, and working interests',
		yieldRange: '10-20%+',
		holdYears: '3-7',
		cashflow: { fit: 'okay' },
		tax: { fit: 'great' },
		growth: { fit: 'okay' }
	},
	'Business / Other': {
		icon: '🌿',
		label: 'Alternative / Other',
		oneLiner: 'Equipment leasing, royalties, private credit',
		yieldRange: 'Varies',
		holdYears: '1-5',
		cashflow: { fit: 'good' },
		tax: { fit: 'okay' },
		growth: { fit: 'okay' }
	}
};

export const PLAN_ASSET_OPTIONS = [
	{
		value: 'Lending',
		icon: '🤝',
		label: 'Private Debt / Credit',
		yieldRange: '8-12%'
	},
	...Object.entries(ASSET_CLASS_OPTIONS).map(([value, option]) => ({
		value,
		icon: option.icon,
		label: option.label,
		yieldRange: option.yieldRange
	}))
];

const PLAN_ASSET_ALIASES = {
	'Multi Family': 'Multi-Family',
	'Hotels / Hospitality': 'Hotels/Hospitality',
	'RV / Mobile Home Parks': 'RV/Mobile Home Parks',
	'Short-Term Rentals': 'Short Term Rental',
	'Oil & Gas': 'Oil & Gas / Energy',
	SFH: 'Single Family',
	'Single Family Homes': 'Single Family',
	'NNN (Triple Net Lease)': 'NNN',
	'Retail Shopping Centres': 'Retail',
	'Private Debt / Credit': 'Lending',
	Debt: 'Lending'
};

export const STRATEGY_ORDER = ['Lending', 'Buy & Hold', 'Value-Add', 'Distressed', 'Development'];

export const STRATEGY_OPTIONS = {
	'Lending': {
		icon: '🤝',
		label: 'Lending / Credit',
		lpImpact: 'You are the bank. Interest payments arrive monthly or quarterly from day one. Returns are capped but consistent, and your principal is typically secured by the property.'
	},
	'Buy & Hold': {
		icon: '🏠',
		label: 'Buy & Hold',
		lpImpact: 'You receive distributions from day one. Cash flow is predictable and the asset is already stabilized - lower risk, steady income.'
	},
	'Value-Add': {
		icon: '🔧',
		label: 'Value-Add',
		lpImpact: 'Expect little or no cash flow the first 1-2 years while renovations happen. Distributions typically start after a refinance, then increase as rents grow.'
	},
	Distressed: {
		icon: '⚡',
		label: 'Distressed / Turnaround',
		lpImpact: 'No income during the turnaround (often 1-3 years). Higher risk of loss, but buying at deep discounts means outsized upside if the operator executes.'
	},
	Development: {
		icon: '🚧',
		label: 'Ground-Up Development',
		lpImpact: 'Your capital is locked for 2-4 years with zero income while the project is built. You get paid when the asset sells or refinances - highest return potential but highest risk.'
	}
};

export function parseDollar(value) {
	if (typeof value === 'number') return value;
	if (!value) return 0;
	return parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
}

function normalizeRate(value) {
	const numeric = Number(value || 0);
	if (!numeric) return 0;
	return numeric > 1 ? numeric / 100 : numeric;
}

function roundRate(value) {
	return Math.round(normalizeRate(value) * 1000) / 1000;
}

function normalizePlanAssetClass(assetClass = '') {
	return PLAN_ASSET_ALIASES[assetClass] || assetClass || 'Multi-Family';
}

function average(values = []) {
	if (!values.length) return 0;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function moneyAnswer(value, { perYear = false, allowZero = false } = {}) {
	if (value === undefined || value === null || value === '') {
		return allowZero ? `${formatCompactMoney(0)}${perYear ? '/yr' : ''}` : 'Not answered';
	}
	return `${formatCompactMoney(value)}${perYear ? '/yr' : ''}`;
}

function listAnswer(values = [], mapper = (value) => value) {
	if (!Array.isArray(values) || !values.length) return 'Not answered';
	return values.map(mapper).join(', ');
}

function optionLabel(options = [], value) {
	const match = options.find((option) => option.value === value);
	return match?.label || value || 'Not answered';
}

export function averageDealYieldForAsset(assetClass, deals = []) {
	const normalizedAsset = normalizePlanAssetClass(assetClass);
	const rows = Array.isArray(deals) ? deals : [];
	const yields = [];

	for (const deal of rows) {
		if (deal?.isStale || deal?.status === 'Closed') continue;
		const rawYield = Number(deal?.cashOnCash || deal?.preferredReturn || 0);
		if (!(rawYield > 0 && rawYield < 1)) continue;

		const dealAsset = normalizePlanAssetClass(deal?.assetClass || deal?.asset_class || '');
		const strategy = String(deal?.strategy || '').toLowerCase();
		if (normalizedAsset === 'Lending') {
			if (strategy === 'lending' || dealAsset === 'Lending') yields.push(rawYield);
			continue;
		}
		if (dealAsset === normalizedAsset) yields.push(rawYield);
	}

	return roundRate(average(yields) || 0.08);
}

export function formatDollar(value) {
	const amount = Number(value || 0);
	return `$${amount.toLocaleString()}`;
}

export function formatCompactMoney(value) {
	const amount = parseDollar(value);
	if (!amount) return '$0';
	if (amount >= 1000000) return `$${(amount / 1000000).toFixed(amount % 1000000 === 0 ? 0 : 1)}M`;
	if (amount >= 1000) return `$${Math.round(amount / 1000).toLocaleString()}K`;
	return `$${amount.toLocaleString()}`;
}

export function formatRangeAmount(value) {
	if (!value) return '';
	return String(value)
		.replace(/\$/g, '$')
		.replace(/k/g, 'K')
		.replace(/m/g, 'M');
}

export function getBranchFlowKey(branch = 'cashflow') {
	return `paid_${branch}`;
}

export function flowKeyToBranch(flowKey = '') {
	const normalized = String(flowKey || '').toLowerCase();
	if (normalized === 'paid_growth') return 'growth';
	if (normalized === 'paid_tax') return 'tax';
	if (normalized === 'paid_cashflow') return 'cashflow';
	return '';
}

export function phaseForStep(step) {
	return STEP_TO_PHASE[step] ?? 0;
}

export function stageSlugForStep(step) {
	return STEP_TO_STAGE[step] || '';
}

export function stageSlugForPhase(sequence = [], phaseIndex = 0) {
	const step = (sequence || []).find((candidate) => phaseForStep(candidate) === phaseIndex);
	return step ? stageSlugForStep(step) : '';
}

export function normalizeWizardData(input = {}) {
	const next = { ...input };
	if (!next._branch && typeof next.branch === 'string') next._branch = next.branch;
	if (!next.branch && typeof next._branch === 'string') next.branch = next._branch;
	if (!next.goal && typeof next._branch === 'string') next.goal = next._branch;

	if (next.dealExperience === undefined && next.lpDealsCount !== undefined) next.dealExperience = next.lpDealsCount;
	if (next.lpDealsCount === undefined && next.dealExperience !== undefined) next.lpDealsCount = next.dealExperience;

	if (next.targetCashFlow === undefined && next.targetIncome !== undefined) next.targetCashFlow = next.targetIncome;
	if (next.targetIncome === undefined && next.targetCashFlow !== undefined) next.targetIncome = next.targetCashFlow;

	if (next.growthCapital === undefined && next.targetGrowth !== undefined) next.growthCapital = next.targetGrowth;
	if (next.targetGrowth === undefined && next.growthCapital !== undefined) next.targetGrowth = next.growthCapital;

	if (next.taxableIncome === undefined && next.targetTaxSavings !== undefined) next.taxableIncome = next.targetTaxSavings;
	if (next.targetTaxSavings === undefined && next.taxableIncome !== undefined) next.targetTaxSavings = next.taxableIncome;

	if (next.investableCapital === undefined && next.capital12mo !== undefined) next.investableCapital = next.capital12mo;
	if (next.capital12mo === undefined && next.investableCapital !== undefined) next.capital12mo = next.investableCapital;

	if (!Array.isArray(next.assetClasses)) next.assetClasses = Array.isArray(next.asset_classes) ? [...next.asset_classes] : [];
	if (!Array.isArray(next.strategies)) next.strategies = Array.isArray(next.dealTypes) ? [...next.dealTypes] : [];
	if (!Array.isArray(next.dealTypes)) next.dealTypes = [...next.strategies];
	if (!Array.isArray(next.accreditation) && next.accreditation) next.accreditation = [next.accreditation];
	if (!Array.isArray(next.accreditation)) next.accreditation = [];
	if (!Array.isArray(next.customPlanSlots) && Array.isArray(next.planSlots)) next.customPlanSlots = next.planSlots;
	if (!Array.isArray(next.customPlanSlots)) next.customPlanSlots = [];
	else next.customPlanSlots = next.customPlanSlots.map((slot) => ({ ...slot }));
	if (typeof next.sharePortfolio !== 'boolean') next.sharePortfolio = next.sharePortfolio === undefined ? true : Boolean(next.sharePortfolio);

	return next;
}

export function shouldSkipPrefilledStep(step, wizardData, { editing = false, forcedStage = false } = {}) {
	if (editing || forcedStage) return false;
	if (step === STEP.GOAL) return Boolean(wizardData._branch && wizardData.goal);
	if (step === STEP.EXPERIENCE) return wizardData.dealExperience !== undefined && wizardData.dealExperience !== null;
	if (step === STEP.BASELINE) return wizardData.baselineIncome !== undefined && wizardData.baselineIncome !== null && wizardData.baselineIncome !== '';
	return false;
}

export function isFreeFlowComplete(wizardData = {}) {
	const data = normalizeWizardData(wizardData);
	return Boolean(
		data._branch &&
		data.dealExperience !== undefined &&
		data.reProfessional &&
		data.baselineIncome !== undefined &&
		data.assetClasses.length > 0 &&
		data.strategies.length > 0 &&
		data.maxOperatorPct &&
		data.accreditation.length > 0
	);
}

export function isPaidFlowComplete(wizardData = {}) {
	const data = normalizeWizardData(wizardData);
	if (!isFreeFlowComplete(data)) return false;

	const common = Boolean(
		data.netWorth &&
		data.capital12mo &&
		data.triggerEvent &&
		data.capitalReadiness &&
		data.diversificationPref &&
		data.operatorFocus &&
		data.lockup &&
		data.distributions
	);
	if (!common) return false;

	if (data._branch === 'growth') {
		return Boolean(data.growthCapital && data.growthPriority && data.taxableIncomeBaseline);
	}
	if (data._branch === 'tax') {
		return Boolean(data.taxableIncome && data.taxableIncomeBaseline);
	}
	return Boolean(data.targetCashFlow);
}

export function hasCompletedPlan(wizardData = {}, portfolioPlan = null) {
	const data = normalizeWizardData(wizardData);
	if (data._completedAt) return true;
	if (Array.isArray(portfolioPlan?.slots) && portfolioPlan.slots.length > 0) return true;
	if (Array.isArray(portfolioPlan?.buckets) && portfolioPlan.buckets.length > 0) return true;
	return isPaidFlowComplete(data);
}

export function hasSavedWizardProgress(wizardData = {}, portfolioPlan = null) {
	const data = normalizeWizardData(wizardData);
	if (hasCompletedPlan(data, portfolioPlan)) return true;
	return Boolean(
		data._branch ||
		data.goal ||
		(data.dealExperience !== undefined && data.dealExperience !== null && data.dealExperience !== '') ||
		data.reProfessional ||
		(data.baselineIncome !== undefined && data.baselineIncome !== null && data.baselineIncome !== '') ||
		data.assetClasses.length > 0 ||
		data.strategies.length > 0 ||
		data.maxOperatorPct ||
		data.accreditation.length > 0 ||
		parseDollar(data.targetCashFlow) > 0 ||
		parseDollar(data.growthCapital) > 0 ||
		parseDollar(data.taxableIncome) > 0 ||
		parseDollar(data.taxableIncomeBaseline) > 0 ||
		parseDollar(data.netWorth) > 0 ||
		data.capital12mo ||
		data.triggerEvent ||
		data.capitalReadiness ||
		data.diversificationPref ||
		data.operatorFocus ||
		data.lockup ||
		data.distributions
	);
}

export function getStepSequence(wizardData = {}, { editing = false, includePaidFlow = false } = {}) {
	const data = normalizeWizardData(wizardData);
	const branch = data._branch || 'cashflow';
	const paidKey = getBranchFlowKey(branch);

	if (includePaidFlow) {
		return [
			...STEP_SEQUENCE.free,
			...(STEP_SEQUENCE[paidKey] || STEP_SEQUENCE.paid_cashflow)
		];
	}
	if (!isFreeFlowComplete(data)) {
		return [...STEP_SEQUENCE.free];
	}
	if (editing) {
		return [
			STEP.GOAL,
			STEP.EXPERIENCE,
			STEP.RE_PRO,
			STEP.BASELINE,
			STEP.ASSETS,
			STEP.STRATEGIES,
			STEP.RISK,
			STEP.ACCREDITATION,
			...(STEP_SEQUENCE[paidKey] || STEP_SEQUENCE.paid_cashflow)
		];
	}
	return [...(STEP_SEQUENCE[paidKey] || STEP_SEQUENCE.paid_cashflow)];
}

export function stepIndexForStage(sequence, stageSlug) {
	const step = STAGE_QUERY_MAP[String(stageSlug || '').toLowerCase()];
	if (!step) return -1;
	return sequence.indexOf(step);
}

export function applyGoalDefaults(wizardData = {}, branch) {
	const next = normalizeWizardData(wizardData);
	next._branch = branch;
	next.branch = branch;
	next.goal = GOAL_CARDS.find((card) => card.branch === branch)?.goalValue || branch;

	if (!next.assetClasses.length) {
		if (branch === 'tax') next.assetClasses = ['Multi-Family', 'Oil & Gas / Energy', 'RV/Mobile Home Parks'];
		else next.assetClasses = ['Multi-Family', 'Self Storage', 'Industrial'];
	}
	if (!next.strategies.length) {
		if (branch === 'cashflow') next.strategies = ['Lending', 'Buy & Hold'];
		else if (branch === 'growth') next.strategies = ['Value-Add', 'Distressed'];
		else next.strategies = ['Value-Add', 'Development'];
	}
	next.dealTypes = [...next.strategies];
	if (branch === 'cashflow' && !next.distributions) next.distributions = 'Monthly';
	return next;
}

export function branchGoalType(branch) {
	if (branch === 'tax') return 'reduce_taxes';
	if (branch === 'growth') return 'build_wealth';
	return 'passive_income';
}

export function wizardToGoalsPayload(wizardData = {}) {
	const data = normalizeWizardData(wizardData);
	return {
		goal_type: branchGoalType(data._branch || 'cashflow'),
		current_income: Number(data.baselineIncome || 0),
		target_income: Number(data._branch === 'growth' ? data.growthCapital || 0 : data.targetCashFlow || 0),
		capital_available: data.capital12mo || '',
		timeline: data.capitalReadiness || '',
		tax_reduction: Number(data._branch === 'tax' ? data.taxableIncome || 0 : 0)
	};
}

export function wizardToBuyBoxPayload(wizardData = {}, { markComplete = false } = {}) {
	const data = normalizeWizardData(wizardData);
	const payload = {
		...data,
		lpDealsCount: data.dealExperience ?? data.lpDealsCount ?? 0,
		dealExperience: data.dealExperience ?? data.lpDealsCount ?? 0,
		assetClasses: [...data.assetClasses],
		strategies: [...data.strategies],
		dealTypes: [...data.dealTypes]
	};
	if (markComplete) payload._markComplete = true;
	return payload;
}

export function planHeroCopy(wizardData = {}, plan = null) {
	const data = normalizeWizardData(wizardData);
	const target = data._branch === 'growth' ? parseDollar(data.growthCapital) : data._branch === 'tax' ? parseDollar(data.taxableIncome) : parseDollar(data.targetCashFlow);
	if (data._branch === 'growth') {
		return {
			title: `Here's your plan to reach ${formatCompactMoney(target || data.growthCapital || 500000)} in 5 years`,
			description: 'Built around the asset classes, operator profile, and time horizon you selected.'
		};
	}
	if (data._branch === 'tax') {
		return {
			title: `Here's your plan to shelter ${formatCompactMoney(target || data.taxableIncome || 100000)}`,
			description: 'Sized for your income, depreciation appetite, and lockup tolerance.'
		};
	}
	return {
		title: `Here's your plan to reach ${formatCompactMoney(target || data.targetCashFlow || 100000)}/yr`,
		description: 'Built from your capital, timing, asset preferences, and payout expectations.'
	};
}

function buildPlanMeta(wizardData = {}, deals = []) {
	const data = normalizeWizardData(wizardData);
	const branch = data._branch || 'cashflow';
	const totalCapital = parseDollar(data.capital12mo) || parseDollar(data.growthCapital) || parseDollar(data.investableCapital) || 500000;
	const defaultCheckSize = parseDollar(data.checkSize) || 100000;
	const globalTargetYield = normalizeRate(data.planTargetYieldPct);
	const rawAssets = Array.isArray(data.assetClasses) ? data.assetClasses : [];
	const currentYear = new Date().getFullYear();

	let targetIncome = 0;
	if (branch === 'cashflow') targetIncome = parseDollar(data.targetCashFlow) || 100000;
	else if (branch === 'growth') targetIncome = parseDollar(data.growthCapital) || Math.round(totalCapital * 0.15);
	else targetIncome = parseDollar(data.taxableIncome) || 100000;

	let sourceAssets = rawAssets.map((asset) => normalizePlanAssetClass(asset)).filter(Boolean);
	if (!sourceAssets.length) sourceAssets = ['Multi-Family'];

	return {
		data,
		branch,
		totalCapital,
		defaultCheckSize,
		targetIncome,
		sourceAssets,
		currentYear,
		defaultDealsPerYear: Math.max(1, Math.min(4, Math.floor(totalCapital / Math.max(defaultCheckSize, 1) / 3) || 1)),
		avgCocFor(assetClass) {
			if (globalTargetYield > 0) return roundRate(globalTargetYield);
			return averageDealYieldForAsset(assetClass, deals);
		}
	};
}

function slotStrategyForAsset(assetClass, branch) {
	if (assetClass === 'Lending') return 'Lending';
	if (branch === 'growth') return 'Value-Add';
	if (branch === 'tax') return 'Development';
	return 'Income';
}

function buildPlanFromSlots(meta, slots = [], generatedFrom = 'wizard_custom') {
	const normalizedSlots = slots.map((slot, index) => {
		const assetClass = normalizePlanAssetClass(slot?.asset_class || slot?.assetClass || meta.sourceAssets[index % meta.sourceAssets.length]);
		const targetCoc = roundRate(slot?.target_coc ?? slot?.targetCoC ?? slot?.targetYield ?? slot?.yield) || meta.avgCocFor(assetClass);
		const checkSize = parseDollar(slot?.check_size ?? slot?.checkSize ?? meta.defaultCheckSize);
		const year = Number(slot?.year) || meta.currentYear + Math.floor(index / meta.defaultDealsPerYear);

		return {
			id: Number(slot?.id) || index + 1,
			asset_class: assetClass,
			strategy: slot?.strategy || slotStrategyForAsset(assetClass, meta.branch),
			check_size: checkSize,
			target_coc: targetCoc,
			est_income: Math.round(checkSize * targetCoc),
			year,
			filled_by: slot?.filled_by ?? slot?.filledBy ?? null,
			filled_name: slot?.filled_name ?? slot?.filledName ?? null
		};
	});

	const totalCapital = normalizedSlots.length ? normalizedSlots.reduce((sum, slot) => sum + slot.check_size, 0) : meta.totalCapital;
	const averageCheckSize = normalizedSlots.length ? Math.round(totalCapital / normalizedSlots.length) : meta.defaultCheckSize;
	const yearCounts = normalizedSlots.reduce((counts, slot) => {
		counts[slot.year] = (counts[slot.year] || 0) + 1;
		return counts;
	}, {});
	const dealsPerYear = Math.max(1, ...Object.values(yearCounts), meta.defaultDealsPerYear);

	return {
		target_income: meta.targetIncome,
		total_capital: totalCapital,
		check_size: averageCheckSize,
		deals_per_year: dealsPerYear,
		blended_coc: normalizedSlots.length ? Math.round(average(normalizedSlots.map((slot) => slot.target_coc)) * 100) / 100 : meta.avgCocFor(meta.sourceAssets[0]),
		slots: normalizedSlots,
		buckets: normalizedSlots,
		generated_from: generatedFrom
	};
}

export function generatePortfolioPlan(wizardData = {}, deals = []) {
	const meta = buildPlanMeta(wizardData, deals);
	const data = meta.data;
	if (Array.isArray(data.customPlanSlots) && data.customPlanSlots.length > 0) {
		return buildPlanFromSlots(meta, data.customPlanSlots, 'wizard_custom');
	}

	const slots = [];
	let runningIncome = 0;
	let slotId = 1;
	const maxSlots = Math.max(Math.ceil(meta.totalCapital / Math.max(meta.defaultCheckSize, 1)), 20);
	let assetIndex = 0;

	while (runningIncome < meta.targetIncome && slots.length < maxSlots) {
		const assetClass = meta.sourceAssets[assetIndex % meta.sourceAssets.length];
		const targetCoc = meta.avgCocFor(assetClass);
		const checkSize = meta.defaultCheckSize;
		slots.push({
			id: slotId,
			asset_class: assetClass,
			strategy: slotStrategyForAsset(assetClass, meta.branch),
			check_size: checkSize,
			target_coc: targetCoc,
			est_income: Math.round(checkSize * targetCoc),
			year: meta.currentYear + Math.floor(slots.length / meta.defaultDealsPerYear),
			filled_by: null,
			filled_name: null
		});
		runningIncome += Math.round(checkSize * targetCoc);
		slotId += 1;
		assetIndex += 1;
	}

	return buildPlanFromSlots(meta, slots, 'wizard');
}

export function wizardSummaryRows(wizardData = {}) {
	const data = normalizeWizardData(wizardData);
	const branchLabel = data._branch === 'growth' ? 'Equity Growth' : data._branch === 'tax' ? 'Tax Optimization' : 'Cash Flow';
	const riskLabels = {
		'10': 'Very conservative',
		'20': 'Moderate',
		'33': 'Concentrated',
		'50': 'High conviction',
		no_limit: 'No limit'
	};

	const rows = [
		{ step: STEP.GOAL, label: 'Primary Goal', value: branchLabel },
		{ step: STEP.EXPERIENCE, label: 'Passive Investments', value: data.dealExperience ?? data.lpDealsCount ?? 'Not answered' },
		{ step: STEP.RE_PRO, label: 'Real Estate Professional', value: optionLabel(RE_PRO_OPTIONS, data.reProfessional) },
		{ step: STEP.BASELINE, label: 'Current Income', value: moneyAnswer(data.baselineIncome, { perYear: true, allowZero: true }) },
		{ step: STEP.ASSETS, label: 'Asset Classes', value: listAnswer(data.assetClasses) },
		{ step: STEP.STRATEGIES, label: 'Strategies', value: listAnswer(data.strategies, (value) => STRATEGY_OPTIONS[value]?.label || value) },
		{ step: STEP.RISK, label: 'Risk Tolerance', value: riskLabels[data.maxOperatorPct] || 'Not answered' },
		{
			step: STEP.ACCREDITATION,
			label: 'Accreditation',
			value: listAnswer(data.accreditation, (value) => ACCREDITATION_OPTIONS.find((option) => option.value === value)?.label || value)
		}
	];

	if (data._branch === 'cashflow') {
		rows.push({ step: STEP.CF_TARGET, label: '12-Month Target', value: moneyAnswer(data.targetCashFlow, { perYear: true }) });
	}
	if (data._branch === 'growth') {
		rows.push(
			{ step: STEP.GROWTH_TARGET, label: 'Growth Target', value: moneyAnswer(data.growthCapital) },
			{ step: STEP.GROWTH_PRIORITY, label: 'Growth Priority', value: optionLabel(GROWTH_PRIORITY_OPTIONS, data.growthPriority) }
		);
	}
	if (data._branch === 'tax') {
		rows.push({ step: STEP.TAX_TARGET, label: 'Shelter Target', value: moneyAnswer(data.taxableIncome) });
	}

	rows.push({ step: STEP.NET_WORTH, label: 'Net Worth', value: moneyAnswer(data.netWorth) });

	if (data._branch === 'growth' || data._branch === 'tax') {
		rows.push({ step: STEP.TAX_BASELINE, label: 'Pre-Tax Income', value: moneyAnswer(data.taxableIncomeBaseline, { perYear: true }) });
	}

	rows.push(
		{ step: STEP.CAPITAL, label: '12-Month Capital', value: optionLabel(CAPITAL_OPTIONS, data.capital12mo) },
		{ step: STEP.SOURCE, label: 'Capital Source', value: optionLabel(SOURCE_OPTIONS, data.triggerEvent) },
		{ step: STEP.READINESS, label: 'Capital Ready In', value: optionLabel(READINESS_OPTIONS, data.capitalReadiness) },
		{ step: STEP.DIVERSIFICATION, label: 'Diversification', value: optionLabel(DIVERSIFICATION_OPTIONS, data.diversificationPref) },
		{ step: STEP.OPERATOR_FOCUS, label: 'Operator Focus', value: optionLabel(OPERATOR_FOCUS_OPTIONS, data.operatorFocus) },
		{ step: STEP.LOCKUP, label: 'Lockup', value: optionLabel(LOCKUP_OPTIONS, data.lockup) },
		{ step: STEP.DISTRIBUTIONS, label: 'Distributions', value: optionLabel(DISTRIBUTION_OPTIONS, data.distributions) },
		{ step: STEP.LP_NETWORK, label: 'LP Network Opt-In', value: data.sharePortfolio === true ? 'Yes' : 'No' }
	);

	return rows;
}
