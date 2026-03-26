<script>
	import { US_MAP_VIEWBOX, US_STATE_PATHS } from '$lib/data/us-state-paths.js';
	import { buildInvestingGeographyModel } from '$lib/utils/investing-geography.js';

	let { deal } = $props();

	const model = $derived.by(() => buildInvestingGeographyModel(deal));
	const contiguousStates = Object.entries(US_STATE_PATHS).filter(([stateCode]) => stateCode !== 'AK' && stateCode !== 'HI');

	function getFillColor(stateCode) {
		if (!model.highlightedStateSet.has(stateCode)) return '#e4eae6';
		return model.allHighlighted ? '#6bbe8a' : '#4fb878';
	}

	function getStrokeColor(stateCode) {
		if (!model.highlightedStateSet.has(stateCode)) return '#d0d8d3';
		return model.allHighlighted ? '#5aaa78' : '#2d8a52';
	}

	function getStrokeWidth(stateCode) {
		if (!model.highlightedStateSet.has(stateCode)) return '0.5';
		return model.allHighlighted ? '0.5' : '2';
	}
</script>

<div class="ig-grid">
	<div class="ig-map-shell">
		<svg viewBox={US_MAP_VIEWBOX} class="ig-map" xmlns="http://www.w3.org/2000/svg" aria-label="United States investing geography map">
			{#each contiguousStates as [stateCode, pathData]}
				<path
					d={pathData}
					fill={model.allHighlighted ? '#6bbe8a' : '#e4eae6'}
					stroke={model.allHighlighted ? '#6bbe8a' : '#e4eae6'}
					stroke-width="1.5"
					stroke-linejoin="round"
				/>
			{/each}
			{#each contiguousStates as [stateCode, pathData]}
				<path
					d={pathData}
					fill={getFillColor(stateCode)}
					stroke={getStrokeColor(stateCode)}
					stroke-width={getStrokeWidth(stateCode)}
					stroke-linejoin="round"
				>
					<title>{stateCode}</title>
				</path>
			{/each}
		</svg>
	</div>

	<div class="ig-details">
		<div class="ig-badge-wrap">
			<span class:ig-badge-active={model.highlightedStates.length > 0} class="ig-badge">{model.badgeLabel}</span>
		</div>

		{#if model.address}
			<div class="ig-address">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" aria-hidden="true">
					<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
					<circle cx="12" cy="10" r="3" />
				</svg>
				<div>{model.address}</div>
			</div>
		{/if}

		<div class="ig-description">{model.description}</div>

		{#if model.metaItems.length > 0}
			<div class="ig-meta-grid">
				{#each model.metaItems as item}
					<div class="ig-meta-card">
						<div class="ig-meta-label">{item.label}</div>
						<div class="ig-meta-value">{item.value}</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>

<style>
	.ig-grid {
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
		gap: 24px;
		align-items: center;
	}

	.ig-map-shell {
		position: relative;
		width: 100%;
		background: linear-gradient(180deg, rgba(244, 247, 245, 0.6) 0%, rgba(238, 243, 240, 0.3) 100%);
		border-radius: 12px;
		padding: 20px 16px 12px;
	}

	.ig-map {
		width: 100%;
		height: auto;
		filter: drop-shadow(0 1px 3px rgba(0, 0, 0, 0.06));
		display: block;
	}

	.ig-details {
		min-width: 0;
	}

	.ig-badge-wrap {
		margin-bottom: 12px;
	}

	.ig-badge {
		display: inline-flex;
		align-items: center;
		padding: 4px 12px;
		background: rgba(200, 200, 200, 0.12);
		border: 1px solid rgba(200, 200, 200, 0.3);
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.ig-badge-active {
		background: rgba(81, 190, 123, 0.08);
		border-color: rgba(81, 190, 123, 0.2);
		color: var(--primary);
	}

	.ig-address {
		display: flex;
		align-items: flex-start;
		gap: 8px;
		margin-bottom: 12px;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
		line-height: 1.5;
	}

	.ig-address svg {
		flex-shrink: 0;
		margin-top: 2px;
		color: var(--text-muted);
	}

	.ig-description {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		margin-bottom: 16px;
	}

	.ig-meta-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.ig-meta-card {
		padding: 8px 12px;
		background: var(--bg-cream);
		border-radius: 8px;
	}

	.ig-meta-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 2px;
	}

	.ig-meta-value {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark);
	}

	@media (max-width: 860px) {
		.ig-grid {
			grid-template-columns: 1fr;
		}

		.ig-map-shell {
			order: 1;
		}

		.ig-details {
			order: 2;
		}
	}
</style>
