<script>
	import { MAX_HISTORICAL_RETURN_YEARS } from '$lib/utils/dealReturns.js';

	let { series = [], variant = 'hero' } = $props();

	const insetLayout = {
		chartWidth: 184,
		chartHeight: 108,
		plotLeft: 10,
		plotRight: 174,
		plotTop: 18,
		plotBottom: 72,
		pillYOffset: 18,
		pillHeight: 14,
		pillRadius: 7,
		pillPadding: 10,
		pillMinWidth: 28,
		pillFontSize: 8,
		yearY: 92,
		yearFontSize: 8,
		label: '5Y RETURNS'
	};

	const heroLayout = {
		chartWidth: 312,
		chartHeight: 132,
		plotLeft: 12,
		plotRight: 300,
		plotTop: 24,
		plotBottom: 102,
		pillYOffset: 20,
		pillHeight: 16,
		pillRadius: 8,
		pillPadding: 12,
		pillMinWidth: 34,
		pillFontSize: 8.5,
		yearY: 121,
		yearFontSize: 8.5,
		label: '5 YEAR RETURNS'
	};

	const layout = $derived.by(() => variant === 'inset' ? insetLayout : heroLayout);
	const plotHeight = $derived.by(() => layout.plotBottom - layout.plotTop);

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
		const min = minValue - padding;
		const max = maxValue + padding;

		return {
			min,
			max,
			span: Math.max(max - min, 1)
		};
	});

	const gridLines = $derived.by(() => [
		layout.plotTop + (plotHeight / 3),
		layout.plotTop + ((plotHeight / 3) * 2)
	]);

	const bars = $derived.by(() => {
		if (!normalizedSeries.length) return [];

		const plotWidth = layout.plotRight - layout.plotLeft;
		const slotWidth = plotWidth / normalizedSeries.length;
		const minBarWidth = variant === 'inset' ? 14 : 18;
		const maxBarWidth = variant === 'inset' ? 24 : 34;
		const barWidth = Math.max(minBarWidth, Math.min(maxBarWidth, slotWidth * 0.58));

		return normalizedSeries.map((point, index) => {
			const centerX = layout.plotLeft + (slotWidth * index) + (slotWidth / 2);
			const height = Math.max(
				9,
				((point.value - domain.min) / domain.span) * plotHeight
			);
			const y = layout.plotBottom - height;
			const label = `${point.value.toFixed(2)}%`;
			const labelCharacterWidth = variant === 'inset' ? 5.4 : 5.9;
			const pillWidth = Math.max(layout.pillMinWidth, (label.length * labelCharacterWidth) + layout.pillPadding);
			const pillY = Math.max(4, y - layout.pillYOffset);

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
				shortYear: String(point.year),
				isLatest: index === normalizedSeries.length - 1
			};
		});
	});
</script>

<div
	class="mini-chart"
	class:variant-hero={variant === 'hero'}
	class:variant-inset={variant === 'inset'}
	aria-hidden="true"
>
	<div class="mini-chart-label">{layout.label}</div>

	<svg
		class="mini-chart-svg"
		viewBox={`0 0 ${layout.chartWidth} ${layout.chartHeight}`}
		role="presentation"
		focusable="false"
	>
		{#each gridLines as gridY}
			<line class="grid-line" x1={layout.plotLeft} y1={gridY} x2={layout.plotRight} y2={gridY}></line>
		{/each}
		<line
			class="baseline"
			x1={layout.plotLeft}
			y1={layout.plotBottom}
			x2={layout.plotRight}
			y2={layout.plotBottom}
		></line>

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
					height={layout.pillHeight}
					rx={layout.pillRadius}
				></rect>
				<text
					class="pill-text"
					style={`font-size:${layout.pillFontSize}px`}
					x={bar.centerX}
					y={bar.pillY + (layout.pillHeight / 2) + 0.5}
				>
					{bar.label}
				</text>
				<text
					class="year-text"
					style={`font-size:${layout.yearFontSize}px`}
					x={bar.centerX}
					y={layout.yearY}
				>
					{bar.shortYear}
				</text>
			</g>
		{/each}
	</svg>
</div>

<style>
	.mini-chart {
		width: 100%;
		height: 100%;
		pointer-events: none;
		box-sizing: border-box;
		display: flex;
		flex-direction: column;
	}

	.mini-chart.variant-hero {
		padding: 0 2px 2px;
	}

	.mini-chart.variant-inset {
		padding: 8px 10px 6px;
		border-radius: 16px;
		background:
			linear-gradient(180deg, rgba(8, 20, 26, 0.36) 0%, rgba(8, 20, 26, 0.18) 100%),
			rgba(255, 255, 255, 0.04);
		border: 1px solid rgba(255, 255, 255, 0.08);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.04);
		backdrop-filter: blur(12px);
		-webkit-backdrop-filter: blur(12px);
	}

	.mini-chart-label {
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.44);
		margin-bottom: 4px;
	}

	.mini-chart-svg {
		display: block;
		width: 100%;
		flex: 1;
		min-height: 0;
		overflow: visible;
	}

	.grid-line,
	.baseline {
		stroke: rgba(255, 255, 255, 0.1);
		stroke-width: 1;
	}

	.bar {
		fill: rgba(117, 239, 164, 0.58);
	}

	.bar.bar-latest {
		fill: rgba(117, 239, 164, 0.92);
	}

	.pill {
		fill: rgba(7, 20, 25, 0.72);
	}

	.pill.pill-latest {
		fill: rgba(7, 20, 25, 0.88);
	}

	.pill-text,
	.year-text {
		font-family: var(--font-ui);
		text-anchor: middle;
		dominant-baseline: middle;
	}

	.pill-text {
		font-weight: 700;
		fill: rgba(255, 255, 255, 0.94);
	}

	.year-text {
		font-weight: 600;
		letter-spacing: 0.04em;
		fill: rgba(255, 255, 255, 0.54);
	}

	@media (max-width: 640px) {
		.mini-chart.variant-inset {
			padding: 7px 9px 5px;
			border-radius: 14px;
		}

		.mini-chart.variant-inset .mini-chart-label {
			font-size: 8px;
		}

		.mini-chart.variant-hero {
			padding-right: 0;
		}
	}
</style>
