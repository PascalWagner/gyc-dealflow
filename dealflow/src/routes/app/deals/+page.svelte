<script>
	import { onMount } from 'svelte';
	import PipelineTabs from '$lib/components/PipelineTabs.svelte';
	import DealCard from '$lib/components/DealCard.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import DealTable from '$lib/components/DealTable.svelte';
	import DealMap from '$lib/components/DealMap.svelte';
	import CompareView from '$lib/components/CompareView.svelte';
	import SwipeFeed from '$lib/components/SwipeFeed.svelte';
	import {
		dealStages,
		decisionCompareIds,
		stageCounts,
		memberDeals,
		memberDealsLoading,
		memberDealsLoadingMore,
		memberDealsError,
		memberDealsMeta,
		fetchMemberDeals,
		loadMoreMemberDeals,
		MAX_DECISION_COMPARE,
		STAGE_META
	} from '$lib/stores/deals.js';
	import { accessTier, getStoredSessionUser, isAdmin } from '$lib/stores/auth.js';
	import { getUiStage } from '$lib/utils/dealflow-contract.js';
	import {
		currentAdminRealUser,
		readUserScopedJson,
		writeUserScopedJson
	} from '$lib/utils/userScopedState.js';
	import { browser } from '$app/environment';
	import { isNativeApp } from '$lib/utils/platform.js';

	let currentTab = $state('filter');
	let viewMode = $state('grid');
	let isMobile = $state(false);
	let buyBox = $state(null);
	let filterAnchor = $state(null);
	let filtersReady = $state(false);

	let dailyDealCount = $state(0);
	let showLimitModal = $state(false);
	let resetTimerLabel = $state('Resets at midnight');
	const DAILY_LIMIT = 20;
	const nativeCompanionMode = browser && isNativeApp();
	const todayKey = $derived(browser ? `gycDailyDeals_${new Date().toISOString().slice(0, 10)}` : '');
	const isFreeUser = $derived($accessTier === 'free');
	const dealsRemaining = $derived(Math.max(0, DAILY_LIMIT - dailyDealCount));
	const dailyViewsPct = $derived(Math.round((dealsRemaining / DAILY_LIMIT) * 100));
	const dailyViewsColor = $derived(dealsRemaining <= 5 ? '#e74c3c' : dealsRemaining <= 10 ? '#f59e0b' : 'var(--primary)');

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
	let decisionSelectionInitialized = $state(false);

	const BUY_BOX_DEAL_TYPES = new Set(['fund', 'syndication', 'reit', '1031 exchange', 'joint venture', 'note/debt', 'other']);
	const UI_STAGE_TABS = new Set(['filter', 'review', 'connect', 'decide', 'invested', 'skipped']);

	function loadDailyCount() {
		if (!browser) return;
		const stored = readUserScopedJson(todayKey, []);
		dailyDealCount = stored.length;
	}

	function updateResetTimer() {
		if (!browser) return;
		const now = new Date();
		const midnight = new Date(now);
		midnight.setHours(24, 0, 0, 0);
		const diff = midnight - now;
		const hrs = Math.floor(diff / 3600000);
		const mins = Math.floor((diff % 3600000) / 60000);
		resetTimerLabel = `Resets in ${hrs}h ${mins}m`;
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
		if (tab !== 'filter' && viewMode === 'map') viewMode = 'grid';
	}

	function switchView(mode) {
		viewMode = mode;
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

	const filteredDeals = $derived.by(() => applyBuyBoxFilters($memberDeals || []));
	const decisionCompareSet = $derived(new Set($decisionCompareIds));
	const selectedDecisionDeals = $derived.by(() => {
		if (currentTab !== 'decide') return [];
		const dealsById = new Map(filteredDeals.map((deal) => [deal.id, deal]));
		return $decisionCompareIds.map((dealId) => dealsById.get(dealId)).filter(Boolean);
	});
	const decisionCompareRemaining = $derived(Math.max(0, MAX_DECISION_COMPARE - selectedDecisionDeals.length));
	const decisionShelfDeals = $derived.by(() => {
		if (currentTab !== 'decide') return [];
		return [
			...selectedDecisionDeals,
			...filteredDeals.filter((deal) => !decisionCompareSet.has(deal.id))
		];
	});
	const totalMatchingDeals = $derived($memberDealsMeta.total || filteredDeals.length);
	const avgIRR = $derived.by(() => {
		const withIRR = filteredDeals.filter((deal) => deal.targetIRR);
		if (withIRR.length === 0) return '0';
		return (withIRR.reduce((sum, deal) => sum + deal.targetIRR, 0) / withIRR.length * 100).toFixed(1);
	});

	const stageDescriptions = {
		filter: { title: 'Filter', text: 'Browse vetted opportunities. Move a deal to Review when it deserves more attention, or skip it if it does not fit.', color: 'var(--primary)' },
		review: { title: 'Review', text: 'Read the deck, explore the deal page, and work through the checklist. Understand this deal before reaching out.', color: '#3b82f6' },
		connect: { title: 'Connect', text: "Time to talk to the operator. Request an intro and we'll connect you via email. Ask your questions, fill in the gaps.", color: '#f97316' },
		decide: { title: 'Decide', text: 'Compare deals side by side. Ready to commit? Wire the money and mark it as Invested.', color: '#a855f7' },
		invested: { title: 'Invested', text: "Deals you've committed capital to. Track distributions, K-1s, and hold periods.", color: '#059669' },
		skipped: { title: 'Skipped', text: "Deals you decided weren't right for you. You can always reconsider later.", color: 'var(--text-muted)' }
	};
	const currentStageContent = $derived(stageDescriptions[currentTab] || stageDescriptions.filter);

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

	function handleDecisionCompareToggle(dealId) {
		decisionCompareIds.toggle(dealId);
	}

	async function loadMoreDeals() {
		await loadMoreMemberDeals().catch(() => {});
	}

	$effect(() => {
		if (!browser || currentTab !== 'decide') return;

		const validIds = filteredDeals.map((deal) => deal.id);
		const nextIds = $decisionCompareIds
			.filter((dealId) => validIds.includes(dealId))
			.slice(0, MAX_DECISION_COMPARE);

		if (!decisionSelectionInitialized) {
			decisionSelectionInitialized = true;
			if (nextIds.length === 0 && validIds.length > 0) {
				decisionCompareIds.set(validIds.slice(0, MAX_DECISION_COMPARE));
				return;
			}
		}

		if (nextIds.length !== $decisionCompareIds.length) {
			decisionCompareIds.set(nextIds);
		}
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
			fetchMemberDeals(request).catch(() => {});
		}, search.trim() ? 150 : 0);

		return () => window.clearTimeout(timer);
	});

	onMount(() => {
		loadBuyBox();
		applyLocationFilters();
		loadDailyCount();
		updateResetTimer();
		filtersReady = true;

		if (browser) {
			isMobile = window.innerWidth <= 768;
			const handler = () => { isMobile = window.innerWidth <= 768; };
			const timer = window.setInterval(updateResetTimer, 60000);
			window.addEventListener('resize', handler);
			return () => {
				window.removeEventListener('resize', handler);
				window.clearInterval(timer);
			};
		}
	});
</script>

<svelte:head><title>Deal Flow | GYC</title></svelte:head>

<div class="deals-page">
	<!-- Header -->
	<div class="deals-header">
		<div class="header-row">
			<h1 class="deals-title">Deal Flow</h1>
			<PipelineTabs {currentTab} counts={$stageCounts} onswitch={switchTab} />
			<div class="view-toggle desktop-only">
				<button class="view-btn" class:active={viewMode === 'grid'} onclick={() => switchView('grid')} title="Grid view">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
				</button>
				<button class="view-btn" class:active={viewMode === 'list'} onclick={() => switchView('list')} title="List view">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
				</button>
				<button class="view-btn" class:active={viewMode === 'map'} onclick={() => switchView('map')} title="Map view">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
				</button>
			</div>
		</div>
	</div>

	<!-- Filter Bar -->
	<div class="deals-filters" bind:this={filterAnchor}>
		<FilterBar
			{search} {assetClass} {dealType} {strategy} {status} {maxInvest} {maxLockup}
			{distributions} {minIRR} {sortBy} {showArchived} {buyBoxApplied}
			totalDeals={totalMatchingDeals} avgIRR={avgIRR}
			isAdmin={$isAdmin}
			onadddeal={() => {
				if (browser) window.location.href = '/app/admin/manage';
			}}
			onchange={({ field: key, value: val }) => {
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
			}}
			onclear={clearFilters}
			ontoggleBuyBox={() => buyBoxApplied = !buyBoxApplied}
		/>
	</div>

	{#if !(isMobile && currentTab === 'filter')}
		<div class="stage-banner" style="border-left-color:{currentStageContent.color}">
			<div class="stage-copy">
				<span class="stage-title">{currentStageContent.title}</span>
				<span class="stage-desc">{currentStageContent.text}</span>
			</div>
		</div>
	{/if}

	{#if isFreeUser && !(isMobile && currentTab === 'filter')}
		<div class="daily-views">
			<div class="daily-views-head">
				<span class="daily-views-text">{dealsRemaining}/{DAILY_LIMIT} deal views left today</span>
				<span class="daily-views-timer">{resetTimerLabel}</span>
			</div>
			<div class="daily-views-track">
				<div class="daily-views-fill" style="width:{dailyViewsPct}%; background:{dailyViewsColor};"></div>
			</div>
		</div>
	{/if}

	<!-- Content -->
	{#if $memberDealsLoading}
		<div class="loading-state">
			<div class="skeleton-grid">
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
	{:else if currentTab === 'decide' && filteredDeals.length > 0}
		<div class="decision-compare-page">
			<CompareView
				deals={selectedDecisionDeals}
				maxDeals={MAX_DECISION_COMPARE}
				onremove={(dealId) => decisionCompareIds.remove(dealId)}
				onstagechange={(dealId, nextStage) => dealStages.setStage(dealId, nextStage)}
			/>

			<div class="decision-selector">
				<div class="decision-selector-head">
					<div>
						<div class="decision-selector-title">Choose Up To {MAX_DECISION_COMPARE} Finalists</div>
						<div class="decision-selector-desc">
							{#if selectedDecisionDeals.length === 0}
								Add deals from the cards below to start your side-by-side comparison.
							{:else if decisionCompareRemaining > 0}
								Add {decisionCompareRemaining} more deal{decisionCompareRemaining === 1 ? '' : 's'} from the cards below.
							{:else}
								Swap deals in and out from the cards below to pressure-test your finalists.
							{/if}
						</div>
					</div>

					<div class="decision-selector-meta">
						<span class="decision-selector-count">{selectedDecisionDeals.length}/{MAX_DECISION_COMPARE} selected</span>
						{#if selectedDecisionDeals.length > 0}
							<button class="decision-clear-btn" onclick={() => decisionCompareIds.clear()}>Clear</button>
						{/if}
					</div>
				</div>

				<div class="deals-grid decision-deals-grid">
					{#each decisionShelfDeals as deal (deal.id)}
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<div
							class="decision-card"
							class:is-selected={decisionCompareSet.has(deal.id)}
							onclick={() => trackDealView(deal.id)}
						>
							<DealCard
								{deal}
								compareSelectable={true}
								compareSelected={decisionCompareSet.has(deal.id)}
								compareDisabled={!decisionCompareSet.has(deal.id) && selectedDecisionDeals.length >= MAX_DECISION_COMPARE}
								oncomparetoggle={handleDecisionCompareToggle}
							/>
						</div>
					{/each}
				</div>
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
	{:else if viewMode === 'list' && !isMobile}
		<DealTable deals={filteredDeals} onopen={(dealId) => { trackDealView(dealId); if (browser) window.location.href = `/deal/${dealId}`; }} />
	{:else if viewMode === 'map' && !isMobile}
		<DealMap deals={filteredDeals} />
	{:else if isMobile && currentTab === 'filter'}
		<SwipeFeed deals={filteredDeals} />
	{:else}
		<div class="deals-grid">
			{#each filteredDeals as deal (deal.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div onclick={() => trackDealView(deal.id)}>
					<DealCard {deal} />
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
		padding: 0 28px 40px;
	}

	.deals-header {
		padding: 14px 0 10px;
	}

	.header-row {
		display: flex;
		align-items: flex-end;
		gap: 16px;
		width: 100%;
		min-width: 0;
		flex-wrap: wrap;
	}

	.deals-title {
		font-family: var(--font-headline);
		font-size: 22px;
		font-weight: 400;
		color: var(--text-dark);
		margin: 0;
		letter-spacing: -0.3px;
		white-space: nowrap;
		flex-shrink: 0;
	}

	:global(.pipeline-tabs.desktop-only) {
		min-width: 0;
		flex: 0 1 auto;
	}

	.deals-filters {
		scroll-margin-top: 24px;
	}

	.view-toggle {
		display: flex;
		gap: 2px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 3px;
		margin-left: auto;
		flex-shrink: 0;
	}

	.view-btn {
		padding: 6px 10px;
		border: none;
		background: none;
		border-radius: 5px;
		cursor: pointer;
		color: var(--text-muted);
		transition: all 0.15s;
		display: flex;
		align-items: center;
	}

	.view-btn:hover { color: var(--text-dark); }
	.view-btn.active { background: var(--primary); color: #fff; }

	.stage-banner {
		padding: 12px 16px;
		margin: 12px 0;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		border-left: 3px solid var(--primary);
	}

	.stage-copy {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.stage-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.stage-desc {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.daily-views {
		margin-bottom: 14px;
		padding: 9px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 10px;
		font-family: var(--font-ui);
	}

	.daily-views-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 6px;
		gap: 12px;
	}

	.daily-views-text {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.daily-views-timer {
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.daily-views-track {
		height: 4px;
		background: var(--border-light);
		border-radius: 2px;
		overflow: hidden;
	}

	.daily-views-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.5s ease, background 0.3s ease;
	}

	.decision-compare-page {
		display: grid;
		gap: 22px;
	}

	.decision-selector {
		padding: 18px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: var(--shadow-card);
	}

	.decision-selector-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
	}

	.decision-selector-title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--text-dark);
	}

	.decision-selector-desc {
		margin-top: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.decision-selector-meta {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-shrink: 0;
	}

	.decision-selector-count {
		padding: 6px 10px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.12);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--primary);
	}

	.decision-clear-btn {
		border: none;
		background: none;
		padding: 0;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		cursor: pointer;
	}

	.decision-clear-btn:hover {
		color: var(--text-dark);
	}

	.decision-deals-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.decision-card {
		border-radius: var(--radius);
		transition: transform 0.15s ease, box-shadow 0.15s ease;
	}

	.decision-card.is-selected {
		box-shadow: 0 0 0 2px rgba(81, 190, 123, 0.24);
	}

	.deals-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 18px;
	}

	.loading-state { padding: 20px 0; }
	.skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 18px; }

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

	.desktop-only { display: flex; }

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

	@media (max-width: 1100px) {
		.deals-grid,
		.skeleton-grid { grid-template-columns: repeat(2, 1fr); }

		.decision-deals-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (min-width: 769px) and (max-width: 1024px) {
		.deals-page {
			padding: 0 22px 36px;
		}

		.deals-grid,
		.skeleton-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 16px;
		}

		.decision-selector {
			padding: 16px;
		}
	}

	@media (max-width: 768px) {
		.deals-page { padding: 16px; }
		.deals-header { padding: 8px 0 12px; }
		.header-row { display: block; }
		.deals-title { font-size: 20px; margin-bottom: 12px; }
		:global(.pipeline-pills.mobile-only) { margin-top: 12px; }
		.deals-grid,
		.skeleton-grid { grid-template-columns: 1fr; }
		.decision-deals-grid { grid-template-columns: 1fr; }
		.desktop-only { display: none; }
		.stage-copy { display: block; }
		.stage-desc { display: block; margin-top: 6px; }
		.daily-views { display: none; }
		.decision-selector-head {
			flex-direction: column;
			align-items: stretch;
		}

		.decision-selector-meta {
			justify-content: space-between;
		}
	}
</style>
