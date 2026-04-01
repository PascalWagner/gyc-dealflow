<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onDestroy, onMount } from 'svelte';
	import DealOnboardingProgress from '$lib/components/deal-review/DealOnboardingProgress.svelte';
	import DealReviewSidebar from '$lib/components/deal-review/DealReviewSidebar.svelte';
	import FieldRenderer from '$lib/components/deal-review/FieldRenderer.svelte';
	import KeyDetailsStage from '$lib/components/deal-review/stages/KeyDetailsStage.svelte';
	import RiskSourceValidationStage from '$lib/components/deal-review/RiskSourceValidationStage.svelte';
	import SecVerificationStage from '$lib/components/deal-review/SecVerificationStage.svelte';
	import TeamContactsStage from '$lib/components/onboarding/TeamContactsStage.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import {
		deriveTeamRoleAssignments,
		mergeSuggestedTeamContacts,
		normalizeTeamContacts,
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
		slugify
	} from '$lib/utils/dealWorkflow.js';
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

	function updateListState(kind, rawValue) {
		const nextList = listFromValue(rawValue);
		if (kind === 'source') {
			sourceRiskFactors = nextList;
		} else {
			highlightedRisks = nextList;
		}
		markDirty();
	}

	function getStageHref(stage, { extract = false, from = '' } = {}) {
		const params = new URLSearchParams({ id: dealId });
		params.set('stage', stage);
		if (stage === 'intake') params.set('step', 'intake');
		if (from) params.set('from', from);
		if (extract) params.set('extract', '1');
		return `/deal-review?${params.toString()}`;
	}

	function getStageFieldGroups(stage) {
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

	let loading = $state(true);
	let saving = $state(false);
	let loadError = $state('');
	let saveError = $state('');
	let saveMessage = $state('');
	let dirty = $state(false);
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
	let secVerificationContext = $state(null);
	let sourceRiskFactors = $state([]);
	let highlightedRisks = $state([]);
	let riskFactorDraft = $state('');
	let highlightedRiskDraft = $state('');
	let manualBranch = $state('');

	const dealId = $derived($page.url.searchParams.get('id') || '');
	const requestedStage = $derived($page.url.searchParams.get('stage') || '');
	const reviewStep = $derived($page.url.searchParams.get('step') === 'intake' ? 'intake' : 'review');
	const shouldAutoExtract = $derived($page.url.searchParams.get('extract') === '1');
	const cameFromIntake = $derived($page.url.searchParams.get('from') === 'intake');
	const cameFromQueue = $derived($page.url.searchParams.get('from') === 'queue');
	const onboardingSource = $derived({
		...(deal || {}),
		...form,
		sponsorName: form.sponsor?.name || deal?.sponsor_name || deal?.sponsorName || '',
		managementCompanyId: form.sponsor?.id || deal?.management_company_id || deal?.managementCompanyId || '',
		branch: manualBranch || deal?.deal_branch || deal?.dealBranch || '',
		dealBranch: manualBranch || deal?.deal_branch || deal?.dealBranch || ''
	});
	const branchInfo = $derived(resolveDealOnboardingBranch(onboardingSource));
	const onboardingStages = $derived(getDealOnboardingStages({ branch: branchInfo.branch, source: onboardingSource }));
	const onboardingFlow = $derived(buildDealOnboardingFlow(onboardingSource, { branch: branchInfo.branch }));
	const teamContactsValidation = $derived(validateTeamContacts(teamContacts));
	const primaryTeamContact = $derived(pickPrimaryTeamContact(teamContacts));
	const irTeamContact = $derived(pickInvestorRelationsContact(teamContacts));
	const secStatus = $derived(secVerificationContext?.view?.currentStatus || 'pending');
	const secGateResolved = $derived(isResolvedSecVerificationStatus(secStatus));
	const hasSourceDocuments = $derived(
		Boolean(deal?.deckUrl || deal?.deck_url || deal?.ppmUrl || deal?.ppm_url)
	);
	const summaryPublishReady = $derived(onboardingFlow.isPublishReady && teamContactsValidation.valid && secGateResolved);
	function isStageComplete(stage) {
		if (!stage) return false;
		if (stage.id === 'intake') return hasSourceDocuments;
		if (stage.id === 'sec') return secGateResolved;
		if (stage.id === 'team') return teamContactsValidation.valid;
		return (stage.rules || []).every((rule) => rule.satisfied);
	}
	const furthestUnlockedStage = $derived.by(() => {
		if (!deal) return reviewStep === 'intake' ? 'intake' : 'sec';
		if (!hasSourceDocuments) return 'intake';
		if (!secGateResolved) return 'sec';
		if (!teamContactsValidation.valid) return 'team';
		return 'summary';
	});
	const unlockedStageIds = $derived.by(() => {
		const unlockedIndex = onboardingStages.findIndex((candidate) => candidate.id === furthestUnlockedStage);
		if (unlockedIndex < 0) return ['intake'];
		return onboardingStages
			.filter((stage, index) => index <= unlockedIndex)
			.map((stage) => stage.id);
	});
	const activeStage = $derived.by(() => {
		if (reviewStep === 'intake') return 'intake';
		const unlockedIndex = onboardingStages.findIndex((candidate) => candidate.id === furthestUnlockedStage);
		if (!isValidOnboardingStage(requestedStage)) return furthestUnlockedStage;

		const requestedIndex = onboardingStages.findIndex((candidate) => candidate.id === requestedStage);
		return requestedIndex >= 0 && requestedIndex <= unlockedIndex ? requestedStage : furthestUnlockedStage;
	});
	const activeStageConfig = $derived(getDealOnboardingStageById(activeStage, { branch: branchInfo.branch, source: onboardingSource }));
	const previousStage = $derived(getPreviousOnboardingStage(activeStage, branchInfo.branch));
	const nextStage = $derived(getNextOnboardingStage(activeStage, branchInfo.branch));
	const completedStageIds = $derived(
		onboardingStages
			.filter((stage) =>
				stage.index < onboardingStages.findIndex((candidate) => candidate.id === activeStage)
				&& isStageComplete(stage)
			)
			.map((stage) => stage.id)
	);
	const sidebarCurrentStage = $derived(reviewStep === 'intake' ? 'intake' : activeStage);
	const sidebarCompletedStages = $derived(reviewStep === 'intake' ? [] : completedStageIds);
	const sidebarAccessibleStages = $derived(reviewStep === 'intake' ? ['intake'] : unlockedStageIds);
	const reviewWorkspaceTitle = $derived(activeStageConfig?.title || 'Review extracted deal details');
	const backHref = $derived($isAdmin ? '/app/admin/manage' : ($isGP ? '/gp-dashboard' : '/app/deals'));
	const backLabel = $derived($isAdmin ? 'Back to Queue' : ($isGP ? 'Back to Dashboard' : 'Back to Deals'));
	const pageSubtitle = $derived(
		activeStage === 'intake'
			? 'Upload the source documents first, then review and clean up the extracted deal details.'
			: activeStageConfig?.description || 'Fix missing fields, tighten source context, and move the deal toward publishing with confidence.'
	);
	const visibleSchemaWarnings = $derived.by(() => {
		const warningEntries = Object.entries(fieldWarnings).filter(([, message]) => Boolean(message));
		if (warningEntries.length === 0) return [];
		if (activeStage === 'summary') return warningEntries;

		const stageFieldKeys = new Set(
			getStageFieldGroups(activeStage)
				.flatMap((group) => Array.isArray(group?.fieldKeys) ? group.fieldKeys : [])
		);
		return warningEntries.filter(([fieldKey]) => stageFieldKeys.has(fieldKey));
	});
	const visibleSchemaWarningLabels = $derived(
		visibleSchemaWarnings.map(([fieldKey]) => dealFieldConfig[fieldKey]?.label || fieldKey)
	);
	const schemaWarningMessage = $derived.by(() => {
		if (visibleSchemaWarnings.length === 0) return '';

		const labelSummary = visibleSchemaWarningLabels.length <= 3
			? visibleSchemaWarningLabels.join(', ')
			: `${visibleSchemaWarningLabels.slice(0, 2).join(', ')}, +${visibleSchemaWarningLabels.length - 2} more`;

		return activeStage === 'summary'
			? `Imported values still need normalization before publishing: ${labelSummary}. Choose the closest canonical options.`
			: `Imported values in this step still need normalization: ${labelSummary}. Choose the closest canonical options before moving on.`;
	});

	function markDirty() {
		dirty = true;
		saveMessage = '';
	}

	function updateField(fieldKey, nextValue) {
		form = {
			...form,
			[fieldKey]: nextValue
		};
		fieldErrors = {
			...fieldErrors,
			[fieldKey]: ''
		};
		fieldWarnings = {
			...fieldWarnings,
			[fieldKey]: getDealReviewFieldWarning(fieldKey, nextValue)
		};
		markDirty();
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
		fieldWarnings = hydrated.warnings;
		fieldErrors = {};
		manualBranch = nextDeal?.deal_branch || nextDeal?.dealBranch || manualBranch || '';
		sourceRiskFactors = listFromDealValue(nextDeal, 'source_risk_factors', 'sourceRiskFactors');
		highlightedRisks = listFromDealValue(nextDeal, 'highlighted_risks', 'highlightedRisks');
		dirty = false;
		saveError = '';
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
		if (stage === 'intake') params.set('step', 'intake');
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
		if (!file || !base64) {
			return { payload: null, warning: null };
		}
		if (!actor.session?.token) {
			return {
				payload: null,
				warning: 'Your session is missing the upload token needed for documents.'
			};
		}

		const response = await fetch('/api/deck-upload', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${actor.session.token}`
			},
			body: JSON.stringify({
				dealId,
				dealName: docType === 'ppm' ? `${form.investmentName || deal?.investmentName || deal?.investment_name || 'Deal'} - PPM` : form.investmentName || deal?.investmentName || deal?.investment_name || 'Deal',
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
			uploadError = 'Upload a deck or PPM before starting extraction, or continue to review manually.';
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
			body: JSON.stringify(intakePayload)
		});
		const payload = await response.json().catch(() => ({}));

		if (!response.ok || !payload?.deal) {
			throw new Error(payload?.error || 'Could not save the intake details.');
		}

		syncDealState(payload.deal);
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
		let savedContacts = [];
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

				savedContacts = normalizeTeamContacts(payload.teamContacts || payload.team_contacts || [], {
					ensureOne: false,
					preserveEmpty: true
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
			const mergedState = mergeSuggestedTeamContacts(teamContacts, suggestionPayload?.contacts || []);
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

			teamContacts = normalizeTeamContacts(payload.teamContacts || payload.team_contacts || validation.contacts, {
				ensureOne: false,
				preserveEmpty: true
			});
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

	async function loadSecVerificationSummary() {
		if (!dealId || reviewStep === 'intake') return;
		try {
			const token = await getFreshSessionToken();
			if (!token) return;
			const response = await fetch(`/api/sec-verification?dealId=${encodeURIComponent(dealId)}`, {
				headers: {
					Authorization: `Bearer ${token}`
				}
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) return;
			secVerificationContext = payload;
		} catch {
			// Keep the stage non-blocking if the SEC summary cannot be prefetched.
		}
	}

	function getSaveFieldKeysForStage(stage = activeStage) {
		if (!stage || stage === 'summary') return null;
		return getOnboardingStageFieldKeys(stage, branchInfo.branch);
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

			const response = await fetch(`/api/deals?id=${encodeURIComponent(dealId)}`, {
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
			await Promise.all([loadTeamContacts(), loadSecVerificationSummary()]);
		} catch (error) {
			loadError = error?.message || 'Failed to load deal.';
			deal = null;
		} finally {
			loading = false;
		}
	}

	async function saveDeal({ quiet = false, stage = activeStage } = {}) {
		if (!dealId || saving) return false;

		const scopedFieldKeys = getSaveFieldKeysForStage(stage);
		const { payload: nextPayload, errors } = buildDealReviewPayload(form, {
			includeFieldKeys: scopedFieldKeys
		});
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
				body: JSON.stringify(requestBody)
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
				throw new Error(payload?.error || 'Failed to save deal.');
			}

			syncDealState(
				{
					...(deal || {}),
					...payload.deal
				},
				{ clearSaveMessage: true }
			);
			if (!quiet) {
				saveMessage = 'Deal saved.';
			}
			return true;
		} catch (error) {
			saveError = error?.message || 'Failed to save deal.';
			return false;
		} finally {
			saving = false;
		}
	}

	async function runExtraction() {
		if (!dealId || extractionState === 'running') return;

		extractionState = 'running';
		extractionError = '';
		extractionSummary = null;
		saveMessage = '';

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
					dealId
				})
			});
			const enrichPayload = await enrichResponse.json().catch(() => ({}));

			if (!enrichResponse.ok || !enrichPayload?.success) {
				throw new Error(enrichPayload?.error || 'Failed to extract deal details.');
			}

			const updates = enrichPayload?.found_fields || {};
			let appliedCount = 0;

			if (Object.keys(updates).length > 0) {
				const applyResponse = await fetch('/api/deal-cleanup', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`
					},
					body: JSON.stringify({
						action: 'apply-enrichment',
						dealId,
						updates
					})
				});
				const applyPayload = await applyResponse.json().catch(() => ({}));

				if (!applyResponse.ok || !applyPayload?.success) {
					throw new Error(applyPayload?.error || 'The extracted fields could not be applied.');
				}

				appliedCount = Array.isArray(applyPayload.fields_updated)
					? applyPayload.fields_updated.length
					: Object.keys(updates).length;

				if (applyPayload?.data) {
					syncDealState({
						...(deal || {}),
						...applyPayload.data
					});
				}
			}

			await loadSecVerificationSummary();
			secStageRefreshKey += 1;
			extractionSummary = {
				fieldsFound: Object.keys(updates).length,
				fieldsApplied: appliedCount,
				sources: enrichPayload?.sources || [],
				steps: enrichPayload?.steps || [],
				notes: enrichPayload?.notes || ''
			};
			extractionState = 'success';
			saveMessage = appliedCount > 0
				? `We prefilled ${appliedCount} fields from the uploaded sources. Review them before publishing.`
				: 'The uploaded sources were processed. Review the deal details before publishing.';
		} catch (error) {
			extractionState = 'error';
			extractionError = error?.message || 'Failed to extract deal details.';
		} finally {
			clearExtractionFlags();
		}
	}

	async function saveCurrentStage(stage = activeStage) {
		if (stage === 'intake') {
			await saveIntakeDetails();
			return true;
		}
		if (stage === 'team') {
			return await saveTeamContacts({ quiet: true, requireComplete: true });
		}
		if (stage === 'sec') {
			if (!secGateResolved) {
				saveError = `Resolve SEC issuer verification first. Current state: ${SEC_VERIFICATION_LABELS[secStatus] || 'Pending'}.`;
				return false;
			}
			return true;
		}
		return await saveDeal({ quiet: true, stage });
	}

	async function saveActiveReviewStage() {
		if (activeStage === 'intake') {
			return await saveIntakeDetails();
		}
		if (activeStage === 'team') {
			return await saveTeamContacts({ quiet: false, requireComplete: false });
		}
		return await saveDeal({ stage: activeStage });
	}

	async function navigateToStage(stage, { from = '', allowAdvance = false } = {}) {
		if (!dealId) return;
		const targetStage = stage;
		if (!targetStage || targetStage === activeStage) return;

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

		if (targetIndex < 0) return;
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
			return;
		}

		if (movingForward) {
			const shouldSaveBeforeAdvance = dirty || ['intake', 'team', 'sec'].includes(activeStage);
			const ok = shouldSaveBeforeAdvance ? await saveCurrentStage(activeStage) : true;
			if (!ok) return;
		}

		saveError = '';
		await goto(getStageHref(targetStage, { from: from || (cameFromQueue ? 'queue' : cameFromIntake ? 'intake' : '') }), {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		});
	}

	onMount(async () => {
		previousDealId = dealId;
		await loadDeal();
	});

	onDestroy(() => {
		if (intakeSponsorBlurTimer) clearTimeout(intakeSponsorBlurTimer);
		if (intakeSponsorSearchTimer) clearTimeout(intakeSponsorSearchTimer);
	});

	$effect(() => {
		if (!dealId || dealId === previousDealId) return;
		previousDealId = dealId;
		autoExtractionHandled = false;
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
		void runExtraction();
	});

	$effect(() => {
		if (!browser || loading || !dealId || loadError) return;
		const targetHref = getStageHref(activeStage, {
			from: cameFromQueue ? 'queue' : cameFromIntake ? 'intake' : '',
			extract: shouldAutoExtract && !autoExtractionHandled
		});
		const currentHref = `${$page.url.pathname}${$page.url.search}`;
		if (targetHref === currentHref) return;
		goto(targetHref, {
			replaceState: true,
			noScroll: true,
			keepFocus: true
		}).catch(() => {});
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
			<button type="button" class="ghost-btn" onclick={() => goto(backHref)}>
				{backLabel}
			</button>
				{#if dealId && activeStage !== 'intake'}
					<a class="ghost-btn" href={`/deal/${dealId}`} target="_blank" rel="noopener">Open Deal</a>
					<button type="button" class="primary-btn" onclick={saveActiveReviewStage} disabled={loading || saving || teamContactsSaveState === 'running' || !dirty}>
						{saving || teamContactsSaveState === 'running' ? 'Saving...' : dirty ? 'Save' : 'Saved'}
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
				<button type="button" class="ghost-btn" onclick={() => goto(backHref)}>{backLabel}</button>
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
								{uploadState === 'running' ? 'Working...' : 'Review Manually'}
							</button>
							<button
								type="button"
								class="primary-btn"
								onclick={() => continueFromIntake({ autoExtract: true })}
								disabled={uploadState === 'running'}
							>
								{uploadState === 'running' ? 'Uploading...' : 'Upload & Extract'}
							</button>
						</div>
					</section>
				</div>

				<DealReviewSidebar
					stages={onboardingStages}
					currentStage={sidebarCurrentStage}
					completedStages={sidebarCompletedStages}
					accessibleStages={sidebarAccessibleStages}
					onselect={() => {}}
					deckUrl={getDocumentUrl('deck') || form.deckUrl}
					ppmUrl={getDocumentUrl('ppm') || form.ppmUrl}
					subAgreementUrl={deal?.subAgreementUrl || deal?.sub_agreement_url || ''}
					extractionState={extractionState}
				/>
			</div>
		{:else}
			<div class={`review-layout ${activeStage === 'team' ? 'review-layout--wide' : ''}`}>
				<form class="editor-stack" onsubmit={(event) => { event.preventDefault(); saveActiveReviewStage(); }}>
					{#if cameFromQueue || hasSourceDocuments}
						<div class="review-stage-controls">
							<div class="review-stage-controls__copy">
								<div class="review-stage-controls__eyebrow">{activeStageConfig?.label || 'Review'} Step</div>
								<h2>{reviewWorkspaceTitle}</h2>
							</div>
						</div>
					{/if}

					{#if saveError}
						<div class="message-banner message-banner--error">{saveError}</div>
					{/if}

					{#if saveMessage && !(extractionSummary && /prefilled/i.test(saveMessage))}
						<div class="message-banner message-banner--success">{saveMessage}</div>
					{/if}

					{#if schemaWarningMessage}
						<div class="message-banner message-banner--warning">
							{schemaWarningMessage}
						</div>
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
								onchange={(nextContacts) => {
									teamContacts = nextContacts;
									teamContactsError = '';
									dirty = true;
									saveMessage = '';
								}}
								onback={() => navigateToStage(previousStage)}
								oncontinue={() => navigateToStage(nextStage, { allowAdvance: true })}
							/>
						{/key}
					{:else if activeStage === 'details'}
						<KeyDetailsStage
							source={{ ...deal, branch: manualBranch || branchInfo.branch }}
							form={{ ...form, branch: manualBranch || branchInfo.branch }}
							branch={manualBranch || branchInfo.branch}
							fieldErrors={fieldErrors}
							fieldWarnings={fieldWarnings}
							onupdate={updateField}
							onaction={generateSlug}
						/>
					{:else if activeStage === 'summary'}
						<section class="editor-card">
							<div class="card-heading">
								<div>
									<h2>Summary and publish readiness</h2>
									<p>Review each stage, confirm the source-backed risks, and only publish when the record is actually trustworthy.</p>
								</div>
								<span class={`readiness-badge tone-${summaryPublishReady ? 'ready' : 'blocked'}`}>
									{summaryPublishReady ? 'Ready to publish' : 'Still blocked'}
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
									<div class={`check-row ${secGateResolved ? 'is-ready' : 'is-blocked'}`}>
										<strong>SEC / issuer verification resolved</strong>
										<span>{secGateResolved ? 'Resolved' : 'Resolve the SEC stage first'}</span>
									</div>
									<div class={`check-row ${teamContactsValidation.valid ? 'is-ready' : 'is-blocked'}`}>
										<strong>LP-facing contacts validated</strong>
										<span>{teamContactsValidation.valid ? 'Ready' : (teamContactsValidation.formError || 'Add a valid primary/IR contact')}</span>
									</div>
									{#each onboardingFlow.publishRules as rule}
										<div class={`check-row ${rule.satisfied ? 'is-ready' : 'is-blocked'}`}>
											<strong>{rule.label}</strong>
											<span>{rule.satisfied ? 'Ready' : `${rule.missingFieldKeys.length} fields still missing`}</span>
										</div>
									{/each}
								</div>
							</section>

							{#if buildOperatorValidationHref()}
								<div class="summary-actions">
									<a class="ghost-btn" href={buildOperatorValidationHref()}>
										Send operator validation email
									</a>
								</div>
							{/if}
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
											onupdate={(nextValue) => updateField(fieldKey, nextValue)}
											onaction={fieldKey === 'slug' ? generateSlug : null}
										/>
									{/each}
								</div>
							</section>
						{/each}

						{#if activeStage === 'risks'}
							<section class="editor-card">
								<div class="card-heading">
									<div>
										<h2>Risk extraction and highlights</h2>
										<p>Use one line per item. The first list captures what the documents say. The second list captures what you want highlighted on the deal page.</p>
									</div>
								</div>
								<div class="field-grid field-grid--single">
									<label class="editor-list-field">
										<span>Source risk factors</span>
										<textarea
											rows="6"
											placeholder="One risk factor per line pulled from the PPM or deck"
											value={listToTextarea(sourceRiskFactors)}
											oninput={(event) => updateListState('source', event.currentTarget.value)}
										></textarea>
									</label>
									<label class="editor-list-field">
										<span>Highlighted risks for the deal page</span>
										<textarea
											rows="5"
											placeholder="One highlighted risk per line"
											value={listToTextarea(highlightedRisks)}
											oninput={(event) => updateListState('highlight', event.currentTarget.value)}
										></textarea>
									</label>
								</div>
							</section>

							<RiskSourceValidationStage
								deal={{
									...deal,
									deckUrl: getDocumentUrl('deck') || deal?.deck_url || form.deckUrl,
									ppmUrl: getDocumentUrl('ppm') || deal?.ppm_url || form.ppmUrl,
									primarySourceUrl: form.primarySourceUrl,
									primarySourceContext: form.primarySourceContext,
									riskNotes: form.riskNotes,
									downsideNotes: form.downsideNotes,
									operatorBackground: form.operatorBackground,
									keyDates: form.keyDates,
									sourceRiskFactors,
									highlightedRisks
								}}
							/>
						{/if}
					{/if}

					{#if activeStage !== 'team'}
						<div class="form-footer wizard-footer">
							<div class="wizard-footer__left">
								{#if activeStage !== 'intake' && previousStage && previousStage !== activeStage}
									<button type="button" class="ghost-btn" onclick={() => navigateToStage(previousStage)}>
										Back
									</button>
								{/if}
							</div>
							<div class="wizard-footer__right">
									<button type="button" class="ghost-btn" onclick={resetForm} disabled={!dirty || saving}>
										Reset unsaved changes
									</button>
									<button type="submit" class="ghost-btn" disabled={saving}>
										{saving ? 'Saving...' : 'Save changes'}
									</button>
									{#if activeStage !== 'summary' && nextStage && nextStage !== activeStage}
										<button type="button" class="primary-btn" disabled={saving} onclick={() => navigateToStage(nextStage, { allowAdvance: true })}>
											Save & Continue
										</button>
									{/if}
								</div>
							</div>
					{/if}
				</form>

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

	.check-row.is-ready {
		border-color: rgba(81, 190, 123, 0.24);
		background: rgba(81, 190, 123, 0.08);
	}

	.check-row.is-blocked {
		border-color: rgba(175, 66, 47, 0.14);
		background: rgba(175, 66, 47, 0.06);
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
		.intake-upload-grid {
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
		.review-stage-controls__actions {
			align-items: stretch;
		}

		.review-stage-controls {
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
