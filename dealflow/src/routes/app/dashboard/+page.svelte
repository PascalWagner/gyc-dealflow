<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { deals, dealStages, stageCounts, fetchDeals } from '$lib/stores/deals.js';
	import { user, getFreshSessionToken, canBuildFullPlan } from '$lib/stores/auth.js';
	import AddDealModal from '$lib/components/AddDealModal.svelte';
	import { hasCompletedPlan, normalizeWizardData } from '$lib/onboarding/planWizard.js';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import { getUserScopedCacheSnapshot } from '$lib/utils/userScopedState.js';
	import { buildInvestedPortfolio, normalizePortfolioRecord } from '$lib/utils/investedPortfolio.js';

	const USER_SCOPED_STATE_EVENT = 'gyc:user-scoped-state-updated';

	// Local state
	let portfolioDetails = $state([]);
	let wizardData = $state({});
	let goals = $state(null);
	let distributions = $state([]);
	let portfolioPlan = $state(null);
	let showAddDealModal = $state(false);
	const portfolioView = $derived.by(() =>
		buildInvestedPortfolio({
			stageMap: $dealStages || {},
			deals: $deals || [],
			portfolio: portfolioDetails
		})
	);
	const metricPortfolio = $derived.by(() => portfolioView.metricEntries || []);
	const pendingEntries = $derived.by(() => portfolioView.pendingEntries || []);

	// Derived
	const branch = $derived(wizardData._branch || '');
	const hasGoals = $derived(Boolean(goals && goals.targetIncome > 0));
	const hasGoalContext = $derived(Boolean(branch) || hasGoals);
	const hasCompletedDashboardPlan = $derived.by(() => hasCompletedPlan(wizardData || {}, portfolioPlan));
	const needsPlanSetup = $derived.by(() => !hasCompletedDashboardPlan);
	const totalInvested = $derived(metricPortfolio.reduce((sum, investment) => sum + (parseFloat(investment.amountInvested) || 0), 0));
	const totalDistributions = $derived(metricPortfolio.reduce((sum, investment) => sum + (parseFloat(investment.distributionsReceived) || 0), 0));
	const activeInvestments = $derived(metricPortfolio.filter((investment) => investment.status === 'Active' || investment.status === 'Distributing').length);
	const targetIncome = $derived(hasGoals ? goals.targetIncome : 0);
	const currentIncome = $derived.by(() => {
		let income = 0;
		if (distributions.length > 0) {
			let firstDistribution = null;
			let totalDistributionAmount = 0;
			distributions.forEach((distribution) => {
				totalDistributionAmount += distribution.amount || 0;
				const distributionDate = new Date(distribution.date);
				if (!firstDistribution || distributionDate < firstDistribution) firstDistribution = distributionDate;
			});
			const months = Math.max(
				1,
				(new Date().getFullYear() - firstDistribution.getFullYear()) * 12 +
					(new Date().getMonth() - firstDistribution.getMonth()) +
					1
			);
			income = Math.round((totalDistributionAmount / months) * 12);
		} else if (totalDistributions > 0 && metricPortfolio.length > 0) {
			let oldestInvestment = null;
			metricPortfolio.forEach((investment) => {
				if (!investment.dateInvested) return;
				const investmentDate = new Date(investment.dateInvested);
				if (!oldestInvestment || investmentDate < oldestInvestment) oldestInvestment = investmentDate;
			});
			const months = oldestInvestment
				? Math.max(
					1,
					(new Date().getFullYear() - oldestInvestment.getFullYear()) * 12 +
						(new Date().getMonth() - oldestInvestment.getMonth()) +
						1
				)
				: 12;
			income = Math.round((totalDistributions / months) * 12);
		}
		if (income === 0 && goals?.currentIncome > 0) income = goals.currentIncome;
		return income;
	});
	const goalProgress = $derived(hasGoals ? Math.min(100, Math.round((currentIncome / targetIncome) * 100)) : 0);
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
			const target = parseDollar(wizardData.targetCashFlow) || 100000;
			return `$0 / $${target.toLocaleString()} per year`;
		}
		if (branch === 'tax') {
			const target = parseDollar(wizardData.taxableIncome) || 200000;
			return `$0 / $${target.toLocaleString()} offset`;
		}
		if (branch === 'growth') {
			const capital = parseDollar(wizardData.growthCapital) || 500000;
			return `$${capital.toLocaleString()} → $${(capital * 2).toLocaleString()}`;
		}
		return '';
	});
	const coachTargetCopy = $derived.by(() => {
		if (needsPlanSetup) {
			if (hasGoals) return `You're building toward $${targetIncome.toLocaleString()}/year in passive income, and the next step is to finish your plan so we can tailor every screen to that target.`;
			if (branch === 'growth') return "You're building toward long-term wealth, and the next step is to finish your plan so we can tailor every screen to that outcome.";
			if (branch === 'tax') return "You're working toward tax-efficient investing, and the next step is to finish your plan so we can tailor every screen to that goal.";
			return "You're building toward passive income, but first we need your plan so we can tailor what you see.";
		}
		if (hasGoals) return `You're building toward $${targetIncome.toLocaleString()}/year in passive income.`;
		if (branch === 'growth') {
			const capital = parseDollar(wizardData.growthCapital) || 500000;
			return `You're building toward $${capital.toLocaleString()} in portfolio value growth.`;
		}
		if (branch === 'tax') {
			const target = parseDollar(wizardData.taxableIncome) || 200000;
			return `You're working toward $${target.toLocaleString()}/year in taxable income offsets.`;
		}
		const target = parseDollar(wizardData.targetCashFlow) || 100000;
		return `You're building toward $${target.toLocaleString()}/year in passive income.`;
	});
	const coachProgressCopy = $derived.by(() => {
		if (needsPlanSetup) {
			return 'Once your plan is in place, Home, Deal Flow, and Portfolio will all reflect what you are actually trying to buy.';
		}
		if (goalProgress > 0 && currentIncome > 0) {
			return `You're currently at $${currentIncome.toLocaleString()}/year, and the fastest way to keep moving is to browse deals that fit your plan.`;
		}
		return `You haven't started deploying yet, and the fastest way to make progress is to browse deals that fit your plan.`;
	});
	const coachPrimaryLabel = $derived(needsPlanSetup ? 'Finish Plan' : 'Browse Deals');
	const coachPrimaryHref = $derived(needsPlanSetup ? '/app/plan' : '/app/deals');
	const coachSecondaryLabel = $derived(needsPlanSetup ? 'Browse Deals First' : 'Review Plan');
	const coachSecondaryHref = $derived(needsPlanSetup ? '/app/deals' : '/app/plan');
	const statsLine = $derived(
		activeInvestments > 0
			? `${activeInvestments} active investment${activeInvestments !== 1 ? 's' : ''} · $${totalInvested >= 1000000 ? (totalInvested / 1000000).toFixed(2) + 'M' : totalInvested.toLocaleString()} deployed`
			: 'No investments yet — start building your portfolio'
	);

	const actionItems = $derived.by(() => {
		const items = [];
		const review = $stageCounts.review || 0;
		const connect = $stageCounts.connect || 0;
		if (connect > 0) {
			items.push({
				icon: 'connect',
				text: `<strong>${connect} deal${connect !== 1 ? 's' : ''} ready to connect</strong> — request an intro with the operator`,
				link: 'Connect Now',
				page: 'deals',
				href: '/app/deals?tab=connect'
			});
		}
		if (review > 0) {
			items.push({
				icon: 'bookmark',
				text: `You have <strong>${review} deal${review !== 1 ? 's' : ''} to review</strong> — pick one and work through the checklist`,
				link: 'Review Deals',
				page: 'deals',
				href: '/app/deals?tab=review'
			});
		}
		if (pendingEntries.length > 0) {
			items.push({
				icon: 'plan',
				text: `<strong>${pendingEntries.length} invested deal${pendingEntries.length !== 1 ? 's are' : ' is'} pending review</strong> — visible in your portfolio now, but not counted in totals yet`,
				link: 'Open Portfolio',
				page: 'portfolio',
				href: '/app/portfolio'
			});
		}
		return items;
	});
	const standardActionItems = $derived.by(() => {
		const items = [];
		items.push({
			icon: 'plus',
			text: 'Add a deal you are evaluating or already invested in so it lands in the right place right away',
			link: 'Add Deal',
			action: 'modal'
		});
		return items;
	});
	const primaryAction = $derived.by(() => {
		if (needsPlanSetup) {
			return {
				icon: 'search',
				text: 'Browse deals now and start building your pipeline while you refine your plan',
				link: 'Browse Deals',
				page: 'deals',
				href: '/app/deals'
			};
		}
		return actionItems[0] || null;
	});
	const secondaryActionItems = $derived.by(() =>
		needsPlanSetup
			? [
				{
					icon: 'plan',
					text: 'Finish your plan so your dashboard, deal flow, and portfolio reflect what you are actually trying to buy',
					link: 'Finish Plan',
					page: 'plan',
					href: '/app/plan'
				},
				...actionItems,
				...standardActionItems
			]
			: [...actionItems.slice(1), ...standardActionItems]
	);

	// First name
	const firstName = $derived.by(() => {
		const u = $user;
		const raw = u?.firstName || (u?.name || '').split(' ')[0] || '';
		return raw ? raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase() : '';
	});

	function parseDollar(value) {
		if (typeof value === 'number') return value;
		if (!value) return 0;
		return parseInt(String(value).replace(/[$,\s]/g, ''), 10) || 0;
	}

	function openWizard() {
		if (!hasGoalContext) {
			goto('/onboarding');
			return;
		}
		goto(hasCompletedDashboardPlan ? '/app/plan?edit=1' : '/app/plan');
	}

	function openAddDealModal() {
		showAddDealModal = true;
	}

	async function syncDashboardState() {
		if (!browser) return;
		const snapshot = getUserScopedCacheSnapshot();
		portfolioDetails = snapshot.portfolio;
		wizardData = normalizeWizardData(snapshot.buyBoxWizard || {});
		goals = snapshot.goals;
		distributions = snapshot.distributions;
		portfolioPlan = snapshot.portfolioPlan;

		const token = await getFreshSessionToken();
		if (!token) return;

		try {
			const portfolioResponse = await fetch('/api/userdata?type=portfolio', {
				headers: { Authorization: `Bearer ${token}` }
			});
			if (!portfolioResponse.ok) return;
			const portfolioData = await portfolioResponse.json();
			if (Array.isArray(portfolioData?.records)) {
				portfolioDetails = portfolioData.records.map((record) => normalizePortfolioRecord(record));
			}
		} catch (error) {
			console.warn('Dashboard portfolio sync failed:', error);
		}
	}

	async function handleDashboardDealSubmission() {
		await fetchDeals({ force: true }).catch(() => {});
		await syncDashboardState();
	}

	onMount(() => {
		if (!browser) return;
		void syncDashboardState();
		const handleScopedStateUpdate = () => {
			void syncDashboardState();
		};
		window.addEventListener(USER_SCOPED_STATE_EVENT, handleScopedStateUpdate);
		return () => {
			window.removeEventListener(USER_SCOPED_STATE_EVENT, handleScopedStateUpdate);
		};
	});

	onMount(() => {
		fetchDeals().catch(() => {});
	});
</script>

<svelte:head>
	<title>Home | GYC</title>
</svelte:head>

<PageContainer className="dashboard-shell ly-page-stack">
	<PageHeader
		title="Home"
		subtitle="Your dashboard for progress, priorities, and next actions."
		className="dashboard-page-header"
	/>

	<div class="content-area">
		{#if !hasGoalContext && !hasCompletedDashboardPlan}
			<div class="dashboard-onboarding-card ly-surface ly-surface--strong">
				<div class="dashboard-onboarding-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
				</div>
				<div class="dashboard-onboarding-title">{firstName ? `${firstName}, set up your investor profile.` : 'Set up your investor profile.'}</div>
				<div class="dashboard-onboarding-copy">Get your preferences in place in a couple of minutes so the dashboard, deal flow, portfolio, and plan page reflect what you are actually trying to buy.</div>
				<div class="dashboard-onboarding-actions">
					<button class="btn-primary" onclick={openWizard}>Get Started →</button>
					<a href="/app/deals" class="dashboard-onboarding-link">Browse deals first</a>
				</div>
			</div>
		{:else}
		<div class="coach-card ly-surface ly-surface--accent ly-surface--strong">
			<div class="coach-copy">
				<div class="coach-eyebrow">Your investing coach</div>
				<h2 class="coach-title">{firstName ? `Welcome back, ${firstName}.` : 'Welcome back.'}</h2>
				<p class="coach-text">{coachTargetCopy}</p>
				<p class="coach-text coach-text--muted">{coachProgressCopy}</p>
			</div>
		</div>

		{#if hasGoalContext}
			<div class="dash-hero ly-surface ly-surface--strong">
				<div class="dash-hero-label">{goalLabel}</div>
				<div class="dash-hero-bar" aria-hidden="true">
					<div class="dash-hero-fill" style={`width:${goalProgress}%;${goalProgress > 0 ? 'min-width:10px;' : ''}`}></div>
				</div>
				<div class="dash-hero-value-row">
					<div class="dash-hero-value">{goalValueText}</div>
					<div class="dash-hero-pct">{goalProgress}%</div>
				</div>
				<div class="dash-hero-stats">{statsLine}</div>
			</div>
		{/if}

		{#if pendingEntries.length > 0}
			<div class="dashboard-pending-note">
				<strong>{pendingEntries.length} invested deal{pendingEntries.length !== 1 ? 's are' : ' is'} pending review.</strong>
				They are visible in your portfolio now and will count toward roll-up metrics after review is complete.
			</div>
		{/if}

		{#if hasGoalContext && needsPlanSetup}
			<div class="plan-cta-card ly-surface ly-surface--muted">
				<div>
					<div class="plan-cta-eyebrow">Your Plan</div>
					<div class="plan-cta-title">{$canBuildFullPlan ? 'Turn your goal into a roadmap.' : 'Review the investor profile driving your deal feed.'}</div>
					<div class="plan-cta-copy">{$canBuildFullPlan ? 'Build out your thesis, roadmap, and next best move without leaving the app shell.' : 'See your saved goal, preferences, and the upgrade path into a full plan.'}</div>
				</div>
				<a href="/app/plan" class="btn-primary plan-cta-btn">{$canBuildFullPlan ? 'Open My Plan →' : 'Review My Profile →'}</a>
			</div>
		{/if}

		<div class="dashboard-stack" data-dashboard-version="overview-cleanup-2">
			{#if primaryAction}
				<div class="action-card ly-surface">
					<div class="action-header">What To Do Next</div>
					<div class="next-action-panel">
						<div class="next-action-copy">
							<div class="next-action-kicker">Next Best Action</div>
							<div class="next-action-text">{@html primaryAction.text}</div>
						</div>
						<a href={primaryAction.href || `/app/${primaryAction.page}`} class="btn-primary next-action-btn">{primaryAction.link} →</a>
					</div>
					{#if secondaryActionItems.length > 0}
						<div class="secondary-actions-label">Also On Deck</div>
					{/if}
					{#each secondaryActionItems as item}
						<svelte:element
							this={item.action === 'modal' ? 'button' : 'a'}
							type={item.action === 'modal' ? 'button' : undefined}
							href={item.action === 'modal' ? undefined : item.href || `/app/${item.page}`}
							class={`action-row${item.action === 'modal' ? ' action-row--button' : ''}`}
							onclick={item.action === 'modal' ? openAddDealModal : undefined}
						>
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
								{:else if item.icon === 'plus'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
								{/if}
							</div>
							<div class="action-text">{@html item.text}</div>
							<span class="action-link">{item.link} →</span>
						</svelte:element>
					{/each}
				</div>
			{:else}
				<div class="empty-dashboard-card ly-surface">
					<div class="action-header">What To Do Next</div>
					<div class="empty-dashboard-title">You’re caught up for now.</div>
					<div class="empty-dashboard-copy">Use this page to launch the next meaningful action, not to monitor a bunch of dashboard metrics. Right now there isn’t anything urgent blocking you.</div>
					<div class="secondary-actions-label secondary-actions-label--standalone">Also On Deck</div>
					{#each secondaryActionItems as item}
						<svelte:element
							this={item.action === 'modal' ? 'button' : 'a'}
							type={item.action === 'modal' ? 'button' : undefined}
							href={item.action === 'modal' ? undefined : item.href || `/app/${item.page}`}
							class={`action-row${item.action === 'modal' ? ' action-row--button' : ''}`}
							onclick={item.action === 'modal' ? openAddDealModal : undefined}
						>
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
								{:else if item.icon === 'plus'}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
								{/if}
							</div>
							<div class="action-text">{@html item.text}</div>
							<span class="action-link">{item.link} →</span>
						</svelte:element>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
	</div>
</PageContainer>

{#if showAddDealModal}
	<AddDealModal
		entrySurface="dashboard"
		onclose={() => (showAddDealModal = false)}
		onsubmitted={handleDashboardDealSubmission}
	/>
{/if}

<style>
	.content-area {
		min-width: 0;
	}

	.dashboard-onboarding-card {
		max-width: 520px;
		margin: 36px 0 0;
		padding: 36px 28px;
		text-align: left;
	}
	.dashboard-onboarding-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 72px;
		height: 72px;
		margin-bottom: 24px;
		border-radius: 20px;
		background: linear-gradient(135deg, var(--primary), #2563EB);
		color: #fff;
	}
	.dashboard-onboarding-title {
		font-family: var(--font-headline);
		font-size: 30px;
		line-height: 1.25;
		color: var(--text-dark);
	}
	.dashboard-onboarding-copy {
		max-width: 420px;
		margin: 12px 0 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.65;
		color: var(--text-secondary);
	}
	.dashboard-onboarding-actions {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 14px;
		margin-top: 28px;
	}
	.dashboard-pending-note {
		margin: 18px 0 0;
		padding: 14px 18px;
		border-radius: 18px;
		background: rgba(245, 158, 11, 0.08);
		border: 1px solid rgba(245, 158, 11, 0.18);
		font-size: 14px;
		line-height: 1.6;
		color: #7c5a00;
	}
	.dashboard-onboarding-link {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}
	.coach-card {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 18px;
		padding: 22px 24px;
		margin-bottom: 18px;
	}
	.coach-copy {
		max-width: 680px;
	}
	.coach-eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.2px;
		text-transform: uppercase;
		color: var(--primary);
	}
	.coach-title {
		margin: 10px 0 0;
		font-family: var(--font-headline);
		font-size: 30px;
		line-height: 1.12;
		color: var(--text-dark);
	}
	.coach-text {
		margin: 12px 0 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-dark);
	}
	.coach-text--muted {
		color: var(--text-secondary);
	}
	.coach-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
		flex-shrink: 0;
	}
	.coach-primary {
		white-space: nowrap;
	}
	.coach-secondary {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 10px 0;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-secondary);
		text-decoration: none;
	}

	.dash-hero {
		padding: 34px 36px 24px;
		margin-bottom: 22px;
	}
	.dash-hero-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.6px;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 20px;
	}
	.dash-hero-bar {
		height: 12px;
		background: var(--border-light);
		border-radius: 999px;
		overflow: hidden;
	}
	.dash-hero-fill {
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, #4db870, #45b86e);
		transition: width 0.6s ease;
	}
	.dash-hero-value-row {
		display: flex;
		align-items: baseline;
		flex-wrap: wrap;
		gap: 12px;
		margin-top: 12px;
	}
	.dash-hero-value {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		line-height: 1.2;
		color: var(--text-dark);
	}
	.dash-hero-pct {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--primary);
	}
	.dash-hero-stats {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		margin-bottom: 0;
		padding-top: 18px;
		border-top: 1px solid var(--border-light);
		margin-top: 18px;
	}

	.plan-cta-card {
		padding: 20px 18px;
		margin-bottom: 18px;
	}
	.plan-cta-card {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}
	.plan-cta-eyebrow,
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

	.dashboard-stack {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	/* ── Action Items ── */
	.action-card {
		overflow: hidden;
	}
	.action-header {
		padding: 16px 16px 0;
		margin-bottom: 12px;
	}
	.next-action-panel {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		padding: 0 16px 16px;
		flex-wrap: wrap;
	}
	.next-action-copy {
		flex: 1;
		min-width: 220px;
	}
	.next-action-kicker,
	.secondary-actions-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}
	.next-action-text {
		margin-top: 8px;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.6;
		color: var(--text-dark);
	}
	.next-action-text :global(strong) {
		font-weight: 700;
	}
	.next-action-btn {
		flex-shrink: 0;
	}
	.secondary-actions-label {
		padding: 0 16px 8px;
	}
	.secondary-actions-label--standalone {
		padding-top: 18px;
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
	.action-row--button {
		width: 100%;
		border: none;
		background: transparent;
		text-align: left;
		font: inherit;
		color: inherit;
	}
	.action-row:last-child { border-bottom: none; }
	.action-row:hover { background: var(--surface-2); }
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
	.empty-dashboard-card {
		padding: 0 0 18px;
	}
	.empty-dashboard-title {
		padding: 0 16px;
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-dark);
	}
	.empty-dashboard-copy {
		padding: 8px 16px 0;
		max-width: 640px;
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
	}
	.empty-dashboard-actions {
		display: flex;
		align-items: center;
		gap: 14px;
		flex-wrap: wrap;
		padding: 18px 16px 0;
	}

	/* ── Mobile Responsive ── */
	@media (max-width: 768px) {
		.coach-card {
			flex-direction: column;
			padding: 20px 18px;
			margin-bottom: 16px;
		}
		.coach-title {
			font-size: 24px;
		}
		.coach-actions {
			width: 100%;
			flex-direction: column;
			align-items: stretch;
		}
		.coach-primary,
		.coach-secondary {
			width: 100%;
			text-align: center;
		}
		.dashboard-onboarding-card {
			margin-top: 20px;
			padding: 28px 20px;
		}
		.dashboard-onboarding-title {
			font-size: 24px;
		}
		.dash-hero {
			padding: 24px 18px 18px;
		}
		.dash-hero-value {
			font-size: 16px;
		}
		.dash-hero-stats {
			font-size: 12px;
		}
		.plan-cta-card { padding: 18px 16px; }
		.next-action-panel {
			align-items: flex-start;
		}
		.next-action-btn {
			width: 100%;
			text-align: center;
		}
	}
</style>
