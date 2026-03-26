<script>
	import {
		DAILY_INTRO_REQUEST_LIMIT,
		getDealOperatorInfo,
		submitDealIntroductionRequest
	} from '$lib/utils/dealIntroRequests.js';

	let {
		deal = null,
		open = false,
		successButtonLabel = 'Back to Deal',
		onclose = () => {},
		onsuccess = () => {}
	} = $props();

	let introMessage = $state('');
	let introSending = $state(false);
	let introSuccess = $state(false);
	let submitError = $state('');

	const operator = $derived(getDealOperatorInfo(deal));
	const operatorYears = $derived(
		operator?.foundingYear
			? `${new Date().getFullYear() - operator.foundingYear}+ years`
			: ''
	);

	function getInitials(name) {
		return String(name || '')
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part) => part.charAt(0).toUpperCase())
			.join('') || 'OP';
	}

	function closeModal() {
		onclose();
	}

	async function handleSubmit() {
		if (!deal || introSending) return;

		introSending = true;
		submitError = '';

		const result = await submitDealIntroductionRequest({
			deal,
			message: introMessage
		});

		if (result.success) {
			introSuccess = true;
			onsuccess({
				dealId: deal.id,
				operatorName: result.operatorName
			});
		} else {
			submitError = result.error || 'Something went wrong. Please try again.';
		}

		introSending = false;
	}

	$effect(() => {
		if (!open) return;
		introMessage = '';
		introSending = false;
		introSuccess = false;
		submitError = '';
	});
</script>

{#if open && deal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={(event) => { if (event.target === event.currentTarget) closeModal(); }}>
		<div class="modal-container">
			<button class="modal-close" onclick={closeModal} aria-label="Close introduction request modal">&times;</button>
			{#if introSuccess}
				<div class="modal-success">
					<div class="modal-success-icon">
						<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2">
							<polyline points="20 6 9 17 4 12"></polyline>
						</svg>
					</div>
					<div class="modal-success-title">You're all set</div>
					<div class="modal-success-text">
						Pascal will personally introduce you to {operator.name}. Check your email. You'll be CC'd on the intro.
					</div>
					<button class="modal-btn-primary modal-btn-dark" onclick={closeModal}>{successButtonLabel}</button>
				</div>
			{:else}
				<div class="modal-header-centered">
					<div class="modal-avatar">{getInitials(operator.name)}</div>
					<div class="modal-avatar-name">{operator.name}</div>
					<div class="modal-avatar-meta">
						{#if operator.ceo}<span>{operator.ceo}</span>{/if}
						{#if operator.ceo && operatorYears}<span>&middot;</span>{/if}
						{#if operatorYears}<span>{operatorYears}</span>{/if}
						{#if operator.website}
							{#if operator.ceo || operatorYears}<span>&middot;</span>{/if}
							<a href={operator.website} target="_blank" rel="noopener" class="modal-avatar-link">Website</a>
						{/if}
					</div>
				</div>
				<div class="modal-body-text">
					We'll connect you with {operator.name} for <strong>{deal.investmentName}</strong>. Pascal will make a personal email introduction on your behalf.
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
				{#if submitError}
					<div class="modal-error" role="alert">{submitError}</div>
				{/if}
				<div class="modal-actions">
					<button class="modal-btn-secondary" onclick={closeModal}>Cancel</button>
					<button class="modal-btn-primary" onclick={handleSubmit} disabled={introSending}>
						{introSending ? 'Requesting...' : 'Request Introduction'}
					</button>
				</div>
				<div class="modal-footer-note">
					{DAILY_INTRO_REQUEST_LIMIT} introductions available per day
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(10, 22, 40, 0.48);
		backdrop-filter: blur(10px);
		z-index: 1100;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 20px;
	}

	.modal-container {
		position: relative;
		width: 100%;
		max-width: 520px;
		background: var(--bg-card, #fff);
		border: 1px solid var(--border);
		border-radius: 18px;
		box-shadow: 0 28px 60px rgba(10, 22, 40, 0.22);
		padding: 28px;
	}

	.modal-close {
		position: absolute;
		top: 14px;
		right: 14px;
		width: 34px;
		height: 34px;
		border: none;
		border-radius: 999px;
		background: transparent;
		font-size: 24px;
		line-height: 1;
		color: var(--text-muted);
		cursor: pointer;
	}

	.modal-close:hover {
		background: rgba(15, 23, 42, 0.05);
		color: var(--text-dark);
	}

	.modal-header-centered,
	.modal-success {
		text-align: center;
	}

	.modal-avatar {
		width: 64px;
		height: 64px;
		margin: 0 auto 14px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.12);
		color: var(--primary);
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.modal-avatar-name,
	.modal-success-title {
		font-family: var(--font-ui);
		font-size: 20px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.modal-avatar-meta {
		margin-top: 8px;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
		flex-wrap: wrap;
		font-family: var(--font-body);
		font-size: 13px;
		color: var(--text-muted);
	}

	.modal-avatar-link {
		color: var(--primary);
		text-decoration: none;
		font-weight: 700;
	}

	.modal-avatar-link:hover {
		text-decoration: underline;
	}

	.modal-body-text,
	.modal-success-text {
		margin-top: 18px;
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.65;
		color: var(--text-secondary);
	}

	.modal-field {
		margin-top: 18px;
	}

	.modal-label {
		display: block;
		margin-bottom: 8px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.4px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.modal-textarea {
		width: 100%;
		padding: 12px 14px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-main, #f8f8f6);
		font-family: var(--font-body);
		font-size: 14px;
		line-height: 1.5;
		color: var(--text-dark);
		resize: vertical;
		min-height: 104px;
	}

	.modal-textarea:focus {
		outline: none;
		border-color: rgba(81, 190, 123, 0.55);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.modal-error {
		margin-top: 12px;
		padding: 10px 12px;
		border-radius: 10px;
		background: rgba(239, 68, 68, 0.08);
		border: 1px solid rgba(239, 68, 68, 0.18);
		font-family: var(--font-body);
		font-size: 13px;
		color: #b91c1c;
	}

	.modal-actions {
		display: flex;
		gap: 10px;
		margin-top: 18px;
	}

	.modal-btn-primary,
	.modal-btn-secondary {
		flex: 1;
		padding: 12px 16px;
		border-radius: 12px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.35px;
		text-transform: uppercase;
		cursor: pointer;
		transition: all 0.18s ease;
	}

	.modal-btn-primary {
		border: 1px solid var(--primary);
		background: var(--primary);
		color: #fff;
	}

	.modal-btn-primary:hover:not(:disabled) {
		background: var(--primary-hover);
		border-color: var(--primary-hover);
	}

	.modal-btn-primary:disabled {
		opacity: 0.7;
		cursor: wait;
	}

	.modal-btn-dark {
		margin-top: 22px;
	}

	.modal-btn-secondary {
		border: 1px solid var(--border);
		background: transparent;
		color: var(--text-secondary);
	}

	.modal-btn-secondary:hover {
		border-color: var(--text-dark);
		color: var(--text-dark);
	}

	.modal-footer-note {
		margin-top: 12px;
		text-align: center;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.modal-success-icon {
		width: 72px;
		height: 72px;
		margin: 0 auto 16px;
		border-radius: 999px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: rgba(81, 190, 123, 0.12);
	}

	@media (max-width: 640px) {
		.modal-container {
			padding: 22px 18px;
		}

		.modal-actions {
			flex-direction: column;
		}
	}
</style>
