<script>
	import { browser } from '$app/environment';
	import { login, setStoredSessionUser } from '$lib/stores/auth.js';
	import VersionAShowcase from './VersionAShowcase.svelte';

	const appReturnPath = '/app/plan';
	const gameplanCallHref = 'https://growyourcashflow.io/introcall';
	const demoVideoUrl = 'https://www.youtube.com/watch?v=lvcFJcL-c6w';

	const heroBullets = [
		'Find better deal flow',
		'Do your own diligence with confidence',
		'Build a real plan for passive income'
	];

	const trustAudience = ['business owners', 'executives', 'first-time LPs'];

	const bridgeItems = [
		{
			number: '01',
			title: 'A plan before a pitch',
			body: 'Know what you want, what fits, and what does not before you react to a deck.'
		},
		{
			number: '02',
			title: 'Better deal flow in one place',
			body: 'Stop chasing random intros and start reviewing opportunities against your plan.'
		},
		{
			number: '03',
			title: 'A simple way to review risk',
			body: 'Check the manager, the structure, and the red flags before you make a real decision.'
		}
	];

	const problemCards = [
		{
			number: '01',
			title: 'No real plan.',
			body: 'Just scattered decks, podcasts, and pitch calls. You are seeing opportunities, but they are not tied to one clear income goal or one written strategy.'
		},
		{
			number: '02',
			title: 'No clear buy box.',
			body: 'No simple way to say "this fits" versus "this is noise." Every new deal pulls your attention because the rules are not written down.'
		},
		{
			number: '03',
			title: 'No reps with one checklist.',
			body: 'So every $50K decision feels like a brand-new leap of faith. The manager changes, the story changes, and you still have to decide if it is safe enough to wire.'
		}
	];

	const workflowSteps = [
		{
			eyebrow: 'Step 1',
			title: 'Build your income plan',
			body: 'Start with the outcome. Set your passive income goal, your timeline, your check size, and the deal rules you want to follow.',
			points: ['Set a passive income goal', 'Choose your check size and timing', 'Decide what kinds of deals belong in your plan'],
			kind: 'plan'
		},
		{
			eyebrow: 'Step 2',
			title: 'Find deals that fit',
			body: 'Stop reacting to random pitches. See better matches first and compare opportunities side by side.',
			points: ['See better matches first', 'Compare deals without losing the thread', 'Know what deserves a closer look'],
			kind: 'matches'
		},
		{
			eyebrow: 'Step 3',
			title: 'Review before you wire',
			body: 'Check the manager, the structure, and the risks in one place so you can make a real invest-or-pass decision.',
			points: ['Review the manager and track record', 'Save questions and red flags', 'Move forward with more confidence'],
			kind: 'review'
		}
	];

	const demoPoints = [
		'See how your plan, deal flow, and diligence live in one place',
		'See what happens right after you create your free account',
		'See how the platform helps you make a real invest-or-pass decision'
	];

	const comparisonCards = [
		{
			kicker: 'What you usually get',
			title: 'A list of deals and a lot of opinions.',
			points: [
				'You still need a way to decide what fits.',
				'You get access, not a real process.',
				'You leave with more information, not more confidence.'
			]
		},
		{
			kicker: 'What you get here',
			title: 'A process you can actually use.',
			points: [
				'You define what fits before you look at deals.',
				'You review the deal and the manager in one place.',
				'You know what to do next before you wire money.'
			],
			accent: true
		}
	];

	const featuredProof = {
		quote: 'I finally had a clear roadmap instead of scattered deal pitches.',
		detail: 'The big shift was not one deal. It was knowing what fit, what to ignore, and what questions to ask before moving.',
		author: 'Philip K.',
		role: 'Strategic Account Executive',
		videoId: 'G_mrxiwEldc'
	};

	const supportingProofs = [
		{
			quote: 'Better questions and a lot more confidence.',
			author: 'Kathleen M.',
			role: 'Customer Success Executive'
		},
		{
			quote: 'The reps that finally made the process click.',
			author: 'Ian J.',
			role: 'Healthcare Professional'
		}
	];

	const testimonialVideos = [
		{
			id: 'G_mrxiwEldc',
			name: 'Philip K.',
			role: 'Account Executive',
			hook: 'Clear roadmap'
		},
		{
			id: 'EX43y_vN1Q0',
			name: 'Kathleen M.',
			role: 'Customer Success Executive',
			hook: 'More confidence'
		},
		{
			id: 'OQ0xP_YJLZY',
			name: 'Ian J.',
			role: 'Healthcare Professional',
			hook: 'The reps that made it click'
		}
	];

	const networkSignals = [
		{ title: 'Better access', body: 'Quality managers want to be where serious investors already are.' },
		{ title: 'Better signal', body: 'What gets saved, reviewed, and pursued tells you what deserves attention.' },
		{ title: 'Less noise', body: 'The goal is better decisions, not more feed activity.' }
	];

	const freeFeatures = [
		'Build your investor profile',
		'Set an income goal and your deal rules',
		'Browse live deals and fund managers',
		'Save what you want to review next'
	];

	const guidedHelpFeatures = [
		'Clarify what you are actually solving for',
		'Pressure-test your next deal or your full plan',
		'Get a second set of eyes before you wire money',
		'Decide whether deeper support makes sense'
	];

	const faqs = [
		{
			question: 'Who is this for?',
			answer: 'This is for accredited investors who want better deal flow, stronger diligence, and a clear path to passive income.'
		},
		{
			question: 'Do I need to be accredited?',
			answer: 'Most of the deals and opportunities here are built for accredited investors. If you are close, you can still learn how the process works and get clearer on what you are building toward.'
		},
		{
			question: 'What do I get for free?',
			answer: 'You can build your investor profile, set your income goal, browse deals and managers, and save what you want to review next.'
		},
		{
			question: 'What happens after I sign up?',
			answer: 'You start by building your plan. Then you can review deals that fit, save what you want to look at, and decide whether you want more help.'
		},
		{
			question: 'How is this different from other deal platforms?',
			answer: 'Most platforms help you find deals. This helps you decide what fits, what to review, and what to do next.'
		},
		{
			question: 'How do you make money?',
			answer: 'Today, investors can start free. Some people later pay for guided help. Fund managers may also pay for access or promotion. Any investment-related economics are disclosed before you invest.'
		},
		{
			question: 'Is this personal investment advice?',
			answer: 'No. It helps you learn, compare deals, and stay organized. It is not personal investment, tax, or legal advice.'
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
	<title>Build Your Path to $100K in Passive Income | Grow Your Cashflow</title>
	<meta
		name="description"
		content="Build your path to $100K in passive income with better deal flow, stronger diligence, and a clear plan before you wire money."
	>
	<meta property="og:title" content="Build Your Path to $100K in Passive Income | Grow Your Cashflow">
	<meta
		property="og:description"
		content="Find better private deals, review managers with confidence, and build a clear plan before you wire money."
	>
	<meta property="og:type" content="website">
</svelte:head>

<div class="marketing-page">
	<nav class="nav-shell">
		<div class="nav">
			<a href="/" class="nav-logo">Grow Your Cashflow</a>
			<div class="nav-links">
				<a href="#workflow" onclick={(event) => scrollToAnchor(event, '#workflow')}>How it works</a>
				<a href="#proof" onclick={(event) => scrollToAnchor(event, '#proof')}>Proof</a>
				<a href="#faq" onclick={(event) => scrollToAnchor(event, '#faq')}>FAQ</a>
				<a href="/for-operators">For fund managers</a>
			</div>
			<div class="nav-actions">
				<a href="/login" class="nav-login" data-sveltekit-reload>Log in</a>
				<a href="#signup" class="nav-cta" onclick={(event) => scrollToAnchor(event, '#signup')}>Start free</a>
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
			<a href="#proof" onclick={(event) => scrollToAnchor(event, '#proof')}>Proof</a>
			<a href="#faq" onclick={(event) => scrollToAnchor(event, '#faq')}>FAQ</a>
			<a href="/for-operators">For fund managers</a>
			<a href="/login" data-sveltekit-reload>Log in</a>
			<a href="#signup" class="nav-cta" onclick={(event) => scrollToAnchor(event, '#signup')}>Start free</a>
		</div>
	</nav>

	<section class="hero-section">
		<div class="hero-copy">
			<div class="eyebrow">For accredited investors</div>
			<h1>Build your path to <span>$100K in passive income.</span></h1>
			<p class="hero-description">
				Find better private deals, review managers with confidence, and build a clear plan
				before you wire money.
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
							placeholder="Enter your email"
							autocomplete="email"
							aria-label="Email address"
							bind:value={signupEmail}
							onkeydown={handleSignupKeydown}
						/>
						<button class="btn btn-primary hero-signup-button" type="button" onclick={handleSignupSubmit} disabled={signupLoading}>
							{signupLoading ? 'Sending...' : 'Build my plan'}
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

			<div class="hero-social-proof">Trusted by 1,000+ accredited investors</div>
		</div>

		<div class="hero-visual-wrap">
			<div class="hero-visual-label">Plan before the pitch</div>
			<VersionAShowcase />
		</div>
	</section>

	<section class="trust-rail" aria-label="Credibility">
		<div class="trust-rail-title">
			Built for {trustAudience[0]}, {trustAudience[1]}, and {trustAudience[2]}.
		</div>
		<div class="trust-rail-copy">
			The platform helps you turn scattered deal flow into a real plan and a repeatable review
			process before you wire money.
		</div>
	</section>

	<section class="section section-open">
		<div class="bridge-shell">
			<div class="section-heading section-heading--compact">
				<div class="eyebrow">What you need</div>
				<h2>You do not need more noise. You need a better process.</h2>
				<p>
					Before you invest, you need three things: a plan before a pitch, better deal flow in
					one place, and a simple way to review the manager, the structure, and the risks.
				</p>
			</div>

			<div class="bridge-grid">
				{#each bridgeItems as item}
					<article class="bridge-item">
						<div class="bridge-index">{item.number}</div>
						<div>
							<h3>{item.title}</h3>
							<p>{item.body}</p>
						</div>
					</article>
				{/each}
			</div>
		</div>
	</section>

	<section class="section" id="problems">
		<div class="problem-shell">
			<div class="section-heading section-heading--compact">
				<div class="eyebrow">If this sounds like you</div>
				<h2>You are surrounded by opportunities, but you still do not have a process you trust.</h2>
				<p>
					That is what keeps smart investors stuck. Not lack of capital. Not lack of access.
					Lack of confidence to know what fits, what is noise, and what deserves a real yes.
				</p>
			</div>

			<div class="problem-layout">
				<article class="problem-card problem-card--lead">
					<div class="problem-number">{problemCards[0].number}</div>
					<h3>{problemCards[0].title}</h3>
					<p>{problemCards[0].body}</p>
				</article>

				<div class="problem-stack">
					{#each problemCards.slice(1) as card}
						<article class="problem-card">
							<div class="problem-number">{card.number}</div>
							<h3>{card.title}</h3>
							<p>{card.body}</p>
						</article>
					{/each}
				</div>
			</div>
		</div>
	</section>

	<section class="section" id="workflow">
		<div class="section-heading">
			<div class="eyebrow">How it works</div>
			<h2>A simple system for better private deal decisions.</h2>
			<p>
				The platform helps you do three things in order so you can move with more confidence.
			</p>
		</div>

		<div class="workflow-grid">
			{#each workflowSteps as step, index}
				<article class:workflow-step--reverse={index % 2 === 1} class="workflow-step">
					<div class="workflow-copy">
						<div class="workflow-step-label">{step.eyebrow}</div>
						<h3>{step.title}</h3>
						<p>{step.body}</p>
						<ul>
							{#each step.points as point}
								<li>{point}</li>
							{/each}
						</ul>
					</div>

					<div class={`workflow-frame workflow-frame--${step.kind}`}>
						<div class="workflow-frame-bar">
							<span></span>
							<span></span>
							<span></span>
						</div>

						{#if step.kind === 'plan'}
							<div class="workflow-frame-body">
								<div class="workflow-kicker">Your plan</div>
								<div class="workflow-title">$120K / year income</div>
								<div class="workflow-chip-row">
									<span>Debt funds</span>
									<span>Storage</span>
									<span>$100K checks</span>
								</div>
								<div class="workflow-metric-stack">
									<div class="workflow-metric-row">
										<div>When</div>
										<strong>3 to 5 years</strong>
									</div>
									<div class="workflow-metric-row">
										<div>First goal</div>
										<strong>Income first</strong>
									</div>
									<div class="workflow-metric-row">
										<div>Risk</div>
										<strong>Moderate</strong>
									</div>
								</div>
							</div>
						{:else if step.kind === 'matches'}
							<div class="workflow-frame-body">
								<div class="workflow-kicker">Deals that fit</div>
								<div class="workflow-list">
									<div class="workflow-match">
										<div>
											<strong>Blue Mesa Income Fund IV</strong>
											<small>11.2% cash income</small>
										</div>
										<span>97%</span>
									</div>
									<div class="workflow-match">
										<div>
											<strong>North Harbor Storage Fund</strong>
											<small>8.5% base + 17% target return</small>
										</div>
										<span>93%</span>
									</div>
									<div class="workflow-match">
										<div>
											<strong>Summit Credit Opportunities</strong>
											<small>Private credit</small>
										</div>
										<span>91%</span>
									</div>
								</div>
							</div>
						{:else}
							<div class="workflow-frame-body">
								<div class="workflow-kicker">Manager review</div>
								<div class="workflow-review-head">
									<div>
										<div class="workflow-title workflow-title--small">North Harbor Partners</div>
										<p>Quick diligence view before you take the pitch call.</p>
									</div>
									<div class="workflow-score">93</div>
								</div>
								<div class="workflow-metric-stack">
									<div class="workflow-metric-row">
										<div>SEC filing</div>
										<strong>506(c) filed</strong>
									</div>
									<div class="workflow-metric-row">
										<div>Operator history</div>
										<strong>$420M managed</strong>
									</div>
									<div class="workflow-metric-row">
										<div>Main risk</div>
										<strong>Short track record</strong>
									</div>
								</div>
							</div>
						{/if}
					</div>
				</article>
			{/each}
		</div>
	</section>

	<section class="section">
		<div class="demo-shell">
			<div class="demo-copy">
				<div class="eyebrow">See it in action</div>
				<h2>One place for your plan, your deal flow, and your diligence.</h2>
				<p>
					Instead of keeping ideas in your inbox, notes in a spreadsheet, and questions in
					your head, you keep the whole decision in one place.
				</p>
				<div class="demo-points">
					{#each demoPoints as point}
						<div class="demo-point">
							<span class="checkmark">+</span>
							<span>{point}</span>
						</div>
					{/each}
				</div>
				<div class="hero-actions">
					<a href="#signup" class="btn btn-primary" onclick={(event) => scrollToAnchor(event, '#signup')}>Build my plan</a>
					<a href={demoVideoUrl} target="_blank" rel="noreferrer" class="btn btn-secondary">
						Watch the demo
					</a>
				</div>
			</div>

			<a href={demoVideoUrl} target="_blank" rel="noreferrer" class="demo-media">
				<img
					src="https://i.ytimg.com/vi/lvcFJcL-c6w/maxresdefault.jpg"
					alt="Watch the Grow Your Cashflow product demo"
					loading="lazy"
				>
				<div class="demo-overlay">
					<div class="play-button" aria-hidden="true">
						<svg viewBox="0 0 24 24" fill="currentColor">
							<path d="M8 5.14v13.72a1 1 0 0 0 1.53.85l10.41-6.86a1 1 0 0 0 0-1.7L9.53 4.29A1 1 0 0 0 8 5.14Z"></path>
						</svg>
					</div>
					<div>
						<strong>Watch the demo</strong>
						<span>See how the system helps you build a plan and review what matters.</span>
					</div>
				</div>
			</a>
		</div>
	</section>

	<section class="section">
		<div class="difference-shell">
			<div class="section-heading section-heading--compact">
				<div class="eyebrow">Why this feels different</div>
				<h2>Most platforms give you deals. You still need a way to decide.</h2>
				<p>
					Grow Your Cashflow helps you define what fits, review what matters, and know what to
					do next before you wire money.
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
		</div>
	</section>

	<section class="section" id="proof">
		<div class="section-heading">
			<div class="eyebrow">Proof</div>
			<h2>The goal is simple: stop guessing and start moving.</h2>
			<p>
				People do not come here for more content. They come here to get clear, ask better
				questions, and make better decisions with real capital.
			</p>
		</div>

		<div class="proof-shell">
			<a
				href={`https://www.youtube.com/watch?v=${featuredProof.videoId}`}
				target="_blank"
				rel="noreferrer"
				class="proof-featured"
			>
				<div class="proof-kicker">Featured story</div>
				<blockquote>&ldquo;{featuredProof.quote}&rdquo;</blockquote>
				<p>{featuredProof.detail}</p>
				<div class="proof-person">
					<strong>{featuredProof.author}</strong>
					<span>{featuredProof.role}</span>
				</div>
				<div class="proof-link">Watch Philip's story</div>
			</a>

			<div class="proof-support-list">
				{#each supportingProofs as item}
					<article class="proof-support-card">
						<div class="proof-support-quote">&ldquo;{item.quote}&rdquo;</div>
						<div class="proof-person">
							<strong>{item.author}</strong>
							<span>{item.role}</span>
						</div>
					</article>
				{/each}
			</div>
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
						<div class="proof-person">
							<strong>{item.name}</strong>
							<span>{item.role}</span>
						</div>
					</div>
				</a>
			{/each}
		</div>
	</section>

	<section class="section section-band" id="network">
		<div class="network-band">
			<div class="network-copy">
				<div class="eyebrow">Investor network</div>
				<h2>A better network gives you better signal.</h2>
				<p>
					As more serious investors and quality managers use the platform, you get better
					access, better signal, and less noise.
				</p>
			</div>

			<div class="network-grid">
				{#each networkSignals as item}
					<div class="network-point">
						<strong>{item.title}</strong>
						<span>{item.body}</span>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="section" id="free">
		<div class="section-heading">
			<div class="eyebrow">Start here</div>
			<h2>Start free. Get help only when you want it.</h2>
			<p>
				Most people should start with the platform. If you want a second set of eyes before you
				invest, there is a next step.
			</p>
		</div>

		<div class="path-shell">
			<article class="path-card path-card--primary">
				<div class="pricing-kicker">Free account</div>
				<h3>Build your plan. Find deals. Review managers.</h3>
				<p class="path-copy">
					Start with the product. Build your profile, review what fits, and organize the next
					moves that deserve your time.
				</p>
				<div class="feature-list">
					{#each freeFeatures as item}
						<div class="feature-item">
							<span class="checkmark">+</span>
							<span>{item}</span>
						</div>
					{/each}
				</div>
				<div class="hero-actions">
					<a href="#signup" class="btn btn-primary" onclick={(event) => scrollToAnchor(event, '#signup')}>Build my plan</a>
				</div>
			</article>

			<article class="path-card path-card--secondary">
				<div class="pricing-kicker">Deployment Gameplan Call</div>
				<h3>Want a second set of eyes before you wire money?</h3>
				<div class="feature-list feature-list--compact">
					{#each guidedHelpFeatures as item}
						<div class="feature-item">
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
				<div class="tier-note">If you want weekly help after that, we can talk about Cashflow Academy.</div>
			</article>
		</div>
	</section>

	<section class="section section-tight">
		<div class="operator-ribbon">
			<div>
				<div class="eyebrow">For fund managers</div>
				<h2>Raising capital?</h2>
				<p>
					If you run a fund or deal, use the fund-manager side to list deals, book a pitch
					spot, and get in front of serious investors.
				</p>
			</div>
			<a href="/for-operators" class="btn btn-secondary">For fund managers</a>
		</div>
	</section>

	<section class="section section-faq" id="faq">
		<div class="section-heading section-heading--compact">
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
		<div class="final-cta">
			<div class="eyebrow">Start now</div>
			<h2>Stop guessing your way through private deals.</h2>
			<p>Build your plan, find better deals, and review managers with confidence.</p>
			<div class="hero-actions hero-actions--center">
				<a href="#signup" class="btn btn-primary" onclick={(event) => scrollToAnchor(event, '#signup')}>
					Build my plan
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
		--page-surface: rgba(255, 255, 255, 0.92);
		--page-surface-strong: rgba(255, 255, 255, 0.98);
		--page-text: #101816;
		--page-muted: #59676b;
		--page-soft: #7a8a8f;
		--page-teal: #123840;
		--page-green: #5bc884;
		--page-green-deep: #2f9e60;
		--page-shadow: 0 20px 46px rgba(18, 29, 27, 0.065);
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
		transition: transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease;
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

	.btn-primary--light {
		background: white;
		color: #10231f;
		box-shadow: 0 16px 34px rgba(255, 255, 255, 0.18);
	}

	.btn-secondary--dark {
		background: rgba(255, 255, 255, 0.1);
		border-color: rgba(255, 255, 255, 0.18);
		color: white;
		box-shadow: none;
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
	.workflow-step-label,
	.comparison-kicker,
	.pricing-kicker,
	.proof-kicker {
		display: inline-flex;
		align-items: center;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 820;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		color: var(--page-teal);
	}

	.eyebrow--light {
		color: rgba(255, 255, 255, 0.78);
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
		max-width: 10.2ch;
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
		font-size: clamp(1.7rem, 2.4vw, 2.6rem);
	}

	p,
	li,
	.feature-item span,
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
		max-width: 36rem;
	}

	.demo-point,
	.feature-item {
		display: flex;
		align-items: flex-start;
		gap: 12px;
	}

	.checkmark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 24px;
		height: 24px;
		border-radius: 999px;
		background: rgba(91, 200, 132, 0.16);
		color: var(--page-green-deep);
		font-size: 13px;
		font-weight: 800;
		flex-shrink: 0;
		margin-top: 2px;
	}

	.hero-bullet {
		display: block;
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

	.section-tight {
		padding-top: 76px;
	}

	.section-band {
		padding-top: 84px;
	}

	.section-heading {
		max-width: 780px;
	}

	.section-heading--compact {
		max-width: 720px;
	}

	.section-heading p {
		margin: 18px 0 0;
		max-width: 43rem;
	}

	.section-open .section-heading p {
		max-width: 38rem;
	}

	.bridge-shell {
		display: grid;
		grid-template-columns: minmax(0, 0.88fr) minmax(0, 1.12fr);
		gap: 34px;
		align-items: start;
	}

	.bridge-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		padding-top: 16px;
	}

	.bridge-item {
		padding-top: 18px;
		border-top: 2px solid rgba(18, 56, 64, 0.12);
	}

	.bridge-index,
	.problem-number {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 820;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--page-teal);
	}

	.bridge-item h3 {
		margin-top: 16px;
		font-size: clamp(1.35rem, 1.8vw, 1.8rem);
		line-height: 1.02;
	}

	.bridge-item p {
		margin: 14px 0 0;
		font-size: 16px;
	}

	.problem-shell {
		display: grid;
		gap: 32px;
	}

	.problem-layout {
		display: grid;
		grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
		gap: 18px;
	}

	.problem-stack {
		display: grid;
		gap: 18px;
	}

	.problem-card,
	.comparison-panel,
	.path-card {
		border: 1px solid rgba(214, 222, 216, 0.96);
		border-radius: 24px;
		background: var(--page-surface);
		box-shadow: var(--page-shadow);
	}

	.problem-card {
		padding: 28px;
	}

	.problem-card--lead {
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.11), transparent 42%),
			var(--page-surface-strong);
	}

	.problem-card h3 {
		margin-top: 16px;
		font-size: clamp(2rem, 2.7vw, 3rem);
		line-height: 0.98;
	}

	.problem-card p {
		margin: 16px 0 0;
		color: #324146;
	}

	.workflow-grid {
		display: grid;
		gap: 24px;
		margin-top: 34px;
	}

	.workflow-step {
		display: grid;
		grid-template-columns: minmax(0, 0.92fr) minmax(0, 1.08fr);
		gap: 24px;
		align-items: center;
	}

	.workflow-step--reverse .workflow-copy {
		order: 2;
	}

	.workflow-step--reverse .workflow-frame {
		order: 1;
	}

	.workflow-copy {
		padding: 12px 8px 12px 0;
	}

	.workflow-copy h3 {
		margin-top: 16px;
	}

	.workflow-copy p {
		margin: 16px 0 0;
		max-width: 34rem;
	}

	.workflow-copy ul {
		display: grid;
		gap: 10px;
		margin: 22px 0 0;
		padding-left: 18px;
	}

	.workflow-copy li {
		color: #2d3d41;
	}

	.workflow-frame {
		border-radius: 28px;
		overflow: hidden;
		border: 1px solid rgba(214, 222, 216, 0.96);
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.12), transparent 34%),
			linear-gradient(155deg, #eef5f1 0%, #f7f6f1 100%);
		box-shadow: 0 24px 54px rgba(15, 33, 37, 0.08);
	}

	.workflow-frame-bar {
		display: flex;
		gap: 6px;
		padding: 14px 16px;
		background: rgba(241, 242, 236, 0.95);
		border-bottom: 1px solid rgba(17, 31, 28, 0.08);
	}

	.workflow-frame-bar span,
	.play-button,
	.proof-video-play {
		flex-shrink: 0;
	}

	.workflow-frame-bar span {
		width: 10px;
		height: 10px;
		border-radius: 999px;
	}

	.workflow-frame-bar span:nth-child(1) {
		background: #ff5f57;
	}

	.workflow-frame-bar span:nth-child(2) {
		background: #ffbd2e;
	}

	.workflow-frame-bar span:nth-child(3) {
		background: #28ca41;
	}

	.workflow-frame-body {
		padding: 20px;
		background: rgba(255, 255, 255, 0.92);
	}

	.workflow-kicker {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 820;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--page-soft);
	}

	.workflow-title {
		margin-top: 12px;
		font-family: var(--font-ui);
		font-size: 28px;
		font-weight: 820;
		line-height: 1;
		letter-spacing: -0.04em;
		color: var(--page-text);
	}

	.workflow-title--small {
		font-size: 22px;
	}

	.workflow-chip-row {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
		margin-top: 16px;
	}

	.workflow-chip-row span {
		padding: 8px 12px;
		border-radius: 999px;
		background: rgba(18, 56, 64, 0.08);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 760;
		color: var(--page-teal);
	}

	.workflow-metric-stack,
	.workflow-list,
	.demo-points,
	.feature-list,
	.faq-list {
		display: grid;
		gap: 12px;
	}

	.workflow-metric-stack,
	.workflow-list {
		margin-top: 18px;
	}

	.workflow-metric-row,
	.workflow-match {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		padding: 14px;
		border-radius: 18px;
		border: 1px solid rgba(18, 34, 38, 0.08);
		background: white;
	}

	.workflow-metric-row div,
	.workflow-match small {
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--page-muted);
	}

	.workflow-metric-row strong,
	.workflow-match strong {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--page-text);
	}

	.workflow-match span,
	.workflow-score {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 54px;
		padding: 8px 10px;
		border-radius: 999px;
		background: rgba(91, 200, 132, 0.16);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		color: var(--page-green-deep);
	}

	.workflow-review-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14px;
		margin-top: 12px;
	}

	.workflow-review-head p {
		margin: 10px 0 0;
		font-family: var(--font-ui);
		font-size: 14px;
		line-height: 1.5;
		color: var(--page-muted);
	}

	.workflow-score {
		min-width: 52px;
		height: 52px;
		border-radius: 18px;
		font-size: 17px;
	}

	.demo-shell {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		gap: 28px;
		align-items: center;
		padding: 30px;
		border: 1px solid rgba(214, 222, 216, 0.96);
		border-radius: 32px;
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.08), transparent 35%),
			linear-gradient(145deg, rgba(255, 255, 255, 0.97), rgba(255, 255, 255, 0.9));
		box-shadow: var(--page-shadow);
	}

	.demo-copy p {
		margin: 18px 0 0;
		max-width: 34rem;
	}

	.demo-points {
		margin-top: 22px;
	}

	.demo-media {
		position: relative;
		display: block;
		overflow: hidden;
		border-radius: 28px;
		background: linear-gradient(145deg, #0f2429, #163a42);
		text-decoration: none;
		box-shadow: 0 30px 72px rgba(18, 29, 27, 0.15);
	}

	.demo-media img {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 10;
		object-fit: cover;
		object-position: center 38%;
	}

	.demo-overlay {
		position: absolute;
		left: 0;
		right: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		gap: 16px;
		padding: 22px;
		background: linear-gradient(180deg, rgba(11, 26, 29, 0), rgba(11, 26, 29, 0.92));
	}

	.demo-overlay strong,
	.demo-overlay span {
		display: block;
		font-family: var(--font-ui);
		color: white;
	}

	.demo-overlay strong {
		font-size: 16px;
		font-weight: 800;
	}

	.demo-overlay span {
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
		box-shadow: 0 16px 30px rgba(0, 0, 0, 0.18);
	}

	.play-button svg,
	.proof-video-play svg {
		width: 22px;
		height: 22px;
	}

	.difference-shell {
		display: grid;
		grid-template-columns: minmax(0, 0.86fr) minmax(0, 1.14fr);
		gap: 28px;
		align-items: start;
	}

	.comparison-board {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px;
	}

	.comparison-panel {
		padding: 28px;
	}

	.comparison-panel--accent {
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.12), transparent 42%),
			var(--page-surface-strong);
		border-color: rgba(91, 200, 132, 0.24);
	}

	.comparison-panel h3 {
		margin-top: 16px;
		font-size: clamp(1.75rem, 2vw, 2.4rem);
	}

	.comparison-list {
		display: grid;
		gap: 12px;
		margin: 20px 0 0;
		padding-left: 18px;
	}

	.comparison-list li {
		color: #304045;
	}

	.proof-shell {
		display: grid;
		grid-template-columns: minmax(0, 1.05fr) minmax(0, 0.95fr);
		gap: 18px;
		margin-top: 34px;
	}

	.proof-featured {
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		padding: 30px;
		border-radius: 30px;
		border: 1px solid rgba(214, 222, 216, 0.96);
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.14), transparent 36%),
			linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 250, 247, 0.98) 100%);
		color: var(--page-text);
		text-decoration: none;
		box-shadow: var(--page-shadow);
		min-height: 320px;
	}

	.proof-featured blockquote {
		margin: 20px 0 0;
		font-family: var(--font-ui);
		font-size: clamp(2.1rem, 2.8vw, 3.1rem);
		font-weight: 760;
		line-height: 1.02;
		letter-spacing: -0.045em;
	}

	.proof-featured p {
		margin: 20px 0 0;
		max-width: 32rem;
		color: #435359;
	}

	.proof-person {
		display: grid;
		gap: 4px;
	}

	.proof-person strong,
	.network-point strong {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 820;
	}

	.proof-person span,
	.network-point span {
		font-family: var(--font-ui);
		font-size: 13px;
		line-height: 1.55;
	}

	.proof-featured .proof-person {
		margin-top: 28px;
	}

	.proof-featured .proof-person strong,
	.proof-featured .proof-link {
		color: var(--page-text);
	}

	.proof-featured .proof-person span {
		color: var(--page-green-deep);
	}

	.proof-link {
		margin-top: 22px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 820;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--page-teal);
	}

	.proof-support-list {
		display: grid;
		gap: 18px;
	}

	.proof-support-card {
		padding: 24px 26px;
		border-radius: 26px;
		border: 1px solid rgba(214, 222, 216, 0.96);
		background: var(--page-surface);
		box-shadow: var(--page-shadow);
	}

	.proof-support-quote {
		font-family: var(--font-ui);
		font-size: clamp(1.4rem, 1.8vw, 2rem);
		font-weight: 760;
		line-height: 1.15;
		letter-spacing: -0.035em;
		color: var(--page-text);
	}

	.proof-support-card .proof-person {
		margin-top: 20px;
	}

	.proof-support-card .proof-person span {
		color: var(--page-green-deep);
	}

	.proof-video-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 18px;
		margin-top: 20px;
	}

	.proof-video-card {
		overflow: hidden;
		border-radius: 26px;
		border: 1px solid rgba(214, 222, 216, 0.96);
		background: var(--page-surface);
		box-shadow: var(--page-shadow);
		text-decoration: none;
	}

	.proof-video-thumb {
		position: relative;
		aspect-ratio: 16 / 11;
		background: #102a2f;
	}

	.proof-video-thumb img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
		object-position: center 38%;
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
		font-weight: 820;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--page-teal);
	}

	.proof-video-meta .proof-person {
		margin-top: 12px;
	}

	.proof-video-meta .proof-person strong {
		color: var(--page-text);
	}

	.proof-video-meta .proof-person span {
		color: var(--page-green-deep);
	}

	.network-band {
		display: grid;
		grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		gap: 24px;
		align-items: center;
		padding: 32px;
		border-radius: 30px;
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.16), transparent 34%),
			linear-gradient(160deg, rgba(240, 248, 244, 0.98) 0%, rgba(250, 249, 243, 0.98) 100%);
		border: 1px solid rgba(214, 222, 216, 0.96);
		box-shadow: var(--page-shadow);
	}

	.network-copy p {
		margin: 18px 0 0;
		max-width: 34rem;
		color: #425156;
	}

	.network-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 14px;
	}

	.network-point {
		padding: 18px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.84);
		border: 1px solid rgba(17, 31, 28, 0.08);
	}

	.network-point strong {
		display: block;
		color: var(--page-text);
	}

	.network-point span {
		display: block;
		margin-top: 8px;
		color: #526267;
	}

	.path-shell {
		display: grid;
		grid-template-columns: minmax(0, 1.12fr) minmax(0, 0.88fr);
		gap: 18px;
		margin-top: 34px;
	}

	.path-card {
		padding: 30px;
	}

	.path-card--primary {
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.12), transparent 42%),
			var(--page-surface-strong);
	}

	.path-card h3 {
		margin-top: 16px;
	}

	.path-copy {
		margin: 16px 0 0;
		max-width: 34rem;
	}

	.feature-list {
		margin-top: 22px;
	}

	.feature-list--compact {
		gap: 10px;
	}

	.tier-note {
		margin-top: 18px;
		padding-top: 16px;
		border-top: 1px solid rgba(17, 31, 28, 0.08);
		font-family: var(--font-ui);
		font-size: 13px;
		line-height: 1.6;
		color: var(--page-muted);
	}

	.operator-ribbon {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 22px;
		padding: 24px 28px;
		border-radius: 26px;
		border: 1px solid rgba(214, 222, 216, 0.96);
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.12), transparent 32%),
			linear-gradient(145deg, rgba(255, 255, 255, 0.96), rgba(245, 249, 246, 0.94));
		box-shadow: var(--page-shadow);
	}

	.operator-ribbon p {
		max-width: 40rem;
		margin: 16px 0 0;
		color: #425156;
	}

	.section-faq {
		padding-bottom: 90px;
	}

	.faq-list {
		margin-top: 30px;
		border-top: 1px solid rgba(211, 219, 214, 0.92);
	}

	.faq-item {
		padding: 20px 0;
		border-bottom: 1px solid rgba(211, 219, 214, 0.92);
	}

	.faq-item summary {
		cursor: pointer;
		list-style: none;
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		letter-spacing: -0.02em;
		color: var(--page-text);
	}

	.faq-item summary::-webkit-details-marker {
		display: none;
	}

	.faq-item p {
		max-width: 48rem;
		margin: 14px 0 0;
		font-size: 16px;
	}

	.section-cta {
		padding-top: 0;
		padding-bottom: 68px;
	}

	.final-cta {
		padding: 44px 30px;
		border-radius: 32px;
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.16), transparent 34%),
			linear-gradient(160deg, rgba(255, 255, 255, 0.98) 0%, rgba(244, 249, 246, 0.98) 100%);
		border: 1px solid rgba(214, 222, 216, 0.96);
		box-shadow: var(--page-shadow);
		text-align: center;
	}

	.final-cta h2 {
		margin-inline: auto;
		max-width: 10ch;
	}

	.final-cta p {
		max-width: 40rem;
		margin: 18px auto 0;
		color: #48575c;
	}

	@media (max-width: 1120px) {
		.hero-section,
		.bridge-shell,
		.difference-shell,
		.demo-shell,
		.path-shell,
		.network-band,
		.workflow-step {
			grid-template-columns: 1fr;
		}

		.hero-section {
			gap: 34px;
		}

		.workflow-step--reverse .workflow-copy,
		.workflow-step--reverse .workflow-frame {
			order: initial;
		}

		.problem-layout,
		.proof-shell {
			grid-template-columns: 1fr;
		}

		.bridge-grid,
		.network-grid,
		.comparison-board,
		.proof-video-grid {
			grid-template-columns: 1fr;
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

		.section-band,
		.section-tight {
			padding-top: 70px;
		}

		.trust-rail {
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.path-shell,
		.problem-layout {
			gap: 16px;
		}

		.operator-ribbon {
			flex-direction: column;
			align-items: flex-start;
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

		h3 {
			font-size: clamp(1.65rem, 8vw, 2.3rem);
		}

		p,
		li,
		.hero-description,
		.hero-bullet,
		.feature-item span {
			font-size: 16px;
		}

		.hero-signup-row {
			grid-template-columns: 1fr;
		}

		.hero-signup-button {
			width: 100%;
			min-width: 0;
		}

		.bridge-item h3 {
			font-size: 1.45rem;
		}

		.problem-card,
		.path-card,
		.comparison-panel {
			padding: 24px;
		}

		.demo-shell,
		.network-band,
		.final-cta {
			padding: 24px;
		}

		.demo-overlay {
			align-items: flex-start;
		}

		.proof-featured {
			padding: 24px;
			min-height: auto;
		}

		.proof-featured blockquote {
			font-size: clamp(1.8rem, 9vw, 2.6rem);
		}
	}
</style>
