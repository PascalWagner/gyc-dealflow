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
			if (currentTab === 'saved') return stage === 'saved' || stage === 'vetting';
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
			<h1 class="deals-title">Deal Flow</h1>
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
		onchange={(key, val) => {
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
			<div class="empty-title">
				{currentTab === 'browse' ? 'No deals match your filters' : `No deals in ${STAGE_META[currentTab]?.label || 'this stage'} yet`}
			</div>
			<div class="empty-desc">
				{#if currentTab === 'browse'}
					Try adjusting your filters or clearing them to see all deals.
				{:else if currentTab === 'saved'}
					Save deals from the Filter tab to start building your pipeline.
				{:else if currentTab === 'diligence'}
					Move deals from Review when you're ready to talk to the operator.
				{:else if currentTab === 'decision'}
					Move deals here when you're comparing finalists.
				{:else if currentTab === 'invested'}
					Deals you've committed to will appear here.
				{:else}
					Passed deals will show here. You can always bring them back.
				{/if}
			</div>
			{#if currentTab !== 'browse'}
				<a href="/app/deals" class="btn-browse" onclick={() => switchTab('browse')}>Browse Deals</a>
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
				<DealCard {deal} />
			{/each}
		</div>
	{/if}
</div>

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
	}

	.desktop-only { display: flex; }

	@media (max-width: 768px) {
		.deals-page { padding: 16px; }
		.deals-grid { grid-template-columns: 1fr; }
		.deals-title { font-size: 20px; }
		.desktop-only { display: none; }
		.skeleton-grid { grid-template-columns: 1fr; }
	}
</style>
