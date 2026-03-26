<script>
	import { onMount } from 'svelte';
	import { user, isLoggedIn, userToken } from '$lib/stores/auth.js';
	import { deals, dealStages } from '$lib/stores/deals.js';
	import { goto } from '$app/navigation';

	const savedDeals = $derived.by(() => {
		const allDeals = $deals || [];
		const stages = $dealStages || {};
		return allDeals.filter(d => stages[d.id] === 'saved' || stages[d.id] === 'review');
	});
</script>

<svelte:head><title>Saved Deals | GYC</title></svelte:head>

<div class="ly-page">
	<div class="ly-frame">
<div class="page-header">
	<h1>Saved Deals</h1>
</div>

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
			<a class="deal-card" href="/deal/{deal.id}">
				<div class="deal-name">{deal.name || deal.investmentName || 'Untitled Deal'}</div>
				<div class="deal-operator">{deal.managementCompany || deal.operator || ''}</div>
				<div class="deal-meta">
					{#if deal.assetClass}
						<span class="deal-tag">{Array.isArray(deal.assetClass) ? deal.assetClass[0] : deal.assetClass}</span>
					{/if}
					{#if deal.targetIRR}
						<span class="deal-stat">{(deal.targetIRR * 100).toFixed(1)}% IRR</span>
					{/if}
					{#if deal.minimumInvestment}
						<span class="deal-stat">${(deal.minimumInvestment / 1000).toFixed(0)}K min</span>
					{/if}
				</div>
			</a>
		{/each}
	</div>
{/if}
</div>
</div>

<style>
	.page-header { padding: 20px 24px; }
	h1 { font-family: var(--font-headline); font-size: 22px; font-weight: 800; color: var(--text-dark); margin: 0; }

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
		gap: 16px; padding: 0 24px 24px;
	}
	.deal-card {
		background: var(--bg-card); border: 1px solid var(--border-light);
		border-radius: var(--radius-sm); padding: 20px; text-decoration: none;
		color: inherit; transition: all 0.2s;
	}
	.deal-card:hover { border-color: var(--primary); transform: translateY(-2px); }
	.deal-name { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.deal-operator { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
	.deal-meta { display: flex; gap: 8px; flex-wrap: wrap; }
	.deal-tag {
		padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;
		background: rgba(44, 110, 73, 0.08); color: #2C6E49; font-family: var(--font-ui);
	}
	.deal-stat { font-family: var(--font-ui); font-size: 11px; color: var(--text-secondary); font-weight: 600; }

	@media (max-width: 768px) {
		.page-header { padding: 16px; }
		.card-grid { padding: 0 16px 16px; grid-template-columns: 1fr; }
	}
</style>
