<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import CompanionGate from '$lib/components/CompanionGate.svelte';
	import LegacyPlanWizard from '$lib/components/LegacyPlanWizard.svelte';
	import OnboardingAppLayout from '$lib/components/onboarding/OnboardingAppLayout.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import {
		getStoredSessionUser,
		isMember
	} from '$lib/stores/auth.js';
	import {
		currentAdminRealUser,
		getUserScopedCacheSnapshot,
		writeUserScopedJson,
		writeUserScopedString
	} from '$lib/utils/userScopedState.js';
	import { browser } from '$app/environment';
	import { isNativeApp } from '$lib/utils/platform.js';
	import { hasCompletedPlan, normalizeWizardData } from '$lib/onboarding/planWizard.js';

	let hasPlan = $state(false);
	let loading = $state(true);
	let plan = $state(null);
	let portfolio = $state([]);
	let showWizard = $state(false);
	let saving = $state(false);
	let saveMsg = $state('');
	let shouldOpenWizardFromLocation = false;
	let wizardForceEdit = $state(false);
	let wizardStage = $state('');
	let wizardBranch = $state('');
	let wizardFlowKey = $state('');
	let reportUser = $state(null);
	let portfolioPlan = $state(null);
	let marketSnapshot = $state({ rows: [], total: 0, newThisMonth: 0, loaded: false });
	const nativeCompanionMode = browser && isNativeApp();

	const canViewAnalytics = $derived($isMember);

	let wizardStep = $state(0);
	let wizardData = $state(normalizeWizardData({}));

	const assetClassOptions = [
		'Single Family',
		'Hotels/Hospitality',
		'Business / Other',
		'RV/Mobile Home Parks',
		'Lending',
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

	const goalLabels = {
		cashflow: 'Build Passive Income',
		growth: 'Build Long-Term Wealth',
		tax: 'Reduce Taxable Income'
	};

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
		'lending': { label: 'Lending', color: '#2563eb', icon: 'L', irrMin: 6.0, irrMax: 25.0, cashYield: 11.4, lockup: 1.5, dealCount: 106, newestDays: 5 },
		'selfstorage': { label: 'Self Storage', color: '#3b82f6', icon: 'SS', irrMin: 10.2, irrMax: 24.3, cashYield: 9.2, lockup: 4.2, dealCount: 22, newestDays: 11 },
		'multifamily': { label: 'Multi-Family', color: '#f59e0b', icon: 'MF', irrMin: 11.8, irrMax: 22.4, cashYield: 8.4, lockup: 4.6, dealCount: 34, newestDays: 9 },
		'retail': { label: 'Retail', color: '#ef4444', icon: 'RT', irrMin: 9.4, irrMax: 19.5, cashYield: 8.7, lockup: 4.8, dealCount: 9, newestDays: 16 },
		'leasebuyback': { label: 'Lease Buy Back', color: '#8b5cf6', icon: 'LB', irrMin: 10.1, irrMax: 17.8, cashYield: 10.1, lockup: 3.2, dealCount: 6, newestDays: 22 },
		'oilgas': { label: 'Oil & Gas', color: '#ec4899', icon: 'OG', irrMin: 14.2, irrMax: 31.0, cashYield: 13.1, lockup: 4.0, dealCount: 7, newestDays: 18 }
	};

	const goalDefaults = {
		cashflow: ['Single Family', 'Hotels/Hospitality', 'Business / Other', 'RV/Mobile Home Parks', 'Lending'],
		growth: ['Multi-Family', 'Self Storage', 'Hotels/Hospitality', 'Retail'],
		tax: ['Oil & Gas', 'Multi-Family', 'RV/Mobile Home Parks', 'Lending']
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

	function formatLockup(value) {
		return `${Number(value || 0).toFixed(value % 1 === 0 ? 0 : 1)} yrs`;
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

	function shouldAutoOpenWizard() {
		if (!browser) return false;
		const params = new URLSearchParams(window.location.search);
		const hash = window.location.hash.replace('#', '').toLowerCase();
		return (
			['1', 'true', 'yes'].includes((params.get('edit') || '').toLowerCase()) ||
			['1', 'true', 'yes'].includes((params.get('wizard') || '').toLowerCase()) ||
			Boolean(params.get('stage')) ||
			Boolean(params.get('flow')) ||
			hash === 'edit' ||
			hash === 'buybox'
		);
	}

	function openWizard(editMode = hasPlan) {
		if (!hasPlan) {
			goto('/onboarding/plan');
			return;
		}
		wizardForceEdit = editMode;
		showWizard = true;
	}

	function syncWizardView(detail = {}) {
		const nextWizard = normalizeWizardData(detail.wizardData || wizardData || {});
		wizardData = nextWizard;
		plan = nextWizard;
		if (detail.persistedPortfolioPlan && detail.portfolioPlan) {
			portfolioPlan = detail.portfolioPlan;
			writeUserScopedJson('gycPortfolioPlan', detail.portfolioPlan);
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
			...emphasisSegment(currency(estimateCheckSize(plan?.investableCapital || wizardData.investableCapital))),
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
			const assets = reportRelevantAssets;
			const checkSize = plannedCheckSize;
			let cancelled = false;

			if (assets.length === 0) {
				marketSnapshot = { rows: [], total: 0, newThisMonth: 0, loaded: true };
				return;
			}

			const params = new URLSearchParams();
			params.set('asset_classes', assets.join(','));
			if (checkSize) params.set('check_size', String(checkSize));

			void (async () => {
				try {
					const response = await fetch(`/api/plan-market-snapshot?${params.toString()}`);
					if (!response.ok) throw new Error('snapshot failed');
					const data = await response.json();
					if (!cancelled) {
						marketSnapshot = {
							rows: data?.rows || [],
							total: data?.total || 0,
							newThisMonth: data?.newThisMonth || 0,
							loaded: true
						};
					}
				} catch {
					if (!cancelled) {
						marketSnapshot = { rows: [], total: 0, newThisMonth: 0, loaded: false };
					}
				}
			})();

			return () => {
				cancelled = true;
			};
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
				matches: profile.dealCount,
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

	const legendItems = $derived.by(() => {
		const labels = new Set();
		projection.bars.forEach((bar) => {
			bar.segments.forEach((segment) => labels.add(segment.label));
		});
		return [...labels].map((label) => ({
			label,
			color: getAssetProfile(label).color
		}));
	});

	const concentrationAlert = $derived.by(() => {
		if (!projection.finalShare || projection.finalShare.share < 45) return null;
		return `${Math.round(projection.finalShare.share)}% in ${projection.finalShare.label} plan targets 45% or less. Consider diversifying.`;
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

	onMount(async () => {
		if (!browser) return;
		shouldOpenWizardFromLocation = shouldAutoOpenWizard();
		const params = new URLSearchParams(window.location.search);
		wizardStage = params.get('stage') || '';
		wizardBranch = params.get('branch') || '';
		wizardFlowKey = params.get('flow') || '';
		wizardForceEdit = ['1', 'true', 'yes'].includes((params.get('edit') || '').toLowerCase());
		const snapshot = getUserScopedCacheSnapshot();
		portfolio = snapshot.portfolio;
		reportUser = getStoredSessionUser();
		portfolioPlan = snapshot.portfolioPlan;
		wizardData = normalizeWizardData(snapshot.buyBoxWizard || {});
		plan = wizardData;
		hasPlan = hasCompletedPlan(wizardData, portfolioPlan);

		try {
			const stored = getStoredSessionUser();
			if (!stored?.token) {
				loading = false;
				if (shouldOpenWizardFromLocation || !hasPlan) openWizard(wizardForceEdit);
				return;
			}
			const realUser = currentAdminRealUser();
			const isAdminImpersonation = !!realUser?.email && realUser.email.toLowerCase() !== stored.email.toLowerCase();
			const buyBoxUrl = new URL('/api/buybox', window.location.origin);
			buyBoxUrl.searchParams.set('email', stored.email);
			if (isAdminImpersonation) buyBoxUrl.searchParams.set('admin', 'true');
			const controller = new AbortController();
			const timeout = window.setTimeout(() => controller.abort(), 8000);

			const response = await fetch(buyBoxUrl.pathname + buyBoxUrl.search, {
				headers: { Authorization: `Bearer ${stored.token}` },
				signal: controller.signal
			});
			window.clearTimeout(timeout);

			if (response.ok) {
				const data = await response.json();
				if (data?.buyBox && Object.keys(data.buyBox).length > 0) {
					wizardData = normalizeWizardData(data.buyBox);
					plan = wizardData;
					hasPlan = hasCompletedPlan(wizardData, portfolioPlan);
				}
			}
		} catch (error) {
			console.warn('Failed to load plan:', error);
		} finally {
			loading = false;
			if (!hasPlan && !wizardStage && !wizardFlowKey) {
				goto('/onboarding/plan', { replaceState: true });
				return;
			}
			if ((shouldOpenWizardFromLocation || !hasPlan) && !showWizard) openWizard(wizardForceEdit && hasPlan);
		}
	});
</script>

<svelte:head>
	<title>My Plan | GYC</title>
</svelte:head>

<PageContainer className="plan-shell ly-page-stack">
	<PageHeader title="My Plan" className="dashboard-page-header">
		<nav slot="secondaryRow" class="ly-dashboard-tabs" aria-label="Dashboard sections">
			<a href="/app/dashboard" class="ly-dashboard-tab" data-sveltekit-reload>Overview</a>
			<a href="/app/portfolio" class="ly-dashboard-tab" data-sveltekit-reload>Portfolio</a>
			<a href="/app/plan" class="ly-dashboard-tab active" data-sveltekit-reload>My Plan</a>
		</nav>
	</PageHeader>

	<div class="plan-page">
	{#if saveMsg && !(showWizard || !hasPlan)}
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
	{:else if showWizard || !hasPlan}
		<OnboardingAppLayout>
			<LegacyPlanWizard
				initialData={wizardData}
				forceEdit={wizardForceEdit}
				forcedStage={wizardStage}
				forcedBranch={wizardBranch}
				forcedFlowKey={wizardFlowKey}
				on:state={handleWizardState}
				on:complete={handleWizardComplete}
			/>
		</OnboardingAppLayout>
	{:else}
		<div class="plan-stack">
			<section class="plan-card plan-target-card">
				<div class="plan-card-top">
					<span class="goal-pill">{targetBadge}</span>
					<div class="target-actions">
						<button class="inline-action" onclick={printPlan}>Print</button>
						<button class="inline-action" onclick={openWizard}>Edit</button>
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
			</section>

			{#if canViewAnalytics}
				<section class="plan-card market-card">
					<div class="section-eyebrow">Market Snapshot</div>
					<div class="section-subcopy">Deals in the database right now that line up with your selected asset classes.</div>
					<div class="snapshot-table">
						<div class="snapshot-head snapshot-row">
							<div>Asset Class</div>
							<div>Target IRR</div>
							<div>Cash Yield</div>
							<div>Avg Lockup</div>
							<div>Newest Deal</div>
						</div>
						{#each snapshotRows as row}
							<div class="snapshot-row">
								<div class="snapshot-asset">
									<span class="snapshot-icon" style={`background:${row.color}`}>{row.icon}</span>
									<div>
										<div class="snapshot-name">{row.label}</div>
										<div class="snapshot-meta">{row.dealCount} deals</div>
									</div>
								</div>
								<div>{percent(row.irrMin)} - {percent(row.irrMax)}</div>
								<div>{percent(row.cashYield)}</div>
								<div>{formatLockup(row.lockup)}</div>
								<div>{row.newestDays} days ago</div>
							</div>
						{/each}
					</div>
					<div class="market-footer">
						<div class="market-match-total">{totalMatches} total deals match</div>
						<a href="/app/deals" class="browse-btn">Browse Matching Deals →</a>
						<div class="market-match-new">{totalNewMatches} new this month</div>
					</div>
				</section>

				<section class="plan-card growth-card">
					<div class="growth-topline">
						<div class="section-eyebrow">Portfolio Growth By Asset Class</div>
						<div class="growth-target">{compactCurrency(projection.finalBar?.total || 0)} target</div>
					</div>
					<div class="growth-chart">
						{#each projection.bars as bar}
							<div class="growth-column">
								<div class="growth-value">{compactCurrency(bar.total)}</div>
								<div class="growth-bar-shell">
									<div class="growth-bar" style={`height:${Math.max(10, (bar.total / projection.maxTotal) * 100)}%`}>
										{#each bar.segments as segment}
											<span class="growth-segment" style={`height:${bar.total > 0 ? (segment.amount / bar.total) * 100 : 0}%; background:${segment.color}`}></span>
										{/each}
									</div>
								</div>
								<div class="growth-label">{bar.label}</div>
							</div>
						{/each}
					</div>
					<div class="growth-legend">
						{#each legendItems as item}
							<div class="legend-item">
								<span class="legend-swatch" style={`background:${item.color}`}></span>
								<span>{item.label}</span>
							</div>
						{/each}
					</div>
					{#if concentrationAlert}
						<div class="growth-alert">{concentrationAlert}</div>
					{/if}
				</section>

				<section class="plan-card schedule-card">
					<div class="schedule-topline">
						<div>
							<div class="section-eyebrow">Your Investment Plan</div>
							<div class="schedule-summary">{currentInvestmentCount} of 9 investments · {currency(currentInvestedTotal)} deployed</div>
						</div>
						<button class="inline-action green" onclick={openWizard}>Edit Plan</button>
					</div>
					<div class="schedule-list">
						{#each projection.years as item}
							<div class="schedule-row">
								<div class="schedule-row-top">
									<div class="schedule-year">Year {item.index} <span>({item.year})</span></div>
									<div class="schedule-income">{currency(item.cumulativeIncome)}/yr <span>{item.progressPct}%</span></div>
								</div>
								<div class="schedule-row-detail">
									<span class="schedule-bullet"></span>
									{item.profile.label} · {currency(item.checkSize)} · ~{percent(item.profile.cashYield)} · ~{currency(item.income)}/yr
									<a href="/app/deals" class="schedule-link">{item.matches} matches</a>
								</div>
							</div>
						{/each}
					</div>
					<div class="schedule-total">{projection.years.length} deals · {currency(projection.checkSize)} avg check · {currency(projection.years[projection.years.length - 1]?.cumulativeIncome || 0)}/yr</div>
				</section>
			{:else}
				<section class="plan-card locked-card">
					<div class="locked-title">
						{nativeCompanionMode ? 'Advanced plan analytics stay on the web' : 'Advanced plan analytics are for members and admins'}
					</div>
					<div class="locked-copy">
						{#if nativeCompanionMode}
							Free users can still build and edit a plan in the iOS app. Market snapshots, projection bars, and deployment schedules remain available to existing members on the web.
						{:else}
							Free users can still build and edit a plan, but the market snapshot, projection bars, and year-by-year deployment schedule stay locked until upgrade.
						{/if}
					</div>
					<div class="locked-actions">
						<button class="btn-cta secondary" onclick={openWizard}>Update Plan</button>
						{#if nativeCompanionMode}
							<CompanionGate
								compact={true}
								title="Available to existing members"
								message="Advanced projections and market snapshots stay available to existing members on the web."
							/>
						{:else}
							<a href="/app/academy" class="btn-cta">Unlock Full Plan</a>
						{/if}
					</div>
				</section>
			{/if}
		</div>

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
						<div class="print-section-title">Market Snapshot - {reportMatchTotal} Matching Deals</div>
						<div class="print-section-copy">
							{reportMatchTotal} active offerings match your criteria on the Grow Your Cashflow platform as of {preparedOn}.
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
						<p class="print-copy">Market snapshot and deployment schedule print views are only included for member and admin accounts.</p>
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
		background: var(--bg-card);
		border: 1px solid #d7e2e7;
		border-radius: 16px;
		padding: 24px;
		box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
	}
	.plan-target-card {
		padding: 32px 34px 34px;
	}
	.plan-card-top,
	.schedule-topline,
	.growth-topline {
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
	.section-subcopy,
	.locked-copy {
		margin: 12px 0 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.8;
		color: var(--text-secondary);
	}
	.market-card {
		padding-top: 18px;
	}
	.snapshot-table {
		margin-top: 18px;
		border-top: 1px solid var(--border-light);
	}
	.snapshot-row {
		display: grid;
		grid-template-columns: minmax(240px, 1.6fr) 1fr 1fr 1fr 1fr;
		align-items: center;
		gap: 12px;
		padding: 14px 0;
		border-bottom: 1px solid var(--border-light);
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-dark);
	}
	.snapshot-head {
		padding-top: 12px;
		padding-bottom: 12px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.snapshot-asset {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.snapshot-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		color: #fff;
		font-size: 11px;
		font-weight: 700;
	}
	.snapshot-name {
		font-weight: 700;
		color: var(--text-dark);
	}
	.snapshot-meta {
		margin-top: 2px;
		font-size: 12px;
		color: var(--text-muted);
	}
	.market-footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		padding-top: 18px;
	}
	.market-match-total {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.market-match-new {
		text-align: right;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
	}
	.browse-btn,
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
		width: 10px;
		height: 10px;
		border-radius: 3px;
	}
	.growth-alert {
		margin-top: 16px;
		padding: 12px 14px;
		border: 1px solid rgba(245, 158, 11, 0.24);
		border-radius: 10px;
		background: rgba(245, 158, 11, 0.08);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: #b45309;
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
		.snapshot-row {
			grid-template-columns: minmax(200px, 1.8fr) repeat(4, minmax(0, 1fr));
		}
		.growth-chart {
			gap: 8px;
		}
	}

	@media (max-width: 768px) {
		.plan-card,
		.plan-target-card {
			padding: 20px 18px;
		}
		.plan-card-top,
		.schedule-topline,
		.market-footer,
		.growth-topline {
			flex-direction: column;
			align-items: flex-start;
		}
		.target-actions,
		.locked-actions {
			width: 100%;
			justify-content: flex-start;
		}
		.snapshot-table {
			border-top: none;
		}
		.snapshot-head {
			display: none;
		}
		.snapshot-row {
			grid-template-columns: 1fr;
			gap: 6px;
			padding: 14px 0;
		}
		.growth-chart {
			grid-template-columns: repeat(5, minmax(0, 1fr));
			row-gap: 18px;
		}
		.growth-bar-shell {
			height: 180px;
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
		.browse-btn,
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
