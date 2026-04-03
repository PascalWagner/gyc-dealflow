<script>
	import { browser } from '$app/environment';
	import InvestorShowcase from '$lib/components/marketing/InvestorShowcase.svelte';

	const primaryCtaHref = '/login?return=/app/plan';
	const stats = [
		{ value: '838', label: 'Live deals', detail: 'See good deals in one place' },
		{ value: '455', label: 'Fund managers', detail: 'Know who runs the deal before you take a call' },
		{ value: '3 min', label: 'To start', detail: 'Set your rules fast and sort deals with less guessing' },
		{ value: '$0', label: 'To join', detail: 'Free account. No card. No sales call' }
	];

	const heroBullets = [
		'Know what fits before you book a call',
		'See deals, fund managers, and key details in one place',
		'Save the best deals and keep your next steps clear'
	];

	const workflowSteps = [
		{
			eyebrow: 'Step 1',
			title: 'Set your plan',
			body: 'Tell the app what you want so it can sort deals for you.',
			points: ['Pick income, tax help, or growth', 'Set your check size and timing', 'Choose the deal types you want to see'],
			kind: 'plan'
		},
		{
			eyebrow: 'Step 2',
			title: 'Find deals that fit',
			body: 'See the best fits first, then compare the deal, the manager, and the minimum in one place.',
			points: ['See the best fits first', 'Spot what fits and what does not fast', 'Check the manager before the next call'],
			kind: 'matches'
		},
		{
			eyebrow: 'Step 3',
			title: 'Save the best ones',
			body: 'Keep the good deals moving and stop losing track of what to do next.',
			points: ['Save deals you want to review', 'See what needs a closer look', 'Ask for intros when you are ready'],
			kind: 'pipeline'
		}
	];

	const freeFeatures = [
		'Make a free account',
		'Set up your investor profile',
		'Browse live deals and fund managers',
		'Save deals and track what you want to review'
	];

	const memberFeatures = [
		'Build your full plan step by step',
		'Get deeper deal notes and review tools',
		'Join office hours and member lessons',
		'Best for people ready to put money to work now'
	];

	const faqs = [
		{
			question: 'Who is the page for?',
			answer: 'This page is best for accredited investors who want a simple way to find and compare private deals.'
		},
		{
			question: 'What is free and what is paid?',
			answer: 'Free lets you look around, save deals, and learn the app. Member gives you the full plan, deeper deal review, and more help.'
		},
		{
			question: 'When should I upgrade?',
			answer: 'Start free. Upgrade when you are close to making a move and want more help.'
		},
		{
			question: 'What if I run a fund or deal?',
			answer: 'If you run a fund or deal, use the operator page. That side is built for managers, not investors.'
		},
		{
			question: 'Is this giving me personal advice?',
			answer: 'No. It helps you learn, compare deals, and stay organized. It is not personal investment advice.'
		}
	];

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
	<title>Find Better Private Deals Before You Send Money | Grow Your Cashflow</title>
	<meta
		name="description"
		content="Set your plan, browse live private deals, compare fund managers, and start using Grow Your Cashflow for free."
	>
	<meta property="og:title" content="Find Better Private Deals Before You Send Money | Grow Your Cashflow">
	<meta
		property="og:description"
		content="Start free, set your plan, see deals that fit, and compare fund managers before you send money."
	>
	<meta property="og:type" content="website">
</svelte:head>

<div class="marketing-page">
	<nav class="nav-shell">
		<div class="nav">
			<a href="/" class="nav-logo">Grow Your Cashflow</a>
			<div class="nav-links">
				<a href="#workflow" onclick={(event) => scrollToAnchor(event, '#workflow')}>How it works</a>
				<a href="#free" onclick={(event) => scrollToAnchor(event, '#free')}>Free vs member</a>
				<a href="/for-operators">For fund managers</a>
			</div>
			<div class="nav-actions">
				<a href="/login" class="nav-login" data-sveltekit-reload>Log in</a>
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
			<a href="#workflow" onclick={(event) => scrollToAnchor(event, '#workflow')}>How it works</a>
			<a href="#free" onclick={(event) => scrollToAnchor(event, '#free')}>Free vs member</a>
			<a href="/for-operators">For fund managers</a>
			<a href="/login" data-sveltekit-reload>Log in</a>
			<a href={primaryCtaHref} class="nav-cta" data-sveltekit-reload>Start free</a>
		</div>
	</nav>

	<section class="hero-section">
		<div class="hero-copy">
			<div class="eyebrow">For investors</div>
			<h1>Find the right private deals <span>before you send money.</span></h1>
			<p class="hero-description">
				Set your rules, see deals that fit, compare fund managers, and save the best ones in
				one place.
			</p>

			<div class="hero-actions">
				<a href={primaryCtaHref} class="btn btn-primary" data-sveltekit-reload>Start free</a>
				<a href="#workflow" class="btn btn-secondary" onclick={(event) => scrollToAnchor(event, '#workflow')}>
					See how it works
				</a>
			</div>

			<div class="hero-fine-print">Free account. No card. Set your rules in minutes.</div>

			<div class="hero-bullets">
				{#each heroBullets as bullet}
					<div class="hero-bullet">
						<span class="hero-bullet-dot"></span>
						<span>{bullet}</span>
					</div>
				{/each}
			</div>
		</div>

		<div class="hero-visual">
			<InvestorShowcase mode="hero" />
		</div>
	</section>

	<section class="stats-strip" aria-label="Platform stats">
		{#each stats as stat}
			<div class="stat-card">
				<div class="stat-value">{stat.value}</div>
				<div class="stat-label">{stat.label}</div>
				<p>{stat.detail}</p>
			</div>
		{/each}
	</section>

	<section class="section" id="workflow">
		<div class="section-heading">
			<div class="eyebrow">What you do inside</div>
			<h2>Turn random deal emails into a clear plan.</h2>
			<p>
				The job of the app is simple: show you what fits, what does not, and what to look at
				next.
			</p>
		</div>

		<div class="workflow-grid">
			{#each workflowSteps as step}
				<article class="workflow-card">
					<div class="workflow-copy">
						<div class="workflow-eyebrow">{step.eyebrow}</div>
						<h3>{step.title}</h3>
						<p>{step.body}</p>
						<ul>
							{#each step.points as point}
								<li>{point}</li>
							{/each}
						</ul>
					</div>

					<div class={`mini-window mini-window--${step.kind}`}>
						<div class="mini-window-bar">
							<span></span>
							<span></span>
							<span></span>
						</div>

						{#if step.kind === 'plan'}
							<div class="mini-window-body">
								<div class="mini-kicker">Your plan</div>
								<div class="mini-title">$120K / year income</div>
								<div class="chip-row">
									<span>Debt funds</span>
									<span>Storage</span>
									<span>$100K checks</span>
								</div>
								<div class="metric-stack">
									<div class="metric-row">
										<div>When</div>
										<strong>3 to 5 years</strong>
									</div>
									<div class="metric-row">
										<div>First goal</div>
										<strong>Income first</strong>
									</div>
									<div class="metric-row">
										<div>Risk</div>
										<strong>Moderate</strong>
									</div>
								</div>
							</div>
						{:else if step.kind === 'matches'}
							<div class="mini-window-body">
								<div class="mini-kicker">Best fits</div>
								<div class="mini-list">
									<div class="mini-match">
										<div>
											<strong>Blue Mesa Income Fund IV</strong>
											<small>11.2% cash income</small>
										</div>
										<span>97%</span>
									</div>
									<div class="mini-match">
										<div>
											<strong>North Harbor Storage Fund</strong>
											<small>8.5% base + 17% target return</small>
										</div>
										<span>93%</span>
									</div>
									<div class="mini-match">
										<div>
											<strong>Summit Credit Opportunities</strong>
											<small>Private credit</small>
										</div>
										<span>91%</span>
									</div>
								</div>
							</div>
						{:else}
							<div class="mini-window-body">
								<div class="mini-kicker">Next steps</div>
								<div class="pipeline-grid">
									<div class="pipeline-column">
										<div class="pipeline-label">Save</div>
										<div class="pipeline-count">12</div>
										<p>Worth a look</p>
									</div>
									<div class="pipeline-column">
										<div class="pipeline-label">Look</div>
										<div class="pipeline-count">4</div>
										<p>Look closer</p>
									</div>
									<div class="pipeline-column">
										<div class="pipeline-label">Intro</div>
										<div class="pipeline-count">2</div>
										<p>Ready to meet</p>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="section section-dark" id="free">
		<div class="free-grid">
			<div class="free-copy">
				<div class="eyebrow">Start free</div>
				<h2>Start free. Pay only when you need more help.</h2>
				<p>
					Most people should start free. Use the app first. If you like it and want more
					help, move up to member.
				</p>
				<div class="free-list">
					{#each freeFeatures as item}
						<div class="free-item">
							<span class="checkmark">+</span>
							<span>{item}</span>
						</div>
					{/each}
				</div>
				<div class="hero-actions">
					<a href={primaryCtaHref} class="btn btn-primary btn-primary--light" data-sveltekit-reload>
						Create a free account
					</a>
				</div>
			</div>

			<div class="support-card">
				<div class="support-kicker">Member</div>
				<h3>Need more help? Go member.</h3>
				<p>
					Cashflow Academy is the paid layer. Most people should not start there. Start
					with the app. Go member when you want a full plan, deeper reviews, and live help.
				</p>
				<div class="support-list">
					{#each memberFeatures as item}
						<div class="support-item">
							<span class="checkmark">+</span>
							<span>{item}</span>
						</div>
					{/each}
				</div>
				<div class="tier-note">For most people: start free, then pay for more help only when you need it.</div>
			</div>
		</div>
	</section>

	<section class="section">
		<div class="operator-card">
			<div>
				<div class="eyebrow">For fund managers</div>
				<h2>Raising money? Go to the operator side.</h2>
				<p>
					If you run a fund or deal, do not go through the investor path. Use the operator
					side to list deals, book a pitch spot, and get in front of the right people.
				</p>
			</div>
			<a href="/for-operators" class="btn btn-secondary btn-secondary--dark">For fund managers</a>
		</div>
	</section>

	<section class="section section-faq">
		<div class="section-heading section-heading--narrow">
			<div class="eyebrow">FAQ</div>
			<h2>Questions people ask before they start.</h2>
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
		<div class="cta-panel">
			<div class="eyebrow">Start now</div>
			<h2>Make a free account and find deals that fit.</h2>
			<p>
				Set your rules, sort deals fast, and stop guessing what to do next.
			</p>
			<div class="hero-actions hero-actions--center">
				<a href={primaryCtaHref} class="btn btn-primary" data-sveltekit-reload>Start free</a>
				<a href="/login" class="btn btn-secondary" data-sveltekit-reload>Log in</a>
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
		--text-dark: #121615;
		--text-secondary: #445359;
		--text-muted: #617279;
		--teal: #123840;
		--primary: #51be7b;
		--primary-hover: #43ab6a;
		width: min(100%, 1320px);
		margin: 0 auto;
		padding: 24px;
		box-sizing: border-box;
	}

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
	.nav-actions,
	.hero-actions,
	.chip-row {
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

	.hero-section,
	.free-grid,
	.operator-card {
		display: grid;
		gap: 36px;
	}

	.hero-section {
		grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
		align-items: center;
		padding: 64px 0 40px;
	}

	.hero-copy,
	.section-heading,
	.free-copy,
	.cta-panel,
	.support-card,
	.workflow-copy {
		min-width: 0;
	}

	.eyebrow,
	.workflow-eyebrow,
	.support-kicker {
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

	h1,
	h2,
	h3 {
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
		max-width: 8.6ch;
	}

	h1 span {
		color: var(--teal);
	}

	h2 {
		margin-top: 18px;
		font-size: clamp(2.4rem, 3.6vw, 4rem);
		max-width: 14ch;
	}

	h3 {
		font-size: clamp(1.8rem, 2.2vw, 2.5rem);
	}

	p,
	li,
	.hero-fine-print,
	.stat-card p,
	.faq-item p {
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

	.hero-actions {
		margin-top: 28px;
	}

	.hero-actions--center {
		justify-content: center;
	}

	.btn {
		padding: 14px 22px;
	}

	.btn-secondary {
		padding: 14px 22px;
		border: 1px solid rgba(20, 20, 19, 0.12);
		background: rgba(255, 255, 255, 0.78);
		color: var(--text-dark);
	}

	.btn-secondary:hover {
		transform: translateY(-1px);
		background: white;
	}

	.btn-primary--light {
		background: #fff;
		color: #0d2327;
		box-shadow: none;
	}

	.btn-secondary--dark {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.16);
		color: white;
	}

	.hero-fine-print {
		margin: 14px 0 0;
		font-size: 15px;
		font-weight: 700;
		color: #2b3b40;
	}

	.hero-bullets {
		display: grid;
		gap: 12px;
		margin-top: 28px;
	}

	.hero-bullet,
	.free-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.hero-bullet-dot,
	.checkmark {
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

	.hero-visual {
		min-width: 0;
	}

	.stats-strip {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 16px;
		margin-top: 10px;
	}

	.stat-card,
	.workflow-card,
	.support-card,
	.operator-card,
	.cta-panel {
		border: 1px solid rgba(221, 229, 232, 0.94);
		border-radius: 28px;
		background: rgba(255, 255, 255, 0.94);
		box-shadow: 0 18px 40px rgba(20, 20, 19, 0.07);
	}

	.stat-card {
		padding: 22px;
	}

	.stat-value {
		font-family: var(--font-ui);
		font-size: 40px;
		line-height: 1;
		color: var(--text-dark);
		font-weight: 800;
	}

	.stat-label {
		margin-top: 10px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #34454a;
	}

	.stat-card p {
		margin: 10px 0 0;
		font-size: 15px;
		color: #58686d;
	}

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

	.workflow-grid {
		display: grid;
		gap: 18px;
		margin-top: 32px;
	}

	.workflow-card {
		display: grid;
		grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.05fr);
		gap: 24px;
		padding: 24px;
		align-items: center;
	}

	.workflow-card ul {
		margin: 18px 0 0;
		padding-left: 20px;
	}

	.workflow-card li {
		margin-top: 10px;
		font-size: 16px;
		color: #223036;
	}

	.workflow-copy p {
		margin: 16px 0 0;
		font-size: 17px;
		color: #2b3a40;
	}

	.mini-window {
		border-radius: 24px;
		overflow: hidden;
		background: #f9faf5;
		border: 1px solid rgba(221, 229, 232, 0.94);
		box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.6);
	}

	.mini-window-bar {
		display: flex;
		gap: 6px;
		padding: 12px 14px;
		background: #22292c;
	}

	.mini-window-bar span {
		width: 9px;
		height: 9px;
		border-radius: 999px;
	}

	.mini-window-bar span:nth-child(1) {
		background: #ff5f57;
	}

	.mini-window-bar span:nth-child(2) {
		background: #ffbd2e;
	}

	.mini-window-bar span:nth-child(3) {
		background: #28ca41;
	}

	.mini-window-body {
		padding: 18px;
		font-family: var(--font-ui);
	}

	.mini-kicker,
	.pipeline-label {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.mini-title {
		margin-top: 10px;
		font-size: 24px;
		font-weight: 800;
		line-height: 1.1;
		color: var(--text-dark);
	}

	.chip-row {
		margin-top: 16px;
	}

	.chip-row span {
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(31, 81, 89, 0.08);
		color: var(--teal);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
	}

	.metric-stack,
	.mini-list,
	.faq-list,
	.free-list,
	.support-list {
		display: grid;
		gap: 12px;
	}

	.metric-stack {
		margin-top: 18px;
	}

	.metric-row,
	.mini-match,
	.pipeline-column {
		padding: 14px;
		border-radius: 18px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: white;
	}

	.metric-row,
	.mini-match {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
	}

	.metric-row div,
	.pipeline-column p,
	.mini-match small {
		font-size: 13px;
		color: var(--text-secondary);
	}

	.metric-row strong,
	.mini-match strong,
	.pipeline-count {
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.mini-match span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 54px;
		padding: 8px 10px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.14);
		color: #1b8a45;
		font-size: 12px;
		font-weight: 800;
	}

	.pipeline-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
		margin-top: 16px;
	}

	.pipeline-count {
		margin-top: 10px;
		font-size: 28px;
	}

	.pipeline-column p {
		margin: 8px 0 0;
		line-height: 1.5;
	}

	.section-dark {
		margin-top: 88px;
		padding: 40px;
		border-radius: 38px;
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.18), transparent 25%),
			linear-gradient(160deg, #0d2327 0%, #12353b 100%);
		color: white;
	}

	.free-grid {
		grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
		align-items: start;
	}

	.section-dark h2,
	.section-dark p,
	.section-dark .free-item span,
	.section-dark .support-card p,
	.section-dark .support-card h3 {
		color: white;
	}

	.section-dark .eyebrow,
	.section-dark .support-kicker {
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.82);
	}

	.section-dark .free-item,
	.section-dark .support-card {
		color: white;
	}

	.free-list {
		margin-top: 22px;
	}

	.support-list {
		margin-top: 20px;
	}

	.support-card {
		padding: 24px;
		background: rgba(255, 255, 255, 0.08);
		border-color: rgba(255, 255, 255, 0.12);
		box-shadow: none;
	}

	.support-card h3 {
		margin-top: 18px;
		font-size: 34px;
		max-width: 11ch;
	}

	.support-card p {
		margin-top: 16px;
		font-size: 16px;
	}

	.support-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.tier-note {
		margin-top: 18px;
		padding-top: 16px;
		border-top: 1px solid rgba(255, 255, 255, 0.14);
		font-family: var(--font-ui);
		font-size: 13px;
		line-height: 1.6;
		color: rgba(255, 255, 255, 0.76);
	}

	.operator-card,
	.cta-panel {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 24px;
		padding: 28px;
	}

	.operator-card {
		background: linear-gradient(145deg, #102a2f, #173e45);
		border-color: rgba(255, 255, 255, 0.08);
	}

	.operator-card h2,
	.operator-card p {
		color: white;
	}

	.operator-card p {
		max-width: 42rem;
		margin: 18px 0 0;
		font-size: 16px;
	}

	.section-faq {
		padding-bottom: 88px;
	}

	.faq-list {
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

	.section-cta {
		padding-top: 0;
		padding-bottom: 64px;
	}

	.cta-panel {
		flex-direction: column;
		text-align: center;
		padding: 40px 28px;
		background: rgba(255, 255, 255, 0.97);
	}

	.cta-panel p {
		max-width: 760px;
		margin: 18px auto 0;
	}

	@media (max-width: 1100px) {
		.hero-section,
		.workflow-card,
		.free-grid {
			grid-template-columns: 1fr;
		}

		.stats-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.operator-card {
			flex-direction: column;
			align-items: flex-start;
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
			max-width: 12ch;
		}

		.section,
		.section-faq {
			padding-top: 72px;
		}

		.section-dark {
			margin-top: 72px;
			padding: 28px 22px;
		}
	}

	@media (max-width: 640px) {
		.stats-strip,
		.pipeline-grid {
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

		h3,
		.support-card h3 {
			font-size: clamp(1.8rem, 9vw, 2.4rem);
		}

		p,
		li,
		.hero-description,
		.hero-fine-print {
			font-size: 16px;
		}

		.workflow-card,
		.stat-card,
		.support-card,
		.operator-card,
		.cta-panel,
		.faq-item {
			border-radius: 24px;
		}

		.workflow-card,
		.operator-card,
		.cta-panel {
			padding: 20px;
		}
	}
</style>
