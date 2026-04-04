<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount, tick } from 'svelte';
	import { accessTier, user, isLoggedIn } from '$lib/stores/auth.js';
	import TeamContactsStage from '$lib/components/onboarding/TeamContactsStage.svelte';
	import WebOnlyNotice from '$lib/components/WebOnlyNotice.svelte';
	import {
		currentAdminRealUser,
		readUserScopedJson,
		writeUserScopedJson,
		writeUserScopedString
	} from '$lib/utils/userScopedState.js';
	import { browser } from '$app/environment';
	import { isNativeApp } from '$lib/utils/platform.js';
	import { resolveLegacyLpOnboardingIntent } from '$lib/onboarding/legacyOnboardingBootstrap.js';
	import { normalizeWizardData } from '$lib/onboarding/planWizard.js';
	import {
		buildFallbackTeamContacts,
		normalizeTeamContacts,
		serializeTeamContactsForApi,
		validateTeamContacts
	} from '$lib/onboarding/teamContacts.js';

	let {
		appMode = false,
		loginReturnBase = '/onboarding',
		lpMemberContinuePath = '/app/plan'
	} = $props();

	// ===== State =====
	let currentStep = $state('step0');
	let previousStep = $state(null);
	let slideDirection = $state('forward');
	let progressPercent = $state(0);
	let showProgress = $state(false);

	// Step 0: Name
	let firstName = $state('');
	let lastName = $state('');
	let lpNetworkVisible = $state(false);

	// Step 1: Role
	let selectedRole = $state(null);

	// LP Steps
	let lpGoal = $state(null);
	let lpDealsCount = $state(0);
	let lpAccreditation = $state([]);
	let lpReProfessional = $state(null);
	let lpAssetClasses = $state([]);
	let lpStrategies = $state([]);
	let lpMaxCheckSize = $state(null);
	let lpNetworkAnswered = $state(false);
	let lpPhotoUrl = $state('');
	let lpPhotoSkipped = $state(false);
	let lpPhotoUploading = $state(false);
	let lpPhotoError = $state('');
	let lpCompletionSaving = $state(false);
	let lpCompletionError = $state('');

	// GP Steps
	let companyName = $state('');
	let gpType = $state('ceo');
	let firmType = $state('');
	let ceo = $state('');
	let linkedinCeo = $state('');
	let website = $state('');
	let foundingYear = $state('');
	let companyId = $state(null);
	let companyDropdownResults = $state([]);
	let showCompanyDropdown = $state(false);
	let selectedAssetClasses = $state([]);
	let gpCompanySaving = $state(false);
	let gpCompanyError = $state('');
	let gpAssetClassesSaving = $state(false);
	let gpAssetClassesError = $state('');
	let teamContacts = $state([]);
	let teamContactsError = $state('');
		let offeringType = $state('506c');
		let consents = $state({ tos: false, listing: false, accuracy: false, recording: false });
		let sigName = $state('');
		let sigTitle = $state('');
		let agreementSigned = $state(false);
		let agreementSaving = $state(false);
		let agreementError = $state('');
		let deckFile = $state(null);
		let ppmFile = $state(null);
		let dealUploaded = $state(false);
		let dealSkipped = $state(false);
		let presentationInterest = $state(null);
		let processing = $state(false);
		let finishSaving = $state(false);
		let finishError = $state('');
		const nativeCompanionMode = browser && isNativeApp();

	// Network stats
	let networkStats = $state(null);

	const ASSET_CLASSES = ['Multi-Family', 'Self Storage', 'Industrial', 'Mobile Home Parks', 'Hotels/Hospitality', 'Retail', 'Office', 'Senior Living', 'Student Housing', 'Medical Office', 'Data Centers', 'Lending', 'Short Term Rental', 'Land', 'Mixed Use', 'Build-to-Rent', 'Other'];
	const LP_STEP_SEQUENCE = [
		'stepLpGoal',
		'stepLpAccreditation',
		'stepLpExperience',
		'stepLpRePro',
		'stepLpAssets',
		'stepLpStrategies',
		'stepLpCheckSize',
		'stepLpNetwork',
		'stepLpPhoto',
		'stepLpComplete'
	];
	const LP_STEP_PROGRESS = Object.fromEntries(LP_STEP_SEQUENCE.map((step, index) => [
		step,
		Math.max(10, Math.round(((index + 1) / LP_STEP_SEQUENCE.length) * 100))
	]));
	const LP_ACCREDITATION_OPTIONS = [
		{ value: 'net_worth', label: 'Net worth over $1M', description: 'Individual or joint net worth exceeding $1M, excluding your primary residence' },
		{ value: 'income', label: 'Income over $200K', description: 'Earned $200K+ individually (or $300K+ jointly) in each of the past 2 years' },
		{ value: 'licensed', label: 'Licensed professional', description: 'Hold a Series 7, Series 65, or Series 82 license in good standing' },
		{ value: 'entity', label: 'Through an entity', description: 'Invest via an LLC, trust, family office, or fund with $5M+ in assets' },
		{ value: 'not_accredited', label: 'Not yet accredited', description: 'I am still working toward accredited status' }
	];
	const LP_RE_PRO_OPTIONS = [
		{ value: 'yes', label: 'Yes, I qualify', description: 'I or my spouse meet the hours requirement' },
		{ value: 'no', label: "No, I don't qualify", description: 'I have a full-time job outside of real estate' },
		{ value: 'unsure', label: "I'm not sure", description: "I'd like to figure this out with my CPA" }
	];
	const LP_ASSET_CLASS_OPTIONS = [
		'Private Debt / Credit',
		'Multi-Family',
		'Self Storage',
		'Industrial',
		'Single Family',
		'RV/Mobile Home Parks',
		'Hotels/Hospitality',
		'Retail',
		'Medical Receivables',
		'Short Term Rental',
		'Business / Other',
		'Oil & Gas / Energy'
	];
	const LP_STRATEGY_OPTIONS = [
		{ value: 'Lending', label: 'Lending / Credit' },
		{ value: 'Buy & Hold', label: 'Buy & Hold' },
		{ value: 'Value-Add', label: 'Value-Add' },
		{ value: 'Distressed', label: 'Distressed / Turnaround' },
		{ value: 'Development', label: 'Ground-Up Development' }
	];
	const LP_CHECK_SIZE_OPTIONS = [
		{ value: '50000', label: 'Under $50K' },
		{ value: '99000', label: '$50K - $99K' },
		{ value: '249000', label: '$100K - $249K' },
		{ value: '250000', label: '$250K+' }
	];

	let headers = $derived($user ? { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + $user.token } : { 'Content-Type': 'application/json' });

	// LP derived
	let dealCountFeedback = $derived.by(() => {
		if (lpDealsCount === 0) return "Everyone starts somewhere. We'll tailor the guidance from here.";
		if (lpDealsCount <= 3) return "Great, you're building experience. We'll keep the context simple and useful.";
		if (lpDealsCount <= 10) return "Solid experience. You're likely ready for a sharper deal mix.";
		return "Seasoned investor. We'll keep things efficient and more selective.";
	});

	let lpStepTitle = $derived.by(() => {
		if (currentStep === 'stepLpGoal') return "What's your primary investing goal right now?";
		if (currentStep === 'stepLpAccreditation') return 'Are you an accredited investor?';
		if (currentStep === 'stepLpExperience') return 'How many passive investments have you made?';
		if (currentStep === 'stepLpRePro') return 'Do you or your spouse qualify as a Real Estate Professional for tax purposes?';
		if (currentStep === 'stepLpAssets') return 'Which asset classes should we prioritize in your deal flow?';
		if (currentStep === 'stepLpStrategies') return 'Which deal strategies are you open to?';
		if (currentStep === 'stepLpCheckSize') return 'What is the max check size you are realistically open to for one deal?';
		if (currentStep === 'stepLpNetwork') return 'Do you want visibility into which other LPs are in a deal?';
		if (currentStep === 'stepLpPhoto') return 'Add a profile photo?';
		if (currentStep === 'stepLpComplete') return 'Your deal flow is personalized.';
		return '';
	});

	let lpStepSubtitle = $derived.by(() => {
		if (currentStep === 'stepLpGoal') return 'This shapes which deals you see first, how we sort them, and what success looks like for you.';
		if (currentStep === 'stepLpAccreditation') return 'This determines which private deals we can legally show you. Select all that apply.';
		if (currentStep === 'stepLpExperience') return 'Syndications, funds, and private placements all count. This helps us tailor how much context and support to give you.';
		if (currentStep === 'stepLpRePro') return 'This helps us understand when tax-focused real estate strategies may be especially relevant for you.';
		if (currentStep === 'stepLpAssets') return 'Choose the categories you want to see more of first. You can change this anytime.';
		if (currentStep === 'stepLpStrategies') return 'Asset class is what the deal is. Strategy is how returns are created.';
		if (currentStep === 'stepLpCheckSize') return 'We use this to avoid showing you deals that are clearly outside your range.';
		if (currentStep === 'stepLpNetwork') return 'Compare notes, build conviction, and see who else is participating. You can only see others if you also opt in.';
		if (currentStep === 'stepLpPhoto') return 'If you participate in the LP network, we can show your face next to your activity and participation. You can skip this for now.';
		if (currentStep === 'stepLpComplete') return 'Review your answers and finish setup.';
		return '';
	});

	let canSignAgreement = $derived(consents.tos && consents.listing && consents.accuracy && consents.recording && sigName.trim().length > 0);
	let currentUserTeamContact = $derived.by(() => (
		buildFallbackTeamContacts({
			user: {
				name: $user?.name || '',
				email: $user?.email || ''
			}
		})[0] || null
	));
	let teamContactsValidation = $derived.by(() => validateTeamContacts(teamContacts));
	const LP_QUERY_STEP_MAP = {
		goal: 'stepLpGoal',
		'lp-goal': 'stepLpGoal',
		accreditation: 'stepLpAccreditation',
		'lp-accreditation': 'stepLpAccreditation',
		experience: 'stepLpExperience',
		'lp-experience': 'stepLpExperience',
		're-professional': 'stepLpRePro',
		're-pro': 'stepLpRePro',
		'lp-re-pro': 'stepLpRePro',
		'asset-classes': 'stepLpAssets',
		'lp-assets': 'stepLpAssets',
		strategies: 'stepLpStrategies',
		'lp-strategies': 'stepLpStrategies',
		'check-size': 'stepLpCheckSize',
		'lp-check-size': 'stepLpCheckSize',
		'lp-network': 'stepLpNetwork',
		photo: 'stepLpPhoto',
		avatar: 'stepLpPhoto',
		completion: 'stepLpComplete',
		'lp-complete': 'stepLpComplete'
	};
	const GP_QUERY_STEP_MAP = {
		name: 'step0',
		role: 'step1',
		gp: 'step2',
		'gp-company': 'step3',
		'gp-assets': 'step4',
		'gp-ir': 'step5',
		'gp-agreement': 'step6',
		'gp-upload': 'step7',
		'gp-presentation': 'step8',
		'gp-upsell': 'step9',
		'gp-checklist': 'step10',
		'gp-also-lp': 'step11'
	};

	// ===== Step Navigation =====
	function goToStep(stepId, isBack = false) {
		slideDirection = isBack ? 'back' : 'forward';
		previousStep = currentStep;
		currentStep = stepId;

		// Progress bar
		const gpProgress = { step0: 0, step1: 0, step2: 0, step3: 11, step4: 22, step5: 33, step6: 44, step7: 55, step8: 66, step9: 77, step10: 88, step11: 100 };
		const lpProgress = LP_STEP_PROGRESS;

		const isHidden = ['step0', 'step1'].includes(stepId);
		showProgress = !isHidden;
		progressPercent = gpProgress[stepId] || lpProgress[stepId] || 0;

		if (stepId === 'step10') buildChecklist();
		if (browser) window.scrollTo(0, 0);
	}

	function readLpWizardSnapshot() {
		return readUserScopedJson('gycBuyBoxWizard', {}) || {};
	}

	function persistLpWizardSnapshot(overrides = {}) {
		const existing = readLpWizardSnapshot();
		const next = normalizeWizardData({
			...existing,
			...overrides,
			goal: lpGoal ?? existing.goal,
			_branch: lpGoal ?? existing._branch,
			lpDealsCount,
			dealExperience: lpDealsCount,
			lpAccreditation,
			reProfessional: lpReProfessional,
			lpExperienceCount: lpDealsCount,
			lpAssetClasses,
			assetClasses: [...lpAssetClasses],
			lpStrategies,
			strategies: [...lpStrategies],
			lpMaxCheckSize,
			maxCheckSize: lpMaxCheckSize,
			lpNetworkAnswered,
			sharePortfolio: lpNetworkVisible,
			lpNetworkVisible,
			lpPhotoUrl,
			lpPhotoSkipped,
			avatarUrl: lpPhotoUrl,
			avatar_url: lpPhotoUrl
		});
		writeUserScopedJson('gycBuyBoxWizard', next);
		return next;
	}

	function hydrateLpWizardSnapshot(snapshot = readLpWizardSnapshot()) {
		const next = normalizeWizardData(snapshot || {});
		const nextGoal = next.goal || next._branch;
		if (nextGoal) lpGoal = nextGoal;
		if (next.lpDealsCount !== undefined || next.dealExperience !== undefined) {
			lpDealsCount = Number(next.lpDealsCount ?? next.dealExperience ?? 0) || 0;
		}
		lpAccreditation = Array.isArray(snapshot.lpAccreditation) ? [...snapshot.lpAccreditation] : Array.isArray(next.accreditation) ? [...next.accreditation] : [];
		lpReProfessional = snapshot.lpReProfessional ?? next.reProfessional ?? null;
		lpAssetClasses = Array.isArray(snapshot.lpAssetClasses) ? [...snapshot.lpAssetClasses] : Array.isArray(next.assetClasses) ? [...next.assetClasses] : [];
		lpStrategies = Array.isArray(snapshot.lpStrategies) ? [...snapshot.lpStrategies] : Array.isArray(next.strategies) ? [...next.strategies] : [];
		lpMaxCheckSize = snapshot.lpMaxCheckSize ?? next.maxCheckSize ?? next.checkSize ?? null;
		lpNetworkAnswered = typeof snapshot.lpNetworkAnswered === 'boolean'
			? snapshot.lpNetworkAnswered
			: Object.prototype.hasOwnProperty.call(snapshot || {}, 'sharePortfolio')
				? true
				: false;
		lpNetworkVisible = lpNetworkAnswered
			? (typeof snapshot.lpNetworkVisible === 'boolean'
				? snapshot.lpNetworkVisible
				: typeof snapshot.sharePortfolio === 'boolean'
					? snapshot.sharePortfolio
					: false)
			: false;
		lpPhotoUrl = snapshot.lpPhotoUrl || snapshot.avatarUrl || snapshot.avatar_url || '';
		lpPhotoSkipped = Boolean(snapshot.lpPhotoSkipped);
		return next;
	}

	function lpSnapshotHasStepValue(snapshot, key) {
		return Object.prototype.hasOwnProperty.call(snapshot || {}, key);
	}

	function inferLpResumeStep(snapshot = readLpWizardSnapshot()) {
		if (!snapshot.goal && !snapshot._branch) return 'stepLpGoal';
		if (!lpSnapshotHasStepValue(snapshot, 'lpAccreditation') && !lpSnapshotHasStepValue(snapshot, 'accreditation')) return 'stepLpAccreditation';
		if (!lpSnapshotHasStepValue(snapshot, 'lpDealsCount') && !lpSnapshotHasStepValue(snapshot, 'dealExperience')) return 'stepLpExperience';
		if (!lpSnapshotHasStepValue(snapshot, 'lpReProfessional') && !lpSnapshotHasStepValue(snapshot, 'reProfessional')) return 'stepLpRePro';
		if (!lpSnapshotHasStepValue(snapshot, 'lpAssetClasses') && !lpSnapshotHasStepValue(snapshot, 'assetClasses')) return 'stepLpAssets';
		if (!lpSnapshotHasStepValue(snapshot, 'lpStrategies') && !lpSnapshotHasStepValue(snapshot, 'strategies')) return 'stepLpStrategies';
		if (!lpSnapshotHasStepValue(snapshot, 'lpMaxCheckSize') && !lpSnapshotHasStepValue(snapshot, 'maxCheckSize')) return 'stepLpCheckSize';
		const networkAnswered = typeof snapshot.lpNetworkAnswered === 'boolean'
			? snapshot.lpNetworkAnswered
			: Object.prototype.hasOwnProperty.call(snapshot || {}, 'sharePortfolio');
		if (!networkAnswered) return 'stepLpNetwork';
		if (
			(snapshot.lpNetworkVisible ?? snapshot.sharePortfolio) === true &&
			!snapshot.lpPhotoSkipped &&
			!lpSnapshotHasStepValue(snapshot, 'lpPhotoUrl') &&
			!lpSnapshotHasStepValue(snapshot, 'avatarUrl') &&
			!lpSnapshotHasStepValue(snapshot, 'avatar_url')
		) {
			return 'stepLpPhoto';
		}
		return 'stepLpComplete';
	}

	function resolveLpAppModeStep(url) {
		const stage = (url.searchParams.get('stage') || '').toLowerCase();
		const hash = url.hash.replace('#', '').toLowerCase();
		return LP_QUERY_STEP_MAP[stage] || LP_QUERY_STEP_MAP[hash] || null;
	}

	// ===== Step 0: Name =====
	function titleCase(s) {
		if (!s) return '';
		return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
	}

	function saveName() {
		firstName = titleCase(firstName.trim());
		lastName = titleCase(lastName.trim());
		if (!firstName) return;
		if (!lastName) return;

			const u = { ...$user, name: firstName + ' ' + lastName, firstName, lastName };
		user.set(u);

		goToStep('step1');
	}

	// ===== Step 1: Role =====
	function selectRole(role) {
		selectedRole = role;
	}

	function confirmRole() {
		if (!selectedRole) return;
		fetch('/api/gp-onboarding', {
			method: 'POST', headers,
			body: JSON.stringify({ email: $user.email, step: 'role-select', data: { role: selectedRole } })
		}).catch(() => {});

		if (selectedRole === 'lp') {
			goToStep(inferLpResumeStep());
		} else {
			goToStep('step2');
		}
	}

	// ===== LP: Core flow =====
	const hasMemberAccess = $derived($accessTier === 'member' || $accessTier === 'admin');

	function lpDealsRedirect() {
		if (!hasMemberAccess) return '/app/deals';
		const params = new URLSearchParams({
			stage: lpGoal === 'growth' ? 'growth-target' : lpGoal === 'tax' ? 'tax-target' : 'starting-point',
			flow: `paid_${lpGoal || 'cashflow'}`,
			branch: lpGoal || 'cashflow'
		});
		return `${lpMemberContinuePath}?${params.toString()}`;
	}

	function toggleItem(values, value) {
		return values.includes(value) ? values.filter((item) => item !== value) : [...values, value];
	}

	function setLpGoal(goal) {
		lpGoal = goal;
		lpCompletionError = '';
		persistLpWizardSnapshot({ goal, _branch: goal });
	}

	function selectGoal(goal) {
		setLpGoal(goal);
		setTimeout(() => goToStep('stepLpAccreditation'), 250);
	}

	function toggleLpAccreditation(value) {
		if (value === 'not_accredited') {
			lpAccreditation = lpAccreditation.includes('not_accredited') ? [] : ['not_accredited'];
		} else {
			lpAccreditation = lpAccreditation.filter((item) => item !== 'not_accredited');
			lpAccreditation = toggleItem(lpAccreditation, value);
		}
		lpCompletionError = '';
		persistLpWizardSnapshot({ lpAccreditation: [...lpAccreditation], accreditation: [...lpAccreditation] });
	}

	function saveLpAccreditation() {
		persistLpWizardSnapshot({ lpAccreditation: [...lpAccreditation], accreditation: [...lpAccreditation] });
		goToStep('stepLpExperience');
	}

	function adjustDealCount(delta) {
		const nextCount = Math.max(0, lpDealsCount + delta);
		lpDealsCount = nextCount;
		persistLpWizardSnapshot({ lpDealsCount: nextCount, dealExperience: nextCount, lpExperienceCount: nextCount });
	}

	function onDealCountInput(e) {
		const clean = e.target.value.replace(/[^0-9]/g, '');
		const nextCount = parseInt(clean) || 0;
		lpDealsCount = nextCount;
		persistLpWizardSnapshot({ lpDealsCount: nextCount, dealExperience: nextCount, lpExperienceCount: nextCount });
	}

	function saveLpExperience() {
		persistLpWizardSnapshot({ lpDealsCount, dealExperience: lpDealsCount, lpExperienceCount: lpDealsCount });
		goToStep('stepLpRePro');
	}

	function selectLpRePro(value) {
		lpReProfessional = value;
		lpCompletionError = '';
		persistLpWizardSnapshot({ lpReProfessional: value, reProfessional: value });
	}

	function saveLpRePro() {
		if (!lpReProfessional) return;
		persistLpWizardSnapshot({ lpReProfessional, reProfessional: lpReProfessional });
		goToStep('stepLpAssets');
	}

	function toggleLpAssetClass(assetClass) {
		lpAssetClasses = toggleItem(lpAssetClasses, assetClass);
		lpCompletionError = '';
		persistLpWizardSnapshot({ lpAssetClasses: [...lpAssetClasses], assetClasses: [...lpAssetClasses] });
	}

	function saveLpAssetClasses() {
		if (lpAssetClasses.length === 0) return;
		persistLpWizardSnapshot({ lpAssetClasses: [...lpAssetClasses], assetClasses: [...lpAssetClasses] });
		goToStep('stepLpStrategies');
	}

	function toggleLpStrategy(strategy) {
		lpStrategies = toggleItem(lpStrategies, strategy);
		lpCompletionError = '';
		persistLpWizardSnapshot({ lpStrategies: [...lpStrategies], strategies: [...lpStrategies], dealTypes: [...lpStrategies] });
	}

	function saveLpStrategies() {
		if (lpStrategies.length === 0) return;
		persistLpWizardSnapshot({ lpStrategies: [...lpStrategies], strategies: [...lpStrategies], dealTypes: [...lpStrategies] });
		goToStep('stepLpCheckSize');
	}

	function selectLpMaxCheckSize(value) {
		lpMaxCheckSize = value;
		lpCompletionError = '';
		persistLpWizardSnapshot({ lpMaxCheckSize: value, maxCheckSize: value, checkSize: value });
	}

	function saveLpMaxCheckSize() {
		if (!lpMaxCheckSize) return;
		persistLpWizardSnapshot({ lpMaxCheckSize, maxCheckSize: lpMaxCheckSize, checkSize: lpMaxCheckSize });
		goToStep('stepLpNetwork');
	}

	function saveLpNetworkVisibility() {
		lpNetworkAnswered = true;
		persistLpWizardSnapshot({ lpNetworkVisible, sharePortfolio: lpNetworkVisible });
		goToStep(lpNetworkVisible ? 'stepLpPhoto' : 'stepLpComplete');
	}

	function fileToDataUrl(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(String(reader.result || ''));
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	async function handleLpPhotoUpload(event) {
		const file = event?.currentTarget?.files?.[0];
		if (!file || lpPhotoUploading) return;
		lpPhotoUploading = true;
		lpPhotoError = '';
		try {
			const imageData = await fileToDataUrl(file);
			const response = await fetch('/api/network?action=avatar', {
				method: 'POST',
				headers,
				body: JSON.stringify({ action: 'avatar', imageData })
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) throw new Error(payload?.error || 'Unable to upload your photo right now.');
			lpPhotoUrl = payload.avatarUrl || imageData;
			lpPhotoSkipped = false;
			persistLpWizardSnapshot({
				lpPhotoUrl: payload.avatarUrl || imageData,
				lpPhotoSkipped: false,
				avatarUrl: payload.avatarUrl || imageData,
				avatar_url: payload.avatarUrl || imageData
			});
			user.set({ ...$user, avatar_url: payload.avatarUrl || imageData });
			goToStep('stepLpComplete');
		} catch (error) {
			lpPhotoError = error?.message || 'Unable to upload your photo right now.';
		} finally {
			lpPhotoUploading = false;
			if (event?.currentTarget) event.currentTarget.value = '';
		}
	}

	function skipLpPhoto() {
		lpPhotoError = '';
		lpPhotoSkipped = true;
		persistLpWizardSnapshot({ lpPhotoSkipped: true });
		goToStep('stepLpComplete');
	}

	let completionSummary = $derived.by(() => {
		const goalLabels = { cashflow: 'Build Passive Income', tax: 'Reduce Tax Bill', growth: 'Grow Wealth' };
		const accreditationLabel = lpAccreditation.length ? lpAccreditation.map((value) => LP_ACCREDITATION_OPTIONS.find((option) => option.value === value)?.label || value).join(', ') : 'Not set';
		const experienceLabel = lpDealsCount === 0 ? 'First-time investor' : lpDealsCount + (lpDealsCount === 1 ? ' deal' : ' deals');
		const reProLabel = LP_RE_PRO_OPTIONS.find((option) => option.value === lpReProfessional)?.label || 'Not set';
		const assetLabel = lpAssetClasses.length ? lpAssetClasses.join(', ') : 'Not set';
		const strategyLabel = lpStrategies.length
			? lpStrategies.map((strategy) => LP_STRATEGY_OPTIONS.find((option) => option.value === strategy)?.label || strategy).join(', ')
			: 'Not set';
		const checkLabel = LP_CHECK_SIZE_OPTIONS.find((option) => option.value === lpMaxCheckSize)?.label || 'Not set';
		return [
			{ label: 'Goal', value: goalLabels[lpGoal] || 'Not set' },
			{ label: 'Accreditation', value: accreditationLabel },
			{ label: 'Experience', value: experienceLabel },
			{ label: 'RE Pro', value: reProLabel },
			{ label: 'Asset Classes', value: assetLabel },
			{ label: 'Strategies', value: strategyLabel },
			{ label: 'Max Check Size', value: checkLabel },
			{ label: 'LP Network', value: lpNetworkVisible ? 'Yes' : 'No' },
			{ label: 'Photo', value: lpNetworkVisible ? (lpPhotoUrl ? 'Added' : 'Skipped') : 'Not shown' }
		];
	});

	let completionBtnText = $derived.by(() => {
		return hasMemberAccess ? 'Build My Investment Plan' : 'Start Browsing Deals';
	});

	let completionSubtitle = $derived.by(() => {
		return "We've set your starting preferences. You can refine them anytime as your goals evolve.";
	});

	function showLpComplete() {
		lpCompletionError = '';
		goToStep('stepLpComplete');
	}

	async function completeLpOnboarding() {
		if (lpCompletionSaving) return;
		if (!lpGoal || !lpAccreditation.length || lpReProfessional === null || lpAssetClasses.length === 0 || lpStrategies.length === 0 || !lpMaxCheckSize || !lpNetworkAnswered) {
			lpCompletionError = 'Finish the remaining setup questions before completing onboarding.';
			return;
		}
		lpCompletionSaving = true;
		lpCompletionError = '';

		const wizardData = persistLpWizardSnapshot({
			goal: lpGoal,
			_branch: lpGoal,
			lpDealsCount: lpDealsCount || 0,
			dealExperience: lpDealsCount || 0,
			lpExperienceCount: lpDealsCount || 0,
			lpAccreditation: [...lpAccreditation],
			accreditation: [...lpAccreditation],
			lpReProfessional,
			reProfessional: lpReProfessional,
			lpAssetClasses: [...lpAssetClasses],
			assetClasses: [...lpAssetClasses],
			lpStrategies: [...lpStrategies],
			strategies: [...lpStrategies],
			dealTypes: [...lpStrategies],
			lpMaxCheckSize,
			maxCheckSize: lpMaxCheckSize,
			checkSize: lpMaxCheckSize,
			lpNetworkVisible,
			sharePortfolio: lpNetworkVisible,
			lpPhotoUrl,
			avatarUrl: lpPhotoUrl,
			avatar_url: lpPhotoUrl
		});
		const realUser = currentAdminRealUser();
		const isAdminImpersonation = !!realUser?.email && realUser.email.toLowerCase() !== ($user?.email || '').toLowerCase();
		try {
			const buyBoxResponse = await fetch('/api/buybox', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					email: $user.email,
					wizardData: {
						...wizardData,
						_markComplete: true
					},
					...(isAdminImpersonation ? { admin: true } : {})
				})
			});
			const buyBoxPayload = await buyBoxResponse.json().catch(() => ({}));
			if (!buyBoxResponse.ok) {
				throw new Error(buyBoxPayload?.error || 'Unable to save your plan right now.');
			}

			const roleResponse = await fetch('/api/gp-onboarding', {
				method: 'POST',
				headers,
				body: JSON.stringify({ email: $user.email, step: 'role-select', data: { role: 'lp' } })
			});
			const rolePayload = await roleResponse.json().catch(() => ({}));
			if (!roleResponse.ok) {
				throw new Error(rolePayload?.error || 'Unable to finish onboarding right now.');
			}

			writeUserScopedString('gycBuyBoxComplete', 'true');
			writeUserScopedString('gycOnboardingComplete', 'true');

			const u = { ...$user, onboardingComplete: true, onboardingRole: 'lp', sharePortfolio: lpNetworkVisible, avatar_url: lpPhotoUrl || $user?.avatar_url || '' };
			user.set(u);

			await goto(lpDealsRedirect());
		} catch (error) {
			console.warn('LP onboarding save error:', error);
			lpCompletionError = error?.message || 'Unable to save your plan right now.';
		} finally {
			lpCompletionSaving = false;
		}
	}

	function lpStepIndex(stepId) {
		const index = LP_STEP_SEQUENCE.indexOf(stepId);
		return index === -1 ? 0 : index;
	}

	// ===== GP: Company Search =====
	let searchTimer;

	function syncTeamContacts(nextContacts, { company = null } = {}) {
		teamContacts = normalizeTeamContacts(nextContacts, {
			fallbackContact: buildFallbackTeamContacts({
				company,
				user: {
					name: $user?.name || '',
					email: $user?.email || ''
				}
			})[0] || currentUserTeamContact,
			ensureOne: true
		});
		teamContactsError = '';
	}

	function onCompanySearch(e) {
		const q = e.target.value.trim();
		companyName = q;
		companyId = null;
		gpCompanyError = '';

		if (q.length < 2) { showCompanyDropdown = false; return; }

		clearTimeout(searchTimer);
		searchTimer = setTimeout(async () => {
			try {
				const r = await fetch('/api/company-search?q=' + encodeURIComponent(q));
				const data = await r.json();
				companyDropdownResults = data.results || [];
				showCompanyDropdown = true;
			} catch { showCompanyDropdown = false; }
		}, 250);
	}

	function pickCompany(co) {
		gpCompanyError = '';
		companyId = co.id;
		companyName = co.operator_name;
		if (co.type) firmType = co.type;
		if (co.ceo) ceo = co.ceo;
		if (co.website) website = co.website;
		if (co.linkedin_ceo) linkedinCeo = co.linkedin_ceo;
		if (co.founding_year) foundingYear = co.founding_year;
		if (Array.isArray(co.asset_classes)) selectedAssetClasses = [...co.asset_classes];
		syncTeamContacts([], { company: co });
		if (co.id) {
			fetch(`/api/management-companies/${encodeURIComponent(co.id)}/settings`, { headers })
				.then((response) => response.ok ? response.json() : null)
				.then((settings) => {
					if (Array.isArray(settings?.teamContacts) || Array.isArray(settings?.team_contacts)) {
						syncTeamContacts(settings.teamContacts || settings.team_contacts || [], { company: co });
					}
				})
				.catch(() => {});
		}
		showCompanyDropdown = false;
	}

	function createNewCompany() {
		gpCompanyError = '';
		showCompanyDropdown = false;
	}

	async function saveCompanyProfile() {
		if (!companyName.trim() || gpCompanySaving) return;
		gpCompanySaving = true;
		gpCompanyError = '';

		const data = { companyName: companyName.trim(), gpType, firmType, ceo, linkedinCeo, website, foundingYear, assetClasses: selectedAssetClasses };

		try {
			const r = await fetch('/api/gp-onboarding', {
				method: 'POST', headers,
				body: JSON.stringify({ email: $user.email, step: 'company-profile', data })
			});
			const result = await r.json().catch(() => ({}));
			if (!r.ok) {
				throw new Error(result?.error || 'Unable to save your company profile right now.');
			}
			if (result.companyId) companyId = result.companyId;
			goToStep('step4');
		} catch (error) {
			gpCompanyError = error?.message || 'Unable to save your company profile right now.';
		} finally {
			gpCompanySaving = false;
		}
	}

	// ===== GP: Asset Classes =====
	function toggleAssetClass(ac) {
		gpAssetClassesError = '';
		const idx = selectedAssetClasses.indexOf(ac);
		if (idx === -1) selectedAssetClasses = [...selectedAssetClasses, ac];
		else selectedAssetClasses = selectedAssetClasses.filter(a => a !== ac);
	}

	async function saveAssetClasses() {
		if (gpAssetClassesSaving) return;
		if (!companyId) {
			gpAssetClassesError = 'Save your company profile first before continuing.';
			return;
		}

		gpAssetClassesSaving = true;
		gpAssetClassesError = '';
		try {
			const response = await fetch('/api/gp-onboarding', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					email: $user.email,
					step: 'company-profile',
					data: {
						companyName: companyName.trim(),
						gpType,
						firmType,
						ceo,
						linkedinCeo,
						website,
						foundingYear,
						assetClasses: selectedAssetClasses
					}
				})
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload?.error || 'Unable to save your asset classes right now.');
			}
			if (payload?.companyId) companyId = payload.companyId;
			goToStep('step5');
		} catch (error) {
			gpAssetClassesError = error?.message || 'Unable to save your asset classes right now.';
		} finally {
			gpAssetClassesSaving = false;
		}
	}

	// ===== GP: Team & Contacts =====
	async function saveTeamContacts() {
		const validation = validateTeamContacts(teamContacts);
		syncTeamContacts(validation.contacts.length > 0 ? validation.contacts : teamContacts);
		if (!validation.valid) {
			teamContactsError = validation.formError || 'Add at least one valid team contact.';
			return;
		}

		try {
			const response = await fetch('/api/gp-onboarding', {
				method: 'POST',
				headers,
				body: JSON.stringify({
					email: $user.email,
					step: 'team-contacts',
					data: {
						teamContacts: serializeTeamContactsForApi(validation.contacts)
					}
				})
			});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				teamContactsError = payload?.formError || payload?.error || 'Unable to save team contacts right now.';
				return;
			}

			syncTeamContacts(payload?.teamContacts?.length > 0 ? payload.teamContacts : validation.contacts);
			goToStep('step6');
		} catch {
			teamContactsError = 'Unable to save team contacts right now.';
		}
	}

	// ===== GP: Agreement =====
	function selectOfferingType(type) {
		offeringType = type;
	}

	function toggleConsent(key) {
		consents = { ...consents, [key]: !consents[key] };
	}

	function simpleHash(str) {
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = ((hash << 5) - hash) + str.charCodeAt(i);
			hash |= 0;
		}
		return 'v1-' + Math.abs(hash).toString(36);
	}

	let agreementScrollEl = $state(null);

	async function saveGpOnboardingStep(step, data = {}) {
		const response = await fetch('/api/gp-onboarding', {
			method: 'POST',
			headers,
			body: JSON.stringify({ email: $user.email, step, data })
		});
		const payload = await response.json().catch(() => ({}));
		if (!response.ok) {
			const message = payload?.error || 'Unable to save onboarding progress.';
			if (payload?.requiresAgreement) {
				agreementSigned = false;
				agreementError = message;
				goToStep('step6', true);
			}
			throw new Error(message);
		}
		return payload;
	}

	async function saveAgreement() {
		if (!canSignAgreement || agreementSaving) return;
		const agreementText = agreementScrollEl?.innerText || '';
		const hash = simpleHash(agreementText);
		agreementSaving = true;
		agreementError = '';

		try {
			const response = await fetch('/api/gp-agreement', {
					method: 'POST', headers,
					body: JSON.stringify({ email: $user.email, signatoryName: sigName.trim(), signatoryEmail: $user.email, signatoryTitle: sigTitle.trim(), offeringType, acceptedTos: consents.tos, acceptedListing: consents.listing, acceptedDataAccuracy: consents.accuracy, acceptedRecording: consents.recording, agreementText, agreementTextHash: hash })
				});
			const payload = await response.json().catch(() => ({}));
			if (!response.ok) {
				throw new Error(payload?.error || 'Unable to save the signed agreement.');
			}
			agreementSigned = true;
			goToStep('step7');
		} catch (err) {
			console.error('Agreement save error:', err);
			agreementError = err?.message || 'Unable to save the signed agreement.';
		} finally {
			agreementSaving = false;
		}
	}

	// ===== GP: File Upload =====
	function fileToBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => resolve(reader.result.split(',')[1]);
			reader.onerror = reject;
			reader.readAsDataURL(file);
		});
	}

	function onDeckDrop(e) { e.preventDefault(); if (e.dataTransfer.files.length) deckFile = e.dataTransfer.files[0]; }
	function onPpmDrop(e) { e.preventDefault(); if (e.dataTransfer.files.length) ppmFile = e.dataTransfer.files[0]; }

	let deckInputEl = $state(null);
	let ppmInputEl = $state(null);

	async function submitDealUploads() {
		processing = true;

		const file = deckFile || ppmFile;
		if (!file) { goToStep('step8'); return; }

		const dealName = file.name.replace(/\.[^.]+$/, '');
		const docType = (ppmFile && !deckFile) ? 'ppm' : 'deck';
		const uploadFile = deckFile || ppmFile;

		try {
			const base64data = await fileToBase64(uploadFile);
				const resp = await fetch('/api/deck-upload', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + $user.token },
					body: JSON.stringify({ dealId: 'new-' + Date.now(), dealName, filedata: base64data, filename: uploadFile.name, docType, userEmail: $user.email, userName: $user.name || '', companyId: companyId || '' })
				});
				const uploadResult = await resp.json();
				if (!resp.ok) {
					throw new Error(uploadResult?.error || 'Upload failed.');
				}
				dealUploaded = true;
				const uploadedDealId = uploadResult?.newDealId || null;

			if (ppmFile && deckFile && uploadedDealId) {
				const ppmBase64 = await fileToBase64(ppmFile);
				await fetch('/api/deck-upload', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + $user.token },
					body: JSON.stringify({ dealId: uploadedDealId, dealName, filedata: ppmBase64, filename: ppmFile.name, docType: 'ppm', userEmail: $user.email, userName: $user.name || '', companyId: companyId || '' })
				});
			}

				await saveGpOnboardingStep('deal-uploaded', {});

			if (uploadedDealId) {
				goto('/app/deals?id=' + uploadedDealId + '&from=onboarding');
			} else {
				processing = false;
				goToStep('step8');
			}
			} catch (err) {
				console.error('Upload error:', err);
				processing = false;
				agreementError = err?.message || 'Upload failed. You can try again or skip for now.';
				if (!agreementError.toLowerCase().includes('agreement')) {
					alert(agreementError);
				}
			}
		}

		async function skipDealUpload() {
			dealSkipped = true;
			try {
				await saveGpOnboardingStep('deal-skipped', {});
				goToStep('step8');
			} catch (err) {
				console.error('Skip deal upload error:', err);
				alert(err?.message || 'Unable to continue right now.');
			}
		}

		// ===== GP: Presentation =====
		async function savePresentation(interested) {
			presentationInterest = interested;
			try {
				await saveGpOnboardingStep('presentation', { interested });
				goToStep(interested ? 'step9' : 'step10');
			} catch (err) {
				console.error('Presentation save error:', err);
				alert(err?.message || 'Unable to continue right now.');
			}
		}

	function skipPayment() { goToStep('step10'); }

	// ===== GP: Checklist =====
	let checklistItems = $state([]);

	function buildChecklist() {
		checklistItems = [
			{ label: 'Company profile', done: !!companyId, skipped: false, action: companyId ? 'Edit' : 'Set up', step: 'step3' },
			{ label: 'Asset classes', done: selectedAssetClasses.length > 0, skipped: false, action: 'Edit', step: 'step4' },
			{ label: 'Team & contacts', done: teamContactsValidation.valid, skipped: false, action: 'Edit', step: 'step5' },
			{ label: 'Listing agreement', done: agreementSigned, skipped: false, action: agreementSigned ? 'Signed' : 'Review', step: agreementSigned ? null : 'step6' },
			{ label: 'Deal uploaded', done: dealUploaded, skipped: dealSkipped, action: dealUploaded ? 'View' : 'Add deal', step: dealUploaded ? null : 'step7' },
			{ label: 'Presentation', done: presentationInterest === true, skipped: presentationInterest === false, action: presentationInterest === true ? 'Booked' : 'Learn more', step: 'step8' }
		];
	}

	// ===== GP: Also an LP? =====
		async function finishOnboarding(wantsBuyBox) {
			if (finishSaving) return;
			finishSaving = true;
			finishError = '';
			try {
				await saveGpOnboardingStep(wantsBuyBox ? 'buybox-interest' : 'complete', {});
				if (wantsBuyBox) {
					goToStep('stepLpGoal');
				} else {
					goto('/gp-dashboard');
				}
			} catch (err) {
				console.error('Finish onboarding error:', err);
				finishError = err?.message || 'Unable to complete onboarding right now.';
			} finally {
				finishSaving = false;
			}
		}

	// ===== Network Stats =====
	async function loadNetworkStats() {
		try {
			const r = await fetch('/api/lp-network-stats', { headers });
			networkStats = await r.json();
		} catch (err) {
			console.error('Network stats error:', err);
		}
	}

	let displayTotalLPs = $derived(Math.max(networkStats?.totalLPs || 0, 1100));
	let displayAccredited = $derived(Math.max(networkStats?.accreditedCount || 0, 600));
	const DONUT_CIRCUMFERENCE = 2 * Math.PI * 15.9;
	const CHART_BAR_COLORS = ['green', 'teal', 'blue', 'green', 'teal', 'blue'];
	const SAMPLE_ASSET_CLASSES = [
		{ name: 'Multifamily', count: 42 },
		{ name: 'Industrial', count: 31 },
		{ name: 'Private Debt / Credit', count: 28 },
		{ name: 'Self-Storage', count: 19 },
		{ name: 'Build-to-Rent', count: 14 },
		{ name: 'Mobile Home Parks', count: 11 }
	];
	const SAMPLE_GOAL_DISTRIBUTION = { income: 58, tax: 27, growth: 15 };
	const SAMPLE_CAPITAL_RANGES = {
		'Under $50K': 14,
		'$50K–$100K': 24,
		'$100K–$250K': 36,
		'$250K–$500K': 21,
		'$500K+': 10
	};

	function formatCompactCurrency(value) {
		if (value >= 1000000) return '$' + (value / 1000000).toFixed(1) + 'M';
		if (value >= 1000) return '$' + Math.round(value / 1000) + 'K';
		return '$' + value.toLocaleString();
	}

	let useSampleNetworkData = $derived((networkStats?.totalLPs || 0) < 200 && (networkStats?.completedBuyBoxes || 0) < 200);
	let capitalReadyValue = $derived.by(() => useSampleNetworkData ? 18500000 : (networkStats?.totalCapitalReady || 0));
	let capitalReadyDisplay = $derived.by(() => formatCompactCurrency(capitalReadyValue));

	let assetDemandData = $derived.by(() => {
		let topClasses = Array.isArray(networkStats?.topAssetClasses) ? networkStats.topAssetClasses : [];
		if (useSampleNetworkData) topClasses = topClasses.length >= 3 ? topClasses : SAMPLE_ASSET_CLASSES;
		const topSix = topClasses.slice(0, 6);
		const maxCount = topSix[0]?.count || 1;
		return topSix.map((assetClass, index) => ({
			...assetClass,
			widthPct: Math.max(5, Math.round((assetClass.count / maxCount) * 100)),
			colorClass: CHART_BAR_COLORS[index % CHART_BAR_COLORS.length]
		}));
	});

	let goalDistributionData = $derived.by(() => {
		let goals = networkStats?.goalDistribution || { income: 0, tax: 0, growth: 0 };
		const goalTotal = (goals.income || 0) + (goals.tax || 0) + (goals.growth || 0);
		if (useSampleNetworkData && goalTotal < 10) goals = SAMPLE_GOAL_DISTRIBUTION;
		const total = (goals.income || 0) + (goals.tax || 0) + (goals.growth || 0) || 1;
		return [
			{ label: 'Income', count: goals.income || 0, color: '#51BE7B' },
			{ label: 'Tax Savings', count: goals.tax || 0, color: '#2563EB' },
			{ label: 'Growth', count: goals.growth || 0, color: '#CF7A30' }
		].map((item) => ({ ...item, percent: Math.round((item.count / total) * 100) }));
	});

	let goalDonutSegments = $derived.by(() => {
		let offset = 0;
		const total = goalDistributionData.reduce((sum, item) => sum + item.count, 0) || 1;
		return goalDistributionData
			.filter((item) => item.count > 0)
			.map((item) => {
				const length = DONUT_CIRCUMFERENCE * (item.count / total);
				const segment = {
					...item,
					dasharray: `${length} ${DONUT_CIRCUMFERENCE - length}`,
					dashoffset: -offset
				};
				offset += length;
				return segment;
			});
	});

	let checkSizeData = $derived.by(() => {
		const ranges = networkStats?.capitalRanges || {};
		const hasRealData = Object.values(ranges).some((value) => (value || 0) > 0);
		const source = hasRealData ? ranges : SAMPLE_CAPITAL_RANGES;
		const entries = Object.entries(source);
		const maxCount = Math.max(...entries.map(([, count]) => Number(count) || 0), 1);
		const colors = ['blue', 'teal', 'green', 'teal', 'green'];
		return entries.map(([label, count], index) => ({
			label,
			count,
			widthPct: Math.max(5, Math.round(((Number(count) || 0) / maxCount) * 100)),
			colorClass: colors[index % colors.length]
		}));
	});

	// ===== Init =====
	onMount(async () => {
		if (!$isLoggedIn) {
			const returnTo = loginReturnBase + $page.url.search + $page.url.hash;
			goto('/login?return=' + encodeURIComponent(returnTo));
			return;
		}

		const reviewMode =
			appMode ||
			['1', 'true', 'yes'].includes(($page.url.searchParams.get('review') || '').toLowerCase());

		// Dark mode
		const savedTheme = localStorage.getItem('gyc-theme');
		if (savedTheme === 'dark') {
			document.documentElement.classList.add('dark');
		}

		// Prefill name
		if ($user?.name && $user.name !== $user.email?.split('@')[0]) {
			const parts = $user.name.split(' ');
			if (parts[0]) firstName = titleCase(parts[0]);
			if (parts.length > 1) lastName = parts.slice(1).map(titleCase).join(' ');
		}

		loadNetworkStats();

		// The embedded /app/plan experience only uses the LP setup path.
		// Skip legacy GP onboarding bootstrap there so free users don't hit GP-only APIs,
		// but still restore local LP progress and honor LP deep links.
		if (appMode) {
			syncTeamContacts([]);
			selectedRole = 'lp';
			const snapshot = hydrateLpWizardSnapshot();
			const requestedLpStep = resolveLpAppModeStep($page.url);
			goToStep(requestedLpStep || inferLpResumeStep(snapshot));
			return;
		}

		// Load existing onboarding state
		try {
			const r = await fetch('/api/gp-onboarding?email=' + encodeURIComponent($user.email), { headers });
			const data = await r.json();

			if (data.company) {
				companyId = data.company.id;
				companyName = data.company.operator_name || '';
				if (data.company.ceo) ceo = data.company.ceo;
				if (data.company.website) website = data.company.website;
				if (data.company.linkedin_ceo) linkedinCeo = data.company.linkedin_ceo;
				if (data.company.founding_year) foundingYear = data.company.founding_year;
				if (data.company.type) firmType = data.company.type;
				if (Array.isArray(data.company.asset_classes)) selectedAssetClasses = data.company.asset_classes;
				syncTeamContacts(data.teamContacts, { company: data.company });
			} else {
				syncTeamContacts([]);
			}
				if (data.profile) {
					selectedRole = data.profile.onboardingRole;
					presentationInterest = data.profile.presentationInterest;
				}
				const agreementStatus = data.agreementStatus || {};
				const currentAgreement = agreementStatus.agreement || null;
				agreementSigned = !!agreementStatus.hasCurrentAgreement;
				if (currentAgreement) {
					offeringType = currentAgreement.offering_type || offeringType;
					sigName = currentAgreement.signatory_name || sigName;
					sigTitle = currentAgreement.signatory_title || sigTitle;
					consents = {
						tos: currentAgreement.accepted_tos === true,
						listing: currentAgreement.accepted_listing === true,
						accuracy: currentAgreement.accepted_data_accuracy === true,
						recording: currentAgreement.accepted_recording === true
					};
				}
				if (data.dealCount > 0) dealUploaded = true;

				const step = data.profile?.onboardingStep || 0;

				if (!reviewMode && data.profile?.onboardingComplete && agreementStatus.hasCurrentAgreement) { goto('/gp-dashboard'); return; }
				const lpOnboardingIntent = resolveLegacyLpOnboardingIntent({
					reviewMode,
					onboardingRole: data.profile?.onboardingRole,
					hasCompletedBuyBox: data.hasBuyBox === true
				});
				if (lpOnboardingIntent === 'redirect') {
					goto(lpDealsRedirect());
					return;
				}
				if (lpOnboardingIntent === 'resume') {
					selectedRole = 'lp';
					const snapshot = hydrateLpWizardSnapshot();
					const requestedLpStep = resolveLpAppModeStep($page.url);
					goToStep(requestedLpStep || inferLpResumeStep(snapshot));
					return;
				}
				if (!reviewMode && data.company && step === 0) { selectedRole = 'gp'; goToStep('step2'); return; }
				if (!reviewMode && data.profile?.onboardingComplete && !agreementStatus.hasCurrentAgreement) {
					selectedRole = 'gp';
					agreementError = 'A current signed operator listing agreement is required before you can access the GP workflow.';
					goToStep('step6');
					return;
				}

				// DB steps -> UI steps
				const stepMap = { 0: 'step0', 1: 'step2', 2: 'step5', 3: 'step6', 4: 'step7', 5: 'step8', 6: 'step10' };
				const resumeStep = $page.url.searchParams.get('resumeStep');
				if (resumeStep) {
					goToStep('step' + resumeStep);
				} else if (!reviewMode && step >= 4 && !agreementStatus.hasCurrentAgreement) {
					agreementError = 'A current signed operator listing agreement is required before you can continue.';
					goToStep('step6');
				} else if (!reviewMode && step > 0 && stepMap[step]) {
					goToStep(stepMap[step]);
				}
		} catch (err) {
			console.error('Load onboarding state error:', err);
		}

		// Deep link hash / query
		const stage = ($page.url.searchParams.get('stage') || '').toLowerCase();
		const hash = $page.url.hash.replace('#', '').toLowerCase();
		const requestedStep = LP_QUERY_STEP_MAP[stage] || GP_QUERY_STEP_MAP[stage];
		if (requestedStep) {
			if (requestedStep.startsWith('stepLp')) selectedRole = 'lp';
			goToStep(requestedStep);
			return;
		}
		if (hash) {
			const hashStep = GP_QUERY_STEP_MAP[hash] || LP_QUERY_STEP_MAP[hash];
			if (hashStep) {
				if (hashStep.startsWith('stepLp')) selectedRole = 'lp';
				goToStep(hashStep);
			}
		}
	});

	// Keyboard enter to continue
	function onKeydown(e) {
		if (e.key !== 'Enter') return;
		if (currentStep === 'step0' && firstName && lastName) saveName();
		else if (currentStep === 'stepLpExperience') saveLpExperience();
		else if (currentStep === 'stepLpRePro') saveLpRePro();
		else if (currentStep === 'stepLpAssets') saveLpAssetClasses();
		else if (currentStep === 'stepLpStrategies') saveLpStrategies();
		else if (currentStep === 'stepLpCheckSize') saveLpMaxCheckSize();
		else if (currentStep === 'stepLpNetwork') saveLpNetworkVisibility();
		else if (currentStep === 'stepLpPhoto') {
			if (lpPhotoUrl) showLpComplete();
			else skipLpPhoto();
		}
		else if (currentStep === 'stepLpComplete') completeLpOnboarding();
	}
</script>

<svelte:window onkeydown={onKeydown} />

<div class={`onboarding-page ${appMode ? 'onboarding-page--app' : 'ly-page'}`.trim()}>
	<div class={`onboarding-shell ${appMode ? 'onboarding-shell--app' : 'ly-frame'}`.trim()}>
		<div class="onboarding-container">
			<div class="onboarding-card">

		<!-- Progress bar -->
		{#if showProgress}
			<div class="progress-bar-wrap">
				<div class="progress-bar-fill" style:width="{progressPercent}%"></div>
			</div>
		{/if}

		<!-- ===== STEP 0: Name ===== -->
		{#if currentStep === 'step0'}
			<div class="step active">
				<div class="gyc-logo">
					<div class="gyc-logo-text">Grow Your Cashflow</div>
					<div class="gyc-logo-sub">Dealflow Platform</div>
				</div>
				<div class="step-header">
					<div class="step-title">What should we call you?</div>
					<div class="step-subtitle">This sets up your profile inside the app.</div>
				</div>
				<div class="step-body">
					<div class="form-grid">
						<div class="form-group">
							<label class="form-label" for="first-name">First Name *</label>
							<input id="first-name" class="form-input" type="text" bind:value={firstName} placeholder="First name" autocomplete="given-name">
						</div>
						<div class="form-group">
							<label class="form-label" for="last-name">Last Name *</label>
							<input id="last-name" class="form-input" type="text" bind:value={lastName} placeholder="Last name" autocomplete="family-name">
						</div>
					</div>
				</div>
				<div class="step-footer">
					<span></span>
					<button class="btn-primary" onclick={saveName} disabled={!firstName.trim() || !lastName.trim()}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		<!-- ===== STEP 1: Role Selection ===== -->
		{#if currentStep === 'step1'}
			<div class="step active">
				<div class="step-header">
					<div class="step-title">What best describes you right now?</div>
					<div class="step-subtitle">We’ll route you to the right setup flow.</div>
				</div>
				<div class="step-body">
					<div class="role-cards">
						<button type="button" class="role-card" class:selected={selectedRole === 'lp'} aria-pressed={selectedRole === 'lp'} onclick={() => selectRole('lp')}>
							<div class="role-card-icon lp-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
							</div>
							<div class="role-card-title">I'm an investor (LP)</div>
							<div class="role-card-desc">I want to discover deals, build a plan, and track my portfolio.</div>
						</button>
						<button type="button" class="role-card" class:selected={selectedRole === 'gp'} aria-pressed={selectedRole === 'gp'} onclick={() => selectRole('gp')}>
							<div class="role-card-icon gp-icon">
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
							</div>
							<div class="role-card-title">I'm an operator / sponsor (GP)</div>
							<div class="role-card-desc">I want to list deals, connect with LPs, and present opportunities.</div>
						</button>
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('step0', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={confirmRole} disabled={!selectedRole}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		<!-- ===== LP FLOW ===== -->
		{#if currentStep === 'stepLpGoal'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="goal-cards">
						<button type="button" class="role-card goal-card" class:selected={lpGoal === 'cashflow'} aria-pressed={lpGoal === 'cashflow'} onclick={() => selectGoal('cashflow')}>
							<div class="goal-emoji">&#128176;</div>
							<div><div class="role-card-title" style="font-size:16px;">Build Passive Income</div><div class="role-card-desc" style="font-size:13px;">I want predictable monthly or quarterly income from my investments</div></div>
						</button>
						<button type="button" class="role-card goal-card" class:selected={lpGoal === 'tax'} aria-pressed={lpGoal === 'tax'} onclick={() => selectGoal('tax')}>
							<div class="goal-emoji">&#127974;</div>
							<div><div class="role-card-title" style="font-size:16px;">Reduce My Tax Bill</div><div class="role-card-desc" style="font-size:13px;">I'm trying to legally offset more of my taxable income</div></div>
						</button>
						<button type="button" class="role-card goal-card" class:selected={lpGoal === 'growth'} aria-pressed={lpGoal === 'growth'} onclick={() => selectGoal('growth')}>
							<div class="goal-emoji">&#128640;</div>
							<div><div class="role-card-title" style="font-size:16px;">Grow My Wealth</div><div class="role-card-desc" style="font-size:13px;">I want to prioritize appreciation and long-term upside</div></div>
						</button>
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('step1', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<span></span>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpAccreditation'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="goal-cards">
						{#each LP_ACCREDITATION_OPTIONS as option}
							<button type="button" class="role-card goal-card" class:selected={lpAccreditation.includes(option.value)} aria-pressed={lpAccreditation.includes(option.value)} onclick={() => toggleLpAccreditation(option.value)}>
								<div>
									<div class="role-card-title" style="font-size:16px;">{option.label}</div>
									<div class="role-card-desc" style="font-size:13px;">{option.description}</div>
								</div>
							</button>
						{/each}
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('stepLpGoal', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveLpAccreditation} disabled={lpAccreditation.length === 0}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpExperience'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="deal-count-wrap">
						<div class="deal-count-row">
							<button class="count-btn" onclick={() => adjustDealCount(-1)}>&minus;</button>
							<input type="text" value={lpDealsCount} inputmode="numeric" autocomplete="off" class="deal-count-input" oninput={onDealCountInput} onfocus={(e) => e.target.select()}>
							<button class="count-btn" onclick={() => adjustDealCount(1)}>+</button>
						</div>
						<div class="count-label">passive investments</div>
						<div class="count-feedback">{dealCountFeedback}</div>
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('stepLpAccreditation', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveLpExperience}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpRePro'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="goal-cards">
						{#each LP_RE_PRO_OPTIONS as option}
							<button type="button" class="role-card goal-card" class:selected={lpReProfessional === option.value} aria-pressed={lpReProfessional === option.value} onclick={() => selectLpRePro(option.value)}>
								<div>
									<div class="role-card-title" style="font-size:16px;">{option.label}</div>
									<div class="role-card-desc" style="font-size:13px;">{option.description}</div>
								</div>
							</button>
						{/each}
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('stepLpExperience', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveLpRePro} disabled={!lpReProfessional}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpAssets'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="pill-grid">
						{#each LP_ASSET_CLASS_OPTIONS as assetClass}
							<button type="button" class="pill-option" class:selected={lpAssetClasses.includes(assetClass)} aria-pressed={lpAssetClasses.includes(assetClass)} onclick={() => toggleLpAssetClass(assetClass)}>{assetClass}</button>
						{/each}
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('stepLpRePro', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveLpAssetClasses} disabled={lpAssetClasses.length === 0}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpStrategies'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="pill-grid">
						{#each LP_STRATEGY_OPTIONS as strategy}
							<button type="button" class="pill-option" class:selected={lpStrategies.includes(strategy.value)} aria-pressed={lpStrategies.includes(strategy.value)} onclick={() => toggleLpStrategy(strategy.value)}>{strategy.label}</button>
						{/each}
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('stepLpAssets', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveLpStrategies} disabled={lpStrategies.length === 0}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpCheckSize'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="deal-pill-grid">
						{#each LP_CHECK_SIZE_OPTIONS as option}
							<button type="button" class="pill-option" class:selected={lpMaxCheckSize === option.value} aria-pressed={lpMaxCheckSize === option.value} onclick={() => selectLpMaxCheckSize(option.value)}>{option.label}</button>
						{/each}
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('stepLpStrategies', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveLpMaxCheckSize} disabled={!lpMaxCheckSize}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpNetwork'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="goal-cards">
						<button type="button" class="role-card goal-card" class:selected={lpNetworkAnswered && lpNetworkVisible === true} aria-pressed={lpNetworkAnswered && lpNetworkVisible === true} onclick={() => { lpNetworkAnswered = true; lpNetworkVisible = true; persistLpWizardSnapshot({ lpNetworkAnswered: true, lpNetworkVisible: true, sharePortfolio: true }); }}>
							<div>
								<div class="role-card-title" style="font-size:16px;">Yes, show me the LP network</div>
								<div class="role-card-desc" style="font-size:13px;">See who else is participating and compare notes</div>
							</div>
						</button>
						<button type="button" class="role-card goal-card" class:selected={lpNetworkAnswered && lpNetworkVisible === false} aria-pressed={lpNetworkAnswered && lpNetworkVisible === false} onclick={() => { lpNetworkAnswered = true; lpNetworkVisible = false; persistLpWizardSnapshot({ lpNetworkAnswered: true, lpNetworkVisible: false, sharePortfolio: false }); }}>
							<div>
								<div class="role-card-title" style="font-size:16px;">No, keep this private</div>
								<div class="role-card-desc" style="font-size:13px;">I still want the personalized deal flow, just without social visibility</div>
							</div>
						</button>
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('stepLpCheckSize', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveLpNetworkVisibility} disabled={!lpNetworkAnswered}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpPhoto'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step {lpStepIndex(currentStep) + 1} of {LP_STEP_SEQUENCE.length}</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{lpStepSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="lp-photo-panel">
						<div class="lp-photo-preview">
							{#if lpPhotoUrl}
								<img src={lpPhotoUrl} alt="Profile photo" />
							{:else}
								<span>{((firstName?.[0] || '?') + (lastName?.[0] || '')).trim() || '?'}</span>
							{/if}
						</div>
						<div class="lp-photo-actions">
							<label class="btn-secondary lp-photo-upload">
								{lpPhotoUploading ? 'Uploading...' : 'Upload Photo'}
								<input type="file" accept="image/*" style="display:none;" onchange={handleLpPhotoUpload}>
							</label>
							<button type="button" class="btn-secondary" onclick={skipLpPhoto}>Skip for Now</button>
						</div>
						{#if lpPhotoError}
							<div class="step-error">{lpPhotoError}</div>
						{/if}
						<div class="lp-photo-help">This only appears if you choose to be visible in the LP network.</div>
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('stepLpNetwork', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<span></span>
				</div>
			</div>
		{/if}

		{#if currentStep === 'stepLpComplete'}
			<div class="step active">
				<div class="step-header">
					<div class="completion-checkmark">
						<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
					</div>
					<div class="step-title">{lpStepTitle}</div>
					<div class="step-subtitle">{completionSubtitle}</div>
				</div>
				<div class="step-body">
					<div class="completion-summary">
						{#each completionSummary as row}
							<div class="completion-row">
								<span class="completion-label">{row.label}</span>
								<span class="completion-value">{row.value}</span>
							</div>
						{/each}
					</div>
					{#if lpCompletionError}
						<div class="step-error">{lpCompletionError}</div>
					{/if}
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep(lpNetworkVisible ? 'stepLpPhoto' : 'stepLpNetwork', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={completeLpOnboarding} style="min-width:220px;" disabled={lpCompletionSaving || !lpGoal}>
						<span>{lpCompletionSaving ? 'Saving...' : completionBtnText}</span>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		<!-- ===== GP STEPS 2-11 (abbreviated here, full HTML matches original) ===== -->
		<!-- Due to extreme length, GP steps 2-11 use the same pattern as above -->

		{#if currentStep === 'step2'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Here's what you get</div>
					<div class="step-title">We fill your deal with qualified investors. You close.</div>
					<div class="step-subtitle">Here's exactly how it works and why operators keep coming back.</div>
				</div>
				<div class="step-body">
					<div class="welcome-layout">
							<div class="welcome-left">
								<div class="value-prop">
									<div class="value-prop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div>
									<div class="value-prop-text"><strong>We match your deal to investors who are already looking for it.</strong> Every LP on the platform has a buy box - asset class, check size, return targets. Your deal gets surfaced to the ones it fits.</div>
								</div>
								<div class="value-prop">
									<div class="value-prop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>
									<div class="value-prop-text"><strong>We make direct introductions to your IR team.</strong> When an investor is interested, we don't send a form - we connect them directly to the person on your team who can close.</div>
								</div>
								<div class="value-prop">
									<div class="value-prop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div>
									<div class="value-prop-text"><strong>You present live to investors whose buy box matches your deal.</strong> 90-minute session, directly marketed to the LPs most likely to invest. No cold audience - warm, qualified, ready to evaluate.</div>
								</div>
								<div class="value-prop">
									<div class="value-prop-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="4" height="8"/><rect x="10" y="8" width="4" height="12"/><rect x="17" y="4" width="4" height="16"/></svg></div>
									<div class="value-prop-text"><strong>You see exactly what investors do with your deal.</strong> Who viewed it, who saved it, who's vetting it, who requested an intro. No guessing - real data on real investor behavior.</div>
								</div>
							</div>
							<div class="welcome-right">
								<div class="network-stats-grid">
									<div class="net-stat highlight" style="grid-column:1/-1;">
									<div class="net-stat-value">{displayTotalLPs.toLocaleString()}</div>
									<div class="net-stat-label">Investors in our database right now</div>
								</div>
									<div class="net-stat highlight">
										<div class="net-stat-value">{displayAccredited.toLocaleString()}</div>
										<div class="net-stat-label">Accredited Investors</div>
									</div>
									<div class="net-stat highlight">
										<div class="net-stat-value">{capitalReadyDisplay}</div>
										<div class="net-stat-label">Capital Ready to Deploy</div>
									</div>
								</div>
								<div class="mini-chart-wrap">
									<div class="mini-chart-title">What They're Looking For</div>
									{#each assetDemandData as assetClass}
										<div class="bar-chart-row">
											<div class="bar-label">{assetClass.name}</div>
											<div class="bar-track">
												<div class={`bar-fill ${assetClass.colorClass}`} style={`width:${assetClass.widthPct}%`}></div>
											</div>
											<div class="bar-count">{assetClass.count}</div>
										</div>
									{/each}
								</div>
								<div class="mini-chart-wrap">
									<div class="mini-chart-title">Investor Goals</div>
									<div class="donut-wrap">
										<svg class="donut-svg" viewBox="0 0 42 42">
											<circle cx="21" cy="21" r="15.9" fill="none" stroke="var(--border-light)" stroke-width="5"></circle>
											{#each goalDonutSegments as segment}
												<circle
													cx="21"
													cy="21"
													r="15.9"
													fill="none"
													stroke={segment.color}
													stroke-width="5"
													stroke-dasharray={segment.dasharray}
													stroke-dashoffset={segment.dashoffset}
													transform="rotate(-90 21 21)"
												></circle>
											{/each}
										</svg>
										<div class="donut-legend">
											{#each goalDistributionData as goal}
												<div class="donut-legend-item">
													<div class="donut-dot" style={`background:${goal.color}`}></div>
													<span>{goal.label}</span>
													<span class="donut-legend-pct">{goal.percent}%</span>
												</div>
											{/each}
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				<div class="step-footer">
					<span></span>
					<button class="btn-primary" onclick={() => goToStep('step3')}>
						Let's Set Up Your Profile
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'step3'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step 1 of 8</div>
					<div class="step-title">What's your firm?</div>
					<div class="step-subtitle">We'll create your operator profile from this</div>
				</div>
				<div class="step-body">
					<div class="form-grid">
						<div class="form-group full-width" style="position:relative;">
							<label class="form-label" for="company-name">Company Name *</label>
							<input id="company-name" class="form-input" type="text" value={companyName} oninput={onCompanySearch} placeholder="Start typing to search..." autocomplete="off">
							{#if showCompanyDropdown}
								<div class="company-dropdown">
									{#each companyDropdownResults as co}
										<button type="button" class="company-result" onclick={() => pickCompany(co)}>
											<div class="company-result-icon">{(co.operator_name || '??').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}</div>
											<div>
												<div class="company-result-name">{co.operator_name}</div>
												<div class="company-result-meta">{[co.type, co.asset_classes?.slice(0, 2).join(', ')].filter(Boolean).join(' \u00B7 ')}</div>
											</div>
										</button>
									{/each}
									<button type="button" class="company-create-option" onclick={createNewCompany}>
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
										Create "{companyName}" as a new company
									</button>
								</div>
							{/if}
						</div>
						<div class="form-group">
							<label class="form-label" for="gp-role">Your Role</label>
							<select id="gp-role" class="form-input" bind:value={gpType}>
								<option value="ceo">CEO / Principal</option>
								<option value="management">Management Team</option>
								<option value="ir">Investor Relations</option>
							</select>
						</div>
					</div>
					{#if gpCompanyError}
						<div class="step-error">{gpCompanyError}</div>
					{/if}
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('step2', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveCompanyProfile} disabled={!companyName.trim() || gpCompanySaving}>
						{gpCompanySaving ? 'Saving...' : 'Continue'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'step4'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step 2 of 8</div>
					<div class="step-title">What asset classes do you operate in?</div>
					<div class="step-subtitle">This helps us match your deals to the right investors</div>
				</div>
				<div class="step-body">
					<div class="pill-grid">
						{#each ASSET_CLASSES as ac}
							<button type="button" class="pill-option" class:selected={selectedAssetClasses.includes(ac)} aria-pressed={selectedAssetClasses.includes(ac)} onclick={() => toggleAssetClass(ac)}>{ac}</button>
						{/each}
					</div>
					{#if gpAssetClassesError}
						<div class="step-error">{gpAssetClassesError}</div>
					{/if}
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('step3', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<button class="btn-primary" onclick={saveAssetClasses} disabled={gpAssetClassesSaving}>
						{gpAssetClassesSaving ? 'Saving...' : 'Continue'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'step5'}
			<TeamContactsStage
				contacts={teamContacts}
				error={teamContactsError}
				selfContact={currentUserTeamContact}
				onchange={(nextContacts) => syncTeamContacts(nextContacts)}
				onback={() => goToStep('step4', true)}
				oncontinue={saveTeamContacts}
			/>
		{/if}

		{#if currentStep === 'step6'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step 4 of 8</div>
					<div class="step-title">Operator Listing Agreement</div>
					<div class="step-subtitle">Review and accept the terms for listing your deals on the platform</div>
				</div>
				<div class="step-body">
					<div style="margin-bottom:20px;">
						<div class="signature-label">What type of offering are you raising?</div>
						<div class="offering-type-row">
							<button type="button" class="offering-type-option" class:selected={offeringType === '506c'} aria-pressed={offeringType === '506c'} onclick={() => selectOfferingType('506c')}><div class="ot-label">Reg D 506(c)</div><div class="ot-desc">General solicitation allowed</div></button>
							<button type="button" class="offering-type-option" class:selected={offeringType === '506b'} aria-pressed={offeringType === '506b'} onclick={() => selectOfferingType('506b')}><div class="ot-label">Reg D 506(b)</div><div class="ot-desc">Pre-existing relationships only</div></button>
							<button type="button" class="offering-type-option" class:selected={offeringType === 'other'} aria-pressed={offeringType === 'other'} onclick={() => selectOfferingType('other')}><div class="ot-label">Other / Unsure</div><div class="ot-desc">Reg A+, non-US, or not yet determined</div></button>
						</div>
						{#if offeringType === '506b'}
							<div class="offering-506b-note"><strong>506(b) deals are not publicly marketed.</strong> Your deal will be stored in our database for portfolio tracking but will not appear as a public deal card.</div>
						{/if}
					</div>
					<div class="agreement-scroll" bind:this={agreementScrollEl}>
						<h3>Grow Your Cashflow &mdash; Operator Listing Agreement</h3>
						<p><em>Version 1.0 &mdash; Effective Date: March 2026</em></p>
						<p>This Operator Listing Agreement ("Agreement") is entered into between you ("Operator") and Grow Your Cashflow LLC ("GYC"), governing your use of the GYC Dealflow Platform ("Platform") as a deal sponsor, operator, or fund manager.</p>
						<p>By checking the boxes below and providing your electronic signature, you acknowledge that you have read, understand, and agree to be bound by the following terms.</p>
						<h3>1. Platform Terms of Service</h3>
						<p>You agree to comply with the GYC Platform Terms of Service. The full Terms of Service are available at <strong>growyourcashflow.com/terms</strong>.</p>
						<h3>2. Authorization to Display &amp; Distribute Deal Materials</h3>
						<p>You grant GYC a non-exclusive, royalty-free license to display your deal information, share documents with registered investors, include your deal in filtered search results and deal alerts, and facilitate direct introductions between interested investors and your designated IR contact.</p>
						<h3>3. Presentation Recording &amp; Distribution</h3>
						<p>If you participate in a GYC live deal presentation event, you consent to the session being recorded and shared with investors in the GYC database.</p>
						<h3>4. Data Accuracy &amp; Representations</h3>
						<p>You represent that all information you provide is truthful, accurate, and not misleading, and that you are authorized to distribute the offering materials.</p>
						<h3>5. Regulatory Compliance</h3>
						<p>GYC is not a broker-dealer and does not provide investment advice.</p>
						<h3>6. Limitation of Liability</h3>
						<p>GYC shall not be liable for any investment losses or failed capital raises.</p>
						<h3>7. Term &amp; Termination</h3>
						<p>This Agreement remains in effect for as long as you have an active operator account on the Platform.</p>
					</div>
					<div class="consent-checks">
						<button type="button" class="consent-row" aria-pressed={consents.tos} onclick={() => toggleConsent('tos')}>
							<div class="consent-box" class:checked={consents.tos}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
							<div class="consent-text">I have read and agree to the <strong>Platform Terms of Service</strong> and the terms of this Operator Listing Agreement.</div>
						</button>
						<button type="button" class="consent-row" aria-pressed={consents.listing} onclick={() => toggleConsent('listing')}>
							<div class="consent-box" class:checked={consents.listing}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
							<div class="consent-text">I authorize GYC to <strong>display, distribute, and promote my deal</strong> to investors on the Platform.</div>
						</button>
						<button type="button" class="consent-row" aria-pressed={consents.accuracy} onclick={() => toggleConsent('accuracy')}>
							<div class="consent-box" class:checked={consents.accuracy}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
							<div class="consent-text">I represent that all information I provide is <strong>accurate and not misleading</strong>.</div>
						</button>
						<button type="button" class="consent-row" aria-pressed={consents.recording} onclick={() => toggleConsent('recording')}>
							<div class="consent-box" class:checked={consents.recording}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div>
							<div class="consent-text">I consent to <strong>recording and distribution</strong> of any live presentation events I participate in.</div>
						</button>
					</div>
						<div class="signature-section">
							<div class="signature-label">Electronic Signature</div>
							<div class="form-grid">
								<div class="form-group"><label class="form-label" for="sig-name">Full Legal Name *</label><input id="sig-name" class="form-input" type="text" bind:value={sigName} placeholder="Type your full name as signature"></div>
								<div class="form-group"><label class="form-label" for="sig-title">Title</label><input id="sig-title" class="form-input" type="text" bind:value={sigTitle} placeholder="e.g. Managing Partner"></div>
							</div>
						</div>
						{#if agreementError}
							<div class="step-error">{agreementError}</div>
						{/if}
					</div>
					<div class="step-footer">
						<button class="btn-secondary" onclick={() => goToStep('step5', true)}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
							Back
						</button>
						<button class="btn-primary" onclick={saveAgreement} disabled={!canSignAgreement || agreementSaving}>
							{agreementSaving ? 'Saving...' : 'I Agree — Continue'}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
						</button>
					</div>
			</div>
		{/if}

		{#if currentStep === 'step7'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">Step 5 of 8</div>
					<div class="step-title">Upload your deal</div>
					<div class="step-subtitle">We'll use AI to extract the key terms from your documents</div>
				</div>
				<div class="step-body">
					{#if !processing}
						<label class="drop-zone active" for="deck-upload" ondragover={(e) => e.preventDefault()} ondrop={onDeckDrop}>
							<div class="drop-zone-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></div>
							<div class="drop-zone-text">{deckFile ? deckFile.name : 'Drag & drop your pitch deck'}</div>
							<div class="drop-zone-hint">{deckFile ? (deckFile.size / 1024 / 1024).toFixed(1) + ' MB' : 'PDF only, up to 25MB'}</div>
						</label>
						<input id="deck-upload" type="file" accept=".pdf" style="display:none" bind:this={deckInputEl} onchange={(e) => deckFile = e.target.files[0]}>
						<label class="drop-zone active" style="margin-top:12px;" for="ppm-upload" ondragover={(e) => e.preventDefault()} ondrop={onPpmDrop}>
							<div class="drop-zone-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg></div>
							<div class="drop-zone-text">{ppmFile ? ppmFile.name : 'Drag & drop your PPM'}</div>
							<div class="drop-zone-hint">{ppmFile ? (ppmFile.size / 1024 / 1024).toFixed(1) + ' MB' : 'PDF only, up to 25MB'}</div>
						</label>
						<input id="ppm-upload" type="file" accept=".pdf" style="display:none" bind:this={ppmInputEl} onchange={(e) => ppmFile = e.target.files[0]}>
						<div class="upload-note"><strong>PDF format required.</strong> If you have a link, slides, or brochure, please save or print it as a PDF before uploading.</div>
					{:else}
						<div class="processing-state">
							<div class="processing-spinner"></div>
							<div class="processing-text">Analyzing your documents...</div>
							<div class="processing-sub">Extracting deal terms, fees, and structure. This usually takes 30-60 seconds.</div>
						</div>
					{/if}
				</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('step6', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<div style="display:flex;gap:12px;align-items:center;">
						<button class="btn-skip" onclick={skipDealUpload}>I'll add a deal later</button>
						{#if deckFile || ppmFile}
							<button class="btn-primary" onclick={submitDealUploads}>
								Continue
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
							</button>
						{/if}
					</div>
				</div>
			</div>
		{/if}

		{#if currentStep === 'step8'}
				<div class="step active">
					<div class="step-header">
						<div class="step-counter">Step 6 of 8</div>
						<div class="step-title">Present your deal live to qualified investors</div>
						<div class="step-subtitle">This is the fastest way to get in front of investors who are actively deploying capital</div>
					</div>
					<div class="step-body">
						<div class="presentation-layout">
							<div>
								<ul class="pres-benefits">
									<li class="pres-benefit"><div class="pres-benefit-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg></div><div class="pres-benefit-text"><strong>Your event is directly marketed to every investor whose buy box matches your deal.</strong> No cold audience - these are LPs who have already told us they want your asset class, return profile, and check size.</div></li>
									<li class="pres-benefit"><div class="pres-benefit-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></div><div class="pres-benefit-text"><strong>90-minute live session.</strong> 40-45 minutes for your presentation, 45 minutes of live Q&amp;A where investors can ask you anything. This is where trust gets built and deals move forward.</div></li>
									<li class="pres-benefit"><div class="pres-benefit-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg></div><div class="pres-benefit-text"><strong>Recording shared with our full investor database.</strong> Investors who couldn't make the live event watch the replay. Your pitch keeps working after the event ends.</div></li>
									<li class="pres-benefit"><div class="pres-benefit-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="12" width="4" height="8"/><rect x="10" y="8" width="4" height="12"/><rect x="17" y="4" width="4" height="16"/></svg></div><div class="pres-benefit-text"><strong>Full post-event analytics.</strong> See exactly who attended, how engaged they were, and who requested a follow-up introduction to your IR team.</div></li>
								</ul>
							</div>
							<div class="presentation-right">
								<div class="network-stats-grid">
									<div class="net-stat highlight" style="grid-column:1/-1;">
										<div class="net-stat-value">{displayTotalLPs.toLocaleString()}+</div>
										<div class="net-stat-label">Investors in our database</div>
									</div>
								</div>
								<div class="mini-chart-wrap">
									<div class="mini-chart-title">Weekly Presentation Schedule</div>
									<div class="presentation-schedule">
										<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" class="presentation-schedule-icon"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
										<div class="presentation-schedule-copy">
											<div class="presentation-schedule-title">Every Thursday</div>
											<div class="presentation-schedule-time">1:00 PM - 2:30 PM ET</div>
										</div>
										<span class="presentation-schedule-badge">BOOKING OPEN</span>
									</div>
									<div class="presentation-schedule-note">One operator per week - slots fill up fast</div>
								</div>
								<div class="mini-chart-wrap">
									<div class="mini-chart-title">LP Check Size Distribution</div>
									{#each checkSizeData as sizeRange}
										<div class="bar-chart-row">
											<div class="bar-label">{sizeRange.label}</div>
											<div class="bar-track">
												<div class={`bar-fill ${sizeRange.colorClass}`} style={`width:${sizeRange.widthPct}%`}></div>
											</div>
											<div class="bar-count">{sizeRange.count}</div>
										</div>
									{/each}
								</div>
							</div>
						</div>
					</div>
				<div class="step-footer">
					<button class="btn-secondary" onclick={() => goToStep('step7', true)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="15 18 9 12 15 6"/></svg>
						Back
					</button>
					<div style="display:flex;gap:12px;align-items:center;">
						<button class="btn-skip" onclick={() => savePresentation(false)}>Maybe later</button>
						<button class="btn-primary" onclick={() => savePresentation(true)}>
							Yes, I'm Interested
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if currentStep === 'step9'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">{nativeCompanionMode ? 'Continue on the Web' : 'Reserve Your Slot'}</div>
					<div class="step-title">{nativeCompanionMode ? 'Presentation scheduling happens on the web' : 'Book your Thursday presentation'}</div>
					<div class="step-subtitle">
						{#if nativeCompanionMode}
							Review the program here, then continue scheduling and contracting on the web.
						{:else}
							Get in front of {displayTotalLPs.toLocaleString()}+ investors in a single 90-minute session
						{/if}
					</div>
				</div>
				<div class="step-body">
					<div class="upsell-card">
						<div class="upsell-header">
							<div class="upsell-label">Operator Sponsorship</div>
							{#if !nativeCompanionMode}
								<div class="upsell-price">$1,000</div>
								<div class="upsell-price-sub">one-time &mdash; per presentation slot</div>
							{/if}
						</div>
							<div class="upsell-body">
								<ul class="upsell-includes">
									<li><div class="upsell-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><div><strong>90-minute live session</strong> &mdash; 45 minutes to present your deal, team, and track record, followed by 45 minutes of live Q&amp;A with qualified investors</div></li>
									<li><div class="upsell-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><div><strong>Directly marketed to matched investors</strong> &mdash; every LP whose buy box matches your deal gets a personal invitation with your deal summary</div></li>
									<li><div class="upsell-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><div><strong>Full recording distributed</strong> &mdash; shared with our entire investor database and embedded on your deal page so it keeps working after the event</div></li>
									<li><div class="upsell-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><div><strong>Post-event analytics</strong> &mdash; see who attended, engagement data, and which investors requested a direct introduction to your IR team</div></li>
									<li><div class="upsell-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg></div><div><strong>Every Thursday at 1:00 PM ET</strong> &mdash; one operator per week, first come first served. Pick your date after checkout.</div></li>
								</ul>
								<div class="proof-grid">
									<div class="proof-stat-card">
										<div class="proof-stat-value">8-20</div>
										<div class="proof-stat-label">Live Attendees</div>
									</div>
									<div class="proof-stat-card">
										<div class="proof-stat-value">500+</div>
										<div class="proof-stat-label">Avg. YouTube Views (90 Days)</div>
									</div>
								</div>
								<div class="youtube-proof">
									<svg viewBox="0 0 24 24" fill="none" stroke="var(--red)" stroke-width="2" class="youtube-proof-icon"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
									<div class="youtube-proof-copy">
										<div class="youtube-proof-title">Presentations also go on YouTube</div>
										<div class="youtube-proof-text">Our top operator presentation has <strong>1,500+ views</strong> on YouTube. The average hits 500+ views within 90 days. Your pitch keeps reaching new investors for months.</div>
									</div>
								</div>
								{#if nativeCompanionMode}
									<WebOnlyNotice
										title="Continue on the web"
										message="Scheduling, contracting, and payment for presentation slots are completed on the web."
										href="https://growyourcashflow.io/book-pitch"
									/>
								{:else}
									<button class="upsell-cta" onclick={() => window.open('https://link.fastpaydirect.com/payment-link/66e09581d780e54a43941ac8', '_blank')}>
										Reserve My Slot &mdash; $1,000
									</button>
									<div class="upsell-guarantee">Secure checkout via GoHighLevel. Cancel anytime before your presentation date.</div>
								{/if}
						</div>
					</div>
				</div>
				<div class="step-footer">
					<button class="btn-skip" onclick={skipPayment}>I'll do this later</button>
					<span></span>
				</div>
			</div>
		{/if}

		{#if currentStep === 'step10'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">You're In</div>
					<div class="step-title">Welcome to the GP network!</div>
					<div class="step-subtitle">Here's a summary of your onboarding.</div>
				</div>
				<div class="step-body">
					<ul class="checklist">
						{#each checklistItems as item}
							<li class="checklist-item">
								<div class="checklist-icon" class:done={item.done} class:skipped={item.skipped} class:pending={!item.done && !item.skipped}>
									{#if item.done}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
									{:else if item.skipped}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"/></svg>
									{:else}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg>
									{/if}
								</div>
								<div class="checklist-info">
									<div class="checklist-label">{item.label}</div>
									<div class="checklist-status">{item.done ? 'Complete' : item.skipped ? 'Skipped' : 'Pending'}</div>
								</div>
								{#if item.step}
									<button class="checklist-action" onclick={() => goToStep(item.step)}>{item.action}</button>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
				<div class="step-footer">
					<span></span>
					<button class="btn-primary" onclick={() => goToStep('step11')}>
						Continue
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
					</button>
				</div>
			</div>
		{/if}

		{#if currentStep === 'step11'}
			<div class="step active">
				<div class="step-header">
					<div class="step-counter">One More Thing</div>
					<div class="step-title">Are you also an LP?</div>
				</div>
					<div class="step-body">
						<div class="lp-prompt">
							<div class="lp-prompt-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></div>
							<div class="lp-prompt-desc">Many GPs are also active investors. If you invest in other operators' deals, setting up your LP buy box helps us match you with opportunities that fit your criteria.</div>
							<div class="lp-prompt-benefits">
								<div class="lp-benefit-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg><div class="lp-benefit-text">Get matched to deals</div></div>
							<div class="lp-benefit-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg><div class="lp-benefit-text">Personalized deal alerts</div></div>
							<div class="lp-benefit-card"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg><div class="lp-benefit-text">Compare opportunities</div></div>
						</div>
					</div>
				</div>
					<div class="step-footer">
						<button class="btn-skip" onclick={() => finishOnboarding(false)} disabled={finishSaving}>Skip &mdash; take me to my dashboard</button>
						<button class="btn-primary" onclick={() => finishOnboarding(true)} disabled={finishSaving}>
							Set Up My Buy Box
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
						</button>
					</div>
					{#if finishError}
						<div class="step-error" style="margin-top:16px;">{finishError}</div>
					{/if}
				</div>
			{/if}

			</div>
		</div>
	</div>
</div>

<style>
	/* ====== LAYOUT ====== */
	.onboarding-page {
		--ly-frame-max: 900px;
		--ly-frame-pad-desktop: 20px;
		--ly-frame-pad-tablet: 20px;
		--ly-frame-pad-mobile: 8px;
		--ly-frame-pad-top: 40px;
		--ly-frame-pad-bottom: 40px;
		--ly-frame-pad-top-tablet: 20px;
		--ly-frame-pad-bottom-tablet: 20px;
		--ly-frame-pad-top-mobile: 12px;
		--ly-frame-pad-bottom-mobile: 12px;
		--onboarding-shell-offset: 80px;
		min-height: 100vh;
		min-height: 100dvh;
	}
	.onboarding-page--app {
		--onboarding-shell-offset: 0px;
		min-height: auto;
	}
	.onboarding-shell { min-width: 0; }
	.onboarding-shell--app {
		width: min(100%, 900px);
		padding-inline: 0;
		padding-block: 0;
	}
	.onboarding-container { min-height: calc(100dvh - var(--onboarding-shell-offset)); display: flex; align-items: center; justify-content: center; min-width: 0; }
	.onboarding-page--app .onboarding-container { min-height: auto; align-items: flex-start; justify-content: flex-start; }
	.onboarding-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.08); width: 100%; max-width: 860px; overflow: hidden; position: relative; }
	.progress-bar-wrap { height: 4px; background: var(--border-light); position: relative; }
	.progress-bar-fill { height: 100%; background: linear-gradient(90deg, var(--primary), var(--accent-green)); border-radius: 0 2px 2px 0; transition: width 0.5s ease; }
	.step { opacity: 1; }
	.step-header { padding: 32px 40px 0; text-align: center; }
	.step-counter { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary); margin-bottom: 8px; }
	.step-title { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); line-height: 1.2; letter-spacing: -0.5px; margin-bottom: 8px; }
	.step-subtitle { font-family: var(--font-body); font-size: 16px; color: var(--text-secondary); max-width: 560px; margin: 0 auto; }
	.step-body { padding: 28px 40px 32px; }
	.step-footer { padding: 0 40px 32px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }

	/* ====== BUTTONS ====== */
	.btn-primary { display: inline-flex; align-items: center; gap: 8px; padding: 12px 28px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 14px; font-weight: 700; cursor: pointer; transition: all var(--transition); letter-spacing: -0.2px; }
	.btn-primary:hover { background: var(--primary-hover); transform: translateY(-1px); box-shadow: 0 4px 12px rgba(81,190,123,0.3); }
	.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
	.btn-primary svg { width: 16px; height: 16px; }
	.btn-secondary { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; background: transparent; color: var(--text-secondary); border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 13px; font-weight: 600; cursor: pointer; transition: all var(--transition); }
	.btn-secondary:hover { border-color: var(--text-muted); color: var(--text-dark); }
	.btn-skip { background: none; border: none; font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--text-muted); cursor: pointer; padding: 8px 12px; transition: color var(--transition); }
	.btn-skip:hover { color: var(--text-secondary); }

	/* ====== ROLE FORK ====== */
	.role-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 8px 0; }
	.role-card { width: 100%; border: 2px solid var(--border); border-radius: var(--radius); padding: 32px 24px; text-align: center; cursor: pointer; transition: all 0.25s ease; position: relative; background: var(--bg-card); appearance: none; font: inherit; }
	.role-card:hover { border-color: var(--primary); box-shadow: var(--shadow-card-hover); transform: translateY(-2px); }
	.role-card.selected { border-color: var(--primary); background: var(--green-bg); }
	.role-card-icon { width: 64px; height: 64px; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; }
	.role-card-icon svg { width: 28px; height: 28px; }
	.role-card-icon.lp-icon { background: var(--blue-bg); color: var(--blue); }
	.role-card-icon.gp-icon { background: var(--green-bg); color: var(--green); }
	.role-card-title { font-family: var(--font-ui); font-size: 17px; font-weight: 800; color: var(--text-dark); margin-bottom: 6px; }
	.role-card-desc { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); line-height: 1.4; }

	/* ====== GOAL CARDS ====== */
	.goal-cards { display: grid; grid-template-columns: 1fr; gap: 12px; }
	.goal-card { text-align: left; display: flex; align-items: center; gap: 16px; padding: 20px 24px; }
	.goal-emoji { font-size: 32px; flex-shrink: 0; }

	/* ====== LP PROGRESS DOTS ====== */
	.lp-progress-dots { display: flex; align-items: center; justify-content: center; gap: 8px; margin-bottom: 16px; }
	.lp-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--border); transition: all 0.3s ease; }
	.lp-dot.active { width: 24px; border-radius: 4px; background: var(--primary); }
	.lp-dot.done { background: var(--primary); }

	/* ====== DEAL COUNT ====== */
	.deal-count-wrap { max-width: 400px; margin: 0 auto; text-align: center; }
	.deal-count-row { display: flex; align-items: center; justify-content: center; gap: 16px; }
	.count-btn { width: 44px; height: 44px; border-radius: 50%; border: 1px solid var(--border); background: var(--bg-card); font-size: 20px; font-weight: 700; color: var(--text-secondary); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all 0.15s; }
	.count-btn:hover { border-color: var(--primary); color: var(--primary); }
	.deal-count-input { font-family: var(--font-headline); font-size: 48px; color: var(--text-dark); border: none; background: transparent; text-align: center; width: 80px; outline: none; letter-spacing: -1px; }
	.deal-count-input.big { width: 100%; }
	.count-label { font-family: var(--font-ui); font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }
	.count-feedback { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); line-height: 1.6; padding: 12px 16px; background: var(--green-bg); border-radius: var(--radius-sm); min-height: 44px; }
	.preset-chips { display: flex; gap: 8px; justify-content: center; flex-wrap: wrap; margin-bottom: 20px; }

	/* ====== LP DEAL COUNT CARD GRID ====== */
	.deal-pill-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; max-width: 360px; margin: 0 auto 20px; }
	.deal-pill {
		display: flex; flex-direction: column; align-items: center; justify-content: center;
		padding: 20px 16px; border: 2px solid var(--border); border-radius: var(--radius);
		cursor: pointer; transition: all 0.2s ease; background: var(--bg-card); text-align: center;
	}
	.deal-pill:hover { border-color: var(--primary); transform: translateY(-1px); box-shadow: var(--shadow-card-hover); }
	.deal-pill.selected { border-color: var(--primary); background: rgba(81,190,123,0.04); }
	.deal-pill-num { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); margin-bottom: 4px; }
	.deal-pill-label { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); font-weight: 600; }

	/* ====== BASELINE INCOME CARDS ====== */
	.baseline-card { padding: 16px 20px; gap: 14px; }
	.baseline-card-amount { font-size: 20px; min-width: 80px; }

	/* ====== PILL OPTIONS ====== */
	.pill-grid { display: flex; flex-wrap: wrap; gap: 8px; }
	.pill-option { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border: 1px solid var(--border); border-radius: 24px; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all var(--transition); user-select: none; background: none; appearance: none; }
	.pill-option:hover { border-color: var(--primary); color: var(--primary); }
	.pill-option.selected { border-color: var(--primary); background: var(--green-bg); color: var(--primary); }

	/* ====== FORM FIELDS ====== */
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
	.form-group { display: flex; flex-direction: column; gap: 4px; }
	.form-group.full-width { grid-column: 1 / -1; }
	.form-label { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.3px; }
	.form-input { padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px; color: var(--text-dark); background: var(--bg-card); transition: border-color var(--transition); outline: none; }
	.form-input:focus { border-color: var(--primary); }
	.form-input::placeholder { color: var(--text-muted); }
	select.form-input { cursor: pointer; appearance: auto; }

	/* ====== LP PHOTO STEP ====== */
	.lp-photo-panel {
		max-width: 420px;
		margin: 0 auto;
		padding: 20px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		box-shadow: var(--shadow-card);
		text-align: center;
	}
	.lp-photo-preview {
		width: 88px;
		height: 88px;
		border-radius: 50%;
		margin: 0 auto 16px;
		background: var(--green-bg);
		border: 1px solid rgba(81,190,123,0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		overflow: hidden;
		font-family: var(--font-headline);
		font-size: 28px;
		font-weight: 700;
		color: var(--primary);
	}
	.lp-photo-preview img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.lp-photo-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		align-items: center;
		justify-content: center;
	}
	.lp-photo-upload {
		position: relative;
		overflow: hidden;
	}
	.lp-photo-help {
		margin-top: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* ====== COMPLETION SCREEN ====== */
	.completion-checkmark { width: 64px; height: 64px; border-radius: 50%; background: var(--green-bg); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; animation: completionPop 0.5s cubic-bezier(.175,.885,.32,1.275) forwards; }
	@keyframes completionPop { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
	.completion-summary { max-width: 400px; margin: 0 auto; }
	.completion-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--border-light); font-family: var(--font-ui); font-size: 14px; }
	.completion-row:last-child { border-bottom: none; }
	.completion-label { color: var(--text-muted); font-weight: 500; }
	.completion-value { color: var(--text-dark); font-weight: 700; }

	/* ====== WELCOME / VALUE PROP ====== */
	.welcome-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; align-items: start; }
	.welcome-headline { font-family: var(--font-headline); font-size: 26px; color: var(--text-dark); line-height: 1.2; margin-bottom: 20px; }
	.value-prop { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 16px; }
	.value-prop-icon { width: 32px; height: 32px; border-radius: 50%; background: var(--green-bg); color: var(--green); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.value-prop-icon svg { width: 16px; height: 16px; }
	.value-prop-text { font-family: var(--font-body); font-size: 15px; color: var(--text-secondary); line-height: 1.4; }
	.value-prop-text strong { color: var(--text-dark); font-weight: 600; }

	/* ====== NETWORK STATS ====== */
	.network-stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
	.net-stat { background: var(--off-white); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 16px; text-align: center; }
	.net-stat-value { font-family: var(--font-headline); font-size: 28px; color: var(--teal-deep); line-height: 1; margin-bottom: 2px; }
	.net-stat-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); }
	.net-stat.highlight { background: linear-gradient(145deg, var(--teal-midnight), var(--teal-deep)); border-color: transparent; }
	.net-stat.highlight .net-stat-value { color: var(--accent-green); }
	.net-stat.highlight .net-stat-label { color: rgba(255,255,255,0.6); }

	/* ====== MINI CHARTS ====== */
	.mini-chart-wrap { margin-top: 16px; background: var(--off-white); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 16px; }
	.mini-chart-title { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--text-muted); margin-bottom: 12px; }
	.bar-chart-row { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
	.bar-chart-row:last-child { margin-bottom: 0; }
	.bar-label { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-secondary); width: 100px; text-align: right; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.bar-track { flex: 1; height: 20px; background: var(--border-light); border-radius: 4px; overflow: hidden; position: relative; }
	.bar-fill { height: 100%; border-radius: 4px; transition: width 1s ease; min-width: 2px; }
	.bar-fill.green { background: var(--primary); }
	.bar-fill.teal { background: var(--teal-deep); }
	.bar-fill.blue { background: var(--blue); }
	.bar-count { font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-muted); width: 32px; text-align: right; flex-shrink: 0; }

	/* ====== DONUT CHART ====== */
	.donut-wrap { display: flex; align-items: center; gap: 20px; }
	.donut-svg { width: 90px; height: 90px; flex-shrink: 0; }
	.donut-legend { flex: 1; }
	.donut-legend-item { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); }
	.donut-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
	.donut-legend-pct { color: var(--text-muted); margin-left: auto; }

	/* ====== COMPANY TYPEAHEAD ====== */
	.company-dropdown { position: absolute; top: 100%; left: 0; right: 0; background: var(--bg-card); border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius-sm) var(--radius-sm); box-shadow: 0 8px 24px rgba(0,0,0,0.12); z-index: 50; max-height: 240px; overflow-y: auto; }
	.company-result { display: flex; align-items: center; gap: 12px; width: 100%; padding: 12px 16px; cursor: pointer; transition: background var(--transition); border: none; border-bottom: 1px solid var(--border-light); background: none; text-align: left; font: inherit; }
	.company-result:last-child { border-bottom: none; }
	.company-result:hover { background: var(--green-bg); }
	.company-result-icon { width: 36px; height: 36px; border-radius: var(--radius-sm); background: var(--green-bg); color: var(--primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; font-family: var(--font-ui); font-weight: 800; font-size: 13px; }
	.company-result-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.company-result-meta { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); font-weight: 500; }
	.company-create-option { display: flex; align-items: center; gap: 10px; width: 100%; padding: 12px 16px; cursor: pointer; transition: background var(--transition); font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--primary); border: none; background: none; text-align: left; }
	.company-create-option:hover { background: var(--green-bg); }
	.company-create-option svg { width: 16px; height: 16px; flex-shrink: 0; }

	/* ====== IR CONTACT ====== */
	.ir-toggle-row { display: flex; align-items: center; gap: 10px; width: 100%; margin-bottom: 16px; cursor: pointer; border: none; background: none; padding: 0; text-align: left; }
	.ir-toggle-check { width: 20px; height: 20px; border: 2px solid var(--border); border-radius: 4px; display: flex; align-items: center; justify-content: center; transition: all var(--transition); flex-shrink: 0; }
	.ir-toggle-check.checked { border-color: var(--primary); background: var(--primary); }
	.ir-toggle-check svg { width: 12px; height: 12px; color: #fff; display: none; }
	.ir-toggle-check.checked svg { display: block; }
	.ir-toggle-label { font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: var(--text-dark); }

	/* ====== AGREEMENT ====== */
	.agreement-scroll { max-height: 340px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 24px 28px; background: var(--off-white); margin-bottom: 20px; font-family: var(--font-body); font-size: 14px; line-height: 1.7; color: var(--text-secondary); }
	.agreement-scroll h3 { font-family: var(--font-ui); font-size: 15px; font-weight: 800; color: var(--text-dark); margin: 20px 0 8px; letter-spacing: -0.2px; }
	.agreement-scroll h3:first-child { margin-top: 0; }
	.agreement-scroll p { margin-bottom: 10px; }
	.agreement-scroll strong { color: var(--text-dark); }
	.consent-checks { display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px; }
	.consent-row { display: flex; align-items: flex-start; gap: 12px; width: 100%; cursor: pointer; border: none; background: none; padding: 0; text-align: left; }
	.consent-box { width: 22px; height: 22px; border: 2px solid var(--border); border-radius: 4px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all var(--transition); margin-top: 1px; }
	.consent-box.checked { border-color: var(--primary); background: var(--primary); }
	.consent-box svg { width: 13px; height: 13px; color: #fff; display: none; }
	.consent-box.checked svg { display: block; }
	.consent-text { font-family: var(--font-body); font-size: 14px; color: var(--text-dark); line-height: 1.4; }
	.consent-text strong { font-weight: 700; }
	.signature-section { background: var(--off-white); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 20px 24px; }
	.signature-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--text-muted); margin-bottom: 12px; }
	.offering-type-row { display: flex; gap: 12px; margin-bottom: 16px; }
	.offering-type-option { flex: 1; border: 2px solid var(--border); border-radius: var(--radius-sm); padding: 12px 16px; cursor: pointer; transition: all var(--transition); text-align: center; background: var(--bg-card); appearance: none; font: inherit; }
	.offering-type-option:hover { border-color: var(--primary); }
	.offering-type-option.selected { border-color: var(--primary); background: var(--green-bg); }
	.ot-label { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.ot-desc { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); margin-top: 2px; }
	.offering-506b-note { background: var(--yellow-bg); border: 1px solid rgba(202,138,4,0.3); border-radius: var(--radius-sm); padding: 12px 16px; font-family: var(--font-ui); font-size: 13px; color: var(--text-dark); line-height: 1.5; }
	.step-error { margin-top: 16px; padding: 12px 14px; border: 1px solid rgba(208,64,64,0.24); border-radius: var(--radius-sm); background: rgba(208,64,64,0.08); color: #9f2323; font-family: var(--font-ui); font-size: 13px; line-height: 1.5; }

	/* ====== UPLOAD / DROP ZONE ====== */
	.upload-options { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
	.upload-card { border: 2px dashed var(--border); border-radius: var(--radius); padding: 32px 24px; text-align: center; cursor: pointer; transition: all 0.25s ease; }
	.upload-card:hover { border-color: var(--primary); border-style: solid; background: var(--green-bg); }
	.upload-card.primary-option { border-color: var(--primary); border-style: solid; background: var(--green-bg); }
	.upload-card-icon { width: 48px; height: 48px; border-radius: 50%; background: var(--green-bg); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
	.upload-card-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.upload-card-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }
	.drop-zone { display: block; width: 100%; box-sizing: border-box; border: 2px dashed var(--border); border-radius: var(--radius); padding: 48px 24px; text-align: center; cursor: pointer; transition: all 0.25s ease; }
	.drop-zone.active { border-color: var(--primary); background: var(--green-bg); }
	.drop-zone.dragging { border-color: var(--accent-green); background: var(--green-bg); transform: scale(1.01); }
	.drop-zone-icon { width: 56px; height: 56px; border-radius: 50%; background: var(--green-bg); color: var(--primary); display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; }
	.drop-zone-icon svg { width: 24px; height: 24px; }
	.drop-zone-text { font-family: var(--font-ui); font-size: 15px; font-weight: 600; color: var(--text-dark); margin-bottom: 4px; }
	.drop-zone-hint { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); }
	.upload-note { margin-top: 16px; padding: 12px 16px; background: var(--off-white); border-radius: 8px; font-size: 13px; color: var(--text-muted); line-height: 1.5; }
	.upload-note strong { color: var(--text-secondary); }

	.role-card:focus-visible,
	.pill-option:focus-visible,
	.company-result:focus-visible,
	.company-create-option:focus-visible,
	.ir-toggle-row:focus-visible,
	.offering-type-option:focus-visible,
	.consent-row:focus-visible,
	.drop-zone:focus-visible {
		outline: 2px solid var(--primary);
		outline-offset: 2px;
	}

	/* ====== PROCESSING STATE ====== */
	.processing-state { text-align: center; padding: 48px 24px; }
	.processing-spinner { width: 48px; height: 48px; border: 3px solid var(--border-light); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.8s linear infinite; margin: 0 auto 16px; }
	@keyframes spin { to { transform: rotate(360deg); } }
	.processing-text { font-family: var(--font-ui); font-size: 15px; font-weight: 600; color: var(--text-dark); margin-bottom: 4px; }
	.processing-sub { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); }

	/* ====== PRESENTATION ====== */
	.presentation-layout { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; }
	.pres-benefits { list-style: none; }
	.pres-benefit { display: flex; align-items: flex-start; gap: 10px; margin-bottom: 14px; }
	.pres-benefit-icon { width: 24px; height: 24px; border-radius: 50%; background: var(--green-bg); color: var(--green); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
	.pres-benefit-icon svg { width: 12px; height: 12px; }
	.pres-benefit-text { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); line-height: 1.4; }
	.presentation-schedule { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); background: var(--bg-card); margin-top: 8px; }
	.presentation-schedule-icon { width: 20px; height: 20px; flex-shrink: 0; }
	.presentation-schedule-copy { min-width: 0; }
	.presentation-schedule-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); }
	.presentation-schedule-time { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); }
	.presentation-schedule-badge { margin-left: auto; font-family: var(--font-ui); font-size: 10px; font-weight: 700; color: var(--primary); background: var(--green-bg); padding: 3px 10px; border-radius: 10px; white-space: nowrap; }
	.presentation-schedule-note { font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); margin-top: 8px; text-align: center; }

	/* ====== MATCH HIGHLIGHT ====== */
	.match-highlight { background: linear-gradient(145deg, var(--teal-midnight), var(--teal-deep)); border-radius: var(--radius); padding: 20px; text-align: center; margin-top: 16px; }
	.match-number { font-family: var(--font-headline); font-size: 36px; color: var(--accent-green); line-height: 1; }
	.match-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: rgba(255,255,255,0.6); margin-top: 4px; }

	/* ====== UPSELL / PAYMENT ====== */
	.upsell-card { border: 2px solid var(--primary); border-radius: 16px; overflow: hidden; background: var(--bg-card); }
	.upsell-header { background: linear-gradient(145deg, var(--teal-midnight), var(--teal-deep)); padding: 28px 32px; text-align: center; }
	.upsell-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-green); margin-bottom: 8px; }
	.upsell-price { font-family: var(--font-headline); font-size: 48px; color: var(--accent-green); line-height: 1; }
	.upsell-price-sub { font-family: var(--font-ui); font-size: 14px; color: rgba(255,255,255,0.6); margin-top: 4px; }
	.upsell-body { padding: 28px 32px; }
	.upsell-includes { list-style: none; padding: 0; margin: 0 0 24px; }
	.upsell-includes li { display: flex; align-items: flex-start; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border-light); font-family: var(--font-body); font-size: 14px; color: var(--text-dark); line-height: 1.4; }
	.upsell-includes li:last-child { border-bottom: none; }
	.upsell-check { width: 22px; height: 22px; border-radius: 50%; background: var(--green-bg); color: var(--green); display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
	.upsell-check svg { width: 12px; height: 12px; }
	.proof-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 24px; padding-top: 4px; }
	.proof-stat-card { background: var(--off-white); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 14px 10px; text-align: center; }
	.proof-stat-value { font-family: var(--font-headline); font-size: 22px; color: var(--teal-deep); line-height: 1; }
	.proof-stat-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-top: 2px; }
	.youtube-proof { background: var(--off-white); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 14px 16px; margin-bottom: 24px; display: flex; align-items: center; gap: 12px; }
	.youtube-proof-icon { width: 20px; height: 20px; flex-shrink: 0; }
	.youtube-proof-copy { flex: 1; min-width: 0; }
	.youtube-proof-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.youtube-proof-text { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); }
	.youtube-proof-text strong { color: var(--text-dark); }
	.upsell-cta { display: block; width: 100%; padding: 16px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 16px; font-weight: 800; cursor: pointer; transition: all var(--transition); text-align: center; letter-spacing: -0.3px; }
	.upsell-cta:hover { background: var(--primary-hover); transform: translateY(-1px); box-shadow: 0 4px 16px rgba(81,190,123,0.3); }
	.upsell-guarantee { text-align: center; margin-top: 12px; font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); }

	/* ====== COMPLETION CHECKLIST ====== */
	.checklist { list-style: none; }
	.checklist-item { display: flex; align-items: center; gap: 14px; padding: 14px 0; border-bottom: 1px solid var(--border-light); }
	.checklist-item:last-child { border-bottom: none; }
	.checklist-icon { width: 32px; height: 32px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
	.checklist-icon svg { width: 14px; height: 14px; }
	.checklist-icon.done { background: var(--green-bg); color: var(--green); }
	.checklist-icon.pending { background: var(--orange-bg); color: var(--orange); }
	.checklist-icon.skipped { background: var(--border-light); color: var(--text-muted); }
	.checklist-info { flex: 1; }
	.checklist-label { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.checklist-status { font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); font-weight: 500; }
	.checklist-action { padding: 6px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-secondary); background: transparent; cursor: pointer; transition: all var(--transition); text-decoration: none; }
	.checklist-action:hover { border-color: var(--primary); color: var(--primary); }

	/* ====== LP PROMPT (ALSO AN LP?) ====== */
	.lp-prompt { text-align: center; padding: 16px 0; }
	.lp-prompt-icon { width: 72px; height: 72px; border-radius: 50%; background: var(--blue-bg); color: var(--blue); display: flex; align-items: center; justify-content: center; margin: 0 auto 20px; }
	.lp-prompt-icon svg { width: 32px; height: 32px; }
	.lp-prompt-title { font-family: var(--font-headline); font-size: 24px; color: var(--text-dark); margin-bottom: 10px; }
	.lp-prompt-desc { font-family: var(--font-body); font-size: 15px; color: var(--text-secondary); max-width: 480px; margin: 0 auto 24px; line-height: 1.5; }
	.lp-prompt-benefits { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 28px; max-width: 520px; margin-left: auto; margin-right: auto; }
	.lp-benefit-card { background: var(--off-white); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 16px 12px; text-align: center; }
	.lp-benefit-card svg { width: 20px; height: 20px; color: var(--blue); margin-bottom: 6px; }
	.lp-benefit-text { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-secondary); line-height: 1.3; }

	/* ====== GYC LOGO ====== */
	.gyc-logo { text-align: center; padding: 24px 0 0; }
	.gyc-logo-text { font-family: var(--font-headline); font-size: 20px; color: var(--text-dark); letter-spacing: -0.3px; }
	.gyc-logo-sub { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); letter-spacing: 1px; text-transform: uppercase; margin-top: 2px; }

	/* ====== RESPONSIVE ====== */
	@media (max-width: 700px) {
		.onboarding-page {
			--ly-frame-pad-mobile: 8px;
			--ly-frame-pad-top-mobile: 12px;
			--ly-frame-pad-bottom-mobile: 12px;
			--onboarding-shell-offset: 24px;
		}
		.onboarding-card { border-radius: 12px; }
		.step-header { padding: 20px 16px 0; }
		.step-body { padding: 16px 16px 20px; }
		.step-footer { padding: 0 16px 20px; flex-wrap: wrap; }
		.step-title { font-size: 22px; }
		.step-subtitle { font-size: 14px; }

		/* Role fork */
		.role-cards { grid-template-columns: 1fr; gap: 12px; }
		.role-card { padding: 24px 20px; }
		.role-card-icon { width: 52px; height: 52px; margin-bottom: 12px; }
		.role-card-title { font-size: 15px; }

		/* Welcome / Value Prop */
		.welcome-layout, .presentation-layout { grid-template-columns: 1fr; gap: 20px; }
		.welcome-headline { font-size: 22px; }
		.network-stats-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
		.net-stat { padding: 12px; }
		.net-stat-value { font-size: 22px; }
		.bar-label { width: 70px; font-size: 10px; }
		.bar-count { width: 28px; font-size: 10px; }
		.donut-wrap { flex-direction: column; gap: 12px; }
		.donut-svg { width: 80px; height: 80px; }
		.mini-chart-wrap { padding: 12px; }

		/* Form fields */
		.form-grid { grid-template-columns: 1fr; gap: 12px; }
		.form-input { font-size: 16px; padding: 12px 14px; } /* 16px prevents iOS zoom */

		/* Upload / Drop zone */
		.upload-options { grid-template-columns: 1fr; gap: 12px; }
		.upload-card { padding: 24px 20px; }
		.drop-zone { padding: 32px 16px; }
		.drop-zone-icon { width: 48px; height: 48px; }

		/* Presentation */
		.match-highlight { padding: 16px; }
		.match-number { font-size: 28px; }
		.pres-benefit-text { font-size: 13px; }
		.presentation-schedule { flex-wrap: wrap; }
		.presentation-schedule-badge { margin-left: 0; }

		/* Checklist */
		.checklist-item { gap: 10px; padding: 12px 0; }
		.checklist-label { font-size: 13px; }
		.checklist-action { padding: 6px 10px; font-size: 10px; }

		/* LP Prompt */
		.lp-prompt-benefits { grid-template-columns: 1fr; gap: 8px; }
		.lp-prompt-title { font-size: 20px; }
		.lp-prompt-desc { font-size: 14px; }

		/* Upsell / Payment */
		.upsell-header { padding: 20px 16px; }
		.upsell-price { font-size: 36px; }
		.upsell-body { padding: 20px 16px; }
		.proof-grid { grid-template-columns: 1fr; }
		.youtube-proof { align-items: flex-start; }
		.upsell-cta { font-size: 15px; padding: 14px; }

		/* Agreement */
		.agreement-scroll { max-height: 260px; padding: 16px; font-size: 13px; }
		.consent-text { font-size: 13px; }
		.signature-section { padding: 16px; }
		.offering-type-row { flex-direction: column; gap: 8px; }

		/* Buttons */
		.btn-primary { padding: 14px 24px; font-size: 15px; justify-content: center; flex: 1; }
		.btn-secondary { padding: 12px 18px; font-size: 14px; }
		.step-footer { flex-wrap: nowrap; }

		/* Pill grid */
		.pill-option { padding: 10px 14px; font-size: 13px; }

		/* Deal pill grid */
		.deal-pill-grid { gap: 8px; }
		.deal-pill { padding: 16px 12px; }
		.deal-pill-num { font-size: 24px; }

		/* Baseline cards */
		.baseline-card { padding: 14px 16px; gap: 12px; }
		.baseline-card-amount { font-size: 18px; min-width: 76px; }

		/* LP prompt benefits */
		.lp-prompt-benefits { grid-template-columns: 1fr; }
	}

	/* ====== EXTRA SMALL PHONES ====== */
	@media (max-width: 380px) {
		.onboarding-page {
			--ly-frame-pad-mobile: 4px;
			--ly-frame-pad-top-mobile: 8px;
			--ly-frame-pad-bottom-mobile: 8px;
			--onboarding-shell-offset: 16px;
		}
		.step-header { padding: 16px 12px 0; }
		.step-body { padding: 12px 12px 16px; }
		.step-footer { padding: 0 12px 16px; }
		.step-title { font-size: 20px; }
		.network-stats-grid { grid-template-columns: 1fr; }
		.role-card-icon { width: 44px; height: 44px; }
		.baseline-card-amount { font-size: 16px; min-width: 64px; }
	}
</style>
