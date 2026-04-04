<script>
	import { browser } from '$app/environment';

	let heroEmail = $state('');
	let heroLoading = $state(false);
	let heroSent = $state(false);
	let ctaEmail = $state('');
	let ctaLoading = $state(false);
	let ctaSent = $state(false);
	let mobileMenuOpen = $state(false);

	async function handleEmail(email, setLoading, setSent) {
		const trimmed = email.trim();
		if (!trimmed || !trimmed.includes('@')) return;
		setLoading(true);
		try {
			await fetch('/api/auth', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ action: 'magic-link', email: trimmed, siteUrl: window.location.origin, returnTo: '/app/dashboard' })
			});
			setSent(true);
		} catch {
			setSent(true);
		}
		setLoading(false);
	}

	function handleHeroEmail() {
		handleEmail(heroEmail, (v) => heroLoading = v, (v) => heroSent = v);
	}

	function handleCtaEmail() {
		handleEmail(ctaEmail, (v) => ctaLoading = v, (v) => ctaSent = v);
	}

	function scrollToAnchor(event, href) {
		if (!browser) return;
		const target = document.querySelector(href);
		if (!target) return;
		event.preventDefault();
		mobileMenuOpen = false;
		target.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}

	const heroBullets = [
		'Reach qualified investors already deploying capital',
		'Show up inside the workflow LPs already use to compare opportunities',
		'Position your deals before the first intro call happens'
	];

	const valueCards = [
		{
			title: 'Distribution',
			body: 'Your opportunities surface inside a product investors already use to compare deals, track managers, and plan allocations.'
		},
		{
			title: 'Visibility',
			body: 'Investors see your profile, track record, and open opportunities before you ever get on the phone.'
		},
		{
			title: 'Positioning',
			body: 'Your deals appear in context alongside what investors are already reviewing, not inside a cold inbox.'
		}
	];

	const howSteps = [
		{
			number: '01',
			title: 'Get started inside the product',
			body: 'Enter your work email. We send a secure link. No password, no separate portal. You enter through the same product investors use.'
		},
		{
			number: '02',
			title: 'Set up your manager identity',
			body: 'Add your firm name, track record, and the basics investors look for before they take a call. This becomes your public profile inside the network.'
		},
		{
			number: '03',
			title: 'Add opportunities and build visibility',
			body: 'List your open deals with key terms, structure, and target returns. Investors who match will see your opportunities inside their workflow.'
		}
	];

	const oldWayPoints = [
		'Cold outreach to investors who never asked to hear from you',
		'Upload funnels that go nowhere and never give you feedback',
		'Conference booths and pitch events that cost time and money with no measurable result',
		'Placement agents who take a cut but bring you the same recycled LP lists'
	];

	const thisWayPoints = [
		'One entry point into a network of investors already deploying capital',
		'Your deals appear inside the workflow LPs already use to compare opportunities',
		'Investors see your profile, track record, and terms before the first call',
		'No separate portal, no upload funnel, no placement fee'
	];

	const faqs = [
		{
			question: 'Who is this for?',
			answer: 'Fund managers, debt fund operators, and emerging managers who need better distribution to accredited investors. If you run a deal or a fund and want qualified visibility, this is built for you.'
		},
		{
			question: 'Do I add opportunities on this page?',
			answer: 'No. This page explains how the manager path works. Once you get started, you set up your identity and add opportunities inside the product.'
		},
		{
			question: 'What happens after I get started?',
			answer: 'We send you a secure magic link. You enter the product, set up your manager profile, and begin adding opportunities. Investors who match will see your deals inside their workflow.'
		},
		{
			question: 'Is this only for large managers?',
			answer: 'No. This works for emerging managers raising their first fund and established operators scaling distribution. The entry point is the same.'
		},
		{
			question: 'How are investors qualified?',
			answer: 'Every investor on the platform has completed an onboarding process that includes their investment goals, check size, deal preferences, and accreditation status. Your deals surface to investors whose criteria match.'
		},
		{
			question: 'Can I still do presentations or pitch slots?',
			answer: 'Yes. The platform gives you visibility inside the investor workflow. Presentations, webinars, and direct conversations still happen. This makes those conversations start from a better position.'
		}
	];
</script>

<svelte:head>
	<title>Get Your Deals in Front of Serious Investors | Grow Your Cashflow</title>
	<meta
		name="description"
		content="Share your opportunities with a vetted network of accredited investors actively deploying capital. One entry point, better distribution."
	>
	<meta property="og:title" content="Get Your Deals in Front of Serious Investors | Grow Your Cashflow">
	<meta
		property="og:description"
		content="Share your opportunities with a vetted network of accredited investors actively deploying capital."
	>
	<meta property="og:type" content="website">
	<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="marketing-page">
	<!-- Nav -->
	<nav class="nav-shell">
		<div class="nav">
			<a href="/" class="nav-logo">Grow Your Cashflow</a>
			<div class="nav-links">
				<a href="#how-it-works" onclick={(event) => scrollToAnchor(event, '#how-it-works')}>How it works</a>
				<a href="#why-this-works" onclick={(event) => scrollToAnchor(event, '#why-this-works')}>Why this works</a>
				<a href="#faq" onclick={(event) => scrollToAnchor(event, '#faq')}>FAQ</a>
				<a href="/landing">For investors</a>
			</div>
			<div class="nav-actions">
				<a href="/login" class="nav-login" data-sveltekit-reload>Log in</a>
				<a href="/login?return=/app/dashboard" class="nav-cta" data-sveltekit-reload>Get started</a>
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
			<a href="#how-it-works" onclick={(event) => scrollToAnchor(event, '#how-it-works')}>How it works</a>
			<a href="#why-this-works" onclick={(event) => scrollToAnchor(event, '#why-this-works')}>Why this works</a>
			<a href="#faq" onclick={(event) => scrollToAnchor(event, '#faq')}>FAQ</a>
			<a href="/landing">For investors</a>
			<a href="/login" data-sveltekit-reload>Log in</a>
			<a href="/login?return=/app/dashboard" class="nav-cta" data-sveltekit-reload>Get started</a>
		</div>
	</nav>

	<!-- Hero -->
	<section class="hero-section">
		<div class="hero-copy">
			<div class="eyebrow">For fund managers</div>
			<h1>Get your deals in front of <span class="text-green">serious investors.</span></h1>
			<p class="hero-description">
				Share your opportunities with a vetted network of accredited investors actively deploying capital.
			</p>

			{#if heroSent}
				<div class="email-sent">
					<div class="email-sent-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M20 6L9 17l-5-5"></path>
						</svg>
					</div>
					<div>
						<strong>Check your inbox.</strong>
						<span>We sent a secure link to <strong>{heroEmail}</strong>.</span>
					</div>
				</div>
			{:else}
				<form class="hero-email-form" onsubmit={(e) => { e.preventDefault(); handleHeroEmail(); }}>
					<input
						type="email"
						class="hero-email-input"
						placeholder="Enter your work email"
						bind:value={heroEmail}
						autocomplete="email"
					/>
					<button type="submit" class="btn btn-primary hero-email-btn" disabled={heroLoading}>
						{heroLoading ? 'Sending...' : 'Get started'}
					</button>
				</form>
			{/if}

			<div class="hero-fine-print">No password needed. We'll send you a secure magic link.</div>

			<div class="hero-bullets">
				{#each heroBullets as bullet}
					<div class="hero-bullet">
						<span class="hero-bullet-dot"></span>
						<span>{bullet}</span>
					</div>
				{/each}
			</div>

			<div class="hero-quiet-proof">
				Same onboarding entry point investors use to discover new opportunities.
			</div>
		</div>

		<div class="hero-visual">
			<div class="mockup-window">
				<div class="mockup-bar">
					<span></span><span></span><span></span>
				</div>
				<div class="mockup-body">
					<div class="mockup-kicker">Manager Workspace</div>
					<div class="mockup-title">Your Distribution</div>
					<div class="mockup-metrics">
						<div class="mockup-metric">
							<div class="mockup-metric-value">1,247</div>
							<div class="mockup-metric-label">Qualified Investors</div>
						</div>
						<div class="mockup-metric">
							<div class="mockup-metric-value">89%</div>
							<div class="mockup-metric-label">Profile Match Rate</div>
						</div>
					</div>
					<div class="mockup-section-label">Audience Insights</div>
					<div class="mockup-audience-row">
						<div class="mockup-audience-item">
							<div class="mockup-audience-bar" style="width: 78%"></div>
							<span>Income-focused</span>
							<strong>78%</strong>
						</div>
						<div class="mockup-audience-item">
							<div class="mockup-audience-bar" style="width: 62%"></div>
							<span>$100K+ checks</span>
							<strong>62%</strong>
						</div>
						<div class="mockup-audience-item">
							<div class="mockup-audience-bar" style="width: 45%"></div>
							<span>Tax-advantaged</span>
							<strong>45%</strong>
						</div>
					</div>
					<div class="mockup-chip-row">
						<span>Debt Funds</span>
						<span>Value-Add</span>
						<span>Core-Plus</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Built for -->
	<section class="built-for-strip">
		<p>Built for debt funds, operators, and emerging managers who need better distribution.</p>
		<p>If you are still too small for institutional channels or tired of extra upload funnels, this is the path.</p>
	</section>

	<!-- Value cards -->
	<section class="section" id="visibility">
		<div class="section-heading">
			<div class="eyebrow">Better distribution</div>
			<h2>More qualified visibility without another separate funnel.</h2>
			<p>
				Get in front of serious investors inside the product they already use to compare deals, review managers, and plan allocations.
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

	<!-- How it works -->
	<section class="section" id="how-it-works">
		<div class="section-heading">
			<div class="eyebrow">How it works</div>
			<h2>One product. One entry point. Better investor access.</h2>
			<p>
				There is no separate manager portal. You enter through the same product investors use, set up your identity, and start building visibility.
			</p>
		</div>

		<div class="steps-grid">
			{#each howSteps as step}
				<article class="step-card">
					<div class="step-number">{step.number}</div>
					<h3>{step.title}</h3>
					<p>{step.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<!-- Why this works -->
	<section class="section" id="why-this-works">
		<div class="section-heading">
			<div class="eyebrow">Why this path works</div>
			<h2>Managers need distribution, not another form.</h2>
			<p>
				The old way costs time, money, and credibility. This way puts you inside an active investor network from day one.
			</p>
		</div>

		<div class="comparison-grid">
			<article class="comparison-card">
				<div class="comparison-kicker">Old way</div>
				<h3>Cold outreach and dead upload funnels</h3>
				<ul class="comparison-list">
					{#each oldWayPoints as point}
						<li>{point}</li>
					{/each}
				</ul>
			</article>

			<article class="comparison-card comparison-card--accent">
				<div class="comparison-kicker comparison-kicker--green">This way</div>
				<h3>One entry point into an active investor network</h3>
				<ul class="comparison-list">
					{#each thisWayPoints as point}
						<li>{point}</li>
					{/each}
				</ul>
			</article>
		</div>
	</section>

	<!-- FAQ -->
	<section class="section section-faq" id="faq">
		<div class="section-heading section-heading--narrow">
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

	<!-- Final CTA -->
	<section class="section section-cta">
		<div class="cta-panel">
			<div class="eyebrow eyebrow--dark">Get started</div>
			<h2>Get inside the product and start building visibility.</h2>
			<p>
				Reach qualified investors, position your opportunities better, and start building real distribution without a separate portal or placement fee.
			</p>

			{#if ctaSent}
				<div class="email-sent email-sent--dark">
					<div class="email-sent-icon">
						<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
							<path d="M20 6L9 17l-5-5"></path>
						</svg>
					</div>
					<div>
						<strong>Check your inbox.</strong>
						<span>We sent a secure link to <strong>{ctaEmail}</strong>.</span>
					</div>
				</div>
			{:else}
				<form class="hero-email-form hero-email-form--center" onsubmit={(e) => { e.preventDefault(); handleCtaEmail(); }}>
					<input
						type="email"
						class="hero-email-input"
						placeholder="Enter your work email"
						bind:value={ctaEmail}
						autocomplete="email"
					/>
					<button type="submit" class="btn btn-primary hero-email-btn" disabled={ctaLoading}>
						{ctaLoading ? 'Sending...' : 'Get started'}
					</button>
				</form>
			{/if}

			<div class="cta-links">
				<a href="/login" class="btn btn-secondary btn-secondary--dark" data-sveltekit-reload>Log in</a>
			</div>
		</div>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.09), transparent 26%),
			linear-gradient(180deg, #f8f6ef 0%, #f1efe7 100%);
		color: #121615;
	}

	.marketing-page {
		--text-dark: #141413;
		--text-secondary: #445359;
		--text-muted: #617279;
		--teal: #123840;
		--primary: #51be7b;
		--primary-hover: #43ab6a;
		--font-ui: 'Plus Jakarta Sans', 'Source Sans 3', system-ui, sans-serif;
		--font-body: 'Source Sans 3', 'Plus Jakarta Sans', system-ui, sans-serif;
		--font-display: 'DM Serif Display', Georgia, serif;
		width: min(100%, 1320px);
		margin: 0 auto;
		padding: 24px;
		box-sizing: border-box;
	}

	/* ---- Nav ---- */
	.nav-shell {
		position: sticky;
		top: 0;
		z-index: 40;
		padding-top: 4px;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 14px 18px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		border-radius: 999px;
		background: rgba(248, 246, 239, 0.96);
		backdrop-filter: blur(18px);
		box-shadow: 0 16px 34px rgba(20, 20, 19, 0.07);
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
		color: var(--text-dark);
	}

	.nav-links,
	.nav-actions {
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
		font-weight: 600;
		color: var(--text-secondary);
	}

	.nav-login:hover,
	.nav-links a:hover,
	.nav-mobile a:hover {
		color: var(--text-dark);
	}

	.nav-cta,
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		text-decoration: none;
		transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
		cursor: pointer;
		border: none;
	}

	.nav-cta,
	.btn-primary {
		padding: 12px 18px;
		background: var(--primary);
		color: #0d2327;
		box-shadow: 0 14px 28px rgba(81, 190, 123, 0.22);
	}

	.nav-cta:hover,
	.btn-primary:hover {
		transform: translateY(-1px);
		background: var(--primary-hover);
	}

	.btn-primary:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		transform: none;
	}

	.nav-toggle {
		display: none;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: 999px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: white;
		color: var(--text-dark);
		cursor: pointer;
	}

	.nav-toggle svg {
		width: 22px;
		height: 22px;
	}

	.nav-mobile {
		display: none;
		margin-top: 10px;
		padding: 16px;
		border-radius: 24px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(250, 249, 245, 0.95);
		box-shadow: 0 20px 34px rgba(20, 20, 19, 0.06);
	}

	.nav-mobile.open {
		display: grid;
		gap: 12px;
	}

	/* ---- Typography ---- */
	.eyebrow {
		display: inline-flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: var(--teal);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.eyebrow--dark {
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.82);
	}

	h1, h2, h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-weight: 800;
		line-height: 0.94;
		letter-spacing: -0.045em;
		color: var(--text-dark);
	}

	h1 {
		margin-top: 18px;
		font-size: clamp(3.3rem, 5vw, 5.6rem);
		max-width: 14ch;
	}

	h1 .text-green {
		color: var(--primary);
	}

	h2 {
		margin-top: 18px;
		font-size: clamp(2.4rem, 3.6vw, 4rem);
		max-width: 16ch;
	}

	h3 {
		font-size: clamp(1.8rem, 2.2vw, 2.5rem);
	}

	p, li {
		font-family: var(--font-ui);
		font-size: 18px;
		line-height: 1.58;
		color: var(--text-secondary);
	}

	.hero-description {
		max-width: 36rem;
		margin: 18px 0 0;
		font-size: 20px;
		color: #223036;
	}

	/* ---- Hero ---- */
	.hero-section {
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
		gap: 36px;
		align-items: center;
		padding: 64px 0 40px;
	}

	.hero-copy {
		min-width: 0;
	}

	.hero-email-form {
		display: flex;
		gap: 10px;
		margin-top: 28px;
		max-width: 440px;
	}

	.hero-email-form--center {
		margin-left: auto;
		margin-right: auto;
	}

	.hero-email-input {
		flex: 1;
		padding: 14px 18px;
		border: 1.5px solid rgba(20, 20, 19, 0.12);
		border-radius: 10px;
		font-family: var(--font-body);
		font-size: 16px;
		background: #fff;
		outline: none;
	}

	.hero-email-input:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.12);
	}

	.hero-email-btn {
		white-space: nowrap;
		flex-shrink: 0;
	}

	.hero-fine-print {
		margin: 14px 0 0;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 700;
		color: #2b3b40;
	}

	.hero-bullets {
		display: grid;
		gap: 12px;
		margin-top: 28px;
	}

	.hero-bullet {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.hero-bullet-dot {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.14);
		color: #1b8a45;
		font-size: 13px;
		font-weight: 800;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.hero-bullet span {
		font-family: var(--font-ui);
		font-size: 16px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.hero-quiet-proof {
		margin-top: 28px;
		padding: 14px 18px;
		border-radius: 14px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(255, 255, 255, 0.7);
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 600;
		color: var(--text-muted);
		max-width: 440px;
	}

	.hero-visual {
		min-width: 0;
	}

	.email-sent {
		display: flex;
		align-items: center;
		gap: 16px;
		margin-top: 28px;
		padding: 18px 22px;
		border-radius: 18px;
		border: 1px solid rgba(81, 190, 123, 0.28);
		background: rgba(81, 190, 123, 0.08);
		max-width: 440px;
	}

	.email-sent--dark {
		border-color: rgba(81, 190, 123, 0.3);
		background: rgba(81, 190, 123, 0.12);
	}

	.email-sent-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		background: var(--primary);
		flex-shrink: 0;
	}

	.email-sent-icon svg {
		width: 20px;
		height: 20px;
		color: white;
	}

	.email-sent strong {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.email-sent span {
		display: block;
		margin-top: 4px;
		font-family: var(--font-ui);
		font-size: 14px;
		color: var(--text-secondary);
	}

	.email-sent--dark strong,
	.email-sent--dark span {
		color: white;
	}

	/* ---- Mockup Window ---- */
	.mockup-window {
		border-radius: 24px;
		overflow: hidden;
		background: #f9faf5;
		border: 1px solid rgba(221, 229, 232, 0.94);
		box-shadow: 0 22px 48px rgba(20, 20, 19, 0.1);
	}

	.mockup-bar {
		display: flex;
		gap: 6px;
		padding: 12px 14px;
		background: #22292c;
	}

	.mockup-bar span {
		width: 9px;
		height: 9px;
		border-radius: 999px;
	}

	.mockup-bar span:nth-child(1) { background: #ff5f57; }
	.mockup-bar span:nth-child(2) { background: #ffbd2e; }
	.mockup-bar span:nth-child(3) { background: #28ca41; }

	.mockup-body {
		padding: 22px;
		font-family: var(--font-ui);
	}

	.mockup-kicker {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.mockup-title {
		margin-top: 10px;
		font-size: 24px;
		font-weight: 800;
		line-height: 1.1;
		color: var(--text-dark);
	}

	.mockup-metrics {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 12px;
		margin-top: 18px;
	}

	.mockup-metric {
		padding: 14px;
		border-radius: 18px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: white;
	}

	.mockup-metric-value {
		font-size: 28px;
		font-weight: 800;
		color: var(--text-dark);
		line-height: 1;
	}

	.mockup-metric-label {
		margin-top: 6px;
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}

	.mockup-section-label {
		margin-top: 18px;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.mockup-audience-row {
		display: grid;
		gap: 10px;
		margin-top: 12px;
	}

	.mockup-audience-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 14px;
		border-radius: 14px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: white;
		position: relative;
		overflow: hidden;
	}

	.mockup-audience-bar {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		background: rgba(81, 190, 123, 0.08);
		border-radius: 14px;
	}

	.mockup-audience-item span {
		position: relative;
		flex: 1;
		font-size: 13px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.mockup-audience-item strong {
		position: relative;
		font-size: 14px;
		font-weight: 800;
		color: var(--primary);
	}

	.mockup-chip-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		margin-top: 16px;
	}

	.mockup-chip-row span {
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: var(--teal);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
	}

	/* ---- Built For Strip ---- */
	.built-for-strip {
		margin-top: 10px;
		padding: 22px 28px;
		border-radius: 24px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(255, 255, 255, 0.7);
		box-shadow: 0 12px 28px rgba(20, 20, 19, 0.05);
	}

	.built-for-strip p {
		margin: 0;
		font-family: var(--font-ui);
		font-size: 15px;
		line-height: 1.6;
		color: var(--text-muted);
		text-align: center;
	}

	.built-for-strip p + p {
		margin-top: 6px;
	}

	/* ---- Sections ---- */
	.section {
		padding: 88px 0 0;
	}

	.section-heading {
		max-width: 820px;
	}

	.section-heading p {
		margin: 18px 0 0;
		max-width: 42rem;
	}

	.section-heading--narrow {
		max-width: 700px;
	}

	/* ---- Value cards ---- */
	.value-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		margin-top: 32px;
	}

	.value-card {
		padding: 28px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		border-radius: 28px;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 18px 40px rgba(20, 20, 19, 0.07);
	}

	.value-card h3 {
		margin: 0;
		font-size: clamp(1.8rem, 2vw, 2.4rem);
		line-height: 1.02;
	}

	.value-card p {
		margin: 16px 0 0;
		font-size: 17px;
		color: #2b3a40;
	}

	/* ---- Steps ---- */
	.steps-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		margin-top: 32px;
	}

	.step-card {
		padding: 28px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		border-radius: 28px;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 18px 40px rgba(20, 20, 19, 0.07);
	}

	.step-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 40px;
		height: 40px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.14);
		color: #1b8a45;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
	}

	.step-card h3 {
		margin-top: 18px;
		font-size: clamp(1.6rem, 2vw, 2.2rem);
		line-height: 1.05;
	}

	.step-card p {
		margin: 16px 0 0;
		font-size: 17px;
		color: #2b3a40;
	}

	/* ---- Comparison ---- */
	.comparison-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px;
		margin-top: 32px;
	}

	.comparison-card {
		padding: 28px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		border-radius: 28px;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 18px 40px rgba(20, 20, 19, 0.07);
	}

	.comparison-kicker {
		display: inline-flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: var(--teal);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	.comparison-kicker--green {
		background: rgba(81, 190, 123, 0.16);
		color: #245738;
	}

	.comparison-card h3 {
		margin-top: 18px;
		font-size: clamp(1.8rem, 2vw, 2.4rem);
		line-height: 1.02;
	}

	.comparison-card--accent {
		background:
			linear-gradient(145deg, rgba(81, 190, 123, 0.12), rgba(31, 81, 89, 0.06)),
			rgba(255, 255, 255, 0.98);
		border-color: rgba(81, 190, 123, 0.24);
	}

	.comparison-list {
		margin: 18px 0 0;
		padding-left: 20px;
	}

	.comparison-list li {
		margin-top: 10px;
		font-size: 16px;
		color: #223036;
	}

	/* ---- FAQ ---- */
	.section-faq {
		padding-bottom: 88px;
	}

	.faq-list {
		display: grid;
		gap: 12px;
		margin-top: 28px;
	}

	.faq-item {
		padding: 22px 24px;
		border-radius: 24px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(255, 255, 255, 0.96);
	}

	.faq-item summary {
		cursor: pointer;
		list-style: none;
		font-family: var(--font-ui);
		font-size: 17px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.faq-item summary::-webkit-details-marker {
		display: none;
	}

	.faq-item p {
		margin: 16px 0 0;
		font-size: 16px;
	}

	/* ---- CTA ---- */
	.section-cta {
		padding-top: 0;
		padding-bottom: 64px;
	}

	.cta-panel {
		display: flex;
		flex-direction: column;
		align-items: center;
		text-align: center;
		padding: 48px 28px;
		border-radius: 38px;
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.18), transparent 25%),
			linear-gradient(160deg, #0d2327 0%, #12353b 100%);
		color: white;
		box-shadow: 0 22px 48px rgba(20, 20, 19, 0.12);
	}

	.cta-panel h2,
	.cta-panel p {
		color: white;
	}

	.cta-panel h2 {
		max-width: 18ch;
	}

	.cta-panel p {
		max-width: 760px;
		margin: 18px auto 0;
	}

	.cta-panel .hero-email-input {
		background: rgba(255, 255, 255, 0.12);
		border-color: rgba(255, 255, 255, 0.18);
		color: white;
	}

	.cta-panel .hero-email-input::placeholder {
		color: rgba(255, 255, 255, 0.5);
	}

	.cta-panel .hero-email-input:focus {
		border-color: var(--primary);
		box-shadow: 0 0 0 3px rgba(81, 190, 123, 0.2);
	}

	.cta-links {
		margin-top: 18px;
	}

	.btn {
		padding: 14px 22px;
	}

	.btn-secondary {
		padding: 14px 22px;
		border: 1px solid rgba(20, 20, 19, 0.12);
		background: rgba(255, 255, 255, 0.78);
		color: var(--text-dark);
		text-decoration: none;
	}

	.btn-secondary:hover {
		transform: translateY(-1px);
		background: white;
	}

	.btn-secondary--dark {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.16);
		color: white;
	}

	.btn-secondary--dark:hover {
		background: rgba(255, 255, 255, 0.18);
	}

	/* ---- Responsive ---- */
	@media (max-width: 1100px) {
		.hero-section,
		.comparison-grid {
			grid-template-columns: 1fr;
		}

		.value-grid,
		.steps-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 820px) {
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
			padding-top: 42px;
		}

		h1 {
			max-width: 14ch;
		}

		.section,
		.section-faq {
			padding-top: 72px;
		}
	}

	@media (max-width: 640px) {
		.value-grid,
		.steps-grid {
			grid-template-columns: 1fr;
		}

		.nav {
			padding-inline: 14px;
		}

		h1 {
			font-size: clamp(2.7rem, 14vw, 4rem);
		}

		h2 {
			font-size: clamp(2rem, 11vw, 3rem);
		}

		h3 {
			font-size: clamp(1.8rem, 9vw, 2.4rem);
		}

		p, li, .hero-description, .hero-fine-print {
			font-size: 16px;
		}

		.hero-email-form {
			flex-direction: column;
		}

		.cta-panel {
			padding: 32px 20px;
		}

		.mockup-metrics {
			grid-template-columns: 1fr;
		}
	}
</style>
