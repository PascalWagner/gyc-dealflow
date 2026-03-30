<script>
	import DealRiskFramework from './DealRiskFramework.svelte';
	import {
		buildFitSummary,
		buildStructureSummary,
		buildSponsorSummary,
		buildRiskSummary,
		buildDeepDiveSummary,
		buildRiskCompensationGaps
	} from '$lib/utils/dealAnalysis.js';

	let {
		deal = null,
		buyBox = null,
		buyBoxChecks = [],
		buyBoxScore = { matched: 0, total: 0, pct: 0 },
		feeRows = [],
		operatorTrackRecordRows = [],
		secFiling = null,
		keyRiskItems = [],
		ddProgress = { answered: 0, total: 0, pct: 0 },
		isPaid = false,
		isPublicViewer = false,
		isFreeViewer = false,
		hasMemberAccess = false,
		isAdmin = false,
		nativeCompanionMode = false,
		academyHref = '/app/academy',
		onOpenAuth = null,
		onOpenBuyBox = null,
		onOpenDDChecklist = null,
		onOpenQA = null,
		fmt = (v, t) => String(v)
	} = $props();

	let openLayer = $state('fit');

	const rcg = $derived(deal ? buildRiskCompensationGaps(deal) : { risks: [], compensations: [], gaps: [] });

	const layers = $derived([
		{
			id: 'fit',
			icon: 'M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11',
			title: 'Does it fit my plan?',
			summary: buildFitSummary(deal, buyBox),
			free: true
		},
		{
			id: 'structure',
			icon: 'M1 4v16a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V8l-7-4H3a2 2 0 0 0-2 2z',
			title: 'Is it structured fairly?',
			summary: buildStructureSummary(deal),
			free: false
		},
		{
			id: 'sponsor',
			icon: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8',
			title: 'Can I trust the people?',
			summary: buildSponsorSummary(deal),
			free: false
		},
		{
			id: 'risk',
			icon: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
			title: 'What could go wrong?',
			summary: buildRiskSummary(deal, rcg.risks),
			free: false
		},
		{
			id: 'deepdive',
			icon: 'M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z',
			title: 'Have I done enough homework?',
			summary: buildDeepDiveSummary(deal, ddProgress),
			free: false
		}
	]);

	function toggleLayer(id) {
		openLayer = openLayer === id ? null : id;
	}

	function canViewLayer(layer) {
		if (layer.free) return true;
		return hasMemberAccess;
	}

	function bbFmtMoney(v) {
		const n = parseFloat(v);
		if (!n) return '---';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}
</script>

<div class="analysis-dashboard">
	<div class="ad-title-row">
		<h2 class="ad-title">Deal Analysis</h2>
		<span class="ad-subtitle">5 layers of due diligence</span>
	</div>

	<div class="ad-layers">
		{#each layers as layer, i}
			{@const isOpen = openLayer === layer.id}
			{@const canView = canViewLayer(layer)}
			<div class="ad-layer" class:open={isOpen} class:locked={!canView}>
				<button class="ad-layer-header" onclick={() => toggleLayer(layer.id)}>
					<div class="ad-layer-num">{i + 1}</div>
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
									<p>Create a free account to save deals and start your due diligence.</p>
									<button class="ad-gate-btn" onclick={() => onOpenAuth?.()}>Create Free Account</button>
								{:else if nativeCompanionMode}
									<p>This analysis layer is available to members on web.</p>
								{:else}
									<p>Members unlock this analysis layer for every deal.</p>
									<a href={academyHref} class="ad-gate-btn">Become a Member</a>
								{/if}
							</div>

						{:else if layer.id === 'fit'}
							<!-- FIT LAYER (free for all logged-in) -->
							{#if buyBoxChecks.length > 0}
								{@const matchColor = buyBoxScore.pct >= 80 ? '#4ade80' : buyBoxScore.pct >= 50 ? '#fbbf24' : '#f87171'}
								<div class="fit-score-row">
									<span class="fit-score" style="color:{matchColor}">{buyBoxScore.matched}/{buyBoxScore.total}</span>
									<div class="fit-progress">
										<div class="fit-progress-fill" style="width:{buyBoxScore.pct}%;background:{matchColor}"></div>
									</div>
								</div>
								<div class="fit-checks">
									{#each buyBoxChecks as check}
										<div class="fit-check" class:match={check.match} class:miss={!check.match}>
											<div class="fit-check-icon">
												{#if check.match}
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
												{:else}
													<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
												{/if}
											</div>
											<div class="fit-check-body">
												<div class="fit-check-label">{check.label}</div>
												<div class="fit-check-detail">Want: {check.want} · Deal: {check.got}</div>
											</div>
										</div>
									{/each}
								</div>
								<button class="ad-action-link" onclick={() => onOpenBuyBox?.()}>Edit Buy Box &rarr;</button>
							{:else}
								<div class="ad-empty">
									<p>Set up your Buy Box to see how this deal matches your criteria.</p>
									<button class="ad-gate-btn" onclick={() => onOpenBuyBox?.()}>
										{isPublicViewer ? 'Create Free Account' : 'Set Up Buy Box'}
									</button>
								</div>
							{/if}

						{:else if layer.id === 'structure'}
							<!-- STRUCTURE LAYER -->
							<div class="structure-grid">
								<div class="struct-row"><span class="struct-label">Offering Type</span><span class="struct-value">{deal?.offeringType || '---'}</span></div>
								<div class="struct-row"><span class="struct-label">Deal Type</span><span class="struct-value">{deal?.dealType || '---'}</span></div>
								<div class="struct-row"><span class="struct-label">Distributions</span><span class="struct-value">{deal?.distributions || '---'}</span></div>
								<div class="struct-row"><span class="struct-label">Hold Period</span><span class="struct-value">{deal?.holdPeriod ? deal.holdPeriod + ' Years' : '---'}</span></div>
								<div class="struct-row"><span class="struct-label">Available To</span><span class="struct-value">{deal?.availableTo || '---'}</span></div>
								{#if deal?.offeringSize}
									<div class="struct-row"><span class="struct-label">Offering Size</span><span class="struct-value">{fmt(deal.offeringSize, 'money')}</span></div>
								{/if}
							</div>
							{#if feeRows.length > 0}
								<div class="struct-section-title">Fee Schedule</div>
								<div class="fee-grid">
									{#each feeRows as row}
										<div class="fee-row">
											<span class="fee-label">{row.label}</span>
											<span class="fee-value">{row.value}</span>
										</div>
									{/each}
								</div>
							{/if}
							{#if secFiling?.hasFiling}
								<div class="struct-section-title">SEC Filing</div>
								<div class="structure-grid">
									{#if secFiling.offeringType}<div class="struct-row"><span class="struct-label">Filing</span><span class="struct-value">{secFiling.offeringType}</span></div>{/if}
									{#if secFiling.totalRaised}<div class="struct-row"><span class="struct-label">Capital Raised</span><span class="struct-value">{fmt(secFiling.totalRaised, 'money')}</span></div>{/if}
									{#if secFiling.totalInvestors}<div class="struct-row"><span class="struct-label">Investors</span><span class="struct-value">{secFiling.totalInvestors}</span></div>{/if}
								</div>
							{/if}

						{:else if layer.id === 'sponsor'}
							<!-- SPONSOR LAYER -->
							{#if operatorTrackRecordRows.length > 0}
								<div class="structure-grid">
									{#each operatorTrackRecordRows as row}
										<div class="struct-row"><span class="struct-label">{row.label}</span><span class="struct-value">{row.value}</span></div>
									{/each}
								</div>
							{:else}
								<div class="ad-empty"><p>Sponsor track record has not been structured yet.</p></div>
							{/if}
							{#if deal?.managementCompany}
								<a href="/sponsor?company={encodeURIComponent(deal.managementCompany)}" class="ad-action-link">View Full Sponsor Profile &rarr;</a>
							{/if}

						{:else if layer.id === 'risk'}
							<!-- RISK LAYER -->
							<DealRiskFramework
								risks={rcg.risks}
								compensations={rcg.compensations}
								gaps={rcg.gaps}
								{isPaid}
								{nativeCompanionMode}
								{academyHref}
							/>

						{:else if layer.id === 'deepdive'}
							<!-- DEEP DIVE LAYER -->
							<div class="deepdive-actions">
								<button class="deepdive-btn" onclick={() => onOpenDDChecklist?.()}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
									<div>
										<div class="deepdive-btn-title">DD Checklist</div>
										<div class="deepdive-btn-detail">{ddProgress.pct}% complete · {ddProgress.answered}/{ddProgress.total} items</div>
									</div>
								</button>
								<button class="deepdive-btn" onclick={() => onOpenQA?.()}>
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
									<div>
										<div class="deepdive-btn-title">Investor Q&A</div>
										<div class="deepdive-btn-detail">Ask questions and share research</div>
									</div>
								</button>
							</div>
						{/if}
					</div>
				{/if}
			</div>
		{/each}
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
	.ad-subtitle {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 500;
	}

	.ad-layers {
		display: flex;
		flex-direction: column;
		gap: 0;
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

	.ad-layer-num {
		width: 24px;
		height: 24px;
		border-radius: 50%;
		background: var(--border-light);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
		flex-shrink: 0;
	}
	.ad-layer.open .ad-layer-num {
		background: var(--primary);
		color: #fff;
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
		margin-bottom: 12px;
	}

	.ad-action-link {
		display: inline-block;
		margin-top: 12px;
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

	/* Fit Layer */
	.fit-score-row {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-bottom: 14px;
	}
	.fit-score {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
	}
	.fit-progress {
		flex: 1;
		height: 6px;
		background: var(--border-light);
		border-radius: 3px;
		overflow: hidden;
	}
	.fit-progress-fill {
		height: 100%;
		border-radius: 3px;
		transition: width 0.5s;
	}
	.fit-checks {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}
	.fit-check {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 8px 10px;
		border-radius: var(--radius-sm, 6px);
	}
	.fit-check.match { background: rgba(74, 222, 128, 0.06); }
	.fit-check.miss { background: rgba(248, 113, 113, 0.06); }
	.fit-check-icon { flex-shrink: 0; margin-top: 2px; }
	.fit-check-body { flex: 1; min-width: 0; }
	.fit-check-label {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
	}
	.fit-check-detail {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}

	/* Structure Layer */
	.structure-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0;
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
	.struct-section-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: var(--text-muted);
		margin: 16px 0 8px;
	}
	.fee-grid {
		display: flex;
		flex-direction: column;
		gap: 0;
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

	/* Deep Dive Layer */
	.deepdive-actions {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}
	.deepdive-btn {
		display: flex;
		align-items: center;
		gap: 14px;
		padding: 14px 18px;
		background: var(--bg-cream);
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 10px);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.15s, box-shadow 0.15s;
		color: var(--text-secondary);
	}
	.deepdive-btn:hover {
		border-color: var(--primary);
		box-shadow: 0 0 0 1px var(--primary);
	}
	.deepdive-btn-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
	}
	.deepdive-btn-detail {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
	}

	@media (max-width: 768px) {
		.ad-layer-header {
			padding: 12px 14px;
			gap: 10px;
		}
		.ad-layer-body {
			padding: 14px 14px;
		}
		.ad-layer-summary {
			display: none;
		}
		.structure-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
