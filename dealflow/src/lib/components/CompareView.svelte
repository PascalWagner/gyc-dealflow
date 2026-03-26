<script>
	import { dealStages, STAGE_META, normalizeStage, stageLabel } from '$lib/stores/deals.js';

	let {
		deals = [],
		maxDeals = 3,
		loading = false,
		planFitById = {},
		onremove = () => {}
	} = $props();

	const visibleDeals = $derived(deals.slice(0, maxDeals));
	const comparisonSlots = $derived([
		...visibleDeals,
		...Array.from({ length: Math.max(0, maxDeals - visibleDeals.length) }, () => null)
	]);

	const COMPARISON_ROWS = [
		{ label: 'Asset Class', get: (deal) => deal.assetClass || '—' },
		{ label: 'Plan Fit', higher: true, get: (deal) => formatPlanFit(deal), getNumber: (deal) => getPlanFitScore(deal) },
		{ label: 'Target IRR', key: 'targetIRR', format: 'pct', higher: true },
		{ label: 'Preferred Return', key: 'preferredReturn', format: 'pct', higher: true },
		{ label: 'Cash-on-Cash', key: 'cashOnCash', format: 'pct', higher: true },
		{ label: 'Equity Multiple', key: 'equityMultiple', format: 'multiple', higher: true },
		{ label: 'Minimum', key: 'investmentMinimum', format: 'money', higher: false },
		{ label: 'Hold Period', key: 'holdPeriod', format: 'hold', higher: false },
		{ label: 'Leverage', key: 'avgLoanLTV', format: 'pct', higher: false },
		{ label: 'Distributions', get: (deal) => deal.distributions || deal.distributionFrequency || '—' },
		{ label: 'Strategy', key: 'strategy' },
		{ label: 'Geography', key: 'investingGeography' }
	];

	function fmtPct(val) {
		if (val == null || val === '') return '—';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (Number.isNaN(n)) return '—';
		return `${(n > 1 ? n : n * 100).toFixed(1)}%`;
	}

	function fmtMoney(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(String(val).replace(/[$,]/g, '')) : val;
		if (Number.isNaN(n)) return '—';
		if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}

	function fmtMultiple(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (Number.isNaN(n)) return '—';
		return `${n.toFixed(2)}x`;
	}

	function fmtHold(val) {
		if (val == null || val === '') return '—';
		if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (Number.isNaN(n)) return val;
		if (n < 1) return `${Math.round(n * 12)} mo`;
		return `${n} ${n === 1 ? 'yr' : 'yrs'}`;
	}

	function formatPlanFit(deal) {
		const score = planFitById?.[deal.id];
		return score?.label || 'Not set';
	}

	function getPlanFitScore(deal) {
		const score = Number(planFitById?.[deal.id]?.score);
		return Number.isFinite(score) ? score : null;
	}

	function getStageMeta(dealId) {
		const stageKey = normalizeStage($dealStages[dealId]);
		return {
			key: stageKey,
			label: stageLabel(stageKey),
			color: STAGE_META[stageKey]?.color || STAGE_META.filter.color
		};
	}

	function getCellValue(deal, row) {
		if (!deal) return '—';
		if (typeof row.get === 'function') return row.get(deal);

		const rawValue = row.key ? deal[row.key] : null;
		if (row.format === 'pct') return fmtPct(rawValue);
		if (row.format === 'money') return fmtMoney(rawValue);
		if (row.format === 'multiple') return fmtMultiple(rawValue);
		if (row.format === 'hold') return fmtHold(rawValue);
		return rawValue || '—';
	}

	function getCellNumber(deal, row) {
		if (!deal) return null;
		if (typeof row.getNumber === 'function') return row.getNumber(deal);
		if (!row.key) return null;

		const rawValue = deal[row.key];
		if (rawValue == null || rawValue === '') return null;
		const numericValue = typeof rawValue === 'string' ? parseFloat(rawValue) : rawValue;
		return Number.isFinite(numericValue) ? numericValue : null;
	}

	function getBest(row) {
		if (row.higher !== true && row.higher !== false) {
			return { best: null, uniqueBest: false, values: [] };
		}

		const values = visibleDeals.map((deal) => getCellNumber(deal, row));
		const numericValues = values.filter((value) => value !== null);
		if (numericValues.length < 2) {
			return { best: null, uniqueBest: false, values };
		}

		const best = row.higher
			? Math.max(...numericValues)
			: Math.min(...numericValues);
		const uniqueBest = numericValues.filter((value) => value === best).length === 1;

		return { best, uniqueBest, values };
	}
</script>

{#if loading && visibleDeals.length === 0}
	<section class="compare-shell compare-status">
		<div class="compare-title">Preparing comparison</div>
		<div class="compare-subtitle">Loading your selected deals into the compare table.</div>
	</section>
{:else if visibleDeals.length === 0}
	<section class="compare-shell compare-status">
		<div class="compare-title">Select deals to compare</div>
		<div class="compare-subtitle">Add up to 3 deals from the cards below to see them side by side.</div>
	</section>
{:else}
	<section class="compare-shell">
		<div class="compare-header">
			<div>
				<div class="compare-title">Compare Deals</div>
				<div class="compare-subtitle">{visibleDeals.length}/{maxDeals} selected across your pipeline</div>
			</div>
		</div>

		<div class="compare-table-wrap">
			<table class="compare-table">
				<thead>
					<tr>
						<th class="sticky-label header-label">Metric</th>
						{#each comparisonSlots as deal}
							<th class="deal-header">
								{#if deal}
									<div class="deal-topline">
										<span class="deal-badge">{deal.assetClass || 'Deal'}</span>
										<button class="remove-btn" onclick={() => onremove(deal.id)} aria-label="Remove from compare">&times;</button>
									</div>
									{@const stage = getStageMeta(deal.id)}
									<span class="stage-pill" style:--stage-color={stage.color}>{stage.label}</span>
									<div class="deal-name">{deal.investmentName}</div>
									<div class="deal-manager">{deal.managementCompany || 'Unknown operator'}</div>
									<a href="/deal/{deal.id}" class="deal-link">Open deal</a>
								{:else}
									<div class="deal-placeholder-title">Select a deal</div>
									<div class="deal-placeholder-copy">Add from the cards below</div>
								{/if}
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#each COMPARISON_ROWS as row}
						{@const best = getBest(row)}
						<tr>
							<td class="sticky-label label-cell">{row.label}</td>
							{#each comparisonSlots as deal, index}
								<td class="value-cell" class:best-cell={deal && best.uniqueBest && best.values[index] === best.best}>
									{deal ? getCellValue(deal, row) : '—'}
								</td>
							{/each}
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
{/if}

<style>
	.compare-shell {
		padding: 18px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 16px;
		box-shadow: var(--shadow-card);
	}

	.compare-status {
		text-align: center;
		padding: 28px 20px;
	}

	.compare-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.compare-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--text-dark);
	}

	.compare-subtitle {
		margin-top: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.compare-table-wrap {
		margin-top: 16px;
		overflow-x: auto;
		border: 1px solid var(--border-light, var(--border));
		border-radius: 12px;
		background: var(--bg-card);
	}

	.compare-table {
		width: max-content;
		min-width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		font-family: var(--font-ui);
	}

	.compare-table th,
	.compare-table td {
		padding: 14px 16px;
		border-bottom: 1px solid var(--border-light, var(--border));
	}

	.compare-table tbody tr:last-child td {
		border-bottom: none;
	}

	.sticky-label {
		position: sticky;
		left: 0;
		z-index: 2;
		background: var(--bg-main);
		box-shadow: 1px 0 0 var(--border-light, var(--border));
	}

	.header-label,
	.label-cell {
		min-width: 160px;
		max-width: 160px;
		text-align: left;
	}

	.header-label {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.6px;
		color: var(--text-muted);
		vertical-align: bottom;
	}

	.label-cell {
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	.deal-header,
	.value-cell {
		min-width: 210px;
		max-width: 210px;
		text-align: left;
		background: var(--bg-card);
	}

	.deal-header {
		vertical-align: top;
	}

	.deal-topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	.deal-badge {
		display: inline-flex;
		align-items: center;
		padding: 4px 8px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.12);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--primary);
	}

	.remove-btn {
		border: none;
		background: none;
		padding: 0;
		font-size: 18px;
		line-height: 1;
		color: var(--text-muted);
		cursor: pointer;
	}

	.remove-btn:hover {
		color: #d04040;
	}

	.stage-pill {
		display: inline-flex;
		align-items: center;
		margin-top: 10px;
		padding: 4px 8px;
		border-radius: 999px;
		border: 1px solid color-mix(in srgb, var(--stage-color) 22%, transparent);
		background: color-mix(in srgb, var(--stage-color) 10%, white);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.45px;
		color: var(--stage-color);
	}

	.deal-name {
		margin-top: 12px;
		font-size: 14px;
		font-weight: 700;
		line-height: 1.35;
		color: var(--text-dark);
	}

	.deal-manager {
		margin-top: 4px;
		font-size: 12px;
		font-weight: 500;
		line-height: 1.45;
		color: var(--text-muted);
	}

	.deal-link {
		display: inline-flex;
		align-items: center;
		margin-top: 12px;
		font-size: 12px;
		font-weight: 700;
		color: var(--primary);
		text-decoration: none;
	}

	.deal-link:hover {
		text-decoration: underline;
	}

	.deal-placeholder-title {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.deal-placeholder-copy {
		margin-top: 6px;
		font-size: 12px;
		line-height: 1.45;
		color: var(--text-muted);
	}

	.value-cell {
		font-size: 13px;
		font-weight: 600;
		line-height: 1.45;
		color: var(--text-dark);
	}

	.best-cell {
		background: rgba(81, 190, 123, 0.08);
		color: var(--primary);
	}

	@media (max-width: 768px) {
		.compare-shell {
			padding: 14px;
		}

		.compare-table th,
		.compare-table td {
			padding: 12px 14px;
		}

		.header-label,
		.label-cell {
			min-width: 132px;
			max-width: 132px;
		}

		.deal-header,
		.value-cell {
			min-width: 168px;
			max-width: 168px;
		}

		.deal-name {
			font-size: 13px;
		}

		.deal-manager,
		.value-cell {
			font-size: 12px;
		}
	}
</style>
