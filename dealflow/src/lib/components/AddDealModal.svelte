<script>
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import { queryMemberDeals, dealStages } from '$lib/stores/deals.js';
	import { getFreshSessionToken, getStoredSessionUser } from '$lib/stores/auth.js';
	import {
		getDefaultSubmissionIntent,
		getSubmissionIntentDescription,
		getSubmissionStage,
		getSubmissionSuccessCopy,
		normalizeSubmissionIntent,
		normalizeSubmissionSurface
	} from '$lib/utils/dealSubmission.js';

	let {
		entrySurface = 'deal_flow',
		defaultIntent = '',
		title = '',
		onclose = () => {},
		onsubmitted = () => {}
	} = $props();

	const normalizedEntrySurface = normalizeSubmissionSurface(entrySurface, 'deal_flow');
	const initialIntent = normalizeSubmissionIntent(
		defaultIntent,
		getDefaultSubmissionIntent(normalizedEntrySurface)
	);

	let nameInputEl = $state(null);
	let deckInputEl = $state(null);
	let ppmInputEl = $state(null);

	let investmentName = $state('');
	let sponsor = $state('');
	let website = $state('');
	let submissionIntent = $state(initialIntent);
	let selectedExistingDeal = $state(null);

	let deckFile = $state(null);
	let deckFileBase64 = $state('');
	let ppmFile = $state(null);
	let ppmFileBase64 = $state('');

	let searchResults = $state([]);
	let showSearchResults = $state(false);
	let searchMessage = $state('');
	let searching = $state(false);
	let submitting = $state(false);
	let submitError = $state('');
	let submitWarnings = $state([]);
	let successCopy = $state(null);

	let searchRequestId = 0;
	let blurTimer = null;

	const modalTitle = $derived.by(() => {
		if (title) return title;
		if (normalizedEntrySurface === 'portfolio') return 'Add Existing Investment';
		return 'Add Deal';
	});

	const submitButtonLabel = $derived.by(() =>
		submissionIntent === 'invested' ? 'Add to Invested' : 'Add to Review'
	);

	onMount(() => {
		tick().then(() => nameInputEl?.focus());
	});

	function closeModal() {
		if (submitting) return;
		onclose();
	}

	function clearBlurTimer() {
		if (blurTimer) {
			window.clearTimeout(blurTimer);
			blurTimer = null;
		}
	}

	function resetSubmissionState({ keepIntent = true } = {}) {
		investmentName = '';
		sponsor = '';
		website = '';
		selectedExistingDeal = null;
		deckFile = null;
		deckFileBase64 = '';
		ppmFile = null;
		ppmFileBase64 = '';
		searchResults = [];
		showSearchResults = false;
		searchMessage = '';
		searching = false;
		submitting = false;
		submitError = '';
		submitWarnings = [];
		successCopy = null;
		if (!keepIntent) {
			submissionIntent = initialIntent;
		}
		tick().then(() => nameInputEl?.focus());
	}

	function normalizeDisplayField(...values) {
		for (const value of values) {
			const normalized = String(value || '').trim();
			if (normalized) return normalized;
		}
		return '';
	}

	function getDealName(deal) {
		return normalizeDisplayField(deal?.investmentName, deal?.investment_name, deal?.name);
	}

	function getDealSponsor(deal) {
		return normalizeDisplayField(
			deal?.managementCompany,
			deal?.management_company_name,
			deal?.management_company,
			deal?.sponsor
		);
	}

	function getDealAssetClass(deal) {
		return normalizeDisplayField(deal?.assetClass, deal?.asset_class);
	}

	function getLifecycleStatus(deal) {
		return normalizeDisplayField(deal?.lifecycleStatus, deal?.lifecycle_status).toLowerCase();
	}

	async function searchExistingDeals(query) {
		const trimmed = String(query || '').trim();
		if (trimmed.length < 2) {
			searchResults = [];
			searchMessage = '';
			searching = false;
			showSearchResults = false;
			return;
		}

		const requestId = ++searchRequestId;
		searching = true;
		showSearchResults = true;
		searchMessage = '';

		try {
			const data = await queryMemberDeals({
				search: trimmed,
				scope: 'browse',
				limit: 8,
				showArchived: true,
				internal: true
			});

			if (requestId !== searchRequestId) return;

			searchResults = (data?.deals || []).map((deal) => ({
				id: deal.id,
				name: getDealName(deal),
				sponsor: getDealSponsor(deal),
				assetClass: getDealAssetClass(deal),
				lifecycleStatus: getLifecycleStatus(deal)
			}));
			searchMessage =
				searchResults.length === 0
					? 'No existing deals found. Continue below to create a new submission.'
					: '';
		} catch (error) {
			if (requestId !== searchRequestId) return;
			searchResults = [];
			searchMessage = error?.message || 'Could not search deals right now.';
		} finally {
			if (requestId === searchRequestId) {
				searching = false;
			}
		}
	}

	function clearSelectedExistingDeal() {
		selectedExistingDeal = null;
		submitError = '';
		void searchExistingDeals(investmentName);
		tick().then(() => nameInputEl?.focus());
	}

	function handleNameInput(event) {
		investmentName = event.currentTarget.value;
		if (selectedExistingDeal && investmentName.trim() !== selectedExistingDeal.name) {
			selectedExistingDeal = null;
		}
		void searchExistingDeals(investmentName);
	}

	function handleNameFocus() {
		clearBlurTimer();
		if (!selectedExistingDeal && investmentName.trim().length >= 2) {
			showSearchResults = true;
			void searchExistingDeals(investmentName);
		}
	}

	function handleNameBlur() {
		clearBlurTimer();
		blurTimer = window.setTimeout(() => {
			showSearchResults = false;
		}, 180);
	}

	function selectExistingDeal(result) {
		selectedExistingDeal = result;
		investmentName = result.name;
		sponsor = result.sponsor || sponsor;
		showSearchResults = false;
		searchResults = [];
		searchMessage = '';
		submitError = '';
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
		if (!file) {
			if (type === 'deck') {
				deckFile = null;
				deckFileBase64 = '';
			} else {
				ppmFile = null;
				ppmFileBase64 = '';
			}
			return;
		}

		if (file.size > 25 * 1024 * 1024) {
			submitError = 'File too large. Maximum size is 25MB.';
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
		submitError = '';
	}

	function removeUpload(type) {
		if (type === 'deck') {
			deckFile = null;
			deckFileBase64 = '';
			if (deckInputEl) deckInputEl.value = '';
		} else {
			ppmFile = null;
			ppmFileBase64 = '';
			if (ppmInputEl) ppmInputEl.value = '';
		}
	}

	function handleDrop(event, type) {
		event.preventDefault();
		const [file] = event.dataTransfer?.files || [];
		if (file) {
			void setUploadFile(file, type);
		}
	}

	function formatStatusBadge(lifecycleStatus = '') {
		const normalized = String(lifecycleStatus || '').trim().toLowerCase();
		if (!normalized || normalized === 'published') return 'Live';
		if (normalized === 'approved') return 'Approved';
		if (normalized === 'in_review') return 'In Review';
		if (normalized === 'do_not_publish') return 'Not Approved';
		return 'Pending';
	}

	function getCurrentSessionName() {
		const session = getStoredSessionUser() || {};
		return String(
			session.name || session.fullName || session.full_name || session.user_metadata?.full_name || ''
		).trim();
	}

	async function uploadDocument({ token, dealId, dealName, sponsorName, base64, file, docType }) {
		if (!file || !base64) return null;

		const response = await fetch('/api/deck-upload', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
			body: JSON.stringify({
				dealId,
				dealName,
				filedata: base64,
				filename: file.name,
				docType,
				userEmail: getStoredSessionUser()?.email || '',
				userName: getCurrentSessionName(),
				companyId: '',
				notes: sponsorName ? `Sponsor: ${sponsorName}` : '',
				submissionIntent,
				entrySurface: normalizedEntrySurface,
				submissionKind: 'document_upload'
			})
		});

		if (response.ok) return null;
		const data = await response.json().catch(() => ({}));
		return data?.error || `Could not upload the ${docType.toUpperCase()} file.`;
	}

	async function ensurePortfolioPlaceholder({ token, dealId, dealName, sponsorName }) {
		const response = await fetch('/api/userdata', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				type: 'portfolio',
				data: {
					'Deal ID': dealId,
					'Investment Name': dealName,
					Sponsor: sponsorName || '',
					Status: 'Pending',
					Notes: 'Submitted through Add Deal and awaiting review.'
				}
			})
		});

		if (response.ok) return null;
		const data = await response.json().catch(() => ({}));
		return data?.error || 'The deal was added, but we could not sync the portfolio placeholder.';
	}

	async function handleSuccessAction(action, href = '') {
		if (action === 'reset') {
			resetSubmissionState({ keepIntent: true });
			return;
		}
		if (href) {
			closeModal();
			await goto(href);
			return;
		}
		closeModal();
	}

	async function submitDeal() {
		submitError = '';
		submitWarnings = [];

		const trimmedName = investmentName.trim();
		const trimmedSponsor = sponsor.trim();
		const trimmedWebsite = website.trim();

		if (!trimmedName) {
			submitError = 'Please enter the deal name.';
			return;
		}

		if (!selectedExistingDeal && !trimmedSponsor) {
			submitError = 'Please enter the sponsor or management company.';
			return;
		}

		submitting = true;

		try {
			const token = await getFreshSessionToken();
			if (!token) {
				throw new Error('Please sign in again to submit this deal.');
			}

			const createResponse = await fetch('/api/deal-create', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(
					selectedExistingDeal
						? {
								existingDealId: selectedExistingDeal.id,
								investmentName: selectedExistingDeal.name,
								sponsor: selectedExistingDeal.sponsor,
								intent: submissionIntent,
								entrySurface: normalizedEntrySurface
							}
						: {
								investmentName: trimmedName,
								sponsor: trimmedSponsor,
								website: trimmedWebsite,
								lifecycleStatus: 'in_review',
								intent: submissionIntent,
								entrySurface: normalizedEntrySurface
							}
				)
			});

			const createData = await createResponse.json().catch(() => ({}));
			if (!createResponse.ok || !createData?.dealId) {
				throw new Error(createData?.error || 'Could not submit the deal right now.');
			}

			const stage = getSubmissionStage(submissionIntent);
			const dealName = createData.investmentName || selectedExistingDeal?.name || trimmedName;
			const sponsorName = createData.sponsorName || selectedExistingDeal?.sponsor || trimmedSponsor;
			const warnings = [];

			const stageResult = await dealStages.setStage(createData.dealId, stage);
			if (!stageResult?.ok) {
				warnings.push('The deal was submitted, but the pipeline stage did not update right away. Refresh if you do not see it immediately.');
			}

			if (stage === 'invested') {
				const portfolioWarning = await ensurePortfolioPlaceholder({
					token,
					dealId: createData.dealId,
					dealName,
					sponsorName
				});
				if (portfolioWarning) warnings.push(portfolioWarning);
			}

			const deckWarning = await uploadDocument({
				token,
				dealId: createData.dealId,
				dealName,
				sponsorName,
				base64: deckFileBase64,
				file: deckFile,
				docType: 'deck'
			});
			if (deckWarning) warnings.push(deckWarning);

			const ppmWarning = await uploadDocument({
				token,
				dealId: createData.dealId,
				dealName,
				sponsorName,
				base64: ppmFileBase64,
				file: ppmFile,
				docType: 'ppm'
			});
			if (ppmWarning) warnings.push(ppmWarning);

			const submissionDetail = {
				dealId: createData.dealId,
				dealName,
				sponsorName,
				intent: submissionIntent,
				stage,
				entrySurface: normalizedEntrySurface,
				createdNewDeal: createData.createdNewDeal !== false,
				linkedExistingDeal: createData.linkedExistingDeal === true,
				lifecycleStatus: createData.lifecycleStatus || 'in_review',
				warnings
			};

			submitWarnings = warnings;
			successCopy = getSubmissionSuccessCopy({
				intent: submissionIntent,
				entrySurface: normalizedEntrySurface,
				createdNewDeal: createData.createdNewDeal !== false,
				dealName
			});

			try {
				await onsubmitted(submissionDetail);
			} catch (callbackError) {
				submitWarnings = [
					...warnings,
					callbackError?.message || 'The deal was submitted, but the page did not refresh automatically.'
				];
			}
		} catch (error) {
			submitError = error?.message || 'Could not submit the deal right now.';
		} finally {
			submitting = false;
		}
	}

	$effect(() => {
		if (!browser) return;
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = 'hidden';

		return () => {
			document.body.style.overflow = previousOverflow;
			clearBlurTimer();
		};
	});
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') {
			event.preventDefault();
			closeModal();
		}
	}}
/>

<div
	class="add-deal-modal__overlay"
	role="button"
	tabindex="0"
	aria-label="Close add deal modal"
	onclick={(event) => {
		if (event.target === event.currentTarget) closeModal();
	}}
	onkeydown={(event) => {
		if (event.target !== event.currentTarget) return;
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			closeModal();
		}
	}}
>
	<div class="add-deal-modal__card" role="dialog" aria-modal="true" aria-labelledby="add-deal-modal-title">
		<div class="add-deal-modal__top">
			<div>
				<div class="add-deal-modal__eyebrow">{successCopy ? 'Submission Complete' : 'Deal Intake'}</div>
				<div id="add-deal-modal-title" class="add-deal-modal__title">{modalTitle}</div>
				<p class="add-deal-modal__copy">
					{#if successCopy}
						Review the next step below.
					{:else}
						Add the deal once, tell us whether you are evaluating it or already invested, and we will route it into your dashboard plus the normal deal review queue.
					{/if}
				</p>
			</div>
			<button class="add-deal-modal__close" aria-label="Close add deal modal" onclick={closeModal}>&times;</button>
		</div>

		{#if successCopy}
			<div class="add-deal-modal__success">
				<div class="add-deal-modal__success-badge">{successCopy.eyebrow}</div>
				<h3 class="add-deal-modal__success-title">{successCopy.title}</h3>
				<p class="add-deal-modal__success-body">{successCopy.body}</p>

				{#if submitWarnings.length > 0}
					<div class="add-deal-modal__warning-box">
						<div class="add-deal-modal__warning-title">A few follow-ups to note</div>
						{#each submitWarnings as warning}
							<div class="add-deal-modal__warning-item">{warning}</div>
						{/each}
					</div>
				{/if}

				<div class="add-deal-modal__actions add-deal-modal__actions--success">
					<button
						class="add-deal-modal__primary"
						onclick={() => handleSuccessAction(successCopy.primaryAction, successCopy.primaryHref)}
					>
						{successCopy.primaryLabel}
					</button>
					<button
						class="add-deal-modal__secondary"
						onclick={() => handleSuccessAction(successCopy.secondaryAction, successCopy.secondaryHref)}
					>
						{successCopy.secondaryLabel}
					</button>
				</div>
			</div>
		{:else}
			<div class="add-deal-modal__grid">
				<div class="add-deal-modal__field add-deal-modal__field--full add-deal-modal__field--search">
					<label for="addDealName">Deal Name *</label>
					<input
						id="addDealName"
						bind:this={nameInputEl}
						value={investmentName}
						placeholder="Search existing deals or enter a new name..."
						autocomplete="off"
						oninput={handleNameInput}
						onfocus={handleNameFocus}
						onblur={handleNameBlur}
					>

					{#if selectedExistingDeal}
						<div class="add-deal-modal__selected">
							<div>
								<div class="add-deal-modal__selected-title">Using an existing deal record</div>
								<div class="add-deal-modal__selected-copy">
									<strong>{selectedExistingDeal.name}</strong>
									{#if selectedExistingDeal.sponsor}
										<span> · {selectedExistingDeal.sponsor}</span>
									{/if}
									{#if selectedExistingDeal.lifecycleStatus}
										<span class="add-deal-modal__selected-badge">
											{formatStatusBadge(selectedExistingDeal.lifecycleStatus)}
										</span>
									{/if}
								</div>
							</div>
							<button type="button" class="add-deal-modal__text-btn" onclick={clearSelectedExistingDeal}>
								Use different deal
							</button>
						</div>
					{/if}

					{#if showSearchResults && !selectedExistingDeal}
						<div class="add-deal-modal__search-results">
							{#if searching}
								<div class="add-deal-modal__search-empty">Searching deals...</div>
							{:else if searchResults.length === 0}
								<div class="add-deal-modal__search-empty">{searchMessage || 'No existing deals found.'}</div>
							{:else}
								<div class="add-deal-modal__search-label">Existing Deals ({searchResults.length})</div>
								{#each searchResults as result}
									<button
										type="button"
										class="add-deal-modal__search-item"
										onclick={() => selectExistingDeal(result)}
									>
										<div class="add-deal-modal__search-name">{result.name}</div>
										<div class="add-deal-modal__search-sub">
											{#if result.sponsor}{result.sponsor}{/if}
											{#if result.assetClass}
												{result.sponsor ? ' · ' : ''}{result.assetClass}
											{/if}
											{#if result.lifecycleStatus}
												{(result.sponsor || result.assetClass) ? ' · ' : ''}{formatStatusBadge(result.lifecycleStatus)}
											{/if}
										</div>
									</button>
								{/each}
							{/if}
						</div>
					{/if}
				</div>

				{#if !selectedExistingDeal}
					<div class="add-deal-modal__field add-deal-modal__field--full">
						<label for="addDealSponsor">Sponsor / Management Company *</label>
						<input id="addDealSponsor" bind:value={sponsor} placeholder="e.g. Acme Capital">
					</div>

					<div class="add-deal-modal__field add-deal-modal__field--full">
						<label for="addDealUrl">Website / Link</label>
						<input id="addDealUrl" bind:value={website} placeholder="https://...">
					</div>
				{/if}

				<div class="add-deal-modal__field add-deal-modal__field--full">
					<label>What are you adding this for? *</label>
					<div class="add-deal-modal__intent-grid">
						<button
							type="button"
							class="add-deal-modal__intent-card"
							class:is-active={submissionIntent === 'interested'}
							onclick={() => (submissionIntent = 'interested')}
						>
							<div class="add-deal-modal__intent-title">I’m evaluating this deal</div>
							<div class="add-deal-modal__intent-copy">Send it to Review so I can track it while the team checks it.</div>
						</button>
						<button
							type="button"
							class="add-deal-modal__intent-card"
							class:is-active={submissionIntent === 'invested'}
							onclick={() => (submissionIntent = 'invested')}
						>
							<div class="add-deal-modal__intent-title">I already invested</div>
							<div class="add-deal-modal__intent-copy">Put it in Invested and My Portfolio while the deal goes through review.</div>
						</button>
					</div>
					<div class="add-deal-modal__intent-note">{getSubmissionIntentDescription(submissionIntent)}</div>
				</div>

				<div class="add-deal-modal__field add-deal-modal__field--full">
					<label for="addDealFileInput">Investment Deck</label>
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
						<div class="add-deal-modal__drop-copy">
							{#if deckFile}
								<strong>{deckFile.name}</strong>
								<span>({(deckFile.size / 1024 / 1024).toFixed(1)} MB)</span>
							{:else}
								Drop a file here or click to upload
							{/if}
						</div>
						<div class="add-deal-modal__drop-help">Optional, but helpful for review.</div>
					</div>
					{#if deckFile}
						<button type="button" class="add-deal-modal__text-btn" onclick={() => removeUpload('deck')}>
							Remove deck
						</button>
					{/if}
					<input
						id="addDealFileInput"
						bind:this={deckInputEl}
						type="file"
						accept=".pdf,.doc,.docx,.pptx,.ppt,.xlsx"
						class="add-deal-modal__file-input"
						onchange={(event) => setUploadFile(event.currentTarget.files?.[0], 'deck')}
					>
				</div>

				<div class="add-deal-modal__field add-deal-modal__field--full">
					<label for="addDealPpmInput">PPM</label>
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
						<div class="add-deal-modal__drop-copy">
							{#if ppmFile}
								<strong>{ppmFile.name}</strong>
								<span>({(ppmFile.size / 1024 / 1024).toFixed(1)} MB)</span>
							{:else}
								Drop a PPM here or click to upload
							{/if}
						</div>
						<div class="add-deal-modal__drop-help">Optional, but useful if you already have the deal docs.</div>
					</div>
					{#if ppmFile}
						<button type="button" class="add-deal-modal__text-btn" onclick={() => removeUpload('ppm')}>
							Remove PPM
						</button>
					{/if}
					<input
						id="addDealPpmInput"
						bind:this={ppmInputEl}
						type="file"
						accept=".pdf,.doc,.docx"
						class="add-deal-modal__file-input"
						onchange={(event) => setUploadFile(event.currentTarget.files?.[0], 'ppm')}
					>
				</div>
			</div>

			{#if submitError}
				<div class="add-deal-modal__error">{submitError}</div>
			{/if}

			<div class="add-deal-modal__actions">
				<button class="add-deal-modal__secondary" onclick={closeModal} disabled={submitting}>Cancel</button>
				<button class="add-deal-modal__primary" onclick={submitDeal} disabled={submitting}>
					{submitting ? 'Submitting...' : submitButtonLabel}
				</button>
			</div>
		{/if}
	</div>
</div>

<style>
	.add-deal-modal__overlay {
		position: fixed;
		inset: 0;
		z-index: 1200;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: rgba(16, 37, 42, 0.48);
		backdrop-filter: blur(4px);
	}

	.add-deal-modal__card {
		width: min(760px, 100%);
		max-height: min(92vh, 920px);
		overflow: auto;
		padding: 28px;
		border-radius: 24px;
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.99), rgba(247, 250, 251, 0.98));
		border: 1px solid rgba(16, 37, 42, 0.08);
		box-shadow: 0 40px 90px rgba(16, 37, 42, 0.22);
	}

	.add-deal-modal__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 18px;
		margin-bottom: 24px;
	}

	.add-deal-modal__eyebrow {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--primary);
	}

	.add-deal-modal__title {
		margin-top: 6px;
		font-family: var(--font-headline);
		font-size: 30px;
		line-height: 1.1;
		color: var(--text-dark);
	}

	.add-deal-modal__copy {
		margin: 10px 0 0;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.add-deal-modal__close {
		width: 38px;
		height: 38px;
		border: none;
		border-radius: 12px;
		background: rgba(16, 37, 42, 0.06);
		color: var(--text-dark);
		font-size: 22px;
		cursor: pointer;
	}

	.add-deal-modal__grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px;
	}

	.add-deal-modal__field {
		display: flex;
		flex-direction: column;
		gap: 8px;
		position: relative;
	}

	.add-deal-modal__field--full {
		grid-column: 1 / -1;
	}

	.add-deal-modal__field label {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
		color: var(--text-secondary);
	}

	.add-deal-modal__field input {
		width: 100%;
		padding: 13px 14px;
		border: 1px solid rgba(31, 81, 89, 0.14);
		border-radius: 14px;
		background: rgba(255, 255, 255, 0.98);
		font-family: var(--font-body);
		font-size: 15px;
		color: var(--text-dark);
	}

	.add-deal-modal__selected {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		padding: 14px 16px;
		border-radius: 16px;
		background: rgba(81, 190, 123, 0.08);
		border: 1px solid rgba(81, 190, 123, 0.18);
	}

	.add-deal-modal__selected-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--primary);
	}

	.add-deal-modal__selected-copy {
		margin-top: 6px;
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-dark);
	}

	.add-deal-modal__selected-badge {
		display: inline-flex;
		margin-left: 8px;
		padding: 3px 8px;
		border-radius: 999px;
		background: rgba(16, 37, 42, 0.08);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.add-deal-modal__search-results {
		position: absolute;
		top: calc(100% + 8px);
		left: 0;
		right: 0;
		z-index: 5;
		padding: 10px;
		border-radius: 18px;
		background: #fff;
		border: 1px solid rgba(16, 37, 42, 0.1);
		box-shadow: 0 24px 54px rgba(16, 37, 42, 0.12);
	}

	.add-deal-modal__search-label,
	.add-deal-modal__search-empty {
		padding: 8px 10px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-secondary);
	}

	.add-deal-modal__search-item {
		width: 100%;
		padding: 12px 10px;
		border: none;
		border-radius: 14px;
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.add-deal-modal__search-item:hover {
		background: rgba(81, 190, 123, 0.08);
	}

	.add-deal-modal__search-name {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.add-deal-modal__search-sub {
		margin-top: 4px;
		font-size: 13px;
		color: var(--text-secondary);
	}

	.add-deal-modal__intent-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 12px;
	}

	.add-deal-modal__intent-card {
		padding: 16px;
		border-radius: 18px;
		border: 1px solid rgba(16, 37, 42, 0.1);
		background: rgba(255, 255, 255, 0.96);
		text-align: left;
		cursor: pointer;
		transition: transform 0.16s ease, border-color 0.16s ease, box-shadow 0.16s ease;
	}

	.add-deal-modal__intent-card:hover,
	.add-deal-modal__intent-card.is-active {
		transform: translateY(-1px);
		border-color: rgba(81, 190, 123, 0.4);
		box-shadow: 0 16px 30px rgba(81, 190, 123, 0.12);
	}

	.add-deal-modal__intent-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.add-deal-modal__intent-copy,
	.add-deal-modal__intent-note {
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.add-deal-modal__intent-copy {
		margin-top: 6px;
	}

	.add-deal-modal__intent-note {
		margin-top: 8px;
	}

	.add-deal-modal__dropzone {
		display: flex;
		flex-direction: column;
		gap: 6px;
		padding: 16px;
		border-radius: 18px;
		border: 1px dashed rgba(31, 81, 89, 0.24);
		background: rgba(248, 250, 252, 0.94);
		cursor: pointer;
	}

	.add-deal-modal__dropzone.is-active {
		border-color: rgba(81, 190, 123, 0.46);
		background: rgba(81, 190, 123, 0.08);
	}

	.add-deal-modal__drop-copy {
		font-size: 14px;
		color: var(--text-dark);
	}

	.add-deal-modal__drop-help {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.add-deal-modal__file-input {
		display: none;
	}

	.add-deal-modal__text-btn {
		align-self: flex-start;
		padding: 0;
		border: none;
		background: transparent;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		color: var(--primary);
		cursor: pointer;
	}

	.add-deal-modal__error {
		margin-top: 18px;
		padding: 12px 14px;
		border-radius: 14px;
		background: rgba(194, 65, 68, 0.08);
		color: #b42318;
		font-size: 14px;
	}

	.add-deal-modal__actions {
		display: flex;
		justify-content: flex-end;
		gap: 10px;
		margin-top: 22px;
	}

	.add-deal-modal__actions--success {
		justify-content: flex-start;
	}

	.add-deal-modal__primary,
	.add-deal-modal__secondary {
		padding: 12px 18px;
		border-radius: 14px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		cursor: pointer;
	}

	.add-deal-modal__primary {
		border: none;
		background: var(--primary);
		color: #fff;
	}

	.add-deal-modal__primary:disabled {
		opacity: 0.6;
		cursor: wait;
	}

	.add-deal-modal__secondary {
		border: 1px solid rgba(31, 81, 89, 0.14);
		background: rgba(255, 255, 255, 0.92);
		color: var(--text-dark);
	}

	.add-deal-modal__success {
		padding: 8px 0 4px;
	}

	.add-deal-modal__success-badge {
		display: inline-flex;
		padding: 6px 10px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.12);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--primary);
	}

	.add-deal-modal__success-title {
		margin: 18px 0 8px;
		font-family: var(--font-headline);
		font-size: 28px;
		line-height: 1.15;
		color: var(--text-dark);
	}

	.add-deal-modal__success-body {
		margin: 0;
		font-size: 15px;
		line-height: 1.7;
		color: var(--text-secondary);
	}

	.add-deal-modal__warning-box {
		margin-top: 18px;
		padding: 16px;
		border-radius: 18px;
		background: rgba(245, 158, 11, 0.08);
		border: 1px solid rgba(245, 158, 11, 0.18);
	}

	.add-deal-modal__warning-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.06em;
		text-transform: uppercase;
		color: #9a6700;
	}

	.add-deal-modal__warning-item {
		margin-top: 8px;
		font-size: 14px;
		line-height: 1.6;
		color: #7c5a00;
	}

	@media (max-width: 720px) {
		.add-deal-modal__overlay {
			padding: 14px;
		}

		.add-deal-modal__card {
			padding: 22px 18px;
			border-radius: 22px;
		}

		.add-deal-modal__grid,
		.add-deal-modal__intent-grid {
			grid-template-columns: 1fr;
		}

		.add-deal-modal__top,
		.add-deal-modal__selected,
		.add-deal-modal__actions {
			flex-direction: column;
		}

		.add-deal-modal__close {
			align-self: flex-end;
		}

		.add-deal-modal__primary,
		.add-deal-modal__secondary {
			width: 100%;
		}
	}
</style>
