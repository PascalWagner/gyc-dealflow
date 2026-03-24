<script>
	/** @type {{ label?: string, current?: number, target?: number, branch?: string }} */
	let { label = 'PASSIVE INCOME GOAL', current = 0, target = 100000, branch = 'cashflow' } = $props();

	const progress = $derived(target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0);

	const valueText = $derived.by(() => {
		if (branch === 'cashflow') return `$${current.toLocaleString()} / $${target.toLocaleString()} per year`;
		if (branch === 'tax') return `$${current.toLocaleString()} / $${target.toLocaleString()} offset`;
		if (branch === 'growth') return `$${current.toLocaleString()} → $${target.toLocaleString()}`;
		return `$${current.toLocaleString()} / $${target.toLocaleString()} per year`;
	});
</script>

<div class="goal-progress">
	<div class="goal-progress-label">{label}</div>
	<div class="goal-progress-bar">
		<div class="goal-progress-fill" style="width:{progress}%;{progress > 0 ? 'min-width:6px;' : ''}"></div>
	</div>
	<div class="goal-progress-value">
		{@html valueText}
		<span class="goal-progress-pct">{progress}%</span>
	</div>
</div>

<style>
	.goal-progress {
		width: 100%;
	}
	.goal-progress-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 8px;
	}
	.goal-progress-bar {
		height: 10px;
		background: var(--bg-main);
		border-radius: 5px;
		overflow: hidden;
		margin-bottom: 8px;
	}
	.goal-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--primary), #3bba78);
		border-radius: 5px;
		transition: width 0.6s ease;
	}
	.goal-progress-value {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		display: flex;
		justify-content: space-between;
		align-items: baseline;
	}
	.goal-progress-pct {
		font-size: 22px;
		font-weight: 800;
		color: var(--primary);
	}
</style>
