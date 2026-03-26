<script>
	import { PIPELINE_STAGES, OUTCOME_STAGES, STAGE_META } from '$lib/stores/deals.js';
	import { selectionChanged } from '$lib/utils/haptics.js';

	let { currentTab = 'browse', counts = {}, onswitch = () => {} } = $props();

	function switchTab(tab) {
		selectionChanged();
		onswitch(tab);
	}
</script>

<!-- Desktop tabs -->
<div class="pipeline-tabs ly-desktop-only">
	{#each PIPELINE_STAGES as stage}
		<button
			class="pipeline-tab"
			class:active={currentTab === stage}
			onclick={() => switchTab(stage)}
		>
			{STAGE_META[stage].label}
			{#if (counts[stage] || 0) > 0}
				<span class="tab-count">{counts[stage]}</span>
			{/if}
		</button>
		{#if stage !== PIPELINE_STAGES[PIPELINE_STAGES.length - 1]}
			<span class="tab-arrow">›</span>
		{/if}
	{/each}

	<span class="tab-divider"></span>

	{#each OUTCOME_STAGES as stage}
		<button
			class="pipeline-tab outcome"
			class:active={currentTab === stage}
			onclick={() => switchTab(stage)}
		>
			{STAGE_META[stage].label}
		</button>
	{/each}
</div>

<!-- Mobile pills -->
<div class="pipeline-pills ly-pill-tabs ly-mobile-only">
	{#each PIPELINE_STAGES as stage}
		<button
			class="pipeline-pill ly-pill-tab"
			class:active={currentTab === stage}
			onclick={() => switchTab(stage)}
		>
			{STAGE_META[stage].label}
			{#if (counts[stage] || 0) > 0}
				<span class="pill-count">{counts[stage]}</span>
			{/if}
		</button>
	{/each}

	<span class="pill-divider"></span>

	{#each OUTCOME_STAGES as stage}
		<button
			class="pipeline-pill ly-pill-tab"
			class:active={currentTab === stage}
			onclick={() => switchTab(stage)}
		>
			{STAGE_META[stage].label}
			{#if (counts[stage] || 0) > 0}
				<span class="pill-count">{counts[stage]}</span>
			{/if}
		</button>
	{/each}
</div>

<style>
	/* Desktop tabs */
	.pipeline-tabs {
		display: flex;
		align-items: center;
		gap: 4px;
		background: var(--bg-card);
		border-radius: 8px;
		padding: 3px 4px;
		border: 1px solid var(--border);
		max-width: 100%;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}
	.pipeline-tabs::-webkit-scrollbar { display: none; }

	.pipeline-tab {
		padding: 6px 11px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		border-radius: 6px;
		transition: all var(--transition);
		border: none;
		background: none;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	.pipeline-tab:hover { color: var(--text-dark); }
	.pipeline-tab.active { background: var(--primary); color: #fff; }

	.tab-divider {
		display: block;
		width: 1px;
		height: 18px;
		background: var(--border);
		margin: 0 4px;
		flex-shrink: 0;
	}

	.tab-arrow {
		color: var(--text-muted);
		font-size: 10px;
		padding: 0 2px;
		opacity: 0.4;
		flex-shrink: 0;
	}

	.tab-count {
		background: rgba(255,255,255,0.22);
		padding: 1px 6px;
		border-radius: 10px;
		font-size: 10px;
		line-height: 1.2;
	}

	/* Mobile pills */
	.pipeline-pills {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 4px;
		margin-top: 4px;
	}

	.pipeline-pill {
		padding: 8px 12px;
		font-size: 11px;
		font-weight: 700;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.pipeline-pill:hover { color: var(--text-dark); }

	.pill-divider {
		width: 1px;
		height: 18px;
		background: var(--border);
		margin: 0 2px;
		flex-shrink: 0;
		align-self: center;
	}

	.pill-count {
		background: rgba(255,255,255,0.2);
		padding: 0 5px;
		border-radius: 8px;
		font-size: 9px;
		margin-left: 2px;
	}

	.pipeline-tabs.ly-desktop-only {
		display: flex;
	}

	.pipeline-pills.ly-mobile-only {
		display: none;
	}

	@media (max-width: 768px) {
		.pipeline-pills.ly-mobile-only {
			display: flex !important;
		}
	}
</style>
