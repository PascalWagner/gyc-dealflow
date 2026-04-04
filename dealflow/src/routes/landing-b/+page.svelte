<script>
	import { browser } from '$app/environment';
	import InvestorShowcase from '$lib/components/marketing/InvestorShowcase.svelte';

	const primaryCtaHref = '/login?return=/app/plan';
	const gameplanCallHref = 'https://growyourcashflow.io/introcall';

	const trustMetrics = [
		{ value: '1,000+', label: 'Accredited investors in the ecosystem' },
		{ value: '838', label: 'Live deals tracked' },
		{ value: '455', label: 'Fund managers tracked' },
		{ value: '25+', label: 'Client stories and case studies' }
	];

	const coreNeeds = [
		{
			title: 'A better pipeline',
			body: 'Stop living off random emails, warm intros, and whatever operator pitched you last.'
		},
		{
			title: 'A repeatable process',
			body: 'Know how to check the deal, the manager, the structure, and the risks the same way every time.'
		},
		{
			title: 'A real deployment plan',
			body: 'Tie each investment to a bigger goal like replacing income, lowering taxes, or de-risking your balance sheet.'
		}
	];

	const deskSteps = [
		{
			number: '01',
			title: 'Set the target',
			body: 'Start with the income goal, the check size, and the kinds of deals that fit your plan.'
		},
		{
			number: '02',
			title: 'Review what fits',
			body: 'See matched deals and manager profiles in one place instead of chasing fragments across inboxes and notes.'
		},
		{
			number: '03',
			title: 'Pressure-test the deal',
			body: 'Use a clear diligence flow so you ask better questions before money moves.'
		},
		{
			number: '04',
			title: 'Decide the next move',
			body: 'Save, pass, book the call, or go deeper with a second set of eyes.'
		}
	];

	const comparisonCards = [
		{
			title: 'What most platforms do',
			points: [
				'Lead with curation',
				'Sell access first',
				'Leave you with more pitch decks than clarity'
			]
		},
		{
			title: 'What this version leans into',
			points: [
				'Lead with decision quality',
				'Give you a private-markets desk feel',
				'Help you trust the process before the pitch'
			],
			accent: true
		}
	];

	const testimonialCards = [
		{
			quote: "Deployed $200K into my first two deals within 60 days. I'd still be on the sidelines without this.",
			author: 'Michael R.',
			role: 'Business Owner, Tampa FL'
		},
		{
			quote: "I vetted my first sponsor in 20 minutes. My advisor said I was crazy. I'm up 11% while his clients are flat.",
			author: 'Sarah K.',
			role: 'Physician, Austin TX'
		}
	];

	const outcomeBullets = [
		'Build a path to $100K in passive income',
		'Know what to pass on faster',
		'See where guided help actually fits'
	];

	const companies = ['Lufthansa', 'Techstars', 'Deloitte', 'General Motors'];

	let mobileMenuOpen = $state(false);

	function scrollToAnchor(event, href) {
		if (!browser) return;
		const target = document.querySelector(href);
		if (!target) return;
		event.preventDefault();
		mobileMenuOpen = false;
		target.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
</script>

<svelte:head>
	<title>Version B | Investor Desk Concept | Grow Your Cashflow</title>
	<meta
		name="description"
		content="Version B explores a darker, more institutional landing page for Grow Your Cashflow: outcome-led, process-first, and built around an investor desk feel."
	>
</svelte:head>

<div class="page-shell">
	<nav class="nav-shell">
		<div class="nav">
			<a href="/" class="logo">Grow Your Cashflow</a>

			<div class="nav-links">
				<a href="#desk" onclick={(event) => scrollToAnchor(event, '#desk')}>How it works</a>
				<a href="#proof" onclick={(event) => scrollToAnchor(event, '#proof')}>Proof</a>
				<a href="#next-step" onclick={(event) => scrollToAnchor(event, '#next-step')}>Next step</a>
				<a href="/for-operators">For fund managers</a>
			</div>

			<div class="nav-actions">
				<div class="version-switch" aria-label="Landing page versions">
					<a href="/landing">Version A</a>
					<a href="/landing-b" class="active">Version B</a>
				</div>
				<a href={primaryCtaHref} class="nav-cta" data-sveltekit-reload>Start free</a>
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
			<a href="/landing">Version A</a>
			<a href="/landing-b">Version B</a>
			<a href="#desk" onclick={(event) => scrollToAnchor(event, '#desk')}>How it works</a>
			<a href="#proof" onclick={(event) => scrollToAnchor(event, '#proof')}>Proof</a>
			<a href="#next-step" onclick={(event) => scrollToAnchor(event, '#next-step')}>Next step</a>
			<a href="/for-operators">For fund managers</a>
			<a href={primaryCtaHref} class="nav-cta" data-sveltekit-reload>Start free</a>
		</div>
	</nav>

	<section class="hero">
		<div class="hero-copy">
			<div class="concept-chip">Version B · Institutional desk</div>
			<h1>The investor network for people building real passive income.</h1>
			<p class="hero-text">
				This concept makes Grow Your Cashflow feel more like a private-markets desk. The
				promise stays outcome-led. The design leans more serious, premium, and process-first.
			</p>

			<div class="hero-actions">
				<a href={primaryCtaHref} class="btn btn-primary" data-sveltekit-reload>Start free</a>
				<a href={gameplanCallHref} target="_blank" rel="noreferrer" class="btn btn-secondary">
					Book a Gameplan Call
				</a>
			</div>

			<div class="hero-note">Best fit for accredited investors who want better deal flow, better diligence, and a real deployment plan.</div>

			<div class="hero-bullets">
				{#each outcomeBullets as item}
					<div class="hero-bullet">
						<span class="hero-bullet-mark"></span>
						<span>{item}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="hero-desk">
			<div class="desk-header">
				<div>
					<div class="desk-kicker">Investor desk</div>
					<h2>See what fits before you take the call.</h2>
				</div>
				<div class="desk-badge">Live signal</div>
			</div>

			<div class="desk-visual">
				<InvestorShowcase mode="compact" />
			</div>

			<div class="desk-metrics">
				{#each trustMetrics.slice(0, 3) as stat}
					<div class="desk-metric">
						<div class="desk-metric-value">{stat.value}</div>
						<div class="desk-metric-label">{stat.label}</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="trust-strip" aria-label="Trust metrics">
		<div class="trust-copy">
			<div class="trust-kicker">Trust and signal</div>
			<p>Trusted by 1,000+ accredited investors, including executives at {companies.join(', ')}.</p>
		</div>
		<div class="trust-grid">
			{#each trustMetrics as item}
				<div class="trust-card">
					<div class="trust-value">{item.value}</div>
					<div class="trust-label">{item.label}</div>
				</div>
			{/each}
		</div>
	</section>

	<section class="section">
		<div class="section-head">
			<div class="section-kicker">Core need</div>
			<h2>Serious investors do not need more noise. They need a better operating system.</h2>
			<p>
				This version is built around that idea. Instead of looking like a normal landing page,
				it tries to feel like the front door to a premium investing workflow.
			</p>
		</div>

		<div class="needs-grid">
			{#each coreNeeds as item}
				<article class="need-card">
					<h3>{item.title}</h3>
					<p>{item.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="section desk-section" id="desk">
		<div class="section-head">
			<div class="section-kicker">How the desk works</div>
			<h2>A cleaner path from interest to decision.</h2>
			<p>
				The point is not to impress people with access. The point is to help them know what to
				do next with more confidence.
			</p>
		</div>

		<div class="desk-grid">
			<div class="desk-steps">
				{#each deskSteps as step}
					<div class="desk-step">
						<div class="desk-step-number">{step.number}</div>
						<div>
							<h3>{step.title}</h3>
							<p>{step.body}</p>
						</div>
					</div>
				{/each}
			</div>

			<div class="proof-panel">
				<div class="proof-panel-kicker">What makes this convert</div>
				<h3>Outcome-led on the surface. Institutional underneath.</h3>
				<p>
					Version A feels more product-forward and open. Version B is the alternative if you
					want the site to feel more like a serious investing institution from the first
					scroll.
				</p>
				<ul>
					<li>Stronger authority and premium feel</li>
					<li>Better fit for higher-net-worth prospects</li>
					<li>Less “startup marketplace,” more “private capital desk”</li>
				</ul>
			</div>
		</div>
	</section>

	<section class="section">
		<div class="section-head">
			<div class="section-kicker">Positioning choice</div>
			<h2>Not curation. Better decision support.</h2>
		</div>

		<div class="comparison-grid">
			{#each comparisonCards as item}
				<article class:item-accent={item.accent} class="comparison-card">
					<h3>{item.title}</h3>
					<ul>
						{#each item.points as point}
							<li>{point}</li>
						{/each}
					</ul>
				</article>
			{/each}
		</div>
	</section>

	<section class="section" id="proof">
		<div class="section-head">
			<div class="section-kicker">Proof</div>
			<h2>The conversion lift here comes from trust, not hype.</h2>
			<p>
				This direction assumes the visitor is sophisticated. The page has to make them feel
				safe, informed, and in control.
			</p>
		</div>

		<div class="testimonial-grid">
			{#each testimonialCards as item}
				<article class="testimonial-card">
					<div class="quote-mark">“</div>
					<p>{item.quote}</p>
					<div class="testimonial-author">{item.author}</div>
					<div class="testimonial-role">{item.role}</div>
				</article>
			{/each}
			<div class="testimonial-card testimonial-card--stat">
				<div class="stat-stack">
					<div>
						<strong>$100K</strong>
						<span>Passive income target the page is built around</span>
					</div>
					<div>
						<strong>1 place</strong>
						<span>Plan, deal flow, diligence, and next steps</span>
					</div>
					<div>
						<strong>Optional help</strong>
						<span>Free first, Gameplan Call second, Academy later only if needed</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="section" id="next-step">
		<div class="section-head">
			<div class="section-kicker">Next step</div>
			<h2>Two clear ways in.</h2>
		</div>

		<div class="action-grid">
			<article class="action-card">
				<div class="action-label">Start with the product</div>
				<h3>Use the free platform first.</h3>
				<p>
					Build your investor profile, set your target, review live deals, and start
					organizing what deserves a closer look.
				</p>
				<a href={primaryCtaHref} class="btn btn-primary" data-sveltekit-reload>Start free</a>
			</article>

			<article class="action-card action-card--accent">
				<div class="action-label">Get help on the decision</div>
				<h3>Book a Gameplan Call when you want a second set of eyes.</h3>
				<p>
					If you are close to allocating capital and want help pressure-testing the plan or
					the next deal, book the call. Academy can come later if it makes sense.
				</p>
				<a href={gameplanCallHref} target="_blank" rel="noreferrer" class="btn btn-secondary">
					Book a Gameplan Call
				</a>
			</article>
		</div>
	</section>

	<section class="operator-band">
		<div>
			<div class="section-kicker">For fund managers</div>
			<h2>Still a separate path.</h2>
			<p>
				Investors and operators should not land in the same funnel. If you run a fund or deal,
				use the operator side.
			</p>
		</div>
		<a href="/for-operators" class="btn btn-secondary btn-secondary-dark">For fund managers</a>
	</section>

	<section class="final-cta">
		<div class="final-kicker">Version B summary</div>
		<h2>Darker. More premium. More institutional.</h2>
		<p>
			If Version A is the cleaner product-and-proof page, Version B is the stronger candidate if
			you want the brand to feel like a serious investing institution from day one.
		</p>
		<div class="hero-actions hero-actions-center">
			<a href="/landing" class="btn btn-secondary">Compare with Version A</a>
			<a href={primaryCtaHref} class="btn btn-primary" data-sveltekit-reload>Start free</a>
		</div>
	</section>
</div>

<style>
	:global(body) {
		margin: 0;
		background:
			radial-gradient(circle at top center, rgba(65, 176, 124, 0.18), transparent 18%),
			linear-gradient(180deg, #081416 0%, #0c1b1f 34%, #f3eee4 34%, #f3eee4 100%);
		color: #e9ece6;
	}

	.page-shell {
		--page-cream: #f3eee4;
		--page-ink: #0b1415;
		--page-muted: #5d6b67;
		--page-line: rgba(15, 24, 24, 0.1);
		--page-green: #51be7b;
		--page-green-deep: #0d3a32;
		--page-card: rgba(255, 255, 255, 0.9);
		width: min(100%, 1320px);
		margin: 0 auto;
		padding: 24px;
		box-sizing: border-box;
	}

	.nav-shell {
		position: sticky;
		top: 0;
		z-index: 50;
		padding-top: 4px;
	}

	.nav {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		padding: 14px 18px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		border-radius: 999px;
		background: rgba(8, 20, 22, 0.78);
		backdrop-filter: blur(18px);
		box-shadow: 0 20px 36px rgba(0, 0, 0, 0.18);
	}

	.logo,
	.nav-links a,
	.nav-mobile a,
	.version-switch a {
		text-decoration: none;
		font-family: var(--font-ui);
	}

	.logo {
		font-size: 15px;
		font-weight: 800;
		color: white;
	}

	.nav-links,
	.nav-actions,
	.version-switch,
	.hero-actions {
		display: flex;
		align-items: center;
		gap: 12px;
		flex-wrap: wrap;
	}

	.nav-links a,
	.nav-mobile a {
		font-size: 14px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.72);
	}

	.nav-links a:hover,
	.nav-mobile a:hover {
		color: white;
	}

	.version-switch {
		padding: 4px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.06);
	}

	.version-switch a {
		padding: 8px 12px;
		border-radius: 999px;
		font-size: 12px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.72);
	}

	.version-switch a.active {
		background: rgba(255, 255, 255, 0.12);
		color: white;
	}

	.nav-cta,
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		text-decoration: none;
		transition: transform 0.2s ease, background 0.2s ease, color 0.2s ease, box-shadow 0.2s ease;
	}

	.nav-cta,
	.btn-primary {
		padding: 13px 18px;
		background: var(--page-green);
		color: #082116;
		box-shadow: 0 18px 34px rgba(81, 190, 123, 0.2);
	}

	.nav-cta:hover,
	.btn-primary:hover,
	.btn-secondary:hover,
	.btn-secondary-dark:hover {
		transform: translateY(-1px);
	}

	.btn-secondary {
		padding: 13px 18px;
		border: 1px solid rgba(11, 20, 21, 0.14);
		background: rgba(255, 255, 255, 0.9);
		color: var(--page-ink);
	}

	.btn-secondary-dark {
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: rgba(255, 255, 255, 0.08);
		color: white;
	}

	.nav-toggle {
		display: none;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.12);
		background: rgba(255, 255, 255, 0.04);
		color: white;
	}

	.nav-mobile {
		display: none;
		margin-top: 10px;
		padding: 16px;
		border-radius: 24px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(8, 20, 22, 0.94);
		box-shadow: 0 20px 34px rgba(0, 0, 0, 0.22);
	}

	.nav-mobile.open {
		display: grid;
		gap: 12px;
	}

	.hero {
		display: grid;
		grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
		gap: 28px;
		padding: 68px 0 40px;
		align-items: center;
	}

	.hero-copy,
	.hero-desk,
	.section-head,
	.need-card,
	.proof-panel,
	.comparison-card,
	.testimonial-card,
	.action-card,
	.final-cta,
	.operator-band {
		min-width: 0;
	}

	.concept-chip,
	.section-kicker,
	.trust-kicker,
	.final-kicker,
	.desk-kicker,
	.action-label {
		display: inline-flex;
		align-items: center;
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.1);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}

	h1,
	h2,
	h3 {
		margin: 0;
		font-family: var(--font-ui);
		font-weight: 800;
		letter-spacing: -0.045em;
		line-height: 0.96;
	}

	h1 {
		margin-top: 18px;
		max-width: 11ch;
		font-size: clamp(3.3rem, 5vw, 5.7rem);
		color: white;
	}

	h2 {
		margin-top: 16px;
		max-width: 14ch;
		font-size: clamp(2.3rem, 3.5vw, 4rem);
		color: var(--page-ink);
	}

	.hero-desk h2 {
		max-width: 12ch;
		color: white;
		font-size: clamp(2rem, 2.8vw, 3rem);
	}

	h3 {
		font-size: clamp(1.65rem, 2vw, 2.35rem);
		color: var(--page-ink);
	}

	p,
	li,
	.hero-note {
		font-family: var(--font-ui);
		font-size: 17px;
		line-height: 1.62;
	}

	.hero-text {
		max-width: 38rem;
		margin: 18px 0 0;
		font-size: 20px;
		color: rgba(255, 255, 255, 0.76);
	}

	.hero-actions {
		margin-top: 28px;
	}

	.hero-actions-center {
		justify-content: center;
	}

	.hero-note {
		margin: 16px 0 0;
		font-size: 14px;
		font-weight: 700;
		color: rgba(255, 255, 255, 0.7);
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
		color: rgba(255, 255, 255, 0.82);
	}

	.hero-copy .concept-chip,
	.hero-desk .desk-kicker {
		color: rgba(255, 255, 255, 0.88);
	}

	.hero-bullet-mark {
		display: inline-flex;
		width: 10px;
		height: 10px;
		margin-top: 9px;
		border-radius: 999px;
		background: var(--page-green);
		flex-shrink: 0;
	}

	.hero-desk {
		padding: 24px;
		border-radius: 32px;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background:
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.16), transparent 30%),
			linear-gradient(155deg, rgba(11, 30, 34, 0.98), rgba(13, 48, 54, 0.98));
		box-shadow: 0 26px 60px rgba(0, 0, 0, 0.24);
	}

	.desk-header,
	.trust-strip,
	.operator-band {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
	}

	.desk-badge {
		display: inline-flex;
		align-items: center;
		padding: 10px 14px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.08);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		color: rgba(255, 255, 255, 0.82);
	}

	.desk-visual {
		margin-top: 20px;
	}

	:global(.hero-desk .showcase) {
		width: 100%;
		min-height: 480px;
	}

	.desk-metrics {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
		margin-top: 20px;
	}

	.desk-metric {
		padding: 16px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.desk-metric-value {
		font-family: var(--font-ui);
		font-size: 24px;
		font-weight: 800;
		color: white;
	}

	.desk-metric-label {
		margin-top: 8px;
		font-family: var(--font-ui);
		font-size: 13px;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.7);
	}

	.trust-strip,
	.needs-grid,
	.desk-grid,
	.comparison-grid,
	.testimonial-grid,
	.action-grid {
		display: grid;
		gap: 18px;
	}

	.trust-strip {
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		padding: 26px;
		border-radius: 30px;
		background: rgba(255, 255, 255, 0.06);
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.trust-copy p {
		margin: 16px 0 0;
		color: rgba(255, 255, 255, 0.8);
	}

	.trust-grid,
	.needs-grid,
	.comparison-grid,
	.action-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.trust-grid {
		display: grid;
		gap: 14px;
	}

	.trust-card {
		padding: 18px;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.1);
	}

	.trust-value {
		font-family: var(--font-ui);
		font-size: 26px;
		font-weight: 800;
		color: white;
	}

	.trust-label {
		margin-top: 8px;
		font-family: var(--font-ui);
		font-size: 13px;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.7);
	}

	.section {
		padding: 88px 0 0;
		color: var(--page-ink);
	}

	.section-head {
		max-width: 820px;
	}

	.section-head p {
		margin: 18px 0 0;
		max-width: 42rem;
		color: var(--page-muted);
	}

	.need-card,
	.proof-panel,
	.comparison-card,
	.testimonial-card,
	.action-card {
		padding: 26px;
		border-radius: 28px;
		background: var(--page-card);
		border: 1px solid var(--page-line);
		box-shadow: 0 22px 44px rgba(17, 23, 23, 0.06);
	}

	.need-card p,
	.proof-panel p,
	.testimonial-card p,
	.action-card p {
		margin: 16px 0 0;
		color: var(--page-muted);
	}

	.desk-section {
		padding-top: 96px;
	}

	.desk-grid {
		grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
		margin-top: 32px;
	}

	.desk-steps {
		display: grid;
		gap: 16px;
	}

	.desk-step {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 16px;
		padding: 22px 0;
		border-bottom: 1px solid rgba(11, 20, 21, 0.12);
	}

	.desk-step:last-child {
		border-bottom: 0;
	}

	.desk-step-number {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 48px;
		height: 48px;
		border-radius: 16px;
		background: rgba(81, 190, 123, 0.12);
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--page-green-deep);
	}

	.desk-step h3 {
		font-size: 26px;
	}

	.desk-step p,
	.proof-panel ul,
	.comparison-card ul {
		margin: 14px 0 0;
	}

	.proof-panel {
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.12), transparent 28%),
			rgba(11, 22, 23, 0.96);
		border-color: rgba(255, 255, 255, 0.08);
	}

	.proof-panel-kicker {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.68);
	}

	.proof-panel h3,
	.proof-panel p,
	.proof-panel li {
		color: white;
	}

	.proof-panel p {
		color: rgba(255, 255, 255, 0.76);
	}

	.proof-panel ul,
	.comparison-card ul {
		padding-left: 18px;
	}

	.comparison-card.item-accent {
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.18), transparent 26%),
			rgba(255, 255, 255, 0.96);
		border-color: rgba(81, 190, 123, 0.22);
	}

	.testimonial-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 32px;
	}

	.quote-mark {
		font-family: var(--font-body);
		font-size: 64px;
		line-height: 1;
		color: rgba(81, 190, 123, 0.5);
	}

	.testimonial-author {
		margin-top: 18px;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--page-ink);
	}

	.testimonial-role {
		margin-top: 6px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		color: #2e7b53;
	}

	.testimonial-card--stat {
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.16), transparent 28%),
			rgba(255, 255, 255, 0.96);
	}

	.stat-stack {
		display: grid;
		gap: 18px;
	}

	.stat-stack strong {
		display: block;
		font-family: var(--font-ui);
		font-size: 24px;
		font-weight: 800;
		color: var(--page-ink);
	}

	.stat-stack span {
		display: block;
		margin-top: 6px;
		font-family: var(--font-ui);
		font-size: 14px;
		line-height: 1.5;
		color: var(--page-muted);
	}

	.action-card--accent {
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.16), transparent 30%),
			rgba(255, 255, 255, 0.96);
		border-color: rgba(81, 190, 123, 0.24);
	}

	.action-label,
	.section-kicker,
	.final-kicker {
		color: var(--page-green-deep);
	}

	.action-card .btn,
	.final-cta .btn {
		margin-top: 22px;
	}

	.operator-band {
		margin-top: 88px;
		padding: 30px;
		border-radius: 30px;
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.18), transparent 26%),
			linear-gradient(155deg, rgba(11, 30, 34, 0.98), rgba(13, 48, 54, 0.98));
		border: 1px solid rgba(255, 255, 255, 0.08);
	}

	.operator-band h2,
	.operator-band p {
		color: white;
	}

	.operator-band p {
		margin: 16px 0 0;
		max-width: 40rem;
		color: rgba(255, 255, 255, 0.76);
	}

	.final-cta {
		margin: 88px 0 64px;
		text-align: center;
	}

	.final-cta p {
		max-width: 760px;
		margin: 18px auto 0;
		color: var(--page-muted);
	}

	@media (max-width: 1120px) {
		.hero,
		.trust-strip,
		.desk-grid,
		.comparison-grid,
		.action-grid {
			grid-template-columns: 1fr;
		}

		.trust-grid,
		.needs-grid,
		.testimonial-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 820px) {
		.page-shell {
			padding: 16px;
		}

		.nav-links,
		.nav-actions {
			display: none;
		}

		.nav-toggle {
			display: inline-flex;
		}

		.hero {
			padding-top: 42px;
		}

		h1 {
			max-width: 10.6ch;
			font-size: clamp(2.8rem, 13vw, 4.4rem);
		}

		h2 {
			font-size: clamp(2rem, 10vw, 3rem);
		}

		.section,
		.final-cta {
			padding-top: 72px;
		}

		:global(.hero-desk .showcase) {
			min-height: 420px;
		}
	}

	@media (max-width: 640px) {
		.desk-metrics,
		.trust-grid,
		.needs-grid,
		.testimonial-grid,
		.action-grid {
			grid-template-columns: 1fr;
		}

		.hero-desk,
		.trust-strip,
		.need-card,
		.proof-panel,
		.comparison-card,
		.testimonial-card,
		.action-card,
		.operator-band {
			border-radius: 24px;
		}

		.operator-band {
			align-items: flex-start;
			flex-direction: column;
		}

		.desk-header {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
