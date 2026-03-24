<script>
	import { onMount } from 'svelte';
	import { user, isLoggedIn, userToken } from '$lib/stores/auth.js';
	import { deals } from '$lib/stores/deals.js';

	let searchQuery = $state('');
	let gps = $state([]);

	function getGPs() {
		const gpMap = {};
		const allDeals = $deals || [];
		allDeals.forEach(d => {
			const company = d.managementCompany || d.operator || '';
			if (!company) return;
			if (!gpMap[company]) {
				gpMap[company] = {
					name: d.ceoName || d.operatorName || company,
					company,
					assetClasses: new Set(),
					deals: []
				};
			}
			gpMap[company].deals.push(d);
			const classes = Array.isArray(d.assetClass) ? d.assetClass : d.assetClass ? [d.assetClass] : [];
			classes.forEach(c => gpMap[company].assetClasses.add(c));
		});
		return Object.values(gpMap).map(g => ({
			...g,
			assetClasses: [...g.assetClasses]
		})).sort((a, b) => b.deals.length - a.deals.length);
	}

	const filteredGPs = $derived.by(() => {
		const all = getGPs();
		const q = searchQuery.toLowerCase();
		if (!q) return all;
		return all.filter(g => [g.name, g.company, ...g.assetClasses].join(' ').toLowerCase().includes(q));
	});
</script>

<svelte:head><title>Find a GP | GYC</title></svelte:head>

<div class="page-header">
	<h1>Find a GP</h1>
	<input
		type="text"
		class="search-input"
		placeholder="Search sponsors..."
		bind:value={searchQuery}
	/>
</div>

<div class="gp-grid">
	{#each filteredGPs as gp}
		<a class="gp-card" href="/sponsor?company={encodeURIComponent(gp.company)}">
			<div class="gp-avatar">{(gp.name || 'N/A').split(' ').map(n => n[0]).join('')}</div>
			<div class="gp-name">{gp.name || 'Unknown'}</div>
			<div class="gp-company">{gp.company}</div>
			<div class="gp-stats">
				<div>
					<div class="gp-stat-label">Deals Listed</div>
					<div class="gp-stat-value">{gp.deals.length}</div>
				</div>
				<div>
					<div class="gp-stat-label">Avg Target IRR</div>
					<div class="gp-stat-value">
						{(() => { const avg = gp.deals.filter(d => d.targetIRR).reduce((s, d, _, a) => s + d.targetIRR / a.length, 0); return avg > 0 ? (avg * 100).toFixed(1) + '%' : '---'; })()}
					</div>
				</div>
			</div>
			<div class="gp-tags">
				{#each gp.assetClasses.slice(0, 3) as tag}
					<span class="gp-tag">{tag}</span>
				{/each}
			</div>
		</a>
	{/each}
	{#if filteredGPs.length === 0}
		<div class="empty-state">No sponsors found matching "{searchQuery}"</div>
	{/if}
</div>

<style>
	.page-header {
		display: flex; align-items: center; justify-content: space-between;
		padding: 20px 24px; gap: 16px; flex-wrap: wrap;
	}
	h1 { font-family: var(--font-headline); font-size: 22px; font-weight: 800; color: var(--text-dark); margin: 0; }
	.search-input {
		min-width: 260px; padding: 10px 14px; border: 1px solid var(--border-light);
		border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 13px;
		background: var(--bg-card); color: var(--text-dark);
	}
	.gp-grid {
		display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
		gap: 16px; padding: 0 24px 24px;
	}
	.gp-card {
		background: var(--bg-card); border: 1px solid var(--border-light);
		border-radius: var(--radius-sm); padding: 20px; text-decoration: none;
		color: inherit; transition: all 0.2s; cursor: pointer;
	}
	.gp-card:hover { border-color: var(--primary); transform: translateY(-2px); box-shadow: var(--shadow-sm); }
	.gp-avatar {
		width: 48px; height: 48px; border-radius: 50%;
		background: linear-gradient(135deg, var(--primary), #2C6E49);
		color: #fff; display: flex; align-items: center; justify-content: center;
		font-family: var(--font-ui); font-size: 16px; font-weight: 700; margin-bottom: 12px;
	}
	.gp-name { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); }
	.gp-company { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); margin-bottom: 12px; }
	.gp-stats { display: flex; gap: 24px; margin-bottom: 12px; }
	.gp-stat-label { font-family: var(--font-body); font-size: 10px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.gp-stat-value { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.gp-tags { display: flex; gap: 6px; flex-wrap: wrap; }
	.gp-tag {
		padding: 3px 8px; border-radius: 4px; font-size: 10px; font-weight: 600;
		background: rgba(44, 110, 73, 0.08); color: #2C6E49;
		font-family: var(--font-ui);
	}
	.empty-state {
		grid-column: 1 / -1; text-align: center; padding: 60px 20px;
		font-family: var(--font-body); font-size: 14px; color: var(--text-muted);
	}
	@media (min-width: 769px) and (max-width: 1024px) {
		.page-header { padding: 20px 24px; }
		.gp-grid { padding: 0 24px 24px; grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
	@media (max-width: 768px) {
		.page-header { padding: 16px; }
		.gp-grid { padding: 0 16px 16px; grid-template-columns: 1fr; }
		.search-input { min-width: auto; width: 100%; }
	}
</style>
