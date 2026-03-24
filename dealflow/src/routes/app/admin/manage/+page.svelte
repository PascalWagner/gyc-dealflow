<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { user, isAdmin, userToken } from '$lib/stores/auth.js';

	let activeTab = $state('operators');
	const tabs = ['operators', 'deals', 'users', 'submissions', 'intros'];
	const tabLabels = { operators: 'Operators', deals: 'Deals', users: 'Users', submissions: 'Uploads', intros: 'Intros' };

	let searchQuery = $state('');
	let searchTimer;
	let tableData = $state([]);
	let tableTotal = $state(0);
	let tableColumns = $state([]);
	let currentPage = $state(1);
	let loading = $state(true);
	let qualityStats = $state(null);
	let resultCount = $state('');
	let operatorView = $state('outreach');
	let dealView = $state('database');

	const showCreateButton = $derived.by(() => {
		if (activeTab === 'operators') return operatorView === 'database';
		if (activeTab === 'deals') return dealView === 'database';
		return false;
	});
	const showDealTools = $derived(activeTab === 'deals' && dealView === 'database');
	const isQualityView = $derived.by(() =>
		(activeTab === 'deals' && dealView === 'quality') ||
		(activeTab === 'operators' && operatorView === 'quality')
	);

	onMount(() => {
		if (!$isAdmin) { goto('/app/deals'); return; }
		loadData();
	});

	async function adminFetch(body) {
		const token = $userToken;
		if (!token) return { success: false, error: 'Not signed in' };
		let resp = await fetch('/api/admin-manage', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
			body: JSON.stringify(body)
		});
		return resp.json();
	}

	async function outreachFetch(body) {
		const token = $userToken;
		if (!token) return { success: false, error: 'Not signed in' };
		const resp = await fetch('/api/operator-outreach', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
			body: JSON.stringify(body)
		});
		return resp.json();
	}

	function switchTab(tab) {
		activeTab = tab;
		currentPage = 1;
		searchQuery = '';
		qualityStats = null;
		if (tab === 'operators') operatorView = 'outreach';
		if (tab === 'deals') dealView = 'database';
		loadData();
	}

	function switchOperatorView(view) {
		operatorView = view;
		currentPage = 1;
		qualityStats = null;
		loadData();
	}

	function switchDealView(view) {
		dealView = view;
		currentPage = 1;
		qualityStats = null;
		loadData();
	}

	function searchDebounce() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => { currentPage = 1; loadData(); }, 300);
	}

	async function loadData() {
		loading = true;
		qualityStats = null;
		const search = searchQuery.trim();

		if (activeTab === 'submissions') {
			try {
				const resp = await fetch('/api/deal-submissions?dealId=all');
				const data = await resp.json();
				const subs = data.submissions || [];
				tableColumns = ['Deal', 'User', 'Type', 'Status', 'Date'];
				tableData = subs.map(s => ({
					cols: [s.dealName || s.dealId, s.email || '--', s.type || '--', s.status || 'pending', s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '--'],
					id: s.id
				}));
				tableTotal = subs.length;
				resultCount = `${subs.length} submissions`;
			} catch (e) { tableData = []; resultCount = 'Error loading'; }
			loading = false;
			return;
		}

		if (activeTab === 'intros') {
			try {
				const result = await adminFetch({ action: 'list-intros', search });
				if (result.success) {
					const intros = result.data || [];
					tableColumns = ['LP', 'Deal', 'GP', 'Status', 'Date'];
					tableData = intros.map(i => ({
						cols: [i.lpEmail || '--', i.dealName || '--', i.gpName || '--', i.status || '--', i.createdAt ? new Date(i.createdAt).toLocaleDateString() : '--'],
						id: i.id
					}));
					tableTotal = intros.length;
					resultCount = `${intros.length} intros`;
				}
			} catch (e) { tableData = []; }
			loading = false;
			return;
		}

		if (activeTab === 'operators' && operatorView === 'outreach') {
			try {
				const result = await outreachFetch({ action: 'list', page: currentPage, limit: 25, search });
				if (result.success) {
					const data = result.data || [];
					tableColumns = ['Operator', 'Status', 'Offering', 'Deals', 'Contact'];
					tableData = data.map((row) => ({
						cols: [
							row.operator_name || '--',
							formatStatus(row.outreach_status || 'backlog'),
							row.offering_type || '--',
							row.deal_count || 0,
							row.contact_name || row.contact_email || '--'
						],
						id: row.id
					}));
					tableTotal = result.total || data.length;
					resultCount = `${tableTotal} operators`;
				}
			} catch (e) { tableData = []; resultCount = 'Error loading'; }
			loading = false;
			return;
		}

		if (
			(activeTab === 'deals' && dealView === 'quality') ||
			(activeTab === 'operators' && operatorView === 'quality')
		) {
			try {
				const action = activeTab === 'deals' ? 'list-deals-quality' : 'list-operators-quality';
				const result = await adminFetch({ action, search });
				if (result.success) {
					qualityStats = result.stats;
					const data = result.data || [];
					tableColumns = activeTab === 'deals'
						? ['Deal', 'Sponsor', 'Completeness', 'Missing Fields']
						: ['Operator', 'Deals', 'Completeness', 'Missing Fields'];
					tableData = data.map(d => ({
						cols: activeTab === 'deals'
							? [
								d.investment_name || '--',
								d.management_company_name || '--',
								`${d.completeness_pct || 0}%`,
								(d.missing_fields || []).join(', ') || 'None'
							]
							: [
								d.name || '--',
								d.deal_count || 0,
								`${d.completeness_pct || 0}%`,
								(d.missing_fields || []).join(', ') || 'None'
							],
						id: d.id,
						completeness: d.completeness_pct || 0
					}));
					tableTotal = data.length;
					resultCount = `${data.length} quality records`;
				}
			} catch (e) { tableData = []; }
			loading = false;
			return;
		}

		try {
			const result = await adminFetch({ action: `list-${activeTab}`, page: currentPage, limit: 25, search });
			if (result.success) {
				const data = result.data || [];
				tableTotal = result.total || data.length;
				resultCount = `${tableTotal} total`;

				if (activeTab === 'operators') {
					tableColumns = ['Name', 'Website', 'Deals', 'Status'];
					tableData = data.map(d => ({
						cols: [
							d.operator_name || d.name || '--',
							d.website || '--',
							d.dealCount || d.deal_count || 0,
							d.status || '--'
						],
						id: d.id
					}));
				} else if (activeTab === 'deals') {
					tableColumns = ['Name', 'Sponsor', 'Asset Class', 'Status'];
					tableData = data.map(d => ({
						cols: [
							d.investment_name || d.name || '--',
							d.management_company_name || d.sponsor || '--',
							d.asset_class || d.assetClass || '--',
							d.status || 'active'
						],
						id: d.id
					}));
				} else if (activeTab === 'users') {
					tableColumns = ['Email', 'Name', 'Tier', 'Signed Up'];
					tableData = data.map(d => ({
						cols: [
							d.email || '--',
							d.full_name || d.fullName || '--',
							d.tier || 'explorer',
							formatShortDate(d.created_at || d.createdAt)
						],
						id: d.id
					}));
				}
			}
		} catch (e) { tableData = []; resultCount = 'Error loading'; }
		loading = false;
	}

	function prevPage() { if (currentPage > 1) { currentPage--; loadData(); } }
	function nextPage() { currentPage++; loadData(); }

	function completenessColor(pct) {
		if (pct >= 80) return '#10b981';
		if (pct >= 50) return '#f59e0b';
		return '#ef4444';
	}

	function formatShortDate(value) {
		if (!value) return '--';
		return new Date(value).toLocaleDateString();
	}

	function formatStatus(status) {
		return String(status || '')
			.split('_')
			.filter(Boolean)
			.map((token) => token.charAt(0).toUpperCase() + token.slice(1))
			.join(' ');
	}

	async function createNew() {
		const name = prompt(`Enter new ${activeTab === 'operators' ? 'operator' : activeTab === 'deals' ? 'deal' : 'user'} name:`);
		if (!name) return;
		const result = await adminFetch({ action: `create-${activeTab.replace(/s$/, '')}`, name });
		if (result.success) loadData();
		else alert('Create failed: ' + (result.error || 'Unknown'));
	}

	async function cleanupStart() {
		alert('Data cleanup: AI-powered enrichment will process deals one by one. This runs via the admin API.');
	}

	async function deckFinderStart() {
		alert('Deck Finder: Searches Google Drive for pitch decks and matches them to deals.');
	}
</script>

{#if !$isAdmin}
	<div class="loading">Redirecting...</div>
{:else}
<div class="manage-page">
	<div class="topbar">
		<div class="topbar-title">Manage Database</div>
		<div class="seg-ctrl">
			{#each tabs as tab}
				<button class="seg-btn" class:active={activeTab === tab} onclick={() => switchTab(tab)}>{tabLabels[tab]}</button>
			{/each}
		</div>
	</div>

	<div class="content" style="max-width:1200px">
		<!-- Toolbar -->
		<div class="toolbar">
			<div class="search-wrap">
				<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
				<input type="text" placeholder="Search..." bind:value={searchQuery} oninput={searchDebounce}>
			</div>
			{#if showCreateButton}
				<button class="action-btn primary" onclick={createNew}>+ Add New</button>
			{/if}
			{#if showDealTools}
				<button class="action-btn secondary" onclick={cleanupStart}>Data Cleanup</button>
				<button class="action-btn secondary" onclick={deckFinderStart}>Deck Finder</button>
			{/if}
			<span class="result-count">{resultCount}</span>
		</div>

		<!-- View toggles -->
		{#if activeTab === 'operators'}
			<div class="sub-toggle">
				<button class="sub-toggle-btn" class:active={operatorView === 'outreach'} onclick={() => switchOperatorView('outreach')}>Outreach Pipeline</button>
				<button class="sub-toggle-btn" class:active={operatorView === 'database'} onclick={() => switchOperatorView('database')}>Database</button>
				<button class="sub-toggle-btn" class:active={operatorView === 'quality'} onclick={() => switchOperatorView('quality')}>Quality Audit</button>
			</div>
		{:else if activeTab === 'deals'}
			<div class="sub-toggle">
				<button class="sub-toggle-btn" class:active={dealView === 'database'} onclick={() => switchDealView('database')}>Database</button>
				<button class="sub-toggle-btn" class:active={dealView === 'quality'} onclick={() => switchDealView('quality')}>Quality Audit</button>
			</div>
		{/if}

		<!-- Quality Stats -->
		{#if qualityStats && isQualityView}
			<div class="quality-banner">
				<strong>Quality Audit Mode</strong> Shows how complete each record is. Green = 80%+, amber = 50-79%, red = below 50%.
			</div>
			<div class="quality-stats">
				<div class="quality-stat" style="border-left:3px solid {completenessColor(qualityStats.avg_completeness || 0)}">
					<div class="quality-stat-label">Average Completeness</div>
					<div class="quality-stat-value">{qualityStats.avg_completeness || 0}%</div>
				</div>
				<div class="quality-stat" style="border-left:3px solid #10b981">
					<div class="quality-stat-label">80%+</div>
					<div class="quality-stat-value">{qualityStats.above_80 || 0}</div>
				</div>
				<div class="quality-stat" style="border-left:3px solid #ef4444">
					<div class="quality-stat-label">Below 50%</div>
					<div class="quality-stat-value">{qualityStats.below_50 || 0}</div>
				</div>
				{#if activeTab === 'deals'}
					<div class="quality-stat" style="border-left:3px solid #f59e0b">
						<div class="quality-stat-label">Missing Decks</div>
						<div class="quality-stat-value">{qualityStats.no_deck || 0}</div>
					</div>
				{:else}
					<div class="quality-stat" style="border-left:3px solid #f59e0b">
						<div class="quality-stat-label">Missing Websites</div>
						<div class="quality-stat-value">{qualityStats.no_website || 0}</div>
					</div>
				{/if}
			</div>
		{/if}

		<!-- Data Table -->
		{#if loading}
			<div class="loading-msg"><div class="sk-bar" style="width:100%;height:180px;background:var(--border-light,#e5e7eb);border-radius:8px;animation:skPulse 1.5s infinite"></div></div>
		{:else if tableData.length === 0}
			<div class="empty-msg">No records found.</div>
		{:else}
			<div class="table-card">
				<div class="table-wrap">
					<table>
						<thead>
							<tr>
								{#each tableColumns as col}
									<th>{col}</th>
								{/each}
							</tr>
						</thead>
						<tbody>
							{#each tableData as row}
								<tr>
									{#each row.cols as cell, i}
										<td class:completeness={tableColumns[i] === 'Completeness'} style={tableColumns[i] === 'Completeness' ? `color:${completenessColor(row.completeness || 0)};font-weight:700` : ''}>
											{cell}
										</td>
									{/each}
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

			<!-- Pagination -->
			<div class="pagination">
				<button class="page-btn" disabled={currentPage <= 1} onclick={prevPage}>&larr; Prev</button>
				<span class="page-info">Page {currentPage}</span>
				<button class="page-btn" onclick={nextPage}>Next &rarr;</button>
			</div>
		{/if}
	</div>
</div>
{/if}

<style>
	.manage-page { min-height: 100vh; }
	.topbar { display: flex; align-items: center; gap: 16px; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg-card); flex-wrap: wrap; }
	.topbar-title { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.seg-ctrl {
		margin-left: auto;
		display: flex;
		gap: 8px;
		padding: 6px;
		background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,250,251,0.94));
		border: 1px solid rgba(31, 81, 89, 0.12);
		border-radius: 18px;
		box-shadow: 0 14px 32px rgba(16, 37, 42, 0.06);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.seg-ctrl::-webkit-scrollbar { display: none; }
	.seg-btn {
		padding: 10px 16px;
		border: 1px solid transparent;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
		background: transparent;
		color: var(--text-secondary);
		transition: all 0.18s ease;
		white-space: nowrap;
	}
	.seg-btn.active {
		background: linear-gradient(135deg, #1f5159, #10252a);
		color: #fff;
		border-color: rgba(31, 81, 89, 0.28);
		box-shadow: 0 10px 22px rgba(16, 37, 42, 0.16);
	}
	.seg-btn:hover:not(.active) { background: rgba(81, 190, 123, 0.08); color: var(--text-dark); }
	.content { padding: 24px; margin: 0 auto; }

	.toolbar { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; flex-wrap: wrap; }
	.search-wrap { position: relative; flex: 1; min-width: 200px; display: flex; align-items: center; }
	.search-wrap svg { position: absolute; left: 12px; }
	.search-wrap input {
		width: 100%;
		padding: 11px 14px 11px 36px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		border-radius: 12px;
		font-family: var(--font-body);
		font-size: 14px;
		background: rgba(255,255,255,0.9);
		color: var(--text-dark);
		box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
	}
	.action-btn { display: flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 13px; font-weight: 700; cursor: pointer; white-space: nowrap; }
	.action-btn.primary { background: var(--primary); color: #fff; }
	.action-btn.secondary { background: transparent; border: 1px solid var(--border); color: var(--text-secondary); font-size: 12px; }
	.result-count { font-family: var(--font-ui); font-size: 13px; color: var(--text-muted); font-weight: 500; }

	.sub-toggle {
		display: inline-flex;
		gap: 8px;
		padding: 6px;
		background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,250,251,0.94));
		border: 1px solid rgba(31, 81, 89, 0.12);
		border-radius: 18px;
		margin-bottom: 16px;
		box-shadow: 0 12px 26px rgba(16, 37, 42, 0.05);
		flex-wrap: wrap;
	}
	.sub-toggle-btn {
		padding: 9px 15px;
		border: 1px solid transparent;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
		transition: all 0.18s ease;
		background: transparent;
		color: var(--text-secondary);
		white-space: nowrap;
	}
	.sub-toggle-btn.active {
		background: linear-gradient(135deg, #1f5159, #10252a);
		color: #fff;
		border-color: rgba(31, 81, 89, 0.28);
		box-shadow: 0 10px 22px rgba(16, 37, 42, 0.16);
	}
	.sub-toggle-btn:hover:not(.active) { background: rgba(81, 190, 123, 0.08); color: var(--text-dark); }

	.quality-banner { padding: 14px 18px; background: var(--bg-cream); border-radius: 12px; margin-bottom: 16px; font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
	.quality-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 12px; margin-bottom: 20px; }
	.quality-stat { background: var(--bg-card); border: 1px solid var(--border); border-radius: 8px; padding: 12px; }
	.quality-stat-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; }
	.quality-stat-value { font-family: var(--font-ui); font-size: 20px; font-weight: 800; color: var(--text-dark); }

	.table-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 14px; }
	thead tr { border-bottom: 2px solid var(--border); }
	th { text-align: left; padding: 12px 16px; font-family: var(--font-ui); font-weight: 600; font-size: 11px; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; }
	td { padding: 12px 16px; border-bottom: 1px solid var(--border); color: var(--text-secondary); }
	tr:hover { background: var(--bg-cream); }

	.pagination { display: flex; justify-content: center; align-items: center; gap: 12px; margin-top: 16px; }
	.page-btn { padding: 8px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--bg-card); font-family: var(--font-ui); font-size: 13px; cursor: pointer; color: var(--text-secondary); }
	.page-btn:disabled { opacity: 0.4; cursor: default; }
	.page-info { font-family: var(--font-ui); font-size: 13px; color: var(--text-muted); }

	.loading-msg, .empty-msg { text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px; }
	.loading { display: flex; align-items: center; justify-content: center; min-height: 60vh; color: var(--text-muted); }

	@media (max-width: 768px) {
		.seg-ctrl { margin-left: 0; width: 100%; }
		.toolbar { flex-direction: column; align-items: stretch; }
		.sub-toggle { width: 100%; }
	}
	@keyframes skPulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
</style>
