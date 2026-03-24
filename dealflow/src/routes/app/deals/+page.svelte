<script>
	import { onMount } from 'svelte';
	import PipelineTabs from '$lib/components/PipelineTabs.svelte';
	import DealCard from '$lib/components/DealCard.svelte';
	import FilterBar from '$lib/components/FilterBar.svelte';
	import DealTable from '$lib/components/DealTable.svelte';
	import DealMap from '$lib/components/DealMap.svelte';
	import CompareView from '$lib/components/CompareView.svelte';
	import SwipeFeed from '$lib/components/SwipeFeed.svelte';
	import { deals, dealStages, stageCounts, fetchDeals, dealsLoading, STAGE_META } from '$lib/stores/deals.js';
	import { isGuest, isAdmin, userTier } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';

	let currentTab = $state('browse');
	let viewMode = $state('grid'); // grid | list | map
	let isMobile = $state(false);

	// Daily deal limit for free users
	let dailyDealCount = $state(0);
	let showLimitModal = $state(false);
	const DAILY_LIMIT = 10;
	const todayKey = $derived(browser ? `gycDailyDeals_${new Date().toISOString().slice(0, 10)}` : '');
	const isFreeUser = $derived(!$isAdmin && $userTier !== 'academy' && $userTier !== 'paid');
	const dealsRemaining = $derived(Math.max(0, DAILY_LIMIT - dailyDealCount));

	function loadDailyCount() {
		if (!browser) return;
		const stored = JSON.parse(localStorage.getItem(todayKey) || '[]');
		dailyDealCount = stored.length;
	}

	function trackDealView(dealId) {
		if (!browser || !isFreeUser) return;
		let stored = JSON.parse(localStorage.getItem(todayKey) || '[]');
		if (!stored.includes(dealId)) {
			stored.push(dealId);
			localStorage.setItem(todayKey, JSON.stringify(stored));
			dailyDealCount = stored.length;
		}
		if (dailyDealCount >= DAILY_LIMIT) {
			showLimitModal = true;
		}
	}

	// Filter state
	let search = $state('');
	let assetClass = $state('');
	let dealType = $state('');
	let strategy = $state('');
	let maxInvest = $state('');
	let maxLockup = $state('');
	let distributions = $state('');
	let minIRR = $state('');
	let sortBy = $state('newest');
	let showArchived = $state(false);
	let buyBoxApplied = $state(false);

	// Whether any filter is active (for empty state messaging)
	const hasActiveFilters = $derived(
		!!search || !!assetClass || !!dealType || !!strategy || !!maxInvest || !!maxLockup || !!distributions || !!minIRR || sortBy !== 'newest' || showArchived || buyBoxApplied
	);

	function switchTab(tab) {
		currentTab = tab;
		// Reset to grid on tab switch (unless on Filter)
		if (tab !== 'browse' && viewMode === 'map') viewMode = 'grid';
	}

	function switchView(mode) {
		viewMode = mode;
	}

	// Filter deals by current tab
	const tabDeals = $derived(
		($deals || []).filter(deal => {
			const stage = $dealStages[deal.id] || 'browse';
			if (currentTab === 'browse') return !$dealStages[deal.id];
			if (currentTab === 'saved') return stage === 'saved';
			return stage === currentTab;
		})
	);

	// Apply filters
	const filteredDeals = $derived(() => {
		let result = tabDeals;
		const q = search.toLowerCase().trim();
		if (q) {
			result = result.filter(d => {
				const searchable = [d.name, d.investmentName, d.managementCompany, d.operator, ...(Array.isArray(d.assetClass) ? d.assetClass : [d.assetClass])].filter(Boolean).join(' ').toLowerCase();
				return searchable.includes(q);
			});
		}
		if (assetClass) result = result.filter(d => {
			const classes = Array.isArray(d.assetClass) ? d.assetClass : [d.assetClass];
			return classes.some(c => c === assetClass);
		});
		if (dealType) result = result.filter(d => d.dealType === dealType);
		if (strategy) result = result.filter(d => d.strategy === strategy);
		if (maxInvest) result = result.filter(d => d.minimumInvestment && d.minimumInvestment <= parseInt(maxInvest));
		if (maxLockup) result = result.filter(d => d.holdPeriod && parseInt(d.holdPeriod) <= parseInt(maxLockup));
		if (minIRR) result = result.filter(d => d.targetIRR && d.targetIRR >= parseFloat(minIRR) / 100);
		if (!showArchived) result = result.filter(d => !d.archived);

		// Sort
		if (sortBy === 'newest') result = [...result].sort((a, b) => new Date(b.addedDate || b.createdTime || 0) - new Date(a.addedDate || a.createdTime || 0));
		else if (sortBy === 'irr') result = [...result].sort((a, b) => (b.targetIRR || 0) - (a.targetIRR || 0));
		else if (sortBy === 'min-invest') result = [...result].sort((a, b) => (a.minimumInvestment || 999999) - (b.minimumInvestment || 999999));
		else if (sortBy === 'name') result = [...result].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

		return result;
	});

	// Stage description messages
	const stageDescriptions = {
		browse: "Swipe through deals. Save the ones that catch your eye, skip the rest.",
		saved: "Read the deck and deal page. Work through the DD checklist. Understand the deal before you talk to anyone.",
		diligence: "You've done your homework. Now request an intro to the operator and ask your questions.",
		decision: "Compare your finalists side-by-side. When you're ready, commit or pass.",
		invested: "You're in. Track distributions, K-1s, and hold period progress.",
		passed: "Deals you've passed on. You can always bring them back."
	};

	// Avg IRR for filter bar
	const avgIRR = $derived(() => {
		const withIRR = tabDeals.filter(d => d.targetIRR);
		if (withIRR.length === 0) return '0';
		return (withIRR.reduce((s, d) => s + d.targetIRR, 0) / withIRR.length * 100).toFixed(1);
	});

	function clearFilters() {
		search = ''; assetClass = ''; dealType = ''; strategy = '';
		maxInvest = ''; maxLockup = ''; distributions = ''; minIRR = '';
		sortBy = 'newest'; showArchived = false; buyBoxApplied = false;
	}

	onMount(() => {
		fetchDeals();
		loadDailyCount();
		if (browser) {
			isMobile = window.innerWidth <= 768;
			const handler = () => { isMobile = window.innerWidth <= 768; };
			window.addEventListener('resize', handler);
			return () => window.removeEventListener('resize', handler);
		}
	});
</script>

<svelte:head><title>Deal Flow | GYC</title></svelte:head>

<div class="deals-page">
	<!-- Header -->
	<div class="deals-header">
		<div class="header-row">
			<h1 class="deals-title">Deal Flow {#if isFreeUser}<span class="daily-remaining">{dealsRemaining}/{DAILY_LIMIT} deals remaining today</span>{/if}</h1>
			<div class="view-toggle desktop-only">
				<button class="view-btn" class:active={viewMode === 'grid'} onclick={() => switchView('grid')} title="Grid view">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
				</button>
				<button class="view-btn" class:active={viewMode === 'list'} onclick={() => switchView('list')} title="List view">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
				</button>
				<button class="view-btn" class:active={viewMode === 'map'} onclick={() => switchView('map')} title="Map view">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
				</button>
			</div>
		</div>

		<PipelineTabs {currentTab} counts={$stageCounts} onswitch={switchTab} />
	</div>

	<!-- Filter Bar -->
	<FilterBar
		{search} {assetClass} {dealType} {strategy} {maxInvest} {maxLockup}
		{distributions} {minIRR} {sortBy} {showArchived} {buyBoxApplied}
		totalDeals={filteredDeals().length} avgIRR={avgIRR()}
		isAdmin={$isAdmin}
		onchange={({ field: key, value: val }) => {
			if (key === 'search') search = val;
			else if (key === 'assetClass') assetClass = val;
			else if (key === 'dealType') dealType = val;
			else if (key === 'strategy') strategy = val;
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

	<!-- Stage description -->
	<div class="stage-banner">
		<span class="stage-icon">{STAGE_META[currentTab]?.icon || '🔍'}</span>
		<span class="stage-desc">{stageDescriptions[currentTab] || ''}</span>
	</div>

	<!-- Content -->
	{#if $dealsLoading}
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
	{:else if currentTab === 'decision' && filteredDeals().length >= 2}
		<!-- Compare view on Decide tab -->
		<CompareView deals={filteredDeals()} />
	{:else if filteredDeals().length === 0}
		<div class="empty-state">
			<div class="empty-icon">{STAGE_META[currentTab]?.icon || '📋'}</div>
			{#if hasActiveFilters && currentTab === 'browse'}
				<div class="empty-title">No deals match your filters</div>
				<div class="empty-desc">Try adjusting your criteria or clearing all filters to see every deal.</div>
				<button class="btn-browse" onclick={clearFilters}>Clear All Filters</button>
			{:else if currentTab === 'browse'}
				<div class="empty-title">No deals available</div>
				<div class="empty-desc">New deals are added regularly. Check back soon.</div>
			{:else if currentTab === 'saved'}
				<div class="empty-title">No deals in Review yet</div>
				<div class="empty-desc">Save deals from Filter to start reviewing. Read the deck, work the checklist, and understand the deal before talking to anyone.</div>
				<button class="btn-browse" onclick={() => switchTab('browse')}>Go to Filter</button>
			{:else if currentTab === 'diligence'}
				<div class="empty-title">No deals in Connect yet</div>
				<div class="empty-desc">Complete your review to request introductions with operators. Once you understand a deal, move it here to schedule a call.</div>
				<button class="btn-browse" onclick={() => switchTab('saved')}>Go to Review</button>
			{:else if currentTab === 'decision'}
				<div class="empty-title">No deals in Decide yet</div>
				<div class="empty-desc">Meet operators before making decisions. After your conversations, move deals here to compare finalists side by side.</div>
				<button class="btn-browse" onclick={() => switchTab('diligence')}>Go to Connect</button>
			{:else if currentTab === 'invested'}
				<div class="empty-title">No investments yet</div>
				<div class="empty-desc">Your invested deals will appear here. Track distributions, K-1s, and hold period progress all in one place.</div>
			{:else if currentTab === 'passed'}
				<div class="empty-title">No skipped deals</div>
				<div class="empty-desc">Deals you've passed on will show here. You can reconsider them anytime.</div>
			{:else}
				<div class="empty-title">Nothing here yet</div>
				<div class="empty-desc">Start browsing deals to build your pipeline.</div>
				<button class="btn-browse" onclick={() => switchTab('browse')}>Browse Deals</button>
			{/if}
		</div>
	{:else if viewMode === 'list' && !isMobile}
		<DealTable deals={filteredDeals()} />
	{:else if viewMode === 'map' && !isMobile}
		<DealMap deals={filteredDeals()} />
	{:else if isMobile && currentTab === 'browse'}
		<SwipeFeed deals={filteredDeals()} />
	{:else}
		<div class="deals-grid">
			{#each filteredDeals() as deal (deal.id)}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div onclick={() => trackDealView(deal.id)}>
					<DealCard {deal} />
				</div>
			{/each}
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
			<p class="limit-desc">Free members can view {DAILY_LIMIT} deals per day. Upgrade to Academy for unlimited access to all deals, due diligence tools, and operator introductions.</p>
			<a href="/app/academy" class="limit-btn">Upgrade to Academy</a>
			<button class="limit-dismiss" onclick={() => showLimitModal = false}>Maybe later</button>
		</div>
	</div>
{/if}

<style>
	.deals-page { padding: 20px 24px; max-width: 1400px; }

	.header-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
	.deals-title { font-family: var(--font-headline); font-size: 24px; font-weight: 800; color: var(--text-dark); margin: 0; }

	.view-toggle { display: flex; gap: 4px; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 3px; }
	.view-btn {
		padding: 6px 10px; border: none; background: none; border-radius: 6px;
		cursor: pointer; color: var(--text-muted); transition: all 0.15s;
		display: flex; align-items: center;
	}
	.view-btn:hover { color: var(--text-dark); }
	.view-btn.active { background: var(--primary); color: #fff; }

	.stage-banner {
		display: flex; align-items: center; gap: 10px;
		padding: 12px 16px; margin-bottom: 20px;
		background: var(--bg-card); border: 1px solid var(--border-light);
		border-radius: var(--radius-sm); border-left: 3px solid var(--primary);
	}
	.stage-icon { font-size: 18px; }
	.stage-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); line-height: 1.5; }

	.deals-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
		gap: 16px;
	}

	.loading-state { padding: 20px 0; }
	.skeleton-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
	.skeleton-card {
		background: var(--bg-card); border: 1px solid var(--border-light);
		border-radius: var(--radius-sm); padding: 20px;
	}
	.sk-bar { height: 12px; background: var(--border-light); border-radius: 6px; margin-bottom: 12px; animation: pulse 1.5s infinite; }
	.sk-title { width: 60%; height: 16px; }
	.sk-subtitle { width: 40%; }
	.sk-body { width: 80%; }
	.sk-body.short { width: 50%; margin-bottom: 0; }
	@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }

	.empty-state {
		text-align: center; padding: 60px 20px;
		display: flex; flex-direction: column; align-items: center; gap: 10px;
	}
	.empty-icon { font-size: 40px; margin-bottom: 8px; }
	.empty-title { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); }
	.empty-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); max-width: 400px; line-height: 1.5; }
	.btn-browse {
		display: inline-block; padding: 10px 24px; background: var(--primary);
		color: #fff; border-radius: 8px; font-family: var(--font-ui);
		font-size: 13px; font-weight: 700; text-decoration: none; margin-top: 8px;
		border: none; cursor: pointer;
	}

	.desktop-only { display: flex; }

	.daily-remaining { font-size: 12px; font-weight: 600; color: var(--text-muted); margin-left: 12px; background: var(--bg-card); border: 1px solid var(--border-light); padding: 3px 10px; border-radius: 12px; vertical-align: middle; }

	.limit-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000; display: flex; align-items: center; justify-content: center; }
	.limit-modal { background: var(--bg-card); border-radius: 16px; padding: 40px 32px; max-width: 420px; text-align: center; box-shadow: 0 20px 60px rgba(0,0,0,0.2); }
	.limit-icon { font-size: 40px; margin-bottom: 12px; }
	.limit-title { font-family: var(--font-headline); font-size: 20px; font-weight: 800; color: var(--text-dark); margin: 0 0 10px; }
	.limit-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); line-height: 1.6; margin: 0 0 20px; }
	.limit-btn { display: inline-block; padding: 12px 28px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-size: 14px; font-weight: 700; text-decoration: none; margin-bottom: 10px; }
	.limit-btn:hover { background: #3da86a; }
	.limit-dismiss { display: block; margin: 0 auto; background: none; border: none; font-family: var(--font-ui); font-size: 12px; color: var(--text-muted); cursor: pointer; padding: 4px; }
	.limit-dismiss:hover { color: var(--text-dark); }

	@media (max-width: 768px) {
		.deals-page { padding: 16px; }
		.deals-grid { grid-template-columns: 1fr; }
		.deals-title { font-size: 20px; }
		.desktop-only { display: none; }
		.skeleton-grid { grid-template-columns: 1fr; }
		.daily-remaining { display: block; margin: 6px 0 0; }
	}
</style>
