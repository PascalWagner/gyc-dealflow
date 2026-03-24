<script>
	import { dealStages, stageLabel, STAGE_META } from '$lib/stores/deals.js';

	let { deal } = $props();

	const stage = $derived($dealStages[deal.id] || 'browse');
	const isInPipeline = $derived(stage !== 'browse');
	const meta = $derived(STAGE_META[stage]);

	// Format helpers
	function fmtPct(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '—';
		return (n > 1 ? n : n * 100).toFixed(1) + '%';
	}

	function fmtMoney(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(val.replace(/[$,]/g, '')) : val;
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
		return n.toFixed(1) + 'x';
	}

	function formatHold(val) {
		if (!val) return '—';
		if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open-ended';
		return val;
	}

	function formatDist(deal) {
		return deal.distributionFrequency || deal.distributions || '—';
	}

	const fundingPct = $derived(deal.pctFunded ? Math.min(deal.pctFunded, 100) : 0);
	const hasFunding = $derived(!!(deal.totalAmountSold && deal.offeringSize && deal.pctFunded));

	// Asset class hero colors
	const assetHeroes = {
		'Private Credit': { gradient: 'linear-gradient(135deg, #1e3a5f, #2d5a8c)', icon: '🏦' },
		'Multifamily': { gradient: 'linear-gradient(135deg, #2d5a3d, #4a8c6a)', icon: '🏢' },
		'Industrial': { gradient: 'linear-gradient(135deg, #5a3d2d, #8c6a4a)', icon: '🏭' },
		'Self Storage': { gradient: 'linear-gradient(135deg, #3d2d5a, #6a4a8c)', icon: '📦' },
		'Build-to-Rent': { gradient: 'linear-gradient(135deg, #5a2d3d, #8c4a6a)', icon: '🏘️' },
	};
	const hero = $derived(assetHeroes[deal.assetClass] || { gradient: 'linear-gradient(135deg, #1a2332, #2d3a4c)', icon: '🏠' });
	const heroImg = $derived(deal.propertyImageUrl || '');

	// Status badges
	const now = new Date();
	const isNew = $derived.by(() => {
		const created = deal.createdAt || deal.created_at || deal.createdTime || deal.addedDate;
		if (!created) return false;
		return (now - new Date(created)) < 14 * 24 * 60 * 60 * 1000;
	});
	const isUpdated = $derived.by(() => {
		const updated = deal.updatedAt || deal.updated_at || deal.lastModified;
		if (!updated) return false;
		const diff = now - new Date(updated);
		return diff < 7 * 24 * 60 * 60 * 1000 && diff > 0;
	});
	const isClosingSoon = $derived.by(() => {
		if (!deal.close_date && !deal.closeDate) return false;
		const close = new Date(deal.close_date || deal.closeDate);
		const diff = close - now;
		return diff > 0 && diff < 30 * 24 * 60 * 60 * 1000;
	});
	const isVerified = $derived(!!deal.verified);
	const hasNoDeck = $derived(!deal.deckUrl);
</script>

<div class="deal-card">
	<!-- Hero -->
	<div
		class="card-hero"
		style="background:{heroImg ? `linear-gradient(180deg, rgba(0,0,0,0.15) 0%, rgba(0,0,0,0.5) 100%), url(${heroImg})` : hero.gradient};{heroImg ? 'background-size:cover;background-position:center;' : ''}"
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
		</div>
		<div class="status-badges">
			{#if isNew}
				<span class="pill pill-new">New</span>
			{/if}
			{#if isUpdated}
				<span class="pill pill-updated">Updated</span>
			{/if}
			{#if isClosingSoon}
				<span class="pill pill-closing">Closing Soon</span>
			{/if}
			{#if isVerified}
				<span class="pill pill-verified"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="10" height="10"><polyline points="20 6 9 17 4 12"/></svg> Verified</span>
			{/if}
			{#if hasNoDeck}
				<span class="pill pill-nodeck">No Deck</span>
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

	<!-- Body -->
	<a href="/deal/{deal.id}" class="card-body">
		<div class="card-title">{deal.investmentName}</div>
		<div class="card-manager">
			{deal.managementCompany || ''}
			{#if deal.location}
				&middot; {deal.location}
			{/if}
		</div>

		<!-- Metrics grid -->
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
		</div>

		<!-- Funding bar -->
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
				<div class="funding-labels"><span>SEC filing data not available</span></div>
				<div class="funding-track">
					<div class="funding-fill empty"></div>
				</div>
			</div>
		{/if}
	</a>

	<!-- Stage badge -->
	{#if isInPipeline}
		<div class="stage-badge" style="background:{meta.color}">
			{stageLabel(stage)}
		</div>
	{/if}
</div>

<style>
	.deal-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius, 12px);
		box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04));
		overflow: hidden;
		cursor: pointer;
		transition: all 0.25s ease;
		display: flex;
		flex-direction: column;
		position: relative;
		animation: fadeInUp 0.3s ease forwards;
	}
	@keyframes fadeInUp {
		from { opacity: 0; transform: translateY(10px); }
		to { opacity: 1; transform: translateY(0); }
	}
	.deal-card:hover {
		box-shadow: var(--shadow-card-hover, 0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04));
		transform: translateY(-2px);
		border-color: #D4C9AD;
	}

	.card-hero {
		position: relative;
		padding: 14px 18px;
		height: 200px;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		overflow: hidden;
	}

	.hero-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		position: relative;
		z-index: 1;
	}
	.badge {
		display: inline-flex;
		align-items: center;
		background: rgba(0,0,0,0.45);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255,255,255,0.15);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		padding: 3px 10px;
		border-radius: 20px;
	}
	.badge.audit {
		background: rgba(81,190,123,0.25);
		color: #7DEFA5;
		border-color: transparent;
	}

	.status-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 4px;
	}
	.pill {
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		padding: 2px 7px;
		border-radius: 10px;
		display: inline-flex;
		align-items: center;
		gap: 3px;
		line-height: 1.4;
	}
	.pill-new { background: #22c55e; color: #fff; }
	.pill-updated { background: #3b82f6; color: #fff; }
	.pill-closing { background: #f97316; color: #fff; }
	.pill-verified { background: #22c55e; color: #fff; }
	.pill-nodeck { background: #fbbf24; color: #78350f; }

	.hero-icon {
		font-size: 32px;
		position: absolute;
		bottom: 12px;
		left: 18px;
		opacity: 0.6;
	}

	.hero-irr {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		margin-top: auto;
		padding-top: 16px;
	}
	.irr-value {
		display: block;
		font-family: var(--font-ui);
		font-size: 28px;
		font-weight: 800;
		color: #fff;
		letter-spacing: -0.5px;
		line-height: 1;
		text-shadow: 0 2px 8px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3);
	}
	.irr-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		color: rgba(255,255,255,0.75);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 2px;
		text-shadow: 0 1px 4px rgba(0,0,0,0.4);
	}

	.card-body {
		display: flex;
		flex-direction: column;
		padding: 0;
		text-decoration: none;
		color: inherit;
		cursor: pointer;
		flex: 1;
	}

	.card-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
		line-height: 1.3;
		letter-spacing: -0.2px;
		padding: 12px 16px 0;
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
		margin-bottom: 4px;
		padding: 0 16px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px 16px;
		padding: 14px 18px;
		margin-bottom: 0;
		flex: 1;
	}
	.metric {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}
	.metric-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 0;
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

	.funding-bar {
		padding: 8px 14px 10px;
		margin-top: auto;
	}
	.funding-labels {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-ui);
		font-size: 10px;
		color: var(--text-muted);
		margin-bottom: 4px;
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
		background: var(--primary);
		border-radius: 3px;
		transition: width 0.3s ease;
	}
	.funding-fill.empty {
		width: 100%;
		background: var(--border);
	}
	.funding-bar.no-data .funding-labels {
		opacity: 0.5;
	}
	.funding-bar.no-data .funding-labels span:first-child {
		color: var(--text-muted);
		font-weight: 500;
		font-style: italic;
	}

	.stage-badge {
		position: absolute;
		top: 10px;
		right: 10px;
		padding: 4px 10px;
		border-radius: 20px;
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		color: #fff;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		z-index: 2;
	}
</style>
