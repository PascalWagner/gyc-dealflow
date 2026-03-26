<script>
	import { browser } from '$app/environment';
	import { login } from '$lib/stores/auth.js';

	let email = $state('');
	let error = $state('');
	let loading = $state(false);
	let sent = $state(false);

	/** @type {(userData: object) => void} */
	let { onBypass = () => {}, onSent = () => {} } = $props();

	async function handleSubmit() {
		error = '';
		const trimmed = email.trim();
		if (!trimmed || !trimmed.includes('@')) {
			error = 'Please enter a valid email.';
			return;
		}
		loading = true;

		try {
			const data = await login(trimmed, {
				siteUrl: browser ? window.location.origin : '',
				returnTo: browser ? `${window.location.pathname}${window.location.search}` : ''
			});

			if (data.bypass && data.token) {
				// Dev bypass -- caller handles redirect
				onBypass(data);
				return;
			}

			// Normal flow -- show "check your email"
			sent = true;
			onSent({ email: trimmed });
		} catch {
			// Still show success -- magic link may have sent
			sent = true;
			onSent({ email: trimmed });
		}
	}

	function resetForm() {
		sent = false;
		loading = false;
		email = '';
		error = '';
	}

	function handleKeydown(e) {
		if (e.key === 'Enter') handleSubmit();
	}
</script>

{#if !sent}
	<div class="form-section">
		<div class="form-title">Build your cash-flowing portfolio</div>
		<div class="form-desc">
			Whether you're deploying your first $50K or your next $500K — research
			vetted sponsors, match deals to your goals, and invest with a plan.
		</div>

		<label class="field-label" for="login-email">Email address</label>
		<!-- svelte-ignore a11y_autofocus -->
		<input
			type="email"
			class="field-input"
			id="login-email"
			placeholder="you@example.com"
			autocomplete="email"
			autofocus
			bind:value={email}
			onkeydown={handleKeydown}
		/>
		{#if error}
			<div class="error-msg">{error}</div>
		{/if}

		<button
			class="submit-btn"
			class:loading
			onclick={handleSubmit}
			disabled={loading}
		>
			{loading ? 'Sending...' : 'Get Started'}
		</button>

		<div class="helper-text">No password needed. We'll send you a secure link.</div>
	</div>
{:else}
	<div class="success-state">
		<div class="success-check">
			<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
				<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
			</svg>
		</div>
		<h2>Check your email</h2>
		<p>We sent a login link to<br /><span class="email-highlight">{email}</span></p>
		<button class="retry" onclick={resetForm}>Use a different email</button>
	</div>
{/if}

<style>
	.form-title {
		font-family: var(--font-headline, 'DM Serif Display', Georgia, serif);
		font-size: 30px;
		color: var(--text-dark, #141413);
		margin-bottom: 8px;
		line-height: 1.2;
	}

	.form-desc {
		font-size: 15px;
		color: var(--text-secondary, #607179);
		margin-bottom: 36px;
		line-height: 1.5;
	}

	.field-label {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-dark, #141413);
		margin-bottom: 8px;
	}

	.field-input {
		width: 100%;
		padding: 16px 18px;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
		font-size: 15px;
		color: var(--text-dark, #141413);
		background: #fafafa;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 12px;
		outline: none;
		transition: all 0.2s;
		-webkit-appearance: none;
	}
	.field-input::placeholder {
		color: #b0b8c0;
	}
	.field-input:focus {
		border-color: var(--green, #51be7b);
		background: #fff;
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.1);
	}

	.submit-btn {
		width: 100%;
		padding: 16px 24px;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
		font-size: 15px;
		font-weight: 600;
		color: #fff;
		background: var(--green, #51be7b);
		border: none;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s;
		margin-top: 20px;
	}
	.submit-btn:hover {
		background: var(--primary-hover, #3da866);
	}
	.submit-btn:active {
		transform: scale(0.985);
	}
	.submit-btn.loading {
		pointer-events: none;
		opacity: 0.6;
	}

	.helper-text {
		text-align: center;
		font-size: 13px;
		color: #b0b8c0;
		margin-top: 20px;
		line-height: 1.5;
	}

	.error-msg {
		font-size: 13px;
		color: #dc2626;
		margin-top: 8px;
	}

	/* Success state */
	.success-state {
		text-align: center;
	}
	.success-check {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		background: rgba(81, 190, 123, 0.1);
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 20px;
	}
	.success-check svg {
		width: 24px;
		height: 24px;
		color: var(--green, #51be7b);
	}
	.success-state h2 {
		font-family: var(--font-headline, 'DM Serif Display', Georgia, serif);
		font-size: 24px;
		color: var(--text-dark, #141413);
		margin-bottom: 10px;
	}
	.success-state p {
		font-size: 14px;
		color: var(--text-secondary, #607179);
		line-height: 1.6;
	}
	.email-highlight {
		color: var(--text-dark, #141413);
		font-weight: 600;
	}
	.retry {
		display: inline-block;
		margin-top: 20px;
		color: var(--green, #51be7b);
		text-decoration: none;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		background: none;
		border: none;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
	}
	.retry:hover {
		text-decoration: underline;
	}

	/* Mobile */
	@media (max-width: 899px) {
		.form-title {
			font-size: 26px;
			margin-bottom: 8px;
		}
		.form-desc {
			font-size: 14px;
			margin-bottom: 28px;
			line-height: 1.5;
		}
		.field-input {
			padding: 14px 16px;
			font-size: 16px;
		}
		.submit-btn {
			padding: 14px 20px;
			font-size: 16px;
			margin-top: 16px;
		}
		.helper-text {
			margin-top: 16px;
			font-size: 12px;
		}
		.success-state h2 {
			font-size: 22px;
		}
		.success-state p {
			font-size: 13px;
		}
	}
</style>
