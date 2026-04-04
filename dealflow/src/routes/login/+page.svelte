<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import InvestorShowcase from '$lib/components/marketing/InvestorShowcase.svelte';
	import { SESSION_VERSION, buildAccessModel, normalizeEmail } from '$lib/auth/access-model.js';
	import { setStoredSessionUser } from '$lib/stores/auth.js';
	import { normalizePrivacyProfile } from '$lib/utils/dealflow-contract.js';

	const ADMIN_REAL_USER_KEY = '_gycAdminRealUser';
	const benefits = [
		'Build your buy box in minutes',
		'See matched deals instead of random pitches',
		'Upgrade to Academy only if you want help'
	];

	let email = $state('');
	let loading = $state(false);
	let error = $state('');
	let sent = $state(false);
	let signingIn = $state(false);
	let signInFailed = $state(false);
	let returnUrl = $derived($page.url.searchParams.get('return'));

	// OTP fallback state
	let otpMode = $state(false);
	let otpEmail = $state('');
	let otpCode = $state('');
	let otpVerifying = $state(false);
	let otpError = $state('');
	let otpSent = $state(false);

	function decodeBase64UrlJson(value) {
		if (!value) return null;
		const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
		try {
			return JSON.parse(atob(padded));
		} catch {
			return null;
		}
	}

	function getReturnDestination() {
		const value = (returnUrl || '').trim();
		if (!value.startsWith('/') || value.startsWith('//')) return '/app/dashboard';
		return value;
	}

	function buildStoredSessionUser(data) {
		const normalizedUserEmail = normalizeEmail(data?.email);
		if (!normalizedUserEmail) return null;

		const managementCompanySeed = data?.managementCompany || {
			id: data?.managementCompanyId || null,
			name: data?.managementCompanyName || '',
			gpType: data?.gpType || data?.gp_type || null
		};
		const accessModel = buildAccessModel({
			email: normalizedUserEmail,
			tier: data?.tier || data?.legacyTier || 'free',
			legacyTier: data?.legacyTier || data?.tier || 'free',
			accessTier: data?.accessTier || null,
			isAdmin: data?.isAdmin === true,
			roleFlags: data?.roleFlags,
			capabilities: data?.capabilities,
			gpType: data?.gpType || data?.gp_type || null,
			managementCompany: managementCompanySeed,
			subscriptions: data?.subscriptions || {},
			autoRenew: data?.autoRenew ?? data?.auto_renew ?? true
		});
		const privacy = normalizePrivacyProfile({
			share_activity: data?.share_activity,
			sharePortfolio: data?.sharePortfolio,
			share_saved: data?.share_saved,
			share_dd: data?.share_dd,
			share_invested: data?.share_invested,
			allow_follows: data?.allow_follows
		});
		const name = data?.name || data?.fullName || normalizedUserEmail.split('@')[0];

		return {
			sessionVersion: SESSION_VERSION,
			email: normalizedUserEmail,
			name,
			fullName: data?.fullName || data?.name || name,
			token: data?.token || '',
			refreshToken: data?.refreshToken || '',
			tier: data?.tier || data?.legacyTier || accessModel.legacyTier || 'free',
			legacyTier: data?.legacyTier || data?.tier || accessModel.legacyTier || 'free',
			accessTier: accessModel.accessTier,
			roleFlags: accessModel.roleFlags,
			capabilities: accessModel.capabilities,
			isAdmin: accessModel.roleFlags.admin,
			isGP: accessModel.roleFlags.gp,
			managementCompany: accessModel.managementCompany,
			tags: Array.isArray(data?.tags) ? data.tags : [],
			contactId: data?.contactId || null,
			phone: data?.phone || '',
			location: data?.location || '',
			avatar_url: data?.avatar_url || '',
			share_activity: privacy.share_activity,
			sharePortfolio: privacy.sharePortfolio,
			share_saved: privacy.share_saved,
			share_dd: privacy.share_dd,
			share_invested: privacy.share_invested,
			allow_follows: privacy.allow_follows,
			preferred_timezone: data?.preferred_timezone || data?.time_zone || '',
			accredited_status: data?.accredited_status || '',
			investable_capital: data?.investable_capital || '',
			investment_experience: data?.investment_experience || '',
			onboardingRole: data?.onboardingRole || null,
			gpOnboardingComplete: data?.gpOnboardingComplete || false,
			onboardingCompletedAt: data?.onboardingCompletedAt || null,
			tosAcceptedAt: data?.tosAcceptedAt || null,
			subscriptions: data?.subscriptions || {},
			autoRenew: data?.autoRenew ?? data?.auto_renew ?? true,
			cardLast4: data?.cardLast4 || data?.card_last4 || null,
			cardBrand: data?.cardBrand || data?.card_brand || null
		};
	}

	function storeUser(data) {
		const userData = buildStoredSessionUser(data);
		if (!userData) return null;
		localStorage.removeItem(ADMIN_REAL_USER_KEY);
		return setStoredSessionUser(userData);
	}

	onMount(() => {
		const hashParams = new URLSearchParams(window.location.hash.substring(1));
		const searchParams = new URLSearchParams(window.location.search);

		// ── 1. Check for OTP-in-link (primary flow) ──────────────────────
		const urlOtp = searchParams.get('otp');
		const urlEmail = searchParams.get('email');
		if (urlOtp && urlEmail) {
			console.log('[AUTH] OTP-in-link detected for', urlEmail);
			signingIn = true;
			otpEmail = urlEmail;

			// Clean URL immediately so code isn't visible in address bar
			if (window.history.replaceState) {
				const cleanUrl = new URL(window.location.href);
				cleanUrl.searchParams.delete('otp');
				cleanUrl.searchParams.delete('email');
				window.history.replaceState(null, '', cleanUrl.pathname + cleanUrl.search);
			}

			// Auto-verify the code
			fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'verify-otp', email: urlEmail, code: urlOtp })
			})
				.then(r => r.json())
				.then(data => {
					if (data.error) {
						console.warn('[AUTH] OTP auto-verify failed:', data.error);
						signingIn = false;
						// Show manual code entry as fallback
						otpMode = true;
						otpError = data.error.includes('expired')
							? 'This link expired. Enter the code from your email or request a new one.'
							: data.error;
						return;
					}
					console.log('[AUTH] OTP auto-verify success — logging in');
					storeUser({
						...data,
						email: urlEmail,
						name: data.name || urlEmail.split('@')[0],
						token: data.token || '',
						refreshToken: data.refreshToken || ''
					});
					window.location.href = getReturnDestination();
				})
				.catch(() => {
					signingIn = false;
					otpMode = true;
					otpError = 'Verification failed. Please enter the code manually.';
				});
			return;
		}

		// ── 2. Check for legacy magic link callback (backward compat) ────
		const authError = hashParams.get('error') || searchParams.get('error');
		const authErrorCode = hashParams.get('error_code') || searchParams.get('error_code');
		const authErrorDesc = hashParams.get('error_description') || searchParams.get('error_description');
		if (authError || authErrorCode) {
			console.warn('[AUTH] Callback error:', { authError, authErrorCode, authErrorDesc });
			if (window.history.replaceState) {
				window.history.replaceState(null, '', window.location.pathname + window.location.search);
			}
			const lastEmail = localStorage.getItem('gyc-last-login-email') || '';
			if (lastEmail) {
				otpEmail = lastEmail;
				otpMode = true;
				otpError = 'Your login link expired. Enter the code from your email or request a new one.';
			} else {
				error = 'Login link expired. Please enter your email to try again.';
			}
			return;
		}

		const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
		const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
		const type = hashParams.get('type') || searchParams.get('type');
		if (!accessToken || type !== 'magiclink') return;

		// Legacy magic link flow (for any old links still in inboxes)
		signingIn = true;
		let userEmail = '';
		try {
			const payload = decodeBase64UrlJson(accessToken.split('.')[1]);
			userEmail = payload?.email || '';
		} catch {}

		if (!userEmail) {
			signInFailed = true;
			signingIn = false;
			return;
		}

		console.log('[AUTH] Legacy magic link callback for', userEmail);
		const dest = getReturnDestination();

		fetch('/api/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'lookup', email: userEmail })
		})
			.then((response) => response.json())
			.then((data) => {
				storeUser({
					...data,
					email: userEmail,
					name: data.name || userEmail.split('@')[0],
					token: accessToken,
					refreshToken: refreshToken || ''
				});
				window.location.href = dest;
			})
			.catch(() => {
				storeUser({
					email: userEmail,
					name: userEmail.split('@')[0],
					token: accessToken,
					refreshToken: refreshToken || '',
					tier: 'free',
					isAdmin: false,
					tags: []
				});
				window.location.href = dest;
			});
	});

	async function handleSubmit() {
		error = '';
		const trimmed = email.trim();
		if (!trimmed || !trimmed.includes('@')) {
			error = 'Please enter a valid email.';
			return;
		}
		loading = true;
		// Store email for OTP fallback recovery
		localStorage.setItem('gyc-last-login-email', trimmed);

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);
			const response = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					action: 'magic-link',
					email: trimmed,
					siteUrl: window.location.origin,
					returnTo: getReturnDestination()
				}),
				signal: controller.signal
			});
			clearTimeout(timeout);

			const data = await response.json();

			if (data.bypass && data.token) {
				storeUser(data);
				window.location.href = getReturnDestination();
				return;
			}

			if (data.error) {
				error = data.error;
				loading = false;
				return;
			}

			sent = true;
		} catch (requestError) {
			if (requestError.name === 'AbortError') sent = true;
			else sent = true;
		}

		loading = false;
	}

	async function sendOtpFallback(targetEmail) {
		otpError = '';
		otpSent = false;
		try {
			const resp = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'send-otp', email: targetEmail })
			});
			const data = await resp.json();
			if (data.error) {
				otpError = data.error;
			} else {
				otpSent = true;
			}
		} catch {
			otpError = 'Failed to send code. Please try again.';
		}
	}

	async function verifyOtp() {
		if (!otpCode.trim() || otpCode.trim().length < 6) {
			otpError = 'Please enter the 6-digit code from your email.';
			return;
		}
		otpVerifying = true;
		otpError = '';
		try {
			const resp = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'verify-otp', email: otpEmail, code: otpCode.trim() })
			});
			const data = await resp.json();
			if (data.error) {
				otpError = data.error;
				otpVerifying = false;
				return;
			}
			// Success — store session and redirect
			storeUser({
				...data,
				email: otpEmail,
				name: data.name || otpEmail.split('@')[0],
				token: data.token || '',
				refreshToken: data.refreshToken || ''
			});
			window.location.href = getReturnDestination();
		} catch {
			otpError = 'Verification failed. Please try again.';
			otpVerifying = false;
		}
	}

	function resetForm() {
		sent = false;
		loading = false;
		email = '';
		error = '';
		otpMode = false;
		otpCode = '';
		otpError = '';
	}

	function onKeydown(event) {
		if (event.key === 'Enter') handleSubmit();
	}
</script>

<svelte:head>
	<title>Start Free | Grow Your Cashflow</title>
	<meta
		name="description"
		content="Start free with Grow Your Cashflow. Build your investor plan, browse deals, and compare sponsors with a secure magic link."
	>
</svelte:head>

<div class="auth-shell">
	<section class="showcase-panel">
		<div class="showcase-copy">
			<div class="eyebrow">Investor access</div>
			<h1>Start free. Build your plan. See your matches.</h1>
			<p>
				Grow Your Cashflow turns sponsor inbox chaos into a cleaner private-investing
				workflow. Use the product first. Buy support later only if you want it.
			</p>
			<div class="benefit-list">
				{#each benefits as benefit}
					<div class="benefit-item">
						<span class="benefit-dot"></span>
						<span>{benefit}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="showcase-stage">
			<InvestorShowcase mode="compact" />
		</div>
	</section>

	<section class="form-panel">
		<div class="form-card">
			<a href="/landing" class="brand-mark">
				<span class="brand-icon">GYC</span>
				<span class="brand-text">Grow Your Cashflow</span>
			</a>

			{#if otpMode}
				<div class="status-card">
					<h2>Enter your verification code</h2>
					<p>
						Your login link expired — this can happen if your email provider scanned it first.
						We sent a 6-digit code to <strong>{otpEmail}</strong>.
					</p>
					<div class="otp-input-row">
						<input
							type="text"
							class="field-input otp-input"
							placeholder="000000"
							maxlength="6"
							inputmode="numeric"
							autocomplete="one-time-code"
							bind:value={otpCode}
							onkeydown={(e) => { if (e.key === 'Enter') verifyOtp(); }}
						/>
						<button class="submit-button" type="button" onclick={verifyOtp} disabled={otpVerifying || otpCode.trim().length < 6}>
							{otpVerifying ? 'Verifying...' : 'Verify'}
						</button>
					</div>
					{#if otpError}
						<div class="error-message">{otpError}</div>
					{/if}
					<div class="otp-help">
						<button class="text-button" type="button" onclick={() => sendOtpFallback(otpEmail)}>Resend code</button>
						<span class="otp-divider">or</span>
						<button class="text-button" type="button" onclick={resetForm}>Start over</button>
					</div>
				</div>
			{:else if signingIn}
				<div class="status-card">
					<h2>{signInFailed ? 'Sign-in failed' : 'Signing you in'}</h2>
					<p>
						{#if signInFailed}
							Please try again from the login form.
						{:else}
							We are securing your session and sending you into the product.
						{/if}
					</p>
				</div>
			{:else if sent}
				<div class="status-card">
					<div class="success-badge">Sent</div>
					<h2>Check your email</h2>
					<p>
						We sent a login link to <strong>{email.trim()}</strong>. Click the button in the email to log in instantly.
					</p>
					<p class="sent-fallback-hint">
						Can't find it? Check spam. You can also enter the 6-digit code from the email below.
					</p>
					<div class="otp-input-row">
						<input
							type="text"
							class="field-input otp-input"
							placeholder="000000"
							maxlength="6"
							inputmode="numeric"
							autocomplete="one-time-code"
							bind:value={otpCode}
							onfocus={() => { otpEmail = email.trim(); }}
							onkeydown={(e) => { if (e.key === 'Enter') { otpEmail = email.trim(); verifyOtp(); } }}
						/>
						<button class="submit-button" type="button" onclick={() => { otpEmail = email.trim(); verifyOtp(); }} disabled={otpVerifying || otpCode.trim().length < 6}>
							{otpVerifying ? 'Verifying...' : 'Verify'}
						</button>
					</div>
					{#if otpError}
						<div class="error-message">{otpError}</div>
					{/if}
					<button class="text-button" type="button" onclick={resetForm}>Use a different email</button>
				</div>
			{:else}
				<div class="form-intro">
					<div class="eyebrow eyebrow-light">No password needed</div>
					<h2>Start using the product</h2>
					<p>
						Enter your email and we will send you a secure magic link. Investors start here.
						Operators use a separate flow.
					</p>
				</div>

				<label class="field-label" for="emailInput">Email address</label>
				<input
					id="emailInput"
					type="email"
					class="field-input"
					placeholder="you@example.com"
					autocomplete="email"
					bind:value={email}
					onkeydown={onKeydown}
				/>

				{#if error}
					<div class="error-message">{error}</div>
				{/if}

				<button class="submit-button" type="button" onclick={handleSubmit} disabled={loading}>
					{loading ? 'Sending...' : 'Get Started'}
				</button>

				<div class="helper-text">Free account. No credit card. You can upgrade later inside the app.</div>

				<div class="micro-links">
					<a href="/for-operators">I am an operator</a>
					<a href="/landing">Back to landing page</a>
				</div>
			{/if}
		</div>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.1), transparent 26%),
			linear-gradient(180deg, #f7f6f1 0%, #efeee7 100%);
	}

	.auth-shell {
		min-height: 100vh;
		min-height: 100dvh;
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(380px, 0.95fr);
	}

	.showcase-panel {
		display: grid;
		align-content: center;
		gap: 28px;
		padding: 36px;
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.12), transparent 22%),
			linear-gradient(160deg, #0d2327 0%, #12353b 100%);
		color: white;
	}

	.showcase-copy {
		max-width: 36rem;
	}

	.eyebrow {
		display: inline-flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.82);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.eyebrow-light {
		background: rgba(31, 81, 89, 0.08);
		color: var(--teal);
	}

	h1,
	h2 {
		margin: 18px 0 0;
		font-family: var(--font-headline);
		font-weight: 400;
		line-height: 0.98;
		letter-spacing: -0.02em;
	}

	h1 {
		font-size: clamp(2.9rem, 4.4vw, 4.8rem);
		max-width: 10ch;
	}

	h2 {
		font-size: clamp(2.2rem, 3.4vw, 3.6rem);
		color: var(--text-dark);
	}

	p,
	label,
	input,
	button,
	a,
	.helper-text {
		font-family: var(--font-ui);
	}

	.showcase-copy p,
	.form-intro p,
	.status-card p {
		margin: 18px 0 0;
		font-size: 17px;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.76);
		max-width: 34rem;
	}

	.benefit-list {
		display: grid;
		gap: 12px;
		margin-top: 24px;
	}

	.benefit-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
		font-size: 15px;
		line-height: 1.55;
		color: rgba(255, 255, 255, 0.9);
	}

	.benefit-dot {
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: var(--primary);
		margin-top: 8px;
		flex-shrink: 0;
		box-shadow: 0 0 0 6px rgba(81, 190, 123, 0.14);
	}

	.showcase-stage {
		width: min(100%, 560px);
	}

	.form-panel {
		display: grid;
		place-items: center;
		padding: 36px 24px;
	}

	.form-card {
		width: min(100%, 520px);
		padding: 34px;
		border-radius: 32px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(255, 255, 255, 0.86);
		box-shadow: 0 24px 54px rgba(20, 20, 19, 0.08);
	}

	.brand-mark,
	.micro-links {
		display: flex;
		align-items: center;
	}

	.brand-mark {
		gap: 10px;
		text-decoration: none;
	}

	.brand-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 36px;
		height: 36px;
		border-radius: 12px;
		background: linear-gradient(145deg, #10353b, #1f5159);
		color: white;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.04em;
	}

	.brand-text {
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.form-intro p,
	.status-card p {
		color: var(--text-secondary);
		max-width: none;
	}

	.field-label {
		display: block;
		margin-top: 26px;
		font-size: 13px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.field-input {
		width: 100%;
		box-sizing: border-box;
		margin-top: 10px;
		padding: 16px 18px;
		border-radius: 16px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: white;
		font-size: 16px;
		color: var(--text-dark);
		outline: none;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.field-input:focus {
		border-color: rgba(81, 190, 123, 0.72);
		box-shadow: 0 0 0 4px rgba(81, 190, 123, 0.12);
	}

	.error-message {
		margin-top: 12px;
		font-size: 14px;
		font-weight: 700;
		color: #b42318;
	}

	.otp-input-row {
		display: flex;
		gap: 10px;
		margin-top: 16px;
	}
	.otp-input {
		flex: 1;
		text-align: center;
		font-size: 24px;
		font-weight: 800;
		letter-spacing: 8px;
		font-family: var(--font-ui, system-ui);
	}
	.otp-help {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-top: 14px;
		font-size: 13px;
	}
	.otp-divider {
		color: var(--text-muted, #999);
	}
	.sent-fallback-hint {
		font-size: 13px;
		color: #6b7280;
		margin-top: 16px;
	}

	.submit-button,
	.text-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-size: 15px;
		font-weight: 800;
		cursor: pointer;
	}

	.submit-button {
		width: 100%;
		margin-top: 18px;
		padding: 15px 20px;
		border: none;
		background: var(--primary);
		color: #0d2327;
		box-shadow: 0 16px 28px rgba(81, 190, 123, 0.24);
	}

	.submit-button:hover:not(:disabled) {
		background: var(--primary-hover);
	}

	.submit-button:disabled {
		opacity: 0.7;
		cursor: default;
	}

	.helper-text {
		margin-top: 14px;
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-muted);
	}

	.micro-links {
		margin-top: 22px;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.micro-links a,
	.text-button {
		color: var(--teal);
		text-decoration: none;
		background: none;
		border: none;
		padding: 0;
	}

	.micro-links a:hover,
	.text-button:hover {
		text-decoration: underline;
	}

	.status-card {
		padding: 12px 0;
	}

	.success-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.14);
		color: #1b8a45;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	@media (max-width: 1080px) {
		.auth-shell {
			grid-template-columns: 1fr;
		}

		.showcase-panel {
			padding: 28px 22px 10px;
		}

		.showcase-stage {
			width: min(100%, 620px);
		}
	}

	@media (max-width: 720px) {
		.showcase-panel {
			display: none;
		}

		.form-panel {
			padding: 20px 16px;
		}

		.form-card {
			padding: 26px 22px;
			border-radius: 24px;
		}

		h2 {
			font-size: clamp(2rem, 11vw, 3rem);
		}
	}
</style>
