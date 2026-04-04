<script>
	import { browser } from '$app/environment';
	import InvestorShowcase from '$lib/components/marketing/InvestorShowcase.svelte';

	const primaryCtaHref = '/login?return=/app/plan';
	const gameplanCallHref = 'https://growyourcashflow.io/introcall';
	const academyVideoUrl = 'https://www.youtube.com/watch?v=lvcFJcL-c6w';
	const stats = [
		{ value: '$100K', label: 'Passive income path', detail: 'Start with the outcome, then build the plan to get there' },
		{ value: '838', label: 'Live deals', detail: 'Find better deal flow in one place' },
		{ value: '455', label: 'Managers tracked', detail: 'Check who runs the deal before you take the call' },
		{ value: '1 place', label: 'Plan + diligence', detail: 'Keep your plan, deal notes, and next steps together' }
	];

	const trustedCompanies = ['Lufthansa', 'Techstars', 'Deloitte', 'General Motors'];

	const heroBullets = [
		'Find better deal flow',
		'Do your own diligence with confidence',
		'Build a real plan for passive income'
	];

	const videoPoints = [
		'See the three-step process behind better deal decisions',
		'Understand how to build an income plan before you wire money',
		'See why confidence matters more than finding one perfect deal'
	];

	const problemCards = [
		{
			number: '01',
			title: 'Most investors do not see enough good deals.',
			body: 'They rely on random emails, warm intros, and whatever happens to show up that week.'
		},
		{
			number: '02',
			title: 'Most investors do not know how to vet what they see.',
			body: 'They can spot a pitch deck, but they do not have a simple process for checking the deal and the manager.'
		},
		{
			number: '03',
			title: 'Most investors do not have a real plan.',
			body: 'They want passive income, but they do not know what to buy first or how to get to a goal like $100K a year.'
		}
	];

	const workflowSteps = [
		{
			eyebrow: 'Step 1',
			title: 'Build your income plan',
			body: 'Start with the outcome. Set your passive income goal, your check size, your timeline, and the deal types you want to see.',
			points: ['Set a passive income goal', 'Choose your check size and timing', 'Decide what kinds of deals belong in your plan'],
			kind: 'plan'
		},
		{
			eyebrow: 'Step 2',
			title: 'Find deals that fit',
			body: 'Stop reacting to random pitches. See better matches first and compare the deal, the manager, and the terms in one place.',
			points: ['See better matches first', 'Compare deals without losing the thread', 'Know what deserves a closer look'],
			kind: 'matches'
		},
		{
			eyebrow: 'Step 3',
			title: 'Do your own diligence',
			body: 'Use a clear process to review the deal, the manager, and the risks so you can move forward with more confidence.',
			points: ['Review the manager and the structure', 'Track questions, risks, and red flags', 'Save the best opportunities and move when ready'],
			kind: 'review'
		}
	];

	const comparisonCards = [
		{
			kicker: 'Most platforms',
			title: 'They curate deals for you.',
			points: [
				'You still depend on someone else to think for you.',
				'You get a list, not a process.',
				'You never build your own confidence.'
			]
		},
		{
			kicker: 'Grow Your Cashflow',
			title: 'We help you think clearly for yourself.',
			points: [
				'You define what fits before you look at deals.',
				'You review the deal and the manager with a clear process.',
				'You build your own plan and make better decisions.'
			],
			accent: true
		}
	];

	const networkCards = [
		{
			title: 'Better access',
			body: 'As more serious investors join, more fund managers want to reach the network.'
		},
		{
			title: 'Better signal',
			body: 'More plans, saves, questions, pitch views, and manager updates create better signal on what deserves attention.'
		},
		{
			title: 'Better decisions',
			body: 'Your plan, your diligence notes, and your next steps stay in one system instead of getting lost across inboxes and spreadsheets.'
		}
	];

	const proofQuotes = [
		{
			quote: "Deployed $200K into my first two deals within 60 days. I'd still be on the sidelines without this.",
			author: 'Michael R.',
			role: 'Business Owner, Tampa FL'
		},
		{
			quote: "I vetted my first sponsor in 20 minutes. My advisor said I was crazy. I'm up 11% while his clients are flat.",
			author: 'Sarah K.',
			role: 'Physician, Austin TX'
		},
		{
			quote: "$8,200/month in distributions. That's my mortgage, car, and kids' school covered. And I still have my W-2.",
			author: 'David L.',
			role: 'Software Executive, Denver CO'
		}
	];

	const testimonialVideos = [
		{
			id: 'G_mrxiwEldc',
			name: 'Philip K.',
			role: 'Account Executive',
			hook: 'Clear roadmap, less noise'
		},
		{
			id: 'EX43y_vN1Q0',
			name: 'Kathleen M.',
			role: 'Customer Success Executive',
			hook: 'Better questions, more confidence'
		},
		{
			id: 'OQ0xP_YJLZY',
			name: 'Ian J.',
			role: 'Healthcare Professional',
			hook: 'The reps that made it click'
		}
	];

	const freeFeatures = [
		'Build your investor profile',
		'Set an income goal and your deal rules',
		'Browse live deals and fund managers',
		'Save deals and organize what you want to review'
	];

	const guidedHelpFeatures = [
		'Get a second set of eyes before you wire money',
		'Clarify what you are solving for: income, tax relief, or de-risking',
		'Pressure-test your next deal or your overall plan',
		'See if deeper support inside Cashflow Academy makes sense'
	];

	const faqs = [
		{
			question: 'Who is the page for?',
			answer: 'This page is for accredited investors who want better deal flow, stronger diligence, and a clear path to passive income.'
		},
		{
			question: 'What is free and what is paid?',
			answer: 'The free account lets you build your profile, find deals, review managers, and organize what you want to look at. If you want a second set of eyes, you can book a Deployment Gameplan Call. Some investors later choose deeper support inside Cashflow Academy.'
		},
		{
			question: 'What makes this different from other platforms?',
			answer: 'Most platforms focus on curation. Grow Your Cashflow gives you the tools to build your own plan, do your own diligence, and make better decisions with more confidence.'
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
	<title>Version A | Build Your Path to $100K in Passive Income | Grow Your Cashflow</title>
	<meta
		name="description"
		content="Grow Your Cashflow is the investor network for accredited investors who want better deal flow, stronger diligence, and a clear path to passive income."
	>
	<meta property="og:title" content="Build Your Path to $100K in Passive Income | Grow Your Cashflow">
	<meta
		property="og:description"
		content="Find better deal flow, do your own diligence with confidence, and invest with a clear plan."
	>
	<meta property="og:type" content="website">
</svelte:head>

<div class="marketing-page">
	<nav class="nav-shell">
		<div class="nav">
			<a href="/" class="nav-logo">Grow Your Cashflow</a>
			<div class="nav-links">
				<a href="#problems" onclick={(event) => scrollToAnchor(event, '#problems')}>Problems</a>
				<a href="#workflow" onclick={(event) => scrollToAnchor(event, '#workflow')}>How it works</a>
				<a href="#network" onclick={(event) => scrollToAnchor(event, '#network')}>Investor network</a>
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
			<a href="#problems" onclick={(event) => scrollToAnchor(event, '#problems')}>Problems</a>
			<a href="#workflow" onclick={(event) => scrollToAnchor(event, '#workflow')}>How it works</a>
			<a href="#network" onclick={(event) => scrollToAnchor(event, '#network')}>Investor network</a>
			<a href="/for-operators">For fund managers</a>
			<a href="/login" data-sveltekit-reload>Log in</a>
			<a href={primaryCtaHref} class="nav-cta" data-sveltekit-reload>Start free</a>
		</div>
	</nav>

	<section class="variant-banner" aria-label="Landing page versions">
		<div>
			<div class="variant-label">Saved concept</div>
			<strong>Version A</strong>
			<span>This is the current product-forward proof version.</span>
		</div>
		<div class="variant-links">
			<a href="/landing-a" class="variant-link variant-link--active">Version A</a>
			<a href="/landing-b" class="variant-link">Version B</a>
		</div>
	</section>

	<section class="hero-section">
		<div class="hero-copy">
			<div class="eyebrow">The investor network for private deals</div>
			<h1>Build your path to <span>$100K in passive income.</span></h1>
			<p class="hero-description">
				Find better deal flow, do your own diligence with confidence, and invest with a
				clear plan.
			</p>

			<div class="hero-actions">
				<a href={primaryCtaHref} class="btn btn-primary" data-sveltekit-reload>Start free</a>
				<a href="#workflow" class="btn btn-secondary" onclick={(event) => scrollToAnchor(event, '#workflow')}>
					See how it works
				</a>
			</div>

			<div class="hero-fine-print">Free account. No card. Built for accredited investors.</div>

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

	<section class="trusted-strip" aria-label="Trusted by investors and executives">
		<div class="trusted-label">Trusted by 1,000+ accredited investors, including executives at</div>
		<div class="trusted-logos">
			{#each trustedCompanies as company, index}
				<span>{company}</span>{#if index < trustedCompanies.length - 1}<span class="trusted-dot">&bull;</span>{/if}
			{/each}
		</div>
	</section>

	<section class="section" id="problems">
		<div class="section-heading">
			<div class="eyebrow">The 3 core problems</div>
			<h2>Most LP investors are missing one of these. Usually all three.</h2>
			<p>
				That is why they stay stuck. They do not see enough good deals, they do not know how
				to vet what they see, and they do not have a real plan for turning money into passive
				income.
			</p>
		</div>

		<div class="problem-grid">
			{#each problemCards as card}
				<article class="problem-card">
					<div class="problem-number">{card.number}</div>
					<h3>{card.title}</h3>
					<p>{card.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="section" id="workflow">
		<div class="section-heading">
			<div class="eyebrow">How it works</div>
			<h2>One system for deal flow, diligence, and a real investing plan.</h2>
			<p>
				The job of the platform is simple: help you know what fits, what to review, and what
				to do next so you can move toward passive income with more confidence.
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
								<div class="mini-kicker">Deals that fit</div>
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
								<div class="mini-kicker">Diligence</div>
								<div class="metric-stack">
									<div class="metric-row">
										<div>Manager</div>
										<strong>Reviewed</strong>
									</div>
									<div class="metric-row">
										<div>Structure</div>
										<strong>506(c) filed</strong>
									</div>
									<div class="metric-row">
										<div>Risk notes</div>
										<strong>4 items saved</strong>
									</div>
								</div>
								<div class="chip-row">
									<span>Ask questions</span>
									<span>Compare terms</span>
									<span>Save red flags</span>
								</div>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="section">
		<div class="video-proof">
			<div class="video-proof-copy">
				<div class="eyebrow">See the process</div>
				<h2>Watch the system behind better private deal decisions.</h2>
				<p>
					This is the thinking behind the platform: most investors do not get hurt because
					they are reckless. They get hurt because they trust the pitch more than the
					process.
				</p>
				<div class="video-proof-list">
					{#each videoPoints as point}
						<div class="free-item">
							<span class="checkmark">+</span>
							<span>{point}</span>
						</div>
					{/each}
				</div>
				<div class="hero-actions">
					<a href={primaryCtaHref} class="btn btn-primary" data-sveltekit-reload>Start free</a>
					<a href={gameplanCallHref} target="_blank" rel="noreferrer" class="btn btn-secondary">
						Book a Gameplan Call
					</a>
				</div>
			</div>

			<div class="video-proof-frame">
				<a href={academyVideoUrl} target="_blank" rel="noreferrer" class="video-proof-link">
					<img
						src="https://i.ytimg.com/vi/lvcFJcL-c6w/hqdefault.jpg"
						alt="Watch the Grow Your Cashflow system walkthrough"
						loading="lazy"
					>
					<div class="video-proof-overlay">
						<div class="play-button" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.41-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z"></path>
							</svg>
						</div>
						<div>
							<strong>Watch the overview</strong>
							<span>See the plan, the diligence flow, and where guided help fits.</span>
						</div>
					</div>
				</a>
			</div>
		</div>
	</section>

	<section class="section">
		<div class="difference-panel">
			<div class="difference-copy">
				<div class="eyebrow">Why this is different</div>
				<h2>Not another platform that just tells you what to buy.</h2>
				<p>
					Most investors do not lose because they lack opportunity. They lose because they
					trust the pitch more than the process. Grow Your Cashflow gives you a process you
					can actually use.
				</p>
			</div>

			<div class="comparison-grid">
				{#each comparisonCards as card}
					<article class:comparison-card--accent={card.accent} class="comparison-card">
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
		</div>
	</section>

	<section class="section">
		<div class="section-heading">
			<div class="eyebrow">Proof</div>
			<h2>What this looks like when investors stop guessing and start moving.</h2>
			<p>
				Real proof is simple. People get clearer on what fits, ask better questions, and
				finally make decisions with more confidence.
			</p>
		</div>

		<div class="proof-grid">
			{#each proofQuotes as item}
				<article class="proof-card">
					<div class="proof-quote">&ldquo;{item.quote}&rdquo;</div>
					<div class="proof-author">{item.author}</div>
					<div class="proof-role">{item.role}</div>
				</article>
			{/each}
		</div>

		<div class="proof-video-grid">
			{#each testimonialVideos as item}
				<a
					href={`https://www.youtube.com/watch?v=${item.id}`}
					target="_blank"
					rel="noreferrer"
					class="proof-video-card"
				>
					<div class="proof-video-thumb">
						<img
							src={`https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`}
							alt={`Watch ${item.name}'s story`}
							loading="lazy"
						>
						<div class="proof-video-play" aria-hidden="true">
							<svg viewBox="0 0 24 24" fill="currentColor">
								<path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.41-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z"></path>
							</svg>
						</div>
					</div>
					<div class="proof-video-meta">
						<div class="proof-video-hook">{item.hook}</div>
						<div class="proof-author">{item.name}</div>
						<div class="proof-role">{item.role}</div>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<section class="section section-dark" id="network">
		<div class="section-heading">
			<div class="eyebrow">The investor network</div>
			<h2>The network matters because better signal creates better decisions.</h2>
			<p>
				This is not a noisy social feed. It is a serious investor network built around deal
				flow, diligence, and capital decisions. As the network grows, the product gets more
				useful.
			</p>
		</div>

		<div class="network-grid">
			{#each networkCards as card}
				<article class="network-card">
					<h3>{card.title}</h3>
					<p>{card.body}</p>
				</article>
			{/each}
		</div>
	</section>

	<section class="section" id="free">
		<div class="section-heading">
			<div class="eyebrow">Choose your next step</div>
			<h2>Start free. Get a second set of eyes only when you need it.</h2>
			<p>
				Most people should start with the platform. If you want help pressure-testing your
				next move, book a Gameplan Call and decide from there.
			</p>
		</div>

		<div class="pricing-grid">
			<article class="pricing-card">
				<div class="pricing-kicker">Free account</div>
				<h3>Find deals. Review managers. Build your plan.</h3>
				<div class="free-list">
					{#each freeFeatures as item}
						<div class="free-item">
							<span class="checkmark">+</span>
							<span>{item}</span>
						</div>
					{/each}
				</div>
				<div class="hero-actions">
					<a href={primaryCtaHref} class="btn btn-primary" data-sveltekit-reload>Start free</a>
				</div>
			</article>

			<article class="pricing-card pricing-card--accent">
				<div class="pricing-kicker">Deployment Gameplan Call</div>
				<h3>Want a second set of eyes before you wire money?</h3>
				<div class="support-list">
					{#each guidedHelpFeatures as item}
						<div class="support-item">
							<span class="checkmark">+</span>
							<span>{item}</span>
						</div>
					{/each}
				</div>
				<div class="hero-actions">
					<a href={gameplanCallHref} target="_blank" rel="noreferrer" class="btn btn-secondary">
						Book a Gameplan Call
					</a>
				</div>
				<div class="tier-note">If you want deeper weekly support after the call, that is where Cashflow Academy comes in.</div>
			</article>
		</div>
	</section>

	<section class="section">
		<div class="operator-card">
			<div>
				<div class="eyebrow">For fund managers</div>
				<h2>Raising money? Use the separate fund-manager path.</h2>
				<p>
					If you run a fund or deal, do not go through the investor funnel. Use the
					operator side to list deals, book a pitch spot, and get in front of the right
					investors.
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
			<h2>Start free and build your path to $100K in passive income.</h2>
			<p>
				Find better deal flow, review managers with confidence, and build a real investing
				plan in one place.
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
	.cta-panel,
	.workflow-copy,
	.difference-copy,
	.pricing-card {
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
		max-width: 10.4ch;
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

	.variant-banner {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		margin-top: 18px;
		padding: 16px 18px;
		border-radius: 24px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(255, 255, 255, 0.84);
		box-shadow: 0 12px 28px rgba(20, 20, 19, 0.05);
	}

	.variant-banner strong,
	.variant-banner span,
	.variant-link,
	.variant-label {
		font-family: var(--font-ui);
	}

	.variant-banner strong {
		display: block;
		font-size: 16px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.variant-banner span {
		display: block;
		margin-top: 4px;
		font-size: 14px;
		color: var(--text-secondary);
	}

	.variant-label {
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.variant-links {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.variant-link {
		padding: 10px 14px;
		border-radius: 999px;
		border: 1px solid rgba(20, 20, 19, 0.08);
		background: rgba(255, 255, 255, 0.76);
		text-decoration: none;
		font-size: 13px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.variant-link--active {
		background: rgba(81, 190, 123, 0.16);
		border-color: rgba(81, 190, 123, 0.24);
		color: #245738;
	}

	.trusted-strip {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		margin-top: 26px;
		padding: 16px 20px;
		border-radius: 24px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(255, 255, 255, 0.7);
		box-shadow: 0 12px 28px rgba(20, 20, 19, 0.05);
	}

	.trusted-label {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
		flex-shrink: 0;
	}

	.trusted-logos {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 10px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.trusted-dot {
		color: var(--text-muted);
	}

	.stat-card,
	.workflow-card,
	.problem-card,
	.comparison-card,
	.pricing-card,
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

	.problem-grid,
	.pricing-grid,
	.network-grid,
	.proof-grid {
		display: grid;
		gap: 18px;
		margin-top: 32px;
	}

	.problem-grid,
	.network-grid,
	.proof-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
	}

	.pricing-grid {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.problem-card {
		padding: 24px;
	}

	.problem-number,
	.comparison-kicker,
	.pricing-kicker {
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

	.problem-card h3,
	.comparison-card h3,
	.network-card h3,
	.pricing-card h3 {
		margin-top: 18px;
		font-size: clamp(1.8rem, 2vw, 2.4rem);
		line-height: 1.02;
	}

	.problem-card p,
	.network-card p,
	.pricing-card p,
	.difference-copy p {
		margin: 16px 0 0;
		font-size: 17px;
		color: #2b3a40;
	}

	.video-proof {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
		gap: 24px;
		align-items: center;
		padding: 28px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		border-radius: 30px;
		background: rgba(255, 255, 255, 0.95);
		box-shadow: 0 18px 40px rgba(20, 20, 19, 0.07);
	}

	.video-proof-copy p {
		margin: 18px 0 0;
	}

	.video-proof-list {
		display: grid;
		gap: 12px;
		margin-top: 22px;
	}

	.video-proof-frame {
		min-width: 0;
	}

	.video-proof-link {
		position: relative;
		display: block;
		overflow: hidden;
		border-radius: 24px;
		text-decoration: none;
		background: linear-gradient(145deg, #0d2327, #173e45);
		box-shadow: 0 22px 48px rgba(20, 20, 19, 0.12);
		transition: transform 0.2s ease, box-shadow 0.2s ease;
	}

	.video-proof-link:hover,
	.proof-video-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 28px 56px rgba(20, 20, 19, 0.12);
	}

	.video-proof-link img {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		object-fit: cover;
		object-position: center 35%;
	}

	.video-proof-overlay {
		position: relative;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 18px 20px;
		background: linear-gradient(180deg, rgba(13, 35, 39, 0), rgba(13, 35, 39, 0.88));
		margin-top: -110px;
		color: white;
	}

	.video-proof-overlay strong,
	.video-proof-overlay span {
		display: block;
		font-family: var(--font-ui);
	}

	.video-proof-overlay strong {
		font-size: 16px;
		font-weight: 800;
	}

	.video-proof-overlay span {
		margin-top: 4px;
		font-size: 14px;
		line-height: 1.5;
		color: rgba(255, 255, 255, 0.82);
	}

	.play-button,
	.proof-video-play {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 56px;
		height: 56px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.94);
		color: #102a2f;
		flex-shrink: 0;
		box-shadow: 0 18px 30px rgba(0, 0, 0, 0.18);
	}

	.play-button svg,
	.proof-video-play svg {
		width: 22px;
		height: 22px;
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

	.section-dark h2,
	.section-dark p,
	.section-dark h3 {
		color: white;
	}

	.section-dark .eyebrow {
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.82);
	}

	.network-card {
		padding: 24px;
		border-radius: 24px;
		background: rgba(255, 255, 255, 0.08);
		border: 1px solid rgba(255, 255, 255, 0.12);
		box-shadow: none;
	}

	.network-card p {
		color: rgba(255, 255, 255, 0.78);
	}

	.difference-panel {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		gap: 24px;
		align-items: start;
	}

	.comparison-grid {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px;
	}

	.comparison-card {
		padding: 24px;
	}

	.comparison-card--accent,
	.pricing-card--accent {
		background:
			linear-gradient(145deg, rgba(81, 190, 123, 0.12), rgba(31, 81, 89, 0.06)),
			rgba(255, 255, 255, 0.98);
		border-color: rgba(81, 190, 123, 0.24);
	}

	.comparison-list,
	.pricing-card ul {
		margin: 18px 0 0;
		padding-left: 20px;
	}

	.proof-card {
		padding: 24px;
		border-radius: 24px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 18px 40px rgba(20, 20, 19, 0.06);
	}

	.proof-video-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		margin-top: 18px;
	}

	.proof-video-card {
		overflow: hidden;
		border-radius: 24px;
		border: 1px solid rgba(221, 229, 232, 0.94);
		background: rgba(255, 255, 255, 0.96);
		box-shadow: 0 18px 40px rgba(20, 20, 19, 0.06);
		text-decoration: none;
	}

	.proof-video-thumb {
		position: relative;
		aspect-ratio: 4 / 3;
		background: #102a2f;
	}

	.proof-video-thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 38%;
		display: block;
	}

	.proof-video-play {
		position: absolute;
		left: 18px;
		bottom: 18px;
		width: 48px;
		height: 48px;
	}

	.proof-video-meta {
		padding: 18px 20px 20px;
	}

	.proof-video-hook {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--teal);
	}

	.proof-video-meta .proof-author {
		margin-top: 10px;
	}

	.proof-quote {
		font-family: var(--font-body);
		font-size: 17px;
		line-height: 1.7;
		color: #233237;
	}

	.proof-author {
		margin-top: 18px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.proof-role {
		margin-top: 4px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: #2e7b53;
	}

	.support-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.free-list,
	.support-list {
		display: grid;
		gap: 12px;
		margin-top: 22px;
	}

	.pricing-card {
		padding: 28px;
	}

	.pricing-card--accent .pricing-kicker {
		background: rgba(81, 190, 123, 0.16);
		color: #245738;
	}

	.tier-note {
		margin-top: 18px;
		padding-top: 16px;
		border-top: 1px solid rgba(20, 20, 19, 0.08);
		font-family: var(--font-ui);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary);
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
		.difference-panel,
		.pricing-grid,
		.video-proof {
			grid-template-columns: 1fr;
		}

		.stats-strip {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}

		.problem-grid,
		.network-grid,
		.comparison-grid,
		.proof-grid,
		.proof-video-grid {
			grid-template-columns: 1fr;
		}

		.operator-card {
			flex-direction: column;
			align-items: flex-start;
		}

		.trusted-strip {
			flex-direction: column;
			align-items: flex-start;
		}

		.video-proof-overlay {
			margin-top: 0;
		}

		.variant-banner {
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
		.pipeline-grid,
		.problem-grid,
		.network-grid,
		.proof-grid,
		.proof-video-grid {
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

		.video-proof-overlay {
			flex-direction: column;
			align-items: flex-start;
		}

		.workflow-card,
		.problem-card,
		.comparison-card,
		.pricing-card,
		.stat-card,
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
