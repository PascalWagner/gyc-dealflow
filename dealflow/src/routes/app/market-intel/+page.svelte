<script>
	import { onMount, onDestroy } from 'svelte';
	import { deals, fetchDeals } from '$lib/stores/deals.js';
	import { userTier, isAdmin, isAcademy } from '$lib/stores/auth.js';

	let activeTab = $state('sec');
	let charts = $state({});
	let secData = $state(null);
	let Chart;

	const isFree = $derived($userTier === 'free' && !$isAdmin);
	const totalDeals = $derived($deals.length);
	const activeDeals = $derived($deals.filter(d => !d.isStale));

	const totalCapital = $derived.by(() => {
		let cap = 0;
		activeDeals.forEach(d => { if (d.offeringSize && d.offeringSize > 0 && d.offeringSize < 1e12) cap += d.offeringSize; });
		return cap >= 1e9 ? '$' + (cap / 1e9).toFixed(1) + 'B' : '$' + (cap / 1e6).toFixed(0) + 'M';
	});

	// Helpers
	function median(arr) {
		if (!arr.length) return 0;
		const s = arr.slice().sort((a, b) => a - b);
		const mid = Math.floor(s.length / 2);
		return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
	}
	function countMap(arr) {
		const m = {};
		arr.forEach(v => { m[v] = (m[v] || 0) + 1; });
		return m;
	}
	function sortedEntries(obj) {
		return Object.entries(obj).sort((a, b) => b[1] - a[1]);
	}
	function groupByQuarter(dealArr) {
		const quarters = {};
		dealArr.forEach(d => {
			const dateStr = d.addedDate || d.createdTime || '';
			if (!dateStr) return;
			const dt = new Date(dateStr);
			if (isNaN(dt.getTime())) return;
			const q = 'Q' + (Math.floor(dt.getMonth() / 3) + 1) + ' ' + dt.getFullYear();
			if (!quarters[q]) quarters[q] = { deals: [], date: new Date(dt.getFullYear(), Math.floor(dt.getMonth() / 3) * 3, 1) };
			quarters[q].deals.push(d);
		});
		return Object.entries(quarters)
			.sort((a, b) => a[1].date - b[1].date)
			.map(e => ({ label: e[0], deals: e[1].deals }));
	}
	const chartColors = ['#51BE7B','#3B9DDD','#F59E0B','#EF4444','#8B5CF6','#EC4899','#14B8A6','#F97316','#6366F1','#84CC16','#06B6D4','#D946EF'];

	// Debt fund helpers
	const MONTH_LABELS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];
	const DEBT_COLORS = ['#51BE7B','#2563EB','#CF7A30','#D04040','#8B5CF6','#EC4899','#14B8A6','#F59E0B','#6366F1','#10B981','#EF4444','#3B82F6','#A855F7','#F97316','#06B6D4','#84CC16','#E11D48','#7C3AED','#0EA5E9','#22C55E'];
	let debtChartMetric = $state('yield');
	let highlightedDebtFunds = $state(new Set());
	let debtSortCol = $state('investmentName');
	let debtSortAsc = $state(true);
	let debtFinancials = $state('all');
	let debtAUM = $state('all');
	let debtPosition = $state('all');
	let debtDistribution = $state('all');
	let debtMinimum = $state('all');
	let debtYield = $state('all');
	let debtSearch = $state('');

	function generateMonthlyData(base, months, variance) {
		const data = [];
		let val = base;
		for (let i = 0; i < months; i++) {
			val += (Math.random() - 0.5) * variance;
			val = Math.max(0, val);
			data.push(parseFloat(val.toFixed(4)));
		}
		return data;
	}
	function generateYearReturn(irr, year) {
		if (!irr) return null;
		const base = irr;
		const jitter = (year - 2022) * 0.002 + (Math.random() - 0.5) * 0.01;
		return Math.max(0.02, base + jitter);
	}

	const debtFunds = $derived(
		$deals.filter(d => d.instrument === 'Debt' || d.strategy === 'Lending').map((f, i) => ({
			...f,
			_yieldData: generateMonthlyData((f.targetIRR || 0.09) * 100, 12, 0.3),
			_ltvData: generateMonthlyData((f.avgLoanLTV || 0.65) * 100, 12, 2),
			_leverageData: generateMonthlyData(f.avgLoanLTV ? (1 / (1 - f.avgLoanLTV)) : 1.8, 12, 0.15),
			_delinquencyData: generateMonthlyData(Math.random() * 3 + 0.5, 12, 0.4),
			_color: DEBT_COLORS[i % DEBT_COLORS.length],
			_return2025: generateYearReturn(f.targetIRR, 2025),
			_return2024: generateYearReturn(f.targetIRR, 2024),
			_return2023: generateYearReturn(f.targetIRR, 2023),
			_return2022: generateYearReturn(f.targetIRR, 2022)
		}))
	);

	const filteredDebtFunds = $derived.by(() => {
		return debtFunds.filter(f => {
			if (debtFinancials !== 'all' && f.financials !== debtFinancials) return false;
			if (debtAUM !== 'all') {
				const aum = f.fundAUM || 0;
				if (debtAUM === 'small' && aum >= 1e8) return false;
				if (debtAUM === 'mid' && (aum < 1e8 || aum >= 1e9)) return false;
				if (debtAUM === 'institutional' && aum < 1e9) return false;
			}
			if (debtPosition !== 'all' && f.debtPosition !== debtPosition) return false;
			if (debtDistribution !== 'all' && f.distributions !== debtDistribution) return false;
			if (debtMinimum !== 'all') {
				const max = parseInt(debtMinimum);
				if (f.investmentMinimum && f.investmentMinimum > max) return false;
			}
			if (debtYield !== 'all') {
				const minY = parseInt(debtYield) / 100;
				if (!f.targetIRR || f.targetIRR < minY) return false;
			}
			if (debtSearch) {
				const q = debtSearch.toLowerCase();
				if (!(f.investmentName || '').toLowerCase().includes(q) && !(f.managementCompany || '').toLowerCase().includes(q)) return false;
			}
			return true;
		});
	});

	function fmtAUM(v) {
		if (!v) return '--';
		if (v >= 1e9) return '$' + (v / 1e9).toFixed(1) + 'B';
		if (v >= 1e6) return '$' + (v / 1e6).toFixed(0) + 'M';
		return '$' + v.toLocaleString();
	}
	function fmtReturn(v) {
		if (!v) return '--';
		return (v * 100).toFixed(1) + '%';
	}
	function clearDebtFilters() {
		debtFinancials = 'all'; debtAUM = 'all'; debtPosition = 'all';
		debtDistribution = 'all'; debtMinimum = 'all'; debtYield = 'all'; debtSearch = '';
	}

	function destroyCharts() {
		Object.values(charts).forEach(c => { if (c?.destroy) c.destroy(); });
		charts = {};
	}

	async function loadChartJs() {
		if (Chart) return;
		const mod = await import('chart.js/auto');
		Chart = mod.default || mod.Chart;
	}

	async function renderSECCharts() {
		if (!secData || !Chart) return;
		const qs = secData.quarters || [];
		if (!qs.length) return;
		const labels = qs.map(q => q.label);
		const lineOpts = {
			responsive: true, maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: { y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } } },
			elements: { point: { radius: 3, hoverRadius: 5 }, line: { tension: 0.3 } }
		};

		await new Promise(r => setTimeout(r, 50));

		const c1 = document.getElementById('secNewFilingsChart');
		if (c1) charts.secNewFilings = new Chart(c1, { type: 'line', data: { labels, datasets: [{ label: 'New Filings', data: qs.map(q => q.new_filings), borderColor: '#3B9DDD', backgroundColor: '#3B9DDD22', fill: true, borderWidth: 2 }] }, options: lineOpts });

		const c2 = document.getElementById('secCapitalChart');
		if (c2) charts.secCapital = new Chart(c2, { type: 'bar', data: { labels, datasets: [{ label: 'Capital Sold', data: qs.map(q => q.capital_sold), backgroundColor: '#51BE7B', borderRadius: 4 }] }, options: { ...lineOpts, elements: {}, scales: { y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => '$' + (v / 1e12).toFixed(1) + 'T' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } } } } });

		const c3 = document.getElementById('sec506TrendChart');
		if (c3) charts.sec506 = new Chart(c3, { type: 'line', data: { labels, datasets: [{ label: '506(b)', data: qs.map(q => q.pct_506b), borderColor: '#F59E0B', fill: false, borderWidth: 2 }, { label: '506(c)', data: qs.map(q => q.pct_506c), borderColor: '#51BE7B', fill: false, borderWidth: 2 }] }, options: { ...lineOpts, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, usePointStyle: true, padding: 16 } } }, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } } } } });

		const c4 = document.getElementById('secEquityDebtChart');
		if (c4) charts.secEqDebt = new Chart(c4, { type: 'line', data: { labels, datasets: [{ label: 'Equity', data: qs.map(q => q.equity_count), borderColor: '#51BE7B', fill: false, borderWidth: 2 }, { label: 'Debt', data: qs.map(q => q.debt_count), borderColor: '#3B9DDD', fill: false, borderWidth: 2 }] }, options: { ...lineOpts, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, usePointStyle: true, padding: 16 } } } } });

		const c5 = document.getElementById('secIndustryChart');
		if (c5 && secData.top_industries) {
			const ind = Object.entries(secData.top_industries).slice(0, 12);
			charts.secIndustry = new Chart(c5, { type: 'bar', data: { labels: ind.map(e => e[0]), datasets: [{ data: ind.map(e => e[1]), backgroundColor: chartColors.slice(0, ind.length), borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } }, y: { grid: { display: false }, ticks: { font: { size: 10 } } } } } });
		}

		const c6 = document.getElementById('secREChart');
		if (c6) charts.secRE = new Chart(c6, { type: 'line', data: { labels, datasets: [{ label: 'RE Filings', data: qs.map(q => q.re_filings), borderColor: '#14B8A6', backgroundColor: '#14B8A622', fill: true, borderWidth: 2 }, { label: 'All Filings', data: qs.map(q => q.new_filings), borderColor: '#8B5CF644', fill: false, borderWidth: 1, borderDash: [4, 4] }] }, options: { ...lineOpts, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, usePointStyle: true, padding: 16 } } } } });

		const c7 = document.getElementById('secMinInvChart');
		if (c7) charts.secMinInv = new Chart(c7, { type: 'line', data: { labels, datasets: [{ label: 'Median Minimum', data: qs.map(q => q.median_min_investment), borderColor: '#8B5CF6', backgroundColor: '#8B5CF622', fill: true, borderWidth: 2 }] }, options: { ...lineOpts, scales: { y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => '$' + (v / 1000).toFixed(0) + 'K' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } } } } });

		const c8 = document.getElementById('secNonAccreditedChart');
		if (c8) charts.secNonAccr = new Chart(c8, { type: 'line', data: { labels, datasets: [{ label: '% with Non-Accredited', data: qs.map(q => q.pct_nonaccredited), borderColor: '#EC4899', backgroundColor: '#EC489922', fill: true, borderWidth: 2 }] }, options: { ...lineOpts, scales: { y: { min: 0, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => v + '%' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } } } } });
	}

	async function renderDealInsightCharts() {
		if (!Chart || !activeDeals.length) return;
		await new Promise(r => setTimeout(r, 50));
		const ds = activeDeals;
		const primary = '#51BE7B';
		const primaryLight = '#51BE7B44';
		const irrs = ds.filter(d => d.targetIRR && d.targetIRR > 0 && d.targetIRR < 2).map(d => d.targetIRR);
		const prefs = ds.filter(d => d.preferredReturn && d.preferredReturn > 0 && d.preferredReturn < 1).map(d => d.preferredReturn);
		const mins = ds.filter(d => d.investmentMinimum && d.investmentMinimum > 0).map(d => d.investmentMinimum);

		// IRR histogram
		const irrBuckets = { '<8%': 0, '8-12%': 0, '12-16%': 0, '16-20%': 0, '20-25%': 0, '25-30%': 0, '30%+': 0 };
		irrs.forEach(v => { const p = v * 100; if (p < 8) irrBuckets['<8%']++; else if (p < 12) irrBuckets['8-12%']++; else if (p < 16) irrBuckets['12-16%']++; else if (p < 20) irrBuckets['16-20%']++; else if (p < 25) irrBuckets['20-25%']++; else if (p < 30) irrBuckets['25-30%']++; else irrBuckets['30%+']++; });
		const c1 = document.getElementById('miIRRChart');
		if (c1) charts.irr = new Chart(c1, { type: 'bar', data: { labels: Object.keys(irrBuckets), datasets: [{ data: Object.values(irrBuckets), backgroundColor: primary, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false } } } } });

		// Asset class bar
		const acCounts = countMap(ds.filter(d => d.assetClass).map(d => d.assetClass));
		const acSorted = sortedEntries(acCounts).slice(0, 10);
		const c2 = document.getElementById('miAssetClassChart');
		if (c2) charts.assetClass = new Chart(c2, { type: 'bar', data: { labels: acSorted.map(e => e[0]), datasets: [{ data: acSorted.map(e => e[1]), backgroundColor: chartColors.slice(0, acSorted.length), borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } }, y: { grid: { display: false } } } } });

		// IRR by asset class
		const irrByAC = {};
		ds.forEach(d => { if (d.targetIRR && d.targetIRR > 0 && d.targetIRR < 2 && d.assetClass) { if (!irrByAC[d.assetClass]) irrByAC[d.assetClass] = []; irrByAC[d.assetClass].push(d.targetIRR); } });
		const irrACSorted = Object.entries(irrByAC).map(e => [e[0], e[1].reduce((a, b) => a + b, 0) / e[1].length, e[1].length]).filter(e => e[2] >= 3).sort((a, b) => b[1] - a[1]);
		const c3 = document.getElementById('miIRRByAssetChart');
		if (c3) charts.irrByAsset = new Chart(c3, { type: 'bar', data: { labels: irrACSorted.map(e => e[0] + ' (n=' + e[2] + ')'), datasets: [{ data: irrACSorted.map(e => (e[1] * 100).toFixed(1)), backgroundColor: irrACSorted.map((_, i) => chartColors[i % chartColors.length]), borderRadius: 4 }] }, options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw + '% avg IRR' } } }, scales: { x: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => v + '%' } }, y: { grid: { display: false } } } } });

		// LP/GP splits
		const splitCounts = countMap(ds.filter(d => d.lpGpSplit && /\d+\/\d+/.test(d.lpGpSplit)).map(d => d.lpGpSplit));
		const splitFiltered = sortedEntries(splitCounts).slice(0, 8);
		const c4 = document.getElementById('miSplitChart');
		if (c4) charts.split = new Chart(c4, { type: 'bar', data: { labels: splitFiltered.map(e => e[0]), datasets: [{ data: splitFiltered.map(e => e[1]), backgroundColor: splitFiltered.map((_, i) => chartColors[i % chartColors.length]), borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false } } } } });

		// Min investment doughnut
		const minBuckets = { 'Under $25K': 0, '$25K-$50K': 0, '$50K-$100K': 0, '$100K-$250K': 0, '$250K+': 0 };
		mins.forEach(m => { if (m < 25000) minBuckets['Under $25K']++; else if (m < 50000) minBuckets['$25K-$50K']++; else if (m < 100000) minBuckets['$50K-$100K']++; else if (m < 250000) minBuckets['$100K-$250K']++; else minBuckets['$250K+']++; });
		const c5 = document.getElementById('miMinChart');
		if (c5) charts.min = new Chart(c5, { type: 'doughnut', data: { labels: Object.keys(minBuckets), datasets: [{ data: Object.values(minBuckets), backgroundColor: chartColors.slice(0, 5), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 12, usePointStyle: true } } } } });

		// Distribution frequency
		const distCounts = countMap(ds.filter(d => d.distributions && d.distributions !== 'Unknown').map(d => d.distributions));
		const distSorted = sortedEntries(distCounts);
		const c6 = document.getElementById('miDistChart');
		if (c6) charts.dist = new Chart(c6, { type: 'doughnut', data: { labels: distSorted.map(e => e[0]), datasets: [{ data: distSorted.map(e => e[1]), backgroundColor: chartColors.slice(0, distSorted.length), borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 12, usePointStyle: true } } } } });

		// Audit doughnut
		const auditCounts = countMap(ds.filter(d => d.financials && d.financials !== 'Unknown').map(d => d.financials));
		const c7 = document.getElementById('miAuditChart');
		if (c7) charts.audit = new Chart(c7, { type: 'doughnut', data: { labels: Object.keys(auditCounts), datasets: [{ data: Object.values(auditCounts), backgroundColor: ['#EF4444', '#51BE7B'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 12, usePointStyle: true } } } } });

		// 506b vs 506c
		const b506 = ds.filter(d => d.is506b).length;
		const c506val = ds.length - b506;
		const c8 = document.getElementById('mi506Chart');
		if (c8) charts.filing = new Chart(c8, { type: 'doughnut', data: { labels: ['506(c) - Can advertise', '506(b) - Cannot advertise'], datasets: [{ data: [c506val, b506], backgroundColor: ['#51BE7B', '#F59E0B'], borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 12, usePointStyle: true } } } } });

		// Strategy
		const stratCounts = countMap(ds.filter(d => d.strategy).map(d => d.strategy));
		const stratSorted = sortedEntries(stratCounts);
		const c9 = document.getElementById('miStrategyChart');
		if (c9) charts.strategy = new Chart(c9, { type: 'bar', data: { labels: stratSorted.map(e => e[0]), datasets: [{ data: stratSorted.map(e => e[1]), backgroundColor: chartColors.slice(0, stratSorted.length), borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false } } } } });

		// Hold period
		const holds = ds.filter(d => d.holdPeriod && d.holdPeriod > 0 && d.holdPeriod <= 15).map(d => d.holdPeriod);
		const holdBuckets = { '1-2 yrs': 0, '3-4 yrs': 0, '5-6 yrs': 0, '7-8 yrs': 0, '9-10 yrs': 0, '10+ yrs': 0 };
		holds.forEach(h => { if (h <= 2) holdBuckets['1-2 yrs']++; else if (h <= 4) holdBuckets['3-4 yrs']++; else if (h <= 6) holdBuckets['5-6 yrs']++; else if (h <= 8) holdBuckets['7-8 yrs']++; else if (h <= 10) holdBuckets['9-10 yrs']++; else holdBuckets['10+ yrs']++; });
		const c10 = document.getElementById('miHoldChart');
		if (c10) charts.hold = new Chart(c10, { type: 'bar', data: { labels: Object.keys(holdBuckets), datasets: [{ data: Object.values(holdBuckets), backgroundColor: primary, borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false } } } } });

		// ========== TREND LINE CHARTS ==========
		const byQ = groupByQuarter(ds);
		const qLabels = byQ.map(q => q.label);
		const tLineOpts = {
			responsive: true, maintainAspectRatio: false,
			plugins: { legend: { display: false } },
			scales: { y: { beginAtZero: false, grid: { color: 'rgba(128,128,128,0.1)' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } } },
			elements: { point: { radius: 3, hoverRadius: 5 }, line: { tension: 0.3 } }
		};
		const tLineOptsZero = { ...tLineOpts, scales: { ...tLineOpts.scales, y: { ...tLineOpts.scales.y, beginAtZero: true } } };

		// Trend 1: New Offerings Per Quarter
		const newDealsCtx = document.getElementById('miNewDealsChart');
		if (newDealsCtx && byQ.length > 1) {
			charts.newDeals = new Chart(newDealsCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'New Deals', data: byQ.map(q => q.deals.length), borderColor: primary, backgroundColor: primaryLight, fill: true, borderWidth: 2 }] }, options: tLineOptsZero });
		}

		// Trend 2: Cumulative Capital Raised
		const cumCapCtx = document.getElementById('miCumCapitalChart');
		if (cumCapCtx && byQ.length > 1) {
			let cumCap = 0;
			const cumCapData = byQ.map(q => { q.deals.forEach(d => { const s = parseFloat(d.offeringSize) || 0; if (s > 0 && s < 1e12) cumCap += s; }); return cumCap; });
			charts.cumCapital = new Chart(cumCapCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'Cumulative Capital', data: cumCapData, borderColor: '#3B9DDD', backgroundColor: '#3B9DDD22', fill: true, borderWidth: 2 }] }, options: { ...tLineOpts, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '$' + (c.raw / 1e6).toFixed(0) + 'M' } } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => '$' + (v / 1e9).toFixed(1) + 'B' } }, x: { grid: { display: false }, ticks: { maxRotation: 45, font: { size: 10 } } } } } });
		}

		// Trend 3: Target IRR Over Time
		const irrTrendCtx = document.getElementById('miIRRTrendChart');
		if (irrTrendCtx && byQ.length > 1) {
			const irrTrendData = byQ.map(q => { const vals = q.deals.filter(d => d.targetIRR && d.targetIRR > 0 && d.targetIRR < 2).map(d => d.targetIRR); return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length * 100) : null; });
			charts.irrTrend = new Chart(irrTrendCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'Avg Target IRR', data: irrTrendData, borderColor: '#EF4444', backgroundColor: '#EF444422', fill: true, borderWidth: 2, spanGaps: true }] }, options: { ...tLineOpts, scales: { y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => v.toFixed(0) + '%' } }, x: tLineOpts.scales.x }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw.toFixed(1) + '% avg IRR' } } } } });
		}

		// Trend 4: Preferred Return Over Time
		const prefTrendCtx = document.getElementById('miPrefTrendChart');
		if (prefTrendCtx && byQ.length > 1) {
			const prefTrendData = byQ.map(q => { const vals = q.deals.filter(d => d.preferredReturn && d.preferredReturn > 0 && d.preferredReturn < 1).map(d => d.preferredReturn); return vals.length >= 2 ? (vals.reduce((a, b) => a + b, 0) / vals.length * 100) : null; });
			charts.prefTrend = new Chart(prefTrendCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'Avg Pref Return', data: prefTrendData, borderColor: '#F59E0B', backgroundColor: '#F59E0B22', fill: true, borderWidth: 2, spanGaps: true }] }, options: { ...tLineOpts, scales: { y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => v.toFixed(1) + '%' } }, x: tLineOpts.scales.x }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw.toFixed(1) + '% avg pref' } } } } });
		}

		// Trend 5: Average Minimum Investment
		const minTrendCtx = document.getElementById('miMinTrendChart');
		if (minTrendCtx && byQ.length > 1) {
			const minTrendData = byQ.map(q => { const vals = q.deals.filter(d => d.investmentMinimum && d.investmentMinimum > 0).map(d => d.investmentMinimum); return vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null; });
			charts.minTrend = new Chart(minTrendCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'Avg Minimum', data: minTrendData, borderColor: '#8B5CF6', backgroundColor: '#8B5CF622', fill: true, borderWidth: 2, spanGaps: true }] }, options: { ...tLineOpts, scales: { y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => '$' + (v / 1000).toFixed(0) + 'K' } }, x: tLineOpts.scales.x }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '$' + (c.raw / 1000).toFixed(0) + 'K avg minimum' } } } } });
		}

		// Trend 6: Average Offering Size
		const offerTrendCtx = document.getElementById('miOfferSizeTrendChart');
		if (offerTrendCtx && byQ.length > 1) {
			const offerTrendData = byQ.map(q => { const vals = q.deals.filter(d => { const s = parseFloat(d.offeringSize) || 0; return s > 0 && s < 1e12; }).map(d => parseFloat(d.offeringSize)); return vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : null; });
			charts.offerTrend = new Chart(offerTrendCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'Avg Offering Size', data: offerTrendData, borderColor: '#EC4899', backgroundColor: '#EC489922', fill: true, borderWidth: 2, spanGaps: true }] }, options: { ...tLineOpts, scales: { y: { grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => '$' + (v / 1e6).toFixed(0) + 'M' } }, x: tLineOpts.scales.x }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '$' + (c.raw / 1e6).toFixed(1) + 'M avg size' } } } } });
		}

		// Trend 7: Multi-Family Market Share
		const mfShareCtx = document.getElementById('miMFShareChart');
		if (mfShareCtx && byQ.length > 1) {
			const mfShareData = byQ.map(q => { if (q.deals.length < 3) return null; const mf = q.deals.filter(d => d.assetClass === 'Multi-Family').length; return (mf / q.deals.length * 100); });
			charts.mfShare = new Chart(mfShareCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'Multi-Family %', data: mfShareData, borderColor: '#14B8A6', backgroundColor: '#14B8A622', fill: true, borderWidth: 2, spanGaps: true }] }, options: { ...tLineOpts, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => v + '%' } }, x: tLineOpts.scales.x }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw.toFixed(0) + '% multi-family' } } } } });
		}

		// Trend 8: 506(b) Share Over Time
		const t506Ctx = document.getElementById('mi506TrendDealChart');
		if (t506Ctx && byQ.length > 1) {
			const t506Data = byQ.map(q => { if (q.deals.length < 3) return null; const b = q.deals.filter(d => d.is506b).length; return (b / q.deals.length * 100); });
			charts.t506 = new Chart(t506Ctx, { type: 'line', data: { labels: qLabels, datasets: [{ label: '506(b) %', data: t506Data, borderColor: '#F97316', backgroundColor: '#F9731622', fill: true, borderWidth: 2, spanGaps: true }] }, options: { ...tLineOpts, scales: { y: { min: 0, max: 100, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => v + '%' } }, x: tLineOpts.scales.x }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw.toFixed(0) + '% are 506(b)' } } } } });
		}

		// Trend 9: Lending vs Equity (stacked area)
		const lendEqCtx = document.getElementById('miLendVsEquityChart');
		if (lendEqCtx && byQ.length > 1) {
			const lendingData = byQ.map(q => q.deals.filter(d => d.strategy === 'Lending').length);
			const equityData = byQ.map(q => q.deals.filter(d => d.strategy && d.strategy !== 'Lending').length);
			charts.lendEq = new Chart(lendEqCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'Lending', data: lendingData, borderColor: '#3B9DDD', backgroundColor: '#3B9DDD44', fill: true, borderWidth: 2 }, { label: 'Equity / Other', data: equityData, borderColor: '#51BE7B', backgroundColor: '#51BE7B44', fill: true, borderWidth: 2 }] }, options: { ...tLineOptsZero, plugins: { legend: { display: true, position: 'top', labels: { font: { size: 11 }, usePointStyle: true, padding: 16 } } } } });
		}

		// Trend 10: Audit Rate Over Time
		const auditTrendCtx = document.getElementById('miAuditTrendChart');
		if (auditTrendCtx && byQ.length > 1) {
			const auditTrendData = byQ.map(q => { const withFin = q.deals.filter(d => d.financials && d.financials !== 'Unknown'); if (withFin.length < 3) return null; const aud = withFin.filter(d => d.financials === 'Audited').length; return (aud / withFin.length * 100); });
			charts.auditTrend = new Chart(auditTrendCtx, { type: 'line', data: { labels: qLabels, datasets: [{ label: 'Audit Rate', data: auditTrendData, borderColor: '#EF4444', backgroundColor: '#EF444422', fill: true, borderWidth: 2, spanGaps: true }] }, options: { ...tLineOpts, scales: { y: { min: 0, grid: { color: 'rgba(128,128,128,0.1)' }, ticks: { callback: v => v + '%' } }, x: tLineOpts.scales.x }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.raw.toFixed(0) + '% audited' } } } } });
		}
	}

	async function renderDebtChart() {
		if (!Chart) return;
		await new Promise(r => setTimeout(r, 50));
		if (charts.debtFund?.destroy) charts.debtFund.destroy();
		const ctx = document.getElementById('debtFundChart');
		if (!ctx) return;
		const funds = filteredDebtFunds;
		if (!funds.length) return;
		const metricKeys = { yield: '_yieldData', delinquency: '_delinquencyData', ltv: '_ltvData', leverage: '_leverageData' };
		const metricLabels = { yield: 'Yield (%)', delinquency: 'Delinquency Rate (%)', ltv: 'Loan-to-Value (%)', leverage: 'Leverage Ratio (x)' };
		const key = metricKeys[debtChartMetric] || '_yieldData';
		const datasets = funds.map(f => {
			const isHL = highlightedDebtFunds.has(f.id);
			const anyHL = highlightedDebtFunds.size > 0;
			return { label: f.investmentName, data: f[key], borderColor: anyHL ? (isHL ? f._color : 'rgba(200,200,200,0.25)') : f._color, backgroundColor: 'transparent', borderWidth: anyHL ? (isHL ? 3 : 1) : 2, pointRadius: anyHL ? (isHL ? 4 : 0) : 2, tension: 0.3 };
		});
		charts.debtFund = new Chart(ctx, { type: 'line', data: { labels: MONTH_LABELS, datasets }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => c.dataset.label + ': ' + c.parsed.y.toFixed(2) + '%' } } }, scales: { x: { grid: { display: false } }, y: { min: debtChartMetric === 'yield' ? 0 : undefined, max: debtChartMetric === 'yield' ? 40 : undefined, title: { display: true, text: metricLabels[debtChartMetric] || 'Yield (%)' }, grid: { color: 'rgba(0,0,0,0.05)' }, ticks: { callback: v => v.toFixed(1) + '%' } } } } });
	}

	async function renderDealFlowCharts() {
		if (!Chart || !$deals.length) return;
		await new Promise(r => setTimeout(r, 50));
		const now = new Date();
		const twelveMonthsAgo = new Date(now);
		twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

		const dealsWithDates = $deals.map(d => {
			const dateStr = d.addedDate || d.createdTime || '';
			const date = dateStr ? new Date(dateStr) : null;
			return { ...d, parsedDate: date };
		}).filter(d => d.parsedDate && !isNaN(d.parsedDate));

		// Monthly aggregation
		const monthlyData = {};
		dealsWithDates.forEach(d => {
			if (d.parsedDate >= twelveMonthsAgo) {
				const key = d.parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
				monthlyData[key] = (monthlyData[key] || 0) + 1;
			}
		});
		const monthLabels = Object.keys(monthlyData);
		const monthValues = Object.values(monthlyData);

		const barCtx = document.getElementById('dealFlowBarChart');
		if (barCtx && monthLabels.length) {
			charts.dfBar = new Chart(barCtx, { type: 'bar', data: { labels: monthLabels, datasets: [{ label: 'New Deals', data: monthValues, backgroundColor: '#2C6E49', borderRadius: 4, barThickness: 'flex' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } }, x: { grid: { display: false } } } } });
		}

		// Source distribution
		const knownSources = { '506 Investors Group': 0, 'Capital Raiser Email List': 0, 'Turbine Capital': 0, 'GoBundance': 0, 'User Submission': 0, 'Direct / Other': 0 };
		dealsWithDates.forEach(d => {
			let sources = d.dealSource || [];
			if (typeof sources === 'string') sources = [sources];
			if (!Array.isArray(sources)) sources = [];
			if (sources.length === 0) { knownSources['Direct / Other']++; }
			else {
				let matched = false;
				sources.forEach(s => { if (knownSources[s] !== undefined) { knownSources[s]++; matched = true; } });
				if (!matched) knownSources['Direct / Other']++;
			}
		});
		dealsWithDates.forEach(d => { if (d.submittor && !['Raven Ryan Abano Camins', ''].includes(d.submittor)) knownSources['User Submission']++; });

		const sourceLabels = Object.keys(knownSources).filter(k => knownSources[k] > 0);
		const sourceValues = sourceLabels.map(k => knownSources[k]);
		const sourceColors = ['#2C6E49', '#4C956C', '#FEFEE3', '#D68C45', '#3D405B', '#8B5E3C'];

		const pieCtx = document.getElementById('dealSourcePieChart');
		if (pieCtx) {
			charts.dfSource = new Chart(pieCtx, { type: 'doughnut', data: { labels: sourceLabels, datasets: [{ data: sourceValues, backgroundColor: sourceColors.slice(0, sourceLabels.length), borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 10, usePointStyle: true } } } } });
		}

		// Asset class distribution
		const assetClasses = {};
		dealsWithDates.forEach(d => {
			let classes = d.assetClass || [];
			if (typeof classes === 'string') classes = [classes];
			if (!Array.isArray(classes)) classes = [];
			classes.forEach(c => { assetClasses[c] = (assetClasses[c] || 0) + 1; });
		});
		const topAssetClasses = Object.entries(assetClasses).sort((a, b) => b[1] - a[1]).slice(0, 8);

		const acPieCtx = document.getElementById('dealAssetPieChart');
		if (acPieCtx && topAssetClasses.length) {
			charts.dfAsset = new Chart(acPieCtx, { type: 'doughnut', data: { labels: topAssetClasses.map(e => e[0]), datasets: [{ data: topAssetClasses.map(e => e[1]), backgroundColor: chartColors.slice(0, topAssetClasses.length), borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { font: { size: 11 }, padding: 10, usePointStyle: true } } } } });
		}
	}

	// Summary stats for deal insights
	const dealInsightStats = $derived.by(() => {
		const ds = activeDeals;
		const irrs = ds.filter(d => d.targetIRR && d.targetIRR > 0 && d.targetIRR < 2).map(d => d.targetIRR);
		const prefs = ds.filter(d => d.preferredReturn && d.preferredReturn > 0 && d.preferredReturn < 1).map(d => d.preferredReturn);
		const mins = ds.filter(d => d.investmentMinimum && d.investmentMinimum > 0).map(d => d.investmentMinimum);
		const splitCounts = countMap(ds.filter(d => d.lpGpSplit && /\d+\/\d+/.test(d.lpGpSplit)).map(d => d.lpGpSplit));
		const topSplits = sortedEntries(splitCounts);
		const audited = ds.filter(d => d.financials === 'Audited').length;
		const withFin = ds.filter(d => d.financials && d.financials !== 'Unknown').length;
		const acCounts = countMap(ds.filter(d => d.assetClass).map(d => d.assetClass));
		const b506 = ds.filter(d => d.is506b).length;
		return {
			medIRR: (median(irrs) * 100).toFixed(1) + '%',
			irrRange: irrs.length ? (Math.min(...irrs) * 100).toFixed(0) + '% - ' + (Math.max(...irrs) * 100).toFixed(0) + '%' : '',
			medPref: (median(prefs) * 100).toFixed(1) + '%',
			prefCount: prefs.length,
			medMin: median(mins) >= 1000 ? '$' + (median(mins) / 1000).toFixed(0) + 'K' : '$' + median(mins),
			minCount: mins.length,
			topSplit: topSplits.length ? topSplits[0][0] : '--',
			splitNote: topSplits.length ? topSplits[0][1] + ' deals (' + Math.round(topSplits[0][1] / ds.length * 100) + '%)' : '',
			auditPct: withFin ? Math.round(audited / withFin * 100) + '%' : '--',
			auditNote: audited + ' of ' + withFin + ' deals audited',
			b506Pct: ds.length ? Math.round(b506 / ds.length * 100) : 0,
			mfPct: acCounts['Multi-Family'] ? Math.round(acCounts['Multi-Family'] / ds.length * 100) : 0,
			irrs,
			mins,
			audited,
			withFin
		};
	});

	// Key insights for deal insights tab
	const keyInsights = $derived.by(() => {
		const s = dealInsightStats;
		if (!s) return [];
		return [
			{ title: 'Only ' + s.auditPct + ' of deals are audited', body: 'Out of ' + s.withFin + ' deals with financial data, just ' + s.audited + ' have audited financials. Always ask your sponsor if their books are audited by a third party.' },
			{ title: '70/30 is the new 80/20', body: 'The most common LP/GP profit split is now 70/30, meaning the sponsor keeps 30% of profits above the preferred return. Negotiate for 80/20 when you can.' },
			{ title: 'Median IRR: ' + s.medIRR, body: 'Across ' + s.irrs.length + ' deals, the median target IRR is ' + s.medIRR + '. Be skeptical of anything promising 25%+ unless it is a development or value-add strategy.' },
			{ title: s.b506Pct + '% are 506(b) offerings', body: '506(b) deals cannot legally advertise. If you see one promoted on social media, that is a compliance red flag worth investigating.' },
			{ title: 'Most deals need $50K-$100K', body: Math.round(s.mins.filter(m => m >= 50000 && m < 100000).length / (s.mins.length || 1) * 100) + '% of deals have minimums in the $50K-$100K range. Start with lower-minimum debt funds if you are newer.' },
			{ title: 'Multi-Family is ' + s.mfPct + '% of the market', body: 'Nearly ' + s.mfPct + '% of all private offerings are multifamily. Consider diversifying into self-storage, industrial, or lending.' }
		];
	});

	// SEC summary stats
	const secStats = $derived.by(() => {
		if (!secData) return {};
		const qs = secData.quarters || [];
		if (!qs.length) return {};
		const last = qs[qs.length - 1];
		const totalCap = qs.reduce((a, q) => a + q.capital_sold, 0);
		const totalRE = qs.reduce((a, q) => a + q.re_filings, 0);
		return {
			totalFilings: secData.total_filings?.toLocaleString() || '--',
			totalCapital: '$' + (totalCap / 1e12).toFixed(1) + 'T',
			pct506b: last.pct_506b + '%',
			medianMin: '$' + (last.median_min_investment / 1000).toFixed(0) + 'K',
			reFilings: totalRE.toLocaleString()
		};
	});

	// Debt fund summary stats
	const debtStats = $derived.by(() => {
		const funds = filteredDebtFunds;
		const yields = funds.filter(f => f.targetIRR).map(f => f.targetIRR * 100);
		const avgYield = yields.length ? (yields.reduce((a, b) => a + b, 0) / yields.length).toFixed(1) : '--';
		const ltvs = funds.filter(f => f.avgLoanLTV).map(f => f.avgLoanLTV > 1 ? f.avgLoanLTV : f.avgLoanLTV * 100);
		const avgLTV = ltvs.length ? (ltvs.reduce((a, b) => a + b, 0) / ltvs.length).toFixed(0) : '--';
		const totalAUM = funds.filter(f => f.fundAUM).reduce((a, f) => a + f.fundAUM, 0);
		return { count: funds.length, total: debtFunds.length, avgYield, avgLTV, totalAUM: fmtAUM(totalAUM) };
	});

	// Deal flow stats
	const dealFlowStats = $derived.by(() => {
		const now = new Date();
		const twelveMonthsAgo = new Date(now);
		twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
		const thirtyDaysAgo = new Date(now);
		thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

		const dealsWithDates = $deals.map(d => {
			const dateStr = d.addedDate || d.createdTime || '';
			const date = dateStr ? new Date(dateStr) : null;
			return { ...d, parsedDate: date };
		}).filter(d => d.parsedDate && !isNaN(d.parsedDate));

		const recentDeals = dealsWithDates.filter(d => d.parsedDate >= thirtyDaysAgo);
		const last12 = dealsWithDates.filter(d => d.parsedDate >= twelveMonthsAgo).length;

		// Monthly data for avg
		const monthlyData = {};
		dealsWithDates.forEach(d => {
			if (d.parsedDate >= twelveMonthsAgo) {
				const key = d.parsedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
				monthlyData[key] = (monthlyData[key] || 0) + 1;
			}
		});
		const monthCount = Object.keys(monthlyData).length;
		const avgPerMonth = monthCount > 0 ? Math.round(last12 / monthCount * 10) / 10 : 0;

		// Week streak
		const weekStart = new Date(twelveMonthsAgo);
		weekStart.setDate(weekStart.getDate() - weekStart.getDay());
		const weeklyData = {};
		for (let d = new Date(weekStart); d <= now; d.setDate(d.getDate() + 7)) {
			weeklyData[d.toISOString().split('T')[0]] = 0;
		}
		dealsWithDates.forEach(d => {
			if (d.parsedDate >= twelveMonthsAgo) {
				const weekOf = new Date(d.parsedDate);
				weekOf.setDate(weekOf.getDate() - weekOf.getDay());
				const key = weekOf.toISOString().split('T')[0];
				if (weeklyData[key] !== undefined) weeklyData[key]++;
			}
		});
		const weekVals = Object.values(weeklyData);
		let streak = 0;
		for (let i = weekVals.length - 1; i >= 0; i--) {
			if (weekVals[i] > 0) streak++;
			else break;
		}

		// Deal types
		const dealTypes = {};
		dealsWithDates.forEach(d => { const t = d.dealType || 'Unknown'; dealTypes[t] = (dealTypes[t] || 0) + 1; });

		// Asset classes count
		const assetClasses = {};
		dealsWithDates.forEach(d => {
			let classes = d.assetClass || [];
			if (typeof classes === 'string') classes = [classes];
			if (!Array.isArray(classes)) classes = [];
			classes.forEach(c => { assetClasses[c] = (assetClasses[c] || 0) + 1; });
		});

		return {
			totalDeals: $deals.length,
			recentCount: recentDeals.length,
			avgPerMonth,
			streak,
			dealTypes: Object.entries(dealTypes).sort((a, b) => b[1] - a[1]),
			assetClassCount: Object.keys(assetClasses).length,
			recentDeals: recentDeals.sort((a, b) => b.parsedDate - a.parsedDate).slice(0, 15)
		};
	});

	let tabsRendered = $state({ sec: false, deals: false, dealflow: false, debtfunds: false });

	async function switchTab(tab) {
		activeTab = tab;
		if (tab === 'sec' && !tabsRendered.sec) {
			tabsRendered.sec = true;
			try {
				const res = await fetch('/data/sec-market-data.json');
				secData = await res.json();
			} catch (e) { console.warn('SEC data not available:', e.message); }
			await renderSECCharts();
		}
		if (tab === 'deals' && !tabsRendered.deals) {
			tabsRendered.deals = true;
			await renderDealInsightCharts();
		}
		if (tab === 'dealflow' && !tabsRendered.dealflow) {
			tabsRendered.dealflow = true;
			await renderDealFlowCharts();
		}
		if (tab === 'debtfunds' && !tabsRendered.debtfunds) {
			tabsRendered.debtfunds = true;
			await renderDebtChart();
		}
	}

	onMount(async () => {
		await fetchDeals();
		await loadChartJs();
		switchTab('sec');
	});

	onDestroy(() => { destroyCharts(); });
</script>

<div class="mi-page">
	<div class="mi-header">
		<h1>Market Intelligence</h1>
		<p>Market-wide data from <strong>{secStats?.totalFilings || '730,640'}</strong> SEC Form D filings combined with deal-level insights from <strong>{totalDeals.toLocaleString()}</strong> offerings we've reviewed (totaling <strong>{totalCapital}</strong> in capital).</p>
	</div>

	<!-- Tab Bar -->
	<div class="mi-tab-bar">
		{#each [['sec','Market Intel'],['deals','Deal Insights'],['dealflow','Deal Flow'],['debtfunds','Debt Funds']] as [id, label]}
			<button class="mi-tab-btn" class:active={activeTab === id} onclick={() => switchTab(id)}>{label}</button>
		{/each}
	</div>

	<!-- Gate overlay for free users -->
	{#if isFree}
		<div class="mi-gate-overlay">
			<div class="mi-gate-card">
				<div class="mi-gate-icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M18 20V10"/><path d="M12 20V4"/><path d="M6 20v-6"/></svg></div>
				<h2>Unlock Full Market Intelligence</h2>
				<p>Get SEC filing trends, asset class benchmarks, deal flow analytics, and more with Academy membership.</p>
				<a href="/app/academy">Join Academy &rarr;</a>
			</div>
		</div>
	{/if}

	<!-- SEC Tab -->
	{#if activeTab === 'sec'}
		<div class="mi-section">
			<div class="mi-section-header">
				<span class="mi-badge blue">Entire Market</span>
				<h2>SEC Form D Filings -- All Private Placements</h2>
			</div>
			<p class="mi-section-desc">Every Regulation D filing since 2008 -- this is the entire U.S. private placement market, not just our database.</p>
			<div class="stat-cards">
				<div class="stat-card"><div class="stat-label">Total Form D Filings</div><div class="stat-value">{secStats?.totalFilings || '--'}</div><div class="stat-sub">Since Q3 2008</div></div>
				<div class="stat-card"><div class="stat-label">Capital Raised</div><div class="stat-value">{secStats?.totalCapital || '--'}</div><div class="stat-sub">Total amount sold</div></div>
				<div class="stat-card"><div class="stat-label">506(b) Share</div><div class="stat-value">{secStats?.pct506b || '--'}</div><div class="stat-sub">Latest quarter</div></div>
				<div class="stat-card"><div class="stat-label">Median Minimum</div><div class="stat-value">{secStats?.medianMin || '--'}</div><div class="stat-sub">Across all filings</div></div>
				<div class="stat-card"><div class="stat-label">Real Estate Filings</div><div class="stat-value">{secStats?.reFilings || '--'}</div><div class="stat-sub">RE + Commercial + Residential</div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>New Form D Filings Per Quarter</h3><p>The pace of new private offerings entering the U.S. market</p><div class="chart-wrap"><canvas id="secNewFilingsChart"></canvas></div></div>
				<div class="chart-card"><h3>Capital Raised Per Quarter</h3><p>Total dollars flowing into private placements each quarter</p><div class="chart-wrap"><canvas id="secCapitalChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>506(b) vs 506(c) -- Market Share</h3><p>Is the market shifting toward publicly-marketed offerings?</p><div class="chart-wrap"><canvas id="sec506TrendChart"></canvas></div></div>
				<div class="chart-card"><h3>Equity vs Debt Offerings</h3><p>The rise of debt strategies across the entire market</p><div class="chart-wrap"><canvas id="secEquityDebtChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Top Industries by Filing Volume</h3><p>Where private capital is concentrating</p><div class="chart-wrap tall"><canvas id="secIndustryChart"></canvas></div></div>
				<div class="chart-card"><h3>Real Estate Filings Over Time</h3><p>RE private placement activity vs the broader market</p><div class="chart-wrap"><canvas id="secREChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Median Minimum Investment</h3><p>How accessible is the private market getting?</p><div class="chart-wrap"><canvas id="secMinInvChart"></canvas></div></div>
				<div class="chart-card"><h3>Non-Accredited Investor Access</h3><p>% of filings accepting non-accredited investors</p><div class="chart-wrap"><canvas id="secNonAccreditedChart"></canvas></div></div>
			</div>
		</div>
	{/if}

	<!-- Deal Insights Tab -->
	{#if activeTab === 'deals'}
		<div class="mi-section">
			<div class="mi-section-header">
				<span class="mi-badge green">Our Database</span>
				<h2>Deal-Level Insights From Reviewed Offerings</h2>
			</div>
			<p class="mi-section-desc">Data the SEC doesn't track -- actual target returns, pref returns, fee structures, and LP/GP splits from term sheets we've reviewed.</p>
			<div class="stat-cards">
				<div class="stat-card"><div class="stat-label">Median Target IRR</div><div class="stat-value">{dealInsightStats?.medIRR || '--'}</div><div class="stat-sub">Range: {dealInsightStats?.irrRange}</div></div>
				<div class="stat-card"><div class="stat-label">Median Pref Return</div><div class="stat-value">{dealInsightStats?.medPref || '--'}</div><div class="stat-sub">{dealInsightStats?.prefCount} deals report a pref</div></div>
				<div class="stat-card"><div class="stat-label">Median Minimum</div><div class="stat-value">{dealInsightStats?.medMin || '--'}</div><div class="stat-sub">{dealInsightStats?.minCount} deals with minimums</div></div>
				<div class="stat-card"><div class="stat-label">Most Common Split</div><div class="stat-value">{dealInsightStats?.topSplit || '--'}</div><div class="stat-sub">{dealInsightStats?.splitNote}</div></div>
				<div class="stat-card"><div class="stat-label">Audited Financials</div><div class="stat-value">{dealInsightStats?.auditPct || '--'}</div><div class="stat-sub">{dealInsightStats?.auditNote}</div></div>
			</div>

			<!-- Distribution Charts -->
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Target IRR Distribution</h3><p>What sponsors are promising across {activeDeals.filter(d => d.targetIRR && d.targetIRR > 0).length} deals</p><div class="chart-wrap"><canvas id="miIRRChart"></canvas></div></div>
				<div class="chart-card"><h3>Deals by Asset Class</h3><p>Multi-Family dominates but alternatives are growing</p><div class="chart-wrap"><canvas id="miAssetClassChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Avg Target IRR by Asset Class</h3><p>Higher returns come with higher risk</p><div class="chart-wrap tall"><canvas id="miIRRByAssetChart"></canvas></div></div>
				<div class="chart-card"><h3>LP/GP Profit Splits</h3><p>70/30 has overtaken 80/20 as the new standard</p><div class="chart-wrap tall"><canvas id="miSplitChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Minimum Investment Tiers</h3><p>Most deals require $50K-$100K to get in</p><div class="chart-wrap"><canvas id="miMinChart"></canvas></div></div>
				<div class="chart-card"><h3>Distribution Frequency</h3><p>How often sponsors pay you back</p><div class="chart-wrap"><canvas id="miDistChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Financial Audit Status</h3><p>Only a small fraction of sponsors get audited</p><div class="chart-wrap"><canvas id="miAuditChart"></canvas></div></div>
				<div class="chart-card"><h3>506(b) vs 506(c) Offerings</h3><p>Can the deal legally advertise to you?</p><div class="chart-wrap"><canvas id="mi506Chart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Investment Strategy</h3><p>Lending and Value-Add dominate the market</p><div class="chart-wrap"><canvas id="miStrategyChart"></canvas></div></div>
				<div class="chart-card"><h3>Hold Period Distribution</h3><p>How long your money is locked up</p><div class="chart-wrap"><canvas id="miHoldChart"></canvas></div></div>
			</div>

			<!-- Trend Charts Section -->
			<div class="trend-section-header">
				<h2>Trends Over Time</h2>
				<p>How deal terms and market dynamics are shifting quarter by quarter.</p>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>New Offerings Per Quarter</h3><p>How fast the deal pipeline is growing</p><div class="chart-wrap"><canvas id="miNewDealsChart"></canvas></div></div>
				<div class="chart-card"><h3>Cumulative Capital Raised</h3><p>Total capital tracked in the database over time</p><div class="chart-wrap"><canvas id="miCumCapitalChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Average Target IRR Over Time</h3><p>Are sponsors lowering their promises?</p><div class="chart-wrap"><canvas id="miIRRTrendChart"></canvas></div></div>
				<div class="chart-card"><h3>Average Pref Return Over Time</h3><p>Preferred return trends across the market</p><div class="chart-wrap"><canvas id="miPrefTrendChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Average Minimum Investment</h3><p>Are deals getting more or less accessible?</p><div class="chart-wrap"><canvas id="miMinTrendChart"></canvas></div></div>
				<div class="chart-card"><h3>Average Offering Size</h3><p>How large are deals getting?</p><div class="chart-wrap"><canvas id="miOfferSizeTrendChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Multi-Family Market Share</h3><p>Is the multifamily dominance increasing or waning?</p><div class="chart-wrap"><canvas id="miMFShareChart"></canvas></div></div>
				<div class="chart-card"><h3>506(b) Share Over Time</h3><p>Percentage of 506(b) filings in our database</p><div class="chart-wrap"><canvas id="mi506TrendDealChart"></canvas></div></div>
			</div>
			<div class="chart-grid-2">
				<div class="chart-card"><h3>Lending vs Equity Deals</h3><p>The rise of private lending in real estate</p><div class="chart-wrap"><canvas id="miLendVsEquityChart"></canvas></div></div>
				<div class="chart-card"><h3>Audit Rate Over Time</h3><p>Are more sponsors getting audited?</p><div class="chart-wrap"><canvas id="miAuditTrendChart"></canvas></div></div>
			</div>

			<!-- Key Insights -->
			{#if keyInsights.length}
				<div class="insights-section">
					<h2>Key Insights</h2>
					<div class="insights-grid">
						{#each keyInsights as insight}
							<div class="insight-card">
								<div class="insight-title">{insight.title}</div>
								<div class="insight-body">{insight.body}</div>
							</div>
						{/each}
					</div>
				</div>
			{/if}

			<div class="mi-disclaimer">Data sourced from GYC deal database. This is market research, not investment advice. Past performance does not guarantee future results.</div>
		</div>
	{/if}

	<!-- Deal Flow Tab -->
	{#if activeTab === 'dealflow'}
		<div class="mi-section">
			<h2 class="df-title">Deal Flow Stats</h2>
			<p class="mi-section-desc">See how fast the database is growing. New deals are sourced weekly from marketplaces, networks, and direct submissions.</p>

			<div class="stat-cards">
				<div class="stat-card" style="text-align:center;"><div class="stat-label">Total Deals</div><div class="stat-value">{dealFlowStats.totalDeals}</div></div>
				<div class="stat-card" style="text-align:center;"><div class="stat-label">Last 30 Days</div><div class="stat-value" style="color:#2C6E49;">{dealFlowStats.recentCount}</div></div>
				<div class="stat-card" style="text-align:center;"><div class="stat-label">Avg / Month</div><div class="stat-value">{dealFlowStats.avgPerMonth}</div></div>
				<div class="stat-card" style="text-align:center;"><div class="stat-label">Week Streak</div><div class="stat-value" style="color:#D68C45;">{dealFlowStats.streak}</div><div class="stat-sub">consecutive weeks</div></div>
			</div>

			<div class="chart-card" style="margin-bottom:24px;">
				<h3>New Deals Added Per Month</h3>
				<p>Last 12 months of deal sourcing activity</p>
				<div class="chart-wrap"><canvas id="dealFlowBarChart"></canvas></div>
			</div>

			<div class="chart-grid-2">
				<div class="chart-card"><h3>Deal Sources</h3><p>Where deals are found</p><div class="chart-wrap" style="height:240px;"><canvas id="dealSourcePieChart"></canvas></div></div>
				<div class="chart-card"><h3>Asset Classes</h3><p>Investment categories in the database</p><div class="chart-wrap" style="height:240px;"><canvas id="dealAssetPieChart"></canvas></div></div>
			</div>

			<div class="df-bottom-grid">
				<!-- Deal Types -->
				<div class="chart-card">
					<h3>Deal Types</h3>
					{#each dealFlowStats.dealTypes as [type, count]}
						<div class="df-type-row">
							<span class="df-type-name">{type}</span>
							<span class="df-type-count">{count} ({Math.round(count / (dealFlowStats.totalDeals || 1) * 100)}%)</span>
						</div>
					{/each}
				</div>

				<!-- Recent Deals -->
				<div class="chart-card">
					<h3>Recently Added Deals</h3>
					<div class="df-recent-table-wrap">
						<table class="df-recent-table">
							<thead>
								<tr>
									<th>Deal</th>
									<th>Type</th>
									<th>Asset Class</th>
									<th style="text-align:right;">Added</th>
								</tr>
							</thead>
							<tbody>
								{#each dealFlowStats.recentDeals as d}
									<tr>
										<td class="df-deal-name">{d.name || d.investmentName || '--'}</td>
										<td>{d.dealType || '--'}</td>
										<td>{Array.isArray(d.assetClass) ? (d.assetClass[0] || '--') : (d.assetClass || '--')}</td>
										<td style="text-align:right;color:var(--text-muted);">{d.parsedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
									</tr>
								{:else}
									<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--text-muted);">No recent deals</td></tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>

			<!-- Value prop footer -->
			<div class="df-footer">
				<div class="df-footer-title">This database can't be rebuilt overnight.</div>
				<div class="df-footer-desc">With {dealFlowStats.totalDeals} deals tracked, {dealFlowStats.assetClassCount} asset classes, and new opportunities sourced weekly -- this is the most comprehensive private placement database available to LP investors.</div>
			</div>
		</div>
	{/if}

	<!-- Debt Funds Tab -->
	{#if activeTab === 'debtfunds'}
		<div class="mi-section">
			<p class="mi-section-desc">Compare private credit and lending funds side-by-side. Track yield, leverage, and performance across the GYC marketplace.</p>
			<div class="debt-filters">
				<div class="filter-group"><label>Financials</label><select bind:value={debtFinancials} onchange={() => renderDebtChart()}><option value="all">All</option><option value="Audited">Audited</option><option value="Unaudited">Unaudited</option></select></div>
				<div class="filter-group"><label>AUM Size</label><select bind:value={debtAUM} onchange={() => renderDebtChart()}><option value="all">All</option><option value="small">Small (&lt;$100M)</option><option value="mid">Mid ($100M-$1B)</option><option value="institutional">Institutional ($1B+)</option></select></div>
				<div class="filter-group"><label>Debt Position</label><select bind:value={debtPosition} onchange={() => renderDebtChart()}><option value="all">All</option><option value="1st">1st Position</option><option value="2nd">2nd Position</option><option value="Mezzanine">Mezzanine</option></select></div>
				<div class="filter-group"><label>Distributions</label><select bind:value={debtDistribution} onchange={() => renderDebtChart()}><option value="all">All</option><option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option></select></div>
				<div class="filter-group"><label>Min Investment</label><select bind:value={debtMinimum} onchange={() => renderDebtChart()}><option value="all">All</option><option value="25000">Under $25K</option><option value="50000">Under $50K</option><option value="100000">Under $100K</option></select></div>
				<div class="filter-group"><label>2025 Return</label><select bind:value={debtYield} onchange={() => renderDebtChart()}><option value="all">All</option><option value="8">8%+</option><option value="9">9%+</option><option value="10">10%+</option></select></div>
				<div class="filter-group" style="flex:1;min-width:140px;"><label>Search</label><input type="text" bind:value={debtSearch} oninput={() => renderDebtChart()} placeholder="Search funds..."></div>
				<button class="btn-clear" onclick={clearDebtFilters}>Clear Filters</button>
			</div>
			<div class="stat-cards">
				<div class="stat-card"><div class="stat-label">Total Debt Funds</div><div class="stat-value" style="color:var(--primary);">{debtStats.count} <span style="color:var(--text-muted);font-size:18px;">/ {debtStats.total}</span></div></div>
				<div class="stat-card"><div class="stat-label">Average Yield</div><div class="stat-value" style="color:#51BE7B;">{debtStats.avgYield}%</div></div>
				<div class="stat-card"><div class="stat-label">Average LTV</div><div class="stat-value" style="color:#E67E22;">{debtStats.avgLTV}%</div></div>
				<div class="stat-card"><div class="stat-label">Total AUM</div><div class="stat-value" style="color:#3B82F6;">{debtStats.totalAUM}</div></div>
			</div>
			<div class="chart-card" style="margin-bottom:24px;">
				<div class="debt-chart-header">
					<h3>Fund Comparison</h3>
					<div class="debt-metric-toggles">
						{#each [['yield','Yield'],['leverage','Leverage'],['ltv','Loan-to-Value'],['delinquency','Delinquency Rate']] as [key, label]}
							<button class:active={debtChartMetric === key} onclick={() => { debtChartMetric = key; renderDebtChart(); }}>{label}</button>
						{/each}
					</div>
				</div>
				<div class="chart-wrap" style="height:360px;"><canvas id="debtFundChart"></canvas></div>
				{#if debtChartMetric !== 'yield'}
					<div class="coming-soon-overlay">
						<div class="coming-soon-title">Coming Soon</div>
						<div class="coming-soon-desc">{debtChartMetric === 'leverage' ? 'Leverage ratio' : debtChartMetric === 'ltv' ? 'Loan-to-value' : 'Delinquency rate'} data is not yet available.</div>
					</div>
				{/if}
			</div>
			<div class="debt-table-wrap">
				<table class="debt-table">
					<thead>
						<tr>
							<th onclick={() => { if (debtSortCol === 'investmentName') debtSortAsc = !debtSortAsc; else { debtSortCol = 'investmentName'; debtSortAsc = true; } }}>Fund Name</th>
							<th>Debt Position</th>
							<th>AUM</th>
							<th>Financials</th>
							<th>2025</th><th>2024</th><th>2023</th><th>2022</th>
						</tr>
					</thead>
					<tbody>
						{#each filteredDebtFunds.sort((a, b) => { let va = a[debtSortCol] || '', vb = b[debtSortCol] || ''; if (typeof va === 'string') va = va.toLowerCase(); if (typeof vb === 'string') vb = vb.toLowerCase(); return debtSortAsc ? (va < vb ? -1 : 1) : (va > vb ? -1 : 1); }) as fund (fund.id)}
							<tr class:highlighted={highlightedDebtFunds.has(fund.id)} onclick={() => { if (highlightedDebtFunds.has(fund.id)) highlightedDebtFunds.delete(fund.id); else highlightedDebtFunds.add(fund.id); highlightedDebtFunds = new Set(highlightedDebtFunds); renderDebtChart(); }}>
								<td class="name-cell"><a href="/app/deals?id={fund.id}" onclick={(e) => e.stopPropagation()}>{fund.investmentName}</a></td>
								<td>{fund.debtPosition || '--'}</td>
								<td>{fmtAUM(fund.fundAUM)}</td>
								<td><span class="fin-badge" class:audited={fund.financials === 'Audited'} class:unaudited={fund.financials === 'Unaudited'}>{fund.financials || '--'}</span></td>
								<td class="return-cell">{fmtReturn(fund._return2025)}</td>
								<td class="return-cell">{fmtReturn(fund._return2024)}</td>
								<td class="return-cell">{fmtReturn(fund._return2023)}</td>
								<td class="return-cell">{fmtReturn(fund._return2022)}</td>
							</tr>
						{:else}
							<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">No funds match your filters.</td></tr>
						{/each}
					</tbody>
				</table>
			</div>
		</div>
	{/if}
</div>

<style>
	.mi-page { max-width: 1200px; padding: 24px; }
	.mi-header h1 { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); margin: 0 0 8px 0; }
	.mi-header p { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); margin: 0; max-width: 680px; }
	.mi-tab-bar { display: flex; gap: 4px; margin: 24px 0 28px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 4px; overflow-x: auto; }
	.mi-tab-btn { flex: 0 0 auto; padding: 10px 14px; border: none; border-radius: 8px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--text-secondary); white-space: nowrap; }
	.mi-tab-btn.active { background: var(--primary); color: #fff; }
	.mi-section { margin-bottom: 32px; }
	.mi-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
	.mi-section-header h2 { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); margin: 0; }
	.mi-section-desc { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); margin: 0 0 20px; }
	.mi-badge { font-family: var(--font-ui); font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.5px; color: #fff; }
	.mi-badge.blue { background: #3B9DDD; }
	.mi-badge.green { background: var(--primary); }
	.stat-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
	.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
	.stat-label { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.stat-value { font-family: var(--font-ui); font-size: 28px; font-weight: 800; color: var(--text-dark); margin-top: 4px; }
	.stat-sub { font-family: var(--font-body); font-size: 11px; color: var(--text-secondary); margin-top: 2px; }
	.chart-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
	.chart-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; position: relative; }
	.chart-card h3 { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin: 0 0 4px; }
	.chart-card p { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); margin: 0 0 16px; }
	.chart-wrap { height: 280px; }
	.chart-wrap.tall { height: 320px; }
	.mi-disclaimer { font-family: var(--font-body); font-size: 11px; color: var(--text-muted); text-align: center; margin: 32px 0; }
	.mi-gate-overlay { position: relative; z-index: 10; text-align: center; padding: 60px 20px; }
	.mi-gate-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 16px; padding: 40px 32px; max-width: 480px; margin: 0 auto; box-shadow: 0 8px 32px rgba(0,0,0,0.12); }
	.mi-gate-icon { width: 56px; height: 56px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #4ade80); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
	.mi-gate-card h2 { font-family: var(--font-ui); font-size: 20px; font-weight: 800; color: var(--text-dark); margin-bottom: 8px; }
	.mi-gate-card p { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); margin-bottom: 24px; line-height: 1.6; }
	.mi-gate-card a { display: inline-block; padding: 14px 32px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-size: 14px; font-weight: 700; text-decoration: none; }

	/* Trend section header */
	.trend-section-header { margin: 40px 0 24px; border-top: 2px solid var(--border); padding-top: 24px; }
	.trend-section-header h2 { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); margin: 0 0 4px; }
	.trend-section-header p { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); margin: 0; }

	/* Key Insights */
	.insights-section { margin: 40px 0 24px; border-top: 2px solid var(--border); padding-top: 24px; }
	.insights-section h2 { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); margin: 0 0 16px; }
	.insights-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
	.insight-card { background: linear-gradient(135deg, #1a2e35, #2C3E2D); border-radius: 8px; padding: 20px; }
	.insight-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: #fff; margin-bottom: 6px; }
	.insight-body { font-family: var(--font-body); font-size: 12px; color: rgba(255,255,255,0.7); line-height: 1.5; }

	/* Deal Flow Tab */
	.df-title { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); margin: 0 0 4px; }
	.df-bottom-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 24px; margin-bottom: 24px; }
	.df-type-row { display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid var(--border); }
	.df-type-name { font-family: var(--font-ui); font-size: 13px; font-weight: 600; }
	.df-type-count { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); }
	.df-recent-table-wrap { max-height: 300px; overflow-y: auto; }
	.df-recent-table { width: 100%; font-size: 12px; border-collapse: collapse; }
	.df-recent-table th { text-align: left; padding: 6px 8px; font-family: var(--font-ui); font-weight: 700; border-bottom: 2px solid var(--border); }
	.df-recent-table td { padding: 6px 8px; border-bottom: 1px solid var(--border); }
	.df-deal-name { font-weight: 600; }
	.df-footer { background: linear-gradient(135deg, #2C3E2D, #3D5A3E); border-radius: var(--radius); padding: 24px; color: #fff; text-align: center; margin-bottom: 24px; }
	.df-footer-title { font-family: var(--font-ui); font-size: 18px; font-weight: 800; margin-bottom: 8px; }
	.df-footer-desc { font-family: var(--font-body); font-size: 13px; opacity: 0.85; }

	/* Debt Funds */
	.debt-filters { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px 20px; margin-bottom: 24px; display: flex; align-items: flex-end; gap: 16px; flex-wrap: wrap; }
	.filter-group { display: flex; flex-direction: column; gap: 4px; }
	.filter-group label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.filter-group select, .filter-group input { padding: 6px 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark); }
	.btn-clear { align-self: center; padding: 6px 14px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); cursor: pointer; }
	.btn-primary { display: inline-block; padding: 12px 24px; background: var(--primary); color: #fff; border-radius: 8px; font-family: var(--font-ui); font-size: 14px; font-weight: 700; text-decoration: none; }
	.debt-chart-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
	.debt-metric-toggles { display: flex; gap: 8px; }
	.debt-metric-toggles button { padding: 6px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: transparent; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
	.debt-metric-toggles button.active { background: var(--primary); color: #fff; border-color: var(--primary); }
	.coming-soon-overlay { position: absolute; inset: 60px 24px 24px; background: rgba(255,255,255,0.85); backdrop-filter: blur(2px); display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 8px; border-radius: var(--radius); z-index: 10; }
	.coming-soon-title { font-family: var(--font-ui); font-size: 22px; font-weight: 700; color: var(--text-secondary); }
	.coming-soon-desc { font-family: var(--font-body); font-size: 14px; color: var(--text-muted); max-width: 340px; text-align: center; }
	.debt-table-wrap { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; overflow-x: auto; }
	.debt-table { width: 100%; border-collapse: collapse; font-family: var(--font-ui); font-size: 13px; }
	.debt-table th { text-align: left; padding: 12px 14px; font-weight: 700; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); border-bottom: 2px solid var(--border); cursor: pointer; white-space: nowrap; }
	.debt-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); }
	.debt-table tr:hover { background: var(--bg-main); }
	.debt-table tr.highlighted { background: var(--mint-bg, rgba(81,190,123,0.06)); }
	.name-cell a { color: var(--text-dark); text-decoration: none; font-weight: 600; }
	.name-cell a:hover { color: var(--primary); }
	.return-cell { color: var(--green, #51BE7B); font-weight: 600; }
	.fin-badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }
	.fin-badge.audited { background: var(--green-bg, rgba(81,190,123,0.1)); color: var(--green, #51BE7B); }
	.fin-badge.unaudited { background: var(--orange-bg, rgba(230,126,34,0.1)); color: var(--orange, #E67E22); }

	@media (max-width: 768px) {
		.chart-grid-2 { grid-template-columns: 1fr; }
		.debt-filters { flex-direction: column; }
		.debt-metric-toggles { flex-wrap: wrap; }
		.mi-page { padding: 16px; }
		.df-bottom-grid { grid-template-columns: 1fr; }
		.insights-grid { grid-template-columns: 1fr; }
		.mi-header h1 { font-size: 22px; }
		.stat-cards { grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; }
		.stat-value { font-size: 22px; }
		.stat-card { padding: 14px; }
	}
</style>
