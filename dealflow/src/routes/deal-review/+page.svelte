<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import DealOnboardingProgress from '$lib/components/deal-review/DealOnboardingProgress.svelte';
	import DealReviewSidebar from '$lib/components/deal-review/DealReviewSidebar.svelte';
	import FieldRenderer from '$lib/components/deal-review/FieldRenderer.svelte';
	import LendingFundReviewSectionStage from '$lib/components/deal-review/LendingFundReviewSectionStage.svelte';
	import KeyDetailsStage from '$lib/components/deal-review/stages/KeyDetailsStage.svelte';
	import SecVerificationStage from '$lib/components/deal-review/SecVerificationStage.svelte';
	import TeamContactsStage from '$lib/components/onboarding/TeamContactsStage.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import {
		deriveTeamRoleAssignments,
		mergeSuggestedTeamContacts,
		normalizeTeamContacts,
		pickDealReviewInitialTeamContacts,
		pickInvestorRelationsContact,
		pickPrimaryTeamContact,
		serializeTeamContactsForApi,
		validateTeamContacts
	} from '$lib/onboarding/teamContacts.js';
	import {
		isResolvedSecVerificationStatus,
		SEC_VERIFICATION_LABELS
	} from '$lib/sec/verification.js';
	import {
		ensureSessionUserToken,
		getFreshSessionToken,
		getStoredSessionUser,
		isAdmin,
		isGP
	} from '$lib/stores/auth.js';
	import {
		buildDealReviewPayload,
		createDealReviewFormFromDeal,
		createEmptyDealReviewForm,
		dealFieldConfig,
		dealReviewSections,
		formatDealReviewFieldDisplay,
		getDealReviewFieldWarning
	} from '$lib/utils/dealReviewSchema.js';
	import {
		buildDealOnboardingFlow,
		DEAL_ONBOARDING_BRANCH_LABELS,
		DEAL_ONBOARDING_BRANCHES,
		getDealOnboardingFieldGroups,
		getDealOnboardingStageById,
		getDealOnboardingStages,
		getNextOnboardingStage,
		getOnboardingStageFieldKeys,
		getPreviousOnboardingStage,
		isValidOnboardingStage,
		resolveDealOnboardingBranch
	} from '$lib/utils/dealOnboardingFlow.js';
	import {
		resolveDealLifecycleStatus,
		slugify
	} from '$lib/utils/dealWorkflow.js';
	import {
		mergeStateCodeLists,
		STATE_NAME_BY_CODE
	} from '$lib/utils/investing-geography.js';
	import {
		canPreviewDealReviewSummary,
		preservesFullReviewAccessForLifecycle,
		resolveSummaryLifecycleSyncTarget,
		resolveSummaryReadinessLabel,
		resolveSummaryReadinessTone
	} from '$lib/utils/reviewSummaryState.js';
	import {
		fieldRequiresSourceCitation,
		getMissingRequiredEvidenceFieldKeys,
		normalizeReviewFieldEvidenceMap,
		readReviewFieldValue
	} from '$lib/utils/reviewFieldEvidence.js';
	import {
		getReviewFieldKeyForColumn,
		getReviewFieldLabel,
		hasActiveAdminOverride,
		normalizeReviewFieldStateMap
	} from '$lib/utils/reviewFieldState.js';
	import { currentAdminRealUser } from '$lib/utils/userScopedState.js';

	function listFromValue(value) {
		if (Array.isArray(value)) {
			return value.map((item) => String(item || '').trim()).filter(Boolean);
		}
		return String(value || '')
			.split('\n')
			.map((item) => item.trim())
			.filter(Boolean);
	}

	function listToTextarea(value = []) {
		return listFromValue(value).join('\n');
	}

	function formatStateCodesForDisplay(stateCodes = []) {
		const normalizedStates = mergeStateCodeLists(stateCodes);
		if (normalizedStates.length === 0) return 'None found';
		return normalizedStates
			.map((stateCode) => STATE_NAME_BY_CODE[stateCode] || stateCode)
			.join(', ');
	}

	function updateListState(kind, rawValue) {
		const nextList = listFromValue(rawValue);
		if (kind === 'source') {
			sourceRiskFactors = nextList;
		} else {
			highlightedRisks = nextList;
		}
		markDirty();
	}

	function revealReviewFeedback() {
		if (!browser) return;
		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		});
	}

	function getRiskRedesignHref({ from = '' } = {}) {
		const params = new URLSearchParams({ id: dealId });
		params.set('view', 'extract');
		if (from) params.set('from', from);
		return `/deal-review/risk-redesign?${params.toString()}`;
	}

	function getStageHref(stage, { extract = false, from = '', allowSummary = false } = {}) {
		if (stage === 'risks' && branchInfo.branch !== 'lending_fund') {
			return getRiskRedesignHref({ from });
		}
		const params = new URLSearchParams({ id: dealId });
		params.set('stage', stage);
		if (from) params.set('from', from);
		if (extract) params.set('extract', '1');
		if (stage === 'summary' && (allowSummary || allowSummaryPreview || preservesFullReviewAccess)) {
			params.set('allowSummary', '1');
		}
		return `/deal-review?${params.toString()}`;
	}

	const LENDING_STAGE_ORDER = [
		'intake',
		'sec',
		'classification',
		'static_terms',
		'fees',
		'historical_performance',
		'portfolio_snapshot',
		'sponsor_trust',
		'team',
		'risks',
		'summary'
	];

	const HISTORICAL_RETURN_YEARS = Array.from(
		{ length: Math.max(0, new Date().getFullYear() - 1 - 2015 + 1) },
		(_, index) => 2015 + index
	);

	const LENDING_STAGE_CONFIGS = {
		intake: {
			id: 'intake',
			label: 'Source Package',
			title: 'Set the deal up, then upload the source files',
			description: 'Capture the investment name, management company, website, and source documents first.',
			sections: [
				{
					label: 'Draft setup',
					description: 'Start with the exact deal name, sponsor linkage, and a stable slug.',
					fieldKeys: ['investmentName', 'sponsor', 'companyWebsite', 'slug']
				}
			]
		},
		sec: {
			id: 'sec',
			label: 'SEC',
			title: 'Confirm the SEC filing and offering structure',
			description: 'Resolve the issuer, match the filing, or intentionally skip with a reviewer note before you move on.',
			sections: []
		},
		classification: {
			id: 'classification',
			label: 'Classification',
			title: 'Classify the lending fund',
			description: 'Lock the lending strategy, offering structure, exposure types, and investing geography before you refine terms.',
			sections: [
				{
					label: 'Offering setup',
					description: 'Set the legal offering structure and who can invest.',
					fieldKeys: ['dealType', 'offeringType', 'offeringStatus', 'availableTo']
				},
				{
					label: 'Strategy and exposure',
					description: 'Capture the lending strategy, the exposure types, and the states the fund invests in.',
					fieldKeys: ['investmentStrategy', 'underlyingExposureTypes', 'investingStates']
				},
				{
					label: 'Narrative',
					description: 'Write the short summary that will anchor the card and deal page.',
					fieldKeys: ['shortSummary']
				}
			]
		},
		static_terms: {
			id: 'static_terms',
			label: 'Static Terms',
			title: 'Capture the durable fund terms',
			description: 'Keep the durable LP terms in one place, then tuck the extra nuance into an additional details row.',
			sections: [
				{
					label: 'Row 1',
					description: 'These are the LP-facing terms that matter first.',
					fieldKeys: ['investmentMinimum', 'holdPeriod', 'redemption', 'distributions']
				},
				{
					label: 'Row 2',
					description: 'Capture the static economics and reporting quality that show trust and structure.',
					fieldKeys: ['preferredReturn', 'financials']
				},
				{
					label: 'Row 3: Additional Details',
					description: 'Keep the structural nuance visible without forcing it onto the card.',
					fieldKeys: ['lpGpSplit', 'redemptionNotes', 'taxForm', 'additionalTermNotes']
				}
			]
		},
		fees: {
			id: 'fees',
			label: 'Fees',
			title: 'Capture the fee structure',
			description: 'Use this page to capture the actual fee language the sponsor disclosed.',
			sections: [
				{
					label: 'Fees',
					description: 'Document the management, incentive, servicing, redemption, and other fee lines cleanly.',
					fieldKeys: ['fees']
				}
			]
		},
		historical_performance: {
			id: 'historical_performance',
			label: 'Historical Performance',
			title: 'Review annual net returns to LPs',
			description: 'Capture the completed annual return series. The current year stays out until it is complete.',
			sections: [
				{
					label: 'Completed years',
					description: 'Enter the net annual return to LPs for each completed year. Negative values are allowed.',
					fieldKeys: HISTORICAL_RETURN_YEARS.map((year) => `historicalReturn${year}`)
				}
			]
		},
		portfolio_snapshot: {
			id: 'portfolio_snapshot',
			label: 'Snapshot',
			title: 'Capture the current portfolio snapshot',
			description: 'Record the latest dated operating snapshot so the live metrics are understandable.',
			sections: [
				{
					label: 'Snapshot timing',
					description: 'Every changing portfolio metric should have an as-of date.',
					fieldKeys: ['snapshotAsOfDate']
				},
				{
					label: 'Snapshot scale',
					description: 'Capture current size, max size, diversification, and manager scale at this point in time.',
					fieldKeys: ['fundAUM', 'currentFundSize', 'offeringSize', 'loanCount']
				},
				{
					label: 'Snapshot risk metrics',
					description: 'These are the point-in-time leverage and LTV metrics the reviewer should confirm.',
					fieldKeys: ['currentAvgLoanLtv', 'maxAllowedLtv', 'currentLeverage', 'maxAllowedLeverage']
				}
			]
		},
		sponsor_trust: {
			id: 'sponsor_trust',
			label: 'Sponsor Trust',
			title: 'Capture firm-level trust context',
			description: 'Capture the firm and fund founding years that help the LP understand sponsor maturity.',
			sections: [
				{
					label: 'Founding years',
					description: 'Track the firm and fund separately so the card and page can show the right history.',
					fieldKeys: ['firmFoundedYear', 'fundFoundedYear']
				}
			]
		},
		team: {
			id: 'team',
			label: 'Contacts',
			title: 'Add the two contacts an LP will actually use',
			description: 'Confirm the operator lead and the investor relations contact before you publish.',
			sections: []
		},
		risks: {
			id: 'risks',
			label: 'Risks',
			title: 'Review the risk profile',
			description: 'Keep the risk capture taxonomy-first, then add supporting notes only when they help.',
			sections: [
				{
					label: 'Risk tags',
					description: 'Select the standardized risks this fund presents.',
					fieldKeys: ['riskTags']
				},
				{
					label: 'Risk notes',
					description: 'Add supporting context only when the taxonomy needs extra explanation.',
					fieldKeys: ['riskNotes', 'downsideNotes']
				}
			]
		},
		summary: {
			id: 'summary',
			label: 'Summary',
			title: 'Review, edit, and publish',
			description: 'See the whole record in one place before publishing or sending a validation email.',
			sections: []
		}
	};

	function getLendingStageConfig(stageId) {
		return LENDING_STAGE_CONFIGS[stageId] || null;
	}

	function getLendingStages() {
		return LENDING_STAGE_ORDER
			.map((stageId, index) => {
				const config = getLendingStageConfig(stageId);
				if (!config) return null;
				return {
					...config,
					index,
					fieldGroups: (config.sections || []).map((section) => ({
						id: `${stageId}:${section.label}`,
						label: section.label,
						description: section.description,
						fieldKeys: [...(section.fieldKeys || [])]
					})),
					rules: []
				};
			})
			.filter(Boolean);
	}

	function getReviewStages(branch) {
		if (branch === 'lending_fund') {
			return getLendingStages();
		}
		return getDealOnboardingStages({ branch, source: onboardingSource });
	}

	function getReviewStageById(stageId, branch) {
		if (branch === 'lending_fund') {
			return getLendingStageConfig(stageId) || null;
		}
		return getDealOnboardingStageById(stageId, { branch, source: onboardingSource });
	}

	function getReviewPreviousStage(stageId, branch, stages = reviewStages) {
		const index = stages.findIndex((stage) => stage.id === stageId);
		if (index <= 0) return '';
		return stages[index - 1]?.id || '';
	}

	function getReviewNextStage(stageId, branch, stages = reviewStages) {
		const index = stages.findIndex((stage) => stage.id === stageId);
		if (index < 0 || index >= stages.length - 1) return '';
		return stages[index + 1]?.id || '';
	}

	function hasMeaningfulReviewValue(value) {
		if (value === null || value === undefined) return false;
		if (Array.isArray(value)) return value.length > 0;
		if (typeof value === 'object') {
			return Object.values(value).some((entry) => hasMeaningfulReviewValue(entry));
		}
		return String(value).trim() !== '';
	}

	function getLendingHistoricalReturnFieldKeys() {
		return HISTORICAL_RETURN_YEARS.map((year) => `historicalReturn${year}`);
	}

	function getMissingFieldKeys(fieldKeys = []) {
		return fieldKeys.filter((fieldKey) => !hasMeaningfulReviewValue(form[fieldKey]));
	}

	function hasSourceCitationInputs() {
		return Boolean(
			getDocumentUrl('deck')
			|| getDocumentUrl('ppm')
			|| deal?.sec_filing_id
			|| deal?.secFilingId
		);
	}

	function getStageMissingEvidenceFieldKeys(stageId, { requireLoadedEvidence = false, source = onboardingSource } = {}) {
		if (!hasSourceCitationInputs()) return [];

		let fieldKeys = getEvidenceFieldKeysForStage(stageId).filter((fieldKey) => fieldRequiresSourceCitation(fieldKey));
		if (requireLoadedEvidence) {
			fieldKeys = fieldKeys.filter((fieldKey) => reviewFieldEvidenceKnownKeys.has(fieldKey));
		}
		if (fieldKeys.length === 0) return [];

		return getMissingRequiredEvidenceFieldKeys({
			fieldKeys,
			source,
			evidence: reviewFieldEvidence
		});
	}

	function getStagePendingEvidenceFieldKeys(stageId, { source = onboardingSource } = {}) {
		if (!hasSourceCitationInputs()) return [];

		return getEvidenceFieldKeysForStage(stageId)
			.filter((fieldKey) => fieldRequiresSourceCitation(fieldKey))
			.filter((fieldKey) => hasMeaningfulReviewValue(readReviewFieldValue(source, fieldKey)))
			.filter((fieldKey) => !reviewFieldEvidenceKnownKeys.has(fieldKey));
	}

	function isStageEvidencePending(stageId, options = {}) {
		return getStagePendingEvidenceFieldKeys(stageId, options).length > 0;
	}

	function summarizeFieldLabels(fieldKeys = []) {
		const labels = fieldKeys.map((fieldKey) => dealFieldConfig[fieldKey]?.label || fieldKey);
		if (labels.length <= 3) return labels.join(', ');
		return `${labels.slice(0, 2).join(', ')}, +${labels.length - 2} more`;
	}

	function getLendingPublishRules() {
		const classificationFields = ['dealType', 'offeringType', 'offeringStatus', 'availableTo', 'investmentStrategy', 'underlyingExposureTypes', 'investingStates', 'shortSummary'];
		const staticTermFields = ['investmentMinimum', 'holdPeriod', 'redemption', 'distributions', 'financials', 'lpGpSplit'];
		const feeFields = ['fees'];
		const snapshotFields = ['snapshotAsOfDate', 'fundAUM', 'currentFundSize', 'offeringSize', 'loanCount', 'currentAvgLoanLtv', 'maxAllowedLtv', 'currentLeverage', 'maxAllowedLeverage'];
		const sponsorTrustFields = ['firmFoundedYear', 'fundFoundedYear'];
		const riskFields = ['riskTags'];
		const historicalReturnFields = getLendingHistoricalReturnFieldKeys();
		const hasHistoricalReturns = historicalReturnFields.some((fieldKey) => hasMeaningfulReviewValue(form[fieldKey]));

		return [
			{
				id: 'lending_classification',
				label: 'Classification is complete',
				stageId: 'classification',
				fieldKeys: classificationFields,
				satisfied: getMissingFieldKeys(classificationFields).length === 0,
				missingFieldKeys: getMissingFieldKeys(classificationFields)
			},
			{
				id: 'lending_static_terms',
				label: 'Static terms are defined',
				stageId: 'static_terms',
				fieldKeys: staticTermFields,
				satisfied: getMissingFieldKeys(staticTermFields).length === 0,
				missingFieldKeys: getMissingFieldKeys(staticTermFields)
			},
			{
				id: 'lending_fees',
				label: 'Fees are captured',
				stageId: 'fees',
				fieldKeys: feeFields,
				satisfied: getMissingFieldKeys(feeFields).length === 0,
				missingFieldKeys: getMissingFieldKeys(feeFields)
			},
			{
				id: 'lending_historical_returns',
				label: 'Historical returns are loaded',
				stageId: 'historical_performance',
				fieldKeys: historicalReturnFields,
				satisfied: hasHistoricalReturns,
				missingFieldKeys: hasHistoricalReturns ? [] : historicalReturnFields
			},
			{
				id: 'lending_snapshot',
				label: 'Snapshot metrics are dated and complete',
				stageId: 'portfolio_snapshot',
				fieldKeys: snapshotFields,
				satisfied: getMissingFieldKeys(snapshotFields).length === 0,
				missingFieldKeys: getMissingFieldKeys(snapshotFields)
			},
			{
				id: 'lending_sponsor_trust',
				label: 'Sponsor trust details are complete',
				stageId: 'sponsor_trust',
				fieldKeys: sponsorTrustFields,
				satisfied: getMissingFieldKeys(sponsorTrustFields).length === 0,
				missingFieldKeys: getMissingFieldKeys(sponsorTrustFields)
			},
			{
				id: 'lending_risks',
				label: 'Risk taxonomy is captured',
				stageId: 'risks',
				fieldKeys: riskFields,
				satisfied: getMissingFieldKeys(riskFields).length === 0,
				missingFieldKeys: getMissingFieldKeys(riskFields)
			}
		];
	}

	function isReviewStageComplete(stage) {
		if (!stage) return false;
		if (legacyApprovedReviewCompat) {
			return stage.id === 'summary'
				? secCanAdvance && teamContactsValidation.valid
				: true;
		}
		let baseComplete = false;
		if (branchInfo.branch !== 'lending_fund') {
			if (stage.id === 'intake') {
				baseComplete = hasSourceDocuments;
			} else if (stage.id === 'sec') {
				baseComplete = secGateResolved;
			} else if (stage.id === 'team') {
				baseComplete = teamContactsValidation.valid;
			} else {
				baseComplete = (stage.rules || []).every((rule) => rule.satisfied);
			}
			if (!baseComplete) return false;
			return getStageMissingEvidenceFieldKeys(stage.id, { requireLoadedEvidence: true }).length === 0;
		}

		switch (stage.id) {
			case 'intake':
				baseComplete = hasSourceDocuments
					&& hasMeaningfulReviewValue(form.investmentName)
					&& hasMeaningfulReviewValue(form.sponsor?.name)
					&& hasMeaningfulReviewValue(form.companyWebsite);
				break;
			case 'sec':
				baseComplete = secCanAdvance;
				break;
			case 'classification':
				baseComplete = hasMeaningfulReviewValue(form.dealType)
					&& hasMeaningfulReviewValue(form.offeringType)
					&& hasMeaningfulReviewValue(form.offeringStatus)
					&& hasMeaningfulReviewValue(form.availableTo)
					&& hasMeaningfulReviewValue(form.investmentStrategy)
					&& hasMeaningfulReviewValue(form.underlyingExposureTypes)
					&& hasMeaningfulReviewValue(form.investingStates)
					&& hasMeaningfulReviewValue(form.shortSummary);
				break;
			case 'static_terms':
				baseComplete = hasMeaningfulReviewValue(form.investmentMinimum)
					&& hasMeaningfulReviewValue(form.holdPeriod)
					&& hasMeaningfulReviewValue(form.redemption)
					&& hasMeaningfulReviewValue(form.distributions)
					&& hasMeaningfulReviewValue(form.financials)
					&& hasMeaningfulReviewValue(form.lpGpSplit);
				break;
			case 'fees':
				baseComplete = hasMeaningfulReviewValue(form.fees);
				break;
			case 'historical_performance':
				baseComplete = HISTORICAL_RETURN_YEARS.some((year) => hasMeaningfulReviewValue(form[`historicalReturn${year}`]));
				break;
			case 'portfolio_snapshot':
				baseComplete = hasMeaningfulReviewValue(form.snapshotAsOfDate)
					&& hasMeaningfulReviewValue(form.fundAUM)
					&& hasMeaningfulReviewValue(form.currentFundSize)
					&& hasMeaningfulReviewValue(form.offeringSize)
					&& hasMeaningfulReviewValue(form.loanCount)
					&& hasMeaningfulReviewValue(form.currentAvgLoanLtv)
					&& hasMeaningfulReviewValue(form.maxAllowedLtv)
					&& hasMeaningfulReviewValue(form.currentLeverage)
					&& hasMeaningfulReviewValue(form.maxAllowedLeverage);
				break;
			case 'sponsor_trust':
				baseComplete = hasMeaningfulReviewValue(form.firmFoundedYear) && hasMeaningfulReviewValue(form.fundFoundedYear);
				break;
			case 'team':
				baseComplete = teamContactsValidation.valid;
				break;
			case 'risks':
				baseComplete = hasMeaningfulReviewValue(form.riskTags);
				break;
			case 'summary':
				baseComplete = secCanAdvance && teamContactsValidation.valid;
				break;
			default:
				baseComplete = true;
				break;
		}

		if (!baseComplete) return false;
		return getStageMissingEvidenceFieldKeys(stage.id, { requireLoadedEvidence: true }).length === 0;
	}

	function getStageFieldGroups(stage) {
		if (branchInfo.branch === 'lending_fund') {
			return getLendingStageConfig(stage)?.sections || [];
		}
		return getDealOnboardingFieldGroups(stage, { branch: branchInfo.branch, source: onboardingSource });
	}

	function getBranchOptions() {
		return Object.values(DEAL_ONBOARDING_BRANCHES);
	}

	function setManualBranch(branch) {
		manualBranch = branch;
		markDirty();
	}

	function buildOperatorValidationHref() {
		const contact = irTeamContact || primaryTeamContact;
		if (!contact?.email) return '';
		const subject = encodeURIComponent(`Deal validation request: ${form.investmentName || deal?.investment_name || 'Investment details'}`);
		const body = encodeURIComponent(
			`Hi ${contact.firstName || ''},\n\n` +
			`I help clients understand private investments and I’m reviewing ${form.investmentName || deal?.investment_name || 'this opportunity'} for our platform.\n\n` +
			`I’d love to confirm whether the information we currently have is accurate, and whether you would prefer your deals to remain hidden from the public or be discoverable by other LPs researching your company.\n\n` +
			`Could you please review the deck/PPM details and let me know if anything should be corrected?\n\n` +
			`Thank you,\nPascal`
		);
		return `mailto:${encodeURIComponent(contact.email)}?subject=${subject}&body=${body}`;
	}

	function readDealTeamContacts(sourceDeal = deal) {
		const snapshot = sourceDeal?.teamContacts || sourceDeal?.team_contacts || [];
		return normalizeTeamContacts(snapshot, {
			ensureOne: false,
			preserveEmpty: true
		});
	}

	let loading = $state(true);
	let saving = $state(false);
	let loadError = $state('');
	let saveError = $state('');
	let saveMessage = $state('');
	let dirty = $state(false);
	let conflictServerDeal = $state(null);
	let deal = $state(null);
	let deckInputEl = $state(null);
	let ppmInputEl = $state(null);
	let deckFile = $state(null);
	let deckFileBase64 = $state('');
	let ppmFile = $state(null);
	let ppmFileBase64 = $state('');
	let uploadError = $state('');
	let uploadState = $state('idle');
	let form = $state(createEmptyDealReviewForm());
	let fieldWarnings = $state({});
	let fieldErrors = $state({});
	let previousDealId = $state('');
	let extractionState = $state('idle');
	let extractionError = $state('');
	let extractionSummary = $state(null);
	let extractionPreview = $state(null);
	let extractionApplyState = $state('idle');
	let autoExtractionHandled = $state(false);
	let secStageRefreshKey = $state(0);
	let intakeSponsorResults = $state([]);
	let intakeSponsorLoading = $state(false);
	let intakeSponsorOpen = $state(false);
	let intakeSponsorBlurTimer = $state(null);
	let intakeSponsorSearchTimer = $state(null);
	let teamContacts = $state([]);
	let teamContactsError = $state('');
	let teamContactsSaveState = $state('idle');
	let lifecycleSyncState = $state('idle');
	let secVerificationContext = $state(null);
	let secVerificationLoadState = $state('idle');
	let classificationSignals = $state(null);
	let classificationSignalsState = $state('idle');
	let classificationSignalsError = $state('');
	let classificationSignalsDealId = $state('');
	let classificationSignalsAppliedKey = $state('');
	let classificationSignalsAppliedMessage = $state('');
	let reviewFieldEvidenceState = $state('idle');
	let reviewFieldEvidenceLoadedKeys = $state([]);
	let reviewFieldEvidenceError = $state('');
	let sourceRiskFactors = $state([]);
	let highlightedRisks = $state([]);
	let riskFactorDraft = $state('');
	let highlightedRiskDraft = $state('');
	let manualBranch = $state('');
	let editedFieldLogCache = new Set();

	const dealId = $derived($page.url.searchParams.get('id') || '');
	const requestedStage = $derived($page.url.searchParams.get('stage') || '');
	const shouldAutoExtract = $derived($page.url.searchParams.get('extract') === '1');
	const cameFromIntake = $derived($page.url.searchParams.get('from') === 'intake');
	const cameFromQueue = $derived($page.url.searchParams.get('from') === 'queue');
	const allowSummaryPreview = $derived($page.url.searchParams.get('allowSummary') === '1');
	const onboardingSource = $derived({
		...(deal || {}),
		...form,
		sponsorName: form.sponsor?.name || deal?.sponsor_name || deal?.sponsorName || '',
		managementCompanyId: form.sponsor?.id || deal?.management_company_id || deal?.managementCompanyId || '',
		branch: manualBranch || deal?.deal_branch || deal?.dealBranch || '',
		dealBranch: manualBranch || deal?.deal_branch || deal?.dealBranch || ''
	});
	const branchInfo = $derived(resolveDealOnboardingBranch(onboardingSource));
	const reviewStages = $derived(branchInfo.branch === 'lending_fund'
		? getLendingStages()
		: getDealOnboardingStages({ branch: branchInfo.branch, source: onboardingSource }));
	const onboardingStages = $derived.by(() => reviewStages);
	const onboardingFlow = $derived(branchInfo.branch === 'lending_fund'
		? {
			isPublishReady: reviewStages.filter((stage) => stage.id !== 'summary').every((stage) => isReviewStageComplete(stage)),
			publishRules: getLendingPublishRules()
		}
		: buildDealOnboardingFlow(onboardingSource, { branch: branchInfo.branch }));
	const teamContactsValidation = $derived(validateTeamContacts(teamContacts));
	const primaryTeamContact = $derived(pickPrimaryTeamContact(teamContacts));
	const irTeamContact = $derived(pickInvestorRelationsContact(teamContacts));
	const classificationPpmStates = $derived(
		Array.isArray(classificationSignals?.ppmStates) ? classificationSignals.ppmStates : []
	);
	const classificationDeckStates = $derived(
		Array.isArray(classificationSignals?.deckStates) ? classificationSignals.deckStates : []
	);
	const classificationSuggestedStates = $derived(
		Array.isArray(classificationSignals?.suggestedStates) ? classificationSignals.suggestedStates : []
	);
	const classificationCurrentStates = $derived(
		mergeStateCodeLists(Array.isArray(form.investingStates) ? form.investingStates : [])
	);
	const classificationMissingSuggestedStates = $derived(
		classificationSuggestedStates.filter((stateCode) => !classificationCurrentStates.includes(stateCode))
	);
	const classificationExtraStates = $derived(
		classificationCurrentStates.filter((stateCode) => !classificationSuggestedStates.includes(stateCode))
	);
	const secStatus = $derived(secVerificationContext?.view?.currentStatus || 'pending');
	const secGateResolved = $derived(isResolvedSecVerificationStatus(secStatus));
	const secCanAdvance = $derived(secGateResolved || secStatus === 'skipped');
	const currentLifecycleStatus = $derived(resolveDealLifecycleStatus(deal || {}));
	const legacyApprovedReviewCompat = $derived(
		branchInfo.branch === 'lending_fund'
		&& currentLifecycleStatus === 'approved'
		&& deal?.legacyApprovedReviewCompat === true
	);
	const preservesFullReviewAccess = $derived(
		preservesFullReviewAccessForLifecycle(currentLifecycleStatus)
	);
	const hasSourceDocuments = $derived(
		Boolean(deal?.deckUrl || deal?.deck_url || deal?.ppmUrl || deal?.ppm_url)
	);
	const intakeHasAttachedSources = $derived(
		Boolean(deckFile || ppmFile || hasSourceDocuments)
	);
	const canOpenSummaryPreview = $derived(
		canPreviewDealReviewSummary({
			allowSummaryPreview,
			lifecycleStatus: currentLifecycleStatus,
			hasSourceDocuments,
			secCanAdvance,
			teamContactsValid: teamContactsValidation.valid
		})
	);
	const summaryPublishReady = $derived(
		(legacyApprovedReviewCompat || (
			branchInfo.branch === 'lending_fund'
			? reviewStages.filter((stage) => stage.id !== 'summary').every((stage) => isReviewStageComplete(stage))
			: onboardingFlow.isPublishReady))
		&& teamContactsValidation.valid
		&& secGateResolved
	);
	const firstIncompleteStage = $derived.by(() => {
		const incompleteStage = reviewStages.find((stage) => stage.id !== 'summary' && !isReviewStageComplete(stage));
		return incompleteStage?.id || 'summary';
	});
	const furthestUnlockedStage = $derived.by(() => {
		if (!deal) return requestedStage || 'intake';
		if (branchInfo.branch === 'lending_fund') return firstIncompleteStage;
		if (['overview', 'details', 'risks'].includes(firstIncompleteStage)) return 'risks';
		return firstIncompleteStage;
	});
	const unlockedStageIds = $derived.by(() => {
		if (!deal) return requestedStage ? [requestedStage] : ['intake'];
		if (preservesFullReviewAccess) {
			return reviewStages.map((stage) => stage.id);
		}
		if (firstIncompleteStage === 'summary') {
			return reviewStages.map((stage) => stage.id);
		}
		if (branchInfo.branch === 'lending_fund') {
			const unlockedIndex = reviewStages.findIndex((candidate) => candidate.id === furthestUnlockedStage);
			if (unlockedIndex < 0) return ['intake'];
			const unlockedIds = reviewStages
				.filter((stage, index) => index <= unlockedIndex)
				.map((stage) => stage.id);
			if (canOpenSummaryPreview && requestedStage === 'summary' && !unlockedIds.includes('summary')) {
				return [...unlockedIds, 'summary'];
			}
			return unlockedIds;
		}
		if (['overview', 'details', 'risks'].includes(firstIncompleteStage)) {
			const unlockedIds = reviewStages
				.filter((stage) => stage.id !== 'summary')
				.map((stage) => stage.id);
			if (canOpenSummaryPreview && requestedStage === 'summary' && !unlockedIds.includes('summary')) {
				return [...unlockedIds, 'summary'];
			}
			return unlockedIds;
		}
		const unlockedIndex = reviewStages.findIndex((candidate) => candidate.id === furthestUnlockedStage);
		if (unlockedIndex < 0) return ['intake'];
		const unlockedIds = reviewStages
			.filter((stage, index) => index <= unlockedIndex)
			.map((stage) => stage.id);
		if (canOpenSummaryPreview && requestedStage === 'summary' && !unlockedIds.includes('summary')) {
			return [...unlockedIds, 'summary'];
		}
		return unlockedIds;
	});
	const activeStage = $derived.by(() => {
		if (requestedStage === 'summary' && canOpenSummaryPreview) return 'summary';
		if (!requestedStage) return firstIncompleteStage;
		if (branchInfo.branch !== 'lending_fund' && !isValidOnboardingStage(requestedStage)) return firstIncompleteStage;
		if (branchInfo.branch === 'lending_fund' && !reviewStages.some((stage) => stage.id === requestedStage)) return firstIncompleteStage;
		return unlockedStageIds.includes(requestedStage) ? requestedStage : firstIncompleteStage;
	});
	const reviewFooterBusy = $derived.by(() => {
		if (saving || teamContactsSaveState === 'running' || extractionState === 'running' || extractionApplyState === 'running') return true;
		if (activeStage === 'sec' && secVerificationLoadState === 'running') return true;
		if (activeStage === 'classification' && classificationSignalsState === 'running') return true;
		if (lifecycleSyncState === 'running') return true;
		return false;
	});
	const activeStageConfig = $derived(
		branchInfo.branch === 'lending_fund'
			? getReviewStageById(activeStage, branchInfo.branch)
			: getDealOnboardingStageById(activeStage, { branch: branchInfo.branch, source: onboardingSource })
	);
	const previousStage = $derived(
		branchInfo.branch === 'lending_fund'
			? getReviewPreviousStage(activeStage, branchInfo.branch, reviewStages)
			: getPreviousOnboardingStage(activeStage, branchInfo.branch)
	);
	const nextStage = $derived(
		branchInfo.branch === 'lending_fund'
			? getReviewNextStage(activeStage, branchInfo.branch, reviewStages)
			: getNextOnboardingStage(activeStage, branchInfo.branch)
	);
	const completedStageIds = $derived(
		reviewStages
			.filter((stage) =>
				stage.index < reviewStages.findIndex((candidate) => candidate.id === activeStage)
				&& isReviewStageComplete(stage)
			)
			.map((stage) => stage.id)
	);
	const sidebarCurrentStage = $derived(activeStage);
	const sidebarCompletedStages = $derived(completedStageIds);
	const sidebarAccessibleStages = $derived(unlockedStageIds);
	const reviewWorkspaceTitle = $derived(activeStageConfig?.title || 'Review extracted deal details');
	const backHref = $derived($isAdmin ? '/app/admin/manage' : ($isGP ? '/gp-dashboard' : '/app/deals'));
	const backLabel = $derived($isAdmin ? 'Back to Queue' : ($isGP ? 'Back to Dashboard' : 'Back to Deals'));
	const pageSubtitle = $derived(
		activeStage === 'intake'
			? 'Upload the source documents first, then review and clean up the extracted deal details.'
			: activeStageConfig?.description || 'Fix missing fields, tighten source context, and move the deal toward publishing with confidence.'
	);
	const stageMetaById = $derived.by(() => new Map(reviewStages.map((stage) => [stage.id, stage])));
	const fieldStageLabels = $derived.by(() => {
		const labels = new Map();
		for (const stage of reviewStages) {
			for (const group of stage.fieldGroups || []) {
				for (const fieldKey of group.fieldKeys || []) {
					if (!labels.has(fieldKey)) {
						labels.set(fieldKey, stage.label);
					}
				}
			}
		}
		return labels;
	});
	const fieldStageIds = $derived.by(() => {
		const ids = new Map();
		for (const stage of reviewStages) {
			for (const group of stage.fieldGroups || []) {
				for (const fieldKey of group.fieldKeys || []) {
					if (!ids.has(fieldKey)) {
						ids.set(fieldKey, stage.id);
					}
				}
			}
		}
		return ids;
	});
	const reviewDocumentUrls = $derived({
		deckUrl: getDocumentUrl('deck') || form.deckUrl,
		ppmUrl: getDocumentUrl('ppm') || form.ppmUrl,
		subAgreementUrl: deal?.subAgreementUrl || deal?.sub_agreement_url || ''
	});
	const reviewFieldState = $derived(
		normalizeReviewFieldStateMap(deal?.reviewFieldState || deal?.review_field_state || {})
	);
	const reviewStateVersion = $derived(Number(deal?.reviewStateVersion || deal?.review_state_version || 0));
	const reviewFieldEvidence = $derived(
		normalizeReviewFieldEvidenceMap(deal?.reviewFieldEvidence || deal?.review_field_evidence || {})
	);
	const currentStageExtractionFieldKeys = $derived.by(() => {
		const fieldKeys = getSaveFieldKeysForStage(activeStage);
		return Array.isArray(fieldKeys) ? Array.from(new Set(fieldKeys.filter(Boolean))) : [];
	});
	const saveStatusLabel = $derived.by(() => {
		if (saving || teamContactsSaveState === 'running' || extractionApplyState === 'running' || lifecycleSyncState === 'running') {
			return 'Saving...';
		}
		if (extractionState === 'running') return 'Extracting...';
		if (saveError) {
			return 'Save failed';
		}
		return dirty ? 'Unsaved changes' : 'Saved';
	});
	const saveStatusTone = $derived.by(() => {
		if (saving || teamContactsSaveState === 'running' || extractionApplyState === 'running' || lifecycleSyncState === 'running' || extractionState === 'running') return 'pending';
		if (saveError) return 'error';
		return dirty ? 'warning' : 'success';
	});
	const extractionPreviewLockedFieldKeys = $derived.by(() =>
		extractionPreview
			? extractionPreview.items
				.filter((item) => item.adminLocked)
				.map((item) => item.fieldKey)
			: []
	);
	const reviewFieldEvidenceKnownKeys = $derived.by(() =>
		new Set([
			...reviewFieldEvidenceLoadedKeys,
			...Object.keys(reviewFieldEvidence)
		])
	);
	const summaryEvidencePending = $derived.by(() => {
		if (loading || !deal || activeStage !== 'summary' || !hasSourceCitationInputs()) return false;
		return reviewStages.some((stage) =>
			!['intake', 'summary', 'team', 'sec'].includes(stage.id)
			&& isStageEvidencePending(stage.id)
		);
	});
	const summaryRelevantWarningFieldKeys = $derived.by(() => {
		const keys = new Set();
		for (const stage of reviewStages) {
			for (const group of stage.fieldGroups || []) {
				for (const fieldKey of group.fieldKeys || []) {
					keys.add(fieldKey);
				}
			}
		}
		for (const rule of onboardingFlow.publishRules || []) {
			for (const fieldKey of rule.fieldKeys || []) {
				keys.add(fieldKey);
			}
		}
		return keys;
	});
	const visibleSchemaWarnings = $derived.by(() => {
		const warningEntries = Object.entries(fieldWarnings).filter(([, message]) => Boolean(message));
		if (warningEntries.length === 0) return [];
		if (activeStage === 'summary') {
			return warningEntries.filter(([fieldKey]) => summaryRelevantWarningFieldKeys.has(fieldKey));
		}

		const stageFieldKeys = new Set(
			getStageFieldGroups(activeStage)
				.flatMap((group) => Array.isArray(group?.fieldKeys) ? group.fieldKeys : [])
		);
		return warningEntries.filter(([fieldKey]) => stageFieldKeys.has(fieldKey));
	});
	const visibleSchemaWarningLabels = $derived.by(() =>
		visibleSchemaWarnings.map(([fieldKey]) => {
			const fieldLabel = dealFieldConfig[fieldKey]?.label || fieldKey;
			if (activeStage !== 'summary') return fieldLabel;
			const stageLabel = fieldStageLabels.get(fieldKey);
			return stageLabel ? `${fieldLabel} (${stageLabel})` : fieldLabel;
		})
	);
	const schemaWarningMessage = $derived.by(() => {
		if (visibleSchemaWarnings.length === 0) return '';

		const labelSummary = visibleSchemaWarningLabels.length <= 3
			? visibleSchemaWarningLabels.join(', ')
			: `${visibleSchemaWarningLabels.slice(0, 2).join(', ')}, +${visibleSchemaWarningLabels.length - 2} more`;

		return activeStage === 'summary'
			? `Imported values still need normalization before publishing: ${labelSummary}. Use Edit on the matching stage and choose the closest canonical options.`
			: `Imported values in this step still need normalization: ${labelSummary}. Choose the closest canonical options before moving on.`;
	});

	function getStageLabel(stageId) {
		return stageMetaById.get(stageId)?.label || '';
	}

	function getRuleTargetStage(rule) {
		const candidateFieldKeys = [
			...(Array.isArray(rule?.missingFieldKeys) ? rule.missingFieldKeys : []),
			...(Array.isArray(rule?.fieldKeys) ? rule.fieldKeys : [])
		];

		for (const fieldKey of candidateFieldKeys) {
			const stageId = fieldStageIds.get(fieldKey);
			if (stageId) return stageId;
		}

		if (rule?.stageId && rule.stageId !== 'summary') return rule.stageId;
		return 'summary';
	}

	function getRuleActionLabel(rule) {
		const stageId = getRuleTargetStage(rule);
		const stageLabel = getStageLabel(stageId);
		return stageLabel ? `Open ${stageLabel}` : 'Open';
	}

	function getPublishRuleState(rule) {
		const stageId = rule?.stageId || '';
		if (stageId && isStageEvidencePending(stageId)) return 'pending';
		if (stageId) {
			const stage = reviewStages.find((candidate) => candidate.id === stageId);
			if (stage) {
				return isReviewStageComplete(stage) ? 'ready' : 'blocked';
			}
		}
		return rule?.satisfied ? 'ready' : 'blocked';
	}

	function getPublishRuleSummary(rule) {
		const stageId = rule?.stageId || '';
		if (stageId && isStageEvidencePending(stageId)) {
			const pendingCount = getStagePendingEvidenceFieldKeys(stageId).length;
			return `${pendingCount} citation${pendingCount === 1 ? ' is' : 's are'} still loading`;
		}
		if (stageId) {
			const missingCitationFieldKeys = getStageMissingEvidenceFieldKeys(stageId, { requireLoadedEvidence: true });
			if (missingCitationFieldKeys.length > 0) {
				return `${missingCitationFieldKeys.length} citation${missingCitationFieldKeys.length === 1 ? ' is' : 's are'} still missing`;
			}
		}
		return rule?.satisfied ? 'Ready' : `${rule?.missingFieldKeys?.length || 0} fields still missing`;
	}

	function getPublishRuleStatusLabel(rule) {
		const state = getPublishRuleState(rule);
		if (state === 'pending') return 'Checking';
		return state === 'ready' ? 'Ready' : 'Needs review';
	}

	function buildDealPatchBody(payload = {}) {
		return {
			...payload,
			reviewStateVersion
		};
	}

	function resolveDealPatchFailure(payload, fallbackMessage = 'Failed to save deal.') {
		if (payload?.code !== 'review_state_conflict') {
			conflictServerDeal = null;
		}
		if (payload?.code === 'review_state_conflict') {
			conflictServerDeal = payload?.deal || null;
			return 'This deal changed after you loaded it. Your local edits are still here, but the save was blocked to protect newer data. Load the latest saved version before saving again.';
		}
		if (payload?.code === 'review_schema_mismatch') {
			return payload?.error || 'This deal is missing required review-schema support, so the save was blocked to prevent silent data loss.';
		}
		return payload?.error || fallbackMessage;
	}

	async function loadLatestServerDeal() {
		if (!conflictServerDeal) return false;
		if (!confirmDiscardUnsavedChanges()) return false;
		syncDealState(conflictServerDeal, { clearSaveMessage: true });
		saveMessage = 'Loaded the latest saved version of this deal.';
		return true;
	}

	function confirmDiscardUnsavedChanges() {
		if (!browser || !dirty) return true;
		return window.confirm('You have unsaved changes that will be lost if you leave this page.');
	}

	async function navigateBack() {
		if (!confirmDiscardUnsavedChanges()) return false;
		await goto(backHref);
		return true;
	}

	function logFieldEdit(fieldKey) {
		if (!fieldKey || editedFieldLogCache.has(fieldKey)) return;
		editedFieldLogCache.add(fieldKey);
		console.info('[deal-review/edit]', {
			dealId,
			fieldKey,
			reviewStateVersion
		});
	}

	function formatPreviewValue(fieldKey, value) {
		if (value === null || value === undefined || value === '') return 'Blank';
		if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : 'Blank';
		if (value && typeof value === 'object') {
			if ('city' in value || 'state' in value || 'country' in value) {
				return [value.city, value.state, value.country].filter(Boolean).join(', ') || 'Blank';
			}
			if (Array.isArray(value)) return value.join(', ');
			return JSON.stringify(value);
		}
		return String(formatDealReviewFieldDisplay(fieldKey, value) || 'Blank');
	}

	function buildExtractionPreview(updates = {}, { scopeLabel = 'whole deal', fieldKeys = [] } = {}) {
		const items = Object.entries(updates)
			.map(([rawFieldKey, nextValue]) => {
				const fieldKey = dealFieldConfig[rawFieldKey] ? rawFieldKey : getReviewFieldKeyForColumn(rawFieldKey);
				if (!fieldKey) return null;
				return {
					fieldKey,
					rawFieldKey,
					label: getReviewFieldLabel(fieldKey),
					currentValue: form[fieldKey],
					extractedValue: nextValue,
					adminLocked: hasActiveAdminOverride(reviewFieldState[fieldKey])
				};
			})
			.filter(Boolean);

		return {
			scopeLabel,
			fieldKeys,
			rawUpdates: updates,
			items
		};
	}

	function buildExtractionPreviewFromItems(preview, items = []) {
		if (!preview || items.length === 0) return null;
		return {
			...preview,
			fieldKeys: items.map((item) => item.fieldKey),
			rawUpdates: Object.fromEntries(
				items.map((item) => [item.rawFieldKey, preview.rawUpdates[item.rawFieldKey]])
			),
			items
		};
	}

	function markDirty() {
		dirty = true;
		saveMessage = '';
	}

	function applyFormPatch(patch, { shouldMarkDirty = true } = {}) {
		const nextForm = {
			...form,
			...patch
		};
		const patchedFieldKeys = Object.keys(patch);

		if (branchInfo.branch === 'lending_fund' && patchedFieldKeys.includes('offeringType')) {
			const normalizedOfferingType = String(nextForm.offeringType || '').trim().toLowerCase();
			if (normalizedOfferingType === '506(c)') {
				nextForm.availableTo = 'Accredited Investors';
			} else if (normalizedOfferingType === '506(b)') {
				nextForm.availableTo = 'Both';
			}
		}
		if (branchInfo.branch === 'lending_fund' && !hasMeaningfulReviewValue(nextForm.assetClass)) {
			nextForm.assetClass = 'Private Debt / Credit';
		}

		form = nextForm;
		fieldErrors = {
			...fieldErrors,
			...Object.fromEntries(patchedFieldKeys.map((fieldKey) => [fieldKey, '']))
		};
		fieldWarnings = {
			...fieldWarnings,
			...Object.fromEntries(
				patchedFieldKeys.map((fieldKey) => [fieldKey, getDealReviewFieldWarning(fieldKey, nextForm[fieldKey])])
			)
		};
		if (extractionPreview) {
			extractionPreview = {
				...extractionPreview,
				items: extractionPreview.items.map((item) => (
					patchedFieldKeys.includes(item.fieldKey)
						? {
							...item,
							currentValue: nextForm[item.fieldKey]
						}
						: item
				))
			};
		}

		if (shouldMarkDirty) {
			patchedFieldKeys.forEach((fieldKey) => logFieldEdit(fieldKey));
			markDirty();
		}
	}

	function updateField(fieldKey, nextValue) {
		applyFormPatch({
			[fieldKey]: nextValue
		});
	}

	function applyClassificationSuggestions({ auto = false } = {}) {
		const nextInvestingStates = mergeStateCodeLists(classificationCurrentStates, classificationSuggestedStates);
		if (nextInvestingStates.length === 0) return;

		applyFormPatch({
			investingStates: nextInvestingStates
		});
		classificationSignalsAppliedMessage = auto
			? `Added ${classificationMissingSuggestedStates.length} source-backed state${classificationMissingSuggestedStates.length === 1 ? '' : 's'} to the current selection.`
			: 'Applied the source-backed geography suggestion to Classification.';
	}

	function updateIntakeSponsorName(nextName) {
		const sponsor = form.sponsor || { id: '', name: '', createIfMissing: false };
		const trimmedName = String(nextName || '').trim();
		const keepLinkedRecord =
			Boolean(sponsor.id) &&
			trimmedName.toLowerCase() === String(sponsor.name || '').trim().toLowerCase();
		updateField('sponsor', {
			id: keepLinkedRecord ? sponsor.id : '',
			name: nextName,
			createIfMissing: false
		});
		queueIntakeSponsorSearch(nextName);
	}

	async function runIntakeSponsorSearch(query) {
		const trimmed = String(query || '').trim();
		if (trimmed.length < 2) {
			intakeSponsorResults = [];
			intakeSponsorLoading = false;
			return;
		}

		intakeSponsorLoading = true;
		try {
			const response = await fetch(`/api/company-search?q=${encodeURIComponent(trimmed)}`);
			const payload = await response.json().catch(() => ({}));
			intakeSponsorResults = Array.isArray(payload?.results) ? payload.results : [];
		} catch {
			intakeSponsorResults = [];
		} finally {
			intakeSponsorLoading = false;
		}
	}

	function queueIntakeSponsorSearch(query) {
		if (intakeSponsorSearchTimer) clearTimeout(intakeSponsorSearchTimer);
		intakeSponsorOpen = true;
		intakeSponsorSearchTimer = setTimeout(() => {
			void runIntakeSponsorSearch(query);
		}, 180);
	}

	function closeIntakeSponsorMenuSoon() {
		if (intakeSponsorBlurTimer) clearTimeout(intakeSponsorBlurTimer);
		intakeSponsorBlurTimer = setTimeout(() => {
			intakeSponsorOpen = false;
		}, 140);
	}

	function cancelIntakeSponsorBlur() {
		if (intakeSponsorBlurTimer) clearTimeout(intakeSponsorBlurTimer);
	}

	function selectIntakeSponsor(result) {
		intakeSponsorResults = [];
		intakeSponsorOpen = false;
		form = {
			...form,
			sponsor: {
				id: result?.id || '',
				name: result?.operator_name || result?.name || '',
				createIfMissing: false
			},
			companyWebsite: form.companyWebsite || result?.website || ''
		};
		fieldErrors = {
			...fieldErrors,
			sponsor: ''
		};
		dirty = true;
		saveMessage = '';
	}

	function createIntakeSponsor() {
		const nextName = String(form.sponsor?.name || '').trim();
		if (!nextName) return;
		intakeSponsorResults = [];
		intakeSponsorOpen = false;
		updateField('sponsor', {
			id: '',
			name: nextName,
			createIfMissing: true
		});
	}

	function intakeSponsorLabel(result) {
		const name = result?.operator_name || result?.name || 'Unknown sponsor';
		const detail = [result?.type, Array.isArray(result?.asset_classes) ? result.asset_classes[0] : '']
			.filter(Boolean)
			.join(' · ');
		return detail ? `${name} — ${detail}` : name;
	}

	function getDocumentUrl(kind) {
		if (kind === 'deck') return String(deal?.deckUrl || deal?.deck_url || '').trim();
		if (kind === 'ppm') return String(deal?.ppmUrl || deal?.ppm_url || '').trim();
		return '';
	}

	function getDocumentName(url, fallbackLabel) {
		const trimmed = String(url || '').trim();
		if (!trimmed) return fallbackLabel;
		try {
			const parsed = new URL(trimmed);
			const filename = decodeURIComponent(parsed.pathname.split('/').pop() || '');
			return filename || fallbackLabel;
		} catch {
			return fallbackLabel;
		}
	}

	function generateSlug() {
		updateField('slug', slugify(form.investmentName));
	}

	function listFromDealValue(nextDeal, snakeKey, camelKey) {
		if (Array.isArray(nextDeal?.[snakeKey])) return nextDeal[snakeKey];
		if (Array.isArray(nextDeal?.[camelKey])) return nextDeal[camelKey];
		return [];
	}

	function syncDealState(nextDeal, { clearSaveMessage = false } = {}) {
		if (!nextDeal) return;
		deal = nextDeal;
		const hydrated = createDealReviewFormFromDeal(nextDeal);
		form = hydrated.form;
		teamContacts = normalizeTeamContacts(readDealTeamContacts(nextDeal), {
			ensureOne: false,
			preserveEmpty: true
		});
		fieldWarnings = hydrated.warnings;
		fieldErrors = {};
		manualBranch = nextDeal?.deal_branch || nextDeal?.dealBranch || manualBranch || '';
		sourceRiskFactors = listFromDealValue(nextDeal, 'source_risk_factors', 'sourceRiskFactors');
		highlightedRisks = listFromDealValue(nextDeal, 'highlighted_risks', 'highlightedRisks');
		reviewFieldEvidenceLoadedKeys = Object.keys(
			normalizeReviewFieldEvidenceMap(nextDeal?.reviewFieldEvidence || nextDeal?.review_field_evidence || {})
		);
		reviewFieldEvidenceError = '';
		dirty = false;
		saveError = '';
		conflictServerDeal = null;
		extractionPreview = null;
		editedFieldLogCache = new Set();
		console.info('[deal-review/load]', {
			dealId: nextDeal?.id || dealId,
			reviewStateVersion: Number(nextDeal?.reviewStateVersion || nextDeal?.review_state_version || 0),
			reviewFieldStateCount: Object.keys(
				normalizeReviewFieldStateMap(nextDeal?.reviewFieldState || nextDeal?.review_field_state || {})
			).length
		});
		if (clearSaveMessage) {
			saveMessage = '';
		}
	}

	function resetForm() {
		if (!deal) return;
		const hydrated = createDealReviewFormFromDeal(deal);
		form = hydrated.form;
		fieldWarnings = hydrated.warnings;
		fieldErrors = {};
		dirty = false;
		saveError = '';
		saveMessage = '';
	}

	function buildReviewHref({ stage = 'sec', extract = false, from = '' } = {}) {
		const params = new URLSearchParams({ id: dealId });
		params.set('stage', stage);
		if (from) params.set('from', from);
		if (extract) params.set('extract', '1');
		return `/deal-review?${params.toString()}`;
	}

	function clearExtractionFlags() {
		if (!browser) return;
		const nextUrl = new URL(window.location.href);
		nextUrl.searchParams.delete('extract');
		window.history.replaceState(window.history.state, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
	}

	async function readFileAsBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (event) => {
				const value = String(event?.target?.result || '');
				resolve(value.includes(',') ? value.split(',')[1] : value);
			};
			reader.onerror = () => reject(new Error('Could not read file.'));
			reader.readAsDataURL(file);
		});
	}

	async function setUploadFile(file, type) {
		if (!file) return;
		if (file.size > 25 * 1024 * 1024) {
			uploadError = 'File too large. Maximum size is 25MB.';
			return;
		}

		const base64 = await readFileAsBase64(file);
		if (type === 'deck') {
			deckFile = file;
			deckFileBase64 = base64;
		} else {
			ppmFile = file;
			ppmFileBase64 = base64;
		}
		uploadError = '';
	}

	function handleDrop(event, type) {
		event.preventDefault();
		const [file] = event.dataTransfer?.files || [];
		if (file) {
			void setUploadFile(file, type);
		}
	}

	function getActorFromSession() {
		const session = getStoredSessionUser() || {};
		const realAdmin = currentAdminRealUser();
		const actorEmail = String(realAdmin?.email || session.email || '').trim().toLowerCase();
		const actorName = String(
			realAdmin?.name ||
			realAdmin?.fullName ||
			session.name ||
			session.fullName ||
			''
		).trim();
		const managementCompanyId = session.managementCompany?.id || session.managementCompanyId || null;

		return {
			session,
			actorEmail,
			actorName,
			managementCompanyId
		};
	}

	async function uploadDocument({ base64, file, docType, actor }) {
		if (!file) {
			return { payload: null, warning: null };
		}
		if (!actor.session?.token) {
			return {
				payload: null,
				warning: 'Your session is missing the upload token needed for documents.'
			};
		}

		const dealName = docType === 'ppm'
			? `${form.investmentName || deal?.investmentName || deal?.investment_name || 'Deal'} - PPM`
			: form.investmentName || deal?.investmentName || deal?.investment_name || 'Deal';
		const authHeaders = { Authorization: `Bearer ${actor.session.token}` };

		// For large files (>3.5 MB), upload directly to storage to avoid Vercel body limit
		const DIRECT_UPLOAD_THRESHOLD = 3.5 * 1024 * 1024;
		if (file.size > DIRECT_UPLOAD_THRESHOLD) {
			try {
				// Step 1: Get a signed upload URL
				const urlResp = await fetch('/api/deck-upload-url', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...authHeaders },
					body: JSON.stringify({ dealId, dealName, filename: file.name, docType })
				});
				const urlData = await urlResp.json().catch(() => ({}));
				if (!urlResp.ok || !urlData.signedUrl) {
					return { payload: null, warning: urlData?.error || 'Could not get upload URL for large file.' };
				}

				// Step 2: Upload file directly to Supabase Storage
				const storageResp = await fetch(urlData.signedUrl, {
					method: 'PUT',
					headers: { 'Content-Type': urlData.contentType || 'application/octet-stream' },
					body: file
				});
				if (!storageResp.ok) {
					const errText = await storageResp.text().catch(() => '');
					return { payload: null, warning: `Storage upload failed (${storageResp.status}): ${errText}` };
				}

				// Step 3: Call deck-upload with metadata only (no filedata) to link + enrich
				const metaResp = await fetch('/api/deck-upload', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', ...authHeaders },
					body: JSON.stringify({
						dealId,
						dealName,
						storagePath: urlData.path,
						filename: file.name,
						docType,
						userEmail: actor.actorEmail,
						userName: actor.actorName,
						companyId: actor.managementCompanyId || ''
					})
				});
				const metaData = await metaResp.json().catch(() => ({}));
				if (metaResp.ok) return { payload: metaData, warning: null };
				return { payload: metaData, warning: metaData?.error || `Could not link the ${docType.toUpperCase()} file.` };
			} catch (err) {
				return { payload: null, warning: `Upload failed: ${err.message}` };
			}
		}

		// Standard base64 upload for small files
		if (!base64) return { payload: null, warning: null };

		const response = await fetch('/api/deck-upload', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', ...authHeaders },
			body: JSON.stringify({
				dealId,
				dealName,
				filedata: base64,
				filename: file.name,
				docType,
				userEmail: actor.actorEmail,
				userName: actor.actorName,
				companyId: actor.managementCompanyId || ''
			})
		});

		const data = await response.json().catch(() => ({}));
		if (response.ok) {
			return {
				payload: data,
				warning: null
			};
		}
		return {
			payload: data,
			warning: data?.error || `Could not upload the ${docType.toUpperCase()} file.`
		};
	}

	async function continueFromIntake({ autoExtract = true } = {}) {
		if (!dealId || uploadState === 'running') return;

		const hasExistingSource = Boolean(deal?.deckUrl || deal?.deck_url || deal?.ppmUrl || deal?.ppm_url);
		if (autoExtract && !deckFile && !ppmFile && !hasExistingSource) {
			uploadError = 'Upload a deck or PPM before continuing with extraction, or skip extraction.';
			return;
		}

		uploadState = 'running';
		uploadError = '';

		try {
			await saveIntakeDetails();
			let nextDealState = deal ? { ...deal } : null;

			if (deckFile || ppmFile) {
				const actor = getActorFromSession();
				if (actor.session?.token) {
					const tokenState = await ensureSessionUserToken(actor.session);
					if (tokenState?.session) {
						actor.session = tokenState.session;
					}
				}

				const warnings = [];
				const deckUpload = await uploadDocument({
					base64: deckFileBase64,
					file: deckFile,
					docType: 'deck',
					actor
				});
				if (deckUpload.warning) warnings.push(deckUpload.warning);
				if (deckUpload.payload?.driveUrl) {
					nextDealState = {
						...(nextDealState || {}),
						deck_url: deckUpload.payload.driveUrl,
						deckUrl: deckUpload.payload.driveUrl
					};
				}

				const ppmUpload = await uploadDocument({
					base64: ppmFileBase64,
					file: ppmFile,
					docType: 'ppm',
					actor
				});
				if (ppmUpload.warning) warnings.push(ppmUpload.warning);
				if (ppmUpload.payload?.driveUrl) {
					nextDealState = {
						...(nextDealState || {}),
						ppm_url: ppmUpload.payload.driveUrl,
						ppmUrl: ppmUpload.payload.driveUrl
					};
				}

				if (warnings.length > 0) {
					throw new Error(warnings.join('\n'));
				}
			}

			if (nextDealState) {
				syncDealState(nextDealState);
			}
			autoExtractionHandled = false;
			await goto(buildReviewHref({ stage: 'sec', extract: autoExtract, from: cameFromQueue ? 'queue' : 'intake' }), {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		} catch (error) {
			uploadError = error?.message || 'Could not attach the source documents.';
		} finally {
			uploadState = 'idle';
		}
	}

	async function saveIntakeDetails() {
		const sponsorName = String(form.sponsor?.name || '').trim();
		const sponsorId = String(form.sponsor?.id || '').trim();
		const intakePayload = {
			investmentName: form.investmentName,
			sponsorName,
			managementCompanyId: sponsorId,
			createManagementCompany: Boolean(form.sponsor?.createIfMissing && sponsorName && !sponsorId),
			companyWebsite: form.companyWebsite,
			slug: form.slug || slugify(form.investmentName)
		};

		const token = await getFreshSessionToken();
		if (!token) throw new Error('You need an active session to continue.');

		const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify(buildDealPatchBody(intakePayload))
		});
		const payload = await response.json().catch(() => ({}));

		if (!response.ok || !payload?.deal) {
			throw new Error(resolveDealPatchFailure(payload, 'Could not save the intake details.'));
		}

		console.info('[deal-review/save]', {
			dealId,
			scope: 'intake',
			reviewStateVersion
		});
		syncDealState({
			...(deal || {}),
			...payload.deal
		});
	}

	function getManagementCompanyId() {
		return String(
			form.sponsor?.id
			|| deal?.management_company_id
			|| deal?.managementCompanyId
			|| ''
		).trim();
	}

	async function loadTeamContacts() {
		teamContactsError = '';
		const managementCompanyId = getManagementCompanyId();
		const dealSnapshotContacts = readDealTeamContacts();
		let savedContacts = dealSnapshotContacts;
		let suggestionWarnings = [];
		let token = '';

		try {
			token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to load team contacts.');

			if (managementCompanyId) {
				const response = await fetch(`/api/management-companies/${encodeURIComponent(managementCompanyId)}/settings`, {
					headers: {
						Authorization: `Bearer ${token}`
					}
				});
				const payload = await response.json().catch(() => ({}));
				if (!response.ok) {
					throw new Error(payload?.error || 'Could not load the management company contacts.');
				}

				savedContacts = pickDealReviewInitialTeamContacts({
					dealContacts: dealSnapshotContacts,
					companyContacts: payload.teamContacts || payload.team_contacts || []
				});
			}
		} catch (error) {
			console.error('[deal-review/team] load failed', {
				dealId,
				managementCompanyId,
				message: error?.message || 'unknown_error'
			});
			teamContactsError = error?.message || 'Could not load the team contacts.';
			teamContacts = normalizeTeamContacts(savedContacts, {
				ensureOne: false,
				preserveEmpty: true
			});
		}

		teamContacts = normalizeTeamContacts(savedContacts, {
			ensureOne: false,
			preserveEmpty: true
		});

		if (!token) {
			return;
		}

		try {
			const suggestionResponse = await fetch('/api/deal-team-contacts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({ dealId })
			});
			const suggestionPayload = await suggestionResponse.json().catch(() => ({}));
			if (!suggestionResponse.ok) {
				throw new Error(suggestionPayload?.error || 'Could not build team contact suggestions.');
			}

			suggestionWarnings = Array.isArray(suggestionPayload?.warnings) ? suggestionPayload.warnings : [];
			const mergedState = mergeSuggestedTeamContacts(teamContacts, suggestionPayload?.contacts || [], {
				appendUnmatched: 'required_roles_only'
			});
			teamContacts = normalizeTeamContacts(mergedState.contacts, {
				ensureOne: false,
				preserveEmpty: true
			});

			console.info('[deal-review/team] extraction payload', {
				dealId,
				candidateCount: Array.isArray(suggestionPayload?.contacts) ? suggestionPayload.contacts.length : 0,
				operatorLeadContactId: suggestionPayload?.operatorLeadContactId || '',
				investorRelationsContactId: suggestionPayload?.investorRelationsContactId || '',
				samePersonHandlesBothRoles: suggestionPayload?.samePersonHandlesBothRoles === true,
				warnings: suggestionWarnings
			});
			if (suggestionPayload?.diagnostics) {
				console.info('[deal-review/team] extraction diagnostics', {
					dealId,
					diagnostics: suggestionPayload.diagnostics
				});
			}
			if (mergedState.decisions.length > 0) {
				console.info('[deal-review/team] mapping decisions', {
					dealId,
					decisions: mergedState.decisions
				});
			}
		} catch (error) {
			console.error('[deal-review/team] optional enrichment failed', {
				dealId,
				message: error?.message || 'unknown_error'
			});
			if (!teamContactsError) {
				teamContactsError = 'We could not enrich team contacts from the source documents automatically. You can still review and edit the team manually.';
			}
			return;
		}

		if (suggestionWarnings.length > 0 && !teamContactsError) {
			teamContactsError = 'Some source-document contact details could not be enriched automatically. You can still review and edit the team manually.';
		}
	}

	async function saveTeamContacts({ quiet = false, requireComplete = false } = {}) {
		const validation = validateTeamContacts(teamContacts, {
			mode: requireComplete ? 'continue' : 'save'
		});
		if (!validation.valid) {
			teamContactsError = validation.formError || 'Fix the team contacts before continuing.';
			return false;
		}

		const managementCompanyId = getManagementCompanyId();
		if (!managementCompanyId) {
			teamContactsError = 'Link the deal to a management company before saving team contacts.';
			return false;
		}

		teamContactsSaveState = 'running';
		teamContactsError = '';

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to save sponsor contacts.');

			const payloadContacts = serializeTeamContactsForApi(validation.contacts);
			console.info('[deal-review/team] save requested', {
				dealId,
				managementCompanyId,
				mode: requireComplete ? 'continue' : 'save',
				contactCount: payloadContacts.length,
				assignments: deriveTeamRoleAssignments(payloadContacts)
			});

			const response = await fetch(`/api/management-companies/${encodeURIComponent(managementCompanyId)}/settings`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					teamContacts: payloadContacts
				})
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload?.formError || payload?.error || 'Could not save the team contacts.');
			}

			const persistedContacts = normalizeTeamContacts(payload.teamContacts || payload.team_contacts || validation.contacts, {
				ensureOne: false,
				preserveEmpty: true
			});
			teamContacts = persistedContacts;

			const dealSupportsTeamSnapshot =
				deal?.teamContactsSnapshotSupported === true;

			if (dealSupportsTeamSnapshot) {
				try {
					const dealSnapshotResponse = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
						method: 'PATCH',
						headers: {
							'Content-Type': 'application/json',
							Authorization: `Bearer ${token}`
						},
						body: JSON.stringify(buildDealPatchBody({
							teamContacts: serializeTeamContactsForApi(persistedContacts)
						}))
					});
					const dealSnapshotPayload = await dealSnapshotResponse.json().catch(() => ({}));
					if (dealSnapshotResponse.ok && dealSnapshotPayload?.deal) {
						syncDealState(
							{
								...(deal || {}),
								...dealSnapshotPayload.deal,
								teamContactsSnapshotSupported: true,
								team_contacts: persistedContacts,
								teamContacts: persistedContacts
							},
							{ clearSaveMessage: true }
						);
					} else {
						teamContactsError = resolveDealPatchFailure(
							dealSnapshotPayload,
							'Sponsor contacts saved, but the deal review snapshot could not be updated.'
						);
						deal = {
							...(deal || {}),
							teamContactsSnapshotSupported: deal?.teamContactsSnapshotSupported === true,
							team_contacts: persistedContacts,
							teamContacts: persistedContacts
						};
					}
				} catch (error) {
					teamContactsError = error?.message || 'Sponsor contacts saved, but the deal review snapshot could not be updated.';
					deal = {
						...(deal || {}),
						teamContactsSnapshotSupported: deal?.teamContactsSnapshotSupported === true,
						team_contacts: persistedContacts,
						teamContacts: persistedContacts
					};
				}
			} else {
				deal = {
					...(deal || {}),
					teamContactsSnapshotSupported: false,
					team_contacts: persistedContacts,
					teamContacts: persistedContacts
				};
			}

			teamContactsSaveState = 'success';
			dirty = false;
			if (!quiet) {
				saveMessage = 'Team contacts saved.';
			}
			return true;
		} catch (error) {
			console.error('[deal-review/team] save failed', {
				dealId,
				managementCompanyId,
				mode: requireComplete ? 'continue' : 'save',
				message: error?.message || 'unknown_error'
			});
			teamContactsSaveState = 'error';
			teamContactsError = error?.message || 'Could not save the team contacts.';
			return false;
		}
	}

	async function loadSecVerificationSummary({ force = false } = {}) {
		if (!dealId) return;
		if (!force && secVerificationLoadState === 'running') return;
		secVerificationLoadState = 'running';
		try {
			const token = await getFreshSessionToken();
			if (!token) {
				secVerificationLoadState = 'idle';
				return;
			}
			const response = await fetch(`/api/sec-verification?dealId=${encodeURIComponent(dealId)}`, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				secVerificationLoadState = 'error';
				return;
			}
			secVerificationContext = payload;
			secVerificationLoadState = 'success';
		} catch {
			secVerificationLoadState = 'error';
			// Keep the stage non-blocking if the SEC summary cannot be prefetched.
		}
	}

	async function loadClassificationSignals({ force = false } = {}) {
		if (!dealId || branchInfo.branch !== 'lending_fund') return;
		if (!force && classificationSignalsState === 'running') return;
		if (!force && classificationSignalsDealId === dealId && classificationSignals) return;

		classificationSignalsState = 'running';
		classificationSignalsError = '';
		classificationSignalsAppliedMessage = '';

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to inspect Classification source signals.');

			const response = await fetch('/api/deal-cleanup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					action: 'classification-signals',
					dealId
				})
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok || !payload?.success) {
				throw new Error(payload?.error || 'Could not inspect the Classification source documents.');
			}

			classificationSignals = payload;
			classificationSignalsDealId = dealId;
			classificationSignalsState = 'success';
		} catch (error) {
			classificationSignals = null;
			classificationSignalsError = error?.message || 'Could not inspect the Classification source documents.';
			classificationSignalsState = 'error';
		}
	}

	function getClassificationSaveValidation(stage = activeStage) {
		if (stage !== 'classification' || branchInfo.branch !== 'lending_fund') return null;
		if (classificationSuggestedStates.length === 0) return null;
		if (classificationCurrentStates.length > 0) return null;

		return {
			fieldKey: 'investingStates',
			message: `The deck and PPM mention ${classificationSuggestedStates.length} target states. Select at least one state or apply the suggested geography before saving.`
		};
	}

	function getSaveFieldKeysForStage(stage = activeStage) {
		if (!stage || stage === 'summary') return null;
		if (branchInfo.branch === 'lending_fund') {
			return getStageFieldGroups(stage).flatMap((group) => Array.isArray(group?.fieldKeys) ? group.fieldKeys : []);
		}
		return getOnboardingStageFieldKeys(stage, branchInfo.branch);
	}

	function getEvidenceFieldKeysForStage(stage = activeStage) {
		if (!stage || ['intake', 'summary', 'team', 'sec'].includes(stage)) return [];
		return Array.from(new Set(getStageFieldGroups(stage).flatMap((group) =>
			Array.isArray(group?.fieldKeys) ? group.fieldKeys : []
		)));
	}

	function buildMissingCitationValidation(stage = activeStage) {
		const missingFieldKeys = getStageMissingEvidenceFieldKeys(stage, {
			requireLoadedEvidence: false
		});
		if (missingFieldKeys.length === 0) return null;
		return {
			fieldKeys: missingFieldKeys,
			message: `Save supporting citations for ${summarizeFieldLabels(missingFieldKeys)} before this stage counts as complete.`
		};
	}

	function applyMissingCitationErrors(stage, missingFieldKeys = []) {
		const stageFieldKeys = getEvidenceFieldKeysForStage(stage);
		fieldErrors = {
			...fieldErrors,
			...Object.fromEntries(stageFieldKeys.map((fieldKey) => [fieldKey, ''])),
			...Object.fromEntries(
				missingFieldKeys.map((fieldKey) => [
					fieldKey,
					'Add a saved supporting citation for this value or clear it before continuing.'
				])
			)
		};
	}

	async function loadReviewFieldEvidence({ fieldKeys = [], force = false } = {}) {
		if (!dealId || !deal || (reviewFieldEvidenceState === 'running' && !force)) return;
		if (!getDocumentUrl('deck') && !getDocumentUrl('ppm') && !deal?.sec_filing_id && !deal?.secFilingId) return;

		const requestedFieldKeys = Array.from(new Set((fieldKeys || []).filter(Boolean)));
		if (requestedFieldKeys.length === 0) return;
		if (!force && requestedFieldKeys.every((fieldKey) => reviewFieldEvidenceLoadedKeys.includes(fieldKey))) return;

		reviewFieldEvidenceState = 'running';
		reviewFieldEvidenceError = '';

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to inspect source citations.');

			const response = await fetch('/api/deal-cleanup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					action: 'review-field-evidence',
					dealId,
					fieldKeys: requestedFieldKeys,
					persist: true
				})
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || !payload?.success) {
				throw new Error(payload?.error || 'Could not load field-level source citations.');
			}

			deal = {
				...(deal || {}),
				...(payload?.deal || {}),
				reviewFieldEvidence: payload?.review_field_evidence || payload?.field_evidence || deal?.reviewFieldEvidence || {},
				review_field_evidence: payload?.review_field_evidence || deal?.review_field_evidence || {}
			};
			reviewFieldEvidenceLoadedKeys = Array.from(new Set([
				...reviewFieldEvidenceLoadedKeys,
				...requestedFieldKeys
			]));
			reviewFieldEvidenceState = 'success';
		} catch (error) {
			reviewFieldEvidenceState = 'error';
			reviewFieldEvidenceError = error?.message || 'Could not load field-level source citations.';
		}
	}

	async function loadDeal() {
		if (!dealId) {
			loadError = 'Pick a deal from Manage Data to start review.';
			loading = false;
			return;
		}

		loading = true;
		loadError = '';

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to review deals.');

			const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok || !payload?.deal) {
				throw new Error(payload?.error || 'Failed to load deal.');
			}

			syncDealState(payload.deal, { clearSaveMessage: true });
			if (!shouldAutoExtract) {
				extractionError = '';
			}
			const ancillaryPreloads = Promise.all([loadTeamContacts(), loadSecVerificationSummary()]);
			if (!(requestedStage === 'summary' || allowSummaryPreview)) {
				await ancillaryPreloads;
			} else {
				void ancillaryPreloads;
			}
		} catch (error) {
			loadError = error?.message || 'Failed to load deal.';
			deal = null;
		} finally {
			loading = false;
		}
	}

	async function saveDeal({ quiet = false, stage = activeStage, enforceEvidence = false } = {}) {
		if (!dealId || saving) return false;

		const scopedFieldKeys = getSaveFieldKeysForStage(stage);
		const { payload: nextPayload, errors } = buildDealReviewPayload(form, {
			includeFieldKeys: scopedFieldKeys
		});
		const classificationValidation = getClassificationSaveValidation(stage);
		if (classificationValidation) {
			errors[classificationValidation.fieldKey] = classificationValidation.message;
		}
		if (Object.keys(errors).length > 0) {
			const errorLabels = Object.keys(errors).map((fieldKey) => dealFieldConfig[fieldKey]?.label || fieldKey);
			const errorSummary = errorLabels.length <= 3
				? errorLabels.join(', ')
				: `${errorLabels.slice(0, 2).join(', ')}, +${errorLabels.length - 2} more`;
			fieldErrors = scopedFieldKeys
				? {
					...fieldErrors,
					...Object.fromEntries(scopedFieldKeys.map((fieldKey) => [fieldKey, ''])),
					...errors
				}
				: errors;
			saveError = `Fix these fields before saving: ${errorSummary}.`;
			saveMessage = '';
			revealReviewFeedback();
			console.warn('[deal-review] stage save blocked by validation', {
				dealId,
				stage,
				errorKeys: Object.keys(errors)
			});
			return false;
		}

		saving = true;
		saveError = '';
		if (!quiet) {
			saveMessage = '';
		}

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to save deals.');

			const requestBody = {
				...nextPayload,
				dealBranch: manualBranch || branchInfo.branch,
				sourceRiskFactors,
				highlightedRisks
			};

			const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(buildDealPatchBody(requestBody))
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok || !payload?.deal) {
				if (payload?.fieldErrors && typeof payload.fieldErrors === 'object') {
					const nextFieldErrors = { ...payload.fieldErrors };
					if (nextFieldErrors.managementCompanyId && !nextFieldErrors.sponsor) {
						nextFieldErrors.sponsor = nextFieldErrors.managementCompanyId;
					}
					if (nextFieldErrors.sponsorName && !nextFieldErrors.sponsor) {
						nextFieldErrors.sponsor = nextFieldErrors.sponsorName;
					}
					fieldErrors = {
						...fieldErrors,
						...(scopedFieldKeys
							? Object.fromEntries(scopedFieldKeys.map((fieldKey) => [fieldKey, '']))
							: {}),
						...nextFieldErrors
					};
				}
				throw new Error(resolveDealPatchFailure(payload, 'Failed to save deal.'));
			}

			console.info('[deal-review/save]', {
				dealId,
				scope: stage,
				fieldCount: Array.isArray(scopedFieldKeys) ? scopedFieldKeys.length : Object.keys(nextPayload || {}).length,
				reviewStateVersion
			});
			syncDealState(
				{
					...(deal || {}),
					...payload.deal
				},
				{ clearSaveMessage: true }
			);
			if (Array.isArray(scopedFieldKeys) && scopedFieldKeys.length > 0) {
				await loadReviewFieldEvidence({
					fieldKeys: scopedFieldKeys,
					force: true
				});
				const missingCitationValidation = buildMissingCitationValidation(stage);
				if (missingCitationValidation) {
					applyMissingCitationErrors(stage, missingCitationValidation.fieldKeys);
					saveError = missingCitationValidation.message;
					saveMessage = quiet
						? ''
						: 'Deal saved, but this stage still needs supporting citations before it can be marked complete.';
					revealReviewFeedback();
					return !enforceEvidence;
				}
			}
			if (!quiet) {
				saveMessage = 'Deal saved.';
			}
			return true;
		} catch (error) {
			console.warn('[deal-review/save] failed', {
				dealId,
				stage,
				message: error?.message || 'unknown_error',
				reviewStateVersion
			});
			saveError = error?.message || 'Failed to save deal.';
			revealReviewFeedback();
			return false;
		} finally {
			saving = false;
		}
	}

	async function syncReviewLifecycleStatus({ quiet = true, targetLifecycle = '' } = {}) {
		if (!dealId || lifecycleSyncState === 'running') return false;

		const currentLifecycle = resolveDealLifecycleStatus(deal || {});
		if (currentLifecycle === 'published' || currentLifecycle === 'do_not_publish') return true;

		const desiredLifecycle =
			targetLifecycle || (summaryPublishReady ? 'approved' : 'in_review');
		if (!desiredLifecycle) return true;
		if (desiredLifecycle === currentLifecycle) {
			if (!quiet) {
				saveMessage = desiredLifecycle === 'approved'
					? 'Deal is already approved and ready for publishing.'
					: 'Deal is already marked In Review.';
			}
			return true;
		}

		lifecycleSyncState = 'running';
		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to update deal workflow.');

			const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(buildDealPatchBody({
					lifecycleStatus: desiredLifecycle
				}))
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok || !payload?.deal) {
				throw new Error(resolveDealPatchFailure(payload, 'Failed to update the deal workflow status.'));
			}

			console.info('[deal-review/save]', {
				dealId,
				scope: 'lifecycle',
				targetLifecycle: desiredLifecycle,
				reviewStateVersion
			});
			syncDealState(
				{
					...(deal || {}),
					...payload.deal
				},
				{ clearSaveMessage: true }
			);
			if (!quiet) {
				saveMessage = desiredLifecycle === 'approved'
					? 'Deal approved and ready for publishing.'
					: 'Deal moved back to In Review until the blockers are resolved.';
			}
			return true;
		} catch (error) {
			console.error('[deal-review] lifecycle sync failed', {
				dealId,
				targetLifecycle: desiredLifecycle,
				message: error?.message || 'unknown_error'
			});
			if (!quiet) {
				saveError = error?.message || 'Failed to update the deal workflow status.';
			}
			return false;
		} finally {
			lifecycleSyncState = 'idle';
		}
	}

	async function runExtraction({ fieldKeys = [], scopeLabel = '' } = {}) {
		if (!dealId || extractionState === 'running' || extractionApplyState === 'running') return;

		const requestedFieldKeys = Array.from(new Set((fieldKeys || []).filter(Boolean)));
		const resolvedScopeLabel =
			scopeLabel
			|| (requestedFieldKeys.length > 0 ? activeStageConfig?.label || 'current step' : 'whole deal');

		extractionState = 'running';
		extractionError = '';
		extractionSummary = null;
		saveMessage = '';

		console.info('[deal-review/extraction] requested', {
			dealId,
			scopeLabel: resolvedScopeLabel,
			fieldKeys: requestedFieldKeys
		});

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active admin session to extract deal details.');

			const enrichResponse = await fetch('/api/deal-cleanup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					action: 'enrich-deal',
					dealId,
					...(requestedFieldKeys.length > 0 ? { fieldKeys: requestedFieldKeys } : {})
				})
			});
			const enrichPayload = await enrichResponse.json().catch(() => ({}));

			if (!enrichResponse.ok || !enrichPayload?.success) {
				throw new Error(enrichPayload?.error || 'Failed to extract deal details.');
			}

			const updates = enrichPayload?.found_fields || {};
			const preview = buildExtractionPreview(updates, {
				scopeLabel: resolvedScopeLabel,
				fieldKeys: requestedFieldKeys
			});

			extractionPreview = preview.items.length > 0 ? preview : null;
			extractionSummary = {
				fieldsFound: preview.items.length,
				fieldsApplied: 0,
				sources: enrichPayload?.sources || [],
				steps: enrichPayload?.steps || [],
				notes: enrichPayload?.notes || ''
			};
			extractionState = 'success';
			await loadSecVerificationSummary();
			secStageRefreshKey += 1;

			if (preview.items.length > 0) {
				saveMessage = `Extraction finished for ${resolvedScopeLabel}. Review ${preview.items.length} proposed ${preview.items.length === 1 ? 'field' : 'fields'} before applying them.`;
			} else {
				saveMessage = `Extraction finished for ${resolvedScopeLabel}, but no new values were proposed.`;
			}

			console.info('[deal-review/extraction] preview ready', {
				dealId,
				scopeLabel: resolvedScopeLabel,
				foundCount: preview.items.length,
				lockedCount: preview.items.filter((item) => item.adminLocked).length
			});
		} catch (error) {
			extractionState = 'error';
			extractionError = error?.message || 'Failed to extract deal details.';
			console.warn('[deal-review/extraction] failed', {
				dealId,
				scopeLabel: resolvedScopeLabel,
				message: error?.message || 'unknown_error'
			});
		} finally {
			clearExtractionFlags();
		}
	}

	async function applyExtractionPreview({ fieldKeys = [], forceFieldKeys = [] } = {}) {
		if (!dealId || !extractionPreview || extractionApplyState === 'running') return false;
		if (dirty) {
			saveError = 'Save or reset your current unsaved changes before applying extracted values.';
			revealReviewFeedback();
			return false;
		}

		const targetedFieldKeys = Array.from(new Set((fieldKeys || []).filter(Boolean)));
		const previewItems = extractionPreview.items.filter((item) =>
			targetedFieldKeys.length === 0 || targetedFieldKeys.includes(item.fieldKey)
		);
		if (previewItems.length === 0) return false;

		const forcedFieldKeys = Array.from(new Set((forceFieldKeys || []).filter(Boolean)));
		if (
			forcedFieldKeys.length > 0
			&& browser
			&& !window.confirm(
				`Overwrite ${forcedFieldKeys.length} admin-edited ${forcedFieldKeys.length === 1 ? 'field' : 'fields'} with the newly extracted value? This cannot be undone automatically.`
			)
		) {
			return false;
		}

		extractionApplyState = 'running';
		saveError = '';
		extractionError = '';
		const previousPreview = extractionPreview;

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active admin session to apply extracted values.');

			const updates = Object.fromEntries(
				previewItems.map((item) => [item.rawFieldKey, previousPreview.rawUpdates[item.rawFieldKey]])
			);

			const applyResponse = await fetch('/api/deal-cleanup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					action: 'apply-enrichment',
					dealId,
					updates,
					...(forcedFieldKeys.length > 0 ? { forceFieldKeys: forcedFieldKeys } : {})
				})
			});
			const applyPayload = await applyResponse.json().catch(() => ({}));

			if (!applyResponse.ok || !applyPayload?.success) {
				throw new Error(applyPayload?.error || 'The extracted fields could not be applied.');
			}

			if (applyPayload?.deal || applyPayload?.data) {
				syncDealState({
					...(deal || {}),
					...(applyPayload.deal || applyPayload.data || {})
				});
			}

			const appliedFieldKeys = previewItems.map((item) => item.fieldKey);
			if (appliedFieldKeys.length > 0) {
				await loadReviewFieldEvidence({
					fieldKeys: appliedFieldKeys,
					force: true
				});
			}

			const blockedFieldSet = new Set(
				(Array.isArray(applyPayload?.blocked_fields) ? applyPayload.blocked_fields : []).filter(Boolean)
			);
			const attemptedFieldKeySet = new Set(previewItems.map((item) => item.fieldKey));
			const remainingItems = previousPreview.items.filter((item) => {
				if (!attemptedFieldKeySet.has(item.fieldKey)) return true;
				return blockedFieldSet.has(item.fieldKey);
			});
			extractionPreview = buildExtractionPreviewFromItems(previousPreview, remainingItems);

			const appliedCount = Array.isArray(applyPayload?.fields_updated)
				? applyPayload.fields_updated.length
				: previewItems.length - blockedFieldSet.size;
			extractionSummary = {
				...(extractionSummary || {}),
				fieldsApplied: appliedCount
			};
			saveMessage = blockedFieldSet.size > 0
				? `Applied ${appliedCount} extracted ${appliedCount === 1 ? 'field' : 'fields'}. ${blockedFieldSet.size} admin-edited ${blockedFieldSet.size === 1 ? 'field was' : 'fields were'} protected and left unchanged.`
				: `Applied ${appliedCount} extracted ${appliedCount === 1 ? 'field' : 'fields'}.`;

			console.info('[deal-review/extraction] applied', {
				dealId,
				appliedCount,
				blockedCount: blockedFieldSet.size,
				forcedFieldKeys
			});
			return true;
		} catch (error) {
			saveError = error?.message || 'The extracted fields could not be applied.';
			revealReviewFeedback();
			console.warn('[deal-review/extraction] apply failed', {
				dealId,
				message: error?.message || 'unknown_error'
			});
			return false;
		} finally {
			extractionApplyState = 'idle';
		}
	}

	async function resetFieldToExtracted(fieldKey) {
		if (!dealId || !fieldKey || extractionApplyState === 'running') return false;
		if (dirty) {
			saveError = 'Save or reset your current unsaved changes before resetting a field to the extracted value.';
			revealReviewFeedback();
			return false;
		}

		const entry = reviewFieldState[fieldKey];
		if (!entry?.aiValuePresent) {
			saveError = 'No extracted value is currently stored for that field.';
			revealReviewFeedback();
			return false;
		}

		if (
			browser
			&& !window.confirm(`Reset ${getReviewFieldLabel(fieldKey)} to the current extracted value?`)
		) {
			return false;
		}

		extractionApplyState = 'running';
		saveError = '';

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active admin session to reset extracted values.');

			const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(buildDealPatchBody({
					reviewFieldAction: {
						type: 'reset_to_ai',
						fieldKey
					}
				}))
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok || !payload?.deal) {
				throw new Error(resolveDealPatchFailure(payload, 'Could not reset this field to the extracted value.'));
			}

			syncDealState({
				...(deal || {}),
				...payload.deal
			});
			await loadReviewFieldEvidence({
				fieldKeys: [fieldKey],
				force: true
			});
			saveMessage = `${getReviewFieldLabel(fieldKey)} was reset to the extracted value.`;
			console.info('[deal-review/extraction] reset to ai', {
				dealId,
				fieldKey
			});
			return true;
		} catch (error) {
			saveError = error?.message || 'Could not reset this field to the extracted value.';
			revealReviewFeedback();
			return false;
		} finally {
			extractionApplyState = 'idle';
		}
	}

	async function saveCurrentStage(stage = activeStage) {
		if (stage === 'intake') {
			await saveIntakeDetails();
			return true;
		}
		if (stage === 'summary') {
			return await syncReviewLifecycleStatus({
				quiet: false,
				targetLifecycle: summaryPublishReady ? 'approved' : 'in_review'
			});
		}
		if (stage === 'team') {
			return await saveTeamContacts({ quiet: true, requireComplete: true });
		}
		if (stage === 'sec') {
			if (!secVerificationContext && secVerificationLoadState === 'running') {
				saveError = 'SEC verification is still loading. Wait a moment, then continue.';
				revealReviewFeedback();
				return false;
			}
			if (!secCanAdvance) {
				saveError = `Finish the SEC review first by verifying the filing or intentionally skipping it. Current state: ${SEC_VERIFICATION_LABELS[secStatus] || 'Pending'}.`;
				revealReviewFeedback();
				return false;
			}
			return true;
		}
		return await saveDeal({ quiet: true, stage, enforceEvidence: true });
	}

	async function saveActiveReviewStage() {
		if (activeStage === 'intake') {
			return await saveIntakeDetails();
		}
		if (activeStage === 'summary') {
			return await syncReviewLifecycleStatus({
				quiet: false,
				targetLifecycle: summaryPublishReady ? 'approved' : 'in_review'
			});
		}
		if (activeStage === 'team') {
			return await saveTeamContacts({ quiet: false, requireComplete: false });
		}
		return await saveDeal({ stage: activeStage, enforceEvidence: false });
	}

	async function continueToNextStage() {
		const targetStage = nextStage;
		if (!targetStage || targetStage === activeStage) return false;
		return await navigateToStage(targetStage, { allowAdvance: true });
	}

	async function navigateToStage(stage, { from = '', allowAdvance = false } = {}) {
		if (!dealId) return false;
		const targetStage = stage;
		if (!targetStage || targetStage === activeStage) return false;

		const currentIndex = onboardingStages.findIndex((candidate) => candidate.id === activeStage);
		const targetIndex = onboardingStages.findIndex((candidate) => candidate.id === targetStage);
		const unlockedIndex = onboardingStages.findIndex((candidate) => candidate.id === furthestUnlockedStage);
		const movingForward = targetIndex > currentIndex;
		const isImmediateNextStage = movingForward && targetIndex === currentIndex + 1;
		const allowImmediateAdvance = allowAdvance && isImmediateNextStage;
		const isAdvancingIntoNextNewStage =
			targetIndex > unlockedIndex
			&& allowAdvance
			&& currentIndex === unlockedIndex
			&& targetIndex === unlockedIndex + 1;

		if (targetIndex < 0) return false;
		if (targetIndex > unlockedIndex && !isAdvancingIntoNextNewStage && !allowImmediateAdvance) {
			console.warn('[deal-review] navigation blocked', {
				dealId,
				activeStage,
				targetStage,
				currentIndex,
				targetIndex,
				unlockedIndex,
				furthestUnlockedStage
			});
			revealReviewFeedback();
			return false;
		}

		if (!movingForward && !confirmDiscardUnsavedChanges()) {
			return false;
		}

		if (movingForward) {
			const shouldSaveBeforeAdvance = dirty || ['intake', 'team', 'sec'].includes(activeStage);
			const ok = shouldSaveBeforeAdvance ? await saveCurrentStage(activeStage) : true;
			if (!ok) return false;
			if (targetStage === 'classification' && branchInfo.branch === 'lending_fund') {
				await loadClassificationSignals();
			}
			if (targetStage === 'summary') {
				const lifecycleOk = await syncReviewLifecycleStatus({
					quiet: true,
					targetLifecycle: summaryPublishReady ? 'approved' : 'in_review'
				});
				if (!lifecycleOk) {
					revealReviewFeedback();
					return false;
				}
			}
		}

		saveError = '';
		await goto(getStageHref(targetStage, { from: from || (cameFromQueue ? 'queue' : cameFromIntake ? 'intake' : '') }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
		return true;
	}

	onMount(() => {
		previousDealId = dealId;
		const handleBeforeUnload = (event) => {
			if (!dirty) return;
			event.preventDefault();
			event.returnValue = '';
		};
		if (browser) {
			window.addEventListener('beforeunload', handleBeforeUnload);
		}
		void loadDeal();
		return () => {
			if (browser) {
				window.removeEventListener('beforeunload', handleBeforeUnload);
			}
		};
	});

	onDestroy(() => {
		if (intakeSponsorBlurTimer) clearTimeout(intakeSponsorBlurTimer);
		if (intakeSponsorSearchTimer) clearTimeout(intakeSponsorSearchTimer);
	});

	$effect(() => {
		if (!dealId || dealId === previousDealId) return;
		previousDealId = dealId;
		autoExtractionHandled = false;
		secVerificationContext = null;
		secVerificationLoadState = 'idle';
		classificationSignals = null;
		classificationSignalsState = 'idle';
		classificationSignalsError = '';
		classificationSignalsDealId = '';
		classificationSignalsAppliedKey = '';
		classificationSignalsAppliedMessage = '';
		reviewFieldEvidenceState = 'idle';
		reviewFieldEvidenceLoadedKeys = [];
		reviewFieldEvidenceError = '';
		void loadDeal();
	});

	$effect(() => {
		if (!shouldAutoExtract || autoExtractionHandled || loading || !deal) return;
		autoExtractionHandled = true;
		if (!hasSourceDocuments) {
			extractionState = 'idle';
			extractionError = '';
			saveMessage = 'No deck or PPM was uploaded, so this deal is ready for manual review.';
			clearExtractionFlags();
			return;
		}
		void runExtraction({ scopeLabel: 'whole deal' });
	});

	$effect(() => {
		if (loading || !deal || activeStage === 'summary') return;
		const stageFieldKeys = getEvidenceFieldKeysForStage(activeStage);
		if (stageFieldKeys.length === 0) return;
		if (stageFieldKeys.every((fieldKey) => reviewFieldEvidenceLoadedKeys.includes(fieldKey))) return;
		void loadReviewFieldEvidence({ fieldKeys: stageFieldKeys });
	});

	$effect(() => {
		if (loading || !deal || activeStage !== 'summary') return;
		const allEvidenceFieldKeys = Array.from(new Set(
			reviewStages.flatMap((stage) => getEvidenceFieldKeysForStage(stage.id))
		));
		if (allEvidenceFieldKeys.length === 0) return;
		if (allEvidenceFieldKeys.every((fieldKey) => reviewFieldEvidenceLoadedKeys.includes(fieldKey))) return;
		void loadReviewFieldEvidence({ fieldKeys: allEvidenceFieldKeys });
	});

	$effect(() => {
		if (!browser || loading || !dealId || !deal || loadError) return;
		const targetHref = getStageHref(activeStage, {
			from: cameFromQueue ? 'queue' : cameFromIntake ? 'intake' : '',
			extract: shouldAutoExtract && !autoExtractionHandled,
			allowSummary: activeStage === 'summary' && canOpenSummaryPreview
		});
		const currentHref = `${$page.url.pathname}${$page.url.search}`;
		if (targetHref === currentHref) return;
		goto(targetHref, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		}).catch(() => {});
	});

	$effect(() => {
		if (!dealId || loading || activeStage !== 'sec') return;
		if (secVerificationContext || secVerificationLoadState === 'running') return;
		void loadSecVerificationSummary();
	});

	$effect(() => {
		if (!dealId || loading || branchInfo.branch !== 'lending_fund' || activeStage !== 'classification') return;
		if (classificationSignalsState === 'running') return;
		if (classificationSignalsDealId === dealId && classificationSignals) return;
		void loadClassificationSignals();
	});

	$effect(() => {
		if (branchInfo.branch !== 'lending_fund' || activeStage !== 'classification') return;
		if (classificationSignalsState !== 'success' || classificationSuggestedStates.length === 0) return;
		const autoApplyKey = `${dealId}:${classificationSuggestedStates.join(',')}`;
		if (classificationSignalsAppliedKey === autoApplyKey) return;
		classificationSignalsAppliedKey = autoApplyKey;
		if (dirty || classificationMissingSuggestedStates.length === 0) return;
		applyClassificationSuggestions({ auto: true });
	});

	$effect(() => {
		if (!dealId || loading || activeStage !== 'summary' || lifecycleSyncState === 'running') return;
		const desiredLifecycle = resolveSummaryLifecycleSyncTarget({
			currentLifecycleStatus,
			summaryPublishReady,
			summaryEvidencePending
		});
		if (!desiredLifecycle) return;
		void syncReviewLifecycleStatus({ quiet: true, targetLifecycle: desiredLifecycle });
	});
</script>

<svelte:head>
	<title>Deal Review | GYC Dealflow</title>
</svelte:head>

<PageContainer className="deal-review-page ly-page-stack">
	<PageHeader
		title={deal ? form.investmentName || 'Untitled deal' : 'Deal Review'}
		subtitle={pageSubtitle}
		className="deal-review-header"
	>
		<div slot="actions" class="header-actions">
			<button type="button" class="ghost-btn" onclick={navigateBack}>
				{backLabel}
			</button>
			{#if dealId && activeStage !== 'intake'}
				<span class={`save-status save-status--${saveStatusTone}`}>{saveStatusLabel}</span>
				<a class="ghost-btn" href={`/deal/${dealId}`} target="_blank" rel="noopener">Open Deal</a>
				<button type="button" class="primary-btn" onclick={saveActiveReviewStage} disabled={loading || reviewFooterBusy || !dirty}>
					{reviewFooterBusy ? 'Working...' : dirty ? 'Save' : 'Saved'}
				</button>
			{/if}
		</div>
	</PageHeader>

	{#if loading}
		<div class="state-card">Loading deal data...</div>
	{:else if loadError}
		<div class="state-card state-card--error">
			<strong>Could not load this deal.</strong>
			<p>{loadError}</p>
			<div class="state-actions">
				<button type="button" class="ghost-btn" onclick={loadDeal}>Retry</button>
				<button type="button" class="ghost-btn" onclick={navigateBack}>{backLabel}</button>
			</div>
		</div>
	{:else}
		{#if activeStage === 'intake'}
			<div class="review-layout review-layout--intake">
				<div class="editor-stack editor-stack--intake">
					<div class="review-stage-progress-mobile">
						<DealOnboardingProgress
							stages={onboardingStages}
							currentStage="intake"
							completedStages={[]}
							accessibleStages={['intake']}
							onselect={() => {}}
							variant="inline"
						/>
					</div>

					<section class="intake-screen">
						<div class="intake-screen__header">
							<div class="intake-screen__eyebrow">Step 1 of {onboardingStages.length}</div>
							<h2>Set the deal up, then upload the source files</h2>
							<p>
								Start with the few inputs the rest of the review depends on. Once the documents are attached, we can extract what’s useful and move into the structured review.
							</p>
						</div>

						<section class="intake-section">
							<div class="card-heading">
								<div>
									<h3>Deal basics</h3>
									<p>Capture the exact investment name, the operator, and the website you trust most.</p>
								</div>
							</div>

							<div class="intake-basics-grid">
								<label class="intake-field intake-field--span-2">
									<span>Investment name</span>
									<input
										type="text"
										value={form.investmentName}
										placeholder="Sunrise Multifamily Fund II"
										oninput={(event) => updateField('investmentName', event.currentTarget.value)}
									>
									<small>This should be the exact name you want to review and eventually publish.</small>
								</label>

								<div class="intake-field intake-field--entity">
									<span>Management company</span>
									<div class="intake-entity-shell" onfocusin={cancelIntakeSponsorBlur} onfocusout={closeIntakeSponsorMenuSoon}>
										<input
											type="text"
											value={form.sponsor?.name || ''}
											placeholder="Blue Bay Capital"
											autocomplete="off"
											onfocus={() => {
												intakeSponsorOpen = true;
												queueIntakeSponsorSearch(form.sponsor?.name || '');
											}}
											oninput={(event) => updateIntakeSponsorName(event.currentTarget.value)}
										>
										{#if form.sponsor?.id}
											<div class="intake-field-meta intake-field-meta--success">Linked to existing management company</div>
										{:else if form.sponsor?.createIfMissing}
											<div class="intake-field-meta intake-field-meta--info">Will create a new management company when you continue</div>
										{/if}

										{#if intakeSponsorOpen && (intakeSponsorLoading || intakeSponsorResults.length > 0 || String(form.sponsor?.name || '').trim().length >= 2)}
											<div class="intake-entity-menu">
												{#if intakeSponsorLoading}
													<div class="intake-entity-empty">Searching management companies...</div>
												{:else}
													{#each intakeSponsorResults as result}
														<button type="button" class="intake-entity-option" onclick={() => selectIntakeSponsor(result)}>
															{intakeSponsorLabel(result)}
														</button>
													{/each}
													{#if String(form.sponsor?.name || '').trim().length >= 2 && !intakeSponsorResults.some((result) => String(result?.operator_name || result?.name || '').trim().toLowerCase() === String(form.sponsor?.name || '').trim().toLowerCase())}
														<button type="button" class="intake-entity-option intake-entity-option--create" onclick={createIntakeSponsor}>
															Create new management company: {String(form.sponsor?.name || '').trim()}
														</button>
													{/if}
													{#if intakeSponsorResults.length === 0}
														<div class="intake-entity-empty">No existing management companies matched that search.</div>
													{/if}
												{/if}
											</div>
										{/if}
									</div>
									<small>Use the sponsor or operator name. We’ll link or create the company record from here.</small>
								</div>

								<label class="intake-field">
									<span>Company website</span>
									<input
										type="url"
										value={form.companyWebsite || ''}
										placeholder="https://..."
										oninput={(event) => updateField('companyWebsite', event.currentTarget.value)}
									>
									<small>Use the sponsor’s main website so the review step has a trustworthy reference point.</small>
								</label>
							</div>
						</section>

						<section class="intake-section">
							<div class="card-heading">
								<div>
									<h3>Source documents</h3>
									<p>Attach the materials you want the review to trust first. You can replace them any time.</p>
								</div>
							</div>

							<div class="intake-document-strip">
								<div class="intake-document-pill">
									<span>Deck</span>
									<strong>
										{#if deckFile}
											{deckFile.name}
										{:else if getDocumentUrl('deck')}
											{getDocumentName(getDocumentUrl('deck'), 'Investment Deck')}
										{:else}
											Not uploaded
										{/if}
									</strong>
								</div>
								<div class="intake-document-pill">
									<span>PPM</span>
									<strong>
										{#if ppmFile}
											{ppmFile.name}
										{:else if getDocumentUrl('ppm')}
											{getDocumentName(getDocumentUrl('ppm'), 'PPM')}
										{:else}
											Not uploaded
										{/if}
									</strong>
								</div>
							</div>

							<div class="intake-upload-grid">
								<div class="intake-upload-card">
									<div class="intake-upload-card__title">Investment deck</div>
									<div
										class="add-deal-modal__dropzone"
										class:is-active={Boolean(deckFile)}
										role="button"
										tabindex="0"
										onclick={() => deckInputEl?.click()}
										onkeydown={(event) => {
											if (event.key === 'Enter' || event.key === ' ') {
												event.preventDefault();
												deckInputEl?.click();
											}
										}}
										ondragover={(event) => event.preventDefault()}
										ondrop={(event) => handleDrop(event, 'deck')}
									>
										<div class="add-deal-modal__drop-icon">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
												<polyline points="17 8 12 3 7 8"></polyline>
												<line x1="12" y1="3" x2="12" y2="15"></line>
											</svg>
										</div>
										<div class="add-deal-modal__drop-copy">
											{#if deckFile}
												<strong>{deckFile.name}</strong> <span>({(deckFile.size / 1024 / 1024).toFixed(1)} MB)</span>
											{:else if deal?.deckUrl || deal?.deck_url}
												<strong>Deck already attached</strong> <span>Click to replace it</span>
											{:else}
												Drop a PDF here or click to upload
											{/if}
										</div>
									</div>
									<input
										bind:this={deckInputEl}
										type="file"
										accept=".pdf,.doc,.docx,.pptx,.ppt,.xlsx"
										class="add-deal-modal__file-input"
										onchange={(event) => setUploadFile(event.currentTarget.files?.[0], 'deck')}
									>
								</div>

								<div class="intake-upload-card">
									<div class="intake-upload-card__title">PPM</div>
									<div
										class="add-deal-modal__dropzone"
										class:is-active={Boolean(ppmFile)}
										role="button"
										tabindex="0"
										onclick={() => ppmInputEl?.click()}
										onkeydown={(event) => {
											if (event.key === 'Enter' || event.key === ' ') {
												event.preventDefault();
												ppmInputEl?.click();
											}
										}}
										ondragover={(event) => event.preventDefault()}
										ondrop={(event) => handleDrop(event, 'ppm')}
									>
										<div class="add-deal-modal__drop-icon">
											<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
												<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
												<polyline points="17 8 12 3 7 8"></polyline>
												<line x1="12" y1="3" x2="12" y2="15"></line>
											</svg>
										</div>
										<div class="add-deal-modal__drop-copy">
											{#if ppmFile}
												<strong>{ppmFile.name}</strong> <span>({(ppmFile.size / 1024 / 1024).toFixed(1)} MB)</span>
											{:else if deal?.ppmUrl || deal?.ppm_url}
												<strong>PPM already attached</strong> <span>Click to replace it</span>
											{:else}
												Drop a PDF here or click to upload
											{/if}
										</div>
									</div>
									<input
										bind:this={ppmInputEl}
										type="file"
										accept=".pdf,.doc,.docx"
										class="add-deal-modal__file-input"
										onchange={(event) => setUploadFile(event.currentTarget.files?.[0], 'ppm')}
									>
								</div>
							</div>
						</section>

						{#if uploadError}
							<div class="message-banner message-banner--error">{uploadError}</div>
						{/if}

						<div class="intake-screen__actions">
							<button
								type="button"
								class="ghost-btn"
								onclick={() => continueFromIntake({ autoExtract: false })}
								disabled={uploadState === 'running'}
							>
								{uploadState === 'running' ? 'Working...' : 'Skip Extraction'}
							</button>
							<button
								type="button"
								class="primary-btn"
								onclick={() => continueFromIntake({ autoExtract: true })}
								disabled={uploadState === 'running' || !intakeHasAttachedSources}
							>
								{uploadState === 'running' ? 'Continuing...' : 'Continue'}
							</button>
						</div>
					</section>
				</div>

				<DealReviewSidebar
					stages={onboardingStages}
					currentStage={sidebarCurrentStage}
					completedStages={sidebarCompletedStages}
					accessibleStages={sidebarAccessibleStages}
					onselect={(stageId) => navigateToStage(stageId)}
					deckUrl={getDocumentUrl('deck') || form.deckUrl}
					ppmUrl={getDocumentUrl('ppm') || form.ppmUrl}
					subAgreementUrl={deal?.subAgreementUrl || deal?.sub_agreement_url || ''}
					extractionState={extractionState}
				/>
			</div>
		{:else}
			<div class={`review-layout ${activeStage === 'team' ? 'review-layout--wide' : ''}`}>
				{#key `${dealId}:${activeStage}`}
				<form class="editor-stack" onsubmit={(event) => { event.preventDefault(); saveActiveReviewStage(); }}>
					{#if cameFromQueue || hasSourceDocuments}
						<div class="review-stage-controls">
							<div class="review-stage-controls__copy">
								<div class="review-stage-controls__eyebrow">{activeStageConfig?.label || 'Review'} Step</div>
								<h2>{reviewWorkspaceTitle}</h2>
							</div>
							<div class="review-stage-controls__actions">
								{#if currentStageExtractionFieldKeys.length > 0}
									<button
										type="button"
										class="ghost-btn"
										disabled={reviewFooterBusy}
										onclick={() => runExtraction({
											fieldKeys: currentStageExtractionFieldKeys,
											scopeLabel: activeStageConfig?.label || 'current step'
										})}
									>
										{extractionState === 'running' ? 'Re-extracting...' : 'Re-extract this step'}
									</button>
								{/if}
								{#if hasSourceDocuments}
									<button
										type="button"
										class="ghost-btn"
										disabled={reviewFooterBusy}
										onclick={() => runExtraction({ scopeLabel: 'whole deal' })}
									>
										{extractionState === 'running' ? 'Working...' : 'Re-extract whole deal'}
									</button>
								{/if}
							</div>
						</div>
					{/if}

					{#if saveError}
						<div class="message-banner message-banner--error">
							<div>{saveError}</div>
							{#if conflictServerDeal}
								<div class="message-banner__actions">
									<button type="button" class="ghost-btn" onclick={loadLatestServerDeal}>Load latest saved version</button>
								</div>
							{/if}
						</div>
					{/if}

					{#if saveMessage && !(extractionSummary && /prefilled/i.test(saveMessage))}
						<div class="message-banner message-banner--success">{saveMessage}</div>
					{/if}

					{#if extractionError}
						<div class="message-banner message-banner--warning">
							{extractionError}
						</div>
					{/if}

					{#if schemaWarningMessage}
						<div class="message-banner message-banner--warning">
							{schemaWarningMessage}
						</div>
					{/if}

					{#if reviewFieldEvidenceError}
						<div class="message-banner message-banner--warning">
							{reviewFieldEvidenceError}
						</div>
					{/if}

					{#if extractionPreview}
						<section class="extraction-preview-card">
							<div class="extraction-preview-card__header">
								<div>
									<div class="extraction-preview-card__eyebrow">Extraction Preview</div>
									<h3>Nothing changes until you apply these updates</h3>
									<p>
										{extractionPreview.items.length} proposed {extractionPreview.items.length === 1 ? 'field' : 'fields'} from {extractionPreview.scopeLabel}. Admin-edited fields stay locked unless you explicitly overwrite them.
									</p>
								</div>
								<div class="extraction-preview-card__actions">
									<button type="button" class="ghost-btn" disabled={extractionApplyState === 'running'} onclick={() => { extractionPreview = null; }}>
										Dismiss preview
									</button>
									<button type="button" class="ghost-btn" disabled={extractionApplyState === 'running'} onclick={() => applyExtractionPreview()}>
										{extractionApplyState === 'running' ? 'Applying...' : 'Apply safe updates'}
									</button>
									{#if extractionPreviewLockedFieldKeys.length > 0}
										<button
											type="button"
											class="primary-btn"
											disabled={extractionApplyState === 'running'}
											onclick={() => applyExtractionPreview({ forceFieldKeys: extractionPreviewLockedFieldKeys })}
										>
											Overwrite {extractionPreviewLockedFieldKeys.length} locked {extractionPreviewLockedFieldKeys.length === 1 ? 'field' : 'fields'}
										</button>
									{/if}
								</div>
							</div>

							<div class="extraction-preview-list">
								{#each extractionPreview.items as item}
									<article class="extraction-preview-item">
										<div class="extraction-preview-item__top">
											<div>
												<h4>{item.label}</h4>
												<div class="extraction-preview-item__meta">
													<span class="extraction-preview-pill">{fieldStageLabels.get(item.fieldKey) || extractionPreview.scopeLabel}</span>
													{#if item.adminLocked}
														<span class="extraction-preview-pill extraction-preview-pill--locked">Admin edit protected</span>
													{/if}
												</div>
											</div>
											<div class="extraction-preview-item__actions">
												<button
													type="button"
													class="ghost-btn"
													disabled={extractionApplyState === 'running'}
													onclick={() => runExtraction({
														fieldKeys: [item.fieldKey],
														scopeLabel: item.label
													})}
												>
													Re-extract field
												</button>
												<button
													type="button"
													class="ghost-btn"
													disabled={extractionApplyState === 'running'}
													onclick={() => applyExtractionPreview({
														fieldKeys: [item.fieldKey],
														forceFieldKeys: item.adminLocked ? [item.fieldKey] : []
													})}
												>
													Apply this field
												</button>
												{#if item.adminLocked && reviewFieldState[item.fieldKey]?.aiValuePresent}
													<button
														type="button"
														class="ghost-btn"
														disabled={extractionApplyState === 'running'}
														onclick={() => resetFieldToExtracted(item.fieldKey)}
													>
														Reset to extracted value
													</button>
												{/if}
											</div>
										</div>
										<div class="extraction-preview-diff">
											<div>
												<span>Current</span>
												<strong>{formatPreviewValue(item.fieldKey, item.currentValue)}</strong>
											</div>
											<div>
												<span>Extracted</span>
												<strong>{formatPreviewValue(item.fieldKey, item.extractedValue)}</strong>
											</div>
										</div>
									</article>
								{/each}
							</div>
						</section>
					{/if}

					<div class="review-stage-progress-mobile">
						<DealOnboardingProgress
							stages={onboardingStages}
							currentStage={activeStage}
							completedStages={completedStageIds}
							accessibleStages={unlockedStageIds}
							onselect={(stageId) => navigateToStage(stageId)}
							variant="inline"
						/>
					</div>

					{#if activeStage === 'sec'}
						<SecVerificationStage
							dealId={dealId}
							deal={deal}
							initialPayload={secVerificationContext}
							refreshKey={secStageRefreshKey}
							onchange={(nextContext) => {
								secVerificationContext = nextContext;
							}}
						/>
					{:else if activeStage === 'team'}
						{#key `${dealId}:${activeStage}`}
							<TeamContactsStage
								contacts={teamContacts}
								error={teamContactsError}
								saving={teamContactsSaveState === 'running'}
								onchange={(nextContacts) => {
									teamContacts = nextContacts;
									teamContactsError = '';
									logFieldEdit('teamContacts');
									markDirty();
								}}
								ondone={() => saveTeamContacts({ quiet: false, requireComplete: false })}
								onback={() => navigateToStage(previousStage)}
								oncontinue={() => navigateToStage(nextStage, { allowAdvance: true })}
								/>
						{/key}
					{:else if activeStage === 'historical_performance'}
							<LendingFundReviewSectionStage
								eyebrow={activeStageConfig?.label || 'Review'}
								title={activeStageConfig?.title || 'Historical performance'}
								description={activeStageConfig?.description || ''}
								sections={activeStageConfig?.sections || []}
								form={form}
								fieldErrors={fieldErrors}
								fieldWarnings={fieldWarnings}
								fieldEvidence={reviewFieldEvidence}
								documentUrls={reviewDocumentUrls}
								evidenceLoading={reviewFieldEvidenceState === 'running'}
								onupdate={updateField}
								labelOverrides={{}}
							/>
					{:else if ['classification', 'static_terms', 'fees', 'portfolio_snapshot', 'sponsor_trust'].includes(activeStage)}
							{#if branchInfo.branch === 'lending_fund'}
								{#if activeStage === 'classification'}
									<section class="editor-card classification-signals-card">
										<div class="card-heading">
											<div>
												<h2>Classification source signals</h2>
												<p>We compare the uploaded PPM and deck, merge the states they mention, and use that union as the recommended investing geography.</p>
											</div>
											{#if classificationSignalsState === 'success' && classificationSuggestedStates.length > 0}
												<span class="classification-signals-card__badge">
													{classificationSuggestedStates.length} states found
												</span>
											{/if}
										</div>

										{#if classificationSignalsState === 'running'}
											<p class="classification-signals-card__status">Reading the deck and PPM for lending-geography references...</p>
										{:else if classificationSignalsState === 'error'}
											<div class="message-banner message-banner--warning">
												{classificationSignalsError}
											</div>
										{:else if classificationSignalsState === 'success'}
											<div class="classification-signals-grid">
												<div class="classification-signal-item">
													<span>PPM states</span>
													<strong>{formatStateCodesForDisplay(classificationPpmStates)}</strong>
												</div>
												<div class="classification-signal-item">
													<span>Deck states</span>
													<strong>{formatStateCodesForDisplay(classificationDeckStates)}</strong>
												</div>
												<div class="classification-signal-item classification-signal-item--wide">
													<span>Suggested union</span>
													<strong>{formatStateCodesForDisplay(classificationSuggestedStates)}</strong>
												</div>
											</div>

											{#if classificationSignalsAppliedMessage}
												<p class="classification-signal-note classification-signal-note--success">
													{classificationSignalsAppliedMessage}
												</p>
											{/if}

											{#if classificationMissingSuggestedStates.length > 0}
												<p class="classification-signal-note classification-signal-note--warning">
													Source documents mention {formatStateCodesForDisplay(classificationMissingSuggestedStates)}, but those states are not currently selected in Classification.
												</p>
											{/if}

											{#if classificationExtraStates.length > 0}
												<p class="classification-signal-note">
													Currently selected outside the source-document union: {formatStateCodesForDisplay(classificationExtraStates)}.
												</p>
											{/if}

											<div class="classification-signals-card__actions">
												<button type="button" class="ghost-btn" onclick={() => applyClassificationSuggestions()}>
													Apply Suggested States
												</button>
											</div>
										{/if}
									</section>
								{/if}
								<LendingFundReviewSectionStage
									eyebrow={activeStageConfig?.label || 'Review'}
									title={activeStageConfig?.title || 'Review the deal'}
									description={activeStageConfig?.description || ''}
									sections={activeStageConfig?.sections || []}
									form={form}
									fieldErrors={fieldErrors}
									fieldWarnings={fieldWarnings}
									fieldEvidence={reviewFieldEvidence}
									documentUrls={reviewDocumentUrls}
									evidenceLoading={reviewFieldEvidenceState === 'running'}
									variant="lending_fund"
									labelOverrides={activeStage === 'static_terms'
										? {
											preferredReturn: 'Preferred Return',
											financials: 'Auditing',
											lpGpSplit: 'LP Share',
											redemptionNotes: 'Redemption Notes',
											taxForm: 'Tax Form',
											additionalTermNotes: 'Additional Details'
										}
										: activeStage === 'portfolio_snapshot'
											? {
												snapshotAsOfDate: 'Snapshot As Of',
												fundAUM: 'Manager AUM',
												currentFundSize: 'Current Fund Size',
												offeringSize: 'Max Fund Size',
												loanCount: 'Loan Count',
												currentAvgLoanLtv: 'Current Avg LTV',
												maxAllowedLtv: 'Max Allowed LTV',
												currentLeverage: 'Current Leverage',
												maxAllowedLeverage: 'Max Allowed Leverage'
											}
											: activeStage === 'fees'
												? { fees: 'Fees' }
												: activeStage === 'sponsor_trust'
													? { firmFoundedYear: 'Firm Founded', fundFoundedYear: 'Fund Founded' }
													: activeStage === 'classification'
														? {
															offeringStatus: 'Offering Status',
															investmentStrategy: 'Strategy',
															investingStates: 'Investing Geography',
															underlyingExposureTypes: 'Underlying Exposure'
														}
														: {}}
									onupdate={updateField}
									onaction={null}
								/>
						{:else}
							<KeyDetailsStage
								source={{ ...deal, branch: manualBranch || branchInfo.branch }}
								form={{ ...form, branch: manualBranch || branchInfo.branch }}
								branch={manualBranch || branchInfo.branch}
								fieldErrors={fieldErrors}
								fieldWarnings={fieldWarnings}
								fieldEvidence={reviewFieldEvidence}
								documentUrls={reviewDocumentUrls}
								evidenceLoading={reviewFieldEvidenceState === 'running'}
								onupdate={updateField}
								onaction={generateSlug}
							/>
						{/if}
					{:else if activeStage === 'risks'}
						{#if branchInfo.branch === 'lending_fund'}
							<LendingFundReviewSectionStage
								eyebrow={activeStageConfig?.label || 'Review'}
								title={activeStageConfig?.title || 'Review the risk profile'}
								description={activeStageConfig?.description || ''}
								sections={activeStageConfig?.sections || []}
								form={form}
								fieldErrors={fieldErrors}
								fieldWarnings={fieldWarnings}
								fieldEvidence={reviewFieldEvidence}
								documentUrls={reviewDocumentUrls}
								evidenceLoading={reviewFieldEvidenceState === 'running'}
								variant="lending_fund"
								labelOverrides={{ riskTags: 'Risks', riskNotes: 'Risk Notes', downsideNotes: 'Downside Notes' }}
								onupdate={updateField}
							/>
						{:else}
							<section class="state-card">
								<strong>Opening the redesigned risk review...</strong>
								<p>This stage now lives in the split risk-review flow.</p>
							</section>
						{/if}
					{:else if activeStage === 'summary'}
						<section class="editor-card">
							<div class="card-heading">
								<div>
									<h2>Summary and publish readiness</h2>
									<p>Review each stage, confirm the source-backed risks, and only publish when the record is actually trustworthy.</p>
								</div>
								<span class={`readiness-badge tone-${resolveSummaryReadinessTone({ currentLifecycleStatus, summaryPublishReady, summaryEvidencePending })}`}>
									{resolveSummaryReadinessLabel({ currentLifecycleStatus, summaryPublishReady, summaryEvidencePending })}
								</span>
							</div>

							<div class="summary-grid">
								<div class="summary-card">
									<div class="summary-card__label">Deal branch</div>
									<strong>{DEAL_ONBOARDING_BRANCH_LABELS[manualBranch || branchInfo.branch] || branchInfo.label}</strong>
								</div>
								<div class="summary-card">
									<div class="summary-card__label">SEC gate</div>
									<strong>{SEC_VERIFICATION_LABELS[secStatus] || 'Pending'}</strong>
								</div>
								<div class="summary-card">
									<div class="summary-card__label">Team contacts</div>
									<strong>{teamContactsValidation.valid ? `${teamContacts.length} saved` : 'Needs attention'}</strong>
								</div>
								<div class="summary-card">
									<div class="summary-card__label">Highlighted risks</div>
									<strong>{highlightedRisks.length || 0}</strong>
								</div>
							</div>

							<div class="summary-section-list">
								{#each onboardingStages.filter((stage) => !['intake', 'summary'].includes(stage.id)) as stage}
									<button type="button" class="summary-section-card" onclick={() => navigateToStage(stage.id)}>
										<div>
											<div class="summary-section-card__label">{stage.label}</div>
											<strong>{stage.title}</strong>
											<p>{stage.description}</p>
										</div>
										<span>Edit</span>
									</button>
								{/each}
							</div>

							<section class="editor-card editor-card--nested">
								<div class="card-heading">
									<div>
										<h3>Publish blockers</h3>
										<p>These gates must be satisfied before the deal should move to Published.</p>
									</div>
								</div>
								<div class="check-grid">
									<button
										type="button"
										class={`check-row check-row--interactive ${secGateResolved ? 'is-ready' : 'is-blocked'}`}
										onclick={() => navigateToStage('sec')}
									>
										<div class="check-row__copy">
											<strong>SEC / issuer review completed</strong>
											<span>{secGateResolved ? 'Resolved' : (secStatus === 'skipped' ? 'Skipped for now still blocks publishing' : 'Resolve the SEC stage first')}</span>
										</div>
										<div class="check-row__meta">
											<span class="check-row__status">{secGateResolved ? 'Resolved' : (secStatus === 'skipped' ? 'Still blocked' : 'Needs review')}</span>
											<span class="check-row__action">Open SEC</span>
										</div>
									</button>
									<button
										type="button"
										class={`check-row check-row--interactive ${teamContactsValidation.valid ? 'is-ready' : 'is-blocked'}`}
										onclick={() => navigateToStage('team')}
									>
										<div class="check-row__copy">
											<strong>LP-facing contacts validated</strong>
											<span>{teamContactsValidation.valid ? 'Ready' : (teamContactsValidation.formError || 'Add a valid primary/IR contact')}</span>
										</div>
										<div class="check-row__meta">
											<span class="check-row__status">{teamContactsValidation.valid ? 'Ready' : 'Needs review'}</span>
											<span class="check-row__action">Open Team</span>
										</div>
									</button>
									{#each onboardingFlow.publishRules as rule}
										{@const publishRuleState = getPublishRuleState(rule)}
										<button
											type="button"
											class={`check-row check-row--interactive ${publishRuleState === 'ready' ? 'is-ready' : publishRuleState === 'pending' ? 'is-pending' : 'is-blocked'}`}
											onclick={() => navigateToStage(getRuleTargetStage(rule))}
										>
											<div class="check-row__copy">
												<strong>{rule.label}</strong>
												<span>{getPublishRuleSummary(rule)}</span>
											</div>
											<div class="check-row__meta">
												<span class="check-row__status">{getPublishRuleStatusLabel(rule)}</span>
												<span class="check-row__action">{getRuleActionLabel(rule)}</span>
											</div>
										</button>
									{/each}
								</div>
							</section>

							<div class="summary-actions">
								<a class="ghost-btn" href={`/deal/${dealId}`} target="_blank" rel="noopener">
									Open Deal Page
								</a>
								{#if buildOperatorValidationHref()}
									<a class="ghost-btn" href={buildOperatorValidationHref()}>
										Send operator validation email
									</a>
								{/if}
							</div>
						</section>
					{:else}
						{#if activeStage === 'overview'}
							<section class="editor-card">
								<div class="card-heading">
									<div>
										<h2>Choose the review track</h2>
										<p>Pick the deal branch first so the right questions show up in Key Details.</p>
									</div>
								</div>
								<div class="branch-grid">
									{#each getBranchOptions() as option}
										<button
											type="button"
											class="branch-card"
											class:is-active={(manualBranch || branchInfo.branch) === option.key}
											onclick={() => setManualBranch(option.key)}
										>
											<span>{option.shortLabel}</span>
											<strong>{option.label}</strong>
										</button>
									{/each}
								</div>
							</section>
						{/if}

						{#each getStageFieldGroups(activeStage) as group}
							<section class="editor-card">
								<div class="card-heading">
									<div>
										<h2>{group.label}</h2>
										<p>{group.description}</p>
									</div>
								</div>
								<div class="field-grid">
									{#each group.fieldKeys as fieldKey}
										<FieldRenderer
											field={dealFieldConfig[fieldKey]}
											value={form[fieldKey]}
											error={fieldErrors[fieldKey] || ''}
											warning={fieldWarnings[fieldKey] || ''}
											evidence={reviewFieldEvidence[fieldKey] || []}
											documentUrls={reviewDocumentUrls}
											evidenceLoading={reviewFieldEvidenceState === 'running'}
											onupdate={(nextValue) => updateField(fieldKey, nextValue)}
											onaction={fieldKey === 'slug' ? generateSlug : null}
										/>
									{/each}
								</div>
							</section>
						{/each}
					{/if}

					{#if activeStage !== 'team'}
						{#key `${activeStage}:${nextStage}:${previousStage}`}
							<div class="form-footer wizard-footer">
								<div class="wizard-footer__left">
									{#if activeStage !== 'intake' && previousStage && previousStage !== activeStage}
										<button type="button" class="ghost-btn" onclick={() => navigateToStage(previousStage)}>
											Back
										</button>
									{/if}
								</div>
								<div class="wizard-footer__right">
											<button type="button" class="ghost-btn" onclick={resetForm} disabled={!dirty || reviewFooterBusy}>
												Reset unsaved changes
											</button>
											<button type="submit" class="ghost-btn" disabled={reviewFooterBusy}>
												{reviewFooterBusy ? 'Working...' : 'Save changes'}
											</button>
											{#if activeStage !== 'summary' && nextStage && nextStage !== activeStage}
												<button type="button" class="primary-btn" disabled={reviewFooterBusy} onclick={continueToNextStage}>
													Save & Continue
												</button>
											{/if}
										</div>
								</div>
						{/key}
					{/if}
				</form>
				{/key}

				<DealReviewSidebar
					stages={onboardingStages}
					currentStage={sidebarCurrentStage}
					completedStages={sidebarCompletedStages}
					accessibleStages={sidebarAccessibleStages}
					onselect={(stageId) => navigateToStage(stageId)}
					deckUrl={getDocumentUrl('deck') || form.deckUrl}
					ppmUrl={getDocumentUrl('ppm') || form.ppmUrl}
					subAgreementUrl={deal?.subAgreementUrl || deal?.sub_agreement_url || ''}
					extractionState={extractionState}
				/>
			</div>
		{/if}
	{/if}
</PageContainer>

<style>
	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.save-status {
		display: inline-flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.save-status--success {
		background: rgba(22, 122, 82, 0.12);
		color: #167a52;
	}

	.save-status--warning {
		background: rgba(214, 140, 69, 0.12);
		color: #8c581f;
	}

	.save-status--pending {
		background: rgba(31, 81, 89, 0.1);
		color: #1f5159;
	}

	.save-status--error {
		background: rgba(194, 65, 68, 0.1);
		color: #b42328;
	}

	.review-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 340px);
		gap: 26px;
		align-items: start;
	}

	.review-layout--wide {
		grid-template-columns: minmax(0, 1fr) minmax(300px, 340px);
	}

	.review-stage-progress-mobile {
		display: none;
	}

	.editor-stack {
		display: flex;
		flex-direction: column;
		gap: 18px;
		min-width: 0;
	}

	.intake-screen {
		width: 100%;
		padding: 30px;
		border-radius: 28px;
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.99), rgba(245, 246, 241, 0.98)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.1), transparent 42%);
		border: 1px solid rgba(31, 81, 89, 0.08);
		box-shadow: 0 22px 48px rgba(16, 37, 42, 0.06);
		display: flex;
		flex-direction: column;
		gap: 22px;
	}

	.intake-section,
	.editor-card,
	.state-card {
		padding: 22px;
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.72), rgba(252, 251, 247, 0.72)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.06), transparent 44%);
		border: 1px solid rgba(31, 81, 89, 0.08);
		box-shadow: 0 14px 32px rgba(16, 37, 42, 0.04);
	}

	.classification-signals-card {
		gap: 18px;
		display: grid;
	}

	.classification-signals-card__badge {
		display: inline-flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: #1f5159;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
	}

	.classification-signals-card__status {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.classification-signals-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.classification-signal-item {
		display: grid;
		gap: 6px;
		padding: 16px;
		border-radius: 18px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.58);
	}

	.classification-signal-item--wide {
		grid-column: 1 / -1;
	}

	.classification-signal-item span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.classification-signal-item strong {
		font-size: 15px;
		line-height: 1.6;
		color: var(--text-dark);
	}

	.classification-signal-note {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.classification-signal-note--warning {
		color: #9c4527;
	}

	.classification-signal-note--success {
		color: #167a52;
	}

	.classification-signals-card__actions {
		display: flex;
		justify-content: flex-start;
	}

	.intake-screen__header h2 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: clamp(2rem, 3vw, 2.4rem);
		font-weight: 800;
		color: var(--text-dark);
		letter-spacing: -0.03em;
	}

	.intake-screen__header p {
		margin: 12px 0 0;
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
		max-width: 62ch;
	}

	.intake-screen__eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: #486f61;
		margin-bottom: 10px;
	}

	.intake-upload-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}

	.intake-basics-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}

	.intake-field {
		display: grid;
		gap: 8px;
		padding: 16px;
		border-radius: 20px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.58);
	}

	.intake-field--span-2 {
		grid-column: 1 / -1;
	}

	.intake-field span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.intake-field input {
		width: 100%;
		box-sizing: border-box;
		padding: 13px 14px;
		border-radius: 16px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(252, 251, 247, 0.92);
		font-family: var(--font-body);
		font-size: 15px;
		color: var(--text-dark);
	}

	.intake-field--entity {
		position: relative;
	}

	.intake-entity-shell {
		position: relative;
	}

	.intake-field-meta {
		margin-top: 6px;
		font-size: 12px;
		font-weight: 600;
		line-height: 1.4;
	}

	.intake-field-meta--success {
		color: #167a52;
	}

	.intake-field-meta--info {
		color: #1f5159;
	}

	.intake-field small {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.intake-document-strip {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.intake-document-pill,
	.intake-upload-card {
		padding: 18px;
		border-radius: 20px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.56);
	}

	.intake-document-pill {
		display: grid;
		gap: 6px;
	}

	.intake-document-pill span,
	.intake-upload-card__title {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.intake-upload-card__title {
		margin-bottom: 12px;
	}

	.intake-document-pill strong {
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-dark);
		word-break: break-word;
	}

	.intake-entity-menu {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		z-index: 30;
		padding: 8px;
		border-radius: 16px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.98);
		box-shadow: 0 18px 34px rgba(16, 37, 42, 0.14);
		display: flex;
		flex-direction: column;
		gap: 6px;
		max-height: 260px;
		overflow-y: auto;
	}

	.intake-entity-option,
	.intake-entity-empty {
		padding: 10px 12px;
		border-radius: 12px;
		font-size: 13px;
		line-height: 1.4;
	}

	.intake-entity-option {
		border: none;
		background: rgba(247, 250, 251, 0.9);
		color: var(--text-dark);
		text-align: left;
		cursor: pointer;
		font-family: var(--font-body);
	}

	.intake-entity-option:hover {
		background: rgba(81, 190, 123, 0.1);
	}

	.intake-entity-option--create {
		background: rgba(31, 81, 89, 0.08);
		font-weight: 700;
	}

	.intake-entity-empty {
		color: var(--text-muted);
		background: rgba(247, 250, 251, 0.65);
	}

	.intake-screen__actions,
	.review-workspace__actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		flex-wrap: wrap;
	}

	.review-stage-controls {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
		padding: 2px 2px 0;
	}

	.review-stage-controls__copy {
		display: grid;
		gap: 6px;
	}

	.review-stage-controls__eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	.review-stage-controls h2 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: clamp(1.15rem, 1.8vw, 1.45rem);
		font-weight: 800;
		color: var(--text-dark);
		letter-spacing: -0.03em;
	}

	.review-stage-controls__actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.extraction-preview-card {
		padding: 20px;
		border-radius: 24px;
		border: 1px solid rgba(31, 81, 89, 0.1);
		background:
			linear-gradient(180deg, rgba(245, 250, 247, 0.98), rgba(252, 251, 247, 0.98)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.12), transparent 42%);
		box-shadow: 0 18px 36px rgba(16, 37, 42, 0.05);
		display: grid;
		gap: 16px;
	}

	.extraction-preview-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.extraction-preview-card__eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #486f61;
		margin-bottom: 8px;
	}

	.extraction-preview-card__header h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 18px;
		color: var(--text-dark);
	}

	.extraction-preview-card__header p {
		margin: 8px 0 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
		max-width: 64ch;
	}

	.extraction-preview-card__actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.extraction-preview-list {
		display: grid;
		gap: 12px;
	}

	.extraction-preview-item {
		padding: 16px;
		border-radius: 18px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.72);
		display: grid;
		gap: 12px;
	}

	.extraction-preview-item__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.extraction-preview-item h4 {
		margin: 0;
		font-size: 15px;
		color: var(--text-dark);
	}

	.extraction-preview-item__meta,
	.extraction-preview-item__actions {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.extraction-preview-pill {
		display: inline-flex;
		align-items: center;
		padding: 6px 10px;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: #1f5159;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.extraction-preview-pill--locked {
		background: rgba(214, 140, 69, 0.16);
		color: #8c581f;
	}

	.extraction-preview-diff {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.extraction-preview-diff div {
		display: grid;
		gap: 6px;
		padding: 12px 14px;
		border-radius: 14px;
		background: rgba(247, 250, 251, 0.9);
		border: 1px solid rgba(31, 81, 89, 0.06);
	}

	.extraction-preview-diff span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.extraction-preview-diff strong {
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-dark);
		word-break: break-word;
	}

	.editor-card--structured {
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.96), rgba(246, 248, 243, 0.96)),
			radial-gradient(circle at top right, rgba(31, 81, 89, 0.04), transparent 40%);
	}

	.editor-card--compressed {
		padding: 18px 20px;
		box-shadow: 0 10px 20px rgba(16, 37, 42, 0.03);
	}

	.state-card--error {
		border-color: rgba(194, 65, 68, 0.18);
		background: rgba(255, 244, 244, 0.92);
	}

	.state-card strong,
	.card-heading h2,
	.card-heading h3 {
		display: block;
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--text-dark);
		margin: 0 0 6px;
		letter-spacing: -0.02em;
	}

	.card-heading p,
	.state-card p {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-muted);
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
		margin-top: 16px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field--span-2 {
		grid-column: 1 / -1;
	}

	.field span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.field input,
	.field textarea {
		width: 100%;
		padding: 11px 12px;
		border-radius: 12px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.92);
		color: var(--text-dark);
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.45;
		outline: none;
		transition: border-color 0.16s ease, box-shadow 0.16s ease;
	}

	.field input:focus,
	.field textarea:focus {
		border-color: rgba(31, 81, 89, 0.34);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.field textarea {
		resize: vertical;
		min-height: 96px;
	}

	.ghost-btn,
	.primary-btn,
	.inline-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.16s ease;
	}

	.ghost-btn,
	.inline-btn {
		padding: 10px 14px;
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: rgba(255, 255, 255, 0.9);
		color: var(--text-dark);
	}

	.inline-btn {
		padding: 6px 10px;
		font-size: 11px;
	}

	.primary-btn {
		padding: 10px 16px;
		border: 1px solid rgba(31, 81, 89, 0.16);
		background: linear-gradient(135deg, #1f5159, #10252a);
		color: #fff;
		box-shadow: 0 12px 24px rgba(16, 37, 42, 0.16);
	}

	.primary-btn:disabled,
	.ghost-btn:disabled {
		opacity: 0.55;
		cursor: default;
		box-shadow: none;
	}

	.form-footer,
	.state-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.wizard-footer__left,
	.wizard-footer__right {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.branch-grid,
	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: 12px;
	}

	.branch-card,
	.summary-section-card,
	.summary-card {
		border: 1px solid rgba(31, 81, 89, 0.12);
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.92);
		padding: 14px 16px;
	}

	.branch-card {
		text-align: left;
		cursor: pointer;
		display: grid;
		gap: 6px;
	}

	.branch-card span,
	.summary-card__label,
	.summary-section-card__label {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.branch-card strong,
	.summary-card strong,
	.summary-section-card strong {
		color: var(--text-dark);
	}

	.branch-card.is-active {
		border-color: rgba(81, 190, 123, 0.42);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.summary-section-list {
		display: grid;
		gap: 12px;
	}

	.summary-section-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		text-align: left;
		cursor: pointer;
	}

	.summary-section-card p {
		margin: 6px 0 0;
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.summary-actions {
		display: flex;
		justify-content: flex-end;
	}

	.editor-card--nested {
		padding: 16px;
		box-shadow: none;
		background: rgba(247, 250, 251, 0.7);
	}

	.check-grid {
		display: grid;
		gap: 10px;
	}

	.check-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		padding: 12px 14px;
		border-radius: 14px;
		background: rgba(247, 250, 251, 0.85);
		border: 1px solid rgba(31, 81, 89, 0.08);
	}

	.check-row--interactive {
		appearance: none;
		width: 100%;
		font: inherit;
		text-align: left;
		cursor: pointer;
		transition: transform 160ms ease, box-shadow 160ms ease, border-color 160ms ease;
	}

	.check-row--interactive:hover {
		transform: translateY(-1px);
		box-shadow: 0 12px 24px rgba(16, 37, 42, 0.08);
	}

	.check-row--interactive:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.18);
		border-color: rgba(81, 190, 123, 0.42);
	}

	.check-row.is-ready {
		border-color: rgba(81, 190, 123, 0.24);
		background: rgba(81, 190, 123, 0.08);
	}

	.check-row.is-pending {
		border-color: rgba(214, 140, 69, 0.18);
		background: rgba(214, 140, 69, 0.08);
	}

	.check-row.is-blocked {
		border-color: rgba(175, 66, 47, 0.14);
		background: rgba(175, 66, 47, 0.06);
	}

	.check-row__copy {
		display: grid;
		gap: 4px;
	}

	.check-row__copy span {
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.check-row__meta {
		display: grid;
		gap: 4px;
		justify-items: end;
		text-align: right;
		flex-shrink: 0;
	}

	.check-row__status {
		font-size: 12px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.check-row__action {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.field-grid--single {
		grid-template-columns: 1fr;
	}

	.editor-list-field {
		display: grid;
		gap: 8px;
	}

	.editor-list-field span {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.editor-list-field textarea {
		width: 100%;
		min-height: 120px;
		box-sizing: border-box;
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px solid var(--border);
		background: rgba(255, 255, 255, 0.98);
		font: inherit;
		color: var(--text-dark);
		resize: vertical;
	}

	.message-banner {
		padding: 12px 14px;
		border-radius: 14px;
		font-size: 13px;
		font-weight: 600;
	}

	.message-banner__actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 10px;
	}

	.message-banner--error {
		background: rgba(194, 65, 68, 0.1);
		color: #b42328;
		border: 1px solid rgba(194, 65, 68, 0.16);
	}

	.message-banner--success {
		background: rgba(22, 122, 82, 0.1);
		color: #167a52;
		border: 1px solid rgba(22, 122, 82, 0.16);
	}

	.message-banner--warning {
		background: rgba(214, 140, 69, 0.12);
		color: #8c581f;
		border: 1px solid rgba(214, 140, 69, 0.18);
	}

	.readiness-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 5px 10px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.2px;
	}

	.readiness-badge.tone-ready {
		background: rgba(22, 122, 82, 0.14);
		color: #167a52;
	}

	.readiness-badge.tone-pending {
		background: rgba(214, 140, 69, 0.16);
		color: #8c581f;
	}

	.readiness-badge.tone-blocked {
		background: rgba(194, 65, 68, 0.14);
		color: #b42328;
	}

	@media (max-width: 980px) {
		.review-stage-progress-mobile {
			display: block;
		}

		.review-layout {
			grid-template-columns: 1fr;
		}

		.intake-basics-grid,
		.intake-document-strip,
		.intake-upload-grid,
		.classification-signals-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.field-grid {
			grid-template-columns: 1fr;
		}

		.field--span-2 {
			grid-column: auto;
		}

		.header-actions,
		.form-footer,
		.intake-screen__actions,
		.review-stage-controls__actions,
		.extraction-preview-card__actions,
		.extraction-preview-item__actions,
		.message-banner__actions {
			align-items: stretch;
		}

		.review-stage-controls {
			flex-direction: column;
			align-items: stretch;
		}

		.extraction-preview-card__header,
		.extraction-preview-item__top,
		.extraction-preview-diff {
			grid-template-columns: 1fr;
			flex-direction: column;
			align-items: stretch;
		}

		.summary-section-card,
		.check-row,
		.wizard-footer__left,
		.wizard-footer__right {
			flex-direction: column;
			align-items: stretch;
		}

		.ghost-btn,
		.primary-btn {
			width: 100%;
		}

		.intake-screen {
			padding: 20px;
		}

		.intake-screen__header h2 {
			font-size: 24px;
		}
	}
</style>
