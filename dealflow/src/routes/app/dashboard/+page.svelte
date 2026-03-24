<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { user, isLoggedIn, isAdmin, userTier } from '$lib/stores/auth.js';
	import { deals, dealStages, stageCounts, STAGE_META } from '$lib/stores/deals.js';
	import GoalProgress from '$lib/components/GoalProgress.svelte';

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
	const hasPlan = $derived(!!(planSlots && planSlots.length > 0 && planSlots[0]?.asset_class));
	const totalPlanSlots = $derived(planSlots?.length || 0);
	const filledPlanSlots = $derived.by(() => (planSlots || []).filter(slot => slot.filled_by));
	const totalPlanIncome = $derived.by(() => (planSlots || []).reduce((sum, slot) => sum + (slot.est_income || 0), 0));
	const filledPlanIncome = $derived.by(() => filledPlanSlots.reduce((sum, slot) => sum + (slot.est_income || 0), 0));
	const planTargetIncome = $derived(portfolioPlan?.target_income || totalPlanIncome || targetIncome || 0);
	const blendedYieldPct = $derived.by(() => {
		if (!planSlots || planSlots.length === 0) return 0;
		const total = planSlots.reduce((sum, slot) => sum + (slot.target_coc || 0), 0);
		return Math.round((total / planSlots.length) * 100);
	});
	const blueprintProgress = $derived(
		planTargetIncome > 0 ? Math.min(100, Math.round((filledPlanIncome / planTargetIncome) * 100)) : 0
	);
	const yearsToGoal = $derived.by(() => {
		if (!planSlots || planSlots.length === 0) return 0;
		const dealsPerYear = portfolioPlan?.deals_per_year || 1;
		return Math.ceil((planSlots.length - filledCount) / dealsPerYear);
	});
	const nextPlanSlot = $derived.by(() => (planSlots || []).find(slot => !slot.filled_by) || null);
	const planCheckSize = $derived(portfolioPlan?.check_size || nextPlanSlot?.check_size || wizardData.checkSize || 100000);

	// Momentum metrics
	const dealsReviewed = $derived(Object.keys($dealStages).length);
	const inPipeline = $derived(($stageCounts.saved || 0) + ($stageCounts.diligence || 0));
	const decisionsMade = $derived(($stageCounts.passed || 0) + ($stageCounts.invested || 0));

	// Daily deal view counter for free users
	const DAILY_LIMIT = 20;
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
		const ms = milestones;
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
	function assetKey(value) {
		return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	}

	function slotMatchesDeal(slot, deal) {
		const slotAsset = assetKey(slot?.asset_class);
		const dealAsset = assetKey(deal?.assetClass);
		const lendingKeys = ['privatedebtcredit', 'lending', 'debt'];
		if (!slotAsset) return true;
		if (lendingKeys.includes(slotAsset)) {
			return lendingKeys.includes(dealAsset) || assetKey(deal?.strategy) === 'lending';
		}
		return slotAsset === dealAsset;
	}

	const nextSlotMatchCount = $derived.by(() => {
		if (!nextPlanSlot || !$deals.length) return 0;
		return $deals.filter((deal) => {
			const stage = $dealStages[deal.id] || 'browse';
			return stage !== 'passed' && slotMatchesDeal(nextPlanSlot, deal);
		}).length;
	});

	const actionItems = $derived.by(() => {
		const items = [];
		const saved = $stageCounts.saved || 0;
		const diligence = $stageCounts.diligence || 0;
		const investedDealIds = Object.entries($dealStages)
			.filter(([, stage]) => stage === 'invested')
			.map(([id]) => id);
		const portfolioDealIds = portfolio.map((investment) => investment.dealId).filter(Boolean);
		const unloggedInvested = investedDealIds.filter((id) => !portfolioDealIds.includes(id));

		if (hasPlan && filledCount > 0 && nextPlanSlot) {
			items.push({
				icon: 'plan',
				text: `<strong>${filledCount} of ${totalPlanSlots}</strong> plan slots filled. Next: <strong>${nextPlanSlot.asset_class}</strong> at ${fmtDollar(nextPlanSlot.check_size)}`,
				link: 'View Plan',
				page: 'plan'
			});
		}

		if (unloggedInvested.length > 0) {
			const unloggedDeal = ($deals || []).find((deal) => deal.id === unloggedInvested[0]);
			items.push({
				icon: 'card',
				text: `${unloggedDeal ? `<strong>${unloggedDeal.investmentName}</strong>` : `<strong>${unloggedInvested.length} deal${unloggedInvested.length !== 1 ? 's' : ''}</strong>`} marked as invested but not logged in portfolio`,
				link: 'Log Now',
				page: 'portfolio'
			});
		}

		if (saved > 0) {
			items.push({
				icon: 'bookmark',
				text: `You have <strong>${saved} deal${saved !== 1 ? 's' : ''} to review</strong> — pick one and work through the checklist`,
				link: 'Review Deals', page: 'deals'
			});
		}
		if (diligence > 0) {
			items.push({
				icon: 'connect',
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
						icon: 'tax',
						text: `<strong>${pending.length} K-1${pending.length > 1 ? 's' : ''} still pending</strong> for ${taxYear} tax year`,
						link: 'Tax Prep', page: 'tax-prep'
					});
				}
			}
		}
		if (items.length === 0 && !hasPlan && portfolio.length === 0 && $deals.length > 0) {
			items.push({
				icon: 'browse',
				text: `Browse <strong>${$deals.length} deals</strong> and start building your pipeline`,
				link: 'Explore Deals',
				page: 'deals'
			});
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
		const name = firstName;
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
				<h1>{firstName ? `${firstName}, let's find` : "Let's find"}<br>your perfect deals.</h1>
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

		{#if hasPlan}
			<div class="blueprint-card">
				<div class="blueprint-header">
					<div class="blueprint-eyebrow">Your Investment Plan</div>
					<a href="/app/plan" class="blueprint-link">Edit Plan</a>
				</div>
				<div class="blueprint-summary">
					<strong>{filledCount} of {totalPlanSlots}</strong> investments ·
					<strong class="summary-accent">{fmtDollar(filledPlanIncome)}</strong>
					of {fmtDollar(planTargetIncome)}/yr
				</div>
				<div class="blueprint-meta">
					{totalPlanSlots} deals × {fmtDollar(planCheckSize)} · ~{blendedYieldPct}% avg yield{#if yearsToGoal > 0} · ~{yearsToGoal} yr to goal{/if}
				</div>
				<div class="blueprint-track">
					<div class="blueprint-fill" style="width:{blueprintProgress}%"></div>
				</div>

				{#if filledPlanSlots.length > 0}
					<div class="blueprint-list">
						{#each filledPlanSlots as slot}
							<div class="blueprint-row">
								<span class="blueprint-dot"></span>
								<div class="blueprint-row-copy">
									<div class="blueprint-row-title">{slot.filled_name || 'Investment'}</div>
									<div class="blueprint-row-meta">{slot.asset_class} · {fmtDollar(slot.check_size)} · {fmtDollar(slot.est_income)}/yr</div>
								</div>
							</div>
						{/each}
					</div>
				{/if}

				{#if nextPlanSlot}
					<div class="blueprint-next">
						<div class="blueprint-next-copy">
							<div class="blueprint-next-label">Next Investment</div>
							<div class="blueprint-next-title">
								<strong>{nextPlanSlot.asset_class}</strong> · {fmtDollar(nextPlanSlot.check_size)} · ~{Math.round((nextPlanSlot.target_coc || 0) * 100)}% CoC · ~{fmtDollar(nextPlanSlot.est_income)}/yr
							</div>
							{#if nextSlotMatchCount > 0}
								<div class="blueprint-next-matches">{nextSlotMatchCount} deal{nextSlotMatchCount === 1 ? '' : 's'} match</div>
							{/if}
						</div>
						<a href="/app/deals" class="btn-primary blueprint-next-btn">Browse Deals →</a>
					</div>
				{/if}
			</div>
		{:else if hasOnboarding}
			<div class="plan-cta-card">
				<div>
					<div class="plan-cta-eyebrow">Your Investment Plan</div>
					<div class="plan-cta-title">Turn your goal into concrete deal slots.</div>
					<div class="plan-cta-copy">Map out check sizes, target yields, and the next investment that should fill your plan.</div>
				</div>
				<a href="/app/plan" class="btn-primary plan-cta-btn">Build My Plan →</a>
			</div>
		{/if}

		<!-- Action Items -->
		{#if actionItems.length > 0}
			<div class="action-card">
				<div class="action-header">Action Items</div>
				{#each actionItems as item}
					<a href="/app/{item.page}" class="action-row">
						<div class="action-icon" class:warn={item.icon === 'card' || item.icon === 'tax'}>
							{#if item.icon === 'plan'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
							{:else if item.icon === 'card'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>
							{:else if item.icon === 'bookmark'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
							{:else if item.icon === 'connect'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"></path><rect x="9" y="3" width="6" height="4" rx="1"></rect><path d="M9 14l2 2 4-4"></path></svg>
							{:else if item.icon === 'tax'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
							{/if}
						</div>
						<div class="action-text">{@html item.text}</div>
						<span class="action-link">{item.link} →</span>
					</a>
				{/each}
			</div>
		{/if}
	{/if}
</div>

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
	.mobile-menu-btn {
		display: none;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-dark);
		padding: 4px;
	}
	.mobile-menu-btn svg { width: 22px; height: 22px; }
	.topbar-title {
		font-family: var(--font-headline);
		font-size: 22px;
		font-weight: 400;
		color: var(--text-dark);
		margin-right: 24px;
		letter-spacing: -0.3px;
	}

	/* ── Dashboard Tab Bar ── */
	.dash-tabs { display: flex; gap: 0; margin-left: 24px; align-self: stretch; }
	.dash-tab {
		background: none;
		border: none;
		border-bottom: 2px solid transparent;
		padding: 0 16px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--text-muted);
		cursor: pointer;
		white-space: nowrap;
		transition: color 0.15s, border-color 0.15s;
		text-decoration: none;
		display: flex;
		align-items: center;
	}
	.dash-tab:hover { color: var(--text-dark); }
	.dash-tab.active { color: var(--primary); border-bottom-color: var(--primary); }

	/* ── Content Area ── */
	.content-area { padding: 24px 32px 48px; max-width: 1200px; }

	/* ── First Time Onboarding ── */
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

	/* ── Hero Progress Card ── */
	.dash-hero {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 36px;
		margin-bottom: 28px;
		box-shadow: var(--shadow-card);
	}
	.dash-hero-stats {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: 0;
		padding-top: 14px;
		border-top: 1px solid var(--border-light);
		margin-top: 16px;
	}
	:global(.dash-hero .goal-progress-label) {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.2px;
		margin-bottom: 20px;
	}
	:global(.dash-hero .goal-progress-bar) {
		height: 12px;
		background: var(--border-light);
		border-radius: 6px;
		margin-bottom: 12px;
	}
	:global(.dash-hero .goal-progress-fill) {
		border-radius: 6px;
	}
	:global(.dash-hero .goal-progress-value) {
		font-size: 22px;
		font-weight: 800;
		justify-content: flex-start;
		align-items: baseline;
		gap: 10px;
		flex-wrap: wrap;
		line-height: 1.1;
	}
	:global(.dash-hero .goal-progress-pct) {
		font-size: 14px;
		font-weight: 700;
	}

	/* ── Goal CTA (no onboarding) ── */
	.goal-cta {
		background: linear-gradient(135deg, #1F5159, #0A1E21);
		border-radius: var(--radius);
		padding: 28px 32px;
		margin-bottom: 24px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		box-shadow: var(--shadow-card);
		flex-wrap: wrap;
	}
	.goal-cta-text {
		color: rgba(255,255,255,0.9);
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.5;
	}
	.goal-cta-text :global(strong) {
		color: #fff;
		font-family: var(--font-ui);
		font-weight: 700;
	}
	.goal-cta-btn {
		padding: 10px 24px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 13px;
		cursor: pointer;
		white-space: nowrap;
		transition: background var(--transition);
	}
	.goal-cta-btn:hover { background: var(--primary-hover); }

	/* ── Plan Blueprint ── */
	.plan-cta-card,
	.blueprint-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 22px 20px;
		margin-bottom: 18px;
		box-shadow: var(--shadow-card);
	}
	.plan-cta-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.plan-cta-eyebrow,
	.blueprint-eyebrow,
	.action-header {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}
	.plan-cta-title {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-dark);
		margin-top: 8px;
	}
	.plan-cta-copy {
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-secondary);
		margin-top: 4px;
		max-width: 560px;
	}
	.plan-cta-btn {
		white-space: nowrap;
	}
	.blueprint-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 4px;
	}
	.blueprint-link {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}
	.blueprint-summary {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-dark);
	}
	.summary-accent {
		color: var(--primary);
	}
	.blueprint-meta {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--text-muted);
		margin-top: 6px;
	}
	.blueprint-track {
		height: 8px;
		background: var(--border-light);
		border-radius: 4px;
		overflow: hidden;
		margin: 14px 0 12px;
	}
	.blueprint-fill {
		height: 100%;
		min-width: 0;
		border-radius: 4px;
		background: linear-gradient(90deg, var(--primary), #3bba78);
	}
	.blueprint-list {
		margin-bottom: 14px;
	}
	.blueprint-row {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 0;
		border-bottom: 1px solid var(--border);
	}
	.blueprint-row:last-child {
		border-bottom: none;
	}
	.blueprint-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--primary);
		flex-shrink: 0;
	}
	.blueprint-row-copy {
		min-width: 0;
	}
	.blueprint-row-title {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.blueprint-row-meta {
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
		margin-top: 1px;
	}
	.blueprint-next {
		padding: 14px 18px;
		background: linear-gradient(135deg, rgba(81, 190, 123, 0.06), rgba(37, 99, 235, 0.06));
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 14px;
		flex-wrap: wrap;
	}
	.blueprint-next-copy {
		flex: 1;
		min-width: 220px;
	}
	.blueprint-next-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 4px;
	}
	.blueprint-next-title {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
		line-height: 1.5;
	}
	.blueprint-next-matches {
		font-family: var(--font-ui);
		font-size: 12px;
		color: var(--primary);
		margin-top: 4px;
	}
	.blueprint-next-btn {
		flex-shrink: 0;
		white-space: nowrap;
	}

	.btn-primary {
		padding: 10px 22px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-weight: 700;
		font-size: 12px;
		cursor: pointer;
		display: inline-block;
		text-decoration: none;
	}

	/* ── Action Items ── */
	.action-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
		margin-bottom: 20px;
		box-shadow: var(--shadow-card);
	}
	.action-header {
		padding: 16px 16px 0;
		margin-bottom: 12px;
	}
	.action-row {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 13px 16px;
		border-bottom: 1px solid var(--border);
		cursor: pointer;
		transition: background var(--transition);
		text-decoration: none;
	}
	.action-row:last-child { border-bottom: none; }
	.action-row:hover { background: var(--bg-cream); }
	.action-icon {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--primary);
		flex-shrink: 0;
	}
	.action-icon.warn {
		color: #ef4444;
	}
	.action-icon svg {
		width: 16px;
		height: 16px;
	}
	.action-text {
		flex: 1;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-secondary);
		line-height: 1.5;
	}
	.action-text :global(strong) {
		color: var(--text-dark);
		font-weight: 700;
	}
	.action-link { flex-shrink: 0; font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--primary); white-space: nowrap; }

	/* ── Mobile Responsive ── */
	@media (max-width: 768px) {
		.topbar { padding: 0 16px; padding-top: env(safe-area-inset-top, 0px); }
		.mobile-menu-btn { display: block; }
		.topbar-title { font-size: 16px; margin-right: 12px; }
		.dash-tabs {
			margin-left: 0;
			overflow-x: auto;
			-webkit-overflow-scrolling: touch;
			scrollbar-width: none;
			flex-shrink: 1;
			min-width: 0;
			width: 100%;
			justify-content: stretch;
			order: 1;
		}
		.dash-tabs::-webkit-scrollbar { display: none; }
		.dash-tab {
			font-size: 13px !important;
			padding: 10px 0 !important;
			flex: 1;
			text-align: center;
			justify-content: center;
		}
		.content-area { padding: 12px !important; }
		.dash-hero { padding: 24px; }
		.plan-cta-card,
		.blueprint-card { padding: 18px 16px; }
		.blueprint-next { padding: 14px; }
	}
</style>
