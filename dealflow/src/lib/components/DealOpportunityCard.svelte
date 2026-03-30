<script>
	import { buildGoalProjection } from '$lib/utils/dealAnalysis.js';

	let {
		deal = null,
		buyBox = null,
		goal = null,
		goalProgress = null,
		investmentAmount = null,
		isLoggedIn = false,
		isPaid = false,
		onSetGoal = null,
		onOpenAuth = null,
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
		if (val >= 1e3) return '$' + Math.round(val / 1e3).toLocaleString() + 'K' ;
		return '$' + Math.round(val).toLocaleString();
	}
</script>

<div class="opportunity-card">
	<div class="opp-header">
		<div class="opp-label">What this deal could do for you</div>
		{#if goal}
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
		{/if}
	</div>

	{#if !isLoggedIn}
		<div class="opp-auth-prompt">
			<div class="opp-auth-text">Create a free account to see personalized projections based on your investment goal.</div>
			<button class="opp-auth-btn" onclick={() => onOpenAuth?.()}>Create Free Account</button>
		</div>
	{:else if !goal}
		<div class="opp-goal-prompt">
			<div class="opp-goal-prompt-title">Set your investment goal</div>
			<div class="opp-goal-prompt-text">Choose your primary goal to see how this deal fits your plan.</div>
			<div class="opp-goal-chooser">
				{#each allGoals as g}
					<button class="opp-goal-card" onclick={() => onSetGoal?.(g)}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="20" height="20"><path d={goalIcons[g]}/></svg>
						<span>{goalLabels[g]}</span>
					</button>
				{/each}
			</div>
		</div>
	{:else if projection}
		<div class="opp-projection">
			<div class="opp-headline">{projection.headline}</div>
			<div class="opp-detail">{projection.detail}</div>

			{#if projection.type === 'cashflow' && projection.monthly > 0}
				<div class="opp-metric-row">
					<div class="opp-metric">
						<div class="opp-metric-value">{fmtMoney(projection.monthly)}</div>
						<div class="opp-metric-label">Monthly Income</div>
					</div>
					<div class="opp-metric">
						<div class="opp-metric-value">{fmtMoney(projection.annual)}</div>
						<div class="opp-metric-label">Annual Income</div>
					</div>
				</div>
			{:else if projection.type === 'tax' && projection.writeOff > 0}
				<div class="opp-metric-row">
					<div class="opp-metric">
						<div class="opp-metric-value">{fmtMoney(projection.writeOff)}</div>
						<div class="opp-metric-label">Year 1 Write-Off</div>
					</div>
				</div>
			{:else if projection.type === 'growth' && projection.totalReturn > 0}
				<div class="opp-metric-row">
					<div class="opp-metric">
						<div class="opp-metric-value">{fmtMoney(projection.totalReturn)}</div>
						<div class="opp-metric-label">Projected Total Return</div>
					</div>
					<div class="opp-metric">
						<div class="opp-metric-value">{fmtMoney(projection.gain)}</div>
						<div class="opp-metric-label">Projected Gain</div>
					</div>
				</div>
			{/if}
		</div>

		{#if goalProgress}
			<div class="opp-progress">
				<div class="opp-progress-header">
					<span class="opp-progress-label">Plan Progress: {goalLabels[goal]}</span>
					<span class="opp-progress-pct">{goalProgress.pct || 0}%</span>
				</div>
				<div class="opp-progress-bar">
					<div class="opp-progress-fill" style="width:{goalProgress.pct || 0}%"></div>
				</div>
				<div class="opp-progress-detail">
					{goalProgress.current || '$0'} of {goalProgress.target || '---'} goal
				</div>
			</div>
		{/if}
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
	.opp-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 16px;
		flex-wrap: wrap;
	}
	.opp-label {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
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

	.opp-auth-prompt, .opp-goal-prompt {
		text-align: center;
		padding: 16px 8px;
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

	.opp-goal-prompt-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 4px;
	}
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

	.opp-projection {
		margin-bottom: 16px;
	}
	.opp-headline {
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 800;
		color: var(--primary);
		margin-bottom: 4px;
		letter-spacing: -0.3px;
	}
	.opp-detail {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
		margin-bottom: 14px;
	}
	.opp-metric-row {
		display: flex;
		gap: 24px;
	}
	.opp-metric {
		flex: 1;
		padding: 12px 16px;
		background: var(--bg-cream);
		border-radius: var(--radius-sm, 6px);
		text-align: center;
	}
	.opp-metric-value {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
		letter-spacing: -0.3px;
	}
	.opp-metric-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.4px;
		color: var(--text-muted);
		margin-top: 2px;
	}

	.opp-progress {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid var(--border-light);
	}
	.opp-progress-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 6px;
	}
	.opp-progress-label {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}
	.opp-progress-pct {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		color: var(--primary);
	}
	.opp-progress-bar {
		height: 6px;
		background: var(--border-light);
		border-radius: 3px;
		overflow: hidden;
		margin-bottom: 6px;
	}
	.opp-progress-fill {
		height: 100%;
		background: var(--primary);
		border-radius: 3px;
		transition: width 0.5s ease;
	}
	.opp-progress-detail {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
	}

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
		.opp-goal-chooser {
			flex-direction: column;
		}
		.opp-metric-row {
			flex-direction: column;
			gap: 10px;
		}
		.opp-headline {
			font-size: 18px;
		}
	}
</style>
