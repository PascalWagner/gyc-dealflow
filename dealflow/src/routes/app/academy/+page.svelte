<script>
	let activeTab = $state(0);
	let openFaq = $state(-1);
	let showMore = $state(false);

	function toggleFaq(i) { openFaq = openFaq === i ? -1 : i; }

	const tabs = ['Deal Intelligence', 'Tools & DD', 'GP Access', 'Pascal & Community'];

	const faqs = [
		{ q: 'How much time does this take per week?', a: 'Most members spend 2-3 hours per week. Office hours are one hour on Thursdays. The rest is reviewing deals at your own pace using the platform.' },
		{ q: 'Do I need to be an accredited investor?', a: 'The platform is open to everyone, but most of the deals listed require accredited investor status to invest. Academy helps you build the skills regardless.' },
		{ q: 'What if I\'ve never invested in alternatives before?', a: 'That\'s exactly who this is for. The 90-day framework starts from zero and builds up. Many members make their first investment within 60 days.' },
		{ q: 'Can I cancel anytime?', a: 'Yes. There\'s no long-term contract. If you\'re not getting value, you can cancel. But most members stay because the deal flow and community are ongoing.' },
		{ q: 'How is this different from a course?', a: 'Courses give you theory. Academy gives you reps. You\'re evaluating real deals, talking to real operators, and making real decisions — with Pascal and the community as your backstop.' },
		{ q: 'What\'s the Deployment Gameplan Call?', a: 'A free 30-minute call where Pascal reviews your current situation, goals, and portfolio. You\'ll leave with a clear 90-day action plan whether or not you join Academy.' }
	];
</script>

<svelte:head><title>Cashflow Academy | GYC</title></svelte:head>

<div class="academy-page">
	<!-- HERO -->
	<div class="hero">
		<div class="hero-badge">Cashflow Academy</div>
		<h1>Build A Cashflowing Portfolio In 12 Months &mdash; Without Becoming A Full&#8209;Time Underwriter</h1>
		<p class="hero-sub">A 12&#8209;month, hands&#8209;on program for accredited investors deploying <strong>$50K&ndash;$1M+</strong> into private alternative investments using a proven three&#8209;step process.</p>
		<div class="hero-stats">
			<div class="hero-stat"><div class="val">90</div><div class="lbl">Day Deployment<br>Framework</div></div>
			<div class="hero-stat"><div class="val">1:1</div><div class="lbl">Deal Reviews<br>With Pascal</div></div>
			<div class="hero-stat"><div class="val">Weekly</div><div class="lbl">Live Office Hours<br>&amp; Q&A</div></div>
		</div>
		<div class="hero-cta">
			<a href="https://growyourcashflow.io/introcall" target="_blank" class="btn-cta">Book Your Deployment Gameplan Call &rarr;</a>
		</div>
		<div class="hero-note">Spots are limited and filled on a first&#8209;come, first&#8209;served basis.</div>
	</div>

	<!-- VIDEO -->
	<div class="video-wrap">
		<div class="video-ratio"><iframe src="https://www.youtube.com/embed/lvcFJcL-c6w" allowfullscreen loading="lazy" title="Academy intro"></iframe></div>
	</div>

	<!-- TRUSTED BY -->
	<div class="trusted">
		<div class="trusted-label">Trusted By Executives Of</div>
		<div class="trusted-logos">
			<span>Lufthansa</span><span class="dot">&bull;</span>
			<span>Techstars</span><span class="dot">&bull;</span>
			<span>Deloitte</span><span class="dot">&bull;</span>
			<span>General Motors</span>
		</div>
	</div>

	<!-- PROBLEM -->
	<div class="card">
		<div class="card-title">You're surrounded by opportunities, but:</div>
		<div class="pain-list">
			<div class="pain"><span class="pain-x">&times;</span><span><strong>No real plan</strong> &mdash; just scattered decks, podcasts, and pitch calls</span></div>
			<div class="pain"><span class="pain-x">&times;</span><span><strong>No clear Buy Box</strong> &mdash; no simple way to say &ldquo;this fits&rdquo; vs &ldquo;this is noise&rdquo;</span></div>
			<div class="pain"><span class="pain-x">&times;</span><span><strong>No reps with one checklist</strong> &mdash; so every $50K decision feels like a brand&#8209;new leap of faith</span></div>
		</div>
		<div class="card-footer">The #1 reason most people never build passive income isn't lack of capital or opportunity. It's lack of <strong>confidence</strong> &mdash; to commit to the right investments, and walk away from the wrong ones.</div>
	</div>

	<!-- BEFORE / AFTER -->
	<div class="compare-grid">
		<div class="compare-card without">
			<div class="compare-label red">Without Academy</div>
			<div class="compare-items">
				{#each ['Cash flow projections locked', 'Risk analysis blurred', 'No GP introductions', 'No peer comparisons', 'Guessing on every wire'] as item}
					<div class="compare-item"><svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" width="14" height="14"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>{item}</div>
				{/each}
			</div>
		</div>
		<div class="compare-card with">
			<div class="compare-label green">With Academy</div>
			<div class="compare-items">
				{#each ['Full cash flow & return projections', 'Complete risk analysis on every deal', 'Direct GP intros & data room access', 'Peer benchmarks vs 400+ deals', 'Confident invest&#8209;or&#8209;pass decisions'] as item}
					<div class="compare-item"><svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>{@html item}</div>
				{/each}
			</div>
		</div>
	</div>

	<!-- WHAT YOU'LL LEARN -->
	<div class="section">
		<h2>In Cashflow Academy, You'll Learn How To&hellip;</h2>
		<div class="learn-list">
			{#each [
				{ title: 'Find and evaluate operators you can actually trust', desc: 'Stop relying on gut feelings, referrals, or how good their webinar felt.' },
				{ title: 'Use a simple checklist to break down any private deal in minutes, not days', desc: 'Whether it\'s a fund or a syndication, you\'ll know exactly what to look at first.' },
				{ title: 'Design an allocation that matches your goals: income, growth, and tax efficiency', desc: 'So every deal you say "yes" to has a clear job in your portfolio.' }
			] as item}
				<div class="learn-item"><svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg><div><div class="learn-title">{item.title}</div><div class="learn-desc">{item.desc}</div></div></div>
			{/each}
			{#if showMore}
				{#each [
					{ title: 'Decide how much capital you really need to hit your numbers', desc: 'E.g. $10K-$30K+/month in passive income or a specific tax reduction target.' },
					{ title: 'Compare funds and syndications apples-to-apples', desc: 'Quickly see which ones fit your Buy Box and which ones are a hard no.' },
					{ title: 'Understand what "normal" fees, terms, and structures look like', desc: 'And when those details quietly tilt the deal against you.' },
					{ title: 'Build a decision process you actually trust', desc: 'So you\'re not second-guessing every wire or stuck in analysis paralysis for months.' }
				] as item}
					<div class="learn-item"><svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2.5" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg><div><div class="learn-title">{item.title}</div><div class="learn-desc">{item.desc}</div></div></div>
				{/each}
			{/if}
		</div>
		{#if !showMore}
			<button class="show-more" onclick={() => showMore = true}>+ Show 4 more skills you'll build</button>
		{/if}
	</div>

	<!-- WHAT YOU UNLOCK (TABBED) -->
	<div class="section">
		<h2>What You Unlock on the Platform</h2>
		<p class="section-sub">Click each tab to explore.</p>
		<div class="tab-bar">
			{#each tabs as tab, i}
				<button class="tab-btn" class:active={activeTab === i} onclick={() => activeTab = i}>{tab}</button>
			{/each}
		</div>
		<div class="tab-panel">
			{#if activeTab === 0}
				<div class="tab-grid">
					<div><div class="tab-title">See the full picture on every deal</div><div class="tab-desc">You've seen the blurred sections. Here's what unlocks:</div>
						{#each ['Year-by-year cash flow projections', 'Risk analysis with detailed explanations', 'Peer comparisons vs 400+ deals', 'Fee benchmarks & stress test calculator'] as f}
							<div class="check-item"><svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>{f}</div>
						{/each}
					</div>
					<div class="tab-preview"><div class="tab-preview-label">Example: Projected LP Cash Flow</div>
						<div class="mini-chart">{#each [24,36,52,72,100] as h, i}<div class="bar-col"><div class="bar" style="height:{h}px"></div><div class="bar-label">Yr {i+1}</div></div>{/each}</div>
						<div class="chart-footer"><span>$100K invested</span><span class="green">$162K total return</span></div>
					</div>
				</div>
			{:else if activeTab === 1}
				<div class="tab-grid"><div><div class="tab-title">Stop guessing. Start checking.</div>
					{#each ['70+ question DD checklists per deal type', 'Buy Box Builder to filter deals fast', 'Market intel & SEC filing trends', 'Operator background reports (SEC, FINRA, courts)', 'Investment plan & allocation worksheet'] as f}
						<div class="check-item"><svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>{f}</div>
					{/each}
				</div></div>
			{:else if activeTab === 2}
				<div class="gp-grid">
					{#each [
						{ icon: 'M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2', title: 'GP Introductions', desc: 'Direct warm intros to operators. Skip months of cold outreach.' },
						{ icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z', title: 'PPM & Data Room', desc: 'Full offering docs, subscription agreements, and data room access.' },
						{ icon: 'M12 2v20M2 4h8v16H2V4zM14 4h8v16h-8V4z', title: 'Deal Comparison', desc: 'Compare deals side by side with buy box scoring.' }
					] as item}
						<div class="gp-card"><svg viewBox="0 0 24 24" fill="none" stroke="var(--primary)" stroke-width="2" width="28" height="28"><path d={item.icon}/></svg><div class="gp-title">{item.title}</div><div class="gp-desc">{item.desc}</div></div>
					{/each}
				</div>
			{:else}
				<div class="tab-grid"><div><div class="tab-title">You're not doing this alone</div>
					{#each ['Weekly office hours every Thursday', "Submit any deal for Pascal's review", '90-day deployment plan with milestones', 'Private community of accredited investors', '1:1 Gameplan Call to map your 12 months'] as f}
						<div class="check-item"><svg viewBox="0 0 24 24" fill="none" stroke="#51BE7B" stroke-width="2.5" width="14" height="14"><polyline points="20 6 9 17 4 12"/></svg>{f}</div>
					{/each}
				</div>
				<div class="tab-preview" style="text-align:center"><div class="tab-preview-label">Office Hours</div><div class="oh-time">Every Thursday 12&ndash;1pm ET</div><div class="oh-desc">Live deal reviews, hot seats, Q&A</div></div>
				</div>
			{/if}
		</div>
	</div>

	<!-- TOOLS -->
	<div class="section">
		<h2>Plus, the Tools to Execute</h2>
		<div class="tools-grid">
			{#each [
				{ title: 'Buy Box Builder', desc: 'Define what\'s in, what\'s out, and what\'s "maybe" — so you filter deals fast.' },
				{ title: 'Deal Research Checklist', desc: 'Run key questions through a structured checklist to vet operators and financials.' },
				{ title: 'Asset Allocation Worksheet', desc: 'See where your money is and how to rebalance across income, growth, and tax buckets.' },
				{ title: '800+ Deal Database', desc: 'Browse real opportunities, compare side-by-side, and apply your Buy Box in real time.' }
			] as tool}
				<div class="tool-card"><div class="tool-title">{tool.title}</div><div class="tool-desc">{tool.desc}</div></div>
			{/each}
		</div>
	</div>

	<!-- BONUSES -->
	<div class="bonus-grid">
		<div class="bonus-card"><div class="bonus-label">Bonus #1</div><div class="bonus-title">1:1 Deal Evaluation Session</div><div class="bonus-desc">A 90&#8209;minute session where Pascal walks through a deal you're considering. Good for up to 12 months after you join.</div></div>
		<div class="bonus-card"><div class="bonus-label">Bonus #2</div><div class="bonus-title">Ultimate Tax Prep Checklist</div><div class="bonus-desc">Organize and manage your K&#8209;1s, distributions, and entity docs so tax season is painless.</div></div>
	</div>

	<!-- 90-DAY MILESTONES -->
	<div class="section">
		<h2>Your First 90 Days</h2>
		<p class="section-sub">Your first 90 days are about getting real reps, not binging theory.</p>
		<div class="timeline">
			{#each [
				{ title: 'Get Oriented & Set Targets', desc: 'Clarify where you are now vs. where you want to be.', outcome: 'You know exactly where you\'re starting from.' },
				{ title: 'Build Your Buy Box', desc: 'Decide what\'s in, what\'s out, and what\'s "maybe."', outcome: 'A written framework to quickly eliminate bad fits.' },
				{ title: 'Compare Real Deals', desc: 'Compare investments against your Buy Box. Spot hype vs. real returns.', outcome: 'You know how to break down a deal and spot red flags.' },
				{ title: 'Run a Deal End-to-End', desc: 'Pick a live deal. Use the checklist. Vet the operator. Make a clear decision.', outcome: 'At least one real deal taken to a clear decision.' },
				{ title: 'Turn It Into a Habit', desc: 'This becomes how you invest: a simple, repeatable process.', outcome: 'A repeatable habit supported by a room of serious LPs.' }
			] as step, i}
				<div class="timeline-step">
					<div class="timeline-num">{i + 1}</div>
					<div><div class="timeline-title">{step.title}</div><div class="timeline-desc">{step.desc}</div><div class="timeline-outcome">Outcome: {step.outcome}</div></div>
				</div>
			{/each}
			<div class="timeline-line"></div>
		</div>
	</div>

	<!-- PASCAL'S STORY -->
	<div class="card pascal-card">
		<div class="pascal-grid">
			<div><img src="https://images.leadconnectorhq.com/image/f_webp/q_80/r_1200/u_https://assets.cdn.filesafe.space/iSHPUTCApON4k5MPXH7Q/media/67f4c0470a6217f578d00a28.png" alt="Pascal Wagner" class="pascal-img" /></div>
			<div><div class="pascal-name">Hi, I'm Pascal Wagner.</div><div class="pascal-bio">In 2021, my dad passed away, leaving my mom an inheritance but no source of consistent income. Over six months, I spent $50,000+ attending masterminds and investor dinners to find investments that provided monthly cashflow. She's currently receiving $10,000+ in 100% passive income each month.<br><br>Once I felt confident, I moved the majority of my net worth into passive investments as well &mdash; earning over $250,000 a year in passive income. Today, I help other accredited investors do the same thing, but with far less confusion and trial&#8209;and&#8209;error.</div></div>
		</div>
	</div>

	<!-- WHO IT'S FOR -->
	<div class="section">
		<h2>Who Cashflow Academy Is For</h2>
		<div class="who-grid">
			{#each [
				{ emoji: '&#128188;', title: 'Busy W&#8209;2 Professionals', desc: 'The paycheck is good but you want to build wealth without being chained to a desk forever.' },
				{ emoji: '&#127968;', title: 'Active Investors Ready to Go Passive', desc: 'You got into real estate for freedom but ended up managing tenants. Ready to shift.' },
				{ emoji: '&#128640;', title: 'Post&#8209;Liquidity Event', desc: "You've exited a business or had a big bonus. You don't want to park money in index funds." }
			] as item}
				<div class="who-card"><div class="who-emoji">{@html item.emoji}</div><div class="who-title">{@html item.title}</div><div class="who-desc">{@html item.desc}</div></div>
			{/each}
		</div>
	</div>

	<!-- SOCIAL PROOF -->
	<div class="section">
		<h2>25+ Success Stories &amp; Counting</h2>
		<p class="section-sub">Busy professionals and founders who finally pulled the trigger.</p>
		<div class="video-grid">
			{#each [
				{ id: 'G_mrxiwEldc', name: 'Philip K.', role: 'Account Executive' },
				{ id: 'EX43y_vN1Q0', name: 'Kathleen M.', role: 'CS Executive' },
				{ id: 'OQ0xP_YJLZY', name: 'Ian J.', role: 'Healthcare Professional' }
			] as v}
				<div class="testimonial-video"><div class="video-ratio"><iframe src="https://www.youtube.com/embed/{v.id}?rel=0&modestbranding=1" allowfullscreen loading="lazy" title={v.name}></iframe></div><div class="video-name">{v.name} <span>&mdash; {v.role}</span></div></div>
			{/each}
		</div>
		<div class="quotes-grid">
			{#each [
				{ q: 'I went from second-guessing every deck to knowing exactly what to look for — and when to walk away.', a: 'Kathleen M. — Customer Success Executive' },
				{ q: 'This was exactly what I needed. I\'d been in knowledge-building mode for too long without taking action.', a: 'Laura M. — Client Director' },
				{ q: 'You make complex topics digestible and practical. I\'ve watched 25+ of your videos.', a: 'Tod S. — Chief Revenue Officer' },
				{ q: 'At 27, I finally feel like I\'m building the right foundation — not just chasing deals.', a: 'Jon W. — CEO & Founder' }
			] as t}
				<div class="quote-card"><div class="quote-text">&ldquo;{t.q}&rdquo;</div><div class="quote-author">{t.a}</div></div>
			{/each}
		</div>
	</div>

	<!-- MID CTA -->
	<div class="mid-cta">
		<div class="mid-cta-text">Seen enough to know this is the room you want to be in?</div>
		<a href="https://growyourcashflow.io/introcall" target="_blank" class="btn-cta">Book Your Deployment Gameplan Call &rarr;</a>
	</div>

	<!-- FAQ -->
	<div class="section">
		<h2>Frequently Asked Questions</h2>
		<div class="faq-list">
			{#each faqs as faq, i}
				<button class="faq-item" class:open={openFaq === i} onclick={() => toggleFaq(i)}>
					<div class="faq-q"><span>{faq.q}</span><span class="faq-arrow">{openFaq === i ? '−' : '+'}</span></div>
					{#if openFaq === i}<div class="faq-a">{faq.a}</div>{/if}
				</button>
			{/each}
		</div>
	</div>

	<!-- FINAL CTA -->
	<div class="final-cta">
		<h2>Ready to Build Your Cashflowing Portfolio?</h2>
		<p>Book a free Deployment Gameplan Call. You'll leave with a clear 90-day action plan whether or not you join Academy.</p>
		<a href="https://growyourcashflow.io/introcall" target="_blank" class="btn-cta">Book Your Call &rarr;</a>
	</div>

	<div class="disclaimer">This material is for informational purposes only and does not constitute an offer to sell or solicitation to buy securities.</div>
</div>

<style>
	.academy-page { max-width: 960px; padding: 0 24px 60px; }

	/* Hero */
	.hero { background: linear-gradient(135deg, #0A1E21 0%, #1a3a42 50%, #0d2e35 100%); border-radius: 16px; padding: 48px 40px; text-align: center; color: #fff; margin-bottom: 24px; }
	.hero-badge { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #51BE7B; margin-bottom: 12px; }
	.hero h1 { font-family: var(--font-headline); font-size: 32px; line-height: 1.2; margin: 0 0 16px; }
	.hero-sub { font-family: var(--font-body); font-size: 15px; color: rgba(255,255,255,0.7); max-width: 600px; margin: 0 auto 24px; line-height: 1.7; }
	.hero-stats { display: flex; justify-content: center; gap: 40px; margin-bottom: 24px; }
	.hero-stat { text-align: center; }
	.hero-stat .val { font-family: var(--font-headline); font-size: 36px; color: #51BE7B; }
	.hero-stat .lbl { font-family: var(--font-ui); font-size: 11px; font-weight: 600; color: rgba(255,255,255,0.5); margin-top: 4px; line-height: 1.4; }
	.hero-cta { margin-bottom: 10px; }
	.btn-cta { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-ui); font-size: 14px; font-weight: 700; padding: 14px 32px; border-radius: 28px; background: #51BE7B; color: #fff; text-decoration: none; transition: all 0.15s; }
	.btn-cta:hover { background: #45A86C; transform: translateY(-1px); }
	.hero-note { font-family: var(--font-ui); font-size: 11px; color: rgba(255,255,255,0.35); }

	/* Video */
	.video-wrap { border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); margin-bottom: 20px; }
	.video-ratio { position: relative; padding-bottom: 56.25%; height: 0; }
	.video-ratio iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: none; }

	/* Trusted */
	.trusted { text-align: center; padding: 12px 0; margin-bottom: 20px; }
	.trusted-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.8px; color: var(--text-muted); margin-bottom: 10px; }
	.trusted-logos { display: flex; align-items: center; justify-content: center; gap: 24px; flex-wrap: wrap; font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-muted); }
	.dot { opacity: 0.3; }

	/* Cards */
	.card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 12px; padding: 28px 32px; margin-bottom: 24px; }
	.card-title { font-family: var(--font-ui); font-size: 15px; font-weight: 700; color: var(--text-dark); margin-bottom: 8px; }
	.pain-list { display: grid; gap: 10px; }
	.pain { display: flex; gap: 10px; align-items: flex-start; font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); line-height: 1.7; }
	.pain-x { color: #f59e0b; font-weight: 700; flex-shrink: 0; }
	.card-footer { margin-top: 16px; padding-top: 14px; border-top: 1px solid var(--border-light); font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); line-height: 1.7; }

	/* Compare */
	.compare-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 24px; }
	.compare-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 12px; padding: 20px; text-align: center; }
	.compare-card.with { border: 2px solid var(--primary); }
	.compare-label { font-family: var(--font-ui); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 12px; }
	.compare-label.red { color: #ef4444; }
	.compare-label.green { color: var(--primary); }
	.compare-items { background: var(--bg-cream); border-radius: 8px; padding: 16px; text-align: left; display: grid; gap: 8px; }
	.compare-item { display: flex; align-items: center; gap: 8px; font-family: var(--font-ui); font-size: 12px; color: var(--text-dark); }
	.without .compare-item { color: var(--text-muted); }

	/* Sections */
	.section { margin-bottom: 32px; }
	.section h2 { font-family: var(--font-headline); font-size: 22px; color: var(--text-dark); margin: 0 0 16px; }
	.section-sub { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); margin: -12px 0 16px; }

	/* Learn */
	.learn-list { display: grid; gap: 12px; }
	.learn-item { display: flex; gap: 14px; align-items: flex-start; background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 16px 20px; }
	.learn-item svg { flex-shrink: 0; margin-top: 2px; }
	.learn-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.learn-desc { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
	.show-more { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; width: 100%; padding: 16px; margin-top: 8px; font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--primary); cursor: pointer; }

	/* Tabs */
	.tab-bar { display: flex; gap: 6px; margin-bottom: 16px; flex-wrap: wrap; }
	.tab-btn { padding: 8px 16px; border-radius: 20px; border: 1px solid var(--border-light); background: var(--bg-card); color: var(--text-secondary); font-family: var(--font-ui); font-size: 12px; font-weight: 700; cursor: pointer; transition: all 0.15s; }
	.tab-btn.active { background: var(--primary); color: #fff; border-color: var(--primary); }
	.tab-panel { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 12px; padding: 24px; }
	.tab-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
	.tab-title { font-family: var(--font-ui); font-size: 14px; font-weight: 800; color: var(--text-dark); margin-bottom: 10px; }
	.tab-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 8px; }
	.check-item { display: flex; gap: 8px; align-items: center; font-size: 12px; font-weight: 600; color: var(--text-dark); margin-bottom: 6px; }
	.tab-preview { background: var(--bg-cream); border-radius: 8px; padding: 16px; }
	.tab-preview-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted); margin-bottom: 8px; }
	.mini-chart { display: grid; grid-template-columns: repeat(5,1fr); gap: 4px; align-items: end; height: 100px; margin-bottom: 8px; }
	.bar-col { text-align: center; }
	.bar { background: rgba(81,190,123,0.25); border-radius: 3px; margin-bottom: 2px; }
	.bar-label { font-size: 8px; color: var(--text-muted); }
	.chart-footer { display: flex; justify-content: space-between; font-family: var(--font-ui); font-size: 10px; }
	.chart-footer .green { color: var(--primary); font-weight: 700; }
	.gp-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
	.gp-card { text-align: center; padding: 16px; background: var(--bg-cream); border-radius: 8px; }
	.gp-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); margin: 8px 0 4px; }
	.gp-desc { font-size: 11px; color: var(--text-secondary); line-height: 1.5; }
	.oh-time { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); margin-bottom: 2px; }
	.oh-desc { font-size: 11px; color: var(--text-secondary); }

	/* Tools */
	.tools-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
	.tool-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 20px; }
	.tool-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.tool-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

	/* Bonuses */
	.bonus-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 32px; }
	.bonus-card { background: rgba(81,190,123,0.04); border: 1px solid rgba(81,190,123,0.15); border-radius: 8px; padding: 20px; }
	.bonus-label { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--primary); margin-bottom: 6px; }
	.bonus-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.bonus-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

	/* Timeline */
	.timeline { position: relative; display: grid; gap: 0; }
	.timeline-line { position: absolute; left: 19px; top: 24px; bottom: 24px; width: 2px; background: var(--border-light); z-index: 0; }
	.timeline-step { display: flex; gap: 16px; align-items: flex-start; padding: 12px 0; position: relative; }
	.timeline-num { width: 40px; height: 40px; border-radius: 50%; background: var(--primary); display: flex; align-items: center; justify-content: center; color: #fff; font-family: var(--font-ui); font-size: 14px; font-weight: 800; flex-shrink: 0; z-index: 1; }
	.timeline-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); }
	.timeline-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; margin-top: 2px; }
	.timeline-outcome { font-size: 11px; color: var(--primary); font-weight: 600; margin-top: 4px; }

	/* Pascal */
	.pascal-card { margin-bottom: 32px; }
	.pascal-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: center; }
	.pascal-img { width: 100%; border-radius: 8px; object-fit: cover; }
	.pascal-name { font-family: var(--font-ui); font-size: 14px; font-weight: 700; color: var(--text-dark); margin-bottom: 6px; }
	.pascal-bio { font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); line-height: 1.7; }

	/* Who */
	.who-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 14px; }
	.who-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 20px; }
	.who-emoji { font-size: 24px; margin-bottom: 8px; }
	.who-title { font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: var(--text-dark); margin-bottom: 4px; }
	.who-desc { font-size: 12px; color: var(--text-secondary); line-height: 1.5; }

	/* Social proof */
	.video-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
	.testimonial-video { border-radius: 8px; overflow: hidden; }
	.video-name { padding: 8px 0; font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-dark); }
	.video-name span { font-weight: 400; color: var(--text-muted); }
	.quotes-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
	.quote-card { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 20px; }
	.quote-text { font-family: var(--font-body); font-size: 13px; color: var(--text-dark); line-height: 1.6; font-style: italic; }
	.quote-author { margin-top: 10px; font-family: var(--font-ui); font-size: 11px; font-weight: 700; color: var(--text-muted); }

	/* CTA sections */
	.mid-cta { text-align: center; padding: 20px; margin-bottom: 32px; }
	.mid-cta-text { font-family: var(--font-ui); font-size: 13px; color: var(--text-secondary); margin-bottom: 12px; }
	.final-cta { text-align: center; background: linear-gradient(135deg, #0A1E21 0%, #1a3a42 100%); border-radius: 12px; padding: 48px 32px; margin-bottom: 24px; }
	.final-cta h2 { font-family: var(--font-headline); font-size: 24px; color: #fff; margin: 0 0 12px; }
	.final-cta p { font-family: var(--font-body); font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 20px; max-width: 500px; margin-left: auto; margin-right: auto; line-height: 1.6; }

	/* FAQ */
	.faq-list { display: grid; gap: 8px; }
	.faq-item { background: var(--bg-card); border: 1px solid var(--border-light); border-radius: 8px; padding: 16px 20px; width: 100%; text-align: left; cursor: pointer; font-family: var(--font-ui); }
	.faq-q { display: flex; justify-content: space-between; align-items: center; font-size: 14px; font-weight: 700; color: var(--text-dark); }
	.faq-arrow { font-size: 18px; color: var(--text-muted); flex-shrink: 0; margin-left: 12px; }
	.faq-a { margin-top: 10px; font-family: var(--font-body); font-size: 13px; color: var(--text-secondary); line-height: 1.7; }

	.disclaimer { font-family: var(--font-ui); font-size: 9px; color: var(--text-muted); text-align: center; opacity: 0.5; line-height: 1.6; }

	@media (min-width: 769px) and (max-width: 1024px) {
		.academy-page { max-width: 900px; padding: 0 24px 48px; }
		.hero { padding: 40px 28px; }
		.hero-stats { gap: 24px; }
		.compare-grid, .tools-grid, .bonus-grid, .quotes-grid, .pascal-grid { gap: 16px; }
		.who-grid, .gp-grid, .video-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
	}

	@media (max-width: 768px) {
		.academy-page { padding: 0 16px 40px; }
		.hero { padding: 32px 20px; }
		.hero h1 { font-size: 24px; }
		.hero-stats { flex-direction: column; gap: 16px; }
		.compare-grid, .tools-grid, .bonus-grid, .quotes-grid, .pascal-grid { grid-template-columns: 1fr; }
		.who-grid, .gp-grid, .video-grid { grid-template-columns: 1fr; }
		.tab-grid { grid-template-columns: 1fr; }
	}
</style>
