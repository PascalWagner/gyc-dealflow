<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { user, isLoggedIn, isAdmin, userTier } from '$lib/stores/auth.js';
	import { deals, dealStages, stageCounts, STAGE_META } from '$lib/stores/deals.js';
	import GoalProgress from '$lib/components/GoalProgress.svelte';
	import PortfolioChart from '$lib/components/PortfolioChart.svelte';

	// Local state
	let portfolio = $state([]);
	let wizardData = $state({});
	let goals = $state(null);
	let distributions = $state([]);
	let portfolioPlan = $state(null);

	// Derived
	const branch = $derived(wizardData._branch || '');
	const buyBoxComplete = $derived(browser && localStorage.getItem('gycBuyBoxComplete') === 'true');
	const hasOnboarding = $derived(!!branch || (goals && goals.targetIncome > 0));

	const totalInvested = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.amountInvested) || 0), 0));
	const totalDistributions = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.distributionsReceived) || 0), 0));
	const activeInvestments = $derived(portfolio.filter(i => i.status === 'Active' || i.status === 'Distributing').length);

	// Goal progress
	const hasGoals = $derived(goals && goals.targetIncome > 0);
	const targetIncome = $derived(hasGoals ? goals.targetIncome : 0);

	const currentIncome = $derived.by(() => {
		let income = 0;
		if (distributions.length > 0) {
			let firstDist = null, totalDist = 0;
			distributions.forEach(d => {
				totalDist += (d.amount || 0);
				const dt = new Date(d.date);
				if (!firstDist || dt < firstDist) firstDist = dt;
			});
			const months = Math.max(1, (new Date().getFullYear() - firstDist.getFullYear()) * 12 + (new Date().getMonth() - firstDist.getMonth()) + 1);
			income = Math.round((totalDist / months) * 12);
		} else if (totalDistributions > 0 && portfolio.length > 0) {
			let oldest = null;
			portfolio.forEach(p => {
				if (p.dateInvested) {
					const dt = new Date(p.dateInvested);
					if (!oldest || dt < oldest) oldest = dt;
				}
			});
			const months = oldest ? Math.max(1, (new Date().getFullYear() - oldest.getFullYear()) * 12 + (new Date().getMonth() - oldest.getMonth()) + 1) : 12;
			income = Math.round((totalDistributions / months) * 12);
		}
		if (income === 0 && goals?.currentIncome > 0) income = goals.currentIncome;
		return income;
	});

	const goalProgress = $derived(hasGoals ? Math.min(100, Math.round((currentIncome / targetIncome) * 100)) : 0);

	// Goal label
	const goalLabel = $derived.by(() => {
		if (hasGoals) return 'YOUR PASSIVE INCOME GOAL';
		if (branch === 'cashflow') return 'PASSIVE INCOME GOAL';
		if (branch === 'tax') return 'TAX OFFSET GOAL';
		if (branch === 'growth') return 'WEALTH GROWTH GOAL';
		return 'YOUR PASSIVE INCOME GOAL';
	});

	const goalValueText = $derived.by(() => {
		if (hasGoals) return `$${currentIncome.toLocaleString()} / $${targetIncome.toLocaleString()} per year`;
		if (branch === 'cashflow') {
			const t = parseDollar(wizardData.targetCashFlow) || 100000;
			return `$0 / $${t.toLocaleString()} per year`;
		}
		if (branch === 'tax') {
			const t = parseDollar(wizardData.taxableIncome) || 200000;
			return `$0 / $${t.toLocaleString()} offset`;
		}
		if (branch === 'growth') {
			const c = parseDollar(wizardData.growthCapital) || 500000;
			return `$${c.toLocaleString()} → $${(c * 2).toLocaleString()}`;
		}
		return '';
	});

	// Stats row
	const statsLine = $derived(
		activeInvestments > 0
			? `${activeInvestments} active investment${activeInvestments !== 1 ? 's' : ''} · $${totalInvested >= 1000000 ? (totalInvested / 1000000).toFixed(2) + 'M' : totalInvested.toLocaleString()} deployed`
			: 'No investments yet — start building your portfolio'
	);

	// Slot progress
	const planSlots = $derived(portfolioPlan && (portfolioPlan.slots || portfolioPlan.buckets));
	const filledCount = $derived(planSlots ? planSlots.filter(s => s.filled_by).length : 0);
	const slotLine = $derived(
		planSlots && planSlots.length > 0 && planSlots[0]?.asset_class
			? ` · ${filledCount} of ${planSlots.length} investments made`
			: ''
	);

	// Momentum metrics
	const dealsReviewed = $derived(Object.keys($dealStages).length);
	const inPipeline = $derived(($stageCounts.saved || 0) + ($stageCounts.diligence || 0));
	const decisionsMade = $derived(($stageCounts.passed || 0) + ($stageCounts.invested || 0));

	// Daily deal view counter for free users
	const DAILY_LIMIT = 10;
	const isFreeUser = $derived(!$isAdmin && $userTier !== 'academy' && $userTier !== 'paid');
	const dailyDealCount = $derived.by(() => {
		if (!browser) return 0;
		const todayKey = `gycDailyDeals_${new Date().toISOString().slice(0, 10)}`;
		const stored = JSON.parse(localStorage.getItem(todayKey) || '[]');
		return stored.length;
	});

	// Milestone tracker — compute activation milestones from deal stages + portfolio
	const milestones = $derived.by(() => {
		const stages = $dealStages || {};
		const stageEntries = Object.entries(stages);
		const hasSaved = stageEntries.some(([, s]) => s === 'saved' || s === 'diligence' || s === 'decision' || s === 'invested');
		const hasDiligence = stageEntries.some(([, s]) => s === 'diligence' || s === 'decision' || s === 'invested');
		const hasDecision = stageEntries.some(([, s]) => s === 'decision' || s === 'invested');
		const hasInvested = stageEntries.some(([, s]) => s === 'invested') || portfolio.length > 0;

		// Check if user has viewed a deck (stored in localStorage)
		let hasDeckView = false;
		if (browser) {
			const deckViews = JSON.parse(localStorage.getItem('gycDeckViews') || '[]');
			hasDeckView = deckViews.length > 0 || stageEntries.length > 0;
		}

		return [
			{ key: 'save', label: 'First Deal Saved', desc: 'Save a deal to your pipeline', done: hasSaved, icon: 'bookmark' },
			{ key: 'deck', label: 'First Deck Viewed', desc: 'Review a deal pitch deck', done: hasDeckView, icon: 'doc' },
			{ key: 'dd', label: 'First DD Started', desc: 'Begin due diligence on a deal', done: hasDiligence, icon: 'check' },
			{ key: 'invest', label: 'First Investment', desc: 'Record your first investment', done: hasInvested, icon: 'star' }
		];
	});

	const milestoneProgress = $derived.by(() => {
		const ms = milestones();
		const done = ms.filter(m => m.done).length;
		return Math.round((done / ms.length) * 100);
	});

	// Recent activity feed — derived from dealStages + deals list
	const recentActivity = $derived.by(() => {
		const stageEntries = Object.entries($dealStages);
		if (stageEntries.length === 0) return [];
		const dealsMap = {};
		($deals || []).forEach(d => { dealsMap[d.id] = d; });

		const actionVerbs = {
			saved: 'saved for review',
			diligence: 'moved to Connect',
			decision: 'moved to Decide',
			invested: 'marked as invested',
			passed: 'skipped'
		};

		const activities = stageEntries
			.map(([dealId, stage]) => {
				const deal = dealsMap[dealId];
				if (!deal) return null;
				return {
					dealId,
					dealName: deal.name || deal.investmentName || 'Unknown Deal',
					stage,
					verb: actionVerbs[stage] || `moved to ${stage}`,
					timestamp: deal.stageUpdatedAt || deal.addedDate || deal.createdTime || null
				};
			})
			.filter(Boolean)
			.sort((a, b) => {
				if (!a.timestamp && !b.timestamp) return 0;
				if (!a.timestamp) return 1;
				if (!b.timestamp) return -1;
				return new Date(b.timestamp) - new Date(a.timestamp);
			})
			.slice(0, 8);

		return activities;
	});

	// Quick actions — context-aware buttons
	const quickActions = $derived.by(() => {
		const actions = [];
		actions.push({ label: 'Browse Deals', href: '/app/deals', icon: 'search' });
		const saved = $stageCounts.saved || 0;
		if (saved > 0) {
			actions.push({ label: `Continue Review (${saved})`, href: '/app/deals', icon: 'clipboard', tab: 'saved' });
		}
		if (portfolio.length > 0) {
			actions.push({ label: 'View Portfolio', href: '/app/portfolio', icon: 'briefcase' });
		} else {
			actions.push({ label: 'View Portfolio', href: '/app/portfolio', icon: 'briefcase' });
		}
		return actions;
	});

	// Allocation for pie chart
	const allocationMap = $derived.by(() => {
		const map = {};
		portfolio.forEach(p => {
			const ac = p.assetClass || 'Other';
			map[ac] = (map[ac] || 0) + (parseFloat(p.amountInvested) || 0);
		});
		return map;
	});

	const planAllocationMap = $derived.by(() => {
		if (!planSlots || planSlots.length === 0 || !planSlots[0]?.asset_class) return null;
		const map = {};
		planSlots.forEach(s => {
			map[s.asset_class] = (map[s.asset_class] || 0) + 1;
		});
		return map;
	});

	// Action items
	const actionItems = $derived.by(() => {
		const items = [];
		const saved = $stageCounts.saved || 0;
		const diligence = $stageCounts.diligence || 0;

		if (saved > 0) {
			items.push({
				text: `You have <strong>${saved} deal${saved !== 1 ? 's' : ''} to review</strong> — pick one and work through the checklist`,
				link: 'Review Deals', page: 'deals'
			});
		}
		if (diligence > 0) {
			items.push({
				text: `<strong>${diligence} deal${diligence !== 1 ? 's' : ''} ready to connect</strong> — request an intro with the operator`,
				link: 'Connect Now', page: 'deals'
			});
		}
		// Tax prep seasonal reminder (Jan-April)
		if (browser) {
			const month = new Date().getMonth();
			if (month >= 0 && month <= 3 && portfolio.length > 0) {
				const taxDocs = JSON.parse(localStorage.getItem('gycTaxDocs') || '[]');
				const taxYear = new Date().getFullYear() - 1;
				const pending = taxDocs.filter(d => d.taxYear == taxYear && d.uploadStatus === 'Pending');
				if (pending.length > 0) {
					items.push({
						text: `<strong>${pending.length} K-1${pending.length > 1 ? 's' : ''} still pending</strong> for ${taxYear} tax year`,
						link: 'Tax Prep', page: 'tax-prep'
					});
				}
			}
		}
		return items;
	});

	// First name
	const firstName = $derived.by(() => {
		const u = $user;
		const raw = u?.firstName || (u?.name || '').split(' ')[0] || '';
		return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
	});

	// Coaching message
	const coachMsg = $derived.by(() => {
		const name = firstName();
		if (!buyBoxComplete && !branch) {
			return { msg: "Let's start by setting up your investor profile — it takes 2 minutes and helps us find deals that match your goals.", cta: 'Get Started', page: '' };
		}
		if ($stageCounts.saved > 0 && ($stageCounts.diligence || 0) === 0) {
			return { msg: `You've saved ${$stageCounts.saved} deal${$stageCounts.saved !== 1 ? 's' : ''} — great start! Pick your strongest one and work through the review checklist.`, cta: 'Review Deals', page: 'deals' };
		}
		if (($stageCounts.diligence || 0) > 0) {
			return { msg: `You have ${$stageCounts.diligence} deal${$stageCounts.diligence !== 1 ? 's' : ''} ready to connect. Request an intro with the operator.`, cta: 'Connect Now', page: 'deals' };
		}
		if (activeInvestments > 0 && hasGoals) {
			return { msg: `You're ${goalProgress}% to your income goal with ${activeInvestments} active investment${activeInvestments !== 1 ? 's' : ''}. Keep the momentum going.`, cta: 'View Portfolio', page: 'portfolio' };
		}
		if (name) {
			return { msg: `Welcome back, ${name}. Here's your investing overview.`, cta: '', page: '' };
		}
		return { msg: '', cta: '', page: '' };
	});

	function parseDollar(s) {
		if (typeof s === 'number') return s;
		if (!s) return 0;
		return parseInt(String(s).replace(/[$,\s]/g, ''), 10) || 0;
	}

	function formatTimeAgo(dateStr) {
		if (!dateStr) return '';
		const now = new Date();
		const date = new Date(dateStr);
		const diffMs = now - date;
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return 'just now';
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		const diffWeeks = Math.floor(diffDays / 7);
		if (diffWeeks < 4) return `${diffWeeks}w ago`;
		return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
	}

	function fmtDollar(n) {
		if (!n || isNaN(n)) return '$0';
		if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
		return '$' + n.toLocaleString();
	}

	function openWizard() {
		if (browser && typeof window.openBuyBoxWizard === 'function') {
			window.openBuyBoxWizard();
		} else {
			goto('/app/plan');
		}
	}

	onMount(() => {
		if (!browser) return;
		portfolio = JSON.parse(localStorage.getItem('gycPortfolio') || '[]');
		wizardData = JSON.parse(localStorage.getItem('gycBuyBoxWizard') || '{}');
		goals = JSON.parse(localStorage.getItem('gycGoals') || 'null');
		distributions = JSON.parse(localStorage.getItem('gycDistributions') || '[]');
		portfolioPlan = JSON.parse(localStorage.getItem('gycPortfolioPlan') || 'null');
	});
</script>

<div class="topbar">
	<button class="mobile-menu-btn" onclick={() => document.getElementById('sidebar')?.classList.toggle('open')}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
	</button>
	<div class="topbar-title">Dashboard</div>
	<div class="dash-tabs">
		<a href="/app/dashboard" class="dash-tab active">Overview</a>
		<a href="/app/portfolio" class="dash-tab">Portfolio</a>
		<a href="/app/plan" class="dash-tab">My Plan</a>
	</div>
</div>

<div class="content-area">
	{#if !hasOnboarding && dealsReviewed === 0 && portfolio.length === 0}
		<!-- First-time user onboarding -->
		<div class="first-time">
			<div class="first-time-inner">
				<div class="first-time-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
				</div>
				<h1>{firstName() ? `${firstName()}, let's find` : "Let's find"}<br>your perfect deals.</h1>
				<p>Tell us what you're looking for in 2 minutes.<br>We'll match you with deals that fit.</p>
				<button class="btn-primary" onclick={openWizard}>Set Up My Investor Profile →</button>
				<div class="first-time-alt">or <a href="/app/deals">browse deals first</a></div>
			</div>
		</div>
	{:else}
		<!-- Hero Progress Card -->
		{#if hasOnboarding}
			<div class="dash-hero">
				<GoalProgress
					label={goalLabel}
					current={currentIncome}
					target={targetIncome || (parseDollar(wizardData.targetCashFlow) || 100000)}
					{branch}
				/>
				<div class="dash-hero-stats">{statsLine}{slotLine}</div>
			</div>
		{:else}
			<div class="goal-cta">
				<div class="goal-cta-text"><strong>Set up your investment plan in 60 seconds</strong><br>Get personalized deal recommendations matched to your goals.</div>
				<button class="goal-cta-btn" onclick={openWizard}>Get Started →</button>
			</div>
		{/if}

		<!-- Coaching Message -->
		{#if coachMsg().msg}
			<div class="coaching-card">
				<div class="coaching-inner">
					{#if firstName()}
						<div class="coaching-label">{firstName()}'s next step</div>
					{/if}
					<div class="coaching-msg">{coachMsg().msg}</div>
				</div>
				{#if coachMsg().cta}
					<a href="/app/{coachMsg().page}" class="btn-primary coaching-btn">{coachMsg().cta} →</a>
				{/if}
			</div>
		{/if}

		<!-- Momentum Metrics -->
		<div class="momentum-grid">
			<div class="metric-card">
				<div class="metric-label">Deals Reviewed</div>
				<div class="metric-value">{dealsReviewed}</div>
			</div>
			<div class="metric-card">
				<div class="metric-label">In Pipeline</div>
				<div class="metric-value">{inPipeline}</div>
			</div>
			<div class="metric-card">
				<div class="metric-label">Decisions Made</div>
				<div class="metric-value">{decisionsMade}</div>
			</div>
			<div class="metric-card">
				<div class="metric-label">Total Invested</div>
				<div class="metric-value">{fmtDollar(totalInvested)}</div>
			</div>
			{#if isFreeUser}
				<div class="metric-card daily-deals-card">
					<div class="metric-label">Deals Today</div>
					<div class="metric-value">{dailyDealCount()}<span class="daily-limit-label">/{DAILY_LIMIT}</span></div>
					<div class="daily-bar-wrap">
						<div class="daily-bar-fill" style="width:{Math.min(100, (dailyDealCount() / DAILY_LIMIT) * 100)}%"></div>
					</div>
				</div>
			{/if}
		</div>

		<!-- Milestone Tracker -->
		{#if milestoneProgress() < 100}
			<div class="milestone-card">
				<div class="milestone-header">
					<div class="milestone-title">Your Activation Journey</div>
					<div class="milestone-pct">{milestoneProgress()}% complete</div>
				</div>
				<div class="milestone-bar-wrap">
					<div class="milestone-bar-fill" style="width:{milestoneProgress()}%"></div>
				</div>
				<div class="milestone-steps">
					{#each milestones() as ms, i}
						<div class="milestone-step" class:done={ms.done} class:next={!ms.done && (i === 0 || milestones()[i - 1].done)}>
							<div class="milestone-icon" class:done={ms.done}>
								{#if ms.done}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>
								{:else if ms.icon === 'bookmark'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
								{:else if ms.icon === 'doc'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
								{:else if ms.icon === 'check'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 12l2 2 4-4"/></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
								{/if}
							</div>
							<div class="milestone-text">
								<div class="milestone-label">{ms.label}</div>
								<div class="milestone-desc">{ms.desc}</div>
							</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<!-- Quick Actions -->
		<div class="quick-actions">
			{#each quickActions() as action}
				<a href={action.href} class="quick-action-btn">
					{#if action.icon === 'search'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
					{:else if action.icon === 'clipboard'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
					{:else if action.icon === 'briefcase'}
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
					{/if}
					{action.label}
				</a>
			{/each}
		</div>

		<!-- Recent Activity Feed -->
		{#if recentActivity().length > 0}
			<div class="activity-card">
				<div class="activity-header">Recent Activity</div>
				{#each recentActivity() as activity}
					<a href="/app/deals/{activity.dealId}" class="activity-row">
						<span class="activity-stage-dot" style="background: {STAGE_META[activity.stage]?.color || 'var(--text-muted)'}"></span>
						<div class="activity-text">
							<strong>{activity.dealName}</strong> {activity.verb}
						</div>
						{#if activity.timestamp}
							<span class="activity-time">{formatTimeAgo(activity.timestamp)}</span>
						{/if}
					</a>
				{/each}
			</div>
		{/if}

		<!-- Action Items -->
		{#if actionItems().length > 0}
			<div class="action-card">
				<div class="action-header">Action Items</div>
				{#each actionItems() as item}
					<a href="/app/{item.page}" class="action-row">
						<div class="action-text">{@html item.text}</div>
						<span class="action-link">{item.link} →</span>
					</a>
				{/each}
			</div>
		{/if}

		<!-- Portfolio Summary -->
		{#if portfolio.length > 0}
			<div class="portfolio-section">
				<div class="section-header">
					<div class="section-title">Your Portfolio</div>
					<a href="/app/portfolio" class="section-link">View Full Portfolio →</a>
				</div>
				<div class="portfolio-layout">
					<PortfolioChart
						allocations={allocationMap()}
						planAllocations={planAllocationMap()}
					/>
					<div class="portfolio-table-wrap">
						<table>
							<thead>
								<tr><th>Investment</th><th>Invested</th><th>Distributions</th><th>Status</th></tr>
							</thead>
							<tbody>
								{#each portfolio as p}
									<tr>
										<td>
											<div class="inv-name">{p.investmentName}</div>
											<div class="inv-sub">{p.sponsor || ''}{p.sponsor && p.assetClass ? ' · ' : ''}{p.assetClass || ''}</div>
										</td>
										<td>${(parseFloat(p.amountInvested) || 0).toLocaleString()}</td>
										<td class="dist-col">${(parseFloat(p.distributionsReceived) || 0).toLocaleString()}</td>
										<td>
											<span class="status-badge" style="--status-color: {p.status === 'Active' ? 'var(--primary)' : p.status === 'Distributing' ? '#3b82f6' : p.status === 'Exited' ? '#6b7280' : '#f59e0b'}">
												{p.status || 'Active'}
											</span>
										</td>
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		{:else}
			<div class="portfolio-empty">
				<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="1.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>
				<div class="empty-title">No investments yet</div>
				<div class="empty-desc">Add investments to track your portfolio here.</div>
				<a href="/app/portfolio" class="btn-primary">+ Add Investment</a>
			</div>
		{/if}
	{/if}
</div>

<style>
	.topbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px 24px;
		border-bottom: 1px solid var(--border);
		background: var(--bg-card);
		position: sticky;
		top: 0;
		z-index: 10;
	}
	.mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; padding: 4px; }
	.mobile-menu-btn svg { width: 22px; height: 22px; }
	.topbar-title { font-family: var(--font-ui); font-size: 16px; font-weight: 800; color: var(--text-dark); }
	.dash-tabs { display: flex; gap: 4px; margin-left: auto; }
	.dash-tab {
		padding: 6px 16px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		text-decoration: none;
		border-radius: var(--radius-sm);
		transition: all 0.15s;
	}
	.dash-tab:hover { color: var(--text-dark); background: var(--bg-cream); }
	.dash-tab.active { color: var(--primary); background: rgba(81, 190, 123, 0.08); }
	.content-area { padding: 24px; max-width: 1200px; }

	/* First time */
	.first-time { display: flex; align-items: center; justify-content: center; min-height: calc(100vh - 120px); }
	.first-time-inner { text-align: center; max-width: 480px; }
	.first-time-icon {
		width: 72px; height: 72px; border-radius: 20px;
		background: linear-gradient(135deg, var(--primary), #2563EB);
		display: flex; align-items: center; justify-content: center;
		margin: 0 auto 28px;
		box-shadow: 0 8px 32px rgba(81, 190, 123, 0.25);
	}
	.first-time-icon svg { width: 32px; height: 32px; }
	.first-time h1 { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); margin: 0 0 12px; line-height: 1.3; }
	.first-time p { font-family: var(--font-body); font-size: 15px; color: var(--text-secondary); line-height: 1.7; margin: 0 0 32px; }
	.first-time-alt { margin-top: 16px; font-size: 12px; color: var(--text-muted); }
	.first-time-alt a { color: var(--primary); font-weight: 600; text-decoration: none; }

	/* Hero */
	.dash-hero {
		background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
		padding: 28px; margin-bottom: 20px;
	}
	.dash-hero-stats { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); margin-top: 12px; }

	.goal-cta {
		background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
		padding: 24px; margin-bottom: 20px; display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
	}
	.goal-cta-text { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); line-height: 1.6; }
	.goal-cta-btn {
		padding: 12px 24px; background: var(--primary); color: #fff; border: none;
		border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 13px; cursor: pointer;
	}

	/* Coaching */
	.coaching-card {
		background: var(--bg-card); border: 1px solid var(--border); border-left: 3px solid var(--primary);
		border-radius: var(--radius); padding: 20px 24px; margin-bottom: 20px;
		display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
	}
	.coaching-inner { flex: 1; min-width: 200px; }
	.coaching-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
	.coaching-msg { font-family: var(--font-body); font-size: 14px; color: var(--text-dark); line-height: 1.5; }
	.coaching-btn { flex-shrink: 0; white-space: nowrap; text-decoration: none; }

	.btn-primary {
		padding: 10px 22px; background: var(--primary); color: #fff; border: none;
		border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 12px; cursor: pointer; display: inline-block;
	}

	/* Momentum */
	.momentum-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin-bottom: 20px; }
	.metric-card {
		background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
		padding: 12px 14px; text-align: center;
	}
	.metric-label { font-family: var(--font-ui); font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 3px; }
	.metric-value { font-family: var(--font-headline); font-size: 18px; color: var(--text-secondary); }
	.daily-limit-label { font-size: 12px; font-weight: 600; color: var(--text-muted); }
	.daily-deals-card { border-color: var(--primary); border-width: 1px 1px 1px 3px; }
	.daily-bar-wrap { height: 3px; background: var(--border-light); border-radius: 2px; margin-top: 6px; overflow: hidden; }
	.daily-bar-fill { height: 100%; background: var(--primary); border-radius: 2px; transition: width 0.3s ease; }

	/* Action Items */
	.action-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; margin-bottom: 20px; }
	.action-header { padding: 16px 16px 0; font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 12px; }
	.action-row {
		display: flex; align-items: center; gap: 14px; padding: 14px 16px;
		border-bottom: 1px solid var(--border); cursor: pointer; transition: background 0.15s; text-decoration: none;
	}
	.action-row:hover { background: var(--bg-cream); }
	.action-text { flex: 1; font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); line-height: 1.5; }
	.action-link { flex-shrink: 0; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--primary); white-space: nowrap; }

	/* Portfolio */
	.portfolio-section { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; margin-bottom: 20px; }
	.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
	.section-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.section-link { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--primary); text-decoration: none; }
	.portfolio-layout { display: flex; gap: 24px; align-items: flex-start; }
	.portfolio-table-wrap { flex: 1; overflow-x: auto; }
	table { width: 100%; border-collapse: collapse; }
	th { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--border); }
	td { padding: 12px; font-family: var(--font-body); font-size: 13px; color: var(--text-dark); border-bottom: 1px solid var(--border); }
	.inv-name { font-weight: 700; color: var(--text-dark); }
	.inv-sub { font-size: 11px; color: var(--text-muted); margin-top: 1px; }
	.dist-col { color: var(--primary); }
	.status-badge {
		padding: 3px 8px; border-radius: 10px; font-size: 10px; font-weight: 700;
		background: color-mix(in srgb, var(--status-color) 12%, transparent);
		color: var(--status-color);
	}

	.portfolio-empty {
		background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
		padding: 40px; text-align: center; margin-bottom: 20px;
	}
	.portfolio-empty svg { width: 40px; height: 40px; margin-bottom: 12px; }
	.empty-title { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-dark); margin-bottom: 8px; }
	.empty-desc { font-family: var(--font-body); font-size: 14px; color: var(--text-muted); margin-bottom: 16px; }

	/* Quick Actions */
	.quick-actions {
		display: flex;
		gap: 10px;
		margin-bottom: 20px;
		flex-wrap: wrap;
	}
	.quick-action-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 20px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		text-decoration: none;
		transition: all 0.15s;
		cursor: pointer;
		flex: 1;
		min-width: 140px;
		justify-content: center;
	}
	.quick-action-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
		background: rgba(81, 190, 123, 0.04);
	}
	.quick-action-btn svg { flex-shrink: 0; }

	/* Recent Activity */
	.activity-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 20px;
	}
	.activity-header {
		padding: 16px 16px 0;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 8px;
	}
	.activity-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 16px;
		border-bottom: 1px solid var(--border);
		text-decoration: none;
		transition: background 0.15s;
	}
	.activity-row:last-child { border-bottom: none; }
	.activity-row:hover { background: var(--bg-cream); }
	.activity-stage-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		flex-shrink: 0;
	}
	.activity-text {
		flex: 1;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.4;
	}
	.activity-text strong { color: var(--text-dark); font-weight: 600; }
	.activity-time {
		font-family: var(--font-ui);
		font-size: 11px;
		color: var(--text-muted);
		white-space: nowrap;
		flex-shrink: 0;
	}

	/* Milestone Tracker */
	.milestone-card {
		background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius);
		padding: 20px 24px; margin-bottom: 20px;
	}
	.milestone-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
	.milestone-title {
		font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark);
	}
	.milestone-pct {
		font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--primary);
	}
	.milestone-bar-wrap {
		height: 6px; background: var(--border); border-radius: 3px; overflow: hidden; margin-bottom: 16px;
	}
	.milestone-bar-fill {
		height: 100%; background: linear-gradient(90deg, var(--primary), #2563EB); border-radius: 3px;
		transition: width 0.5s ease;
	}
	.milestone-steps { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; }
	.milestone-step {
		display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px;
		border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--bg-cream);
		opacity: 0.5; transition: all 0.2s;
	}
	.milestone-step.done { opacity: 1; border-color: rgba(81,190,123,0.3); background: rgba(81,190,123,0.04); }
	.milestone-step.next { opacity: 1; border-color: var(--primary); background: rgba(81,190,123,0.06); }
	.milestone-icon {
		width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
		background: var(--border); color: var(--text-muted); flex-shrink: 0;
	}
	.milestone-icon.done { background: var(--primary); color: #fff; }
	.milestone-text { min-width: 0; }
	.milestone-label {
		font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: var(--text-dark); line-height: 1.3;
	}
	.milestone-desc {
		font-family: var(--font-body); font-size: 11px; color: var(--text-muted); margin-top: 2px; line-height: 1.4;
	}

	@media (max-width: 768px) {
		.mobile-menu-btn { display: block; }
		.topbar-title { font-size: 14px; }
		.dash-tabs { gap: 2px; }
		.dash-tab { padding: 6px 10px; font-size: 12px; }
		.momentum-grid { grid-template-columns: repeat(2, 1fr); }
		.portfolio-layout { flex-direction: column; }
		.content-area { padding: 16px; }
		.quick-actions { flex-direction: column; }
		.quick-action-btn { min-width: unset; }
		.milestone-steps { grid-template-columns: repeat(2, 1fr); }
	}
</style>
