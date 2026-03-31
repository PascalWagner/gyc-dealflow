<script>
	import { onMount } from 'svelte';
	import PipelineTabs from '$lib/components/PipelineTabs.svelte';
	import DealCard from '$lib/components/DealCard.svelte';
	import DealFlowViewToggle from '$lib/components/DealFlowViewToggle.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import DealMap from '$lib/components/DealMap.svelte';
	import CompareView from '$lib/components/CompareView.svelte';
	import RequestIntroductionModal from '$lib/components/RequestIntroductionModal.svelte';
	import SwipeFeed from '$lib/components/SwipeFeed.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import {
		dealStages,
		compareDealIds,
		dealFlowViewMode,
		stageCounts,
		memberDeals,
		memberDealsLoading,
		memberDealsLoadingMore,
		memberDealsError,
		memberDealsMeta,
		fetchMemberDeals,
		loadMoreMemberDeals,
		queryMemberDeals,
		MAX_COMPARE_DEALS,
		STAGE_META
	} from '$lib/stores/deals.js';
	import { accessTier, getStoredSessionUser, isAdmin } from '$lib/stores/auth.js';
	import {
		buildDealCardFooterAnalyticsPayload,
		buildDealCardUtilityAnalyticsPayload,
		DEAL_CARD_UTILITY_ACTIONS,
		getDealCardActionModel,
		getDealCardUtilityActionLabel,
		trackDealCardFooterActionClick,
		trackDealCardRequestIntroOpened,
		trackDealCardUtilityActionClick,
		trackDealCardViewDeckClicked
	} from '$lib/utils/dealCardUtilityAction.js';
	import { getUiStage } from '$lib/utils/dealflow-contract.js';
	import { openDealDeckInNewTab } from '$lib/utils/dealDocuments.js';
	import { getDealIntroductionRequestGate } from '$lib/utils/dealIntroRequests.js';
	import { notifySuccess } from '$lib/utils/haptics.js';
	import {
		currentAdminRealUser,
		readUserScopedJson,
		writeUserScopedJson
	} from '$lib/utils/userScopedState.js';
	import { browser } from '$app/environment';
	import { isNativeApp } from '$lib/utils/platform.js';

	let currentTab = $state('filter');
	let isMobile = $state(false);
	let buyBox = $state(null);
	let filterAnchor = $state(null);
	let filtersReady = $state(false);
	let pageNotice = $state('');
	let pageNoticeVisible = $state(false);
	let compareDealsLoading = $state(false);
	let compareSelectedDeals = $state([]);
	let pendingFooterActionByDealId = $state({});
	let pageNoticeTimer = null;
	let compareRequestId = 0;
	let showIntroModal = $state(false);
	let introRequestDeal = $state(null);

	let dailyDealCount = $state(0);
	let showLimitModal = $state(false);
	const DAILY_LIMIT = 20;
	const nativeCompanionMode = browser && isNativeApp();
	const todayKey = $derived(browser ? `gycDailyDeals_${new Date().toISOString().slice(0, 10)}` : '');
	const isFreeUser = $derived($accessTier === 'free');
	const dealsRemaining = $derived(Math.max(0, DAILY_LIMIT - dailyDealCount));

	let search = $state('');
	let assetClass = $state('');
	let dealType = $state('');
	let strategy = $state('');
	let status = $state('');
	let maxInvest = $state('');
	let maxLockup = $state('');
	let distributions = $state('');
	let minIRR = $state('');
	let sortBy = $state('newest');
	let showArchived = $state(false);
	let buyBoxApplied = $state(false);

	const BUY_BOX_DEAL_TYPES = new Set(['fund', 'syndication', 'reit', '1031 exchange', 'joint venture', 'note/debt', 'other']);
	const UI_STAGE_TABS = new Set(['filter', 'review', 'connect', 'decide', 'invested', 'skipped']);

	function loadDailyCount() {
		if (!browser) return;
		const stored = readUserScopedJson(todayKey, []);
		dailyDealCount = stored.length;
	}

	function trackDealView(dealId) {
		if (!browser || !isFreeUser) return;
		let stored = readUserScopedJson(todayKey, []);
		if (!stored.includes(dealId)) {
			stored.push(dealId);
			writeUserScopedJson(todayKey, stored);
			dailyDealCount = stored.length;
		}
		if (dailyDealCount >= DAILY_LIMIT) {
			showLimitModal = true;
		}
	}

	function normalizeMatchValue(value) {
		return String(value || '').trim().toLowerCase();
	}

	function getBuyBoxCheckSize(inputBuyBox) {
		const directCheckSize = Number(inputBuyBox?.checkSize);
		if (Number.isFinite(directCheckSize) && directCheckSize > 0) return directCheckSize;

		const investableCapital = String(inputBuyBox?.investableCapital || inputBuyBox?._capitalRange || '').trim();
		if (!investableCapital.includes('-')) return 0;

		const rangeParts = investableCapital
			.split('-')
			.map((part) => parseInt(part, 10))
			.filter(Number.isFinite);

		return rangeParts[rangeParts.length - 1] || 0;
	}

	function getBuyBoxSelections(inputBuyBox) {
		const combinedSelections = [
			...(Array.isArray(inputBuyBox?.strategies) ? inputBuyBox.strategies : []),
			...(Array.isArray(inputBuyBox?.dealTypes) ? inputBuyBox.dealTypes : [])
		]
			.map(normalizeMatchValue)
			.filter(Boolean);

		const dealTypes = combinedSelections.filter((value) => BUY_BOX_DEAL_TYPES.has(value));
		const strategies = combinedSelections.filter((value) => !BUY_BOX_DEAL_TYPES.has(value));

		return { dealTypes, strategies };
	}

	function applyLocationFilters() {
		if (!browser) return;

		const params = new URLSearchParams(window.location.search);
		const hash = window.location.hash.replace('#', '').toLowerCase();
		const wantsBuyBox = ['1', 'true', 'yes'].includes((params.get('buybox') || '').toLowerCase()) || hash === 'buybox';
		const company = params.get('company');
		const q = params.get('q');
		const requestedTab = String(params.get('tab') || '').trim().toLowerCase();

		if (UI_STAGE_TABS.has(requestedTab)) currentTab = requestedTab;

		if (company && !search) search = company;
		if (q && !search) search = q;

		if (!wantsBuyBox) return;

		buyBoxApplied = true;

		if (hash === 'buybox') {
			params.set('buybox', '1');
			const nextSearch = params.toString();
			window.history.replaceState({}, '', `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}`);
		}

		requestAnimationFrame(() => {
			filterAnchor?.scrollIntoView({ behavior: 'smooth', block: 'start' });
		});
	}

	function syncTabInUrl(tab) {
		if (!browser) return;
		const params = new URLSearchParams(window.location.search);
		if (tab === 'filter') params.delete('tab');
		else params.set('tab', tab);
		const nextSearch = params.toString();
		const nextUrl = `${window.location.pathname}${nextSearch ? `?${nextSearch}` : ''}${window.location.hash}`;
		window.history.replaceState({}, '', nextUrl);
	}

	async function loadBuyBox() {
		if (!browser) return;

		try {
			const storedBuyBox = readUserScopedJson('gycBuyBoxWizard', {});
			if (storedBuyBox && Object.keys(storedBuyBox).length > 0) {
				buyBox = storedBuyBox;
			}
		} catch {}

		try {
			const storedUser = getStoredSessionUser();
			if (!storedUser?.token || !storedUser?.email) return;
			const realUser = currentAdminRealUser();
			const isAdminImpersonation = !!realUser?.email && realUser.email.toLowerCase() !== storedUser.email.toLowerCase();
			const buyBoxUrl = new URL('/api/buybox', window.location.origin);
			buyBoxUrl.searchParams.set('email', storedUser.email);
			if (isAdminImpersonation) buyBoxUrl.searchParams.set('admin', 'true');

			const res = await fetch(buyBoxUrl.pathname + buyBoxUrl.search, {
				headers: { Authorization: 'Bearer ' + storedUser.token }
			});

			if (!res.ok) return;

			const data = await res.json();
			const nextBuyBox = data?.buyBox || data;
			if (nextBuyBox && Object.keys(nextBuyBox).length > 0) {
				buyBox = nextBuyBox;
			}
		} catch {}
	}

	function applyBuyBoxFilters(dealsList) {
		if (!buyBoxApplied || !buyBox) return dealsList;

		let result = dealsList;
		const assetPreferences = (Array.isArray(buyBox.assetClasses) ? buyBox.assetClasses : [])
			.map(normalizeMatchValue)
			.filter(Boolean);
		const buyBoxCheckSize = getBuyBoxCheckSize(buyBox);
		const { dealTypes: buyBoxDealTypes, strategies: buyBoxStrategies } = getBuyBoxSelections(buyBox);
		const buyBoxDistribution = normalizeMatchValue(buyBox.distributions);
		const buyBoxMinIrr = Number(buyBox.minIRR || 0);
		const buyBoxMaxLockup = Number(buyBox.maxLockup || 0);

		if (assetPreferences.length) {
			result = result.filter((deal) => {
				const dealAssetClasses = (Array.isArray(deal.assetClass) ? deal.assetClass : [deal.assetClass])
					.map(normalizeMatchValue)
					.filter(Boolean);
				return assetPreferences.some((assetClassPreference) => dealAssetClasses.includes(assetClassPreference));
			});
		}

		if (buyBoxStrategies.length || buyBoxDealTypes.length) {
			result = result.filter((deal) => {
				const dealStrategy = normalizeMatchValue(deal.strategy);
				const normalizedDealType = normalizeMatchValue(deal.dealType);
				const dealAssetClasses = (Array.isArray(deal.assetClass) ? deal.assetClass : [deal.assetClass])
					.map(normalizeMatchValue)
					.filter(Boolean);
				const strategyMatch = buyBoxStrategies.length
					? buyBoxStrategies.some((preference) => dealStrategy === preference || dealAssetClasses.includes(preference))
					: false;
				const dealTypeMatch = buyBoxDealTypes.length ? buyBoxDealTypes.includes(normalizedDealType) : false;

				if (buyBoxStrategies.length && buyBoxDealTypes.length) return strategyMatch || dealTypeMatch;
				return buyBoxStrategies.length ? strategyMatch : dealTypeMatch;
			});
		}

		if (buyBoxCheckSize > 0) {
			result = result.filter((deal) => {
				const dealMinimum = Number(deal.investmentMinimum || deal.minimumInvestment || 0);
				return dealMinimum > 0 ? dealMinimum <= buyBoxCheckSize : true;
			});
		}

		if (buyBoxMaxLockup > 0) {
			result = result.filter((deal) => {
				const holdPeriod = parseFloat(deal.holdPeriod);
				return Number.isFinite(holdPeriod) ? holdPeriod <= buyBoxMaxLockup : true;
			});
		}

		if (buyBoxMinIrr > 0) {
			const normalizedMinIrr = buyBoxMinIrr <= 1 ? buyBoxMinIrr * 100 : buyBoxMinIrr;
			result = result.filter((deal) => {
				const dealTargetIrr = Number(deal.targetIRR || 0);
				if (!dealTargetIrr) return false;
				const normalizedDealIrr = dealTargetIrr <= 1 ? dealTargetIrr * 100 : dealTargetIrr;
				return normalizedDealIrr >= normalizedMinIrr;
			});
		}

		if (buyBoxDistribution) {
			result = result.filter((deal) => {
				const dealDistribution = normalizeMatchValue(deal.distributions || deal.distributionFrequency);
				return dealDistribution ? dealDistribution === buyBoxDistribution : true;
			});
		}

		return result;
	}

	function getEffectiveBrowseFilters() {
		if (!buyBoxApplied || !buyBox) {
			return { search, assetClass, dealType, strategy, status, maxInvest, maxLockup, distributions, minIRR };
		}

		const { dealTypes: buyBoxDealTypes, strategies: buyBoxStrategies } = getBuyBoxSelections(buyBox);
		const buyBoxDistribution = String(buyBox.distributions || '').trim();
		const buyBoxCheckSize = getBuyBoxCheckSize(buyBox);
		const buyBoxMaxLockup = Number(buyBox.maxLockup || 0);
		const buyBoxMinIrr = Number(buyBox.minIRR || 0);
		const buyBoxAssetClasses = Array.isArray(buyBox.assetClasses) ? buyBox.assetClasses.filter(Boolean) : [];

		return {
			search,
			assetClass: assetClass || (buyBoxAssetClasses.length === 1 ? buyBoxAssetClasses[0] : ''),
			dealType: dealType || (buyBoxDealTypes.length === 1 ? buyBox.dealTypes?.[0] || '' : ''),
			strategy: strategy || (buyBoxStrategies.length === 1 ? buyBox.strategies?.[0] || '' : ''),
			status,
			maxInvest: maxInvest || (buyBoxCheckSize > 0 ? String(buyBoxCheckSize) : ''),
			maxLockup: maxLockup || (buyBoxMaxLockup > 0 ? String(buyBoxMaxLockup) : ''),
			distributions: distributions || buyBoxDistribution,
			minIRR: minIRR || (buyBoxMinIrr > 0 ? String(buyBoxMinIrr <= 1 ? buyBoxMinIrr : buyBoxMinIrr / 100) : '')
		};
	}

	function switchTab(tab) {
		currentTab = tab;
		syncTabInUrl(tab);
	}

	function switchView(mode) {
		dealFlowViewMode.set(mode);
	}

	function handleAddDeal() {
		if (!browser) return;
		window.location.href = '/app/admin/manage';
	}

	function showPageNotice(message) {
		if (!browser) return;
		pageNotice = message;
		pageNoticeVisible = true;
		if (pageNoticeTimer) window.clearTimeout(pageNoticeTimer);
		pageNoticeTimer = window.setTimeout(() => {
			pageNoticeVisible = false;
		}, 2600);
	}

	function getComparePlanFit(deal) {
		if (!deal || !buyBox) return { label: 'Not set', score: null };

		const checks = [];
		const assetPreferences = (Array.isArray(buyBox.assetClasses) ? buyBox.assetClasses : [])
			.map(normalizeMatchValue)
			.filter(Boolean);
		const buyBoxCheckSize = getBuyBoxCheckSize(buyBox);
		const { dealTypes: buyBoxDealTypes, strategies: buyBoxStrategies } = getBuyBoxSelections(buyBox);
		const buyBoxDistribution = normalizeMatchValue(buyBox.distributions);
		const buyBoxMinIrr = Number(buyBox.minIRR || 0);
		const buyBoxMaxLockup = Number(buyBox.maxLockup || 0);

		if (assetPreferences.length) {
			const dealAssetClasses = (Array.isArray(deal.assetClass) ? deal.assetClass : [deal.assetClass])
				.map(normalizeMatchValue)
				.filter(Boolean);
			checks.push(assetPreferences.some((assetClassPreference) => dealAssetClasses.includes(assetClassPreference)));
		}

		if (buyBoxStrategies.length || buyBoxDealTypes.length) {
			const dealStrategy = normalizeMatchValue(deal.strategy);
			const normalizedDealType = normalizeMatchValue(deal.dealType);
			const dealAssetClasses = (Array.isArray(deal.assetClass) ? deal.assetClass : [deal.assetClass])
				.map(normalizeMatchValue)
				.filter(Boolean);
			const strategyMatch = buyBoxStrategies.length
				? buyBoxStrategies.some((preference) => dealStrategy === preference || dealAssetClasses.includes(preference))
				: false;
			const dealTypeMatch = buyBoxDealTypes.length ? buyBoxDealTypes.includes(normalizedDealType) : false;

			checks.push(
				buyBoxStrategies.length && buyBoxDealTypes.length
					? strategyMatch || dealTypeMatch
					: buyBoxStrategies.length
						? strategyMatch
						: dealTypeMatch
			);
		}

		if (buyBoxCheckSize > 0) {
			const dealMinimum = Number(deal.investmentMinimum || deal.minimumInvestment || 0);
			if (dealMinimum > 0) checks.push(dealMinimum <= buyBoxCheckSize);
		}

		if (buyBoxMaxLockup > 0) {
			const holdPeriod = parseFloat(deal.holdPeriod);
			if (Number.isFinite(holdPeriod)) checks.push(holdPeriod <= buyBoxMaxLockup);
		}

		if (buyBoxMinIrr > 0) {
			const dealTargetIrr = Number(deal.targetIRR || 0);
			if (dealTargetIrr > 0) {
				const normalizedMinIrr = buyBoxMinIrr <= 1 ? buyBoxMinIrr * 100 : buyBoxMinIrr;
				const normalizedDealIrr = dealTargetIrr <= 1 ? dealTargetIrr * 100 : dealTargetIrr;
				checks.push(normalizedDealIrr >= normalizedMinIrr);
			}
		}

		if (buyBoxDistribution) {
			const dealDistribution = normalizeMatchValue(deal.distributions || deal.distributionFrequency);
			if (dealDistribution) checks.push(dealDistribution === buyBoxDistribution);
		}

		if (checks.length === 0) return { label: 'Not set', score: null };

		const matched = checks.filter(Boolean).length;
		const total = checks.length;
		const score = Math.round((matched / total) * 100);

		return {
			label: `${matched}/${total} match`,
			score
		};
	}

	const hasActiveFilters = $derived(
		!!search || !!assetClass || !!dealType || !!strategy || !!status || !!maxInvest || !!maxLockup || !!distributions || !!minIRR || sortBy !== 'newest' || showArchived || buyBoxApplied
	);

	const stageDealIds = $derived.by(() => {
		const grouped = { review: [], connect: [], decide: [], invested: [], skipped: [] };
		for (const [dealId, stage] of Object.entries($dealStages || {})) {
			const uiStage = getUiStage(stage);
			if (grouped[uiStage]) grouped[uiStage].push(dealId);
		}
		return grouped;
	});

	const currentTabIds = $derived(currentTab === 'filter' ? [] : (stageDealIds[currentTab] || []));
	const excludedBrowseIds = $derived(Object.keys($dealStages || {}));
	const effectiveFilters = $derived(getEffectiveBrowseFilters());

	const filteredDeals = $derived.by(() => {
		const scopedDeals = currentTab === 'filter'
			? ($memberDeals || [])
			: ($memberDeals || []).filter((deal) => currentTabIds.includes(deal.id));
		return applyBuyBoxFilters(scopedDeals);
	});
	const compareDealSet = $derived(new Set($compareDealIds));
	const compareRemaining = $derived(Math.max(0, MAX_COMPARE_DEALS - $compareDealIds.length));
	const compareModeActive = $derived($dealFlowViewMode === 'compare');
	const utilityUserRole = $derived.by(() => {
		const session = getStoredSessionUser() || {};
		if (session.roleFlags?.admin) return 'admin';
		if (session.roleFlags?.gp) return 'gp';
		if (session.roleFlags?.lp) return 'lp';
		return $accessTier || '';
	});
	const comparePlanFitById = $derived.by(() =>
		Object.fromEntries(compareSelectedDeals.map((deal) => [deal.id, getComparePlanFit(deal)]))
	);
	const totalMatchingDeals = $derived($memberDealsMeta.total || filteredDeals.length);

	const stageDescriptions = {
		filter: {
			title: 'Filter',
			text: 'Browse new opportunities. Move strong deals to Review, or skip what does not fit.'
		},
		review: {
			title: 'Review',
			text: 'Take a closer look at shortlisted deals. Move the strongest ones forward.'
		},
		connect: {
			title: 'Connect',
			text: 'Connect with the operator and collect the details you need to move forward.'
		},
		decide: {
			title: 'Decide',
			text: 'Compare deals and decide which ones to invest in.'
		},
		invested: {
			title: 'Invested',
			text: 'Track the deals you’ve invested in and keep your portfolio organized.'
		},
		skipped: {
			title: 'Skipped',
			text: 'Keep track of deals you skipped without cluttering your active pipeline.'
		}
	};
	const currentStageContent = $derived(stageDescriptions[currentTab] || stageDescriptions.filter);
	const showSwipeFeed = $derived(isMobile && currentTab === 'filter' && $dealFlowViewMode === 'grid');

	function clearFilters() {
		search = '';
		assetClass = '';
		dealType = '';
		strategy = '';
		status = '';
		maxInvest = '';
		maxLockup = '';
		distributions = '';
		minIRR = '';
		sortBy = 'newest';
		showArchived = false;
		buyBoxApplied = false;
	}

	function handleFilterChange({ field: key, value: val }) {
		if (key === 'search') search = val;
		else if (key === 'assetClass') assetClass = val;
		else if (key === 'dealType') dealType = val;
		else if (key === 'strategy') strategy = val;
		else if (key === 'status') status = val;
		else if (key === 'maxInvest') maxInvest = val;
		else if (key === 'maxLockup') maxLockup = val;
		else if (key === 'distributions') distributions = val;
		else if (key === 'minIRR') minIRR = val;
		else if (key === 'sortBy') sortBy = val;
		else if (key === 'showArchived') showArchived = val;
	}

	function handleCompareToggle(dealId) {
		const result = compareDealIds.toggle(dealId);
		if (result.reason === 'max') {
			showPageNotice(`You can compare up to ${MAX_COMPARE_DEALS} deals at a time.`);
		}
	}

	function isDealCompareAtLimit(dealId) {
		return !compareDealSet.has(dealId) && $compareDealIds.length >= MAX_COMPARE_DEALS;
	}

	function getDealCardActionModelForCard(deal) {
		return getDealCardActionModel({
			deal,
			pipelineStage: currentTab,
			viewMode: $dealFlowViewMode
		});
	}

	function getDealUtilityAnalyticsForCard(deal, utilityAction) {
		return buildDealCardUtilityAnalyticsPayload({
			deal,
			pipelineStage: currentTab,
			viewMode: $dealFlowViewMode,
			utilityAction,
			labelShown: getDealCardUtilityActionLabel(utilityAction, {
				compareSelected: compareDealSet.has(deal.id),
				compareAtLimit: isDealCompareAtLimit(deal.id)
			}),
			userRole: utilityUserRole,
			accessTier: $accessTier || '',
			compareModeActive
		});
	}

	function closeIntroModal() {
		showIntroModal = false;
		introRequestDeal = null;
	}

	function handleIntroRequestSuccess() {
		// Request persistence is handled in the shared intro helper.
	}

	function handleDealCardUtilityAction({ deal, utilityAction, utilityAnalytics }) {
		if (!deal || !utilityAction || utilityAction.disabled) return;

		trackDealCardUtilityActionClick(utilityAnalytics);

		if (utilityAction.action === DEAL_CARD_UTILITY_ACTIONS.COMPARE) {
			handleCompareToggle(deal.id);
			return;
		}

		if (utilityAction.action === DEAL_CARD_UTILITY_ACTIONS.VIEW_DECK) {
			if (openDealDeckInNewTab(deal)) {
				trackDealCardViewDeckClicked(utilityAnalytics);
			}
			return;
		}

		if (utilityAction.action === DEAL_CARD_UTILITY_ACTIONS.REQUEST_INTRODUCTION) {
			const session = getStoredSessionUser() || {};
			if (!session?.email) {
				if (browser) {
					window.location.href = `/login?return=${encodeURIComponent(window.location.pathname)}`;
				}
				return;
			}

			const gate = getDealIntroductionRequestGate(deal.id);
			if (!gate.ok) {
				showPageNotice(gate.message);
				return;
			}

			introRequestDeal = deal;
			showIntroModal = true;
			trackDealCardRequestIntroOpened(utilityAnalytics);
		}
	}

	async function handleDealCardFooterAction({ deal, action }) {
		if (!deal?.id || !action?.next || action.disabled) return;
		if (pendingFooterActionByDealId[deal.id]) return;

		const session = getStoredSessionUser() || {};
		const userId = session.id || session.userId || session.user_id || session.sub || '';
		const footerAnalytics = buildDealCardFooterAnalyticsPayload({
			deal,
			currentPipeline: currentTab,
			destinationPipeline: action.next,
			action,
			userId,
			userRole: utilityUserRole
		});

		trackDealCardFooterActionClick(footerAnalytics);
		pendingFooterActionByDealId = {
			...pendingFooterActionByDealId,
			[deal.id]: action.id
		};

		const result = await dealStages.setStage(deal.id, action.next);

		if (!result?.ok) {
			showPageNotice(result?.error?.message || 'We could not update that pipeline stage. Please try again.');
		} else if (result.nextStage === 'review' || result.nextStage === 'invested') {
			notifySuccess();
		}

		const nextPending = { ...pendingFooterActionByDealId };
		delete nextPending[deal.id];
		pendingFooterActionByDealId = nextPending;
	}

	async function loadMoreDeals() {
		await loadMoreMemberDeals().catch(() => {});
	}

	$effect(() => {
		if (!browser) return;

		const selectedIds = $compareDealIds;
		const visibleDealsById = new Map(filteredDeals.map((deal) => [deal.id, deal]));

		if (selectedIds.length === 0) {
			compareSelectedDeals = [];
			compareDealsLoading = false;
			return;
		}

		const requestId = ++compareRequestId;
		compareDealsLoading = true;

		const loadComparedDeals = async () => {
			try {
				const missingIds = selectedIds.filter((dealId) => !visibleDealsById.has(dealId));
				let fetchedDeals = [];

				if (missingIds.length > 0) {
					const data = await queryMemberDeals({
						scope: 'ids',
						ids: missingIds,
						limit: MAX_COMPARE_DEALS
					});
					if (requestId !== compareRequestId) return;
					fetchedDeals = data?.deals || [];
				}

				const byId = new Map([
					...filteredDeals.map((deal) => [deal.id, deal]),
					...fetchedDeals.map((deal) => [deal.id, deal])
				]);

				compareSelectedDeals = selectedIds
					.map((dealId) => byId.get(dealId))
					.filter(Boolean);
			} catch {
				if (requestId !== compareRequestId) return;
				compareSelectedDeals = selectedIds
					.map((dealId) => visibleDealsById.get(dealId))
					.filter(Boolean);
			} finally {
				if (requestId === compareRequestId) {
					compareDealsLoading = false;
				}
			}
		};

		loadComparedDeals();
	});

	$effect(() => {
		if (!browser || !filtersReady) return;

		const request = {
			scope: currentTab === 'filter' ? 'browse' : 'ids',
			ids: currentTab === 'filter' ? [] : currentTabIds,
			excludeIds: currentTab === 'filter' ? excludedBrowseIds : [],
			search: effectiveFilters.search,
			assetClass: effectiveFilters.assetClass,
			dealType: effectiveFilters.dealType,
			strategy: effectiveFilters.strategy,
			status: effectiveFilters.status,
			maxInvest: effectiveFilters.maxInvest,
			maxLockup: effectiveFilters.maxLockup,
			distributions: effectiveFilters.distributions,
			minIRR: effectiveFilters.minIRR,
			sortBy,
			showArchived
		};

		const timer = window.setTimeout(() => {
			fetchMemberDeals({
				...request,
				preserveResults: currentTab !== 'filter' && $memberDealsMeta.loaded && $memberDealsMeta.scope === 'ids'
			}).catch(() => {});
		}, search.trim() ? 150 : 0);

		return () => window.clearTimeout(timer);
	});

	onMount(() => {
		compareDealIds.syncFromSession();
		dealFlowViewMode.syncFromSession();
		loadBuyBox();
		applyLocationFilters();
		loadDailyCount();
		filtersReady = true;

		if (browser) {
			isMobile = window.innerWidth <= 768;
			const handler = () => { isMobile = window.innerWidth <= 768; };
			window.addEventListener('resize', handler);
			return () => {
				if (pageNoticeTimer) window.clearTimeout(pageNoticeTimer);
				window.removeEventListener('resize', handler);
			};
		}
	});
</script>

<svelte:head><title>Deal Flow | GYC</title></svelte:head>

<PageContainer className="deals-page">
	<div class="deals-shell ly-page-stack">
		<div class="deals-top">
			{#if isMobile}
				<div class="mobile-toolbar">
					<div class="mobile-pipeline-row">
						<div class="mobile-pipeline-label deals-page-title deals-page-title-mobile">Dealflow</div>
						<div class="mobile-pipeline-right">
							<div class="mobile-pipeline-control">
								<PipelineTabs
									{currentTab}
									counts={$stageCounts}
									onswitch={switchTab}
									mobileCountStyle="inline"
								/>
							</div>
							<DealFlowViewToggle
								value={$dealFlowViewMode}
								onchange={switchView}
								className="mobile-view-toggle"
							/>
						</div>
					</div>

					<div class="deals-filters" bind:this={filterAnchor}>
						<FilterBar
							{search}
							{assetClass}
							{dealType}
							{strategy}
							{status}
							{maxInvest}
							{maxLockup}
							{distributions}
							{minIRR}
							{sortBy}
							{showArchived}
							{buyBoxApplied}
							onchange={handleFilterChange}
							onclear={clearFilters}
							ontoggleBuyBox={() => buyBoxApplied = !buyBoxApplied}
						/>
					</div>

					<div class="mobile-stage-helper">{currentStageContent.text}</div>
				</div>
			{:else}
				<div class="desktop-toolbar">
					<div class="desktop-toolbar-row desktop-toolbar-row-primary">
						<div class="toolbar-stage-group">
							<div class="deals-page-title">Dealflow</div>
							<div class="toolbar-stage-tabs">
								<PipelineTabs {currentTab} counts={$stageCounts} onswitch={switchTab} />
							</div>
						</div>

						<DealFlowViewToggle value={$dealFlowViewMode} onchange={switchView} />
					</div>

					<div class="desktop-toolbar-row desktop-toolbar-row-secondary deals-filters" bind:this={filterAnchor}>
						<FilterBar
							{search}
							{assetClass}
							{dealType}
							{strategy}
							{status}
							{maxInvest}
							{maxLockup}
							{distributions}
							{minIRR}
							{sortBy}
							{showArchived}
							{buyBoxApplied}
							showAddDeal={$isAdmin}
							onadddeal={handleAddDeal}
							onchange={handleFilterChange}
							onclear={clearFilters}
							ontoggleBuyBox={() => buyBoxApplied = !buyBoxApplied}
						/>
					</div>
				</div>
			{/if}
		</div>

		{#if pageNoticeVisible}
			<div class="compare-notice" role="status">{pageNotice}</div>
		{/if}

	<!-- Content -->
		{#if $memberDealsLoading}
			<div class="loading-state">
				<div class="skeleton-grid ly-grid">
				{#each Array(6) as _}
					<div class="skeleton-card">
						<div class="sk-bar sk-title"></div>
						<div class="sk-bar sk-subtitle"></div>
						<div class="sk-bar sk-body"></div>
						<div class="sk-bar sk-body short"></div>
					</div>
				{/each}
			</div>
		</div>
	{:else if $memberDealsError}
		<div class="empty-state">
			<div class="empty-icon">⚠️</div>
			<div class="empty-title">Couldn’t load deals</div>
			<div class="empty-desc">{$memberDealsError}</div>
			<button class="btn-browse" onclick={() => fetchMemberDeals($memberDealsMeta.filters || {}).catch(() => {})}>Try Again</button>
		</div>
	{:else if $dealFlowViewMode === 'compare'}
		<div class="compare-mode-layout">
			<CompareView
				deals={compareSelectedDeals}
				loading={compareDealsLoading}
				maxDeals={MAX_COMPARE_DEALS}
				planFitById={comparePlanFitById}
				onremove={(dealId) => compareDealIds.remove(dealId)}
			/>

			<div class="compare-grid-shell">
				<div class="compare-grid-head">
					<div>
						<div class="compare-grid-title">{currentStageContent.title} Deals</div>
						<div class="compare-grid-desc">
							{#if $compareDealIds.length === 0}
								Add up to {MAX_COMPARE_DEALS} deals from the cards below to build your comparison set.
							{:else if compareRemaining > 0}
								Add {compareRemaining} more deal{compareRemaining === 1 ? '' : 's'} from the cards below, or review the ones already selected.
							{:else}
								Swap deals in and out from the cards below to pressure-test your finalists across stages.
							{/if}
						</div>
					</div>

					<div class="compare-grid-meta">
						<span class="compare-grid-count">{$compareDealIds.length}/{MAX_COMPARE_DEALS} selected</span>
						{#if $compareDealIds.length > 0}
							<button class="compare-clear-btn" onclick={() => compareDealIds.clear()}>Clear compare</button>
						{/if}
					</div>
				</div>

				{#if filteredDeals.length === 0}
					<div class="empty-state">
						<div class="empty-icon">{STAGE_META[currentTab]?.icon || '📋'}</div>
						{#if hasActiveFilters && currentTab === 'filter'}
							<div class="empty-title">No deals match your filters</div>
							<div class="empty-desc">Try adjusting your criteria or clearing all filters to see every deal.</div>
							<button class="btn-browse" onclick={clearFilters}>Clear All Filters</button>
						{:else if currentTab === 'filter'}
							<div class="empty-title">No deals available</div>
							<div class="empty-desc">New deals are added regularly. Check back soon.</div>
						{:else if currentTab === 'review'}
							<div class="empty-title">No deals in Review yet</div>
							<div class="empty-desc">Move deals from Filter into Review to start working the checklist and deciding what deserves a conversation.</div>
							<button class="btn-browse" onclick={() => switchTab('filter')}>Go to Filter</button>
						{:else if currentTab === 'connect'}
							<div class="empty-title">No deals in Connect yet</div>
							<div class="empty-desc">Complete your review to request introductions with operators. Once you understand a deal, move it here to schedule a call.</div>
							<button class="btn-browse" onclick={() => switchTab('review')}>Go to Review</button>
						{:else if currentTab === 'decide'}
							<div class="empty-title">No deals in Decide yet</div>
							<div class="empty-desc">Meet operators before making decisions. After your conversations, move deals here to compare finalists side by side.</div>
							<button class="btn-browse" onclick={() => switchTab('connect')}>Go to Connect</button>
						{:else if currentTab === 'invested'}
							<div class="empty-title">No investments yet</div>
							<div class="empty-desc">Your invested deals will appear here. Track distributions, K-1s, and hold period progress all in one place.</div>
						{:else if currentTab === 'skipped'}
							<div class="empty-title">No skipped deals</div>
							<div class="empty-desc">Deals you've passed on will show here. You can reconsider them anytime.</div>
						{:else}
							<div class="empty-title">Nothing here yet</div>
							<div class="empty-desc">Start browsing deals to build your pipeline.</div>
							<button class="btn-browse" onclick={() => switchTab('filter')}>Browse Deals</button>
						{/if}
					</div>
					{:else}
						<div class="deals-grid ly-grid">
						{#each filteredDeals as deal (deal.id)}
							{@const actionModel = getDealCardActionModelForCard(deal)}
							{@const utilityAction = actionModel.utilityAction}
							{@const utilityAnalytics = getDealUtilityAnalyticsForCard(deal, utilityAction)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div onclick={() => trackDealView(deal.id)}>
								<DealCard
									{deal}
									footerActions={actionModel.footerActions}
									stageActionPending={Boolean(pendingFooterActionByDealId[deal.id])}
									pendingFooterActionId={pendingFooterActionByDealId[deal.id] || ''}
									{utilityAction}
									{utilityAnalytics}
									compareSelected={compareDealSet.has(deal.id)}
									compareAtLimit={isDealCompareAtLimit(deal.id)}
									onutilityaction={handleDealCardUtilityAction}
									onfooteraction={handleDealCardFooterAction}
								/>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{:else if $dealFlowViewMode === 'location'}
		<div class="location-mode-layout">
			<div class="location-map-shell">
				<div class="location-map-head">
					<div>
						<div class="compare-grid-title">{currentStageContent.title} Locations</div>
						<div class="compare-grid-desc">
							See the geographic spread for the deals in this stage, then review the same cards underneath.
						</div>
					</div>

					<div class="compare-grid-meta">
						<span class="compare-grid-count">{filteredDeals.length} mapped</span>
					</div>
				</div>

				<DealMap deals={filteredDeals} />
			</div>

			<div class="compare-grid-shell">
				<div class="compare-grid-head">
					<div>
						<div class="compare-grid-title">{currentStageContent.title} Deals</div>
						<div class="compare-grid-desc">
							Use the map as context, then continue browsing and acting on the cards below without leaving Deal Flow.
						</div>
					</div>
				</div>

				{#if filteredDeals.length === 0}
					<div class="empty-state">
						<div class="empty-icon">{STAGE_META[currentTab]?.icon || '📋'}</div>
						{#if hasActiveFilters && currentTab === 'filter'}
							<div class="empty-title">No deals match your filters</div>
							<div class="empty-desc">Try adjusting your criteria or clearing all filters to see every deal.</div>
							<button class="btn-browse" onclick={clearFilters}>Clear All Filters</button>
						{:else if currentTab === 'filter'}
							<div class="empty-title">No deals available</div>
							<div class="empty-desc">New deals are added regularly. Check back soon.</div>
						{:else if currentTab === 'review'}
							<div class="empty-title">No deals in Review yet</div>
							<div class="empty-desc">Move deals from Filter into Review to start working the checklist and deciding what deserves a conversation.</div>
							<button class="btn-browse" onclick={() => switchTab('filter')}>Go to Filter</button>
						{:else if currentTab === 'connect'}
							<div class="empty-title">No deals in Connect yet</div>
							<div class="empty-desc">Complete your review to request introductions with operators. Once you understand a deal, move it here to schedule a call.</div>
							<button class="btn-browse" onclick={() => switchTab('review')}>Go to Review</button>
						{:else if currentTab === 'decide'}
							<div class="empty-title">No deals in Decide yet</div>
							<div class="empty-desc">Meet operators before making decisions. After your conversations, move deals here to compare finalists side by side.</div>
							<button class="btn-browse" onclick={() => switchTab('connect')}>Go to Connect</button>
						{:else if currentTab === 'invested'}
							<div class="empty-title">No investments yet</div>
							<div class="empty-desc">Your invested deals will appear here. Track distributions, K-1s, and hold period progress all in one place.</div>
						{:else if currentTab === 'skipped'}
							<div class="empty-title">No skipped deals</div>
							<div class="empty-desc">Deals you've passed on will show here. You can reconsider them anytime.</div>
						{:else}
							<div class="empty-title">Nothing here yet</div>
							<div class="empty-desc">Start browsing deals to build your pipeline.</div>
							<button class="btn-browse" onclick={() => switchTab('filter')}>Browse Deals</button>
						{/if}
					</div>
		{:else if showSwipeFeed}
			<SwipeFeed
				deals={filteredDeals}
				compareIds={$compareDealIds}
				getActionModel={getDealCardActionModelForCard}
				getUtilityAnalytics={getDealUtilityAnalyticsForCard}
				{pendingFooterActionByDealId}
				isCompareAtLimit={isDealCompareAtLimit}
				onutilityaction={handleDealCardUtilityAction}
				onfooteraction={handleDealCardFooterAction}
				oncardview={trackDealView}
			/>
		{:else}
			<div class="deals-grid ly-grid">
						{#each filteredDeals as deal (deal.id)}
							{@const actionModel = getDealCardActionModelForCard(deal)}
							{@const utilityAction = actionModel.utilityAction}
							{@const utilityAnalytics = getDealUtilityAnalyticsForCard(deal, utilityAction)}
							<!-- svelte-ignore a11y_no_static_element_interactions -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<div onclick={() => trackDealView(deal.id)}>
								<DealCard
									{deal}
									footerActions={actionModel.footerActions}
									stageActionPending={Boolean(pendingFooterActionByDealId[deal.id])}
									pendingFooterActionId={pendingFooterActionByDealId[deal.id] || ''}
									{utilityAction}
									{utilityAnalytics}
									compareSelected={compareDealSet.has(deal.id)}
									compareAtLimit={isDealCompareAtLimit(deal.id)}
									onutilityaction={handleDealCardUtilityAction}
									onfooteraction={handleDealCardFooterAction}
								/>
							</div>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{:else if filteredDeals.length === 0}
		<div class="empty-state">
			<div class="empty-icon">{STAGE_META[currentTab]?.icon || '📋'}</div>
			{#if hasActiveFilters && currentTab === 'filter'}
				<div class="empty-title">No deals match your filters</div>
				<div class="empty-desc">Try adjusting your criteria or clearing all filters to see every deal.</div>
				<button class="btn-browse" onclick={clearFilters}>Clear All Filters</button>
			{:else if currentTab === 'filter'}
				<div class="empty-title">No deals available</div>
				<div class="empty-desc">New deals are added regularly. Check back soon.</div>
			{:else if currentTab === 'review'}
				<div class="empty-title">No deals in Review yet</div>
				<div class="empty-desc">Move deals from Filter into Review to start working the checklist and deciding what deserves a conversation.</div>
				<button class="btn-browse" onclick={() => switchTab('filter')}>Go to Filter</button>
			{:else if currentTab === 'connect'}
				<div class="empty-title">No deals in Connect yet</div>
				<div class="empty-desc">Complete your review to request introductions with operators. Once you understand a deal, move it here to schedule a call.</div>
				<button class="btn-browse" onclick={() => switchTab('review')}>Go to Review</button>
			{:else if currentTab === 'decide'}
				<div class="empty-title">No deals in Decide yet</div>
				<div class="empty-desc">Meet operators before making decisions. After your conversations, move deals here to compare finalists side by side.</div>
				<button class="btn-browse" onclick={() => switchTab('connect')}>Go to Connect</button>
			{:else if currentTab === 'invested'}
				<div class="empty-title">No investments yet</div>
				<div class="empty-desc">Your invested deals will appear here. Track distributions, K-1s, and hold period progress all in one place.</div>
			{:else if currentTab === 'skipped'}
				<div class="empty-title">No skipped deals</div>
				<div class="empty-desc">Deals you've passed on will show here. You can reconsider them anytime.</div>
			{:else}
				<div class="empty-title">Nothing here yet</div>
				<div class="empty-desc">Start browsing deals to build your pipeline.</div>
				<button class="btn-browse" onclick={() => switchTab('filter')}>Browse Deals</button>
			{/if}
		</div>
	{:else}
		<div class="deals-grid ly-grid">
			{#each filteredDeals as deal (deal.id)}
				{@const actionModel = getDealCardActionModelForCard(deal)}
				{@const utilityAction = actionModel.utilityAction}
				{@const utilityAnalytics = getDealUtilityAnalyticsForCard(deal, utilityAction)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div onclick={() => trackDealView(deal.id)}>
					<DealCard
						{deal}
						footerActions={actionModel.footerActions}
						stageActionPending={Boolean(pendingFooterActionByDealId[deal.id])}
						pendingFooterActionId={pendingFooterActionByDealId[deal.id] || ''}
						{utilityAction}
						{utilityAnalytics}
						compareSelected={compareDealSet.has(deal.id)}
						compareAtLimit={isDealCompareAtLimit(deal.id)}
						onutilityaction={handleDealCardUtilityAction}
						onfooteraction={handleDealCardFooterAction}
					/>
				</div>
			{/each}
		</div>
		{/if}

		{#if !$memberDealsLoading && !$memberDealsError && $memberDealsMeta.hasMore}
			<div class="load-more-row">
				<button class="load-more-btn" onclick={loadMoreDeals} disabled={$memberDealsLoadingMore}>
					{$memberDealsLoadingMore ? 'Loading more deals...' : `Load More Deals (${filteredDeals.length}/${totalMatchingDeals})`}
				</button>
			</div>
		{/if}
	</div>
</PageContainer>

<RequestIntroductionModal
	deal={introRequestDeal}
	open={showIntroModal}
	successButtonLabel="Back to Deal Flow"
	onclose={closeIntroModal}
	onsuccess={handleIntroRequestSuccess}
/>

<!-- Daily Limit Modal -->
{#if showLimitModal && isFreeUser}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="limit-overlay" onclick={() => showLimitModal = false}>
		<div class="limit-modal" onclick={(e) => e.stopPropagation()}>
			<div class="limit-icon">🔒</div>
			<h2 class="limit-title">You've reached your daily limit</h2>
			<p class="limit-desc">
				{#if nativeCompanionMode}
					Free users can view {DAILY_LIMIT} deals per day in the iOS app. Expanded deal access is available to existing members in their web account.
				{:else}
					Free members can view {DAILY_LIMIT} deals per day. Upgrade to Academy for unlimited access to all deals, due diligence tools, and operator introductions.
				{/if}
			</p>
			{#if !nativeCompanionMode}
				<a href="/app/academy" class="limit-btn">Upgrade to Academy</a>
			{/if}
			<button class="limit-dismiss" onclick={() => showLimitModal = false}>Maybe later</button>
		</div>
	</div>
{/if}

<style>
	.deals-page {
		--ly-frame-pad-top: 16px;
		--ly-frame-pad-bottom: 48px;
		--ly-frame-pad-top-tablet: 14px;
		--ly-frame-pad-bottom-tablet: 40px;
		--ly-frame-pad-top-mobile: 12px;
		--ly-frame-pad-bottom-mobile: 28px;
		min-width: 0;
	}

	.deals-shell {
		--ly-page-stack-gap: 12px;
		min-width: 0;
	}

	.deals-top {
		display: grid;
		gap: 12px;
		min-width: 0;
	}

	.desktop-toolbar,
	.mobile-toolbar {
		display: grid;
		gap: 12px;
		min-width: 0;
	}

	.desktop-toolbar-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-width: 0;
	}

	.desktop-toolbar-row-secondary {
		display: block;
	}

	.toolbar-stage-group {
		display: flex;
		align-items: center;
		gap: 18px;
		min-width: 0;
		flex: 1 1 auto;
	}

	.deals-page-title {
		flex-shrink: 0;
		font-family: var(--font-headline);
		font-size: 22px;
		font-weight: 400;
		line-height: 1.1;
		letter-spacing: -0.3px;
		color: var(--text-dark);
		white-space: nowrap;
	}

	.toolbar-stage-tabs {
		min-width: 0;
		flex: 1 1 auto;
	}

	:global(.pipeline-tabs.ly-desktop-only) {
		min-width: 0;
		flex: 1 1 auto;
	}

	.deals-filters {
		scroll-margin-top: 20px;
	}

	.mobile-toolbar {
		gap: 10px;
	}

	.mobile-pipeline-row {
		display: grid;
		grid-template-columns: auto minmax(0, 1fr);
		align-items: center;
		gap: 12px;
	}

	.mobile-pipeline-right {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		min-width: 0;
	}

	.mobile-pipeline-label {
		font-size: 18px;
		font-weight: 400;
		color: var(--text-dark);
		letter-spacing: -0.2px;
	}

	.deals-page-title-mobile {
		font-size: 18px;
	}

	.mobile-pipeline-control {
		display: flex;
		justify-content: flex-end;
		min-width: 0;
		flex: 0 1 auto;
	}

	.mobile-stage-helper {
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.45;
		color: var(--text-secondary);
		padding: 0 2px;
	}

	.compare-notice {
		margin-bottom: 0;
		padding: 10px 14px;
		border-radius: 10px;
		border: 1px solid rgba(245, 158, 11, 0.2);
		background: rgba(245, 158, 11, 0.08);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: #b7791f;
	}

	.compare-mode-layout,
	.location-mode-layout {
		display: grid;
		gap: 22px;
		min-width: 0;
	}

	.location-map-shell {
		padding: 18px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: var(--shadow-card);
		min-width: 0;
	}

	.location-map-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
	}

	.compare-grid-shell {
		padding: 18px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: var(--shadow-card);
		min-width: 0;
	}

	.compare-grid-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
	}

	.compare-grid-title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--text-dark);
	}

	.compare-grid-desc {
		margin-top: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.compare-grid-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}

	.compare-grid-count {
		padding: 6px 10px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.12);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--primary);
	}

	.compare-clear-btn {
		border: none;
		background: none;
		padding: 0;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		cursor: pointer;
	}

	.compare-clear-btn:hover {
		color: var(--text-dark);
	}

	.deals-grid,
	.skeleton-grid {
		--ly-grid-desktop: 3;
		--ly-grid-tablet: 2;
		--ly-grid-mobile: 1;
		--ly-grid-gap: 18px;
	}

	.loading-state { padding: 20px 0; }

	.skeleton-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 18px;
		box-shadow: var(--shadow-card);
	}

	.sk-bar {
		height: 12px;
		background: var(--border-light);
		border-radius: 6px;
		margin-bottom: 12px;
		animation: pulse 1.5s infinite;
	}

	.sk-title { width: 60%; height: 16px; }
	.sk-subtitle { width: 40%; }
	.sk-body { width: 80%; }
	.sk-body.short { width: 50%; margin-bottom: 0; }

	@keyframes pulse {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 0.8; }
	}

	.empty-state {
		text-align: center;
		padding: 80px 32px;
		grid-column: 1 / -1;
	}

	.load-more-row {
		display: flex;
		justify-content: center;
		padding: 24px 0 8px;
	}

	.load-more-btn {
		padding: 12px 20px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-card);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.load-more-btn:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--primary);
	}

	.load-more-btn:disabled {
		cursor: wait;
		opacity: 0.7;
	}

	.empty-icon { font-size: 48px; margin-bottom: 16px; opacity: 0.3; }
	.empty-title { font-size: 16px; font-weight: 600; color: var(--text-muted); }

	.empty-desc {
		font-size: 13px;
		color: var(--text-muted);
		margin-top: 4px;
		max-width: 400px;
		margin-left: auto;
		margin-right: auto;
		line-height: 1.5;
	}

	.btn-browse {
		display: inline-block;
		padding: 10px 24px;
		background: var(--primary);
		color: #fff;
		border-radius: 8px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		margin-top: 12px;
		border: none;
		cursor: pointer;
	}

	.limit-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.limit-modal {
		background: var(--bg-card);
		border-radius: 16px;
		padding: 40px 32px;
		max-width: 420px;
		text-align: center;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);
	}

	.limit-icon { font-size: 40px; margin-bottom: 12px; }
	.limit-title { font-family: var(--font-headline); font-size: 20px; font-weight: 800; color: var(--text-dark); margin: 0 0 10px; }
	.limit-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0 0 20px; }
	.limit-btn { display: inline-block; padding: 12px 28px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-size: 14px; font-weight: 700; text-decoration: none; margin-bottom: 10px; }
	.limit-btn:hover { background: #3da86a; }
	.limit-dismiss { display: block; margin: 0 auto; background: none; border: none; font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); cursor: pointer; padding: 4px; }
	.limit-dismiss:hover { color: var(--text-dark); }

	@media (min-width: 769px) and (max-width: 1024px) {
		.deals-grid,
		.skeleton-grid { --ly-grid-gap: 16px; }

		.desktop-toolbar-row {
			gap: 14px;
		}

		.toolbar-stage-group {
			gap: 14px;
		}

		.deals-page-title {
			font-size: 20px;
		}

		.compare-grid-shell {
			padding: 16px;
		}

		.location-map-shell {
			padding: 16px;
		}
	}

	@media (max-width: 768px) {
		.deals-shell {
			--ly-page-stack-gap: 8px;
		}

		.deals-page {
			--ly-frame-pad-top-mobile: 10px;
		}

		.deals-top {
			gap: 8px;
		}

		.mobile-toolbar {
			gap: 8px;
		}

		.mobile-pipeline-row {
			gap: 10px;
		}

		.mobile-pipeline-right {
			gap: 6px;
		}

		.mobile-pipeline-label {
			font-size: 17px;
		}

		.mobile-stage-helper {
			font-size: 12px;
			line-height: 1.4;
		}

		.compare-grid-head {
			flex-direction: column;
			align-items: stretch;
		}

		.compare-grid-meta {
			justify-content: space-between;
		}

		.location-map-head {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
