<script>
	import { dealStages } from '$lib/stores/deals.js';
	import { getDealHeroImage } from '$lib/utils/dealHero.js';
	import { tapLight, tapMedium, notifySuccess } from '$lib/utils/haptics.js';
	import { shareDeal, canShare } from '$lib/utils/share.js';

	let {
		deals = [],
		compareIds = [],
		compareLimit = 3,
		oncomparetoggle = () => {},
		showCompare = false
	} = $props();

	let currentIndex = $state(0);

	const currentDeal = $derived(deals[currentIndex] || null);
	const compareSet = $derived(new Set(compareIds));

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
		Multifamily: { gradient: 'linear-gradient(135deg, #2d5a3d, #4a8c6a)', icon: '\u{1f3e2}' },
		'Multi-Family': { gradient: 'linear-gradient(135deg, #2d5a3d, #4a8c6a)', icon: '\u{1f3e2}' },
		Industrial: { gradient: 'linear-gradient(135deg, #5a3d2d, #8c6a4a)', icon: '\u{1f3ed}' },
		'Self Storage': { gradient: 'linear-gradient(135deg, #3d2d5a, #6a4a8c)', icon: '\u{1f4e6}' },
		'Build-to-Rent': { gradient: 'linear-gradient(135deg, #5a2d3d, #8c4a6a)', icon: '\u{1f3d8}\ufe0f' }
	};

	function getHero(deal) {
		return assetHeroes[deal.assetClass] || { gradient: 'linear-gradient(135deg, #1a2332, #2d3a4c)', icon: '\u{1f3e0}' };
	}

	function getHeroImage(deal) {
		return deal.propertyImageUrl || getDealHeroImage(deal) || deal.imageUrl || '';
	}

	function openDealDetails(deal) {
		if (!deal || typeof window === 'undefined') return;
		window.location.href = `/deal/${deal.id}`;
	}

	function handleCardKeydown(event, deal) {
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openDealDetails(deal);
	}

	function skipDeal() {
		if (currentDeal) {
			dealStages.setStage(currentDeal.id, 'passed');
		}
		tapMedium();
		nextCard();
	}

	function saveDeal() {
		if (currentDeal) {
			dealStages.setStage(currentDeal.id, 'saved');
		}
		notifySuccess();
		nextCard();
	}

	async function handleShare(deal) {
		if (!deal) return;
		tapLight();
		await shareDeal(deal);
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

	function handleCompareToggle(dealId) {
		oncomparetoggle(dealId);
	}

	function isCompareLimitReached(dealId) {
		return !compareSet.has(dealId) && compareIds.length >= compareLimit;
	}

	function stopPropagation(event, callback = null) {
		event.stopPropagation();
		callback?.();
	}

	$effect(() => {
		if (deals) currentIndex = 0;
	});
</script>

<div class="swipe-container">
	{#if deals.length === 0}
		<div class="swipe-empty">
			<div class="swipe-empty-icon">🔍</div>
			<div class="swipe-empty-text">No deals to show</div>
			<div class="swipe-empty-sub">Try adjusting your filters</div>
		</div>
	{:else if currentDeal}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="swipe-card"
			role="link"
			tabindex="0"
			onclick={() => openDealDetails(currentDeal)}
			onkeydown={(event) => handleCardKeydown(event, currentDeal)}
		>
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

				{#if showCompare}
					<button
						class="swipe-compare"
						class:is-selected={compareSet.has(currentDeal.id)}
						class:is-at-limit={isCompareLimitReached(currentDeal.id)}
						onclick={(event) => stopPropagation(event, () => handleCompareToggle(currentDeal.id))}
					>
						{#if compareSet.has(currentDeal.id)}
							Remove From Compare
						{:else if isCompareLimitReached(currentDeal.id)}
							Compare Full
						{:else}
							Add To Compare
						{/if}
					</button>
				{/if}

				<div class="swipe-actions">
					<button class="swipe-action skip" onclick={(event) => stopPropagation(event, skipDeal)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
						Skip
					</button>
					<a href="/deal/{currentDeal.id}" class="swipe-action view" onclick={(event) => stopPropagation(event)}>
						View Deal
					</a>
					{#if canShare()}
						<button
							class="swipe-action share"
							onclick={(event) => stopPropagation(event, () => handleShare(currentDeal))}
							aria-label="Share deal"
						>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
								<circle cx="18" cy="5" r="3"></circle>
								<circle cx="6" cy="12" r="3"></circle>
								<circle cx="18" cy="19" r="3"></circle>
								<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
								<line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
							</svg>
							Share
						</button>
					{/if}
					<button class="swipe-action save" onclick={(event) => stopPropagation(event, saveDeal)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="20" height="20">
							<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
						</svg>
						Save
					</button>
				</div>
			</div>
		</div>

		<div class="swipe-nav">
			<button class="nav-arrow" onclick={prevCard} disabled={currentIndex === 0} aria-label="Previous deal">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
					<polyline points="15 18 9 12 15 6"></polyline>
				</svg>
			</button>
			<div class="swipe-position">{currentIndex + 1} of {deals.length}</div>
			<button class="nav-arrow" onclick={nextCard} disabled={currentIndex >= deals.length - 1} aria-label="Next deal">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
					<polyline points="9 18 15 12 9 6"></polyline>
				</svg>
			</button>
		</div>
	{/if}
</div>

<style>
	.swipe-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding-bottom: 24px;
	}

	.swipe-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 16px;
		overflow: hidden;
		max-width: 380px;
		width: 100%;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
		cursor: pointer;
		outline: none;
		transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
	}

	.swipe-card:focus-visible {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12), 0 4px 20px rgba(0, 0, 0, 0.08);
	}

	.swipe-hero {
		height: 140px;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 12px;
	}

	.swipe-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}

	.badge {
		background: rgba(0, 0, 0, 0.4);
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
		color: rgba(255, 255, 255, 0.7);
		text-transform: uppercase;
	}

	.swipe-body {
		padding: 16px;
	}

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

	.metric-value.highlight {
		color: var(--primary);
	}

	.swipe-compare {
		width: 100%;
		margin-bottom: 12px;
		padding: 10px 12px;
		border-radius: 10px;
		border: 1px solid var(--border);
		background: transparent;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--text-secondary);
		cursor: pointer;
	}

	.swipe-compare.is-selected {
		background: rgba(81, 190, 123, 0.12);
		border-color: rgba(81, 190, 123, 0.34);
		color: var(--primary);
	}

	.swipe-compare.is-at-limit {
		background: rgba(245, 158, 11, 0.08);
		border-color: rgba(245, 158, 11, 0.25);
		color: #b7791f;
	}

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

	.swipe-action.skip:hover {
		border-color: var(--red, #e74c3c);
		color: var(--red, #e74c3c);
	}

	.swipe-action.save {
		background: var(--primary);
		color: #fff;
		border-color: var(--primary);
	}

	.swipe-action.view {
		border-color: var(--primary);
		color: var(--primary);
	}

	.swipe-action.share {
		flex: 0 0 88px;
	}

	.swipe-nav {
		display: flex;
		align-items: center;
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

	.nav-arrow:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.nav-arrow:not(:disabled):hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.swipe-position {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		min-width: 64px;
		text-align: center;
	}

	.swipe-empty {
		text-align: center;
		padding: 60px 20px;
	}

	.swipe-empty-icon {
		font-size: 40px;
		margin-bottom: 12px;
	}

	.swipe-empty-text {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.swipe-empty-sub {
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	@media (min-width: 769px) and (max-width: 1024px) {
		.swipe-card {
			max-width: 480px;
		}
	}
</style>
