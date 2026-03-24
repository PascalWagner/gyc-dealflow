<script>
	import { PIPELINE_STAGES, OUTCOME_STAGES, STAGE_META } from '$lib/stores/deals.js';

	let { currentTab = 'browse', counts = {}, onswitch = () => {} } = $props();

	function switchTab(tab) {
		onswitch(tab);
	}
</script>

<!-- Desktop tabs -->
<div class="pipeline-tabs desktop-only">
	{#each PIPELINE_STAGES as stage}
		<button
			class="pipeline-tab"
			class:active={currentTab === stage}
			onclick={() => switchTab(stage)}
		>
			{STAGE_META[stage].label}
		</button>
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
<div class="pipeline-pills mobile-only">
	{#each PIPELINE_STAGES as stage}
		<button
			class="pipeline-pill"
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
			class="pipeline-pill"
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
		gap: 2px;
		background: var(--bg-card);
		border-radius: 10px;
		padding: 3px;
		border: 1px solid var(--border);
		max-width: 100%;
		overflow-x: auto;
		scrollbar-width: none;
		-webkit-overflow-scrolling: touch;
	}
	.pipeline-tabs::-webkit-scrollbar { display: none; }

	.pipeline-tab {
		padding: 7px 14px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		color: var(--text-secondary);
		cursor: pointer;
		border-radius: 7px;
		transition: all var(--transition);
		border: none;
		background: none;
		letter-spacing: 0.45px;
		text-transform: uppercase;
		white-space: nowrap;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		flex-shrink: 0;
	}

	.pipeline-tab:hover { color: var(--text-dark); }
	.pipeline-tab.active { background: var(--primary); color: #fff; }

	.tab-divider {
		display: block;
		width: 1px;
		height: 18px;
		background: var(--border);
		margin: 0 8px;
		flex-shrink: 0;
	}

	/* Mobile pills */
	.pipeline-pills {
		display: flex;
		align-items: center;
		gap: 6px;
		overflow-x: auto;
		padding: 4px 0 8px;
		-webkit-overflow-scrolling: touch;
		scrollbar-width: none;
	}
	.pipeline-pills::-webkit-scrollbar { display: none; }

	.pipeline-pill {
		padding: 6px 12px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
		background: var(--bg-card);
		border: 1px solid var(--border-light);
		border-radius: 20px;
		cursor: pointer;
		white-space: nowrap;
		transition: all var(--transition);
	}

	.pipeline-pill:hover { color: var(--text-dark); }
	.pipeline-pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }

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

	/* Responsive */
	.desktop-only { display: flex; }
	.mobile-only { display: none; }

	@media (max-width: 768px) {
		.desktop-only { display: none; }
		.mobile-only { display: flex; }
	}
</style>
