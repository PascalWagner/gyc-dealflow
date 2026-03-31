<script>
	import { deals, dealStages } from '$lib/stores/deals.js';
	import { goto } from '$app/navigation';
	import DealCard from '$lib/components/DealCard.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';

	const VIEW_DEAL_FOOTER_ACTIONS = [
		{
			id: 'viewDeal',
			label: 'View Deal',
			next: 'open',
			tone: 'primary',
			full: true
		}
	];

	const savedDeals = $derived.by(() => {
		const allDeals = $deals || [];
		const stages = $dealStages || {};
		return allDeals.filter(d => stages[d.id] === 'saved' || stages[d.id] === 'review');
	});

	function handleOpenDeal({ deal }) {
		goto(`/deal/${deal.id}`);
	}
</script>

<svelte:head><title>Saved Deals | GYC</title></svelte:head>

<PageContainer className="saved-page">
<PageHeader title="Saved Deals" />

{#if savedDeals.length === 0}
	<div class="empty-state">
		<div class="empty-icon">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="40" height="40">
				<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
			</svg>
		</div>
		<div class="empty-title">No Saved Deals Yet</div>
		<div class="empty-desc">Bookmark deals from the Deal Flow page by clicking the save icon. They'll show up here for easy access.</div>
		<a href="/app/deals" class="btn-cta">Browse Live Deals</a>
	</div>
	{:else}
		<div class="card-grid">
			{#each savedDeals as deal}
				<DealCard
					{deal}
					footerActions={VIEW_DEAL_FOOTER_ACTIONS}
					onfooteraction={handleOpenDeal}
				/>
			{/each}
		</div>
	{/if}
</PageContainer>

<style>
	.empty-state {
		text-align: center; padding: 80px 20px;
		display: flex; flex-direction: column; align-items: center; gap: 12px;
	}
	.empty-icon { color: var(--text-muted); opacity: 0.4; margin-bottom: 8px; }
	.empty-title { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); }
	.empty-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); max-width: 400px; line-height: 1.5; }
	.btn-cta {
		display: inline-block; padding: 12px 32px; background: var(--primary);
		color: #fff; border-radius: 10px; font-family: var(--font-ui);
		font-size: 14px; font-weight: 700; text-decoration: none; margin-top: 8px;
	}
	.btn-cta:hover { opacity: 0.9; }

	.card-grid {
		display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
		gap: 16px;
	}

	@media (max-width: 768px) {
		.card-grid { grid-template-columns: 1fr; }
	}
</style>
