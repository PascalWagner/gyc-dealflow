<script>
	let {
		deal = null,
		showAuthModal = false,
		authSent = false,
		authModalTitle = 'Create a free account',
		authModalBody = 'Create a free account to continue.',
		authEmail = $bindable(''),
		authSending = false,
		authError = '',
		closeAuthModal = () => {},
		submitAuthModal = () => {},
		showIntroModal = false,
		dealOperator = null,
		dealOperatorName = '',
		dealOperatorCeo = '',
		introSuccess = false,
		introMessage = $bindable(''),
		introSending = false,
		closeIntroModal = () => {},
		submitIntroRequest = () => {},
		showInviteModal = false,
		inviteUrl = '',
		inviteEmail = $bindable(''),
		inviteMessage = $bindable(''),
		inviteEmailSubject = '',
		inviteEmailBody = '',
		inviteSmsBody = '',
		closeInviteModal = () => {},
		copyInviteLink = () => {},
		showClaimModal = false,
		claimName = '',
		claimEmail = '',
		claimCompany = '',
		claimRole = $bindable(''),
		claimSubmitting = false,
		claimSuccess = false,
		closeClaimModal = () => {},
		submitClaim = () => {},
		showDeckViewer = false,
		deckPreviewUrl = '',
		closeDeckViewer = () => {},
		showEnrichModal = false,
		isAdmin = false,
		enrichmentData = null,
		enrichSuccess = false,
		enrichChecked = $bindable({}),
		enrichSaving = false,
		closeEnrichModal = () => {},
		confirmEnrichment = () => {},
		formatEnrichmentValue = (key, value) => value,
		enrichmentFieldLabels = {}
	} = $props();

	function closeOnBackdrop(event, closeFn) {
		if (event.target === event.currentTarget) closeFn();
	}

	function getInitials(name = '') {
		return String(name)
			.trim()
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part[0]?.toUpperCase() || '')
			.join('') || '?';
	}

	const introOperatorName = $derived(dealOperatorName || 'the operator');
	const introOperatorYears = $derived.by(() => {
		if (!dealOperator?.foundingYear) return '';
		return `${new Date().getFullYear() - dealOperator.foundingYear}+ years`;
	});
	const enrichmentEntries = $derived.by(() =>
		Object.entries(enrichmentData || {}).filter(([key, value]) => value != null && enrichmentFieldLabels[key])
	);
	const hasEnrichmentFields = $derived(enrichmentEntries.length > 0);
</script>

{#if showAuthModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(event) => closeOnBackdrop(event, closeAuthModal)}>
		<div class="modal-container auth-modal">
			<button class="modal-close" onclick={closeAuthModal}>&times;</button>
			{#if authSent}
				<div class="modal-success">
					<div class="modal-success-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
					</div>
					<div class="modal-success-title">Check your email</div>
					<div class="modal-success-text">We sent you a magic link so you can finish creating your free account and pick up right where you left off.</div>
					<button class="modal-btn-primary" onclick={closeAuthModal}>Close</button>
				</div>
			{:else}
				<div class="auth-modal-header">
					<div class="auth-modal-title">{authModalTitle}</div>
					<div class="auth-modal-copy">{authModalBody}</div>
				</div>
				<div class="modal-field">
					<label class="modal-label" for="auth-email">Email address</label>
					<input
						id="auth-email"
						type="email"
						class="modal-input"
						placeholder="you@example.com"
						bind:value={authEmail}
						onkeydown={(event) => {
							if (event.key === 'Enter') submitAuthModal();
						}}
					/>
				</div>
				{#if authError}
					<div class="auth-modal-error">{authError}</div>
				{/if}
				<div class="modal-actions">
					<button class="modal-btn-secondary" onclick={closeAuthModal}>Cancel</button>
					<button class="modal-btn-primary" onclick={submitAuthModal} disabled={authSending}>
						{authSending ? 'Sending...' : 'Continue'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

{#if showIntroModal && deal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(event) => closeOnBackdrop(event, closeIntroModal)}>
		<div class="modal-container">
			<button class="modal-close" onclick={closeIntroModal}>&times;</button>
			{#if introSuccess}
				<div class="modal-success">
					<div class="modal-success-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2"><polyline points="20 6 9 17 4 12"/></svg>
					</div>
					<div class="modal-success-title">You're all set</div>
					<div class="modal-success-text">Pascal will personally introduce you to {introOperatorName}. Check your email -- you'll be CC'd on the intro.</div>
					<button class="modal-btn-primary intro-success-btn" onclick={closeIntroModal}>Back to Deal</button>
				</div>
			{:else}
				<div class="modal-header-centered">
					<div class="modal-avatar">{getInitials(introOperatorName)}</div>
					<div class="modal-avatar-name">{introOperatorName}</div>
					<div class="modal-avatar-meta">
						{#if dealOperatorCeo}<span>{dealOperatorCeo}</span>{/if}
						{#if dealOperatorCeo && introOperatorYears}<span>&middot;</span>{/if}
						{#if introOperatorYears}<span>{introOperatorYears}</span>{/if}
						{#if dealOperator?.website}
							{#if dealOperatorCeo || introOperatorYears}<span>&middot;</span>{/if}
							<a href={dealOperator.website} target="_blank" rel="noopener" class="modal-avatar-link">Website</a>
						{/if}
					</div>
				</div>
				<div class="modal-body-text">
					We'll connect you with {introOperatorName} for <strong>{deal.investmentName}</strong>. Pascal will make a personal email introduction on your behalf.
				</div>
				<div class="modal-intro-disclaimer">
					This introduction is a courtesy. GYC does not endorse, recommend, or guarantee any investment or operator.
				</div>
				<div class="modal-field">
					<label class="modal-label" for="intro-message">Message to Operator (optional)</label>
					<textarea
						id="intro-message"
						class="modal-textarea"
						rows="3"
						placeholder="Hi, I'm interested in learning more about this opportunity..."
						bind:value={introMessage}
					></textarea>
				</div>
				<div class="modal-actions">
					<button class="modal-btn-secondary" onclick={closeIntroModal}>Cancel</button>
					<button class="modal-btn-primary" onclick={submitIntroRequest} disabled={introSending}>
						{introSending ? 'Requesting...' : 'Request Introduction'}
					</button>
				</div>
				<div class="modal-footer-note">3 introductions available per day</div>
			{/if}
		</div>
	</div>
{/if}

{#if showInviteModal && deal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(event) => closeOnBackdrop(event, closeInviteModal)}>
		<div class="modal-container">
			<div class="modal-header-row">
				<div class="modal-title">Invite a Co-Investor</div>
				<button class="modal-close-inline" onclick={closeInviteModal}>&times;</button>
			</div>
			<div class="modal-body-text modal-body-text-left modal-body-text-spaced">
				Share a personal invite link for <strong>{deal.investmentName}</strong>. Your friend will see the deal and can sign up to save it.
			</div>
			<div class="invite-link-row">
				<input
					type="text"
					class="modal-input invite-link-input"
					readonly
					value={inviteUrl}
					onclick={(event) => event.currentTarget.select?.()}
				/>
				<button class="modal-btn-primary invite-copy-btn" onclick={copyInviteLink}>Copy Link</button>
			</div>
			<div class="modal-field modal-field-spaced">
				<label class="modal-label" for="invite-email">Email a friend directly (optional)</label>
				<input id="invite-email" type="email" class="modal-input" placeholder="friend@example.com" bind:value={inviteEmail} />
			</div>
			<div class="modal-field">
				<label class="modal-label" for="invite-message">Personal message (optional)</label>
				<textarea id="invite-message" class="modal-textarea" rows="2" placeholder="Hey, check out this deal..." bind:value={inviteMessage}></textarea>
			</div>
			<div class="invite-share-row">
				<a href={`mailto:${inviteEmail}?subject=${inviteEmailSubject}&body=${inviteEmailBody}`} class="invite-share-btn">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
					Email
				</a>
				<a href={`sms:?&body=${inviteSmsBody}`} class="invite-share-btn">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
					Text
				</a>
			</div>
		</div>
	</div>
{/if}

{#if showClaimModal && deal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(event) => closeOnBackdrop(event, closeClaimModal)}>
		<div class="modal-container">
			<div class="modal-header-row">
				<div class="modal-title">Claim This Deal</div>
				<button class="modal-close-inline" onclick={closeClaimModal}>&times;</button>
			</div>
			{#if claimSuccess}
				<div class="modal-success modal-success-compact">
					<div class="modal-success-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2" width="32" height="32"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
					</div>
					<div class="modal-success-title">Claim submitted!</div>
					<div class="modal-success-text">We'll review and get back to you within 24 hours.</div>
					<button class="modal-btn-primary modal-success-close" onclick={closeClaimModal}>Close</button>
				</div>
			{:else}
				<div class="modal-body-text modal-body-text-left modal-body-text-spaced">
					Claim <strong>{deal.investmentName}</strong> to manage your deal listing, see investor interest, and respond to questions.
				</div>
				<div class="claim-user-card">
					<div class="claim-user-name">{claimName}</div>
					<div class="claim-user-email">{claimEmail}</div>
					{#if claimCompany}<div class="claim-user-company">{claimCompany}</div>{/if}
				</div>
				<div class="modal-field">
					<label class="modal-label" for="claim-role">Your Role</label>
					<select id="claim-role" class="modal-select" bind:value={claimRole} required>
						<option value="">Select your role...</option>
						<option value="founder">Founder / CEO</option>
						<option value="ir">IR / Investor Relations</option>
						<option value="partner">Managing Partner</option>
						<option value="authorized">Authorized Representative</option>
					</select>
				</div>
				<button class="modal-btn-claim" onclick={submitClaim} disabled={claimSubmitting || !claimRole}>
					{claimSubmitting ? 'Submitting...' : 'Submit Claim'}
				</button>
			{/if}
		</div>
	</div>
{/if}

{#if showDeckViewer && deal?.deckUrl}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="deck-viewer-overlay" onclick={(event) => closeOnBackdrop(event, closeDeckViewer)}>
		<div class="deck-viewer-modal">
			<div class="deck-viewer-header">
				<span class="deck-viewer-title">{deal.investmentName} - Investment Deck</span>
				<div class="deck-viewer-actions">
					<a href={deal.deckUrl} target="_blank" rel="noopener" class="deck-viewer-download">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
						Download
					</a>
					<button class="deck-viewer-close" onclick={closeDeckViewer}>&times;</button>
				</div>
			</div>
			<div class="deck-viewer-body">
				<iframe
					src={deckPreviewUrl}
					title="Deck Viewer"
					class="deck-viewer-iframe"
					allowfullscreen
					sandbox="allow-scripts allow-same-origin allow-popups"
				></iframe>
			</div>
		</div>
	</div>
{/if}

{#if showEnrichModal && isAdmin && deal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(event) => closeOnBackdrop(event, closeEnrichModal)}>
		<div class="modal-container modal-container-wide">
			<div class="modal-header-row">
				<div class="modal-title">Enrich from Deck</div>
				<button class="modal-close-inline" onclick={closeEnrichModal}>&times;</button>
			</div>
			{#if enrichSuccess}
				<div class="modal-success modal-success-compact">
					<div class="modal-success-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2" width="32" height="32"><path d="M22 11.08V12a10 10 0 11-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
					</div>
					<div class="modal-success-title">Enrichment saved!</div>
					<div class="modal-success-text">Deal data has been updated with the confirmed fields.</div>
					<button class="modal-btn-primary modal-success-close" onclick={closeEnrichModal}>Close</button>
				</div>
			{:else if enrichmentData === null}
				<div class="enrich-loading-state">
					<div class="enrich-spinner"></div>
					<div class="enrich-loading-copy">Extracting data from deck...</div>
				</div>
			{:else if !hasEnrichmentFields}
				<div class="enrich-empty-state">
					<svg viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" stroke-width="2" width="32" height="32"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
					<div class="enrich-empty-copy">No extractable fields found in the deck.</div>
					<button class="modal-btn-secondary modal-empty-close" onclick={closeEnrichModal}>Close</button>
				</div>
			{:else}
				<div class="enrich-wizard">
					<div class="enrich-header">
						<svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="28" height="28"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
						<div>
							<div class="enrich-title">Review Extracted Fields</div>
							<div class="enrich-subtitle">{Object.keys(enrichChecked).length} fields extracted. Uncheck any you want to skip.</div>
						</div>
					</div>
					<div class="enrich-fields">
						{#each enrichmentEntries as [key, value]}
							<div class="enrich-field">
								<label class="enrich-checkbox">
									<input type="checkbox" bind:checked={enrichChecked[key]} />
								</label>
								<span class="enrich-field-label">{enrichmentFieldLabels[key]}</span>
								<span class="enrich-field-value">{formatEnrichmentValue(key, value)}</span>
							</div>
						{/each}
					</div>
					<div class="enrich-actions">
						<button class="modal-btn-secondary" onclick={closeEnrichModal}>Skip</button>
						<button class="modal-btn-primary enrich-confirm-btn" onclick={confirmEnrichment} disabled={enrichSaving}>
							{enrichSaving ? 'Saving...' : 'Confirm & Save'}
						</button>
					</div>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		background: rgba(0, 0, 0, 0.55);
		backdrop-filter: blur(4px);
		-webkit-backdrop-filter: blur(4px);
		z-index: 1100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
		opacity: 0;
		animation: modalFadeIn 0.25s ease forwards;
	}

	@keyframes modalFadeIn {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes modalSlideUp {
		from { opacity: 0; transform: translateY(12px); }
		to { opacity: 1; transform: translateY(0); }
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	.modal-container {
		background: #fff;
		border-radius: 20px;
		max-width: 440px;
		width: 100%;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05);
		overflow: hidden;
		padding: 32px;
		animation: modalSlideUp 0.3s ease forwards;
		position: relative;
	}

	.modal-container-wide { max-width: 560px; }
	.auth-modal-header { margin-bottom: 20px; }
	.auth-modal-title { font-family: var(--font-ui); font-size: 22px; font-weight: 800; color: var(--text-dark); letter-spacing: -0.4px; }
	.auth-modal-copy { margin-top: 8px; font-family: var(--font-body); font-size: 14px; line-height: 1.6; color: var(--text-secondary); }
	.auth-modal-error { margin-bottom: 12px; font-family: var(--font-ui); font-size: 12px; font-weight: 700; color: #dc2626; }

	.modal-close,
	.modal-close-inline {
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-muted);
		font-size: 20px;
		line-height: 1;
	}

	.modal-close {
		position: absolute;
		top: 16px;
		right: 16px;
		width: 32px;
		height: 32px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: background 0.15s;
	}

	.modal-close:hover { background: rgba(0, 0, 0, 0.05); }
	.modal-close-inline:hover { color: var(--text-dark); }

	.modal-header-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 12px;
	}

	.modal-title {
		font-family: var(--font-display, var(--font-headline));
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.modal-header-centered {
		padding: 8px 0 0;
		text-align: center;
	}

	.modal-avatar {
		width: 72px;
		height: 72px;
		border-radius: 50%;
		background: linear-gradient(135deg, #0f2027, #1a3a4a);
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 700;
		color: #fff;
		margin: 0 auto 16px;
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
	}

	.modal-avatar-name {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
		margin-bottom: 4px;
	}

	.modal-avatar-meta {
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		flex-wrap: wrap;
		margin-bottom: 16px;
	}

	.modal-avatar-link {
		color: var(--primary);
		text-decoration: none;
		font-weight: 600;
	}

	.modal-body-text {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		text-align: center;
	}

	.modal-body-text strong { color: var(--text-dark); }
	.modal-body-text-left { text-align: left; }
	.modal-body-text-spaced { margin-bottom: 20px; }

	.modal-field { margin-bottom: 16px; }
	.modal-field-spaced { margin-top: 16px; }

	.modal-label {
		display: block;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		margin-bottom: 6px;
	}

	.modal-input,
	.modal-textarea,
	.modal-select {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
		background: var(--bg-page, #f5f5f5);
		box-sizing: border-box;
	}

	.modal-textarea { resize: vertical; }
	.modal-input:focus,
	.modal-textarea:focus { border-color: var(--primary); outline: none; }

	.modal-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		margin-top: 20px;
	}

	.modal-btn-secondary,
	.modal-btn-primary,
	.modal-btn-claim {
		font-family: var(--font-ui);
		font-size: 14px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.modal-btn-secondary {
		padding: 14px 24px;
		background: none;
		border: 1px solid var(--border);
		border-radius: 12px;
		font-weight: 600;
		color: var(--text-muted);
		white-space: nowrap;
	}

	.modal-btn-secondary:hover { border-color: var(--text-muted); }

	.modal-btn-primary {
		flex: 1;
		padding: 14px 24px;
		background: var(--primary);
		color: #fff;
		border: none;
		border-radius: 12px;
		font-weight: 700;
		box-shadow: 0 2px 8px rgba(81, 190, 123, 0.3);
	}

	.modal-btn-primary:hover:not(:disabled) {
		background: #3dbd6d;
		box-shadow: 0 4px 16px rgba(81, 190, 123, 0.4);
	}

	.modal-btn-primary:disabled,
	.modal-btn-claim:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.modal-footer-note {
		text-align: center;
		padding-top: 12px;
		font-family: var(--font-body);
		font-size: 11px;
		color: var(--text-muted);
	}
	.modal-intro-disclaimer {
		font-size: 11px;
		font-family: var(--font-body);
		color: var(--text-muted);
		line-height: 1.5;
		padding: 8px 0 4px;
	}

	.modal-success {
		text-align: center;
		padding: 16px 0;
	}

	.modal-success-compact { padding: 24px 0; }

	.modal-success-icon {
		width: 64px;
		height: 64px;
		border-radius: 50%;
		background: rgba(81, 190, 123, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 20px;
	}

	.modal-success-title {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
		margin-bottom: 8px;
	}

	.modal-success-text {
		font-family: var(--font-body);
		font-size: 14px;
		color: var(--text-secondary);
		line-height: 1.6;
		max-width: 320px;
		margin: 0 auto 20px;
	}

	.modal-success-close { margin-top: 16px; }
	.intro-success-btn { background: var(--text-dark); }

	.invite-link-row,
	.invite-share-row,
	.enrich-actions {
		display: flex;
		gap: 8px;
	}

	.invite-link-row { margin-bottom: 16px; }
	.invite-share-row { margin-top: 16px; }

	.invite-link-input {
		flex: 1;
		min-width: 0;
		font-size: 12px;
	}

	.invite-copy-btn {
		flex-shrink: 0;
		white-space: nowrap;
	}

	.invite-share-btn {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		padding: 10px;
		border: 1px solid var(--border);
		border-radius: 8px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--text-secondary);
		text-decoration: none;
		transition: background 0.15s;
	}

	.invite-share-btn:hover { background: var(--bg-page, #f5f5f5); }

	.claim-user-card {
		background: var(--bg-page, #f5f5f5);
		border: 1px solid var(--border);
		border-radius: 10px;
		padding: 14px 16px;
		margin-bottom: 20px;
	}

	.claim-user-name {
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
	}

	.claim-user-email,
	.claim-user-company {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
	}

	.claim-user-company { margin-top: 2px; }

	.modal-btn-claim {
		width: 100%;
		padding: 14px;
		background: #2563eb;
		color: #fff;
		border: none;
		border-radius: 10px;
		font-weight: 700;
	}

	.modal-btn-claim:hover:not(:disabled) { background: #1d4ed8; }

	.deck-viewer-overlay {
		position: fixed;
		top: 0;
		right: 0;
		bottom: 0;
		left: 0;
		background: rgba(0, 0, 0, 0.75);
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
	}

	.deck-viewer-modal {
		background: var(--bg-card, #fff);
		border-radius: 12px;
		width: 100%;
		max-width: 1100px;
		height: 85vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
		overflow: hidden;
	}

	.deck-viewer-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 14px 20px;
		border-bottom: 1px solid var(--border);
		flex-shrink: 0;
	}

	.deck-viewer-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.deck-viewer-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.deck-viewer-download {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 600;
		color: var(--primary);
		text-decoration: none;
		border: 1px solid var(--border);
		border-radius: 6px;
		transition: background 0.15s;
	}

	.deck-viewer-download:hover { background: var(--bg-cream, #f8f8f6); }

	.deck-viewer-close {
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: none;
		border: none;
		font-size: 24px;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: 6px;
		transition: background 0.15s;
	}

	.deck-viewer-close:hover { background: var(--bg-cream, #f8f8f6); color: var(--text-dark); }
	.deck-viewer-body { flex: 1; overflow: hidden; }
	.deck-viewer-iframe { width: 100%; height: 100%; border: none; }

	.enrich-wizard { text-align: left; }

	.enrich-header {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
	}

	.enrich-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.enrich-subtitle {
		font-size: 13px;
		color: var(--text-secondary);
		margin-top: 2px;
	}

	.enrich-fields {
		max-height: 360px;
		overflow-y: auto;
		border: 1px solid var(--border-light, #eee);
		border-radius: 8px;
	}

	.enrich-field {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 14px;
		border-bottom: 1px solid var(--border-light, #eee);
	}

	.enrich-field:last-child { border-bottom: none; }

	.enrich-checkbox input {
		width: 16px;
		height: 16px;
		accent-color: var(--primary);
		cursor: pointer;
	}

	.enrich-field-label {
		flex: 0 0 130px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	.enrich-field-value {
		flex: 1;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-dark);
	}

	.enrich-confirm-btn { flex: 1; }

	.enrich-spinner {
		width: 32px;
		height: 32px;
		border: 3px solid var(--border);
		border-top-color: var(--primary);
		border-radius: 50%;
		animation: spin 0.8s linear infinite;
		margin: 0 auto;
	}

	.enrich-loading-state,
	.enrich-empty-state {
		text-align: center;
		padding: 32px 0;
	}

	.enrich-loading-state { padding: 40px 0; }
	.enrich-loading-copy,
	.enrich-empty-copy {
		color: var(--text-muted);
		font-size: 13px;
		margin-top: 12px;
	}

	.enrich-empty-copy { font-size: 14px; }
	.modal-empty-close { margin-top: 16px; }

	@media (max-width: 768px) {
		.deck-viewer-overlay { padding: 8px; }
		.deck-viewer-modal { height: 90vh; }
		.deck-viewer-title { font-size: 12px; }
		.enrich-field-label { flex: 0 0 100px; font-size: 10px; }
		.modal-container {
			max-width: 100%;
			border-radius: 16px;
		}
		.invite-link-row,
		.invite-share-row {
			flex-direction: column;
		}
		.invite-share-btn { width: 100%; }
		.modal-actions {
			flex-direction: column-reverse;
		}
		.modal-btn-secondary,
		.modal-btn-primary {
			width: 100%;
		}
	}

	@media (max-width: 480px) {
		.modal-overlay { padding: 12px; }
	}
</style>
