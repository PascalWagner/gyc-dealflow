import {
	buildDealReviewCompletenessModel,
	dealFieldConfig,
	parseLocationValue
} from './dealReviewSchema.js';
import {
	computeDealCompleteness,
	DEAL_CATALOG_STATE_LABELS,
	DEAL_LIFECYCLE_LABELS,
	resolveDealCatalogState,
	resolveDealLifecycleStatus
} from './dealWorkflow.js';
import { hasRenderableHeroMedia } from './dealCardHero.js';

export const DEAL_ONBOARDING_STAGE_ORDER = ['intake', 'sec', 'team', 'overview', 'details', 'risks', 'summary'];

const STAGE_ID_ALIASES = {
	key_details: 'details',
	economics: 'details',
	risk: 'risks',
	media: 'risks',
	publish: 'summary'
};

export const DEAL_ONBOARDING_BRANCHES = {
	equity_single_asset: {
		key: 'equity_single_asset',
		family: 'equity',
		structure: 'single_asset',
		label: 'Equity · Single Asset',
		shortLabel: 'Equity Deal'
	},
	equity_fund: {
		key: 'equity_fund',
		family: 'equity',
		structure: 'fund',
		label: 'Equity · Fund',
		shortLabel: 'Equity Fund'
	},
	lending_single_loan: {
		key: 'lending_single_loan',
		family: 'lending',
		structure: 'single_loan',
		label: 'Lending · Single Loan',
		shortLabel: 'Loan Deal'
	},
	lending_fund: {
		key: 'lending_fund',
		family: 'lending',
		structure: 'fund',
		label: 'Lending · Fund',
		shortLabel: 'Credit Fund'
	}
};

export const DEAL_ONBOARDING_BRANCH_KEYS = Object.keys(DEAL_ONBOARDING_BRANCHES);

export const DEAL_ONBOARDING_BRANCH_LABELS = {
	equity_single_asset: DEAL_ONBOARDING_BRANCHES.equity_single_asset.label,
	equity_fund: DEAL_ONBOARDING_BRANCHES.equity_fund.label,
	lending_fund: DEAL_ONBOARDING_BRANCHES.lending_fund.label,
	lending_single_loan: DEAL_ONBOARDING_BRANCHES.lending_single_loan.label,
	single_loan: DEAL_ONBOARDING_BRANCHES.lending_single_loan.label
};

const COMMON_STAGE_CONFIG = {
	intake: {
		id: 'intake',
		label: 'Intake',
		title: 'Set the deal up, then upload the source files',
		description: 'Capture the investment name, management company, website, and source documents first.',
		fieldGroupIds: ['intake_identity'],
		requiredRuleIds: ['intake_identity']
	},
	sec: {
		id: 'sec',
		label: 'SEC',
		title: 'Verify the issuer filing before you trust the record',
		description: 'Confirm the issuer match, filing evidence, and reviewer notes before you move on.',
		fieldGroupIds: [],
		requiredRuleIds: ['sec_structure']
	},
	team: {
		id: 'team',
		label: 'Team',
		title: 'Confirm the operator team and LP-facing context',
		description: 'Validate who runs the deal and what context an investor should trust before reviewing details.',
		fieldGroupIds: ['team_sponsor'],
		requiredRuleIds: ['team_sponsor']
	},
	overview: {
		id: 'overview',
		label: 'Overview',
		title: 'Define the overview of the deal',
		description: 'Confirm the structured identity and plain-English positioning of the opportunity.',
		fieldGroupIds: ['overview_identity', 'overview_story'],
		requiredRuleIds: ['overview_required']
	},
	details: {
		id: 'details',
		label: 'Key Details',
		title: 'Validate the key terms for this deal type',
		description: 'The fields here branch based on whether this is an equity deal, lending fund, or single-loan deal.',
		fieldGroupIds: ['details_common', 'details_branch'],
		requiredRuleIds: ['detail_metric']
	},
	risks: {
		id: 'risks',
		label: 'Risk & Sources',
		title: 'Review risks and source evidence',
		description: 'Line up the actual risks in the deck and PPM with the risks you want highlighted on the deal page.',
		fieldGroupIds: ['risks_primary', 'risks_supporting', 'risks_media'],
		requiredRuleIds: ['risk_required', 'media_required', 'source_evidence']
	},
	summary: {
		id: 'summary',
		label: 'Summary',
		title: 'Review, publish, and validate with the operator',
		description: 'See the whole record in one place before publishing or sending a validation email.',
		fieldGroupIds: ['summary_core_checklist', 'summary_branch_checklist'],
		requiredRuleIds: ['base_required', 'source_evidence', 'detail_metric']
	}
};

const FIELD_GROUPS = {
	intake_identity: {
		id: 'intake_identity',
		stageId: 'intake',
		label: 'Draft Setup',
		description: 'Start with the exact deal name, sponsor linkage, and a stable slug.',
		fieldKeys: ['investmentName', 'sponsor', 'companyWebsite', 'slug']
	},
	sec_structure: {
		id: 'sec_structure',
		stageId: 'sec',
		label: 'Issuer Structure',
		description: 'Use structured fields for offering status, audience, and offering type before any SEC matching.',
		fieldKeys: ['dealType', 'offeringType', 'availableTo', 'offeringStatus']
	},
	team_sponsor: {
		id: 'team_sponsor',
		stageId: 'team',
		label: 'Sponsor Context',
		description: 'Tie the deal to the right sponsor record and capture the LP-facing operator context.',
		fieldKeys: ['sponsor', 'companyWebsite', 'operatorBackground']
	},
	overview_identity: {
		id: 'overview_identity',
		stageId: 'overview',
		label: 'Classification',
		description: 'Lock in the structured identity of the deal before you refine the narrative.',
		fieldKeys: ['assetClass', 'dealType', 'offeringType', 'offeringStatus', 'availableTo', 'investmentMinimum', 'investingGeography']
	},
	overview_story: {
		id: 'overview_story',
		stageId: 'overview',
		label: 'Narrative',
		description: 'Explain the opportunity in plain English before the economics get more detailed.',
		fieldKeys: ['shortSummary', 'investmentStrategy']
	},
	details_common: {
		id: 'details_common',
		stageId: 'details',
		label: 'Common Terms',
		description: 'These fields apply across all four onboarding branches.',
		fieldKeys: ['investmentMinimum', 'distributions', 'financials', 'feeSummary']
	},
	details_branch: {
		id: 'details_branch',
		stageId: 'details',
		label: 'Branch-Specific Terms',
		description: 'The returns and term structure change depending on the branch.',
		fieldKeys: []
	},
	risks_primary: {
		id: 'risks_primary',
		stageId: 'risks',
		label: 'Primary Risks',
		description: 'Make the risk framing explicit before the listing can publish.',
		fieldKeys: ['riskNotes', 'downsideNotes']
	},
	risks_supporting: {
		id: 'risks_supporting',
		stageId: 'risks',
		label: 'Supporting Context',
		description: 'Operator background, timing, and other diligence notes belong here.',
		fieldKeys: ['operatorBackground', 'keyDates', 'taxCharacteristics']
	},
	risks_media: {
		id: 'risks_media',
		stageId: 'risks',
		label: 'Sources and Evidence',
		description: 'Back the record with media and source context before you publish it.',
		fieldKeys: ['coverImageUrl', 'heroMediaUrl', 'deckUrl', 'primarySourceUrl', 'primarySourceContext', 'tags']
	},
	summary_core_checklist: {
		id: 'summary_core_checklist',
		stageId: 'summary',
		label: 'Core Publish Checklist',
		description: 'These are the base fields every deal should satisfy before it goes live.',
		fieldKeys: [],
		ruleIds: ['base_required', 'source_evidence', 'detail_metric'],
		mode: 'checklist'
	},
	summary_branch_checklist: {
		id: 'summary_branch_checklist',
		stageId: 'summary',
		label: 'Branch-Specific Checklist',
		description: 'The final gate changes by branch so the wizard enforces the right review depth.',
		fieldKeys: [],
		ruleIds: [],
		mode: 'checklist'
	}
};

const BRANCH_STAGE_OVERRIDES = {
	equity_single_asset: {
		details: {
			title: 'Property Economics and Terms',
			description: 'Single-asset equity deals should foreground the return profile, hold period, and carry terms.'
		}
	},
	equity_fund: {
		details: {
			title: 'Fund Economics and Terms',
			description: 'Equity funds should foreground the pooled return profile, distributions, and fee structure.'
		}
	},
	lending_single_loan: {
		details: {
			title: 'Loan Economics and Terms',
			description: 'Single-loan deals should foreground yield, duration, and downside framing.'
		}
	},
	lending_fund: {
		details: {
			title: 'Lending Fund Economics and Terms',
			description: 'Lending funds should foreground yield, liquidity, and reporting expectations.'
		}
	}
};

const DETAILS_BY_BRANCH = {
	equity_single_asset: [
		'targetIRR',
		'cashYield',
		'preferredReturn',
		'equityMultiple',
		'holdPeriod',
		'lpGpSplit',
		'purchasePrice',
		'propertyAddress',
		'propertyType',
		'unitCount',
		'yearBuilt',
		'squareFootage',
		'occupancyPct',
		'acquisitionLoan',
		'loanToValue',
		'loanRate',
		'loanTermYears',
		'loanIOYears',
		'capexBudget',
		'closingCosts'
	],
	equity_fund: [
		'targetIRR',
		'cashYield',
		'preferredReturn',
		'equityMultiple',
		'holdPeriod',
		'distributions',
		'lpGpSplit',
		'feeSummary',
		'taxCharacteristics',
		'offeringSize',
		'fundAUM'
	],
	lending_fund: [
		'cashYield',
		'targetIRR',
		'preferredReturn',
		'investmentMinimum',
		'offeringSize',
		'fundAUM',
		'loanCount',
		'avgLoanLtv',
		'debtPosition',
		'distributions',
		'redemption',
		'financials',
		'taxForm',
		'feeSummary'
	],
	lending_single_loan: [
		'cashYield',
		'targetIRR',
		'investmentMinimum',
		'offeringSize',
		'debtPosition',
		'loanToValue',
		'loanRate',
		'loanTermYears',
		'loanIOYears',
		'propertyAddress',
		'downsideNotes'
	]
};

const BASE_REQUIRED_PUBLISH_FIELDS = Object.values(dealFieldConfig)
	.filter((field) => field.requiredForPublish)
	.map((field) => field.key);

const COMMON_PUBLISH_RULES = [
	{
		id: 'intake_identity',
		type: 'all',
		stageId: 'intake',
		label: 'Draft identity is set',
		description: 'The draft needs a deal name, sponsor, and slug before the wizard can continue cleanly.',
		fieldKeys: ['investmentName', 'sponsor', 'slug']
	},
	{
		id: 'sec_structure',
		type: 'all',
		stageId: 'sec',
		label: 'Issuer structure is set',
		description: 'The SEC/compliance step should at least define deal type, audience, and live offering status.',
		fieldKeys: ['dealType', 'availableTo', 'offeringStatus']
	},
	{
		id: 'team_sponsor',
		type: 'all',
		stageId: 'team',
		label: 'Sponsor context is captured',
		description: 'The LP-facing sponsor and operator context should be visible before detail review.',
		fieldKeys: ['sponsor', 'companyWebsite', 'operatorBackground']
	},
	{
		id: 'overview_required',
		type: 'all',
		stageId: 'overview',
		label: 'Overview fields are complete',
		description: 'The structured classification and summary should be in place before detail review.',
		fieldKeys: ['assetClass', 'offeringStatus', 'investmentMinimum', 'shortSummary']
	},
	{
		id: 'detail_metric',
		type: 'any',
		stageId: 'details',
		label: 'At least one structured economics metric',
		description: 'Use at least one structured metric instead of leaving the economics fully in prose.',
		fieldKeys: ['targetIRR', 'cashYield', 'preferredReturn', 'equityMultiple']
	},
	{
		id: 'risk_required',
		type: 'all',
		stageId: 'risks',
		label: 'Risk framing is present',
		description: 'Every live listing should call out its primary risks.',
		fieldKeys: ['riskNotes']
	},
	{
		id: 'media_required',
		type: 'all',
		stageId: 'risks',
		label: 'Media essentials are present',
		description: 'A publishable listing needs a cover image and clear CTA/source context.',
		fieldKeys: ['coverImageUrl', 'primarySourceContext']
	},
	{
		id: 'source_evidence',
		type: 'any',
		stageId: 'risks',
		label: 'At least one source URL',
		description: 'A live listing should have either a deck URL or another primary source URL.',
		fieldKeys: ['deckUrl', 'primarySourceUrl']
	},
	{
		id: 'base_required',
		type: 'all',
		stageId: 'summary',
		label: 'Base publish requirements',
		description: 'This mirrors the existing schema-level required-for-publish fields.',
		fieldKeys: BASE_REQUIRED_PUBLISH_FIELDS
	}
];

const BRANCH_PUBLISH_RULES = {
	equity_single_asset: [
		{
			id: 'equity_single_asset_market',
			type: 'all',
			stageId: 'summary',
			label: 'Single-asset equity needs market context',
			description: 'A property-style equity listing should include where the opportunity is operating.',
			fieldKeys: ['investingGeography']
		}
	],
	equity_fund: [
		{
			id: 'equity_fund_structure',
			type: 'all',
			stageId: 'summary',
			label: 'Equity fund structure is defined',
			description: 'Fund listings should clearly identify the pooled structure and distribution profile.',
			fieldKeys: ['dealType', 'offeringType', 'distributions']
		}
	],
	lending_single_loan: [
		{
			id: 'lending_single_loan_underwriting',
			type: 'all',
			stageId: 'summary',
			label: 'Single-loan underwriting context is present',
			description: 'A single-loan listing should include both duration and downside framing.',
			fieldKeys: ['holdPeriod', 'downsideNotes']
		}
	],
	lending_fund: [
		{
			id: 'lending_fund_structure',
			type: 'all',
			stageId: 'summary',
			label: 'Lending fund terms are defined',
			description: 'A pooled lending vehicle should describe structure, liquidity, and reporting.',
			fieldKeys: ['dealType', 'offeringType', 'redemption', 'financials']
		}
	]
};

const LENDING_ASSET_CLASS_TOKENS = new Set([
	'lending',
	'private_debt_credit',
	'private_debt',
	'private_credit',
	'debt',
	'credit'
]);
const FUND_DEAL_TYPE_TOKENS = new Set(['fund', 'portfolio']);
const SINGLE_DEAL_TYPE_TOKENS = new Set(['syndication', 'direct', 'joint_venture']);
const FUND_HINT_PATTERN = /\b(fund|portfolio)\b/i;
const LENDING_HINT_PATTERN = /\b(lend|loan|credit|debt|note|bridge)\b/i;

function normalizeToken(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function normalizeStageId(stageId) {
	const normalized = normalizeToken(stageId);
	return STAGE_ID_ALIASES[normalized] || normalized;
}

function readPath(record, path) {
	if (!record || !path) return undefined;
	return String(path)
		.split('.')
		.reduce((current, key) => (current === null || current === undefined ? undefined : current[key]), record);
}

function firstValue(record, aliases = []) {
	for (const alias of aliases) {
		const value = readPath(record, alias);
		if (value !== undefined && value !== null) return value;
	}
	return undefined;
}

function toArray(value) {
	if (Array.isArray(value)) {
		return value.map((item) => String(item || '').trim()).filter(Boolean);
	}
	return String(value || '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function hasMeaningfulString(value) {
	return String(value || '').trim().length > 0;
}

function hasMeaningfulLocation(value) {
	const location = parseLocationValue(value);
	return hasMeaningfulString(location.city)
		|| hasMeaningfulString(location.state)
		|| (hasMeaningfulString(location.country) && location.country !== 'United States');
}

function hasFieldDefinition(fieldKey) {
	return Object.prototype.hasOwnProperty.call(dealFieldConfig, fieldKey);
}

function getBranchMetadata(branchKey) {
	return DEAL_ONBOARDING_BRANCHES[branchKey] || DEAL_ONBOARDING_BRANCHES.equity_single_asset;
}

export function normalizeDealOnboardingBranch(value) {
	const token = normalizeToken(value);
	if (DEAL_ONBOARDING_BRANCH_KEYS.includes(token)) return token;
	if (token === 'single_loan' || token === 'loan') return 'lending_single_loan';
	if (token === 'credit_fund' || token === 'debt_fund') return 'lending_fund';
	if (token === 'equity_single' || token === 'single_asset_equity') return 'equity_single_asset';
	if (token === 'equity_portfolio' || token === 'fund_equity') return 'equity_fund';
	return '';
}

export function getFieldValue(source = {}, fieldKey) {
	const field = dealFieldConfig[fieldKey];
	if (!field) return source?.[fieldKey];

	if (Object.prototype.hasOwnProperty.call(source || {}, fieldKey)) {
		return source[fieldKey];
	}

	if (field.type === 'entity_reference') {
		return {
			id: String(firstValue(source, field.readIdFrom) || '').trim(),
			name: String(firstValue(source, field.readNameFrom) || '').trim(),
			createIfMissing: false
		};
	}

	if (field.type === 'location') {
		return parseLocationValue(firstValue(source, [fieldKey, ...(field.readFrom || [])]));
	}

	return firstValue(source, [fieldKey, ...(field.readFrom || [])]);
}

export function createDealOnboardingFieldValueMap(source = {}) {
	return Object.fromEntries(
		Object.keys(dealFieldConfig).map((fieldKey) => [fieldKey, getFieldValue(source, fieldKey)])
	);
}

function hasFieldValue(source, fieldKey) {
	const field = dealFieldConfig[fieldKey];
	if (!field) return hasMeaningfulString(source?.[fieldKey]);

	if (fieldKey === 'coverImageUrl' || fieldKey === 'heroMediaUrl') {
		return hasRenderableHeroMedia(source);
	}

	const value = getFieldValue(source, fieldKey);

	if (field.type === 'entity_reference') {
		return hasMeaningfulString(value?.name);
	}
	if (field.type === 'location') {
		return hasMeaningfulLocation(value);
	}
	if (field.type === 'multi_select') {
		return toArray(value).length > 0;
	}
	if (field.type === 'currency' || field.type === 'number' || field.type === 'percentage') {
		return value !== null && value !== undefined && String(value).trim() !== '';
	}
	return hasMeaningfulString(value);
}

function resolveFamily(source) {
	const assetClass = normalizeToken(getFieldValue(source, 'assetClass'));
	const dealType = normalizeToken(getFieldValue(source, 'dealType'));
	const summaryHint = [
		getFieldValue(source, 'investmentName'),
		getFieldValue(source, 'shortSummary'),
		getFieldValue(source, 'investmentStrategy')
	]
		.filter(Boolean)
		.join(' ');

	if (LENDING_ASSET_CLASS_TOKENS.has(assetClass)) return 'lending';
	if (assetClass.includes('debt') || assetClass.includes('credit')) return 'lending';
	if (dealType === 'fund' && LENDING_HINT_PATTERN.test(summaryHint)) return 'lending';
	if (LENDING_HINT_PATTERN.test(summaryHint) && assetClass === '') return 'lending';

	return 'equity';
}

function resolveStructure(source) {
	const dealType = normalizeToken(getFieldValue(source, 'dealType'));
	if (FUND_DEAL_TYPE_TOKENS.has(dealType)) return 'fund';
	if (SINGLE_DEAL_TYPE_TOKENS.has(dealType)) return 'single';

	const summaryHint = [
		getFieldValue(source, 'investmentName'),
		getFieldValue(source, 'shortSummary'),
		getFieldValue(source, 'investmentStrategy')
	]
		.filter(Boolean)
		.join(' ');

	return FUND_HINT_PATTERN.test(summaryHint) ? 'fund' : 'single';
}

export function resolveDealOnboardingBranch(source = {}) {
	const explicit = normalizeDealOnboardingBranch(source?.onboardingBranch || source?.dealOnboardingBranch || source?.branch);
	if (explicit) {
		const metadata = getBranchMetadata(explicit);
		return { branch: explicit, family: metadata.family, structure: metadata.structure, ...metadata };
	}

	const family = resolveFamily(source);
	const structure = resolveStructure(source);
	const branch = family === 'lending'
		? (structure === 'fund' ? 'lending_fund' : 'lending_single_loan')
		: (structure === 'fund' ? 'equity_fund' : 'equity_single_asset');
	const metadata = getBranchMetadata(branch);
	return { branch, family: metadata.family, structure: metadata.structure, ...metadata };
}

function cloneFieldGroup(groupId, options = {}) {
	const group = FIELD_GROUPS[groupId];
	return {
		...group,
		label: options.label || group.label,
		description: options.description || group.description,
		fieldKeys: [...(options.fieldKeys || group.fieldKeys || [])].filter(hasFieldDefinition),
		ruleIds: [...(options.ruleIds || group.ruleIds || [])]
	};
}

function getDetailsGroupForBranch(branchKey) {
	const branchFields = DETAILS_BY_BRANCH[branchKey] || DETAILS_BY_BRANCH.equity_single_asset;
	const metadata = getBranchMetadata(branchKey);
	const labelMap = {
		equity_single_asset: 'Single-Asset Economics',
		equity_fund: 'Fund Economics',
		lending_single_loan: 'Loan Economics',
		lending_fund: 'Lending Fund Economics'
	};
	const descriptionMap = {
		equity_single_asset: 'Focus on return profile, duration, and carry for the asset-level equity deal.',
		equity_fund: 'Focus on pooled fund returns, payout cadence, and sponsor economics.',
		lending_single_loan: 'Focus on yield, duration, and downside framing for the loan deal.',
		lending_fund: 'Focus on yield, liquidity, and reporting for the pooled lending vehicle.'
	};

	return cloneFieldGroup('details_branch', {
		label: labelMap[branchKey] || `${metadata.shortLabel} Economics`,
		description: descriptionMap[branchKey] || FIELD_GROUPS.details_branch.description,
		fieldKeys: branchFields
	});
}

function getStageOverride(branchKey, stageId) {
	return BRANCH_STAGE_OVERRIDES[branchKey]?.[stageId] || {};
}

function normalizeStageConfig(stageId, branchKey) {
	const stage = COMMON_STAGE_CONFIG[stageId];
	const override = getStageOverride(branchKey, stageId);

	const fieldGroups = stage.fieldGroupIds.map((groupId) => {
		if (groupId === 'details_branch') {
			return getDetailsGroupForBranch(branchKey);
		}
		if (groupId === 'summary_branch_checklist') {
			const branchRuleIds = (BRANCH_PUBLISH_RULES[branchKey] || []).map((rule) => rule.id);
			return cloneFieldGroup(groupId, { ruleIds: branchRuleIds });
		}
		return cloneFieldGroup(groupId);
	});

	return {
		...stage,
		title: override.title || stage.title,
		description: override.description || stage.description,
		fieldGroups
	};
}

export function getDealOnboardingPublishRules({ branch = '', source = {} } = {}) {
	const resolvedBranch = normalizeDealOnboardingBranch(branch) || resolveDealOnboardingBranch(source).branch;
	return [
		...COMMON_PUBLISH_RULES.map((rule) => ({ ...rule, fieldKeys: [...rule.fieldKeys] })),
		...(BRANCH_PUBLISH_RULES[resolvedBranch] || []).map((rule) => ({ ...rule, fieldKeys: [...rule.fieldKeys] }))
	];
}

export function evaluateDealOnboardingPublishRules(source = {}, options = {}) {
	const branchResolution = resolveDealOnboardingBranch({ ...source, branch: options.branch || source?.branch });
	const rules = getDealOnboardingPublishRules({ branch: branchResolution.branch, source });

	return rules.map((rule) => {
		const presentFieldKeys = rule.fieldKeys.filter((fieldKey) => hasFieldValue(source, fieldKey));
		const missingFieldKeys = rule.fieldKeys.filter((fieldKey) => !presentFieldKeys.includes(fieldKey));
		const satisfied = rule.type === 'any' ? presentFieldKeys.length > 0 : missingFieldKeys.length === 0;

		return {
			...rule,
			branch: branchResolution.branch,
			satisfied,
			presentFieldKeys,
			missingFieldKeys
		};
	});
}

export function getDealOnboardingStages(options = {}) {
	const source = typeof options === 'string' ? {} : (options.source || {});
	const branchKey = typeof options === 'string' ? options : options.branch;
	const branchResolution = resolveDealOnboardingBranch({ ...source, branch: branchKey || source?.branch });
	const publishRules = evaluateDealOnboardingPublishRules(source, { branch: branchResolution.branch });

	return DEAL_ONBOARDING_STAGE_ORDER.map((stageId, index) => {
		const stage = normalizeStageConfig(stageId, branchResolution.branch);
		return {
			...stage,
			index,
			branch: branchResolution.branch,
			branchLabel: branchResolution.label,
			rules: publishRules.filter(
				(rule) => stage.requiredRuleIds.includes(rule.id) || (stage.id === 'summary' && rule.stageId === 'summary')
			)
		};
	});
}

export function getDealOnboardingStageById(stageId, options = {}) {
	const normalizedStageId = normalizeStageId(stageId);
	return getDealOnboardingStages(options).find((stage) => stage.id === normalizedStageId) || null;
}

export function getDealOnboardingFieldGroups(stageId, options = {}) {
	return getDealOnboardingStageById(stageId, options)?.fieldGroups || [];
}

export function getOnboardingStageFieldKeys(stageId, branch) {
	return getDealOnboardingFieldGroups(stageId, { branch }).flatMap((group) => group.fieldKeys || []);
}

export function getNextOnboardingStage(stageId, branch) {
	const normalizedStageId = normalizeStageId(stageId);
	const stages = getDealOnboardingStages({ branch });
	const index = stages.findIndex((stage) => stage.id === normalizedStageId);
	return index >= 0 && index < stages.length - 1 ? stages[index + 1].id : normalizedStageId;
}

export function getPreviousOnboardingStage(stageId, branch) {
	const normalizedStageId = normalizeStageId(stageId);
	const stages = getDealOnboardingStages({ branch });
	const index = stages.findIndex((stage) => stage.id === normalizedStageId);
	return index > 0 ? stages[index - 1].id : normalizedStageId;
}

export function isValidOnboardingStage(stageId) {
	return DEAL_ONBOARDING_STAGE_ORDER.includes(normalizeStageId(stageId));
}

export function buildDealOnboardingFlow(source = {}, options = {}) {
	const branchResolution = resolveDealOnboardingBranch({ ...source, branch: options.branch || source?.branch });
	const normalizedSource = createDealOnboardingFieldValueMap(source);
	const completenessModel = buildDealReviewCompletenessModel(normalizedSource, source);
	const completeness = computeDealCompleteness(completenessModel);
	const lifecycleStatus = resolveDealLifecycleStatus(source);
	const catalogState = resolveDealCatalogState(source);
	const publishRules = evaluateDealOnboardingPublishRules(source, { branch: branchResolution.branch });
	const stages = getDealOnboardingStages({ branch: branchResolution.branch, source });

	return {
		branch: branchResolution.branch,
		branchLabel: branchResolution.label,
		family: branchResolution.family,
		structure: branchResolution.structure,
		workflow: {
			lifecycleStatus,
			lifecycleLabel: DEAL_LIFECYCLE_LABELS[lifecycleStatus] || lifecycleStatus,
			catalogState,
			catalogLabel: DEAL_CATALOG_STATE_LABELS[catalogState] || catalogState
		},
		completeness,
		publishRules,
		stages,
		isPublishReady: completeness.hasBlockingIssues === false && publishRules.every((rule) => rule.satisfied)
	};
}
