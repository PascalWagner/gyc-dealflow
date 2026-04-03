<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import CompanionGate from '$lib/components/CompanionGate.svelte';
	import LegacyPlanWizard from '$lib/components/LegacyPlanWizard.svelte';
	import PlanRoadmapChart from '$lib/components/PlanRoadmapChart.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import { deals, dealStages, fetchDeals } from '$lib/stores/deals.js';
	import {
		bootstrapProtectedRouteSession,
		canBuildFullPlan,
		getStoredSessionUser,
		isMember
	} from '$lib/stores/auth.js';
	import {
		currentAdminRealUser,
		getUserScopedCacheSnapshot,
		readScopedJson,
		writeScopedJson,
		writeUserScopedJson,
		writeUserScopedString
	} from '$lib/utils/userScopedState.js';
	import { browser } from '$app/environment';
	import { isNativeApp } from '$lib/utils/platform.js';
	import {
		STEP,
		hasCompletedPlan,
		hasSavedWizardProgress,
		getBranchFlowKey,
		normalizeWizardData,
		parseDollar,
		stageSlugForStep
	} from '$lib/onboarding/planWizard.js';
	import { buildInvestedPortfolio } from '$lib/utils/investedPortfolio.js';

	let hasPlan = $state(false);
	let loading = $state(true);
	let plan = $state(null);
	let portfolioDetails = $state([]);
	let showWizard = $state(false);
	let saving = $state(false);
	let saveMsg = $state('');
	let shouldOpenWizardFromLocation = false;
	let wizardForceEdit = $state(false);
	let wizardStage = $state('');
	let wizardBranch = $state('');
	let wizardFlowKey = $state('');
	let roadmapView = $state('plan');
	let reportUser = $state(null);
	let portfolioPlan = $state(null);
	let marketSnapshot = $state({
		rows: [],
		total: 0,
		newThisMonth: 0,
		loaded: false,
		refreshing: false,
		refreshedAt: 0,
		requestKey: ''
	});
	const nativeCompanionMode = browser && isNativeApp();
	const USER_SCOPED_STATE_EVENT = 'gyc:user-scoped-state-updated';
	const PLAN_MARKET_SNAPSHOT_CACHE_KEY = 'gycPlanMarketSnapshot';
	const PLAN_MARKET_SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1000;
	let wizardStep = $state(0);
	let wizardData = $state(normalizeWizardData({}));
	let wizardRenderKey = $state(0);
	let planConfirmDialog = $state(null);
	let planConfirmError = $state('');
	let planResetting = $state(false);
	let wizardRef = $state();
	const hasSavedPlanProgress = $derived.by(() => hasSavedWizardProgress(wizardData, portfolioPlan));
	const portfolioView = $derived.by(() =>
		buildInvestedPortfolio({
			stageMap: $dealStages || {},
			deals: $deals || [],
			portfolio: portfolioDetails
		})
	);
	const portfolio = $derived.by(() => portfolioView.entries);

	const canViewAnalytics = $derived($isMember);
	const canViewFullPlan = $derived($canBuildFullPlan);
	const hasInvestorProfile = $derived.by(() =>
		Boolean(
			wizardData._branch ||
			wizardData.goal ||
			wizardData.dealExperience !== undefined ||
			wizardData.lpDealsCount !== undefined ||
			parseDollar(wizardData.baselineIncome) > 0 ||
			(wizardData.assetClasses || []).length > 0 ||
			(wizardData.strategies || []).length > 0
		)
	);
	const showInlineWizard = $derived.by(() =>
		canViewFullPlan ? showWizard || !hasSavedPlanProgress : showWizard || !hasInvestorProfile
	);
	const inlineWizardTitle = $derived(
		canViewFullPlan ? 'Build Your Plan' : 'Set Up Your Investor Profile'
	);
	const inlineWizardCopy = $derived(
		canViewFullPlan
			? 'Complete your thesis, roadmap, and next-best-move setup without leaving the app shell.'
			: 'Save your goal, experience, and deal preferences without leaving the app shell.'
	);
	const showInlineWizardBackAction = $derived(
		canViewFullPlan ? hasSavedPlanProgress : hasInvestorProfile
	);
	const inlineWizardFlowKey = $derived(canViewFullPlan ? wizardFlowKey : 'free');
	const inlineWizardBranch = $derived.by(
		() => wizardBranch || String(wizardData._branch || wizardData.branch || '')
	);

	const goalLabels = {
		cashflow: 'Build Passive Income',
		growth: 'Build Long-Term Wealth',
		tax: 'Reduce Taxable Income'
	};

	const assetClassOptions = [
		'Single Family',
		'Hotels/Hospitality',
		'Business / Other',
		'RV/Mobile Home Parks',
		'Private Debt / Credit',
		'Self Storage',
		'Multi-Family',
		'Retail',
		'Lease Buy Back',
		'Oil & Gas'
	];

	const dealTypeOptions = [
		'Lending / Credit',
		'Buy & Hold',
		'Distressed',
		'Value-Add',
		'Single Family',
		'Hotels/Hospitality',
		'Business / Other',
		'RV/Mobile Home Parks'
	];

	const stepTitles = [
		'What is your primary goal?',
		'Set your target',
		'How much can you invest?',
		'Which asset classes interest you?',
		'What deal types do you prefer?',
		'Review your plan'
	];

	const capitalOptions = [
		{ label: 'Under $100K', value: '0-100000' },
		{ label: '$100K - $250K', value: '100000-250000' },
		{ label: '$250K - $500K', value: '250000-500000' },
		{ label: '$500K - $1M', value: '500000-1000000' },
		{ label: '$1M+', value: '1000000-5000000' }
	];

	const assetProfiles = {
		'singlefamily': { label: 'Single Family', color: '#0f7a5b', icon: 'SF', irrMin: 8.1, irrMax: 33.8, cashYield: 12.7, lockup: 2.4, dealCount: 14, newestDays: 8 },
		'hotelshospitality': { label: 'Hotels/Hospitality', color: '#5b50d6', icon: 'HH', irrMin: 18.0, irrMax: 33.1, cashYield: 12.9, lockup: 5.1, dealCount: 13, newestDays: 30 },
		'businessother': { label: 'Business / Other', color: '#7b5a46', icon: 'BO', irrMin: 4.0, irrMax: 45.0, cashYield: 16.9, lockup: 3.7, dealCount: 17, newestDays: 5 },
		'rvmobilehomeparks': { label: 'RV/Mobile Home Parks', color: '#127c4e', icon: 'RV', irrMin: 15.9, irrMax: 45.7, cashYield: 10.5, lockup: 6.0, dealCount: 16, newestDays: 29 },
		'privatedebtcredit': { label: 'Private Debt / Credit', color: '#2563eb', icon: 'PD', irrMin: 6.0, irrMax: 25.0, cashYield: 11.4, lockup: 1.5, dealCount: 106, newestDays: 5 },
		'lending': { label: 'Private Debt / Credit', color: '#2563eb', icon: 'PD', irrMin: 6.0, irrMax: 25.0, cashYield: 11.4, lockup: 1.5, dealCount: 106, newestDays: 5 },
		'selfstorage': { label: 'Self Storage', color: '#3b82f6', icon: 'SS', irrMin: 10.2, irrMax: 24.3, cashYield: 9.2, lockup: 4.2, dealCount: 22, newestDays: 11 },
		'multifamily': { label: 'Multi-Family', color: '#f59e0b', icon: 'MF', irrMin: 11.8, irrMax: 22.4, cashYield: 8.4, lockup: 4.6, dealCount: 34, newestDays: 9 },
		'retail': { label: 'Retail', color: '#ef4444', icon: 'RT', irrMin: 9.4, irrMax: 19.5, cashYield: 8.7, lockup: 4.8, dealCount: 9, newestDays: 16 },
		'leasebuyback': { label: 'Lease Buy Back', color: '#8b5cf6', icon: 'LB', irrMin: 10.1, irrMax: 17.8, cashYield: 10.1, lockup: 3.2, dealCount: 6, newestDays: 22 },
		'oilgas': { label: 'Oil & Gas', color: '#ec4899', icon: 'OG', irrMin: 14.2, irrMax: 31.0, cashYield: 13.1, lockup: 4.0, dealCount: 7, newestDays: 18 }
	};

	const goalDefaults = {
		cashflow: ['Single Family', 'Hotels/Hospitality', 'Business / Other', 'RV/Mobile Home Parks', 'Private Debt / Credit'],
		growth: ['Multi-Family', 'Self Storage', 'Hotels/Hospitality', 'Retail'],
		tax: ['Oil & Gas', 'Multi-Family', 'RV/Mobile Home Parks', 'Private Debt / Credit']
	};

	function normalizeAssetKey(value) {
		return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	}

	function getAssetProfile(value) {
		const normalized = normalizeAssetKey(value);
		return assetProfiles[normalized] || {
			label: value || 'Other',
			color: '#51BE7B',
			icon: String(value || 'OT').slice(0, 2).toUpperCase(),
			irrMin: 8,
			irrMax: 18,
			cashYield: 9.5,
			lockup: 4.0,
			dealCount: 12,
			newestDays: 14
		};
	}

	function currency(value) {
		return `$${Math.round(value || 0).toLocaleString()}`;
	}

	function compactCurrency(value) {
		const amount = Number(value) || 0;
		if (amount >= 1000000) return `$${(amount / 1000000).toFixed(1)}M`;
		if (amount >= 1000) return `$${Math.round(amount / 1000)}K`;
		return currency(amount);
	}

	function percent(value, digits = 1) {
		return `${Number(value || 0).toFixed(digits)}%`;
	}

	function parseCapitalRange(value) {
		if (!value) return 0;
		if (typeof value === 'number') return value;
		const numbers = String(value)
			.split('-')
			.map((part) => parseInt(part.replace(/[^0-9]/g, ''), 10))
			.filter((part) => Number.isFinite(part));
		if (numbers.length === 0) return 0;
		if (numbers.length === 1) return numbers[0];
		return Math.round((numbers[0] + numbers[1]) / 2);
	}

	function estimateCheckSize(rangeValue) {
		const midpoint = parseCapitalRange(rangeValue);
		if (midpoint >= 1000000) return 250000;
		if (midpoint >= 500000) return 150000;
		if (midpoint >= 250000) return 125000;
		if (midpoint >= 100000) return 100000;
		if (midpoint > 0) return 50000;
		return 100000;
	}

	function targetDisplay(goal, amount) {
		if (goal === 'growth') return `Build ${currency(amount)} in portfolio value`;
		if (goal === 'tax') return `Offset ${currency(amount)}/yr in taxable income`;
		return `Build ${currency(amount)}/yr in passive income`;
	}

	function defaultAnnualTarget(goal) {
		if (goal === 'growth') return 1000000;
		if (goal === 'tax') return 100000;
		return 100000;
	}

	function titleCaseList(items = []) {
		if (!items.length) return '';
		if (items.length === 1) return items[0];
		if (items.length === 2) return `${items[0]} and ${items[1]}`;
		return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
	}

	function plainSegment(text) {
		return text ? [{ text, emphasis: false }] : [];
	}

	function emphasisSegment(text) {
		return text ? [{ text, emphasis: true }] : [];
	}

	function listSegments(items = []) {
		const filtered = items.filter(Boolean);
		return filtered.flatMap((item, index) => {
			const segments = [];
			if (index > 0) {
				segments.push({
					text: filtered.length === 2 ? ' and ' : index === filtered.length - 1 ? ', and ' : ', ',
					emphasis: false
				});
			}
			segments.push({ text: item, emphasis: true });
			return segments;
		});
	}

	function percentNumber(value) {
		const amount = Number(value || 0);
		if (!Number.isFinite(amount) || amount <= 0) return 0;
		return amount <= 1 ? amount * 100 : amount;
	}

	function average(values = []) {
		const valid = values.map((value) => Number(value)).filter((value) => Number.isFinite(value) && value > 0);
		if (valid.length === 0) return 0;
		return valid.reduce((sum, value) => sum + value, 0) / valid.length;
	}

	function formatLongDate(value) {
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return new Intl.DateTimeFormat('en-US', {
			month: 'long',
			day: 'numeric',
			year: 'numeric'
		}).format(date);
	}

	function formatMonthYear(value) {
		const date = value instanceof Date ? value : new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return new Intl.DateTimeFormat('en-US', {
			month: 'short',
			year: 'numeric'
		}).format(date);
	}

	function firstDefined(...values) {
		return values.find((value) => value !== null && value !== undefined && value !== '');
	}

	function dealMinimum(deal) {
		return Number(
			firstDefined(
				deal?.investmentMinimum,
				deal?.investment_minimum,
				deal?.minimumInvestment,
				deal?.minimum_investment,
				deal?.minimum
			) || 0
		);
	}

	function createEmptyMarketSnapshot(requestKey = '') {
		return {
			rows: [],
			total: 0,
			newThisMonth: 0,
			loaded: false,
			refreshing: false,
			refreshedAt: 0,
			requestKey
		};
	}

	function buildMarketSnapshotRequestKey(assets = [], checkSize = 0) {
		const normalizedAssets = [...new Set((assets || []).map((asset) => normalizeAssetKey(asset)).filter(Boolean))];
		return JSON.stringify({
			assets: normalizedAssets,
			checkSize: Number(checkSize || 0)
		});
	}

	function readCachedMarketSnapshot(requestKey) {
		if (!browser || !requestKey) return null;
		const cache = readScopedJson(PLAN_MARKET_SNAPSHOT_CACHE_KEY, {});
		const cached = cache?.[requestKey];
		if (!cached) return null;
		return {
			rows: Array.isArray(cached.rows) ? cached.rows : [],
			total: Number(cached.total || 0),
			newThisMonth: Number(cached.newThisMonth || 0),
			loaded: true,
			refreshing: false,
			refreshedAt: Number(cached.refreshedAt || 0),
			requestKey
		};
	}

	function writeCachedMarketSnapshot(requestKey, snapshot) {
		if (!browser || !requestKey) return;
		const cache = readScopedJson(PLAN_MARKET_SNAPSHOT_CACHE_KEY, {});
		writeScopedJson(PLAN_MARKET_SNAPSHOT_CACHE_KEY, {
			...cache,
			[requestKey]: {
				rows: snapshot.rows || [],
				total: snapshot.total || 0,
				newThisMonth: snapshot.newThisMonth || 0,
				refreshedAt: snapshot.refreshedAt || Date.now()
			}
		});
	}

	function isMarketSnapshotFresh(snapshot) {
		return Boolean(snapshot?.refreshedAt) && Date.now() - snapshot.refreshedAt < PLAN_MARKET_SNAPSHOT_MAX_AGE_MS;
	}

	function dealTargetIrrPct(deal) {
		return percentNumber(firstDefined(deal?.targetIRR, deal?.target_irr));
	}

	function dealCashYieldPct(deal) {
		return percentNumber(
			firstDefined(
				deal?.cashYield,
				deal?.cash_yield,
				deal?.cashOnCash,
				deal?.cash_on_cash,
				deal?.preferredReturn,
				deal?.preferred_return
			)
		);
	}

	function dealAgeInDays(deal) {
		const raw = firstDefined(
			deal?.publishedAt,
			deal?.published_at,
			deal?.addedDate,
			deal?.added_date,
			deal?.createdAt,
			deal?.created_at
		);
		if (!raw) return null;
		const date = new Date(raw);
		if (Number.isNaN(date.getTime())) return null;
		return Math.max(0, Math.round((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24)));
	}

	function computeMarketSnapshotFromDeals(assets = [], checkSize = 0, dealsList = []) {
		const activeDeals = (dealsList || []).filter((deal) => {
			const status = String(deal?.status || '').trim().toLowerCase();
			return !['closed', 'fully funded', 'completed', 'archived'].includes(status);
		});

		const rows = assets.slice(0, 5).map((asset) => {
			const profile = getAssetProfile(asset);
			const matchingDeals = activeDeals.filter((deal) => assetChoiceMatchesDeal(asset, deal));
			const affordableDeals = matchingDeals.filter((deal) => {
				const minimum = dealMinimum(deal);
				return minimum <= 0 || Number(checkSize || 0) <= 0 || minimum <= Number(checkSize || 0);
			});
			const matchedDeals = Number(checkSize || 0) > 0 ? affordableDeals : matchingDeals;
			const irrValues = matchedDeals.map((deal) => dealTargetIrrPct(deal)).filter((value) => value > 0);
			const yieldValues = matchedDeals.map((deal) => dealCashYieldPct(deal)).filter((value) => value > 0);
			const minimums = matchedDeals.map((deal) => dealMinimum(deal)).filter((value) => value > 0);
			const ageValues = matchedDeals.map((deal) => dealAgeInDays(deal)).filter((value) => value !== null);

			return {
				label: profile.label,
				color: profile.color,
				icon: profile.icon,
				assetClass: profile.label,
				count: matchedDeals.length,
				irrMin: irrValues.length ? Math.min(...irrValues) : profile.irrMin,
				irrMax: irrValues.length ? Math.max(...irrValues) : profile.irrMax,
				avgCoC: yieldValues.length ? average(yieldValues) : profile.cashYield,
				avgMinimum: minimums.length ? Math.round(average(minimums)) : 0,
				affordableCount: Number(checkSize || 0) > 0 ? affordableDeals.length : null,
				newThisMonth: matchedDeals.filter((deal) => {
					const age = dealAgeInDays(deal);
					return age !== null && age <= 30;
				}).length,
				newestDays: ageValues.length ? Math.min(...ageValues) : profile.newestDays
			};
		});

		return {
			rows,
			total: rows.reduce((sum, row) => sum + row.count, 0),
			newThisMonth: rows.reduce((sum, row) => sum + row.newThisMonth, 0),
			refreshedAt: Date.now()
		};
	}

	function hasLocalPlanContent(snapshot = {}) {
		const localWizardData = normalizeWizardData(snapshot.buyBoxWizard || {});
		const localPortfolioPlan = snapshot.portfolioPlan || null;
		if (hasCompletedPlan(localWizardData, localPortfolioPlan)) return true;
		return Boolean(
			localWizardData._branch ||
			localWizardData.goal ||
			localWizardData.dealExperience !== undefined ||
			localWizardData.lpDealsCount !== undefined ||
			parseDollar(localWizardData.baselineIncome) > 0 ||
			(localWizardData.assetClasses || []).length > 0 ||
			(localWizardData.strategies || []).length > 0
		);
	}

	function isLendingLike(value) {
		const normalized = normalizeAssetKey(value);
		return ['lending', 'debt', 'credit', 'privatedebtcredit'].some((token) => normalized.includes(token));
	}

	function assetChoiceMatchesDeal(asset, deal) {
		const choice = normalizeAssetKey(asset);
		const assetClass = normalizeAssetKey(deal?.assetClass || deal?.asset_class || '');
		const strategy = normalizeAssetKey(deal?.strategy || deal?.dealType || deal?.deal_type || '');
		if (!choice) return false;
		if (isLendingLike(choice)) {
			return isLendingLike(assetClass) || isLendingLike(strategy);
		}
		return assetClass === choice;
	}

	function investmentAnnualIncomeEstimate(investment) {
		const amount = Number(investment?.amountInvested || 0);
		if (!amount) return 0;
		const target = percentNumber(investment?.targetIRR);
		if (target > 0) return Math.round(amount * (target / 100));
		const profile = getAssetProfile(investment?.assetClass || 'Other');
		return Math.round(amount * ((profile.cashYield || 0) / 100));
	}

	function getInvestmentYear(investment, fallbackYear = currentYearNumber()) {
		if (!investment?.dateInvested) return fallbackYear;
		const date = new Date(investment.dateInvested);
		return Number.isNaN(date.getTime()) ? fallbackYear : date.getFullYear();
	}

	function investmentTaxOffsetEstimate(investment) {
		const directEstimate = Number(
			investment?.actualYear1Depreciation ??
			investment?.displayYear1Depreciation ??
			investment?.projectedYear1DepreciationValue ??
			0
		);
		if (Number.isFinite(directEstimate) && directEstimate > 0) return Math.round(directEstimate);
		const amount = Number(investment?.amountInvested || 0);
		return amount > 0 ? Math.round(amount * 0.18) : 0;
	}

	function metricGrowthRatePct(assetClass, targetIRR) {
		const target = percentNumber(targetIRR);
		if (target > 0) return target;
		const profile = getAssetProfile(assetClass || 'Other');
		return (profile.irrMin + profile.irrMax) / 2 || 12;
	}

	function investmentGrowthValueEstimate(investment, year) {
		const amount = Number(investment?.amountInvested || 0);
		if (!amount) return 0;
		const investYear = getInvestmentYear(investment, year);
		const yearsHeld = Math.max(0, year - investYear);
		const annualRate = metricGrowthRatePct(investment?.assetClass, investment?.targetIRR) / 100;
		return Math.round(amount * Math.pow(1 + annualRate, yearsHeld));
	}

	function modeledSlotGrowthValueEstimate(slot, year) {
		const amount = Number(slot?.checkSize || 0);
		if (!amount) return 0;
		const yearsHeld = Math.max(0, year - Number(slot?.year || year));
		const annualRate = metricGrowthRatePct(slot?.assetClass, slot?.irrPct) / 100;
		return Math.round(amount * Math.pow(1 + annualRate, yearsHeld));
	}

	function buildAllocationSegments(allocations = {}) {
		return Object.entries(allocations)
			.filter(([, amount]) => Number(amount) > 0)
			.map(([label, amount]) => ({
				label,
				amount,
				color: getAssetProfile(label).color
			}))
			.sort((left, right) => right.amount - left.amount);
	}

	function currentYearNumber() {
		return new Date().getFullYear();
	}

	function getTargetLabel() {
		if (wizardData.goal === 'cashflow') return 'Target Annual Passive Income ($)';
		if (wizardData.goal === 'growth') return 'Target Portfolio Value ($)';
		if (wizardData.goal === 'tax') return 'Annual Taxable Income to Offset ($)';
		return 'Target Amount ($)';
	}

	function getTargetHint() {
		const value = Number(wizardData.targetAmount || 0);
		if (!value) return '';
		if (wizardData.goal === 'cashflow') {
			const needed = Math.round(value / 0.1);
			return `At roughly 10% cash yield, that usually means building about ${currency(needed)} of deployed capital.`;
		}
		if (wizardData.goal === 'growth') {
			return 'This becomes the target line used in your projection bars and year-by-year plan.';
		}
		if (wizardData.goal === 'tax') {
			return 'Tax-focused plans prioritize depreciation-heavy and offset-friendly deal types.';
		}
		return '';
	}

	function toggleAssetClass(assetClass) {
		if (wizardData.assetClasses.includes(assetClass)) {
			wizardData.assetClasses = wizardData.assetClasses.filter((value) => value !== assetClass);
		} else {
			wizardData.assetClasses = [...wizardData.assetClasses, assetClass];
		}
	}

	function toggleDealType(dealType) {
		if (wizardData.dealTypes.includes(dealType)) {
			wizardData.dealTypes = wizardData.dealTypes.filter((value) => value !== dealType);
		} else {
			wizardData.dealTypes = [...wizardData.dealTypes, dealType];
		}
	}

	function selectGoal(goal) {
		wizardData.goal = goal;
		if (wizardData.assetClasses.length === 0) {
			wizardData.assetClasses = [...(goalDefaults[goal] || goalDefaults.cashflow).slice(0, 4)];
		}
		if (wizardData.dealTypes.length === 0) {
			wizardData.dealTypes = goal === 'cashflow'
				? ['Lending / Credit', 'Buy & Hold', 'Distressed']
				: goal === 'growth'
					? ['Value-Add', 'Buy & Hold', 'Distressed']
					: ['Lending / Credit', 'Value-Add'];
		}
		wizardStep = 1;
	}

	function nextStep() {
		if (wizardStep < stepTitles.length - 1) wizardStep += 1;
	}

	function prevStep() {
		if (wizardStep > 0) wizardStep -= 1;
	}

	function readWizardRouteState() {
		if (!browser) {
			return {
				shouldOpen: false,
				stage: '',
				branch: '',
				flowKey: '',
				forceEdit: false
			};
		}
		const params = new URLSearchParams(window.location.search);
		const hash = window.location.hash.replace('#', '').toLowerCase();
		const forceEdit = ['1', 'true', 'yes'].includes((params.get('edit') || '').toLowerCase());
		return {
			shouldOpen:
				forceEdit ||
			['1', 'true', 'yes'].includes((params.get('wizard') || '').toLowerCase()) ||
			Boolean(params.get('stage')) ||
			Boolean(params.get('flow')) ||
			hash === 'edit' ||
			hash === 'buybox',
			stage: params.get('stage') || '',
			branch: params.get('branch') || '',
			flowKey: params.get('flow') || '',
			forceEdit
		};
	}

	function syncWizardRouteFromLocation() {
		const routeState = readWizardRouteState();
		shouldOpenWizardFromLocation = routeState.shouldOpen;
		wizardStage = routeState.stage;
		wizardBranch = routeState.branch;
		wizardFlowKey = routeState.flowKey;
		wizardForceEdit = routeState.forceEdit;
		showWizard = routeState.shouldOpen;
	}

	function hasPassiveWizardRouteIntent() {
		if (!browser) return false;
		const params = new URLSearchParams(window.location.search);
		const hash = window.location.hash.replace('#', '').toLowerCase();
		if (wizardForceEdit) return false;
		if (['1', 'true', 'yes'].includes((params.get('wizard') || '').toLowerCase())) return false;
		if (hash === 'edit' || hash === 'buybox') return false;
		return Boolean(params.get('stage') || params.get('flow') || params.get('branch'));
	}

	function dismissPassiveWizardRouteIfPlanExists(snapshot = getUserScopedCacheSnapshot()) {
		if (!browser || !hasPassiveWizardRouteIntent()) return;
		const localWizardData = normalizeWizardData(snapshot.buyBoxWizard || {});
		const localPortfolioPlan = snapshot.portfolioPlan || null;
		if (!hasCompletedPlan(localWizardData, localPortfolioPlan)) return;
		showWizard = false;
		goto('/app/plan', { replaceState: true, noScroll: true, keepFocus: true }).catch(() => {});
	}

	function resolveWizardBranch() {
		const branch = String(plan?._branch || wizardData._branch || wizardData.branch || '').toLowerCase();
		return ['cashflow', 'growth', 'tax'].includes(branch) ? branch : 'cashflow';
	}

	function buildWizardUrl({ step = STEP.GOAL, branch = '', flowKey = '', editMode = false } = {}) {
		const stage = stageSlugForStep(step);
		const params = new URLSearchParams();
		if (stage) params.set('stage', stage);
		if (flowKey) params.set('flow', flowKey);
		if (branch) params.set('branch', branch);
		if (editMode) params.set('edit', '1');
		const query = params.toString();
		return query ? `/app/plan?${query}` : '/app/plan';
	}

	async function navigateWizardStep(
		step,
		{ branch = '', flowKey = '', editMode = false, replaceState = false } = {}
	) {
		const nextFlowKey = canViewFullPlan ? flowKey : 'free';
		const nextBranch = canViewFullPlan ? branch : branch || String(wizardData._branch || wizardData.branch || '');
		const nextEditMode = canViewFullPlan ? editMode : false;
		const url = buildWizardUrl({ step, branch: nextBranch, flowKey: nextFlowKey, editMode: nextEditMode });
		wizardStage = stageSlugForStep(step);
		wizardBranch = nextBranch;
		wizardFlowKey = nextFlowKey;
		wizardForceEdit = nextEditMode;
		showWizard = true;
		if (browser) {
			const historyMethod = replaceState ? 'replaceState' : 'pushState';
			window.history[historyMethod](window.history.state, '', url);
			syncWizardRouteFromLocation();
			return;
		}
		await goto(url, { replaceState, noScroll: true, keepFocus: true });
	}

	function clearLocalPlanState() {
		wizardData = normalizeWizardData({});
		plan = wizardData;
		portfolioPlan = null;
		hasPlan = false;
		writeUserScopedJson('gycBuyBox', null);
		writeUserScopedJson('gycBuyBoxWizard', null);
		writeUserScopedString('gycBuyBoxComplete', '');
		writeUserScopedJson('gycGoals', null);
		writeUserScopedJson('gycPortfolioPlan', null);
		if (browser) {
			window.dispatchEvent(new CustomEvent(USER_SCOPED_STATE_EVENT));
		}
	}

	async function expectResetResponse(response, label) {
		if (response.ok) return;
		let detail = '';
		try {
			detail = await response.text();
		} catch {
			detail = '';
		}
		const suffix = detail ? ` ${detail}` : '';
		throw new Error(`${label} failed: ${response.status}${suffix}`);
	}

	async function resetPersistedPlanState() {
		const stored = browser ? getStoredSessionUser() : null;
		if (!stored?.token) {
			clearLocalPlanState();
			return;
		}

		const realUser = currentAdminRealUser();
		const isAdminImpersonation =
			!!realUser?.email &&
			realUser.email.toLowerCase() !== String(stored.email || '').toLowerCase();
		const authHeaders = {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${stored.token}`
		};
		const adminPayload = isAdminImpersonation ? { admin: true, email: stored.email } : {};

		const buyBoxResponse = await fetch('/api/buybox', {
			method: 'DELETE',
			headers: authHeaders,
			body: JSON.stringify(adminPayload)
		});
		await expectResetResponse(buyBoxResponse, 'buybox reset');

		const goalsResponse = await fetch('/api/userdata', {
			method: 'POST',
			headers: authHeaders,
			body: JSON.stringify({
				type: 'goals',
				data: {
					goal_type: '',
					current_income: null,
					target_income: null,
					capital_available: null,
					timeline: '',
					tax_reduction: null
				},
				...adminPayload
			})
		});
		await expectResetResponse(goalsResponse, 'goals reset');

		const planResponse = await fetch('/api/userdata', {
			method: 'POST',
			headers: authHeaders,
			body: JSON.stringify({
				type: 'plan',
				data: {
					total_capital: 0,
					check_size: 100000,
					target_annual_income: null,
					target_irr: null,
					target_tax_offset: null,
					buckets: [],
					generated_from: 'wizard'
				},
				...adminPayload
			})
		});
		await expectResetResponse(planResponse, 'plan reset');

		clearLocalPlanState();
	}

	async function startFreshPlan() {
		await resetPersistedPlanState();
		wizardRenderKey += 1;
		await navigateWizardStep(STEP.GOAL, {
			branch: '',
			flowKey: 'free',
			editMode: false,
			replaceState: true
		});
	}

	function openPlanReview() {
		const branch = resolveWizardBranch();
		return navigateWizardStep(STEP.PROFILE_REVIEW, {
			branch,
			flowKey: getBranchFlowKey(branch),
			editMode: true
		});
	}

	function openPlanEditor() {
		const branch = resolveWizardBranch();
		return navigateWizardStep(STEP.PLAN, {
			branch,
			flowKey: getBranchFlowKey(branch),
			editMode: true
		});
	}

	function openInvestorProfile() {
		return navigateWizardStep(STEP.GOAL, {
			branch: String(wizardData._branch || wizardData.branch || ''),
			flowKey: 'free',
			editMode: false
		});
	}

	async function closeWizard() {
		if (wizardRef?.persistProgress || wizardRef?.persistExitState) {
			try {
				if (canViewFullPlan && wizardRef?.persistExitState) {
					await wizardRef.persistExitState();
				} else if (wizardRef?.persistProgress) {
					await wizardRef.persistProgress();
				}
			} catch (error) {
				console.warn('Failed to persist wizard state before closing:', error);
			}
		}
		showWizard = false;
		wizardStage = '';
		wizardBranch = '';
		wizardFlowKey = '';
		wizardForceEdit = false;
		await goto('/app/plan', { noScroll: true, keepFocus: true });
	}

	function openStartOverConfirmation() {
		planConfirmError = '';
		planConfirmDialog = {
			kind: 'start-over',
			title: 'Start over?',
			body: 'This will clear your current in-progress plan inputs and take you back to the beginning.',
			confirmLabel: 'Start Over'
		};
	}

	function openNewPlanConfirmation() {
		planConfirmError = '';
		planConfirmDialog = {
			kind: 'new-plan',
			title: 'Create a new plan?',
			body: 'This app currently supports one active plan. Creating a new plan will clear your current plan inputs and start a fresh replacement plan from the beginning.',
			confirmLabel: 'Create New Plan'
		};
	}

	function closePlanConfirmation() {
		if (planResetting) return;
		planConfirmError = '';
		planConfirmDialog = null;
	}

	async function confirmPlanReset() {
		if (!planConfirmDialog || planResetting) return;
		planResetting = true;
		planConfirmError = '';
		try {
			await startFreshPlan();
			planConfirmDialog = null;
		} catch (error) {
			console.warn('Failed to reset plan state:', error);
			planConfirmError = 'Could not reset the plan right now. Please try again.';
		} finally {
			planResetting = false;
		}
	}

	function syncWizardView(detail = {}) {
		const nextWizard = normalizeWizardData(detail.wizardData || wizardData || {});
		wizardData = nextWizard;
		plan = nextWizard;
		if (detail.portfolioPlan) {
			portfolioPlan = detail.portfolioPlan;
			if (detail.persistedPortfolioPlan) {
				writeUserScopedJson('gycPortfolioPlan', detail.portfolioPlan);
			}
		}
		hasPlan = hasCompletedPlan(nextWizard, detail.portfolioPlan || portfolioPlan);
	}

	function handleWizardState(event) {
		syncWizardView(event.detail || {});
	}

	function handleWizardComplete(event) {
		syncWizardView(event.detail || {});
		showWizard = false;
		if (event.detail?.redirectTo) {
			goto(event.detail.redirectTo);
		}
	}

	async function savePlan() {
		saving = true;
		saveMsg = '';
		const stored = browser ? getStoredSessionUser() : null;
		const payload = {
			goal: goalLabels[wizardData.goal] || wizardData.goal,
			targetIncome: wizardData.goal === 'cashflow' ? wizardData.targetAmount : undefined,
			targetGrowth: wizardData.goal === 'growth' ? wizardData.targetAmount : undefined,
			targetTaxSavings: wizardData.goal === 'tax' ? wizardData.targetAmount : undefined,
			investableCapital: wizardData.investableCapital,
			assetClasses: wizardData.assetClasses,
			dealTypes: wizardData.dealTypes,
			_branch: wizardData.goal
		};

		if (browser) {
			writeUserScopedJson('gycBuyBoxWizard', payload);
			writeUserScopedString('gycBuyBoxComplete', 'true');
		}

		try {
			if (stored?.email && stored?.token) {
				const realUser = currentAdminRealUser();
				const isAdminImpersonation = !!realUser?.email && realUser.email.toLowerCase() !== stored.email.toLowerCase();
				const response = await fetch('/api/buybox', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${stored.token}`
					},
					body: JSON.stringify({
						email: stored.email,
						wizardData: payload,
						...(isAdminImpersonation ? { admin: true } : {})
					})
				});
				saveMsg = response.ok ? 'Plan saved' : 'Saved locally (sync pending)';
			} else {
				saveMsg = 'Plan saved locally';
			}
		} catch (error) {
			console.warn('Buy box save failed:', error);
			saveMsg = 'Saved locally (sync pending)';
		}

		plan = payload;
		hasPlan = true;
		showWizard = false;
		saving = false;
		setTimeout(() => {
			saveMsg = '';
		}, 3000);
	}

	function syncPlanState() {
		if (!browser) return;
		const snapshot = getUserScopedCacheSnapshot();
		portfolioDetails = snapshot.portfolio;
		reportUser = getStoredSessionUser();
		portfolioPlan = snapshot.portfolioPlan;
		wizardData = normalizeWizardData(snapshot.buyBoxWizard || {});
		plan = wizardData;
		hasPlan = hasCompletedPlan(wizardData, portfolioPlan);
	}

	function printPlan() {
		if (browser) window.print();
	}

	const goalKey = $derived.by(() => plan?._branch || wizardData.goal || 'cashflow');
	const selectedAssets = $derived.by(() => {
		const assets = plan?.assetClasses || wizardData.assetClasses || [];
		return assets.length ? assets : [...(goalDefaults[goalKey] || goalDefaults.cashflow)];
	});
	const selectedStrategies = $derived.by(() => plan?.dealTypes || plan?.strategies || wizardData.dealTypes || []);
	const annualTargetAmount = $derived.by(() => {
		const raw = Number(plan?.targetIncome || plan?.targetGrowth || plan?.targetTaxSavings || wizardData.targetAmount || 0);
		if (!raw) return defaultAnnualTarget(goalKey);
		return raw;
	});
	const reportUserName = $derived.by(() => reportUser?.fullName || reportUser?.name || reportUser?.email || 'Grow Your Cashflow Member');
	const preparedOn = $derived(formatLongDate(new Date()));
	const plannedCheckSize = $derived.by(() =>
		Number(portfolioPlan?.check_size || portfolioPlan?.checkSize || estimateCheckSize(plan?.investableCapital || wizardData.investableCapital) || 0)
	);
	const currentInvestedTotal = $derived(portfolio.reduce((sum, investment) => sum + (parseFloat(investment.amountInvested) || 0), 0));
	const currentInvestmentCount = $derived(portfolio.length);
	const targetBadge = $derived.by(() => {
		if (goalKey === 'growth') return 'LONG-TERM GROWTH';
		if (goalKey === 'tax') return 'TAX EFFICIENCY';
		return 'CASH FLOW';
	});
	const targetHeadline = $derived(targetDisplay(goalKey, annualTargetAmount));
	const targetLabel = $derived('Thesis');
	const planThesisSegments = $derived.by(() => {
		const assetLabels = selectedAssets.slice(0, 5).map((asset) => getAssetProfile(asset).label);
		const strategyLabels = (
			selectedStrategies.length ? selectedStrategies : ['Lending / Credit', 'Buy & Hold', 'Distressed']
		).slice(0, 4);

		if (goalKey === 'growth') {
			return [
				...plainSegment('I want to compound capital through '),
				...listSegments(assetLabels),
				...plainSegment(', using '),
				...listSegments(strategyLabels),
				...plainSegment(' strategies, with a bias toward durable sponsors, steady reinvestment, and long-term upside.')
			];
		}

		if (goalKey === 'tax') {
			return [
				...plainSegment('I want to target '),
				...listSegments(assetLabels),
				...plainSegment(', using '),
				...listSegments(strategyLabels),
				...plainSegment(' structures, with a focus on depreciation, efficient capital placement, and offset-friendly cash flow.')
			];
		}

		return [
			...plainSegment('I invest in '),
			...listSegments(assetLabels),
			...plainSegment(', using '),
			...listSegments(strategyLabels),
			...plainSegment(' strategies, writing '),
			...emphasisSegment(currency(plannedCheckSize)),
			...plainSegment(' checks, targeting '),
			...emphasisSegment('quarterly or better'),
			...plainSegment(' distributions.')
		];
	});

	const snapshotRows = $derived.by(() =>
		selectedAssets.slice(0, 5).map((asset) => {
			const profile = getAssetProfile(asset);
			return {
				...profile,
				newThisMonth: Math.max(1, Math.round(profile.dealCount * 0.12))
			};
		})
	);
	const totalMatches = $derived(snapshotRows.reduce((sum, row) => sum + row.dealCount, 0));
	const totalNewMatches = $derived(snapshotRows.reduce((sum, row) => sum + row.newThisMonth, 0));
	const wantsLendingSnapshot = $derived.by(() =>
		selectedStrategies.some((strategy) => isLendingLike(strategy))
	);
	const reportRelevantAssets = $derived.by(() => {
		const assets = [...selectedAssets];
		if (wantsLendingSnapshot && !assets.some((asset) => isLendingLike(asset))) {
			assets.push('Lending');
		}
		return [...new Set(assets)].slice(0, 5);
	});
	const planMarketSnapshotKey = $derived.by(() =>
		buildMarketSnapshotRequestKey(reportRelevantAssets, plannedCheckSize)
	);
	const reportSnapshotRows = $derived.by(() => {
		const fallbackRows = snapshotRows.map((row) => ({
			label: row.label,
			color: row.color,
			icon: row.icon,
			count: row.dealCount,
			irrMin: row.irrMin,
			irrMax: row.irrMax,
			avgCoC: row.cashYield,
			avgMinimum: plannedCheckSize ? Math.round(plannedCheckSize * 1.35) : 0,
			affordableCount: plannedCheckSize ? Math.max(1, Math.round(row.dealCount * 0.45)) : null
		}));
		const snapshotByAsset = new Map(
			(marketSnapshot.rows || []).map((row) => [normalizeAssetKey(row.assetClass), row])
		);
		if (snapshotByAsset.size === 0) return fallbackRows;

		const rows = reportRelevantAssets.map((asset) => {
			const profile = getAssetProfile(asset);
			const snapshot = snapshotByAsset.get(normalizeAssetKey(asset));
			if (!snapshot) return null;

			return {
				label: profile.label,
				color: profile.color,
				icon: profile.icon,
				count: snapshot.count || 0,
				irrMin: snapshot.irrMin ?? profile.irrMin,
				irrMax: snapshot.irrMax ?? profile.irrMax,
				avgCoC: snapshot.avgCoC ?? profile.cashYield,
				avgMinimum: snapshot.avgMinimum || 0,
				affordableCount: snapshot.affordableCount ?? null
			};
		}).filter(Boolean);

		return rows.length ? rows : fallbackRows;
	});
	const reportMatchTotal = $derived.by(() =>
		marketSnapshot.loaded ? marketSnapshot.total : totalMatches
	);
	const reportNewThisMonth = $derived.by(() =>
		marketSnapshot.loaded ? marketSnapshot.newThisMonth : totalNewMatches
	);

	$effect(() => {
		if (!browser) return;
		const requestKey = planMarketSnapshotKey;
		if (!requestKey) {
			marketSnapshot = createEmptyMarketSnapshot();
			return;
		}

		const cached = readCachedMarketSnapshot(requestKey);
		if (cached) {
			marketSnapshot = {
				...cached,
				refreshing: !isMarketSnapshotFresh(cached)
			};
			return;
		}

		marketSnapshot = createEmptyMarketSnapshot(requestKey);
	});

	$effect(() => {
		if (!browser) return;
		const assets = reportRelevantAssets;
		const checkSize = plannedCheckSize;
		const requestKey = planMarketSnapshotKey;
		const dealsList = $deals || [];
		if (!requestKey) return;

		if (assets.length === 0) {
			marketSnapshot = {
				...createEmptyMarketSnapshot(requestKey),
				loaded: true
			};
			return;
		}

		const cached = readCachedMarketSnapshot(requestKey);
		const needsRefresh = !cached || !isMarketSnapshotFresh(cached);
		if (!needsRefresh || dealsList.length === 0) return;

		const nextSnapshot = computeMarketSnapshotFromDeals(assets, checkSize, dealsList);
		const normalizedSnapshot = {
			...nextSnapshot,
			loaded: true,
			refreshing: false,
			requestKey
		};
		writeCachedMarketSnapshot(requestKey, normalizedSnapshot);
		marketSnapshot = normalizedSnapshot;
	});

	const projection = $derived.by(() => {
		const preferredAssets = selectedAssets.length ? selectedAssets : [...goalDefaults.cashflow];
		const checkSize = estimateCheckSize(plan?.investableCapital || wizardData.investableCapital);
		const startYear = new Date().getFullYear();
		let cumulativeIncome = 0;
		let cumulativeCapital = currentInvestedTotal;
		const currentAllocations = {};
		portfolio.forEach((investment) => {
			const profile = getAssetProfile(investment.assetClass || 'Other');
			currentAllocations[profile.label] = (currentAllocations[profile.label] || 0) + (parseFloat(investment.amountInvested) || 0);
		});

		const years = Array.from({ length: 9 }, (_, index) => {
			const profile = getAssetProfile(preferredAssets[index % preferredAssets.length]);
			const income = Math.round(checkSize * (profile.cashYield / 100));
			cumulativeIncome += income;
			cumulativeCapital += checkSize;
			return {
				index: index + 1,
				year: startYear + index,
				profile,
				checkSize,
				income,
				cumulativeIncome,
				cumulativeCapital,
				matches:
					reportSnapshotRows.find((row) => normalizeAssetKey(row.label) === normalizeAssetKey(profile.label))?.count ||
					profile.dealCount,
				progressPct: annualTargetAmount > 0 ? Math.min(100, Math.round((cumulativeIncome / annualTargetAmount) * 100)) : 0
			};
		});

		const bars = [];
		const running = { ...currentAllocations };
		bars.push({
			label: 'Today',
			total: currentInvestedTotal,
			segments: Object.entries(running)
				.map(([label, amount]) => ({ label, amount, color: getAssetProfile(label).color }))
				.sort((a, b) => b.amount - a.amount)
		});

		years.forEach((item) => {
			running[item.profile.label] = (running[item.profile.label] || 0) + item.checkSize;
			bars.push({
				label: `Year ${item.index} (${item.year})`,
				total: Object.values(running).reduce((sum, value) => sum + value, 0),
				segments: Object.entries(running)
					.map(([label, amount]) => ({ label, amount, color: getAssetProfile(label).color }))
					.sort((a, b) => b.amount - a.amount)
			});
		});

		const maxTotal = Math.max(...bars.map((bar) => bar.total), checkSize, 1);
		const finalBar = bars[bars.length - 1];
		const finalShare = finalBar.total > 0
			? finalBar.segments.map((segment) => ({
				...segment,
				share: (segment.amount / finalBar.total) * 100
			})).sort((a, b) => b.share - a.share)[0]
			: null;

		return {
			checkSize,
			years,
			bars,
			maxTotal,
			finalBar,
			finalShare
		};
	});

	const printAssetClasses = $derived.by(() => titleCaseList(reportRelevantAssets.map((asset) => getAssetProfile(asset).label)));
	const printStrategies = $derived.by(() =>
		titleCaseList((selectedStrategies.length ? selectedStrategies : ['Lending / Credit', 'Buy & Hold', 'Distressed']).slice(0, 5))
	);
	const printLockup = $derived.by(() => {
		const years = Number(portfolioPlan?.timeline || portfolioPlan?.target_hold_years || 0);
		if (years >= 5) return `${Math.round(years)}+ years`;
		if (years > 0) return `${years} years`;
		const avgYears = average(snapshotRows.map((row) => row.lockup));
		if (!avgYears) return 'Flexible';
		return avgYears >= 5 ? `${Math.round(avgYears)}+ years` : `${avgYears.toFixed(avgYears % 1 === 0 ? 0 : 1)} years`;
	});
	const printDistributions = $derived.by(() => {
		if (goalKey === 'cashflow') return 'Quarterly';
		if (goalKey === 'tax') return 'Offset focused';
		return 'Long-term';
	});
	const activeInvestmentsForPrint = $derived.by(() =>
		[...portfolio]
			.filter((investment) => !['exited', 'sold'].includes(String(investment?.status || '').toLowerCase()))
			.sort((a, b) => {
				const aDate = a?.dateInvested ? new Date(a.dateInvested).getTime() : 0;
				const bDate = b?.dateInvested ? new Date(b.dateInvested).getTime() : 0;
				return aDate - bDate;
			})
	);
	const exitedInvestmentsForPrint = $derived.by(() =>
		[...portfolio]
			.filter((investment) => ['exited', 'sold'].includes(String(investment?.status || '').toLowerCase()))
			.sort((a, b) => {
				const aDate = a?.dateInvested ? new Date(a.dateInvested).getTime() : 0;
				const bDate = b?.dateInvested ? new Date(b.dateInvested).getTime() : 0;
				return aDate - bDate;
			})
	);
	const printCurrentIncome = $derived.by(() => {
		const filledSlots = Array.isArray(portfolioPlan?.slots)
			? portfolioPlan.slots.filter((slot) => slot?.filled_by || slot?.filled_name || slot?.filledName)
			: [];
		if (filledSlots.length) {
			return filledSlots.reduce((sum, slot) => {
				const checkSize = Number(slot?.check_size || slot?.checkSize || plannedCheckSize || 0);
				const estIncome = Number(slot?.est_income || slot?.estIncome || 0);
				const fallbackIncome = Math.round(checkSize * (percentNumber(slot?.target_coc || slot?.targetCoC || average(reportSnapshotRows.map((row) => row.avgCoC))) / 100));
				return sum + (estIncome || fallbackIncome);
			}, 0);
		}
		return activeInvestmentsForPrint.reduce((sum, investment) => sum + investmentAnnualIncomeEstimate(investment), 0);
	});
	const printProgressPct = $derived.by(() =>
		annualTargetAmount > 0 ? Math.min(100, Math.round((printCurrentIncome / annualTargetAmount) * 100)) : 0
	);
	const currentInvestmentsSummary = $derived.by(() =>
		`${portfolio.length} total positions · ${currency(currentInvestedTotal)} deployed · ${activeInvestmentsForPrint.length} active · ${exitedInvestmentsForPrint.length} exited`
	);
	const printSchedule = $derived.by(() => {
		const targetIncome = annualTargetAmount;
		const fallbackYield = average(reportSnapshotRows.map((row) => row.avgCoC)) || average(selectedAssets.map((asset) => getAssetProfile(asset).cashYield)) || 10;
		const legacySlots = Array.isArray(portfolioPlan?.slots) ? portfolioPlan.slots : [];

		if (legacySlots.length) {
			const normalizedSlots = legacySlots.map((slot, index) => {
				const assetClass = slot?.asset_class || slot?.assetClass || reportRelevantAssets[index % reportRelevantAssets.length] || 'Lending';
				const checkSize = Number(slot?.check_size || slot?.checkSize || plannedCheckSize || 0);
				const yieldPct = percentNumber(slot?.target_coc || slot?.targetCoC || fallbackYield);
				const estIncome = Number(slot?.est_income || slot?.estIncome || Math.round(checkSize * (yieldPct / 100)));
				return {
					id: slot?.id || `${assetClass}-${index}`,
					name: slot?.filled_name || slot?.filledName || 'Open slot',
					assetClass,
					checkSize,
					yieldPct,
					estIncome,
					year: Number(slot?.year) || currentYearNumber() + index,
					filled: Boolean(slot?.filled_by || slot?.filled_name || slot?.filledName)
				};
			}).sort((a, b) => a.year - b.year);

			let cumulativeIncome = 0;
			const years = [];
			for (const year of [...new Set(normalizedSlots.map((slot) => slot.year))]) {
				const slots = normalizedSlots.filter((slot) => slot.year === year);
				cumulativeIncome += slots.reduce((sum, slot) => sum + slot.estIncome, 0);
				years.push({
					index: years.length + 1,
					year,
					slots,
					cumulativeIncome,
					progressPct: targetIncome > 0 ? Math.min(100, Math.round((cumulativeIncome / targetIncome) * 100)) : 0
				});
			}

			const totalCapital = Number(portfolioPlan?.total_capital || portfolioPlan?.totalCapital || normalizedSlots.reduce((sum, slot) => sum + slot.checkSize, 0));
			const totalIncome = years[years.length - 1]?.cumulativeIncome || 0;
			const blendedYieldPct = percentNumber(portfolioPlan?.blended_coc || portfolioPlan?.blendedCoC || fallbackYield);

			return {
				years,
				totalCapital,
				totalSlots: normalizedSlots.length,
				totalYears: years.length,
				totalIncome,
				targetIncome,
				blendedYieldPct,
				avgCheckSize: normalizedSlots.length ? Math.round(totalCapital / normalizedSlots.length) : plannedCheckSize
			};
		}

		const years = projection.years.map((item) => ({
			index: item.index,
			year: item.year,
			slots: [{
				id: `projection-${item.index}`,
				name: 'Open slot',
				assetClass: item.profile.label,
				checkSize: item.checkSize,
				yieldPct: item.profile.cashYield,
				estIncome: item.income,
				filled: false
			}],
			cumulativeIncome: item.cumulativeIncome,
			progressPct: item.progressPct
		}));
		const totalCapital = projection.years.reduce((sum, item) => sum + item.checkSize, 0);
		const totalIncome = years[years.length - 1]?.cumulativeIncome || 0;

		return {
			years,
			totalCapital,
			totalSlots: projection.years.length,
			totalYears: years.length,
			totalIncome,
			targetIncome,
			blendedYieldPct: fallbackYield,
			avgCheckSize: projection.checkSize
		};
	});
	const planPageSubtitle = $derived.by(() =>
		canViewFullPlan
			? 'Turn your goal into a thesis, roadmap, and next best move.'
			: 'Keep your investor profile, deal-fit context, and upgrade path in one place.'
	);
	const freeProfileGoalLabel = $derived.by(() => goalLabels[wizardData._branch || wizardData.goal] || 'Define your investing goal');
	const freeProfileExperience = $derived.by(() => {
		const dealsCount = Number(wizardData.dealExperience ?? wizardData.lpDealsCount ?? 0);
		if (!Number.isFinite(dealsCount) || dealsCount <= 0) return 'First-time investor';
		return `${dealsCount} completed deal${dealsCount === 1 ? '' : 's'}`;
	});
	const freeProfileBaseline = $derived.by(() => {
		const baseline = parseDollar(wizardData.baselineIncome);
		return baseline > 0 ? `${currency(baseline)}/yr current baseline` : 'No passive baseline saved yet';
	});
	const freeProfileSummary = $derived.by(() => {
		if (!hasInvestorProfile) return 'Finish your investor profile so the app can tailor the deal feed, holdings context, and upgrade path to you.';
		const assets = selectedAssets.slice(0, 2).map((asset) => getAssetProfile(asset).label);
		const strategies = selectedStrategies.slice(0, 2);
		const focus = [assets.join(' + '), strategies.join(' + ')].filter(Boolean).join(' with ');
		if (!focus) return `Your profile is currently centered on ${freeProfileGoalLabel.toLowerCase()}.`;
		return `Your deal feed is being tuned for ${freeProfileGoalLabel.toLowerCase()} with ${focus}.`;
	});
	const roadmapMetricConfig = $derived.by(() => {
		const avgIrrPct =
			average(
				selectedAssets.map((asset) => {
					const profile = getAssetProfile(asset);
					return (profile.irrMin + profile.irrMax) / 2;
				})
			) || 14;
		if (goalKey === 'growth') {
			return {
				label: 'Projected portfolio value',
				unitSuffix: '',
				describe: (value) => currency(value),
				valueForYear: (item) => Math.round(item.cumulativeCapital * (1 + (avgIrrPct / 100) * 0.75))
			};
		}
		if (goalKey === 'tax') {
			return {
				label: 'Estimated first-year tax offset',
				unitSuffix: '/yr',
				describe: (value) => `${currency(value)}/yr`,
				valueForYear: (item) => Math.round(item.cumulativeCapital * 0.18)
			};
		}
		return {
			label: 'Annual passive income run-rate',
			unitSuffix: '/yr',
			describe: (value) => `${currency(value)}/yr`,
			valueForYear: (item) => item.cumulativeIncome
		};
	});
	const roadmapPlanYears = $derived.by(() => {
		const years = Array.isArray(printSchedule?.years) ? printSchedule.years : [];
		let cumulativeCapital = 0;
		return years.map((year, index) => {
			const yearCapital = (year.slots || []).reduce((sum, slot) => sum + Number(slot.checkSize || 0), 0);
			cumulativeCapital += yearCapital;
			const metricValue = goalKey === 'growth'
				? Math.round(cumulativeCapital * 1.12)
				: goalKey === 'tax'
					? Math.round(cumulativeCapital * 0.18)
					: Number(year.cumulativeIncome || 0);
			return {
				index: year.index || index + 1,
				year: year.year,
				slots: year.slots || [],
				cumulativeCapital,
				metricValue,
				progressPct: annualTargetAmount > 0 ? Math.min(100, Math.round((metricValue / annualTargetAmount) * 100)) : 0
			};
		});
	});
	const roadmapYears = $derived.by(() =>
		projection.years.map((item) => {
			const metricValue = roadmapMetricConfig.valueForYear(item);
			return {
				...item,
				metricValue,
				metricLabel: roadmapMetricConfig.label,
				progressPct:
					annualTargetAmount > 0 ? Math.min(100, Math.round((metricValue / annualTargetAmount) * 100)) : 0
			};
		})
	);
	const roadmapSummary = $derived.by(() => {
		const finalYear = roadmapPlanYears[roadmapPlanYears.length - 1];
		if (!finalYear) return '';
		return `${roadmapMetricConfig.describe(finalYear.metricValue)} on ${currency(finalYear.cumulativeCapital)} deployed across ${printSchedule.totalSlots} modeled slots.`;
	});
	const nextBestMove = $derived.by(() => {
		const nextYear = printSchedule.years.find((year) => year.slots.some((slot) => !slot.filled)) || printSchedule.years[0];
		const nextSlot = nextYear?.slots?.find((slot) => !slot.filled) || nextYear?.slots?.[0];
		if (!nextSlot) return null;
		const assetMatch =
			reportSnapshotRows.find((row) => normalizeAssetKey(row.label) === normalizeAssetKey(nextSlot.assetClass)) ||
			reportSnapshotRows[0] ||
			null;
		const matchCount = assetMatch?.count ?? totalMatches;
		const affordableCount = assetMatch?.affordableCount ?? null;
		const estimatedImpact = goalKey === 'growth'
			? `toward an estimated ${roadmapMetricConfig.describe(
				Math.round(nextSlot.checkSize * 1.12)
			)} value contribution`
			: goalKey === 'tax'
				? `toward roughly ${roadmapMetricConfig.describe(Math.round(nextSlot.checkSize * 0.18))} in modeled offset`
				: `toward roughly ${roadmapMetricConfig.describe(nextSlot.estIncome)} in modeled income`;
		return {
			year: nextYear?.year || currentYearNumber(),
			assetClass: nextSlot.assetClass,
			checkSize: nextSlot.checkSize,
			yieldPct: nextSlot.yieldPct,
			estimatedImpact,
			matchCount,
			affordableCount
		};
	});
	const roadmapChart = $derived.by(() => {
		const currentYear = currentYearNumber();
		const historicalYears = Array.from({ length: 5 }, (_, index) => currentYear - 5 + index);
		const activeEntries = [...portfolio].filter(
			(investment) => !['exited', 'sold'].includes(String(investment?.status || '').toLowerCase())
		);
		const currentAllocations = {};
		activeEntries.forEach((investment) => {
			const amount = Number(investment?.amountInvested || 0);
			if (!amount) return;
			const label = getAssetProfile(investment?.assetClass || 'Other').label;
			currentAllocations[label] = (currentAllocations[label] || 0) + amount;
		});

		const metricValueForInvestments = (entries, year) => {
			if (goalKey === 'growth') {
				return entries.reduce((sum, investment) => sum + investmentGrowthValueEstimate(investment, year), 0);
			}
			if (goalKey === 'tax') {
				return entries.reduce((sum, investment) => sum + investmentTaxOffsetEstimate(investment), 0);
			}
			return entries.reduce((sum, investment) => sum + investmentAnnualIncomeEstimate(investment), 0);
		};

		const metricValueForSlots = (slots, year) => {
			if (goalKey === 'growth') {
				return slots.reduce((sum, slot) => sum + modeledSlotGrowthValueEstimate(slot, year), 0);
			}
			if (goalKey === 'tax') {
				return slots.reduce((sum, slot) => sum + Math.round(Number(slot.checkSize || 0) * 0.18), 0);
			}
			return slots.reduce((sum, slot) => sum + Number(slot.estIncome || 0), 0);
		};

		const actualPoints = historicalYears.map((year) => {
			const entries = activeEntries.filter((investment) => getInvestmentYear(investment, currentYear) <= year);
			const allocations = {};
			entries.forEach((investment) => {
				const amount = Number(investment?.amountInvested || 0);
				if (!amount) return;
				const label = getAssetProfile(investment?.assetClass || 'Other').label;
				allocations[label] = (allocations[label] || 0) + amount;
			});
			const capitalTotal = Object.values(allocations).reduce((sum, amount) => sum + Number(amount || 0), 0);
			return {
				key: `actual-${year}`,
				year,
				period: 'actual',
				capitalTotal,
				metricValue: metricValueForInvestments(entries, year),
				segments: buildAllocationSegments(allocations)
			};
		});

		const modeledSlots = projection.years.slice(0, 5).map((item) => ({
			year: item.year,
			assetClass: item.profile.label,
			checkSize: item.checkSize,
			estIncome: item.income,
			irrPct: (item.profile.irrMin + item.profile.irrMax) / 2
		}));

		const futurePoints = modeledSlots.map((slot) => {
			const activeSlots = modeledSlots.filter((candidate) => candidate.year <= slot.year);
			const allocations = { ...currentAllocations };
			activeSlots.forEach((candidate) => {
				allocations[candidate.assetClass] = (allocations[candidate.assetClass] || 0) + candidate.checkSize;
			});
			const capitalTotal = Object.values(allocations).reduce((sum, amount) => sum + Number(amount || 0), 0);
			return {
				key: `modeled-${slot.year}`,
				year: slot.year,
				period: 'modeled',
				capitalTotal,
				metricValue:
					metricValueForInvestments(activeEntries, slot.year) + metricValueForSlots(activeSlots, slot.year),
				segments: buildAllocationSegments(allocations)
			};
		});

		const points = [...actualPoints, ...futurePoints];
		const maxCapital = Math.max(...points.map((point) => point.capitalTotal), 1);
		const maxMetric = Math.max(annualTargetAmount, ...points.map((point) => point.metricValue), 1);
		const visibleLabelIndexes = new Set([
			0,
			historicalYears.length - 1,
			historicalYears.length,
			points.length - 1
		]);
		const chartPoints = points.map((point, index, allPoints) => ({
			...point,
			capitalPct: point.capitalTotal > 0 ? (point.capitalTotal / maxCapital) * 100 : 0,
			metricPct: point.metricValue > 0 ? (point.metricValue / maxMetric) * 100 : 0,
			plotX: allPoints.length > 1 ? (index / (allPoints.length - 1)) * 100 : 50,
			plotY: 100 - (point.metricValue > 0 ? (point.metricValue / maxMetric) * 100 : 0),
			showCapitalLabel: visibleLabelIndexes.has(index),
			showMetricDot: visibleLabelIndexes.has(index) || index === allPoints.length - 1
		}));
		const finalPoint = chartPoints[chartPoints.length - 1];
		const finalShare =
			finalPoint?.capitalTotal > 0
				? [...finalPoint.segments]
						.map((segment) => ({
							...segment,
							share: (segment.amount / finalPoint.capitalTotal) * 100
						}))
						.sort((left, right) => right.share - left.share)[0]
				: null;
		const dominantLabels = finalPoint?.segments?.slice(0, 4).map((segment) => segment.label) || [];
		const groupedPoints = chartPoints.map((point) => {
			const grouped = [];
			let otherAmount = 0;
			point.segments.forEach((segment) => {
				if (dominantLabels.includes(segment.label)) {
					grouped.push(segment);
				} else {
					otherAmount += segment.amount;
				}
			});
			if (otherAmount > 0) {
				grouped.push({
					label: 'Other',
					amount: otherAmount,
					color: 'rgba(148, 163, 184, 0.9)'
				});
			}
			return {
				...point,
				displaySegments: grouped.map((segment) => ({
					...segment,
					widthPct: point.capitalTotal > 0 ? (segment.amount / point.capitalTotal) * 100 : 0
				}))
			};
		});

		return {
			points: groupedPoints,
			maxCapital,
			maxMetric,
			polylinePoints: groupedPoints.map((point) => `${point.plotX},${point.plotY}`).join(' '),
			targetY: 100 - ((annualTargetAmount / maxMetric) * 100),
			finalShare,
			dominantLabels,
			actualRangeLabel: `${historicalYears[0]}-${historicalYears[historicalYears.length - 1]}`,
			modeledRangeLabel: futurePoints.length
				? `${futurePoints[0].year}-${futurePoints[futurePoints.length - 1].year}`
				: `${currentYear}-${currentYear + 4}`
		};
	});
	const roadmapChartSummary = $derived.by(() => {
		const finalPoint = roadmapChart.points[roadmapChart.points.length - 1];
		if (!finalPoint) return '';
		return `The left side shows the last 5 completed years of portfolio history. The right side shows the next 5 years modeled from today. By ${finalPoint.year}, this roadmap reaches ${roadmapMetricConfig.describe(finalPoint.metricValue)} on ${currency(finalPoint.capitalTotal)} deployed.`;
	});
	const roadmapFinalMix = $derived.by(() => {
		const finalPoint = roadmapChart.points[roadmapChart.points.length - 1];
		if (!finalPoint?.displaySegments?.length) return [];
		return finalPoint.displaySegments;
	});
	const concentrationAlert = $derived.by(() => {
		if (!roadmapChart.finalShare || roadmapChart.finalShare.share < 45) return null;
		return `${Math.round(roadmapChart.finalShare.share)}% of the deployed capital in this 5-year forward plan lands in ${roadmapChart.finalShare.label}. Consider diversifying.`;
	});

	onMount(() => {
		if (!browser) return;
		syncWizardRouteFromLocation();
		const snapshot = getUserScopedCacheSnapshot();
		const shouldRenderFromCache = hasLocalPlanContent(snapshot);
		syncPlanState();
		dismissPassiveWizardRouteIfPlanExists(snapshot);
		if (shouldRenderFromCache) {
			loading = false;
		}
		fetchDeals().catch(() => {});

		const handleScopedStateUpdate = () => {
			syncPlanState();
			dismissPassiveWizardRouteIfPlanExists();
		};
		const handlePopState = () => {
			syncWizardRouteFromLocation();
			dismissPassiveWizardRouteIfPlanExists();
		};
		window.addEventListener(USER_SCOPED_STATE_EVENT, handleScopedStateUpdate);
		window.addEventListener('popstate', handlePopState);

		if (shouldRenderFromCache && canViewFullPlan && shouldOpenWizardFromLocation && !showWizard) {
			showWizard = true;
		}

		void (async () => {
			try {
				const returnPath = `${window.location.pathname}${window.location.search}`;
				const boot = await bootstrapProtectedRouteSession({
					returnPath,
					hydrateScopedData: true,
					awaitHydration: true
				});
				if (!boot.ok) {
					loading = false;
					goto(boot.redirect).catch(() => {});
					return;
				}
				syncPlanState();
				dismissPassiveWizardRouteIfPlanExists();
			} catch (error) {
				console.warn('Failed to load plan:', error);
			} finally {
				if (loading) loading = false;
				if (canViewFullPlan && shouldOpenWizardFromLocation && !showWizard) {
					showWizard = true;
				}
			}
		})();

		return () => {
			window.removeEventListener(USER_SCOPED_STATE_EVENT, handleScopedStateUpdate);
			window.removeEventListener('popstate', handlePopState);
		};
	});
</script>

<svelte:head>
	<title>Plan | GYC</title>
</svelte:head>

<PageContainer className="plan-shell ly-page-stack">
	<PageHeader title="Plan" subtitle={planPageSubtitle} className="dashboard-page-header" />

	<div class="plan-page">
	{#if saveMsg && !showInlineWizard}
		<div class="save-toast">{saveMsg}</div>
	{/if}

	{#if loading}
		<div class="loading-skeleton">
			<div class="sk-bar" style="width: 180px; height: 14px;"></div>
			<div class="sk-card">
				<div class="sk-bar" style="width: 120px; height: 18px; margin-bottom: 18px;"></div>
				<div class="sk-bar" style="width: 78%; height: 30px; margin-bottom: 24px;"></div>
				<div class="sk-bar" style="width: 92%; height: 14px; margin-bottom: 12px;"></div>
				<div class="sk-bar" style="width: 84%; height: 14px;"></div>
			</div>
		</div>
	{:else if showInlineWizard}
		<div class="plan-setup-shell">
			<section class="plan-card plan-setup-card ly-surface ly-surface--strong">
				<div class="plan-card-top">
					<div class="section-eyebrow">{inlineWizardTitle}</div>
					{#if showInlineWizardBackAction}
						<button class="inline-action" onclick={closeWizard}>
							{canViewFullPlan ? 'Back To Plan' : 'Back To Profile'}
						</button>
					{/if}
				</div>
				<div class="section-subcopy">{inlineWizardCopy}</div>
				{#key wizardRenderKey}
					<LegacyPlanWizard
						bind:this={wizardRef}
						initialData={wizardData}
						forceEdit={canViewFullPlan ? (wizardForceEdit && hasSavedPlanProgress) : false}
						forcedStage={wizardStage}
						forcedBranch={inlineWizardBranch}
						forcedFlowKey={inlineWizardFlowKey}
						fullPlanMode={canViewFullPlan}
						freeCompleteRedirectTo="/app/plan"
						paidCompleteRedirectTo="/app/plan"
						on:state={handleWizardState}
						on:complete={handleWizardComplete}
						on:requeststartover={openStartOverConfirmation}
						/>
				{/key}
			</section>
		</div>
	{:else if !canViewFullPlan}
		<div class="plan-stack plan-stack--free">
			<section class="plan-card plan-target-card profile-card ly-surface ly-surface--accent ly-surface--strong">
				<div class="plan-card-top">
					<span class="goal-pill goal-pill--profile">Investor Profile</span>
					<div class="target-actions">
						<button class="inline-action" onclick={openInvestorProfile}>Update Profile</button>
					</div>
				</div>
				<div class="plan-kicker">Current Focus</div>
				<h1 class="plan-headline">{freeProfileGoalLabel}</h1>
				<p class="plan-copy">{freeProfileSummary}</p>
				{#if hasInvestorProfile}
					<div class="plan-snapshot-grid">
						<div class="plan-snapshot-item">
							<div class="plan-snapshot-label">Experience</div>
							<div class="plan-snapshot-value">{freeProfileExperience}</div>
						</div>
						<div class="plan-snapshot-item">
							<div class="plan-snapshot-label">Starting Point</div>
							<div class="plan-snapshot-value">{freeProfileBaseline}</div>
						</div>
						<div class="plan-snapshot-item">
							<div class="plan-snapshot-label">Preferred Asset Classes</div>
							<div class="plan-snapshot-value plan-snapshot-value--wrap">
								{selectedAssets.length ? selectedAssets.slice(0, 3).map((asset) => getAssetProfile(asset).label).join(', ') : 'Not saved yet'}
							</div>
						</div>
						<div class="plan-snapshot-item">
							<div class="plan-snapshot-label">Preferred Strategies</div>
							<div class="plan-snapshot-value plan-snapshot-value--wrap">
								{selectedStrategies.length ? selectedStrategies.slice(0, 3).join(', ') : 'Not saved yet'}
							</div>
						</div>
					</div>
				{:else}
					<div class="profile-empty-copy">Finish your investor profile to personalize deals, portfolio context, and your future plan.</div>
				{/if}
			</section>

			<section class="plan-card locked-card ly-surface ly-surface--muted">
				<div class="locked-title">
					{nativeCompanionMode ? 'Full planning stays on the web for members' : 'Membership unlocks your full investment plan'}
				</div>
				<div class="locked-copy">
					You can keep browsing deals, saving opportunities, and managing holdings as a free user. Membership unlocks your synthesized thesis, roadmap, and next best move on this page.
				</div>
				<div class="locked-actions">
					<a href="/app/deals" class="btn-cta secondary">Browse Matching Deals</a>
					{#if nativeCompanionMode}
						<CompanionGate
							compact={true}
							title="Available to existing members"
							message="Full plan roadmap, next-best-move guidance, and advanced projections stay available to existing members on the web."
						/>
					{:else}
						<a href="/app/academy" class="btn-cta">Unlock Full Plan</a>
					{/if}
				</div>
			</section>
		</div>
	{:else}
		<div class="plan-stack">
			<section class="plan-card plan-target-card ly-surface ly-surface--accent ly-surface--strong">
				<div class="plan-card-top">
					<span class="goal-pill">{targetBadge}</span>
					<div class="target-actions">
						<button class="inline-action" onclick={printPlan}>Print</button>
						<button class="inline-action" data-testid="plan-summary-edit" onclick={openPlanReview}>Edit</button>
						<button class="inline-action" data-testid="plan-summary-new" onclick={openNewPlanConfirmation}>New Plan</button>
					</div>
				</div>
				<div class="plan-kicker">Target</div>
				<h1 class="plan-headline">{targetHeadline}</h1>
				<div class="plan-kicker">{targetLabel}</div>
				<p class="plan-copy">
					{#each planThesisSegments as segment}
						{#if segment.emphasis}
							<strong>{segment.text}</strong>
						{:else}
							{segment.text}
						{/if}
					{/each}
				</p>
				<div class="plan-snapshot-grid">
					<div class="plan-snapshot-item">
						<div class="plan-snapshot-label">Target Annual Outcome</div>
						<div class="plan-snapshot-value">{currency(annualTargetAmount)}</div>
					</div>
					<div class="plan-snapshot-item">
						<div class="plan-snapshot-label">Target Check Size</div>
						<div class="plan-snapshot-value">{currency(plannedCheckSize)}</div>
					</div>
					<div class="plan-snapshot-item">
						<div class="plan-snapshot-label">Preferred Asset Classes</div>
						<div class="plan-snapshot-value plan-snapshot-value--wrap">
							{selectedAssets.slice(0, 3).map((asset) => getAssetProfile(asset).label).join(', ')}
						</div>
					</div>
					<div class="plan-snapshot-item">
						<div class="plan-snapshot-label">Target Hold Period</div>
						<div class="plan-snapshot-value">{printLockup}</div>
					</div>
				</div>
			</section>

			<section class="plan-card roadmap-card ly-surface">
				<div class="roadmap-topline">
					<div>
						<div class="section-eyebrow">Your Roadmap</div>
						<div class="section-subcopy">Here is the year-by-year plan and chart view for how this thesis moves toward your goal.</div>
					</div>
					<div class="roadmap-toggle" role="tablist" aria-label="Roadmap views">
						<button type="button" class="roadmap-toggle-btn" class:active={roadmapView === 'plan'} onclick={() => (roadmapView = 'plan')}>Plan</button>
						<button type="button" class="roadmap-toggle-btn" class:active={roadmapView === 'charts'} onclick={() => (roadmapView = 'charts')}>Charts</button>
					</div>
				</div>

				{#if roadmapView === 'charts'}
					<div class="roadmap-summary-grid">
						<div class="plan-snapshot-item">
							<div class="plan-snapshot-label">{roadmapMetricConfig.label}</div>
							<div class="plan-snapshot-value">{roadmapMetricConfig.describe(roadmapChart.points[roadmapChart.points.length - 1]?.metricValue || 0)}</div>
						</div>
						<div class="plan-snapshot-item">
							<div class="plan-snapshot-label">Projected Capital In 5 Years</div>
							<div class="plan-snapshot-value">{currency(roadmapChart.points[roadmapChart.points.length - 1]?.capitalTotal || currentInvestedTotal)}</div>
						</div>
						<div class="plan-snapshot-item">
							<div class="plan-snapshot-label">Current Holdings</div>
							<div class="plan-snapshot-value">{currentInvestmentCount} positions</div>
						</div>
						<div class="plan-snapshot-item">
							<div class="plan-snapshot-label">Target Check Size</div>
							<div class="plan-snapshot-value">{currency(projection.checkSize)}</div>
						</div>
					</div>
					<div class="roadmap-summary-note">{roadmapChartSummary}</div>
					<div class="growth-topline growth-topline--embedded">
						<div>
							<div class="section-eyebrow">Historical + Forward Roadmap</div>
							<div class="roadmap-chart-copy">Last 5 completed years actual. Next 5 years modeled from today.</div>
						</div>
						<div class="growth-target">{roadmapMetricConfig.label}</div>
					</div>
					<PlanRoadmapChart
						points={roadmapChart.points}
						targetValue={annualTargetAmount}
						metricLabel={roadmapMetricConfig.label}
						actualRangeLabel={roadmapChart.actualRangeLabel}
						modeledRangeLabel={roadmapChart.modeledRangeLabel}
						formatMetricValue={roadmapMetricConfig.describe}
						formatCapitalValue={compactCurrency}
						finalMixSegments={roadmapFinalMix}
						finalMixTotal={roadmapChart.points[roadmapChart.points.length - 1]?.capitalTotal || 0}
						concentrationAlert={concentrationAlert}
					/>
				{:else}
					<div class="schedule-card schedule-card--embedded">
						<div class="schedule-topline">
							<div>
								<div class="section-eyebrow">Your Investment Plan</div>
								<div class="schedule-summary">{currentInvestmentCount} current investments · {currency(currentInvestedTotal)} deployed today</div>
							</div>
							<button class="inline-action green" onclick={openPlanEditor}>Edit Plan</button>
						</div>
						<div class="schedule-list">
							{#each roadmapPlanYears as item}
								<div class="schedule-row">
									<div class="schedule-row-top">
										<div class="schedule-year">Year {item.index} <span>({item.year})</span></div>
										<div class="schedule-income">{roadmapMetricConfig.describe(item.metricValue)} <span>{item.progressPct}%</span></div>
									</div>
									{#each item.slots as slot, slotIndex}
										<div class="schedule-row-detail">
											<span class="schedule-bullet"></span>
											{slot.assetClass} · {currency(slot.checkSize)} · ~{percent(slot.yieldPct)}
											{#if slotIndex === 0 && item.slots.length > 1}
												· {item.slots.length} slots
											{/if}
										</div>
									{/each}
								</div>
							{/each}
						</div>
						<div class="schedule-total">{projection.years.length} modeled slots · {currency(projection.checkSize)} target check · {roadmapSummary}</div>
						<div class="schedule-total">{printSchedule.totalSlots} modeled slots · {currency(printSchedule.avgCheckSize)} avg check · {roadmapSummary}</div>
					</div>
				{/if}
			</section>

			{#if nextBestMove}
				<section class="plan-card next-move-card ly-surface ly-surface--strong">
					<div class="next-move-kicker">Your Next Best Move</div>
					<h2 class="next-move-title">Add a {currency(nextBestMove.checkSize)} {nextBestMove.assetClass} allocation.</h2>
					<p class="next-move-copy">
						The next modeled slot in your roadmap lands in {nextBestMove.year} and points to {nextBestMove.assetClass}. A move at this size should help you move {nextBestMove.estimatedImpact}.
					</p>
					<div class="next-move-meta">
						<div class="next-move-pill">{nextBestMove.matchCount} matching deals in the database</div>
						{#if nextBestMove.affordableCount !== null && nextBestMove.affordableCount !== nextBestMove.matchCount}
							<div class="next-move-pill">{nextBestMove.affordableCount} fit your current check size</div>
						{/if}
						<div class="next-move-pill">Target pace: {percent(nextBestMove.yieldPct)} yield</div>
					</div>
					<div class="next-move-actions">
						<a href="/app/deals" class="btn-cta">Browse Matching Deals</a>
						<button class="btn-cta secondary" onclick={openPlanEditor}>Edit Plan</button>
					</div>
				</section>
			{/if}
		</div>

		{#if canViewFullPlan && hasPlan}
		<div class="print-plan" aria-hidden="true">
			<section class="print-page">
				<header class="print-header">
					<div>
						<div class="print-brand">Grow Your Cashflow</div>
						<div class="print-subbrand">Personal Investment Plan</div>
					</div>
					<div class="print-prepared">
						<div class="print-user">{reportUserName}</div>
						<div class="print-date">Prepared {preparedOn}</div>
					</div>
				</header>

				<section class="print-hero">
					<div class="print-pill">{targetBadge}</div>
					<h1 class="print-title">{targetHeadline}</h1>
					<div class="print-progress">
						<div class="print-progress-bar">
							<span style={`width:${printProgressPct}%`}></span>
						</div>
						<div class="print-progress-meta">
							<span>{currency(printCurrentIncome)}/yr earned</span>
							<span>{printProgressPct}% of {currency(annualTargetAmount)}/yr</span>
						</div>
					</div>
				</section>

				<section class="print-card">
					<div class="print-kicker">Investment Thesis</div>
					<p class="print-copy">
						{#each planThesisSegments as segment}
							{#if segment.emphasis}
								<strong>{segment.text}</strong>
							{:else}
								{segment.text}
							{/if}
						{/each}
					</p>
				</section>

				<div class="print-meta-row">
					<div class="print-meta-pill"><strong>Asset Classes:</strong> {printAssetClasses}</div>
					<div class="print-meta-pill"><strong>Strategies:</strong> {printStrategies}</div>
					<div class="print-meta-pill"><strong>Check Size:</strong> {currency(plannedCheckSize)}</div>
					<div class="print-meta-pill"><strong>Lockup:</strong> {printLockup}</div>
					<div class="print-meta-pill"><strong>Distributions:</strong> {printDistributions}</div>
				</div>

				{#if canViewAnalytics}
					<section class="print-section">
						<div class="print-section-title">Matching Deal Signal - {reportMatchTotal} Matching Deals</div>
						<div class="print-section-copy">
							{reportMatchTotal} active offerings line up with your current thesis on the Grow Your Cashflow platform as of {preparedOn}.
						</div>
						<table class="print-table">
							<thead>
								<tr>
									<th>Asset Class</th>
									<th>IRR Range</th>
									<th>Avg CoC</th>
									<th>Avg Min</th>
									<th>Affordable</th>
								</tr>
							</thead>
							<tbody>
								{#each reportSnapshotRows as row}
									<tr>
										<td>
											<div class="print-asset">
												<span class="print-asset-icon" style={`background:${row.color}`}>{row.icon}</span>
												<div>
													<div class="print-asset-name">{row.label}</div>
													<div class="print-asset-meta">{row.count} deals</div>
												</div>
											</div>
										</td>
										<td>{percent(row.irrMin)} - {percent(row.irrMax)}</td>
										<td>{percent(row.avgCoC)}</td>
										<td>{row.avgMinimum ? currency(row.avgMinimum) : '—'}</td>
										<td>{row.affordableCount ?? '—'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</section>
				{:else}
					<section class="print-card print-lock-card">
						<div class="print-kicker">Upgrade Required</div>
						<p class="print-copy">Roadmap and matching-deal print views are only included for member and admin accounts.</p>
					</section>
				{/if}
			</section>

			{#if portfolio.length}
				<section class="print-page">
					<div class="print-section-title">Current Investments</div>
					<div class="print-section-copy">{currentInvestmentsSummary}</div>

					{#if activeInvestmentsForPrint.length}
						<div class="print-subsection-title">Active Investments</div>
						<table class="print-table">
							<thead>
								<tr>
									<th>Deal</th>
									<th>Operator</th>
									<th>Asset Class</th>
									<th>Invested</th>
									<th>Date</th>
								</tr>
							</thead>
							<tbody>
								{#each activeInvestmentsForPrint as investment}
									<tr>
										<td>{investment.investmentName || 'Unnamed investment'}</td>
										<td>{investment.sponsor || '—'}</td>
										<td>{investment.assetClass || '—'}</td>
										<td>{currency(investment.amountInvested)}</td>
										<td>{formatMonthYear(investment.dateInvested)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}

					{#if exitedInvestmentsForPrint.length}
						<div class="print-subsection-title">Exited Investments</div>
						<table class="print-table">
							<thead>
								<tr>
									<th>Deal</th>
									<th>Operator</th>
									<th>Asset Class</th>
									<th>Invested</th>
									<th>Date</th>
								</tr>
							</thead>
							<tbody>
								{#each exitedInvestmentsForPrint as investment}
									<tr class="muted">
										<td>{investment.investmentName || 'Unnamed investment'}</td>
										<td>{investment.sponsor || '—'}</td>
										<td>{investment.assetClass || '—'}</td>
										<td>{currency(investment.amountInvested)}</td>
										<td>{formatMonthYear(investment.dateInvested)}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					{/if}
				</section>
			{/if}

			{#if canViewAnalytics && printSchedule.years.length}
				<section class="print-page">
					<div class="print-section-title">Deployment Schedule</div>
					<div class="print-section-copy">
						Deploy {currency(printSchedule.totalCapital)} across {printSchedule.totalSlots} investments over {printSchedule.totalYears} years -> {currency(printSchedule.targetIncome)}/yr at {Math.round(printSchedule.blendedYieldPct)}% blended yield.
					</div>

					<table class="print-table print-schedule-table">
						<thead>
							<tr>
								<th>Investment</th>
								<th>Asset Class</th>
								<th>Check Size</th>
								<th>Est. Income</th>
							</tr>
						</thead>
						<tbody>
							{#each printSchedule.years as year}
								<tr class="print-year-row">
									<td colspan="3">Year {year.index} ({year.year})</td>
									<td>{currency(year.cumulativeIncome)}/yr · {year.progressPct}%</td>
								</tr>
								{#each year.slots as slot}
									<tr>
										<td>{slot.name}</td>
										<td>{slot.assetClass}</td>
										<td>{currency(slot.checkSize)}</td>
										<td>{currency(slot.estIncome)}/yr{slot.yieldPct ? ` (${Math.round(slot.yieldPct)}%)` : ''}</td>
									</tr>
								{/each}
							{/each}
						</tbody>
						<tfoot>
							<tr>
								<td>Total</td>
								<td>{printSchedule.totalSlots} investments</td>
								<td>{currency(printSchedule.totalCapital)}</td>
								<td>{currency(printSchedule.totalIncome)}/yr</td>
							</tr>
						</tfoot>
					</table>

					<div class="print-disclaimer">
						Disclaimer: This plan is for informational purposes only and does not constitute investment advice or an offer to sell securities. Projected returns are based on current listings and may change. Past performance does not guarantee future results. Consult a qualified financial advisor before making investment decisions. All investments involve risk, including loss of principal.
					</div>

					<footer class="print-footer">
						<div>growyourcashflow.com</div>
						<div>Confidential - Prepared for {reportUserName}</div>
						<div>{preparedOn}</div>
					</footer>
				</section>
			{/if}
		</div>
	{/if}
	{/if}
	{#if planConfirmDialog}
		<div
			class="confirm-modal-overlay"
			role="dialog"
			aria-modal="true"
			aria-labelledby="plan-confirm-title"
			onclick={(event) => {
				if (event.target === event.currentTarget) closePlanConfirmation();
			}}
		>
			<div class="confirm-modal">
				<div class="confirm-modal-header">
					<h2 id="plan-confirm-title">{planConfirmDialog.title}</h2>
				</div>
				<p class="confirm-modal-copy">{planConfirmDialog.body}</p>
				{#if planConfirmError}
					<div class="confirm-modal-error">{planConfirmError}</div>
				{/if}
				<div class="confirm-modal-actions">
					<button
						type="button"
						class="btn-cta secondary"
						data-testid="plan-reset-cancel"
						onclick={closePlanConfirmation}
						disabled={planResetting}
					>
						Cancel
					</button>
					<button
						type="button"
						class="btn-cta"
						data-testid="plan-reset-confirm"
						onclick={confirmPlanReset}
						disabled={planResetting}
					>
						{planResetting ? 'Working...' : planConfirmDialog.confirmLabel}
					</button>
				</div>
			</div>
		</div>
	{/if}
	</div>
</PageContainer>

<style>
	.plan-page {
		min-width: 0;
	}
	.print-plan {
		display: none;
	}
	.plan-stack {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.plan-card {
		padding: 24px;
	}
	.plan-target-card {
		padding: 32px 34px 34px;
	}
	.plan-setup-shell {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.plan-setup-card {
		padding-top: 22px;
	}
	.plan-setup-card .section-eyebrow {
		margin-top: 0;
	}
	.profile-card {
		position: relative;
	}
	.plan-card-top,
	.schedule-topline,
	.growth-topline,
	.roadmap-topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}
	.goal-pill {
		display: inline-flex;
		align-items: center;
		padding: 6px 12px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.1);
		border: 1px solid rgba(81, 190, 123, 0.18);
		color: var(--primary);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.goal-pill--profile {
		background: rgba(59, 130, 246, 0.1);
		border-color: rgba(59, 130, 246, 0.18);
		color: #2563eb;
	}
	.target-actions {
		display: flex;
		align-items: center;
		gap: 14px;
	}
	.inline-action {
		border: none;
		background: none;
		padding: 0;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		text-decoration: none;
	}
	.inline-action.green {
		color: var(--primary);
	}
	.plan-kicker,
	.section-eyebrow {
		margin-top: 20px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.plan-headline {
		margin: 10px 0 0;
		font-family: var(--font-headline);
		font-size: 27px;
		font-weight: 700;
		line-height: 1.18;
		color: var(--text-dark);
	}
	.plan-copy {
		margin: 12px 0 0;
		font-family: var(--font-body);
		font-size: 17px;
		line-height: 1.75;
		color: var(--text-secondary);
	}
	.plan-copy strong,
	.print-copy strong {
		font-weight: 700;
		color: var(--text-dark);
	}
	.plan-snapshot-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
		margin-top: 20px;
	}
	.plan-snapshot-item {
		padding: 14px 16px;
		border-radius: 14px;
		background: rgba(81, 190, 123, 0.06);
		border: 1px solid rgba(81, 190, 123, 0.12);
	}
	.plan-snapshot-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.plan-snapshot-value {
		margin-top: 8px;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		line-height: 1.45;
		color: var(--text-dark);
	}
	.plan-snapshot-value--wrap {
		font-size: 14px;
	}
	.section-subcopy,
	.locked-copy {
		margin: 12px 0 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.8;
		color: var(--text-secondary);
	}
	.profile-empty-copy {
		margin-top: 18px;
		padding: 18px 20px;
		border-radius: 14px;
		background: rgba(59, 130, 246, 0.06);
		border: 1px solid rgba(59, 130, 246, 0.14);
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
	}
	.market-card {
		padding-top: 18px;
	}
	.roadmap-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 4px;
		border-radius: 999px;
		background: var(--surface-2);
		border: 1px solid var(--surface-border);
	}
	.roadmap-toggle-btn {
		border: none;
		background: transparent;
		padding: 8px 14px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		cursor: pointer;
	}
	.roadmap-toggle-btn.active {
		background: var(--surface-1);
		color: var(--text-dark);
		box-shadow: var(--shadow-sm);
	}
	.roadmap-summary-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
		margin-top: 18px;
	}
	.roadmap-summary-note {
		margin-top: 14px;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
	}
	.roadmap-progress-list {
		display: grid;
		gap: 10px;
		margin-top: 18px;
	}
	.roadmap-progress-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 16px;
		border-radius: 14px;
		border: 1px solid rgba(81, 190, 123, 0.12);
		background: rgba(81, 190, 123, 0.05);
	}
	.roadmap-progress-copy {
		min-width: 0;
	}
	.roadmap-progress-year {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.roadmap-progress-year span {
		font-weight: 500;
		color: var(--text-muted);
	}
	.roadmap-progress-meta {
		margin-top: 4px;
		font-family: var(--font-ui);
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-secondary);
	}
	.roadmap-progress-value {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--primary);
		white-space: nowrap;
	}
	.growth-topline--embedded {
		margin-top: 24px;
	}
	.roadmap-chart-copy {
		margin-top: 6px;
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
	}
	.roadmap-chart-scroll {
		margin-top: 18px;
		overflow-x: auto;
		padding-bottom: 8px;
	}
	.roadmap-chart-frame {
		min-width: 920px;
	}
	.roadmap-chart-periods,
	.roadmap-chart-grid,
	.roadmap-chart-labels {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 0;
	}
	.roadmap-chart-periods {
		margin-bottom: 14px;
	}
	.roadmap-chart-period {
		grid-column: span 5;
		padding: 10px 12px;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.roadmap-chart-period--actual {
		background: rgba(15, 23, 42, 0.05);
		color: var(--text-muted);
	}
	.roadmap-chart-period--modeled {
		background: rgba(81, 190, 123, 0.08);
		color: var(--primary);
	}
	.roadmap-chart-capital {
		height: 18px;
		margin-bottom: 10px;
		text-align: center;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
		color: rgba(15, 23, 42, 0.56);
		opacity: 0;
		transition: opacity 160ms ease;
	}
	.roadmap-chart-capital--visible {
		opacity: 1;
	}
	.roadmap-chart-canvas {
		position: relative;
		height: 280px;
	}
	.roadmap-chart-divider {
		position: absolute;
		top: 0;
		bottom: 0;
		left: 50%;
		width: 1px;
		background: rgba(148, 163, 184, 0.18);
		z-index: 1;
	}
	.roadmap-chart-target-pill {
		position: absolute;
		right: 10px;
		z-index: 4;
		padding: 4px 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.88);
		backdrop-filter: blur(8px);
		border: 1px solid rgba(148, 163, 184, 0.22);
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: rgba(100, 116, 139, 0.9);
	}
	.roadmap-line-layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		z-index: 3;
		pointer-events: none;
	}
	.roadmap-target-line {
		stroke: rgba(100, 116, 139, 0.42);
		stroke-width: 1.2;
		stroke-dasharray: 3 5;
	}
	.roadmap-metric-line {
		fill: none;
		stroke: var(--primary);
		stroke-width: 2.1;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.roadmap-metric-dot {
		fill: rgba(255, 255, 255, 0.92);
		stroke: var(--primary);
		stroke-width: 1.1;
	}
	.roadmap-metric-dot--key {
		stroke-width: 1.5;
	}
	.roadmap-chart-grid {
		position: relative;
		z-index: 2;
		height: 100%;
		align-items: end;
	}
	.roadmap-chart-column {
		display: flex;
		flex-direction: column;
		align-items: center;
	}
	.roadmap-chart-bar-shell {
		height: calc(100% - 28px);
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding: 0 10px;
	}
	.roadmap-chart-bar {
		position: relative;
		width: 100%;
		max-width: 52px;
		border-radius: 18px 18px 6px 6px;
		overflow: hidden;
		box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.16);
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(243, 246, 250, 0.98));
	}
	.roadmap-chart-bar--actual {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(241, 245, 249, 0.96));
	}
	.roadmap-chart-bar--modeled {
		background: linear-gradient(180deg, rgba(245, 252, 248, 0.98), rgba(232, 246, 238, 0.98));
	}
	.roadmap-chart-bar-fill {
		position: absolute;
		inset: 0;
		border-radius: inherit;
		background: linear-gradient(180deg, rgba(52, 94, 233, 0.16), rgba(52, 94, 233, 0.88));
		opacity: 0.88;
	}
	.roadmap-chart-bar-cap {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 16px;
		display: flex;
		overflow: hidden;
		border-bottom: 1px solid rgba(255, 255, 255, 0.22);
	}
	.roadmap-chart-cap-segment {
		display: block;
		height: 100%;
	}
	.roadmap-chart-labels {
		margin-top: 14px;
	}
	.roadmap-chart-label-group {
		text-align: center;
	}
	.roadmap-chart-year {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.roadmap-chart-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 14px;
		margin-top: 18px;
		padding-top: 14px;
		border-top: 1px solid rgba(148, 163, 184, 0.14);
	}
	.legend-line {
		display: inline-block;
		width: 18px;
		height: 0;
		border-top: 2px solid var(--primary);
	}
	.legend-line--target {
		border-top-style: dashed;
		border-top-color: rgba(100, 116, 139, 0.85);
	}
	.legend-swatch--other {
		background: rgba(148, 163, 184, 0.9);
	}
	.schedule-card--embedded {
		margin-top: 18px;
	}
	.next-move-card {
		background:
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.18), transparent 34%),
			linear-gradient(135deg, rgba(10, 30, 33, 0.98), rgba(18, 55, 43, 0.98));
		border-color: rgba(81, 190, 123, 0.28);
		color: #f7fbf8;
	}
	.next-move-kicker {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.78);
	}
	.next-move-title {
		margin: 10px 0 0;
		font-family: var(--font-headline);
		font-size: 30px;
		line-height: 1.15;
		color: #fff;
	}
	.next-move-copy {
		margin: 12px 0 0;
		font-family: var(--font-body);
		font-size: 16px;
		line-height: 1.75;
		color: rgba(241, 245, 249, 0.88);
	}
	.next-move-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 20px;
	}
	.next-move-pill {
		display: inline-flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: #e2f6ea;
	}
	.next-move-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 22px;
	}
	.next-move-card .btn-cta.secondary {
		border-color: rgba(255, 255, 255, 0.24);
		color: #fff;
	}
	.btn-cta {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px 22px;
		border-radius: 8px;
		background: var(--primary);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		border: 1px solid var(--primary);
		cursor: pointer;
	}
	.btn-cta.secondary {
		background: transparent;
		color: var(--primary);
	}
	.growth-target {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-muted);
	}
	.growth-chart {
		display: grid;
		grid-template-columns: repeat(10, minmax(0, 1fr));
		gap: 10px;
		align-items: end;
		margin-top: 18px;
		min-height: 290px;
	}
	.growth-column {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.growth-value {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.growth-bar-shell {
		height: 220px;
		width: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
	}
	.growth-bar {
		width: 100%;
		max-width: 52px;
		min-height: 10px;
		display: flex;
		flex-direction: column-reverse;
		border-radius: 0;
		overflow: hidden;
		background: rgba(81, 190, 123, 0.08);
	}
	.growth-segment {
		display: block;
		width: 100%;
	}
	.growth-label {
		text-align: center;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		line-height: 1.35;
	}
	.growth-legend {
		display: flex;
		flex-wrap: wrap;
		gap: 10px 16px;
		margin-top: 16px;
	}
	.legend-item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-secondary);
	}
	.legend-swatch {
		width: 9px;
		height: 9px;
		border-radius: 999px;
	}
	.growth-alert {
		margin-top: 16px;
		padding: 12px 14px;
		border: 1px solid rgba(245, 158, 11, 0.16);
		border-radius: 14px;
		background: rgba(245, 158, 11, 0.05);
		backdrop-filter: blur(8px);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: rgba(180, 83, 9, 0.88);
	}
	.schedule-summary {
		margin-top: 6px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.schedule-list {
		margin-top: 18px;
		border: 1px solid var(--border-light);
		border-radius: 10px;
		overflow: hidden;
	}
	.schedule-row {
		padding: 14px 18px;
		border-bottom: 1px solid var(--border-light);
	}
	.schedule-row:last-child {
		border-bottom: none;
	}
	.schedule-row-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}
	.schedule-year {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.schedule-year span {
		font-weight: 500;
		color: var(--text-muted);
	}
	.schedule-income {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--primary);
	}
	.schedule-income span {
		color: var(--text-muted);
		font-weight: 600;
	}
	.schedule-row-detail {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-top: 8px;
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-secondary);
		flex-wrap: wrap;
	}
	.schedule-bullet {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(148, 163, 184, 0.65);
	}
	.schedule-link {
		color: var(--primary);
		text-decoration: none;
		font-weight: 600;
	}
	.schedule-total {
		display: flex;
		justify-content: flex-end;
		margin-top: 14px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--primary);
	}
	.locked-card {
		text-align: center;
		padding-top: 38px;
		padding-bottom: 38px;
	}
	.locked-title,
	.empty-title {
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.locked-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 12px;
		margin-top: 22px;
		flex-wrap: wrap;
	}
	.empty-state {
		max-width: 560px;
		margin: 28px auto 0;
		padding: 42px 30px;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		text-align: center;
	}
	.empty-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 68px;
		height: 68px;
		border-radius: 20px;
		background: var(--bg-cream);
		color: var(--text-muted);
		margin-bottom: 18px;
	}
	.empty-desc {
		max-width: 460px;
		margin: 12px auto 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
	}
	.save-toast {
		margin-bottom: 14px;
		padding: 10px 14px;
		border-radius: 10px;
		background: rgba(81, 190, 123, 0.12);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--primary);
	}
	.confirm-modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 120;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		background: rgba(15, 23, 42, 0.42);
	}
	.confirm-modal {
		width: min(100%, 520px);
		padding: 24px;
		border-radius: 18px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		box-shadow: 0 28px 80px rgba(15, 23, 42, 0.18);
	}
	.confirm-modal-header h2 {
		margin: 0;
		font-family: var(--font-headline);
		font-size: 28px;
		line-height: 1.15;
		color: var(--text-dark);
	}
	.confirm-modal-copy {
		margin: 12px 0 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
	}
	.confirm-modal-error {
		margin-top: 14px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: #c0392b;
	}
	.confirm-modal-actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 22px;
	}

	.loading-skeleton {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}
	.sk-card {
		padding: 24px;
		border-radius: var(--radius);
		border: 1px solid var(--border);
		background: var(--bg-card);
	}
	.sk-bar {
		border-radius: 8px;
		background: var(--border-light, #e5e7eb);
		animation: skPulse 1.5s infinite;
	}
	@keyframes skPulse {
		0%, 100% { opacity: 0.45; }
		50% { opacity: 0.85; }
	}

	.wizard-overlay {
		position: fixed;
		inset: 0;
		z-index: 100;
		background: rgba(0, 0, 0, 0.48);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}
	.wizard-modal {
		width: 100%;
		max-width: 620px;
		max-height: 92vh;
		overflow-y: auto;
		padding: 30px;
		border-radius: 18px;
		background: var(--bg-card);
		box-shadow: 0 28px 80px rgba(15, 23, 42, 0.24);
	}
	.wizard-top {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 22px;
	}
	.wizard-progress {
		display: flex;
		gap: 8px;
	}
	.wiz-dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--border);
	}
	.wiz-dot.active {
		background: var(--primary);
		transform: scale(1.2);
	}
	.wiz-dot.done {
		background: rgba(81, 190, 123, 0.45);
	}
	.wizard-close {
		border: none;
		background: none;
		font-size: 28px;
		line-height: 1;
		color: var(--text-muted);
		cursor: pointer;
	}
	.wizard-step-title {
		font-family: var(--font-headline);
		font-size: 24px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 22px;
	}
	.goal-cards,
	.capital-chips {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}
	.goal-card,
	.capital-chip {
		width: 100%;
		text-align: left;
		padding: 18px 18px;
		border-radius: 12px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		cursor: pointer;
	}
	.goal-card.selected,
	.capital-chip.selected,
	.toggle-chip.selected {
		border-color: var(--primary);
		background: rgba(81, 190, 123, 0.08);
	}
	.goal-card-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.goal-card-desc {
		margin-top: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-secondary);
	}
	.wiz-field label,
	.summary-label {
		display: block;
		margin-bottom: 8px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.wiz-field input {
		width: 100%;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		font-size: 15px;
		box-sizing: border-box;
	}
	.wiz-hint {
		margin-top: 10px;
		font-family: var(--font-body);
		font-size: 12px;
		line-height: 1.55;
		color: var(--text-secondary);
	}
	.toggle-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}
	.toggle-chip {
		padding: 14px 12px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-card);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
	}
	.summary-card {
		border: 1px solid var(--border-light);
		border-radius: 12px;
		padding: 18px;
		background: var(--bg-cream);
	}
	.summary-row {
		padding: 12px 0;
		border-bottom: 1px solid var(--border-light);
	}
	.summary-row:last-child {
		border-bottom: none;
	}
	.summary-value {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.summary-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}
	.summary-tag {
		padding: 5px 10px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.12);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
	}
	.wiz-nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-top: 18px;
	}
	.wiz-btn-back,
	.wiz-btn-next,
	.wiz-btn-save {
		padding: 12px 20px;
		border-radius: 10px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		cursor: pointer;
	}
	.wiz-btn-back {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-secondary);
	}
	.wiz-btn-next,
	.wiz-btn-save {
		border: 1px solid var(--primary);
		background: var(--primary);
		color: #fff;
	}
	.wiz-btn-next:disabled,
	.wiz-btn-save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.print-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 24px;
		padding-bottom: 14px;
		border-bottom: 2px solid rgba(15, 23, 42, 0.9);
	}
	.print-brand {
		font-family: var(--font-headline);
		font-size: 28px;
		font-weight: 400;
		color: var(--text-dark);
	}
	.print-subbrand {
		margin-top: 4px;
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-muted);
	}
	.print-prepared {
		text-align: right;
	}
	.print-user {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.print-date {
		margin-top: 4px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
	}
	.print-hero {
		padding-top: 22px;
	}
	.print-pill {
		display: inline-flex;
		align-items: center;
		padding: 6px 12px;
		border-radius: 999px;
		border: 1px solid rgba(81, 190, 123, 0.3);
		background: rgba(81, 190, 123, 0.12);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--primary);
	}
	.print-title {
		margin: 14px 0 0;
		font-family: var(--font-headline);
		font-size: 26px;
		font-weight: 700;
		line-height: 1.2;
		color: var(--text-dark);
	}
	.print-progress {
		margin-top: 18px;
	}
	.print-progress-bar {
		height: 10px;
		border-radius: 999px;
		background: #edf2f4;
		overflow: hidden;
	}
	.print-progress-bar span {
		display: block;
		height: 100%;
		min-width: 0;
		border-radius: inherit;
		background: var(--primary);
	}
	.print-progress-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		margin-top: 8px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.print-card,
	.print-section {
		margin-top: 20px;
	}
	.print-card {
		padding: 18px 20px;
		border: 1px solid var(--border-light);
		border-radius: 14px;
		background: rgba(248, 246, 241, 0.65);
	}
	.print-lock-card {
		background: #fff;
	}
	.print-kicker,
	.print-section-title,
	.print-subsection-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.9px;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.print-section-title {
		color: #8f9aa3;
	}
	.print-subsection-title {
		margin-top: 18px;
		margin-bottom: 10px;
	}
	.print-copy,
	.print-section-copy {
		margin: 12px 0 0;
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.75;
		color: var(--text-secondary);
	}
	.print-meta-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 18px;
	}
	.print-meta-pill {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 12px;
		border: 1px solid var(--border-light);
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-secondary);
		background: #fff;
	}
	.print-meta-pill strong {
		color: var(--text-dark);
	}
	.print-table {
		width: 100%;
		margin-top: 14px;
		border-collapse: collapse;
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-dark);
	}
	.print-table th,
	.print-table td {
		padding: 10px 8px;
		text-align: left;
		border-bottom: 1px solid var(--border-light);
		vertical-align: top;
	}
	.print-table th {
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.print-asset {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.print-asset-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		border-radius: 9px;
		color: #fff;
		font-size: 10px;
		font-weight: 800;
	}
	.print-asset-name {
		font-weight: 700;
		color: var(--text-dark);
	}
	.print-asset-meta {
		margin-top: 2px;
		font-size: 11px;
		color: var(--text-muted);
	}
	.print-table tr.muted td {
		color: #a1acb3;
	}
	.print-year-row td {
		padding-top: 14px;
		font-weight: 700;
		background: rgba(248, 246, 241, 0.65);
		color: var(--text-dark);
	}
	.print-schedule-table tfoot td {
		padding-top: 14px;
		font-weight: 800;
		border-top: 2px solid rgba(15, 23, 42, 0.9);
		border-bottom: none;
	}
	.print-disclaimer {
		margin-top: 18px;
		font-family: var(--font-body);
		font-size: 10.5px;
		line-height: 1.55;
		color: var(--text-muted);
	}
	.print-footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 12px;
		margin-top: 16px;
		padding-top: 10px;
		border-top: 1px solid var(--border-light);
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-muted);
	}
	.print-footer div:last-child {
		text-align: right;
	}

	@media (max-width: 1024px) {
		.plan-snapshot-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.roadmap-summary-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.roadmap-chart-frame {
			min-width: 820px;
		}
		.roadmap-chart-bar-shell {
			padding: 0 8px;
		}
	}

	@media (max-width: 768px) {
		.plan-card,
		.plan-target-card {
			padding: 20px 18px;
		}
		.plan-card-top,
		.schedule-topline,
		.growth-topline,
		.roadmap-topline,
		.roadmap-progress-row {
			flex-direction: column;
			align-items: flex-start;
		}
		.plan-snapshot-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.roadmap-summary-grid {
			grid-template-columns: minmax(0, 1fr);
		}
		.roadmap-toggle {
			width: 100%;
			justify-content: space-between;
		}
		.roadmap-toggle-btn {
			flex: 1 1 0;
		}
		.target-actions,
		.locked-actions,
		.next-move-actions {
			width: 100%;
			justify-content: flex-start;
		}
		.roadmap-chart-frame {
			min-width: 720px;
		}
		.roadmap-chart-canvas {
			height: 240px;
		}
		.roadmap-chart-bar-shell {
			padding: 0 6px;
		}
		.roadmap-chart-target-pill {
			right: 6px;
		}
		.schedule-row-top {
			flex-direction: column;
			align-items: flex-start;
		}
		.toggle-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
		.wizard-modal {
			padding: 24px 18px;
		}
		.confirm-modal {
			padding: 20px;
		}
		.confirm-modal-actions {
			flex-direction: column-reverse;
		}
		.next-move-title {
			font-size: 24px;
		}
		.next-move-meta {
			flex-direction: column;
			align-items: stretch;
		}
		.btn-cta {
			width: 100%;
		}
	}

	@media print {
		:global(body) {
			background: #fff !important;
			-webkit-print-color-adjust: exact;
			print-color-adjust: exact;
		}
		:global(.main) {
			margin-left: 0 !important;
		}
		.ly-dashboard-topbar,
		.save-toast,
		.loading-skeleton,
		.plan-setup-shell,
		.confirm-modal-overlay,
		.wizard-overlay,
		.empty-state,
		.plan-stack {
			display: none !important;
		}
		.plan-page {
			max-width: none;
			padding: 0;
			--ly-frame-pad-desktop: 0;
			--ly-frame-pad-tablet: 0;
			--ly-frame-pad-mobile: 0;
			--ly-frame-pad-top: 0;
			--ly-frame-pad-bottom: 0;
			--ly-frame-pad-top-tablet: 0;
			--ly-frame-pad-bottom-tablet: 0;
			--ly-frame-pad-top-mobile: 0;
			--ly-frame-pad-bottom-mobile: 0;
		}
		.print-plan {
			display: block;
		}
		.print-page {
			break-after: page;
			page-break-after: always;
			padding: 0;
		}
		.print-page:last-child {
			break-after: auto;
			page-break-after: auto;
		}
		.print-card,
		.print-section,
		.print-table,
		.print-table tr,
		.print-footer {
			break-inside: avoid;
			page-break-inside: avoid;
		}
		@page {
			margin: 0.6in;
		}
	}
</style>
