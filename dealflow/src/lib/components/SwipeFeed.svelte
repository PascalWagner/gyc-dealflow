<script>
	import { dealStages, stageLabel, STAGE_META, normalizeStage } from '$lib/stores/deals.js';
	import { getDealHeroImage } from '$lib/utils/dealHero.js';

	let { deals = [], search = '', onfilter = () => {}, onsearch = () => {} } = $props();

	let currentIndex = $state(0);
	let mobileView = $state('swipe'); // 'swipe' | 'feed'

	const currentDeal = $derived(deals[currentIndex] || null);

	function fmtPct(val) {
		if (!val) return '\u2014';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '\u2014';
		return (n > 1 ? n : n * 100).toFixed(1) + '%';
	}

	function fmtMoney(val) {
		if (!val) return '\u2014';
		const n = typeof val === 'string' ? parseFloat(String(val).replace(/[$,]/g, '')) : val;
		if (isNaN(n)) return '\u2014';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}

	function formatHold(val) {
		if (!val) return '\u2014';
		if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open-ended';
		return val + ' yr';
	}

	function formatDist(deal) {
		return deal.distributionFrequency || deal.distributions || '\u2014';
	}

	const assetHeroes = {
		'Private Credit': { gradient: 'linear-gradient(135deg, #1e3a5f, #2d5a8c)', icon: '\u{1f3e6}' },
		'Multifamily': { gradient: 'linear-gradient(135deg, #2d5a3d, #4a8c6a)', icon: '\u{1f3e2}' },
		'Multi-Family': { gradient: 'linear-gradient(135deg, #2d5a3d, #4a8c6a)', icon: '\u{1f3e2}' },
		'Industrial': { gradient: 'linear-gradient(135deg, #5a3d2d, #8c6a4a)', icon: '\u{1f3ed}' },
		'Self Storage': { gradient: 'linear-gradient(135deg, #3d2d5a, #6a4a8c)', icon: '\u{1f4e6}' },
		'Build-to-Rent': { gradient: 'linear-gradient(135deg, #5a2d3d, #8c4a6a)', icon: '\u{1f3d8}\ufe0f' },
	};

	function getHero(deal) {
		return assetHeroes[deal.assetClass] || { gradient: 'linear-gradient(135deg, #1a2332, #2d3a4c)', icon: '\u{1f3e0}' };
	}

	function getHeroImage(deal) {
		return deal.propertyImageUrl || getDealHeroImage(deal) || deal.imageUrl || '';
	}

	function skipDeal() {
		if (currentDeal) {
			dealStages.setStage(currentDeal.id, 'passed');
		}
		nextCard();
	}

	function saveDeal() {
		if (currentDeal) {
			dealStages.setStage(currentDeal.id, 'saved');
		}
		nextCard();
	}

	function nextCard() {
		if (currentIndex < deals.length - 1) {
			currentIndex++;
		}
	}

	function prevCard() {
		if (currentIndex > 0) {
			currentIndex--;
		}
	}

	// Reset index when deals change
	$effect(() => {
		if (deals) currentIndex = 0;
	});
</script>

<!-- Swipe Toolbar -->
<div class="swipe-toolbar">
	<button class="toolbar-btn" onclick={() => mobileView = mobileView === 'swipe' ? 'feed' : 'swipe'} title="Switch view">
		{#if mobileView === 'swipe'}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
		{:else}
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/></svg>
		{/if}
	</button>
	<button class="toolbar-btn" onclick={onfilter}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
		Filters
	</button>
	<input
		type="text"
		class="toolbar-search"
		placeholder="Search deals..."
		value={search}
		oninput={(e) => onsearch(e.target.value)}
	>
	<span class="toolbar-count">{deals.length} deals</span>
</div>

{#if mobileView === 'swipe'}
	<!-- Swipe Card View -->
	<div class="swipe-container">
		{#if deals.length === 0}
			<div class="swipe-empty">
				<div class="swipe-empty-icon">🔍</div>
				<div class="swipe-empty-text">No deals to show</div>
				<div class="swipe-empty-sub">Try adjusting your filters</div>
			</div>
		{:else if currentDeal}
			<div class="swipe-counter">{currentIndex + 1} / {deals.length}</div>
			<div class="swipe-card">
				<div
					class="swipe-hero"
					style="background:{getHeroImage(currentDeal) ? `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 100%), url(${getHeroImage(currentDeal)})` : getHero(currentDeal).gradient};{getHeroImage(currentDeal) ? 'background-size:cover;background-position:center;' : ''}"
				>
					<div class="swipe-badges">
						<span class="badge">{currentDeal.assetClass || 'Real Estate'}</span>
						<span class="badge">{currentDeal.dealType || 'Fund'}</span>
					</div>
					{#if !getHeroImage(currentDeal)}
						<div class="swipe-hero-icon">{getHero(currentDeal).icon}</div>
					{/if}
					{#if currentDeal.targetIRR}
						<div class="swipe-irr">
							<span class="irr-value">{fmtPct(currentDeal.targetIRR)}</span>
							<span class="irr-label">Target IRR</span>
						</div>
					{/if}
				</div>

				<div class="swipe-body">
					<div class="swipe-title">{currentDeal.investmentName}</div>
					<div class="swipe-manager">
						{currentDeal.managementCompany || ''}
						{#if currentDeal.location}&middot; {currentDeal.location}{/if}
					</div>

					<div class="swipe-metrics">
						<div class="metric">
							<div class="metric-label">Pref Return</div>
							<div class="metric-value highlight">{fmtPct(currentDeal.preferredReturn)}</div>
						</div>
						<div class="metric">
							<div class="metric-label">Minimum</div>
							<div class="metric-value">{fmtMoney(currentDeal.investmentMinimum)}</div>
						</div>
						<div class="metric">
							<div class="metric-label">Lockup</div>
							<div class="metric-value">{formatHold(currentDeal.holdPeriod)}</div>
						</div>
						<div class="metric">
							<div class="metric-label">Distribution</div>
							<div class="metric-value">{formatDist(currentDeal)}</div>
						</div>
					</div>

					<div class="swipe-actions">
						<button class="swipe-action skip" onclick={skipDeal}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
							Skip
						</button>
						<a href="/deal/{currentDeal.id}" class="swipe-action view">
							View Deal
						</a>
						<button class="swipe-action save" onclick={saveDeal}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
							Save
						</button>
					</div>
				</div>
			</div>

			<div class="swipe-nav">
				<button class="nav-arrow" onclick={prevCard} disabled={currentIndex === 0}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="15 18 9 12 15 6"/></svg>
				</button>
				<button class="nav-arrow" onclick={nextCard} disabled={currentIndex >= deals.length - 1}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="9 18 15 12 9 6"/></svg>
				</button>
			</div>
		{/if}
	</div>
{:else}
	<!-- Feed (mini card grid) View -->
	<div class="feed-grid">
		{#each deals as deal (deal.id)}
			{@const hero = getHero(deal)}
			{@const heroImg = getHeroImage(deal)}
			<a href="/deal/{deal.id}" class="feed-card">
				<div class="feed-hero" style="background:{heroImg ? `linear-gradient(180deg, rgba(0,0,0,0.12) 0%, rgba(0,0,0,0.4) 100%), url(${heroImg})` : hero.gradient};{heroImg ? 'background-size:cover;background-position:center;' : ''}">
					<span class="feed-badge">{deal.assetClass || 'Real Estate'}</span>
					{#if deal.targetIRR}
						<span class="feed-irr">{fmtPct(deal.targetIRR)} IRR</span>
					{/if}
				</div>
				<div class="feed-info">
					<div class="feed-title">{deal.investmentName}</div>
					<div class="feed-manager">{deal.managementCompany || ''}</div>
					<div class="feed-stats">
						{#if deal.preferredReturn}<span>{fmtPct(deal.preferredReturn)} pref</span>{/if}
						{#if deal.investmentMinimum}<span>{fmtMoney(deal.investmentMinimum)} min</span>{/if}
					</div>
				</div>
			</a>
		{/each}
	</div>
{/if}

<style>
	.swipe-toolbar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 0;
	}

	.toolbar-btn {
		padding: 6px 10px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 11px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 4px;
		color: var(--text-secondary);
	}

	.toolbar-search {
		flex: 1;
		padding: 6px 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		background: var(--bg-card);
		color: var(--text-dark);
		outline: none;
		min-width: 0;
	}

	.toolbar-count {
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	/* Swipe Card */
	.swipe-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-bottom: 24px;
	}

	.swipe-counter {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	.swipe-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
		max-width: 380px;
		width: 100%;
		box-shadow: 0 4px 20px rgba(0,0,0,0.08);
	}

	.swipe-hero {
		height: 140px;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 12px;
	}

	.swipe-badges { display: flex; flex-wrap: wrap; gap: 4px; }
	.badge {
		background: rgba(0,0,0,0.4);
		backdrop-filter: blur(8px);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 3px 8px;
		border-radius: 4px;
	}

	.swipe-hero-icon {
		font-size: 36px;
		position: absolute;
		bottom: 12px;
		left: 12px;
		opacity: 0.6;
	}

	.swipe-irr {
		position: absolute;
		bottom: 8px;
		right: 12px;
		text-align: right;
	}
	.irr-value {
		display: block;
		font-family: var(--font-ui);
		font-size: 24px;
		font-weight: 800;
		color: #fff;
		line-height: 1;
	}
	.irr-label {
		font-family: var(--font-ui);
		font-size: 9px;
		color: rgba(255,255,255,0.7);
		text-transform: uppercase;
	}

	.swipe-body { padding: 16px; }

	.swipe-title {
		font-family: var(--font-ui);
		font-size: 17px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
	}

	.swipe-manager {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 14px;
	}

	.swipe-metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		margin-bottom: 16px;
	}
	.metric-label {
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		color: var(--text-muted);
		margin-bottom: 2px;
	}
	.metric-value {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.metric-value.highlight { color: var(--primary); }

	.swipe-actions {
		display: flex;
		gap: 8px;
	}
	.swipe-action {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 10px 8px;
		border-radius: 10px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-secondary);
		text-decoration: none;
		transition: all 0.15s;
	}
	.swipe-action.skip:hover { border-color: var(--red, #e74c3c); color: var(--red, #e74c3c); }
	.swipe-action.save { background: var(--primary); color: #fff; border-color: var(--primary); }
	.swipe-action.view { border-color: var(--primary); color: var(--primary); }

	.swipe-nav {
		display: flex;
		gap: 16px;
		margin-top: 16px;
	}
	.nav-arrow {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--bg-card);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
		transition: all 0.15s;
	}
	.nav-arrow:disabled { opacity: 0.3; cursor: default; }
	.nav-arrow:not(:disabled):hover { border-color: var(--primary); color: var(--primary); }

	.swipe-empty {
		text-align: center;
		padding: 60px 20px;
	}
	.swipe-empty-icon { font-size: 40px; margin-bottom: 12px; }
	.swipe-empty-text { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-dark); }
	.swipe-empty-sub { font-family: var(--font-ui); font-size: 13px; color: var(--text-muted); margin-top: 4px; }

	/* Feed Grid */
	.feed-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
		padding-bottom: 24px;
	}

	.feed-card {
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 10px;
		overflow: hidden;
		text-decoration: none;
		color: inherit;
	}

	.feed-hero {
		height: 56px;
		display: flex;
		align-items: flex-end;
		justify-content: space-between;
		padding: 6px 8px;
	}

	.feed-badge {
		background: rgba(0,0,0,0.4);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 8px;
		font-weight: 700;
		text-transform: uppercase;
		padding: 2px 6px;
		border-radius: 3px;
	}

	.feed-irr {
		color: #fff;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
	}

	.feed-info { padding: 8px; }

	.feed-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-dark);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.feed-manager {
		font-family: var(--font-ui);
		font-size: 10px;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		margin-bottom: 4px;
	}

	.feed-stats {
		display: flex;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 10px;
		color: var(--text-secondary);
		font-weight: 600;
	}
</style>
