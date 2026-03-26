<script>
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import { getStoredSessionToken } from '$lib/stores/auth.js';

	let currentStep = $state(1);
	let loading = $state(true);
	let submitting = $state(false);
	let submitted = $state(false);
	let dealId = $state(null);

	let formData = $state({
		dealName: '', assetClass: '', dealType: '', investmentStrategy: '',
		targetMarkets: '', offeringEntity: '', managementCompany: '', ceo: '',
		targetIRR: '', targetCoC: '', equityMultiple: '', minInvestment: '',
		maxInvestment: '', distributionFrequency: '', preferredReturn: '',
		managementFee: '', acquisitionFee: '', dispositionFee: '',
		carriedInterest: '', hurdleRate: '', lpGpSplit: '',
		startDate: '', targetClose: '', holdPeriod: '', extensionOptions: '',
		exitStrategy: ''
	});

	let autoFilled = $state({});
	const progress = $derived((currentStep / 5) * 100);

	const stepTitles = ['Investment Terms', 'Financial Metrics', 'Fee Structure', 'Key Dates & Exit', 'Confirmation'];

	const assetClasses = ['Multi-Family', 'Self-Storage', 'Industrial', 'Debt Fund', 'Retail', 'Office', 'Mobile Home Park', 'Build-to-Rent', 'Hotel/Hospitality', 'Senior Living', 'Mixed-Use', 'Land', 'Other'];
	const dealTypes = ['Syndication', 'Fund', 'REIT', 'Joint Venture', 'Note/Debt', 'Other'];
	const frequencies = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'At Exit', 'None'];
	const exitStrategies = ['Sale', 'Refinance', 'Hold', 'Liquidation', 'IPO', 'Other'];

	function nextStep() { if (currentStep < 5) currentStep++; }
	function prevStep() { if (currentStep > 1) currentStep--; }

	async function submitReview() {
		submitting = true;
		try {
			const token = getStoredSessionToken();
			await fetch('/api/deal-review', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (token || '') },
				body: JSON.stringify({ dealId, ...formData })
			});
			submitted = true;
		} catch (e) { console.error('Submit failed:', e); }
		finally { submitting = false; }
	}

	function badge(field) { return autoFilled[field] ? 'auto' : (formData[field] ? '' : 'empty'); }

	onMount(async () => {
		if (!browser) return;
		dealId = $page.url.searchParams.get('id');
		if (dealId) {
			try {
				const token = getStoredSessionToken();
				const res = await fetch(`/api/deals?id=${dealId}`, {
					headers: token ? { 'Authorization': 'Bearer ' + token } : {}
				});
				if (res.ok) {
					const deal = await res.json();
					const d = Array.isArray(deal) ? deal[0] : deal;
					if (d) {
						const map = {
							dealName: d.name, assetClass: d.asset_class, dealType: d.deal_type,
							investmentStrategy: d.strategy_summary || d.investment_strategy,
							targetMarkets: d.target_markets || d.geographic_focus,
							offeringEntity: d.offering_entity_name, managementCompany: d.management_company_name,
							ceo: d.ceo_name, targetIRR: d.target_irr, targetCoC: d.target_coc,
							equityMultiple: d.equity_multiple, minInvestment: d.minimum_investment,
							maxInvestment: d.maximum_investment, distributionFrequency: d.distribution_frequency,
							preferredReturn: d.preferred_return, managementFee: d.management_fee,
							acquisitionFee: d.acquisition_fee, dispositionFee: d.disposition_fee,
							carriedInterest: d.carried_interest, hurdleRate: d.hurdle_rate,
							lpGpSplit: d.lp_gp_split, holdPeriod: d.hold_period, exitStrategy: d.exit_strategy
						};
						for (const [k, v] of Object.entries(map)) {
							if (v != null && v !== '') { formData[k] = String(v); autoFilled[k] = true; }
						}
					}
				}
			} catch (e) { console.warn('Failed to load deal:', e); }
		}
		loading = false;
	});
</script>

<svelte:head><title>Review Deal | GYC</title></svelte:head>

<div class="ly-page">
	<div class="ly-frame">
<div class="review-container">
	<div class="review-card">
		<!-- Progress bar -->
		<div class="progress-bar-wrap">
			<div class="progress-bar-fill" style="width:{progress}%"></div>
		</div>

		{#if loading}
			<div class="loading-state">Loading deal data...</div>
		{:else if submitted}
			<div class="success-state">
				<div class="success-icon">&#10003;</div>
				<h2>Review Submitted</h2>
				<p>Your deal review has been saved. You can close this page.</p>
				{#if dealId}
					<a href="/deal/{dealId}" class="btn-primary" style="margin-top:16px;display:inline-block;text-decoration:none;">View Deal Page</a>
				{/if}
			</div>
		{:else}
			<!-- Step header -->
			<div class="step-header">
				<div class="step-counter">Step {currentStep} of 5</div>
				<h1 class="step-title">{stepTitles[currentStep - 1]}</h1>
			</div>

			<!-- Step 1: Investment Terms -->
			{#if currentStep === 1}
				<div class="step-body">
					<div class="form-grid">
						<div class="field-group full-width">
							<label>Deal Name {#if badge('dealName') === 'auto'}<span class="field-badge badge-auto">Auto-filled</span>{/if}</label>
							<input type="text" bind:value={formData.dealName} placeholder="e.g. Sunrise Multi-Family Fund II" />
						</div>
						<div class="field-group">
							<label>Asset Class</label>
							<select bind:value={formData.assetClass}>
								<option value="">Select...</option>
								{#each assetClasses as ac}<option value={ac}>{ac}</option>{/each}
							</select>
						</div>
						<div class="field-group">
							<label>Deal Type</label>
							<select bind:value={formData.dealType}>
								<option value="">Select...</option>
								{#each dealTypes as dt}<option value={dt}>{dt}</option>{/each}
							</select>
						</div>
						<div class="field-group full-width">
							<label>Investment Strategy</label>
							<textarea bind:value={formData.investmentStrategy} placeholder="Brief summary of the deal's thesis..."></textarea>
						</div>
						<div class="field-group">
							<label>Target Markets</label>
							<input type="text" bind:value={formData.targetMarkets} placeholder="e.g. Southeast US, Tampa FL" />
						</div>
						<div class="field-group">
							<label>Offering Entity</label>
							<input type="text" bind:value={formData.offeringEntity} placeholder="Legal entity name" />
						</div>
						<div class="field-group">
							<label>Management Company {#if badge('managementCompany') === 'auto'}<span class="field-badge badge-auto">Auto-filled</span>{/if}</label>
							<input type="text" bind:value={formData.managementCompany} />
						</div>
						<div class="field-group">
							<label>CEO / Key Principal {#if badge('ceo') === 'auto'}<span class="field-badge badge-auto">Auto-filled</span>{/if}</label>
							<input type="text" bind:value={formData.ceo} />
						</div>
					</div>
				</div>

			<!-- Step 2: Financial Metrics -->
			{:else if currentStep === 2}
				<div class="step-body">
					<div class="form-grid">
						<div class="field-group">
							<label>Target IRR {#if badge('targetIRR') === 'auto'}<span class="field-badge badge-auto">Auto-filled</span>{/if}</label>
							<div class="input-with-suffix"><input type="number" step="0.1" bind:value={formData.targetIRR} placeholder="15.0" /><span class="input-suffix">%</span></div>
						</div>
						<div class="field-group">
							<label>Target Cash-on-Cash</label>
							<div class="input-with-suffix"><input type="number" step="0.1" bind:value={formData.targetCoC} placeholder="8.0" /><span class="input-suffix">%</span></div>
						</div>
						<div class="field-group">
							<label>Equity Multiple {#if badge('equityMultiple') === 'auto'}<span class="field-badge badge-auto">Auto-filled</span>{/if}</label>
							<div class="input-with-suffix"><input type="number" step="0.01" bind:value={formData.equityMultiple} placeholder="2.0" /><span class="input-suffix">x</span></div>
						</div>
						<div class="field-group">
							<label>Minimum Investment {#if badge('minInvestment') === 'auto'}<span class="field-badge badge-auto">Auto-filled</span>{/if}</label>
							<div class="input-with-prefix"><span class="input-prefix">$</span><input type="number" bind:value={formData.minInvestment} placeholder="50000" /></div>
						</div>
						<div class="field-group">
							<label>Maximum Investment</label>
							<div class="input-with-prefix"><span class="input-prefix">$</span><input type="number" bind:value={formData.maxInvestment} /></div>
						</div>
						<div class="field-group">
							<label>Distribution Frequency</label>
							<select bind:value={formData.distributionFrequency}>
								<option value="">Select...</option>
								{#each frequencies as f}<option value={f}>{f}</option>{/each}
							</select>
						</div>
						<div class="field-group">
							<label>Preferred Return</label>
							<div class="input-with-suffix"><input type="number" step="0.1" bind:value={formData.preferredReturn} placeholder="8.0" /><span class="input-suffix">%</span></div>
						</div>
					</div>
				</div>

			<!-- Step 3: Fee Structure -->
			{:else if currentStep === 3}
				<div class="step-body">
					<div class="form-grid">
						<div class="field-group">
							<label>Management Fee</label>
							<div class="input-with-suffix"><input type="number" step="0.1" bind:value={formData.managementFee} placeholder="1.5" /><span class="input-suffix">%</span></div>
						</div>
						<div class="field-group">
							<label>Acquisition Fee</label>
							<div class="input-with-suffix"><input type="number" step="0.1" bind:value={formData.acquisitionFee} placeholder="2.0" /><span class="input-suffix">%</span></div>
						</div>
						<div class="field-group">
							<label>Disposition Fee</label>
							<div class="input-with-suffix"><input type="number" step="0.1" bind:value={formData.dispositionFee} placeholder="1.0" /><span class="input-suffix">%</span></div>
						</div>
						<div class="field-group">
							<label>Carried Interest / Promote</label>
							<div class="input-with-suffix"><input type="number" step="0.1" bind:value={formData.carriedInterest} placeholder="20.0" /><span class="input-suffix">%</span></div>
						</div>
						<div class="field-group">
							<label>Hurdle Rate</label>
							<div class="input-with-suffix"><input type="number" step="0.1" bind:value={formData.hurdleRate} placeholder="8.0" /><span class="input-suffix">%</span></div>
						</div>
						<div class="field-group">
							<label>LP/GP Split</label>
							<input type="text" bind:value={formData.lpGpSplit} placeholder="e.g. 80/20" />
						</div>
					</div>
				</div>

			<!-- Step 4: Key Dates & Exit -->
			{:else if currentStep === 4}
				<div class="step-body">
					<div class="form-grid">
						<div class="field-group">
							<label>Fund/Offering Start Date</label>
							<input type="date" bind:value={formData.startDate} />
						</div>
						<div class="field-group">
							<label>Target Close Date</label>
							<input type="date" bind:value={formData.targetClose} />
						</div>
						<div class="field-group">
							<label>Hold Period</label>
							<div class="input-with-suffix"><input type="number" bind:value={formData.holdPeriod} placeholder="5" /><span class="input-suffix">years</span></div>
						</div>
						<div class="field-group">
							<label>Extension Options</label>
							<input type="text" bind:value={formData.extensionOptions} placeholder="e.g. Two 1-year extensions" />
						</div>
						<div class="field-group">
							<label>Exit Strategy</label>
							<select bind:value={formData.exitStrategy}>
								<option value="">Select...</option>
								{#each exitStrategies as es}<option value={es}>{es}</option>{/each}
							</select>
						</div>
					</div>
				</div>

			<!-- Step 5: Confirmation -->
			{:else if currentStep === 5}
				<div class="step-body">
					<div class="summary-grid">
						<div class="summary-section">
							<h3>Investment Terms</h3>
							<div class="summary-row"><span>Deal Name</span><strong>{formData.dealName || '—'}</strong></div>
							<div class="summary-row"><span>Asset Class</span><strong>{formData.assetClass || '—'}</strong></div>
							<div class="summary-row"><span>Deal Type</span><strong>{formData.dealType || '—'}</strong></div>
							<div class="summary-row"><span>Management Company</span><strong>{formData.managementCompany || '—'}</strong></div>
							<div class="summary-row"><span>CEO</span><strong>{formData.ceo || '—'}</strong></div>
						</div>
						<div class="summary-section">
							<h3>Financial Metrics</h3>
							<div class="summary-row"><span>Target IRR</span><strong>{formData.targetIRR ? formData.targetIRR + '%' : '—'}</strong></div>
							<div class="summary-row"><span>Equity Multiple</span><strong>{formData.equityMultiple ? formData.equityMultiple + 'x' : '—'}</strong></div>
							<div class="summary-row"><span>Minimum</span><strong>{formData.minInvestment ? '$' + Number(formData.minInvestment).toLocaleString() : '—'}</strong></div>
							<div class="summary-row"><span>Preferred Return</span><strong>{formData.preferredReturn ? formData.preferredReturn + '%' : '—'}</strong></div>
						</div>
						<div class="summary-section">
							<h3>Fee Structure</h3>
							<div class="summary-row"><span>Management Fee</span><strong>{formData.managementFee ? formData.managementFee + '%' : '—'}</strong></div>
							<div class="summary-row"><span>Carried Interest</span><strong>{formData.carriedInterest ? formData.carriedInterest + '%' : '—'}</strong></div>
							<div class="summary-row"><span>LP/GP Split</span><strong>{formData.lpGpSplit || '—'}</strong></div>
						</div>
						<div class="summary-section">
							<h3>Key Dates & Exit</h3>
							<div class="summary-row"><span>Hold Period</span><strong>{formData.holdPeriod ? formData.holdPeriod + ' years' : '—'}</strong></div>
							<div class="summary-row"><span>Exit Strategy</span><strong>{formData.exitStrategy || '—'}</strong></div>
						</div>
					</div>
				</div>
			{/if}

			<!-- Step footer -->
			<div class="step-footer">
				{#if currentStep > 1}
					<button class="btn-back" onclick={prevStep}>Back</button>
				{:else}
					<div></div>
				{/if}
				{#if currentStep < 5}
					<button class="btn-primary" onclick={nextStep}>Next</button>
				{:else}
					<button class="btn-primary" onclick={submitReview} disabled={submitting}>
						{submitting ? 'Submitting...' : 'Submit Review'}
					</button>
				{/if}
			</div>
		{/if}
	</div>
</div>
</div>
</div>

<style>
	.review-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 40px 20px; background: var(--bg-cream); }
	.review-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 16px; box-shadow: 0 8px 32px rgba(0,0,0,0.08); width: 100%; max-width: 860px; overflow: hidden; }

	.progress-bar-wrap { height: 4px; background: var(--border-light); }
	.progress-bar-fill { height: 100%; background: linear-gradient(90deg, #51BE7B, #40E47F); border-radius: 0 2px 2px 0; transition: width 0.5s ease; }

	.step-header { padding: 32px 40px 0; text-align: center; }
	.step-counter { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary); margin-bottom: 8px; }
	.step-title { font-family: var(--font-headline); font-size: 28px; color: var(--text-dark); line-height: 1.2; margin: 0; }

	.step-body { padding: 28px 40px 32px; }
	.step-footer { padding: 0 40px 32px; display: flex; align-items: center; justify-content: space-between; }

	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
	.full-width { grid-column: 1 / -1; }

	.field-group label { display: block; font-family: var(--font-ui); font-size: 13px; font-weight: 500; color: var(--text-secondary); margin-bottom: 4px; }
	.field-group input, .field-group select, .field-group textarea {
		width: 100%; font-family: var(--font-body); font-size: 15px; padding: 10px 12px;
		border: 1px solid var(--border-light); border-radius: var(--radius-sm);
		background: var(--bg-card); color: var(--text-dark); outline: none; transition: border-color 0.2s;
	}
	.field-group input:focus, .field-group select:focus, .field-group textarea:focus { border-color: var(--primary); }
	.field-group textarea { resize: vertical; min-height: 80px; }

	.field-badge { display: inline-flex; align-items: center; gap: 4px; font-family: var(--font-ui); font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 4px; margin-left: 6px; }
	.badge-auto { background: rgba(81,190,123,0.1); color: #51BE7B; }
	.badge-empty { background: rgba(214,140,69,0.1); color: #D68C45; }

	.input-with-suffix { position: relative; }
	.input-with-suffix input { padding-right: 40px; }
	.input-suffix { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 14px; pointer-events: none; }
	.input-with-prefix { position: relative; }
	.input-with-prefix input { padding-left: 20px; }
	.input-prefix { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); font-size: 14px; pointer-events: none; }

	.btn-primary { padding: 12px 32px; background: var(--primary); color: #fff; border: none; border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 14px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
	.btn-primary:hover { background: #45A86C; transform: translateY(-1px); }
	.btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
	.btn-back { padding: 12px 24px; background: transparent; color: var(--text-secondary); border: 1px solid var(--border-light); border-radius: var(--radius-sm); font-family: var(--font-ui); font-size: 14px; font-weight: 600; cursor: pointer; }

	.summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }
	.summary-section h3 { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin: 0 0 12px; padding-bottom: 8px; border-bottom: 2px solid var(--primary); }
	.summary-row { display: flex; justify-content: space-between; padding: 6px 0; font-size: 13px; border-bottom: 1px solid var(--border-light); }
	.summary-row span { color: var(--text-muted); }
	.summary-row strong { color: var(--text-dark); font-weight: 600; }

	.loading-state, .success-state { text-align: center; padding: 80px 40px; }
	.success-icon { width: 64px; height: 64px; border-radius: 50%; background: rgba(81,190,123,0.1); color: #51BE7B; font-size: 32px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 16px; }
	.success-state h2 { font-family: var(--font-headline); font-size: 24px; color: var(--text-dark); margin: 0 0 8px; }
	.success-state p { font-family: var(--font-body); font-size: 14px; color: var(--text-secondary); }

	@media (max-width: 768px) {
		.review-container { padding: 20px 12px; }
		.step-header { padding: 24px 20px 0; }
		.step-body { padding: 20px; }
		.step-footer { padding: 0 20px 24px; }
		.form-grid { grid-template-columns: 1fr; }
		.summary-grid { grid-template-columns: 1fr; }
		.step-title { font-size: 22px; }
	}

	:global(html.dark) .review-card { box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
</style>
