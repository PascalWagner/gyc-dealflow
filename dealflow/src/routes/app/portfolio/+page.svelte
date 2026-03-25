<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { deals, dealStages, fetchDeals } from '$lib/stores/deals.js';

	let portfolio = $state([]);
	let taxDocuments = $state([]);
	let wizardData = $state({});
	let showAddModal = $state(false);
	let showDealSearch = $state(false);
	let editingId = $state('');
	let dealSearchQuery = $state('');
	let dealSearchResults = $state([]);
	let dealSearchLoading = $state(false);
	let taxYearFilter = $state('all');
	let taxDocsOpen = $state(false);

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
	const allocationEntries = $derived(Object.entries(allocationMap).sort((a, b) => b[1] - a[1]));
	const allocationTotal = $derived(allocationEntries.reduce((sum, [, amount]) => sum + amount, 0));
	const allocationSlices = $derived.by(() => {
		if (allocationEntries.length === 0 || allocationTotal === 0) return [];
		let currentAngle = -90;
		return allocationEntries.map(([assetClass, amount], index) => {
			const pct = amount / allocationTotal;
			const angle = pct * 360;
			const startAngle = currentAngle * Math.PI / 180;
			const endAngle = (currentAngle + angle) * Math.PI / 180;
			const largeArcFlag = angle > 180 ? 1 : 0;
			const x1 = 80 + 60 * Math.cos(startAngle);
			const y1 = 80 + 60 * Math.sin(startAngle);
			const x2 = 80 + 60 * Math.cos(endAngle);
			const y2 = 80 + 60 * Math.sin(endAngle);
			currentAngle += angle;
			return {
				assetClass,
				amount,
				pct,
				color: PIE_COLORS[index % PIE_COLORS.length],
				x1,
				y1,
				x2,
				y2,
				largeArcFlag,
				isOnly: allocationEntries.length === 1
			};
		});
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
	const timelineMax = $derived.by(() => {
		if (!timelineData?.amounts?.length) return 0;
		return Math.max(...timelineData.amounts, totalInvested);
	});

	const PIE_COLORS = ['#51BE7B', '#2563EB', '#f59e0b', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#6366f1'];

	const sorted = $derived(portfolio);
	const taxYears = $derived.by(() =>
		[...new Set(taxDocuments.map((doc) => doc.taxYear).filter(Boolean))].sort((a, b) => Number(b) - Number(a))
	);
	const visibleTaxDocuments = $derived.by(() =>
		taxYearFilter === 'all'
			? taxDocuments
			: taxDocuments.filter((doc) => String(doc.taxYear) === String(taxYearFilter))
	);
	const investedUnloggedDeals = $derived.by(() => {
		const investedIds = Object.entries($dealStages || {})
			.filter(([, stage]) => stage === 'invested')
			.map(([id]) => id);
		return investedIds
			.map((id) => ($deals || []).find((deal) => deal.id === id))
			.filter(Boolean)
			.filter((deal) => !portfolio.some((investment) => investment.dealId === deal.id));
	});
	const taxReceivedCount = $derived(taxDocuments.filter(doc => doc.uploadStatus === 'Received').length);
	const taxSummaryText = $derived.by(() => {
		if (taxDocuments.length === 0) return 'No tax documents yet';
		const pendingCount = taxDocuments.length - taxReceivedCount;
		return `${taxDocuments.length} tracked · ${taxReceivedCount} received${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`;
	});

	const statusColors = { Active: 'var(--primary)', Distributing: '#3b82f6', Exited: 'var(--text-muted)', Pending: '#f59e0b' };

	function getToken() {
		if (!browser) return null;
		const stored = JSON.parse(localStorage.getItem('gycUser') || '{}');
		return stored?.token || localStorage.getItem('sb_token') || localStorage.getItem('ghlToken') || null;
	}

	function normalizePortfolioRecord(record = {}) {
		return {
			id: record.id || `inv_${Math.random().toString(36).slice(2, 9)}`,
			_recordId: record._recordId || record.id || '',
			dealId: record.dealId || record.deal_id || '',
			investmentName: record.investmentName || record.investment_name || '',
			sponsor: record.sponsor || '',
			assetClass: record.assetClass || record.asset_class || '',
			amountInvested: record.amountInvested ?? record.amount_invested ?? '',
			dateInvested: record.dateInvested || record.date_invested || '',
			status: record.status || 'Active',
			targetIRR: record.targetIRR ?? record.target_irr ?? '',
			distributionsReceived: record.distributionsReceived ?? record.distributions_received ?? '',
			equityMultiple: record.equityMultiple ?? record.equity_multiple ?? '',
			investingEntity: record.investingEntity || record.investing_entity || '',
			entityInvestedInto: record.entityInvestedInto || record.entity_invested_into || '',
			holdPeriod: record.holdPeriod || record.hold_period || '',
			notes: record.notes || ''
		};
	}

	function savePortfolioLocal(nextPortfolio) {
		portfolio = [...nextPortfolio];
		if (browser) {
			localStorage.setItem('gycPortfolio', JSON.stringify(portfolio));
		}
	}

	function saveTaxDocsLocal(nextDocs) {
		taxDocuments = [...nextDocs];
		if (browser) {
			localStorage.setItem('gycTaxDocs', JSON.stringify(taxDocuments));
		}
	}

	function buildPortfolioPayload(investment) {
		return {
			_recordId: investment._recordId || undefined,
			'Deal ID': investment.dealId || '',
			'Investment Name': investment.investmentName || '',
			Sponsor: investment.sponsor || '',
			'Asset Class': investment.assetClass || '',
			'Amount Invested': parseFloat(investment.amountInvested) || 0,
			'Date Invested': investment.dateInvested || '',
			Status: investment.status || 'Active',
			'Target IRR': investment.targetIRR !== '' ? parseFloat(investment.targetIRR) || 0 : '',
			'Distributions Received': parseFloat(investment.distributionsReceived) || 0,
			'Hold Period': investment.holdPeriod || '',
			'Investing Entity': investment.investingEntity || '',
			'Entity Invested Into': investment.entityInvestedInto || '',
			Notes: investment.notes || ''
		};
	}

	async function syncPortfolioRecord(investment) {
		const token = getToken();
		if (!token) return normalizePortfolioRecord(investment);
		const response = await fetch('/api/userdata', {
			method: 'POST',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'portfolio',
				data: buildPortfolioPayload(investment)
			})
		});
		if (!response.ok) {
			throw new Error(`Portfolio sync failed: ${response.status}`);
		}
		const result = await response.json();
		return normalizePortfolioRecord({
			...investment,
			...(result.record || {})
		});
	}

	async function deletePortfolioRecord(investment) {
		const token = getToken();
		if (!token || !investment?._recordId) return;
		const response = await fetch('/api/userdata', {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({
				type: 'portfolio',
				recordId: investment._recordId
			})
		});
		if (!response.ok) {
			throw new Error(`Portfolio delete failed: ${response.status}`);
		}
	}

	async function loadPortfolioData() {
		if (!browser) return;
		const localPortfolio = JSON.parse(localStorage.getItem('gycPortfolio') || '[]').map((item) => normalizePortfolioRecord(item));
		const localTaxDocs = JSON.parse(localStorage.getItem('gycTaxDocs') || '[]');
		savePortfolioLocal(localPortfolio);
		saveTaxDocsLocal(localTaxDocs);
		taxDocsOpen = localTaxDocs.length > 0;
		wizardData = JSON.parse(localStorage.getItem('gycBuyBoxWizard') || '{}');

		const token = getToken();
		if (!token) return;

		try {
			const response = await fetch('/api/userdata?type=portfolio', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!response.ok) return;
			const data = await response.json();
			const remotePortfolio = Array.isArray(data?.records)
				? data.records.map((item) => normalizePortfolioRecord(item))
				: [];
			if (remotePortfolio.length > 0 || localPortfolio.length === 0) {
				savePortfolioLocal(remotePortfolio);
			}
		} catch (error) {
			console.warn('Portfolio sync load failed:', error);
		}
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

	async function saveInvestment() {
		if (!modalData.investmentName.trim()) { alert('Please enter an investment name.'); return; }
		let draftInvestment;
		let nextPortfolio = [...portfolio];
		if (editingId) {
			const idx = portfolio.findIndex(i => i.id === editingId);
			if (idx < 0) return;
			draftInvestment = normalizePortfolioRecord({ ...portfolio[idx], ...modalData, id: editingId });
			nextPortfolio[idx] = draftInvestment;
		} else {
			draftInvestment = normalizePortfolioRecord({
				...modalData,
				id: 'inv_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7)
			});
			nextPortfolio = [...portfolio, draftInvestment];
			// Auto-add tax document for new investments
			if (browser) {
				const taxDocs = [...taxDocuments];
				const year = new Date().getFullYear();
				const alreadyExists = taxDocs.some(t => t.investmentName === draftInvestment.investmentName && t.taxYear == year);
				if (!alreadyExists) {
					taxDocs.push({
						id: 'tax_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7),
						taxYear: year,
						investmentName: draftInvestment.investmentName,
						investingEntity: draftInvestment.investingEntity || '',
						entityInvestedInto: draftInvestment.entityInvestedInto || '',
						formType: 'K-1',
						uploadStatus: 'Pending',
						dateReceived: '', portalUrl: '', contact: '', notes: '', fileUrl: ''
					});
					saveTaxDocsLocal(taxDocs);
					taxDocsOpen = true;
				}
			}
		}
		savePortfolioLocal(nextPortfolio);
		try {
			const synced = await syncPortfolioRecord(draftInvestment);
			savePortfolioLocal(nextPortfolio.map((investment) => investment.id === draftInvestment.id ? synced : investment));
		} catch (error) {
			console.warn('Portfolio save sync failed:', error);
		}
		showAddModal = false;
	}

	async function deleteInvestment(id) {
		if (!confirm('Delete this investment from your portfolio?')) return;
		const existingInvestment = portfolio.find((investment) => investment.id === id);
		savePortfolioLocal(portfolio.filter(i => i.id !== id));
		try {
			await deletePortfolioRecord(existingInvestment);
		} catch (error) {
			console.warn('Portfolio delete sync failed:', error);
		}
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
		fetchDeals();
		await loadPortfolioData();
	});
</script>

<div class="topbar">
	<button class="mobile-menu-btn" aria-label="Open navigation menu" onclick={() => document.getElementById('sidebar')?.classList.toggle('open')}>
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
		<div class="import-section">
			<div class="import-card">
				<div class="empty-briefcase">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" width="42" height="42"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
				</div>
				<h3>No investments yet</h3>
				<p>Add your first investment to start tracking allocation, performance, and tax documents in one place.</p>
				<button class="btn-manual" onclick={() => openDealSearchModal()}>+ Add Investment</button>
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
		</div>

		<!-- Charts row -->
		<div class="charts-row">
			<div class="chart-card">
				<div class="chart-card-title">Asset Class Allocation</div>
				<div class="chartjs-donut-wrap">
					{#if allocationSlices.length > 0}
						<svg viewBox="0 0 160 160" class="allocation-donut" aria-hidden="true">
							{#each allocationSlices as slice}
								{#if slice.isOnly}
									<circle cx="80" cy="80" r="60" fill={slice.color}></circle>
								{:else}
									<path
										d={`M80,80 L${slice.x1},${slice.y1} A60,60 0 ${slice.largeArcFlag},1 ${slice.x2},${slice.y2} Z`}
										fill={slice.color}
									></path>
								{/if}
							{/each}
							<circle cx="80" cy="80" r="33" fill="var(--bg-card)"></circle>
						</svg>
					{/if}
				</div>
				<div class="alloc-legend">
					{#each allocationEntries as [cls, amt], i}
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
				<div class="chart-card-title">Capital Deployed Over Time</div>
				<div class="chartjs-timeline-wrap">
					<div class="timeline-grid-lines">
						<div></div>
						<div></div>
						<div></div>
						<div></div>
					</div>
					<div class="timeline-bars">
						{#each timelineData.labels as label, index}
							<div class="timeline-col">
								<div
									class="timeline-bar"
									style={`height:${timelineMax ? Math.max(8, Math.round((timelineData.amounts[index] / timelineMax) * 180)) : 8}px`}
								></div>
								<div class="timeline-label">{label}</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- Investment cards -->
		<div class="inv-header">
			<div class="inv-title">Your Investments</div>
			<button class="btn-add section-add-btn" onclick={() => openDealSearchModal()}>+ Add Investment</button>
		</div>

		<div class="inv-table-wrap">
			<table class="inv-table">
				<thead>
					<tr>
						<th>Investment</th>
						<th>Sponsor</th>
						<th>Asset Class</th>
						<th>Amount</th>
						<th>Date</th>
						<th>Status</th>
						<th>Target IRR</th>
						<th>Distributions</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each sorted as inv}
						{@const sc = statusColors[inv.status] || 'var(--text-muted)'}
						<tr>
							<td class="inv-table-primary">
								<div class="inv-cell-name">{inv.investmentName || 'Unnamed'}</div>
							</td>
							<td>{inv.sponsor || '—'}</td>
							<td>{inv.assetClass || '—'}</td>
							<td class="num">${(parseFloat(inv.amountInvested) || 0).toLocaleString()}</td>
							<td>{inv.dateInvested || '—'}</td>
							<td><span class="inv-status" style="--sc:{sc}">{inv.status || 'Unknown'}</span></td>
							<td class:green={!!inv.targetIRR}>{inv.targetIRR ? `${inv.targetIRR}%` : '—'}</td>
							<td class:num class:green={parseFloat(inv.distributionsReceived || 0) > 0}>${(parseFloat(inv.distributionsReceived) || 0).toLocaleString()}</td>
							<td>
								<div class="inv-table-actions">
									<button class="btn-edit" onclick={() => openAddModal(inv.id)}>Edit</button>
									<button class="btn-delete" onclick={() => deleteInvestment(inv.id)} title="Delete investment">&times;</button>
								</div>
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<div class="inv-list inv-list-mobile">
			{#each sorted as inv}
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

		{#if investedUnloggedDeals.length > 0}
			<div class="pending-section-label">Needs Investment Details</div>
			<div class="inv-list pending-list">
				{#each investedUnloggedDeals as deal}
					<div class="inv-card pending-card">
						<div class="inv-card-stripe pending-stripe"></div>
						<div class="inv-card-body">
							<div class="inv-card-top">
								<div class="inv-card-info">
									<div class="inv-card-name">{deal.investmentName || deal.investment_name || deal.name || 'Unknown Deal'}</div>
									<div class="inv-card-sub">{deal.managementCompany || deal.sponsor || deal.management_company || ''}{deal.assetClass ? ` · ${deal.assetClass}` : ''}</div>
								</div>
								<div class="inv-card-actions">
									<span class="inv-status pending-status">Pending</span>
									<button class="btn-pending-add" onclick={() => selectDealForPortfolio(deal)}>Add Details</button>
								</div>
							</div>
							<div class="pending-card-desc">This deal is already marked as invested in your pipeline, but it has not been logged in your tracked portfolio yet.</div>
						</div>
					</div>
				{/each}
			</div>
		{/if}

		<div class="tax-shell">
			<button class="tax-shell-toggle" type="button" aria-expanded={taxDocsOpen} onclick={() => taxDocsOpen = !taxDocsOpen}>
				<div class="tax-shell-toggle-copy">
					<div class="tax-shell-title">Tax Documents</div>
					<div class="tax-shell-desc">{taxSummaryText}</div>
				</div>
				<svg class="tax-shell-chevron" class:open={taxDocsOpen} viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="6 9 12 15 18 9"/></svg>
			</button>
			{#if taxDocsOpen}
				<div class="tax-shell-body">
					<div class="tax-shell-actions">
						<select class="tax-filter-select" bind:value={taxYearFilter}>
							<option value="all">All Years</option>
							{#each taxYears as year}
								<option value={year}>{year}</option>
							{/each}
						</select>
						<a href="/app/tax-prep" class="tax-action-btn secondary">Auto-Populate from Portfolio</a>
						<a href="/app/tax-prep" class="tax-action-btn">+ Add</a>
					</div>
					{#if taxDocuments.length === 0}
						<div class="tax-empty-state">
							<div class="tax-empty-title">No tax documents yet</div>
							<div class="tax-empty-copy">Auto-populate from portfolio or add documents manually to track upcoming K-1s and 1099s.</div>
							<div class="tax-empty-actions">
								<a href="/app/tax-prep" class="tax-action-btn secondary">Auto-Populate from Portfolio</a>
								<a href="/app/tax-prep" class="tax-action-btn">+ Add Manually</a>
							</div>
						</div>
					{:else}
						<div class="tax-table-wrap">
							<table class="tax-table">
								<thead>
									<tr>
										<th>Tax Year</th>
										<th>Investment</th>
										<th>Investing Entity</th>
										<th>Entity Invested Into</th>
										<th>Form Type</th>
										<th>Status</th>
										<th>Date Received</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each visibleTaxDocuments as doc}
										<tr>
											<td>{doc.taxYear || '—'}</td>
											<td class="inv-table-primary">{doc.investmentName || '—'}</td>
											<td>{doc.investingEntity || '—'}</td>
											<td>{doc.entityInvestedInto || '—'}</td>
											<td>{doc.formType || '—'}</td>
											<td>
												<span class="tax-status" class:received={doc.uploadStatus === 'Received'}>{doc.uploadStatus || 'Pending'}</span>
											</td>
											<td>{doc.dateReceived || '—'}</td>
											<td>
												<a class="tax-row-link" href={doc.fileUrl || doc.portalUrl || '/app/tax-prep'} target={doc.fileUrl || doc.portalUrl ? '_blank' : undefined} rel={doc.fileUrl || doc.portalUrl ? 'noopener' : undefined}>
													{doc.fileUrl || doc.portalUrl ? 'View' : 'Manage'}
												</a>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/if}
		</div>
	{/if}
</div>

<!-- Deal Search Modal -->
{#if showDealSearch}
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		aria-label="Close add to portfolio modal"
		onclick={(e) => { if (e.target === e.currentTarget) showDealSearch = false; }}
		onkeydown={(e) => {
			if (e.target !== e.currentTarget) return;
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				showDealSearch = false;
			}
		}}
	>
		<div class="modal-card" style="max-width:520px;">
			<div class="modal-top">
				<div class="modal-title">Add to Portfolio</div>
				<button class="modal-close" aria-label="Close add to portfolio modal" onclick={() => showDealSearch = false}>&times;</button>
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
	<div
		class="modal-overlay"
		role="button"
		tabindex="0"
		aria-label="Close investment form modal"
		onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }}
		onkeydown={(e) => {
			if (e.target !== e.currentTarget) return;
			if (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				showAddModal = false;
			}
		}}
	>
		<div class="modal-card">
			<div class="modal-top">
				<div class="modal-title">{editingId ? 'Edit' : 'Add'} Investment</div>
				<button class="modal-close" aria-label="Close investment form modal" onclick={() => showAddModal = false}>&times;</button>
			</div>
			<div class="modal-grid">
				<div class="modal-field"><label for="portfolioInvestmentName">Investment Name *</label><input id="portfolioInvestmentName" bind:value={modalData.investmentName} placeholder="e.g. Acme Multi-Family Fund II"></div>
				<div class="modal-field"><label for="portfolioSponsor">Sponsor</label><input id="portfolioSponsor" bind:value={modalData.sponsor} placeholder="e.g. Acme Capital"></div>
				<div class="modal-field">
					<label for="portfolioAssetClass">Asset Class</label>
					<select id="portfolioAssetClass" bind:value={modalData.assetClass}>
						<option value="">Select...</option>
						<option>Multi Family</option><option>Self Storage</option><option>Industrial</option>
						<option>Lending</option><option>Short Term Rental</option><option>Hotels/Hospitality</option>
						<option>Mixed-Use</option><option>RV/Mobile Home Parks</option><option>Senior Living</option>
						<option>Land</option><option>Car Wash</option><option>Oil & Gas</option><option>Other</option>
					</select>
				</div>
				<div class="modal-field"><label for="portfolioAmountInvested">Amount Invested ($)</label><input id="portfolioAmountInvested" type="number" bind:value={modalData.amountInvested} placeholder="50000"></div>
				<div class="modal-field"><label for="portfolioDateInvested">Date Invested</label><input id="portfolioDateInvested" type="date" bind:value={modalData.dateInvested}></div>
				<div class="modal-field">
					<label for="portfolioStatus">Status</label>
					<select id="portfolioStatus" bind:value={modalData.status}>
						<option>Active</option><option>Distributing</option><option>Exited</option><option>Pending</option>
					</select>
				</div>
				<div class="modal-field"><label for="portfolioTargetIRR">Target IRR (%)</label><input id="portfolioTargetIRR" type="number" step="0.1" bind:value={modalData.targetIRR} placeholder="15"></div>
				<div class="modal-field"><label for="portfolioDistributionsReceived">Distributions Received ($)</label><input id="portfolioDistributionsReceived" type="number" bind:value={modalData.distributionsReceived} placeholder="0"></div>
				<div class="modal-field"><label for="portfolioEquityMultiple">Equity Multiple</label><input id="portfolioEquityMultiple" type="number" step="0.01" bind:value={modalData.equityMultiple} placeholder="1.8"></div>
				<div class="modal-field"><label for="portfolioHoldPeriod">Hold Period (years)</label><input id="portfolioHoldPeriod" bind:value={modalData.holdPeriod} placeholder="e.g. 5"></div>
				<div class="modal-field"><label for="portfolioInvestingEntity">Investing Entity</label><input id="portfolioInvestingEntity" bind:value={modalData.investingEntity} placeholder="e.g. My LLC"></div>
				<div class="modal-field"><label for="portfolioEntityInvestedInto">Entity Invested Into</label><input id="portfolioEntityInvestedInto" bind:value={modalData.entityInvestedInto} placeholder="e.g. Acme Fund II LLC"></div>
				<div class="modal-field full-width"><label for="portfolioNotes">Notes</label><textarea id="portfolioNotes" bind:value={modalData.notes} rows="2" placeholder="Optional notes about this investment..."></textarea></div>
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
	/* ── Top Bar ── */
	.topbar {
		position: sticky;
		top: 0;
		height: var(--topbar-height);
		background: var(--bg-cream);
		border-bottom: 1px solid var(--border);
		display: flex;
		align-items: center;
		padding: 0 32px;
		gap: 16px;
		z-index: 50;
	}
	.mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; padding: 4px; }
	.mobile-menu-btn svg { width: 22px; height: 22px; }
	.topbar-title {
		font-family: var(--font-headline);
		font-size: 22px;
		font-weight: 400;
		color: var(--text-dark);
		margin-right: 24px;
		letter-spacing: -0.3px;
	}
	.dash-tabs {
		display: flex;
		gap: 4px;
		margin-left: 24px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 3px;
		align-self: center;
	}
	.dash-tab {
		background: none;
		border: none;
		padding: 6px 12px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
		cursor: pointer;
		white-space: nowrap;
		transition: all 0.15s;
		text-decoration: none;
		display: flex;
		align-items: center;
		text-transform: uppercase;
		letter-spacing: 0.3px;
		border-radius: 6px;
	}
	.dash-tab:hover { color: var(--text-dark); }
	.dash-tab.active { color: #fff; background: var(--primary); }
	.topbar-spacer { flex: 1; }
	.btn-add {
		padding: 8px 18px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		transition: background var(--transition);
	}
	.btn-add:hover { background: var(--primary-hover); }
	.section-add-btn {
		padding: 8px 20px;
		font-size: 12px;
	}

	/* ── Content Area ── */
	.content-area { padding: 24px 24px 40px; max-width: 1200px; }

	/* ── Summary Stat Cards ── */
	.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-bottom: 20px; }
	.summary-grid .stat-card:nth-child(5) { display: none; }
	.stat-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 18px;
		text-align: center;
	}
	.stat-label {
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		margin-bottom: 8px;
		font-family: var(--font-ui);
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}
	.stat-value {
		font-size: 24px;
		font-weight: 800;
		color: var(--primary);
		font-family: var(--font-ui);
	}

	/* ── Charts Row ── */
	.charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px; }
	.chart-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 20px;
	}
	.chart-card-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 16px;
	}
	.alloc-meta { display: flex; justify-content: center; gap: 24px; margin-top: 16px; }
	.alloc-stat { text-align: center; }
	.alloc-num { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); }
	.alloc-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }

	/* ── Allocation Donut ── */
	.chartjs-donut-wrap {
		display: flex;
		justify-content: center;
		align-items: center;
		min-height: 172px;
		margin-bottom: 12px;
	}
	.allocation-donut {
		width: 180px;
		height: 180px;
		display: block;
	}
	.alloc-legend { display: flex; flex-direction: column; gap: 6px; margin-bottom: 16px; }
	.alloc-legend-item { display: flex; align-items: center; gap: 8px; font-family: var(--font-ui); font-size: 12px; }
	.alloc-legend-dot { width: 10px; height: 10px; border-radius: 3px; flex-shrink: 0; }
	.alloc-legend-label { flex: 1; color: var(--text-secondary); }
	.alloc-legend-pct { font-weight: 700; color: var(--text-dark); }

	/* ── Risk Insights (matches old border-left style) ── */
	.risk-badges { display: flex; flex-direction: column; gap: 10px; }
	.risk-badge {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--orange);
		border-radius: var(--radius-sm);
		padding: 14px 16px;
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-dark);
	}
	.risk-badge-icon { display: none; }
	.risk-badge-icon svg { width: 20px; height: 20px; }
	.risk-badge-content { flex: 1; }
	.risk-badge-text { font-family: var(--font-ui); font-size: 13px; font-weight: 700; line-height: 1.4; }
	.risk-badge-detail { font-family: var(--font-body); font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 2px; }
	.risk-badge.badge-danger {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--red, #D04040);
	}
	.risk-badge.badge-danger .risk-badge-text { color: var(--text-dark); }
	.risk-badge.badge-warn {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--orange);
	}
	.risk-badge.badge-warn .risk-badge-text { color: var(--text-dark); }
	.risk-badge.badge-ok {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-left: 4px solid var(--green);
	}
	.risk-badge.badge-ok .risk-badge-text { color: var(--text-dark); }

	/* ── Timeline Chart ── */
	.timeline-card { margin-bottom: 20px; }
	.chartjs-timeline-wrap {
		position: relative;
		height: 260px;
		padding: 18px 18px 8px;
	}
	.timeline-grid-lines {
		position: absolute;
		inset: 18px 18px 34px;
		display: grid;
		grid-template-rows: repeat(4, 1fr);
		pointer-events: none;
	}
	.timeline-grid-lines div {
		border-top: 1px solid rgba(17, 24, 39, 0.08);
	}
	.timeline-bars {
		position: relative;
		height: 100%;
		display: flex;
		align-items: flex-end;
		gap: 14px;
	}
	.timeline-col {
		flex: 1;
		min-width: 44px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: flex-end;
		gap: 10px;
	}
	.timeline-bar {
		width: min(40px, 100%);
		border-radius: 10px 10px 0 0;
		background: linear-gradient(180deg, #7ed49c 0%, #51BE7B 100%);
		box-shadow: inset 0 -1px 0 rgba(0, 0, 0, 0.05);
	}
	.timeline-label {
		font-family: var(--font-ui);
		font-size: 10px;
		color: var(--text-muted);
		text-align: center;
		line-height: 1.35;
	}

	/* ── Investment List Header ── */
	.inv-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
	.inv-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.inv-table-wrap {
		overflow-x: auto;
		border: 1px solid var(--border);
		border-radius: var(--radius);
		background: var(--bg-card);
		margin-bottom: 20px;
	}
	.inv-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-ui);
		font-size: 12px;
	}
	.inv-table th {
		padding: 12px 14px;
		text-align: left;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border-light);
		background: var(--bg-cream);
		white-space: nowrap;
	}
	.inv-table td {
		padding: 14px;
		border-bottom: 1px solid var(--border-light);
		color: var(--text-secondary);
		vertical-align: middle;
		white-space: nowrap;
	}
	.inv-table tbody tr:last-child td { border-bottom: none; }
	.inv-table-primary,
	.inv-cell-name {
		font-weight: 700;
		color: var(--text-dark);
	}
	.inv-table td.num { font-variant-numeric: tabular-nums; color: var(--text-dark); }
	.inv-table td.green { color: var(--primary); font-weight: 700; }
	.inv-table-actions { display: flex; align-items: center; gap: 8px; }
	.pending-section-label {
		margin: 20px 0 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	/* ── Investment Cards ── */
	.inv-list { display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px; }
	.inv-list-mobile { display: none; }
	.inv-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		display: flex;
		transition: all 0.25s ease;
	}
	.inv-card:hover { border-color: color-mix(in srgb, var(--primary) 18%, var(--border)); }
	.inv-card-stripe { width: 6px; flex-shrink: 0; }
	.inv-card-body { flex: 1; padding: 20px 24px; }
	.inv-card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 14px; }
	.inv-card-info { min-width: 0; flex: 1; }
	.inv-card-name { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; }
	.inv-card-sub { font-family: var(--font-body); font-size: 12px; color: var(--text-muted); }
	.inv-card-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; margin-left: 12px; }
	.inv-status { padding: 4px 12px; border-radius: 100px; font-family: var(--font-ui); font-size: 11px; font-weight: 700; background: color-mix(in srgb, var(--sc) 8%, transparent); color: var(--sc); }
	.pending-status {
		--sc: #f59e0b;
		background: rgba(245, 158, 11, 0.08);
		color: #f59e0b;
	}
	.btn-edit {
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		padding: 5px 12px;
		cursor: pointer;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		transition: all 0.15s ease;
	}
	.btn-edit:hover {
		background: transparent;
		border-color: var(--primary);
		color: var(--primary);
	}
	.inv-card-metrics { display: flex; gap: 28px; flex-wrap: wrap; }
	.m-label { font-family: var(--font-ui); font-size: 9px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	.m-value { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); font-variant-numeric: tabular-nums; }
	.m-value.green { color: var(--primary); }
	.pending-stripe { background: #f59e0b; }
	.pending-card-desc {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
	}
	.btn-pending-add {
		padding: 6px 14px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}
	.btn-pending-add:hover { background: var(--primary-hover); }

	/* ── Empty State ── */
	.empty-charts {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 24px;
		margin-bottom: 24px;
		opacity: 0.35;
		pointer-events: none;
	}
	.empty-chart-box {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 24px;
		min-height: 180px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}
	.chart-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 16px;
		align-self: flex-start;
	}
	.risk-bars { display: flex; flex-direction: column; gap: 10px; width: 100%; }
	.risk-bar { background: var(--border); height: 10px; border-radius: 4px; }

	/* ── Import / Empty Card ── */
	.import-section {
		max-width: 520px;
		margin: 0 auto;
		padding: 40px 24px 24px;
	}
	.import-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 28px 24px;
		text-align: center;
	}
	.empty-briefcase {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 68px;
		height: 68px;
		border-radius: 20px;
		background: var(--bg-cream);
		color: var(--text-muted);
		margin-bottom: 14px;
	}
	.import-card h3 {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--text-dark);
		margin: 0 0 6px;
	}
	.import-card p {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-muted);
		margin: 0 0 24px;
		line-height: 1.5;
	}
	.btn-manual {
		padding: 10px 24px;
		background: var(--primary);
		color: #fff;
		border: 1px solid var(--primary);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		transition: background 0.2s, border-color 0.2s;
	}
	.btn-manual:hover { background: var(--primary-hover); border-color: var(--primary-hover); color: #fff; }
	.browse-link {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid var(--border);
	}
	.browse-link a {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
		cursor: pointer;
	}
	.browse-link a:hover { text-decoration: underline; }

	/* ── Tax Section ── */
	.tax-shell {
		margin-top: 28px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
	}
	.tax-shell-toggle {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 18px;
		background: var(--bg-card);
		border: none;
		cursor: pointer;
		text-align: left;
	}
	.tax-shell-toggle:hover {
		background: var(--bg-cream);
	}
	.tax-shell-toggle-copy {
		min-width: 0;
	}
	.tax-shell-chevron {
		flex-shrink: 0;
		color: var(--text-muted);
		transition: transform 0.2s ease;
	}
	.tax-shell-chevron.open {
		transform: rotate(180deg);
	}
	.tax-shell-body {
		border-top: 1px solid var(--border-light);
	}
	.tax-shell-actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 16px;
		padding: 16px 18px;
		flex-wrap: wrap;
	}
	.tax-shell-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.tax-shell-desc {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		margin-top: 4px;
		line-height: 1.5;
	}
	.tax-filter-select {
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
	}
	.tax-action-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 14px;
		background: var(--primary);
		color: #fff;
		border: 1px solid var(--primary);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		text-decoration: none;
		white-space: nowrap;
	}
	.tax-action-btn.secondary {
		background: transparent;
		color: var(--primary);
	}
	.tax-empty-state {
		padding: 20px 18px 24px;
		text-align: center;
	}
	.tax-empty-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.tax-empty-copy {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-secondary);
		margin-top: 6px;
		line-height: 1.5;
	}
	.tax-empty-actions {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-top: 18px;
	}
	.tax-table-wrap { overflow-x: auto; }
	.tax-table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-ui);
		font-size: 12px;
	}
	.tax-table th {
		padding: 12px 14px;
		text-align: left;
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		border-bottom: 1px solid var(--border-light);
		background: var(--bg-cream);
		white-space: nowrap;
	}
	.tax-table td {
		padding: 14px;
		border-bottom: 1px solid var(--border-light);
		color: var(--text-secondary);
		white-space: nowrap;
	}
	.tax-table tbody tr:last-child td { border-bottom: none; }
	.tax-status {
		display: inline-flex;
		align-items: center;
		padding: 4px 10px;
		border-radius: 999px;
		background: rgba(245, 158, 11, 0.08);
		color: #f59e0b;
		font-size: 11px;
		font-weight: 700;
	}
	.tax-status.received {
		background: rgba(81, 190, 123, 0.1);
		color: var(--primary);
	}
	.tax-row-link {
		font-size: 12px;
		font-weight: 700;
		color: var(--primary);
		text-decoration: none;
	}

	/* ── Delete Button ── */
	.btn-delete {
		background: none;
		border: 1px solid transparent;
		border-radius: var(--radius-sm);
		padding: 4px 8px;
		cursor: pointer;
		font-size: 16px;
		line-height: 1;
		color: var(--text-muted);
		font-weight: 400;
		transition: all 0.15s ease;
	}
	.btn-delete:hover { color: #ef4444; border-color: #ef4444; background: rgba(239, 68, 68, 0.06); }

	/* ── Investment Notes ── */
	.inv-card-notes {
		margin-top: 10px;
		padding-top: 10px;
		border-top: 1px solid var(--border);
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	/* ── Deal Search Modal ── */
	.deal-search-hint { font-size: 13px; color: var(--text-secondary); margin: 0 0 16px; }
	.deal-search-input {
		width: 100%;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-body);
		font-size: 14px;
		margin-bottom: 12px;
		box-sizing: border-box;
		background: var(--bg-card);
		color: var(--text-dark);
	}
	.deal-search-input:focus { outline: none; border-color: var(--primary); }
	.deal-search-results { max-height: 280px; overflow-y: auto; margin-bottom: 16px; }
	.deal-search-empty { text-align: center; padding: 24px; color: var(--text-muted); font-size: 13px; }
	.deal-search-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		margin-bottom: 6px;
		cursor: pointer;
		transition: background 0.15s;
		width: 100%;
		background: none;
		text-align: left;
		font-family: inherit;
	}
	.deal-search-item:hover:not(:disabled) { background: var(--bg-cream); }
	.deal-search-item.already { opacity: 0.5; cursor: default; }
	.deal-search-name { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.deal-search-sub { font-size: 11px; color: var(--text-secondary); }
	.deal-search-action { font-size: 11px; color: var(--text-muted); font-weight: 600; flex-shrink: 0; margin-left: 12px; }
	.deal-search-item.already .deal-search-action { color: var(--primary); }
	.deal-search-divider { border-top: 1px solid var(--border); padding-top: 12px; text-align: center; }
	.btn-manual-add {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		color: var(--text-secondary);
		transition: border-color 0.2s, color 0.2s;
	}
	.btn-manual-add:hover { border-color: var(--primary); color: var(--primary); }

	/* ── Modal ── */
	.modal-overlay {
		position: fixed;
		top: 0; left: 0; right: 0; bottom: 0;
		background: rgba(0,0,0,0.22);
		z-index: 9999;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		animation: modalFadeIn 0.2s ease;
	}
	@keyframes modalFadeIn { from { opacity: 0; } to { opacity: 1; } }
	@keyframes modalSlideUp {
		from { opacity: 0; transform: translateY(12px) scale(0.98); }
		to { opacity: 1; transform: translateY(0) scale(1); }
	}
	.modal-card {
		background: var(--bg-card);
		border-radius: 16px;
		padding: 28px;
		max-width: 600px;
		width: 100%;
		max-height: 90vh;
		overflow-y: auto;
		box-shadow: 0 24px 60px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.03);
		animation: modalSlideUp 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
	}
	:global(html.dark) .modal-card { box-shadow: 0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06); }
	.modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
	.modal-title {
		font-family: var(--font-ui);
		font-size: 17px;
		font-weight: 700;
		color: var(--text-dark);
		letter-spacing: -0.2px;
	}
	.modal-close {
		width: 30px;
		height: 30px;
		border-radius: 50%;
		border: none;
		background: var(--bg-cream);
		color: var(--text-muted);
		font-size: 15px;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s ease;
		line-height: 1;
	}
	.modal-close:hover { background: var(--border); color: var(--text-dark); }
	.modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
	.modal-field { margin-bottom: 16px; }
	.modal-field.full-width { grid-column: 1 / -1; }
	.modal-field label {
		display: block;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 6px;
	}
	.modal-field input,
	.modal-field select,
	.modal-field textarea {
		width: 100%;
		padding: 10px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		color: var(--text-dark);
		font-family: var(--font-body);
		font-size: 14px;
		box-sizing: border-box;
	}
	.modal-field textarea { resize: vertical; min-height: 60px; }
	.modal-field input:focus,
	.modal-field select:focus,
	.modal-field textarea:focus { outline: none; border-color: var(--primary); }
	.modal-actions { display: flex; align-items: center; gap: 10px; margin-top: 8px; }
	.btn-cancel {
		padding: 10px 20px;
		background: transparent;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		color: var(--text-secondary);
		transition: all 0.15s ease;
	}
	.btn-cancel:hover { border-color: var(--text-muted); color: var(--text-dark); }
	.btn-primary {
		padding: 10px 24px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		transition: background var(--transition);
	}
	.btn-primary:hover { background: var(--primary-hover); }
	.btn-danger {
		padding: 10px 20px;
		background: transparent;
		border: none;
		border-radius: 10px;
		font-family: var(--font-ui);
		font-weight: 600;
		font-size: 13px;
		cursor: pointer;
		color: var(--red, #D04040);
		transition: all 0.15s ease;
	}
	.btn-danger:hover { background: #fde8e8; }

	@media (min-width: 769px) and (max-width: 1024px) {
		.topbar {
			padding: 0 24px;
		}

		.content-area {
			padding: 20px 24px 40px;
		}

		.summary-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.charts-row {
			grid-template-columns: minmax(0, 1fr);
			gap: 20px;
		}

		.import-section {
			max-width: 640px;
			padding: 40px 24px;
		}

		.modal-card {
			max-width: 560px;
		}
	}

	/* ── Mobile Breakpoints ── */
	@media (max-width: 768px) {
		.mobile-menu-btn { display: block; }
		.topbar {
			padding: 0 16px;
			padding-top: env(safe-area-inset-top, 0px);
			flex-wrap: wrap;
			height: auto;
			min-height: var(--topbar-height);
		}
		.topbar-title { font-size: 17px; font-weight: 600; margin-right: 0; white-space: nowrap; flex-shrink: 0; }
		.dash-tabs {
			margin-left: 0 !important;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			flex-shrink: 1;
			min-width: 0;
			width: 100%;
			justify-content: flex-start;
			gap: 3px;
			order: 1;
		}
		.dash-tabs::-webkit-scrollbar { display: none; }
		.dash-tab {
			font-size: 10px !important;
			padding: 6px 11px !important;
			flex: 0 0 auto;
			text-align: center;
			justify-content: center;
		}
		/* Hide topbar action buttons on mobile */
		.topbar > button:not(.mobile-menu-btn) { display: none !important; }
		.topbar-spacer { display: none; }
		.charts-row { grid-template-columns: 1fr; }
		.empty-charts { grid-template-columns: 1fr; }
		.modal-grid { grid-template-columns: 1fr; }
		.content-area { padding: 16px; padding-bottom: 16px; }
		.inv-header { flex-direction: column; gap: 12px; align-items: stretch; }
		.section-add-btn { width: 100%; }
		.inv-table-wrap { display: none; }
		.inv-list-mobile { display: flex; }
		.summary-grid { grid-template-columns: repeat(2, 1fr); }
		.chartjs-donut-wrap { max-width: 200px; }
		.chartjs-timeline-wrap { height: 200px; }
		.tax-shell-actions { justify-content: flex-start; }
		.tax-filter-select, .tax-action-btn { width: 100%; }
	}
</style>
