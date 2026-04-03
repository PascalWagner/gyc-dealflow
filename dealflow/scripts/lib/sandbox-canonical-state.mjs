import { transformDeals } from '../../api/member/deals/transform.js';

const GOAL_LABEL_TO_TYPE = {
	'cash flow (income now)': 'passive_income',
	'equity growth (wealth later)': 'build_wealth',
	'tax optimization (tax shield now)': 'reduce_taxes'
};

const GOAL_LABEL_TO_BRANCH = {
	'cash flow (income now)': 'cashflow',
	'equity growth (wealth later)': 'growth',
	'tax optimization (tax shield now)': 'tax'
};

const GHL_GOALS_FIELD_MATCHERS = {
	goal_type: ['contact.primary_investment_objective'],
	current_income: ['contact.current_passive_income'],
	target_income: ['contact.target_passive_income'],
	capital_available: ['contact.capital_12_month'],
	timeline: ['contact.investment_timeline'],
	tax_reduction: ['contact.tax_offset_target']
};

const GHL_WIZARD_FIELD_MATCHERS = {
	triggerEvent: ['contact.investment_trigger_event', 'contact.where_is_the_money_coming_from'],
	netWorth: ['contact.networth'],
	assetClasses: ['contact.asset_class_preference'],
	lockup: ['contact.lockup_period_tolerance'],
	strategies: ['contact.strategy_preference'],
	distributions: ['contact.distribution_frequency_options'],
	accreditation: ['contact.accreditation_type'],
	goal: ['contact.primary_investment_objective'],
	branch: ['contact.onboarding_branch'],
	incomeStructure: ['contact.income_source_type'],
	reProfessional: ['contact.real_estate_professional_status', 'contact.re_professional_status'],
	baselineIncome: ['contact.current_passive_income'],
	targetCashFlow: ['contact.target_passive_income'],
	taxableIncome: ['contact.tax_offset_target'],
	taxableIncomeBaseline: ['contact.annual_taxable_income'],
	growthPriority: ['contact.growth_investment_priority'],
	capital12mo: ['contact.capital_12_month'],
	capital90Day: ['contact.capital_90_day'],
	capitalReadiness: ['contact.investment_timeline'],
	maxLossPct: ['contact.max_loss_tolerance'],
	operatorFocus: ['contact.operator_focus_preference', 'contact.firm_focus_preference', 'contact.operator_strategy_preference'],
	sharePortfolio: ['contact.lp_network_optin'],
	diversificationPref: ['contact.diversification_preference'],
	lpDealsCount: ['contact.lp_deals_count']
};

function normalizeString(value) {
	return String(value || '').trim();
}

function normalizeMatcher(value) {
	return normalizeString(value).toLowerCase();
}

function normalizeFieldValue(value) {
	if (Array.isArray(value)) return value.map((entry) => normalizeFieldValue(entry)).filter((entry) => entry !== '');
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value.trim();
	return value;
}

export function hasMeaningfulValue(value) {
	if (Array.isArray(value)) return value.some((entry) => hasMeaningfulValue(entry));
	if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
	if (typeof value === 'boolean') return true;
	return normalizeString(value) !== '';
}

export function readHydratedField(contact, matchers = []) {
	const normalizedMatchers = (Array.isArray(matchers) ? matchers : [matchers])
		.map((entry) => normalizeMatcher(entry))
		.filter(Boolean);
	if (normalizedMatchers.length === 0) return '';

	const hydratedFields = Array.isArray(contact?.customFieldsHydrated)
		? contact.customFieldsHydrated
		: Array.isArray(contact?.customFields)
			? contact.customFields
			: Array.isArray(contact?.customField)
				? contact.customField
				: [];

	const match = hydratedFields.find((entry) =>
		normalizedMatchers.includes(normalizeMatcher(entry?.fieldKey))
		|| normalizedMatchers.includes(normalizeMatcher(entry?.name))
		|| normalizedMatchers.includes(normalizeMatcher(entry?.id))
	);

	return normalizeFieldValue(match?.value);
}

function rangeToCapital(label) {
	const normalized = normalizeString(label).toLowerCase();
	if (!normalized) return 0;

	const ranges = {
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
		'$1m+': 2000000
	};

	return ranges[normalized] || Number(label) || 0;
}

function normalizeWizardValue(key, value) {
	if (Array.isArray(value)) return [...new Set(value.flatMap((entry) => normalizeWizardValue(key, entry)))].filter(Boolean);
	const normalized = normalizeFieldValue(value);
	if (key === 'lpDealsCount') {
		return Number(normalized || 0);
	}
	if (key === 'accreditation' && Array.isArray(normalized)) {
		return normalized.length === 1 ? normalized[0] : normalized;
	}
	return normalized;
}

function normalizeGoalBranch(wizardBuyBox = {}) {
	const next = { ...wizardBuyBox };
	const branch = normalizeString(next._branch || next.branch).toLowerCase();
	const goal = normalizeString(next.goal).toLowerCase();
	const resolvedBranch = branch || GOAL_LABEL_TO_BRANCH[goal] || '';

	if (resolvedBranch) {
		next._branch = resolvedBranch;
		next.branch = resolvedBranch;
		next.goal = next.goal || Object.keys(GOAL_LABEL_TO_BRANCH).find((label) => GOAL_LABEL_TO_BRANCH[label] === resolvedBranch) || resolvedBranch;
	}

	return next;
}

export function buildCanonicalGoalsFromContact(contact) {
	const goalType = readHydratedField(contact, GHL_GOALS_FIELD_MATCHERS.goal_type);
	const currentIncome = readHydratedField(contact, GHL_GOALS_FIELD_MATCHERS.current_income);
	const targetIncome = readHydratedField(contact, GHL_GOALS_FIELD_MATCHERS.target_income);
	const capitalAvailable = readHydratedField(contact, GHL_GOALS_FIELD_MATCHERS.capital_available);
	const timeline = readHydratedField(contact, GHL_GOALS_FIELD_MATCHERS.timeline);
	const taxReduction = readHydratedField(contact, GHL_GOALS_FIELD_MATCHERS.tax_reduction);

	if (![currentIncome, targetIncome, capitalAvailable, timeline, taxReduction].some(hasMeaningfulValue)) {
		return null;
	}

	return {
		goal_type: GOAL_LABEL_TO_TYPE[normalizeString(goalType).toLowerCase()] || normalizeString(goalType) || 'passive_income',
		current_income: Number(currentIncome || 0),
		target_income: Number(targetIncome || 0),
		capital_available: rangeToCapital(capitalAvailable),
		timeline: normalizeString(timeline || '5'),
		tax_reduction: Number(taxReduction || 0)
	};
}

export function buildCanonicalBuyBoxFromContact(contact) {
	const wizardBuyBox = {};

	for (const [wizardKey, matchers] of Object.entries(GHL_WIZARD_FIELD_MATCHERS)) {
		const value = readHydratedField(contact, matchers);
		if (!hasMeaningfulValue(value)) continue;
		wizardBuyBox[wizardKey] = normalizeWizardValue(wizardKey, value);
	}

	if (wizardBuyBox.lpDealsCount !== undefined && wizardBuyBox.dealExperience === undefined) {
		wizardBuyBox.dealExperience = Number(wizardBuyBox.lpDealsCount || 0);
	}

	const tags = new Set((contact?.tags || []).map((tag) => normalizeString(tag).toLowerCase()));
	if (!wizardBuyBox._completedAt && (tags.has('wizard-complete') || tags.has('buy-box-complete') || tags.has('buy box complete'))) {
		wizardBuyBox._completedAt = contact?.dateUpdated || contact?.dateAdded || new Date().toISOString();
	}

	return normalizeGoalBranch(wizardBuyBox);
}

export function buildCanonicalDealBackfill(deal) {
	const normalized = transformDeals([deal], [], [])?.[0] || {};

	return {
		...normalized,
		legacyApprovedReviewCompat:
			String(normalized.lifecycleStatus || deal?.lifecycle_status || '').trim().toLowerCase() === 'approved'
				&& String(normalized.dealBranch || deal?.deal_branch || '').trim().toLowerCase() === 'lending_fund'
	};
}

export function pickPersistableFields(source = {}, allowedKeys = []) {
	const allowed = new Set(allowedKeys);
	return Object.fromEntries(
		Object.entries(source).filter(([key, value]) => allowed.has(key) && value !== undefined)
	);
}
