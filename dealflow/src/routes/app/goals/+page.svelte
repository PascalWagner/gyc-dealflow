<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { deals, dealStages } from '$lib/stores/deals.js';
	import GoalProgress from '$lib/components/GoalProgress.svelte';

	let investorGoals = $state(null);
	let portfolio = $state([]);
	let showWizard = $derived(!investorGoals);

	// Wizard form values
	let goalType = $state('passive_income');
	let currentIncome = $state(0);
	let targetIncome = $state(100000);
	let capital = $state('$500k - $999k');
	let checkSize = $state(100000);
	let timeline = $state(5);
	let taxReduction = $state(0);

	// Derived calculations
	const gap = $derived(investorGoals ? investorGoals.targetIncome - investorGoals.currentIncome : targetIncome - currentIncome);
	const progress = $derived(investorGoals && investorGoals.targetIncome > 0 ? Math.min(100, Math.round((investorGoals.currentIncome / investorGoals.targetIncome) * 100)) : 0);

	const pTotalInvested = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.amountInvested) || 0), 0));
	const pTotalDist = $derived(portfolio.reduce((s, i) => s + (parseFloat(i.distributionsReceived) || 0), 0));
	const actualYield = $derived(pTotalInvested > 0 && pTotalDist > 0 ? pTotalDist / pTotalInvested : 0);
	const avgYield = $derived(actualYield > 0.02 ? actualYield : 0.08);
	const capitalNeeded = $derived(investorGoals ? (gap > 0 ? Math.round(gap / avgYield) : 0) : 0);
	const dealsNeeded = $derived(capitalNeeded > 0 ? Math.ceil(capitalNeeded / 100000) : 0);

	// Scenarios for "how to get there"
	const scenarios = [
		{ label: 'Conservative (6% yield)', yield: 0.06, color: '#6b7280' },
		{ label: 'Moderate (8% yield)', yield: 0.08, color: '#3b82f6' },
		{ label: 'Aggressive (10% yield)', yield: 0.10, color: 'var(--primary)' }
	];

	// Year-by-year roadmap
	const roadmapYears = $derived(investorGoals ? parseInt(investorGoals.timeline) || 5 : timeline);
	const annualDeploy = $derived(capitalNeeded > 0 ? Math.round(capitalNeeded / roadmapYears) : 0);
	const annualDeals = $derived(annualDeploy > 0 ? Math.ceil(annualDeploy / 100000) : 0);

	let saving = $state(false);
	let saveMsg = $state('');

	function getToken() {
		if (!browser) return null;
		return localStorage.getItem('sb_token') || localStorage.getItem('ghlToken') || JSON.parse(localStorage.getItem('gycUser') || '{}').token || null;
	}

	async function saveGoals() {
		saving = true;
		saveMsg = '';
		investorGoals = {
			type: goalType,
			currentIncome: parseFloat(currentIncome) || 0,
			targetIncome: parseFloat(targetIncome) || 100000,
			capital: capital,
			checkSize: parseFloat(checkSize) || 100000,
			timeline: parseInt(timeline) || 5,
			taxReduction: parseFloat(taxReduction) || 0,
			createdAt: new Date().toISOString()
		};
		if (browser) localStorage.setItem('gycGoals', JSON.stringify(investorGoals));
		try {
			const token = getToken();
			if (token) {
				const resp = await fetch('/api/userdata', {
					method: 'POST',
					headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
					body: JSON.stringify({
						type: 'goals',
						data: {
							'Goal Type': investorGoals.type,
							'Current Income': investorGoals.currentIncome,
							'Target Income': investorGoals.targetIncome,
							'Capital Available': investorGoals.capital,
							'Timeline': investorGoals.timeline,
							'Tax Reduction': investorGoals.taxReduction
						}
					})
				});
				if (resp.ok) {
					saveMsg = 'Goals saved';
				} else {
					saveMsg = 'Saved locally (sync pending)';
				}
			} else {
				saveMsg = 'Goals saved locally';
			}
		} catch (e) {
			console.warn('Goals sync failed:', e);
			saveMsg = 'Saved locally (sync pending)';
		}
		saving = false;
		setTimeout(() => saveMsg = '', 3000);
	}

	function editGoals() {
		if (investorGoals) {
			goalType = investorGoals.type || 'passive_income';
			currentIncome = investorGoals.currentIncome || 0;
			targetIncome = investorGoals.targetIncome || 100000;
			capital = investorGoals.capital || '$500k - $999k';
			checkSize = investorGoals.checkSize || 100000;
			timeline = investorGoals.timeline || 5;
			taxReduction = investorGoals.taxReduction || 0;
		}
		investorGoals = null;
	}

	function populateFormFromGoals(g) {
		if (!g) return;
		goalType = g.type || g['Goal Type'] || 'passive_income';
		currentIncome = g.currentIncome || g['Current Income'] || 0;
		targetIncome = g.targetIncome || g['Target Income'] || 100000;
		capital = g.capital || g['Capital Available'] || '$500k - $999k';
		checkSize = g.checkSize || 100000;
		timeline = g.timeline || g['Timeline'] || 5;
		taxReduction = g.taxReduction || g['Tax Reduction'] || 0;
	}

	onMount(async () => {
		if (!browser) return;
		// Load from localStorage first for fast render
		investorGoals = JSON.parse(localStorage.getItem('gycGoals') || 'null');
		portfolio = JSON.parse(localStorage.getItem('gycPortfolio') || '[]');
		if (investorGoals) populateFormFromGoals(investorGoals);

		// Then try to load from API
		try {
			const token = getToken();
			if (token) {
				const resp = await fetch('/api/userdata?type=goals', {
					headers: { 'Authorization': 'Bearer ' + token }
				});
				if (resp.ok) {
					const data = await resp.json();
					if (data && (data.goals || data.data)) {
						const apiGoals = data.goals || data.data;
						if (apiGoals && Object.keys(apiGoals).length > 0) {
							// Normalize API response to our format
							const normalized = {
								type: apiGoals['Goal Type'] || apiGoals.type || 'passive_income',
								currentIncome: parseFloat(apiGoals['Current Income'] || apiGoals.currentIncome) || 0,
								targetIncome: parseFloat(apiGoals['Target Income'] || apiGoals.targetIncome) || 100000,
								capital: apiGoals['Capital Available'] || apiGoals.capital || '$500k - $999k',
								checkSize: parseFloat(apiGoals.checkSize) || 100000,
								timeline: parseInt(apiGoals['Timeline'] || apiGoals.timeline) || 5,
								taxReduction: parseFloat(apiGoals['Tax Reduction'] || apiGoals.taxReduction) || 0,
								createdAt: apiGoals.createdAt || new Date().toISOString()
							};
							investorGoals = normalized;
							localStorage.setItem('gycGoals', JSON.stringify(normalized));
							populateFormFromGoals(normalized);
						}
					}
				}
			}
		} catch (e) {
			console.warn('Failed to load goals from API:', e);
		}
	});
</script>

<div class="topbar">
	<button class="mobile-menu-btn" onclick={() => document.getElementById('sidebar')?.classList.toggle('open')}>
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
	</button>
	<div class="topbar-title">My Goals</div>
</div>

{#if showWizard}
	<!-- Goals Wizard -->
	<div class="wizard-container">
		<div class="wizard-inner">
			<div class="wizard-header">
				<div class="wizard-icon">🎯</div>
				<h1>Set Your Investment Goals</h1>
				<p>Let's build a plan to grow your passive income. We'll show you exactly what it takes to get there.</p>
			</div>
			<div class="wizard-form">
				<div class="field">
					<label>What's your primary goal?</label>
					<select bind:value={goalType}>
						<option value="passive_income">Grow Passive Income</option>
						<option value="reduce_taxes">Reduce Taxable Income</option>
						<option value="build_wealth">Build Long-Term Wealth</option>
					</select>
				</div>
				<div class="field">
					<label>Current Annual Passive Income ($)</label>
					<input type="number" bind:value={currentIncome}>
				</div>
				<div class="field">
					<label>Target Annual Passive Income ($)</label>
					<input type="number" bind:value={targetIncome}>
				</div>
				<div class="field">
					<label>Capital Available to Invest</label>
					<select bind:value={capital}>
						<option>&lt;$100k</option>
						<option>$100k - $249k</option>
						<option>$249k - $499k</option>
						<option value="$500k - $999k">$500k - $999k</option>
						<option>$1M+</option>
					</select>
				</div>
				<div class="field">
					<label>Maximum Check Size Per Deal ($)</label>
					<input type="number" bind:value={checkSize}>
					<div class="field-hint">How much would you invest in a single deal?</div>
				</div>
				<div class="field">
					<label>Target Timeline (Years)</label>
					<select bind:value={timeline}>
						<option value={3}>3 years</option>
						<option value={5}>5 years</option>
						<option value={7}>7 years</option>
						<option value={10}>10 years</option>
					</select>
				</div>
				<div class="field">
					<label>Annual Taxable Income to Reduce ($, optional)</label>
					<input type="number" bind:value={taxReduction} placeholder="0">
				</div>
				<button class="btn-submit" onclick={saveGoals} disabled={saving}>
				{saving ? 'Saving...' : 'Build My Plan →'}
			</button>
			{#if saveMsg}
				<div class="save-toast">{saveMsg}</div>
			{/if}
			</div>
		</div>
	</div>
{:else}
	<!-- Goals Dashboard -->
	<div class="goals-dashboard">
		<div class="goals-top">
			<div>
				<h2>Your Investment Plan</h2>
				<div class="goals-subtitle">Target: ${investorGoals.targetIncome.toLocaleString()}/yr passive income in {investorGoals.timeline} years</div>
			</div>
			<button class="btn-edit" onclick={editGoals}>Edit Goals</button>
		</div>

		<!-- Progress Bar -->
		<div class="card">
			<div class="progress-header">
				<div class="progress-label">Progress to ${investorGoals.targetIncome.toLocaleString()}/yr</div>
				<div class="progress-pct">{progress}%</div>
			</div>
			<div class="progress-bar"><div class="progress-fill" style="width:{progress}%;{progress > 0 ? 'min-width:4px' : ''}"></div></div>
			<div class="progress-footer">
				<span>Current: ${investorGoals.currentIncome.toLocaleString()}/yr</span>
				<span>Gap: ${gap.toLocaleString()}/yr</span>
				<span>Target: ${investorGoals.targetIncome.toLocaleString()}/yr</span>
			</div>
		</div>

		<!-- Key Metrics -->
		<div class="metrics-grid">
			<div class="metric-card">
				<div class="metric-label">Capital Needed</div>
				<div class="metric-value">${capitalNeeded.toLocaleString()}</div>
				<div class="metric-sub">at ~8% avg cash yield</div>
			</div>
			<div class="metric-card">
				<div class="metric-label">Capital Available</div>
				<div class="metric-value primary">{investorGoals.capital}</div>
			</div>
			<div class="metric-card">
				<div class="metric-label">Est. Deals Needed</div>
				<div class="metric-value">{dealsNeeded}</div>
				<div class="metric-sub">at ~$100K per deal</div>
			</div>
			<div class="metric-card">
				<div class="metric-label">Currently Invested</div>
				<div class="metric-value">${pTotalInvested.toLocaleString()}</div>
				<div class="metric-sub">{portfolio.length} investment{portfolio.length !== 1 ? 's' : ''}</div>
			</div>
		</div>

		<!-- How to Reach Goal -->
		<div class="card">
			<div class="card-title">How to Reach ${investorGoals.targetIncome.toLocaleString()}/yr in Passive Income</div>
			<div class="scenarios-grid">
				{#each scenarios as s}
					{@const needed = Math.round(gap / s.yield)}
					{@const numDeals5 = Math.ceil(needed / 200000)}
					{@const numDeals3 = Math.ceil(needed / 100000)}
					<div class="scenario" style="border-left:4px solid {s.color}">
						<div class="scenario-title">{s.label}</div>
						<div class="scenario-body">
							<div>Capital needed: <strong>${needed.toLocaleString()}</strong></div>
							<div>{numDeals5} deals at $200K each</div>
							<div>or {numDeals3} deals at $100K each</div>
							<div class="scenario-result">= <strong>${Math.round(gap).toLocaleString()}/yr</strong> passive income</div>
						</div>
					</div>
				{/each}
			</div>

			{#if investorGoals.taxReduction > 0}
				<div class="tax-goal-card">
					<div class="tax-goal-title">Tax Reduction Goal: ${investorGoals.taxReduction.toLocaleString()}</div>
					<div class="tax-goal-body">
						Look for deals with <strong>bonus depreciation</strong> or <strong>cost segregation</strong>. You may need <strong>${Math.round(investorGoals.taxReduction / 0.6).toLocaleString()}</strong> invested in high-depreciation deals.
					</div>
				</div>
			{/if}
		</div>

		<!-- Year-by-Year Roadmap -->
		<div class="card">
			<div class="card-title">Your {roadmapYears}-Year Roadmap</div>
			<div class="roadmap">
				{#each Array(roadmapYears) as _, y}
					{@const year = y + 1}
					{@const cumCapital = Math.min(capitalNeeded, annualDeploy * year)}
					{@const cumIncome = Math.round(cumCapital * avgYield)}
					{@const pct = gap > 0 ? Math.round((cumIncome / gap) * 100) : 0}
					{@const isFinal = year === roadmapYears}
					<div class="roadmap-item" class:last={isFinal}>
						<div class="roadmap-marker">
							<div class="roadmap-dot" class:final={isFinal}>Y{year}</div>
							{#if !isFinal}<div class="roadmap-line"></div>{/if}
						</div>
						<div class="roadmap-content">
							<div class="roadmap-header">
								<div class="roadmap-year">Year {year}{isFinal ? ' — Goal Reached!' : ''}</div>
								<div class="roadmap-pct" class:final={isFinal}>{pct}%</div>
							</div>
							<div class="roadmap-bar"><div class="roadmap-fill" style="width:{Math.min(100, pct)}%;background:{isFinal ? 'var(--primary)' : '#3b82f6'}"></div></div>
							<div class="roadmap-desc">Deploy <strong>${annualDeploy.toLocaleString()}</strong> across ~{annualDeals} deals → <strong>${cumIncome.toLocaleString()}/yr</strong> passive income</div>
						</div>
					</div>
				{/each}
			</div>
			<div class="roadmap-summary">
				<div class="rm-stat"><div class="rm-label">Deploy Per Year</div><div class="rm-value">${annualDeploy.toLocaleString()}</div></div>
				<div class="rm-stat"><div class="rm-label">Deploy Per Quarter</div><div class="rm-value">${Math.round(annualDeploy / 4).toLocaleString()}</div></div>
				<div class="rm-stat"><div class="rm-label">Deals Per Year</div><div class="rm-value">{annualDeals}</div></div>
				<div class="rm-stat"><div class="rm-label">Avg Per Deal</div><div class="rm-value">$100K</div></div>
			</div>
		</div>
	</div>
{/if}

<style>
	.topbar { display: flex; align-items: center; gap: 12px; padding: 16px 24px; border-bottom: 1px solid var(--border); background: var(--bg-card); position: sticky; top: 0; z-index: 10; }
	.mobile-menu-btn { display: none; background: none; border: none; cursor: pointer; padding: 4px; }
	.mobile-menu-btn svg { width: 22px; height: 22px; }
	.topbar-title { font-family: var(--font-ui); font-size: 16px; font-weight: 800; color: var(--text-dark); }

	/* Wizard */
	.wizard-container { max-width: 600px; margin: 40px auto; padding: 0 24px; }
	.wizard-inner { }
	.wizard-header { text-align: center; margin-bottom: 32px; }
	.wizard-icon { font-size: 48px; margin-bottom: 12px; }
	.wizard-header h1 { font-family: var(--font-headline); font-size: 28px; font-weight: 400; color: var(--text-dark); margin: 0 0 8px; }
	.wizard-header p { font-size: 14px; color: var(--text-secondary); margin: 0; }
	.wizard-form { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; }
	.field { margin-bottom: 20px; }
	.field label { display: block; font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 6px; }
	.field input, .field select { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 14px; box-sizing: border-box; }
	.field-hint { font-size: 11px; color: var(--text-muted); margin-top: 4px; }
	.btn-submit { width: 100%; padding: 14px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 700; font-size: 15px; cursor: pointer; margin-top: 4px; }
	.btn-submit:disabled { opacity: 0.6; cursor: not-allowed; }
	.save-toast { margin-top: 12px; padding: 10px 16px; background: #F0F9F4; border-radius: 8px; font-family: var(--font-ui); font-size: 13px; color: #059669; font-weight: 600; text-align: center; }

	/* Dashboard */
	.goals-dashboard { padding: 0 24px 40px; max-width: 900px; margin: 0 auto; }
	.goals-top { display: flex; justify-content: space-between; align-items: center; margin: 24px 0; }
	.goals-top h2 { font-family: var(--font-headline); font-size: 24px; font-weight: 400; color: var(--text-dark); margin: 0; }
	.goals-subtitle { font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
	.btn-edit { padding: 6px 14px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-weight: 600; font-size: 11px; cursor: pointer; color: var(--text-secondary); }

	.card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 28px; margin-bottom: 24px; }
	.card-title { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 16px; }

	.progress-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; }
	.progress-label { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.progress-pct { font-size: 28px; font-weight: 800; color: var(--primary); }
	.progress-bar { height: 16px; background: var(--bg-main); border-radius: 8px; overflow: hidden; margin-bottom: 16px; }
	.progress-fill { height: 100%; background: linear-gradient(90deg, var(--primary), #3bba78); border-radius: 8px; transition: width 0.6s ease; }
	.progress-footer { display: flex; justify-content: space-between; font-size: 12px; color: var(--text-muted); }

	.metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 24px; }
	.metric-card { background: var(--bg-card); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; text-align: center; }
	.metric-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
	.metric-value { font-size: 28px; font-weight: 800; color: var(--text-dark); }
	.metric-value.primary { color: var(--primary); }
	.metric-sub { font-size: 11px; color: var(--text-muted); margin-top: 4px; }

	.scenarios-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; }
	.scenario { padding: 20px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
	.scenario-title { font-weight: 700; font-size: 13px; color: var(--text-dark); margin-bottom: 12px; }
	.scenario-body { font-size: 11px; color: var(--text-secondary); line-height: 1.8; }
	.scenario-result { margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border); color: var(--text-muted); }

	.tax-goal-card { margin-top: 16px; padding: 16px; background: var(--bg-main); border-radius: var(--radius-sm); border-left: 4px solid #f59e0b; }
	.tax-goal-title { font-weight: 700; font-size: 13px; color: var(--text-dark); margin-bottom: 6px; }
	.tax-goal-body { font-size: 12px; color: var(--text-secondary); line-height: 1.6; }

	/* Roadmap */
	.roadmap { display: flex; flex-direction: column; }
	.roadmap-item { display: flex; align-items: flex-start; gap: 16px; position: relative; }
	.roadmap-item:not(.last) { padding-bottom: 20px; }
	.roadmap-marker { display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
	.roadmap-dot { width: 32px; height: 32px; border-radius: 50%; background: var(--bg-main); border: 2px solid var(--border); display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; color: var(--text-dark); position: relative; z-index: 1; }
	.roadmap-dot.final { background: var(--primary); border-color: var(--primary); color: #fff; }
	.roadmap-line { width: 2px; flex: 1; background: var(--border); min-height: 20px; }
	.roadmap-content { flex: 1; padding-top: 4px; }
	.roadmap-header { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px; }
	.roadmap-year { font-weight: 700; font-size: 13px; color: var(--text-dark); }
	.roadmap-pct { font-size: 12px; font-weight: 700; color: var(--text-secondary); }
	.roadmap-pct.final { color: var(--primary); }
	.roadmap-bar { height: 8px; background: var(--bg-main); border-radius: 4px; overflow: hidden; margin-bottom: 6px; }
	.roadmap-fill { height: 100%; border-radius: 4px; }
	.roadmap-desc { font-size: 11px; color: var(--text-muted); line-height: 1.6; }

	.roadmap-summary { margin-top: 16px; padding: 16px; background: var(--bg-main); border-radius: var(--radius-sm); display: flex; gap: 24px; flex-wrap: wrap; }
	.rm-stat { flex: 1; min-width: 140px; }
	.rm-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
	.rm-value { font-size: 20px; font-weight: 800; color: var(--text-dark); }

	@media (min-width: 769px) and (max-width: 1024px) {
		.topbar { padding: 16px 24px; }
		.wizard-container { padding: 0 24px; }
		.goals-dashboard { padding: 0 24px 40px; }
		.metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	@media (max-width: 768px) {
		.mobile-menu-btn { display: block; }
		.goals-dashboard { padding: 0 16px 40px; }
		.metrics-grid { grid-template-columns: repeat(2, 1fr); }
		.scenarios-grid { grid-template-columns: 1fr; }
		.roadmap-summary { flex-direction: column; gap: 12px; }
	}
</style>
