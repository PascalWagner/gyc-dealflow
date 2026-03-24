<script>
	import { onMount } from 'svelte';
	import { user, isLoggedIn, userToken, userTier, isAcademy } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';

	let hasPlan = $state(false);
	let loading = $state(true);
	let plan = $state(null);

	const isPaid = $derived($userTier !== 'free' || $isAcademy);

	onMount(async () => {
		if (!browser) return;
		try {
			const stored = JSON.parse(localStorage.getItem('gycUser') || '{}');
			if (!stored?.token) { loading = false; return; }
			const res = await fetch('/api/buy-box?email=' + encodeURIComponent(stored.email), {
				headers: { 'Authorization': 'Bearer ' + stored.token }
			});
			if (res.ok) {
				const data = await res.json();
				if (data && data.buyBox && Object.keys(data.buyBox).length > 0) {
					plan = data.buyBox;
					hasPlan = true;
				}
			}
		} catch (e) {
			console.warn('Failed to load plan:', e);
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head><title>My Plan | GYC</title></svelte:head>

<div class="plan-page">
	<div class="dash-tabs">
		<a href="/app/dashboard" class="dash-tab">Overview</a>
		<a href="/app/portfolio" class="dash-tab">Portfolio</a>
		<a class="dash-tab active" href="/app/plan">My Plan</a>
	</div>

	{#if loading}
		<div class="loading">Loading your plan...</div>
	{:else if !hasPlan}
		<div class="empty-state">
			<div class="empty-icon">📋</div>
			<div class="empty-title">You don't have a plan yet.</div>
			<div class="empty-desc">Members with a plan deploy an average of $150K in their first 90 days. Takes 3 minutes.</div>
			<a href="/app/dashboard" class="btn-cta">Build My Plan</a>
		</div>
	{:else}
		<div class="plan-content">
			<h2>Your Investment Plan</h2>
			{#if plan.goal}
				<div class="plan-section">
					<div class="plan-label">Goal</div>
					<div class="plan-value">{plan.goal}</div>
				</div>
			{/if}
			{#if plan.targetIncome}
				<div class="plan-section">
					<div class="plan-label">Target Monthly Income</div>
					<div class="plan-value">${Number(plan.targetIncome).toLocaleString()}/mo</div>
				</div>
			{/if}
			{#if plan.investableCapital}
				<div class="plan-section">
					<div class="plan-label">Investable Capital</div>
					<div class="plan-value">${Number(plan.investableCapital).toLocaleString()}</div>
				</div>
			{/if}
			{#if plan.assetClasses?.length}
				<div class="plan-section">
					<div class="plan-label">Preferred Asset Classes</div>
					<div class="plan-tags">
						{#each plan.assetClasses as ac}
							<span class="plan-tag">{ac}</span>
						{/each}
					</div>
				</div>
			{/if}
			{#if plan.dealTypes?.length}
				<div class="plan-section">
					<div class="plan-label">Preferred Deal Types</div>
					<div class="plan-tags">
						{#each plan.dealTypes as dt}
							<span class="plan-tag">{dt}</span>
						{/each}
					</div>
				</div>
			{/if}

			{#if !isPaid}
				<div class="gate-overlay">
					<div class="gate-card">
						<div class="gate-icon">🔒</div>
						<div class="gate-title">Unlock Your Full Plan</div>
						<div class="gate-desc">Academy members get a personalized deployment timeline with slot-by-slot recommendations.</div>
						<a href="/app/academy" class="btn-cta">Learn More</a>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.plan-page { padding: 20px 24px; max-width: 900px; }
	.dash-tabs { display: flex; gap: 4px; margin-bottom: 24px; }
	.dash-tab {
		padding: 8px 16px; border-radius: 8px; font-family: var(--font-ui);
		font-size: 13px; font-weight: 600; text-decoration: none;
		color: var(--text-muted); transition: all 0.15s;
	}
	.dash-tab:hover { color: var(--text-dark); background: rgba(0,0,0,0.04); }
	.dash-tab.active { background: var(--primary); color: #fff; }

	.loading { text-align: center; padding: 80px 20px; font-family: var(--font-ui); color: var(--text-muted); }

	.empty-state {
		text-align: center; padding: 80px 32px;
		display: flex; flex-direction: column; align-items: center; gap: 8px;
	}
	.empty-icon { font-size: 48px; opacity: 0.3; margin-bottom: 8px; }
	.empty-title { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); }
	.empty-desc { font-family: var(--font-body); font-size: 14px; color: var(--text-muted); max-width: 400px; margin-bottom: 16px; }
	.btn-cta {
		display: inline-block; padding: 14px 32px; background: var(--primary);
		color: #fff; border-radius: var(--radius-sm); font-family: var(--font-ui);
		font-size: 14px; font-weight: 700; text-decoration: none;
	}

	.plan-content { }
	h2 { font-family: var(--font-headline); font-size: 20px; font-weight: 800; color: var(--text-dark); margin: 0 0 24px; }
	.plan-section {
		padding: 16px 0; border-bottom: 1px solid var(--border-light);
	}
	.plan-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
	.plan-value { font-family: var(--font-ui); font-size: 18px; font-weight: 700; color: var(--text-dark); }
	.plan-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
	.plan-tag {
		padding: 4px 10px; border-radius: 6px; font-family: var(--font-ui);
		font-size: 12px; font-weight: 600; background: rgba(44,110,73,0.08); color: #2C6E49;
	}

	.gate-overlay {
		margin-top: 32px; padding: 32px; background: var(--bg-card);
		border: 2px dashed var(--border-light); border-radius: var(--radius-sm); text-align: center;
	}
	.gate-icon { font-size: 32px; margin-bottom: 12px; }
	.gate-title { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-dark); margin-bottom: 8px; }
	.gate-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-muted); margin-bottom: 16px; }

	@media (max-width: 768px) {
		.plan-page { padding: 16px; }
	}
</style>
