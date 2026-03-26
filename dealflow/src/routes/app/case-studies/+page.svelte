<script>
	import { browser } from '$app/environment';

	// ── Dummy data ──────────────────────────────────────────────────────
	const DUMMY_MEMBERS = [
		{
			id: 1, name: 'Jake C.', tier: 'academy', outreach: 'hot', goal: 'income',
			capitalDeployed: 150000, dealsInvested: 3, dealsInDD: 1,
			goalCurrent: 2500, assetClasses: ['Multi-Family', 'Debt Fund'],
			journey: { buybox: true, saved3: true, bookedCall: true, firstDD: true, officeHours: false, invested: false },
			loginCount: 45, joined: '2025-06-15', lastActive: '2026-03-20'
		},
		{
			id: 2, name: 'Sarah M.', tier: 'investor', outreach: 'warm', goal: 'income',
			capitalDeployed: 425000, dealsInvested: 5, dealsInDD: 0,
			goalCurrent: 5800, assetClasses: ['Multi-Family', 'Self-Storage', 'Debt Fund'],
			journey: { buybox: true, saved3: true, bookedCall: true, firstDD: true, officeHours: true, invested: true },
			loginCount: 112, joined: '2024-11-02', lastActive: '2026-03-22'
		},
		{
			id: 3, name: 'Derek W.', tier: 'alumni', outreach: 'hot', goal: 'tax',
			capitalDeployed: 300000, dealsInvested: 2, dealsInDD: 2,
			goalCurrent: 78000, assetClasses: ['Oil & Gas', 'Cost Segregation'],
			journey: { buybox: true, saved3: true, bookedCall: true, firstDD: true, officeHours: true, invested: false },
			loginCount: 67, joined: '2025-02-10', lastActive: '2026-03-18'
		},
		{
			id: 4, name: 'Maria L.', tier: 'free', outreach: 'new', goal: 'growth',
			capitalDeployed: 0, dealsInvested: 0, dealsInDD: 1,
			goalCurrent: 0, assetClasses: [],
			journey: { buybox: true, saved3: false, bookedCall: false, firstDD: false, officeHours: false, invested: false },
			loginCount: 8, joined: '2026-02-28', lastActive: '2026-03-15'
		},
		{
			id: 5, name: 'Tom R.', tier: 'academy', outreach: 'warm', goal: 'income',
			capitalDeployed: 75000, dealsInvested: 1, dealsInDD: 1,
			goalCurrent: 850, assetClasses: ['Multi-Family'],
			journey: { buybox: true, saved3: true, bookedCall: true, firstDD: true, officeHours: false, invested: false },
			loginCount: 34, joined: '2025-09-01', lastActive: '2026-03-21'
		},
		{
			id: 6, name: 'Angela K.', tier: 'investor', outreach: 'hot', goal: 'tax',
			capitalDeployed: 1200000, dealsInvested: 8, dealsInDD: 0,
			goalCurrent: 195000, assetClasses: ['Oil & Gas', 'Multi-Family', 'Self-Storage', 'Debt Fund'],
			journey: { buybox: true, saved3: true, bookedCall: true, firstDD: true, officeHours: true, invested: true },
			loginCount: 203, joined: '2024-05-20', lastActive: '2026-03-23'
		}
	];

	// ── State ───────────────────────────────────────────────────────────
	let members = $state(DUMMY_MEMBERS);
	let search = $state('');
	let filter = $state('all');
	let sortBy = $state('capital');
	let expandedId = $state(null);

	// ── Helpers ─────────────────────────────────────────────────────────
	function fmtMoney(n) {
		if (n == null || n === 0) return '$0';
		if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
		if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
		return `$${n}`;
	}

	function daysSince(dateStr) {
		if (!dateStr) return '—';
		const diff = Math.floor((new Date() - new Date(dateStr)) / 86_400_000);
		if (diff === 0) return 'Today';
		if (diff === 1) return '1d ago';
		return `${diff}d ago`;
	}

	const JOURNEY_STEPS = [
		{ key: 'buybox', label: 'My Plan' },
		{ key: 'saved3', label: 'Saved 3' },
		{ key: 'bookedCall', label: 'Intro Call' },
		{ key: 'firstDD', label: 'First DD' },
		{ key: 'officeHours', label: 'Office Hrs' },
		{ key: 'invested', label: 'Invested' }
	];

	const TIER_LABELS = { free: 'Free', academy: 'Academy', alumni: 'Alumni', investor: 'Investor' };
	const OUTREACH_LABELS = { hot: 'Ready', warm: 'Warm', new: 'New' };
	const GOAL_LABELS = { income: 'Passive Income', tax: 'Tax Reduction', growth: 'Growth' };

	function matchesFilter(m) {
		if (filter === 'all') return true;
		if (filter === 'hot') return m.outreach === 'hot';
		if (filter === 'invested') return m.dealsInvested > 0;
		if (filter === 'dd') return m.dealsInDD > 0;
		if (filter === 'tax') return m.goal === 'tax';
		return true;
	}

	function matchesSearch(m) {
		if (!search.trim()) return true;
		const q = search.toLowerCase();
		const searchable = [m.name, ...m.assetClasses, TIER_LABELS[m.tier], GOAL_LABELS[m.goal]].join(' ').toLowerCase();
		return searchable.includes(q);
	}

	function sortMembers(list) {
		return [...list].sort((a, b) => {
			if (sortBy === 'capital') return b.capitalDeployed - a.capitalDeployed;
			if (sortBy === 'income') return b.goalCurrent - a.goalCurrent;
			if (sortBy === 'activity') return b.loginCount - a.loginCount;
			if (sortBy === 'deals') return (b.dealsInvested + b.dealsInDD) - (a.dealsInvested + a.dealsInDD);
			if (sortBy === 'joined') return new Date(b.joined) - new Date(a.joined);
			return 0;
		});
	}

	// ── Derived ─────────────────────────────────────────────────────────
	const filtered = $derived(sortMembers(members.filter(m => matchesFilter(m) && matchesSearch(m))));

	const stats = $derived({
		totalCapital: members.reduce((s, m) => s + m.capitalDeployed, 0),
		totalInvestments: members.reduce((s, m) => s + m.dealsInvested, 0),
		avgIncome: (() => {
			const incomers = members.filter(m => m.goal === 'income' && m.goalCurrent > 0);
			return incomers.length ? Math.round(incomers.reduce((s, m) => s + m.goalCurrent, 0) / incomers.length) : 0;
		})(),
		assetClasses: [...new Set(members.flatMap(m => m.assetClasses))].length
	});

	function toggleExpand(id) {
		expandedId = expandedId === id ? null : id;
	}

	function goalResult(m) {
		if (m.goal === 'income') return m.goalCurrent > 0 ? `${fmtMoney(m.goalCurrent)}/mo` : '—';
		if (m.goal === 'tax') return m.goalCurrent > 0 ? `${fmtMoney(m.goalCurrent)} saved` : '—';
		return m.capitalDeployed > 0 ? fmtMoney(m.capitalDeployed) : '—';
	}

	function journeyProgress(m) {
		return JOURNEY_STEPS.filter(s => m.journey[s.key]).length;
	}
</script>

<svelte:head>
	<title>Member Success | GYC</title>
</svelte:head>

<div class="ly-page">
	<div class="ly-frame">
<div class="page">
	<header class="page-header">
		<h1>Member Success</h1>
		<p class="subtitle">Track member journeys, investment milestones, and engagement across the community.</p>
	</header>

	<!-- Summary Stats -->
	<div class="stats-row">
		<div class="stat-card">
			<span class="stat-value">{fmtMoney(stats.totalCapital)}</span>
			<span class="stat-label">Capital Deployed</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{stats.totalInvestments}</span>
			<span class="stat-label">Total Investments</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{fmtMoney(stats.avgIncome)}/mo</span>
			<span class="stat-label">Avg Passive Income</span>
		</div>
		<div class="stat-card">
			<span class="stat-value">{stats.assetClasses}</span>
			<span class="stat-label">Asset Classes</span>
		</div>
	</div>

	<!-- Filter / Search Bar -->
	<div class="toolbar">
		<div class="search-wrap">
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
			<input type="text" placeholder="Search by name or asset class..." bind:value={search} class="search-input" />
		</div>

		<div class="filter-buttons">
			{#each [['all', 'All'], ['hot', 'Hot'], ['invested', 'Invested'], ['dd', 'Active DD'], ['tax', 'Tax Focus']] as [key, label]}
				<button class="filter-btn" class:active={filter === key} onclick={() => filter = key}>{label}</button>
			{/each}
		</div>

		<select bind:value={sortBy} class="sort-select">
			<option value="capital">Sort: Capital</option>
			<option value="income">Sort: Income</option>
			<option value="activity">Sort: Activity</option>
			<option value="deals">Sort: Deals</option>
			<option value="joined">Sort: Joined</option>
		</select>
	</div>

	<!-- Results count -->
	<p class="results-count">{filtered.length} member{filtered.length !== 1 ? 's' : ''}</p>

	<!-- Desktop Table -->
	<div class="table-wrap">
		<table class="members-table">
			<thead>
				<tr>
					<th>Name</th>
					<th>Outreach</th>
					<th>Goal</th>
					<th>Capital</th>
					<th>Deals</th>
					<th>Result</th>
					<th>Journey</th>
					<th>Last Active</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as m (m.id)}
					<tr class="member-row" class:expanded={expandedId === m.id} onclick={() => toggleExpand(m.id)}>
						<td class="name-cell">
							<span class="member-name">{m.name}</span>
							<span class="tier-badge tier-{m.tier}">{TIER_LABELS[m.tier]}</span>
						</td>
						<td>
							<span class="outreach-badge outreach-{m.outreach}">{OUTREACH_LABELS[m.outreach]}</span>
						</td>
						<td class="goal-cell">{GOAL_LABELS[m.goal]}</td>
						<td class="mono">{fmtMoney(m.capitalDeployed)}</td>
						<td class="mono">
							{m.dealsInvested}{#if m.dealsInDD > 0}<span class="dd-count"> / {m.dealsInDD} DD</span>{/if}
						</td>
						<td class="mono">{goalResult(m)}</td>
						<td>
							<div class="journey-dots">
								{#each JOURNEY_STEPS as step}
									<span class="dot" class:done={m.journey[step.key]} title={step.label}></span>
								{/each}
								<span class="journey-count">{journeyProgress(m)}/6</span>
							</div>
						</td>
						<td class="last-active">{daysSince(m.lastActive)}</td>
					</tr>
					{#if expandedId === m.id}
						<tr class="expanded-row">
							<td colspan="8">
								<div class="expanded-content">
									<div class="expanded-section">
										<h4>Journey Progress</h4>
										<div class="journey-full">
											{#each JOURNEY_STEPS as step, i}
												<div class="journey-step" class:complete={m.journey[step.key]}>
													<div class="step-dot">{m.journey[step.key] ? '✓' : (i + 1)}</div>
													<span class="step-label">{step.label}</span>
												</div>
												{#if i < JOURNEY_STEPS.length - 1}
													<div class="step-connector" class:complete={m.journey[step.key] && m.journey[JOURNEY_STEPS[i + 1].key]}></div>
												{/if}
											{/each}
										</div>
									</div>
									<div class="expanded-meta">
										<div class="meta-item">
											<span class="meta-label">Asset Classes</span>
											<span class="meta-value">{m.assetClasses.length ? m.assetClasses.join(', ') : 'None yet'}</span>
										</div>
										<div class="meta-item">
											<span class="meta-label">Login Count</span>
											<span class="meta-value">{m.loginCount}</span>
										</div>
										<div class="meta-item">
											<span class="meta-label">Joined</span>
											<span class="meta-value">{new Date(m.joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
										</div>
									</div>
								</div>
							</td>
						</tr>
					{/if}
				{/each}
				{#if filtered.length === 0}
					<tr><td colspan="8" class="empty-row">No members match your filters.</td></tr>
				{/if}
			</tbody>
		</table>
	</div>

	<!-- Mobile Cards -->
	<div class="mobile-cards">
		{#each filtered as m (m.id)}
			<button class="member-card" onclick={() => toggleExpand(m.id)}>
				<div class="card-header">
					<div class="card-name-row">
						<span class="member-name">{m.name}</span>
						<span class="tier-badge tier-{m.tier}">{TIER_LABELS[m.tier]}</span>
						<span class="outreach-badge outreach-{m.outreach}">{OUTREACH_LABELS[m.outreach]}</span>
					</div>
					<span class="card-goal">{GOAL_LABELS[m.goal]}</span>
				</div>
				<div class="card-stats">
					<div class="card-stat">
						<span class="card-stat-value">{fmtMoney(m.capitalDeployed)}</span>
						<span class="card-stat-label">Capital</span>
					</div>
					<div class="card-stat">
						<span class="card-stat-value">{m.dealsInvested}{#if m.dealsInDD > 0} / {m.dealsInDD} DD{/if}</span>
						<span class="card-stat-label">Deals</span>
					</div>
					<div class="card-stat">
						<span class="card-stat-value">{goalResult(m)}</span>
						<span class="card-stat-label">Result</span>
					</div>
					<div class="card-stat">
						<span class="card-stat-value">{daysSince(m.lastActive)}</span>
						<span class="card-stat-label">Active</span>
					</div>
				</div>
				<div class="card-journey">
					{#each JOURNEY_STEPS as step}
						<div class="card-journey-step" class:done={m.journey[step.key]}>
							<span class="dot" class:done={m.journey[step.key]}></span>
							<span class="card-step-label">{step.label}</span>
						</div>
					{/each}
				</div>
				{#if expandedId === m.id}
					<div class="card-expanded">
						<div class="meta-item">
							<span class="meta-label">Asset Classes</span>
							<span class="meta-value">{m.assetClasses.length ? m.assetClasses.join(', ') : 'None yet'}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Login Count</span>
							<span class="meta-value">{m.loginCount}</span>
						</div>
						<div class="meta-item">
							<span class="meta-label">Joined</span>
							<span class="meta-value">{new Date(m.joined).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
						</div>
					</div>
				{/if}
			</button>
		{/each}
		{#if filtered.length === 0}
			<p class="empty-mobile">No members match your filters.</p>
		{/if}
	</div>
</div>
</div>
</div>

<style>
	/* ── Page ──────────────────────────────────────────────────────────── */
	.page {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem 1.5rem 4rem;
		font-family: var(--font-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
		color: var(--text, #1a1a2e);
	}
	.page-header { margin-bottom: 1.5rem; }
	.page-header h1 {
		font-size: 1.75rem;
		font-weight: 700;
		margin: 0 0 0.25rem;
	}
	.subtitle {
		color: var(--text-muted, #6b7280);
		font-size: 0.9rem;
		margin: 0;
	}

	/* ── Stats Row ────────────────────────────────────────────────────── */
	.stats-row {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.stat-card {
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 10px;
		padding: 1rem 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
	}
	.stat-value {
		font-size: 1.4rem;
		font-weight: 700;
		color: var(--primary, #4f46e5);
	}
	.stat-label {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted, #6b7280);
		font-weight: 600;
	}

	/* ── Toolbar ──────────────────────────────────────────────────────── */
	.toolbar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}
	.search-wrap {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 8px;
		padding: 0.45rem 0.75rem;
		flex: 1 1 220px;
		min-width: 180px;
	}
	.search-wrap svg { color: var(--text-muted, #9ca3af); flex-shrink: 0; }
	.search-input {
		border: none;
		outline: none;
		background: transparent;
		font-size: 0.875rem;
		width: 100%;
		color: inherit;
		font-family: inherit;
	}
	.filter-buttons {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
	}
	.filter-btn {
		padding: 0.4rem 0.85rem;
		border-radius: 6px;
		border: 1px solid var(--border, #e5e7eb);
		background: var(--surface, #fff);
		font-size: 0.8rem;
		font-weight: 500;
		cursor: pointer;
		color: var(--text-muted, #6b7280);
		transition: all 0.15s;
		font-family: inherit;
	}
	.filter-btn:hover { border-color: var(--primary, #4f46e5); color: var(--primary, #4f46e5); }
	.filter-btn.active {
		background: var(--primary, #4f46e5);
		color: #fff;
		border-color: var(--primary, #4f46e5);
	}
	.sort-select {
		padding: 0.4rem 0.75rem;
		border-radius: 6px;
		border: 1px solid var(--border, #e5e7eb);
		background: var(--surface, #fff);
		font-size: 0.8rem;
		font-weight: 500;
		color: var(--text, #1a1a2e);
		cursor: pointer;
		font-family: inherit;
	}
	.results-count {
		font-size: 0.8rem;
		color: var(--text-muted, #9ca3af);
		margin: 0 0 0.5rem;
	}

	/* ── Table ────────────────────────────────────────────────────────── */
	.table-wrap {
		overflow-x: auto;
		border-radius: 10px;
		border: 1px solid var(--border, #e5e7eb);
		background: var(--surface, #fff);
	}
	.members-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.85rem;
	}
	.members-table th {
		text-align: left;
		padding: 0.7rem 0.75rem;
		font-weight: 600;
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted, #6b7280);
		border-bottom: 1px solid var(--border, #e5e7eb);
		white-space: nowrap;
	}
	.members-table td {
		padding: 0.65rem 0.75rem;
		border-bottom: 1px solid var(--border-light, #f3f4f6);
		vertical-align: middle;
	}
	.member-row { cursor: pointer; transition: background 0.12s; }
	.member-row:hover { background: var(--hover, #f9fafb); }
	.member-row.expanded { background: var(--hover, #f5f3ff); }

	.name-cell { display: flex; align-items: center; gap: 0.5rem; white-space: nowrap; }
	.member-name { font-weight: 600; }
	.goal-cell { white-space: nowrap; }
	.mono { font-variant-numeric: tabular-nums; }

	/* Tier badge */
	.tier-badge {
		font-size: 0.65rem;
		font-weight: 700;
		padding: 0.15rem 0.45rem;
		border-radius: 4px;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.tier-free { background: #f3f4f6; color: #6b7280; }
	.tier-academy { background: #dbeafe; color: #1d4ed8; }
	.tier-alumni { background: #fef3c7; color: #92400e; }
	.tier-investor { background: #d1fae5; color: #065f46; }

	/* Outreach badge */
	.outreach-badge {
		font-size: 0.7rem;
		font-weight: 600;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		white-space: nowrap;
	}
	.outreach-hot { background: #fee2e2; color: #dc2626; }
	.outreach-warm { background: #ffedd5; color: #c2410c; }
	.outreach-new { background: #e0e7ff; color: #4338ca; }

	/* DD count */
	.dd-count { color: var(--text-muted, #9ca3af); font-size: 0.78rem; }

	/* Journey dots */
	.journey-dots {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.dot {
		width: 10px;
		height: 10px;
		border-radius: 50%;
		background: var(--border, #e5e7eb);
		display: inline-block;
		transition: background 0.2s;
	}
	.dot.done { background: #22c55e; }
	.journey-count {
		font-size: 0.7rem;
		color: var(--text-muted, #9ca3af);
		margin-left: 4px;
	}

	.last-active { white-space: nowrap; color: var(--text-muted, #6b7280); }

	/* Empty row */
	.empty-row {
		text-align: center;
		padding: 2rem !important;
		color: var(--text-muted, #9ca3af);
	}

	/* ── Expanded Row ─────────────────────────────────────────────────── */
	.expanded-row td { padding: 0 !important; border-bottom: 1px solid var(--border, #e5e7eb); }
	.expanded-content {
		padding: 1rem 1.25rem 1.25rem;
		background: var(--hover, #fafafa);
	}
	.expanded-section h4 {
		font-size: 0.78rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted, #6b7280);
		margin: 0 0 0.75rem;
	}

	/* Journey full */
	.journey-full {
		display: flex;
		align-items: center;
		gap: 0;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}
	.journey-step {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.3rem;
	}
	.step-dot {
		width: 28px;
		height: 28px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.7rem;
		font-weight: 700;
		background: var(--border, #e5e7eb);
		color: var(--text-muted, #9ca3af);
	}
	.journey-step.complete .step-dot {
		background: #22c55e;
		color: #fff;
	}
	.step-label {
		font-size: 0.65rem;
		color: var(--text-muted, #6b7280);
		white-space: nowrap;
	}
	.step-connector {
		width: 24px;
		height: 2px;
		background: var(--border, #e5e7eb);
		margin-top: -1rem;
		flex-shrink: 0;
	}
	.step-connector.complete { background: #22c55e; }

	.expanded-meta {
		display: flex;
		gap: 2rem;
		flex-wrap: wrap;
	}
	.meta-item { display: flex; flex-direction: column; gap: 0.15rem; }
	.meta-label {
		font-size: 0.68rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: var(--text-muted, #9ca3af);
		font-weight: 600;
	}
	.meta-value { font-size: 0.85rem; font-weight: 500; }

	/* ── Mobile Cards ─────────────────────────────────────────────────── */
	.mobile-cards { display: none; }

	.member-card {
		display: block;
		width: 100%;
		background: var(--surface, #fff);
		border: 1px solid var(--border, #e5e7eb);
		border-radius: 10px;
		padding: 0.9rem 1rem;
		margin-bottom: 0.75rem;
		text-align: left;
		cursor: pointer;
		font-family: inherit;
		color: inherit;
		font-size: inherit;
		transition: box-shadow 0.15s;
	}
	.member-card:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.06); }

	.card-header { margin-bottom: 0.6rem; }
	.card-name-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
		margin-bottom: 0.2rem;
	}
	.card-goal { font-size: 0.78rem; color: var(--text-muted, #6b7280); }

	.card-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 0.5rem;
		margin-bottom: 0.6rem;
	}
	.card-stat { display: flex; flex-direction: column; }
	.card-stat-value { font-size: 0.85rem; font-weight: 600; font-variant-numeric: tabular-nums; }
	.card-stat-label { font-size: 0.65rem; color: var(--text-muted, #9ca3af); text-transform: uppercase; }

	.card-journey {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.card-journey-step {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.card-step-label { font-size: 0.65rem; color: var(--text-muted, #9ca3af); }
	.card-journey-step.done .card-step-label { color: #16a34a; }

	.card-expanded {
		margin-top: 0.75rem;
		padding-top: 0.75rem;
		border-top: 1px solid var(--border-light, #f3f4f6);
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.empty-mobile { text-align: center; color: var(--text-muted, #9ca3af); padding: 2rem 0; }

	/* ── Responsive ───────────────────────────────────────────────────── */
	@media (min-width: 769px) and (max-width: 1024px) {
		.page { padding: 1.5rem 1.25rem 3.5rem; }
		.stats-row { grid-template-columns: repeat(2, 1fr); }
	}

	@media (max-width: 768px) {
		.page { padding: 1rem 1rem 3rem; }
		.stats-row { grid-template-columns: repeat(2, 1fr); }
		.table-wrap { display: none; }
		.mobile-cards { display: block; }
		.toolbar { flex-direction: column; align-items: stretch; }
		.search-wrap { flex: 1 1 100%; }
		.filter-buttons { overflow-x: auto; flex-wrap: nowrap; padding-bottom: 0.25rem; }
	}
	@media (max-width: 480px) {
		.stats-row { grid-template-columns: 1fr 1fr; gap: 0.5rem; }
		.stat-value { font-size: 1.1rem; }
		.card-stats { grid-template-columns: repeat(2, 1fr); }
	}
</style>
