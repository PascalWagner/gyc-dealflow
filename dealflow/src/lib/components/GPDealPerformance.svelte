<script>
	import { onMount } from 'svelte';

	// Props
	let { companyId = '', authHeaders = () => ({}) } = $props();

	// State
	let loading = $state(true);
	let error = $state(null);
	let perfData = $state({ deals: [], benchmarks: { byAssetClass: {}, platform: {} }, crossDeal: [] });
	let period = $state('all');
	let selectedDealId = $state(null);
	let chartEl = $state(null);
	let chartInstance = $state(null);
	let chartJsLoaded = $state(false);

	const PERIODS = [
		{ value: '7', label: '7 days' },
		{ value: '30', label: '30 days' },
		{ value: '90', label: '90 days' },
		{ value: 'all', label: 'All time' }
	];

	const STAGE_COLORS = {
		totalEngaged: '#64748b',
		saved: '#3b82f6',
		connect: '#f97316',
		decide: '#a855f7',
		invested: '#059669'
	};

	const CONV_KEYS = [
		{ key: 'engaged_to_saved', label: 'Engaged \u2192 Saved', short: 'Eng\u2192Sav' },
		{ key: 'saved_to_connect', label: 'Saved \u2192 Connect', short: 'Sav\u2192Con' },
		{ key: 'connect_to_decide', label: 'Connect \u2192 Decide', short: 'Con\u2192Dec' },
		{ key: 'decide_to_invested', label: 'Decide \u2192 Invested', short: 'Dec\u2192Inv' }
	];

	// Derived
	const deals = $derived(perfData.deals || []);
	const benchmarks = $derived(perfData.benchmarks || { byAssetClass: {}, platform: {} });
	const crossDeal = $derived(perfData.crossDeal || []);
	const selectedDeal = $derived(deals.find(d => d.id === selectedDealId) || deals[0] || null);
	const selectedBenchmark = $derived(
		selectedDeal?.asset_class ? benchmarks.byAssetClass?.[selectedDeal.asset_class] : null
	);
	const platformBenchmark = $derived(benchmarks.platform || {});
	const selectedFunnel = $derived(selectedDeal?.funnel || { totalEngaged: 0, saved: 0, connect: 0, decide: 0, invested: 0, skipped: 0, skippedBreakdown: {} });
	const funnelMax = $derived(selectedFunnel.totalEngaged || 1);
	const selectedCross = $derived(crossDeal.find(c => c.id === selectedDeal?.id) || {});

	// Helpers
	function fmtPct(val) {
		if (val == null) return '--';
		const num = Number(val);
		if (isNaN(num)) return '--';
		return num.toFixed(1) + '%';
	}

	function fmtDiff(val) {
		if (val == null) return '--';
		const prefix = val > 0 ? '+' : '';
		return prefix + val + '%';
	}

	function diffClass(val) {
		if (val == null) return '';
		return val > 0 ? 'diff-positive' : val < 0 ? 'diff-negative' : 'diff-neutral';
	}

	function statusBadge(status) {
		if (!status) return 'badge-green';
		const s = status.toLowerCase();
		if (s.includes('closed') || s.includes('fully funded') || s.includes('completed')) return 'badge-gray';
		if (s.includes('evergreen')) return 'badge-blue';
		return 'badge-green';
	}

	function funnelBarWidth(count, max) {
		if (!max || !count) return 0;
		return Math.max(Math.round((count / max) * 100), 2);
	}

	function avgDiff(diffObj) {
		if (!diffObj) return null;
		const diffs = CONV_KEYS.map(c => diffObj[c.key]).filter(v => v != null);
		return diffs.length ? Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length) : null;
	}

	// Data fetching
	async function fetchPerformance() {
		loading = true;
		error = null;
		try {
			const resp = await fetch(
				`/api/gp-deal-performance?companyId=${encodeURIComponent(companyId)}&period=${period}`,
				{ headers: authHeaders() }
			);
			if (!resp.ok) throw new Error('Failed to load performance data');
			perfData = await resp.json();
			if (!selectedDealId && perfData.deals?.length > 0) {
				selectedDealId = perfData.deals[0].id;
			}
		} catch (e) {
			error = e.message;
		} finally {
			loading = false;
		}
	}

	// Chart
	let ChartConstructor = null;

	async function loadChartJs() {
		if (chartJsLoaded) return;
		const { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend } = await import('chart.js');
		Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
		ChartConstructor = Chart;
		chartJsLoaded = true;
	}

	function renderBenchmarkChart() {
		if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
		if (!chartEl || !chartJsLoaded || !ChartConstructor || !selectedDeal) return;

		const conv = selectedDeal.conversions || {};
		const acConv = selectedBenchmark?.avgConversions || {};
		const platConv = platformBenchmark?.avgConversions || {};

		chartInstance = new ChartConstructor(chartEl, {
			type: 'bar',
			data: {
				labels: CONV_KEYS.map(c => c.short),
				datasets: [
					{
						label: 'Your Deal',
						data: CONV_KEYS.map(c => conv[c.key] ?? null),
						backgroundColor: '#059669',
						borderRadius: 3,
						maxBarThickness: 32
					},
					{
						label: selectedDeal.asset_class ? selectedDeal.asset_class + ' Avg' : 'Asset Class Avg',
						data: CONV_KEYS.map(c => acConv[c.key] ?? null),
						backgroundColor: '#3b82f6',
						borderRadius: 3,
						maxBarThickness: 32
					},
					{
						label: 'Platform Avg',
						data: CONV_KEYS.map(c => platConv[c.key] ?? null),
						backgroundColor: '#94a3b8',
						borderRadius: 3,
						maxBarThickness: 32
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						display: true,
						position: 'top',
						labels: { boxWidth: 10, boxHeight: 10, padding: 14, font: { size: 11, weight: '600' } }
					},
					tooltip: {
						callbacks: {
							label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y != null ? ctx.parsed.y.toFixed(1) + '%' : '--'}`
						}
					}
				},
				scales: {
					x: { grid: { display: false }, ticks: { font: { size: 11 } } },
					y: { beginAtZero: true, ticks: { callback: v => v + '%', font: { size: 11 } }, grid: { color: 'rgba(0,0,0,0.05)' } }
				}
			}
		});
	}

	// Effects
	$effect(() => {
		const _p = period;
		const _c = companyId;
		if (_c) fetchPerformance();
	});

	$effect(() => {
		const _deal = selectedDeal;
		const _bench = selectedBenchmark;
		const _loaded = chartJsLoaded;
		const _el = chartEl;
		if (_loaded && _el) renderBenchmarkChart();
	});

	onMount(async () => {
		await loadChartJs();
	});
</script>

{#if loading}
	<div class="perf-loading">
		<div class="skeleton skeleton-funnel"></div>
		<div class="skeleton skeleton-chart"></div>
		<div class="skeleton skeleton-table"></div>
	</div>
{:else if error}
	<div class="perf-error">
		<p>Failed to load performance data. <button onclick={() => fetchPerformance()}>Retry</button></p>
	</div>
{:else if deals.length === 0}
	<div class="perf-empty">
		<div class="perf-empty-icon">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3v18h18"/><path d="M7 16l4-4 4 4 5-6"/></svg>
		</div>
		<h3>No Deal Performance Data Yet</h3>
		<p>Once your deals start getting LP engagement, you'll see funnel metrics, conversion rates, and benchmark comparisons here.</p>
	</div>
{:else}

	<!-- Period Filter -->
	<div class="perf-controls">
		<div class="period-tabs">
			{#each PERIODS as p}
				<button class="period-tab" class:active={period === p.value} onclick={() => { period = p.value; }}>
					{p.label}
				</button>
			{/each}
		</div>
	</div>

	<!-- Deal Selector -->
	{#if deals.length > 1}
		<div class="deal-selector">
			{#each deals as deal}
				<button
					class="deal-chip"
					class:active={selectedDealId === deal.id}
					onclick={() => { selectedDealId = deal.id; }}
				>
					<span class="deal-chip-name">{deal.name}</span>
					<span class="deal-chip-badge {statusBadge(deal.status)}">{deal.status || 'Active'}</span>
				</button>
			{/each}
		</div>
	{/if}

	{#if selectedDeal}
		<!-- 1. Per-Deal Funnel -->
		<div class="section-card">
			<div class="section-header">
				<div class="section-title">Deal Funnel</div>
				<div class="section-header-right">
					<span class="deal-name-label">{selectedDeal.name}</span>
					{#if selectedDeal.asset_class}
						<span class="ac-badge">{selectedDeal.asset_class}</span>
					{/if}
				</div>
			</div>
			<div class="section-body">
				<div class="funnel-chart">
					<div class="funnel-row">
						<div class="funnel-label">Total Engaged</div>
						<div class="funnel-bar-wrap">
							<div class="funnel-bar" style="width:{funnelBarWidth(selectedFunnel.totalEngaged, funnelMax)}%;background:{STAGE_COLORS.totalEngaged};">
								<span class="funnel-count">{selectedFunnel.totalEngaged}</span>
							</div>
						</div>
						<div class="funnel-pct"></div>
					</div>
					<div class="funnel-row">
						<div class="funnel-label">Saved</div>
						<div class="funnel-bar-wrap">
							<div class="funnel-bar" style="width:{funnelBarWidth(selectedFunnel.saved, funnelMax)}%;background:{STAGE_COLORS.saved};">
								<span class="funnel-count">{selectedFunnel.saved}</span>
							</div>
						</div>
						<div class="funnel-pct">{fmtPct(selectedDeal.conversions.engaged_to_saved)}</div>
					</div>
					<div class="funnel-row">
						<div class="funnel-label">Connect</div>
						<div class="funnel-bar-wrap">
							<div class="funnel-bar" style="width:{funnelBarWidth(selectedFunnel.connect, funnelMax)}%;background:{STAGE_COLORS.connect};">
								<span class="funnel-count">{selectedFunnel.connect}</span>
							</div>
						</div>
						<div class="funnel-pct">{fmtPct(selectedDeal.conversions.saved_to_connect)}</div>
					</div>
					<div class="funnel-row">
						<div class="funnel-label">Decide</div>
						<div class="funnel-bar-wrap">
							<div class="funnel-bar" style="width:{funnelBarWidth(selectedFunnel.decide, funnelMax)}%;background:{STAGE_COLORS.decide};">
								<span class="funnel-count">{selectedFunnel.decide}</span>
							</div>
						</div>
						<div class="funnel-pct">{fmtPct(selectedDeal.conversions.connect_to_decide)}</div>
					</div>
					<div class="funnel-row">
						<div class="funnel-label">Invested</div>
						<div class="funnel-bar-wrap">
							<div class="funnel-bar" style="width:{funnelBarWidth(selectedFunnel.invested, funnelMax)}%;background:{STAGE_COLORS.invested};">
								<span class="funnel-count">{selectedFunnel.invested}</span>
							</div>
						</div>
						<div class="funnel-pct">{fmtPct(selectedDeal.conversions.decide_to_invested)}</div>
					</div>
				</div>

				{#if selectedFunnel.skipped > 0}
					<div class="skipped-summary">
						<span class="skipped-count">{selectedFunnel.skipped} skipped</span>
						<span class="skipped-detail">
							{#each Object.entries(selectedFunnel.skippedBreakdown).filter(([,v]) => v > 0) as [stage, count]}
								<span class="skipped-item">{count} from {stage}</span>
							{/each}
						</span>
					</div>
				{/if}
			</div>
		</div>

		<!-- 2. Benchmark Comparison -->
		<div class="section-card">
			<div class="section-header">
				<div class="section-title">Benchmark Comparison</div>
				<span class="section-subtitle">vs. other deals (last 12 months)</span>
			</div>
			<div class="section-body">
				{#if !selectedBenchmark && !platformBenchmark?.dealCount}
					<div class="bench-empty">Not enough platform data to generate benchmarks yet.</div>
				{:else}
					<div class="benchmark-chart-wrap">
						<canvas bind:this={chartEl}></canvas>
					</div>

					<!-- Text callouts -->
					<div class="benchmark-callouts">
						{#each CONV_KEYS as ck}
							{#if selectedDeal.conversions[ck.key] != null}
								<div class="callout-row">
									<span class="callout-label">{ck.label}</span>
									<span class="callout-value">{fmtPct(selectedDeal.conversions[ck.key])}</span>
									{#if selectedCross?.vsAssetClass?.[ck.key] != null && selectedDeal.asset_class}
										<span class="callout-diff {diffClass(selectedCross.vsAssetClass[ck.key])}">
											{fmtDiff(selectedCross.vsAssetClass[ck.key])} vs {selectedDeal.asset_class}
										</span>
									{/if}
									{#if selectedCross?.vsPlatform?.[ck.key] != null}
										<span class="callout-diff {diffClass(selectedCross.vsPlatform[ck.key])}">
											{fmtDiff(selectedCross.vsPlatform[ck.key])} vs platform
										</span>
									{/if}
								</div>
							{/if}
						{/each}
						{#if selectedCross?.acSampleNote}
							<div class="sample-note">{selectedCross.acSampleNote}</div>
						{/if}
					</div>
				{/if}
			</div>
		</div>
	{/if}

	<!-- 3. Cross-Deal Comparison -->
	{#if crossDeal.length > 1}
		<div class="section-card">
			<div class="section-header">
				<div class="section-title">Cross-Deal Comparison</div>
			</div>
			<div class="section-body">
				<div class="cross-deal-table-wrap">
					<table class="cross-deal-table">
						<thead>
							<tr>
								<th class="col-deal">Deal</th>
								<th class="col-ac">Asset Class</th>
								{#each CONV_KEYS as ck}
									<th class="col-conv">{ck.short}</th>
								{/each}
								<th class="col-vs">vs Asset Class</th>
								<th class="col-vs">vs Platform</th>
							</tr>
						</thead>
						<tbody>
							{#each crossDeal as row}
								<tr class:row-highlight={row.id === selectedDealId}>
									<td class="col-deal">
										<button class="deal-link" onclick={() => { selectedDealId = row.id; }}>
											{row.name}
										</button>
									</td>
									<td class="col-ac"><span class="ac-badge-sm">{row.asset_class || '--'}</span></td>
									{#each CONV_KEYS as ck}
										<td class="col-conv">{fmtPct(row.conversions[ck.key])}</td>
									{/each}
									<td class="col-vs">
										<span class={diffClass(avgDiff(row.vsAssetClass))}>{fmtDiff(avgDiff(row.vsAssetClass))}</span>
										{#if row.acSampleNote}
											<span class="sample-note-inline" title={row.acSampleNote}>*</span>
										{/if}
									</td>
									<td class="col-vs">
										<span class={diffClass(avgDiff(row.vsPlatform))}>{fmtDiff(avgDiff(row.vsPlatform))}</span>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	{/if}
{/if}

<style>
	/* ====== LOADING & EMPTY ====== */
	.perf-loading { display: flex; flex-direction: column; gap: 16px; }
	.skeleton {
		position: relative; overflow: hidden; background: var(--border-light);
		border-radius: var(--radius-sm, 8px);
	}
	.skeleton::after {
		content: ''; position: absolute; inset: 0;
		background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.6) 50%, transparent 100%);
		animation: shimmer 1.5s infinite;
	}
	@keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
	.skeleton-funnel { height: 240px; }
	.skeleton-chart { height: 200px; }
	.skeleton-table { height: 160px; }

	.perf-error {
		padding: 32px; text-align: center; color: var(--text-muted);
		font-family: var(--font-ui); font-size: 14px;
	}
	.perf-error button {
		background: var(--primary); color: #fff; border: none; border-radius: 6px;
		padding: 6px 14px; font-size: 13px; font-weight: 600; cursor: pointer; margin-left: 8px;
	}

	.perf-empty {
		text-align: center; padding: 48px 24px; color: var(--text-muted);
		font-family: var(--font-ui);
	}
	.perf-empty-icon { margin-bottom: 16px; }
	.perf-empty-icon :global(svg) { width: 48px; height: 48px; color: var(--border); }
	.perf-empty h3 { font-size: 16px; color: var(--text-dark); margin-bottom: 8px; }
	.perf-empty p { font-size: 13px; max-width: 400px; margin: 0 auto; line-height: 1.5; }

	/* ====== CONTROLS ====== */
	.perf-controls {
		display: flex; align-items: center; justify-content: flex-end;
		margin-bottom: 16px; gap: 12px;
	}
	.period-tabs { display: flex; gap: 4px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 3px; }
	.period-tab {
		padding: 6px 14px; border: none; background: transparent; border-radius: 6px;
		font-family: var(--font-ui); font-size: 12px; font-weight: 600;
		color: var(--text-muted); cursor: pointer; transition: all 0.15s;
	}
	.period-tab:hover { color: var(--text-dark); }
	.period-tab.active { background: var(--primary); color: #fff; }

	/* ====== DEAL SELECTOR ====== */
	.deal-selector {
		display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;
	}
	.deal-chip {
		display: inline-flex; align-items: center; gap: 8px;
		padding: 8px 14px; border: 1px solid var(--border); border-radius: 8px;
		background: var(--bg-card); font-family: var(--font-ui); font-size: 13px;
		font-weight: 500; color: var(--text-dark); cursor: pointer; transition: all 0.15s;
	}
	.deal-chip:hover { border-color: var(--primary); }
	.deal-chip.active { border-color: var(--primary); background: rgba(81,190,123,0.08); }
	.deal-chip-name { max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
	.deal-chip-badge {
		font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
		padding: 2px 6px; border-radius: 4px;
	}
	.badge-green { background: rgba(81,190,123,0.15); color: #059669; }
	.badge-blue { background: rgba(59,130,246,0.15); color: #2563eb; }
	.badge-gray { background: rgba(148,163,184,0.15); color: #64748b; }

	/* ====== SECTION CARDS (inherited from parent, redeclare for scoping) ====== */
	.section-card {
		background: var(--bg-card); border: 1px solid var(--border);
		border-radius: 10px; margin-bottom: 20px; overflow: hidden;
	}
	.section-header {
		display: flex; align-items: center; gap: 10px;
		padding: 16px 20px; border-bottom: 1px solid var(--border-light);
	}
	.section-title {
		font-family: var(--font-ui); font-size: 11px; font-weight: 700;
		text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary);
	}
	.section-subtitle {
		font-family: var(--font-ui); font-size: 11px; color: var(--text-muted); margin-left: auto;
	}
	.section-header-right {
		margin-left: auto; display: flex; align-items: center; gap: 8px;
	}
	.deal-name-label {
		font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-dark);
	}
	.ac-badge, .ac-badge-sm {
		display: inline-flex; align-items: center; padding: 2px 8px;
		border-radius: 12px; font-family: var(--font-ui); font-size: 10px;
		font-weight: 600; text-transform: uppercase; letter-spacing: 0.3px;
		background: rgba(81,190,123,0.12); color: var(--primary);
	}
	.ac-badge-sm { font-size: 9px; padding: 1px 6px; }
	.section-body { padding: 20px; }

	/* ====== FUNNEL CHART ====== */
	.funnel-chart { display: flex; flex-direction: column; gap: 10px; }
	.funnel-row { display: grid; grid-template-columns: 100px 1fr 60px; align-items: center; gap: 12px; }
	.funnel-label {
		font-family: var(--font-ui); font-size: 12px; font-weight: 600;
		color: var(--text-dark); text-align: right;
	}
	.funnel-bar-wrap {
		background: var(--border-light, #f1f5f9); border-radius: 6px;
		height: 32px; overflow: hidden; position: relative;
	}
	.funnel-bar {
		height: 100%; border-radius: 6px; display: flex; align-items: center;
		justify-content: flex-end; padding-right: 10px; min-width: 24px;
		transition: width 0.4s cubic-bezier(0.4, 0, 0.2, 1);
	}
	.funnel-count {
		font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: #fff;
	}
	.funnel-pct {
		font-family: var(--font-ui); font-size: 12px; font-weight: 600;
		color: var(--text-muted); text-align: left;
	}

	/* ====== SKIPPED SUMMARY ====== */
	.skipped-summary {
		margin-top: 12px; padding: 10px 14px; background: rgba(148,163,184,0.08);
		border-radius: 8px; font-family: var(--font-ui); font-size: 12px;
		color: var(--text-muted); display: flex; align-items: center; gap: 10px;
	}
	.skipped-count { font-weight: 700; color: var(--text-dark); }
	.skipped-detail { display: flex; gap: 8px; }
	.skipped-item {
		padding: 2px 6px; background: rgba(148,163,184,0.1); border-radius: 4px; font-size: 11px;
	}

	/* ====== BENCHMARK CHART ====== */
	.benchmark-chart-wrap { height: 220px; margin-bottom: 20px; }
	.bench-empty {
		text-align: center; padding: 32px; color: var(--text-muted);
		font-family: var(--font-ui); font-size: 13px;
	}

	/* ====== BENCHMARK CALLOUTS ====== */
	.benchmark-callouts { display: flex; flex-direction: column; gap: 8px; }
	.callout-row {
		display: flex; align-items: center; gap: 12px; padding: 8px 12px;
		background: var(--border-light, #f8fafc); border-radius: 8px;
		font-family: var(--font-ui); font-size: 12px;
	}
	.callout-label { font-weight: 600; color: var(--text-dark); min-width: 130px; }
	.callout-value { font-weight: 700; color: var(--teal-deep, #1F5159); min-width: 50px; }
	.callout-diff { font-weight: 600; font-size: 11px; padding: 2px 8px; border-radius: 4px; }
	.diff-positive { background: rgba(5,150,105,0.1); color: #059669; }
	.diff-negative { background: rgba(239,68,68,0.1); color: #ef4444; }
	.diff-neutral { background: rgba(148,163,184,0.1); color: #64748b; }
	.sample-note {
		font-size: 11px; color: var(--text-muted); font-style: italic;
		padding: 4px 12px; margin-top: 4px;
	}

	/* ====== CROSS-DEAL TABLE ====== */
	.cross-deal-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
	.cross-deal-table {
		width: 100%; border-collapse: collapse;
		font-family: var(--font-ui); font-size: 12px;
	}
	.cross-deal-table th {
		text-align: left; padding: 8px 10px;
		font-size: 10px; font-weight: 700; text-transform: uppercase;
		letter-spacing: 0.8px; color: var(--text-muted);
		border-bottom: 2px solid var(--border);
		white-space: nowrap;
	}
	.cross-deal-table td {
		padding: 10px; border-bottom: 1px solid var(--border-light);
		white-space: nowrap;
	}
	.cross-deal-table .col-deal { min-width: 150px; }
	.cross-deal-table .col-conv { text-align: center; min-width: 70px; font-weight: 600; }
	.cross-deal-table .col-vs { text-align: center; min-width: 90px; font-weight: 700; }
	.cross-deal-table .col-ac { min-width: 80px; }
	.row-highlight { background: rgba(81,190,123,0.06); }
	.deal-link {
		background: none; border: none; cursor: pointer; font-family: var(--font-ui);
		font-size: 12px; font-weight: 600; color: var(--primary); padding: 0;
		text-align: left;
	}
	.deal-link:hover { text-decoration: underline; }
	.sample-note-inline {
		font-size: 10px; color: var(--text-muted); cursor: help; font-weight: 400;
	}

	/* ====== RESPONSIVE ====== */
	@media (max-width: 768px) {
		.funnel-row { grid-template-columns: 80px 1fr 50px; gap: 8px; }
		.funnel-label { font-size: 11px; }
		.callout-row { flex-wrap: wrap; gap: 6px; }
		.callout-label { min-width: auto; }
		.deal-selector { gap: 6px; }
		.deal-chip { padding: 6px 10px; font-size: 12px; }
		.perf-controls { justify-content: center; }
		.benchmark-chart-wrap { height: 180px; }
		.section-header { flex-wrap: wrap; gap: 6px; }
		.section-header-right { margin-left: 0; }
	}
	@media (max-width: 480px) {
		.funnel-row { grid-template-columns: 65px 1fr 42px; gap: 4px; }
		.funnel-label { font-size: 10px; }
		.funnel-count { font-size: 10px; }
		.funnel-pct { font-size: 10px; }
		.callout-row { flex-direction: column; align-items: flex-start; }
		.benchmark-chart-wrap { height: 160px; }
		.cross-deal-table { font-size: 11px; }
	}
</style>
