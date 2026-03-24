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
	import { isAdmin, userTier } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';

	let currentTab = $state('browse');
	let viewMode = $state('grid'); // grid | list | map
	let isMobile = $state(false);

	// Daily deal limit for free users
	let dailyDealCount = $state(0);
	let showLimitModal = $state(false);
	let resetTimerLabel = $state('Resets at midnight');
	const DAILY_LIMIT = 20;
	const todayKey = $derived(browser ? `gycDailyDeals_${new Date().toISOString().slice(0, 10)}` : '');
	const isFreeUser = $derived(!$isAdmin && $userTier !== 'academy' && $userTier !== 'paid');
	const dealsRemaining = $derived(Math.max(0, DAILY_LIMIT - dailyDealCount));
	const dailyViewsPct = $derived(Math.round((dealsRemaining / DAILY_LIMIT) * 100));
	const dailyViewsColor = $derived(dealsRemaining <= 5 ? '#e74c3c' : dealsRemaining <= 10 ? '#f59e0b' : 'var(--primary)');

	function loadDailyCount() {
		if (!browser) return;
		const stored = JSON.parse(localStorage.getItem(todayKey) || '[]');
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
	const filteredDeals = $derived.by(() => {
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
		if (maxInvest) result = result.filter(d => (d.investmentMinimum || d.minimumInvestment) && (d.investmentMinimum || d.minimumInvestment) <= parseInt(maxInvest));
		if (maxLockup) result = result.filter(d => d.holdPeriod && parseInt(d.holdPeriod) <= parseInt(maxLockup));
		if (minIRR) result = result.filter(d => d.targetIRR && d.targetIRR >= parseFloat(minIRR) / 100);
		if (!showArchived) result = result.filter(d => !d.archived);

		// Sort
		if (sortBy === 'newest') result = [...result].sort((a, b) => new Date(b.addedDate || b.createdTime || 0) - new Date(a.addedDate || a.createdTime || 0));
		else if (sortBy === 'irr') result = [...result].sort((a, b) => (b.targetIRR || 0) - (a.targetIRR || 0));
		else if (sortBy === 'min-invest' || sortBy === 'min_invest') result = [...result].sort((a, b) => ((a.investmentMinimum || a.minimumInvestment || 999999) - (b.investmentMinimum || b.minimumInvestment || 999999)));
		else if (sortBy === 'name' || sortBy === 'az') result = [...result].sort((a, b) => (a.investmentName || a.name || '').localeCompare(b.investmentName || b.name || ''));

		return result;
	});

	// Stage description messages
	const stageDescriptions = {
		browse: { title: 'Filter', text: 'Browse vetted opportunities. Swipe right to save a deal or left to skip it.', color: 'var(--primary)' },
		saved: { title: 'Review', text: 'Read the deck, explore the deal page, and work through the checklist. Understand this deal before reaching out.', color: '#3b82f6' },
		diligence: { title: 'Connect', text: "Time to talk to the operator. Request an intro and we'll connect you via email. Ask your questions, fill in the gaps.", color: '#f97316' },
		decision: { title: 'Decide', text: 'Compare deals side by side. Ready to commit? Wire the money and mark it as Invested.', color: '#a855f7' },
		invested: { title: 'Invested', text: "Deals you've committed capital to. Track distributions, K-1s, and hold periods.", color: '#059669' },
		passed: { title: 'Skipped', text: "Deals you decided weren't right for you. You can always reconsider later.", color: 'var(--text-muted)' }
	};
	const currentStageContent = $derived(stageDescriptions[currentTab] || stageDescriptions.browse);

	// Avg IRR for filter bar
	const avgIRR = $derived.by(() => {
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
		updateResetTimer();
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
	<FilterBar
		{search} {assetClass} {dealType} {strategy} {maxInvest} {maxLockup}
		{distributions} {minIRR} {sortBy} {showArchived} {buyBoxApplied}
		totalDeals={filteredDeals.length} avgIRR={avgIRR}
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

	{#if !(isMobile && currentTab === 'browse')}
		<div class="stage-banner" style="border-left-color:{currentStageContent.color}">
			<div class="stage-copy">
				<span class="stage-title">{currentStageContent.title}</span>
				<span class="stage-desc">{currentStageContent.text}</span>
			</div>
		</div>
	{/if}

	{#if isFreeUser && !(isMobile && currentTab === 'browse')}
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
	{:else if currentTab === 'decision' && filteredDeals.length >= 2}
		<!-- Compare view on Decide tab -->
		<CompareView deals={filteredDeals} onstagechange={(dealId, nextStage) => dealStages.setStage(dealId, nextStage)} />
	{:else if filteredDeals.length === 0}
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
		<DealTable deals={filteredDeals} onopen={(dealId) => { trackDealView(dealId); if (browser) window.location.href = `/deal/${dealId}`; }} />
	{:else if viewMode === 'map' && !isMobile}
		<DealMap deals={filteredDeals} />
	{:else if isMobile && currentTab === 'browse'}
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
	.deals-page {
		padding: 0 32px 48px;
	}

	.deals-header {
		padding: 18px 0 14px;
	}

	.header-row {
		display: flex;
		align-items: center;
		gap: 14px;
		width: 100%;
		min-width: 0;
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
		padding: 14px 20px;
		margin: 16px 0;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
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
		margin-bottom: 16px;
		padding: 10px 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
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

	.deals-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 20px;
	}

	.loading-state { padding: 20px 0; }
	.skeleton-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }

	.skeleton-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 20px;
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
	}

	@media (min-width: 769px) and (max-width: 1024px) {
		.deals-page {
			padding: 0 24px 40px;
		}

		.header-row {
			flex-wrap: wrap;
		}

		.deals-grid,
		.skeleton-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 18px;
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
		.desktop-only { display: none; }
		.stage-copy { display: block; }
		.stage-desc { display: block; margin-top: 6px; }
		.daily-views { display: none; }
	}
</style>
