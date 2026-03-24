<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { user, isAdmin, userTier } from '$lib/stores/auth.js';


	let portfolio = $state([]);
	let taxDocuments = $state([]);
	let wizardData = $state({});

	// Chart.js refs
	let allocationCanvasEl = $state(null);
	let timelineCanvasEl = $state(null);
	let allocationChartInstance = $state(null);
	let timelineChartInstance = $state(null);
	let chartJsLoaded = $state(false);
	let sortCol = $state('investmentName');
	let sortAsc = $state(true);
	let showAddModal = $state(false);
	let showDealSearch = $state(false);
	let editingId = $state('');
	let taxSectionOpen = $state(false);
	let searchQuery = $state('');
	let dealSearchQuery = $state('');
	let dealSearchResults = $state([]);
	let dealSearchLoading = $state(false);

	// Modal form data
	let modalData = $state({
		investmentName: '', sponsor: '', assetClass: '', amountInvested: '',
		dateInvested: '', status: 'Active', targetIRR: '', distributionsReceived: '',
		equityMultiple: '', investingEntity: '', entityInvestedInto: '',
		holdPeriod: '', notes: '', dealId: ''
	});

	const totalInvested = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.amountInvested) || 0), 0));
	const totalDistributions = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.distributionsReceived) || 0), 0));
	const activeCount = $derived(portfolio.filter(i => i.status === 'Active' || i.status === 'Distributing').length);
	const avgIRR = $derived.by(() => {
		const withIRR = portfolio.filter(i => i.targetIRR);
		if (withIRR.length === 0) return 0;
		return withIRR.reduce((s, i) => s + parseFloat(i.targetIRR), 0) / withIRR.length;
	});
	const avgHoldPeriod = $derived.by(() => {
		const withDate = portfolio.filter(i => i.dateInvested && (i.status === 'Active' || i.status === 'Distributing'));
		if (withDate.length === 0) return 0;
		const now = new Date();
		const totalMonths = withDate.reduce((s, i) => {
			const d = new Date(i.dateInvested);
			return s + ((now - d) / (1000 * 60 * 60 * 24 * 30.44));
		}, 0);
		return totalMonths / withDate.length;
	});
	const assetClasses = $derived(new Set(portfolio.map(i => i.assetClass).filter(Boolean)));
	const sponsors = $derived(new Set(portfolio.map(i => i.sponsor).filter(Boolean)));

	const allocationMap = $derived.by(() => {
		const map = {};
		portfolio.forEach(i => { const cls = i.assetClass || 'Other'; map[cls] = (map[cls] || 0) + (parseFloat(i.amountInvested) || 0); });
		return map;
	});

	// Risk insights
	const riskInsights = $derived.by(() => {
		const insights = [];
		if (totalInvested === 0) return [{ type: 'ok', text: 'Add investments to see risk analysis.' }];
		const alloc = allocationMap;
		for (const [cls, amt] of Object.entries(alloc)) {
			const pct = (amt / totalInvested) * 100;
			if (pct > 50) insights.push({ type: 'danger', text: `High concentration in ${cls}`, detail: `${pct.toFixed(0)}% of portfolio. Consider diversifying across asset classes.` });
		}
		const sponsorAlloc = {};
		portfolio.forEach(i => { const sp = i.sponsor || 'Unknown'; sponsorAlloc[sp] = (sponsorAlloc[sp] || 0) + (parseFloat(i.amountInvested) || 0); });
		for (const [sp, amt] of Object.entries(sponsorAlloc)) {
			const pct = (amt / totalInvested) * 100;
			if (pct > 40) insights.push({ type: 'warn', text: `Operator concentration risk`, detail: `${pct.toFixed(0)}% allocated to ${sp}. Diversifying sponsors reduces counterparty risk.` });
		}
		// Hold period risk
		const avgHoldMonths = avgHoldPeriod;
		if (avgHoldMonths > 84) {
			insights.push({ type: 'warn', text: `Long average hold period`, detail: `${(avgHoldMonths / 12).toFixed(1)} years avg hold. Longer holds reduce liquidity.` });
		}
		if (insights.length === 0) return [{ type: 'ok', text: 'Portfolio looks well-diversified', detail: 'No major concentration risks detected.' }];
		return insights;
	});

	// Timeline data - investments grouped by quarter
	const timelineData = $derived.by(() => {
		const withDate = portfolio.filter(i => i.dateInvested);
		if (withDate.length === 0) return null;
		const buckets = {};
		withDate.forEach(i => {
			const d = new Date(i.dateInvested);
			const q = Math.floor(d.getMonth() / 3) + 1;
			const key = `Q${q} ${d.getFullYear()}`;
			buckets[key] = (buckets[key] || 0) + (parseFloat(i.amountInvested) || 0);
		});
		const sorted = Object.entries(buckets).sort((a, b) => {
			const parseKey = (k) => { const [q, y] = k.split(' '); return parseInt(y) * 4 + parseInt(q[1]); };
			return parseKey(a[0]) - parseKey(b[0]);
		});
		return { labels: sorted.map(([k]) => k), amounts: sorted.map(([, v]) => v) };
	});

	// Chart.js rendering functions
	async function loadChartJs() {
		if (chartJsLoaded) return;
		const { Chart, DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend } = await import('chart.js');
		Chart.register(DoughnutController, BarController, ArcElement, BarElement, CategoryScale, LinearScale, Tooltip, Legend);
		chartJsLoaded = true;
	}

	const PIE_COLORS = ['#51BE7B', '#2563EB', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

	function renderAllocationChart() {
		if (!allocationCanvasEl || !chartJsLoaded) return;
		const alloc = allocationMap;
		const entries = Object.entries(alloc).sort((a, b) => b[1] - a[1]);
		if (entries.length === 0) return;

		if (allocationChartInstance) allocationChartInstance.destroy();

		const { Chart } = window.Chart ? { Chart: window.Chart } : {};
		import('chart.js').then(({ Chart: C }) => {
			allocationChartInstance = new C(allocationCanvasEl, {
				type: 'doughnut',
				data: {
					labels: entries.map(([k]) => k),
					datasets: [{
						data: entries.map(([, v]) => v),
						backgroundColor: entries.map((_, i) => PIE_COLORS[i % PIE_COLORS.length]),
						borderWidth: 2,
						borderColor: 'var(--bg-card)',
						hoverBorderColor: '#fff',
						hoverOffset: 6
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					cutout: '60%',
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => {
									const val = ctx.raw;
									const pct = ((val / totalInvested) * 100).toFixed(1);
									return `$${val.toLocaleString()} (${pct}%)`;
								}
							}
						}
					}
				}
			});
		});
	}

	function renderTimelineChart() {
		if (!timelineCanvasEl || !chartJsLoaded) return;
		const tData = timelineData;
		if (!tData) return;

		if (timelineChartInstance) timelineChartInstance.destroy();

		import('chart.js').then(({ Chart: C }) => {
			timelineChartInstance = new C(timelineCanvasEl, {
				type: 'bar',
				data: {
					labels: tData.labels,
					datasets: [{
						label: 'Amount Invested',
						data: tData.amounts,
						backgroundColor: '#51BE7B',
						borderRadius: 4,
						maxBarThickness: 40
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: { display: false },
						tooltip: {
							callbacks: {
								label: (ctx) => '$' + ctx.raw.toLocaleString()
							}
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: {
								callback: (v) => '$' + (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v),
								font: { size: 11 }
							},
							grid: { color: 'rgba(0,0,0,0.05)' }
						},
						x: {
							ticks: { font: { size: 11 } },
							grid: { display: false }
						}
					}
				}
			});
		});
	}

	// Filtered portfolio based on search
	const filtered = $derived.by(() => {
		if (!searchQuery.trim()) return portfolio;
		const q = searchQuery.toLowerCase();
		return portfolio.filter(i => {
			const hay = [i.investmentName, i.sponsor, i.assetClass, i.investingEntity, i.entityInvestedInto].join(' ').toLowerCase();
			return hay.includes(q);
		});
	});

	const sorted = $derived.by(() => {
		return [...filtered].sort((a, b) => {
			let va = a[sortCol], vb = b[sortCol];
			if (['amountInvested', 'distributionsReceived', 'targetIRR', 'equityMultiple'].includes(sortCol)) {
				va = parseFloat(va) || 0; vb = parseFloat(vb) || 0;
			}
			if (sortCol === 'dateInvested') {
				va = va ? new Date(va).getTime() : 0;
				vb = vb ? new Date(vb).getTime() : 0;
			}
			if (typeof va === 'string') va = va.toLowerCase();
			if (typeof vb === 'string') vb = vb.toLowerCase();
			if (va < vb) return sortAsc ? -1 : 1;
			if (va > vb) return sortAsc ? 1 : -1;
			return 0;
		});
	});

	const statusColors = { Active: 'var(--primary)', Distributing: '#3b82f6', Exited: 'var(--text-muted)', Pending: '#f59e0b' };

	function sortBy(col) {
		if (sortCol === col) sortAsc = !sortAsc;
		else { sortCol = col; sortAsc = true; }
	}

	function sortArrow(col) {
		if (sortCol !== col) return '';
		return sortAsc ? ' \u25B2' : ' \u25BC';
	}

	function openDealSearchModal() {
		dealSearchQuery = '';
		dealSearchResults = [];
		showDealSearch = true;
	}

	async function searchDeals() {
		const q = dealSearchQuery.trim();
		if (q.length < 2) { dealSearchResults = []; return; }
		dealSearchLoading = true;
		try {
			const res = await fetch(`/api/deals?q=${encodeURIComponent(q)}&limit=10`);
			if (res.ok) {
				const data = await res.json();
				dealSearchResults = Array.isArray(data) ? data : (data.deals || []);
			} else {
				dealSearchResults = [];
			}
		} catch {
			dealSearchResults = [];
		}
		dealSearchLoading = false;
	}

	function selectDealForPortfolio(deal) {
		showDealSearch = false;
		editingId = '';
		modalData = {
			investmentName: deal.investmentName || deal.investment_name || deal.name || '',
			sponsor: deal.managementCompany || deal.sponsor || deal.management_company || '',
			assetClass: deal.assetClass || deal.asset_class || '',
			amountInvested: '',
			dateInvested: '',
			status: 'Active',
			targetIRR: deal.targetIRR || deal.target_irr || '',
			distributionsReceived: '',
			equityMultiple: deal.equityMultiple || deal.equity_multiple || '',
			investingEntity: '',
			entityInvestedInto: '',
			holdPeriod: '',
			notes: '',
			dealId: deal.id || ''
		};
		showAddModal = true;
	}

	function openAddModal(id = '') {
		editingId = id;
		if (id) {
			const inv = portfolio.find(i => i.id === id);
			if (inv) modalData = { ...inv };
		} else {
			modalData = {
				investmentName: '', sponsor: '', assetClass: '', amountInvested: '',
				dateInvested: '', status: 'Active', targetIRR: '', distributionsReceived: '',
				equityMultiple: '', investingEntity: '', entityInvestedInto: '',
				holdPeriod: '', notes: '', dealId: ''
			};
		}
		showAddModal = true;
	}

	function saveInvestment() {
		if (!modalData.investmentName.trim()) { alert('Please enter an investment name.'); return; }
		if (editingId) {
			const idx = portfolio.findIndex(i => i.id === editingId);
			if (idx >= 0) portfolio[idx] = { ...portfolio[idx], ...modalData };
		} else {
			const newInv = { ...modalData, id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) };
			portfolio.push(newInv);
			// Auto-add tax document for new investments
			if (browser) {
				const taxDocs = JSON.parse(localStorage.getItem('gycTaxDocs') || '[]');
				const year = new Date().getFullYear();
				const alreadyExists = taxDocs.some(t => t.investmentName === newInv.investmentName && t.taxYear == year);
				if (!alreadyExists) {
					taxDocs.push({
						id: 'tax_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
						taxYear: year,
						investmentName: newInv.investmentName,
						investingEntity: newInv.investingEntity || '',
						entityInvestedInto: newInv.entityInvestedInto || '',
						formType: 'K-1',
						uploadStatus: 'Pending',
						dateReceived: '', portalUrl: '', contact: '', notes: '', fileUrl: ''
					});
					localStorage.setItem('gycTaxDocs', JSON.stringify(taxDocs));
					taxDocuments = taxDocs;
				}
			}
		}
		portfolio = [...portfolio];
		if (browser) localStorage.setItem('gycPortfolio', JSON.stringify(portfolio));
		showAddModal = false;
	}

	function deleteInvestment(id) {
		if (!confirm('Delete this investment from your portfolio?')) return;
		portfolio = portfolio.filter(i => i.id !== id);
		if (browser) localStorage.setItem('gycPortfolio', JSON.stringify(portfolio));
	}

	function handlePPMUpload(file) {
		if (!file) return;
		alert('PPM upload processing is available in the full application. Please add investments manually for now.');
	}

	function formatHoldPeriod(months) {
		if (!months || months <= 0) return '--';
		if (months < 12) return Math.round(months) + 'mo';
		const yrs = months / 12;
		return yrs.toFixed(1) + 'yr';
	}

	onMount(async () => {
		if (!browser) return;
		portfolio = JSON.parse(localStorage.getItem('gycPortfolio') || '[]');
		taxDocuments = JSON.parse(localStorage.getItem('gycTaxDocs') || '[]');
		wizardData = JSON.parse(localStorage.getItem('gycBuyBoxWizard') || '{}');

		// Load Chart.js dynamically (SSR-safe)
		await loadChartJs();
		renderAllocationChart();
		renderTimelineChart();
	});

	// Re-render charts when portfolio data changes
	$effect(() => {
		// Access reactive deps
		const _alloc = allocationMap;
		const _timeline = timelineData;
		if (chartJsLoaded && browser) {
			renderAllocationChart();
			renderTimelineChart();
		}
	});
</script>

<div class="topbar">
	<button class="mobile-menu-btn" onclick={() => document.getElementById('sidebar')?.classList.toggle('open')}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
	</button>
	<div class="topbar-title">Dashboard</div>
	<div class="dash-tabs">
		<a href="/app/dashboard" class="dash-tab">Overview</a>
		<a href="/app/portfolio" class="dash-tab active">Portfolio</a>
		<a href="/app/plan" class="dash-tab">My Plan</a>
	</div>
	<div class="topbar-spacer"></div>
	<button class="btn-add" onclick={() => openDealSearchModal()}>+ Add Investment</button>
</div>

<div class="content-area">
	{#if portfolio.length === 0}
		<!-- Empty state -->
		<div class="empty-charts">
			<div class="empty-chart-box">
				<div class="chart-title">Asset Class Allocation</div>
				<svg viewBox="0 0 120 120" style="width:100px;height:100px;"><circle cx="60" cy="60" r="50" fill="none" stroke="var(--border)" stroke-width="18" stroke-dasharray="80 235" stroke-dashoffset="0"/><circle cx="60" cy="60" r="50" fill="none" stroke="var(--text-muted)" stroke-width="18" stroke-dasharray="120 195" stroke-dashoffset="-80"/><circle cx="60" cy="60" r="50" fill="none" stroke="var(--primary)" stroke-width="18" stroke-dasharray="115 200" stroke-dashoffset="-200"/></svg>
			</div>
			<div class="empty-chart-box">
				<div class="chart-title">Risk Analysis</div>
				<div class="risk-bars">
					<div class="risk-bar" style="width:75%"></div>
					<div class="risk-bar" style="width:55%"></div>
					<div class="risk-bar" style="width:90%"></div>
					<div class="risk-bar" style="width:40%"></div>
				</div>
			</div>
		</div>
		<div class="import-section">
			<div class="import-card">
				<h3>Track your investments in one place</h3>
				<p>Import your existing portfolio to see allocation, performance, and progress toward your goals.</p>
				<div class="upload-zone">
					<input type="file" accept=".pdf" onchange={(e) => handlePPMUpload(e.target.files[0])}>
					<div class="upload-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><polyline points="9 15 12 12 15 15"/></svg>
					</div>
					<div class="upload-label">Upload a PPM or Subscription Document</div>
					<div class="upload-hint">We'll extract your investment details automatically. PDF up to 25 MB</div>
				</div>
				<div class="divider-text">or</div>
				<button class="btn-manual" onclick={() => openAddModal()}>+ Add Investment Manually</button>
				<div class="browse-link"><a href="/app/deals">Browse deals in the marketplace →</a></div>
			</div>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="summary-grid">
			<div class="stat-card"><div class="stat-label">Total Invested</div><div class="stat-value">${totalInvested.toLocaleString()}</div></div>
			<div class="stat-card"><div class="stat-label">Active Investments</div><div class="stat-value">{activeCount}</div></div>
			<div class="stat-card"><div class="stat-label">Total Distributions</div><div class="stat-value">${totalDistributions.toLocaleString()}</div></div>
			<div class="stat-card"><div class="stat-label">Avg Target IRR</div><div class="stat-value">{avgIRR ? avgIRR.toFixed(1) + '%' : '--'}</div></div>
			<div class="stat-card"><div class="stat-label">Avg Hold Period</div><div class="stat-value">{formatHoldPeriod(avgHoldPeriod)}</div></div>
		</div>

		<!-- Charts row -->
		<div class="charts-row">
			<div class="chart-card">
				<div class="chart-card-title">Asset Class Allocation</div>
				<div class="chartjs-donut-wrap">
					<canvas bind:this={allocationCanvasEl}></canvas>
				</div>
				<div class="alloc-legend">
					{#each Object.entries(allocationMap).sort((a, b) => b[1] - a[1]) as [cls, amt], i}
						<div class="alloc-legend-item">
							<span class="alloc-legend-dot" style="background:{PIE_COLORS[i % PIE_COLORS.length]}"></span>
							<span class="alloc-legend-label">{cls}</span>
							<span class="alloc-legend-pct">{((amt / totalInvested) * 100).toFixed(0)}%</span>
						</div>
					{/each}
				</div>
				<div class="alloc-meta">
					<div class="alloc-stat"><div class="alloc-num">{assetClasses.size}</div><div class="alloc-label">Asset Classes</div></div>
					<div class="alloc-stat"><div class="alloc-num">{sponsors.size}</div><div class="alloc-label">Sponsors</div></div>
				</div>
			</div>
			<div class="chart-card">
				<div class="chart-card-title">Risk Analysis</div>
				<div class="risk-badges">
					{#each riskInsights as insight}
						<div class="risk-badge" class:badge-danger={insight.type === 'danger'} class:badge-warn={insight.type === 'warn'} class:badge-ok={insight.type === 'ok'}>
							<div class="risk-badge-icon">
								{#if insight.type === 'danger'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
								{:else if insight.type === 'warn'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
								{/if}
							</div>
							<div class="risk-badge-content">
								<div class="risk-badge-text">{insight.text}</div>
								{#if insight.detail}
									<div class="risk-badge-detail">{insight.detail}</div>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Portfolio Timeline -->
		{#if timelineData}
			<div class="chart-card timeline-card">
				<div class="chart-card-title">Investment Timeline</div>
				<div class="chartjs-timeline-wrap">
					<canvas bind:this={timelineCanvasEl}></canvas>
				</div>
			</div>
		{/if}

		<!-- Investment cards -->
		<div class="inv-header">
			<div class="inv-title">Your Investments ({filtered.length})</div>
			<div class="inv-header-right">
				<div class="search-box">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="search-icon"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
					<input type="text" placeholder="Search portfolio..." bind:value={searchQuery} class="search-input">
				</div>
				<button class="btn-add" onclick={() => openDealSearchModal()}>+ Add Investment</button>
			</div>
		</div>

		<!-- Sort bar -->
		<div class="sort-bar">
			<button class="sort-btn" class:active={sortCol === 'investmentName'} onclick={() => sortBy('investmentName')}>Name{sortArrow('investmentName')}</button>
			<button class="sort-btn" class:active={sortCol === 'amountInvested'} onclick={() => sortBy('amountInvested')}>Amount{sortArrow('amountInvested')}</button>
			<button class="sort-btn" class:active={sortCol === 'dateInvested'} onclick={() => sortBy('dateInvested')}>Date{sortArrow('dateInvested')}</button>
			<button class="sort-btn" class:active={sortCol === 'status'} onclick={() => sortBy('status')}>Status{sortArrow('status')}</button>
			<button class="sort-btn" class:active={sortCol === 'assetClass'} onclick={() => sortBy('assetClass')}>Asset Class{sortArrow('assetClass')}</button>
			<button class="sort-btn" class:active={sortCol === 'distributionsReceived'} onclick={() => sortBy('distributionsReceived')}>Distributions{sortArrow('distributionsReceived')}</button>
			<button class="sort-btn" class:active={sortCol === 'targetIRR'} onclick={() => sortBy('targetIRR')}>IRR{sortArrow('targetIRR')}</button>
		</div>

		{#if sorted().length === 0 && searchQuery}
			<div class="no-results">No investments match "{searchQuery}"</div>
		{/if}

		<div class="inv-list">
			{#each sorted() as inv}
				{@const sc = statusColors[inv.status] || 'var(--text-muted)'}
				<div class="inv-card">
					<div class="inv-card-stripe" style="background:{sc}"></div>
					<div class="inv-card-body">
						<div class="inv-card-top">
							<div class="inv-card-info">
								<div class="inv-card-name">{inv.investmentName || 'Unnamed'}</div>
								<div class="inv-card-sub">{inv.sponsor || ''}{inv.assetClass ? ' · ' + inv.assetClass : ''}{inv.dateInvested ? ' · ' + inv.dateInvested : ''}</div>
							</div>
							<div class="inv-card-actions">
								<span class="inv-status" style="--sc:{sc}">{inv.status || 'Unknown'}</span>
								<button class="btn-edit" onclick={() => openAddModal(inv.id)}>Edit</button>
								<button class="btn-delete" onclick={() => deleteInvestment(inv.id)} title="Delete investment">&times;</button>
							</div>
						</div>
						<div class="inv-card-metrics">
							<div><div class="m-label">Invested</div><div class="m-value">${(parseFloat(inv.amountInvested) || 0).toLocaleString()}</div></div>
							{#if inv.targetIRR}
								<div><div class="m-label">Target IRR</div><div class="m-value green">{inv.targetIRR}%</div></div>
							{/if}
							<div><div class="m-label">Distributions</div><div class="m-value" class:green={parseFloat(inv.distributionsReceived || 0) > 0}>${(parseFloat(inv.distributionsReceived) || 0).toLocaleString()}</div></div>
							{#if inv.equityMultiple}
								<div><div class="m-label">Equity Multiple</div><div class="m-value">{inv.equityMultiple}x</div></div>
							{/if}
						</div>
						{#if inv.notes}
							<div class="inv-card-notes">{inv.notes}</div>
						{/if}
					</div>
				</div>
			{/each}
		</div>

		<!-- Tax Documents Collapsible -->
		{#if portfolio.length > 0 || taxDocuments.length > 0}
			<div class="tax-section">
				<button class="tax-header" onclick={() => { taxSectionOpen = !taxSectionOpen; }}>
					<div class="tax-header-left">
						<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" stroke-width="2" style="width:18px;height:18px;flex-shrink:0;"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
						<span class="tax-title">Tax Documents</span>
					</div>
					<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" style="width:16px;height:16px;transition:transform 0.2s;transform:{taxSectionOpen ? 'rotate(180deg)' : 'none'}"><polyline points="6 9 12 15 18 9"/></svg>
				</button>
				{#if taxSectionOpen}
					<div class="tax-content">
						{#if taxDocuments.length === 0}
							<div class="tax-empty">
								<div>No tax documents yet</div>
								<a href="/app/tax-prep" class="btn-primary" style="margin-top:8px;">Manage Tax Documents</a>
							</div>
						{:else}
							<div class="tax-summary">
								{taxDocuments.filter(d => d.uploadStatus === 'Received').length} of {taxDocuments.length} received
							</div>
							<a href="/app/tax-prep" class="section-link">View All →</a>
						{/if}
					</div>
				{/if}
			</div>
		{/if}
	{/if}
</div>

<!-- Deal Search Modal -->
{#if showDealSearch}
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showDealSearch = false; }}>
		<div class="modal-card" style="max-width:520px;">
			<div class="modal-top">
				<div class="modal-title">Add to Portfolio</div>
				<button class="modal-close" onclick={() => showDealSearch = false}>&times;</button>
			</div>
			<p class="deal-search-hint">Search for an existing deal or add a custom investment.</p>
			<input
				type="text"
				placeholder="Search deals by name or sponsor..."
				bind:value={dealSearchQuery}
				oninput={searchDeals}
				class="deal-search-input"
			>
			<div class="deal-search-results">
				{#if dealSearchQuery.length < 2}
					<div class="deal-search-empty">Type to search deals...</div>
				{:else if dealSearchLoading}
					<div class="deal-search-empty">Searching...</div>
				{:else if dealSearchResults.length === 0}
					<div class="deal-search-empty">No deals found. Use "Add Custom Investment" below.</div>
				{:else}
					{#each dealSearchResults as deal}
						{@const alreadyAdded = portfolio.some(i => i.dealId === deal.id)}
						<button
							class="deal-search-item"
							class:already={alreadyAdded}
							disabled={alreadyAdded}
							onclick={() => selectDealForPortfolio(deal)}
						>
							<div>
								<div class="deal-search-name">{deal.investmentName || deal.investment_name || deal.name}</div>
								<div class="deal-search-sub">{deal.managementCompany || deal.sponsor || deal.management_company || ''} &middot; {deal.assetClass || deal.asset_class || ''}</div>
							</div>
							<div class="deal-search-action">{alreadyAdded ? 'Already Added' : 'Select \u2192'}</div>
						</button>
					{/each}
				{/if}
			</div>
			<div class="deal-search-divider">
				<button class="btn-manual-add" onclick={() => { showDealSearch = false; openAddModal(); }}>+ Add Custom Investment (Not in Database)</button>
			</div>
		</div>
	</div>
{/if}

<!-- Add/Edit Investment Modal -->
{#if showAddModal}
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }}>
		<div class="modal-card">
			<div class="modal-top">
				<div class="modal-title">{editingId ? 'Edit' : 'Add'} Investment</div>
				<button class="modal-close" onclick={() => showAddModal = false}>&times;</button>
			</div>
			<div class="modal-grid">
				<div class="modal-field"><label>Investment Name *</label><input bind:value={modalData.investmentName} placeholder="e.g. Acme Multi-Family Fund II"></div>
				<div class="modal-field"><label>Sponsor</label><input bind:value={modalData.sponsor} placeholder="e.g. Acme Capital"></div>
				<div class="modal-field">
					<label>Asset Class</label>
					<select bind:value={modalData.assetClass}>
						<option value="">Select...</option>
						<option>Multi Family</option><option>Self Storage</option><option>Industrial</option>
						<option>Lending</option><option>Short Term Rental</option><option>Hotels/Hospitality</option>
						<option>Mixed-Use</option><option>RV/Mobile Home Parks</option><option>Senior Living</option>
						<option>Land</option><option>Car Wash</option><option>Oil & Gas</option><option>Other</option>
					</select>
				</div>
				<div class="modal-field"><label>Amount Invested ($)</label><input type="number" bind:value={modalData.amountInvested} placeholder="50000"></div>
				<div class="modal-field"><label>Date Invested</label><input type="date" bind:value={modalData.dateInvested}></div>
				<div class="modal-field">
					<label>Status</label>
					<select bind:value={modalData.status}>
						<option>Active</option><option>Distributing</option><option>Exited</option><option>Pending</option>
					</select>
				</div>
				<div class="modal-field"><label>Target IRR (%)</label><input type="number" step="0.1" bind:value={modalData.targetIRR} placeholder="15"></div>
				<div class="modal-field"><label>Distributions Received ($)</label><input type="number" bind:value={modalData.distributionsReceived} placeholder="0"></div>
				<div class="modal-field"><label>Equity Multiple</label><input type="number" step="0.01" bind:value={modalData.equityMultiple} placeholder="1.8"></div>
				<div class="modal-field"><label>Hold Period (years)</label><input bind:value={modalData.holdPeriod} placeholder="e.g. 5"></div>
				<div class="modal-field"><label>Investing Entity</label><input bind:value={modalData.investingEntity} placeholder="e.g. My LLC"></div>
				<div class="modal-field"><label>Entity Invested Into</label><input bind:value={modalData.entityInvestedInto} placeholder="e.g. Acme Fund II LLC"></div>
				<div class="modal-field full-width"><label>Notes</label><textarea bind:value={modalData.notes} rows="2" placeholder="Optional notes about this investment..."></textarea></div>
			</div>
			<div class="modal-actions">
				{#if editingId}
					<button class="btn-danger" onclick={() => { showAddModal = false; deleteInvestment(editingId); }}>Delete</button>
				{/if}
				<div style="flex:1"></div>
				<button class="btn-cancel" onclick={() => showAddModal = false}>Cancel</button>
				<button class="btn-primary" onclick={saveInvestment}>{editingId ? 'Save Changes' : 'Add Investment'}</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.topbar { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg-card); position: sticky; top: 0; z-index: 10; }
	.mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; padding: 4px; }
	.mobile-menu-btn svg { width: 22px; height: 22px; }
	.topbar-title { font-family: var(--font-ui); font-size: 16px; font-weight: 800; color: var(--text-dark); }
	.dash-tabs { display: flex; gap: 4px; margin-left: auto; }
	.dash-tab { padding: 6px 16px; font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-muted); text-decoration: none; border-radius: var(--radius-sm); transition: all 0.15s; }
	.dash-tab:hover { color: var(--text-dark); background: var(--bg-cream); }
	.dash-tab.active { color: var(--primary); background: rgba(81, 190, 123, 0.08); }
	.topbar-spacer { flex: 1; }
	.btn-add { padding: 8px 18px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 13px; cursor: pointer; }
	.content-area { padding: 24px; max-width: 1200px; }

	.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
	.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; text-align: center; }
	.stat-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
	.stat-value { font-family: var(--font-headline); font-size: 24px; font-weight: 800; color: var(--text-dark); }

	.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; }
	.chart-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; }
	.chart-card-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 16px; }
	.alloc-meta { display: flex; justify-content: center; gap: 24px; margin-top: 16px; }
	.alloc-stat { text-align: center; }
	.alloc-num { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); }
	.alloc-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }

	/* Chart.js donut */
	.chartjs-donut-wrap { width: 180px; height: 180px; margin: 0 auto 16px; }
	.alloc-legend { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
	.alloc-legend-item { display: flex; align-items: center; gap: 8px; font-family: var(--font-ui); font-size: 12px; }
	.alloc-legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
	.alloc-legend-label { flex: 1; color: var(--text-secondary); }
	.alloc-legend-pct { font-weight: 700; color: var(--text-dark); }

	/* Risk badges */
	.risk-badges { display: flex; flex-direction: column; gap: 10px; }
	.risk-badge { display: flex; align-items: flex-start; gap: 10px; padding: 12px; border-radius: var(--radius-sm); }
	.risk-badge-icon { flex-shrink: 0; width: 20px; height: 20px; }
	.risk-badge-icon svg { width: 20px; height: 20px; }
	.risk-badge-content { flex: 1; }
	.risk-badge-text { font-family: var(--font-ui); font-size: 13px; font-weight: 700; line-height: 1.4; }
	.risk-badge-detail { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 2px; }
	.risk-badge.badge-danger { background: rgba(239, 68, 68, 0.08); border-left: 3px solid #ef4444; }
	.risk-badge.badge-danger .risk-badge-icon { color: #ef4444; }
	.risk-badge.badge-danger .risk-badge-text { color: #ef4444; }
	.risk-badge.badge-warn { background: rgba(245, 158, 11, 0.08); border-left: 3px solid #f59e0b; }
	.risk-badge.badge-warn .risk-badge-icon { color: #f59e0b; }
	.risk-badge.badge-warn .risk-badge-text { color: #f59e0b; }
	.risk-badge.badge-ok { background: rgba(81, 190, 123, 0.08); border-left: 3px solid var(--primary); }
	.risk-badge.badge-ok .risk-badge-icon { color: var(--primary); }
	.risk-badge.badge-ok .risk-badge-text { color: var(--primary); }

	/* Timeline chart */
	.timeline-card { margin-bottom: 24px; }
	.chartjs-timeline-wrap { height: 200px; }

	.inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
	.inv-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.inv-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
	.inv-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; box-shadow: var(--shadow-card); display: flex; }
	.inv-card-stripe { width: 6px; flex-shrink: 0; }
	.inv-card-body { flex: 1; padding: 20px 24px; }
	.inv-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
	.inv-card-info { min-width: 0; flex: 1; }
	.inv-card-name { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; }
	.inv-card-sub { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); }
	.inv-card-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 12px; }
	.inv-status { padding: 4px 12px; border-radius: 100px; font-family: var(--font-ui); font-size: 11px; font-weight: 700; background: color-mix(in srgb, var(--sc) 8%, transparent); color: var(--sc); }
	.btn-edit { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 5px 12px; cursor: pointer; font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); }
	.btn-edit:hover { border-color: var(--primary); color: var(--primary); }
	.inv-card-metrics { display: flex; gap: 28px; flex-wrap: wrap; }
	.m-label { font-family: var(--font-ui); font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.m-value { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); }
	.m-value.green { color: var(--primary); }

	/* Empty state */
	.empty-charts { display: flex; gap: 24px; justify-content: center; margin-bottom: 32px; opacity: 0.5; }
	.empty-chart-box { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; text-align: center; min-width: 200px; }
	.chart-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-muted); margin-bottom: 16px; }
	.risk-bars { display: flex; flex-direction: column; gap: 10px; }
	.risk-bar { background: var(--border); height: 10px; border-radius: 4px; }
	.import-section { display: flex; justify-content: center; }
	.import-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 32px; max-width: 500px; text-align: center; }
	.import-card h3 { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); margin: 0 0 8px; }
	.import-card p { font-size: 14px; color: var(--text-secondary); margin: 0 0 24px; line-height: 1.6; }
	.upload-zone { position: relative; border: 2px dashed var(--border); border-radius: var(--radius); padding: 32px; cursor: pointer; transition: border-color 0.2s; }
	.upload-zone:hover { border-color: var(--primary); }
	.upload-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; }
	.upload-icon { margin-bottom: 12px; }
	.upload-icon svg { width: 40px; height: 40px; color: var(--text-muted); }
	.upload-label { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.upload-hint { font-size: 12px; color: var(--text-muted); line-height: 1.5; }
	.divider-text { font-size: 13px; color: var(--text-muted); margin: 16px 0; }
	.btn-manual { padding: 10px 24px; background: transparent; border: 2px solid var(--primary); color: var(--primary); border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 13px; cursor: pointer; }
	.browse-link { margin-top: 16px; font-size: 13px; }
	.browse-link a { color: var(--primary); text-decoration: none; font-weight: 600; }

	/* Tax section */
	.tax-section { margin-top: 32px; }
	.tax-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 20px; background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); cursor: pointer; width: 100%; font-family: var(--font-ui); }
	.tax-header:hover { background: var(--bg-cream); }
	.tax-header-left { display: flex; align-items: center; gap: 10px; }
	.tax-title { font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.tax-content { border: 1px solid var(--border); border-top: none; border-radius: 0 0 var(--radius) var(--radius); background: var(--bg-card); padding: 16px 20px; }
	.tax-empty { text-align: center; padding: 16px; font-size: 13px; color: var(--text-muted); }
	.tax-summary { font-size: 13px; color: var(--text-secondary); }
	.section-link { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; }

	/* Search box */
	.inv-header-right { display: flex; align-items: center; gap: 12px; }
	.search-box { position: relative; }
	.search-icon { width: 16px; height: 16px; position: absolute; left: 10px; top: 50%; transform: translateY(-50%); color: var(--text-muted); pointer-events: none; }
	.search-input { padding: 8px 12px 8px 32px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 13px; width: 220px; box-sizing: border-box; background: var(--bg-main); }
	.search-input:focus { outline: none; border-color: var(--primary); }

	/* Sort bar */
	.sort-bar { display: flex; gap: 4px; margin-bottom: 12px; flex-wrap: wrap; }
	.sort-btn { background: none; border: 1px solid transparent; padding: 4px 10px; font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-muted); cursor: pointer; border-radius: var(--radius-sm); white-space: nowrap; }
	.sort-btn:hover { color: var(--text-dark); background: var(--bg-cream); }
	.sort-btn.active { color: var(--primary); border-color: var(--primary); background: rgba(81, 190, 123, 0.06); }

	.no-results { text-align: center; padding: 32px; color: var(--text-muted); font-size: 14px; }

	/* Delete button on cards */
	.btn-delete { background: none; border: 1px solid transparent; border-radius: var(--radius-sm); padding: 4px 8px; cursor: pointer; font-size: 16px; line-height: 1; color: var(--text-muted); font-weight: 400; }
	.btn-delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.06); }

	/* Investment notes */
	.inv-card-notes { margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border); font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

	/* Deal search modal */
	.deal-search-hint { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; }
	.deal-search-input { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-body); font-size: 14px; margin-bottom: 12px; box-sizing: border-box; }
	.deal-search-input:focus { outline: none; border-color: var(--primary); }
	.deal-search-results { max-height: 280px; overflow-y: auto; margin-bottom: 16px; }
	.deal-search-empty { text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px; }
	.deal-search-item { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; border: 1px solid var(--border); border-radius: var(--radius-sm); margin-bottom: 6px; cursor: pointer; transition: background 0.15s; width: 100%; background: none; text-align: left; font-family: inherit; }
	.deal-search-item:hover:not(:disabled) { background: var(--bg-cream); }
	.deal-search-item.already { opacity: 0.5; cursor: default; }
	.deal-search-name { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.deal-search-sub { font-size: 11px; color: var(--text-secondary); }
	.deal-search-action { font-size: 11px; color: var(--text-muted); font-weight: 600; flex-shrink: 0; margin-left: 12px; }
	.deal-search-item.already .deal-search-action { color: var(--primary); }
	.deal-search-divider { border-top: 1px solid var(--border); padding-top: 12px; text-align: center; }
	.btn-manual-add { padding: 10px 20px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 13px; cursor: pointer; color: var(--text-secondary); }
	.btn-manual-add:hover { border-color: var(--primary); color: var(--primary); }

	/* Modal */
	.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
	.modal-card { background: var(--bg-card); border-radius: var(--radius); padding: 28px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; }
	.modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
	.modal-title { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.modal-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-muted); line-height: 1; }
	.modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
	.modal-field { margin-bottom: 16px; }
	.modal-field.full-width { grid-column: 1 / -1; }
	.modal-field label { display: block; font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
	.modal-field input, .modal-field select, .modal-field textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; font-family: var(--font-body); }
	.modal-field textarea { resize: vertical; }
	.modal-field input:focus, .modal-field select:focus, .modal-field textarea:focus { outline: none; border-color: var(--primary); }
	.modal-actions { display: flex; align-items: center; gap: 12px; margin-top: 8px; }
	.btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 13px; cursor: pointer; color: var(--text-secondary); }
	.btn-primary { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 13px; cursor: pointer; }
	.btn-danger { padding: 10px 20px; background: transparent; border: 1px solid #ef4444; border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 13px; cursor: pointer; color: #ef4444; }
	.btn-danger:hover { background: rgba(239, 68, 68, 0.06); }

	@media (max-width: 768px) {
		.mobile-menu-btn { display: block; }
		.charts-row { grid-template-columns: 1fr; }
		.empty-charts { flex-direction: column; align-items: center; }
		.modal-grid { grid-template-columns: 1fr; }
		.content-area { padding: 16px; }
		.inv-header { flex-direction: column; gap: 12px; align-items: stretch; }
		.inv-header-right { flex-direction: column; gap: 8px; }
		.search-input { width: 100%; }
		.sort-bar { overflow-x: auto; flex-wrap: nowrap; -webkit-overflow-scrolling: touch; }
		.summary-grid { grid-template-columns: repeat(2, 1fr); }
		.chartjs-donut-wrap { width: 150px; height: 150px; }
		.chartjs-timeline-wrap { height: 160px; }
	}
</style>
