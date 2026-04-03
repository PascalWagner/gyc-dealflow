<script>
	import { browser } from '$app/environment';
	import { login, setStoredSessionUser } from '$lib/stores/auth.js';
	import OperatorShowcase from './OperatorShowcase.svelte';

	const appReturnPath = '/app/plan';

	const heroBullets = [
		'Reach qualified investors already deploying capital',
		'Show up inside the workflow LPs already use to compare opportunities',
		'Position your deals before the first intro call happens'
	];

	const valueCards = [
		{
			title: 'Distribution',
			body: 'Get your opportunities in front of investors who are already looking for places to deploy capital.'
		},
		{
			title: 'Visibility',
			body: 'Show up where investors are browsing, saving, and comparing deals instead of disappearing into a submission queue.'
		},
		{
			title: 'Positioning',
			body: 'Give investors context before the first meeting so the conversation starts warmer and more qualified.'
		}
	];

	const workflowSteps = [
		{
			number: '01',
			title: 'Get started inside the product',
			body: 'Use the same secure magic-link entry point investors use. No separate operator form. No upload gate on the homepage.'
		},
		{
			number: '02',
			title: 'Set up your manager identity',
			body: 'Tell us who you are, what you raise, and how you want to show up. Role and fit can be handled during onboarding.'
		},
		{
			number: '03',
			title: 'Add opportunities and build visibility',
			body: 'Once you are inside, you can publish opportunities, book pitch exposure, and get in front of the right investors with better context.'
		}
	];

	const comparisonCards = [
		{
			kicker: 'Old way',
			title: 'Cold outreach and dead upload funnels.',
			points: [
				'You keep chasing attention one call at a time.',
				'You do not know who is serious.',
				'Every introduction starts from zero.'
			]
		},
		{
			kicker: 'This way',
			title: 'One entry point into an active investor network.',
			points: [
				'Your opportunities live where investors already compare deals.',
				'You get better distribution and clearer positioning.',
				'Conversations start with more context and better fit.'
			],
			accent: true
		}
	];

	const faqs = [
		{
			question: 'Who is this for?',
			answer: 'This is for debt funds, private credit managers, real estate operators, and emerging managers who want better distribution to qualified accredited investors.'
		},
		{
			question: 'Do I add opportunities on this page?',
			answer: 'No. This page is for getting you into the product. Once you are inside, you can set up your manager profile and add opportunities from there.'
		},
		{
			question: 'What happens after I get started?',
			answer: 'You enter the same onboarding flow investors use. From there, your manager role can be identified and your workspace can be tailored inside the product.'
		},
		{
			question: 'Is this only for large managers?',
			answer: 'No. It is especially useful for smaller and mid-sized managers who need better access to qualified LP attention without building a whole separate funnel.'
		},
		{
			question: 'How are investors qualified?',
			answer: 'The platform is built around accredited investors who are actively building a private-markets plan, reviewing deals, and looking for the right fit.'
		},
		{
			question: 'Can I still do presentations or pitch slots?',
			answer: 'Yes. Once you are inside, that is the kind of visibility layer that can sit on top of the core product flow.'
		}
	];

	let mobileMenuOpen = $state(false);
	let signupEmail = $state('');
	let signupError = $state('');
	let signupLoading = $state(false);
	let signupSent = $state(false);
	let signupSentEmail = $state('');

	function scrollToAnchor(event, href) {
		if (!browser) return;
		const target = document.querySelector(href);
		if (!target) return;
		event.preventDefault();
		mobileMenuOpen = false;
		target.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	async function handleSignupSubmit() {
		signupError = '';
		const trimmed = signupEmail.trim();
		if (!trimmed || !trimmed.includes('@')) {
			signupError = 'Please enter a valid email.';
			return;
		}

		signupLoading = true;

		try {
			const data = await login(trimmed, {
				siteUrl: browser ? window.location.origin : '',
				returnTo: appReturnPath
			});

			if (data?.bypass && data?.token) {
				setStoredSessionUser(data);
				window.location.href = appReturnPath;
				return;
			}

			if (data?.error) {
				signupError = data.error;
				signupLoading = false;
				return;
			}

			signupSentEmail = trimmed;
			signupSent = true;
		} catch {
			signupSentEmail = trimmed;
			signupSent = true;
		}

		signupLoading = false;
	}

	function resetSignup() {
		signupSent = false;
		signupLoading = false;
		signupEmail = '';
		signupError = '';
		signupSentEmail = '';
	}

	function handleSignupKeydown(event) {
		if (event.key === 'Enter') handleSignupSubmit();
	}
</script>

<svelte:head>
	<title>Get Your Deals in Front of Serious Investors | Grow Your Cashflow</title>
	<meta
		name="description"
		content="Get your deals in front of serious investors with a low-friction onboarding flow built for fund managers, operators, and emerging managers."
	>
	<meta
		property="og:title"
		content="Get Your Deals in Front of Serious Investors | Grow Your Cashflow"
	>
	<meta
		property="og:description"
		content="Share your opportunities with a vetted network of accredited investors actively deploying capital."
	>
	<meta property="og:type" content="website">
</svelte:head>

<div class="marketing-page">
	<nav class="nav-shell">
		<div class="nav">
			<a href="/" class="nav-logo">Grow Your Cashflow</a>
			<div class="nav-links">
				<a href="#workflow" onclick={(event) => scrollToAnchor(event, '#workflow')}>How it works</a>
				<a href="#difference" onclick={(event) => scrollToAnchor(event, '#difference')}>Why this works</a>
				<a href="#faq" onclick={(event) => scrollToAnchor(event, '#faq')}>FAQ</a>
				<a href="/landing-a">For investors</a>
			</div>
			<div class="nav-actions">
				<a href="/login" class="nav-login" data-sveltekit-reload>Log in</a>
				<a href="#signup" class="nav-cta" onclick={(event) => scrollToAnchor(event, '#signup')}>Get started</a>
			</div>
			<button
				class="nav-toggle"
				type="button"
				aria-label="Toggle menu"
				onclick={() => (mobileMenuOpen = !mobileMenuOpen)}
			>
				<svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M4 6h16M4 12h16M4 18h16"></path>
				</svg>
			</button>
		</div>

		<div class:open={mobileMenuOpen} class="nav-mobile">
			<a href="#workflow" onclick={(event) => scrollToAnchor(event, '#workflow')}>How it works</a>
			<a href="#difference" onclick={(event) => scrollToAnchor(event, '#difference')}>Why this works</a>
			<a href="#faq" onclick={(event) => scrollToAnchor(event, '#faq')}>FAQ</a>
			<a href="/landing-a">For investors</a>
			<a href="/login" data-sveltekit-reload>Log in</a>
			<a href="#signup" class="nav-cta" onclick={(event) => scrollToAnchor(event, '#signup')}>Get started</a>
		</div>
	</nav>

	<section class="hero-section">
		<div class="hero-copy">
			<div class="eyebrow">For fund managers</div>
			<h1>Get your deals in front of <span>serious investors.</span></h1>
			<p class="hero-description">
				Share your opportunities with a vetted network of accredited investors actively
				deploying capital.
			</p>

			{#if signupSent}
				<div class="hero-signup-success" id="signup">
					<div class="hero-signup-success-title">Check your email</div>
					<p>
						We sent a secure magic link to <strong>{signupSentEmail}</strong>.
					</p>
					<button class="hero-signup-reset" type="button" onclick={resetSignup}>Use a different email</button>
				</div>
			{:else}
				<div class="hero-signup-shell" id="signup">
					<div class="hero-signup-row">
						<input
							type="email"
							class="hero-signup-input"
							placeholder="Enter your work email"
							autocomplete="email"
							aria-label="Email address"
							bind:value={signupEmail}
							onkeydown={handleSignupKeydown}
						/>
						<button
							class="btn btn-primary hero-signup-button"
							type="button"
							onclick={handleSignupSubmit}
							disabled={signupLoading}
						>
							{signupLoading ? 'Sending...' : 'Get started'}
						</button>
					</div>

					{#if signupError}
						<div class="hero-signup-error">{signupError}</div>
					{/if}

					<div class="hero-signup-note">No password needed. We'll send you a secure magic link.</div>
				</div>
			{/if}

			<div class="hero-bullets">
				{#each heroBullets as bullet}
					<div class="hero-bullet">{bullet}</div>
				{/each}
			</div>

			<div class="hero-social-proof">
				Same onboarding entry point investors use to discover new opportunities.
			</div>
		</div>

		<div class="hero-visual-wrap">
			<div class="hero-visual-label">Distribution inside the platform</div>
			<OperatorShowcase />
		</div>
	</section>

	<section class="trust-rail" aria-label="Why managers use this">
		<div class="trust-rail-title">
			Built for debt funds, operators, and emerging managers who need better distribution.
		</div>
		<div class="trust-rail-copy">
			If you are still too small for institutional channels or tired of extra upload funnels,
			this gives you one clean entry point into the same product investors already use.
		</div>
	</section>

	<section class="section">
		<div class="section-heading section-heading--compact">
			<div class="eyebrow">What this gets you</div>
			<h2>More qualified visibility without another separate funnel.</h2>
			<p>
				The goal is simple: get your opportunities in front of serious investors with better
				context and less friction.
			</p>
		</div>

		<div class="value-grid">
			{#each valueCards as card}
				<article class="value-card">
					<h3>{card.title}</h3>
					<p>{card.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="section" id="workflow">
		<div class="section-heading">
			<div class="eyebrow">How it works</div>
			<h2>One product. One entry point. Better investor access.</h2>
			<p>
				You do not need to fight through a separate operator funnel first. Start inside the
				product and let the role, profile, and opportunity setup happen from there.
			</p>
		</div>

		<div class="workflow-grid">
			{#each workflowSteps as step}
				<article class="workflow-card">
					<div class="workflow-number">{step.number}</div>
					<h3>{step.title}</h3>
					<p>{step.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="section" id="difference">
		<div class="section-heading section-heading--compact">
			<div class="eyebrow">Why this path works</div>
			<h2>Managers need distribution, not another form.</h2>
			<p>
				This route is built to get you into the same environment investors already trust, so your
				opportunities are better positioned from the start.
			</p>
		</div>

		<div class="comparison-board">
			{#each comparisonCards as card}
				<article class:comparison-panel--accent={card.accent} class="comparison-panel">
					<div class="comparison-kicker">{card.kicker}</div>
					<h3>{card.title}</h3>
					<ul class="comparison-list">
						{#each card.points as point}
							<li>{point}</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</section>

	<section class="section section-faq" id="faq">
		<div class="section-heading section-heading--compact">
			<div class="eyebrow">FAQ</div>
			<h2>Questions fund managers ask before they start.</h2>
		</div>

		<div class="faq-list">
			{#each faqs as item}
				<details class="faq-item">
					<summary>{item.question}</summary>
					<p>{item.answer}</p>
				</details>
			{/each}
		</div>
	</section>

	<section class="section section-cta">
		<div class="final-cta">
			<div class="eyebrow">Get started</div>
			<h2>Get inside the product and start building visibility.</h2>
			<p>
				Reach qualified investors, position your opportunities better, and stop relying on cold
				distribution.
			</p>
			<div class="hero-actions hero-actions--center">
				<a href="#signup" class="btn btn-primary" onclick={(event) => scrollToAnchor(event, '#signup')}>
					Get started
				</a>
				<a href="/login" class="btn btn-secondary" data-sveltekit-reload>Log in</a>
			</div>
		</div>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at top left, rgba(89, 194, 130, 0.1), transparent 24%),
			linear-gradient(180deg, #fbfaf5 0%, #f4f1e8 100%);
		color: #101816;
	}

	.marketing-page {
		--page-line: rgba(17, 31, 28, 0.12);
		--page-line-strong: rgba(17, 31, 28, 0.18);
		--page-text: #101816;
		--page-muted: #59676b;
		--page-soft: #7a8a8f;
		--page-teal: #123840;
		--page-green: #5bc884;
		--page-green-deep: #2f9e60;
		width: min(100%, 1240px);
		margin: 0 auto;
		padding: 24px;
		box-sizing: border-box;
	}

	.nav-shell {
		position: sticky;
		top: 0;
		z-index: 40;
		padding-top: 6px;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 14px 18px;
		border: 1px solid rgba(218, 226, 220, 0.96);
		border-radius: 999px;
		background: rgba(248, 246, 239, 0.92);
		backdrop-filter: blur(16px);
		box-shadow: 0 18px 40px rgba(18, 29, 27, 0.05);
	}

	.nav-logo,
	.nav-links a,
	.nav-actions a,
	.nav-mobile a {
		text-decoration: none;
	}

	.nav-logo {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--page-text);
		letter-spacing: -0.02em;
	}

	.nav-links,
	.nav-actions,
	.hero-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.nav-links a,
	.nav-login,
	.nav-mobile a {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 650;
		color: var(--page-muted);
	}

	.nav-login:hover,
	.nav-links a:hover,
	.nav-mobile a:hover {
		color: var(--page-text);
	}

	.nav-cta,
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 760;
		text-decoration: none;
		transition:
			transform 0.18s ease,
			box-shadow 0.18s ease,
			background 0.18s ease,
			border-color 0.18s ease;
	}

	.nav-cta,
	.btn-primary {
		padding: 13px 20px;
		background: var(--page-green);
		color: #0f221d;
		box-shadow: 0 16px 30px rgba(91, 200, 132, 0.2);
	}

	.nav-cta:hover,
	.btn-primary:hover {
		transform: translateY(-1px);
		background: #51c07c;
	}

	.btn {
		padding: 14px 22px;
	}

	.btn-secondary {
		padding: 14px 22px;
		border: 1px solid var(--page-line);
		background: rgba(255, 255, 255, 0.78);
		color: var(--page-text);
		box-shadow: 0 10px 24px rgba(18, 29, 27, 0.04);
	}

	.btn-secondary:hover {
		transform: translateY(-1px);
		background: white;
		border-color: var(--page-line-strong);
	}

	.nav-toggle {
		display: none;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: 999px;
		border: 1px solid rgba(218, 226, 220, 0.96);
		background: white;
		color: var(--page-text);
	}

	.nav-mobile {
		display: none;
		margin-top: 10px;
		padding: 16px;
		border-radius: 26px;
		border: 1px solid rgba(218, 226, 220, 0.96);
		background: rgba(250, 248, 242, 0.96);
		box-shadow: 0 18px 34px rgba(18, 29, 27, 0.05);
	}

	.nav-mobile.open {
		display: grid;
		gap: 12px;
	}

	.hero-section {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
		align-items: center;
		gap: 56px;
		padding: 74px 0 54px;
	}

	.hero-copy,
	.section-heading {
		min-width: 0;
	}

	.eyebrow,
	.comparison-kicker {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 820;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--page-teal);
	}

	h1,
	h2,
	h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-weight: 820;
		line-height: 0.95;
		letter-spacing: -0.05em;
		color: var(--page-text);
	}

	h1 {
		margin-top: 16px;
		font-size: clamp(3.6rem, 6vw, 6.1rem);
		max-width: 10.6ch;
	}

	h1 span {
		color: #238a53;
	}

	h2 {
		margin-top: 16px;
		font-size: clamp(2.35rem, 4vw, 4.2rem);
		max-width: 13ch;
	}

	h3 {
		font-size: clamp(1.5rem, 2vw, 2rem);
	}

	p,
	li,
	.faq-item p {
		font-family: var(--font-ui);
		font-size: 17px;
		line-height: 1.6;
		color: var(--page-muted);
	}

	.hero-description {
		max-width: 34rem;
		margin: 18px 0 0;
		font-size: 21px;
		line-height: 1.55;
		color: #35464a;
	}

	.hero-actions {
		margin-top: 30px;
	}

	.hero-actions--center {
		justify-content: center;
	}

	.hero-signup-shell,
	.hero-signup-success {
		margin-top: 30px;
		max-width: 36rem;
	}

	.hero-signup-row {
		display: grid;
		grid-template-columns: minmax(0, 1fr) auto;
		gap: 12px;
		align-items: center;
	}

	.hero-signup-input {
		width: 100%;
		box-sizing: border-box;
		padding: 17px 18px;
		border-radius: 18px;
		border: 1px solid rgba(211, 220, 214, 0.96);
		background: rgba(255, 255, 255, 0.92);
		font-family: var(--font-ui);
		font-size: 16px;
		color: var(--page-text);
		outline: none;
		transition: border-color 0.18s ease, box-shadow 0.18s ease, background 0.18s ease;
	}

	.hero-signup-input::placeholder {
		color: #90a0a5;
	}

	.hero-signup-input:focus {
		border-color: rgba(91, 200, 132, 0.8);
		background: white;
		box-shadow: 0 0 0 4px rgba(91, 200, 132, 0.12);
	}

	.hero-signup-button {
		min-width: 170px;
		border: none;
		cursor: pointer;
	}

	.hero-signup-button:disabled {
		cursor: wait;
		opacity: 0.72;
		transform: none;
	}

	.hero-signup-error,
	.hero-signup-note,
	.hero-signup-success p,
	.hero-signup-reset {
		font-family: var(--font-ui);
		font-size: 14px;
		line-height: 1.55;
	}

	.hero-signup-error {
		margin-top: 10px;
		color: #b42318;
	}

	.hero-signup-note {
		margin-top: 12px;
		color: #5e6d72;
	}

	.hero-signup-success {
		padding: 18px 20px;
		border-radius: 20px;
		border: 1px solid rgba(91, 200, 132, 0.24);
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 16px 34px rgba(18, 29, 27, 0.06);
	}

	.hero-signup-success-title {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 820;
		letter-spacing: -0.02em;
		color: var(--page-text);
	}

	.hero-signup-success p {
		margin: 8px 0 0;
		color: #47565b;
	}

	.hero-signup-success strong {
		color: var(--page-text);
	}

	.hero-signup-reset {
		margin-top: 12px;
		padding: 0;
		border: none;
		background: transparent;
		color: var(--page-green-deep);
		font-weight: 760;
		cursor: pointer;
	}

	.hero-bullets {
		display: grid;
		gap: 10px;
		margin-top: 26px;
		max-width: 38rem;
	}

	.hero-bullet {
		font-family: var(--font-ui);
		font-size: 17px;
		line-height: 1.55;
		color: #2f3e43;
	}

	.hero-social-proof {
		margin-top: 24px;
		font-family: var(--font-ui);
		font-size: 14px;
		line-height: 1.5;
		color: #6c7b80;
	}

	.hero-visual-wrap {
		min-width: 0;
	}

	.hero-visual-label {
		margin: 0 0 14px 10px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: var(--page-soft);
	}

	.trust-rail {
		display: grid;
		grid-template-columns: max-content minmax(0, 1fr);
		align-items: center;
		gap: 22px;
		padding: 18px 0 0;
		border-top: 1px solid rgba(210, 219, 214, 0.92);
	}

	.trust-rail-title {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 760;
		letter-spacing: -0.02em;
		color: var(--page-text);
		max-width: 24ch;
	}

	.trust-rail-copy {
		font-family: var(--font-ui);
		font-size: 16px;
		line-height: 1.6;
		color: #314045;
	}

	.section {
		padding-top: 96px;
	}

	.section-cta {
		padding-bottom: 48px;
	}

	.section-heading {
		max-width: 52rem;
	}

	.section-heading--compact {
		max-width: 44rem;
	}

	.section-heading p {
		margin: 18px 0 0;
	}

	.value-grid,
	.workflow-grid,
	.comparison-board {
		display: grid;
		gap: 18px;
	}

	.value-grid,
	.workflow-grid,
	.comparison-board {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.value-card,
	.workflow-card,
	.comparison-panel,
	.final-cta {
		border-radius: 30px;
		border: 1px solid rgba(214, 221, 215, 0.95);
		background: rgba(255, 255, 255, 0.82);
		box-shadow: 0 18px 40px rgba(18, 29, 27, 0.045);
	}

	.value-card,
	.workflow-card,
	.comparison-panel {
		padding: 26px;
	}

	.value-card h3,
	.workflow-card h3,
	.comparison-panel h3 {
		font-size: 1.55rem;
		line-height: 1;
	}

	.value-card p,
	.workflow-card p {
		margin: 14px 0 0;
		font-size: 16px;
	}

	.workflow-number {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 820;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #708288;
	}

	.comparison-panel--accent {
		background: rgba(230, 248, 237, 0.9);
		border-color: rgba(91, 200, 132, 0.32);
	}

	.comparison-list {
		margin: 18px 0 0;
		padding-left: 18px;
		display: grid;
		gap: 10px;
	}

	.faq-list {
		display: grid;
		gap: 12px;
	}

	.faq-item {
		border-radius: 22px;
		border: 1px solid rgba(214, 221, 215, 0.95);
		background: rgba(255, 255, 255, 0.8);
		padding: 0 20px;
		box-shadow: 0 14px 28px rgba(18, 29, 27, 0.03);
	}

	.faq-item summary {
		padding: 18px 0;
		cursor: pointer;
		list-style: none;
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 760;
		color: var(--page-text);
	}

	.faq-item summary::-webkit-details-marker {
		display: none;
	}

	.faq-item p {
		margin: 0 0 18px;
		font-size: 15px;
		color: #4d5d62;
	}

	.final-cta {
		padding: 30px;
		text-align: center;
	}

	.final-cta h2 {
		margin-inline: auto;
		max-width: 12ch;
	}

	.final-cta p {
		max-width: 40rem;
		margin: 18px auto 0;
		color: #48575c;
	}

	@media (max-width: 1120px) {
		.hero-section,
		.value-grid,
		.workflow-grid,
		.comparison-board {
			grid-template-columns: 1fr;
		}

		.hero-section {
			gap: 34px;
		}
	}

	@media (max-width: 860px) {
		.marketing-page {
			padding: 16px;
		}

		.nav-links,
		.nav-actions {
			display: none;
		}

		.nav-toggle {
			display: inline-flex;
		}

		.hero-section {
			padding-top: 46px;
		}

		.section {
			padding-top: 78px;
		}

		.trust-rail {
			grid-template-columns: 1fr;
			gap: 12px;
		}
	}

	@media (max-width: 640px) {
		h1 {
			font-size: clamp(2.85rem, 13vw, 4.2rem);
			max-width: 10.8ch;
		}

		h2 {
			font-size: clamp(2rem, 10vw, 3rem);
		}

		p,
		li,
		.hero-description,
		.hero-bullet {
			font-size: 16px;
		}

		.hero-signup-row {
			grid-template-columns: 1fr;
		}

		.hero-signup-button {
			width: 100%;
			min-width: 0;
		}

		.value-card,
		.workflow-card,
		.comparison-panel,
		.final-cta {
			padding: 24px;
		}
	}
</style>
