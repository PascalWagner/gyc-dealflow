<script>
	import { onMount } from 'svelte';
	import { user, isLoggedIn, userToken } from '$lib/stores/auth.js';
	import { deals } from '$lib/stores/deals.js';
	import { browser } from '$app/environment';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';

	let Chart = $state(null);
	let charts = {};

	const analytics = $derived.by(() => {
		const DEALS = $deals || [];
		const now = new Date();
		const twelveMonthsAgo = new Date(now);
		twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
		const thirtyDaysAgo = new Date(now);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const dealsWithDates = DEALS.map(d => {
			const dateStr = d.addedDate || d.createdTime || '';
			const date = dateStr ? new Date(dateStr) : null;
			return { ...d, parsedDate: date };
		}).filter(d => d.parsedDate && !isNaN(d.parsedDate));

		// Monthly data
		const monthlyData = {};
		dealsWithDates.forEach(d => {
			if (d.parsedDate >= twelveMonthsAgo) {
				const key = d.parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
				monthlyData[key] = (monthlyData[key] || 0) + 1;
			}
		});

		// Sources
		const sources = { '506 Investors Group': 0, 'Capital Raiser Email List': 0, 'Turbine Capital': 0, 'GoBundance': 0, 'User Submission': 0, 'Direct / Other': 0 };
		dealsWithDates.forEach(d => {
			let s = d.dealSource || [];
			if (typeof s === 'string') s = [s];
			if (!Array.isArray(s)) s = [];
			let matched = false;
			s.forEach(src => { if (sources[src] !== undefined) { sources[src]++; matched = true; } });
			if (!matched) sources['Direct / Other']++;
		});

		// Asset classes
		const assetClasses = {};
		dealsWithDates.forEach(d => {
			let c = d.assetClass || [];
			if (typeof c === 'string') c = [c];
			c.forEach(cls => { assetClasses[cls] = (assetClasses[cls] || 0) + 1; });
		});
		const topAssetClasses = Object.entries(assetClasses).sort((a, b) => b[1] - a[1]).slice(0, 8);

		// Deal types
		const dealTypes = {};
		dealsWithDates.forEach(d => { const t = d.dealType || 'Unknown'; dealTypes[t] = (dealTypes[t] || 0) + 1; });

		// Weekly streak
		const weeklyData = {};
		const weekStart = new Date(twelveMonthsAgo);
		weekStart.setDate(weekStart.getDate() - weekStart.getDay());
		for (let d = new Date(weekStart); d <= now; d.setDate(d.getDate() + 7)) {
			weeklyData[d.toISOString().split('T')[0]] = 0;
		}
		dealsWithDates.forEach(d => {
			if (d.parsedDate >= twelveMonthsAgo) {
				const w = new Date(d.parsedDate);
				w.setDate(w.getDate() - w.getDay());
				const key = w.toISOString().split('T')[0];
				if (weeklyData[key] !== undefined) weeklyData[key]++;
			}
		});
		let streak = 0;
		const wv = Object.values(weeklyData);
		for (let i = wv.length - 1; i >= 0; i--) { if (wv[i] > 0) streak++; else break; }

		const recentDeals = dealsWithDates.filter(d => d.parsedDate >= thirtyDaysAgo).sort((a, b) => b.parsedDate - a.parsedDate).slice(0, 15);
		const last12 = dealsWithDates.filter(d => d.parsedDate >= twelveMonthsAgo).length;
		const monthLabels = Object.keys(monthlyData);

		return {
			totalDeals: DEALS.length, recentCount: recentDeals.length,
			avgPerMonth: monthLabels.length > 0 ? Math.round(last12 / monthLabels.length * 10) / 10 : 0,
			streak, monthLabels, monthValues: Object.values(monthlyData),
			sources, topAssetClasses, dealTypes, recentDeals,
			assetClassCount: Object.keys(assetClasses).length
		};
	});

	onMount(async () => {
		if (!browser) return;
		const mod = await import('chart.js/auto');
		Chart = mod.default || mod.Chart;
		renderCharts();
	});

	function renderCharts() {
		if (!Chart) return;
		const a = analytics;

		// Monthly bar
		const barEl = document.getElementById('dfBarChart');
		if (barEl) {
			if (charts.bar) charts.bar.destroy();
			charts.bar = new Chart(barEl, {
				type: 'bar',
				data: { labels: a.monthLabels, datasets: [{ label: 'New Deals', data: a.monthValues, backgroundColor: '#2C6E49', borderRadius: 4 }] },
				options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true }, x: { grid: { display: false } } } }
			});
		}

		// Source pie
		const srcLabels = Object.keys(a.sources).filter(k => a.sources[k] > 0);
		const srcValues = srcLabels.map(k => a.sources[k]);
		const srcEl = document.getElementById('dfSourceChart');
		if (srcEl) {
			if (charts.source) charts.source.destroy();
			charts.source = new Chart(srcEl, {
				type: 'doughnut',
				data: { labels: srcLabels, datasets: [{ data: srcValues, backgroundColor: ['#2C6E49','#4C956C','#FEFEE3','#D68C45','#3D405B','#8B5E3C'], borderWidth: 2, borderColor: '#fff' }] },
				options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } } }
			});
		}

		// Asset class pie
		const acEl = document.getElementById('dfAssetChart');
		if (acEl) {
			if (charts.asset) charts.asset.destroy();
			charts.asset = new Chart(acEl, {
				type: 'doughnut',
				data: { labels: a.topAssetClasses.map(e => e[0]), datasets: [{ data: a.topAssetClasses.map(e => e[1]), backgroundColor: ['#2C6E49','#4C956C','#D68C45','#3D405B','#8B5E3C','#6B8F71','#E8B960','#5B7065'], borderWidth: 2, borderColor: '#fff' }] },
				options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { font: { size: 11 }, boxWidth: 12 } } } }
			});
		}
	}

	$effect(() => { if (Chart && $deals) setTimeout(renderCharts, 50); });
</script>

<svelte:head><title>Deal Flow Stats | GYC</title></svelte:head>

<PageContainer className="deal-flow-stats-page">
<PageHeader
	title="Deal Flow Stats"
	subtitle="See how fast the database is growing. New deals are sourced weekly from marketplaces, networks, and direct submissions."
/>

<div class="stats-grid">
	<div class="stat-card">
		<div class="stat-label">Total Deals</div>
		<div class="stat-value">{analytics.totalDeals}</div>
	</div>
	<div class="stat-card">
		<div class="stat-label">Last 30 Days</div>
		<div class="stat-value accent">{analytics.recentCount}</div>
	</div>
	<div class="stat-card">
		<div class="stat-label">Avg / Month</div>
		<div class="stat-value">{analytics.avgPerMonth}</div>
	</div>
	<div class="stat-card">
		<div class="stat-label">Week Streak</div>
		<div class="stat-value orange">{analytics.streak}</div>
		<div class="stat-sub">consecutive weeks</div>
	</div>
</div>

<div class="chart-card">
	<h3>New Deals Added Per Month</h3>
	<p class="chart-sub">Last 12 months of deal sourcing activity</p>
	<div class="chart-container"><canvas id="dfBarChart"></canvas></div>
</div>

<div class="two-col">
	<div class="chart-card">
		<h3>Deal Sources</h3>
		<p class="chart-sub">Where deals are found</p>
		<div class="chart-container-sm"><canvas id="dfSourceChart"></canvas></div>
	</div>
	<div class="chart-card">
		<h3>Asset Classes</h3>
		<p class="chart-sub">Investment categories in the database</p>
		<div class="chart-container-sm"><canvas id="dfAssetChart"></canvas></div>
	</div>
</div>

<div class="two-col uneven">
	<div class="chart-card">
		<h3>Deal Types</h3>
		{#each Object.entries(analytics.dealTypes) as [type, count]}
			<div class="type-row">
				<span class="type-name">{type}</span>
				<span class="type-count">{count} ({Math.round(count / analytics.totalDeals * 100)}%)</span>
			</div>
		{/each}
	</div>
	<div class="chart-card">
		<h3>Recently Added Deals</h3>
		<div class="recent-table-wrap">
			<table class="recent-table">
				<thead><tr><th>Deal</th><th>Type</th><th>Asset Class</th><th class="text-right">Added</th></tr></thead>
				<tbody>
					{#each analytics.recentDeals as d}
						<tr>
							<td class="fw-600">{d.name || d.investmentName || '—'}</td>
							<td>{d.dealType || '—'}</td>
							<td>{Array.isArray(d.assetClass) ? (d.assetClass[0] || '—') : (d.assetClass || '—')}</td>
							<td class="text-right muted">{d.parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>

<div class="value-banner">
	<div class="banner-title">This database can't be rebuilt overnight.</div>
	<div class="banner-desc">With {analytics.totalDeals} deals tracked, {analytics.assetClassCount} asset classes, and new opportunities sourced weekly — this is the most comprehensive private placement database available to LP investors.</div>
</div>
</PageContainer>

<style>
	.stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
	.stat-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 20px; text-align: center; }
	.stat-label { font-family: var(--font-body); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
	.stat-value { font-family: var(--font-ui); font-size: 28px; font-weight: 800; color: var(--text-dark); }
	.stat-value.accent { color: #2C6E49; }
	.stat-value.orange { color: #D68C45; }
	.stat-sub { font-family: var(--font-body); font-size: 10px; color: var(--text-muted); }

	.chart-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 24px; margin: 0 0 24px; }
	.chart-card h3 { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin: 0 0 4px; }
	.chart-sub { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); margin: 0 0 16px; }
	.chart-container { height: 280px; }
	.chart-container-sm { height: 240px; }

	.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
	.two-col .chart-card { margin: 0; }
	.two-col.uneven { grid-template-columns: 1fr 2fr; }

	.type-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border-light); }
	.type-name { font-family: var(--font-ui); font-size: 13px; font-weight: 600; }
	.type-count { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }

	.recent-table-wrap { max-height: 300px; overflow-y: auto; }
	.recent-table { width: 100%; font-size: 12px; border-collapse: collapse; }
	.recent-table th { text-align: left; padding: 6px 8px; font-weight: 700; border-bottom: 2px solid var(--border-light); }
	.recent-table td { padding: 6px 8px; border-bottom: 1px solid var(--border-light); }
	.fw-600 { font-weight: 600; }
	.text-right { text-align: right; }
	.muted { color: var(--text-muted); }

		.value-banner {
			background: linear-gradient(135deg, #2C3E2D, #3D5A3E); border-radius: var(--radius-sm);
			padding: 24px; color: #fff; text-align: center; margin: 0 0 24px;
		}
	.banner-title { font-family: var(--font-ui); font-size: 18px; font-weight: 800; margin-bottom: 8px; }
	.banner-desc { font-family: var(--font-body); font-size: 13px; opacity: 0.85; }

	@media (min-width: 769px) and (max-width: 1024px) {
		.stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		.two-col, .two-col.uneven { grid-template-columns: 1fr; }
	}

	@media (max-width: 768px) {
		.two-col, .two-col.uneven { grid-template-columns: 1fr; }
		.chart-card { margin: 0 0 16px; }
		.value-banner { margin: 0 0 16px; }
	}
</style>
