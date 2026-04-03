<script>
	import { selectionChanged } from '$lib/utils/haptics.js';
	import { normalizeAssetClassValue } from '$lib/utils/dealReviewSchema.js';

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
		showAddDeal = false,
		onchange = () => {},
		onclear = () => {},
		ontoggleBuyBox = () => {},
		onadddeal = () => {}
	} = $props();

	let filterPanelOpen = $state(false);

	const SORT_OPTIONS = [
		['newest', 'Sort: Newest'],
		['best_match', 'Sort: Best Match'],
		['irr', 'Sort: Highest IRR'],
		['min_invest', 'Sort: Lowest Min Investment'],
		['az', 'Sort: A-Z Name']
	];

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
				['Private Debt / Credit', 'Private Debt / Credit'],
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
		}
	];

	const activeFilterCount = $derived(
		[assetClass, dealType, strategy, status, maxInvest, maxLockup, distributions, minIRR].filter(Boolean).length
			+ (showArchived ? 1 : 0)
	);

	function emit(field, value, withHaptic = false) {
		if (withHaptic) selectionChanged();
		onchange({ field, value });
	}

	function toggleFilterPanel() {
		selectionChanged();
		filterPanelOpen = !filterPanelOpen;
	}

	function closeFilterPanel() {
		filterPanelOpen = false;
	}

	function clearAll() {
		selectionChanged();
		onclear();
	}

	function handleOverlayClick(event) {
		if (event.target === event.currentTarget) {
			closeFilterPanel();
		}
	}

	function handleWindowKeydown(event) {
		if (event.key === 'Escape' && filterPanelOpen) {
			closeFilterPanel();
		}
	}

	function valueFor(field) {
		switch (field) {
			case 'assetClass':
				return normalizeAssetClassValue(assetClass);
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
			default:
				return '';
		}
	}

	$effect(() => {
		if (typeof window === 'undefined' || typeof document === 'undefined' || !filterPanelOpen || window.innerWidth > 768) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
		};
	});
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<div class="filter-shell">
	<div class="filter-toolbar ly-desktop-only">
		<div class="search-wrap toolbar-search">
			<input
				type="text"
				class="filter-input"
				placeholder="Search deals, operators, people..."
				value={search}
				oninput={(event) => emit('search', event.currentTarget.value)}
				autocomplete="off"
			>
		</div>

		<label class="sr-only" for="deal-flow-sort">Sort Deals</label>
		<select
			id="deal-flow-sort"
			class="toolbar-select"
			value={sortBy}
			onchange={(event) => emit('sortBy', event.currentTarget.value, true)}
		>
			{#each SORT_OPTIONS as [value, label]}
				<option value={value}>{label}</option>
			{/each}
		</select>

		<button
			class="buybox-toggle"
			class:active={buyBoxApplied}
			onclick={() => {
				selectionChanged();
				ontoggleBuyBox();
			}}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
				<rect x="3" y="3" width="18" height="18" rx="3"></rect>
				<path d="M9 12l2 2 4-4"></path>
			</svg>
			Apply My Plan
		</button>

		<button
			class="filters-toggle"
			class:active={filterPanelOpen || activeFilterCount > 0}
			aria-expanded={filterPanelOpen}
			onclick={toggleFilterPanel}
		>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
				<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
			</svg>
			Filters
			{#if activeFilterCount > 0}
				<span class="filter-count-badge">{activeFilterCount}</span>
			{/if}
		</button>

		{#if showAddDeal}
			<button class="add-deal-btn desktop-add-deal" onclick={onadddeal}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="13" height="13">
					<line x1="12" y1="5" x2="12" y2="19"></line>
					<line x1="5" y1="12" x2="19" y2="12"></line>
				</svg>
				Add Deal
			</button>
		{/if}
	</div>

	<div class="mobile-toolbar ly-mobile-only">
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

			<button
				class="mobile-filter-button"
				class:active={filterPanelOpen || activeFilterCount > 0}
				aria-expanded={filterPanelOpen}
				aria-label="Open filters"
				onclick={toggleFilterPanel}
			>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
					<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
				</svg>
				{#if activeFilterCount > 0}
					<span class="mobile-filter-badge">{activeFilterCount}</span>
				{/if}
			</button>

			{#if showAddDeal}
				<button class="mobile-add-deal-btn" onclick={onadddeal}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
						<line x1="12" y1="5" x2="12" y2="19"></line>
						<line x1="5" y1="12" x2="19" y2="12"></line>
					</svg>
				</button>
			{/if}
		</div>
	</div>

	{#if filterPanelOpen}
		<div class="filter-panel ly-desktop-only">
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

		<div class="mobile-filter-modal ly-mobile-only" onclick={handleOverlayClick}>
			<div class="mobile-filter-sheet">
				<div class="mobile-filter-header">
					<div class="mobile-filter-title">Filters</div>
					<button class="mobile-close-btn" aria-label="Close filters" onclick={closeFilterPanel}>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
							<line x1="18" y1="6" x2="6" y2="18"></line>
							<line x1="6" y1="6" x2="18" y2="18"></line>
						</svg>
					</button>
				</div>

				<div class="mobile-filter-body">
					<button
						class="buybox-toggle mobile-plan-toggle"
						class:active={buyBoxApplied}
						onclick={() => {
							selectionChanged();
							ontoggleBuyBox();
						}}
					>
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14">
							<rect x="3" y="3" width="18" height="18" rx="3"></rect>
							<path d="M9 12l2 2 4-4"></path>
						</svg>
						Apply My Plan
					</button>

					<div class="filter-field mobile-sort-field">
						<label for="deal-flow-mobile-sort">Sort By</label>
						<select
							id="deal-flow-mobile-sort"
							value={sortBy}
							onchange={(event) => emit('sortBy', event.currentTarget.value, true)}
						>
							{#each SORT_OPTIONS as [value, label]}
								<option value={value}>{label}</option>
							{/each}
						</select>
					</div>

					<div class="mobile-filter-grid">
						{#each FILTER_SELECTS as filterDef}
							<div class="filter-field">
								<label for={`mobile-filter-${filterDef.field}`}>{filterDef.label}</label>
								<select
									id={`mobile-filter-${filterDef.field}`}
									value={valueFor(filterDef.field)}
									onchange={(event) => emit(filterDef.field, event.currentTarget.value, true)}
								>
									{#each filterDef.options as [value, label]}
										<option value={value}>{label}</option>
									{/each}
								</select>
							</div>
						{/each}
					</div>

					<label class="archived-toggle mobile-archived-toggle">
						<input
							type="checkbox"
							checked={showArchived}
							onchange={(event) => emit('showArchived', event.currentTarget.checked, true)}
						>
						Show archived
					</label>

					<div class="mobile-filter-actions">
						<button class="clear-btn mobile-clear-btn" onclick={clearAll}>Clear All Filters</button>
						<button class="done-btn" onclick={closeFilterPanel}>Done</button>
					</div>
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
		min-width: 0;
	}

	.filter-toolbar {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto auto auto auto;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.search-wrap {
		position: relative;
		min-width: 0;
	}

	.toolbar-search {
		min-width: 0;
	}

	.filter-input,
	.toolbar-select,
	.filter-field select {
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
		appearance: none;
		-webkit-appearance: none;
	}

	.filter-input {
		background-image: url("data:image/svg+xml,%3Csvg width='16' height='16' viewBox='0 0 24 24' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='11' cy='11' r='7' stroke='%23999' stroke-width='2'/%3E%3Cpath d='M16 16L20 20' stroke='%23999' stroke-width='2' stroke-linecap='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
	}

	.toolbar-select,
	.filter-field select {
		min-width: 156px;
		background-image: url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23999' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 12px center;
		cursor: pointer;
	}

	.filter-input:focus,
	.toolbar-select:focus,
	.filter-field select:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.buybox-toggle,
	.filters-toggle,
	.add-deal-btn,
	.mobile-filter-button,
	.clear-btn,
	.done-btn,
	.mobile-close-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.buybox-toggle {
		height: var(--toolbar-control-height);
		padding: 0 14px;
		border-radius: 999px;
		white-space: nowrap;
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

	.filters-toggle {
		height: var(--toolbar-control-height);
		padding: 0 14px;
		border-radius: 10px;
		white-space: nowrap;
	}

	.filters-toggle:hover,
	.filters-toggle.active {
		border-color: var(--primary);
		color: var(--primary);
	}

	.add-deal-btn {
		height: var(--toolbar-control-height);
		padding: 0 14px;
		border-radius: 10px;
		border: 1px solid transparent;
		background: var(--primary);
		color: #fff;
		white-space: nowrap;
	}

	.add-deal-btn:hover {
		background: #3ca96b;
	}

	.filter-count-badge,
	.mobile-filter-badge {
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

	.mobile-toolbar {
		display: none;
	}

	.mobile-search-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		align-items: center;
		gap: 10px;
	}

	.mobile-filter-button {
		position: relative;
		width: 42px;
		height: 42px;
		padding: 0;
		border-radius: 12px;
		flex-shrink: 0;
	}

	.mobile-add-deal-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 44px;
		height: 44px;
		border: none;
		border-radius: 14px;
		background: var(--primary);
		color: #fff;
		box-shadow: 0 14px 28px rgba(81, 190, 123, 0.24);
		flex-shrink: 0;
	}

	.mobile-filter-button:hover,
	.mobile-filter-button.active {
		border-color: var(--primary);
		color: var(--primary);
	}

	.mobile-filter-badge {
		position: absolute;
		top: -4px;
		right: -4px;
		min-width: 20px;
		height: 20px;
	}

	.filter-panel {
		margin-top: 18px;
		padding: 18px;
		border: 1px solid var(--border-light);
		border-radius: 16px;
		background: var(--bg-card);
		box-shadow: 0 10px 30px rgba(15, 23, 42, 0.05);
	}

	.filter-panel-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 14px;
		align-items: end;
	}

	.filter-field {
		display: grid;
		gap: 6px;
		min-width: 0;
	}

	.filter-field label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.archived-toggle {
		display: inline-flex;
		align-items: center;
		gap: 8px;
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
		display: flex;
		justify-content: flex-end;
	}

	.clear-btn {
		height: 40px;
		padding: 0 14px;
		border-radius: 10px;
	}

	.clear-btn:hover {
		border-color: var(--red, #e74c3c);
		color: var(--red, #e74c3c);
	}

	.mobile-filter-modal {
		position: fixed;
		inset: 0;
		z-index: 1200;
		background: rgba(15, 23, 42, 0.42);
		display: none;
	}

	.mobile-filter-sheet {
		width: 100%;
		height: 100%;
		background: var(--bg);
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		padding-top: env(safe-area-inset-top, 0px);
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}

	.mobile-filter-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 18px 18px 16px;
		border-bottom: 1px solid var(--border-light);
		background: var(--bg-card);
	}

	.mobile-filter-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.mobile-close-btn {
		width: 40px;
		height: 40px;
		padding: 0;
		border-radius: 12px;
	}

	.mobile-filter-body {
		overflow-y: auto;
		padding: 18px;
		display: grid;
		gap: 18px;
		align-content: start;
	}

	.mobile-plan-toggle {
		width: 100%;
		min-height: 42px;
	}

	.mobile-sort-field select,
	.mobile-filter-grid .filter-field select {
		min-width: 0;
	}

	.mobile-filter-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}

	.mobile-archived-toggle {
		height: 44px;
		justify-content: flex-start;
	}

	.mobile-filter-actions {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
		gap: 10px;
	}

	.mobile-clear-btn,
	.done-btn {
		width: 100%;
		height: 44px;
	}

	.done-btn {
		border-color: var(--primary);
		background: var(--primary);
		color: #fff;
	}

	.done-btn:hover {
		background: #3ca96b;
		border-color: #3ca96b;
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

	@media (max-width: 1080px) {
		.filter-toolbar {
			grid-template-columns: minmax(0, 1fr) minmax(170px, auto) auto auto auto;
			gap: 10px;
		}

		.filter-panel-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 1023px) {
		.desktop-add-deal {
			display: none;
		}

		.filter-toolbar {
			grid-template-columns: minmax(0, 1fr) minmax(170px, auto) auto auto;
		}
	}

	@media (max-width: 900px) {
		.filter-panel-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 768px) {
		.filter-toolbar {
			display: none;
		}

		.mobile-toolbar {
			display: block;
		}

		.mobile-filter-modal.ly-mobile-only {
			display: block !important;
		}
	}

	@media (max-width: 520px) {
		.mobile-filter-grid,
		.mobile-filter-actions {
			grid-template-columns: minmax(0, 1fr);
		}
	}
</style>
