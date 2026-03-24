<script>
	/** @type {{ allocations?: Record<string, number>, planAllocations?: Record<string, number> | null }} */
	let { allocations = {}, planAllocations = null } = $props();

	const PIE_COLORS = ['#51BE7B', '#2563EB', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

	const entries = $derived(
		Object.entries(allocations).sort((a, b) => b[1] - a[1])
	);
	const total = $derived(entries.reduce((s, [, v]) => s + v, 0));
	const hasPlan = $derived(planAllocations && Object.keys(planAllocations).length > 0);
	const planTotal = $derived(hasPlan ? Object.values(planAllocations).reduce((s, v) => s + v, 0) : 0);

	// Build SVG paths
	const slices = $derived(() => {
		if (entries.length === 0 || total === 0) return [];
		let cumAngle = 0;
		return entries.map(([ac, amount], i) => {
			const pct = amount / total;
			const angle = pct * 360;
			const color = PIE_COLORS[i % PIE_COLORS.length];
			const startAngle = cumAngle * Math.PI / 180;
			const endAngle = (cumAngle + angle) * Math.PI / 180;
			const largeArc = angle > 180 ? 1 : 0;
			const x1 = 80 + 60 * Math.cos(startAngle);
			const y1 = 80 + 60 * Math.sin(startAngle);
			const x2 = 80 + 60 * Math.cos(endAngle);
			const y2 = 80 + 60 * Math.sin(endAngle);
			cumAngle += angle;
			const isOnly = entries.length === 1;
			return { ac, amount, pct, color, x1, y1, x2, y2, largeArc, isOnly };
		});
	});

	// Legend entries including plan-only asset classes
	const legendItems = $derived(() => {
		const items = entries.map(([ac, amount], i) => {
			const actualPct = Math.round((amount / total) * 100);
			const planPct = hasPlan && planAllocations[ac]
				? Math.round(planAllocations[ac] / planTotal * 100)
				: null;
			const drift = planPct !== null ? actualPct - planPct : null;
			return {
				ac, color: PIE_COLORS[i % PIE_COLORS.length],
				actualPct, planPct, drift, inPortfolio: true
			};
		});
		// Plan-only asset classes not yet in portfolio
		if (hasPlan) {
			for (const [ac, count] of Object.entries(planAllocations)) {
				if (allocations[ac]) continue;
				items.push({
					ac, color: null,
					actualPct: 0,
					planPct: Math.round(count / planTotal * 100),
					drift: null, inPortfolio: false
				});
			}
		}
		return items;
	});
</script>

<div class="chart-wrapper">
	<div class="chart-label">Allocation{hasPlan ? ' vs Plan' : ''}</div>
	{#if total > 0}
		<svg viewBox="0 0 160 160" class="pie-svg">
			{#each slices() as s}
				{#if s.isOnly}
					<circle cx="80" cy="80" r="60" fill={s.color} />
				{:else}
					<path d="M80,80 L{s.x1},{s.y1} A60,60 0 {s.largeArc},1 {s.x2},{s.y2} Z" fill={s.color} />
				{/if}
			{/each}
			<circle cx="80" cy="80" r="35" fill="var(--bg-card)" />
		</svg>
		<div class="legend">
			{#each legendItems() as item}
				<div class="legend-item">
					{#if item.inPortfolio}
						<div class="legend-dot" style="background:{item.color};"></div>
					{:else}
						<div class="legend-dot legend-dot-empty"></div>
					{/if}
					<div class="legend-text">
						<span class="legend-pct">{item.actualPct}%</span>
						{item.ac}
						{#if item.planPct !== null}
							<span class="legend-plan">(plan: {item.planPct}%)</span>
						{/if}
						{#if item.drift !== null && Math.abs(item.drift) >= 10}
							<span class="legend-drift" class:over={item.drift > 0} class:under={item.drift < 0}>
								{item.drift > 0 ? '↑' : '↓'}{Math.abs(item.drift)}%
							</span>
						{/if}
					</div>
				</div>
			{/each}
		</div>
	{:else}
		<div class="empty">No data</div>
	{/if}
</div>

<style>
	.chart-wrapper { flex-shrink: 0; width: 240px; }
	.chart-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 12px;
	}
	.pie-svg {
		display: block;
		width: 140px;
		height: 140px;
		margin: 0 auto 12px;
	}
	.legend { display: flex; flex-direction: column; gap: 6px; }
	.legend-item { display: flex; align-items: center; gap: 8px; }
	.legend-dot {
		width: 10px;
		height: 10px;
		border-radius: 3px;
		flex-shrink: 0;
	}
	.legend-dot-empty {
		border: 2px dashed var(--border);
		box-sizing: border-box;
		background: transparent;
	}
	.legend-text { font-size: 12px; color: var(--text-secondary); }
	.legend-pct { font-weight: 700; color: var(--text-dark); }
	.legend-plan { font-size: 10px; color: var(--text-muted); }
	.legend-drift { font-size: 10px; }
	.legend-drift.over { color: #f59e0b; }
	.legend-drift.under { color: #3b82f6; }
	.empty {
		text-align: center;
		font-size: 13px;
		color: var(--text-muted);
		padding: 20px;
	}
	@media (max-width: 768px) {
		.chart-wrapper { width: 100%; }
		.pie-svg { margin-bottom: 16px; }
	}
</style>
