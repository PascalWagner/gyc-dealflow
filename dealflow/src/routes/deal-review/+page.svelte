<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import FieldRenderer from '$lib/components/deal-review/FieldRenderer.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import { getFreshSessionToken, isAdmin, isGP } from '$lib/stores/auth.js';
	import {
		buildDealReviewCompletenessModel,
		buildDealReviewPayload,
		createDealReviewFormFromDeal,
		createEmptyDealReviewForm,
		dealFieldConfig,
		dealReviewSections,
		getDealReviewFieldWarning
	} from '$lib/utils/dealReviewSchema.js';
	import {
		computeDealCompleteness,
		DEAL_LIFECYCLE_LABELS,
		resolveDealLifecycleStatus,
		resolveDealVisibility,
		slugify
	} from '$lib/utils/dealWorkflow.js';

	function formatDateTime(value) {
		if (!value) return 'Not yet saved';
		const date = new Date(value);
		return Number.isNaN(date.getTime()) ? 'Not yet saved' : date.toLocaleString();
	}

	function lifecycleTone(status) {
		if (status === 'published') return 'published';
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
	let form = $state(createEmptyDealReviewForm());
	let fieldWarnings = $state({});
	let fieldErrors = $state({});
	let previousDealId = $state('');

	const dealId = $derived($page.url.searchParams.get('id') || '');
	const completeness = $derived(computeDealCompleteness(buildDealReviewCompletenessModel(form, deal)));
	const lifecycleStatus = $derived(resolveDealLifecycleStatus(deal || {}));
	const isVisibleToUsers = $derived(resolveDealVisibility(deal || {}));
	const canPublishFromQueue = $derived(!completeness.hasBlockingIssues);
	const backHref = $derived($isAdmin ? '/app/admin/manage' : ($isGP ? '/gp-dashboard' : '/app/deals'));
	const backLabel = $derived($isAdmin ? 'Back to Queue' : ($isGP ? 'Back to Dashboard' : 'Back to Deals'));
	const schemaWarnings = $derived(
		Object.entries(fieldWarnings).filter(([, message]) => Boolean(message))
	);

	function markDirty() {
		dirty = true;
		saveMessage = '';
	}

	function updateField(fieldKey, nextValue) {
		form = {
			...form,
			[fieldKey]: nextValue
		};
		fieldErrors = {
			...fieldErrors,
			[fieldKey]: ''
		};
		fieldWarnings = {
			...fieldWarnings,
			[fieldKey]: getDealReviewFieldWarning(fieldKey, nextValue)
		};
		markDirty();
	}

	function generateSlug() {
		updateField('slug', slugify(form.investmentName));
	}

	function resetForm() {
		if (!deal) return;
		const hydrated = createDealReviewFormFromDeal(deal);
		form = hydrated.form;
		fieldWarnings = hydrated.warnings;
		fieldErrors = {};
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
			const hydrated = createDealReviewFormFromDeal(payload.deal);
			form = hydrated.form;
			fieldWarnings = hydrated.warnings;
			fieldErrors = {};
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

		const { payload: nextPayload, errors } = buildDealReviewPayload(form);
		if (Object.keys(errors).length > 0) {
			fieldErrors = errors;
			saveError = 'Fix the highlighted fields before saving.';
			saveMessage = '';
			return;
		}

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
				body: JSON.stringify(nextPayload)
			});
			const payload = await response.json().catch(() => ({}));

			if (!response.ok || !payload?.deal) {
				if (payload?.fieldErrors && typeof payload.fieldErrors === 'object') {
					const nextFieldErrors = { ...payload.fieldErrors };
					if (nextFieldErrors.managementCompanyId && !nextFieldErrors.sponsor) {
						nextFieldErrors.sponsor = nextFieldErrors.managementCompanyId;
					}
					if (nextFieldErrors.sponsorName && !nextFieldErrors.sponsor) {
						nextFieldErrors.sponsor = nextFieldErrors.sponsorName;
					}
					fieldErrors = {
						...fieldErrors,
						...nextFieldErrors
					};
				}
				throw new Error(payload?.error || 'Failed to save deal.');
			}

			deal = payload.deal;
			const hydrated = createDealReviewFormFromDeal(payload.deal);
			form = hydrated.form;
			fieldWarnings = hydrated.warnings;
			fieldErrors = {};
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
		subtitle="Fix missing fields, tighten source context, and move the deal toward publishing with confidence."
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
			<form class="editor-stack" onsubmit={(event) => { event.preventDefault(); saveDeal(); }}>
				{#if saveError}
					<div class="message-banner message-banner--error">{saveError}</div>
				{/if}
				{#if saveMessage}
					<div class="message-banner message-banner--success">{saveMessage}</div>
				{/if}
				{#if schemaWarnings.length > 0}
					<div class="message-banner message-banner--warning">
						Some imported values do not match the canonical field options yet. Review the highlighted structured fields before publishing.
					</div>
				{/if}

				{#each dealReviewSections as section}
					<section class="editor-card">
						<div class="card-heading">
							<div>
								<h2>{section.title}</h2>
								<p>{section.description}</p>
							</div>
						</div>
						<div class="field-grid">
							{#each section.fields as fieldKey}
								<FieldRenderer
									field={dealFieldConfig[fieldKey]}
									value={form[fieldKey]}
									error={fieldErrors[fieldKey] || ''}
									warning={fieldWarnings[fieldKey] || ''}
									onupdate={(nextValue) => updateField(fieldKey, nextValue)}
									onaction={fieldKey === 'slug' ? generateSlug : null}
								/>
							{/each}
						</div>
					</section>
				{/each}

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
						<div class="sidebar-label">Catalog state</div>
						<div class="sidebar-value">{isVisibleToUsers ? 'Live in Deal Flow' : 'Not published yet'}</div>
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
						<p class="sidebar-copy">All required fields are present. This deal is ready to be published from the queue.</p>
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
							This deal can be published from the queue once you are comfortable making it live.
						{:else}
							This deal should stay unpublished until every required field above is filled in.
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

	.message-banner--warning {
		background: rgba(214, 140, 69, 0.12);
		color: #8c581f;
		border: 1px solid rgba(214, 140, 69, 0.18);
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
