<script>
	import { buildGoalProjection } from '$lib/utils/dealAnalysis.js';

	let {
		deal = null,
		buyBox = null,
		buyBoxChecks = [],
		buyBoxScore = { matched: 0, total: 0, pct: 0 },
		goal = null,
		goalProgress = null,
		investmentAmount = null,
		isLoggedIn = false,
		isPaid = false,
		onSetGoal = null,
		onOpenAuth = null,
		onOpenBuyBox = null,
		nativeCompanionMode = false
	} = $props();

	const projection = $derived(deal && goal ? buildGoalProjection(deal, goal, investmentAmount) : null);
	const goalLabels = { cashflow: 'Cash Flow', tax: 'Tax Reduction', growth: 'Equity Growth' };
	const goalIcons = {
		cashflow: 'M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6',
		tax: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
		growth: 'M23 6l-9.5 9.5-5-5L1 18M17 6h6v6'
	};
	const allGoals = ['cashflow', 'tax', 'growth'];

	function fmtMoney(val) {
		if (!val || isNaN(val)) return '$0';
		if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
		if (val >= 1e3) return '$' + Math.round(val / 1e3).toLocaleString() + 'K';
		return '$' + Math.round(val).toLocaleString();
	}

	/** Slot label from goal + deal type */
	function getSlotLabel(deal, goal) {
		if (!deal || !goal) return null;
		const dt = (deal.dealType || deal.assetClass || '').toLowerCase();
		if (goal === 'cashflow') {
			if (dt.includes('lend') || dt.includes('debt')) return 'Lending slot';
			if (dt.includes('multi')) return 'Multi-Family slot';
			return 'Income slot';
		}
		if (goal === 'tax') return 'Tax shelter slot';
		if (goal === 'growth') return 'Growth slot';
		return null;
	}

	const slotLabel = $derived(getSlotLabel(deal, goal));
</script>

<div class="opportunity-card">
	{#if !isLoggedIn}
		<div class="opp-auth-prompt">
			<div class="opp-auth-title">Your Plan</div>
			<div class="opp-auth-text">Create a free account to see personalized projections based on your investment goal.</div>
			<button class="opp-auth-btn" onclick={() => onOpenAuth?.()}>Create Free Account</button>
		</div>
	{:else if !goal}
		<div class="opp-goal-prompt">
			<div class="opp-goal-prompt-title">Your Plan</div>
			<div class="opp-goal-prompt-text">Choose your primary investment goal to see how this deal fits your plan.</div>
			<div class="opp-goal-chooser">
				{#each allGoals as g}
					<button class="opp-goal-card" onclick={() => onSetGoal?.(g)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d={goalIcons[g]}/></svg>
						<span>{goalLabels[g]}</span>
					</button>
				{/each}
			</div>
		</div>
	{:else}
		<!-- Header -->
		<div class="opp-header">
			<div class="opp-label">Your Plan</div>
			<div class="opp-header-right">
				<div class="opp-goal-pills">
					{#each allGoals as g}
						<button
							class="opp-goal-pill"
							class:active={goal === g}
							onclick={() => onSetGoal?.(g)}
						>
							{goalLabels[g]}
						</button>
					{/each}
				</div>
				<button class="opp-edit-link" onclick={() => onOpenBuyBox?.()}>Edit &rarr;</button>
			</div>
		</div>

		<!-- Two-column plan layout -->
		{#if projection}
			<div class="opp-plan-grid">
				<!-- LEFT: Goal + Progress -->
				<div class="opp-plan-left">
					{#if goalProgress}
						<div class="opp-goal-display">
							<div class="opp-goal-amount">{goalProgress.target || '---'}</div>
							<div class="opp-goal-type">{goalLabels[goal]?.toLowerCase() || 'passive income'}</div>
						</div>
						<div class="opp-progress-bar">
							<div class="opp-progress-fill" style="width:{goalProgress.pct || 0}%"></div>
						</div>
						<div class="opp-progress-meta">
							<span class="opp-progress-pct">{goalProgress.pct || 0}%</span>
						</div>
						<div class="opp-progress-detail">
							{goalProgress.current || '$0'} of {goalProgress.target || '---'}
						</div>
					{:else}
						<div class="opp-goal-display">
							<div class="opp-goal-amount">{goalLabels[goal]}</div>
							<div class="opp-goal-type">goal selected</div>
						</div>
						<div class="opp-goal-hint">Set a target in your plan to track progress.</div>
					{/if}
				</div>

				<!-- RIGHT: Projection -->
				<div class="opp-plan-right">
					<div class="opp-invest-label">If you invest {fmtMoney(investmentAmount || deal?.investmentMinimum || 50000)}:</div>

					{#if projection.type === 'cashflow' && projection.annual > 0}
						<div class="opp-invest-stat">+{fmtMoney(projection.annual)}/yr income</div>
					{:else if projection.type === 'tax' && projection.writeOff > 0}
						<div class="opp-invest-stat">~{fmtMoney(projection.writeOff)} yr-1 write-off</div>
					{:else if projection.type === 'growth' && projection.totalReturn > 0}
						<div class="opp-invest-stat">{fmtMoney(projection.gain)} projected gain</div>
					{:else}
						<div class="opp-invest-stat">Projection data limited</div>
					{/if}

					{#if goalProgress && goalProgress.pctAfter != null}
						<div class="opp-invest-progress">Gets you to {goalProgress.pctAfter}% of your goal</div>
					{/if}

					{#if slotLabel}
						<div class="opp-invest-slot">Fills: {slotLabel}</div>
					{/if}
				</div>
			</div>

			<div class="opp-basis">
				{projection.detail}
			</div>
		{/if}

		<!-- Divider -->
		<div class="opp-divider"></div>

		<!-- Buy Box Match -->
		<div class="opp-buybox">
			<div class="opp-buybox-header">
				<span class="opp-buybox-label">Buy Box Match</span>
				{#if buyBoxChecks.length > 0}
					<span class="opp-buybox-score">{buyBoxScore.matched} of {buyBoxScore.total}</span>
				{/if}
			</div>

			{#if buyBoxChecks.length > 0}
				<div class="opp-buybox-checks">
					{#each buyBoxChecks as check}
						<div class="opp-check" class:match={check.match} class:miss={!check.match}>
							<div class="opp-check-icon">
								{#if check.match}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
								{:else}
									<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
								{/if}
							</div>
							<div class="opp-check-label">{check.label}</div>
						</div>
					{/each}
				</div>
			{:else}
				<div class="opp-buybox-empty">
					<button class="opp-buybox-setup" onclick={() => onOpenBuyBox?.()}>Set Up Buy Box</button>
				</div>
			{/if}
		</div>
	{/if}

	<div class="opp-disclaimer">
		Projections are illustrative only. Past performance does not guarantee future results.
	</div>
</div>

<style>
	.opportunity-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius, 12px);
		padding: 20px 24px;
		margin-bottom: 18px;
	}

	/* Header */
	.opp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 18px;
		flex-wrap: wrap;
	}
	.opp-label {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.opp-header-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.opp-edit-link {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
		background: none;
		border: none;
		cursor: pointer;
		white-space: nowrap;
	}
	.opp-edit-link:hover { text-decoration: underline; }

	.opp-goal-pills {
		display: flex;
		gap: 4px;
		padding: 3px;
		background: var(--border-light);
		border-radius: var(--radius-sm, 6px);
	}
	.opp-goal-pill {
		padding: 5px 12px;
		border: none;
		background: transparent;
		border-radius: calc(var(--radius-sm, 6px) - 2px);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		transition: all 0.15s;
		white-space: nowrap;
	}
	.opp-goal-pill.active {
		background: var(--bg-card);
		color: var(--primary);
		box-shadow: var(--shadow-sm);
	}
	.opp-goal-pill:hover:not(.active) {
		color: var(--text-secondary);
	}

	/* Two-column plan grid */
	.opp-plan-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
		margin-bottom: 12px;
	}
	.opp-plan-left {
		padding: 16px;
		background: var(--bg-cream);
		border-radius: var(--radius-sm, 6px);
	}
	.opp-plan-right {
		padding: 16px;
		background: var(--bg-cream);
		border-radius: var(--radius-sm, 6px);
	}

	.opp-goal-display {
		margin-bottom: 12px;
	}
	.opp-goal-amount {
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 800;
		color: var(--text-dark);
		letter-spacing: -0.3px;
	}
	.opp-goal-type {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: lowercase;
	}

	.opp-progress-bar {
		height: 8px;
		background: var(--border-light);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 6px;
	}
	.opp-progress-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 4px;
		transition: width 0.5s ease;
	}
	.opp-progress-meta {
		margin-bottom: 2px;
	}
	.opp-progress-pct {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.opp-progress-detail {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
	}
	.opp-goal-hint {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.5;
	}

	/* Right column - projection */
	.opp-invest-label {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 10px;
	}
	.opp-invest-stat {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--primary);
		margin-bottom: 8px;
		letter-spacing: -0.3px;
	}
	.opp-invest-progress {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
		margin-bottom: 6px;
	}
	.opp-invest-slot {
		display: inline-block;
		padding: 4px 10px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.opp-basis {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.5;
		margin-bottom: 4px;
	}

	/* Divider */
	.opp-divider {
		height: 1px;
		background: var(--border-light);
		margin: 16px 0;
	}

	/* Buy Box Match */
	.opp-buybox-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 12px;
	}
	.opp-buybox-label {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.opp-buybox-score {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.opp-buybox-checks {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}
	.opp-check {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm, 6px);
		background: var(--bg-card);
		min-width: 70px;
		flex: 1;
	}
	.opp-check.match {
		border-color: rgba(74, 222, 128, 0.4);
		background: rgba(74, 222, 128, 0.04);
	}
	.opp-check.match .opp-check-icon { color: #4ade80; }
	.opp-check.miss {
		border-color: rgba(248, 113, 113, 0.4);
		background: rgba(248, 113, 113, 0.04);
	}
	.opp-check.miss .opp-check-icon { color: #f87171; }
	.opp-check-icon {
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.opp-check-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		color: var(--text-muted);
		text-align: center;
		white-space: nowrap;
	}

	.opp-buybox-empty {
		text-align: center;
		padding: 8px 0;
	}
	.opp-buybox-setup {
		display: inline-block;
		padding: 8px 20px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm, 6px);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.opp-buybox-setup:hover { background: var(--primary-hover); }

	/* Auth / Goal Prompt */
	.opp-auth-prompt, .opp-goal-prompt {
		text-align: center;
		padding: 16px 8px;
	}
	.opp-auth-title, .opp-goal-prompt-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 6px;
	}
	.opp-auth-text, .opp-goal-prompt-text {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		margin-bottom: 12px;
	}
	.opp-auth-btn {
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
	}
	.opp-auth-btn:hover { background: var(--primary-hover); }

	.opp-goal-chooser {
		display: flex;
		gap: 10px;
		justify-content: center;
	}
	.opp-goal-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 6px;
		padding: 16px 20px;
		border: 1px solid var(--border);
		border-radius: var(--radius-md, 10px);
		background: var(--bg-card);
		cursor: pointer;
		transition: all 0.15s;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}
	.opp-goal-card:hover {
		border-color: var(--primary);
		color: var(--primary);
		background: var(--primary-light);
	}

	/* Disclaimer */
	.opp-disclaimer {
		margin-top: 14px;
		padding-top: 10px;
		border-top: 1px solid var(--border-light);
		font-family: var(--font-body);
		font-size: 10px;
		color: var(--text-muted);
		text-align: center;
	}

	@media (max-width: 600px) {
		.opportunity-card {
			padding: 16px;
		}
		.opp-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
		}
		.opp-header-right {
			flex-direction: column;
			align-items: flex-start;
			gap: 8px;
			width: 100%;
		}
		.opp-plan-grid {
			grid-template-columns: 1fr;
			gap: 12px;
		}
		.opp-goal-chooser {
			flex-direction: column;
		}
		.opp-buybox-checks {
			flex-wrap: wrap;
		}
		.opp-check {
			min-width: 60px;
			padding: 8px 10px;
		}
		.opp-goal-amount {
			font-size: 18px;
		}
		.opp-invest-stat {
			font-size: 16px;
		}
	}
</style>
