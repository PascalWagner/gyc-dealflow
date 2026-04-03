<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { getStoredSessionUser, patchStoredSessionUser } from '$lib/stores/auth.js';

	let acceptedTos = $state(false);
	let acceptedPrivacy = $state(false);
	let acceptedDisclaimer = $state(false);
	let submitting = $state(false);
	let errorMsg = $state('');

	const canSubmit = $derived(acceptedTos && acceptedPrivacy && acceptedDisclaimer && !submitting);
	const returnPath = $derived($page.url.searchParams.get('return') || '/app/dashboard');

	async function handleAccept() {
		if (!canSubmit) return;
		submitting = true;
		errorMsg = '';

		try {
			const session = getStoredSessionUser();
			if (!session?.token) {
				errorMsg = 'Please log in first.';
				submitting = false;
				return;
			}

			const resp = await fetch('/api/user-agreement', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${session.token}`
				},
				body: JSON.stringify({
					acceptedTos: true,
					acceptedPrivacy: true,
					acceptedDisclaimer: true
				})
			});

			if (!resp.ok) {
				const data = await resp.json().catch(() => ({}));
				throw new Error(data.error || 'Failed to record agreement');
			}

			// Update session with TOS acceptance
			patchStoredSessionUser({ tosAccepted: true, tosVersion: '1.0' });

			// Redirect to return path
			goto(returnPath);
		} catch (e) {
			errorMsg = e.message || 'Something went wrong. Please try again.';
			submitting = false;
		}
	}
</script>

<svelte:head>
	<title>Accept Terms - GYC Deals</title>
</svelte:head>

<div class="accept-page">
	<div class="accept-container">
		<div class="accept-logo">
			<svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
				<path d="M12 1v22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
			</svg>
			<span class="accept-logo-text">GYC Deals</span>
		</div>

		<h1 class="accept-title">Before you continue</h1>
		<p class="accept-subtitle">Please review and accept our terms to use the platform.</p>

		<div class="accept-checks">
			<button type="button" class="consent-row" aria-pressed={acceptedTos} onclick={() => acceptedTos = !acceptedTos}>
				<div class="consent-box" class:checked={acceptedTos}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
				</div>
				<div class="consent-text">
					I have read and agree to the <a href="/terms" target="_blank" rel="noopener"><strong>Terms of Service</strong></a>
				</div>
			</button>

			<button type="button" class="consent-row" aria-pressed={acceptedPrivacy} onclick={() => acceptedPrivacy = !acceptedPrivacy}>
				<div class="consent-box" class:checked={acceptedPrivacy}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
				</div>
				<div class="consent-text">
					I have read and agree to the <a href="/privacy" target="_blank" rel="noopener"><strong>Privacy Policy</strong></a>
				</div>
			</button>

			<button type="button" class="consent-row" aria-pressed={acceptedDisclaimer} onclick={() => acceptedDisclaimer = !acceptedDisclaimer}>
				<div class="consent-box" class:checked={acceptedDisclaimer}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
				</div>
				<div class="consent-text">
					I understand that GYC is <strong>not an investment advisor</strong> and nothing on this platform constitutes investment advice. All investment decisions are my own.
				</div>
			</button>
		</div>

		{#if errorMsg}
			<div class="accept-error">{errorMsg}</div>
		{/if}

		<button
			class="accept-btn"
			disabled={!canSubmit}
			onclick={handleAccept}
		>
			{submitting ? 'Processing...' : 'I Agree — Continue'}
		</button>
	</div>
</div>

<style>
	.accept-page {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: var(--bg-page, #f8f8f6);
		padding: 24px;
	}
	.accept-container {
		max-width: 480px;
		width: 100%;
		background: var(--bg-card, #fff);
		border: 1px solid var(--border, #e5e5e3);
		border-radius: 16px;
		padding: 40px 32px;
	}
	.accept-logo {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 28px;
	}
	.accept-logo-text {
		font-family: var(--font-ui, system-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--text-dark, #141413);
	}
	.accept-title {
		font-family: var(--font-ui, system-ui);
		font-size: 24px;
		font-weight: 800;
		color: var(--text-dark, #141413);
		margin-bottom: 8px;
	}
	.accept-subtitle {
		font-family: var(--font-body, system-ui);
		font-size: 15px;
		color: var(--text-secondary, #607179);
		margin-bottom: 28px;
		line-height: 1.5;
	}
	.accept-checks {
		display: flex;
		flex-direction: column;
		gap: 12px;
		margin-bottom: 24px;
	}
	.consent-row {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		padding: 12px 14px;
		border: 1px solid var(--border, #e5e5e3);
		border-radius: 10px;
		background: var(--bg-card, #fff);
		cursor: pointer;
		text-align: left;
		transition: border-color 0.15s;
		width: 100%;
	}
	.consent-row:hover {
		border-color: var(--primary, #51BE7B);
	}
	.consent-box {
		width: 22px;
		height: 22px;
		min-width: 22px;
		border: 2px solid var(--border, #ccc);
		border-radius: 5px;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.15s;
	}
	.consent-box svg {
		width: 14px;
		height: 14px;
		opacity: 0;
		transition: opacity 0.15s;
	}
	.consent-box.checked {
		background: var(--primary, #51BE7B);
		border-color: var(--primary, #51BE7B);
	}
	.consent-box.checked svg {
		opacity: 1;
		stroke: #fff;
	}
	.consent-text {
		font-family: var(--font-body, system-ui);
		font-size: 14px;
		color: var(--text-dark, #141413);
		line-height: 1.5;
	}
	.consent-text a {
		color: var(--primary, #51BE7B);
		text-decoration: none;
	}
	.consent-text a:hover {
		text-decoration: underline;
	}
	.accept-error {
		padding: 10px 14px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.3);
		border-radius: 8px;
		color: #dc2626;
		font-family: var(--font-ui, system-ui);
		font-size: 13px;
		margin-bottom: 16px;
	}
	.accept-btn {
		width: 100%;
		padding: 14px 24px;
		background: var(--primary, #51BE7B);
		color: #fff;
		border: none;
		border-radius: 10px;
		font-family: var(--font-ui, system-ui);
		font-size: 15px;
		font-weight: 700;
		cursor: pointer;
		transition: background 0.15s;
	}
	.accept-btn:hover:not(:disabled) {
		background: var(--primary-hover, #45a96c);
	}
	.accept-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
</style>
