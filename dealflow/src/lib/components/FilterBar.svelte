<script>
	import { selectionChanged } from '$lib/utils/haptics.js';

	let {
		search = '',
		assetClass = '',
		dealType = '',
		strategy = '',
		status = '',
		maxInvest = '',
		maxLockup = '',
		distributions = '',
		minIRR = '',
		sortBy = 'newest',
		showArchived = false,
		buyBoxApplied = false,
		totalDeals = 0,
		avgIRR = '0',
		onchange = () => {},
		onclear = () => {},
		ontoggleBuyBox = () => {},
		onadddeal = () => {},
		isAdmin = false
	} = $props();

	let filterPanelOpen = $state(false);

	const activeFilterCount = $derived(
		[assetClass, dealType, strategy, status, maxInvest, maxLockup, distributions, minIRR].filter(Boolean).length
			+ (sortBy !== 'newest' ? 1 : 0)
			+ (showArchived ? 1 : 0)
	);

	const FILTER_SELECTS = [
		{
			field: 'assetClass',
			label: 'Asset Class',
			options: [
				['', 'Asset Class'],
				['Multi-Family', 'Multi-Family'],
				['Industrial', 'Industrial'],
				['Self Storage', 'Self Storage'],
				['Hotels/Hospitality', 'Hotels / Hospitality'],
				['Lending', 'Lending'],
				['RV/Mobile Home Parks', 'RV / Mobile Home Parks'],
				['Business / Other', 'Business / Other'],
				['Mixed-Use', 'Mixed-Use'],
				['Short Term Rental', 'Short Term Rental']
			]
		},
		{
			field: 'dealType',
			label: 'Deal Type',
			options: [
				['', 'Deal Type'],
				['Fund', 'Fund'],
				['Syndication', 'Syndication']
			]
		},
		{
			field: 'strategy',
			label: 'Strategy',
			options: [
				['', 'Strategy'],
				['Lending', 'Lending'],
				['Buy & Hold', 'Buy & Hold'],
				['Value-Add', 'Value-Add'],
				['Distressed', 'Distressed'],
				['Development', 'Development']
			]
		},
		{
			field: 'status',
			label: 'Status',
			options: [
				['', 'Status'],
				['Open to invest', 'Open to invest'],
				['Evergreen', 'Evergreen']
			]
		},
		{
			field: 'maxInvest',
			label: 'Max Investment Min.',
			options: [
				['', 'Max Investment Min.'],
				['25000', '$25K or less'],
				['50000', '$50K or less'],
				['100000', '$100K or less'],
				['250000', '$250K or less']
			]
		},
		{
			field: 'maxLockup',
			label: 'Max Lockup',
			options: [
				['', 'Max Lockup'],
				['1', '1 year or less'],
				['3', '3 years or less'],
				['5', '5 years or less'],
				['7', '7 years or less'],
				['10', '10 years or less']
			]
		},
		{
			field: 'distributions',
			label: 'Distributions',
			options: [
				['', 'Distributions'],
				['Monthly', 'Monthly'],
				['Quarterly', 'Quarterly'],
				['Annual', 'Annual']
			]
		},
		{
			field: 'minIRR',
			label: 'Min Target IRR',
			options: [
				['', 'Min Target IRR'],
				['0.06', '6%+'],
				['0.08', '8%+'],
				['0.10', '10%+'],
				['0.12', '12%+'],
				['0.15', '15%+'],
				['0.20', '20%+']
			]
		},
		{
			field: 'sortBy',
			label: 'Sort By',
			options: [
				['newest', 'Sort: Newest'],
				['best_match', 'Sort: Best Match'],
				['irr', 'Sort: Highest IRR'],
				['min_invest', 'Sort: Lowest Min Investment'],
				['az', 'Sort: A-Z Name']
			]
		}
	];

	function emit(field, value, withHaptic = false) {
		if (withHaptic) selectionChanged();
		onchange({ field, value });
	}

	function clearAll() {
		selectionChanged();
		filterPanelOpen = true;
		onclear();
	}

	function valueFor(field) {
		switch (field) {
			case 'assetClass':
				return assetClass;
			case 'dealType':
				return dealType;
			case 'strategy':
				return strategy;
			case 'status':
				return status;
			case 'maxInvest':
				return maxInvest;
			case 'maxLockup':
				return maxLockup;
			case 'distributions':
				return distributions;
			case 'minIRR':
				return minIRR;
			case 'sortBy':
				return sortBy;
			default:
				return '';
		}
	}
</script>

<div class="filter-shell">
	<div class="filter-bar ly-desktop-only">
		<div class="filter-bar-actions">
			<button
				class="buybox-toggle"
				class:active={buyBoxApplied}
				onclick={() => {
					selectionChanged();
					ontoggleBuyBox();
				}}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg>
				Apply My Plan
			</button>

			<a class="buybox-update-btn" href="/app/plan?edit=1">
				Update Plan
			</a>

			<button
				class="filters-toggle"
				class:active={filterPanelOpen}
				aria-expanded={filterPanelOpen}
				onclick={() => {
					selectionChanged();
					filterPanelOpen = !filterPanelOpen;
				}}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
				Filters
				{#if activeFilterCount > 0}
					<span class="filter-count-badge">{activeFilterCount}</span>
				{/if}
			</button>
		</div>

		<div class="search-wrap">
			<input
				type="text"
				class="filter-input"
				placeholder="Search deals, operators, people..."
				value={search}
				oninput={(event) => emit('search', event.currentTarget.value)}
				autocomplete="off"
			>
		</div>

		<div class="filter-bar-meta">
			<div class="filter-bar-stats">
				<span><strong>{totalDeals}</strong> deals</span>
				<span class="fbs-dot">&middot;</span>
				<span><strong>{avgIRR}%</strong> avg IRR</span>
			</div>

			{#if isAdmin}
				<button class="add-deal-btn" onclick={onadddeal}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
					Add Deal
				</button>
			{/if}
		</div>
	</div>

	<div class="mobile-filter-shell ly-mobile-only">
		<div class="mobile-search-row">
			<div class="search-wrap mobile-search-wrap">
				<input
					type="text"
					class="filter-input mobile-filter-input"
					placeholder="Search deals, operators, people..."
					value={search}
					oninput={(event) => emit('search', event.currentTarget.value)}
					autocomplete="off"
				>
			</div>
		</div>

		<button
			class="filters-toggle mobile-full-button"
			class:active={filterPanelOpen || activeFilterCount > 0}
			aria-expanded={filterPanelOpen}
			onclick={() => {
				selectionChanged();
				filterPanelOpen = !filterPanelOpen;
			}}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
			{#if activeFilterCount > 0}
				Filters ({activeFilterCount})
			{:else}
				Filters
			{/if}
		</button>

		{#if isAdmin}
			<div class="mobile-primary-row">
				<button
					class="buybox-toggle mobile-primary-button"
					class:active={buyBoxApplied}
					onclick={() => {
						selectionChanged();
						ontoggleBuyBox();
					}}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg>
					Apply My Plan
				</button>

				<button class="add-deal-btn mobile-primary-button" onclick={onadddeal}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
					Add Deal
				</button>
			</div>
		{:else}
			<button
				class="buybox-toggle mobile-full-button"
				class:active={buyBoxApplied}
				onclick={() => {
					selectionChanged();
					ontoggleBuyBox();
				}}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg>
				Apply My Plan
			</button>
		{/if}

		<a class="buybox-update-btn mobile-full-button mobile-update-btn" href="/app/plan?edit=1">
			Update Plan
		</a>

		<div class="mobile-stats">
			<span><strong>{totalDeals}</strong> deals</span>
			<span class="fbs-dot">&middot;</span>
			<span><strong>{avgIRR}%</strong> avg IRR</span>
		</div>
	</div>

	{#if filterPanelOpen}
		<div class="filter-panel">
			<div class="filter-panel-grid">
				{#each FILTER_SELECTS as filterDef}
					<div class="filter-field">
						<label for={`filter-${filterDef.field}`}>{filterDef.label}</label>
						<select
							id={`filter-${filterDef.field}`}
							value={valueFor(filterDef.field)}
							onchange={(event) => emit(filterDef.field, event.currentTarget.value, true)}
						>
							{#each filterDef.options as [value, label]}
								<option value={value}>{label}</option>
							{/each}
						</select>
					</div>
				{/each}

				<label class="archived-toggle">
					<input
						type="checkbox"
						checked={showArchived}
						onchange={(event) => emit('showArchived', event.currentTarget.checked, true)}
					>
					Show archived
				</label>

				<div class="clear-wrap">
					<button class="clear-btn" onclick={clearAll}>Clear All Filters</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.filter-shell {
		--toolbar-control-height: 40px;
		display: grid;
		gap: 0;
		margin: 0;
		background: transparent;
	}

	.filter-bar {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 0;
		min-width: 0;
		flex-wrap: nowrap;
	}

	.filter-bar-actions,
	.filter-bar-meta {
		display: flex;
		align-items: center;
		gap: 8px;
		min-width: 0;
		flex: 0 0 auto;
	}

	.filter-bar-meta {
		margin-left: auto;
	}

	.buybox-toggle,
	.buybox-update-btn,
	.filters-toggle,
	.add-deal-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		height: var(--toolbar-control-height);
		padding: 0 14px;
		box-sizing: border-box;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		white-space: nowrap;
		text-decoration: none;
		transition: all 0.15s ease;
		cursor: pointer;
	}

	.buybox-toggle {
		border: 1px solid rgba(81, 190, 123, 0.35);
		border-radius: 999px;
		background: var(--bg-card);
		color: var(--text-dark);
	}

	.buybox-toggle:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.buybox-toggle.active {
		background: var(--primary);
		border-color: var(--primary);
		color: #fff;
	}

	.buybox-update-btn {
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--text-secondary);
	}

	.buybox-update-btn:hover {
		border-color: var(--text-muted);
		color: var(--text-dark);
		background: rgba(15, 23, 42, 0.03);
	}

	.filters-toggle {
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-card);
		color: var(--text-secondary);
	}

	.filters-toggle:hover,
	.filters-toggle.active {
		border-color: var(--primary);
		color: var(--primary);
	}

	.filter-count-badge {
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
		color: var(--primary);
	}

	.search-wrap {
		position: relative;
		flex: 1 1 280px;
		min-width: 220px;
	}

	.filter-input {
		width: 100%;
		height: var(--toolbar-control-height);
		padding: 0 38px 0 14px;
		box-sizing: border-box;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-card);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 12px;
		outline: none;
		transition: border-color 0.15s ease, box-shadow 0.15s ease;
		background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='11' cy='11' r='7' stroke='%23999' stroke-width='2'/%3E%3Cpath d='M16 16L20 20' stroke='%23999' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
	}

	.filter-input:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.filter-bar-stats,
	.mobile-stats {
		display: flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.filter-bar-stats :global(strong),
	.mobile-stats :global(strong) {
		color: var(--text-dark);
		font-weight: 700;
	}

	.fbs-dot {
		color: var(--border);
	}

	.add-deal-btn {
		border: 1px solid transparent;
		border-radius: 10px;
		background: var(--primary);
		color: #fff;
	}

	.add-deal-btn:hover {
		background: #3ca96b;
	}

	.mobile-filter-shell {
		display: none;
	}

	.mobile-search-row {
		display: block;
	}

	.mobile-full-button,
	.mobile-update-btn {
		width: 100%;
	}

	.mobile-primary-row {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 8px;
	}

	.mobile-primary-button {
		width: 100%;
		min-width: 0;
	}

	.mobile-stats {
		font-size: 11px;
		line-height: 1.4;
		white-space: normal;
	}

	.filter-panel {
		margin: 0;
		padding: 8px 0 0;
		border-top: 1px solid var(--border-light);
		background: transparent;
	}

	.filter-panel-grid {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 12px;
	}

	.filter-field {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.filter-field label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.filter-field select {
		min-width: 140px;
		height: 40px;
		padding: 0 36px 0 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-card);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 12px;
		appearance: none;
		-webkit-appearance: none;
		cursor: pointer;
		background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
	}

	.archived-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		height: 40px;
		padding: 0 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: var(--bg-card);
		color: var(--text-secondary);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}

	.archived-toggle input {
		width: 14px;
		height: 14px;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.clear-wrap {
		margin-left: auto;
	}

	.clear-btn {
		height: 40px;
		padding: 0 14px;
		border: 1px solid var(--border);
		border-radius: 10px;
		background: transparent;
		color: var(--text-secondary);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.clear-btn:hover {
		border-color: var(--red, #e74c3c);
		color: var(--red, #e74c3c);
	}

	@media (max-width: 1080px) {
		.filter-bar {
			flex-wrap: wrap;
			row-gap: 8px;
		}

		.search-wrap {
			order: 2;
			flex-basis: 100%;
			min-width: 0;
		}

		.filter-bar-meta {
			order: 3;
			width: 100%;
			justify-content: flex-end;
			margin-left: 0;
		}
	}

	@media (max-width: 768px) {
		.filter-bar {
			display: none;
		}

		.mobile-filter-shell {
			display: grid;
			gap: 8px;
			padding: 0;
		}

		.mobile-search-wrap {
			min-width: 0;
		}

		.mobile-filter-input {
			height: 42px;
			font-size: 16px;
		}

		.mobile-full-button,
		.mobile-primary-button {
			min-height: 42px;
		}

		.filter-panel {
			padding-top: 8px;
		}

		.filter-panel-grid {
			display: grid;
			grid-template-columns: repeat(2, minmax(0, 1fr));
			align-items: start;
			gap: 12px;
		}

		.filter-field select {
			width: 100%;
			min-width: 0;
		}

		.archived-toggle,
		.clear-wrap,
		.clear-btn {
			width: 100%;
		}

		.clear-wrap {
			margin-left: 0;
			grid-column: 1 / -1;
		}
	}

	@media (max-width: 520px) {
		.mobile-primary-row,
		.filter-panel-grid {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
