<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { deals, dealStages, stageCounts, fetchDeals } from '$lib/stores/deals.js';
	import { user } from '$lib/stores/auth.js';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';

	// Local state
	let portfolio = $state([]);
	let wizardData = $state({});
	let goals = $state(null);
	let distributions = $state([]);
	let portfolioPlan = $state(null);

	// Derived
	const branch = $derived(wizardData._branch || '');
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

	const dealsReviewed = $derived(Object.keys($dealStages).length);

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
			const stage = $dealStages[deal.id] || 'filter';
			return stage !== 'skipped' && slotMatchesDeal(nextPlanSlot, deal);
		}).length;
	});

	const actionItems = $derived.by(() => {
		const items = [];
		const review = $stageCounts.review || 0;
		const connect = $stageCounts.connect || 0;
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

		if (review > 0) {
			items.push({
				icon: 'bookmark',
				text: `You have <strong>${review} deal${review !== 1 ? 's' : ''} to review</strong> — pick one and work through the checklist`,
				link: 'Review Deals', page: 'deals'
			});
		}
		if (connect > 0) {
			items.push({
				icon: 'connect',
				text: `<strong>${connect} deal${connect !== 1 ? 's' : ''} ready to connect</strong> — request an intro with the operator`,
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
						link: 'Open Tax Docs',
						page: 'portfolio',
						href: '/app/portfolio#tax-documents'
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

	function parseDollar(s) {
		if (typeof s === 'number') return s;
		if (!s) return 0;
		return parseInt(String(s).replace(/[$,\s]/g, ''), 10) || 0;
	}

	function fmtDollar(n) {
		if (!n || isNaN(n)) return '$0';
		if (n >= 1000000) return '$' + (n / 1000000).toFixed(1) + 'M';
		return '$' + n.toLocaleString();
	}

	function openWizard() {
		goto(hasPlan ? '/app/plan?edit=1' : '/onboarding/plan');
	}

	onMount(() => {
		if (!browser) return;
		portfolio = JSON.parse(localStorage.getItem('gycPortfolio') || '[]');
		wizardData = JSON.parse(localStorage.getItem('gycBuyBoxWizard') || '{}');
		goals = JSON.parse(localStorage.getItem('gycGoals') || 'null');
		distributions = JSON.parse(localStorage.getItem('gycDistributions') || '[]');
		portfolioPlan = JSON.parse(localStorage.getItem('gycPortfolioPlan') || 'null');
	});

	onMount(() => {
		fetchDeals().catch(() => {});
	});
</script>

<PageContainer className="dashboard-shell ly-page-stack">
	<PageHeader title="Dashboard" className="dashboard-page-header">
		<nav slot="secondaryRow" class="ly-dashboard-tabs" aria-label="Dashboard sections">
			<a href="/app/dashboard" class="ly-dashboard-tab active">Overview</a>
			<a href="/app/portfolio" class="ly-dashboard-tab">Portfolio</a>
			<a href="/app/plan" class="ly-dashboard-tab">My Plan</a>
		</nav>
	</PageHeader>

	<div class="content-area">
		{#if !hasOnboarding && dealsReviewed === 0 && portfolio.length === 0}
			<div class="dashboard-onboarding-card">
				<div class="dashboard-onboarding-icon">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="32" height="32"><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/></svg>
				</div>
				<div class="dashboard-onboarding-title">{firstName ? `${firstName}, set up your investment plan.` : 'Set up your investment plan.'}</div>
				<div class="dashboard-onboarding-copy">Get your preferences in place in a couple of minutes so the dashboard, deal flow, and portfolio all reflect what you are actually trying to buy.</div>
				<div class="dashboard-onboarding-actions">
					<button class="btn-primary" onclick={openWizard}>Get Started →</button>
					<a href="/app/deals" class="dashboard-onboarding-link">Browse deals first</a>
				</div>
			</div>
		{:else}
		<!-- Hero Progress Card -->
		{#if hasOnboarding}
			<div class="dash-hero">
				<div class="dash-hero-label">{goalLabel}</div>
				<div class="dash-hero-bar" aria-hidden="true">
					<div class="dash-hero-fill" style={`width:${goalProgress}%;${goalProgress > 0 ? 'min-width:10px;' : ''}`}></div>
				</div>
				<div class="dash-hero-value-row">
					<div class="dash-hero-value">{goalValueText}</div>
					<div class="dash-hero-pct">{goalProgress}%</div>
				</div>
				<div class="dash-hero-stats">{statsLine}{slotLine}</div>
			</div>
			{:else}
				<div class="plan-empty-card">
					<div class="plan-empty-icon">📋</div>
					<div class="plan-empty-title">You don't have a plan yet.</div>
					<div class="plan-empty-copy">Members with a plan deploy an average of $150K in their first 90 days. Takes 3 minutes.</div>
					<a href="/onboarding/plan" class="btn-primary plan-empty-btn">Build My Plan</a>
				</div>
			{/if}

		{#if hasPlan}
			<div class="blueprint-card">
				<div class="blueprint-header">
					<div class="blueprint-eyebrow">Your Investment Plan</div>
					<a href="/app/plan?edit=1" class="blueprint-link">Edit Plan</a>
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
				<a href="/onboarding/plan" class="btn-primary plan-cta-btn">Build My Plan →</a>
			</div>
		{/if}

		<div class="dashboard-stack" data-dashboard-version="overview-cleanup-2">
			{#if actionItems.length > 0}
				<div class="action-card">
					<div class="action-header">Action Items</div>
					{#each actionItems as item}
						<a href={item.href || `/app/${item.page}`} class="action-row">
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
		</div>
	{/if}
	</div>
</PageContainer>

<style>
	.content-area {
		min-width: 0;
	}

	.dashboard-onboarding-card {
		max-width: 520px;
		margin: 36px auto 0;
		padding: 36px 28px;
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		text-align: center;
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
		margin: 12px auto 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.65;
		color: var(--text-secondary);
	}
	.dashboard-onboarding-actions {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 14px;
		margin-top: 28px;
	}
	.dashboard-onboarding-link {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
	}

	/* ── Empty Plan Card ── */
	.plan-empty-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		padding: 24px 24px;
		margin-bottom: 20px;
	}
	.plan-empty-icon {
		font-size: 28px;
		line-height: 1;
		margin-bottom: 16px;
	}
	.plan-empty-title {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 8px;
	}
	.plan-empty-copy {
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
		max-width: 520px;
	}
	.plan-empty-btn {
		display: inline-flex;
		margin-top: 20px;
		text-decoration: none;
	}

	/* ── Hero Progress Card ── */
	.dash-hero {
		background: #fff;
		border: 1px solid #d4dee3;
		border-radius: 14px;
		box-shadow: 0 2px 10px rgba(16, 24, 40, 0.05);
		padding: 34px 36px 24px;
		margin-bottom: 22px;
	}
	.dash-hero-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.6px;
		text-transform: uppercase;
		color: #8a9aa0;
		margin-bottom: 20px;
	}
	.dash-hero-bar {
		height: 12px;
		background: #e8eef1;
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
		color: #8a9aa0;
		margin-bottom: 0;
		padding-top: 18px;
		border-top: 1px solid #e6ecef;
		margin-top: 18px;
	}

	/* ── Plan Blueprint ── */
	.plan-cta-card,
	.blueprint-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
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

	.dashboard-stack {
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	/* ── Action Items ── */
	.action-card {
		background: var(--bg-card);
		border: 1px solid var(--border);
		border-radius: var(--radius);
		overflow: hidden;
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

	@media (min-width: 769px) and (max-width: 1024px) {
		.dash-hero {
			padding: 30px 28px 22px;
		}
	}

	/* ── Mobile Responsive ── */
	@media (max-width: 768px) {
		.dashboard-onboarding-card {
			margin-top: 20px;
			padding: 28px 20px;
		}
		.dashboard-onboarding-title {
			font-size: 24px;
		}
		.dash-hero { padding: 24px 18px 18px; }
		.dash-hero-value { font-size: 16px; }
		.dash-hero-stats { font-size: 12px; }
		.plan-cta-card,
		.blueprint-card { padding: 18px 16px; }
		.blueprint-next { padding: 14px; }
	}
</style>
