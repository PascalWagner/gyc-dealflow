<script>
	import { MAX_HISTORICAL_RETURN_YEARS } from '$lib/utils/dealReturns.js';

	let { series = [] } = $props();

	const chartWidth = 184;
	const chartHeight = 108;
	const plotLeft = 10;
	const plotRight = 174;
	const plotTop = 18;
	const plotBottom = 72;
	const plotHeight = plotBottom - plotTop;

	const normalizedSeries = $derived.by(() =>
		(Array.isArray(series) ? series : [])
			.filter((point) => Number.isFinite(point?.year) && Number.isFinite(point?.value))
			.slice(-MAX_HISTORICAL_RETURN_YEARS)
	);

	const values = $derived.by(() => normalizedSeries.map((point) => point.value));

	const domain = $derived.by(() => {
		if (!values.length) return { min: 0, max: 1, span: 1 };

		const minValue = Math.min(...values);
		const maxValue = Math.max(...values);
		const spread = maxValue - minValue;
		const padding = Math.max(0.9, spread * 0.32 || 1.2);
		const min = Math.max(0, minValue - padding);
		const max = maxValue + padding;

		return {
			min,
			max,
			span: Math.max(max - min, 1)
		};
	});

	const gridLines = $derived.by(() => [
		plotTop + (plotHeight / 3),
		plotTop + ((plotHeight / 3) * 2)
	]);

	const bars = $derived.by(() => {
		if (!normalizedSeries.length) return [];

		const plotWidth = plotRight - plotLeft;
		const slotWidth = plotWidth / normalizedSeries.length;
		const barWidth = Math.max(14, Math.min(24, slotWidth * 0.58));

		return normalizedSeries.map((point, index) => {
			const centerX = plotLeft + (slotWidth * index) + (slotWidth / 2);
			const height = Math.max(
				9,
				((point.value - domain.min) / domain.span) * plotHeight
			);
			const y = plotBottom - height;
			const label = `${point.value.toFixed(1)}%`;
			const pillWidth = Math.max(28, (label.length * 5.4) + 10);
			const pillY = Math.max(4, y - 18);

			return {
				...point,
				centerX,
				x: centerX - (barWidth / 2),
				y,
				width: barWidth,
				height,
				label,
				pillWidth,
				pillX: centerX - (pillWidth / 2),
				pillY,
				shortYear: String(point.year).slice(-2),
				isLatest: index === normalizedSeries.length - 1
			};
		});
	});
</script>

<div class="mini-chart" aria-hidden="true">
	<div class="mini-chart-label">5Y RETURNS</div>

	<svg
		class="mini-chart-svg"
		viewBox={`0 0 ${chartWidth} ${chartHeight}`}
		role="presentation"
		focusable="false"
	>
		{#each gridLines as gridY}
			<line class="grid-line" x1={plotLeft} y1={gridY} x2={plotRight} y2={gridY}></line>
		{/each}
		<line class="baseline" x1={plotLeft} y1={plotBottom} x2={plotRight} y2={plotBottom}></line>

		{#each bars as bar}
			<g>
				<rect
					class="bar"
					class:bar-latest={bar.isLatest}
					x={bar.x}
					y={bar.y}
					width={bar.width}
					height={bar.height}
					rx="5"
				></rect>
				<rect
					class="pill"
					class:pill-latest={bar.isLatest}
					x={bar.pillX}
					y={bar.pillY}
					width={bar.pillWidth}
					height="14"
					rx="7"
				></rect>
				<text class="pill-text" x={bar.centerX} y={bar.pillY + 9}>{bar.label}</text>
				<text class="year-text" x={bar.centerX} y="92">{bar.shortYear}</text>
			</g>
		{/each}
	</svg>
</div>

<style>
	.mini-chart {
		width: 100%;
		height: 100%;
		padding: 8px 10px 6px;
		border-radius: 16px;
		background:
			linear-gradient(180deg, rgba(8, 20, 26, 0.36) 0%, rgba(8, 20, 26, 0.18) 100%),
			rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
		pointer-events: none;
		box-sizing: border-box;
	}

	.mini-chart-label {
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.48);
		margin-bottom: 2px;
	}

	.mini-chart-svg {
		display: block;
		width: 100%;
		height: calc(100% - 16px);
		overflow: visible;
	}

	.grid-line,
	.baseline {
		stroke: rgba(255, 255, 255, 0.12);
		stroke-width: 1;
	}

	.bar {
		fill: rgba(117, 239, 164, 0.52);
	}

	.bar.bar-latest {
		fill: rgba(117, 239, 164, 0.9);
	}

	.pill {
		fill: rgba(8, 20, 26, 0.62);
	}

	.pill.pill-latest {
		fill: rgba(8, 20, 26, 0.82);
	}

	.pill-text,
	.year-text {
		font-family: var(--font-ui);
		text-anchor: middle;
	}

	.pill-text {
		font-size: 8px;
		font-weight: 700;
		fill: rgba(255, 255, 255, 0.94);
	}

	.year-text {
		font-size: 8px;
		font-weight: 600;
		letter-spacing: 0.04em;
		fill: rgba(255, 255, 255, 0.54);
	}

	@media (max-width: 640px) {
		.mini-chart {
			padding: 7px 9px 5px;
			border-radius: 14px;
		}

		.mini-chart-label {
			font-size: 8px;
		}
	}
</style>
