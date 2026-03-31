<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import FieldRenderer from '$lib/components/deal-review/FieldRenderer.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';
	import {
		ensureSessionUserToken,
		getFreshSessionToken,
		getStoredSessionUser,
		isAdmin,
		isGP
	} from '$lib/stores/auth.js';
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
	import { currentAdminRealUser } from '$lib/utils/userScopedState.js';

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
	let deckInputEl = $state(null);
	let ppmInputEl = $state(null);
	let deckFile = $state(null);
	let deckFileBase64 = $state('');
	let ppmFile = $state(null);
	let ppmFileBase64 = $state('');
	let uploadError = $state('');
	let uploadState = $state('idle');
	let form = $state(createEmptyDealReviewForm());
	let fieldWarnings = $state({});
	let fieldErrors = $state({});
	let previousDealId = $state('');
	let extractionState = $state('idle');
	let extractionError = $state('');
	let extractionSummary = $state(null);
	let autoExtractionHandled = $state(false);

	const dealId = $derived($page.url.searchParams.get('id') || '');
	const reviewStep = $derived($page.url.searchParams.get('step') === 'intake' ? 'intake' : 'review');
	const shouldAutoExtract = $derived($page.url.searchParams.get('extract') === '1');
	const cameFromIntake = $derived($page.url.searchParams.get('from') === 'intake');
	const cameFromQueue = $derived($page.url.searchParams.get('from') === 'queue');
	const completeness = $derived(computeDealCompleteness(buildDealReviewCompletenessModel(form, deal)));
	const lifecycleStatus = $derived(resolveDealLifecycleStatus(deal || {}));
	const isVisibleToUsers = $derived(resolveDealVisibility(deal || {}));
	const canPublishFromQueue = $derived(!completeness.hasBlockingIssues);
	const backHref = $derived($isAdmin ? '/app/admin/manage' : ($isGP ? '/gp-dashboard' : '/app/deals'));
	const backLabel = $derived($isAdmin ? 'Back to Queue' : ($isGP ? 'Back to Dashboard' : 'Back to Deals'));
	const pageSubtitle = $derived(
		reviewStep === 'intake'
			? 'Upload the source documents first, then review and clean up the extracted deal details.'
			: 'Fix missing fields, tighten source context, and move the deal toward publishing with confidence.'
	);
	const hasSourceDocuments = $derived(
		Boolean(deal?.deckUrl || deal?.deck_url || deal?.ppmUrl || deal?.ppm_url)
	);
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

	function buildReviewHref({ step = 'review', extract = false, from = '' } = {}) {
		const params = new URLSearchParams({ id: dealId });
		if (from) params.set('from', from);
		if (step === 'intake') params.set('step', 'intake');
		if (extract) params.set('extract', '1');
		return `/deal-review?${params.toString()}`;
	}

	function clearExtractionFlags() {
		if (!browser) return;
		const nextUrl = new URL(window.location.href);
		nextUrl.searchParams.delete('extract');
		nextUrl.searchParams.delete('from');
		nextUrl.searchParams.delete('step');
		window.history.replaceState(window.history.state, '', `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
	}

	async function readFileAsBase64(file) {
		return new Promise((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = (event) => {
				const value = String(event?.target?.result || '');
				resolve(value.includes(',') ? value.split(',')[1] : value);
			};
			reader.onerror = () => reject(new Error('Could not read file.'));
			reader.readAsDataURL(file);
		});
	}

	async function setUploadFile(file, type) {
		if (!file) return;
		if (file.size > 25 * 1024 * 1024) {
			uploadError = 'File too large. Maximum size is 25MB.';
			return;
		}

		const base64 = await readFileAsBase64(file);
		if (type === 'deck') {
			deckFile = file;
			deckFileBase64 = base64;
		} else {
			ppmFile = file;
			ppmFileBase64 = base64;
		}
		uploadError = '';
	}

	function handleDrop(event, type) {
		event.preventDefault();
		const [file] = event.dataTransfer?.files || [];
		if (file) {
			void setUploadFile(file, type);
		}
	}

	function getActorFromSession() {
		const session = getStoredSessionUser() || {};
		const realAdmin = currentAdminRealUser();
		const actorEmail = String(realAdmin?.email || session.email || '').trim().toLowerCase();
		const actorName = String(
			realAdmin?.name ||
			realAdmin?.fullName ||
			session.name ||
			session.fullName ||
			''
		).trim();
		const managementCompanyId = session.managementCompany?.id || session.managementCompanyId || null;

		return {
			session,
			actorEmail,
			actorName,
			managementCompanyId
		};
	}

	async function uploadDocument({ base64, file, docType, actor }) {
		if (!file || !base64) return null;
		if (!actor.session?.token) {
			return 'Your session is missing the upload token needed for documents.';
		}

		const response = await fetch('/api/deck-upload', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${actor.session.token}`
			},
			body: JSON.stringify({
				dealId,
				dealName: docType === 'ppm' ? `${form.investmentName || deal?.investmentName || deal?.investment_name || 'Deal'} - PPM` : form.investmentName || deal?.investmentName || deal?.investment_name || 'Deal',
				filedata: base64,
				filename: file.name,
				docType,
				userEmail: actor.actorEmail,
				userName: actor.actorName,
				companyId: actor.managementCompanyId || ''
			})
		});

		if (response.ok) return null;
		const data = await response.json().catch(() => ({}));
		return data?.error || `Could not upload the ${docType.toUpperCase()} file.`;
	}

	async function continueFromIntake({ autoExtract = true } = {}) {
		if (!dealId || uploadState === 'running') return;

		const hasExistingSource = Boolean(deal?.deckUrl || deal?.deck_url || deal?.ppmUrl || deal?.ppm_url);
		if (autoExtract && !deckFile && !ppmFile && !hasExistingSource) {
			uploadError = 'Upload a deck or PPM before starting extraction, or continue to review manually.';
			return;
		}

		uploadState = 'running';
		uploadError = '';

		try {
			if (deckFile || ppmFile) {
				const actor = getActorFromSession();
				if (actor.session?.token) {
					const tokenState = await ensureSessionUserToken(actor.session);
					if (tokenState?.session) {
						actor.session = tokenState.session;
					}
				}

				const warnings = [];
				const deckWarning = await uploadDocument({
					base64: deckFileBase64,
					file: deckFile,
					docType: 'deck',
					actor
				});
				if (deckWarning) warnings.push(deckWarning);

				const ppmWarning = await uploadDocument({
					base64: ppmFileBase64,
					file: ppmFile,
					docType: 'ppm',
					actor
				});
				if (ppmWarning) warnings.push(ppmWarning);

				if (warnings.length > 0) {
					throw new Error(warnings.join('\n'));
				}
			}

			await loadDeal();
			autoExtractionHandled = false;
			await goto(buildReviewHref({ step: 'review', extract: autoExtract, from: cameFromQueue ? 'queue' : 'intake' }), {
				replaceState: true,
				noScroll: true,
				keepFocus: true
			});
		} catch (error) {
			uploadError = error?.message || 'Could not attach the source documents.';
		} finally {
			uploadState = 'idle';
		}
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
			if (!shouldAutoExtract) {
				extractionError = '';
			}
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

	async function runExtraction() {
		if (!dealId || extractionState === 'running') return;

		extractionState = 'running';
		extractionError = '';
		extractionSummary = null;
		saveMessage = '';

		try {
			const token = await getFreshSessionToken();
			if (!token) throw new Error('You need an active admin session to extract deal details.');

			const enrichResponse = await fetch('/api/deal-cleanup', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify({
					action: 'enrich-deal',
					dealId
				})
			});
			const enrichPayload = await enrichResponse.json().catch(() => ({}));

			if (!enrichResponse.ok || !enrichPayload?.success) {
				throw new Error(enrichPayload?.error || 'Failed to extract deal details.');
			}

			const updates = enrichPayload?.found_fields || {};
			let appliedCount = 0;

			if (Object.keys(updates).length > 0) {
				const applyResponse = await fetch('/api/deal-cleanup', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						Authorization: `Bearer ${token}`
					},
					body: JSON.stringify({
						action: 'apply-enrichment',
						dealId,
						updates
					})
				});
				const applyPayload = await applyResponse.json().catch(() => ({}));

				if (!applyResponse.ok || !applyPayload?.success) {
					throw new Error(applyPayload?.error || 'The extracted fields could not be applied.');
				}

				appliedCount = Array.isArray(applyPayload.fields_updated)
					? applyPayload.fields_updated.length
					: Object.keys(updates).length;

				await loadDeal();
			}

			extractionSummary = {
				fieldsFound: Object.keys(updates).length,
				fieldsApplied: appliedCount,
				sources: enrichPayload?.sources || [],
				steps: enrichPayload?.steps || [],
				notes: enrichPayload?.notes || ''
			};
			extractionState = 'success';
			saveMessage = appliedCount > 0
				? `We prefilled ${appliedCount} fields from the uploaded sources. Review them before publishing.`
				: 'The uploaded sources were processed. Review the deal details before publishing.';
		} catch (error) {
			extractionState = 'error';
			extractionError = error?.message || 'Failed to extract deal details.';
		} finally {
			clearExtractionFlags();
		}
	}

	onMount(async () => {
		previousDealId = dealId;
		await loadDeal();
	});

	$effect(() => {
		if (!dealId || dealId === previousDealId) return;
		previousDealId = dealId;
		autoExtractionHandled = false;
		void loadDeal();
	});

	$effect(() => {
		if (!shouldAutoExtract || autoExtractionHandled || loading || !deal) return;
		autoExtractionHandled = true;
		if (!hasSourceDocuments) {
			extractionState = 'idle';
			extractionError = '';
			saveMessage = 'No deck or PPM was uploaded, so this deal is ready for manual review.';
			clearExtractionFlags();
			return;
		}
		void runExtraction();
	});
</script>

<svelte:head>
	<title>Deal Review | GYC Dealflow</title>
</svelte:head>

<PageContainer className="deal-review-page ly-page-stack">
	<PageHeader
		title={deal ? form.investmentName || 'Untitled deal' : 'Deal Review'}
		subtitle={pageSubtitle}
		className="deal-review-header"
	>
		<div slot="actions" class="header-actions">
			<button type="button" class="ghost-btn" onclick={() => goto(backHref)}>
				{backLabel}
			</button>
			{#if dealId && reviewStep === 'review'}
				<a class="ghost-btn" href={`/deal/${dealId}`}>Open Deal</a>
				<button type="button" class="primary-btn" onclick={saveDeal} disabled={loading || saving || !dirty}>
					{saving ? 'Saving...' : dirty ? 'Save changes' : 'Saved'}
				</button>
			{/if}
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
		{#if reviewStep === 'intake'}
			<div class="intake-layout">
				<section class="intake-screen">
					<div class="intake-screen__header">
						<div class="intake-screen__eyebrow">Step 1 of 2</div>
						<h2>Upload the deck and PPM first</h2>
						<p>
							Attach the source documents for this deal, then move into review after we extract what we can.
						</p>
					</div>

					<div class="intake-screen__status-grid">
						<div class="doc-status-card">
							<div class="doc-status-card__label">Investment Deck</div>
							<div class="doc-status-card__value">
								{deckFile ? deckFile.name : deal?.deckUrl || deal?.deck_url ? 'Already attached' : 'Not uploaded'}
							</div>
						</div>
						<div class="doc-status-card">
							<div class="doc-status-card__label">PPM</div>
							<div class="doc-status-card__value">
								{ppmFile ? ppmFile.name : deal?.ppmUrl || deal?.ppm_url ? 'Already attached' : 'Not uploaded'}
							</div>
						</div>
					</div>

					<div class="intake-upload-grid">
						<div class="intake-upload-card">
							<div class="intake-upload-card__title">Deck</div>
							<div
								class="add-deal-modal__dropzone"
								class:is-active={Boolean(deckFile)}
								role="button"
								tabindex="0"
								onclick={() => deckInputEl?.click()}
								onkeydown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										deckInputEl?.click();
									}
								}}
								ondragover={(event) => event.preventDefault()}
								ondrop={(event) => handleDrop(event, 'deck')}
							>
								<div class="add-deal-modal__drop-icon">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
										<polyline points="17 8 12 3 7 8"></polyline>
										<line x1="12" y1="3" x2="12" y2="15"></line>
									</svg>
								</div>
								<div class="add-deal-modal__drop-copy">
									{#if deckFile}
										<strong>{deckFile.name}</strong> <span>({(deckFile.size / 1024 / 1024).toFixed(1)} MB)</span>
									{:else if deal?.deckUrl || deal?.deck_url}
										<strong>Deck already attached</strong> <span>Click to replace it</span>
									{:else}
										Drop a PDF here or click to upload
									{/if}
								</div>
							</div>
							<input
								bind:this={deckInputEl}
								type="file"
								accept=".pdf,.doc,.docx,.pptx,.ppt,.xlsx"
								class="add-deal-modal__file-input"
								onchange={(event) => setUploadFile(event.currentTarget.files?.[0], 'deck')}
							>
						</div>

						<div class="intake-upload-card">
							<div class="intake-upload-card__title">PPM</div>
							<div
								class="add-deal-modal__dropzone"
								class:is-active={Boolean(ppmFile)}
								role="button"
								tabindex="0"
								onclick={() => ppmInputEl?.click()}
								onkeydown={(event) => {
									if (event.key === 'Enter' || event.key === ' ') {
										event.preventDefault();
										ppmInputEl?.click();
									}
								}}
								ondragover={(event) => event.preventDefault()}
								ondrop={(event) => handleDrop(event, 'ppm')}
							>
								<div class="add-deal-modal__drop-icon">
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
										<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
										<polyline points="17 8 12 3 7 8"></polyline>
										<line x1="12" y1="3" x2="12" y2="15"></line>
									</svg>
								</div>
								<div class="add-deal-modal__drop-copy">
									{#if ppmFile}
										<strong>{ppmFile.name}</strong> <span>({(ppmFile.size / 1024 / 1024).toFixed(1)} MB)</span>
									{:else if deal?.ppmUrl || deal?.ppm_url}
										<strong>PPM already attached</strong> <span>Click to replace it</span>
									{:else}
										Drop a PDF here or click to upload
									{/if}
								</div>
							</div>
							<input
								bind:this={ppmInputEl}
								type="file"
								accept=".pdf,.doc,.docx"
								class="add-deal-modal__file-input"
								onchange={(event) => setUploadFile(event.currentTarget.files?.[0], 'ppm')}
							>
						</div>
					</div>

					{#if uploadError}
						<div class="message-banner message-banner--error">{uploadError}</div>
					{/if}

					<div class="intake-screen__actions">
						<button
							type="button"
							class="ghost-btn"
							onclick={() => continueFromIntake({ autoExtract: false })}
							disabled={uploadState === 'running'}
						>
							{uploadState === 'running' ? 'Working...' : 'Review Manually'}
						</button>
						<button
							type="button"
							class="primary-btn"
							onclick={() => continueFromIntake({ autoExtract: true })}
							disabled={uploadState === 'running'}
						>
							{uploadState === 'running' ? 'Uploading...' : 'Upload & Extract'}
						</button>
					</div>
				</section>
			</div>
		{:else}
			<div class="review-layout">
				<form class="editor-stack" onsubmit={(event) => { event.preventDefault(); saveDeal(); }}>
					{#if cameFromIntake || cameFromQueue || extractionState !== 'idle' || extractionSummary}
						<div class={`intake-banner intake-banner--${extractionState === 'error' ? 'error' : extractionState === 'running' ? 'working' : 'ready'}`}>
							<div class="intake-banner__header">
								<div>
									<div class="intake-banner__eyebrow">Step 2 of 2</div>
									<h2>Review extracted deal details</h2>
								</div>
								<div class="intake-banner__actions">
									{#if cameFromQueue}
										<button
											type="button"
											class="ghost-btn"
											onclick={() => goto(buildReviewHref({ step: 'intake', from: 'queue' }), { replaceState: true, noScroll: true, keepFocus: true })}
										>
											Back to Uploads
										</button>
									{/if}
									{#if hasSourceDocuments}
										<button
											type="button"
											class="ghost-btn"
											onclick={runExtraction}
											disabled={extractionState === 'running' || saving}
										>
											{extractionState === 'running' ? 'Extracting...' : 'Run extraction again'}
										</button>
									{/if}
								</div>
							</div>

							{#if extractionState === 'running'}
								<p>We’re extracting fields from the uploaded deck and PPM now. Stay on this page and review the details as they come in.</p>
							{:else if extractionState === 'error'}
								<p>{extractionError}</p>
							{:else if extractionSummary}
								<p>
									We found {extractionSummary.fieldsFound} candidate fields and applied {extractionSummary.fieldsApplied}
									to the draft. Review each section below before publishing.
								</p>
								{#if extractionSummary.steps.length > 0}
									<div class="intake-step-list">
										{#each extractionSummary.steps as step}
											<div class="intake-step-chip">
												<strong>{step.step || 'step'}</strong>
												<span>{step.fields_found || 0} fields</span>
											</div>
										{/each}
									</div>
								{/if}
							{:else}
								<p>
									Review the extracted details, fill any gaps, and publish only when you trust the record.
								</p>
							{/if}
						</div>
					{/if}

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

	.intake-layout {
		display: flex;
		justify-content: center;
	}

	.intake-screen {
		width: min(100%, 900px);
		padding: 24px;
		border-radius: 22px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 251, 0.98)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.12), transparent 40%);
		border: 1px solid rgba(31, 81, 89, 0.1);
		box-shadow: 0 16px 34px rgba(16, 37, 42, 0.05);
		display: flex;
		flex-direction: column;
		gap: 18px;
	}

	.intake-screen__header h2 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 28px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.intake-screen__header p {
		margin: 10px 0 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
		max-width: 680px;
	}

	.intake-screen__eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 10px;
	}

	.intake-screen__status-grid,
	.intake-upload-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 14px;
	}

	.doc-status-card,
	.intake-upload-card {
		padding: 16px;
		border-radius: 18px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.82);
	}

	.doc-status-card__label,
	.intake-upload-card__title {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 10px;
	}

	.doc-status-card__value {
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
		line-height: 1.5;
	}

	.intake-screen__actions,
	.intake-banner__actions {
		display: flex;
		align-items: center;
		justify-content: flex-end;
		gap: 12px;
		flex-wrap: wrap;
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
	.state-card,
	.intake-banner {
		padding: 20px;
		border-radius: 20px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(247, 250, 251, 0.98));
		border: 1px solid rgba(31, 81, 89, 0.1);
		box-shadow: 0 16px 34px rgba(16, 37, 42, 0.05);
	}

	.intake-banner {
		display: flex;
		flex-direction: column;
		gap: 12px;
		background:
			linear-gradient(180deg, rgba(18, 42, 48, 0.98), rgba(21, 58, 65, 0.94)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.14), transparent 40%);
		color: #f7fafb;
	}

	.intake-banner--error {
		background: rgba(255, 244, 244, 0.92);
		border-color: rgba(194, 65, 68, 0.16);
		color: #7a1d1d;
	}

	.intake-banner__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.intake-banner__eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.8px;
		text-transform: uppercase;
		color: rgba(247, 250, 251, 0.76);
		margin-bottom: 8px;
	}

	.intake-banner--error .intake-banner__eyebrow {
		color: #b42328;
	}

	.intake-banner h2 {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: inherit;
	}

	.intake-banner p {
		margin: 0;
		font-size: 13px;
		line-height: 1.6;
		color: inherit;
		opacity: 0.92;
	}

	.intake-step-list {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.intake-step-chip {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
		font-size: 12px;
		line-height: 1;
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

		.intake-screen__status-grid,
		.intake-upload-grid {
			grid-template-columns: 1fr;
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
		.form-footer,
		.intake-screen__actions,
		.intake-banner__actions {
			align-items: stretch;
		}

		.ghost-btn,
		.primary-btn {
			width: 100%;
		}

		.intake-screen {
			padding: 20px;
		}

		.intake-screen__header h2 {
			font-size: 24px;
		}
	}
</style>
