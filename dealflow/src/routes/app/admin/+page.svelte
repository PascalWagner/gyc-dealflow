<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { user, isAdmin, userToken, userEmail } from '$lib/stores/auth.js';
	import { deals } from '$lib/stores/deals.js';

	let activeTab = $state('overview');
	const tabs = ['overview', 'users', 'schema', 'devnotes', 'network', 'transactions', 'feedback'];

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
	let usersData = $state(null);

	// Feedback state
	let feedbackItems = $state([]);
	let feedbackFilter = $state('all');

	// Network & Moat state
	let introStats = $state({ total: 0, uniqueGPs: 0, uniqueLPs: 0, thisMonth: 0 });
	let introRequests = $state([]);
	let moatMetrics = $state({});

	// Admin guard
	onMount(() => {
		if (!$isAdmin) {
			goto('/app/deals');
			return;
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
		else if (tab === 'network') await loadNetwork();
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
		try {
			const result = await adminFetch({ action: 'user-metrics' });
			if (result.success) usersData = result;
		} catch (e) { console.error(e); }
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
			}
		} catch (e) { console.error(e); }
	}

	function triggerGhlSync() {
		adminFetch({ action: 'ghl-sync' }).then(r => {
			alert(r.success ? 'GHL sync triggered!' : 'Sync failed: ' + (r.error || 'Unknown'));
		});
	}

	const filteredFeedback = $derived(
		feedbackFilter === 'all' ? feedbackItems : feedbackItems.filter(f => f.type === feedbackFilter)
	);

	function histColor(i) {
		return ['#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6', '#10b981'][i] || '#666';
	}
</script>

{#if !$isAdmin}
	<div class="loading">Redirecting...</div>
{:else}
<div class="admin-page">
	<div class="topbar">
		<div class="topbar-title">Admin Dashboard</div>
		<div class="topbar-actions">
			<a href="https://analytics.google.com/analytics/web/#/p/G-F8B5NMB9J9" target="_blank" rel="noopener" class="topbar-btn">Google Analytics</a>
			<button class="topbar-btn" onclick={() => triggerGhlSync()}>Sync GHL</button>
			<button class="topbar-btn" onclick={() => loadTab(activeTab)}>Refresh</button>
		</div>
	</div>

	<div class="content" style="max-width:1100px">
		<!-- Tab Bar -->
		<div class="tab-bar">
			{#each tabs as tab}
				<button
					class="tab-btn"
					class:active={activeTab === tab}
					onclick={() => switchTab(tab)}
				>
					{tab === 'overview' ? 'Overview' : tab === 'users' ? 'Users' : tab === 'schema' ? 'Database Schema' : tab === 'devnotes' ? 'Dev Notes' : tab === 'network' ? 'Network & Moat' : tab === 'transactions' ? 'Transactions' : 'Feedback'}
				</button>
			{/each}
		</div>

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

				<!-- User Table -->
				{#if usersData.users}
					<div class="section-card">
						<div class="section-title">All Users <span class="badge">{usersData.users.length}</span></div>
						<div class="table-wrap">
							<table>
								<thead>
									<tr>
										<th>Email</th><th>Signed Up</th><th>Stage</th>
										<th class="center">Onboarded</th><th class="right">Views</th>
										<th class="right">Saves</th><th class="right">Sessions</th><th>Last Active</th>
									</tr>
								</thead>
								<tbody>
									{#each usersData.users as u}
										<tr>
											<td>{u.email}</td>
											<td>{u.signedUp || '--'}</td>
											<td>{u.stage || '--'}</td>
											<td class="center">{u.onboarded ? 'Yes' : 'No'}</td>
											<td class="right">{u.views ?? 0}</td>
											<td class="right">{u.saves ?? 0}</td>
											<td class="right">{u.sessions ?? 0}</td>
											<td>{u.lastActive || '--'}</td>
										</tr>
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
			<div class="section-card">
				<div class="section-title">Database Schema</div>
				<div class="muted-text">Schema browser loads from API. Click Refresh to fetch live row counts.</div>
				<SchemaView />
			</div>

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
						{#each ['GHL -> Supabase sync is login-only', 'Magic link / forgot password not built', 'Weekly digest email kill-switched', 'Mobile swipe feed is beta', 'Analytics data stored in localStorage'] as issue}
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
						<tr><td class="arch-key">Code</td><td><code>github.com/PascalWagner/gyc-dealflow</code></td></tr>
						<tr><td class="arch-key">Domain</td><td><code>dealflow.growyourcashflow.io</code></td></tr>
						<tr><td class="arch-key">Supabase</td><td>gyc-dealflow (nntzqyufmtypfjpusflm)</td></tr>
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
			<div class="section-desc">User-submitted feedback from across the platform.</div>
			<div class="section-card">
				<div class="section-header-row">
					<span class="section-title">User Feedback</span>
					<span class="badge">{feedbackItems.length}</span>
				</div>
				<div class="feedback-filters">
					{#each ['all', 'bug', 'feature', 'question'] as type}
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
								<div class="feedback-meta">{item.email} -- {item.date}</div>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		{/if}
	</div>
</div>
{/if}

{#snippet SchemaView()}
	<div class="muted-text" style="padding:20px 0">
		Schema browser fetches live table information from the admin API.
		<button class="topbar-btn" style="margin-top:10px" onclick={async () => {
			const result = await adminFetch({ action: 'schema' });
			if (result.success && result.tables) {
				const el = document.getElementById('schemaTableBody');
				if (el) el.innerHTML = result.tables.map(t => `<tr><td class="bold">${t.name}</td><td class="right">${t.rows?.toLocaleString() ?? '--'}</td><td class="muted">${t.description || ''}</td></tr>`).join('');
			}
		}}>Load Schema</button>
		<div class="table-wrap" style="margin-top:12px">
			<table>
				<thead><tr><th>Table</th><th class="right">Rows</th><th>Description</th></tr></thead>
				<tbody id="schemaTableBody"></tbody>
			</table>
		</div>
	</div>
{/snippet}

<style>
	.admin-page { min-height: 100vh; }
	.topbar { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg-card); flex-wrap: wrap; }
	.topbar-title { font-family: var(--font-ui); font-size: 18px; font-weight: 800; color: var(--text-dark); }
	.topbar-actions { margin-left: auto; display: flex; gap: 8px; }
	.topbar-btn { background: none; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 6px 14px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; text-decoration: none; display: inline-flex; align-items: center; gap: 6px; }
	.topbar-btn:hover { border-color: var(--primary); color: var(--primary); }
	.content { padding: 24px; margin: 0 auto; }

	/* Tab bar */
	.tab-bar { display: flex; gap: 4px; margin-bottom: 24px; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 4px; flex-wrap: wrap; }
	.tab-btn { flex: 1; min-width: 100px; padding: 10px 12px; border: none; border-radius: 8px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s; background: transparent; color: var(--text-secondary); }
	.tab-btn.active { background: var(--primary); color: #fff; }
	.tab-btn:hover:not(.active) { background: var(--bg-cream); }

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

	/* Stats */
	.stats-grid-4 { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 24px; }
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
	.feedback-filters { display: flex; gap: 8px; margin-bottom: 16px; }
	.filter-btn { padding: 6px 14px; border: 1px solid var(--border); border-radius: 6px; background: var(--bg-card); font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
	.filter-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
	.feedback-item { display: flex; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border); }
	.feedback-type { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 4px; background: var(--bg-cream); color: var(--text-muted); white-space: nowrap; height: fit-content; }
	.feedback-type.bug { background: rgba(239,68,68,0.1); color: #ef4444; }
	.feedback-type.feature { background: rgba(59,130,246,0.1); color: #3b82f6; }
	.feedback-type.question { background: rgba(245,158,11,0.1); color: #f59e0b; }
	.feedback-text { font-size: 13px; color: var(--text-dark); line-height: 1.5; }
	.feedback-meta { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

	/* Responsive */
	@media (max-width: 768px) {
		.two-col, .charts-grid, .pillars-grid, .arch-grid, .features-grid { grid-template-columns: 1fr; }
		.phase-card-body { grid-template-columns: 1fr; }
		.revenue-grid { grid-template-columns: repeat(2, 1fr); }
		.flywheel { flex-wrap: wrap; }
		.flywheel-arrow { display: none; }
		.market-grid { grid-template-columns: repeat(2, 1fr); }
		.phase-names { grid-template-columns: repeat(2, 1fr); }
	}
</style>
