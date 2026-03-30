<script>
	import {
		buildLegitimacySummary,
		buildSponsorSummary,
		buildStructureSummary,
		buildReturnsSummary,
		buildRiskCompSummary,
		buildRiskCompensationGaps,
		computeDataCompleteness
	} from '$lib/utils/dealAnalysis.js';

	let {
		deal = null,
		buyBox = null,
		feeRows = [],
		operatorTrackRecordRows = [],
		secFiling = null,
		bgCheck = null,
		bgCheckLoading = false,
		bgCheckLoaded = false,
		onLoadBgCheck = null,
		isPaid = false,
		isPublicViewer = false,
		isFreeViewer = false,
		hasMemberAccess = false,
		isAdmin = false,
		nativeCompanionMode = false,
		academyHref = '/app/academy',
		onOpenAuth = null,
		fmt = (v, t) => String(v)
	} = $props();

	let openLayer = $state('legitimacy');

	const rcg = $derived(deal ? buildRiskCompensationGaps(deal) : { risks: [], compensations: [], gaps: [] });
	const completeness = $derived(deal ? computeDataCompleteness(deal) : { filled: 0, total: 24, pct: 0 });

	function getInitials(name) {
		if (!name) return '?';
		return name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
	}

	function bgStatusClass(s) { return s === 'clear' ? 'bg-clear' : s === 'flagged' ? 'bg-flagged' : 'bg-pending'; }
	function bgStatusLabel(s) { return s === 'clear' ? 'Clear' : s === 'flagged' ? 'Flag' : 'Pending'; }

	const layers = $derived([
		{
			id: 'legitimacy',
			icon: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
			title: 'Legitimacy',
			summary: buildLegitimacySummary(deal, secFiling),
			free: true
		},
		{
			id: 'sponsor',
			icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
			title: 'Sponsor',
			summary: buildSponsorSummary(deal),
			free: true
		},
		{
			id: 'structure',
			icon: 'M1 4v16a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8l-7-4H3a2 2 0 0 0-2 2z',
			title: 'Structure',
			summary: buildStructureSummary(deal),
			free: true
		},
		{
			id: 'returns',
			icon: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6',
			title: 'Returns',
			summary: buildReturnsSummary(deal),
			free: false
		},
		{
			id: 'riskcomp',
			icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
			title: 'Risk & Compensation',
			summary: buildRiskCompSummary(deal, rcg),
			free: false
		}
	]);

	function toggleLayer(id) {
		if (openLayer === id) {
			openLayer = null;
		} else {
			openLayer = id;
			// Lazy-load bg check when sponsor layer opens
			if (id === 'sponsor' && !bgCheckLoaded && !bgCheckLoading) {
				onLoadBgCheck?.();
			}
		}
	}

	function canViewLayer(layer) {
		if (layer.free) return true;
		return hasMemberAccess;
	}
</script>

<div class="analysis-dashboard">
	<div class="ad-title-row">
		<h2 class="ad-title">Deal Analysis</h2>
	</div>

	<div class="ad-layers">
		{#each layers as layer}
			{@const isOpen = openLayer === layer.id}
			{@const canView = canViewLayer(layer)}
			<div class="ad-layer" class:open={isOpen} class:locked={!canView}>
				<button class="ad-layer-header" onclick={() => toggleLayer(layer.id)}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="18" height="18" class="ad-layer-icon"><path d={layer.icon}/></svg>
					<div class="ad-layer-content">
						<div class="ad-layer-title">{layer.title}</div>
						<div class="ad-layer-summary">{layer.summary}</div>
					</div>
					{#if !canView}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="ad-lock-icon"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
					{/if}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" class="ad-chevron" class:ad-chevron-open={isOpen}><polyline points="6 9 12 15 18 9"/></svg>
				</button>

				{#if isOpen}
					<div class="ad-layer-body">
						{#if !canView}
							<div class="ad-gate">
								{#if isPublicViewer}
									<p>Create a free account to unlock this analysis layer.</p>
									<button class="ad-gate-btn" onclick={() => onOpenAuth?.()}>Create Free Account</button>
								{:else if nativeCompanionMode}
									<p>This analysis layer is available to members on web.</p>
								{:else}
									<p>Members unlock this analysis layer for every deal.</p>
									<a href={academyHref} class="ad-gate-btn">Become a Member</a>
								{/if}
							</div>

						{:else if layer.id === 'legitimacy'}
							<!-- LEGITIMACY LAYER -->
							<div class="structure-grid">
								{#if secFiling?.hasFiling}
									{#if secFiling.offeringType}<div class="struct-row"><span class="struct-label">SEC Filing</span><span class="struct-value">{secFiling.offeringType}</span></div>{/if}
									{#if secFiling.cik}<div class="struct-row"><span class="struct-label">CIK</span><span class="struct-value">{secFiling.cik}</span></div>{/if}
									{#if secFiling.totalRaised}<div class="struct-row"><span class="struct-label">Capital Raised</span><span class="struct-value">{fmt(secFiling.totalRaised, 'money')}</span></div>{/if}
									{#if secFiling.totalInvestors}<div class="struct-row"><span class="struct-label">Investors</span><span class="struct-value">{secFiling.totalInvestors}</span></div>{/if}
									{#if secFiling.firstSaleDate}<div class="struct-row"><span class="struct-label">First Sale</span><span class="struct-value">{secFiling.firstSaleDate}</span></div>{/if}
								{:else}
									<div class="ad-empty"><p>No SEC filing data matched for this deal.</p></div>
								{/if}
								{#if deal?.addedDate}
									{@const months = Math.round((Date.now() - new Date(deal.addedDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44))}
									<div class="struct-row"><span class="struct-label">In Database</span><span class="struct-value">{months} month{months !== 1 ? 's' : ''}</span></div>
								{/if}
								{#if deal?.status}
									<div class="struct-row"><span class="struct-label">Status</span><span class="struct-value">{deal.status}</span></div>
								{/if}
							</div>

						{:else if layer.id === 'sponsor'}
							<!-- SPONSOR LAYER -->
							{#if deal?.managementCompany}
								<div class="sponsor-card">
									<div class="sponsor-avatar">{getInitials(deal.managementCompany)}</div>
									<div class="sponsor-info">
										<div class="sponsor-name">{deal.managementCompany}</div>
										{#if deal.ceo}<div class="sponsor-meta">{deal.ceo}, CEO</div>{/if}
										<div class="sponsor-meta">
											{#if deal.mcFoundingYear}Founded {deal.mcFoundingYear}{/if}
											{#if deal.mcFoundingYear && deal.investingGeography} · {/if}
											{#if deal.investingGeography}{deal.investingGeography}{/if}
										</div>
										<a href="/sponsor?company={encodeURIComponent(deal.managementCompany)}" class="sponsor-profile-link">View Sponsor Profile &rarr;</a>
									</div>
								</div>
							{/if}

							<!-- Track Record -->
							{#if operatorTrackRecordRows.length > 0 || deal?.fundAUM || deal?.mcFoundingYear}
								<div class="section-divider"></div>
								<div class="subsection-title">Track Record</div>
								<div class="stat-cards">
									{#if deal?.mcFoundingYear}
										{@const years = new Date().getFullYear() - deal.mcFoundingYear}
										<div class="stat-card">
											<div class="stat-value">{years}+ years</div>
											<div class="stat-label">Operating</div>
										</div>
									{/if}
									{#if deal?.fundAUM}
										<div class="stat-card">
											<div class="stat-value">{fmt(deal.fundAUM, 'money')}</div>
											<div class="stat-label">Under Mgmt</div>
										</div>
									{/if}
									{#if deal?.mcFullCycleExits}
										<div class="stat-card">
											<div class="stat-value">{deal.mcFullCycleExits} exits</div>
											<div class="stat-label">Full-cycle</div>
										</div>
									{/if}
								</div>
							{/if}

							<!-- Co-Invest -->
							{#if deal?.sponsorInDeal}
								<div class="co-invest-row">Co-Invest: {fmt(deal.sponsorInDeal, 'pct')} alongside LPs</div>
							{/if}

							<!-- Other deals link -->
							{#if deal?.managementCompany}
								<div class="section-divider"></div>
								<a href="/sponsor?company={encodeURIComponent(deal.managementCompany)}" class="ad-action-link">Other deals from this sponsor &rarr;</a>
							{/if}

							<!-- Background Check -->
							{#if deal?.managementCompanyId}
								<div class="section-divider"></div>
								<div class="subsection-title">
									Background Check
									{#if !hasMemberAccess}
										<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="ad-lock-icon" style="display:inline;vertical-align:middle;margin-left:6px;"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg>
										<span class="member-badge">Member</span>
									{/if}
								</div>
								{#if hasMemberAccess}
									{#if bgCheckLoading}
										<div class="bg-loading">Loading background check...</div>
									{:else if bgCheck}
										<div class="bg-sources">
											{#each [{ label: 'SEC EDGAR', status: bgCheck.sec_status, count: bgCheck.sec_filings_count }, { label: 'FINRA', status: bgCheck.finra_status, count: null }, { label: 'OFAC', status: bgCheck.ofac_status, count: null }] as src}
												<div class="bg-source {bgStatusClass(src.status)}">
													<span class="bg-source-label">{src.label}</span>
													<span class="bg-source-status">{bgStatusLabel(src.status)}{#if src.count} · {src.count} filing{src.count !== 1 ? 's' : ''}{/if}</span>
												</div>
											{/each}
										</div>
									{:else if bgCheckLoaded}
										<div class="ad-empty"><p>No background check data available.</p></div>
									{:else}
										<div class="ad-empty"><p>Background check loads when this section opens.</p></div>
									{/if}
								{:else}
									<div class="bg-gate-text">SEC EDGAR, FINRA, and OFAC screening available for members.</div>
								{/if}
							{/if}

						{:else if layer.id === 'structure'}
							<!-- STRUCTURE LAYER -->
							<div class="structure-grid">
								{#if deal?.offeringType}<div class="struct-row"><span class="struct-label">Offering Type</span><span class="struct-value">{deal.offeringType}</span></div>{/if}
								{#if deal?.dealType}<div class="struct-row"><span class="struct-label">Deal Type</span><span class="struct-value">{deal.dealType}</span></div>{/if}
								{#if deal?.distributions}<div class="struct-row"><span class="struct-label">Distributions</span><span class="struct-value">{deal.distributions}</span></div>{/if}
								{#if deal?.holdPeriod}<div class="struct-row"><span class="struct-label">Hold Period</span><span class="struct-value">{deal.holdPeriod} Years</span></div>{/if}
								{#if deal?.availableTo}<div class="struct-row"><span class="struct-label">Available To</span><span class="struct-value">{deal.availableTo}</span></div>{/if}
								{#if deal?.offeringSize}<div class="struct-row"><span class="struct-label">Offering Size</span><span class="struct-value">{fmt(deal.offeringSize, 'money')}</span></div>{/if}
							</div>
							{#if feeRows.length > 0}
								<div class="subsection-title" style="margin-top:16px;">Fee Schedule</div>
								<div class="fee-grid">
									{#each feeRows as row}
										<div class="fee-row">
											<span class="fee-label">{row.label}</span>
											<span class="fee-value">{row.value}</span>
										</div>
									{/each}
								</div>
							{/if}

						{:else if layer.id === 'returns'}
							<!-- RETURNS LAYER -->
							<div class="structure-grid">
								{#if deal?.preferredReturn}
									<div class="struct-row"><span class="struct-label">Preferred Return</span><span class="struct-value">{fmt(deal.preferredReturn, 'pct')}</span></div>
								{/if}
								{#if deal?.cashOnCash}
									<div class="struct-row"><span class="struct-label">Cash-on-Cash</span><span class="struct-value">{fmt(deal.cashOnCash, 'pct')}</span></div>
								{/if}
								{#if deal?.targetIRR}
									<div class="struct-row"><span class="struct-label">Target IRR</span><span class="struct-value">{fmt(deal.targetIRR, 'pct')}</span></div>
								{/if}
								{#if deal?.equityMultiple}
									<div class="struct-row"><span class="struct-label">Equity Multiple</span><span class="struct-value">{deal.equityMultiple.toFixed(2)}x</span></div>
								{/if}
								{#if deal?.distributions && deal.distributions !== 'Unknown'}
									<div class="struct-row"><span class="struct-label">Distribution Frequency</span><span class="struct-value">{deal.distributions}</span></div>
								{/if}
								{#if deal?.holdPeriod}
									<div class="struct-row"><span class="struct-label">Hold Period</span><span class="struct-value">{deal.holdPeriod} Years</span></div>
								{/if}
							</div>

						{:else if layer.id === 'riskcomp'}
							<!-- RISK & COMPENSATION LAYER (stacked, not tabbed) -->

							<!-- Risks -->
							<div class="rc-section">
								<div class="rc-section-title">RISKS YOU'RE TAKING</div>
								{#if rcg.risks.length > 0}
									<div class="rc-items">
										{#each rcg.risks as risk}
											<div class="rc-risk-card">
												<div class="rc-risk-label">{risk.label}</div>
												<div class="rc-risk-detail">{risk.detail}</div>
											</div>
										{/each}
									</div>
								{:else}
									<div class="rc-empty">No specific risks identified from available data.</div>
								{/if}
							</div>

							<!-- Compensation -->
							<div class="rc-divider"></div>
							<div class="rc-section">
								<div class="rc-section-title">WHAT YOU'RE BEING COMPENSATED WITH</div>
								{#if rcg.compensations.length > 0}
									<div class="rc-comp-list">
										{#each rcg.compensations as comp}
											<div class="rc-comp-row">
												<span class="rc-comp-value">{comp.label}{#if comp.value} {comp.value}{/if}</span>
												<span class="rc-comp-detail">{comp.detail}</span>
											</div>
										{/each}
									</div>
								{:else}
									<div class="rc-empty">No compensation metrics available.</div>
								{/if}
							</div>

							<!-- Gaps -->
							<div class="rc-divider"></div>
							<div class="rc-section">
								<div class="rc-section-title">WHAT'S NOT COVERED</div>
								{#if rcg.gaps.length > 0}
									<div class="rc-gap-list">
										{#each rcg.gaps as gap}
											<div class="rc-gap-row">
												<span class="rc-gap-dot"></span>
												<span class="rc-gap-label">{gap.label} not provided</span>
											</div>
										{/each}
									</div>
								{:else}
									<div class="rc-empty">All critical data fields are present.</div>
								{/if}
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
	</div>

	<!-- Data Completeness -->
	<div class="ad-completeness">
		<div class="ad-completeness-bar">
			<div class="ad-completeness-fill" style="width:{completeness.pct}%"></div>
		</div>
		<span class="ad-completeness-text">{completeness.pct}% complete · {completeness.filled} of {completeness.total} fields</span>
	</div>
</div>

<style>
	.analysis-dashboard {
		margin-bottom: 18px;
	}
	.ad-title-row {
		display: flex;
		align-items: baseline;
		gap: 10px;
		margin-bottom: 14px;
	}
	.ad-title {
		font-family: var(--font-headline);
		font-size: 22px;
		color: var(--text-dark);
		margin: 0;
	}

	.ad-layers {
		display: flex;
		flex-direction: column;
		border: 1px solid var(--border);
		border-radius: var(--radius, 12px);
		overflow: hidden;
		background: var(--bg-card);
	}

	.ad-layer {
		border-bottom: 1px solid var(--border-light);
	}
	.ad-layer:last-child {
		border-bottom: none;
	}

	.ad-layer-header {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
		padding: 14px 18px;
		background: transparent;
		border: none;
		cursor: pointer;
		text-align: left;
		transition: background 0.15s;
	}
	.ad-layer-header:hover {
		background: var(--bg-cream);
	}
	.ad-layer.open .ad-layer-header {
		background: var(--bg-cream);
		border-bottom: 1px solid var(--border-light);
	}

	.ad-layer-icon {
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.ad-layer.open .ad-layer-icon {
		color: var(--primary);
	}

	.ad-layer-content {
		flex: 1;
		min-width: 0;
	}
	.ad-layer-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 1px;
	}
	.ad-layer-summary {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.ad-lock-icon {
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.ad-chevron {
		color: var(--text-muted);
		flex-shrink: 0;
		transition: transform 0.2s;
	}
	.ad-chevron-open {
		transform: rotate(180deg);
	}

	.ad-layer-body {
		padding: 18px 20px;
		animation: layerOpen 0.2s ease;
	}
	@keyframes layerOpen {
		from { opacity: 0; transform: translateY(-6px); }
		to { opacity: 1; transform: translateY(0); }
	}

	.ad-gate {
		text-align: center;
		padding: 16px 8px;
	}
	.ad-gate p {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}
	.ad-gate-btn {
		display: inline-block;
		padding: 10px 24px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm, 6px);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		text-decoration: none;
	}
	.ad-gate-btn:hover { background: var(--primary-hover); }

	.ad-empty {
		text-align: center;
		padding: 12px 8px;
	}
	.ad-empty p {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: 0;
	}

	.ad-action-link {
		display: inline-block;
		margin-top: 4px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
		background: none;
		border: none;
		cursor: pointer;
		text-decoration: none;
	}
	.ad-action-link:hover { text-decoration: underline; }

	/* Structure / Legitimacy / Returns grid */
	.structure-grid {
		display: flex;
		flex-direction: column;
	}
	.struct-row {
		display: flex;
		justify-content: space-between;
		padding: 8px 0;
		border-bottom: 1px solid var(--border-light);
	}
	.struct-row:last-child { border-bottom: none; }
	.struct-label {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
	}
	.struct-value {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
		text-align: right;
	}

	.subsection-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: var(--text-muted);
		margin-bottom: 10px;
	}
	.section-divider {
		height: 1px;
		background: var(--border-light);
		margin: 16px 0;
	}

	/* Fee grid */
	.fee-grid {
		display: flex;
		flex-direction: column;
	}
	.fee-row {
		display: flex;
		justify-content: space-between;
		padding: 8px 0;
		border-bottom: 1px solid var(--border-light);
	}
	.fee-row:last-child { border-bottom: none; }
	.fee-label {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
	}
	.fee-value {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
	}

	/* Sponsor card */
	.sponsor-card {
		display: flex;
		gap: 14px;
		align-items: flex-start;
		padding: 16px;
		background: var(--bg-cream);
		border-radius: var(--radius-sm, 6px);
	}
	.sponsor-avatar {
		width: 48px;
		height: 48px;
		border-radius: 8px;
		background: var(--border-light);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 800;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.sponsor-info {
		flex: 1;
		min-width: 0;
	}
	.sponsor-name {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
	}
	.sponsor-meta {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.5;
	}
	.sponsor-profile-link {
		display: inline-block;
		margin-top: 6px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}
	.sponsor-profile-link:hover { text-decoration: underline; }

	/* Stat cards */
	.stat-cards {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}
	.stat-card {
		flex: 1;
		min-width: 90px;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		text-align: center;
	}
	.stat-value {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
		margin-bottom: 2px;
	}
	.stat-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		color: var(--text-muted);
	}

	.co-invest-row {
		margin-top: 12px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
	}

	/* Background check */
	.bg-sources {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.bg-source {
		padding: 8px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		min-width: 80px;
		text-align: center;
	}
	.bg-source.bg-clear { border-color: rgba(74, 222, 128, 0.4); background: rgba(74, 222, 128, 0.04); }
	.bg-source.bg-flagged { border-color: rgba(248, 113, 113, 0.4); background: rgba(248, 113, 113, 0.04); }
	.bg-source.bg-pending { border-color: var(--border); }
	.bg-source-label {
		display: block;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
	}
	.bg-source-status {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}
	.bg-loading {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		padding: 8px 0;
	}
	.bg-gate-text {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
	}
	.member-badge {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted);
		margin-left: 4px;
	}

	/* Risk & Compensation stacked sections */
	.rc-section {
		margin-bottom: 4px;
	}
	.rc-section-title {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 12px;
	}
	.rc-divider {
		height: 1px;
		background: var(--border-light);
		margin: 16px 0;
	}

	/* Risk cards */
	.rc-items {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.rc-risk-card {
		padding: 12px 14px;
		border: 1px solid var(--border-light);
		border-radius: var(--radius-sm, 6px);
		background: var(--bg-cream);
	}
	.rc-risk-label {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 4px;
	}
	.rc-risk-detail {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	/* Compensation list */
	.rc-comp-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.rc-comp-row {
		display: flex;
		gap: 12px;
		align-items: baseline;
	}
	.rc-comp-value {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		white-space: nowrap;
		min-width: 60px;
	}
	.rc-comp-detail {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
	}

	/* Gaps list */
	.rc-gap-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.rc-gap-row {
		display: flex;
		gap: 10px;
		align-items: center;
	}
	.rc-gap-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: var(--text-muted);
		flex-shrink: 0;
	}
	.rc-gap-label {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
	}
	.rc-empty {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		padding: 4px 0;
	}

	/* Data Completeness bar */
	.ad-completeness {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 12px;
		padding: 0 4px;
	}
	.ad-completeness-bar {
		flex: 1;
		height: 4px;
		background: var(--border-light);
		border-radius: 2px;
		overflow: hidden;
	}
	.ad-completeness-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 2px;
		transition: width 0.5s ease;
	}
	.ad-completeness-text {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		white-space: nowrap;
	}

	@media (max-width: 768px) {
		.ad-layer-header {
			padding: 12px 14px;
			gap: 10px;
		}
		.ad-layer-body {
			padding: 14px 14px;
		}
		.stat-cards {
			flex-direction: column;
		}
		.bg-sources {
			flex-direction: column;
		}
	}
</style>
