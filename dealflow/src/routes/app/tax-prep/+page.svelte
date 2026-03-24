<script>
	import { onMount } from 'svelte';
	import { user, isLoggedIn, userToken } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';

	let taxDocs = $state([]);
	let loading = $state(true);
	let yearFilter = $state('');
	let sortCol = $state('taxYear');
	let sortDir = $state('desc');
	let showAddModal = $state(false);

	// Form state
	let formYear = $state(new Date().getFullYear() - 1);
	let formInvestment = $state('');
	let formEntity = $state('');
	let formEntityInto = $state('');
	let formType = $state('K-1');
	let formStatus = $state('pending');
	let formDate = $state('');
	let editId = $state(null);

	const years = $derived(() => {
		const all = [...new Set(taxDocs.map(d => d.taxYear))].sort((a, b) => b - a);
		return all;
	});

	const filteredDocs = $derived(() => {
		let docs = yearFilter ? taxDocs.filter(d => String(d.taxYear) === yearFilter) : taxDocs;
		docs = [...docs].sort((a, b) => {
			const aVal = a[sortCol] || '';
			const bVal = b[sortCol] || '';
			const cmp = String(aVal).localeCompare(String(bVal));
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return docs;
	});

	const summary = $derived(() => {
		const docs = filteredDocs();
		return {
			total: docs.length,
			received: docs.filter(d => d.uploadStatus === 'received').length,
			pending: docs.filter(d => d.uploadStatus === 'pending').length,
			k1s: docs.filter(d => d.formType === 'K-1').length
		};
	});

	function toggleSort(col) {
		if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else { sortCol = col; sortDir = 'desc'; }
	}

	async function loadDocs() {
		if (!browser) return;
		try {
			const stored = JSON.parse(localStorage.getItem('gycUser') || '{}');
			if (!stored?.token) { loading = false; return; }
			const res = await fetch('/api/userdata?type=tax_docs', {
				headers: { 'Authorization': 'Bearer ' + stored.token }
			});
			if (res.ok) {
				const data = await res.json();
				taxDocs = data.docs || data || [];
			}
		} catch (e) { console.warn('Failed to load tax docs:', e); }
		finally { loading = false; }
	}

	async function saveTaxDoc() {
		const stored = JSON.parse(localStorage.getItem('gycUser') || '{}');
		if (!stored?.token) return;
		const doc = {
			taxYear: formYear,
			investmentName: formInvestment,
			investingEntity: formEntity,
			entityInvestedInto: formEntityInto,
			formType: formType,
			uploadStatus: formStatus,
			dateReceived: formDate
		};
		if (editId) doc.id = editId;

		await fetch('/api/userdata', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + stored.token },
			body: JSON.stringify({ type: 'tax_docs', data: doc })
		});
		showAddModal = false;
		editId = null;
		await loadDocs();
	}

	function openEdit(doc) {
		editId = doc.id;
		formYear = doc.taxYear;
		formInvestment = doc.investmentName || '';
		formEntity = doc.investingEntity || '';
		formEntityInto = doc.entityInvestedInto || '';
		formType = doc.formType || 'K-1';
		formStatus = doc.uploadStatus || 'pending';
		formDate = doc.dateReceived || '';
		showAddModal = true;
	}

	function openNew() {
		editId = null;
		formYear = new Date().getFullYear() - 1;
		formInvestment = ''; formEntity = ''; formEntityInto = '';
		formType = 'K-1'; formStatus = 'pending'; formDate = '';
		showAddModal = true;
	}

	onMount(loadDocs);
</script>

<svelte:head><title>Tax Prep | GYC</title></svelte:head>

<div class="tax-page">
	<div class="dash-tabs">
		<a href="/app/dashboard" class="dash-tab">Overview</a>
		<a href="/app/portfolio" class="dash-tab">Portfolio</a>
		<a href="/app/plan" class="dash-tab">My Plan</a>
	</div>

	<div class="header-row">
		<div class="filter-row">
			<select bind:value={yearFilter} class="year-select">
				<option value="">All Years</option>
				{#each years() as yr}
					<option value={String(yr)}>{yr}</option>
				{/each}
			</select>
		</div>
		<div class="action-row">
			<button class="btn-outline" onclick={loadDocs}>Auto-Populate from Portfolio</button>
			<button class="btn-primary" onclick={openNew}>+ Add Document</button>
		</div>
	</div>

	{#if loading}
		<div class="loading">Loading tax documents...</div>
	{:else if taxDocs.length === 0}
		<div class="empty-state">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" class="empty-icon">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
			</svg>
			<div class="empty-title">No tax documents yet</div>
			<div class="empty-desc">Track K-1s, 1099s, and other tax forms for all your investments.</div>
			<div class="empty-actions">
				<button class="btn-primary" onclick={loadDocs}>Auto-Populate from Portfolio</button>
				<button class="btn-outline" onclick={openNew}>+ Add Manually</button>
			</div>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="summary-grid">
			<div class="summary-card">
				<div class="sc-label">Total Documents</div>
				<div class="sc-value">{summary().total}</div>
			</div>
			<div class="summary-card">
				<div class="sc-label">Received</div>
				<div class="sc-value green">{summary().received}</div>
			</div>
			<div class="summary-card">
				<div class="sc-label">Pending</div>
				<div class="sc-value orange">{summary().pending}</div>
			</div>
			<div class="summary-card">
				<div class="sc-label">K-1s</div>
				<div class="sc-value">{summary().k1s}</div>
			</div>
		</div>

		<!-- Table -->
		<div class="table-wrap">
			<table>
				<thead>
					<tr>
						<th onclick={() => toggleSort('taxYear')}>Tax Year</th>
						<th onclick={() => toggleSort('investmentName')}>Investment</th>
						<th onclick={() => toggleSort('investingEntity')}>Investing Entity</th>
						<th onclick={() => toggleSort('entityInvestedInto')}>Entity Invested Into</th>
						<th onclick={() => toggleSort('formType')}>Form Type</th>
						<th onclick={() => toggleSort('uploadStatus')}>Status</th>
						<th onclick={() => toggleSort('dateReceived')}>Date Received</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each filteredDocs() as doc}
						<tr>
							<td>{doc.taxYear}</td>
							<td class="fw-600">{doc.investmentName || '—'}</td>
							<td>{doc.investingEntity || '—'}</td>
							<td>{doc.entityInvestedInto || '—'}</td>
							<td><span class="form-badge">{doc.formType || '—'}</span></td>
							<td>
								<span class="status-badge" class:received={doc.uploadStatus === 'received'} class:pending={doc.uploadStatus === 'pending'}>
									{doc.uploadStatus || 'pending'}
								</span>
							</td>
							<td>{doc.dateReceived || '—'}</td>
							<td><button class="edit-btn" onclick={() => openEdit(doc)}>Edit</button></td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	{/if}
</div>

<!-- Add/Edit Modal -->
{#if showAddModal}
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }} role="dialog">
		<div class="modal">
			<h3>{editId ? 'Edit' : 'Add'} Tax Document</h3>
			<div class="form-grid">
				<label>
					<span>Tax Year</span>
					<input type="number" bind:value={formYear} />
				</label>
				<label>
					<span>Investment Name</span>
					<input type="text" bind:value={formInvestment} />
				</label>
				<label>
					<span>Investing Entity</span>
					<input type="text" bind:value={formEntity} />
				</label>
				<label>
					<span>Entity Invested Into</span>
					<input type="text" bind:value={formEntityInto} />
				</label>
				<label>
					<span>Form Type</span>
					<select bind:value={formType}>
						<option value="K-1">K-1</option>
						<option value="1099-DIV">1099-DIV</option>
						<option value="1099-INT">1099-INT</option>
						<option value="1099-B">1099-B</option>
						<option value="Other">Other</option>
					</select>
				</label>
				<label>
					<span>Status</span>
					<select bind:value={formStatus}>
						<option value="pending">Pending</option>
						<option value="received">Received</option>
					</select>
				</label>
				<label>
					<span>Date Received</span>
					<input type="date" bind:value={formDate} />
				</label>
			</div>
			<div class="modal-actions">
				<button class="btn-outline" onclick={() => showAddModal = false}>Cancel</button>
				<button class="btn-primary" onclick={saveTaxDoc}>Save</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.tax-page { padding: 20px 24px; max-width: 1000px; }
	.dash-tabs { display: flex; gap: 4px; margin-bottom: 24px; }
	.dash-tab {
		padding: 8px 16px; border-radius: 8px; font-family: var(--font-ui);
		font-size: 13px; font-weight: 600; text-decoration: none;
		color: var(--text-muted); transition: all 0.15s;
	}
	.dash-tab:hover { color: var(--text-dark); background: rgba(0,0,0,0.04); }
	.dash-tab.active { background: var(--primary); color: #fff; }

	.header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
	.action-row { display: flex; gap: 10px; }
	.year-select {
		padding: 8px 12px; border: 1px solid var(--border-light); border-radius: var(--radius-sm);
		font-family: var(--font-ui); font-size: 13px; background: var(--bg-card); color: var(--text-dark);
	}
	.btn-primary {
		padding: 8px 16px; background: var(--primary); color: #fff; border: none;
		border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 13px; cursor: pointer;
	}
	.btn-outline {
		padding: 8px 16px; background: transparent; color: var(--primary); border: 1px solid var(--primary);
		border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 13px; cursor: pointer;
	}

	.loading { text-align: center; padding: 80px 20px; font-family: var(--font-ui); color: var(--text-muted); }

	.empty-state { text-align: center; padding: 60px 20px; }
	.empty-icon { color: var(--text-muted); margin-bottom: 16px; }
	.empty-title { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-dark); margin-bottom: 8px; }
	.empty-desc { font-family: var(--font-body); font-size: 14px; color: var(--text-muted); margin-bottom: 20px; }
	.empty-actions { display: flex; gap: 10px; justify-content: center; }

	.summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
	.summary-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 16px; text-align: center; }
	.sc-label { font-family: var(--font-body); font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); margin-bottom: 4px; }
	.sc-value { font-family: var(--font-ui); font-size: 24px; font-weight: 800; color: var(--text-dark); }
	.sc-value.green { color: #059669; }
	.sc-value.orange { color: #D68C45; }

	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 13px; }
	th {
		text-align: left; padding: 10px 12px; font-family: var(--font-ui); font-weight: 700;
		border-bottom: 2px solid var(--border-light); cursor: pointer; white-space: nowrap;
	}
	td { padding: 10px 12px; border-bottom: 1px solid var(--border-light); }
	.fw-600 { font-weight: 600; }
	.form-badge {
		padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
		background: rgba(59,130,246,0.1); color: #3b82f6;
	}
	.status-badge {
		padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600;
		background: rgba(214,140,69,0.1); color: #D68C45;
	}
	.status-badge.received { background: rgba(5,150,105,0.1); color: #059669; }
	.edit-btn {
		padding: 4px 10px; border: 1px solid var(--border-light); border-radius: 4px;
		background: none; font-size: 12px; cursor: pointer; color: var(--text-secondary);
	}

	.modal-overlay {
		position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;
		display: flex; align-items: center; justify-content: center;
	}
	.modal {
		background: var(--bg-card); border-radius: 12px; padding: 24px;
		max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
	}
	.modal h3 { font-family: var(--font-ui); font-size: 18px; font-weight: 700; margin: 0 0 20px; }
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
	.form-grid label { display: flex; flex-direction: column; gap: 4px; }
	.form-grid span { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-muted); }
	.form-grid input, .form-grid select {
		padding: 8px 12px; border: 1px solid var(--border-light); border-radius: var(--radius-sm);
		font-family: var(--font-ui); font-size: 13px;
	}
	.modal-actions { display: flex; gap: 10px; justify-content: flex-end; }

	@media (max-width: 768px) {
		.tax-page { padding: 16px; }
		.form-grid { grid-template-columns: 1fr; }
		.header-row { flex-direction: column; }
	}
</style>
