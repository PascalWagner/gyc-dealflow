<script>
	import { goto } from '$app/navigation';
	import { browser } from '$app/environment';
	import { onMount, tick } from 'svelte';
	import { queryMemberDeals } from '$lib/stores/deals.js';
	import { ensureSessionUserToken, getStoredSessionUser } from '$lib/stores/auth.js';
	import { currentAdminRealUser } from '$lib/utils/userScopedState.js';

	let { onclose = () => {} } = $props();

	let nameInputEl = $state(null);
	let deckInputEl = $state(null);
	let ppmInputEl = $state(null);

	let investmentName = $state('');
	let sponsor = $state('');
	let website = $state('');

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

	let searchRequestId = 0;
	let blurTimer = null;

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
				showArchived: true
			});

			if (requestId !== searchRequestId) return;

			searchResults = (data?.deals || []).map((deal) => ({
				id: deal.id,
				name: getDealName(deal),
				sponsor: getDealSponsor(deal),
				assetClass: getDealAssetClass(deal),
				targetIrr: Number(deal?.targetIRR || deal?.target_irr || 0)
			}));
			searchMessage = searchResults.length === 0
				? 'No existing deals found. Fill out the details below to add it.'
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

	function handleNameInput(event) {
		investmentName = event.currentTarget.value;
		void searchExistingDeals(investmentName);
	}

	function handleNameFocus() {
		clearBlurTimer();
		if (investmentName.trim().length >= 2) {
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

	async function selectExistingDeal(dealId) {
		closeModal();
		await goto(`/deal/${dealId}`);
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

	function handleDrop(event, type) {
		event.preventDefault();
		const [file] = event.dataTransfer?.files || [];
		if (file) {
			void setUploadFile(file, type);
		}
	}

	function formatIrr(value) {
		if (!Number.isFinite(value) || value <= 0) return '';
		const normalized = value <= 1 ? value * 100 : value;
		return `${normalized.toFixed(1)}% IRR`;
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

	async function uploadDocument({ dealId, dealName, base64, file, docType, actor }) {
		if (!file || !base64) return null;
		if (!actor.session?.token) {
			return 'The deal was created, but your session is missing the upload token needed for documents.';
		}

		const response = await fetch('/api/deck-upload', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${actor.session.token}`
			},
			body: JSON.stringify({
				dealId,
				dealName,
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

	async function submitNewDeal() {
		submitError = '';

		const trimmedName = investmentName.trim();
		const trimmedSponsor = sponsor.trim();
		const trimmedWebsite = website.trim();
		if (!trimmedName || !trimmedSponsor) {
			submitError = 'Please enter at least the investment name and sponsor.';
			return;
		}

		submitting = true;

		try {
			const actor = getActorFromSession();
			if (actor.session?.token) {
				const tokenState = await ensureSessionUserToken(actor.session);
				if (tokenState?.session) {
					actor.session = tokenState.session;
				}
			}

			const createResponse = await fetch('/api/deal-create', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					investmentName: trimmedName,
					sponsor: trimmedSponsor,
					website: trimmedWebsite,
					userEmail: actor.actorEmail,
					userName: actor.actorName
				})
			});

			const createData = await createResponse.json().catch(() => ({}));
			if (!createResponse.ok || !createData?.dealId) {
				throw new Error(createData?.error || 'Could not create the deal right now.');
			}

			const uploadWarnings = [];
			const deckWarning = await uploadDocument({
				dealId: createData.dealId,
				dealName: trimmedName,
				base64: deckFileBase64,
				file: deckFile,
				docType: 'deck',
				actor
			});
			if (deckWarning) uploadWarnings.push(deckWarning);

			const ppmWarning = await uploadDocument({
				dealId: createData.dealId,
				dealName: `${trimmedName} - PPM`,
				base64: ppmFileBase64,
				file: ppmFile,
				docType: 'ppm',
				actor
			});
			if (ppmWarning) uploadWarnings.push(ppmWarning);

			closeModal();

			if (uploadWarnings.length && browser) {
				window.alert(`Deal created, but there was a document issue:\n\n${uploadWarnings.join('\n')}`);
			}

			await goto(`/deal/${createData.dealId}`);
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
				<div id="add-deal-modal-title" class="add-deal-modal__title">Add a Deal</div>
				<p class="add-deal-modal__copy">
					Can’t find a deal? Submit it to the database. If you upload a deck or PPM, we’ll attach it to the record.
				</p>
			</div>
			<button class="add-deal-modal__close" aria-label="Close add deal modal" onclick={closeModal}>&times;</button>
		</div>

		<div class="add-deal-modal__grid">
			<div class="add-deal-modal__field add-deal-modal__field--full add-deal-modal__field--search">
				<label for="addDealName">Investment Name *</label>
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

				{#if showSearchResults}
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
									onclick={() => selectExistingDeal(result.id)}
								>
									<div class="add-deal-modal__search-name">{result.name}</div>
									<div class="add-deal-modal__search-sub">
										{#if result.sponsor}{result.sponsor}{/if}
										{#if result.assetClass}
											{result.sponsor ? ' · ' : ''}{result.assetClass}
										{/if}
										{#if formatIrr(result.targetIrr)}
											{(result.sponsor || result.assetClass) ? ' · ' : ''}{formatIrr(result.targetIrr)}
										{/if}
									</div>
								</button>
							{/each}
						{/if}
					</div>
				{/if}
			</div>

			<div class="add-deal-modal__field add-deal-modal__field--full">
				<label for="addDealSponsor">Sponsor / Management Company *</label>
				<input id="addDealSponsor" bind:value={sponsor} placeholder="e.g. Acme Capital">
			</div>

			<div class="add-deal-modal__field add-deal-modal__field--full">
				<label for="addDealUrl">Website / Link</label>
				<input id="addDealUrl" bind:value={website} placeholder="https://...">
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
						{:else}
							Drop a PDF here or click to upload
						{/if}
					</div>
				</div>
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
				<label for="addDealPpmInput">PPM (Private Placement Memorandum)</label>
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
						{:else}
							Drop a PDF here or click to upload
						{/if}
					</div>
				</div>
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
			<div class="add-deal-modal__error" role="alert">{submitError}</div>
		{/if}

		<div class="add-deal-modal__actions">
			<button class="add-deal-modal__btn add-deal-modal__btn--secondary" onclick={closeModal} disabled={submitting}>
				Cancel
			</button>
			<button class="add-deal-modal__btn add-deal-modal__btn--primary" onclick={submitNewDeal} disabled={submitting}>
				{submitting ? 'Submitting...' : 'Submit Deal'}
			</button>
		</div>
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
		padding: 20px;
		background: rgba(10, 18, 24, 0.38);
	}

	.add-deal-modal__card {
		width: 100%;
		max-width: 580px;
		max-height: min(90vh, 860px);
		overflow-y: auto;
		border-radius: 18px;
		padding: 28px;
		background: var(--bg-card);
		box-shadow: 0 30px 72px rgba(7, 18, 22, 0.18), 0 0 0 1px rgba(16, 37, 42, 0.06);
	}

	.add-deal-modal__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 20px;
	}

	.add-deal-modal__title {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.add-deal-modal__copy {
		margin: 8px 0 0;
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.add-deal-modal__close {
		flex: 0 0 auto;
		width: 32px;
		height: 32px;
		border: none;
		border-radius: 999px;
		background: var(--bg-cream);
		color: var(--text-muted);
		font-size: 18px;
		line-height: 1;
		cursor: pointer;
	}

	.add-deal-modal__grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0 16px;
	}

	.add-deal-modal__field {
		margin-bottom: 16px;
	}

	.add-deal-modal__field--full {
		grid-column: 1 / -1;
	}

	.add-deal-modal__field--search {
		position: relative;
	}

	.add-deal-modal__field label {
		display: block;
		margin-bottom: 6px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	.add-deal-modal__field input {
		width: 100%;
		box-sizing: border-box;
		padding: 11px 14px;
		border: 1px solid var(--border);
		border-radius: var(--radius-sm);
		background: var(--bg-card);
		color: var(--text-dark);
		font-family: var(--font-body);
		font-size: 14px;
	}

	.add-deal-modal__field input:focus {
		outline: none;
		border-color: var(--primary);
	}

	.add-deal-modal__search-results {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		z-index: 5;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-card);
		box-shadow: 0 18px 38px rgba(7, 18, 22, 0.16);
		overflow: hidden;
	}

	.add-deal-modal__search-label {
		padding: 8px 12px;
		border-bottom: 1px solid var(--border);
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
	}

	.add-deal-modal__search-item {
		display: block;
		width: 100%;
		padding: 11px 12px;
		border: none;
		border-top: 1px solid var(--border-light, rgba(16, 37, 42, 0.08));
		background: transparent;
		text-align: left;
		cursor: pointer;
	}

	.add-deal-modal__search-item:hover {
		background: var(--bg-main);
	}

	.add-deal-modal__search-name {
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.add-deal-modal__search-sub,
	.add-deal-modal__search-empty {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.add-deal-modal__search-empty {
		padding: 14px 12px;
	}

	.add-deal-modal__dropzone {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 16px;
		border: 2px dashed var(--border);
		border-radius: 12px;
		background: transparent;
		cursor: pointer;
		transition: border-color 0.18s ease, background-color 0.18s ease;
	}

	.add-deal-modal__dropzone:hover,
	.add-deal-modal__dropzone.is-active {
		border-color: var(--primary);
		background: rgba(81, 190, 123, 0.05);
	}

	.add-deal-modal__drop-icon {
		flex: 0 0 auto;
		width: 36px;
		height: 36px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.12);
		color: var(--primary);
	}

	.add-deal-modal__drop-copy {
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.add-deal-modal__drop-copy strong {
		color: var(--text-dark);
	}

	.add-deal-modal__drop-copy span {
		color: var(--text-muted);
	}

	.add-deal-modal__file-input {
		display: none;
	}

	.add-deal-modal__error {
		margin-top: 4px;
		padding: 12px 14px;
		border-radius: 12px;
		background: rgba(217, 83, 79, 0.08);
		color: #b42318;
		font-size: 13px;
		line-height: 1.5;
	}

	.add-deal-modal__actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
		margin-top: 18px;
	}

	.add-deal-modal__btn {
		padding: 10px 20px;
		border-radius: var(--radius-sm);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		cursor: pointer;
	}

	.add-deal-modal__btn:disabled {
		cursor: default;
		opacity: 0.65;
	}

	.add-deal-modal__btn--secondary {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-secondary);
	}

	.add-deal-modal__btn--primary {
		border: none;
		background: var(--primary);
		color: #fff;
	}

	@media (max-width: 640px) {
		.add-deal-modal__overlay {
			padding: 12px;
		}

		.add-deal-modal__card {
			padding: 22px;
		}

		.add-deal-modal__grid {
			grid-template-columns: 1fr;
		}

		.add-deal-modal__actions {
			flex-direction: column-reverse;
		}

		.add-deal-modal__btn {
			width: 100%;
		}
	}
</style>
