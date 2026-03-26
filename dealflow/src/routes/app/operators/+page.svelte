<script>
	import { onMount } from 'svelte';
	import { deals, fetchDeals } from '$lib/stores/deals.js';

	let nameSearch = $state('');
	let assetFilter = $state('');
	let maxInvest = $state('');
	let fullCycleMin = $state('0');
	let sortBy = $state('deals');
	let showMobileFilters = $state(false);
	function computeStats(dealList) {
		let irrs = [], prefs = [], mins = [], activeCount = 0;
		dealList.forEach(d => {
			const irr = typeof d.targetIRR === 'number' ? (d.targetIRR <= 1 ? d.targetIRR * 100 : d.targetIRR) : 0;
			if (irr > 0) irrs.push(irr);
			const pref = typeof d.preferredReturn === 'number' ? (d.preferredReturn <= 1 ? d.preferredReturn * 100 : d.preferredReturn) : 0;
			if (pref > 0) prefs.push(pref);
			const min = typeof d.investmentMinimum === 'number' ? d.investmentMinimum : 0;
			if (min > 0) mins.push(min);
			if (d.status && /open|active|accepting/i.test(d.status)) activeCount++;
		});
		const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
		return { avgIRR: avg(irrs), avgPref: avg(prefs), minInvestment: mins.length ? Math.min(...mins) : 0, activeDeals: activeCount };
	}

	// Use $derived instead of $effect — avoids effect_update_depth_exceeded
	const _computed = $derived.by(() => {
		if (!$deals.length) return { companies: [], assetClasses: [] };
		const dealsByCompany = {};
		$deals.forEach(d => {
			const name = d.managementCompany;
			if (!name) return;
			if (!dealsByCompany[name]) dealsByCompany[name] = { deals: [], assetClasses: new Set(), dealTypes: new Set() };
			dealsByCompany[name].deals.push(d);
			if (d.assetClass) dealsByCompany[name].assetClasses.add(d.assetClass);
			if (d.dealType) dealsByCompany[name].dealTypes.add(d.dealType);
		});

		const companyMap = {};
		Object.entries(dealsByCompany).forEach(([name, info]) => {
			const stats = computeStats(info.deals);
			companyMap[name] = {
				name, ceo: info.deals[0]?.ceo || '', assetClasses: info.assetClasses, dealTypes: info.dealTypes,
				dealCount: info.deals.length, website: '', type: '', foundingYear: null, fullCycleDeals: 0, ...stats
			};
		});

		if (typeof window !== 'undefined' && window.GYC_COMPANIES) {
			window.GYC_COMPANIES.forEach(c => {
				if (!c.name) return;
				const existing = companyMap[c.name];
				if (existing) {
					existing.id = c.id; existing.website = c.website || ''; existing.type = c.type || '';
					existing.foundingYear = c.foundingYear || null; existing.fullCycleDeals = c.fullCycleDeals || 0;
					(c.assetClasses || []).forEach(ac => existing.assetClasses.add(ac));
				} else {
					companyMap[c.name] = { name: c.name, id: c.id, ceo: c.ceo || '', assetClasses: new Set(c.assetClasses || []),
						dealTypes: new Set(), dealCount: 0, website: c.website || '', type: c.type || '',
						foundingYear: c.foundingYear || null, fullCycleDeals: c.fullCycleDeals || 0,
						avgIRR: 0, avgPref: 0, minInvestment: 0, activeDeals: 0 };
				}
			});
		}

		const companyList = Object.values(companyMap);
		const acs = new Set();
		companyList.forEach(c => c.assetClasses.forEach(ac => { if (ac) acs.add(ac); }));
		return { companies: companyList, assetClasses: [...acs].sort() };
	});

	const companies = $derived(_computed.companies);
	const allAssetClasses = $derived(_computed.assetClasses);

	const filtered = $derived.by(() => {
		let result = companies.filter(c => {
			if (assetFilter && !c.assetClasses.has(assetFilter)) return false;
			if (nameSearch && !c.name.toLowerCase().includes(nameSearch.toLowerCase()) && !(c.ceo && c.ceo.toLowerCase().includes(nameSearch.toLowerCase()))) return false;
			if (maxInvest && c.minInvestment && c.minInvestment > parseInt(maxInvest)) return false;
			if (parseInt(fullCycleMin) > 0 && (c.fullCycleDeals || 0) < parseInt(fullCycleMin)) return false;
			return true;
		});
		if (sortBy === 'name') result.sort((a, b) => a.name.localeCompare(b.name));
		else if (sortBy === 'newest') result.sort((a, b) => (b.foundingYear || 0) - (a.foundingYear || 0) || b.dealCount - a.dealCount);
		else if (sortBy === 'fullcycle') result.sort((a, b) => (b.fullCycleDeals || 0) - (a.fullCycleDeals || 0) || b.dealCount - a.dealCount);
		else result.sort((a, b) => b.dealCount - a.dealCount || a.name.localeCompare(b.name));
		return result;
	});

	const hasAdvancedFilters = $derived(
		Boolean(assetFilter || maxInvest || parseInt(fullCycleMin) > 0 || sortBy !== 'deals')
	);
	const hasAnyFilters = $derived(Boolean(nameSearch.trim()) || hasAdvancedFilters);
	const activeFilterCount = $derived(
		(assetFilter ? 1 : 0)
		+ (maxInvest ? 1 : 0)
		+ (parseInt(fullCycleMin) > 0 ? 1 : 0)
		+ (sortBy !== 'deals' ? 1 : 0)
	);
	const totalDeals = $derived(filtered.reduce((sum, company) => sum + company.dealCount, 0));

	function resetFilters() {
		nameSearch = '';
		assetFilter = '';
		maxInvest = '';
		fullCycleMin = '0';
		sortBy = 'deals';
		showMobileFilters = false;
	}

	function toggleMobileFilters() {
		showMobileFilters = !showMobileFilters;
	}

	function getInitials(name) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

	function fmtMin(v) { return v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'K' : '$' + v.toLocaleString(); }

	function getOperatorHref(company) {
		if (company.id) return '/sponsor?id=' + encodeURIComponent(company.id);
		return '/sponsor?company=' + encodeURIComponent(company.name);
	}

	onMount(() => { fetchDeals(); });
</script>

<div class="operators-page ly-page">
	<div class="filter-shell">
		<div class="filter-shell-inner ly-frame">
			<div class="filter-bar desktop-filter-bar">
				<input type="text" bind:value={nameSearch} placeholder="Search operators..." class="filter-input">
				<select bind:value={assetFilter} class="filter-select">
					<option value="">All Asset Classes</option>
					{#each allAssetClasses as ac}<option value={ac}>{ac}</option>{/each}
				</select>
				<select bind:value={maxInvest} class="filter-select">
					<option value="">Max Investment Min.</option>
					<option value="25000">$25K or less</option>
					<option value="50000">$50K or less</option>
					<option value="100000">$100K or less</option>
				</select>
				<select bind:value={fullCycleMin} class="filter-select">
					<option value="0">Full Cycle Deals</option>
					<option value="1">1+ full cycle</option>
					<option value="5">5+ full cycle</option>
					<option value="10">10+ full cycle</option>
				</select>
				<select bind:value={sortBy} class="filter-select">
					<option value="deals">Most Deals</option>
					<option value="fullcycle">Most Full Cycle</option>
					<option value="name">Name (A-Z)</option>
					<option value="newest">Newest First</option>
				</select>
				<button class="btn-reset" onclick={resetFilters}>Reset</button>
				<div class="stats-bar">
					<span><strong>{filtered.length}</strong> Operators</span>
					<span><strong>{allAssetClasses.length}</strong> asset classes</span>
					<span><strong>{totalDeals}</strong> total deals</span>
				</div>
			</div>

			<div class="mobile-filter-shell">
				<div class="mobile-search-row">
					<input
						type="text"
						bind:value={nameSearch}
						placeholder="Search operators..."
						class="filter-input mobile-filter-input"
					>
					<button
						type="button"
						class="mobile-toolbar-button"
						class:active={showMobileFilters || hasAdvancedFilters}
						onclick={toggleMobileFilters}
						aria-expanded={showMobileFilters}
					>
						{showMobileFilters ? 'Hide Filters' : activeFilterCount > 0 ? `Filters (${activeFilterCount})` : 'Filters'}
					</button>
				</div>

				<div class="mobile-toolbar-row">
					<div class="mobile-stats">
						<span><strong>{filtered.length}</strong> Operators</span>
						<span><strong>{totalDeals}</strong> Deals</span>
					</div>
					<button class="btn-reset mobile-reset" onclick={resetFilters} disabled={!hasAnyFilters}>Reset</button>
				</div>

				{#if showMobileFilters}
					<div class="mobile-filter-panel">
						<div class="mobile-filter-grid">
							<select bind:value={assetFilter} class="filter-select mobile-filter-select">
								<option value="">All Asset Classes</option>
								{#each allAssetClasses as ac}<option value={ac}>{ac}</option>{/each}
							</select>
							<select bind:value={maxInvest} class="filter-select mobile-filter-select">
								<option value="">Max Investment Min.</option>
								<option value="25000">$25K or less</option>
								<option value="50000">$50K or less</option>
								<option value="100000">$100K or less</option>
							</select>
							<select bind:value={fullCycleMin} class="filter-select mobile-filter-select">
								<option value="0">Full Cycle Deals</option>
								<option value="1">1+ full cycle</option>
								<option value="5">5+ full cycle</option>
								<option value="10">10+ full cycle</option>
							</select>
							<select bind:value={sortBy} class="filter-select mobile-filter-select">
								<option value="deals">Most Deals</option>
								<option value="fullcycle">Most Full Cycle</option>
								<option value="name">Name (A-Z)</option>
								<option value="newest">Newest First</option>
							</select>
						</div>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="operators-content ly-frame">
		<div class="managers-grid ly-grid">
		{#each filtered as c (c.name)}
			<a href={getOperatorHref(c)} class="manager-card" data-sveltekit-reload>
				<div class="card-header">
					<div class="avatar">{getInitials(c.name)}</div>
					<div class="card-info">
						<div class="card-name">{c.name}</div>
						<div class="card-meta">{c.ceo || ''}{c.ceo && c.type ? ' \u00B7 ' : ''}{c.type || ''}</div>
					</div>
				</div>
				<div class="card-metrics">
					<span class="metric"><strong>{c.dealCount}</strong> deal{c.dealCount !== 1 ? 's' : ''}</span>
					{#if c.activeDeals > 0}<span class="metric active"><strong>{c.activeDeals}</strong> active</span>{/if}
					{#if c.avgIRR > 0}<span class="metric">IRR <strong>{c.avgIRR.toFixed(1)}%</strong></span>{:else if c.avgPref > 0}<span class="metric">Pref <strong>{c.avgPref.toFixed(1)}%</strong></span>{/if}
					{#if c.minInvestment > 0}<span class="metric">Min <strong>{fmtMin(c.minInvestment)}</strong></span>{/if}
					{#if c.fullCycleDeals > 0}<span class="metric"><strong>{c.fullCycleDeals}</strong> Full Cycle</span>{/if}
					{#if c.foundingYear}<span class="metric">Est. <strong>{c.foundingYear}</strong></span>{/if}
				</div>
				<div class="card-badges">
					{#each [...c.assetClasses].filter(Boolean).sort().slice(0, 4) as ac}
						<span class="badge">{ac}</span>
					{/each}
					{#if [...c.assetClasses].filter(Boolean).length > 4}
						<span class="badge muted">+{[...c.assetClasses].filter(Boolean).length - 4}</span>
					{/if}
				</div>
			</a>
		{:else}
			<div class="empty-state">No management companies found.</div>
		{/each}
		</div>
	</div>
</div>

<style>
	.operators-page {
		--ly-frame-max: 1440px;
		--ly-frame-pad-desktop: clamp(32px, 3vw, 40px);
		--ly-frame-pad-tablet: 24px;
		--ly-frame-pad-mobile: 16px;
		min-width: 0;
	}

	.filter-shell {
		border-bottom: 1px solid var(--border);
		background: var(--bg-card);
	}

	.filter-shell-inner {
		--ly-frame-pad-top: 0;
		--ly-frame-pad-bottom: 0;
		min-width: 0;
	}

	.operators-content {
		--ly-frame-pad-top: 24px;
		--ly-frame-pad-bottom: 48px;
		--ly-frame-pad-top-tablet: 20px;
		--ly-frame-pad-bottom-tablet: 40px;
		--ly-frame-pad-top-mobile: 16px;
		--ly-frame-pad-bottom-mobile: 32px;
		min-width: 0;
	}

	.filter-bar {
		padding: 12px 0;
		display: flex;
		gap: 8px;
		align-items: center;
		flex-wrap: wrap;
		background: var(--bg-card);
		min-width: 0;
	}

	.desktop-filter-bar { border-bottom: none; }
	.filter-input {
		padding: 7px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 13px;
		font-family: var(--font-body);
		color: var(--text-dark);
		background: var(--bg-card);
		min-width: 180px;
		box-sizing: border-box;
	}

	.filter-select {
		padding: 7px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-size: 13px;
		font-family: var(--font-body);
		color: var(--text-dark);
		background: var(--bg-card);
		min-width: 0;
	}

	.btn-reset { padding: 7px 14px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 11px; cursor: pointer; color: var(--text-secondary); white-space: nowrap; }
	.btn-reset:disabled { cursor: default; opacity: 0.5; }
	.stats-bar { margin-left: auto; display: flex; gap: 16px; align-items: center; font-size: 12px; color: var(--text-muted); white-space: nowrap; min-width: 0; }
	.stats-bar strong { color: var(--text-dark); }
	.mobile-filter-shell { display: none; }
	.managers-grid {
		--ly-grid-desktop: 3;
		--ly-grid-tablet: 2;
		--ly-grid-mobile: 1;
		--ly-grid-gap: 12px;
	}

	.manager-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 18px; cursor: pointer; transition: all 0.15s; text-decoration: none; color: inherit; display: block; min-width: 0; height: 100%; }
	.manager-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); border-color: var(--primary); }
	.card-header { display: flex; align-items: center; gap: 12px; margin-bottom: 10px; }
	.avatar { width: 40px; height: 40px; border-radius: 10px; background: linear-gradient(135deg, #1F5159, #0A1E21); display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-ui); font-size: 14px; font-weight: 700; flex-shrink: 0; }
	.card-info { flex: 1; min-width: 0; }
	.card-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.card-meta { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.card-metrics { display: flex; gap: 6px; flex-wrap: wrap; padding: 4px 0; }
	.metric { font-family: var(--font-ui); font-size: 11px; color: var(--text-secondary); }
	.metric strong { color: var(--text-dark); }
	.metric.active strong { color: var(--green, #51BE7B); }
	.card-badges { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 8px; }
	.badge { display: inline-block; padding: 2px 8px; background: var(--bg-main); border: 1px solid var(--border); border-radius: 12px; font-size: 10px; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
	.badge.muted { color: var(--text-muted); }
	.empty-state { grid-column: 1 / -1; text-align: center; padding: 60px; color: var(--text-muted); font-size: 14px; }
	@media (min-width: 769px) and (max-width: 1024px) {
		.filter-bar { padding: 16px 0; }
		.filter-input { flex: 1 1 260px; min-width: 240px; }
		.stats-bar { flex-basis: 100%; margin-left: 0; }
	}

	@media (max-width: 768px) {
		.desktop-filter-bar { display: none; }
		.mobile-filter-shell {
			display: grid;
			gap: 12px;
			padding: 12px 0 14px;
		}
		.mobile-search-row {
			display: grid;
			grid-template-columns: minmax(0, 1fr) auto;
			gap: 8px;
			align-items: stretch;
		}
		.mobile-toolbar-button {
			height: 40px;
			padding: 0 14px;
			border: 1px solid var(--border);
			border-radius: var(--radius-sm);
			background: var(--bg-card);
			font-family: var(--font-ui);
			font-size: 12px;
			font-weight: 700;
			color: var(--text-secondary);
			display: inline-flex;
			align-items: center;
			justify-content: center;
			white-space: nowrap;
			cursor: pointer;
			transition: border-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
		}
		.mobile-toolbar-button.active {
			border-color: var(--primary);
			color: var(--text-dark);
			box-shadow: 0 0 0 1px color-mix(in srgb, var(--primary) 22%, transparent);
		}
		.mobile-filter-panel {
			padding: 12px;
			border: 1px solid var(--border);
			border-radius: var(--radius);
			background: var(--bg-card);
			box-shadow: var(--shadow-card);
		}
		.mobile-filter-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			gap: 10px;
		}
		.mobile-filter-input,
		.mobile-filter-select {
			width: 100%;
			min-width: 0;
			height: 40px;
			font-size: 16px;
		}
		.mobile-toolbar-row {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}
		.mobile-stats {
			display: flex;
			align-items: center;
			gap: 12px;
			flex-wrap: wrap;
			font-size: 12px;
			color: var(--text-muted);
			min-width: 0;
		}
		.mobile-stats strong { color: var(--text-dark); }
		.mobile-reset {
			height: 40px;
			padding-inline: 14px;
			flex-shrink: 0;
		}
		.stats-bar { display: none; }
	}

	@media (max-width: 520px) {
		.mobile-search-row,
		.mobile-toolbar-row,
		.mobile-filter-grid {
			grid-template-columns: 1fr;
		}

		.mobile-toolbar-row {
			display: grid;
		}

		.mobile-reset {
			width: 100%;
		}
	}
</style>
