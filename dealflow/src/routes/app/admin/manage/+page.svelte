<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { canonicalizeUserTier, isAdmin, getFreshSessionToken, getStoredSessionUser } from '$lib/stores/auth.js';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import { readScopedStaleCache, writeScopedStaleCache } from '$lib/utils/scopedStaleCache.js';
	import {
		compareDealWorkflowRecords,
		DEAL_LIFECYCLE_LABELS,
		DEAL_LIFECYCLE_STATUSES
	} from '$lib/utils/dealWorkflow.js';

	let activeTab = $state('deals');
	const tabs = ['deals', 'operators', 'users', 'intros'];
	const tabLabels = {
		operators: 'Operators',
		deals: 'Deals',
		users: 'Users',
		intros: 'Intros'
	};

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

	let dealWorkflowRows = $state([]);
	let dealFilter = $state('all');
	let rowActionPendingId = $state(null);
	let hasEverLoaded = $state(false);
	const DEAL_QUEUE_CACHE_TTL_MS = 15 * 1000;

	const showCreateButton = $derived.by(() => {
		if (activeTab === 'operators') return operatorView === 'database';
		if (activeTab === 'deals') return true;
		return false;
	});

	const searchPlaceholder = $derived.by(() => {
		if (activeTab === 'deals') return 'Search deals...';
		if (activeTab === 'operators') return 'Search operators...';
		if (activeTab === 'users') return 'Search users...';
		return 'Search intros...';
	});

	const dealStats = $derived.by(() => computeDealWorkflowStats(dealWorkflowRows));
	const filteredDealRows = $derived.by(() => {
		let rows = [...dealWorkflowRows];
		if (dealFilter !== 'all') {
			rows = rows.filter((row) => matchesDealFilter(row, dealFilter));
		}
		rows.sort(compareDealWorkflowRecords);
		return rows;
	});
	const dealFilterOptions = $derived.by(() => [
		{ key: 'all', label: 'All', count: dealWorkflowRows.length },
		{ key: 'draft', label: 'Draft', count: countDealRows(dealWorkflowRows, 'draft') },
		{ key: 'in_review', label: 'In Review', count: countDealRows(dealWorkflowRows, 'in_review') },
		{ key: 'approved', label: 'Approved', count: countDealRows(dealWorkflowRows, 'approved') },
		{ key: 'published', label: 'Published', count: countDealRows(dealWorkflowRows, 'published') },
		{ key: 'do_not_publish', label: 'Do Not Publish', count: countDealRows(dealWorkflowRows, 'do_not_publish') },
		{ key: 'archived', label: 'Archived', count: countDealRows(dealWorkflowRows, 'archived') }
	]);

	onMount(() => {
		if (!$isAdmin) {
			goto('/app/deals');
			return;
		}
		void loadData();
	});

	async function adminFetch(body) {
		let token = await getFreshSessionToken();
		// Fallback to stored token if refresh fails (bypass/expired tokens)
		if (!token) {
			const stored = getStoredSessionUser();
			token = stored?.token || '';
		}
		if (!token) return { success: false, error: 'Not signed in' };
		const resp = await fetch('/api/admin-manage', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(body)
		});
		return resp.json();
	}

	async function outreachFetch(body) {
		const token = await getFreshSessionToken();
		if (!token) return { success: false, error: 'Not signed in' };
		const resp = await fetch('/api/operator-outreach', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
		if (tab === 'deals') dealFilter = 'all';
		void loadData();
	}

	function switchOperatorView(view) {
		operatorView = view;
		currentPage = 1;
		qualityStats = null;
		void loadData();
	}

	function searchDebounce() {
		clearTimeout(searchTimer);
		searchTimer = setTimeout(() => {
			currentPage = 1;
			void loadData();
		}, 300);
	}

	function getDealQueueCacheKey(search = '') {
		return `gycAdminDealQueueV1:${String(search || '').trim().toLowerCase()}`;
	}

	function primeDealQueueFromCache(search = '') {
		const cached = readScopedStaleCache(getDealQueueCacheKey(search), {
			maxAgeMs: DEAL_QUEUE_CACHE_TTL_MS
		});
		if (!cached?.value) return { hasCached: false, fresh: false };
		dealWorkflowRows = Array.isArray(cached.value.rows) ? cached.value.rows : [];
		loading = false;
		return { hasCached: true, fresh: cached.fresh };
	}

	function persistDealQueueCache(search = '') {
		writeScopedStaleCache(getDealQueueCacheKey(search), {
			rows: dealWorkflowRows
		});
	}

	async function loadData() {
		const search = searchQuery.trim();

		if (activeTab === 'deals') {
			const cachedState = primeDealQueueFromCache(search);
			if (cachedState.fresh) {
				hasEverLoaded = true;
				return;
			}
			// Only show loading spinner if no cached data exists
			if (!cachedState.hasCached) loading = true;
			try {
				const result = await adminFetch({ action: 'list-deals-workflow', search });
				if (result.success) {
					dealWorkflowRows = result.data || [];
				} else if (!cachedState.hasCached) {
					dealWorkflowRows = [];
				}
			} catch {
				if (!cachedState.hasCached) dealWorkflowRows = [];
			}
			// Persist cache outside the try/catch so a storage write failure
			// (e.g. QuotaExceededError on large datasets) never wipes dealWorkflowRows
			if (dealWorkflowRows.length > 0) {
				try { persistDealQueueCache(search); } catch {}
			}
			loading = false;
			hasEverLoaded = true;
			return;
		}

		loading = true;
		qualityStats = null;

		if (activeTab === 'intros') {
			try {
				const result = await adminFetch({ action: 'list-intros', search });
				if (result.success) {
					const intros = result.data || [];
					tableColumns = ['LP', 'Deal', 'GP', 'Status', 'Date'];
					tableData = intros.map((item) => ({
						cols: [
							item.user_email || '--',
							item.deal_name || '--',
							item.operator_name || '--',
							item.status || '--',
							item.created_at ? new Date(item.created_at).toLocaleDateString() : '--'
						],
						id: item.id
					}));
					tableTotal = intros.length;
					resultCount = `${intros.length} intros`;
				}
			} catch {
				tableData = [];
			}
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
			} catch {
				tableData = [];
				resultCount = 'Error loading';
			}
			loading = false;
			return;
		}

		if (activeTab === 'operators' && operatorView === 'quality') {
			try {
				const result = await adminFetch({ action: 'list-operators-quality', search });
				if (result.success) {
					qualityStats = result.stats;
					const data = result.data || [];
					tableColumns = ['Operator', 'Deals', 'Completeness', 'Missing Fields'];
					tableData = data.map((item) => ({
						cols: [
							item.name || '--',
							item.deal_count || 0,
							`${item.completeness_pct || 0}%`,
							(item.missing_fields || []).join(', ') || 'None'
						],
						id: item.id,
						completeness: item.completeness_pct || 0
					}));
					tableTotal = data.length;
					resultCount = `${data.length} quality records`;
				}
			} catch {
				tableData = [];
			}
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
					tableData = data.map((item) => ({
						cols: [
							item.operator_name || item.name || '--',
							item.website || '--',
							item.dealCount || item.deal_count || 0,
							item.status || '--'
						],
						id: item.id
					}));
				} else if (activeTab === 'users') {
					tableColumns = ['Email', 'Name', 'Tier', 'Signed Up'];
					tableData = data.map((item) => ({
						cols: [
							item.email || '--',
							item.full_name || item.fullName || '--',
							canonicalizeUserTier(item.tier, { email: item.email, isAdmin: item.is_admin === true }),
							formatShortDate(item.created_at || item.createdAt)
						],
						id: item.id
					}));
				}
			}
		} catch {
			tableData = [];
			resultCount = 'Error loading';
		}
		loading = false;
	}

	async function createNew() {
		const name = prompt(
			`Enter new ${activeTab === 'operators' ? 'operator' : activeTab === 'deals' ? 'deal' : 'record'} name:`
		);
		if (!name) return;

		const payload =
			activeTab === 'deals'
				? { action: 'create-deal', investment_name: name }
				: activeTab === 'operators'
					? { action: 'create-operator', operator_name: name }
					: null;

		if (!payload) return;

		const result = await adminFetch(payload);
		if (!result.success) {
			alert('Create failed: ' + (result.error || 'Unknown'));
			return;
		}

		if (activeTab === 'deals' && result.data?.id) {
			await goto(`/deal-review?id=${encodeURIComponent(result.data.id)}&from=queue&stage=intake`);
			return;
		}

		void loadData();
	}

	function prevPage() {
		if (currentPage > 1) {
			currentPage -= 1;
			void loadData();
		}
	}

	function nextPage() {
		currentPage += 1;
		void loadData();
	}

	function completenessColor(pct) {
		if (pct >= 90) return '#167a52';
		if (pct >= 70) return '#d68c45';
		return '#c24144';
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

	function formatLifecycleLabel(status) {
		return DEAL_LIFECYCLE_LABELS[status] || formatStatus(status);
	}

	function computeDealWorkflowStats(rows) {
		return {
			totalDeals: rows.length,
			draft: rows.filter((row) => row.lifecycleStatus === 'draft').length,
			inReview: rows.filter((row) => row.lifecycleStatus === 'in_review').length,
			approved: rows.filter((row) => row.lifecycleStatus === 'approved').length,
			published: rows.filter((row) => row.lifecycleStatus === 'published' && row.catalogState !== 'archived').length,
			doNotPublish: rows.filter((row) => row.lifecycleStatus === 'do_not_publish').length,
			archived: rows.filter((row) => row.catalogState === 'archived').length
		};
	}

	function matchesDealFilter(row, filterKey) {
		switch (filterKey) {
			case 'draft':
			case 'in_review':
			case 'approved':
			case 'do_not_publish':
				return row.lifecycleStatus === filterKey;
			case 'published':
				return row.lifecycleStatus === 'published' && row.catalogState !== 'archived';
			case 'archived':
				return row.catalogState === 'archived';
			default:
				return true;
		}
	}

	function countDealRows(rows, filterKey) {
		return rows.filter((row) => matchesDealFilter(row, filterKey)).length;
	}

	function readinessTone(row) {
		if (row.hasBlockingIssues) return 'blocked';
		if (row.completenessScore >= 90) return 'ready';
		if (row.completenessScore >= 70) return 'nearly';
		return 'incomplete';
	}

	function updateDealWorkflowRow(nextRow) {
		dealWorkflowRows = dealWorkflowRows.map((row) => (row.id === nextRow.id ? nextRow : row));
		persistDealQueueCache(searchQuery.trim());
	}

	async function handleLifecycleChange(row, event) {
		const lifecycleStatus = event.currentTarget.value;
		if (!lifecycleStatus || lifecycleStatus === row.lifecycleStatus) return;
		rowActionPendingId = row.id;
		const result = await adminFetch({
			action: 'update-deal-workflow',
			id: row.id,
			lifecycleStatus
		});
		rowActionPendingId = null;
		if (!result.success) {
			alert(result.message || result.error || 'Could not update lifecycle status.');
			return;
		}
		updateDealWorkflowRow(result.data);
	}

	function openDealEditor(row) {
		const params = new URLSearchParams({
			id: row.id,
			from: 'queue'
		});
		if (['approved', 'published', 'do_not_publish'].includes(row?.lifecycleStatus)) {
			params.set('stage', 'summary');
			params.set('allowSummary', '1');
		}
		goto(`/deal-review?${params.toString()}`);
	}

	function formatSubmissionSummary(row) {
		const submittedBy = row.submittedByName || row.submittedByEmail || 'Unknown submitter';
		const role = row.submittedByRoleLabel || 'Admin';
		const surface = row.submissionSurfaceLabel || 'Admin';
		return `${role} via ${surface} · ${submittedBy}`;
	}

	function formatSubmissionContext(row) {
		const intent = row.submissionIntentLabel || 'Evaluating';
		return `Intent: ${intent}`;
	}
</script>

{#if !$isAdmin}
	<div class="loading">Redirecting...</div>
{:else}
	<PageContainer className="manage-page ly-page-stack">
		<PageHeader title="Manage Data">
			<div slot="secondaryRow" class="page-tools-row">
				<div class="seg-ctrl">
					{#each tabs as tab}
						<button class="seg-btn" class:active={activeTab === tab} onclick={() => switchTab(tab)}>
							{tabLabels[tab]}
						</button>
					{/each}
				</div>
				<div class="header-toolbar">
					<div class="search-wrap header-search">
						<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="16" height="16">
							<circle cx="11" cy="11" r="8" />
							<line x1="21" y1="21" x2="16.65" y2="16.65" />
						</svg>
						<input type="text" placeholder={searchPlaceholder} bind:value={searchQuery} oninput={searchDebounce} />
					</div>
					{#if showCreateButton}
						<button class="action-btn primary" onclick={createNew}>+ Add New</button>
					{/if}
				</div>
			</div>
		</PageHeader>

		<div class="content">
			{#if activeTab === 'operators'}
				<div class="sub-toggle">
					<button class="sub-toggle-btn" class:active={operatorView === 'outreach'} onclick={() => switchOperatorView('outreach')}>
						Outreach Pipeline
					</button>
					<button class="sub-toggle-btn" class:active={operatorView === 'database'} onclick={() => switchOperatorView('database')}>
						Database
					</button>
					<button class="sub-toggle-btn" class:active={operatorView === 'quality'} onclick={() => switchOperatorView('quality')}>
						Quality Audit
					</button>
				</div>
			{/if}

			{#if activeTab === 'deals'}
				<section class="queue-banner">
					<div class="queue-banner__eyebrow">Deal QA Work Queue</div>
					<div class="queue-banner__title">Review imported deals, fill the gaps, then publish only what is trustworthy.</div>
					<p class="queue-banner__copy">
						Start new deals in Draft, move active work to In Review, approve what is ready, and publish only what belongs in the live catalog.
					</p>
				</section>

				<div class="stats-grid">
					{#if loading && !hasEverLoaded}
						{#each ['Total Deals', 'Draft', 'In Review', 'Approved', 'Published', 'Do Not Publish', 'Archived'] as label}
							<div class="stat-card">
								<div class="stat-label">{label}</div>
								<div class="stat-value stat-loading">—</div>
							</div>
						{/each}
					{:else}
						<div class="stat-card">
							<div class="stat-label">Total Deals</div>
							<div class="stat-value">{dealStats.totalDeals}</div>
						</div>
						<div class="stat-card">
							<div class="stat-label">Draft</div>
							<div class="stat-value">{dealStats.draft}</div>
						</div>
						<div class="stat-card">
							<div class="stat-label">In Review</div>
							<div class="stat-value">{dealStats.inReview}</div>
						</div>
						<div class="stat-card">
							<div class="stat-label">Approved</div>
							<div class="stat-value">{dealStats.approved}</div>
						</div>
						<div class="stat-card">
							<div class="stat-label">Published</div>
							<div class="stat-value">{dealStats.published}</div>
						</div>
						<div class="stat-card">
							<div class="stat-label">Do Not Publish</div>
							<div class="stat-value">{dealStats.doNotPublish}</div>
						</div>
						<div class="stat-card">
							<div class="stat-label">Archived</div>
							<div class="stat-value">{dealStats.archived}</div>
						</div>
					{/if}
				</div>

				<div class="filter-row">
					{#each dealFilterOptions as option}
						<button class="filter-chip" class:active={dealFilter === option.key} onclick={() => (dealFilter = option.key)}>
							<span>{option.label}</span>
							<span class="filter-chip__count">{option.count}</span>
						</button>
					{/each}
				</div>

				{#if loading && !hasEverLoaded}
					<div class="loading-msg">
						<div class="sk-bar"></div>
					</div>
				{:else if filteredDealRows.length === 0 && hasEverLoaded}
					<div class="empty-msg">No deals match the current search or filter.</div>
				{:else}
					<div class="table-card">
						<div class="table-wrap">
							<table class="workflow-table">
								<thead>
									<tr>
										<th>Deal</th>
										<th>Completeness</th>
										<th>Lifecycle Status</th>
										<th>Edit</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredDealRows as row}
										<tr class:is-pending={rowActionPendingId === row.id}>
											<td>
												<div class="deal-cell">
													<div class="deal-sponsor">{row.sponsorName || 'Unknown sponsor'}</div>
													<div class="deal-name">{row.dealName}</div>
													<div class="deal-meta">{row.slug ? `/${row.slug}` : 'No slug yet'}</div>
													<div class="deal-meta">{formatSubmissionSummary(row)}</div>
													<div class="deal-meta">{formatSubmissionContext(row)}</div>
													<div class="deal-updated">
														Updated {formatShortDate(row.updatedAt)}
													</div>
												</div>
											</td>
											<td>
												<div class="completeness-cell">
													<div class="completeness-topline">
														<span class="completeness-score" style={`color:${completenessColor(row.completenessScore)};`}>
															{row.completenessScore}%
														</span>
														<span class={`readiness-badge tone-${readinessTone(row)}`}>
															{row.hasBlockingIssues ? 'Blocked' : row.readinessLabel}
														</span>
													</div>
													<div class="progress-shell" aria-hidden="true">
														<div class="progress-fill" style={`width:${row.completenessScore}%; background:${completenessColor(row.completenessScore)};`}></div>
													</div>
													<div class="completeness-copy">{row.readinessLabel}</div>
												</div>
											</td>
											<td>
												<div class="lifecycle-cell">
													<select
														class="lifecycle-select"
														value={row.lifecycleStatus}
														onchange={(event) => handleLifecycleChange(row, event)}
														disabled={rowActionPendingId === row.id}
													>
														{#each DEAL_LIFECYCLE_STATUSES as status}
															<option value={status}>{formatLifecycleLabel(status)}</option>
														{/each}
													</select>
												</div>
											</td>
											<td>
												<button class="edit-link" onclick={() => openDealEditor(row)}>Edit</button>
											</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}
			{:else}
				{#if qualityStats && activeTab === 'operators' && operatorView === 'quality'}
					<div class="quality-banner">
						<strong>Quality Audit Mode</strong> Shows how complete each operator record is. Green = 80%+, amber = 50-79%, red = below 50%.
					</div>
					<div class="quality-stats">
						<div class="quality-stat" style={`border-left:3px solid ${completenessColor(qualityStats.avg_completeness || 0)}`}>
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
						<div class="quality-stat" style="border-left:3px solid #f59e0b">
							<div class="quality-stat-label">Missing Websites</div>
							<div class="quality-stat-value">{qualityStats.no_website || 0}</div>
						</div>
					</div>
				{/if}

				{#if loading}
					<div class="loading-msg">
						<div class="sk-bar"></div>
					</div>
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
											{#each row.cols as cell, index}
												<td
													class:completeness={tableColumns[index] === 'Completeness'}
													style={tableColumns[index] === 'Completeness' ? `color:${completenessColor(row.completeness || 0)};font-weight:700` : ''}
												>
													{cell}
												</td>
											{/each}
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					{#if activeTab !== 'deals'}
						<div class="pagination">
							<button class="page-btn" disabled={currentPage <= 1} onclick={prevPage}>&larr; Prev</button>
							<span class="page-info">Page {currentPage}</span>
							<button class="page-btn" onclick={nextPage}>Next &rarr;</button>
						</div>
					{/if}
				{/if}
			{/if}
		</div>
	</PageContainer>
{/if}

<style>
	.manage-page { min-height: 100vh; }
	.page-tools-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
	}

	.seg-ctrl,
	.sub-toggle {
		display: flex;
		gap: 8px;
		padding: 6px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(247, 250, 251, 0.94));
		border: 1px solid rgba(31, 81, 89, 0.12);
		border-radius: 18px;
		box-shadow: 0 14px 32px rgba(16, 37, 42, 0.06);
		overflow-x: auto;
		scrollbar-width: none;
	}

	.seg-ctrl::-webkit-scrollbar,
	.sub-toggle::-webkit-scrollbar { display: none; }

	.seg-btn,
	.sub-toggle-btn {
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

	.seg-btn.active,
	.sub-toggle-btn.active {
		background: linear-gradient(135deg, #1f5159, #10252a);
		color: #fff;
		border-color: rgba(31, 81, 89, 0.28);
		box-shadow: 0 10px 22px rgba(16, 37, 42, 0.16);
	}

	.seg-btn:hover:not(.active),
	.sub-toggle-btn:hover:not(.active) {
		background: rgba(81, 190, 123, 0.08);
		color: var(--text-dark);
	}

	.content { min-width: 0; }

	.header-toolbar {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
		margin-left: auto;
	}

	.search-wrap {
		position: relative;
		flex: 1;
		min-width: 220px;
		display: flex;
		align-items: center;
	}
	.header-search {
		min-width: 320px;
		max-width: 460px;
	}

	.search-wrap svg { position: absolute; left: 12px; }

	.search-wrap input {
		width: 100%;
		padding: 11px 14px 11px 36px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		border-radius: 12px;
		font-family: var(--font-body);
		font-size: 14px;
		background: rgba(255, 255, 255, 0.9);
		color: var(--text-dark);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.4);
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 10px 20px;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
		white-space: nowrap;
	}

	.action-btn.primary { background: var(--primary); color: #fff; }
	.action-btn.secondary {
		background: transparent;
		border: 1px solid var(--border);
		color: var(--text-secondary);
		font-size: 12px;
	}

	.sub-toggle {
		margin-bottom: 16px;
		flex-wrap: wrap;
	}

	.queue-banner {
		padding: 20px 22px;
		border-radius: 18px;
		background:
			linear-gradient(135deg, rgba(16, 37, 42, 0.96), rgba(31, 81, 89, 0.94)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.25), transparent 42%);
		color: #f7fafb;
		margin-bottom: 18px;
		box-shadow: 0 18px 40px rgba(16, 37, 42, 0.18);
	}

	.queue-banner__eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 1.4px;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.68);
		margin-bottom: 10px;
	}

	.queue-banner__title {
		font-family: var(--font-ui);
		font-size: clamp(20px, 3vw, 26px);
		font-weight: 800;
		line-height: 1.18;
		margin-bottom: 8px;
	}

	.queue-banner__copy {
		margin: 0;
		max-width: 780px;
		font-size: 14px;
		line-height: 1.55;
		color: rgba(247, 250, 251, 0.78);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
		gap: 12px;
		margin-bottom: 16px;
	}

	.stat-card {
		padding: 14px 16px;
		border-radius: 16px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 251, 0.98));
		border: 1px solid rgba(31, 81, 89, 0.1);
		box-shadow: 0 14px 30px rgba(16, 37, 42, 0.05);
	}

	.stat-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.9px;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 6px;
	}

	.stat-value {
		font-family: var(--font-ui);
		font-size: 26px;
		font-weight: 800;
		color: var(--text-dark);
	}
	.stat-loading {
		color: var(--text-muted);
		opacity: 0.5;
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		margin-bottom: 16px;
	}

	.filter-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 9px 12px;
		border-radius: 999px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.86);
		color: var(--text-secondary);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
		transition: all 0.16s ease;
	}

	.filter-chip.active {
		background: rgba(31, 81, 89, 0.96);
		color: #fff;
		border-color: rgba(31, 81, 89, 0.96);
	}

	.filter-chip__count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 22px;
		height: 22px;
		padding: 0 6px;
		border-radius: 999px;
		background: rgba(16, 37, 42, 0.08);
		font-size: 11px;
	}

	.filter-chip.active .filter-chip__count {
		background: rgba(255, 255, 255, 0.16);
	}

	.table-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 20px;
		overflow: hidden;
		box-shadow: 0 18px 36px rgba(16, 37, 42, 0.05);
	}

	.table-wrap { overflow-x: auto; }

	table {
		width: 100%;
		border-collapse: collapse;
		font-family: var(--font-body);
		font-size: 14px;
	}

	thead tr { border-bottom: 2px solid var(--border); }

	th {
		text-align: left;
		padding: 13px 16px;
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 11px;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: rgba(247, 250, 251, 0.98);
	}

	td {
		padding: 14px 16px;
		border-bottom: 1px solid var(--border);
		color: var(--text-secondary);
		vertical-align: top;
	}

	tr:hover { background: rgba(247, 250, 251, 0.85); }
	.workflow-table tr.is-pending { opacity: 0.7; }

	.deal-cell {
		min-width: 260px;
		display: flex;
		flex-direction: column;
		gap: 3px;
	}

	.deal-sponsor {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.2px;
		color: var(--text-secondary);
	}

	.deal-name {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
		line-height: 1.3;
	}

	.deal-meta,
	.deal-updated,
	.issue-fallback,
	.completeness-copy {
		font-size: 12px;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.completeness-cell {
		min-width: 180px;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.completeness-topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
	}

	.completeness-score {
		font-family: var(--font-ui);
		font-size: 24px;
		font-weight: 800;
		line-height: 1;
	}

	.progress-shell {
		height: 8px;
		border-radius: 999px;
		background: rgba(16, 37, 42, 0.08);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: inherit;
	}

	.readiness-badge,
	.issue-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 5px 9px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.2px;
	}

	.readiness-badge.tone-ready {
		background: rgba(22, 122, 82, 0.12);
		color: #167a52;
	}

	.readiness-badge.tone-nearly {
		background: rgba(214, 140, 69, 0.14);
		color: #b56f2f;
	}

	.readiness-badge.tone-incomplete {
		background: rgba(31, 81, 89, 0.1);
		color: #1f5159;
	}

	.readiness-badge.tone-blocked {
		background: rgba(194, 65, 68, 0.14);
		color: #b42328;
	}

	.issue-chip-wrap {
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		max-width: 260px;
	}

	.issue-chip.tone-required {
		background: rgba(194, 65, 68, 0.12);
		color: #b42328;
	}

	.issue-chip.tone-recommended {
		background: rgba(31, 81, 89, 0.08);
		color: #1f5159;
	}

	.issue-fallback { margin-top: 6px; }

	.lifecycle-cell {
		display: flex;
		flex-direction: column;
		min-width: 160px;
	}

	.lifecycle-select {
		padding: 9px 10px;
		border-radius: 10px;
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: #fff;
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
	}

	.visibility-toggle {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		min-width: 220px;
		padding: 0;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.visibility-toggle:disabled {
		cursor: not-allowed;
		opacity: 0.6;
	}

	.visibility-track {
		position: relative;
		flex: 0 0 auto;
		width: 48px;
		height: 28px;
		border-radius: 999px;
		background: rgba(16, 37, 42, 0.14);
		transition: background 0.18s ease;
	}

	.visibility-toggle.is-on .visibility-track {
		background: rgba(22, 122, 82, 0.24);
	}

	.visibility-knob {
		position: absolute;
		top: 3px;
		left: 3px;
		width: 22px;
		height: 22px;
		border-radius: 50%;
		background: #fff;
		box-shadow: 0 5px 12px rgba(16, 37, 42, 0.18);
		transition: transform 0.18s ease;
	}

	.visibility-toggle.is-on .visibility-knob {
		transform: translateX(20px);
	}

	.visibility-text {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.visibility-label {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.visibility-sub {
		font-size: 11px;
		color: var(--text-muted);
		line-height: 1.35;
	}

	.edit-link {
		padding: 9px 12px;
		border-radius: 10px;
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: rgba(255, 255, 255, 0.9);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		cursor: pointer;
	}

	.quality-banner {
		padding: 14px 18px;
		background: var(--bg-cream);
		border-radius: 12px;
		margin-bottom: 16px;
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
	}

	.quality-stats {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
		gap: 12px;
		margin-bottom: 20px;
	}

	.quality-stat {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 12px;
	}

	.quality-stat-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
	}

	.quality-stat-value {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.pagination {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 12px;
		margin-top: 16px;
	}

	.page-btn {
		padding: 8px 16px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		font-family: var(--font-ui);
		font-size: 13px;
		cursor: pointer;
		color: var(--text-secondary);
	}

	.page-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.page-info {
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-muted);
	}

	.loading-msg,
	.empty-msg {
		text-align: center;
		padding: 40px;
		color: var(--text-muted);
		font-size: 13px;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 60vh;
		color: var(--text-muted);
	}

	.sk-bar {
		width: 100%;
		height: 180px;
		background: var(--border-light, #e5e7eb);
		border-radius: 12px;
		animation: skPulse 1.5s infinite;
	}

	@media (max-width: 900px) {
		.page-tools-row { align-items: stretch; }
		.header-toolbar { width: 100%; margin-left: 0; }
		.header-search { min-width: 0; max-width: none; width: 100%; }
		.visibility-toggle { min-width: 180px; }
	}

	@media (max-width: 768px) {
		.seg-ctrl { width: 100%; }
		.sub-toggle { width: 100%; }
		.queue-banner { padding: 18px; }
		.stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
		th,
		td { padding: 12px; }
	}

	@keyframes skPulse {
		0%, 100% { opacity: 0.4; }
		50% { opacity: 0.8; }
	}
</style>
