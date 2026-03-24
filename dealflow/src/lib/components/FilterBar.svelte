<script>
	let {
		search = '',
		assetClass = '',
		dealType = '',
		strategy = '',
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
		[assetClass, dealType, strategy, maxInvest, maxLockup, distributions, minIRR].filter(Boolean).length
		+ (sortBy !== 'newest' ? 1 : 0)
		+ (showArchived ? 1 : 0)
	);

	function emit(field, value) {
		onchange({ field, value });
	}

	function clearAll() {
		filterPanelOpen = false;
		onclear();
	}
</script>

<div class="filter-bar">
	<button
		class="buybox-toggle"
		class:active={buyBoxApplied}
		onclick={ontoggleBuyBox}
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 12l2 2 4-4"/></svg>
		Apply My Plan
	</button>

	<button
		class="filters-toggle"
		class:active={filterPanelOpen}
		onclick={() => filterPanelOpen = !filterPanelOpen}
	>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>
		Filters
		{#if activeFilterCount > 0}
			<span class="filter-count-badge">{activeFilterCount}</span>
		{/if}
	</button>

	<div class="search-wrap">
		<input
			type="text"
			class="filter-input"
			placeholder="Search deals, operators, people..."
			value={search}
			oninput={(e) => emit('search', e.target.value)}
			autocomplete="off"
		>
	</div>

	<div class="filter-bar-stats">
		<span class="fbs-item"><strong>{totalDeals}</strong> deals</span>
		<span class="fbs-dot">&middot;</span>
		<span class="fbs-item"><strong>{avgIRR}%</strong> avg IRR</span>
	</div>

	{#if isAdmin}
		<button class="add-deal-btn" onclick={onadddeal}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
			Add Deal
		</button>
	{/if}
</div>

{#if filterPanelOpen}
	<div class="filter-panel">
		<div class="filter-panel-grid">
			<div class="filter-field">
				<label>Asset Class</label>
				<select value={assetClass} onchange={(e) => emit('assetClass', e.target.value)}>
					<option value="">All</option>
					<option value="Multi-Family">Multi-Family</option>
					<option value="Industrial">Industrial</option>
					<option value="Self Storage">Self Storage</option>
					<option value="Hotels/Hospitality">Hotels / Hospitality</option>
					<option value="Lending">Lending</option>
					<option value="RV/Mobile Home Parks">RV / Mobile Home Parks</option>
					<option value="Business / Other">Business / Other</option>
					<option value="Mixed-Use">Mixed-Use</option>
					<option value="Short Term Rental">Short Term Rental</option>
				</select>
			</div>

			<div class="filter-field">
				<label>Deal Type</label>
				<select value={dealType} onchange={(e) => emit('dealType', e.target.value)}>
					<option value="">All</option>
					<option value="Fund">Fund</option>
					<option value="Syndication">Syndication</option>
				</select>
			</div>

			<div class="filter-field">
				<label>Strategy</label>
				<select value={strategy} onchange={(e) => emit('strategy', e.target.value)}>
					<option value="">All</option>
					<option value="Lending">Lending</option>
					<option value="Buy & Hold">Buy & Hold</option>
					<option value="Value-Add">Value-Add</option>
					<option value="Distressed">Distressed</option>
					<option value="Development">Development</option>
				</select>
			</div>

			<div class="filter-field">
				<label>Max Investment Min.</label>
				<select value={maxInvest} onchange={(e) => emit('maxInvest', e.target.value)}>
					<option value="">Any</option>
					<option value="25000">$25K or less</option>
					<option value="50000">$50K or less</option>
					<option value="100000">$100K or less</option>
					<option value="250000">$250K or less</option>
				</select>
			</div>

			<div class="filter-field">
				<label>Max Lockup</label>
				<select value={maxLockup} onchange={(e) => emit('maxLockup', e.target.value)}>
					<option value="">Any</option>
					<option value="1">1 year or less</option>
					<option value="3">3 years or less</option>
					<option value="5">5 years or less</option>
					<option value="7">7 years or less</option>
					<option value="10">10 years or less</option>
				</select>
			</div>

			<div class="filter-field">
				<label>Distributions</label>
				<select value={distributions} onchange={(e) => emit('distributions', e.target.value)}>
					<option value="">Any</option>
					<option value="Monthly">Monthly</option>
					<option value="Quarterly">Quarterly</option>
					<option value="Annual">Annual</option>
				</select>
			</div>

			<div class="filter-field">
				<label>Min Target IRR</label>
				<select value={minIRR} onchange={(e) => emit('minIRR', e.target.value)}>
					<option value="">Any</option>
					<option value="0.06">6%+</option>
					<option value="0.08">8%+</option>
					<option value="0.10">10%+</option>
					<option value="0.12">12%+</option>
					<option value="0.15">15%+</option>
					<option value="0.20">20%+</option>
				</select>
			</div>

			<div class="filter-field">
				<label>Sort By</label>
				<select value={sortBy} onchange={(e) => emit('sortBy', e.target.value)}>
					<option value="newest">Newest</option>
					<option value="irr">Highest IRR</option>
					<option value="min_invest">Lowest Min Investment</option>
					<option value="az">A-Z Name</option>
				</select>
			</div>

			<label class="archived-toggle">
				<input
					type="checkbox"
					checked={showArchived}
					onchange={(e) => emit('showArchived', e.target.checked)}
				>
				Show archived
			</label>

			<div class="clear-wrap">
				<button class="clear-btn" onclick={clearAll}>Clear All Filters</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.filter-bar {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 0;
		flex-wrap: wrap;
		border-bottom: 1px solid var(--border-light);
		background: transparent;
	}

	.buybox-toggle {
		padding: 7px 14px;
		background: var(--bg-card);
		border: 2px solid var(--border);
		border-radius: 20px;
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 12px;
		cursor: pointer;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		color: var(--text-secondary);
		transition: all var(--transition, 0.15s);
	}
	.buybox-toggle:hover { border-color: var(--green, var(--primary)); color: var(--green, var(--primary)); }
	.buybox-toggle.active {
		background: var(--green, var(--primary));
		color: #fff;
		border-color: var(--green, var(--primary));
	}

	.filters-toggle {
		padding: 8px 14px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 500;
		font-size: 12px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		white-space: nowrap;
		color: var(--text-dark);
		transition: all 0.15s;
	}
	.filters-toggle.active {
		background: var(--bg-card);
		border-color: var(--primary);
		color: var(--primary);
	}

	.filter-count-badge {
		background: var(--primary);
		color: #fff;
		border-radius: 10px;
		padding: 0 6px;
		font-size: 10px;
		min-width: 16px;
		text-align: center;
	}

	.search-wrap {
		position: relative;
		flex: 1 1 320px;
		min-width: 240px;
		max-width: none;
	}

	.filter-input {
		width: 100%;
		box-sizing: border-box;
		padding: 8px 36px 8px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-size: 12px;
		background: var(--bg-card);
		color: var(--text-dark);
		outline: none;
		transition: border-color 0.15s;
		background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='11' cy='11' r='7' stroke='%23999' stroke-width='2'/%3E%3Cpath d='M16 16L20 20' stroke='%23999' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
	}
	.filter-input:focus { border-color: var(--primary); }

	.filter-bar-stats {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-left: auto;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.filter-bar-stats :global(strong) {
		color: var(--text-dark);
		font-weight: 700;
	}
	.fbs-dot { color: var(--border); }

	.add-deal-btn {
		padding: 6px 14px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 11px;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 5px;
		white-space: nowrap;
		margin-left: 2px;
	}

	.filter-panel {
		background: transparent;
		border: none;
		padding: 10px 0 0;
		margin: 0;
	}

	.filter-panel-grid {
		display: flex;
		gap: 12px;
		align-items: flex-end;
		flex-wrap: wrap;
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
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.filter-field select {
		min-width: 140px;
		padding: 8px 32px 8px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-size: 12px;
		background: var(--bg-card);
		color: var(--text-dark);
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
	}

	.archived-toggle {
		display: flex;
		align-items: center;
		gap: 6px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		white-space: nowrap;
		padding: 7px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
	}
	.archived-toggle input {
		cursor: pointer;
		accent-color: var(--primary);
		width: 14px;
		height: 14px;
	}

	.clear-wrap { margin-left: auto; }
	.clear-btn {
		padding: 8px 14px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 12px;
		cursor: pointer;
		color: var(--text-secondary);
		white-space: nowrap;
		transition: all 0.15s;
	}
	.clear-btn:hover {
		border-color: var(--red, #e74c3c);
		color: var(--red, #e74c3c);
	}

	@media (max-width: 980px) {
		.filter-bar-stats {
			order: 10;
			flex-basis: 100%;
			margin-left: 0;
			padding-top: 8px;
			border-top: 1px solid var(--border-light);
		}
	}

	@media (max-width: 768px) {
		.filter-bar { display: none; }
		.filter-panel { display: none; }
	}
</style>
