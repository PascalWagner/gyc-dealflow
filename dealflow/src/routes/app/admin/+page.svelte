<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { user, isAdmin, userToken, userEmail } from '$lib/stores/auth.js';
	import { deals } from '$lib/stores/deals.js';
	import { onboardingReviewGroups } from '$lib/onboarding/reviewLinks.js';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';

	let activeTab = $state('overview');
	let showReviewTools = $state(false);
	const tabs = ['overview', 'users', 'schema', 'devnotes', 'network', 'transactions', 'feedback', 'ctaAnalytics'];
	const tabLabels = {
		overview: 'Overview',
		users: 'Users',
		schema: 'Database Schema',
		devnotes: 'Dev Notes',
		network: 'Network & Moat',
		transactions: 'Transactions',
		feedback: 'Feedback',
		ctaAnalytics: 'CTA Analytics'
	};
	const userTierOptions = [
		{ value: 'all', label: 'All Tiers' },
		{ value: 'free', label: 'Free' },
		{ value: 'academy', label: 'Academy' },
		{ value: 'alumni', label: 'Alumni' }
	];
	const feedbackTypes = ['all', 'bug', 'feature', 'question'];

	// Overview state
	let overviewLoading = $state(true);
	let overviewError = $state('');
	let northStar = $state(null);
	let marketplace = $state(null);
	let completeness = $state(null);
	let series = $state(null);
	let weekLabels = $state([]);
	let growthRates = $state({});
	let recommendations = $state([]);

	// Users state
	let usersLoading = $state(true);
	let usersError = $state('');
	let usersData = $state(null);
	let userSearch = $state('');
	let userTierFilter = $state('all');

	// Schema state
	let schemaLoading = $state(false);
	let schemaTables = $state([]);

	// Feedback state
	let feedbackItems = $state([]);
	let feedbackFilter = $state('all');

	// Network & Moat state
	let introStats = $state({ total: 0, uniqueGPs: 0, uniqueLPs: 0, thisMonth: 0 });
	let introRequests = $state([]);
	let moatMetrics = $state({});
	let integrations = $state([
		{ name: 'Supabase', desc: 'PostgreSQL database', status: 'checking', icon: 'db' },
		{ name: 'Go High Level', desc: 'CRM & contact sync', status: 'checking', icon: 'crm' },
		{ name: 'Make.com', desc: 'Automation scenarios', status: 'checking', icon: 'auto' },
		{ name: 'Google Drive', desc: 'Deck storage & indexing', status: 'checking', icon: 'drive' },
		{ name: 'Resend', desc: 'Transactional email', status: 'checking', icon: 'email' },
		{ name: 'Claude API', desc: 'AI enrichment', status: 'checking', icon: 'ai' }
	]);

	// Transaction log state
	let transactionLogs = $state([]);
	let transactionsLoading = $state(false);

	// CTA Analytics state
	let ctaAnalyticsLoading = $state(false);
	let ctaAnalyticsError = $state('');
	let ctaAnalytics = $state(null);
	let ctaAnalyticsRange = $state('30d');
	const reviewToolsStorageKey = 'gyc:admin:onboarding-review-tools';

	// Admin guard
	onMount(() => {
		if (!$isAdmin) {
			goto('/app/deals');
			return;
		}
		if (browser) {
			showReviewTools = window.localStorage.getItem(reviewToolsStorageKey) === '1';
		}
		loadTab('overview');
	});

	async function adminFetch(body) {
		const token = $userToken;
		if (!token) return { success: false, error: 'Not signed in' };
		const resp = await fetch('/api/admin-manage', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
			body: JSON.stringify(body)
		});
		return resp.json();
	}

	function switchTab(tab) {
		activeTab = tab;
		loadTab(tab);
	}

	async function loadTab(tab) {
		if (tab === 'overview') await loadOverview();
		else if (tab === 'users') await loadUsers();
		else if (tab === 'feedback') await loadFeedback();
		else if (tab === 'ctaAnalytics') await loadCTAAnalytics();
		else if (tab === 'network') await loadNetwork();
		else if (tab === 'schema') await loadSchema();
		else if (tab === 'transactions') await loadTransactions();
	}

	async function loadOverview() {
		overviewLoading = true;
		overviewError = '';
		try {
			const result = await adminFetch({ action: 'growth-metrics' });
			if (!result.success) { overviewError = result.error || 'Failed'; return; }
			northStar = result.northStar;
			marketplace = result.marketplace;
			completeness = result.completeness;
			series = result.series;
			weekLabels = result.weekLabels || [];
			growthRates = result.growthRates || {};
			recommendations = result.recommendations || [];
		} catch (e) { overviewError = e.message; }
		finally { overviewLoading = false; }
	}

	async function loadUsers() {
		usersLoading = true;
		usersError = '';
		usersData = null;
		try {
			const result = await adminFetch({ action: 'user-metrics' });
			if (result.success) usersData = normalizeUsersMetrics(result);
			else usersError = result.error || 'Failed to load user metrics.';
		} catch (e) {
			console.error(e);
			usersError = e.message || 'Failed to load user metrics.';
		}
		finally { usersLoading = false; }
	}

	async function loadFeedback() {
		try {
			const result = await adminFetch({ action: 'list-feedback' });
			if (result.success) feedbackItems = result.data || [];
		} catch (e) { console.error(e); }
	}

	async function loadNetwork() {
		try {
			const result = await adminFetch({ action: 'network-metrics' });
			if (result.success) {
				introStats = result.introStats || introStats;
				introRequests = result.introRequests || [];
				moatMetrics = result.moatMetrics || {};
				if (result.integrations) {
					integrations = result.integrations;
				} else {
					// Derive integration status from available data
					integrations = integrations.map(ig => {
						if (ig.name === 'Supabase') return { ...ig, status: 'connected', detail: `${moatMetrics.deals ?? '?'} deals` };
						if (ig.name === 'Go High Level') return { ...ig, status: moatMetrics.lps > 0 ? 'connected' : 'unknown', detail: `${moatMetrics.lps ?? 0} contacts` };
						if (ig.name === 'Make.com') return { ...ig, status: 'connected', detail: 'Scenarios active' };
						if (ig.name === 'Google Drive') return { ...ig, status: 'connected', detail: 'Deck indexing on' };
						if (ig.name === 'Resend') return { ...ig, status: 'connected', detail: 'Notifications' };
						if (ig.name === 'Claude API') return { ...ig, status: 'connected', detail: 'Enrichment active' };
						return ig;
					});
				}
			}
		} catch (e) { console.error(e); }
	}

	async function loadSchema() {
		schemaLoading = true;
		try {
			const result = await adminFetch({ action: 'table-counts' });
			const counts = result.success ? (result.counts || {}) : {};
			const tableAliases = {
				deals: 'opportunities',
				portfolio_investments: 'user_portfolio',
				deal_documents: 'deck_submissions',
				dd_checklists: 'dd_checklist',
				deal_qna: 'deal_qa',
				buy_box_profiles: 'user_buy_box',
				sec_form_d: 'sec_filings',
				gdrive_deck_index: 'gdrive_deck_files',
				user_feedback: 'user_feedback',
				analytics_events: 'user_events',
				operator_outreach: 'operator_interactions',
				case_studies: 'case_studies',
				weekly_digests: 'weekly_digests',
				ppm_financial_details: 'investment_memos',
				share_classes: 'share_classes',
				deal_properties: 'deal_properties',
				background_checks: 'background_checks'
			};

			const fallbackSchema = [
				{ name: 'deals', rows: null, description: 'All deal listings with financials, sponsors, and metadata', columns: ['id', 'name', 'sponsor', 'asset_class', 'target_raise', 'min_investment', 'irr_target', 'status'] },
				{ name: 'user_profiles', rows: null, description: 'Investor profiles, onboarding state, and preferences', columns: ['id', 'email', 'name', 'tier', 'signed_up_at', 'last_active', 'onboarded'] },
				{ name: 'user_deal_stages', rows: null, description: 'Deal pipeline stages per user (saved, diligence, decision, invested, passed)', columns: ['user_id', 'deal_id', 'stage', 'updated_at'] },
				{ name: 'management_companies', rows: null, description: 'Operators / sponsors with track records and contact info', columns: ['id', 'name', 'aum', 'deal_count', 'contact_email', 'website'] },
				{ name: 'portfolio_investments', rows: null, description: 'User investment records with amounts and distributions', columns: ['id', 'user_id', 'deal_id', 'amount_invested', 'distributions_received', 'status'] },
				{ name: 'deal_documents', rows: null, description: 'Pitch decks, PPMs, and DD documents linked to deals', columns: ['id', 'deal_id', 'type', 'url', 'filename'] },
				{ name: 'dd_checklists', rows: null, description: '10-item due diligence checklists per user per deal', columns: ['user_id', 'deal_id', 'item_key', 'completed', 'notes'] },
				{ name: 'deal_qna', rows: null, description: 'Q&A threads on deals', columns: ['id', 'deal_id', 'user_id', 'question', 'answer', 'created_at'] },
				{ name: 'intro_requests', rows: null, description: 'LP-to-GP introduction requests', columns: ['id', 'user_id', 'deal_id', 'status', 'created_at'] },
				{ name: 'buy_box_profiles', rows: null, description: 'User investment criteria from wizard', columns: ['user_id', 'branch', 'asset_classes', 'min_investment', 'target_return'] },
				{ name: 'sec_form_d', rows: null, description: '730K+ SEC Form D filings for market intelligence', columns: ['cik', 'entity_name', 'filing_date', 'total_offering', 'amount_sold'] },
				{ name: 'gdrive_deck_index', rows: null, description: 'Google Drive deck file index matched to deals', columns: ['id', 'file_id', 'deal_id', 'filename', 'matched_at'] },
				{ name: 'user_feedback', rows: null, description: 'Platform feedback submissions', columns: ['id', 'user_id', 'type', 'text', 'rating', 'created_at'] },
				{ name: 'analytics_events', rows: null, description: 'User activity tracking events', columns: ['id', 'user_id', 'event', 'metadata', 'created_at'] },
				{ name: 'operator_outreach', rows: null, description: 'GP outreach pipeline status tracking', columns: ['id', 'company_id', 'status', 'priority', 'contact_email', 'notes'] },
				{ name: 'case_studies', rows: null, description: 'Member success stories and investment case studies', columns: ['id', 'title', 'deal_id', 'user_id', 'content'] },
				{ name: 'weekly_digests', rows: null, description: 'Weekly email digest content and send status', columns: ['id', 'week', 'content', 'sent_at'] },
				{ name: 'ppm_financial_details', rows: null, description: 'Extracted PPM financial terms and fee structures', columns: ['deal_id', 'mgmt_fee', 'carry', 'pref_return', 'waterfall'] },
				{ name: 'share_classes', rows: null, description: 'Deal share class definitions with different terms', columns: ['id', 'deal_id', 'class_name', 'min_investment', 'pref_return'] },
				{ name: 'deal_properties', rows: null, description: 'Physical property assets linked to deals', columns: ['id', 'deal_id', 'address', 'city', 'state', 'units'] },
				{ name: 'background_checks', rows: null, description: 'SEC, FINRA, OFAC, and court check results', columns: ['id', 'entity_name', 'check_type', 'result', 'checked_at'] }
			];

			schemaTables = fallbackSchema.map((table) => {
				const sourceTable = tableAliases[table.name] || table.name;
				return {
					...table,
					rows: counts[sourceTable] ?? null
				};
			});
		} catch (e) { console.error(e); }
		finally { schemaLoading = false; }
	}

	async function loadTransactions() {
		transactionsLoading = true;
		try {
			const result = await adminFetch({ action: 'transaction-logs' });
			if (result.success && result.logs) {
				transactionLogs = result.logs;
			} else {
				// Fall back to deriving from other data
				transactionLogs = [];
			}
		} catch (e) { console.error(e); }
		finally { transactionsLoading = false; }
	}

	async function loadCTAAnalytics(range = ctaAnalyticsRange) {
		ctaAnalyticsRange = range;
		ctaAnalyticsLoading = true;
		ctaAnalyticsError = '';
		try {
			const result = await adminFetch({ action: 'cta-analytics', range });
			if (!result.success) {
				ctaAnalyticsError = result.error || 'Failed to load CTA analytics.';
				ctaAnalytics = null;
				return;
			}
			ctaAnalytics = result;
		} catch (e) {
			ctaAnalyticsError = e.message || 'Failed to load CTA analytics.';
			ctaAnalytics = null;
		} finally {
			ctaAnalyticsLoading = false;
		}
	}

	function triggerGhlSync() {
		adminFetch({ action: 'ghl-sync' }).then(r => {
			alert(r.success ? 'GHL sync triggered!' : 'Sync failed: ' + (r.error || 'Unknown'));
		});
	}

	function toggleReviewTools() {
		showReviewTools = !showReviewTools;
		if (browser) {
			window.localStorage.setItem(reviewToolsStorageKey, showReviewTools ? '1' : '0');
		}
	}

	const filteredFeedback = $derived(
		feedbackFilter === 'all' ? feedbackItems : feedbackItems.filter(f => f.type === feedbackFilter)
	);

	const filteredUsers = $derived.by(() => {
		if (!usersData?.users) return [];
		let list = usersData.users;
		if (userTierFilter !== 'all') {
			list = list.filter(u => (u.tier || u.stage || 'free').toLowerCase() === userTierFilter);
		}
		if (userSearch.trim()) {
			const q = userSearch.toLowerCase().trim();
			list = list.filter(u => (u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q));
		}
		return list;
	});

	function histColor(i) {
		return ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'][i] || '#666';
	}

	function formatTtvValue(metric) {
		if (!metric || metric.median === null || metric.median === undefined) return '--';
		if (metric.median < 1) return `${Math.round(metric.median * 60)} min`;
		if (metric.median < 24) return `${Math.round(metric.median * 10) / 10} hrs`;
		return `${Math.round((metric.median / 24) * 10) / 10} days`;
	}

	function normalizeUsersMetrics(payload) {
		const rawUsers = payload?.users || payload?.userList || [];
		const rawFunnel = payload?.funnel || payload?.funnelSteps || [];
		const rawCohorts = payload?.cohorts || [];
		const rawTtv = payload?.timeToValue || payload?.ttv || [];
		const timeToValue = Array.isArray(rawTtv)
			? rawTtv
			: [
				{ key: 'firstOnboard', label: 'First Onboarding', value: formatTtvValue(rawTtv.firstOnboard), samples: rawTtv.firstOnboard?.samples || 0 },
				{ key: 'firstDealView', label: 'First Deal View', value: formatTtvValue(rawTtv.firstDealView), samples: rawTtv.firstDealView?.samples || 0 },
				{ key: 'firstSave', label: 'First Deal Save', value: formatTtvValue(rawTtv.firstSave), samples: rawTtv.firstSave?.samples || 0 },
				{ key: 'firstCallBook', label: 'First Call Booked', value: formatTtvValue(rawTtv.firstCallBook), samples: rawTtv.firstCallBook?.samples || 0 }
			];

		return {
			...payload,
			funnel: rawFunnel,
			users: rawUsers.map((user) => ({
				...user,
				name: user.name || user.full_name || user.fullName || '',
				views: user.views ?? user.dealsViewed ?? 0,
				saves: user.saves ?? user.dealsSaved ?? 0,
				sessions: user.sessions ?? 0,
				tier: user.tier || 'free'
			})),
			cohorts: rawCohorts.map((cohort) => ({
				...cohort,
				count: cohort.count ?? cohort.signups ?? 0,
				active: cohort.active ?? cohort.activated ?? 0,
				saved: cohort.saved ?? cohort.savedDeal ?? 0,
				call: cohort.call ?? cohort.bookedCall ?? 0
			})),
			timeToValue
		};
	}
</script>

{#if !$isAdmin}
	<div class="loading">Redirecting...</div>
{:else}
<PageContainer className="admin-page ly-page-stack">
	<PageHeader title="Admin Dashboard">
		<div slot="actions" class="topbar-actions">
			<button class="topbar-btn" class:toggle-active={showReviewTools} onclick={toggleReviewTools}>
				{showReviewTools ? 'Hide Review Links' : 'Show Review Links'}
			</button>
			<a href="/onboarding-review" class="topbar-btn">Open Review Launcher</a>
			<a href="https://analytics.google.com/analytics/web/#/p/G-F8B5NMB9J9" target="_blank" rel="noopener" class="topbar-btn">Google Analytics</a>
			<button class="topbar-btn" onclick={() => triggerGhlSync()}>Sync GHL</button>
			<button class="topbar-btn" onclick={() => loadTab(activeTab)}>Refresh</button>
		</div>
		<div slot="secondaryRow" class="tab-bar">
			{#each tabs as tab}
				<button
					class="tab-btn"
					class:active={activeTab === tab}
					onclick={() => switchTab(tab)}
				>
					{tabLabels[tab]}
				</button>
			{/each}
		</div>
	</PageHeader>

	<div class="content">
		{#if showReviewTools}
			<section class="review-tools-card">
				<div class="review-tools-head">
					<div>
						<div class="review-tools-eyebrow">Admin QA</div>
						<div class="section-title">Onboarding Review Links</div>
						<div class="section-desc">This toggle keeps every restored onboarding page one click away inside the admin dashboard. The open state is saved in your browser.</div>
					</div>
					<div class="review-tools-actions">
						<a href="/onboarding-review" class="review-tools-launch">Open full launcher</a>
						<button class="review-tools-dismiss" onclick={toggleReviewTools}>Hide panel</button>
					</div>
				</div>
				<div class="review-tools-groups">
					{#each onboardingReviewGroups as group}
						<div class="review-tools-group">
							<div class="review-tools-group-title">{group.title}</div>
							<div class="review-tools-group-desc">{group.description}</div>
							<div class="review-tools-links">
								{#each group.links as link}
									<a class="review-tools-link" href={link.href}>
										<span>{link.label}</span>
										<code>{link.href}</code>
									</a>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			</section>
		{/if}

		<!-- TAB: Overview -->
		{#if activeTab === 'overview'}
			{#if overviewLoading}
				<div class="loading-msg">Loading dashboard...</div>
			{:else if overviewError}
				<div class="error-msg">Failed to load: {overviewError}</div>
			{:else if northStar}
				<!-- North Star -->
				<div class="north-star-card">
					<div class="ns-label">North Star: Deal Inventory Quality</div>
					<div class="ns-row">
						<div class="ns-big">{northStar.complete100?.toLocaleString() ?? '--'}</div>
						<div class="ns-desc">deals at 100% completeness ({northStar.pct}% of {northStar.totalActive} active deals)</div>
						{#if northStar.prevWeekComplete100 !== undefined}
							{@const diff = northStar.complete100 - northStar.prevWeekComplete100}
							<div class="ns-delta" class:positive={diff >= 0} class:negative={diff < 0}>
								{diff >= 0 ? '+' : ''}{diff} vs last week
							</div>
						{/if}
					</div>
					{#if completeness?.histogram}
						<div class="histogram">
							{#each completeness.histogram as bin, i}
								{@const maxH = Math.max(...completeness.histogram.map(b => b.count), 1)}
								{@const pct = Math.max(Math.round(bin.count / maxH * 100), 4)}
								<div class="hist-bar">
									<div class="hist-val">{bin.count}</div>
									<div class="hist-track"><div class="hist-fill" style="height:{pct}%;background:{histColor(i)}"></div></div>
									<div class="hist-label">{bin.label}</div>
								</div>
							{/each}
						</div>
					{/if}
					<div class="ns-avg">Average completeness: <strong>{northStar.avgCompleteness ?? '--'}%</strong> across all active deals.</div>
				</div>

				<!-- Marketplace Health Cards -->
				{#if marketplace}
					<div class="market-grid">
						{#each [
							{ label: 'LPs', value: marketplace.lps, growth: growthRates.lps, sub: marketplace.lps7d },
							{ label: 'GPs (Operators)', value: marketplace.gps, growth: growthRates.gps, sub: marketplace.gps7d },
							{ label: 'Active Deals', value: marketplace.deals, growth: growthRates.deals, sub: marketplace.deals7d },
							{ label: 'LP:Deal Ratio', value: `${marketplace.lpDealRatio}:1`, growth: null, constraint: marketplace.constraint }
						] as card}
							<div class="market-card">
								<div class="market-label">{card.label}</div>
								<div class="market-value">{typeof card.value === 'number' ? card.value.toLocaleString() : card.value}</div>
								<div class="market-meta">
									{#if card.growth !== null && card.growth !== undefined}
										<span class="growth-badge" class:positive={card.growth >= 0} class:negative={card.growth < 0}>{card.growth >= 0 ? '+' : ''}{card.growth}% WoW</span>
									{/if}
									{#if card.sub > 0}
										<span class="week-badge">+{card.sub} this week</span>
									{/if}
									{#if card.constraint}
										<span class="constraint-badge" class:demand={card.constraint === 'demand'} class:supply={card.constraint === 'supply'} class:balanced={card.constraint === 'balanced'}>
											{card.constraint === 'demand' ? 'Need more LPs' : card.constraint === 'supply' ? 'Need more deals' : 'Balanced'}
										</span>
									{/if}
								</div>
							</div>
						{/each}
					</div>
				{/if}

				<!-- Trend Charts (simple bar representation) -->
				{#if series && weekLabels.length > 0}
					<div class="charts-grid">
						<div class="chart-card">
							<div class="chart-title">Deals + Completeness (8-week)</div>
							<div class="mini-chart">
								{#each weekLabels as label, i}
									{@const maxBar = Math.max(...(series.dealsCumulative || [1]))}
									{@const barPct = Math.max(Math.round(((series.dealsCumulative?.[i] || 0) / maxBar) * 80), 3)}
									<div class="chart-col">
										<div class="chart-line-val">{series.avgCompleteness?.[i] || 0}%</div>
										<div class="chart-bar-wrap"><div class="chart-bar" style="height:{barPct}%;background:#10b981"></div></div>
										<div class="chart-label">{label}</div>
									</div>
								{/each}
							</div>
						</div>
						<div class="chart-card">
							<div class="chart-title">LPs + GPs (8-week)</div>
							<div class="mini-chart">
								{#each weekLabels as label, i}
									{@const maxBar = Math.max(...(series.lpsCumulative || [1]))}
									{@const barPct = Math.max(Math.round(((series.lpsCumulative?.[i] || 0) / maxBar) * 80), 3)}
									<div class="chart-col">
										<div class="chart-line-val">{series.gpsCumulative?.[i] || 0}</div>
										<div class="chart-bar-wrap"><div class="chart-bar" style="height:{barPct}%;background:#3b82f6"></div></div>
										<div class="chart-label">{label}</div>
									</div>
								{/each}
							</div>
						</div>
					</div>
				{/if}

				<!-- Top Missing Fields -->
				{#if completeness?.topMissing}
					<div class="section-card">
						<div class="section-title">Top Data Gaps Across All Deals</div>
						<div class="missing-fields">
							{#each completeness.topMissing as m}
								<div class="missing-tag">
									<span class="missing-name">{m.field}</span>
									<span class="missing-pct" class:high={m.pct >= 70} class:med={m.pct >= 40 && m.pct < 70}>{m.pct}% missing</span>
								</div>
							{:else}
								<div class="muted-text">All fields well-covered across deals.</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Recommendations -->
				{#if recommendations.length > 0}
					<div class="section-card">
						<div class="section-title">This Week's Focus</div>
						<div class="recs-grid">
							{#each recommendations as rec}
								<div class="rec-item" class:high={rec.priority === 'high'} class:medium={rec.priority === 'medium'} class:low={rec.priority === 'low'}>
									<div class="rec-dot"></div>
									<div>
										<div class="rec-title">{rec.title}</div>
										<div class="rec-body">{rec.body}</div>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			{/if}

		<!-- TAB: Users -->
		{:else if activeTab === 'users'}
			{#if usersLoading}
				<div class="loading-msg">Loading user metrics...</div>
			{:else if usersError}
				<div class="error-msg">Failed to load: {usersError}</div>
			{:else if usersData}
				<!-- Activation Funnel -->
				{#if usersData.funnel}
					<div class="section-card">
						<div class="section-title">Activation Funnel</div>
						<div class="funnel">
							{#each usersData.funnel as step}
								<div class="funnel-row">
									<div class="funnel-label">{step.label}</div>
									<div class="funnel-bar-wrap">
										<div class="funnel-bar" style="width:{step.pct}%;background:{step.color || 'var(--primary)'}"></div>
									</div>
									<div class="funnel-count">{step.count}</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Action Lists -->
				{#if usersData.actionLists}
					<div class="three-col">
						{#each usersData.actionLists as list}
							<div class="section-card">
								<div class="section-title">{list.title}</div>
								{#each list.items as item}
									<div class="action-list-item">
										<span class="action-list-email">{item.email}</span>
										<span class="action-list-meta">{item.meta || ''}</span>
									</div>
								{:else}
									<div class="muted-text">None</div>
								{/each}
							</div>
						{/each}
					</div>
				{/if}

				<!-- User Table with Search & Filter -->
				{#if usersData.users}
					<div class="section-card">
						<div class="users-toolbar">
							<div class="section-title">All Users <span class="badge">{filteredUsers.length} of {usersData.users.length}</span></div>
							<div class="users-filters">
								<input
									type="text"
									class="users-search"
									placeholder="Search by email or name..."
									bind:value={userSearch}
								/>
								<div class="users-tier-toggle">
									{#each userTierOptions as option}
										<button
											class="filter-btn tier-filter-btn"
											class:active={userTierFilter === option.value}
											onclick={() => (userTierFilter = option.value)}
										>
											{option.label}
										</button>
									{/each}
								</div>
							</div>
						</div>
						<div class="table-wrap">
							<table>
								<thead>
									<tr>
										<th>Email</th><th>Name</th><th>Tier</th><th>Signed Up</th>
										<th class="center">Onboarded</th><th class="right">Views</th>
										<th class="right">Saves</th><th class="right">Sessions</th><th>Last Active</th>
									</tr>
								</thead>
								<tbody>
									{#each filteredUsers as u}
										<tr>
											<td class="bold">{u.email}</td>
											<td>{u.name || '--'}</td>
											<td>
												<span class="tier-badge" class:free={!u.tier || u.tier === 'free'} class:academy={u.tier === 'academy'} class:alumni={u.tier === 'alumni'}>
													{u.tier || u.stage || 'free'}
												</span>
											</td>
											<td>{u.signedUp || '--'}</td>
											<td class="center">{u.onboarded ? 'Yes' : 'No'}</td>
											<td class="right">{u.views ?? 0}</td>
											<td class="right">{u.saves ?? 0}</td>
											<td class="right">{u.sessions ?? 0}</td>
											<td>{u.lastActive || '--'}</td>
										</tr>
									{:else}
										<tr><td colspan="9" class="muted" style="text-align:center;padding:20px">No users match filters.</td></tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				{/if}

				<!-- Cohort Retention -->
				{#if usersData.cohorts}
					<div class="two-col">
						<div class="section-card">
							<div class="section-title">Time to Value</div>
							{#if usersData.timeToValue}
								{#each usersData.timeToValue as ttv}
									<div class="ttv-row">
										<span class="ttv-label">{ttv.label}</span>
										<span class="ttv-value">{ttv.value}</span>
									</div>
								{/each}
							{:else}
								<div class="muted-text">No time-to-value data yet.</div>
							{/if}
						</div>
						<div class="section-card">
							<div class="section-title">Weekly Signup Cohorts</div>
							<div class="table-wrap">
								<table class="compact">
									<thead>
										<tr><th>Week</th><th class="right">#</th><th class="right">Onb</th><th class="right">Active</th><th class="right">Saved</th><th class="right">Call</th></tr>
									</thead>
									<tbody>
										{#each usersData.cohorts as c}
											<tr><td>{c.week}</td><td class="right">{c.count}</td><td class="right">{c.onboarded}</td><td class="right">{c.active}</td><td class="right">{c.saved}</td><td class="right">{c.call}</td></tr>
										{/each}
									</tbody>
								</table>
							</div>
						</div>
					</div>
				{/if}
			{:else}
				<div class="muted-text">No user data available.</div>
			{/if}

		<!-- TAB: Schema -->
		{:else if activeTab === 'schema'}
			{#if schemaLoading}
				<div class="loading-msg">Loading schema...</div>
			{:else}
				<div class="stats-grid-4">
					<div class="stat-card"><div class="stat-label">Tables</div><div class="stat-value green">{schemaTables.length}</div></div>
					<div class="stat-card"><div class="stat-label">Total Rows</div><div class="stat-value">{schemaTables.reduce((s, t) => s + (t.rows || 0), 0).toLocaleString()}</div></div>
					<div class="stat-card"><div class="stat-label">With Data</div><div class="stat-value">{schemaTables.filter(t => t.rows > 0).length}</div></div>
					<div class="stat-card"><div class="stat-label">Columns Tracked</div><div class="stat-value">{schemaTables.reduce((s, t) => s + (t.columns?.length || 0), 0)}</div></div>
				</div>

				{#each schemaTables as table}
					<div class="schema-table-card">
						<div class="schema-table-header">
							<div class="schema-table-name">{table.name}</div>
							{#if table.rows !== null && table.rows !== undefined}
								<div class="schema-row-count">{table.rows.toLocaleString()} rows</div>
							{/if}
						</div>
						{#if table.description}
							<div class="schema-table-desc">{table.description}</div>
						{/if}
						{#if table.columns && table.columns.length > 0}
							<div class="schema-columns">
								{#each table.columns as col}
									<span class="schema-col-tag">{col}</span>
								{/each}
							</div>
						{/if}
					</div>
				{:else}
					<div class="section-card">
						<div class="muted-text" style="padding:20px 0;text-align:center">No schema data loaded. Click Refresh to fetch.</div>
					</div>
				{/each}
			{/if}

		<!-- TAB: Dev Notes -->
		{:else if activeTab === 'devnotes'}
			<div class="section-title-lg">Development Status</div>
			<div class="section-desc">Internal engineering notes. Last updated: March 22, 2026.</div>

			<div class="stats-grid-4">
				<div class="stat-card"><div class="stat-label">Tables</div><div class="stat-value green">21</div></div>
				<div class="stat-card"><div class="stat-label">API Endpoints</div><div class="stat-value">6</div></div>
				<div class="stat-card"><div class="stat-label">Integrations</div><div class="stat-value">7</div></div>
				<div class="stat-card"><div class="stat-label">Pages</div><div class="stat-value">20+</div></div>
			</div>

			<!-- Working Features -->
			<div class="section-card">
				<div class="section-header-row">
					<span class="dot green"></span>
					<span class="section-title">Working Features</span>
					<span class="count-badge green">35 shipped</span>
				</div>
				<div class="features-grid">
					<div class="features-col">
						<div class="features-group-label">Core Platform</div>
						{#each ['Supabase auth (email+password, JWT, auto-refresh)', 'Sign Up -> Supabase user + GHL contact + tier tags', 'GHL tier gating (free / academy / alumni)', 'Live deals from 21 Supabase tables', 'Deal filtering, search, grid/list views', 'Deal detail with fee benchmarks + social proof', 'Buy Box wizard -> Supabase + GHL sync', 'Deal pipeline (filter -> review -> connect -> decide)', 'DD checklist (10-item, realtime sync)', 'Deal Q&A system', 'Compare tool (side-by-side deal comparison)', 'Debt Fund Explorer with filters'] as f}
							<div class="feature-item">&#10003; {f}</div>
						{/each}
					</div>
					<div class="features-col">
						<div class="features-group-label">Data & Intelligence</div>
						{#each ['730K+ SEC Form D filings (full market data)', 'Market Intel with 3 tabs (SEC / Deal Insights / Stats)', 'AI deal enrichment via Claude (deck/PPM extraction)', 'Background checks (SEC, FINRA, OFAC, courts)', 'Operator directory with profiles + track records', 'Operator outreach pipeline (CRM integration)', 'GDrive deck index (auto-match to deals)'] as f}
							<div class="feature-item">&#10003; {f}</div>
						{/each}
						<div class="features-group-label" style="margin-top:8px">Admin & Growth</div>
						{#each ['Admin Dashboard (7 tabs, consolidated)', 'Growth metrics + WoW trends', 'User analytics (sessions, pageviews, activity)', 'Database schema browser with live row counts', 'View-as-user impersonation', 'Case studies page'] as f}
							<div class="feature-item">&#10003; {f}</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Known Issues + Next Up -->
			<div class="two-col">
				<div class="section-card">
					<div class="section-header-row"><span class="dot yellow"></span><span class="section-title">Known Issues</span></div>
					<div class="issues-list">
						{#each ['GHL -> Supabase sync is login-only', 'Magic link / forgot password not built', 'Weekly digest email kill-switched', 'Mobile swipe feed polish in progress', 'Analytics data stored in localStorage'] as issue}
							<div class="issue-item">&#10007; {issue}</div>
						{/each}
					</div>
				</div>
				<div class="section-card">
					<div class="section-header-row"><span class="dot blue"></span><span class="section-title">Next Up</span></div>
					<div class="issues-list">
						{#each ['Stripe subscription/payment integration', 'Magic link + forgot password', 'Email alerts for new deals matching buy box', 'Weekly digest email (Supabase backend)', 'GP introduction request flow', 'Attribution tracking (intro -> meeting -> investment)', 'Investment memo generation (AI)'] as item}
							<div class="issue-item">&#9744; {item}</div>
						{/each}
					</div>
				</div>
			</div>

			<!-- Architecture -->
			<div class="section-card">
				<div class="section-header-row"><span class="dot purple"></span><span class="section-title">Architecture</span></div>
				<div class="arch-grid">
					<table class="arch-table">
						<tbody>
						<tr><td class="arch-key">Database</td><td>Supabase (PostgreSQL) -- 21 tables</td></tr>
						<tr><td class="arch-key">File Storage</td><td>Supabase Storage (deal-decks bucket)</td></tr>
						<tr><td class="arch-key">Auth</td><td>Supabase Auth (JWT) + GHL tier lookup</td></tr>
						<tr><td class="arch-key">CRM</td><td>GoHighLevel (contacts, tags, custom fields)</td></tr>
						<tr><td class="arch-key">AI</td><td>Claude API (extraction + enrichment)</td></tr>
						<tr><td class="arch-key">SEC Data</td><td>730K+ Form D filings (2008-present)</td></tr>
						</tbody>
					</table>
					<table class="arch-table">
						<tbody>
						<tr><td class="arch-key">Email</td><td>Resend (notifications)</td></tr>
						<tr><td class="arch-key">Automations</td><td>Make.com (deal processing pipelines)</td></tr>
						<tr><td class="arch-key">Hosting</td><td>Vercel (serverless + static)</td></tr>
						<tr><td class="arch-key">Code</td><td><code>Canonical DealFlow repository</code></td></tr>
						<tr><td class="arch-key">Domain</td><td><code>dealflow.growyourcashflow.io</code></td></tr>
						<tr><td class="arch-key">Supabase</td><td>Primary production project (nntzqyufmtypfjpusflm)</td></tr>
						</tbody>
					</table>
				</div>
			</div>

			<!-- Data Sync -->
			<div class="section-card">
				<div class="section-header-row"><span class="dot purple"></span><span class="section-title">Data Sync Architecture</span></div>
				<div class="table-wrap">
					<table>
						<thead><tr><th>Data</th><th>Primary</th><th>Sync To</th><th>Direction</th></tr></thead>
						<tbody>
							<tr><td>Deal Stages</td><td>localStorage</td><td>Supabase</td><td class="blue">Bidirectional</td></tr>
							<tr><td>Portfolio</td><td>localStorage</td><td>Supabase</td><td class="blue">Bidirectional</td></tr>
							<tr><td>Goals</td><td>localStorage</td><td>Supabase + GHL</td><td class="blue">Bidirectional</td></tr>
							<tr><td>Buy Box</td><td>Supabase</td><td>GHL fields</td><td class="green">One-way</td></tr>
							<tr><td>Deals / Sponsors</td><td>Supabase</td><td>--</td><td class="muted">Server only</td></tr>
							<tr><td>Auth / Tier</td><td>Supabase Auth</td><td>GHL tags</td><td class="yellow">GHL -> Supabase (on login)</td></tr>
						</tbody>
					</table>
				</div>
			</div>

		<!-- TAB: Network & Moat -->
		{:else if activeTab === 'network'}
			<!-- Integration Status -->
			<div class="section-card">
				<div class="section-title">Integration Status</div>
				<div class="integrations-grid">
					{#each integrations as ig}
						<div class="integration-card" class:connected={ig.status === 'connected'} class:error={ig.status === 'error'} class:checking={ig.status === 'checking'}>
							<div class="integration-icon">
								{#if ig.icon === 'db'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>
								{:else if ig.icon === 'crm'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
								{:else if ig.icon === 'auto'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
								{:else if ig.icon === 'drive'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
								{:else if ig.icon === 'email'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
								{/if}
							</div>
							<div class="integration-info">
								<div class="integration-name">{ig.name}</div>
								<div class="integration-desc">{ig.desc}</div>
							</div>
							<div class="integration-status">
								<span class="status-dot" class:connected={ig.status === 'connected'} class:error={ig.status === 'error'} class:checking={ig.status === 'checking'}></span>
								<span class="status-text">{ig.status === 'connected' ? 'Connected' : ig.status === 'error' ? 'Error' : ig.status === 'checking' ? 'Checking...' : 'Unknown'}</span>
							</div>
							{#if ig.detail}
								<div class="integration-detail">{ig.detail}</div>
							{/if}
						</div>
					{/each}
				</div>
			</div>

			<!-- Thesis -->
			<div class="north-star-card">
				<div class="ns-label">Moat Thesis</div>
				<div class="thesis-title">The moat is the people, not the software.</div>
				<div class="thesis-desc">Every intro made, every DD checklist completed, every buy box configured creates proprietary data a competitor can't replicate. The network compounds -- more LPs attract more GPs, which attract more LPs.</div>
			</div>

			<!-- Intro Stats -->
			<div class="stats-grid-4">
				<div class="stat-card"><div class="stat-label">Total Intros</div><div class="stat-value green">{introStats.total}</div></div>
				<div class="stat-card"><div class="stat-label">Unique GPs</div><div class="stat-value">{introStats.uniqueGPs}</div></div>
				<div class="stat-card"><div class="stat-label">Unique LPs</div><div class="stat-value">{introStats.uniqueLPs}</div></div>
				<div class="stat-card"><div class="stat-label">This Month</div><div class="stat-value">{introStats.thisMonth}</div></div>
			</div>

			<!-- Introduction Request Log -->
			<div class="section-card">
				<div class="section-header-row">
					<span class="dot green"></span>
					<span class="section-title">Introduction Requests</span>
				</div>
				{#if introRequests.length > 0}
					<div class="table-wrap">
						<table>
							<thead>
								<tr><th>LP</th><th>Deal</th><th>GP / Operator</th><th>Status</th><th>Date</th></tr>
							</thead>
							<tbody>
								{#each introRequests as req}
									<tr>
										<td class="bold">{req.lpEmail || req.lp || '--'}</td>
										<td>{req.dealName || req.deal || '--'}</td>
										<td>{req.gpName || req.gp || '--'}</td>
										<td>
											<span class="intro-status" class:pending={req.status === 'pending'} class:completed={req.status === 'completed'} class:declined={req.status === 'declined'}>
												{req.status || 'pending'}
											</span>
										</td>
										<td class="muted">{req.date || req.createdAt || '--'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="muted-text" style="padding:20px 0;text-align:center">No introduction requests tracked yet. When LPs request intros from deal pages, they will appear here.</div>
				{/if}
			</div>

			<!-- Network Flywheel -->
			<div class="section-card">
				<div class="section-header-row"><span class="dot purple"></span><span class="section-title">Network Flywheel</span></div>
				<div class="flywheel">
					{#each [
						{ label: 'More\nLPs', bg: 'linear-gradient(135deg,var(--primary),#2C6E49)' },
						{ label: 'More\nIntros', bg: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' },
						{ label: 'GPs Get\nWarm Leads', bg: 'linear-gradient(135deg,#f59e0b,#d97706)' },
						{ label: 'GPs List\nMore Deals', bg: 'linear-gradient(135deg,#8b5cf6,#6d28d9)' },
						{ label: 'More LPs\nJoin', bg: 'linear-gradient(135deg,var(--primary),#2C6E49)' },
						{ label: 'AI Agents\nFind Us', bg: 'linear-gradient(135deg,#ec4899,#be185d)' }
					] as node, i}
						{#if i > 0}<div class="flywheel-arrow">&rarr;</div>{/if}
						<div class="flywheel-node" style="background:{node.bg}">{@html node.label.replace('\n', '<br>')}</div>
					{/each}
				</div>
			</div>

			<!-- 6 Moat Pillars -->
			<div class="pillars-grid">
				{#each [
					{ num: 1, title: 'LP Network Lock-In', color: 'var(--primary)', desc: 'More LPs means more intro requests. GPs get warm leads for free, so they list more deals.', track: 'LP signups, active users, intros/month' },
					{ num: 2, title: 'GP Recruitment via Data', color: '#3b82f6', desc: 'Show GPs: "We made X intros that led to $Y in capital deployed." Prove value with attribution data.', track: 'capital attributed, GP conversion rate' },
					{ num: 3, title: 'Data Moat', color: '#f59e0b', desc: 'Every deal reviewed creates proprietary data. A competitor would need to replicate the database AND the community.', track: 'deals in DB, DD completions, buy box profiles' },
					{ num: 4, title: 'Academy as Trust Engine', color: '#8b5cf6', desc: 'Academy members get intros and deal access. Non-members see deals but can\'t act.', track: 'free-to-paid conversion, Academy retention' },
					{ num: 5, title: 'AI Agent Distribution', color: '#ec4899', desc: 'When AI agents search for deals, they hit our API. Every query trains our models and deepens the data moat.', track: 'API calls/day, unique agent keys, revenue per query' },
					{ num: 6, title: 'Proprietary Intelligence Layer', color: '#06b6d4', desc: 'AI can scrape public data but can\'t replicate our DD checklists, LP sentiment, or fund performance data.', track: 'DD completions, sentiment signals, performance data points' }
				] as pillar}
					<div class="pillar-card" style="border-left:4px solid {pillar.color}">
						<div class="pillar-header"><span class="pillar-num" style="color:{pillar.color}">{pillar.num}</span><span class="pillar-title">{pillar.title}</span></div>
						<div class="pillar-desc">{pillar.desc}</div>
						<div class="pillar-track">TRACK: {pillar.track}</div>
					</div>
				{/each}
			</div>

			<!-- Moat Scorecard -->
			<div class="section-card">
				<div class="section-header-row"><span class="dot yellow"></span><span class="section-title">Moat Scorecard</span></div>
				<div class="table-wrap">
					<table>
						<thead><tr><th>Metric</th><th class="center">Current</th><th class="center">Target</th><th>Progress</th><th>Why It Matters</th></tr></thead>
						<tbody>
							{#each [
								{ metric: 'Active LPs', current: moatMetrics.lps ?? '--', target: 500, color: 'var(--primary)', why: 'Critical mass for GP interest' },
								{ metric: 'GP Partners', current: moatMetrics.gps ?? '--', target: 50, color: '#3b82f6', why: 'Supply side of marketplace' },
								{ metric: 'Intros / Month', current: moatMetrics.intros ?? '--', target: 25, color: '#f59e0b', why: 'Engagement proof for GPs' },
								{ metric: 'Capital Attributed', current: moatMetrics.capital ? `$${(moatMetrics.capital / 1e6).toFixed(1)}M` : '$0', target: '$5M', color: '#8b5cf6', why: 'Proves platform value' },
								{ metric: 'Deals in Database', current: moatMetrics.deals ?? '--', target: 500, color: 'var(--primary)', why: 'Content moat depth' }
							] as row}
								<tr>
									<td class="bold">{row.metric}</td>
									<td class="center bold">{row.current}</td>
									<td class="center muted">{row.target}</td>
									<td>
										<div class="progress-bar">
											<div class="progress-fill" style="width:{typeof row.current === 'number' ? Math.min(100, Math.round(row.current / (typeof row.target === 'number' ? row.target : 1) * 100)) : 0}%;background:{row.color}"></div>
										</div>
									</td>
									<td class="muted">{row.why}</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			</div>

		<!-- TAB: Transactions -->
		{:else if activeTab === 'transactions'}
			<!-- Recent Transaction / Event Log -->
			<div class="section-card">
				<div class="section-header-row">
					<span class="dot green"></span>
					<span class="section-title">Recent Platform Events</span>
					{#if transactionsLoading}
						<span class="muted-text" style="margin-left:auto">Loading...</span>
					{/if}
				</div>
				{#if transactionLogs.length > 0}
					<div class="table-wrap">
						<table>
							<thead>
								<tr><th>Event</th><th>User</th><th>Deal</th><th>Details</th><th>Date</th></tr>
							</thead>
							<tbody>
								{#each transactionLogs as log}
									<tr>
										<td>
											<span class="event-type-badge" class:signup={log.event === 'signup'} class:save={log.event === 'deal_save'} class:intro={log.event === 'intro_request'} class:invest={log.event === 'investment'} class:view={log.event === 'deck_view'}>
												{log.event === 'signup' ? 'Signup' : log.event === 'deal_save' ? 'Deal Saved' : log.event === 'intro_request' ? 'Intro Request' : log.event === 'investment' ? 'Investment' : log.event === 'deck_view' ? 'Deck View' : log.event || 'Event'}
											</span>
										</td>
										<td class="bold">{log.email || log.user || '--'}</td>
										<td>{log.dealName || log.deal || '--'}</td>
										<td class="muted">{log.details || ''}</td>
										<td class="muted">{log.date || log.createdAt || '--'}</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{:else}
					<div class="muted-text" style="padding:16px 0;text-align:center">
						{transactionsLoading ? 'Loading event log...' : 'No transaction events recorded yet. Events like signups, deal saves, intro requests, and investments will appear here.'}
					</div>
				{/if}
			</div>

			<div class="section-desc">Roadmap to facilitate capital flow and capture transaction revenue.</div>

			<!-- Phase Progress -->
			<div class="section-card">
				<div class="phase-progress">
					{#each [
						{ num: 1, label: 'CURRENT', active: true },
						{ num: 2, label: '6-12 MO', active: false },
						{ num: 3, label: '12-24 MO', active: false },
						{ num: 4, label: '24+ MO', active: false }
					] as phase}
						<div class="phase-step" class:active={phase.active}>
							<div class="phase-circle" class:active={phase.active}>{phase.num}</div>
							<div class="phase-label">{phase.label}</div>
						</div>
					{/each}
				</div>
				<div class="phase-names">
					<div class="phase-name active">Intro & Attribution</div>
					<div class="phase-name">Placement Agent</div>
					<div class="phase-name">Transaction Layer</div>
					<div class="phase-name">Secondary Market</div>
				</div>
			</div>

			<!-- Phase Cards -->
			{#each [
				{ num: 1, title: 'Intro & Attribution', status: 'IN PROGRESS', color: 'var(--primary)', what: 'Facilitate LP-to-GP introductions. Track which intros lead to investments.', revenue: 'None directly. Building the data foundation.', items: ['Request Introduction button on deal pages', 'Track intro requests (analytics events)', 'Follow-up: ask LP "did you invest?"', 'Attribution dashboard (intros -> meetings -> $)', 'GP report: "GYC sent you X qualified LPs"'], done: [true, true, false, false, false] },
				{ num: 2, title: 'Placement Agent', status: '6-12 MONTHS', color: 'var(--border)', what: 'Become a registered placement agent. Take a fee for capital raised.', revenue: '1-2% placement fee. $500K-2M/yr potential.', items: ['Legal: BD registration / RIA considerations', 'GP agreements: formal placement terms', '"Invest Now" button + commitment tracking', 'Capital pipeline (soft circle -> funded)', 'Automated LP accreditation verification'], done: [false, false, false, false, false] },
				{ num: 3, title: 'Transaction Layer', status: '12-24 MONTHS', color: 'var(--border)', what: 'Facilitate actual money movement. Payment processing, subscription docs.', revenue: 'Transaction fees + platform fees. $1-5M/yr potential.', items: ['Digital subscription agreements (e-sign)', 'ACH / wire payment facilitation', 'Capital call management for GPs', 'Distribution tracking & reporting', 'K-1 document distribution'], done: [false, false, false, false, false] },
				{ num: 4, title: 'Secondary Market & Tokenization', status: '24+ MONTHS', color: 'var(--border)', what: 'Enable LP-to-LP secondary trades. Tokenize LP interests on-chain.', revenue: 'Transaction fees on secondary trades. $5-20M/yr potential.', items: ['Secondary marketplace for LP interests', 'Price discovery (NAV, auction, negotiated)', 'ROFR workflow for GPs', 'ERC-1400 security token tokenization', 'ATS registration'], done: [false, false, false, false, false] }
			] as phase}
				<div class="phase-card" style="border-left:4px solid {phase.color}">
					<div class="phase-card-header">
						<span class="phase-num" style="color:{phase.num === 1 ? 'var(--primary)' : 'var(--text-muted)'}">Phase {phase.num}</span>
						<span class="phase-title">{phase.title}</span>
						<span class="phase-status" class:active={phase.num === 1}>{phase.status}</span>
					</div>
					<div class="phase-card-body">
						<div><div class="phase-col-label">What</div><div class="phase-col-text">{phase.what}</div></div>
						<div><div class="phase-col-label">Revenue</div><div class="phase-col-text">{phase.revenue}</div></div>
						<div><div class="phase-col-label">Checklist</div>
							{#each phase.items as item, i}
								<div class="phase-checklist-item" class:done={phase.done[i]}>{phase.done[i] ? '&#10003;' : '&#9744;'} {item}</div>
							{/each}
						</div>
					</div>
				</div>
			{/each}

			<!-- Revenue Summary -->
			<div class="north-star-card" style="margin-top:24px">
				<div class="ns-label">Revenue Model Evolution</div>
				<div class="revenue-grid">
					{#each [
						{ label: 'Academy + Fund', value: '$200K', unit: '/yr' },
						{ label: 'Placement', value: '$500K-2M', unit: '/yr' },
						{ label: 'Transactions', value: '$1-5M', unit: '/yr' },
						{ label: 'Secondary', value: '$5-20M', unit: '/yr' }
					] as rev}
						<div class="revenue-item">
							<div class="revenue-label">{rev.label}</div>
							<div class="revenue-value">{rev.value}</div>
							<div class="revenue-unit">{rev.unit}</div>
						</div>
					{/each}
				</div>
			</div>

		<!-- TAB: Feedback -->
		{:else if activeTab === 'feedback'}
			<div class="section-desc">User-submitted feedback from across the platform. Review bugs, feature requests, and questions.</div>

			<!-- Feedback Summary -->
			{#if feedbackItems.length > 0}
				{@const avgRating = feedbackItems.filter(f => f.rating).reduce((s, f) => s + f.rating, 0) / Math.max(1, feedbackItems.filter(f => f.rating).length)}
				<div class="stats-grid-4">
					<div class="stat-card"><div class="stat-label">Total Feedback</div><div class="stat-value">{feedbackItems.length}</div></div>
					<div class="stat-card"><div class="stat-label">Avg Rating</div><div class="stat-value green">{avgRating ? avgRating.toFixed(1) : '--'}</div></div>
					<div class="stat-card"><div class="stat-label">Bugs</div><div class="stat-value" style="color:#ef4444">{feedbackItems.filter(f => f.type === 'bug').length}</div></div>
					<div class="stat-card"><div class="stat-label">Feature Requests</div><div class="stat-value" style="color:#3b82f6">{feedbackItems.filter(f => f.type === 'feature').length}</div></div>
				</div>
			{/if}

			<div class="section-card">
				<div class="section-header-row">
					<span class="section-title">User Feedback</span>
					<span class="badge">{filteredFeedback.length}</span>
				</div>
				<div class="feedback-filters">
					{#each feedbackTypes as type}
						<button class="filter-btn" class:active={feedbackFilter === type} onclick={() => feedbackFilter = type}>
							{type === 'all' ? 'All' : type === 'bug' ? 'Bugs' : type === 'feature' ? 'Features' : 'Questions'}
						</button>
					{/each}
				</div>
				{#if filteredFeedback.length === 0}
					<div class="muted-text" style="padding:20px 0">No feedback items yet.</div>
				{:else}
					{#each filteredFeedback as item}
						<div class="feedback-item">
							<div class="feedback-type" class:bug={item.type === 'bug'} class:feature={item.type === 'feature'} class:question={item.type === 'question'}>{item.type}</div>
							<div class="feedback-content">
								<div class="feedback-text">{item.text}</div>
								<div class="feedback-bottom">
									{#if item.rating}
										<div class="feedback-stars">
											{#each [1, 2, 3, 4, 5] as star}
												<span class="star" class:filled={star <= item.rating}>&#9733;</span>
											{/each}
										</div>
									{/if}
									<div class="feedback-meta">{item.email || 'Anonymous'} -- {item.date || item.createdAt || '--'}</div>
								</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{:else if activeTab === 'ctaAnalytics'}
			<div class="section-desc">Deal Flow utility CTA performance across compare, deck, and introduction actions.</div>
			<div class="cta-toolbar">
				<div class="users-tier-toggle">
					{#each [
						{ value: '7d', label: 'Last 7 Days' },
						{ value: '30d', label: 'Last 30 Days' },
						{ value: 'all', label: 'All Time' }
					] as option}
						<button
							class="filter-btn tier-filter-btn"
							class:active={ctaAnalyticsRange === option.value}
							onclick={() => loadCTAAnalytics(option.value)}
						>
							{option.label}
						</button>
					{/each}
				</div>
			</div>

			{#if ctaAnalyticsLoading}
				<div class="loading-msg">Loading CTA analytics...</div>
			{:else if ctaAnalyticsError}
				<div class="error-msg">Failed to load: {ctaAnalyticsError}</div>
			{:else if ctaAnalytics?.overview}
				<div class="section-card">
					<div class="section-header-row">
						<span class="section-title">Daily Trend</span>
						<span class="badge">
							{ctaAnalytics.range === 'all' ? 'Last 30 active days' : ctaAnalytics.range === '7d' ? 'Last 7 days' : 'Last 30 days'}
						</span>
					</div>
					{#if (ctaAnalytics.dailyTrend || []).length > 0}
						{@const maxTrendImpressions = Math.max(...(ctaAnalytics.dailyTrend || []).map((row) => row.impressions), 1)}
						{@const maxTrendClicks = Math.max(...(ctaAnalytics.dailyTrend || []).map((row) => row.clicks), 1)}
						<div class="cta-trend-chart">
							{#each ctaAnalytics.dailyTrend || [] as row}
								<div class="cta-trend-col">
									<div class="cta-trend-meta">{row.impressions} / {row.clicks}</div>
									<div class="cta-trend-bars">
										<div
											class="cta-trend-bar impressions"
											style={`height:${Math.max(Math.round((row.impressions / maxTrendImpressions) * 100), row.impressions > 0 ? 8 : 0)}%`}
											title={`${row.label}: ${row.impressions} impressions`}
										></div>
										<div
											class="cta-trend-bar clicks"
											style={`height:${Math.max(Math.round((row.clicks / maxTrendClicks) * 100), row.clicks > 0 ? 8 : 0)}%`}
											title={`${row.label}: ${row.clicks} clicks`}
										></div>
									</div>
									<div class="cta-trend-date">{row.label}</div>
									<div class="cta-trend-ctr">{row.ctr}% CTR</div>
								</div>
							{/each}
						</div>
						<div class="cta-trend-legend">
							<span><span class="cta-legend-dot impressions"></span>Impressions</span>
							<span><span class="cta-legend-dot clicks"></span>Clicks</span>
						</div>
					{:else}
						<div class="muted-text">No CTA trend data yet for this range.</div>
					{/if}
				</div>

				<div class="stats-grid-4 cta-stats-grid">
					<div class="stat-card"><div class="stat-label">Impressions</div><div class="stat-value">{ctaAnalytics.overview.impressions}</div></div>
					<div class="stat-card"><div class="stat-label">Clicks</div><div class="stat-value">{ctaAnalytics.overview.clicks}</div></div>
					<div class="stat-card"><div class="stat-label">CTR</div><div class="stat-value green">{ctaAnalytics.overview.ctr}%</div></div>
					<div class="stat-card"><div class="stat-label">Intro Opens</div><div class="stat-value">{ctaAnalytics.overview.requestIntroOpens}</div></div>
					<div class="stat-card"><div class="stat-label">Deck Clicks</div><div class="stat-value">{ctaAnalytics.overview.viewDeckClicks}</div></div>
					<div class="stat-card"><div class="stat-label">No Deck Impr.</div><div class="stat-value">{ctaAnalytics.overview.disabledImpressions}</div></div>
				</div>

				<div class="two-col cta-analytics-grid">
					<div class="section-card">
						<div class="section-title">CTR by Pipeline Stage</div>
						<div class="table-wrap">
							<table class="compact">
								<thead>
									<tr>
										<th>Stage</th>
										<th class="right">Impr.</th>
										<th class="right">Clicks</th>
										<th class="right">CTR</th>
										<th class="right">Disabled</th>
									</tr>
								</thead>
								<tbody>
									{#each ctaAnalytics.byStage || [] as row}
										<tr>
											<td class="bold">{row.label.charAt(0).toUpperCase() + row.label.slice(1)}</td>
											<td class="right">{row.impressions}</td>
											<td class="right">{row.clicks}</td>
											<td class="right">{row.ctr}%</td>
											<td class="right">{row.disabledImpressions}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="section-card">
						<div class="section-title">CTR by Utility Action</div>
						<div class="table-wrap">
							<table class="compact">
								<thead>
									<tr>
										<th>Action</th>
										<th class="right">Impr.</th>
										<th class="right">Clicks</th>
										<th class="right">CTR</th>
										<th class="right">Intro Opens</th>
										<th class="right">Deck Clicks</th>
									</tr>
								</thead>
								<tbody>
									{#each ctaAnalytics.byAction || [] as row}
										<tr>
											<td class="bold">{row.label}</td>
											<td class="right">{row.impressions}</td>
											<td class="right">{row.clicks}</td>
											<td class="right">{row.ctr}%</td>
											<td class="right">{row.requestIntroOpens}</td>
											<td class="right">{row.viewDeckClicks}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				<div class="two-col cta-analytics-grid">
					<div class="section-card">
						<div class="section-title">Breakdown by View Mode</div>
						<div class="table-wrap">
							<table class="compact">
								<thead>
									<tr>
										<th>View</th>
										<th class="right">Impr.</th>
										<th class="right">Clicks</th>
										<th class="right">CTR</th>
									</tr>
								</thead>
								<tbody>
									{#each ctaAnalytics.byViewMode || [] as row}
										<tr>
											<td class="bold">{row.label.charAt(0).toUpperCase() + row.label.slice(1)}</td>
											<td class="right">{row.impressions}</td>
											<td class="right">{row.clicks}</td>
											<td class="right">{row.ctr}%</td>
										</tr>
									{:else}
										<tr><td colspan="4" class="muted" style="text-align:center;padding:20px;">No view mode data yet.</td></tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>

					<div class="section-card">
						<div class="section-title">Deck Availability</div>
						<div class="table-wrap">
							<table class="compact">
								<thead>
									<tr>
										<th>Bucket</th>
										<th class="right">Impr.</th>
										<th class="right">Clicks</th>
										<th class="right">CTR</th>
										<th class="right">Disabled</th>
									</tr>
								</thead>
								<tbody>
									{#each ctaAnalytics.byDeckAvailability || [] as row}
										<tr>
											<td class="bold">{row.label}</td>
											<td class="right">{row.impressions}</td>
											<td class="right">{row.clicks}</td>
											<td class="right">{row.ctr}%</td>
											<td class="right">{row.disabledImpressions}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
					</div>
				</div>

				<div class="section-card">
					<div class="section-header-row">
						<span class="section-title">Recent CTA Events</span>
						<span class="badge">{ctaAnalytics.recentEvents?.length || 0}</span>
					</div>
					<div class="table-wrap">
						<table class="compact">
							<thead>
								<tr>
									<th>Timestamp</th>
									<th>Deal</th>
									<th>Stage</th>
									<th>Action</th>
									<th>Label</th>
									<th>Role</th>
									<th>View</th>
									<th>Event</th>
								</tr>
							</thead>
							<tbody>
								{#each ctaAnalytics.recentEvents || [] as row}
									<tr>
										<td>{row.timestamp ? new Date(row.timestamp).toLocaleString() : '--'}</td>
										<td class="bold">{row.deal}</td>
										<td>{row.stage}</td>
										<td>{row.action}</td>
										<td>{row.label || '--'}</td>
										<td>{row.userRole || '--'}</td>
										<td>{row.viewMode}</td>
										<td class="muted">{row.event}</td>
									</tr>
								{:else}
									<tr><td colspan="8" class="muted" style="text-align:center;padding:20px;">No CTA events recorded yet.</td></tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			{:else}
				<div class="muted-text">No CTA analytics available yet.</div>
			{/if}
		{/if}
	</div>
</PageContainer>
{/if}

<style>
	.admin-page { min-height: 100vh; }
	.topbar-actions { display: flex; gap: 8px; flex-wrap: wrap; }
	.topbar-btn { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 6px 14px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
	.topbar-btn:hover { border-color: var(--primary); color: var(--primary); }
	.topbar-btn.toggle-active { background: rgba(81, 190, 123, 0.14); border-color: rgba(81, 190, 123, 0.36); color: var(--text-dark); }
	.content { min-width: 0; max-width: 1100px; }

	/* Tab bar */
	.tab-bar {
		display: flex;
		gap: 8px;
		margin-bottom: 24px;
		padding: 6px;
		background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,250,251,0.94));
		border: 1px solid rgba(31, 81, 89, 0.12);
		border-radius: 18px;
		box-shadow: 0 14px 32px rgba(16, 37, 42, 0.06);
		overflow-x: auto;
		scrollbar-width: none;
	}
	.tab-bar::-webkit-scrollbar { display: none; }
	.tab-btn {
		flex: 0 0 auto;
		min-width: max-content;
		padding: 11px 16px;
		border: 1px solid transparent;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.2px;
		cursor: pointer;
		transition: all 0.18s ease;
		background: transparent;
		color: var(--text-secondary);
		white-space: nowrap;
	}
	.tab-btn.active {
		background: linear-gradient(135deg, #1f5159, #10252a);
		border-color: rgba(31, 81, 89, 0.3);
		color: #fff;
		box-shadow: 0 10px 22px rgba(16, 37, 42, 0.16);
	}
	.tab-btn:hover:not(.active) {
		background: rgba(81, 190, 123, 0.08);
		color: var(--text-dark);
	}

	/* Loading */
	.loading-msg { text-align: center; padding: 40px; color: var(--text-muted); font-size: 13px; }
	.error-msg { text-align: center; padding: 40px; color: #ef4444; font-size: 13px; }
	.loading { display: flex; align-items: center; justify-content: center; min-height: 60vh; color: var(--text-muted); }
	.muted-text { color: var(--text-muted); font-size: 12px; }

	/* North Star */
	.north-star-card { background: linear-gradient(135deg, rgba(81,190,123,0.08), rgba(81,190,123,0.02)); border: 1px solid rgba(81,190,123,0.2); border-radius: 12px; padding: 24px 28px; margin-bottom: 24px; }
	.ns-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary); margin-bottom: 8px; }
	.ns-row { display: flex; align-items: baseline; gap: 16px; flex-wrap: wrap; }
	.ns-big { font-family: var(--font-ui); font-size: 42px; font-weight: 800; color: var(--text-dark); }
	.ns-desc { font-size: 14px; color: var(--text-secondary); }
	.ns-delta { font-family: var(--font-ui); font-size: 13px; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-left: auto; }
	.ns-delta.positive { background: rgba(81,190,123,0.12); color: #10b981; }
	.ns-delta.negative { background: rgba(239,68,68,0.12); color: #ef4444; }
	.ns-avg { font-size: 12px; color: var(--text-muted); margin-top: 10px; }

	/* Histogram */
	.histogram { margin-top: 14px; display: flex; gap: 6px; align-items: center; }
	.hist-bar { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 4px; }
	.hist-val { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-dark); }
	.hist-track { width: 100%; height: 40px; background: var(--bg-cream); border-radius: 4px; overflow: hidden; display: flex; align-items: flex-end; }
	.hist-fill { width: 100%; border-radius: 4px; }
	.hist-label { font-family: var(--font-ui); font-size: 10px; color: var(--text-muted); white-space: nowrap; }

	/* Market cards */
	.market-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 14px; margin-bottom: 24px; }
	.market-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; }
	.market-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); }
	.market-value { font-family: var(--font-ui); font-size: 28px; font-weight: 800; color: var(--text-dark); margin-top: 4px; }
	.market-meta { margin-top: 6px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
	.growth-badge { font-size: 11px; font-weight: 700; padding: 2px 8px; border-radius: 12px; }
	.growth-badge.positive { color: #10b981; background: rgba(81,190,123,0.1); }
	.growth-badge.negative { color: #ef4444; background: rgba(239,68,68,0.1); }
	.week-badge { font-size: 10px; font-weight: 600; color: var(--primary); }
	.constraint-badge { font-weight: 700; font-size: 11px; }
	.constraint-badge.demand { color: #ef4444; }
	.constraint-badge.supply { color: #f59e0b; }
	.constraint-badge.balanced { color: #10b981; }

	/* Charts */
	.charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 24px; }
	.chart-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; }
	.chart-title { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
	.mini-chart { display: flex; align-items: flex-end; gap: 3px; height: 140px; }
	.chart-col { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%; }
	.chart-line-val { font-family: var(--font-ui); font-size: 9px; font-weight: 600; color: var(--text-muted); margin-bottom: 2px; }
	.chart-bar-wrap { width: 100%; height: 80%; display: flex; align-items: flex-end; justify-content: center; }
	.chart-bar { width: 70%; max-width: 36px; border-radius: 3px 3px 0 0; opacity: 0.7; }
	.chart-label { font-family: var(--font-ui); font-size: 9px; color: var(--text-muted); margin-top: 3px; white-space: nowrap; }

	/* Section cards */
	.section-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
	.section-title { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 14px; }
	.section-title-lg { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.section-desc { font-size: 13px; color: var(--text-secondary); margin-bottom: 20px; }
	.review-tools-card {
		background: linear-gradient(180deg, rgba(81, 190, 123, 0.08), rgba(255, 255, 255, 0.98));
		border: 1px solid rgba(81, 190, 123, 0.22);
		border-radius: 20px;
		padding: 22px;
		margin-bottom: 18px;
		box-shadow: 0 12px 30px rgba(15, 23, 42, 0.06);
	}
	.review-tools-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
	}
	.review-tools-eyebrow {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--primary);
		margin-bottom: 6px;
	}
	.review-tools-actions { display: flex; gap: 10px; flex-wrap: wrap; }
	.review-tools-launch,
	.review-tools-dismiss {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 10px 14px;
		border-radius: 999px;
		border: 1px solid var(--border);
		background: var(--bg-card);
		color: var(--text-dark);
		text-decoration: none;
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}
	.review-tools-launch {
		background: var(--primary);
		border-color: var(--primary);
		color: white;
	}
	.review-tools-groups { display: grid; gap: 16px; }
	.review-tools-group {
		background: rgba(255, 255, 255, 0.78);
		border: 1px solid var(--border);
		border-radius: 16px;
		padding: 18px;
	}
	.review-tools-group-title { font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.review-tools-group-desc { font-size: 14px; color: var(--text-secondary); margin-top: 6px; }
	.review-tools-links {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 10px;
		margin-top: 14px;
	}
	.review-tools-link {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 12px 14px;
		border-radius: 14px;
		border: 1px solid var(--border);
		background: rgba(247, 249, 250, 0.95);
		color: var(--text-dark);
		text-decoration: none;
	}
	.review-tools-link:hover { border-color: rgba(81, 190, 123, 0.45); background: rgba(255, 255, 255, 1); }
	.review-tools-link span { font-size: 14px; font-weight: 700; }
	.review-tools-link code {
		font-size: 12px;
		line-height: 1.45;
		color: var(--text-muted);
		word-break: break-word;
	}
	.section-header-row { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; }

	/* Missing fields */
	.missing-fields { display: flex; flex-wrap: wrap; gap: 8px; }
	.missing-tag { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: var(--bg-cream); border: 1px solid var(--border); border-radius: 6px; }
	.missing-name { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark); }
	.missing-pct { font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-secondary); }
	.missing-pct.high { color: #ef4444; }
	.missing-pct.med { color: #f59e0b; }

	/* Recs */
	.recs-grid { display: grid; gap: 10px; }
	.rec-item { padding: 14px 16px; border-radius: 8px; display: flex; gap: 10px; align-items: flex-start; }
	.rec-item.high { background: rgba(239,68,68,0.06); border: 1px solid rgba(239,68,68,0.15); }
	.rec-item.medium { background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.15); }
	.rec-item.low { background: rgba(81,190,123,0.06); border: 1px solid rgba(81,190,123,0.15); }
	.rec-dot { width: 8px; height: 8px; border-radius: 50%; margin-top: 5px; flex-shrink: 0; }
	.rec-item.high .rec-dot { background: #ef4444; }
	.rec-item.medium .rec-dot { background: #f59e0b; }
	.rec-item.low .rec-dot { background: var(--primary); }
	.rec-title { font-family: var(--font-ui); font-weight: 700; font-size: 13px; color: var(--text-dark); margin-bottom: 4px; }
	.rec-body { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

	/* Tables */
	.table-wrap { overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; font-family: var(--font-body); font-size: 12px; }
	thead tr { border-bottom: 2px solid var(--border); }
	th { text-align: left; padding: 10px 12px; font-family: var(--font-ui); font-weight: 600; color: var(--text-muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
	td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--text-secondary); }
	.center { text-align: center; }
	.right { text-align: right; }
	.bold { font-weight: 600; color: var(--text-dark); }
	.muted { color: var(--text-muted); }
	.blue { color: #3b82f6; }
	.green { color: var(--primary); }
	.yellow { color: #f59e0b; }
	table.compact { font-size: 11px; }
	table.compact th, table.compact td { padding: 6px 8px; }

	/* Two column */
	.two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 20px; }
	.cta-analytics-grid { align-items: start; }

	/* Stats */
	.stats-grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
	.cta-stats-grid { grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
	.stat-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px; text-align: center; }
	.stat-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
	.stat-value { font-size: 22px; font-weight: 800; color: var(--text-dark); }
	.stat-value.green { color: var(--primary); }

	/* Badge */
	.badge { font-size: 11px; color: var(--text-muted); font-weight: 400; }
	.count-badge { margin-left: auto; font-size: 10px; font-weight: 700; padding: 2px 10px; border-radius: 10px; }
	.count-badge.green { color: #22c55e; background: rgba(34,197,94,0.1); }

	/* Dot */
	.dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
	.dot.green { background: #22c55e; }
	.dot.yellow { background: #f59e0b; }
	.dot.blue { background: #3b82f6; }
	.dot.purple { background: #8b5cf6; }

	/* Features */
	.features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; padding: 16px 20px; }
	.features-col { font-size: 12px; color: var(--text-secondary); line-height: 2.2; }
	.features-group-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
	.feature-item { color: var(--text-secondary); }
	.issues-list { font-size: 12px; color: var(--text-secondary); line-height: 2.2; padding: 16px 20px; }
	.issue-item { }

	/* Architecture */
	.arch-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
	.arch-table { font-size: 12px; color: var(--text-secondary); width: 100%; border-collapse: collapse; }
	.arch-table td { padding: 5px 10px 5px 0; }
	.arch-key { font-weight: 600; white-space: nowrap; color: var(--text-dark); }

	/* Funnel */
	.funnel { display: flex; flex-direction: column; gap: 8px; }
	.funnel-row { display: flex; align-items: center; gap: 12px; }
	.funnel-label { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark); min-width: 120px; }
	.funnel-bar-wrap { flex: 1; height: 20px; background: var(--bg-cream); border-radius: 4px; overflow: hidden; }
	.funnel-bar { height: 100%; border-radius: 4px; transition: width 0.3s; }
	.funnel-count { font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-dark); min-width: 40px; text-align: right; }

	/* TTV */
	.ttv-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
	.ttv-label { color: var(--text-secondary); }
	.ttv-value { font-weight: 700; color: var(--text-dark); }

	/* Flywheel */
	.flywheel { display: flex; align-items: center; justify-content: center; gap: 0; flex-wrap: nowrap; padding: 24px 20px; }
	.flywheel-node { width: 80px; height: 80px; border-radius: 50%; color: #fff; display: flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-size: 11px; font-weight: 800; line-height: 1.2; text-align: center; flex-shrink: 0; }
	.flywheel-arrow { font-size: 20px; color: var(--primary); flex-shrink: 0; margin: 0 4px; }

	/* Pillars */
	.pillars-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 24px; }
	.pillar-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; }
	.pillar-header { display: flex; align-items: center; gap: 8px; margin-bottom: 10px; }
	.pillar-num { font-family: var(--font-ui); font-size: 18px; font-weight: 800; }
	.pillar-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.pillar-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.7; }
	.pillar-track { font-family: var(--font-ui); font-size: 10px; font-weight: 600; color: var(--text-muted); margin-top: 10px; }

	/* Progress bars */
	.progress-bar { background: var(--border); border-radius: 4px; height: 6px; width: 100px; overflow: hidden; }
	.progress-fill { height: 100%; border-radius: 4px; }

	/* Thesis */
	.thesis-title { font-family: var(--font-body); font-size: 14px; color: var(--text-dark); font-weight: 600; line-height: 1.6; }
	.thesis-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin-top: 4px; }

	/* Phase cards */
	.phase-progress { display: flex; align-items: center; gap: 0; margin-bottom: 20px; }
	.phase-step { flex: 1; text-align: center; }
	.phase-circle { width: 36px; height: 36px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-family: var(--font-ui); font-weight: 800; font-size: 14px; background: var(--border); color: var(--text-muted); }
	.phase-circle.active { background: var(--primary); color: #fff; }
	.phase-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; color: var(--text-muted); margin-top: 6px; }
	.phase-label.active { color: var(--primary); }
	.phase-names { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; font-family: var(--font-ui); font-size: 11px; text-align: center; margin-bottom: 24px; }
	.phase-name { color: var(--text-muted); }
	.phase-name.active { color: var(--primary); font-weight: 700; }
	.phase-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 16px; }
	.phase-card-header { padding: 16px 20px; border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; }
	.phase-num { font-family: var(--font-ui); font-size: 13px; font-weight: 800; }
	.phase-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.phase-status { margin-left: auto; font-size: 10px; font-weight: 700; color: var(--text-muted); background: var(--border); padding: 3px 10px; border-radius: 10px; }
	.phase-status.active { color: #fff; background: var(--primary); }
	.phase-card-body { padding: 16px 20px; display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
	.phase-col-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
	.phase-col-text { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }
	.phase-checklist-item { font-size: 12px; color: var(--text-secondary); line-height: 2; }
	.phase-checklist-item.done { color: var(--primary); }

	/* Revenue grid */
	.revenue-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
	.revenue-item { text-align: center; }
	.revenue-label { font-family: var(--font-ui); font-size: 10px; font-weight: 600; color: var(--text-muted); margin-bottom: 4px; }
	.revenue-value { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.revenue-unit { font-size: 10px; color: var(--text-muted); }

	/* Feedback */
	.feedback-filters { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
	.filter-btn {
		padding: 8px 14px;
		border: 1px solid transparent;
		border-radius: 10px;
		background: transparent;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary);
		cursor: pointer;
		transition: all 0.18s ease;
		white-space: nowrap;
	}
	.filter-btn.active {
		background: linear-gradient(135deg, #1f5159, #10252a);
		color: #fff;
		border-color: rgba(31, 81, 89, 0.28);
		box-shadow: 0 8px 18px rgba(16, 37, 42, 0.14);
	}
	.filter-btn:hover:not(.active) {
		background: rgba(81, 190, 123, 0.08);
		color: var(--text-dark);
	}
	.feedback-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
	.feedback-type { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; background: var(--bg-cream); color: var(--text-muted); white-space: nowrap; height: fit-content; }
	.feedback-type.bug { background: rgba(239,68,68,0.1); color: #ef4444; }
	.feedback-type.feature { background: rgba(59,130,246,0.1); color: #3b82f6; }
	.feedback-type.question { background: rgba(245,158,11,0.1); color: #f59e0b; }
	.feedback-text { font-size: 13px; color: var(--text-dark); line-height: 1.5; }
	.feedback-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

	/* Three column */
	.three-col { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px; }

	/* Action lists */
	.action-list-item { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border); font-size: 12px; }
	.action-list-email { color: var(--text-dark); font-weight: 600; }
	.action-list-meta { color: var(--text-muted); font-size: 11px; }

	/* Users toolbar */
	.users-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 14px; flex-wrap: wrap; }
	.users-filters { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; justify-content: flex-end; }
	.users-search {
		min-height: 42px; padding: 0 14px; border: 1px solid rgba(31, 81, 89, 0.12); border-radius: 12px;
		font-family: var(--font-body); font-size: 13px; width: 260px; background: rgba(255,255,255,0.9); color: var(--text-dark);
		box-shadow: inset 0 1px 0 rgba(255,255,255,0.4);
	}
	.users-search:focus { outline: none; border-color: var(--primary); box-shadow: 0 0 0 4px rgba(81,190,123,0.12); }
	.users-tier-toggle {
		display: flex;
		gap: 6px;
		padding: 4px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		border-radius: 14px;
		background: linear-gradient(180deg, rgba(255,255,255,0.96), rgba(247,250,251,0.94));
		box-shadow: 0 10px 20px rgba(16, 37, 42, 0.04);
		flex-wrap: wrap;
	}
	.tier-filter-btn { min-height: 34px; }
	.cta-toolbar { margin-bottom: 18px; }
	.cta-trend-chart {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(42px, 1fr));
		gap: 10px;
		align-items: end;
		min-height: 220px;
	}
	.cta-trend-col {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 8px;
		min-width: 0;
	}
	.cta-trend-meta {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cta-trend-bars {
		height: 140px;
		width: 100%;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		gap: 6px;
		padding: 0 2px;
	}
	.cta-trend-bar {
		width: 12px;
		border-radius: 999px 999px 3px 3px;
		min-height: 0;
	}
	.cta-trend-bar.impressions {
		background: rgba(31, 81, 89, 0.24);
		border: 1px solid rgba(31, 81, 89, 0.18);
	}
	.cta-trend-bar.clicks {
		background: linear-gradient(180deg, rgba(81,190,123,0.96), rgba(31,81,89,0.9));
	}
	.cta-trend-date {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.cta-trend-ctr {
		font-size: 10px;
		color: var(--text-muted);
		white-space: nowrap;
	}
	.cta-trend-legend {
		display: flex;
		gap: 16px;
		margin-top: 14px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
		flex-wrap: wrap;
	}
	.cta-legend-dot {
		display: inline-block;
		width: 10px;
		height: 10px;
		border-radius: 999px;
		margin-right: 6px;
		vertical-align: middle;
	}
	.cta-legend-dot.impressions {
		background: rgba(31, 81, 89, 0.24);
		border: 1px solid rgba(31, 81, 89, 0.18);
	}
	.cta-legend-dot.clicks {
		background: linear-gradient(180deg, rgba(81,190,123,0.96), rgba(31,81,89,0.9));
	}

	/* Tier badges */
	.tier-badge {
		display: inline-block; padding: 2px 8px; border-radius: 10px;
		font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase;
	}
	.tier-badge.free { background: var(--bg-cream); color: var(--text-muted); }
	.tier-badge.academy { background: rgba(59,130,246,0.1); color: #3b82f6; }
	.tier-badge.alumni { background: rgba(81,190,123,0.1); color: var(--primary); }

	/* Schema */
	.schema-table-card {
		background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px;
		padding: 16px 20px; margin-bottom: 10px; transition: border-color 0.15s;
	}
	.schema-table-card:hover { border-color: var(--primary); }
	.schema-table-header { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
	.schema-table-name {
		font-family: 'SF Mono', 'Fira Code', monospace; font-size: 14px; font-weight: 700; color: var(--text-dark);
	}
	.schema-row-count {
		font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--primary);
		background: rgba(81,190,123,0.1); padding: 2px 10px; border-radius: 10px;
	}
	.schema-table-desc { font-size: 12px; color: var(--text-secondary); margin-top: 6px; line-height: 1.5; }
	.schema-columns { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 10px; }
	.schema-col-tag {
		font-family: 'SF Mono', 'Fira Code', monospace; font-size: 10px; font-weight: 600;
		padding: 2px 8px; background: var(--bg-cream); border: 1px solid var(--border);
		border-radius: 4px; color: var(--text-secondary);
	}

	/* Integration cards */
	.integrations-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; }
	.integration-card {
		display: flex; align-items: center; gap: 12px; padding: 14px 16px;
		background: var(--bg-cream); border: 1px solid var(--border); border-radius: 10px;
		position: relative;
	}
	.integration-card.connected { border-left: 3px solid var(--primary); }
	.integration-card.error { border-left: 3px solid #ef4444; }
	.integration-card.checking { border-left: 3px solid #f59e0b; }
	.integration-icon { color: var(--text-muted); flex-shrink: 0; }
	.integration-info { flex: 1; min-width: 0; }
	.integration-name { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.integration-desc { font-size: 11px; color: var(--text-muted); }
	.integration-status { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
	.status-dot { width: 8px; height: 8px; border-radius: 50%; background: var(--text-muted); }
	.status-dot.connected { background: #22c55e; }
	.status-dot.error { background: #ef4444; }
	.status-dot.checking { background: #f59e0b; animation: pulse 1.5s infinite; }
	.status-text { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: var(--text-secondary); }
	.integration-detail { position: absolute; bottom: 4px; right: 16px; font-size: 10px; color: var(--text-muted); }

	@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }

	/* Intro request status */
	.intro-status {
		display: inline-block; padding: 2px 8px; border-radius: 10px;
		font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase;
	}
	.intro-status.pending { background: rgba(245,158,11,0.1); color: #f59e0b; }
	.intro-status.completed { background: rgba(81,190,123,0.1); color: var(--primary); }
	.intro-status.declined { background: rgba(239,68,68,0.1); color: #ef4444; }

	/* Event type badges */
	.event-type-badge {
		display: inline-block; padding: 3px 10px; border-radius: 6px;
		font-family: var(--font-ui); font-size: 10px; font-weight: 700; white-space: nowrap;
		background: var(--bg-cream); color: var(--text-muted);
	}
	.event-type-badge.signup { background: rgba(81,190,123,0.1); color: var(--primary); }
	.event-type-badge.save { background: rgba(59,130,246,0.1); color: #3b82f6; }
	.event-type-badge.intro { background: rgba(139,92,246,0.1); color: #8b5cf6; }
	.event-type-badge.invest { background: rgba(245,158,11,0.1); color: #f59e0b; }
	.event-type-badge.view { background: var(--bg-cream); color: var(--text-secondary); }

	/* Feedback stars */
	.feedback-bottom { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
	.feedback-stars { display: flex; gap: 1px; }
	.star { color: var(--border); font-size: 14px; }
	.star.filled { color: #f59e0b; }

	/* Responsive */
	@media (max-width: 768px) {
		.two-col, .charts-grid, .pillars-grid, .arch-grid, .features-grid, .three-col { grid-template-columns: 1fr; }
		.phase-card-body { grid-template-columns: 1fr; }
		.revenue-grid { grid-template-columns: repeat(2, 1fr); }
		.flywheel { flex-wrap: wrap; }
		.flywheel-arrow { display: none; }
		.market-grid { grid-template-columns: repeat(2, 1fr); }
		.phase-names { grid-template-columns: repeat(2, 1fr); }
		.users-search { width: 100%; }
		.users-filters { width: 100%; justify-content: stretch; }
		.users-tier-toggle { width: 100%; }
		.integrations-grid { grid-template-columns: 1fr; }
		.topbar-actions { width: 100%; margin-left: 0; flex-wrap: wrap; }
		.review-tools-head { flex-direction: column; }
		.review-tools-actions { width: 100%; }
		.review-tools-launch, .review-tools-dismiss { flex: 1 1 180px; }
	}
</style>
