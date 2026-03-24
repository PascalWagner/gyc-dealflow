<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';

	let taxDocs = $state([]);
	let loading = $state(true);
	let yearFilter = $state('');
	let sortCol = $state('taxYear');
	let sortDir = $state('desc');
	let showAddModal = $state(false);
	let autoPopulating = $state(false);
	let collapsedYears = $state({});

	// Form state
	let formYear = $state(new Date().getFullYear() - 1);
	let formInvestment = $state('');
	let formEntity = $state('');
	let formEntityInto = $state('');
	let formType = $state('K-1');
	let formStatus = $state('pending');
	let formDate = $state('');
	let editId = $state(null);

	const years = $derived([...new Set(taxDocs.map(d => d.taxYear))].sort((a, b) => b - a));

	const sortedDocs = $derived((() => {
		let docs = yearFilter ? taxDocs.filter(d => String(d.taxYear) === yearFilter) : taxDocs;
		docs = [...docs].sort((a, b) => {
			const aVal = a[sortCol] || '';
			const bVal = b[sortCol] || '';
			const cmp = String(aVal).localeCompare(String(bVal));
			return sortDir === 'asc' ? cmp : -cmp;
		});
		return docs;
	})());

	// Group by year for expandable sections
	const groupedByYear = $derived((() => {
		const groups = {};
		for (const doc of sortedDocs) {
			const yr = doc.taxYear || 'Unknown';
			if (!groups[yr]) groups[yr] = [];
			groups[yr].push(doc);
		}
		return Object.entries(groups).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
	})());

	const summary = $derived((() => {
		return {
			total: sortedDocs.length,
			received: sortedDocs.filter(d => d.uploadStatus === 'received').length,
			pending: sortedDocs.filter(d => d.uploadStatus === 'pending').length,
			k1s: sortedDocs.filter(d => d.formType === 'K-1').length
		};
	})());

	function toggleSort(col) {
		if (sortCol === col) sortDir = sortDir === 'asc' ? 'desc' : 'asc';
		else { sortCol = col; sortDir = 'desc'; }
	}

	function sortIndicator(col) {
		if (sortCol !== col) return '';
		return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
	}

	function toggleYearSection(yr) {
		collapsedYears = { ...collapsedYears, [yr]: !collapsedYears[yr] };
	}

	function getToken() {
		if (!browser) return null;
		const stored = JSON.parse(localStorage.getItem('gycUser') || '{}');
		return stored?.token || null;
	}

	async function loadDocs() {
		const token = getToken();
		if (!token) { loading = false; return; }
		try {
			const res = await fetch('/api/userdata?type=tax_docs', {
				headers: { 'Authorization': 'Bearer ' + token }
			});
			if (res.ok) {
				const data = await res.json();
				taxDocs = data.docs || data || [];
			}
		} catch (e) { console.warn('Failed to load tax docs:', e); }
		finally { loading = false; }
	}

	async function saveTaxDoc() {
		const token = getToken();
		if (!token) return;
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
			headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
			body: JSON.stringify({ type: 'tax_docs', data: doc })
		});
		showAddModal = false;
		editId = null;
		await loadDocs();
	}

	async function deleteTaxDoc(doc) {
		if (!confirm(`Delete tax document for "${doc.investmentName || 'Untitled'}"?`)) return;
		const token = getToken();
		if (!token) return;

		// Remove from local state immediately
		taxDocs = taxDocs.filter(d => d.id !== doc.id);

		try {
			await fetch('/api/userdata', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
				body: JSON.stringify({ type: 'tax_docs', action: 'delete', id: doc.id })
			});
		} catch (e) {
			console.warn('Failed to delete tax doc:', e);
			await loadDocs(); // reload on error to restore state
		}
	}

	async function autoPopulate() {
		const token = getToken();
		if (!token) return;
		autoPopulating = true;

		try {
			const res = await fetch('/api/userdata?type=portfolio', {
				headers: { 'Authorization': 'Bearer ' + token }
			});
			if (!res.ok) {
				alert('Failed to load portfolio. Please try again.');
				return;
			}
			const data = await res.json();
			const investments = data.docs || data || [];

			if (investments.length === 0) {
				alert('No investments in your portfolio yet. Add investments first, then auto-populate tax docs.');
				return;
			}

			const yr = yearFilter ? Number(yearFilter) : new Date().getFullYear() - 1;
			const existingNames = taxDocs
				.filter(d => String(d.taxYear) === String(yr))
				.map(d => d.investmentName);

			let added = 0;
			for (const inv of investments) {
				if (!inv.investmentName || existingNames.includes(inv.investmentName)) continue;

				const doc = {
					taxYear: yr,
					investmentName: inv.investmentName,
					investingEntity: inv.investingEntity || '',
					entityInvestedInto: inv.entityInvestedInto || '',
					formType: (inv.assetClass || '').toLowerCase() === 'lending' ? '1099-INT' : 'K-1',
					uploadStatus: 'pending',
					dateReceived: '',
					notes: 'Auto-populated from portfolio'
				};

				await fetch('/api/userdata', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
					body: JSON.stringify({ type: 'tax_docs', data: doc })
				});
				added++;
			}

			await loadDocs();

			if (added > 0) {
				alert(`Added ${added} tax document${added > 1 ? 's' : ''} for tax year ${yr}.`);
			} else {
				alert(`All portfolio investments already have tax documents for ${yr}.`);
			}
		} catch (e) {
			console.warn('Auto-populate failed:', e);
			alert('Failed to auto-populate. Please try again.');
		} finally {
			autoPopulating = false;
		}
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
		formYear = yearFilter ? Number(yearFilter) : new Date().getFullYear() - 1;
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
				{#each years as yr}
					<option value={String(yr)}>{yr}</option>
				{/each}
			</select>
		</div>
		<div class="action-row">
			<button class="btn-outline" onclick={autoPopulate} disabled={autoPopulating}>
				{autoPopulating ? 'Populating...' : 'Auto-Populate from Portfolio'}
			</button>
			<button class="btn-primary" onclick={openNew}>+ Add Document</button>
		</div>
	</div>

	{#if loading}
		<div class="loading-skeleton">
			<div class="summary-grid">
				{#each Array(4) as _}
					<div class="summary-card"><div class="sk-bar" style="width:50%;height:14px;margin-bottom:8px"></div><div class="sk-bar" style="width:30%;height:24px"></div></div>
				{/each}
			</div>
			<div class="sk-table">
				{#each Array(4) as _}
					<div class="sk-row"><div class="sk-bar" style="width:100%;height:14px"></div></div>
				{/each}
			</div>
		</div>
	{:else if taxDocs.length === 0}
		<div class="empty-state">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="48" height="48" class="empty-icon">
				<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
			</svg>
			<div class="empty-title">No tax documents yet</div>
			<div class="empty-desc">Track K-1s, 1099s, and other tax forms for all your investments.</div>
			<div class="empty-actions">
				<button class="btn-primary" onclick={autoPopulate} disabled={autoPopulating}>
					{autoPopulating ? 'Populating...' : 'Auto-Populate from Portfolio'}
				</button>
				<button class="btn-outline" onclick={openNew}>+ Add Manually</button>
			</div>
		</div>
	{:else}
		<!-- Summary cards -->
		<div class="summary-grid">
			<div class="summary-card">
				<div class="sc-label">Total Documents</div>
				<div class="sc-value">{summary.total}</div>
			</div>
			<div class="summary-card">
				<div class="sc-label">Received</div>
				<div class="sc-value green">{summary.received}</div>
			</div>
			<div class="summary-card">
				<div class="sc-label">Pending</div>
				<div class="sc-value orange">{summary.pending}</div>
			</div>
			<div class="summary-card">
				<div class="sc-label">K-1s</div>
				<div class="sc-value">{summary.k1s}</div>
			</div>
		</div>

		<!-- Grouped by year with collapsible sections -->
		{#if yearFilter}
			<!-- Single year view: flat table -->
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th onclick={() => toggleSort('taxYear')}>Tax Year{sortIndicator('taxYear')}</th>
							<th onclick={() => toggleSort('investmentName')}>Investment{sortIndicator('investmentName')}</th>
							<th onclick={() => toggleSort('investingEntity')}>Investing Entity{sortIndicator('investingEntity')}</th>
							<th onclick={() => toggleSort('entityInvestedInto')}>Entity Invested Into{sortIndicator('entityInvestedInto')}</th>
							<th onclick={() => toggleSort('formType')}>Form Type{sortIndicator('formType')}</th>
							<th onclick={() => toggleSort('uploadStatus')}>Status{sortIndicator('uploadStatus')}</th>
							<th onclick={() => toggleSort('dateReceived')}>Date Received{sortIndicator('dateReceived')}</th>
							<th>Actions</th>
						</tr>
					</thead>
					<tbody>
						{#each sortedDocs as doc}
							<tr>
								<td>{doc.taxYear}</td>
								<td class="fw-600">{doc.investmentName || '\u2014'}</td>
								<td>{doc.investingEntity || '\u2014'}</td>
								<td>{doc.entityInvestedInto || '\u2014'}</td>
								<td><span class="form-badge">{doc.formType || '\u2014'}</span></td>
								<td>
									<span class="status-badge" class:received={doc.uploadStatus === 'received'} class:pending={doc.uploadStatus === 'pending'}>
										{doc.uploadStatus || 'pending'}
									</span>
								</td>
								<td>{doc.dateReceived || '\u2014'}</td>
								<td class="actions-cell">
									<button class="edit-btn" onclick={() => openEdit(doc)}>Edit</button>
									<button class="delete-btn" onclick={() => deleteTaxDoc(doc)}>Delete</button>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<!-- All years: grouped with collapsible sections -->
			{#each groupedByYear as [yr, docs]}
				<div class="year-section">
					<button class="year-header" onclick={() => toggleYearSection(yr)}>
						<span class="year-chevron" class:collapsed={collapsedYears[yr]}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
								<polyline points="6 9 12 15 18 9"/>
							</svg>
						</span>
						<span class="year-title">Tax Year {yr}</span>
						<span class="year-count">{docs.length} document{docs.length !== 1 ? 's' : ''}</span>
						<span class="year-status-summary">
							{#if docs.filter(d => d.uploadStatus === 'received').length > 0}<span class="mini-badge received">{docs.filter(d => d.uploadStatus === 'received').length} received</span>{/if}
							{#if docs.filter(d => d.uploadStatus === 'pending').length > 0}<span class="mini-badge pending">{docs.filter(d => d.uploadStatus === 'pending').length} pending</span>{/if}
						</span>
					</button>
					{#if !collapsedYears[yr]}
						<div class="table-wrap">
							<table>
								<thead>
									<tr>
										<th onclick={() => toggleSort('investmentName')}>Investment{sortIndicator('investmentName')}</th>
										<th onclick={() => toggleSort('investingEntity')}>Investing Entity{sortIndicator('investingEntity')}</th>
										<th onclick={() => toggleSort('entityInvestedInto')}>Entity Invested Into{sortIndicator('entityInvestedInto')}</th>
										<th onclick={() => toggleSort('formType')}>Form Type{sortIndicator('formType')}</th>
										<th onclick={() => toggleSort('uploadStatus')}>Status{sortIndicator('uploadStatus')}</th>
										<th onclick={() => toggleSort('dateReceived')}>Date Received{sortIndicator('dateReceived')}</th>
										<th>Actions</th>
									</tr>
								</thead>
								<tbody>
									{#each docs as doc}
										<tr>
											<td class="fw-600">{doc.investmentName || '\u2014'}</td>
											<td>{doc.investingEntity || '\u2014'}</td>
											<td>{doc.entityInvestedInto || '\u2014'}</td>
											<td><span class="form-badge">{doc.formType || '\u2014'}</span></td>
											<td>
												<span class="status-badge" class:received={doc.uploadStatus === 'received'} class:pending={doc.uploadStatus === 'pending'}>
													{doc.uploadStatus || 'pending'}
												</span>
											</td>
											<td>{doc.dateReceived || '\u2014'}</td>
											<td class="actions-cell">
												<button class="edit-btn" onclick={() => openEdit(doc)}>Edit</button>
												<button class="delete-btn" onclick={() => deleteTaxDoc(doc)}>Delete</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	{/if}
</div>

<!-- Add/Edit Modal -->
{#if showAddModal}
	<div class="modal-overlay" onclick={(e) => { if (e.target === e.currentTarget) showAddModal = false; }} role="dialog">
		<div class="modal">
			<div class="modal-header">
				<h3>{editId ? 'Edit' : 'Add'} Tax Document</h3>
				<button class="modal-close" onclick={() => showAddModal = false}>&times;</button>
			</div>
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
				<button class="btn-primary" onclick={saveTaxDoc}>{editId ? 'Save Changes' : 'Add Document'}</button>
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
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-outline {
		padding: 8px 16px; background: transparent; color: var(--primary); border: 1px solid var(--primary);
		border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 13px; cursor: pointer;
	}
	.btn-outline:disabled { opacity: 0.6; cursor: not-allowed; }

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

	/* Year sections */
	.year-section { margin-bottom: 16px; border: 1px solid var(--border-light); border-radius: var(--radius-sm); overflow: hidden; }
	.year-header {
		display: flex; align-items: center; gap: 10px; width: 100%; padding: 14px 16px;
		background: var(--bg-card); border: none; cursor: pointer; font-family: var(--font-ui);
		text-align: left; transition: background 0.15s;
	}
	.year-header:hover { background: rgba(0,0,0,0.02); }
	.year-chevron { display: flex; align-items: center; transition: transform 0.2s; color: var(--text-muted); }
	.year-chevron.collapsed { transform: rotate(-90deg); }
	.year-title { font-size: 15px; font-weight: 800; color: var(--text-dark); }
	.year-count { font-size: 12px; color: var(--text-muted); font-weight: 500; }
	.year-status-summary { display: flex; gap: 6px; margin-left: auto; }
	.mini-badge {
		padding: 2px 8px; border-radius: 10px; font-size: 10px; font-weight: 700;
	}
	.mini-badge.received { background: rgba(5,150,105,0.1); color: #059669; }
	.mini-badge.pending { background: rgba(214,140,69,0.1); color: #D68C45; }
	.year-section .table-wrap { border-top: 1px solid var(--border-light); }

	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-size: 13px; }
	th {
		text-align: left; padding: 10px 12px; font-family: var(--font-ui); font-weight: 700;
		border-bottom: 2px solid var(--border-light); cursor: pointer; white-space: nowrap;
		user-select: none; transition: color 0.15s;
	}
	th:hover { color: var(--primary); }
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
	.actions-cell { white-space: nowrap; }
	.edit-btn {
		padding: 4px 10px; border: 1px solid var(--border-light); border-radius: 4px;
		background: none; font-size: 12px; cursor: pointer; color: var(--text-secondary);
		margin-right: 4px;
	}
	.edit-btn:hover { background: rgba(0,0,0,0.04); }
	.delete-btn {
		padding: 4px 10px; border: 1px solid rgba(220,38,38,0.3); border-radius: 4px;
		background: none; font-size: 12px; cursor: pointer; color: #dc2626;
	}
	.delete-btn:hover { background: rgba(220,38,38,0.06); }

	.modal-overlay {
		position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 1000;
		display: flex; align-items: center; justify-content: center;
	}
	.modal {
		background: var(--bg-card); border-radius: 12px; padding: 24px;
		max-width: 500px; width: 90%; max-height: 80vh; overflow-y: auto;
	}
	.modal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
	.modal h3 { font-family: var(--font-ui); font-size: 18px; font-weight: 700; margin: 0; }
	.modal-close {
		background: none; border: none; font-size: 22px; cursor: pointer;
		color: var(--text-muted); line-height: 1; padding: 0 4px;
	}
	.modal-close:hover { color: var(--text-dark); }
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
		.year-status-summary { display: none; }
	}
	.loading-skeleton { padding: 16px 0; }
	.sk-bar { background: var(--border-light, #e5e7eb); border-radius: 6px; animation: skPulse 1.5s infinite; }
	.sk-table { margin-top: 20px; }
	.sk-row { padding: 12px 16px; background: var(--bg-card, #fff); border: 1px solid var(--border, #e5e7eb); border-radius: 8px; margin-bottom: 8px; }
	@keyframes skPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
</style>
