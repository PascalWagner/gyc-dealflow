<script>
	import { onMount } from 'svelte';

	let {
		points = [],
		targetValue = 0,
		metricLabel = 'Annual outcome',
		actualRangeLabel = '',
		modeledRangeLabel = '',
		formatMetricValue = (value) => `$${Math.round(Number(value || 0)).toLocaleString()}`,
		formatCapitalValue = (value) => `$${Math.round(Number(value || 0)).toLocaleString()}`,
		finalMixSegments = [],
		finalMixTotal = 0,
		concentrationAlert = null
	} = $props();

	let canvasEl = $state(null);
	let ChartConstructor = null;
	let chartInstance = null;

	const chartColors = {
		line: '#4fbe7b',
		lineFill: 'rgba(79, 190, 123, 0.14)',
		target: 'rgba(107, 124, 142, 0.55)',
		actualBar: 'rgba(148, 163, 184, 0.20)',
		actualBarBorder: 'rgba(148, 163, 184, 0.36)',
		modeledBar: 'rgba(79, 190, 123, 0.20)',
		modeledBarBorder: 'rgba(79, 190, 123, 0.34)',
		historicalBand: 'rgba(15, 23, 42, 0.03)',
		forwardBand: 'rgba(79, 190, 123, 0.05)',
		divider: 'rgba(148, 163, 184, 0.18)'
	};

	const historicalCount = $derived.by(() => points.filter((point) => point.period === 'actual').length);
	const metricLabelShort = $derived.by(() => {
		const normalized = String(metricLabel || '').trim();
		if (!normalized) return 'Outcome';
		if (normalized.length <= 26) return normalized;
		return normalized.replace(/ run-rate$/i, '').replace(/^Annual\s+/i, '');
	});
	const mixSegments = $derived.by(() => {
		if (!finalMixTotal) return [];
		return finalMixSegments
			.map((segment) => ({
				...segment,
				sharePct: Math.round((Number(segment.amount || 0) / finalMixTotal) * 100)
			}))
			.filter((segment) => segment.sharePct > 0);
	});

	const roadmapBandPlugin = {
		id: 'roadmapBandPlugin',
		beforeDatasetsDraw(chart, _args, pluginOptions) {
			const { ctx, chartArea, scales } = chart;
			if (!chartArea || !scales?.x) return;

			const count = chart.data.labels?.length || 0;
			const actualYears = Number(pluginOptions?.historicalCount || 0);
			if (!count || !actualYears || actualYears >= count) return;

			const xScale = scales.x;
			const left = chartArea.left;
			const right = chartArea.right;
			const top = chartArea.top;
			const bottom = chartArea.bottom;
			const leftMid = xScale.getPixelForValue(actualYears - 1);
			const rightMid = xScale.getPixelForValue(actualYears);
			const dividerX = (leftMid + rightMid) / 2;

			ctx.save();
			ctx.fillStyle = chartColors.historicalBand;
			ctx.fillRect(left, top, dividerX - left, bottom - top);
			ctx.fillStyle = chartColors.forwardBand;
			ctx.fillRect(dividerX, top, right - dividerX, bottom - top);
			ctx.strokeStyle = chartColors.divider;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo(dividerX, top + 6);
			ctx.lineTo(dividerX, bottom);
			ctx.stroke();
			ctx.restore();
		}
	};

	function destroyChart() {
		if (chartInstance?.destroy) chartInstance.destroy();
		chartInstance = null;
	}

	async function ensureChart() {
		if (ChartConstructor) return;
		const mod = await import('chart.js/auto');
		ChartConstructor = mod.default || mod.Chart;
	}

	function renderChart() {
		destroyChart();
		if (!canvasEl || !ChartConstructor || !points.length) return;

		const labels = points.map((point) => String(point.year));
		const actualYears = points.filter((point) => point.period === 'actual').length;
		const capitalValues = points.map((point) => Number(point.capitalTotal || 0));
		const metricValues = points.map((point) => Number(point.metricValue || 0));
		const maxCapital = Math.max(...capitalValues, 1);
		const maxMetric = Math.max(targetValue, ...metricValues, 1);
		const keyIndexes = new Set([0, Math.max(actualYears - 1, 0), labels.length - 1]);

		chartInstance = new ChartConstructor(canvasEl, {
			type: 'bar',
			plugins: [roadmapBandPlugin],
			data: {
				labels,
				datasets: [
					{
						type: 'bar',
						label: 'Deployed Capital',
						data: capitalValues,
						yAxisID: 'yCapital',
						backgroundColor: points.map((point) =>
							point.period === 'actual' ? chartColors.actualBar : chartColors.modeledBar
						),
						borderColor: points.map((point) =>
							point.period === 'actual' ? chartColors.actualBarBorder : chartColors.modeledBarBorder
						),
						borderWidth: 1,
						borderRadius: 14,
						borderSkipped: false,
						barPercentage: 0.58,
						categoryPercentage: 0.7,
						order: 2
					},
					{
						type: 'line',
						label: metricLabel,
						data: metricValues,
						yAxisID: 'yMetric',
						borderColor: chartColors.line,
						backgroundColor: chartColors.lineFill,
						borderWidth: 3,
						tension: 0.34,
						fill: false,
						pointRadius: points.map((_point, index) => (keyIndexes.has(index) ? 3.6 : 2.3)),
						pointHoverRadius: 4.4,
						pointBackgroundColor: '#ffffff',
						pointBorderColor: chartColors.line,
						pointBorderWidth: 2,
						order: 1
					},
					{
						type: 'line',
						label: 'Target',
						data: points.map(() => targetValue),
						yAxisID: 'yMetric',
						borderColor: chartColors.target,
						borderWidth: 1.5,
						borderDash: [7, 7],
						pointRadius: 0,
						pointHoverRadius: 0,
						fill: false,
						order: 0
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				animation: false,
				interaction: {
					mode: 'index',
					intersect: false
				},
				layout: {
					padding: { top: 12, right: 10, bottom: 2, left: 6 }
				},
				plugins: {
					legend: { display: false },
					tooltip: {
						backgroundColor: 'rgba(15, 23, 42, 0.94)',
						displayColors: false,
						padding: 12,
						titleFont: { size: 12, weight: '700' },
						bodyFont: { size: 12, weight: '600' },
						callbacks: {
							title: (items) => {
								const point = points[items[0]?.dataIndex ?? 0];
								return `${point?.year || ''} ${point?.period === 'actual' ? 'Actual' : 'Modeled'}`.trim();
							},
							label: (context) => {
								const point = points[context.dataIndex];
								if (context.datasetIndex === 0) {
									return `Deployed capital: ${formatCapitalValue(point?.capitalTotal || 0)}`;
								}
								if (context.datasetIndex === 1) {
									return `${metricLabelShort}: ${formatMetricValue(point?.metricValue || 0)}`;
								}
								return `Target: ${formatMetricValue(targetValue)}`;
							}
						}
					},
					roadmapBandPlugin: {
						historicalCount: actualYears
					}
				},
				scales: {
					x: {
						grid: { display: false, drawBorder: false },
						border: { display: false },
						ticks: {
							color: 'rgba(15, 23, 42, 0.82)',
							font: { size: 11, weight: '700' }
						}
					},
					yCapital: {
						display: false,
						beginAtZero: true,
						max: maxCapital * 1.14,
						grid: { display: false, drawBorder: false },
						border: { display: false }
					},
					yMetric: {
						display: false,
						beginAtZero: true,
						max: maxMetric * 1.08,
						grid: {
							color: 'rgba(148, 163, 184, 0.14)',
							drawTicks: false,
							drawBorder: false
						},
						border: { display: false }
					}
				}
			}
		});
	}

	onMount(() => {
		let cancelled = false;
		void (async () => {
			await ensureChart();
			if (!cancelled) renderChart();
		})();
		return () => {
			cancelled = true;
			destroyChart();
		};
	});

	$effect(() => {
		const _points = points;
		const _target = targetValue;
		const _label = metricLabel;
		const _mix = finalMixSegments;
		if (ChartConstructor && canvasEl) renderChart();
	});
</script>

<div class="roadmap-chart-shell">
	<div class="roadmap-chart-periods">
		<div class="roadmap-chart-period roadmap-chart-period--actual">Historical · {actualRangeLabel}</div>
		<div class="roadmap-chart-period roadmap-chart-period--modeled">Forward · {modeledRangeLabel}</div>
	</div>

	<div class="roadmap-chart-wrap">
		<canvas bind:this={canvasEl} aria-label={`${metricLabel} chart`} role="img"></canvas>
	</div>

	<div class="roadmap-chart-key">
		<div class="roadmap-chart-key-item">
			<span class="legend-line legend-line--metric"></span>
			<span>{metricLabelShort}</span>
		</div>
		<div class="roadmap-chart-key-item">
			<span class="legend-line legend-line--capital"></span>
			<span>Deployed Capital</span>
		</div>
		<div class="roadmap-chart-key-item">
			<span class="legend-line legend-line--target"></span>
			<span>Target</span>
		</div>
	</div>

	{#if mixSegments.length}
		<div class="mix-card">
			<div class="mix-card-top">
				<div>
					<div class="mix-card-title">Projected Capital Mix</div>
					<div class="mix-card-copy">Where deployed capital lands by the end of the forward roadmap.</div>
				</div>
				<div class="mix-card-total">{formatCapitalValue(finalMixTotal)}</div>
			</div>
			<div class="mix-bar" aria-hidden="true">
				{#each mixSegments as segment}
					<span class="mix-bar-segment" style={`width:${Math.max(segment.sharePct, 4)}%; background:${segment.color}`}></span>
				{/each}
			</div>
			<div class="mix-pill-row">
				{#each mixSegments as segment}
					<div class="mix-pill">
						<span class="mix-pill-swatch" style={`background:${segment.color}`}></span>
						<span>{segment.label}</span>
						<strong>{segment.sharePct}%</strong>
					</div>
				{/each}
			</div>
		</div>
	{/if}

	{#if concentrationAlert}
		<div class="growth-alert">{concentrationAlert}</div>
	{/if}
</div>

<style>
	.roadmap-chart-shell {
		margin-top: 18px;
	}
	.roadmap-chart-periods {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 10px;
		margin-bottom: 14px;
	}
	.roadmap-chart-period {
		padding: 10px 12px;
		border-radius: 14px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.roadmap-chart-period--actual {
		background: rgba(15, 23, 42, 0.045);
		color: rgba(100, 116, 139, 0.92);
	}
	.roadmap-chart-period--modeled {
		background: rgba(79, 190, 123, 0.08);
		color: #2f8d58;
	}
	.roadmap-chart-wrap {
		position: relative;
		height: 320px;
		padding: 8px 0 0;
	}
	.roadmap-chart-key {
		display: flex;
		flex-wrap: wrap;
		gap: 12px 18px;
		align-items: center;
		margin-top: 12px;
		padding-top: 14px;
		border-top: 1px solid rgba(148, 163, 184, 0.14);
	}
	.roadmap-chart-key-item {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
	}
	.legend-line {
		display: inline-block;
		width: 18px;
		height: 0;
		border-top: 2px solid var(--primary);
	}
	.legend-line--metric {
		border-top-color: #4fbe7b;
	}
	.legend-line--capital {
		border-top-color: rgba(79, 190, 123, 0.5);
	}
	.legend-line--target {
		border-top-style: dashed;
		border-top-color: rgba(107, 124, 142, 0.72);
	}
	.mix-card {
		margin-top: 18px;
		padding: 18px;
		border-radius: 18px;
		background: linear-gradient(180deg, rgba(248, 250, 252, 0.9), rgba(255, 255, 255, 0.96));
		border: 1px solid rgba(148, 163, 184, 0.16);
	}
	.mix-card-top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}
	.mix-card-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}
	.mix-card-copy {
		margin-top: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-secondary);
	}
	.mix-card-total {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		white-space: nowrap;
	}
	.mix-bar {
		display: flex;
		width: 100%;
		height: 14px;
		margin-top: 16px;
		border-radius: 999px;
		overflow: hidden;
		background: rgba(226, 232, 240, 0.72);
	}
	.mix-bar-segment {
		display: block;
		height: 100%;
	}
	.mix-pill-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 14px;
	}
	.mix-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.92);
		border: 1px solid rgba(148, 163, 184, 0.18);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}
	.mix-pill strong {
		color: var(--text-dark);
	}
	.mix-pill-swatch {
		width: 8px;
		height: 8px;
		border-radius: 999px;
		flex-shrink: 0;
	}
	.growth-alert {
		margin-top: 16px;
		padding: 12px 14px;
		border: 1px solid rgba(245, 158, 11, 0.16);
		border-radius: 14px;
		background: rgba(245, 158, 11, 0.05);
		backdrop-filter: blur(8px);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: rgba(180, 83, 9, 0.88);
	}

	@media (max-width: 900px) {
		.roadmap-chart-wrap {
			height: 280px;
		}
	}

	@media (max-width: 640px) {
		.roadmap-chart-periods {
			grid-template-columns: 1fr;
		}
		.mix-card-top {
			flex-direction: column;
		}
		.mix-card-total {
			white-space: normal;
		}
	}
</style>
