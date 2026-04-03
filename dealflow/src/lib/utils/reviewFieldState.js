import { dealFieldConfig } from './dealReviewSchema.js';

const HISTORICAL_RETURN_START_YEAR = 2015;
const HISTORICAL_RETURN_END_YEAR = new Date().getFullYear() - 1;

export const HISTORICAL_RETURN_YEARS = Array.from(
	{ length: Math.max(0, HISTORICAL_RETURN_END_YEAR - HISTORICAL_RETURN_START_YEAR + 1) },
	(_, index) => HISTORICAL_RETURN_START_YEAR + index
);

export const REVIEW_FIELD_DB_COLUMN_MAP = {
	investmentName: 'investment_name',
	managementCompanyId: 'management_company_id',
	assetClass: 'asset_class',
	dealType: 'deal_type',
	strategy: 'strategy',
	investmentStrategy: 'investment_strategy',
	targetIRR: 'target_irr',
	preferredReturn: 'preferred_return',
	cashOnCash: 'cash_on_cash',
	cashYield: 'cash_yield',
	equityMultiple: 'equity_multiple',
	investmentMinimum: 'investment_minimum',
	holdPeriod: 'hold_period_years',
	offeringSize: 'offering_size',
	purchasePrice: 'purchase_price',
	offeringType: 'offering_type',
	availableTo: 'available_to',
	distributions: 'distributions',
	lpGpSplit: 'lp_gp_split',
	fees: 'fees',
	financials: 'financials',
	instrument: 'instrument',
	shortSummary: 'short_summary',
	coverImageUrl: 'cover_image_url',
	heroMediaUrl: 'hero_media_url',
	riskNotes: 'risk_notes',
	downsideNotes: 'downside_notes',
	deckUrl: 'deck_url',
	ppmUrl: 'ppm_url',
	subAgreementUrl: 'sub_agreement_url',
	feeSummary: 'fee_summary',
	taxCharacteristics: 'tax_characteristics',
	operatorBackground: 'operator_background',
	keyDates: 'key_dates',
	primarySourceContext: 'primary_source_context',
	primarySourceUrl: 'primary_source_url',
	sponsorName: 'sponsor_name',
	slug: 'slug',
	investingGeography: 'investing_geography',
	investingStates: 'investing_states',
	underlyingExposureTypes: 'underlying_exposure_types',
	debtPosition: 'debt_position',
	fundAUM: 'fund_aum',
	managerAUM: 'fund_aum',
	currentFundSize: 'current_fund_size',
	loanCount: 'loan_count',
	avgLoanLtv: 'avg_loan_ltv',
	currentAvgLoanLtv: 'current_avg_loan_ltv',
	maxAllowedLtv: 'max_allowed_ltv',
	currentLeverage: 'current_leverage',
	maxAllowedLeverage: 'max_allowed_leverage',
	redemption: 'redemption',
	redemptionNotes: 'redemption_notes',
	additionalTermNotes: 'additional_term_notes',
	sponsorCoinvest: 'sponsor_in_deal_pct',
	sponsorInDeal: 'sponsor_in_deal_pct',
	taxForm: 'tax_form',
	fundFoundedYear: 'fund_founded_year',
	firmFoundedYear: 'firm_founded_year',
	snapshotAsOfDate: 'snapshot_as_of_date',
	propertyAddress: 'property_address',
	unitCount: 'unit_count',
	yearBuilt: 'year_built',
	squareFootage: 'square_footage',
	occupancyPct: 'occupancy_pct',
	propertyType: 'property_type',
	acquisitionLoan: 'acquisition_loan',
	loanToValue: 'loan_to_value',
	loanRate: 'loan_rate',
	loanTermYears: 'loan_term_years',
	loanIOYears: 'loan_io_years',
	capexBudget: 'capex_budget',
	closingCosts: 'closing_costs',
	acquisitionFeePct: 'acquisition_fee_pct',
	assetMgmtFeePct: 'asset_mgmt_fee_pct',
	propertyMgmtFeePct: 'property_mgmt_fee_pct',
	capitalEventFeePct: 'capital_event_fee_pct',
	dispositionFeePct: 'disposition_fee_pct',
	constructionMgmtFeePct: 'construction_mgmt_fee_pct',
	tags: 'tags',
	issuerEntity: 'issuer_entity',
	gpEntity: 'gp_entity',
	sponsorEntity: 'sponsor_entity',
	secEntityName: 'sec_entity_name',
	secCik: 'sec_cik',
	dateOfFirstSale: 'date_of_first_sale',
	totalAmountSold: 'total_amount_sold',
	totalInvestors: 'total_investors',
	is506b: 'is_506b',
	secVerificationState: 'sec_verification_state',
	secVerificationNotes: 'sec_verification_notes',
	secLookupState: 'sec_lookup_state',
	secFilingId: 'sec_filing_id',
	dealBranch: 'deal_branch',
	teamContacts: 'team_contacts',
	sourceRiskFactors: 'source_risk_factors',
	highlightedRisks: 'highlighted_risks',
	riskTags: 'risk_tags',
	status: 'status'
};

for (const year of HISTORICAL_RETURN_YEARS) {
	REVIEW_FIELD_DB_COLUMN_MAP[`historicalReturn${year}`] = `historical_return_${year}`;
}

export const DB_COLUMN_REVIEW_FIELD_MAP = Object.entries(REVIEW_FIELD_DB_COLUMN_MAP).reduce(
	(result, [fieldKey, columnName]) => {
		if (!result[columnName]) {
			result[columnName] = fieldKey;
		}
		return result;
	},
	{}
);

function hasOwn(value, key) {
	return Object.prototype.hasOwnProperty.call(value || {}, key);
}

function normalizeString(value) {
	return String(value || '').trim();
}

export function getReviewFieldDbColumn(fieldKey = '') {
	return REVIEW_FIELD_DB_COLUMN_MAP[fieldKey] || '';
}

export function getReviewFieldKeyForColumn(columnName = '') {
	return DB_COLUMN_REVIEW_FIELD_MAP[columnName] || '';
}

export function getReviewFieldLabel(fieldKey = '') {
	return dealFieldConfig[fieldKey]?.label || fieldKey;
}

export function isReviewFieldKey(fieldKey = '') {
	return Boolean(getReviewFieldDbColumn(fieldKey));
}

export function normalizeReviewFieldStateEntry(entry = {}) {
	return {
		aiValue: hasOwn(entry, 'aiValue') ? entry.aiValue : null,
		aiValuePresent: entry?.aiValuePresent === true || hasOwn(entry, 'aiValue'),
		adminOverrideActive: entry?.adminOverrideActive === true,
		adminOverrideValue: hasOwn(entry, 'adminOverrideValue') ? entry.adminOverrideValue : null,
		finalValue: hasOwn(entry, 'finalValue') ? entry.finalValue : null,
		finalValuePresent: entry?.finalValuePresent === true || hasOwn(entry, 'finalValue'),
		lastWriter: normalizeString(entry?.lastWriter || ''),
		lastAction: normalizeString(entry?.lastAction || ''),
		aiUpdatedAt: normalizeString(entry?.aiUpdatedAt || ''),
		adminEditedAt: normalizeString(entry?.adminEditedAt || ''),
		lastUpdatedAt: normalizeString(entry?.lastUpdatedAt || ''),
		adminActorEmail: normalizeString(entry?.adminActorEmail || ''),
		adminActorName: normalizeString(entry?.adminActorName || ''),
		aiSource: normalizeString(entry?.aiSource || '')
	};
}

export function normalizeReviewFieldStateMap(value = {}) {
	const raw = value && typeof value === 'object' ? value : {};
	return Object.fromEntries(
		Object.entries(raw)
			.filter(([fieldKey]) => Boolean(fieldKey))
			.map(([fieldKey, entry]) => [fieldKey, normalizeReviewFieldStateEntry(entry)])
	);
}

export function hasActiveAdminOverride(entry = {}) {
	return normalizeReviewFieldStateEntry(entry).adminOverrideActive;
}

export function resolveFinalReviewFieldValue(entry = {}, fallbackValue) {
	const normalized = normalizeReviewFieldStateEntry(entry);
	if (normalized.adminOverrideActive) {
		return normalized.adminOverrideValue;
	}
	if (normalized.aiValuePresent) {
		return normalized.aiValue;
	}
	if (normalized.finalValuePresent) {
		return normalized.finalValue;
	}
	return fallbackValue;
}

export function applyReviewFieldStateToDeal(deal = {}) {
	const reviewFieldState = normalizeReviewFieldStateMap(
		deal?.review_field_state || deal?.reviewFieldState || {}
	);
	const nextDeal = {
		...deal,
		review_field_state: reviewFieldState,
		reviewFieldState: reviewFieldState
	};

	for (const [fieldKey, entry] of Object.entries(reviewFieldState)) {
		const columnName = getReviewFieldDbColumn(fieldKey);
		if (!columnName) continue;
		const resolvedValue = resolveFinalReviewFieldValue(entry, deal?.[columnName]);
		nextDeal[columnName] = resolvedValue;
		nextDeal[fieldKey] = resolvedValue;
	}

	return nextDeal;
}

export function buildAdminReviewFieldStateEntry(
	existingEntry = {},
	{
		nextValue,
		fallbackValue,
		actor = {},
		at = new Date().toISOString()
	} = {}
) {
	const normalized = normalizeReviewFieldStateEntry(existingEntry);
	const nextEntry = {
		...normalized,
		adminOverrideActive: true,
		adminOverrideValue: nextValue,
		finalValue: nextValue,
		finalValuePresent: true,
		lastWriter: 'admin',
		lastAction: 'admin_save',
		adminEditedAt: at,
		lastUpdatedAt: at,
		adminActorEmail: normalizeString(actor?.email || ''),
		adminActorName: normalizeString(actor?.name || '')
	};

	if (!normalized.aiValuePresent && fallbackValue !== undefined) {
		nextEntry.aiValue = fallbackValue;
		nextEntry.aiValuePresent = true;
	}

	return nextEntry;
}

export function buildAiReviewFieldStateEntry(
	existingEntry = {},
	{
		nextValue,
		overwriteAdmin = false,
		source = 'ai_extraction',
		at = new Date().toISOString()
	} = {}
) {
	const normalized = normalizeReviewFieldStateEntry(existingEntry);
	const nextEntry = {
		...normalized,
		aiValue: nextValue,
		aiValuePresent: true,
		aiUpdatedAt: at,
		lastUpdatedAt: at,
		aiSource: normalizeString(source)
	};

	if (overwriteAdmin) {
		nextEntry.adminOverrideActive = false;
		nextEntry.adminOverrideValue = null;
		nextEntry.finalValue = nextValue;
		nextEntry.finalValuePresent = true;
		nextEntry.lastWriter = 'ai';
		nextEntry.lastAction = normalized.adminOverrideActive ? 'ai_overwrite_admin' : 'ai_apply';
		return nextEntry;
	}

	nextEntry.finalValue = normalized.adminOverrideActive ? normalized.adminOverrideValue : nextValue;
	nextEntry.finalValuePresent = true;
	nextEntry.lastWriter = normalized.adminOverrideActive ? (normalized.lastWriter || 'admin') : 'ai';
	nextEntry.lastAction = normalized.adminOverrideActive ? 'ai_update_blocked_by_admin' : 'ai_apply';
	return nextEntry;
}

export function clearAdminOverrideReviewFieldStateEntry(
	existingEntry = {},
	{
		fallbackValue,
		at = new Date().toISOString()
	} = {}
) {
	const normalized = normalizeReviewFieldStateEntry(existingEntry);
	const finalValue = normalized.aiValuePresent ? normalized.aiValue : fallbackValue;

	return {
		...normalized,
		adminOverrideActive: false,
		adminOverrideValue: null,
		finalValue,
		finalValuePresent: normalized.aiValuePresent || fallbackValue !== undefined,
		lastWriter: normalized.aiValuePresent ? 'ai' : 'system',
		lastAction: 'reset_to_ai',
		lastUpdatedAt: at
	};
}
