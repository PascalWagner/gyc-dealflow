import { getDealOperatorName } from './dealSponsors.js';

export const DEAL_LIFECYCLE_STATUSES = ['draft', 'in_review', 'approved', 'published', 'archived'];

export const DEAL_LIFECYCLE_LABELS = {
	draft: 'Draft',
	in_review: 'In Review',
	approved: 'Approved',
	published: 'Published',
	archived: 'Archived'
};

export const DEAL_LIFECYCLE_SORT_ORDER = {
	draft: 0,
	in_review: 1,
	approved: 2,
	published: 3,
	archived: 4
};

const REQUIRED_FIELD_WEIGHT = 70;
const RECOMMENDED_FIELD_WEIGHT = 30;

function normalizeToken(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function readPath(record, path) {
	if (!record || !path) return undefined;
	return String(path)
		.split('.')
		.reduce((current, key) => (current === null || current === undefined ? undefined : current[key]), record);
}

function hasMeaningfulValue(value, { allowZero = false } = {}) {
	if (value === null || value === undefined) return false;
	if (typeof value === 'boolean') return true;
	if (typeof value === 'number') return Number.isFinite(value) && (allowZero || value !== 0);
	if (Array.isArray(value)) return value.some((item) => hasMeaningfulValue(item, { allowZero: true }));
	if (typeof value === 'object') return Object.keys(value).length > 0;
	if (typeof value === 'string') return value.trim().length > 0;
	return Boolean(value);
}

function firstMeaningfulValue(record, aliases, options = {}) {
	for (const alias of aliases || []) {
		const value = readPath(record, alias);
		if (hasMeaningfulValue(value, options)) {
			return value;
		}
	}
	return null;
}

function hasAnyMeaningfulValue(record, aliasGroups, options = {}) {
	return (aliasGroups || []).some((aliases) => hasMeaningfulValue(firstMeaningfulValue(record, aliases, options), options));
}

export function slugify(value = '') {
	return String(value || '')
		.normalize('NFKD')
		replace(/[\u0300-\u036f]/g, '')
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

export function normalizeLifecycleStatus(value, fallback = 'draft') {
	const normalized = normalizeToken(value);
	if (DEAL_LIFECYCLE_STATUSES.includes(normalized)) return normalized;
	if (normalized === 'inreview') return 'in_review';
	if (normalized === 'active' || normalized === 'live') return 'published';
	if (normalized === 'review') return 'in_review';
	return DEAL_LIFECYCLE_STATUSES.includes(normalizeToken(fallback)) ? normalizeToken(fallback) : 'draft';
}

export function resolveDealLifecycleStatus(deal) {
	const explicit = normalizeToken(firstMeaningfulValue(deal, ['lifecycle_status', 'lifecycleStatus']));
	if (DEAL_LIFECYCLE_STATUSES.includes(explicit)) {
		return explicit;
	}

	const archived = firstMeaningfulValue(deal, ['archived'], { allowZero: true }) === true;
	const legacyStatus = normalizeToken(firstMeaningfulValue(deal, ['status', 'offering_status', 'offeringStatus']));
	if (archived || legacyStatus === 'archived') return 'archived';

	const visible = firstMeaningfulValue(deal, ['is_visible_to_users', 'isVisibleToUsers'], { allowZero: true });
	if (visible === true) return 'published';

	return 'draft';
}

export function resolveDealVisibility(deal) {
	const lifecycleStatus = resolveDealLifecycleStatus(deal);
	if (lifecycleStatus === 'archived') return false;

	const explicit = readPath(deal, 'is_visible_to_users');
	if (explicit === true || explicit === false) return explicit;
	const camel = readPath(deal, 'isVisibleToUsers');
	if (camel === true || camel === false) return camel;

	return lifecycleStatus === 'published';
}

export function getDealDisplayName(deal) {
	return firstMeaningfulValue(deal, ['investment_name', 'investmentName', 'name']) || 'Untitled deal';
}

export function getDealSponsorName(deal) {
	return getDealOperatorName(deal, 'Unknown sponsor');
}

export function getDealResolvedSlug(deal) {
	return firstMeaningfulValue(deal, ['slug']) || slugify(getDealDisplayName(deal));
}

function buildRequiredFieldChecks(deal) {
	const sponsorName = getDealSponsorName(deal);
	return [
		{ label: 'Name', present: hasMeaningfulValue(firstMeaningfulValue(deal, ['investment_name', 'investmentName', 'name'])) },
		{
			label: 'Sponsor',
			present: sponsorName !== 'Unknown sponsor'
		},
		{ label: 'Asset class', present: hasMeaningfulValue(firstMeaningfulValue(deal, ['asset_class', 'assetClass'])) },
		{
			label: 'Short summary',
			present: hasMeaningfulValue(
				firstMeaningfulValue(deal, ['short_summary', 'shortSummary', 'investment_strategy', 'investmentStrategy'])
			)
		},
		{
			label: 'Minimum investment',
			present: hasMeaningfulValue(
				firstMeaningfulValue(
					deal,
					['investment_minimum', 'investmentMinimum', 'minimum_investment', 'minimumInvestment'],
					{ allowZero: false }
				)
			)
		},
		{
			label: 'Offering status',
			present: hasMeaningfulValue(firstMeaningfulValue(deal, ['offering_status', 'offeringStatus', 'status']))
		},
		{
			label: 'Cover image or hero media',
			present: hasMeaningfulValue(
				firstMeaningfulValue(deal, [
					'cover_image_url',
					'coverImageUrl',
					'hero_media_url',
					'heroMediaUrl',
					'property_image_url',
					'propertyImageUrl',
					'image_url',
					'imageUrl'
				])
			)
		},
		{
			label: 'Return or payout metric',
			present: hasAnyMeaningfulValue(deal, [
				['target_irr', 'targetIRR'],
				['cash_yield', 'cashYield', 'cash_on_cash', 'cashOnCash'],
				['preferred_return', 'preferredReturn'],
				['equity_multiple', 'equityMultiple']
			])
		},
		{
			label: 'Risk or downside notes',
			present: hasMeaningfulValue(
				firstMeaningfulValue(deal, ['risk_notes', 'riskNotes', 'downside_notes', 'downsideNotes'])
			)
		},
		{ label: 'Slug', present: hasMeaningfulValue(getDealResolvedSlug(deal)) },
		{
			label: 'Deck or primary source / CTA context',
			present:
				hasMeaningfulValue(firstMeaningfulValue(deal, ['deck_url', 'deckUrl']))
				|| hasMeaningfulValue(firstMeaningfulValue(deal, ['primary_source_url', 'primarySourceUrl']))
				|| hasMeaningfulValue(firstMeaningfulValue(deal, ['primary_source_context', 'primarySourceContext']))
		}
	];
}

function buildRecommendedFieldChecks(deal) {
	const requiredSourceCoveredByDeck = hasMeaningfulValue(firstMeaningfulValue(deal, ['deck_url', 'deckUrl']));

	return [
		{ label: 'Target IRR', present: hasMeaningfulValue(firstMeaningfulValue(deal, ['target_irr', 'targetIRR'])) },
		{
			label: 'Cash yield',
			present: hasMeaningfulValue(firstMeaningfulValue(deal, ['cash_yield', 'cashYield', 'cash_on_cash', 'cashOnCash']))
		},
		{
			label: 'Equity multiple',
			present: hasMeaningfulValue(firstMeaningfulValue(deal, ['equity_multiple', 'equityMultiple']))
		},
		{ label: 'Hold period', present: hasMeaningfulValue(firstMeaningfulValue(deal, ['hold_period_years', 'holdPeriod'])) },
		{
			label: 'Geography or market',
			present: hasMeaningfulValue(
				firstMeaningfulValue(deal, ['investing_geography', 'investingGeography', 'location', 'market'])
			)
		},
		{
			label: 'Fee summary',
			present: hasMeaningfulValue(firstMeaningfulValue(deal, ['fee_summary', 'feeSummary', 'fees']))
		},
		{
			label: 'Liquidity or redemption terms',
			present: hasMeaningfulValue(firstMeaningfulValue(deal, ['redemption', 'liquidity_terms', 'liquidityTerms']))
		},
		{
			label: 'Audited flag',
			present: hasMeaningfulValue(firstMeaningfulValue(deal, ['financials', 'audited_flag', 'auditedFlag']))
		},
		{
			label: 'Tax characteristics',
			present: hasMeaningfulValue(
				firstMeaningfulValue(deal, [
					'tax_characteristics',
					'taxCharacteristics',
					'tax_form',
					'taxForm',
					'first_yr_depreciation',
					'firstYrDepreciation'
				])
			)
		},
		{
			label: 'Tags or strategy',
			present: hasMeaningfulValue(firstMeaningfulValue(deal, ['tags', 'strategy', 'investment_strategy', 'investmentStrategy']))
		},
		...(
			requiredSourceCoveredByDeck
				? []
				: [{ label: 'Deck URL', present: hasMeaningfulValue(firstMeaningfulValue(deal, ['deck_url', 'deckUrl'])) }]
		),
		{
			label: 'Operator background',
			present: hasMeaningfulValue(
				firstMeaningfulValue(deal, [
					'operator_background',
					'operatorBackground',
					'management_company.description',
					'managementCompanyDescription'
				])
			)
		},
		{
			label: 'Key dates',
			present: hasMeaningfulValue(
				firstMeaningfulValue(deal, [
					'key_dates',
					'keyDates',
					'date_of_first_sale',
					'dateOfFirstSale',
					'start_date',
					'startDate',
					'target_close_date',
					'targetCloseDate'
				])
			)
		},
		{ label: 'Updated at', present: hasMeaningfulValue(firstMeaningfulValue(deal, ['updated_at', 'updatedAt'])) }
	];
}

export function computeDealCompleteness(deal) {
	const requiredChecks = buildRequiredFieldChecks(deal);
	const recommendedChecks = buildRecommendedFieldChecks(deal);

	const requiredWeightPerField = requiredChecks.length > 0 ? REQUIRED_FIELD_WEIGHT / requiredChecks.length : 0;
	const recommendedWeightPerField = recommendedChecks.length > 0 ? RECOMMENDED_FIELD_WEIGHT / recommendedChecks.length : 0;

	const completenessScore = Math.round(
		requiredChecks.reduce((sum, check) => sum + (check.present ? requiredWeightPerField : 0), 0)
		+ recommendedChecks.reduce((sum, check) => sum + (check.present ? recommendedWeightPerField : 0), 0)
	);

	const missingRequiredFields = requiredChecks.filter((check) => !check.present).map((check) => check.label);
	const missingRecommendedFields = recommendedChecks.filter((check) => !check.present).map((check) => check.label);

	let readinessLabel = 'Needs setup';
	if (completenessScore >= 90) readinessLabel = 'Ready for approval';
	else if (completenessScore >= 70) readinessLabel = 'Nearly ready';
	else if (completenessScore >= 40) readinessLabel = 'Incomplete';

	return {
		completenessScore,
		missingRequiredFields,
		missingRecommendedFields,
		readinessLabel,
		hasBlockingIssues: missingRequiredFields.length > 0
	};
}

export function buildDealWorkflowRecord(deal) {
	const lifecycleStatus = resolveDealLifecycleStatus(deal);
	const isVisibleToUsers = resolveDealVisibility(deal);
	const completeness = computeDealCompleteness(deal);
	const updatedAt = firstMeaningfulValue(deal, ['updated_at', 'updatedAt', 'added_date', 'addedDate']) || null;
	const visibilityDisabledReason =
		lifecycleStatus === 'archived'
			? 'Archived deals cannot be visible to users'
			: (!isVisibleToUsers && completeness.hasBlockingIssues
				? 'Cannot make visible until required fields are complete'
				: (!isVisibleToUsers && lifecycleStatus !== 'approved'
					? 'Move deal to Approved before making it visible'
					: null));

	return {
		...deal,
		dealName: getDealDisplayName(deal),
		sponsorName: getDealSponsorName(deal),
		slug: getDealResolvedSlug(deal),
		lifecycleStatus,
		isVisibleToUsers,
		updatedAt,
		...completeness,
		readyToPublish:
			lifecycleStatus === 'approved' && completeness.hasBlockingIssues === false,
		visibilityDisabledReason
	};
}

export function compareDealWorkflowRecords(left, right) {
	const leftIsLive = left.lifecycleStatus === 'published';
	const rightIsLive = right.lifecycleStatus === 'published';
	if (leftIsLive !== rightIsLive) {
		return leftIsLive ? 1 : -1;
	}

	const lifecycleDelta =
		(DEAL_LIFECYCLE_SORT_ORDER[left.lifecycleStatus] ?? 99)
		- (DEAL_LIFECYCLE_SORT_ORDER[right.lifecycleStatus] ?? 99);
	if (lifecycleDelta !== 0) return lifecycleDelta;

	if (left.completenessScore !== right.completenessScore) {
		return left.completenessScore - right.completenessScore;
	}

	const leftUpdated = left.updatedAt ? new Date(left.updatedAt).getTime() : 0;
	const rightUpdated = right.updatedAt ? new Date(right.updatedAt).getTime() : 0;
	if (leftUpdated !== rightUpdated) return rightUpdated - leftUpdated;

	return String(left.dealName || '').localeCompare(String(right.dealName || ''));
}

export function resolveDealWorkflowMutation(currentDeal, requestedUpdates = {}) {
	const existingLifecycleStatus = resolveDealLifecycleStatus(currentDeal);
	const existingVisibility = resolveDealVisibility(currentDeal);

	const explicitLifecycle =
		requestedUpdates.lifecycle_status !== undefined
			? requestedUpdates.lifecycle_status
			: requestedUpdates.lifecycleStatus;
	const explicitVisibility =
		requestedUpdates.is_visible_to_users !== undefined
			? requestedUpdates.is_visible_to_users
			: requestedUpdates.isVisibleToUsers;

	let lifecycleStatus =
		explicitLifecycle !== undefined
			? normalizeLifecycleStatus(explicitLifecycle, existingLifecycleStatus)
			: existingLifecycleStatus;
	let isVisibleToUsers = explicitVisibility !== undefined ? Boolean(explicitVisibility) : existingVisibility;
	const hasApprovalGate =
		existingLifecycleStatus === 'approved'
		|| existingLifecycleStatus === 'published'
		|| lifecycleStatus === 'approved';

	if (explicitLifecycle !== undefined && lifecycleStatus !== 'published') {
		isVisibleToUsers = false;
	}

	if ((explicitVisibility === true || lifecycleStatus === 'published') && !hasApprovalGate) {
		return {
			error: 'Move deal to Approved before making it visible',
			finalDeal: {
				...currentDeal,
				...requestedUpdates,
				lifecycle_status: lifecycleStatus,
				is_visible_to_users: isVisibleToUsers
			}
		};
	}

	if (explicitVisibility === true) {
		lifecycleStatus = 'published';
		isVisibleToUsers = true;
	} else if (explicitVisibility === false) {
		isVisibleToUsers = false;
		if (explicitLifecycle === undefined && existingLifecycleStatus === 'published') {
			lifecycleStatus = 'approved';
		}
	}

	if (lifecycleStatus === 'published') {
		isVisibleToUsers = true;
	}

	if (lifecycleStatus === 'archived') {
		isVisibleToUsers = false;
	}

	const finalDeal = {
		...currentDeal,
		...requestedUpdates,
		lifecycle_status: lifecycleStatus,
		is_visible_to_users: isVisibleToUsers
	};
	const completeness = computeDealCompleteness(finalDeal);

	if (isVisibleToUsers && completeness.hasBlockingIssues) {
		return {
			error: 'Cannot make visible until required fields are complete',
			finalDeal,
			completeness
		};
	}

	return {
		error: null,
		finalDeal,
		lifecycleStatus,
		isVisibleToUsers,
		completeness
	};
}

export function buildNewDealDefaults(input = {}) {
	const investmentName = firstMeaningfulValue(input, ['investment_name', 'investmentName', 'name']) || '';
	const sponsorName =
		firstMeaningfulValue(input, [
			'sponsor_name',
			'sponsorName',
			'sponsor',
			'management_company_name',
			'managementCompanyName'
		]) || '';

	return {
		lifecycle_status: 'draft',
		is_visible_to_users: false,
		slug: firstMeaningfulValue(input, ['slug']) || slugify(investmentName),
		sponsor_name: sponsorName
	};
}
