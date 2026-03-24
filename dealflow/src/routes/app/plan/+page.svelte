<script>
	import { onMount } from 'svelte';
	import { user, isLoggedIn, userToken, userTier, isAcademy } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';

	let hasPlan = $state(false);
	let loading = $state(true);
	let plan = $state(null);
	let showWizard = $state(false);
	let saving = $state(false);
	let saveMsg = $state('');

	const isPaid = $derived($userTier !== 'free' || $isAcademy);

	// Wizard state
	let wizardStep = $state(0);
	let wizardData = $state({
		goal: 'cashflow',
		targetAmount: 0,
		investableCapital: '',
		assetClasses: [],
		dealTypes: [],
	});

	const assetClassOptions = [
		'Multi-Family', 'Self Storage', 'Industrial', 'RV/Mobile Home Parks',
		'Oil & Gas / Energy', 'Medical Office', 'Senior Living', 'Hospitality',
		'Retail', 'Data Centers', 'Single Family', 'Mixed-Use'
	];

	const dealTypeOptions = [
		'Lending', 'Buy & Hold', 'Value-Add', 'Development',
		'Distressed', 'Fund', 'REIT', '1031 Exchange'
	];

	const goalLabels = {
		cashflow: 'Generate Passive Income',
		growth: 'Build Long-Term Wealth',
		tax: 'Reduce Taxable Income'
	};

	const stepTitles = [
		'What is your primary goal?',
		'Set your target',
		'How much can you invest?',
		'Which asset classes interest you?',
		'What deal types do you prefer?',
		'Review your plan'
	];

	function getToken() {
		if (!browser) return null;
		return localStorage.getItem('sb_token') || localStorage.getItem('ghlToken') || JSON.parse(localStorage.getItem('gycUser') || '{}').token || null;
	}

	function getEmail() {
		if (!browser) return null;
		const u = JSON.parse(localStorage.getItem('gycUser') || '{}');
		return u.email || null;
	}

	function toggleAssetClass(ac) {
		if (wizardData.assetClasses.includes(ac)) {
			wizardData.assetClasses = wizardData.assetClasses.filter(a => a !== ac);
		} else {
			wizardData.assetClasses = [...wizardData.assetClasses, ac];
		}
	}

	function toggleDealType(dt) {
		if (wizardData.dealTypes.includes(dt)) {
			wizardData.dealTypes = wizardData.dealTypes.filter(d => d !== dt);
		} else {
			wizardData.dealTypes = [...wizardData.dealTypes, dt];
		}
	}

	function selectGoal(g) {
		wizardData.goal = g;
		// Pre-select asset classes and deal types based on goal
		if (g === 'cashflow') {
			if (wizardData.assetClasses.length === 0) wizardData.assetClasses = ['Multi-Family', 'Self Storage', 'Industrial'];
			if (wizardData.dealTypes.length === 0) wizardData.dealTypes = ['Lending', 'Buy & Hold'];
		} else if (g === 'growth') {
			if (wizardData.assetClasses.length === 0) wizardData.assetClasses = ['Multi-Family', 'Self Storage', 'Industrial'];
			if (wizardData.dealTypes.length === 0) wizardData.dealTypes = ['Value-Add', 'Distressed'];
		} else if (g === 'tax') {
			if (wizardData.assetClasses.length === 0) wizardData.assetClasses = ['Multi-Family', 'Oil & Gas / Energy', 'RV/Mobile Home Parks'];
			if (wizardData.dealTypes.length === 0) wizardData.dealTypes = ['Value-Add', 'Development'];
		}
		wizardStep = 1;
	}

	function nextStep() {
		if (wizardStep < 5) wizardStep++;
	}

	function prevStep() {
		if (wizardStep > 0) wizardStep--;
	}

	function openWizard() {
		// Load any existing wizard data from localStorage
		if (browser) {
			const stored = JSON.parse(localStorage.getItem('gycBuyBoxWizard') || '{}');
			if (stored && Object.keys(stored).length > 0) {
				wizardData.goal = stored._branch || stored.goal || 'cashflow';
				wizardData.targetAmount = parseFloat(stored.targetAmount || stored.targetIncome || stored.targetTaxSavings || stored.targetGrowth || 0);
				wizardData.investableCapital = stored.investableCapital || stored._capitalRange || '';
				wizardData.assetClasses = stored.assetClasses || [];
				wizardData.dealTypes = stored.dealTypes || stored.strategies || [];
			}
		}
		wizardStep = 0;
		showWizard = true;
	}

	function closeWizard() {
		showWizard = false;
		// Save progress to localStorage
		if (browser) {
			localStorage.setItem('gycBuyBoxWizard', JSON.stringify({
				_branch: wizardData.goal,
				goal: wizardData.goal,
				targetAmount: wizardData.targetAmount,
				investableCapital: wizardData.investableCapital,
				assetClasses: wizardData.assetClasses,
				dealTypes: wizardData.dealTypes
			}));
		}
	}

	async function savePlan() {
		saving = true;
		saveMsg = '';
		const email = getEmail();
		const planPayload = {
			goal: goalLabels[wizardData.goal] || wizardData.goal,
			targetIncome: wizardData.goal === 'cashflow' ? wizardData.targetAmount : undefined,
			targetGrowth: wizardData.goal === 'growth' ? wizardData.targetAmount : undefined,
			targetTaxSavings: wizardData.goal === 'tax' ? wizardData.targetAmount : undefined,
			investableCapital: wizardData.investableCapital,
			assetClasses: wizardData.assetClasses,
			dealTypes: wizardData.dealTypes,
			_branch: wizardData.goal
		};

		// Save to localStorage
		if (browser) {
			localStorage.setItem('gycBuyBoxWizard', JSON.stringify(planPayload));
			localStorage.setItem('gycBuyBoxComplete', 'true');
		}

		// Save to API
		try {
			if (email) {
				const resp = await fetch('/api/buybox', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, wizardData: planPayload })
				});
				if (resp.ok) {
					saveMsg = 'Plan saved';
				} else {
					saveMsg = 'Saved locally (sync pending)';
				}
			} else {
				saveMsg = 'Plan saved locally';
			}
		} catch (e) {
			console.warn('Buy box save failed:', e);
			saveMsg = 'Saved locally (sync pending)';
		}

		plan = {
			goal: goalLabels[wizardData.goal] || wizardData.goal,
			targetIncome: wizardData.goal === 'cashflow' ? wizardData.targetAmount : undefined,
			targetGrowth: wizardData.goal === 'growth' ? wizardData.targetAmount : undefined,
			targetTaxSavings: wizardData.goal === 'tax' ? wizardData.targetAmount : undefined,
			investableCapital: wizardData.investableCapital,
			assetClasses: wizardData.assetClasses,
			dealTypes: wizardData.dealTypes
		};
		hasPlan = true;
		showWizard = false;
		saving = false;
		setTimeout(() => saveMsg = '', 3000);
	}

	function getTargetLabel() {
		if (wizardData.goal === 'cashflow') return 'Target Monthly Passive Income ($)';
		if (wizardData.goal === 'growth') return 'Target Portfolio Value in 5 Years ($)';
		if (wizardData.goal === 'tax') return 'Annual Taxable Income to Offset ($)';
		return 'Target Amount ($)';
	}

	function getTargetHint() {
		const val = wizardData.targetAmount;
		if (!val || val <= 0) return '';
		if (wizardData.goal === 'cashflow') {
			const annual = val * 12;
			const needed = Math.round(annual / 0.09);
			return `That is $${annual.toLocaleString()}/yr. At ~9% avg yield, you will need ~$${needed.toLocaleString()} deployed.`;
		}
		if (wizardData.goal === 'tax') return 'Typical depreciation deals offset 60-80% of your investment in year one.';
		if (wizardData.goal === 'growth') return 'That is a ~15% annualized return over 5 years.';
		return '';
	}

	const capitalOptions = [
		{ label: 'Under $100K', value: '0-100000' },
		{ label: '$100K - $250K', value: '100000-250000' },
		{ label: '$250K - $500K', value: '250000-500000' },
		{ label: '$500K - $1M', value: '500000-1000000' },
		{ label: '$1M+', value: '1000000-5000000' }
	];

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
					// Populate wizard data from saved plan
					wizardData.goal = data.buyBox._branch || 'cashflow';
					wizardData.targetAmount = parseFloat(data.buyBox.targetIncome || data.buyBox.targetGrowth || data.buyBox.targetTaxSavings || 0);
					wizardData.investableCapital = data.buyBox.investableCapital || '';
					wizardData.assetClasses = data.buyBox.assetClasses || [];
					wizardData.dealTypes = data.buyBox.dealTypes || data.buyBox.strategies || [];
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

	{#if saveMsg}
		<div class="save-toast">{saveMsg}</div>
	{/if}

	{#if loading}
		<div class="loading">Loading your plan...</div>
	{:else if showWizard}
		<!-- Buy Box Wizard -->
		<div class="wizard-overlay">
			<div class="wizard-modal">
				<div class="wizard-top">
					<div class="wizard-progress">
						{#each stepTitles as _, i}
							<div class="wiz-dot" class:active={i === wizardStep} class:done={i < wizardStep}></div>
						{/each}
					</div>
					<button class="wizard-close" onclick={closeWizard}>&times;</button>
				</div>
				<div class="wizard-step-title">{stepTitles[wizardStep]}</div>

				{#if wizardStep === 0}
					<!-- Step 1: Goal Selection -->
					<div class="goal-cards">
						<button class="goal-card" class:selected={wizardData.goal === 'cashflow'} onclick={() => selectGoal('cashflow')}>
							<div class="goal-icon">💰</div>
							<div class="goal-card-title">Generate Passive Income</div>
							<div class="goal-card-desc">Build monthly cash flow from real estate investments</div>
						</button>
						<button class="goal-card" class:selected={wizardData.goal === 'growth'} onclick={() => selectGoal('growth')}>
							<div class="goal-icon">📈</div>
							<div class="goal-card-title">Build Long-Term Wealth</div>
							<div class="goal-card-desc">Grow your portfolio value through appreciation</div>
						</button>
						<button class="goal-card" class:selected={wizardData.goal === 'tax'} onclick={() => selectGoal('tax')}>
							<div class="goal-icon">🛡️</div>
							<div class="goal-card-title">Reduce Taxable Income</div>
							<div class="goal-card-desc">Offset W-2 income with depreciation and tax benefits</div>
						</button>
					</div>

				{:else if wizardStep === 1}
					<!-- Step 2: Target Amount -->
					<div class="wiz-field">
						<label>{getTargetLabel()}</label>
						<input type="number" bind:value={wizardData.targetAmount} placeholder="e.g. 10000" />
						{#if getTargetHint()}
							<div class="wiz-hint">{getTargetHint()}</div>
						{/if}
					</div>
					<div class="wiz-nav">
						<button class="wiz-btn-back" onclick={prevStep}>Back</button>
						<button class="wiz-btn-next" onclick={nextStep} disabled={!wizardData.targetAmount || wizardData.targetAmount <= 0}>Next</button>
					</div>

				{:else if wizardStep === 2}
					<!-- Step 3: Investable Capital -->
					<div class="capital-chips">
						{#each capitalOptions as opt}
							<button class="capital-chip" class:selected={wizardData.investableCapital === opt.value} onclick={() => wizardData.investableCapital = opt.value}>
								{opt.label}
							</button>
						{/each}
					</div>
					<div class="wiz-nav">
						<button class="wiz-btn-back" onclick={prevStep}>Back</button>
						<button class="wiz-btn-next" onclick={nextStep} disabled={!wizardData.investableCapital}>Next</button>
					</div>

				{:else if wizardStep === 3}
					<!-- Step 4: Asset Class Preferences -->
					<div class="toggle-grid">
						{#each assetClassOptions as ac}
							<button class="toggle-chip" class:selected={wizardData.assetClasses.includes(ac)} onclick={() => toggleAssetClass(ac)}>
								{ac}
							</button>
						{/each}
					</div>
					<div class="wiz-nav">
						<button class="wiz-btn-back" onclick={prevStep}>Back</button>
						<button class="wiz-btn-next" onclick={nextStep} disabled={wizardData.assetClasses.length === 0}>Next</button>
					</div>

				{:else if wizardStep === 4}
					<!-- Step 5: Deal Type Preferences -->
					<div class="toggle-grid">
						{#each dealTypeOptions as dt}
							<button class="toggle-chip" class:selected={wizardData.dealTypes.includes(dt)} onclick={() => toggleDealType(dt)}>
								{dt}
							</button>
						{/each}
					</div>
					<div class="wiz-nav">
						<button class="wiz-btn-back" onclick={prevStep}>Back</button>
						<button class="wiz-btn-next" onclick={nextStep} disabled={wizardData.dealTypes.length === 0}>Next</button>
					</div>

				{:else if wizardStep === 5}
					<!-- Step 6: Summary -->
					<div class="summary-card">
						<div class="summary-row">
							<div class="summary-label">Goal</div>
							<div class="summary-value">{goalLabels[wizardData.goal] || wizardData.goal}</div>
						</div>
						<div class="summary-row">
							<div class="summary-label">Target</div>
							<div class="summary-value">${Number(wizardData.targetAmount).toLocaleString()}{wizardData.goal === 'cashflow' ? '/mo' : ''}</div>
						</div>
						<div class="summary-row">
							<div class="summary-label">Investable Capital</div>
							<div class="summary-value">{capitalOptions.find(o => o.value === wizardData.investableCapital)?.label || wizardData.investableCapital}</div>
						</div>
						<div class="summary-row">
							<div class="summary-label">Asset Classes</div>
							<div class="summary-tags">
								{#each wizardData.assetClasses as ac}
									<span class="summary-tag">{ac}</span>
								{/each}
							</div>
						</div>
						<div class="summary-row">
							<div class="summary-label">Deal Types</div>
							<div class="summary-tags">
								{#each wizardData.dealTypes as dt}
									<span class="summary-tag">{dt}</span>
								{/each}
							</div>
						</div>
					</div>
					<div class="wiz-nav">
						<button class="wiz-btn-back" onclick={prevStep}>Back</button>
						<button class="wiz-btn-save" onclick={savePlan} disabled={saving}>
							{saving ? 'Saving...' : 'Save My Plan'}
						</button>
					</div>
				{/if}
			</div>
		</div>

	{:else if !hasPlan}
		<div class="empty-state">
			<div class="empty-icon">📋</div>
			<div class="empty-title">You don't have a plan yet.</div>
			<div class="empty-desc">Members with a plan deploy an average of $150K in their first 90 days. Takes 3 minutes.</div>
			<button class="btn-cta" onclick={openWizard}>Build My Plan</button>
		</div>
	{:else}
		<div class="plan-content">
			<div class="plan-header">
				<h2>Your Investment Plan</h2>
				<button class="btn-edit" onclick={openWizard}>Edit Plan</button>
			</div>
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
			{#if plan.targetGrowth}
				<div class="plan-section">
					<div class="plan-label">Target Portfolio Value</div>
					<div class="plan-value">${Number(plan.targetGrowth).toLocaleString()}</div>
				</div>
			{/if}
			{#if plan.targetTaxSavings}
				<div class="plan-section">
					<div class="plan-label">Tax Offset Target</div>
					<div class="plan-value">${Number(plan.targetTaxSavings).toLocaleString()}/yr</div>
				</div>
			{/if}
			{#if plan.investableCapital}
				<div class="plan-section">
					<div class="plan-label">Investable Capital</div>
					<div class="plan-value">{capitalOptions.find(o => o.value === plan.investableCapital)?.label || plan.investableCapital}</div>
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
	.save-toast { padding: 10px 16px; background: #F0F9F4; border-radius: 8px; font-family: var(--font-ui); font-size: 13px; color: #059669; font-weight: 600; text-align: center; margin-bottom: 16px; }

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
		font-size: 14px; font-weight: 700; text-decoration: none; border: none; cursor: pointer;
	}

	.plan-content { }
	.plan-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
	h2 { font-family: var(--font-headline); font-size: 20px; font-weight: 800; color: var(--text-dark); margin: 0; }
	.btn-edit { padding: 8px 16px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
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

	/* Wizard */
	.wizard-overlay { position: fixed; inset: 0; z-index: 100; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; padding: 20px; }
	.wizard-modal { background: var(--bg-card); border-radius: 16px; max-width: 560px; width: 100%; max-height: 90vh; overflow-y: auto; padding: 32px; position: relative; box-shadow: 0 24px 64px rgba(0,0,0,0.15); }
	.wizard-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; }
	.wizard-progress { display: flex; gap: 6px; }
	.wiz-dot { width: 10px; height: 10px; border-radius: 50%; background: var(--border); transition: all 0.2s; }
	.wiz-dot.active { background: var(--primary); transform: scale(1.3); }
	.wiz-dot.done { background: var(--primary); opacity: 0.5; }
	.wizard-close { background: none; border: none; font-size: 24px; color: var(--text-muted); cursor: pointer; padding: 4px 8px; line-height: 1; }
	.wizard-step-title { font-family: var(--font-headline); font-size: 22px; color: var(--text-dark); margin-bottom: 24px; }

	/* Goal cards */
	.goal-cards { display: flex; flex-direction: column; gap: 12px; }
	.goal-card { text-align: left; padding: 20px; border: 2px solid var(--border); border-radius: 12px; background: var(--bg-card); cursor: pointer; transition: all 0.2s; }
	.goal-card:hover { border-color: var(--primary); }
	.goal-card.selected { border-color: var(--primary); background: rgba(81,190,123,0.06); }
	.goal-icon { font-size: 28px; margin-bottom: 8px; }
	.goal-card-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.goal-card-desc { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); }

	/* Wizard fields */
	.wiz-field { margin-bottom: 24px; }
	.wiz-field label { display: block; font-family: var(--font-ui); font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
	.wiz-field input { width: 100%; padding: 12px 16px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-size: 16px; box-sizing: border-box; }
	.wiz-field input:focus { outline: none; border-color: var(--primary); }
	.wiz-hint { font-size: 12px; color: var(--text-secondary); margin-top: 8px; line-height: 1.5; }

	/* Capital chips */
	.capital-chips { display: flex; flex-direction: column; gap: 10px; margin-bottom: 24px; }
	.capital-chip { padding: 16px; border: 2px solid var(--border); border-radius: 10px; background: var(--bg-card); font-family: var(--font-ui); font-size: 15px; font-weight: 600; color: var(--text-dark); cursor: pointer; text-align: left; transition: all 0.2s; }
	.capital-chip:hover { border-color: var(--primary); }
	.capital-chip.selected { border-color: var(--primary); background: rgba(81,190,123,0.06); color: var(--primary); }

	/* Toggle grid */
	.toggle-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 24px; }
	.toggle-chip { padding: 14px; border: 2px solid var(--border); border-radius: 10px; background: var(--bg-card); font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: var(--text-secondary); cursor: pointer; transition: all 0.2s; text-align: center; }
	.toggle-chip:hover { border-color: var(--primary); color: var(--text-dark); }
	.toggle-chip.selected { border-color: var(--primary); background: rgba(81,190,123,0.08); color: #2C6E49; }

	/* Navigation */
	.wiz-nav { display: flex; justify-content: space-between; gap: 12px; margin-top: 8px; }
	.wiz-btn-back { padding: 12px 24px; background: transparent; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 14px; font-weight: 600; color: var(--text-secondary); cursor: pointer; }
	.wiz-btn-next, .wiz-btn-save { padding: 12px 32px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 14px; font-weight: 700; cursor: pointer; margin-left: auto; }
	.wiz-btn-next:disabled, .wiz-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

	/* Summary */
	.summary-card { background: var(--bg-main); border-radius: var(--radius); padding: 24px; margin-bottom: 24px; }
	.summary-row { padding: 12px 0; border-bottom: 1px solid var(--border-light); }
	.summary-row:last-child { border-bottom: none; }
	.summary-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 4px; }
	.summary-value { font-family: var(--font-ui); font-size: 16px; font-weight: 700; color: var(--text-dark); }
	.summary-tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 4px; }
	.summary-tag { padding: 4px 10px; border-radius: 6px; font-family: var(--font-ui); font-size: 12px; font-weight: 600; background: rgba(44,110,73,0.08); color: #2C6E49; }

	@media (max-width: 768px) {
		.plan-page { padding: 16px; }
		.wizard-modal { padding: 24px 20px; }
		.toggle-grid { grid-template-columns: repeat(2, 1fr); }
	}
</style>
