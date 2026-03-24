<script>
	let { deals = [], onopen = () => {} } = $props();

	let sortCol = $state('');
	let sortAsc = $state(true);

	const TABLE_COLS = [
		{ key: 'investmentName', label: 'Investment Name', numeric: false },
		{ key: 'managementCompany', label: 'GP / Sponsor', numeric: false },
		{ key: 'assetClass', label: 'Asset Class', numeric: false },
		{ key: 'dealType', label: 'Deal Type', numeric: false },
		{ key: 'targetIRR', label: 'Target IRR', numeric: true },
		{ key: 'investmentMinimum', label: 'Min Invest', numeric: true },
		{ key: 'equityMultiple', label: 'Eq. Multiple', numeric: true },
		{ key: 'preferredReturn', label: 'Pref Return', numeric: true },
		{ key: 'holdPeriod', label: 'Hold', numeric: true },
		{ key: 'status', label: 'Status', numeric: false }
	];

	function fmtPct(val) {
		if (!val) return '---';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '---';
		return (n > 1 ? n : n * 100).toFixed(1) + '%';
	}

	function fmtMoney(val) {
		if (!val) return '---';
		const n = typeof val === 'string' ? parseFloat(String(val).replace(/[$,]/g, '')) : val;
		if (isNaN(n)) return '---';
		if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}

	function fmtMultiple(val) {
		if (!val) return '---';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '---';
		return n.toFixed(2) + 'x';
	}

	function formatHold(val) {
		if (!val) return '---';
		if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open';
		return val + ' yr';
	}

	function getCellValue(deal, key) {
		switch (key) {
			case 'targetIRR': return fmtPct(deal.targetIRR);
			case 'investmentMinimum': return fmtMoney(deal.investmentMinimum);
			case 'equityMultiple': return fmtMultiple(deal.equityMultiple);
			case 'preferredReturn': return fmtPct(deal.preferredReturn);
			case 'holdPeriod': return formatHold(deal.holdPeriod);
			default: return deal[key] || '---';
		}
	}

	const sortedDeals = $derived(() => {
		if (!sortCol) return deals;
		const col = TABLE_COLS.find(c => c.key === sortCol);
		return [...deals].sort((a, b) => {
			let va = a[sortCol];
			let vb = b[sortCol];
			if (va == null) va = col?.numeric ? -Infinity : '';
			if (vb == null) vb = col?.numeric ? -Infinity : '';
			if (typeof va === 'number' && typeof vb === 'number') {
				return sortAsc ? va - vb : vb - va;
			}
			return sortAsc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
		});
	});

	function toggleSort(key) {
		if (sortCol === key) {
			sortAsc = !sortAsc;
		} else {
			sortCol = key;
			sortAsc = true;
		}
	}
</script>

<div class="table-wrap">
	<table class="deal-table">
		<thead>
			<tr>
				{#each TABLE_COLS as col}
					<th
						class:sorted={sortCol === col.key}
						onclick={() => toggleSort(col.key)}
					>
						{col.label}
						<span class="sort-arrow">
							{#if sortCol === col.key}
								{sortAsc ? '\u25B2' : '\u25BC'}
							{:else}
								\u25B2
							{/if}
						</span>
					</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			{#if sortedDeals().length === 0}
				<tr>
					<td colspan={TABLE_COLS.length} class="empty-row">No deals match your filters.</td>
				</tr>
			{:else}
				{#each sortedDeals() as deal (deal.id)}
					<tr onclick={() => onopen(deal.id)}>
						{#each TABLE_COLS as col, i}
							<td
								class:name-cell={i === 0}
								class:irr-cell={col.key === 'targetIRR' && deal.targetIRR}
							>
								{getCellValue(deal, col.key)}
							</td>
						{/each}
					</tr>
				{/each}
			{/if}
		</tbody>
	</table>
</div>

<style>
	.table-wrap {
		overflow-x: auto;
		border-radius: var(--radius, 8px);
		box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.1));
	}

	.deal-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-ui);
		font-size: 13px;
	}

	thead th {
		text-align: left;
		padding: 10px 12px;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		border-bottom: 2px solid var(--border);
		cursor: pointer;
		white-space: nowrap;
		user-select: none;
		background: var(--bg-card);
	}
	thead th:hover { color: var(--text-dark); }
	thead th.sorted { color: var(--primary); }

	.sort-arrow {
		font-size: 8px;
		margin-left: 2px;
		opacity: 0.5;
	}
	thead th.sorted .sort-arrow { opacity: 1; }

	tbody tr {
		cursor: pointer;
		transition: background 0.1s;
	}
	tbody tr:hover { background: var(--bg-hover, rgba(0,0,0,0.02)); }

	tbody td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--border-light);
		color: var(--text-dark);
		white-space: nowrap;
	}

	.name-cell {
		font-weight: 700;
		color: var(--text-dark);
		max-width: 240px;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.irr-cell {
		font-weight: 700;
		color: var(--primary);
	}

	.empty-row {
		text-align: center;
		padding: 60px 20px;
		color: var(--text-muted);
		font-size: 15px;
	}
</style>
