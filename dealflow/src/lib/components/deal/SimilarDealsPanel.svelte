<script>
	import { getDealOperator } from '$lib/utils/dealSponsors.js';
	import {
		filterComparableDeals,
		getComparableMetricConfig,
		getComparableMetricValue
	} from '$lib/utils/dealComparables.js';

	let {
		deal,
		similarDeals = [],
		dealOperatorName = '',
		fmt
	} = $props();

	const metricConfig = $derived.by(() => getComparableMetricConfig(deal));
	const eligibleSimilarDeals = $derived.by(() => filterComparableDeals(similarDeals, deal));
	const primaryMobileMetrics = $derived(metricConfig.slice(0, 3));
	const secondaryMobileMetrics = $derived(metricConfig.slice(3));

	function formatComparableValue(record, metric) {
		const value = getComparableMetricValue(record, metric);
		if (value === null || value === undefined || value === '') return '---';
		if (metric.type === 'pct') return fmt(value, 'pct');
		if (metric.type === 'money') return fmt(value, 'money');
		if (metric.type === 'multiple') return fmt(value, 'multiple');
		if (metric.type === 'hold') {
			const normalized = String(value);
			return /open/i.test(normalized) ? normalized : `${normalized} Yrs`;
		}
		return value;
	}
</script>

<div class="similar-table-wrap ly-table-scroll ly-desktop-only">
	<table class="similar-table">
		<thead>
			<tr>
				<th class="sim-th left">Deal Name</th>
				{#each metricConfig as metric}
					<th class="sim-th">{metric.label}</th>
				{/each}
			</tr>
		</thead>
		<tbody>
			<tr class="sim-current-row">
				<td class="sim-td left">
					<div class="sim-deal-name current">{deal.investmentName}</div>
					<div class="sim-deal-company">{dealOperatorName || ''}</div>
					<span class="sim-badge current">THIS DEAL</span>
				</td>
				{#each metricConfig as metric}
					<td class="sim-td">{formatComparableValue(deal, metric)}</td>
				{/each}
			</tr>
			{#if eligibleSimilarDeals.length > 0}
				{#each eligibleSimilarDeals as sd}
					{@const similarDealOperator = getDealOperator(sd)}
					<tr class="sim-peer-row">
						<td class="sim-td left">
							<a href="/deal/{sd.id}" class="sim-deal-link">{sd.investmentName}</a>
							<div class="sim-deal-company">{similarDealOperator.name || ''}</div>
						</td>
						{#each metricConfig as metric}
							<td class="sim-td">{formatComparableValue(sd, metric)}</td>
						{/each}
					</tr>
				{/each}
			{:else}
				<tr>
					<td class="sim-empty-row" colspan={metricConfig.length + 1}>Comparable deals need more structured data before we can show a trustworthy table.</td>
				</tr>
			{/if}
		</tbody>
	</table>
</div>

<div class="similar-mobile-list ly-mobile-only">
	{#if eligibleSimilarDeals.length > 0}
	<article class="similar-mobile-card current">
		<div class="similar-mobile-header">
			<div class="similar-mobile-copy">
				<div class="sim-deal-name current">{deal.investmentName}</div>
				<div class="sim-deal-company">{dealOperatorName || ''}</div>
				<span class="sim-badge current">THIS DEAL</span>
			</div>
		</div>
		<div class="similar-mobile-primary">
			{#each primaryMobileMetrics as metric}
				<div class="similar-mobile-stat">
					<span class="similar-mobile-stat-label">{metric.label}</span>
					<strong class="similar-mobile-stat-value">{formatComparableValue(deal, metric)}</strong>
				</div>
			{/each}
		</div>
		{#if secondaryMobileMetrics.length > 0}
			<details class="similar-mobile-details">
				<summary>More metrics</summary>
				<div class="similar-mobile-secondary">
					{#each secondaryMobileMetrics as metric}
						<div class="similar-mobile-detail"><span>{metric.label}</span><strong>{formatComparableValue(deal, metric)}</strong></div>
					{/each}
				</div>
			</details>
		{/if}
	</article>
		{#each eligibleSimilarDeals as sd}
			{@const similarDealOperator = getDealOperator(sd)}
			<article class="similar-mobile-card">
				<div class="similar-mobile-header">
					<div class="similar-mobile-copy">
						<a href="/deal/{sd.id}" class="sim-deal-link">{sd.investmentName}</a>
						<div class="sim-deal-company">{similarDealOperator.name || ''}</div>
					</div>
				</div>
				<div class="similar-mobile-primary">
					{#each primaryMobileMetrics as metric}
						<div class="similar-mobile-stat">
							<span class="similar-mobile-stat-label">{metric.label}</span>
							<strong class="similar-mobile-stat-value">{formatComparableValue(sd, metric)}</strong>
						</div>
					{/each}
				</div>
				{#if secondaryMobileMetrics.length > 0}
					<details class="similar-mobile-details">
						<summary>More metrics</summary>
						<div class="similar-mobile-secondary">
							{#each secondaryMobileMetrics as metric}
								<div class="similar-mobile-detail"><span>{metric.label}</span><strong>{formatComparableValue(sd, metric)}</strong></div>
							{/each}
						</div>
					</details>
				{/if}
			</article>
		{/each}
	{:else}
		<article class="similar-mobile-card similar-empty-card">
			<div class="similar-empty-title">Not enough comparable data yet.</div>
			<div class="similar-empty-copy">We hide weak matches until the comparison fields are structured enough to be trustworthy.</div>
		</article>
	{/if}
</div>

<style>
	.similar-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; min-width: 0; max-width: 100%; }
	.similar-table { width: 100%; border-collapse: collapse; min-width: 600px; }
	.sim-th { padding: 10px 12px; font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.3px; text-align: right; white-space: nowrap; border-bottom: 2px solid var(--border); }
	.sim-th.left { text-align: left; min-width: 180px; }
	.sim-td { padding: 10px 12px; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark); text-align: right; border-bottom: 1px solid var(--border-light); }
	.sim-td.left { text-align: left; }
	.sim-current-row { background: rgba(81,190,123,0.06); }
	.sim-deal-name { font-weight: 700; color: var(--text-dark); }
	.sim-deal-name.current { font-weight: 800; color: var(--primary); }
	.sim-deal-company { font-size: 11px; font-weight: 500; color: var(--text-muted); }
	.sim-deal-link { color: var(--text-dark); text-decoration: none; font-weight: 600; }
	.sim-deal-link:hover { color: var(--primary); text-decoration: underline; }
	.sim-badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 9px; font-weight: 700; margin-top: 2px; }
	.sim-badge.current { background: var(--primary); color: #fff; }
	.sim-peer-row { transition: background 0.1s; }
	.sim-peer-row:hover { background: var(--bg-cream, #f8f8f6); }
	.sim-empty-row {
		padding: 16px 12px;
		text-align: center;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border-light);
	}
	.similar-mobile-list { display: grid; gap: 12px; }
	.similar-mobile-list.ly-mobile-only { display: grid !important; }
	.similar-mobile-card {
		padding: 14px;
		border: 1px solid var(--border-light);
		border-radius: 12px;
		background: linear-gradient(180deg, rgba(248,248,246,0.7) 0%, rgba(255,255,255,0.96) 100%);
	}
	.similar-mobile-card.current {
		border-color: rgba(81,190,123,0.25);
		background: linear-gradient(180deg, rgba(81,190,123,0.06) 0%, rgba(255,255,255,0.98) 100%);
	}
	.similar-empty-card {
		background: linear-gradient(180deg, rgba(248,248,246,0.9) 0%, rgba(255,255,255,0.98) 100%);
	}
	.similar-mobile-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
	}
	.similar-mobile-copy {
		min-width: 0;
	}
	.similar-mobile-primary {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		margin-top: 14px;
	}
	.similar-mobile-primary > * {
		min-width: 0;
	}
	.similar-mobile-stat {
		padding: 10px 12px;
		border-radius: 10px;
		background: var(--bg-cream, #f8f8f6);
	}
	.similar-mobile-stat-label {
		display: block;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.similar-mobile-stat-value {
		display: block;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.similar-mobile-details {
		margin-top: 12px;
		padding-top: 12px;
		border-top: 1px solid var(--border-light);
	}
	.similar-mobile-details summary {
		list-style: none;
		cursor: pointer;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--primary);
	}
	.similar-mobile-details summary::-webkit-details-marker {
		display: none;
	}
	.similar-mobile-secondary {
		display: grid;
		gap: 8px;
		margin-top: 10px;
	}
	.similar-mobile-detail {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-secondary);
	}
	.similar-mobile-detail strong {
		color: var(--text-dark);
		font-weight: 700;
		text-align: right;
	}
	.similar-empty-title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.similar-empty-copy {
		margin-top: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	@media (max-width: 768px) {
		.similar-table { font-size: 12px; }
	}

	@media (max-width: 480px) {
		.similar-mobile-primary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}
</style>
