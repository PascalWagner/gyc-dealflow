<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { user, isAdmin, userTier } from '$lib/stores/auth.js';
	import PortfolioChart from '$lib/components/PortfolioChart.svelte';

	let portfolio = $state([]);
	let taxDocuments = $state([]);
	let wizardData = $state({});
	let sortCol = $state('investmentName');
	let sortAsc = $state(true);
	let showAddModal = $state(false);
	let editingId = $state('');
	let taxSectionOpen = $state(false);

	// Modal form data
	let modalData = $state({
		investmentName: '', sponsor: '', assetClass: '', amountInvested: '',
		dateInvested: '', status: 'Active', targetIRR: '', distributionsReceived: '',
		equityMultiple: '', investingEntity: '', entityInvestedInto: ''
	});

	const totalInvested = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.amountInvested) || 0), 0));
	const totalDistributions = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.distributionsReceived) || 0), 0));
	const activeCount = $derived(portfolio.filter(i => i.status === 'Active' || i.status === 'Distributing').length);
	const avgIRR = $derived(() => {
		const withIRR = portfolio.filter(i => i.targetIRR);
		if (withIRR.length === 0) return 0;
		return withIRR.reduce((s, i) => s + parseFloat(i.targetIRR), 0) / withIRR.length;
	});
	const assetClasses = $derived(new Set(portfolio.map(i => i.assetClass).filter(Boolean)));
	const sponsors = $derived(new Set(portfolio.map(i => i.sponsor).filter(Boolean)));

	const allocationMap = $derived(() => {
		const map = {};
		portfolio.forEach(i => { const cls = i.assetClass || 'Other'; map[cls] = (map[cls] || 0) + (parseFloat(i.amountInvested) || 0); });
		return map;
	});

	// Risk insights
	const riskInsights = $derived(() => {
		const insights = [];
		if (totalInvested === 0) return [{ type: 'ok', text: 'Add investments to see risk analysis.' }];
		const alloc = allocationMap();
		for (const [cls, amt] of Object.entries(alloc)) {
			const pct = (amt / totalInvested) * 100;
			if (pct > 50) insights.push({ type: 'warn', text: `<strong>High concentration:</strong> ${pct.toFixed(0)}% of portfolio in ${cls}. Consider diversifying across asset classes.` });
		}
		const sponsorAlloc = {};
		portfolio.forEach(i => { const sp = i.sponsor || 'Unknown'; sponsorAlloc[sp] = (sponsorAlloc[sp] || 0) + (parseFloat(i.amountInvested) || 0); });
		for (const [sp, amt] of Object.entries(sponsorAlloc)) {
			const pct = (amt / totalInvested) * 100;
			if (pct > 40) insights.push({ type: 'warn', text: `<strong>Sponsor exposure:</strong> ${pct.toFixed(0)}% allocated to ${sp}. Diversifying sponsors reduces counterparty risk.` });
		}
		if (insights.length === 0) return [{ type: 'ok', text: '<strong>Portfolio looks well-diversified.</strong> No major concentration risks detected.' }];
		return insights;
	});

	const sorted = $derived(() => {
		return [...portfolio].sort((a, b) => {
			let va = a[sortCol], vb = b[sortCol];
			if (['amountInvested', 'distributionsReceived', 'targetIRR'].includes(sortCol)) {
				va = parseFloat(va) || 0; vb = parseFloat(vb) || 0;
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

	function openAddModal(id = '') {
		editingId = id;
		if (id) {
			const inv = portfolio.find(i => i.id === id);
			if (inv) modalData = { ...inv };
		} else {
			modalData = { investmentName: '', sponsor: '', assetClass: '', amountInvested: '', dateInvested: '', status: 'Active', targetIRR: '', distributionsReceived: '', equityMultiple: '', investingEntity: '', entityInvestedInto: '' };
		}
		showAddModal = true;
	}

	function saveInvestment() {
		if (editingId) {
			const idx = portfolio.findIndex(i => i.id === editingId);
			if (idx >= 0) portfolio[idx] = { ...portfolio[idx], ...modalData };
		} else {
			portfolio.push({ ...modalData, id: 'inv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5) });
		}
		portfolio = [...portfolio];
		if (browser) localStorage.setItem('gycPortfolio', JSON.stringify(portfolio));
		showAddModal = false;
	}

	function handlePPMUpload(file) {
		if (!file) return;
		// In production this calls the enrichment API; for now show toast
		alert('PPM upload processing is available in the full application. Please add investments manually for now.');
	}

	onMount(() => {
		if (!browser) return;
		portfolio = JSON.parse(localStorage.getItem('gycPortfolio') || '[]');
		taxDocuments = JSON.parse(localStorage.getItem('gycTaxDocs') || '[]');
		wizardData = JSON.parse(localStorage.getItem('gycBuyBoxWizard') || '{}');
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
	<button class="btn-add" onclick={() => openAddModal()}>+ Add Investment</button>
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
			<div class="stat-card"><div class="stat-label">Avg Target IRR</div><div class="stat-value">{avgIRR() ? avgIRR().toFixed(1) + '%' : '--'}</div></div>
		</div>

		<!-- Charts row -->
		<div class="charts-row">
			<div class="chart-card">
				<div class="chart-card-title">Asset Class Allocation</div>
				<PortfolioChart allocations={allocationMap()} />
				<div class="alloc-meta">
					<div class="alloc-stat"><div class="alloc-num">{assetClasses.size}</div><div class="alloc-label">Asset Classes</div></div>
					<div class="alloc-stat"><div class="alloc-num">{sponsors.size}</div><div class="alloc-label">Sponsors</div></div>
				</div>
			</div>
			<div class="chart-card">
				<div class="chart-card-title">Risk Analysis</div>
				<div class="risk-insights">
					{#each riskInsights() as insight}
						<div class="risk-insight" class:warn={insight.type === 'warn'} class:ok={insight.type === 'ok'}>
							{@html insight.text}
						</div>
					{/each}
				</div>
			</div>
		</div>

		<!-- Investment cards -->
		<div class="inv-header">
			<div class="inv-title">Your Investments</div>
			<button class="btn-add" onclick={() => openAddModal()}>+ Add Investment</button>
		</div>
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

<!-- Add/Edit Investment Modal -->
{#if showAddModal}
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }}>
		<div class="modal-card">
			<div class="modal-top">
				<div class="modal-title">{editingId ? 'Edit' : 'Add'} Investment</div>
				<button class="modal-close" onclick={() => showAddModal = false}>&times;</button>
			</div>
			<div class="modal-grid">
				<div class="modal-field"><label>Investment Name</label><input bind:value={modalData.investmentName}></div>
				<div class="modal-field"><label>Sponsor</label><input bind:value={modalData.sponsor}></div>
				<div class="modal-field"><label>Asset Class</label><input bind:value={modalData.assetClass}></div>
				<div class="modal-field"><label>Amount Invested ($)</label><input type="number" bind:value={modalData.amountInvested}></div>
				<div class="modal-field"><label>Date Invested</label><input type="date" bind:value={modalData.dateInvested}></div>
				<div class="modal-field">
					<label>Status</label>
					<select bind:value={modalData.status}>
						<option>Active</option><option>Distributing</option><option>Exited</option><option>Pending</option>
					</select>
				</div>
				<div class="modal-field"><label>Target IRR (%)</label><input bind:value={modalData.targetIRR}></div>
				<div class="modal-field"><label>Distributions Received ($)</label><input type="number" bind:value={modalData.distributionsReceived}></div>
				<div class="modal-field"><label>Equity Multiple</label><input bind:value={modalData.equityMultiple}></div>
			</div>
			<div class="modal-actions">
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

	.risk-insights { display: flex; flex-direction: column; gap: 12px; }
	.risk-insight { font-family: var(--font-body); font-size: 13px; line-height: 1.6; padding: 12px; border-radius: var(--radius-sm); }
	.risk-insight.warn { background: rgba(245, 158, 11, 0.08); color: var(--text-secondary); border-left: 3px solid #f59e0b; }
	.risk-insight.ok { background: rgba(81, 190, 123, 0.08); color: var(--text-secondary); border-left: 3px solid var(--primary); }

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

	/* Modal */
	.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 1000; display: flex; align-items: center; justify-content: center; padding: 20px; }
	.modal-card { background: var(--bg-card); border-radius: var(--radius); padding: 28px; max-width: 600px; width: 100%; max-height: 90vh; overflow-y: auto; }
	.modal-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
	.modal-title { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.modal-close { background: none; border: none; font-size: 22px; cursor: pointer; color: var(--text-muted); line-height: 1; }
	.modal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0 16px; }
	.modal-field { margin-bottom: 16px; }
	.modal-field label { display: block; font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
	.modal-field input, .modal-field select { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
	.modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; }
	.btn-cancel { padding: 10px 20px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 13px; cursor: pointer; color: var(--text-secondary); }
	.btn-primary { padding: 10px 24px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 13px; cursor: pointer; }

	@media (max-width: 768px) {
		.mobile-menu-btn { display: block; }
		.charts-row { grid-template-columns: 1fr; }
		.empty-charts { flex-direction: column; align-items: center; }
		.modal-grid { grid-template-columns: 1fr; }
		.content-area { padding: 16px; }
	}
</style>
