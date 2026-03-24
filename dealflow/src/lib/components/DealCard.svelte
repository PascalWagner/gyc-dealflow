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
	const isNew = $derived(() => {
		const created = deal.createdAt || deal.created_at || deal.createdTime || deal.addedDate;
		if (!created) return false;
		return (now - new Date(created)) < 14 * 24 * 60 * 60 * 1000;
	});
	const isUpdated = $derived(() => {
		const updated = deal.updatedAt || deal.updated_at || deal.lastModified;
		if (!updated) return false;
		const diff = now - new Date(updated);
		return diff < 7 * 24 * 60 * 60 * 1000 && diff > 0;
	});
	const isClosingSoon = $derived(() => {
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
			{#if isNew()}
				<span class="pill pill-new">New</span>
			{/if}
			{#if isUpdated()}
				<span class="pill pill-updated">Updated</span>
			{/if}
			{#if isClosingSoon()}
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
		border: 1px solid var(--border-light);
		border-radius: var(--radius-lg);
		overflow: hidden;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
		position: relative;
	}
	.deal-card:hover {
		transform: translateY(-2px);
		box-shadow: var(--shadow-md);
	}

	.card-hero {
		height: 120px;
		position: relative;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 12px;
	}

	.hero-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
	}
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
	.badge.audit {
		background: rgba(81,190,123,0.8);
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
	.pill-nodeck { background: rgba(150,150,150,0.7); color: #fff; }

	.hero-icon {
		font-size: 32px;
		position: absolute;
		bottom: 12px;
		left: 12px;
		opacity: 0.6;
	}

	.hero-irr {
		position: absolute;
		bottom: 8px;
		right: 12px;
		text-align: right;
	}
	.irr-value {
		display: block;
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 800;
		color: #fff;
		line-height: 1;
	}
	.irr-label {
		font-family: var(--font-ui);
		font-size: 9px;
		color: rgba(255,255,255,0.7);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.card-body {
		display: block;
		padding: 16px;
		text-decoration: none;
		color: inherit;
		cursor: pointer;
	}

	.card-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
	}

	.card-manager {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		margin-bottom: 12px;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
		margin-bottom: 12px;
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
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.metric-value.highlight {
		color: var(--primary);
	}

	.funding-bar {
		margin-top: 4px;
	}
	.funding-labels {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-ui);
		font-size: 10px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.funding-track {
		height: 4px;
		background: var(--border-light);
		border-radius: 2px;
		overflow: hidden;
	}
	.funding-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 2px;
		transition: width 0.3s ease;
	}
	.funding-fill.empty {
		width: 100%;
		background: var(--border);
	}
	.funding-bar.no-data .funding-labels {
		opacity: 0.5;
	}

	.stage-badge {
		position: absolute;
		top: 8px;
		right: 8px;
		padding: 3px 10px;
		border-radius: 4px;
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		color: #fff;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		z-index: 2;
	}
</style>
