	<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { setStoredSessionUser } from '$lib/stores/auth.js';
	import { ADMIN_REAL_USER_KEY } from '$lib/utils/userScopedState.js';

	// ── Reactive state (Svelte 5 runes) ──
	let email = $state('');
	let loading = $state(false);
	let error = $state('');
	let sent = $state(false);
	let signingIn = $state(false);
	let signInFailed = $state(false);

	// Carousel
	const screens = [
		{ label: 'Every deal vetted. Every sponsor tracked.' },
		{ label: 'Know exactly who you\'re investing with.' },
		{ label: 'Your buy box. Your matches. Your plan.' }
	];
	let currentSlide = $state(0);

	// Testimonials
	const testimonials = [
		{
			initials: 'MR',
			quote: 'Deployed $200K into my first two deals within 60 days. I\'d still be on the sidelines without this.',
			author: 'Michael R.',
			role: 'Business Owner, Tampa FL'
		},
		{
			initials: 'SK',
			quote: 'I vetted my first sponsor in 20 minutes. My advisor said I was crazy. I\'m up 11% while his clients are flat.',
			author: 'Sarah K.',
			role: 'Physician, Austin TX'
		},
		{
			initials: 'DL',
			quote: '$8,200/month in distributions. That\'s my mortgage, car, and kids\' school — covered. And I still have my W-2.',
			author: 'David L.',
			role: 'Software Executive, Denver CO'
		}
	];
	let currentTestimonial = $state(0);

	// Derived
	let showcaseLabel = $derived(screens[currentSlide].label);
	let returnUrl = $derived($page.url.searchParams.get('return'));

	// ── Auto-rotate carousel ──
	$effect(() => {
		const timer = setInterval(() => {
			currentSlide = (currentSlide + 1) % screens.length;
		}, 5000);
		return () => clearInterval(timer);
	});

	// ── Auto-rotate testimonials ──
	$effect(() => {
		const timer = setInterval(() => {
			currentTestimonial = (currentTestimonial + 1) % testimonials.length;
		}, 4000);
		return () => clearInterval(timer);
	});

	function showScreen(i) {
		currentSlide = i;
	}

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

	// ── Store user data helper ──
	function storeUser(data) {
		localStorage.removeItem(ADMIN_REAL_USER_KEY);
		const userData = setStoredSessionUser({
			email: data.email,
			name: data.name || data.email?.split('@')[0],
			token: data.token,
			refreshToken: data.refreshToken || '',
			tier: data.tier || 'free',
			isAdmin: data.isAdmin || false,
			tags: data.tags || [],
			contactId: data.contactId || null,
			phone: data.phone || '',
			location: data.location || '',
			share_saved: data.share_saved !== false,
			share_dd: data.share_dd !== false,
			share_invested: data.share_invested !== false,
			allow_follows: data.allow_follows !== false,
			...(data.gpType && {
				gpType: data.gpType,
				managementCompanyId: data.managementCompanyId,
				managementCompanyName: data.managementCompanyName
			})
		});
		if (!userData) return null;
		return userData;
	}

	// ── Magic link callback handler ──
	onMount(() => {
		const hashParams = new URLSearchParams(window.location.hash.substring(1));
		const searchParams = new URLSearchParams(window.location.search);
		const accessToken = hashParams.get('access_token') || searchParams.get('access_token');
		const refreshToken = hashParams.get('refresh_token') || searchParams.get('refresh_token');
		const type = hashParams.get('type') || searchParams.get('type');
		if (!accessToken || type !== 'magiclink') return;

		signingIn = true;

		// Decode the JWT to get the email
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

		// Look up user profile
		fetch('/api/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'lookup', email: userEmail })
		})
			.then((r) => r.json())
			.then((data) => {
				storeUser({
					email: userEmail,
					name: data.name || userEmail.split('@')[0],
					token: accessToken,
					refreshToken: refreshToken || '',
					tier: data.tier,
					isAdmin: data.isAdmin,
					tags: data.tags,
					contactId: data.contactId,
					phone: data.phone,
					location: data.location,
					share_saved: data.share_saved,
					share_dd: data.share_dd,
					share_invested: data.share_invested,
					allow_follows: data.allow_follows,
					gpType: data.gpType,
					managementCompanyId: data.managementCompanyId,
					managementCompanyName: data.managementCompanyName
				});
				const dest = returnUrl || '/app/deals';
				window.location.href = dest;
			})
			.catch(() => {
				// Fallback: store minimal session
				storeUser({
					email: userEmail,
					name: userEmail.split('@')[0],
					token: accessToken,
					refreshToken: refreshToken || '',
					tier: 'free',
					isAdmin: false,
					tags: []
				});
				const dest = returnUrl || '/app/deals';
				window.location.href = dest;
			});
	});

	// ── Form submit ──
	async function handleSubmit() {
		error = '';
		const trimmed = email.trim();
		if (!trimmed || !trimmed.includes('@')) {
			error = 'Please enter a valid email.';
			return;
		}
		loading = true;

		try {
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), 15000);

			const res = await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'magic-link', email: trimmed }),
				signal: controller.signal
			});
			clearTimeout(timeout);

			const data = await res.json();

			if (data.bypass && data.token) {
				// Dev bypass — store session and redirect with full page reload
				storeUser(data);
				const dest = returnUrl || '/app/deals';
				window.location.href = dest;
				return;
			}

			if (data.error) {
				error = data.error;
				loading = false;
				return;
			}

			// Normal flow — show "check your email"
			sent = true;
		} catch (e) {
			if (e.name === 'AbortError') {
				// Timeout — still show success since email may have been sent
				sent = true;
			} else {
				// Network error — show success state anyway (magic link may have sent)
				sent = true;
			}
		}

		loading = false;
	}

	function resetForm() {
		sent = false;
		loading = false;
		email = '';
		error = '';
	}

	function onKeydown(e) {
		if (e.key === 'Enter') handleSubmit();
	}
</script>

<svelte:head>
	<link
		href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Sans+3:wght@400;500;600&display=swap"
		rel="stylesheet"
	/>
	<title>GYC - Sign In</title>
</svelte:head>

<div class="split-layout">
	<!-- ─── Left: Platform showcase ─── -->
	<div class="left-panel">
		<div class="left-content">
			<div class="screenshot-carousel">
				<div class="screenshot-frame">
					<!-- Screen 1: Deal Flow -->
					<div class="screen screen-deals" class:active={currentSlide === 0}>
						<div class="page-title">Deal Flow</div>
						<div class="page-subtitle">838 deals from 455 vetted sponsors</div>
						<div class="tabs-row">
							<div class="tab on">Filter</div>
							<div class="tab">Review</div>
							<div class="tab">Connect</div>
							<div class="tab">Decide</div>
						</div>
						<div class="deal-grid">
							<div class="deal-card">
								<div class="deal-card-header">
									<div class="deal-card-icon" style="background:#EBF5FF;">&#x1F3E2;</div>
									<div>
										<div class="deal-card-name">Meridian Self Storage Fund III</div>
										<div class="deal-card-sponsor">Meridian Capital Partners</div>
									</div>
								</div>
								<div class="deal-card-metrics">
									<div class="deal-metric"><strong>8.2%</strong>Pref Return</div>
									<div class="deal-metric"><strong>18.5%</strong>Target IRR</div>
								</div>
								<div class="deal-card-tag" style="background:rgba(81,190,123,0.1);color:#51BE7B;">
									Open
								</div>
							</div>
							<div class="deal-card">
								<div class="deal-card-header">
									<div class="deal-card-icon" style="background:#FFF5EB;">&#x1F3E8;</div>
									<div>
										<div class="deal-card-name">Gulf Coast Hospitality REIT</div>
										<div class="deal-card-sponsor">Tidewater Group</div>
									</div>
								</div>
								<div class="deal-card-metrics">
									<div class="deal-metric"><strong>10%</strong>Pref Return</div>
									<div class="deal-metric"><strong>22%</strong>Target IRR</div>
								</div>
								<div class="deal-card-tag" style="background:rgba(59,130,246,0.1);color:#3B82F6;">
									New
								</div>
							</div>
							<div class="deal-card">
								<div class="deal-card-header">
									<div class="deal-card-icon" style="background:#F0FFF4;">&#x1F3ED;</div>
									<div>
										<div class="deal-card-name">Sunbelt Industrial Portfolio</div>
										<div class="deal-card-sponsor">Atlas Industrial Group</div>
									</div>
								</div>
								<div class="deal-card-metrics">
									<div class="deal-metric"><strong>7%</strong>Pref Return</div>
									<div class="deal-metric"><strong>16%</strong>Target IRR</div>
								</div>
								<div class="deal-card-tag" style="background:rgba(81,190,123,0.1);color:#51BE7B;">
									Open
								</div>
							</div>
							<div class="deal-card">
								<div class="deal-card-header">
									<div class="deal-card-icon" style="background:#FFF0F5;">&#x1F3E0;</div>
									<div>
										<div class="deal-card-name">Carolina Multifamily Fund II</div>
										<div class="deal-card-sponsor">Pinnacle Living Partners</div>
									</div>
								</div>
								<div class="deal-card-metrics">
									<div class="deal-metric"><strong>8%</strong>Pref Return</div>
									<div class="deal-metric"><strong>17%</strong>Target IRR</div>
								</div>
								<div class="deal-card-tag" style="background:rgba(234,179,8,0.1);color:#CA8A04;">
									Closing Soon
								</div>
							</div>
						</div>
					</div>

					<!-- Screen 2: Sponsor Profile -->
					<div class="screen screen-sponsor" class:active={currentSlide === 1}>
						<div class="sponsor-header">
							<div class="sponsor-logo">MC</div>
							<div>
								<div class="sponsor-name">Meridian Capital Partners</div>
								<div class="sponsor-type">Self Storage &middot; Industrial &middot; Est. 2014</div>
								<div class="sponsor-verified">&#10003; Verified Sponsor</div>
							</div>
						</div>
						<div class="sponsor-stats">
							<div class="sponsor-stat">
								<div class="sponsor-stat-val">$420M</div>
								<div class="sponsor-stat-label">AUM</div>
							</div>
							<div class="sponsor-stat">
								<div class="sponsor-stat-val">12</div>
								<div class="sponsor-stat-label">Deals</div>
							</div>
							<div class="sponsor-stat">
								<div class="sponsor-stat-val">19.2%</div>
								<div class="sponsor-stat-label">Avg IRR</div>
							</div>
							<div class="sponsor-stat">
								<div class="sponsor-stat-val">0</div>
								<div class="sponsor-stat-label">Losses</div>
							</div>
						</div>
						<div class="sponsor-track">
							<div class="sponsor-track-title">Track Record by Asset Class</div>
							<div class="track-bar-row">
								<div class="track-bar-label">Self Storage</div>
								<div class="track-bar-bg"><div class="track-bar-fill" style="width:85%"></div></div>
							</div>
							<div class="track-bar-row">
								<div class="track-bar-label">Industrial</div>
								<div class="track-bar-bg"><div class="track-bar-fill" style="width:60%"></div></div>
							</div>
							<div class="track-bar-row">
								<div class="track-bar-label">Multifamily</div>
								<div class="track-bar-bg"><div class="track-bar-fill" style="width:35%"></div></div>
							</div>
							<div class="track-bar-row">
								<div class="track-bar-label">Retail</div>
								<div class="track-bar-bg"><div class="track-bar-fill" style="width:15%"></div></div>
							</div>
						</div>
					</div>

					<!-- Screen 3: Dashboard -->
					<div class="screen screen-dashboard" class:active={currentSlide === 2}>
						<div class="dash-greeting">Good morning, Sarah</div>
						<div class="dash-cards">
							<div class="dash-card">
								<div class="dash-card-label">New Deals</div>
								<div class="dash-card-val">14</div>
								<div class="dash-card-change">+6 this week</div>
							</div>
							<div class="dash-card">
								<div class="dash-card-label">Matches</div>
								<div class="dash-card-val">8</div>
								<div class="dash-card-change">3 new today</div>
							</div>
							<div class="dash-card">
								<div class="dash-card-label">Saved</div>
								<div class="dash-card-val">23</div>
								<div class="dash-card-change">2 closing soon</div>
							</div>
						</div>
						<div class="dash-section-title">Top Matches for You</div>
						<div class="dash-match-list">
							<div class="dash-match">
								<div class="dash-match-icon" style="background:#EBF5FF;">&#x1F3E2;</div>
								<div class="dash-match-info">
									<div class="dash-match-name">Meridian Self Storage Fund III</div>
									<div class="dash-match-detail">
										8.2% Pref &middot; 18.5% IRR &middot; Self Storage
									</div>
								</div>
								<div class="dash-match-badge">98% Match</div>
							</div>
							<div class="dash-match">
								<div class="dash-match-icon" style="background:#FFF5EB;">&#x1F3E8;</div>
								<div class="dash-match-info">
									<div class="dash-match-name">Gulf Coast Hospitality REIT</div>
									<div class="dash-match-detail">
										10% Pref &middot; 22% IRR &middot; Hospitality
									</div>
								</div>
								<div class="dash-match-badge">94% Match</div>
							</div>
							<div class="dash-match">
								<div class="dash-match-icon" style="background:#F0FFF4;">&#x1F3ED;</div>
								<div class="dash-match-info">
									<div class="dash-match-name">Sunbelt Industrial Portfolio</div>
									<div class="dash-match-detail">
										7% Pref &middot; 16% IRR &middot; Industrial
									</div>
								</div>
								<div class="dash-match-badge">91% Match</div>
							</div>
						</div>
					</div>
				</div>
			</div>

			<div class="showcase-caption">
				<div class="showcase-label">{showcaseLabel}</div>
				<div class="showcase-dots">
					{#each screens as _, i}
						<button
							class="showcase-dot"
							class:active={currentSlide === i}
							aria-label={`Show slide ${i + 1}`}
							onclick={() => showScreen(i)}
						></button>
					{/each}
				</div>
			</div>

			<div class="testimonial-section">
				{#each testimonials as t, i}
					<div class="testimonial-slide" class:active={currentTestimonial === i}>
						<div class="testimonial-avatar">{t.initials}</div>
						<div class="testimonial-body">
							<div class="testimonial-quote">"{t.quote}"</div>
							<div class="testimonial-author">{t.author}</div>
							<div class="testimonial-role">{t.role}</div>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- Mobile header -->
	<div class="mobile-header">
		<div class="mobile-brand">
			<div class="brand-mark-icon">GYC</div>
			<div class="brand-mark-text">Grow Your Cashflow</div>
		</div>
		<div class="mobile-tagline">Research vetted sponsors. Invest with a plan.</div>
	</div>

	<!-- ─── Right: Form ─── -->
	<div class="right-panel">
		<div class="form-container">
			<div class="brand-mark">
				<div class="brand-mark-icon">GYC</div>
				<div class="brand-mark-text">Grow Your Cashflow</div>
			</div>

			{#if signingIn}
				<!-- Auth callback loading state -->
				{#if signInFailed}
					<p style="text-align:center;color:#dc2626;padding:40px 0;">
						Sign-in failed. Please try again.
					</p>
				{:else}
					<p style="text-align:center;color:var(--slate);font-size:16px;padding:40px 0;">
						Signing you in...
					</p>
				{/if}
			{:else if sent}
				<!-- Success state -->
				<div class="success-state show">
					<div class="success-check">
						<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
							<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
						</svg>
					</div>
					<h2>Check your email</h2>
					<p>
						We sent a login link to<br /><span class="email-highlight">{email.trim()}</span>
					</p>
					<button class="retry" onclick={resetForm}>Use a different email</button>
				</div>
			{:else}
				<!-- Form state -->
				<div class="form-title">Build your cash-flowing portfolio</div>
				<div class="form-desc">
					Whether you're deploying your first $50K or your next $500K — research vetted sponsors,
					match deals to your goals, and invest with a plan.
				</div>

				<label class="field-label" for="emailInput">Email address</label>
				<input
					type="email"
					class="field-input"
					id="emailInput"
					placeholder="you@example.com"
					autocomplete="email"
					bind:value={email}
					onkeydown={onKeydown}
				/>
				{#if error}
					<div class="error-msg show">{error}</div>
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
			{/if}
		</div>
	</div>
</div>

<style>
	:global(body) {
		font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
		-webkit-font-smoothing: antialiased;
		margin: 0;
		min-height: 100vh;
		min-height: 100dvh;
	}

	.split-layout {
		--green: #51BE7B;
		--green-hover: #45A86C;
		--teal: #1F5159;
		--teal-dark: #0A1E21;
		--charcoal: #141413;
		--slate: #6B7280;
		--border: #E5E7EB;
		display: flex;
		min-height: 100vh;
		min-height: 100dvh;
	}

	/* ─── Left panel: showcase ─── */
	.left-panel {
		flex: 1;
		background: linear-gradient(160deg, #0f2d33 0%, #1f5159 40%, #163b42 100%);
		position: relative;
		overflow: hidden;
		display: none;
	}
	@media (min-width: 900px) {
		.left-panel {
			display: flex;
			flex-direction: column;
		}
	}

	/* Subtle grid pattern */
	.left-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		opacity: 0.04;
		background-image: linear-gradient(rgba(255, 255, 255, 0.5) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.5) 1px, transparent 1px);
		background-size: 60px 60px;
	}

	/* Glow effect */
	.left-panel::after {
		content: '';
		position: absolute;
		width: 500px;
		height: 500px;
		border-radius: 50%;
		background: radial-gradient(circle, rgba(81, 190, 123, 0.12) 0%, transparent 70%);
		top: 30%;
		left: 30%;
		transform: translate(-50%, -50%);
		pointer-events: none;
	}

	.left-content {
		position: relative;
		z-index: 2;
		flex: 1;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 60px 40px;
	}

	/* ─── Screenshot showcase ─── */
	.screenshot-carousel {
		width: 100%;
		max-width: 520px;
		position: relative;
	}

	.screenshot-frame {
		position: relative;
		border-radius: 12px;
		overflow: hidden;
		box-shadow: 0 25px 60px rgba(0, 0, 0, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.06);
		background: #1a1a1a;
		aspect-ratio: 16 / 10;
		transition: opacity 0.6s ease;
	}

	/* Browser chrome bar */
	.screenshot-frame::before {
		content: '';
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 32px;
		background: #2a2a2a;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		z-index: 3;
	}
	.screenshot-frame::after {
		content: '';
		position: absolute;
		top: 10px;
		left: 12px;
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #ff5f57;
		box-shadow: 14px 0 0 #ffbd2e, 28px 0 0 #28ca41;
		z-index: 4;
	}

	.screen {
		position: absolute;
		inset: 0;
		top: 32px;
		opacity: 0;
		transition: opacity 0.8s ease;
		overflow: hidden;
	}
	.screen.active {
		opacity: 1;
	}

	/* ─── Screen 1: Deal Flow grid ─── */
	.screen-deals {
		background: #faf9f5;
		padding: 20px;
		font-family: 'Plus Jakarta Sans', sans-serif;
	}
	.screen-deals .page-title {
		font-family: 'DM Serif Display', serif;
		font-size: 18px;
		color: var(--charcoal);
		margin-bottom: 4px;
	}
	.screen-deals .page-subtitle {
		font-size: 10px;
		color: var(--slate);
		margin-bottom: 14px;
	}
	.screen-deals .tabs-row {
		display: flex;
		gap: 0;
		border-bottom: 2px solid #e5e7eb;
		margin-bottom: 14px;
	}
	.screen-deals .tab {
		padding: 6px 12px;
		font-size: 9px;
		font-weight: 600;
		color: var(--slate);
		border-bottom: 2px solid transparent;
		margin-bottom: -2px;
	}
	.screen-deals .tab.on {
		color: var(--green);
		border-bottom-color: var(--green);
	}
	.deal-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 10px;
	}
	.deal-card {
		background: #fff;
		border-radius: 8px;
		padding: 12px;
		border: 1px solid #eee;
	}
	.deal-card-header {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 8px;
	}
	.deal-card-icon {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
	}
	.deal-card-name {
		font-size: 10px;
		font-weight: 700;
		color: var(--charcoal);
		line-height: 1.2;
	}
	.deal-card-sponsor {
		font-size: 8px;
		color: var(--slate);
		margin-top: 1px;
	}
	.deal-card-metrics {
		display: flex;
		gap: 10px;
		margin-top: 6px;
	}
	.deal-metric {
		font-size: 8px;
		color: var(--slate);
	}
	.deal-metric strong {
		display: block;
		font-size: 11px;
		color: var(--charcoal);
		font-weight: 700;
	}
	.deal-card-tag {
		display: inline-block;
		font-size: 7px;
		font-weight: 700;
		padding: 2px 6px;
		border-radius: 4px;
		margin-top: 8px;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	/* ─── Screen 2: Sponsor profile ─── */
	.screen-sponsor {
		background: #faf9f5;
		padding: 20px;
		font-family: 'Plus Jakarta Sans', sans-serif;
	}
	.sponsor-header {
		display: flex;
		align-items: center;
		gap: 14px;
		margin-bottom: 16px;
	}
	.sponsor-logo {
		width: 44px;
		height: 44px;
		border-radius: 10px;
		background: linear-gradient(135deg, var(--teal), #2a6b75);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 14px;
		font-weight: 800;
		color: #fff;
	}
	.sponsor-name {
		font-size: 16px;
		font-weight: 700;
		color: var(--charcoal);
	}
	.sponsor-type {
		font-size: 10px;
		color: var(--slate);
		margin-top: 2px;
	}
	.sponsor-verified {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		font-size: 8px;
		font-weight: 700;
		color: var(--green);
		background: rgba(81, 190, 123, 0.1);
		padding: 3px 8px;
		border-radius: 4px;
		margin-top: 4px;
	}
	.sponsor-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 10px;
		margin-bottom: 16px;
	}
	.sponsor-stat {
		background: #fff;
		border-radius: 8px;
		padding: 10px;
		border: 1px solid #eee;
		text-align: center;
	}
	.sponsor-stat-val {
		font-size: 14px;
		font-weight: 800;
		color: var(--charcoal);
	}
	.sponsor-stat-label {
		font-size: 7px;
		color: var(--slate);
		margin-top: 2px;
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}
	.sponsor-track {
		background: #fff;
		border-radius: 8px;
		padding: 12px;
		border: 1px solid #eee;
	}
	.sponsor-track-title {
		font-size: 10px;
		font-weight: 700;
		color: var(--charcoal);
		margin-bottom: 10px;
	}
	.track-bar-row {
		display: flex;
		align-items: center;
		gap: 8px;
		margin-bottom: 6px;
	}
	.track-bar-label {
		font-size: 8px;
		color: var(--slate);
		width: 60px;
		flex-shrink: 0;
	}
	.track-bar-bg {
		flex: 1;
		height: 6px;
		background: #f0f0f0;
		border-radius: 3px;
		overflow: hidden;
	}
	.track-bar-fill {
		height: 100%;
		border-radius: 3px;
		background: var(--green);
	}

	/* ─── Screen 3: Dashboard ─── */
	.screen-dashboard {
		background: #faf9f5;
		padding: 20px;
		font-family: 'Plus Jakarta Sans', sans-serif;
	}
	.dash-greeting {
		font-family: 'DM Serif Display', serif;
		font-size: 16px;
		color: var(--charcoal);
		margin-bottom: 14px;
	}
	.dash-cards {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 10px;
		margin-bottom: 14px;
	}
	.dash-card {
		background: #fff;
		border-radius: 8px;
		padding: 12px;
		border: 1px solid #eee;
	}
	.dash-card-label {
		font-size: 8px;
		color: var(--slate);
		text-transform: uppercase;
		letter-spacing: 0.3px;
		margin-bottom: 4px;
	}
	.dash-card-val {
		font-size: 18px;
		font-weight: 800;
		color: var(--charcoal);
	}
	.dash-card-change {
		font-size: 8px;
		font-weight: 600;
		color: var(--green);
		margin-top: 2px;
	}
	.dash-section-title {
		font-size: 10px;
		font-weight: 700;
		color: var(--charcoal);
		margin-bottom: 8px;
	}
	.dash-match-list {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}
	.dash-match {
		display: flex;
		align-items: center;
		gap: 10px;
		background: #fff;
		border-radius: 8px;
		padding: 10px 12px;
		border: 1px solid #eee;
	}
	.dash-match-icon {
		width: 28px;
		height: 28px;
		border-radius: 6px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 12px;
		flex-shrink: 0;
	}
	.dash-match-info {
		flex: 1;
	}
	.dash-match-name {
		font-size: 10px;
		font-weight: 700;
		color: var(--charcoal);
	}
	.dash-match-detail {
		font-size: 8px;
		color: var(--slate);
		margin-top: 1px;
	}
	.dash-match-badge {
		font-size: 7px;
		font-weight: 700;
		padding: 3px 8px;
		border-radius: 4px;
		background: rgba(81, 190, 123, 0.1);
		color: var(--green);
		text-transform: uppercase;
		letter-spacing: 0.3px;
	}

	/* ─── Caption below screenshot ─── */
	.showcase-caption {
		text-align: center;
		margin-top: 28px;
	}
	.showcase-label {
		font-size: 13px;
		font-weight: 500;
		color: rgba(255, 255, 255, 0.7);
		margin-bottom: 16px;
		transition: opacity 0.5s ease;
	}
	.showcase-dots {
		display: flex;
		justify-content: center;
		gap: 8px;
	}
	.showcase-dot {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: rgba(255, 255, 255, 0.2);
		cursor: pointer;
		transition: all 0.3s;
		border: none;
		padding: 0;
	}
	.showcase-dot.active {
		background: var(--green);
		width: 24px;
		border-radius: 3px;
	}

	/* ─── Testimonial below screenshot ─── */
	.testimonial-section {
		margin-top: 32px;
		max-width: 520px;
		width: 100%;
		position: relative;
		min-height: 80px;
	}
	.testimonial-slide {
		position: absolute;
		inset: 0;
		opacity: 0;
		transition: opacity 0.6s ease;
		display: flex;
		align-items: flex-start;
		gap: 14px;
	}
	.testimonial-slide.active {
		opacity: 1;
	}
	.testimonial-avatar {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		background: rgba(81, 190, 123, 0.15);
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 13px;
		font-weight: 700;
		color: var(--green);
		flex-shrink: 0;
		margin-top: 2px;
	}
	.testimonial-body {
		flex: 1;
	}
	.testimonial-quote {
		font-size: 14px;
		color: rgba(255, 255, 255, 0.75);
		line-height: 1.55;
		font-style: italic;
	}
	.testimonial-author {
		margin-top: 8px;
		font-size: 12px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.9);
	}
	.testimonial-role {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.4);
		font-weight: 400;
		margin-top: 1px;
	}

	/* ─── Right panel: form ─── */
	.right-panel {
		flex: 1;
		max-width: 520px;
		background: #fff;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		padding: 40px 24px;
	}

	.form-container {
		width: 100%;
		max-width: 380px;
	}

	.brand-mark {
		display: flex;
		align-items: center;
		gap: 10px;
		margin-bottom: 48px;
	}
	.brand-mark-icon {
		width: 36px;
		height: 36px;
		background: linear-gradient(135deg, var(--green) 0%, var(--teal) 100%);
		border-radius: 10px;
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 11px;
		font-weight: 800;
		color: #fff;
		letter-spacing: -0.3px;
	}
	.brand-mark-text {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 18px;
		color: var(--charcoal);
	}

	.form-title {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 30px;
		color: var(--charcoal);
		margin-bottom: 8px;
		line-height: 1.2;
	}

	.form-desc {
		font-size: 15px;
		color: var(--slate);
		margin-bottom: 36px;
		line-height: 1.5;
	}

	.field-label {
		display: block;
		font-size: 13px;
		font-weight: 600;
		color: var(--charcoal);
		margin-bottom: 8px;
	}

	.field-input {
		width: 100%;
		padding: 16px 18px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 15px;
		color: var(--charcoal);
		background: #fafafa;
		border: 1px solid var(--border);
		border-radius: 12px;
		outline: none;
		transition: all 0.2s;
		-webkit-appearance: none;
	}
	.field-input::placeholder {
		color: #b0b8c0;
	}
	.field-input:focus {
		border-color: var(--green);
		background: #fff;
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.1);
	}

	.submit-btn {
		width: 100%;
		padding: 16px 24px;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 15px;
		font-weight: 600;
		color: #fff;
		background: var(--green);
		border: none;
		border-radius: 12px;
		cursor: pointer;
		transition: all 0.2s;
		margin-top: 20px;
	}
	.submit-btn:hover {
		background: var(--green-hover);
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

	/* Error */
	.error-msg {
		font-size: 13px;
		color: #dc2626;
		margin-top: 8px;
		display: none;
	}
	.error-msg.show {
		display: block;
	}

	/* Success */
	.success-state {
		display: none;
		text-align: center;
	}
	.success-state.show {
		display: block;
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
		color: var(--green);
	}
	.success-state h2 {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 24px;
		color: var(--charcoal);
		margin-bottom: 10px;
	}
	.success-state p {
		font-size: 14px;
		color: var(--slate);
		line-height: 1.6;
	}
	.success-state .email-highlight {
		color: var(--charcoal);
		font-weight: 600;
	}
	.retry {
		display: inline-block;
		margin-top: 20px;
		color: var(--green);
		text-decoration: none;
		font-size: 13px;
		font-weight: 600;
		cursor: pointer;
		background: none;
		border: none;
		font-family: inherit;
	}
	.retry:hover {
		text-decoration: underline;
	}

	/* ─── Mobile ─── */
	.mobile-header {
		display: none;
	}
	@media (max-width: 899px) {
		.split-layout {
			flex-direction: column;
			min-height: 100vh;
			min-height: 100dvh;
		}
		.mobile-header {
			display: block;
			background: linear-gradient(160deg, #0f2d33, #1f5159);
			padding: 48px 24px 28px;
			padding-top: calc(48px + env(safe-area-inset-top, 0px));
			text-align: center;
		}
		.mobile-brand {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 10px;
		}
		.mobile-brand .brand-mark-icon {
			width: 32px;
			height: 32px;
			background: linear-gradient(135deg, var(--green) 0%, var(--teal) 100%);
			border-radius: 8px;
			display: flex;
			align-items: center;
			justify-content: center;
			font-size: 10px;
			font-weight: 800;
			color: #fff;
		}
		.mobile-brand .brand-mark-text {
			font-family: 'DM Serif Display', Georgia, serif;
			font-size: 17px;
			color: #fff;
		}
		.mobile-tagline {
			margin-top: 10px;
			font-size: 13px;
			color: rgba(255, 255, 255, 0.6);
			line-height: 1.4;
		}
		.right-panel {
			max-width: 100%;
			min-height: auto;
			flex: none;
			justify-content: flex-start;
			padding: 32px 24px 40px;
			padding-bottom: calc(40px + env(safe-area-inset-bottom, 0px));
		}
		.right-panel .brand-mark {
			display: none;
		}
		.form-container {
			max-width: 420px;
			margin: 0 auto;
		}
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
	@media (min-width: 900px) {
		.mobile-header {
			display: none;
		}
	}
</style>
