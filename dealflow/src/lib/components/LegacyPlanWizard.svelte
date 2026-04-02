<script>
	import { createEventDispatcher, onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { browser } from '$app/environment';
	import { currentAdminRealUser, writeUserScopedJson, writeUserScopedString } from '$lib/utils/userScopedState.js';
	import { getStoredSessionUser, user } from '$lib/stores/auth.js';
	import OnboardingSelectableCard from '$lib/components/onboarding/OnboardingSelectableCard.svelte';
	import OnboardingProgress from '$lib/components/onboarding/OnboardingProgress.svelte';
	import {
		STEP,
		STEP_SEQUENCE,
		PHASE_NAMES,
		GOAL_CARDS,
		PLAN_ASSET_OPTIONS,
		CAPITAL_OPTIONS,
		READINESS_OPTIONS,
		SOURCE_OPTIONS,
		RE_PRO_OPTIONS,
		GROWTH_PRIORITY_OPTIONS,
		LOSS_TOLERANCE_OPTIONS,
		DIVERSIFICATION_OPTIONS,
		OPERATOR_FOCUS_OPTIONS,
		LOCKUP_OPTIONS,
		DISTRIBUTION_OPTIONS,
		ACCREDITATION_OPTIONS,
		NETWORK_BENEFITS,
		ASSET_CLASS_OPTIONS,
		STRATEGY_ORDER,
		STRATEGY_OPTIONS,
		averageDealYieldForAsset,
		applyGoalDefaults,
		flowKeyToBranch,
		formatCompactMoney,
		generatePortfolioPlan,
		getStepSequence,
		isFreeFlowComplete,
		normalizeWizardData,
		parseDollar,
		phaseForStep,
		planHeroCopy,
		stageSlugForStep,
		shouldSkipPrefilledStep,
		stepIndexForStage,
		wizardSummaryRows,
		wizardToBuyBoxPayload,
		wizardToGoalsPayload
	} from '$lib/onboarding/planWizard.js';

	export let initialData = {};
	export let forceEdit = false;
	export let forcedStage = '';
	export let forcedBranch = '';
	export let forcedFlowKey = '';
	export let fullPlanMode = false;
	export let freeCompleteRedirectTo = '/app/deals';
	export let paidCompleteRedirectTo = '/app/deals';

	const dispatch = createEventDispatcher();

	let initialized = false;
	let wizardData = normalizeWizardData(initialData);
	let wizardStepIndex = 0;
	let allDeals = [];
	let validationError = '';
	let saving = false;
	let saveMessage = '';
	let saveTimer = null;
	let draggedPlanSlotId = null;
	let planDropYear = null;
	let planDropBeforeSlotId = null;
	let planFieldState = {};
	let hasLocalEdits = false;
	let lastHydratedInitialDataKey = '';

	function sequenceSourceData(data = wizardData) {
		const normalized = normalizeWizardData(data);
		const inferredBranch = normalized._branch || forcedBranch || flowKeyToBranch(forcedFlowKey);
		if (!inferredBranch || normalized._branch === inferredBranch) return normalized;
		return normalizeWizardData({
			...normalized,
			_branch: inferredBranch,
			branch: inferredBranch
		});
	}

	function sequenceForData(data = wizardData) {
		const source = sequenceSourceData(data);
		return fullPlanMode
			? getStepSequence(source, { editing: forceEdit, includePaidFlow: true })
			: forcedFlowKey && STEP_SEQUENCE[forcedFlowKey]
				? [...STEP_SEQUENCE[forcedFlowKey]]
				: getStepSequence(source, { editing: forceEdit, includePaidFlow: false });
	}

	function serializeWizardState(data = {}) {
		return JSON.stringify(normalizeWizardData(data));
	}

	function hydrateWizardDataFromProps({ preserveCurrentStep = true } = {}) {
		let nextWizardData = normalizeWizardData(initialData);
		const inferredBranch = forcedBranch || flowKeyToBranch(forcedFlowKey);
		if (inferredBranch && !nextWizardData._branch) {
			nextWizardData = applyGoalDefaults(nextWizardData, inferredBranch);
		}
		if (forceEdit) {
			nextWizardData = { ...nextWizardData, _isEditing: true };
		}

		const nextSequence = sequenceForData(nextWizardData);
		const currentStage = preserveCurrentStep ? currentStep : '';
		let nextIndex = currentStage ? nextSequence.indexOf(currentStage) : -1;
		if (nextIndex < 0) nextIndex = stepIndexForStage(nextSequence, forcedStage);
		if (nextIndex < 0) nextIndex = 0;
		if (!preserveCurrentStep && !forcedStage) {
			while (
				nextIndex < nextSequence.length - 1 &&
				shouldSkipPrefilledStep(nextSequence[nextIndex], nextWizardData, {
					editing: forceEdit,
					forcedStage: Boolean(forcedStage)
				})
			) {
				nextIndex += 1;
			}
		}

		wizardData = nextWizardData;
		wizardStepIndex = nextIndex;
		lastHydratedInitialDataKey = serializeWizardState(nextWizardData);
		hasLocalEdits = false;
	}

	function moneyInputValue(value) {
		if (value === undefined || value === null || value === '') return '';
		return String(parseDollar(value));
	}

	function completionCtaLabel() {
		if (paidCompleteRedirectTo === '/app/plan') return 'View My Full Plan →';
		if (paidCompleteRedirectTo === '/app/deals') return 'Browse My Matches →';
		return 'Continue →';
	}

	$: sequence = sequenceForData(wizardData);
	$: if (sequence.length && wizardStepIndex > sequence.length - 1) wizardStepIndex = sequence.length - 1;
	$: currentStep = sequence[wizardStepIndex] || sequence[0] || STEP.GOAL;
	$: currentPhase = phaseForStep(currentStep);
	$: currentTitle = stepTitleFor(currentStep);
	$: currentSubtitle = stepSubtitleFor(currentStep);
	$: currentFlowKey = activeFlowKey(currentStep);
	$: reviewRows = wizardSummaryRows(wizardData);
	$: planPreview = generatePortfolioPlan(wizardData, allDeals);
	$: groupedPlanYearRows = buildGroupedPlanYears(planPreview);
	$: heroCopy = planHeroCopy(wizardData, planPreview);
	$: phaseItems = PHASE_NAMES.map((label, index) => buildPhaseItem(label, index));
	$: globalPlanCheckSize = parseDollar(wizardData.checkSize) || planPreview.check_size || 100000;
	$: globalPlanYieldPct = wizardData.planTargetYieldPct !== undefined && wizardData.planTargetYieldPct !== null && wizardData.planTargetYieldPct !== ''
		? Number(wizardData.planTargetYieldPct)
		: Math.round(Number(planPreview.blended_coc || 0.08) * 100);
	$: planFieldState = Object.fromEntries(
		(Array.isArray(planPreview?.slots) ? planPreview.slots : []).map((slot) => [
			slot.id,
			{
				assetClass: slot.asset_class,
				checkSize: String(Number(slot.check_size || 0)),
				yieldPct: (Number(slot.target_coc || 0) * 100).toFixed(1)
			}
		])
	);
	$: if (browser && initialized && currentStep) {
		syncReviewUrl({
			step: currentStep,
			flowKey: currentFlowKey,
			branch: wizardData._branch,
			editMode: forceEdit
		});
	}
	$: initialDataKey = serializeWizardState(initialData);
	$: if (initialized && !hasLocalEdits && initialDataKey !== lastHydratedInitialDataKey) {
		hydrateWizardDataFromProps({ preserveCurrentStep: true });
	}

	onMount(async () => {
		initializeWizard();
		await loadDeals();
	});

	function initializeWizard() {
		if (initialized) return;
		hydrateWizardDataFromProps({ preserveCurrentStep: false });
		initialized = true;
	}

	async function loadDeals() {
		if (!browser) return;
		try {
			const response = await fetch('/api/deals?include506b=true');
			if (!response.ok) return;
			const data = await response.json();
			const rows = Array.isArray(data?.deals)
				? data.deals
				: Array.isArray(data?.records)
					? data.records
					: Array.isArray(data)
						? data
						: [];
			allDeals = rows;
		} catch {
			allDeals = [];
		}
	}

	function setWizardData(next, { autosave = true, markDirty = true } = {}) {
		wizardData = normalizeWizardData(next);
		validationError = '';
		if (markDirty) hasLocalEdits = true;
		if (browser) {
			writeUserScopedJson('gycBuyBoxWizard', wizardData);
		}
		if (autosave) scheduleSave();
	}

	function emitWizardState(detail = {}) {
		dispatch('state', {
			wizardData: normalizeWizardData(wizardData),
			...detail
		});
	}

	function activeFlowKey(step = currentStep) {
		if (STEP_SEQUENCE.free.includes(step)) return 'free';
		const branch = wizardData._branch || flowKeyToBranch(forcedFlowKey) || 'cashflow';
		return `paid_${branch}`;
	}

	function syncReviewUrl({ step = currentStep, flowKey = activeFlowKey(step), branch = wizardData._branch, editMode = forceEdit } = {}) {
		const stage = stageSlugForStep(step);
		if (!stage) return;
		const url = new URL(window.location.href);
		url.searchParams.set('stage', stage);
		url.searchParams.set('flow', flowKey);
		if (branch) url.searchParams.set('branch', branch);
		else url.searchParams.delete('branch');
		if (editMode) url.searchParams.set('edit', '1');
		else url.searchParams.delete('edit');
		window.history.replaceState(window.history.state, '', `${url.pathname}?${url.searchParams.toString()}${url.hash}`);
	}

	function buildPhaseItem(label, phaseIndex) {
		if (!forceEdit) return { label };
		if (phaseIndex === PHASE_NAMES.length - 1) {
			return {
				label,
				onClick: () => void exitToPlan()
			};
		}
		return {
			label,
			onClick: () => jumpToPhase(phaseIndex)
		};
	}

	function jumpToPhase(phaseIndex) {
		const nextIndex = sequence.findIndex((step) => phaseForStep(step) === phaseIndex);
		if (nextIndex < 0 || nextIndex === wizardStepIndex) return;
		validationError = '';
		wizardStepIndex = nextIndex;
	}

	function jumpToStep(step) {
		const nextIndex = sequence.findIndex((candidate) => candidate === step);
		if (nextIndex < 0 || nextIndex === wizardStepIndex) return;
		validationError = '';
		wizardStepIndex = nextIndex;
	}

	async function exitToPlan() {
		if (!browser) return;
		window.location.assign('/app/plan');
	}

	function updateField(key, value, { autosave = true } = {}) {
		setWizardData({ ...wizardData, [key]: value }, { autosave });
	}

	function toggleAssetClass(assetClass) {
		const selected = new Set(wizardData.assetClasses || []);
		if (selected.has(assetClass)) selected.delete(assetClass);
		else selected.add(assetClass);
		setWizardData({ ...wizardData, assetClasses: [...selected], dealTypes: wizardData.strategies || [] });
	}

	function toggleStrategy(strategy) {
		const selected = new Set(wizardData.strategies || []);
		if (selected.has(strategy)) selected.delete(strategy);
		else selected.add(strategy);
		setWizardData({ ...wizardData, strategies: [...selected], dealTypes: [...selected] });
	}

	function toggleAccreditation(value) {
		const current = new Set(Array.isArray(wizardData.accreditation) ? wizardData.accreditation : []);
		if (value === 'not_accredited') {
			const next = current.has('not_accredited') ? [] : ['not_accredited'];
			setWizardData({ ...wizardData, accreditation: next });
			return;
		}
		current.delete('not_accredited');
		if (current.has(value)) current.delete(value);
		else current.add(value);
		setWizardData({ ...wizardData, accreditation: [...current] });
	}

	function selectGoal(branch) {
		setWizardData(applyGoalDefaults(wizardData, branch));
		wizardStepIndex = Math.min(wizardStepIndex + 1, sequence.length - 1);
		skipAnsweredSteps();
	}

	function skipAnsweredSteps() {
		let idx = wizardStepIndex;
		while (idx < sequence.length - 1 && shouldSkipPrefilledStep(sequence[idx], wizardData, { editing: forceEdit, forcedStage: Boolean(forcedStage) })) {
			idx += 1;
		}
		wizardStepIndex = idx;
	}

	function previousStep() {
		validationError = '';
		if (wizardStepIndex > 0) wizardStepIndex -= 1;
	}

	function validateCurrentStep() {
		const data = normalizeWizardData(wizardData);
		switch (currentStep) {
			case STEP.GOAL:
				return Boolean(data._branch);
			case STEP.EXPERIENCE:
				return data.dealExperience !== undefined && data.dealExperience !== null && data.dealExperience !== '';
			case STEP.RE_PRO:
				return Boolean(data.reProfessional);
			case STEP.BASELINE:
				return data.baselineIncome !== undefined && data.baselineIncome !== null && data.baselineIncome !== '';
			case STEP.ASSETS:
				return Array.isArray(data.assetClasses) && data.assetClasses.length > 0;
			case STEP.STRATEGIES:
				return Array.isArray(data.strategies) && data.strategies.length > 0;
			case STEP.RISK:
				return Boolean(data.maxOperatorPct);
			case STEP.ACCREDITATION:
				return Array.isArray(data.accreditation) && data.accreditation.length > 0;
			case STEP.CF_TARGET:
				return parseDollar(data.targetCashFlow) > 0;
			case STEP.GROWTH_TARGET:
				return parseDollar(data.growthCapital) > 0;
			case STEP.TAX_TARGET:
				return parseDollar(data.taxableIncome) > 0;
			case STEP.GROWTH_PRIORITY:
				return Boolean(data.growthPriority);
			case STEP.TAX_BASELINE:
				return parseDollar(data.taxableIncomeBaseline) > 0;
			case STEP.NET_WORTH:
				return parseDollar(data.netWorth) > 0;
			case STEP.CAPITAL:
				return Boolean(data.capital12mo);
			case STEP.SOURCE:
				return Boolean(data.triggerEvent);
			case STEP.READINESS:
				return Boolean(data.capitalReadiness);
			case STEP.DIVERSIFICATION:
				return Boolean(data.diversificationPref);
			case STEP.OPERATOR_FOCUS:
				return Boolean(data.operatorFocus);
			case STEP.LOCKUP:
				return Boolean(data.lockup);
			case STEP.DISTRIBUTIONS:
				return Boolean(data.distributions);
			default:
				return true;
		}
	}

	function nextStep() {
		if (!validateCurrentStep()) {
			validationError = 'Answer this step before moving on.';
			return;
		}
		validationError = '';

		if (!forceEdit && !forcedFlowKey && !fullPlanMode && !isFreeFlowComplete(wizardData) && wizardStepIndex >= sequence.length - 1) {
			void completeFreeFlow();
			return;
		}

		if (wizardStepIndex >= sequence.length - 1) {
			void completePaidFlow();
			return;
		}

		wizardStepIndex += 1;
	}

	function scheduleSave() {
		if (!browser) return;
		clearTimeout(saveTimer);
		saveTimer = setTimeout(() => {
			void saveBuyBox(false);
		}, 1200);
	}

	async function saveBuyBox(markComplete = false) {
		const sessionUser = getStoredSessionUser() || get(user);
		if (!sessionUser?.email) return;

		saving = true;
		let saveSucceeded = false;
		try {
			const realUser = currentAdminRealUser();
			const isAdminImpersonation =
				!!realUser?.email &&
				realUser.email.toLowerCase() !== String(sessionUser.email || '').toLowerCase();
			const response = await fetch('/api/buybox', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					...(sessionUser.token ? { Authorization: `Bearer ${sessionUser.token}` } : {})
				},
				body: JSON.stringify({
					email: sessionUser.email,
					wizardData: wizardToBuyBoxPayload(wizardData, { markComplete }),
					...(isAdminImpersonation ? { admin: true } : {})
				})
			});
			saveSucceeded = response.ok;
			saveMessage = response.ok ? (markComplete ? 'Plan saved' : 'Progress saved') : 'Saved locally';
		} catch {
			saveMessage = 'Saved locally';
		} finally {
			saving = false;
			if (saveSucceeded) {
				hasLocalEdits = false;
				lastHydratedInitialDataKey = serializeWizardState(wizardData);
			}
			emitWizardState({
				portfolioPlan: planPreview,
				persistedPortfolioPlan: true
			});
		}
	}

	export async function persistProgress() {
		await saveBuyBox(false);
	}

	async function saveGoals() {
		const sessionUser = getStoredSessionUser() || get(user);
		if (!sessionUser?.token) return;
		const payload = wizardToGoalsPayload(wizardData);
		try {
			await fetch('/api/userdata', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${sessionUser.token}`
				},
				body: JSON.stringify({ type: 'goals', data: payload })
			});
		} catch {
			/* no-op */
		}
	}

	async function savePortfolioPlan() {
		const sessionUser = getStoredSessionUser() || get(user);
		writeUserScopedJson('gycPortfolioPlan', planPreview);
		if (!sessionUser?.token) return;
		try {
			await fetch('/api/userdata', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${sessionUser.token}`
				},
				body: JSON.stringify({
					type: 'plan',
					data: {
						total_capital: planPreview.total_capital,
						check_size: planPreview.check_size,
						target_annual_income: planPreview.target_income,
						buckets: planPreview.slots,
						generated_from: 'wizard'
					}
				})
			});
		} catch {
			/* no-op */
		}
	}

	async function completeFreeFlow() {
		setWizardData({ ...wizardData, _freeComplete: true }, { autosave: false });
		user.set({ ...(get(user) || {}), sharePortfolio: wizardData.sharePortfolio === true });
		await saveBuyBox(false);
		dispatch('complete', {
			wizardData: normalizeWizardData(wizardData),
			redirectTo: freeCompleteRedirectTo
		});
	}

	async function completePaidFlow() {
		user.set({ ...(get(user) || {}), sharePortfolio: wizardData.sharePortfolio === true });
		await saveGoals();
		await savePortfolioPlan();
		await saveBuyBox(true);
		writeUserScopedString('gycBuyBoxComplete', 'true');
		dispatch('complete', {
			wizardData: normalizeWizardData(wizardData),
			portfolioPlan: planPreview,
			persistedPortfolioPlan: true,
			redirectTo: paidCompleteRedirectTo
		});
	}

	function buildGroupedPlanYears(plan = planPreview) {
		const rows = Array.isArray(plan?.slots) ? plan.slots : [];
		const grouped = new Map();
		for (const slot of rows) {
			const year = slot.year || new Date().getFullYear();
			if (!grouped.has(year)) grouped.set(year, []);
			grouped.get(year).push(slot);
		}
		return [...grouped.entries()].sort((a, b) => a[0] - b[0]);
	}

	function cloneEditablePlanSlots() {
		return (Array.isArray(planPreview?.slots) ? planPreview.slots : []).map((slot) => ({ ...slot }));
	}

	function sanitizePlanSlots(slots = []) {
		return slots.map((slot, index) => {
			const checkSize = parseDollar(slot?.check_size ?? slot?.checkSize ?? globalPlanCheckSize);
			const targetCocRaw = Number(slot?.target_coc ?? slot?.targetCoC ?? 0);
			const targetCoc = Math.round(((targetCocRaw > 1 ? targetCocRaw / 100 : targetCocRaw) || 0.08) * 1000) / 1000;
			return {
				id: Number(slot?.id) || index + 1,
				asset_class: slot?.asset_class || 'Multi-Family',
				strategy: slot?.strategy || null,
				check_size: checkSize,
				target_coc: targetCoc,
				est_income: Math.round(checkSize * targetCoc),
				year: Number(slot?.year) || new Date().getFullYear(),
				filled_by: slot?.filled_by ?? null,
				filled_name: slot?.filled_name ?? null
			};
		});
	}

	function persistCustomPlanSlots(slots, overrides = {}) {
		const nextSlots = sanitizePlanSlots(slots);
		const next = {
			...wizardData,
			customPlanSlots: nextSlots,
			planSlots: nextSlots
		};
		if (overrides.checkSize !== undefined) next.checkSize = String(parseDollar(overrides.checkSize) || globalPlanCheckSize);
		if (overrides.planTargetYieldPct !== undefined) next.planTargetYieldPct = overrides.planTargetYieldPct === '' ? '' : String(overrides.planTargetYieldPct);
		setWizardData(next);
		if (browser && forceEdit) {
			const nextPlanPreview = generatePortfolioPlan(next, allDeals);
			writeUserScopedJson('gycPortfolioPlan', nextPlanPreview);
			emitWizardState({
				portfolioPlan: nextPlanPreview,
				persistedPortfolioPlan: true
			});
		}
	}

	function updateGlobalPlanCheckSize(value) {
		const checkSize = Math.max(25000, parseDollar(value) || globalPlanCheckSize || 100000);
		const slots = cloneEditablePlanSlots().map((slot) => ({
			...slot,
			check_size: checkSize,
			est_income: Math.round(checkSize * Number(slot.target_coc || 0))
		}));
		persistCustomPlanSlots(slots, { checkSize });
	}

	function updateGlobalPlanYield(value) {
		const numeric = Math.max(1, Number(value || globalPlanYieldPct || 8));
		const targetCoc = Math.round((numeric / 100) * 1000) / 1000;
		const slots = cloneEditablePlanSlots().map((slot) => ({
			...slot,
			target_coc: targetCoc,
			est_income: Math.round(Number(slot.check_size || 0) * targetCoc)
		}));
		persistCustomPlanSlots(slots, { planTargetYieldPct: numeric });
	}

	function updatePlanSlotAssetClass(slotId, assetClass) {
		const slots = cloneEditablePlanSlots();
		const slot = slots.find((candidate) => candidate.id === slotId);
		if (!slot) return;
		const nextYield = averageDealYieldForAsset(assetClass, allDeals);
		slot.asset_class = assetClass;
		slot.target_coc = nextYield;
		slot.est_income = Math.round(Number(slot.check_size || 0) * nextYield);
		persistCustomPlanSlots(slots);
	}

	function updatePlanSlotCheckSize(slotId, value) {
		const nextCheck = Math.max(25000, parseDollar(value) || 0);
		if (!nextCheck) return;
		const slots = cloneEditablePlanSlots();
		const slot = slots.find((candidate) => candidate.id === slotId);
		if (!slot) return;
		slot.check_size = nextCheck;
		slot.est_income = Math.round(nextCheck * Number(slot.target_coc || 0));
		persistCustomPlanSlots(slots);
	}

	function updatePlanSlotYield(slotId, value) {
		const numeric = Number(value);
		if (!Number.isFinite(numeric) || numeric <= 0) return;
		const targetCoc = Math.round((numeric / 100) * 1000) / 1000;
		const slots = cloneEditablePlanSlots();
		const slot = slots.find((candidate) => candidate.id === slotId);
		if (!slot) return;
		slot.target_coc = targetCoc;
		slot.est_income = Math.round(Number(slot.check_size || 0) * targetCoc);
		persistCustomPlanSlots(slots);
	}

	function beginPlanDrag(slotId) {
		draggedPlanSlotId = slotId;
		planDropBeforeSlotId = null;
	}

	function hoverPlanDrop(event, year, beforeSlotId = null) {
		event.preventDefault();
		planDropYear = year;
		planDropBeforeSlotId = beforeSlotId;
	}

	function clearPlanYearHover(year) {
		if (planDropYear === year && !planDropBeforeSlotId) planDropYear = null;
	}

	function clearPlanSlotHover(slotId) {
		if (planDropBeforeSlotId === slotId) planDropBeforeSlotId = null;
	}

	function resetPlanDragState() {
		draggedPlanSlotId = null;
		planDropYear = null;
		planDropBeforeSlotId = null;
	}

	function applyPlanDrop(event, year, beforeSlotId = null) {
		event.preventDefault();
		if (!draggedPlanSlotId) return;

		const slots = cloneEditablePlanSlots();
		const fromIndex = slots.findIndex((candidate) => candidate.id === draggedPlanSlotId);
		if (fromIndex < 0) {
			resetPlanDragState();
			return;
		}

		const [moved] = slots.splice(fromIndex, 1);
		moved.year = year;

		if (beforeSlotId) {
			const insertIndex = slots.findIndex((candidate) => candidate.id === beforeSlotId);
			if (insertIndex >= 0) {
				slots.splice(insertIndex, 0, moved);
			} else {
				slots.push(moved);
			}
		} else {
			const firstFutureIndex = slots.findIndex((candidate) => Number(candidate.year) > year);
			const lastSameYearIndex = slots.reduce((lastIndex, candidate, index) => (Number(candidate.year) === year ? index : lastIndex), -1);
			if (lastSameYearIndex >= 0) slots.splice(lastSameYearIndex + 1, 0, moved);
			else if (firstFutureIndex >= 0) slots.splice(firstFutureIndex, 0, moved);
			else slots.push(moved);
		}

		persistCustomPlanSlots(slots);
		resetPlanDragState();
	}

	function riskDollarRange(option) {
		const netWorth = parseDollar(wizardData.netWorth);
		if (!netWorth || !option.low || !option.high) return '';
		return `${formatCompactMoney(Math.round(netWorth * option.low))} - ${formatCompactMoney(Math.round(netWorth * option.high))}`;
	}

	function taxContextNote() {
		if (wizardData.incomeStructure === 'w2' && wizardData.reProfessional === 'no') {
			return 'W-2 without RE Pro status: passive losses can only offset passive income - not your salary.';
		}
		if (wizardData.incomeStructure === 'w2' && wizardData.reProfessional === 'yes') {
			return 'W-2 + RE Pro status: you can deduct passive losses against your salary.';
		}
		if (wizardData.incomeStructure === 'self_employed') {
			return 'Self-employed: losses flow through your entity structure more flexibly.';
		}
		if (wizardData.incomeStructure === 'mixed') {
			return 'Mixed income: we can target depreciation strategies for both your passive and active income streams.';
		}
		return '';
	}

	function distributionHighlight(option) {
		if (wizardData._branch === 'growth') return ['Annual', 'Any'].includes(option.value);
		if (wizardData._branch === 'cashflow') return ['Monthly', 'Quarterly'].includes(option.value);
		return true;
	}

	function lockupHighlight(option) {
		if (wizardData._branch === 'growth') return ['3', '5', '5+'].includes(option.value);
		if (wizardData._branch === 'cashflow') return ['flexible', '1', '3'].includes(option.value);
		return true;
	}

	function stepTitleFor(step) {
		switch (step) {
			case STEP.GOAL:
				return 'What do you want your money to do for you?';
			case STEP.EXPERIENCE:
				return 'How many passive investments have you made?';
			case STEP.RE_PRO:
				return 'Do you have Real Estate Professional status?';
			case STEP.BASELINE:
				return 'Where are you starting from?';
			case STEP.ASSETS:
				return 'What types of deals interest you?';
			case STEP.STRATEGIES:
				return 'How do you want your money working?';
			case STEP.RISK:
				return 'What lets you sleep at night?';
			case STEP.ACCREDITATION:
				return 'Are you an accredited investor?';
			case STEP.CF_TARGET:
				return 'How much passive income do you want in 12 months?';
			case STEP.GROWTH_TARGET:
				return "What's your portfolio growth target?";
			case STEP.TAX_TARGET:
				return 'How much income do you want to shelter?';
			case STEP.GROWTH_PRIORITY:
				return 'What matters more - upside or safety?';
			case STEP.TAX_BASELINE:
				return 'How much are you earning (before taxes)?';
			case STEP.NET_WORTH:
				return "What's your total net worth?";
			case STEP.CAPITAL:
				return 'How much capital could you put to work in the next 12 months?';
			case STEP.SOURCE:
				return "What's making this possible?";
			case STEP.READINESS:
				return 'How soon could you write your first check?';
			case STEP.DIVERSIFICATION:
				return 'Concentrated or diversified?';
			case STEP.OPERATOR_FOCUS:
				return 'Who do you want managing your money?';
			case STEP.LOCKUP:
				return 'How long can you lock up your capital?';
			case STEP.DISTRIBUTIONS:
				return 'How often do you want to get paid?';
			case STEP.LP_NETWORK:
				return 'Invest alongside other LPs';
			case STEP.PLAN:
				return heroCopy.title;
			case STEP.PROFILE_REVIEW:
				return 'Your Investment Profile';
			case STEP.COMPLETION:
				return 'Your plan is ready.';
			default:
				return '';
		}
	}

	function stepSubtitleFor(step) {
		switch (step) {
			case STEP.GOAL:
				return 'Whether you are evaluating your first deal or your fifteenth, this takes 3 minutes and shapes everything you see.';
			case STEP.EXPERIENCE:
				return 'Syndications, funds, private placements - anything where you wrote a check and someone else operates the deal.';
			case STEP.RE_PRO:
				return 'This IRS designation lets you use real estate losses to offset all income - not just passive income.';
			case STEP.BASELINE:
				return 'Your current passive income - rental checks, distributions, interest. Do not overthink it.';
			case STEP.ASSETS:
				return "Select any that interest you. You are not locked in - this just shapes what we show you first.";
			case STEP.STRATEGIES:
				return 'Each strategy has a different risk/return profile. Best strategies for your goal are shown first.';
			case STEP.RISK:
				return 'The max you would be comfortable losing in any single deal. Private investments are illiquid and carry real risk.';
			case STEP.ACCREDITATION:
				return 'Most private placements require accreditation. Select all that apply - this determines which deals you can legally invest in.';
			case STEP.CF_TARGET:
				return 'Set a 12-month number so the rest of the plan has a real destination.';
			case STEP.GROWTH_TARGET:
				return 'This is the number we will use for the long-term wealth plan.';
			case STEP.TAX_TARGET:
				return 'We use this to size depreciation strategies to the amount of income you actually want to offset.';
			case STEP.GROWTH_PRIORITY:
				return 'There is no wrong answer. This shapes how we rank deals for you.';
			case STEP.TAX_BASELINE:
				return 'We need this to size depreciation strategies to your actual tax bracket. Never shared.';
			case STEP.NET_WORTH:
				return 'Include everything - investments, savings, real estate, retirement. This helps us right-size recommendations. Never shared.';
			case STEP.CAPITAL:
				return 'Not a commitment - just helps us show you deals you can actually get into.';
			case STEP.SOURCE:
				return 'Different capital sources unlock different deal structures. A 1031 exchange has a 45-day clock. Savings do not.';
			case STEP.READINESS:
				return 'Good deals move fast. Knowing your timeline helps us prioritize what to show you first.';
			case STEP.DIVERSIFICATION:
				return `You selected ${wizardData.assetClasses?.length || 0} asset classes. How concentrated do you want your portfolio to be?`;
			case STEP.OPERATOR_FOCUS:
				return 'This is about focus vs. diversification at the operator level - not your portfolio.';
			case STEP.LOCKUP:
				return 'Once you are in, you cannot withdraw early. Longer lockups typically mean higher returns.';
			case STEP.DISTRIBUTIONS:
				return 'Monthly checks feel great, but they narrow your options to mostly lending funds. Being flexible opens up more deals.';
			case STEP.LP_NETWORK:
				return 'The best investors do not go alone. See who else is in the same deals, share diligence, and deploy together.';
			case STEP.PLAN:
				return heroCopy.description;
			case STEP.PROFILE_REVIEW:
				return 'Review your answers below. You can change any section after finishing.';
			case STEP.COMPLETION:
				return parseDollar(wizardData.baselineIncome) === 0 || wizardData.capital12mo === '$0' || wizardData.capital12mo === '$1-$49k'
					? 'Most members who complete this deploy their first check within 60 days. You do not have to do it alone.'
					: 'Your personalized deal matches are ready. We will notify you when new deals hit your buy box.';
			default:
				return '';
		}
	}
</script>

<div class="wizard-shell">
	<div class="wizard-card">
			<OnboardingProgress
				phaseNames={PHASE_NAMES}
				{phaseItems}
				currentPhase={currentPhase}
				currentStep={wizardStepIndex + 1}
				totalSteps={sequence.length}
			title={currentTitle}
			subtitle={currentSubtitle}
		/>

		{#if currentStep === STEP.GOAL}
			<div class="goal-grid">
				{#each GOAL_CARDS as card}
					<OnboardingSelectableCard
						className="goal-card"
						selected={wizardData._branch === card.branch}
						icon={card.icon}
						title={card.title}
						description={card.description}
						onClick={() => selectGoal(card.branch)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.EXPERIENCE}
			<div class="input-panel centered">
				<input
					type="number"
					min="0"
					max="999"
					class="money-input narrow"
					value={wizardData.dealExperience ?? ''}
					oninput={(event) => updateField('dealExperience', parseInt(event.currentTarget.value || '0', 10))}
				/>
				<div class="help-text">
					{#if (wizardData.dealExperience ?? 0) === 0}
						No worries - everyone starts somewhere. We will walk you through it.
					{:else if (wizardData.dealExperience ?? 0) <= 3}
						You have gotten started. Let us help you build a system around it.
					{:else if (wizardData.dealExperience ?? 0) <= 10}
						Solid experience. We will help you scale and optimize.
					{:else}
						You are a veteran. We will focus on portfolio-level insights.
					{/if}
				</div>
			</div>
		{:else if currentStep === STEP.RE_PRO}
			<div class="callout">
				<strong>To qualify, you or your spouse must:</strong>
				<div>Spend 750+ hours/year in real estate activities.</div>
				<div>RE hours must exceed hours at any other job.</div>
			</div>
			<div class="option-stack">
				{#each RE_PRO_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.reProfessional === option.value}
						title={option.label}
						description={option.description}
						onClick={() => updateField('reProfessional', option.value)}
					/>
				{/each}
			</div>
			<div class="footnote">Why we ask: RE Pro status changes which deals make sense for you. If you qualify, depreciation-heavy deals can shelter income from your W-2 or business.</div>
		{:else if currentStep === STEP.BASELINE}
			<div class="input-panel centered">
				<input
					type="number"
					min="0"
					step="1000"
					class="money-input"
					value={moneyInputValue(wizardData.baselineIncome)}
					oninput={(event) => updateField('baselineIncome', event.currentTarget.value)}
				/>
				<div class="preset-row">
					{#each [0, 12000, 25000, 50000, 100000] as preset}
						<button type="button" class="pill-chip" class:selected={parseDollar(wizardData.baselineIncome) === preset} onclick={() => updateField('baselineIncome', String(preset))}>
							{formatCompactMoney(preset)}
						</button>
					{/each}
				</div>
				<div class="help-text">
					{#if parseDollar(wizardData.baselineIncome) === 0}
						Most of our members started at $0. That is the whole point.
					{:else if parseDollar(wizardData.baselineIncome) < 25000}
						That is {formatCompactMoney(Math.round(parseDollar(wizardData.baselineIncome) / 12))}/mo. Good - you have already started. Let us accelerate it.
					{:else}
						That is {formatCompactMoney(Math.round(parseDollar(wizardData.baselineIncome) / 12))}/mo. Nice foundation - let us build on it.
					{/if}
				</div>
			</div>
		{:else if currentStep === STEP.ASSETS}
			<div class="choice-grid">
				{#each Object.entries(ASSET_CLASS_OPTIONS) as [assetKey, asset]}
					<OnboardingSelectableCard
						className="choice-card"
						selected={wizardData.assetClasses.includes(assetKey)}
						icon={asset.icon}
						title={asset.label}
						description={asset.oneLiner}
						onClick={() => toggleAssetClass(assetKey)}
					>
						<svelte:fragment slot="meta">
							<div class="choice-meta">
								<span>{asset.yieldRange} yield</span>
								<span>{asset.holdYears} yr hold</span>
							</div>
						</svelte:fragment>
					</OnboardingSelectableCard>
				{/each}
			</div>
		{:else if currentStep === STEP.STRATEGIES}
			<div class="option-stack">
				{#each STRATEGY_ORDER as strategyKey}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.strategies.includes(strategyKey)}
						icon={STRATEGY_OPTIONS[strategyKey].icon}
						title={STRATEGY_OPTIONS[strategyKey].label}
						description={STRATEGY_OPTIONS[strategyKey].lpImpact}
						onClick={() => toggleStrategy(strategyKey)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.RISK}
			{#if parseDollar(wizardData.netWorth) > 0}
				<div class="callout subtle">
					Based on your {formatCompactMoney(wizardData.netWorth)} net worth:
					<strong>{formatCompactMoney(Math.round(parseDollar(wizardData.netWorth) * 0.01))} - {formatCompactMoney(Math.round(parseDollar(wizardData.netWorth) * 0.02))}</strong>
					per deal is the standard 1-2% range.
				</div>
			{/if}
			<div class="option-stack">
				{#each LOSS_TOLERANCE_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.maxOperatorPct === option.value}
						title={option.label}
						description={option.description}
						onClick={() => updateField('maxOperatorPct', option.value)}
					>
						<svelte:fragment slot="aside">
							{#if riskDollarRange(option)}
								<div class="option-badge">{riskDollarRange(option)}</div>
							{/if}
						</svelte:fragment>
					</OnboardingSelectableCard>
				{/each}
			</div>
		{:else if currentStep === STEP.ACCREDITATION}
			<div class="option-stack">
				{#each ACCREDITATION_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.accreditation.includes(option.value)}
						title={option.label}
						description={option.description}
						onClick={() => toggleAccreditation(option.value)}
					/>
				{/each}
				<OnboardingSelectableCard
					className="option-card"
					selected={wizardData.accreditation.includes('not_accredited')}
					title="Not yet accredited"
					description="We will show you deals open to all investors."
					onClick={() => toggleAccreditation('not_accredited')}
				/>
			</div>
		{:else if currentStep === STEP.CF_TARGET}
			<div class="input-panel centered">
				<input
					type="number"
					min="0"
					step="1000"
					class="money-input"
					value={moneyInputValue(wizardData.targetCashFlow)}
					oninput={(event) => updateField('targetCashFlow', event.currentTarget.value)}
				/>
				<div class="preset-row">
					{#each [25000, 50000, 100000, 200000, 500000] as preset}
						<button type="button" class="pill-chip" class:selected={parseDollar(wizardData.targetCashFlow) === preset} onclick={() => updateField('targetCashFlow', String(preset))}>
							{formatCompactMoney(preset)}
						</button>
					{/each}
				</div>
				<div class="help-text">
					At roughly 9% average yield, you will need about {formatCompactMoney(Math.round(parseDollar(wizardData.targetCashFlow || 0) / 0.09 || 0))} deployed to reach this goal.
				</div>
			</div>
		{:else if currentStep === STEP.GROWTH_TARGET}
			<div class="input-panel centered">
				<input
					type="number"
					min="0"
					step="1000"
					class="money-input"
					value={moneyInputValue(wizardData.growthCapital)}
					oninput={(event) => updateField('growthCapital', event.currentTarget.value)}
				/>
				<div class="preset-row">
					{#each [250000, 500000, 1000000, 2000000, 5000000] as preset}
						<button type="button" class="pill-chip" class:selected={parseDollar(wizardData.growthCapital) === preset} onclick={() => updateField('growthCapital', String(preset))}>
							{formatCompactMoney(preset)}
						</button>
					{/each}
				</div>
				<div class="help-text">{formatCompactMoney(parseDollar(wizardData.growthCapital || 0))} -> {formatCompactMoney(parseDollar(wizardData.growthCapital || 0) * 2)} (2x in 5 years ~= 15% IRR)</div>
			</div>
		{:else if currentStep === STEP.TAX_TARGET}
			<div class="input-panel centered">
				<input
					type="number"
					min="0"
					step="1000"
					class="money-input"
					value={moneyInputValue(wizardData.taxableIncome)}
					oninput={(event) => updateField('taxableIncome', event.currentTarget.value)}
				/>
				<div class="preset-row">
					{#each [50000, 100000, 200000, 500000, 1000000] as preset}
						<button type="button" class="pill-chip" class:selected={parseDollar(wizardData.taxableIncome) === preset} onclick={() => updateField('taxableIncome', String(preset))}>
							{formatCompactMoney(preset)}
						</button>
					{/each}
				</div>
				<div class="help-text">At a 37% bracket, that is about {formatCompactMoney(Math.round(parseDollar(wizardData.taxableIncome || 0) * 0.37))} back in your pocket.</div>
				{#if taxContextNote()}
					<div class="footnote">{taxContextNote()}</div>
				{/if}
			</div>
		{:else if currentStep === STEP.GROWTH_PRIORITY}
			<div class="option-stack">
				{#each GROWTH_PRIORITY_OPTIONS as option}
					<button type="button" class="option-card" class:selected={wizardData.growthPriority === option.value} onclick={() => updateField('growthPriority', option.value)}>
						<div class="option-title">{option.label}</div>
						<div class="option-copy">{option.description}</div>
					</button>
				{/each}
			</div>
		{:else if currentStep === STEP.TAX_BASELINE}
			<div class="input-panel centered">
				<input
					type="number"
					min="0"
					step="1000"
					class="money-input"
					value={moneyInputValue(wizardData.taxableIncomeBaseline)}
					oninput={(event) => updateField('taxableIncomeBaseline', event.currentTarget.value)}
				/>
				<div class="preset-row">
					{#each [100000, 200000, 500000, 1000000, 2000000] as preset}
						<button type="button" class="pill-chip" class:selected={parseDollar(wizardData.taxableIncomeBaseline) === preset} onclick={() => updateField('taxableIncomeBaseline', String(preset))}>
							{formatCompactMoney(preset)}
						</button>
					{/each}
				</div>
				<div class="help-text">At a 37% bracket, you are paying about {formatCompactMoney(Math.round(parseDollar(wizardData.taxableIncomeBaseline || 0) * 0.37))}/yr in federal taxes.</div>
				{#if taxContextNote()}
					<div class="footnote">{taxContextNote()}</div>
				{/if}
			</div>
		{:else if currentStep === STEP.NET_WORTH}
			<div class="input-panel centered">
				<input
					type="number"
					min="0"
					step="1000"
					class="money-input"
					value={moneyInputValue(wizardData.netWorth)}
					oninput={(event) => updateField('netWorth', event.currentTarget.value)}
				/>
				<div class="preset-row">
					{#each [250000, 500000, 1000000, 2000000, 5000000, 10000000] as preset}
						<button type="button" class="pill-chip" class:selected={parseDollar(wizardData.netWorth) === preset} onclick={() => updateField('netWorth', String(preset))}>
							{formatCompactMoney(preset)}
						</button>
					{/each}
				</div>
				<div class="help-text">1-2% per deal = {formatCompactMoney(Math.round(parseDollar(wizardData.netWorth || 0) * 0.01))} - {formatCompactMoney(Math.round(parseDollar(wizardData.netWorth || 0) * 0.02))}.</div>
			</div>
		{:else if currentStep === STEP.CAPITAL}
			<div class="option-stack">
				{#each CAPITAL_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.capital12mo === option.value}
						title={option.label}
						description={option.description}
						onClick={() => updateField('capital12mo', option.value)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.SOURCE}
			<div class="option-stack">
				{#each SOURCE_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.triggerEvent === option.value}
						icon={option.icon}
						title={option.label}
						description={option.description}
						onClick={() => updateField('triggerEvent', option.value)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.READINESS}
			<div class="option-stack">
				{#each READINESS_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.capitalReadiness === option.value}
						icon={option.icon}
						title={option.label}
						description={option.description}
						onClick={() => updateField('capitalReadiness', option.value)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.DIVERSIFICATION}
			<div class="option-stack">
				{#each DIVERSIFICATION_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.diversificationPref === option.value}
						icon={option.icon}
						title={option.label}
						description={option.description}
						onClick={() => updateField('diversificationPref', option.value)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.OPERATOR_FOCUS}
			<div class="option-stack">
				{#each OPERATOR_FOCUS_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.operatorFocus === option.value}
						title={option.label}
						description={option.description}
						onClick={() => updateField('operatorFocus', option.value)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.LOCKUP}
			<div class="option-stack">
				{#each LOCKUP_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.lockup === option.value}
						muted={!lockupHighlight(option) && wizardData.lockup !== option.value}
						title={option.label}
						description={option.description}
						onClick={() => updateField('lockup', option.value)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.DISTRIBUTIONS}
			<div class="option-stack">
				{#each DISTRIBUTION_OPTIONS as option}
					<OnboardingSelectableCard
						className="option-card"
						selected={wizardData.distributions === option.value}
						muted={!distributionHighlight(option) && wizardData.distributions !== option.value}
						title={option.label}
						description={option.description}
						onClick={() => updateField('distributions', option.value)}
					/>
				{/each}
			</div>
		{:else if currentStep === STEP.LP_NETWORK}
			<div class="benefit-stack">
				{#each NETWORK_BENEFITS as benefit}
					<div class="benefit-card">
						<div class="choice-emoji">{benefit.icon}</div>
						<div>
							<div class="option-title">{benefit.title}</div>
							<div class="option-copy">{benefit.description}</div>
						</div>
					</div>
				{/each}
			</div>
			<label class="checkbox-row">
				<input type="checkbox" checked={wizardData.sharePortfolio === true} onchange={(event) => updateField('sharePortfolio', event.currentTarget.checked)} />
				<div>
					<div class="option-title">Yes, show my name on deals I invest in</div>
					<div class="option-copy">You can only see others if you also opt in.</div>
				</div>
			</label>
		{:else if currentStep === STEP.PLAN}
			<div class="plan-stage">
				<div class="plan-summary-grid plan-summary-grid--wide">
					<div class="plan-metric">
						<div class="plan-metric-label">Total Capital</div>
						<div class="plan-metric-value">{formatCompactMoney(planPreview.total_capital)}</div>
					</div>
					<div class="plan-metric">
						<div class="plan-metric-label">Average Check</div>
						<div class="plan-metric-value">{formatCompactMoney(planPreview.check_size)}</div>
					</div>
					<div class="plan-metric">
						<div class="plan-metric-label">Target</div>
						<div class="plan-metric-value">{formatCompactMoney(planPreview.target_income)}</div>
					</div>
					<div class="plan-metric">
						<div class="plan-metric-label">Average Yield</div>
						<div class="plan-metric-value">{Math.round(Number(planPreview.blended_coc || 0.08) * 100)}%</div>
					</div>
					<div class="plan-metric">
						<div class="plan-metric-label">Annual Income</div>
						<div class="plan-metric-value">{formatCompactMoney(planPreview.slots.reduce((sum, slot) => sum + Number(slot.est_income || 0), 0))}/yr</div>
					</div>
				</div>

				<div class="plan-controls-grid">
					<label class="plan-control">
						<span>Global Check Size</span>
						<input
							data-testid="plan-global-check"
							class="plan-control-input"
							type="number"
							min="25000"
							step="25000"
							value={globalPlanCheckSize}
							onchange={(event) => updateGlobalPlanCheckSize(event.currentTarget.value)}
						/>
					</label>
					<label class="plan-control">
						<span>Global Yield Target</span>
						<div class="plan-percent-input">
							<input
								data-testid="plan-global-yield"
								class="plan-control-input"
								type="number"
								min="1"
								step="0.5"
								value={globalPlanYieldPct}
								onchange={(event) => updateGlobalPlanYield(event.currentTarget.value)}
							/>
							<strong>%</strong>
						</div>
					</label>
				</div>

				<div class="plan-stage-note">
					Drag rows between years to change timing. Global controls update the full plan, and each row can override its own asset class, check, and yield.
				</div>

				<div class="plan-roster plan-roster--interactive">
					{#each groupedPlanYearRows as [year, slots], yearIndex}
						<section
							class="plan-year"
							class:plan-year--drop-target={planDropYear === year && !planDropBeforeSlotId}
							data-testid={`plan-year-${year}`}
							ondragover={(event) => hoverPlanDrop(event, year)}
							ondrop={(event) => applyPlanDrop(event, year)}
							ondragleave={() => clearPlanYearHover(year)}
						>
							<div class="plan-year-head">
								<span>Year {yearIndex + 1} ({year})</span>
								<span>{slots.length} slot{slots.length === 1 ? '' : 's'}</span>
							</div>
							{#each slots as slot}
								{#key `${slot.id}:${slot.year}:${slot.asset_class}:${slot.check_size}:${slot.target_coc}` }
									<div
										class="plan-slot plan-slot--interactive"
										class:plan-slot--drop-target={planDropBeforeSlotId === slot.id}
										data-testid={`plan-slot-${slot.id}`}
										draggable="true"
										ondragstart={() => beginPlanDrag(slot.id)}
										ondragend={resetPlanDragState}
										ondragover={(event) => hoverPlanDrop(event, year, slot.id)}
										ondrop={(event) => applyPlanDrop(event, year, slot.id)}
										ondragleave={() => clearPlanSlotHover(slot.id)}
									>
										<div class="plan-drag-handle" aria-hidden="true">≡</div>
										<div class="plan-slot-fields">
											<label class="plan-slot-field">
												<span>Asset Class</span>
												<select
													data-testid={`slot-asset-${slot.id}`}
													class="plan-slot-select"
													bind:value={planFieldState[slot.id].assetClass}
													onchange={(event) => updatePlanSlotAssetClass(slot.id, event.currentTarget.value)}
												>
													{#each PLAN_ASSET_OPTIONS as option}
														<option value={option.value}>{option.label}</option>
													{/each}
												</select>
											</label>
											<label class="plan-slot-field">
												<span>Check</span>
												<input
													data-testid={`slot-check-${slot.id}`}
													class="plan-slot-input"
													type="number"
													min="25000"
													step="25000"
													bind:value={planFieldState[slot.id].checkSize}
													onchange={(event) => updatePlanSlotCheckSize(slot.id, event.currentTarget.value)}
												/>
											</label>
											<label class="plan-slot-field plan-slot-field--yield">
												<span>Yield</span>
												<div class="plan-percent-input">
													<input
														data-testid={`slot-yield-${slot.id}`}
														class="plan-slot-input"
														type="number"
														min="1"
														step="0.5"
														bind:value={planFieldState[slot.id].yieldPct}
														onchange={(event) => updatePlanSlotYield(slot.id, event.currentTarget.value)}
													/>
													<strong>%</strong>
												</div>
											</label>
										</div>
										<div class="plan-slot-income" data-testid={`slot-income-${slot.id}`}>{formatCompactMoney(slot.est_income)}/yr</div>
									</div>
								{/key}
							{/each}
						</section>
					{/each}
				</div>
			</div>
		{:else if currentStep === STEP.PROFILE_REVIEW}
			<div class="review-grid">
				{#each reviewRows as row}
					<button
						type="button"
						class="review-row"
						data-testid={`review-row-${row.step}`}
						onclick={() => jumpToStep(row.step)}
					>
						<div class="review-row-copy">
							<span>{row.label}</span>
							<small>{PHASE_NAMES[phaseForStep(row.step)]}</small>
						</div>
						<div class="review-row-value">
							<strong>{row.value}</strong>
							<span class="review-row-arrow">›</span>
						</div>
					</button>
				{/each}
			</div>
		{:else if currentStep === STEP.COMPLETION}
			<div class="completion-panel">
				<div class="completion-check">✓</div>
				<div class="completion-actions">
					<a class="academy-link" href="/app/academy">See what is included in the Academy →</a>
				</div>
			</div>
		{/if}

		{#if validationError}
			<div class="validation-error">{validationError}</div>
		{/if}

		{#if saveMessage}
			<div class="save-note">{saveMessage}</div>
		{/if}

		<div class="wizard-actions">
			<button type="button" class="ob-btn ob-btn--secondary action-btn secondary" onclick={previousStep} disabled={wizardStepIndex === 0}>Back</button>
			{#if currentStep !== STEP.GOAL}
				<button type="button" class="ob-btn ob-btn--primary action-btn primary" onclick={nextStep} disabled={saving}>
					{#if currentStep === STEP.LP_NETWORK}
						Build My Plan →
					{:else if currentStep === STEP.PROFILE_REVIEW}
						Looks Good →
					{:else if currentStep === STEP.COMPLETION}
						{completionCtaLabel()}
					{:else}
						Next
					{/if}
				</button>
			{/if}
		</div>
	</div>
</div>

<style>
	.wizard-shell {
		display: flex;
		flex-direction: column;
		gap: 20px;
	}

	.wizard-card {
		position: relative;
		padding: 28px;
	}

	.goal-grid,
	.choice-grid,
	.option-stack,
	.benefit-stack {
		display: grid;
		gap: 12px;
	}

	.goal-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.choice-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.choice-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.choice-meta span,
	.option-badge {
		padding: 4px 8px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.08);
		font-size: 11px;
		font-weight: 700;
		color: var(--primary, #51be7b);
	}

	.input-panel {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.input-panel.centered {
		align-items: center;
		text-align: center;
	}

	.money-input {
		width: min(100%, 320px);
		padding: 16px 18px;
		border: 2px solid var(--border, #dde5e8);
		border-radius: 14px;
		background: #fff;
		font-size: 28px;
		font-weight: 700;
		text-align: center;
		color: var(--text-dark, #141413);
	}

	.money-input.narrow {
		width: min(100%, 180px);
	}

	.preset-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		justify-content: center;
	}

	.pill-chip {
		padding: 8px 12px;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 999px;
		background: #fff;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary, #607179);
		cursor: pointer;
	}

	.pill-chip.selected {
		border-color: var(--primary, #51be7b);
		background: rgba(81, 190, 123, 0.08);
		color: var(--primary, #51be7b);
	}

	.help-text,
	.footnote,
	.save-note {
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary, #607179);
	}

	.callout {
		margin-bottom: 16px;
		padding: 14px 16px;
		border: 1px solid rgba(81, 190, 123, 0.16);
		border-radius: 14px;
		background: rgba(81, 190, 123, 0.06);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary, #607179);
	}

	.callout.subtle {
		background: rgba(59, 130, 246, 0.05);
		border-color: rgba(59, 130, 246, 0.12);
	}

	.benefit-card {
		display: flex;
		gap: 12px;
		padding: 14px 16px;
		border: 1px solid rgba(81, 190, 123, 0.12);
		border-radius: 14px;
		background: rgba(81, 190, 123, 0.05);
	}

	.checkbox-row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		margin-top: 16px;
		padding: 16px;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 14px;
		background: #fff;
	}

	.checkbox-row input {
		margin-top: 2px;
		width: 18px;
		height: 18px;
		accent-color: var(--primary, #51be7b);
	}

	.plan-stage {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.plan-summary-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.plan-summary-grid--wide {
		grid-template-columns: repeat(5, minmax(0, 1fr));
	}

	.plan-metric {
		padding: 16px;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 14px;
		background: #fff;
	}

	.plan-metric-label {
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted, #607179);
	}

	.plan-metric-value {
		margin-top: 8px;
		font-size: 24px;
		font-weight: 800;
		color: var(--text-dark, #141413);
	}

	.plan-controls-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.plan-control {
		display: flex;
		flex-direction: column;
		gap: 8px;
		padding: 16px;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 14px;
		background: #fff;
	}

	.plan-control span,
	.plan-slot-field span {
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted, #607179);
	}

	.plan-control-input,
	.plan-slot-input,
	.plan-slot-select {
		width: 100%;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 10px;
		background: #fff;
		padding: 10px 12px;
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark, #141413);
	}

	.plan-control-input:focus,
	.plan-slot-input:focus,
	.plan-slot-select:focus {
		outline: 2px solid rgba(81, 190, 123, 0.18);
		border-color: var(--primary, #51be7b);
	}

	.plan-percent-input {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.plan-percent-input strong {
		font-size: 15px;
		color: var(--text-dark, #141413);
	}

	.plan-stage-note {
		padding: 14px 16px;
		border: 1px solid rgba(81, 190, 123, 0.14);
		border-radius: 14px;
		background: rgba(81, 190, 123, 0.06);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary, #607179);
	}

	.plan-roster {
		display: grid;
		gap: 14px;
	}

	.plan-year {
		padding: 16px;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 14px;
		background: #fff;
		transition: border-color 0.18s ease, background 0.18s ease;
	}

	.plan-year--drop-target {
		border-color: var(--primary, #51be7b);
		background: rgba(81, 190, 123, 0.05);
	}

	.plan-year-head,
	.plan-slot {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.plan-year-head {
		margin-bottom: 12px;
		padding-bottom: 10px;
		border-bottom: 1px solid var(--border-light, #edf1f2);
		font-size: 13px;
		font-weight: 800;
		color: var(--text-dark, #141413);
	}

	.plan-slot {
		padding: 10px 0;
		border-bottom: 1px solid var(--border-light, #edf1f2);
	}

	.plan-slot:last-child {
		border-bottom: 0;
		padding-bottom: 0;
	}

	.plan-slot--interactive {
		align-items: stretch;
		gap: 14px;
		padding: 14px 0;
	}

	.plan-slot--drop-target {
		border-top: 2px solid var(--primary, #51be7b);
	}

	.plan-drag-handle {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 28px;
		color: var(--text-muted, #607179);
		font-size: 18px;
		font-weight: 700;
		cursor: grab;
		user-select: none;
	}

	.plan-slot-fields {
		flex: 1;
		display: grid;
		grid-template-columns: minmax(0, 1.4fr) repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.plan-slot-field {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.plan-slot-title {
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark, #141413);
	}

	.plan-slot-copy,
	.plan-slot-income {
		font-size: 12px;
		color: var(--text-secondary, #607179);
	}

	.plan-slot-income {
		font-weight: 800;
		color: var(--primary, #51be7b);
		align-self: center;
		min-width: 88px;
		text-align: right;
	}

	.review-grid {
		display: grid;
		gap: 10px;
	}

	.review-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		width: 100%;
		padding: 12px 14px;
		border: 1px solid var(--border-light, #edf1f2);
		border-radius: 12px;
		background: #fff;
		font-size: 13px;
		color: var(--text-secondary, #607179);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.18s ease, transform 0.18s ease;
	}

	.review-row:hover {
		border-color: rgba(81, 190, 123, 0.3);
		transform: translateY(-1px);
	}

	.review-row-copy,
	.review-row-value {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.review-row-copy small {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted, #607179);
	}

	.review-row strong {
		color: var(--text-dark, #141413);
		text-align: right;
	}

	.review-row-value {
		align-items: flex-end;
	}

	.review-row-arrow {
		font-size: 16px;
		font-weight: 800;
		color: var(--primary, #51be7b);
	}

	.completion-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		text-align: center;
		padding: 24px 0 8px;
	}

	.completion-check {
		display: inline-flex;
		width: 64px;
		height: 64px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: var(--primary, #51be7b);
		font-size: 28px;
		font-weight: 800;
		color: #fff;
	}

	.academy-link {
		font-size: 13px;
		font-weight: 700;
		color: var(--primary, #51be7b);
		text-decoration: none;
	}

	.validation-error {
		margin-top: 16px;
		color: #c0392b;
		font-size: 13px;
		font-weight: 700;
	}

	.wizard-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 22px;
	}

	.action-btn {
		min-width: 132px;
	}

	@media (max-width: 900px) {
		.goal-grid,
		.choice-grid,
		.plan-summary-grid,
		.plan-summary-grid--wide,
		.plan-controls-grid,
		.plan-slot-fields {
			grid-template-columns: 1fr;
		}

		.wizard-card {
			padding: 20px;
		}

		.plan-year-head,
		.plan-slot,
		.review-row {
			flex-direction: column;
			align-items: flex-start;
		}

		.plan-slot-income,
		.review-row-value {
			align-items: flex-start;
			text-align: left;
		}
	}

	@media (max-width: 640px) {
		.wizard-actions {
			flex-direction: column;
		}

		.action-btn {
			width: 100%;
		}
	}
</style>
