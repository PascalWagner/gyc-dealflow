<script>
	let {
		rows = [],
		totalMatches = 0,
		totalNewMatches = 0
	} = $props();

	function percent(value, digits = 1) {
		return `${Number(value || 0).toFixed(digits)}%`;
	}

	function formatLockup(value) {
		const amount = Number(value || 0);
		return `${amount.toFixed(amount % 1 === 0 ? 0 : 1)} yrs`;
	}

	function formatNewestDeal(days) {
		const amount = Number(days || 0);
		return `${amount} day${amount === 1 ? '' : 's'} ago`;
	}
</script>

<div class="market-snapshot">
	<div class="snapshot-table desktop-snapshot">
		<div class="snapshot-head snapshot-row">
			<div>Asset Class</div>
			<div>Target IRR</div>
			<div>Cash Yield</div>
			<div>Avg Lockup</div>
			<div>Newest Deal</div>
		</div>
		{#each rows as row}
			<div class="snapshot-row">
				<div class="snapshot-asset">
					<span class="snapshot-icon" style={`background:${row.color}`}>{row.icon}</span>
					<div>
						<div class="snapshot-name">{row.label}</div>
						<div class="snapshot-meta">{row.dealCount} deals</div>
					</div>
				</div>
				<div>{percent(row.irrMin)} - {percent(row.irrMax)}</div>
				<div>{percent(row.cashYield)}</div>
				<div>{formatLockup(row.lockup)}</div>
				<div>{formatNewestDeal(row.newestDays)}</div>
			</div>
		{/each}
	</div>

	<div class="snapshot-list mobile-snapshot">
		{#each rows as row}
			<article class="snapshot-card">
				<div class="snapshot-card-top">
					<div class="snapshot-asset">
						<span class="snapshot-icon" style={`background:${row.color}`}>{row.icon}</span>
						<div>
							<div class="snapshot-name">{row.label}</div>
							<div class="snapshot-meta">{row.dealCount} deals</div>
						</div>
					</div>
				</div>

				<dl class="snapshot-card-metrics">
					<div class="snapshot-card-metric">
						<dt>Target IRR</dt>
						<dd>{percent(row.irrMin)} - {percent(row.irrMax)}</dd>
					</div>
					<div class="snapshot-card-metric">
						<dt>Cash Yield</dt>
						<dd>{percent(row.cashYield)}</dd>
					</div>
					<div class="snapshot-card-metric">
						<dt>Avg Lockup</dt>
						<dd>{formatLockup(row.lockup)}</dd>
					</div>
					<div class="snapshot-card-metric">
						<dt>Newest Deal</dt>
						<dd>{formatNewestDeal(row.newestDays)}</dd>
					</div>
				</dl>
			</article>
		{/each}
	</div>

	<div class="market-footer">
		<div class="market-match-total">{totalMatches} total deals match</div>
		<a href="/app/deals" class="browse-btn">Browse Matching Deals →</a>
		<div class="market-match-new">{totalNewMatches} new this month</div>
	</div>
</div>

<style>
	.market-snapshot {
		margin-top: 18px;
	}

	.desktop-snapshot {
		border-top: 1px solid var(--border-light);
	}

	.snapshot-row {
		display: grid;
		grid-template-columns: minmax(240px, 1.6fr) 1fr 1fr 1fr 1fr;
		align-items: center;
		gap: 12px;
		padding: 14px 0;
		border-bottom: 1px solid var(--border-light);
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-dark);
	}

	.snapshot-head {
		padding-top: 12px;
		padding-bottom: 12px;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.6px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.snapshot-asset {
		display: flex;
		align-items: center;
		gap: 12px;
		min-width: 0;
	}

	.snapshot-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 10px;
		color: #fff;
		font-size: 11px;
		font-weight: 700;
		flex-shrink: 0;
	}

	.snapshot-name {
		font-weight: 700;
		color: var(--text-dark);
	}

	.snapshot-meta {
		margin-top: 2px;
		font-size: 12px;
		color: var(--text-muted);
	}

	.snapshot-list {
		display: none;
	}

	.snapshot-card {
		padding: 16px 0;
		border-bottom: 1px solid var(--border-light);
	}

	.snapshot-card:first-child {
		padding-top: 0;
	}

	.snapshot-card:last-child {
		padding-bottom: 0;
		border-bottom: none;
	}

	.snapshot-card-metrics {
		display: grid;
		gap: 10px;
		margin: 14px 0 0;
	}

	.snapshot-card-metric {
		display: grid;
		gap: 2px;
	}

	.snapshot-card-metric dt {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.snapshot-card-metric dd {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.market-footer {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 16px;
		padding-top: 18px;
	}

	.market-match-total {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.market-match-new {
		text-align: right;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
	}

	.browse-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 12px 22px;
		border-radius: 8px;
		background: var(--primary);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		text-decoration: none;
		border: 1px solid var(--primary);
		cursor: pointer;
	}

	@media (max-width: 1023px) {
		.desktop-snapshot {
			display: none;
		}

		.snapshot-list {
			display: grid;
			gap: 0;
		}

		.market-footer {
			grid-template-columns: 1fr;
			align-items: flex-start;
			gap: 12px;
		}

		.browse-btn {
			width: 100%;
		}

		.market-match-new {
			text-align: left;
		}
	}
</style>
