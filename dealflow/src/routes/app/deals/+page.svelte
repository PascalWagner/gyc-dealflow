<script>
	import { onMount } from 'svelte';
	import PipelineTabs from '$lib/components/PipelineTabs.svelte';
	import DealCard from '$lib/components/DealCard.svelte';
	import { deals, dealStages, stageCounts, fetchDeals, dealsLoading } from '$lib/stores/deals.js';
	import { isGuest } from '$lib/stores/auth.js';

	let currentTab = $state('browse');

	function switchTab(tab) {
		currentTab = tab;
	}

	// Filter deals by current tab
	const filteredDeals = $derived(
		$deals.filter(deal => {
			const stage = $dealStages[deal.id] || 'browse';
			if (currentTab === 'browse') return !$dealStages[deal.id];
			if (currentTab === 'saved') return stage === 'saved' || stage === 'vetting';
			return stage === currentTab;
		})
	);

	onMount(() => {
		fetchDeals();
	});
</script>

<div class="deals-page">
	<div class="deals-header">
		<h1 class="deals-title">Deal Flow</h1>
		<PipelineTabs {currentTab} counts={$stageCounts} onswitch={switchTab} />
	</div>

	{#if $dealsLoading}
		<div class="deals-loading">
			<p>Loading deals...</p>
		</div>
	{:else if filteredDeals.length === 0}
		<div class="deals-empty">
			<p>No deals in this stage yet.</p>
		</div>
	{:else}
		<div class="deals-grid">
			{#each filteredDeals as deal (deal.id)}
				<DealCard {deal} />
			{/each}
		</div>
	{/if}
</div>

<style>
	.deals-page {
		padding: 24px;
		max-width: 1400px;
	}

	.deals-header {
		margin-bottom: 24px;
	}

	.deals-title {
		font-family: var(--font-headline);
		font-size: 28px;
		color: var(--text-dark);
		margin-bottom: 16px;
	}

	.deals-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
		gap: 16px;
	}

	.deals-loading, .deals-empty {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 40vh;
		font-family: var(--font-ui);
		color: var(--text-muted);
		font-size: 15px;
	}

	@media (max-width: 768px) {
		.deals-page { padding: 16px; }
		.deals-grid { grid-template-columns: 1fr; }
		.deals-title { font-size: 22px; }
	}
</style>
