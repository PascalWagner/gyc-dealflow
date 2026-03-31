<script>
	import { PIPELINE_STAGES, OUTCOME_STAGES, STAGE_META } from '$lib/stores/deals.js';
	import { selectionChanged } from '$lib/utils/haptics.js';

	let {
		currentTab = 'filter',
		counts = {},
		onswitch = () => {},
		mobileCountStyle = 'inline'
	} = $props();

	const ALL_STAGES = [...PIPELINE_STAGES, ...OUTCOME_STAGES];

	function switchTab(tab) {
		selectionChanged();
		onswitch(tab);
	}

	function stageCount(stage) {
		return Number(counts?.[stage] || 0);
	}

	function stageLabel(stage, forceCount = false) {
		const count = stageCount(stage);
		if (forceCount || count > 0 || currentTab === stage) {
			return `${STAGE_META[stage].label} (${count})`;
		}
		return STAGE_META[stage].label;
	}

	const mobileStageLabel = $derived(STAGE_META[currentTab]?.label || 'Filter');
	const mobileStageCount = $derived(stageCount(currentTab));
</script>

<div class="pipeline-tabs ly-desktop-only">
	{#each PIPELINE_STAGES as stage}
		<button
			class="pipeline-tab"
			class:active={currentTab === stage}
			onclick={() => switchTab(stage)}
		>
			<span>{STAGE_META[stage].label}</span>
			{#if stageCount(stage) > 0}
				<span class="tab-count">{stageCount(stage)}</span>
			{/if}
		</button>
		{#if stage !== PIPELINE_STAGES[PIPELINE_STAGES.length - 1]}
			<span class="tab-arrow" aria-hidden="true">›</span>
		{/if}
	{/each}

	<span class="tab-divider" aria-hidden="true"></span>

	{#each OUTCOME_STAGES as stage}
		<button
			class="pipeline-tab outcome"
			class:active={currentTab === stage}
			onclick={() => switchTab(stage)}
		>
			<span>{STAGE_META[stage].label}</span>
			{#if stageCount(stage) > 0}
				<span class="tab-count">{stageCount(stage)}</span>
			{/if}
		</button>
	{/each}
</div>

<div class="pipeline-mobile-select ly-mobile-only">
	<label class="sr-only" for="deal-flow-stage-select">Pipeline Stage</label>
	<div class="pipeline-select-shell">
		<select
			id="deal-flow-stage-select"
			class="pipeline-select"
			value={currentTab}
			onchange={(event) => switchTab(event.currentTarget.value)}
		>
			{#each ALL_STAGES as stage}
				<option value={stage}>{stageLabel(stage, true)}</option>
			{/each}
		</select>

		<div class="pipeline-select-display" aria-hidden="true">
			<span class="pipeline-select-label">{mobileStageLabel}</span>
			<svg class="pipeline-select-chevron" viewBox="0 0 10 6" fill="none">
				<path d="M1 1L5 5L9 1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"></path>
			</svg>

			{#if mobileCountStyle === 'inline'}
				<span class="pipeline-select-count">{mobileStageCount}</span>
			{/if}
		</div>
	</div>
</div>

<style>
	.pipeline-tabs {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}

	.pipeline-tabs::-webkit-scrollbar {
		display: none;
	}

	.pipeline-tab {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 0;
		border: none;
		background: none;
		border-radius: 999px;
		color: var(--text-secondary);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.32px;
		text-transform: uppercase;
		white-space: nowrap;
		cursor: pointer;
		flex-shrink: 0;
		transition: color 0.15s ease, background-color 0.15s ease;
	}

	.pipeline-tab:hover {
		color: var(--text-dark);
	}

	.pipeline-tab.active {
		padding: 6px 10px;
		background: rgba(81, 190, 123, 0.12);
		color: var(--primary);
	}

	.tab-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 18px;
		height: 18px;
		padding: 0 5px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.14);
		font-size: 10px;
		line-height: 1;
		color: inherit;
	}

	.pipeline-tab.active .tab-count {
		background: rgba(81, 190, 123, 0.18);
	}

	.tab-arrow {
		color: var(--text-muted);
		font-size: 11px;
		opacity: 0.5;
		flex-shrink: 0;
	}

	.tab-divider {
		width: 1px;
		height: 16px;
		background: var(--border);
		margin: 0 2px;
		flex-shrink: 0;
	}

	.pipeline-mobile-select.ly-mobile-only {
		display: none;
	}

	.pipeline-select-shell {
		position: relative;
		min-width: 0;
	}

	.pipeline-select {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		opacity: 0.01;
		cursor: pointer;
	}

	.pipeline-select-display {
		display: inline-flex;
		align-items: center;
		justify-content: flex-end;
		gap: 8px;
		min-height: 38px;
		padding: 0 12px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-card);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		pointer-events: none;
		box-sizing: border-box;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
	}

	.pipeline-select-shell:focus-within .pipeline-select-display {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.pipeline-select-label {
		white-space: nowrap;
	}

	.pipeline-select-chevron {
		width: 10px;
		height: 6px;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.pipeline-select-count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.14);
		font-size: 11px;
		line-height: 1;
		color: var(--primary);
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	.pipeline-tabs.ly-desktop-only {
		display: flex;
	}

	@media (max-width: 768px) {
		.pipeline-tabs.ly-desktop-only {
			display: none !important;
		}

		.pipeline-mobile-select.ly-mobile-only {
			display: block !important;
		}
	}
</style>
