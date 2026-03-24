<script>
	import { dealStages, STAGE_META, normalizeStage, stageLabel } from '$lib/stores/deals.js';

	let { deals = [], allDeals = [], onclose = () => {}, onremove = () => {}, onstagechange = () => {} } = $props();

	function fmtPct(val) {
		if (val == null || val === '') return '\u2014';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '\u2014';
		return (n > 1 ? n : n * 100).toFixed(1) + '%';
	}

	function fmtMoney(val) {
		if (!val) return '\u2014';
		const n = typeof val === 'string' ? parseFloat(String(val).replace(/[$,]/g, '')) : val;
		if (isNaN(n)) return '\u2014';
		if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}

	function fmtMultiple(val) {
		if (!val) return '\u2014';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '\u2014';
		return n.toFixed(2) + 'x';
	}

	function fmtHold(val) {
		if (!val) return '\u2014';
		if (val < 1) return Math.round(val * 12) + ' mo';
		return val + ' yr';
	}

	// Find best numeric value in a row for highlighting
	function getBest(values, higherIsBetter) {
		const nums = values.map(v => (typeof v === 'number' && !isNaN(v)) ? v : null);
		let best = null;
		nums.forEach(n => { if (n !== null && (best === null || (higherIsBetter ? n > best : n < best))) best = n; });
		const uniqueBest = best !== null && nums.filter(n => n === best).length < nums.filter(n => n !== null).length;
		return { best, uniqueBest, nums };
	}

	const RETURNS_ROWS = [
		{ label: 'Target IRR', key: 'targetIRR', format: 'pct', higher: true },
		{ label: 'Pref Return', key: 'preferredReturn', format: 'pct', higher: true },
		{ label: 'Equity Multiple', key: 'equityMultiple', format: 'multiple', higher: true },
		{ label: 'Cash-on-Cash', key: 'cashOnCash', format: 'pct', higher: true }
	];

	const TERMS_ROWS = [
		{ label: 'Minimum', key: 'investmentMinimum', format: 'money', higher: false },
		{ label: 'Hold Period', key: 'holdPeriod', format: 'hold', higher: false }
	];

	const TEXT_ROWS = [
		{ label: 'Distributions', key: 'distributions' },
		{ label: 'Asset Class', key: 'assetClass' },
		{ label: 'Strategy', key: 'strategy' },
		{ label: 'Deal Type', key: 'dealType' },
		{ label: 'Geography', key: 'investingGeography' },
		{ label: 'Company', key: 'managementCompany' },
		{ label: 'CEO', key: 'ceo' },
		{ label: 'Founded', key: 'mcFoundingYear' }
	];

	function formatVal(val, fmt) {
		if (fmt === 'pct') return fmtPct(val);
		if (fmt === 'money') return fmtMoney(val);
		if (fmt === 'multiple') return fmtMultiple(val);
		if (fmt === 'hold') return fmtHold(val);
		return val || '\u2014';
	}

	function getStage(dealId) {
		return normalizeStage($dealStages[dealId]);
	}

	function getNextAction(dealId) {
		const stage = getStage(dealId);
		switch (stage) {
			case 'browse': return { label: 'Start Review', next: 'saved' };
			case 'saved': return { label: 'Ready to Connect', next: 'diligence' };
			case 'diligence': return { label: 'Decide', next: 'decision' };
			default: return null;
		}
	}
</script>

{#if deals.length < 2}
	<div class="compare-empty">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48">
			<line x1="12" y1="2" x2="12" y2="22"/>
			<rect x="2" y="4" width="8" height="16" rx="1"/>
			<rect x="14" y="4" width="8" height="16" rx="1"/>
		</svg>
		<div class="empty-title">Compare deals side by side</div>
		<div class="empty-sub">
			{deals.length === 0 ? 'Add at least 2 deals to get started.' : 'Add one more deal to start comparing.'}
		</div>
	</div>
{:else}
	<div class="compare-overlay">
		<div class="compare-header">
			<div class="compare-title">Deal Comparison</div>
			<button class="close-btn" onclick={onclose}>&times; Close</button>
		</div>

		<div class="compare-table-wrap">
			<table class="compare-table">
				<thead>
					<tr>
						<th class="col-label"></th>
						{#each deals as deal}
							<th class="col-deal">
								<button class="remove-btn" onclick={() => onremove(deal.id)} title="Remove">&times;</button>
								<div class="deal-badge">{deal.assetClass || 'Deal'}</div>
								<div class="deal-name">{deal.investmentName}</div>
								<div class="deal-mgr">{deal.managementCompany || ''}</div>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<!-- Returns -->
					<tr class="section-row"><td colspan={deals.length + 1}>Returns</td></tr>
					{#each RETURNS_ROWS as row}
						{@const info = getBest(deals.map(d => d[row.key]), row.higher)}
						<tr>
							<td class="col-label">{row.label}</td>
							{#each deals as deal, i}
								<td class="col-deal" class:best-val={info.uniqueBest && info.nums[i] === info.best}>
									{formatVal(deal[row.key], row.format)}
								</td>
							{/each}
						</tr>
					{/each}

					<!-- Terms -->
					<tr class="section-row"><td colspan={deals.length + 1}>Terms</td></tr>
					{#each TERMS_ROWS as row}
						{@const info = getBest(deals.map(d => d[row.key]), row.higher)}
						<tr>
							<td class="col-label">{row.label}</td>
							{#each deals as deal, i}
								<td class="col-deal" class:best-val={info.uniqueBest && info.nums[i] === info.best}>
									{formatVal(deal[row.key], row.format)}
								</td>
							{/each}
						</tr>
					{/each}

					<!-- Structure & Sponsor -->
					<tr class="section-row"><td colspan={deals.length + 1}>Structure & Sponsor</td></tr>
					{#each TEXT_ROWS as row}
						<tr>
							<td class="col-label">{row.label}</td>
							{#each deals as deal}
								<td class="col-deal">{deal[row.key] || '\u2014'}</td>
							{/each}
						</tr>
					{/each}

					<!-- Actions -->
					<tr class="section-row"><td colspan={deals.length + 1}>Actions</td></tr>
					<tr>
						<td class="col-label">Stage</td>
						{#each deals as deal}
							<td class="col-deal">
								<a href="/deal/{deal.id}" class="action-btn primary">Open Deal</a>
								{#if getNextAction(deal.id)}
									<button class="action-btn" onclick={() => onstagechange(deal.id, getNextAction(deal.id).next)}>
										{getNextAction(deal.id).label}
									</button>
								{:else}
									<button class="action-btn" disabled>{stageLabel(getStage(deal.id))}</button>
								{/if}
							</td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>
	</div>
{/if}

<style>
	.compare-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: 60px 20px;
		text-align: center;
		color: var(--text-muted);
	}
	.empty-title {
		font-family: var(--font-headline);
		font-size: 20px;
		color: var(--text-dark);
		margin-top: 16px;
	}
	.empty-sub {
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-secondary);
		margin-top: 8px;
	}

	.compare-overlay {
		background: var(--bg-main);
	}

	.compare-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}
	.compare-title {
		font-family: var(--font-headline);
		font-size: 24px;
		color: var(--text-dark);
	}
	.close-btn {
		padding: 8px 16px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 12px;
		cursor: pointer;
		color: var(--text-dark);
	}

	.compare-table-wrap {
		overflow-x: auto;
	}

	.compare-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-ui);
		font-size: 13px;
	}

	.compare-table th, .compare-table td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--border-light, var(--border));
	}

	.col-label {
		text-align: left;
		font-weight: 600;
		color: var(--text-muted);
		font-size: 11px;
		text-transform: uppercase;
		width: 180px;
		white-space: nowrap;
	}

	.col-deal {
		text-align: center;
		font-weight: 600;
		color: var(--text-dark);
		min-width: 160px;
	}

	.col-deal.best-val {
		background: rgba(74, 222, 128, 0.1);
		color: var(--primary);
	}

	.section-row td {
		padding: 16px 12px 8px;
		font-weight: 800;
		font-size: 12px;
		color: var(--primary);
		text-transform: uppercase;
		letter-spacing: 1px;
		border-bottom: none;
	}

	.remove-btn {
		position: absolute;
		top: 4px;
		right: 4px;
		background: none;
		border: none;
		font-size: 16px;
		cursor: pointer;
		color: var(--text-muted);
		padding: 2px 6px;
	}
	.remove-btn:hover { color: var(--red, #e74c3c); }

	th.col-deal {
		position: relative;
		vertical-align: top;
		text-align: center;
		border-bottom: 2px solid var(--border);
	}

	.deal-badge {
		display: inline-block;
		padding: 2px 8px;
		background: var(--primary);
		color: #fff;
		border-radius: 4px;
		font-size: 9px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-bottom: 4px;
	}

	.deal-name {
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.deal-mgr {
		font-size: 11px;
		color: var(--text-muted);
		font-weight: 500;
	}

	.action-btn {
		display: block;
		width: 100%;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 6px;
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 12px;
		cursor: pointer;
		text-align: center;
		text-decoration: none;
		color: var(--text-dark);
		background: var(--bg-card);
		margin-bottom: 6px;
		transition: all 0.15s;
	}
	.action-btn:hover { border-color: var(--primary); color: var(--primary); }
	.action-btn.primary {
		background: var(--primary);
		color: #fff;
		border-color: var(--primary);
	}
	.action-btn:disabled { opacity: 0.5; cursor: default; }

	@media (max-width: 768px) {
		.compare-header { flex-direction: column; gap: 8px; align-items: flex-start; }
		.col-label { width: 120px; font-size: 10px; }
		.col-deal { min-width: 130px; }
	}
</style>
