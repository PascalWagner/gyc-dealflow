<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import { getFreshSessionToken, isAdmin, isGP } from '$lib/stores/auth.js';
	import {
		computeDealCompleteness,
		DEAL_LIFECYCLE_LABELS,
		resolveDealLifecycleStatus,
		resolveDealVisibility,
		slugify
	} from '$lib/utils/dealWorkflow.js';

	function createEmptyForm() {
		return {
			investmentName: '',
			sponsorName: '',
			slug: '',
			assetClass: '',
			dealType: '',
			offeringType: '',
			availableTo: '',
			status: '',
			shortSummary: '',
			investmentStrategy: '',
			investmentMinimum: '',
			targetIRR: '',
			cashYield: '',
			preferredReturn: '',
			equityMultiple: '',
			holdPeriod: '',
			lpGpSplit: '',
			investingGeography: '',
			feeSummary: '',
			redemption: '',
			financials: '',
			taxCharacteristics: '',
			coverImageUrl: '',
			heroMediaUrl: '',
			riskNotes: '',
			downsideNotes: '',
			deckUrl: '',
			primarySourceUrl: '',
			primarySourceContext: '',
			operatorBackground: '',
			keyDates: '',
			tags: ''
		};
	}

	function readField(source, ...keys) {
		for (const key of keys) {
			const value = source?.[key];
			if (value !== undefined && value !== null) return value;
		}
		return '';
	}

	function formatTextValue(value) {
		if (value === null || value === undefined) return '';
		if (Array.isArray(value)) return value.join(', ');
		return String(value);
	}

	function formatNumberValue(value) {
		if (value === null || value === undefined || value === '') return '';
		return String(value);
	}

	function formatDateTime(value) {
		if (!value) return 'Not yet saved';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? 'Not yet saved' : date.toLocaleString();
	}

	function createFormFromDeal(source) {
		return {
			investmentName: formatTextValue(readField(source, 'investmentName', 'investment_name', 'name')),
			sponsorName: formatTextValue(
				readField(
					source,
					'sponsorName',
					'sponsor_name',
					'managementCompany',
					'management_company_name'
				)
			),
			slug: formatTextValue(readField(source, 'slug')) || slugify(readField(source, 'investmentName', 'investment_name', 'name')),
			assetClass: formatTextValue(readField(source, 'assetClass', 'asset_class')),
			dealType: formatTextValue(readField(source, 'dealType', 'deal_type')),
			offeringType: formatTextValue(readField(source, 'offeringType', 'offering_type')),
			availableTo: formatTextValue(readField(source, 'availableTo', 'available_to')),
			status: formatTextValue(readField(source, 'status', 'offeringStatus', 'offering_status')),
			shortSummary: formatTextValue(readField(source, 'shortSummary', 'short_summary')),
			investmentStrategy: formatTextValue(readField(source, 'investmentStrategy', 'investment_strategy', 'strategy')),
			investmentMinimum: formatNumberValue(readField(source, 'investmentMinimum', 'investment_minimum', 'minimumInvestment')),
			targetIRR: formatNumberValue(readField(source, 'targetIRR', 'target_irr')),
			cashYield: formatNumberValue(readField(source, 'cashYield', 'cash_yield', 'cashOnCash', 'cash_on_cash')),
			preferredReturn: formatNumberValue(readField(source, 'preferredReturn', 'preferred_return')),
			equityMultiple: formatNumberValue(readField(source, 'equityMultiple', 'equity_multiple')),
			holdPeriod: formatNumberValue(readField(source, 'holdPeriod', 'hold_period_years')),
			lpGpSplit: formatTextValue(readField(source, 'lpGpSplit', 'lp_gp_split')),
			investingGeography: formatTextValue(readField(source, 'investingGeography', 'investing_geography', 'location')),
			feeSummary: formatTextValue(readField(source, 'feeSummary', 'fee_summary')),
			redemption: formatTextValue(readField(source, 'redemption')),
			financials: formatTextValue(readField(source, 'financials')),
			taxCharacteristics: formatTextValue(readField(source, 'taxCharacteristics', 'tax_characteristics')),
			coverImageUrl: formatTextValue(readField(source, 'coverImageUrl', 'cover_image_url', 'property_image_url', 'image_url')),
			heroMediaUrl: formatTextValue(readField(source, 'heroMediaUrl', 'hero_media_url')),
			riskNotes: formatTextValue(readField(source, 'riskNotes', 'risk_notes')),
			downsideNotes: formatTextValue(readField(source, 'downsideNotes', 'downside_notes')),
			deckUrl: formatTextValue(readField(source, 'deckUrl', 'deck_url')),
			primarySourceUrl: formatTextValue(readField(source, 'primarySourceUrl', 'primary_source_url')),
			primarySourceContext: formatTextValue(readField(source, 'primarySourceContext', 'primary_source_context')),
			operatorBackground: formatTextValue(readField(source, 'operatorBackground', 'operator_background')),
			keyDates: formatTextValue(readField(source, 'keyDates', 'key_dates')),
			tags: formatTextValue(readField(source, 'tags'))
		};
	}

	function buildCompletenessDeal(formState, existingDeal) {
		return {
			investmentName: formState.investmentName,
			sponsorName: formState.sponsorName,
			slug: formState.slug || slugify(formState.investmentName),
			assetClass: formState.assetClass,
			shortSummary: formState.shortSummary,
			investmentMinimum: formState.investmentMinimum,
			status: formState.status,
			coverImageUrl: formState.coverImageUrl,
			heroMediaUrl: formState.heroMediaUrl,
			targetIRR: formState.targetIRR,
			cashYield: formState.cashYield,
			preferredReturn: formState.preferredReturn,
			equityMultiple: formState.equityMultiple,
			riskNotes: formState.riskNotes,
			downsideNotes: formState.downsideNotes,
			deckUrl: formState.deckUrl,
			primarySourceUrl: formState.primarySourceUrl,
			primarySourceContext: formState.primarySourceContext,
			holdPeriod: formState.holdPeriod,
			investingGeography: formState.investingGeography,
			feeSummary: formState.feeSummary,
			redemption: formState.redemption,
			financials: formState.financials,
			taxCharacteristics: formState.taxCharacteristics,
			tags: formState.tags
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean),
			investmentStrategy: formState.investmentStrategy,
			operatorBackground: formState.operatorBackground,
			keyDates: formState.keyDates,
			updatedAt: existingDeal?.updatedAt || existingDeal?.updated_at || null
		};
	}

	function toOptionalNumber(value) {
		if (value === null || value === undefined || value === '') return null;
		const numericValue =
			typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
		return Number.isFinite(numericValue) ? numericValue : null;
	}

	function toOptionalString(value) {
		const stringValue = String(value || '').trim();
		return stringValue;
	}

	function buildSavePayload(formState) {
		return {
			investmentName: toOptionalString(formState.investmentName),
			sponsorName: toOptionalString(formState.sponsorName),
			slug: toOptionalString(formState.slug) || slugify(formState.investmentName),
			assetClass: toOptionalString(formState.assetClass),
			dealType: toOptionalString(formState.dealType),
			offeringType: toOptionalString(formState.offeringType),
			availableTo: toOptionalString(formState.availableTo),
			status: toOptionalString(formState.status),
			shortSummary: toOptionalString(formState.shortSummary),
			investmentStrategy: toOptionalString(formState.investmentStrategy),
			investmentMinimum: toOptionalNumber(formState.investmentMinimum),
			targetIRR: toOptionalNumber(formState.targetIRR),
			cashYield: toOptionalNumber(formState.cashYield),
			preferredReturn: toOptionalNumber(formState.preferredReturn),
			equityMultiple: toOptionalNumber(formState.equityMultiple),
			holdPeriod: toOptionalNumber(formState.holdPeriod),
			lpGpSplit: toOptionalString(formState.lpGpSplit),
			investingGeography: toOptionalString(formState.investingGeography),
			feeSummary: toOptionalString(formState.feeSummary),
			redemption: toOptionalString(formState.redemption),
			financials: toOptionalString(formState.financials),
			taxCharacteristics: toOptionalString(formState.taxCharacteristics),
			coverImageUrl: toOptionalString(formState.coverImageUrl),
			heroMediaUrl: toOptionalString(formState.heroMediaUrl),
			riskNotes: toOptionalString(formState.riskNotes),
			downsideNotes: toOptionalString(formState.downsideNotes),
			deckUrl: toOptionalString(formState.deckUrl),
			primarySourceUrl: toOptionalString(formState.primarySourceUrl),
			primarySourceContext: toOptionalString(formState.primarySourceContext),
			operatorBackground: toOptionalString(formState.operatorBackground),
			keyDates: toOptionalString(formState.keyDates),
			tags: formState.tags
				.split(',')
				.map((item) => item.trim())
				.filter(Boolean)
		};
	}

	function lifecycleTone(status) {
		if (status === 'published') return 'published';
		if (status === 'approved') return 'approved';
		if (status === 'archived') return 'archived';
		return 'working';
	}

	let loading = $state(true);
	let saving = $state(false);
	let loadError = $state('');
	let saveError = $state('');
	let saveMessage = $state('');
	let dirty = $state(false);
	let deal = $state(null);
	let form = $state(createEmptyForm());
	let previousDealId = $state('');

	const dealId = $derived($page.url.searchParams.get('id') || '');
	const completeness = $derived(computeDealCompleteness(buildCompletenessDeal(form, deal)));
	const lifecycleStatus = $derived(resolveDealLifecycleStatus(deal || {}));
	const isVisibleToUsers = $derived(resolveDealVisibility(deal || {}));
	const canPublishFromQueue = $derived(!completeness.hasBlockingIssues);
	const backHref = $derived($isAdmin ? '/app/admin/manage' : ($isGP ? '/gp-dashboard' : '/app/deals'));
	const backLabel = $derived($isAdmin ? 'Back to Queue' : ($isGP ? 'Back to Dashboard' : 'Back to Deals'));

	function markDirty() {
		dirty = true;
		saveMessage = '';
	}

	function generateSlug() {
		form.slug = slugify(form.investmentName);
		markDirty();
	}

	function resetForm() {
		if (!deal) return;
		form = createFormFromDeal(deal);
		dirty = false;
		saveError = '';
		saveMessage = '';
	}

	async function loadDeal() {
		if (!dealId) {
			loadError = 'Pick a deal from Manage Data to start review.';
			loading = false;
			return;
		}

		loading = true;
		loadError = '';

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to review deals.');

			const response = await fetch(`/api/deals?id=${encodeURIComponent(dealId)}`, {
				headers: { Authorization: `Bearer ${token}` }
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok || !payload?.deal) {
				throw new Error(payload?.error || 'Failed to load deal.');
			}

			deal = payload.deal;
			form = createFormFromDeal(payload.deal);
			dirty = false;
			saveError = '';
		} catch (error) {
			loadError = error?.message || 'Failed to load deal.';
			deal = null;
		} finally {
			loading = false;
		}
	}

	async function saveDeal() {
		if (!dealId || saving) return;

		saving = true;
		saveError = '';
		saveMessage = '';

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active session to save deals.');

			const response = await fetch(`/api/deals/${encodeURIComponent(dealId)}`, {
				method: 'PATCH',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(buildSavePayload(form))
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok || !payload?.deal) {
				throw new Error(payload?.error || 'Failed to save deal.');
			}

			deal = payload.deal;
			form = createFormFromDeal(payload.deal);
			dirty = false;
			saveMessage = 'Deal saved.';
		} catch (error) {
			saveError = error?.message || 'Failed to save deal.';
		} finally {
			saving = false;
		}
	}

	onMount(async () => {
		previousDealId = dealId;
		await loadDeal();
	});

	$effect(() => {
		if (!dealId || dealId === previousDealId) return;
		previousDealId = dealId;
		void loadDeal();
	});
</script>

<svelte:head>
	<title>Deal Review | GYC Dealflow</title>
</svelte:head>

<PageContainer className="deal-review-page ly-page-stack">
	<PageHeader
		title={deal ? form.investmentName || 'Untitled deal' : 'Deal Review'}
		subtitle="Fix missing fields, tighten source context, and move the deal toward approval with confidence."
		className="deal-review-header"
	>
		<div slot="actions" class="header-actions">
			<button type="button" class="ghost-btn" onclick={() => goto(backHref)}>
				{backLabel}
			</button>
			{#if dealId}
				<a class="ghost-btn" href={`/deal/${dealId}`}>Open Deal</a>
			{/if}
			<button type="button" class="primary-btn" onclick={saveDeal} disabled={loading || saving || !dirty}>
				{saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
			</button>
		</div>
	</PageHeader>

	{#if loading}
		<div class="state-card">Loading deal data...</div>
	{:else if loadError}
		<div class="state-card state-card--error">
			<strong>Could not load this deal.</strong>
			<p>{loadError}</p>
			<div class="state-actions">
				<button type="button" class="ghost-btn" onclick={loadDeal}>Retry</button>
				<button type="button" class="ghost-btn" onclick={() => goto(backHref)}>{backLabel}</button>
			</div>
		</div>
	{:else}
		<div class="review-layout">
			<form class="editor-stack" oninput={markDirty} onchange={markDirty} onsubmit={(event) => { event.preventDefault(); saveDeal(); }}>
				{#if saveError}
					<div class="message-banner message-banner--error">{saveError}</div>
				{/if}
				{#if saveMessage}
					<div class="message-banner message-banner--success">{saveMessage}</div>
				{/if}

				<section class="editor-card">
					<div class="card-heading">
						<div>
							<h2>Core deal profile</h2>
							<p>These fields drive the queue score and the basic user-facing listing quality.</p>
						</div>
					</div>
					<div class="field-grid">
						<label class="field field--span-2">
							<span>Deal name</span>
							<input bind:value={form.investmentName} placeholder="Sunrise Multifamily Fund II" />
						</label>
						<label class="field">
							<span>Sponsor</span>
							<input bind:value={form.sponsorName} placeholder="Operator or sponsor entity" />
						</label>
						<label class="field">
							<span>Asset class</span>
							<input bind:value={form.assetClass} placeholder="Multifamily, debt fund, industrial..." />
						</label>
						<label class="field field--span-2">
							<span class="field-label-row">
								<span>Slug</span>
								<button type="button" class="inline-btn" onclick={generateSlug}>Generate from name</button>
							</span>
							<input bind:value={form.slug} placeholder="sunrise-multifamily-fund-ii" />
						</label>
						<label class="field">
							<span>Deal type</span>
							<input bind:value={form.dealType} placeholder="Fund, syndication, JV..." />
						</label>
						<label class="field">
							<span>Offering type</span>
							<input bind:value={form.offeringType} placeholder="506(c), evergreen, note..." />
						</label>
						<label class="field">
							<span>Offering status</span>
							<input bind:value={form.status} placeholder="Draft, open, fully funded..." />
						</label>
						<label class="field">
							<span>Available to</span>
							<input bind:value={form.availableTo} placeholder="Accredited investors, members..." />
						</label>
						<label class="field">
							<span>Minimum investment</span>
							<input bind:value={form.investmentMinimum} type="number" min="0" step="1000" placeholder="50000" />
						</label>
						<label class="field">
							<span>Geography / market</span>
							<input bind:value={form.investingGeography} placeholder="Dallas-Fort Worth, Southeast US..." />
						</label>
						<label class="field field--span-2">
							<span>Short summary</span>
							<textarea
								bind:value={form.shortSummary}
								rows="4"
								placeholder="What is the deal, why does it exist, and what should an investor understand immediately?"
							></textarea>
						</label>
						<label class="field field--span-2">
							<span>Strategy / tags context</span>
							<textarea
								bind:value={form.investmentStrategy}
								rows="3"
								placeholder="Value-add multifamily in growth markets, bridge lending, income-focused note strategy..."
							></textarea>
						</label>
					</div>
				</section>

				<section class="editor-card">
					<div class="card-heading">
						<div>
							<h2>Returns and economics</h2>
							<p>Capture the payout profile, time horizon, fees, and any LP terms that matter for review.</p>
						</div>
					</div>
					<div class="field-grid">
						<label class="field">
							<span>Target IRR</span>
							<input bind:value={form.targetIRR} type="number" step="0.1" placeholder="15" />
						</label>
						<label class="field">
							<span>Cash yield</span>
							<input bind:value={form.cashYield} type="number" step="0.1" placeholder="8" />
						</label>
						<label class="field">
							<span>Preferred return</span>
							<input bind:value={form.preferredReturn} type="number" step="0.1" placeholder="8" />
						</label>
						<label class="field">
							<span>Equity multiple</span>
							<input bind:value={form.equityMultiple} type="number" step="0.01" placeholder="2.0" />
						</label>
						<label class="field">
							<span>Hold period (years)</span>
							<input bind:value={form.holdPeriod} type="number" step="0.1" placeholder="5" />
						</label>
						<label class="field">
							<span>LP / GP split</span>
							<input bind:value={form.lpGpSplit} placeholder="80/20 after pref" />
						</label>
						<label class="field field--span-2">
							<span>Fee summary</span>
							<textarea
								bind:value={form.feeSummary}
								rows="3"
								placeholder="Acquisition, asset management, disposition, promote..."
							></textarea>
						</label>
						<label class="field">
							<span>Liquidity / redemption terms</span>
							<textarea bind:value={form.redemption} rows="3" placeholder="Lockup, redemption windows, gates..." ></textarea>
						</label>
						<label class="field">
							<span>Audited / financials</span>
							<input bind:value={form.financials} placeholder="Audited, unaudited, quarterly reviewed..." />
						</label>
						<label class="field field--span-2">
							<span>Tax characteristics</span>
							<textarea
								bind:value={form.taxCharacteristics}
								rows="3"
								placeholder="K-1 timing, depreciation profile, 1099, state filing considerations..."
							></textarea>
						</label>
					</div>
				</section>

				<section class="editor-card">
					<div class="card-heading">
						<div>
							<h2>Risk and diligence notes</h2>
							<p>Use this section to make the review trustworthy, not just complete.</p>
						</div>
					</div>
					<div class="field-grid">
						<label class="field field--span-2">
							<span>Risk notes</span>
							<textarea
								bind:value={form.riskNotes}
								rows="4"
								placeholder="Market, leverage, execution, concentration, sponsor, or structure risks..."
							></textarea>
						</label>
						<label class="field field--span-2">
							<span>Downside notes</span>
							<textarea
								bind:value={form.downsideNotes}
								rows="4"
								placeholder="What happens if underwriting assumptions miss? How is downside absorbed?"
							></textarea>
						</label>
						<label class="field field--span-2">
							<span>Operator background</span>
							<textarea
								bind:value={form.operatorBackground}
								rows="4"
								placeholder="Track record, experience, prior exits, team credibility, and relevant context..."
							></textarea>
						</label>
						<label class="field field--span-2">
							<span>Key dates</span>
							<textarea
								bind:value={form.keyDates}
								rows="3"
								placeholder="Launch date, target close, first distribution, extension options, maturity..."
							></textarea>
						</label>
					</div>
				</section>

				<section class="editor-card">
					<div class="card-heading">
						<div>
							<h2>Media and source context</h2>
							<p>Every publishable deal needs evidence, a usable hero asset, and enough source context to trust the entry.</p>
						</div>
					</div>
					<div class="field-grid">
						<label class="field">
							<span>Cover image URL</span>
							<input bind:value={form.coverImageUrl} placeholder="https://..." />
						</label>
						<label class="field">
							<span>Hero media URL</span>
							<input bind:value={form.heroMediaUrl} placeholder="https://..." />
						</label>
						<label class="field">
							<span>Deck URL</span>
							<input bind:value={form.deckUrl} placeholder="https://..." />
						</label>
						<label class="field">
							<span>Primary source URL</span>
							<input bind:value={form.primarySourceUrl} placeholder="https://..." />
						</label>
						<label class="field field--span-2">
							<span>Primary source / CTA context</span>
							<textarea
								bind:value={form.primarySourceContext}
								rows="3"
								placeholder="What is the source of truth here and what should a user do next?"
							></textarea>
						</label>
						<label class="field field--span-2">
							<span>Tags / strategy keywords</span>
							<input bind:value={form.tags} placeholder="Income, Sunbelt, GP co-invest, debt, multifamily" />
						</label>
					</div>
				</section>

				<div class="form-footer">
					<button type="button" class="ghost-btn" onclick={resetForm} disabled={!dirty || saving}>
						Reset unsaved changes
					</button>
					<button type="submit" class="primary-btn" disabled={saving}>
						{saving ? 'Saving...' : 'Save deal'}
					</button>
				</div>
			</form>

			<aside class="review-sidebar">
				<section class="sidebar-card sidebar-card--score">
					<div class="sidebar-eyebrow">Completeness</div>
					<div class="score-row">
						<div class="score-value">{completeness.completenessScore}%</div>
						<span class={`readiness-badge tone-${completeness.hasBlockingIssues ? 'blocked' : 'ready'}`}>
							{completeness.hasBlockingIssues ? 'Blocked' : completeness.readinessLabel}
						</span>
					</div>
					<div class="progress-shell" aria-hidden="true">
						<div class="progress-fill" style={`width:${completeness.completenessScore}%`}></div>
					</div>
					<p class="sidebar-copy">{completeness.readinessLabel}</p>
				</section>

				<section class="sidebar-card">
					<div class="sidebar-block">
						<div class="sidebar-label">Lifecycle status</div>
						<span class={`status-pill tone-${lifecycleTone(lifecycleStatus)}`}>
							{DEAL_LIFECYCLE_LABELS[lifecycleStatus] || lifecycleStatus}
						</span>
					</div>
					<div class="sidebar-block">
						<div class="sidebar-label">Visibility</div>
						<div class="sidebar-value">{isVisibleToUsers ? 'Visible to users' : 'Hidden from users'}</div>
					</div>
					<div class="sidebar-block">
						<div class="sidebar-label">Last updated</div>
						<div class="sidebar-value">{formatDateTime(deal?.updatedAt || deal?.updated_at || deal?.createdAt || deal?.created_at)}</div>
					</div>
				</section>

				<section class="sidebar-card">
					<div class="sidebar-label">Required gaps</div>
					{#if completeness.missingRequiredFields.length > 0}
						<ul class="checklist">
							{#each completeness.missingRequiredFields as field}
								<li>{field}</li>
							{/each}
						</ul>
					{:else}
						<p class="sidebar-copy">All required fields are present. This deal can be made visible from the queue.</p>
					{/if}
				</section>

				<section class="sidebar-card">
					<div class="sidebar-label">Recommended improvements</div>
					{#if completeness.missingRecommendedFields.length > 0}
						<ul class="checklist checklist--muted">
							{#each completeness.missingRecommendedFields as field}
								<li>{field}</li>
							{/each}
						</ul>
					{:else}
						<p class="sidebar-copy">Recommended fields look complete.</p>
					{/if}
				</section>

				<section class="sidebar-card sidebar-card--note">
					<div class="sidebar-label">Publishing rule</div>
					<p class="sidebar-copy">
						{#if canPublishFromQueue}
							This deal can be made visible from the queue once you are comfortable approving it.
						{:else}
							Visibility stays disabled in the queue until every required field above is filled in.
						{/if}
					</p>
				</section>
			</aside>
		</div>
	{/if}
</PageContainer>

<style>
	.deal-review-page { min-height: 100vh; }

	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.review-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.45fr) minmax(300px, 360px);
		gap: 20px;
		align-items: start;
	}

	.editor-stack,
	.review-sidebar {
		display: flex;
		flex-direction: column;
		gap: 16px;
		min-width: 0;
	}

	.editor-card,
	.sidebar-card,
	.state-card {
		padding: 20px;
		border-radius: 20px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 251, 0.98));
		border: 1px solid rgba(31, 81, 89, 0.1);
		box-shadow: 0 16px 34px rgba(16, 37, 42, 0.05);
	}

	.sidebar-card--score {
		background:
			linear-gradient(160deg, rgba(16, 37, 42, 0.98), rgba(31, 81, 89, 0.94)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.22), transparent 40%);
		color: #f7fafb;
	}

	.sidebar-card--note {
		background: rgba(81, 190, 123, 0.08);
	}

	.state-card--error {
		border-color: rgba(194, 65, 68, 0.18);
		background: rgba(255, 244, 244, 0.92);
	}

	.state-card strong,
	.card-heading h2 {
		display: block;
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--text-dark);
		margin: 0 0 6px;
	}

	.sidebar-card--score .sidebar-copy,
	.sidebar-card--score .sidebar-eyebrow,
	.sidebar-card--score .sidebar-label,
	.sidebar-card--score .sidebar-value {
		color: rgba(247, 250, 251, 0.8);
	}

	.card-heading p,
	.sidebar-copy,
	.state-card p {
		margin: 0;
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-muted);
	}

	.field-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
		margin-top: 16px;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.field--span-2 {
		grid-column: 1 / -1;
	}

	.field span,
	.sidebar-label,
	.sidebar-eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.field-label-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.field input,
	.field textarea {
		width: 100%;
		padding: 11px 12px;
		border-radius: 12px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		background: rgba(255, 255, 255, 0.92);
		color: var(--text-dark);
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.45;
		outline: none;
		transition: border-color 0.16s ease, box-shadow 0.16s ease;
	}

	.field input:focus,
	.field textarea:focus {
		border-color: rgba(31, 81, 89, 0.34);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.field textarea {
		resize: vertical;
		min-height: 96px;
	}

	.ghost-btn,
	.primary-btn,
	.inline-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		text-decoration: none;
		cursor: pointer;
		transition: all 0.16s ease;
	}

	.ghost-btn,
	.inline-btn {
		padding: 10px 14px;
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: rgba(255, 255, 255, 0.9);
		color: var(--text-dark);
	}

	.inline-btn {
		padding: 6px 10px;
		font-size: 11px;
	}

	.primary-btn {
		padding: 10px 16px;
		border: 1px solid rgba(31, 81, 89, 0.16);
		background: linear-gradient(135deg, #1f5159, #10252a);
		color: #fff;
		box-shadow: 0 12px 24px rgba(16, 37, 42, 0.16);
	}

	.primary-btn:disabled,
	.ghost-btn:disabled {
		opacity: 0.55;
		cursor: default;
		box-shadow: none;
	}

	.form-footer,
	.state-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.message-banner {
		padding: 12px 14px;
		border-radius: 14px;
		font-size: 13px;
		font-weight: 600;
	}

	.message-banner--error {
		background: rgba(194, 65, 68, 0.1);
		color: #b42328;
		border: 1px solid rgba(194, 65, 68, 0.16);
	}

	.message-banner--success {
		background: rgba(22, 122, 82, 0.1);
		color: #167a52;
		border: 1px solid rgba(22, 122, 82, 0.16);
	}

	.score-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		margin: 10px 0 12px;
	}

	.score-value {
		font-family: var(--font-ui);
		font-size: 42px;
		font-weight: 800;
		line-height: 1;
	}

	.progress-shell {
		height: 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.16);
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #51be7b, #9be4b5);
	}

	.status-pill,
	.readiness-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 5px 10px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.2px;
	}

	.readiness-badge.tone-ready {
		background: rgba(22, 122, 82, 0.14);
		color: #167a52;
	}

	.readiness-badge.tone-blocked {
		background: rgba(194, 65, 68, 0.14);
		color: #b42328;
	}

	.sidebar-card--score .readiness-badge.tone-ready {
		background: rgba(81, 190, 123, 0.16);
		color: #f7fafb;
	}

	.sidebar-card--score .readiness-badge.tone-blocked {
		background: rgba(255, 255, 255, 0.12);
		color: #fff;
	}

	.status-pill.tone-published {
		background: rgba(22, 122, 82, 0.12);
		color: #167a52;
	}

	.status-pill.tone-approved {
		background: rgba(214, 140, 69, 0.14);
		color: #b56f2f;
	}

	.status-pill.tone-working {
		background: rgba(31, 81, 89, 0.1);
		color: #1f5159;
	}

	.status-pill.tone-archived {
		background: rgba(107, 114, 128, 0.14);
		color: #475467;
	}

	.sidebar-block + .sidebar-block {
		margin-top: 14px;
		padding-top: 14px;
		border-top: 1px solid rgba(31, 81, 89, 0.08);
	}

	.sidebar-value {
		margin-top: 4px;
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		line-height: 1.45;
	}

	.checklist {
		margin: 10px 0 0;
		padding-left: 18px;
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-dark);
	}

	.checklist--muted {
		color: var(--text-secondary);
	}

	@media (max-width: 980px) {
		.review-layout {
			grid-template-columns: 1fr;
		}

		.review-sidebar {
			order: -1;
		}
	}

	@media (max-width: 720px) {
		.field-grid {
			grid-template-columns: 1fr;
		}

		.field--span-2 {
			grid-column: auto;
		}

		.header-actions,
		.form-footer {
			align-items: stretch;
		}

		.ghost-btn,
		.primary-btn {
			width: 100%;
		}
	}
</style>
