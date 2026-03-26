<script>
	import { dealStages, networkCounts } from '$lib/stores/deals.js';
	import {
		getDealCardUtilityActionLabel,
		trackDealCardUtilityActionDisabledImpression,
		trackDealCardUtilityActionImpression
	} from '$lib/utils/dealCardUtilityAction.js';
	import { getDealHeroImage } from '$lib/utils/dealHero.js';
	import { notifySuccess, tapLight } from '$lib/utils/haptics.js';
	import { canShare, shareDeal } from '$lib/utils/share.js';

	let {
		deal,
		utilityAction = null,
		utilityAnalytics = null,
		footerActions = [],
		compareSelected = false,
		compareAtLimit = false,
		onutilityaction = () => {}
	} = $props();

	function fmtPct(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '—';
		return (n > 1 ? n : n * 100).toFixed(1) + '%';
	}

	function fmtMoney(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(String(val).replace(/[$,]/g, '')) : val;
		if (isNaN(n)) return '—';
		if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}

	function fmtMultiple(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '—';
		return n.toFixed(2) + 'x';
	}

	function formatHold(val) {
		if (val === undefined || val === null || val === '') return '—';
		if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (!isNaN(n)) {
			if (n < 1) return `${Math.round(n * 12)} Mos`;
			return `${n} ${n === 1 ? 'Yr' : 'Yrs'}`;
		}
		return val;
	}

	function formatDist(inputDeal) {
		return inputDeal.distributionFrequency || inputDeal.distributions || '—';
	}

	function getManagerTier(inputDeal) {
		const size = inputDeal.fundAUM || inputDeal.offeringSize || inputDeal.aum || inputDeal.managementCompanyAUM;
		if (!size) return { range: '—' };
		if (size >= 1000000000) return { range: '$1B+' };
		if (size >= 100000000) return { range: '$100M-$1B' };
		if (size >= 50000000) return { range: '$50M-$100M' };
		return { range: '<$50M' };
	}

	function getStrategySummary(inputDeal) {
		const text = inputDeal.investmentStrategy || inputDeal.summary || inputDeal.description || inputDeal.teaser || '';
		if (!text) return '';
		const firstSentence = text.split(/(?<=[.!?])\s+/)[0];
		const clean = (firstSentence || text).trim();
		if (clean.length <= 140) return clean;
		return clean.slice(0, 137).replace(/[,;:\s]+$/, '') + '...';
	}

	function handleAction(event, action) {
		event.stopPropagation();
		if (!action.next || action.disabled) return;
		if (action.next === 'review' || action.next === 'invested') {
			notifySuccess();
		}
		dealStages.setStage(deal.id, action.next);
	}

	function handleCardClick() {
		tapLight();
	}

	async function handleShare(event) {
		event.stopPropagation();
		tapLight();
		await shareDeal(deal);
	}

	function handleUtilityAction(event) {
		event.stopPropagation();
		if (!utilityAction?.show || utilityAction?.disabled) return;
		tapLight();
		onutilityaction({
			deal,
			utilityAction,
			utilityAnalytics: {
				...(utilityAnalytics || {}),
				labelShown: utilityLabel,
				isDisabled: Boolean(utilityAction?.disabled)
			}
		});
	}

	const assetHeroes = {
		'Private Credit': { gradient: 'linear-gradient(135deg, #1a365d 0%, #2563eb 100%)', icon: '🏦' },
		'Multifamily': { gradient: 'linear-gradient(135deg, #1a3a5c 0%, #2d6a9f 100%)', icon: '🏢' },
		'Multi-Family': { gradient: 'linear-gradient(135deg, #1a3a5c 0%, #2d6a9f 100%)', icon: '🏢' },
		'Industrial': { gradient: 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)', icon: '🏭' },
		'Self Storage': { gradient: 'linear-gradient(135deg, #5b4a1e 0%, #8b7535 100%)', icon: '📦' },
		'Hotels/Hospitality': { gradient: 'linear-gradient(135deg, #4a235a 0%, #7d3c98 100%)', icon: '🏨' },
		'Lending': { gradient: 'linear-gradient(135deg, #1a365d 0%, #2563eb 100%)', icon: '💵' }
	};

	const hero = $derived(assetHeroes[deal.assetClass] || { gradient: 'linear-gradient(135deg, #0A1E21 0%, #1F5159 100%)', icon: '🏠' });
	const heroImg = $derived(deal.propertyImageUrl || getDealHeroImage(deal) || deal.imageUrl || '');
	const managerTier = $derived(getManagerTier(deal));
	const strategySummary = $derived(getStrategySummary(deal));
	const fundingPct = $derived(deal.pctFunded ? Math.min(Number(deal.pctFunded), 100) : 0);
	const hasFunding = $derived(!!(deal.totalAmountSold && deal.offeringSize && deal.pctFunded));
	const hasNoDeck = $derived(!(deal.deckUrl || deal.ppmUrl || deal.subAgreementUrl));
	const utilityLabel = $derived(
		getDealCardUtilityActionLabel(utilityAction, {
			compareSelected,
			compareAtLimit
		})
	);
	const utilityVisible = $derived(Boolean(utilityAction?.show && utilityLabel));
	const socialCounts = $derived($networkCounts[deal.id] || null);
	const networkProof = $derived.by(() => {
		if (!socialCounts) return null;
		if ((socialCounts.invested || 0) >= 1) {
			return {
				text: `${socialCounts.invested} LP${socialCounts.invested === 1 ? '' : 's'} from the network ${socialCounts.invested === 1 ? 'has' : 'have'} invested`,
				emphasis: true
			};
		}
		if ((socialCounts.reviewing || 0) >= 1) {
			return {
				text: `${socialCounts.reviewing} LP${socialCounts.reviewing === 1 ? '' : 's'} ${socialCounts.reviewing === 1 ? 'is' : 'are'} reviewing this deal`,
				emphasis: false
			};
		}
		return null;
	});

	$effect(() => {
		if (!utilityVisible || !utilityAnalytics) return;
		const payload = {
			...utilityAnalytics,
			labelShown: utilityLabel,
			isDisabled: Boolean(utilityAction?.disabled)
		};
		if (payload.isDisabled) trackDealCardUtilityActionDisabledImpression(payload);
		else trackDealCardUtilityActionImpression(payload);
	});
</script>

<div class="deal-card" class:is-compared={compareSelected}>
	<div
		class="card-hero"
		style="background:{heroImg ? `linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.5) 100%), url(${heroImg})` : hero.gradient};{heroImg ? 'background-size:cover;background-position:center;' : ''}"
	>
		<div class="hero-badges">
			<span class="badge">{deal.assetClass || 'Real Estate'}</span>
			<span class="badge">{deal.dealType || 'Fund'}</span>
			{#if deal.strategy}
				<span class="badge">{deal.strategy}</span>
			{/if}
			{#if deal.financials === 'Audited'}
				<span class="badge audit">Audited</span>
			{/if}
			{#if hasNoDeck}
				<span class="no-deck-bubble">No Deck</span>
			{/if}
		</div>

		{#if !heroImg}
			<div class="hero-icon">{hero.icon}</div>
		{/if}

		{#if deal.targetIRR}
			<div class="hero-irr">
				<span class="irr-value">{fmtPct(deal.targetIRR)}</span>
				<span class="irr-label">Target IRR</span>
			</div>
		{/if}
	</div>

	<a href="/deal/{deal.id}" class="card-body" onclick={handleCardClick}>
		<div class="card-title">{deal.investmentName}</div>
		<div class="card-manager">{deal.managementCompany || ''}</div>
		{#if deal.location}
			<div class="card-location">{deal.location}</div>
		{/if}
		{#if strategySummary}
			<div class="card-summary">{strategySummary}</div>
		{/if}

		<div class="metrics">
			<div class="metric">
				<div class="metric-label">Pref Return</div>
				<div class="metric-value highlight">{fmtPct(deal.preferredReturn)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Minimum</div>
				<div class="metric-value">{fmtMoney(deal.investmentMinimum)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Lockup</div>
				<div class="metric-value">{formatHold(deal.holdPeriod)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Distribution</div>
				<div class="metric-value">{formatDist(deal)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">LP/GP Split</div>
				<div class="metric-value">{deal.lpGpSplit && /\d+\s*\/\s*\d+/.test(deal.lpGpSplit) ? deal.lpGpSplit : '—'}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Equity Mult.</div>
				<div class="metric-value">{fmtMultiple(deal.equityMultiple)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Manager AUM</div>
				<div class="metric-value">{managerTier.range}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Founded</div>
				<div class="metric-value">{deal.mcFoundingYear || '—'}</div>
			</div>
		</div>

		{#if hasFunding}
			<div class="funding-bar">
				<div class="funding-labels">
					<span>{fmtMoney(deal.totalAmountSold)} raised</span>
					<span>{deal.pctFunded}% funded</span>
				</div>
				<div class="funding-track">
					<div class="funding-fill" style="width:{fundingPct}%"></div>
				</div>
			</div>
		{:else}
			<div class="funding-bar no-data">
				<div class="funding-labels">
					<span>SEC filing data not available</span>
					<span></span>
				</div>
				<div class="funding-track">
					<div class="funding-fill empty"></div>
				</div>
			</div>
		{/if}

		{#if networkProof}
			<div class="network-proof" class:is-invested={networkProof.emphasis}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
					<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
					<circle cx="9" cy="7" r="4"></circle>
					<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
					<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
				</svg>
				<span>{networkProof.text}</span>
			</div>
		{/if}
	</a>

	<div class="card-footer">
		{#if utilityVisible}
			<div class="card-utility-row">
				<button
					class="card-btn utility-btn"
					class:btn-compare-selected={utilityAction?.action === 'compare' && compareSelected}
					class:btn-compare-limit={utilityAction?.action === 'compare' && compareAtLimit && !compareSelected}
					class:btn-utility-disabled={utilityAction?.disabled}
					aria-pressed={utilityAction?.action === 'compare' ? compareSelected : undefined}
					disabled={utilityAction?.disabled}
					onclick={handleUtilityAction}
				>
					{#if utilityAction?.action === 'compare'}
						{#if compareSelected}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="5" y1="12" x2="19" y2="12"></line>
							</svg>
						{:else}
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<line x1="12" y1="5" x2="12" y2="19"></line>
								<line x1="5" y1="12" x2="19" y2="12"></line>
							</svg>
						{/if}
					{:else if utilityAction?.action === 'viewDeck'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
							<polyline points="14 2 14 8 20 8"></polyline>
						</svg>
					{:else if utilityAction?.action === 'requestIntroduction'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
							<circle cx="9" cy="7" r="4"></circle>
							<line x1="19" y1="8" x2="19" y2="14"></line>
							<line x1="16" y1="11" x2="22" y2="11"></line>
						</svg>
					{:else}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<circle cx="12" cy="12" r="10"></circle>
							<line x1="15" y1="9" x2="9" y2="15"></line>
							<line x1="9" y1="9" x2="15" y2="15"></line>
						</svg>
					{/if}
					{utilityLabel}
				</button>
			</div>
		{/if}

		<div class="card-actions-row">
			{#if canShare()}
				<button class="card-btn share-btn" onclick={handleShare} aria-label="Share deal">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
						<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
					</svg>
				</button>
			{/if}
			{#each footerActions as action}
				<button
					class="card-btn"
					class:btn-primary={action.primary}
					class:btn-danger={action.danger}
					class:btn-status={action.status}
					class:btn-full={action.full}
					disabled={action.disabled}
					onclick={(event) => handleAction(event, action)}
				>
					{#if action.icon === 'x'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					{:else if action.icon === 'bookmark'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
						</svg>
					{:else if action.icon === 'check'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M9 11l3 3L22 4"></path>
							<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
						</svg>
					{:else if action.icon === 'back'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="15 18 9 12 15 6"></polyline>
						</svg>
					{:else if action.icon === 'money' || action.icon === 'tracking'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
							<polyline points="22 4 12 14.01 9 11.01"></polyline>
						</svg>
					{:else if action.icon === 'refresh'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
							<polyline points="1 4 1 10 7 10"></polyline>
							<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
						</svg>
					{/if}
					{action.label}
				</button>
			{/each}
		</div>
	</div>
</div>

<style>
	.deal-card {
		background: var(--bg-card);
		border-radius: var(--radius);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-card);
		overflow: hidden;
		cursor: pointer;
		transition: all 0.25s ease;
		display: flex;
		flex-direction: column;
		position: relative;
		min-height: 100%;
	}

	.deal-card:hover {
		box-shadow: var(--shadow-card-hover);
		transform: translateY(-2px);
		border-color: #D4C9AD;
	}

	.deal-card.is-compared {
		border-color: rgba(81, 190, 123, 0.35);
		box-shadow: 0 0 0 2px rgba(81, 190, 123, 0.12), var(--shadow-card);
	}

	.card-hero {
		position: relative;
		padding: 12px 16px 8px;
		height: 184px;
		box-sizing: border-box;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.hero-badges {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
		position: relative;
		z-index: 1;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		border-radius: 20px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: rgba(0, 0, 0, 0.36);
		color: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.12);
	}

	.badge.audit {
		background: rgba(81, 190, 123, 0.25);
		color: #7DEFA5;
	}

	.no-deck-bubble {
		background: #fbbf24;
		color: #78350f;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 10px;
		letter-spacing: 0.3px;
		font-family: var(--font-ui);
		text-transform: none;
	}

	.hero-icon {
		font-size: 46px;
		position: absolute;
		right: -4px;
		bottom: -12px;
		opacity: 0.14;
		filter: grayscale(1) brightness(1.6);
		pointer-events: none;
	}

	.hero-irr {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-self: flex-start;
	}

	.irr-value {
		display: block;
		font-family: var(--font-ui);
		font-size: 28px;
		font-weight: 800;
		color: #fff;
		letter-spacing: -0.5px;
		line-height: 1;
	}

	.irr-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.55);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 2px;
	}

	.card-body {
		padding: 0;
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.card-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
		line-height: 1.3;
		letter-spacing: -0.2px;
		padding: 11px 15px 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		min-height: calc(2 * 1.3em);
	}

	.card-manager {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 500;
		margin-bottom: 2px;
		padding: 0 15px;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-location {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
		padding: 0 15px;
		margin-bottom: 4px;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-summary {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.4;
		padding: 0 15px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		min-height: calc(2 * 1.4em);
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 0;
		border-top: 1px solid var(--border);
		margin-top: 8px;
	}

	.metric {
		padding: 7px 9px;
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.metric:nth-child(4n) { border-right: none; }
	.metric:nth-last-child(-n + 4) { border-bottom: none; }

	.metric-label {
		font-family: var(--font-ui);
		font-size: 8px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	.metric-value {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-dark);
		margin-top: 2px;
	}

	.metric-value.highlight {
		color: var(--primary);
	}

	.funding-bar {
		padding: 7px 12px 9px;
		margin-top: auto;
	}

	.funding-labels {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-ui);
		font-size: 10px;
		color: var(--text-muted);
		margin-bottom: 4px;
		gap: 12px;
	}

	.funding-labels span:first-child {
		color: var(--primary);
		font-weight: 600;
	}

	.funding-track {
		height: 5px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
	}

	.funding-fill {
		height: 100%;
		border-radius: 3px;
		background: var(--primary);
	}

	.funding-fill.empty {
		width: 100%;
		background: var(--border);
	}

	.funding-bar.no-data .funding-labels span:first-child {
		color: var(--text-muted);
		font-weight: 500;
		font-style: italic;
	}

	.card-footer {
		padding: 10px 14px 12px;
		border-top: 1px solid var(--border-light);
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.card-utility-row {
		display: flex;
	}

	.card-actions-row {
		display: flex;
		gap: 6px;
		flex-wrap: wrap;
	}

	.network-proof {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px 8px;
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-secondary);
		line-height: 1.4;
	}

	.network-proof svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		opacity: 0.72;
	}

	.network-proof.is-invested {
		color: var(--primary);
		font-weight: 600;
	}

	.card-btn {
		flex: 1;
		padding: 8px 12px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		border-radius: var(--radius-sm);
		cursor: pointer;
		transition: all var(--transition);
		text-align: center;
		border: 1px solid var(--border);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 4px;
		background: transparent;
		color: var(--text-secondary);
	}

	.card-btn:hover:not(:disabled) {
		border-color: var(--primary);
		color: var(--primary);
	}

	.card-btn svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.btn-primary {
		background: var(--primary);
		color: #fff;
		border-color: var(--primary);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--primary-hover);
		border-color: var(--primary-hover);
		color: #fff;
	}

	.btn-danger {
		color: #e57373;
		border-color: rgba(229, 115, 115, 0.3);
	}

	.btn-danger:hover:not(:disabled) {
		color: #e57373;
		border-color: rgba(229, 115, 115, 0.55);
		background: rgba(229, 115, 115, 0.05);
	}

	.btn-status {
		border: none;
		background: transparent;
		color: var(--green);
		cursor: default;
	}

	.btn-status:hover:not(:disabled) {
		border: none;
		background: transparent;
		color: var(--green);
	}

	.btn-full { flex: 1 1 100%; }

	.card-btn:disabled {
		opacity: 1;
		cursor: default;
	}

	.share-btn {
		flex: 0 0 36px;
		padding: 8px;
	}

	.utility-btn {
		flex: 1 1 100%;
	}

	.btn-compare-selected {
		background: rgba(81, 190, 123, 0.12);
		border-color: rgba(81, 190, 123, 0.34);
		color: var(--primary);
	}

	.btn-compare-selected:hover:not(:disabled) {
		background: rgba(81, 190, 123, 0.18);
		border-color: rgba(81, 190, 123, 0.46);
		color: var(--primary);
	}

	.btn-compare-limit {
		border-color: rgba(245, 158, 11, 0.28);
		color: #b7791f;
		background: rgba(245, 158, 11, 0.08);
	}

	.btn-utility-disabled {
		border-style: dashed;
		border-color: rgba(148, 163, 184, 0.28);
		background: rgba(148, 163, 184, 0.08);
		color: var(--text-muted);
	}

	@media (max-width: 1200px) {
		.metrics {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.metric:nth-child(2n) { border-right: none; }
		.metric:nth-last-child(-n + 2) { border-bottom: none; }
	}
</style>
