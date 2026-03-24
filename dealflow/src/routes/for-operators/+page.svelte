<script>
	let optinState = $state('form'); // form | loading | result
	let optinEmail = $state('');
	let optinAssetClass = $state('');
	let resultAmount = $state('127');
	let resultLabel = $state('');
	let resultDetail = $state('');

	let submitState = $state('idle'); // idle | submitting | success
	let deckFileName = $state('');
	let ppmFileName = $state('');
	let deckFileInput;
	let ppmFileInput;

	const demandData = {
		'multifamily': { count: '127', label: 'investors actively looking for multifamily deals', detail: "They've completed buy-box exercises targeting multifamily" },
		'industrial': { count: '89', label: 'investors actively looking for industrial deals', detail: "They've told us: industrial, value-add or core-plus" },
		'self-storage': { count: '64', label: 'investors actively looking for self-storage deals', detail: "They've told us: self-storage, cash-flowing assets" },
		'mobile-home': { count: '41', label: 'investors actively looking for mobile home park deals', detail: "They've told us: MHP, operator-run, income-producing" },
		'lending': { count: '103', label: 'investors actively looking for private credit deals', detail: "They've told us: lending/credit, 8-12% yield, lower volatility" },
		'dst': { count: '52', label: 'investors looking for DST / 1031 exchange deals', detail: "They've told us: 1031-eligible, passive, income-producing" },
		'opportunity-zone': { count: '29', label: 'investors looking for opportunity zone deals', detail: "They've told us: OZ-qualified, long hold, tax-advantaged" },
		'mixed': { count: '78', label: 'investors looking for diversified fund deals', detail: "They've told us: diversified exposure, multi-asset funds" },
		'other': { count: '34', label: 'investors exploring alternative investments', detail: "They've completed buy-box exercises and are actively deploying" }
	};

	function handleHeroOptin(e) {
		e.preventDefault();
		optinState = 'loading';

		// Fire and forget lead capture
		fetch('/api/deck-submit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: optinEmail, assetClass: optinAssetClass, source: 'hero-optin' })
		}).catch(() => {});

		setTimeout(() => {
			const data = demandData[optinAssetClass] || demandData['other'];
			resultAmount = data.count;
			resultLabel = data.label;
			resultDetail = data.detail;
			optinState = 'result';
		}, 800);
	}

	function showDeckFile(e) {
		if (e.target.files?.[0]) deckFileName = e.target.files[0].name;
	}
	function showPpmFile(e) {
		if (e.target.files?.[0]) ppmFileName = e.target.files[0].name;
	}

	function setupDrop(zoneEl, inputEl, setFn) {
		if (!zoneEl) return;
		zoneEl.addEventListener('dragover', (e) => { e.preventDefault(); zoneEl.classList.add('dragover'); });
		zoneEl.addEventListener('dragleave', () => { zoneEl.classList.remove('dragover'); });
		zoneEl.addEventListener('drop', (e) => {
			e.preventDefault();
			zoneEl.classList.remove('dragover');
			if (e.dataTransfer.files.length > 0) {
				inputEl.files = e.dataTransfer.files;
				setFn(inputEl.files[0].name);
			}
		});
	}

	function handleDealSubmit(e) {
		e.preventDefault();
		submitState = 'submitting';
		const form = e.target;
		const formData = new FormData(form);

		const deckName = formData.get('deck')?.name || 'Not uploaded';
		const ppmName = formData.get('ppm')?.name || 'Not uploaded';
		const subject = 'New Deal Submission: ' + (formData.get('dealName') || 'Untitled');
		const body = `NEW DEAL SUBMISSION\n==================\n\nContact: ${formData.get('name')}\nEmail: ${formData.get('email')}\nCompany: ${formData.get('company')}\n\nDeal: ${formData.get('dealName')}\n\nDeck: ${deckName}\nPPM: ${ppmName}\n\nNotes: ${formData.get('notes') || 'None'}\n\nLegal consent: Yes`;

		fetch('/api/deck-submit', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				name: formData.get('name'),
				email: formData.get('email'),
				company: formData.get('company'),
				dealName: formData.get('dealName'),
				notes: formData.get('notes'),
				consent: true
			})
		}).then(res => {
			if (!res.ok) throw new Error('API error');
			return res.json();
		}).then(() => {
			submitState = 'success';
		}).catch(() => {
			const mailtoUrl = `mailto:pascal@growyourcashflow.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
			window.open(mailtoUrl, '_blank');
			submitState = 'success';
		});
	}

	function toggleFaq(e) {
		e.currentTarget.parentElement.classList.toggle('open');
	}

	function smoothScroll(e) {
		const href = e.currentTarget.getAttribute('href');
		if (href?.startsWith('#')) {
			const target = document.querySelector(href);
			if (target) {
				e.preventDefault();
				target.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
	}
</script>

<svelte:head>
	<title>List Your Deals — Grow Your Cashflow</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<!-- Nav -->
<nav class="nav">
	<a href="/" class="nav-logo">Grow Your Cashflow</a>
	<a href="#submit-deal" class="nav-cta" onclick={smoothScroll}>List Your Deal — Free</a>
</nav>

<!-- Hero -->
<section class="hero-dark">
	<div class="hero-dark-inner">
		<div class="hero-eyebrow">For Sponsors &amp; Operators</div>
		<h1>Stop spending 70% of your time raising capital</h1>
		<p class="hero-desc">1,000+ accredited investors have already told us what they want — asset class, check size, return targets. Upload your deck and we put your deal in front of every investor it fits. Instantly. Free.</p>

		<div class="hero-optin">
			{#if optinState !== 'result'}
			<div class="hero-optin-title">How many investors are looking for deals like yours?</div>
			<div class="hero-optin-sub">Select your asset class — instant results, no sales call</div>
			<form onsubmit={handleHeroOptin}>
				<div class="hero-optin-row">
					<input type="email" class="hero-optin-input" bind:value={optinEmail} required placeholder="you@company.com">
					<select class="hero-optin-select" bind:value={optinAssetClass} required>
						<option value="">Asset class...</option>
						<option value="multifamily">Multifamily</option>
						<option value="industrial">Industrial</option>
						<option value="self-storage">Self-Storage</option>
						<option value="mobile-home">Mobile Home Parks</option>
						<option value="lending">Private Credit / Lending</option>
						<option value="dst">DST / 1031</option>
						<option value="opportunity-zone">Opportunity Zone</option>
						<option value="mixed">Mixed / Diversified</option>
						<option value="other">Other</option>
					</select>
				</div>
				<button type="submit" class="hero-optin-btn" disabled={optinState === 'loading'}>
					{optinState === 'loading' ? 'Loading...' : 'Show Me the Demand →'}
				</button>
				<div class="hero-optin-fine">Free. No spam. Just data.</div>
			</form>
			{:else}
			<div class="hero-optin-result">
				<div class="hero-optin-result-amount">{resultAmount}</div>
				<div class="hero-optin-result-label">{resultLabel}</div>
				<div class="hero-optin-result-investors">{resultDetail}</div>
				<a href="#submit-deal" class="hero-optin-result-cta" onclick={smoothScroll}>List Your Deal Now &rarr;</a>
			</div>
			{/if}
		</div>

		<div class="hero-trust-row">
			<div class="hero-trust-item"><span class="hero-trust-dot"></span> Always free</div>
			<div class="hero-trust-item"><span class="hero-trust-dot"></span> Live instantly</div>
			<div class="hero-trust-item"><span class="hero-trust-dot"></span> Not a broker-dealer</div>
			<div class="hero-trust-item"><span class="hero-trust-dot"></span> 1,000+ accredited investors</div>
		</div>
	</div>
</section>

<!-- Urgency banner -->
<div class="urgency-banner">
	<div class="urgency-text">We're onboarding our <strong>founding 50 sponsors</strong> — early listings get featured placement and a free Friday webinar slot. <strong>38 spots remaining.</strong></div>
</div>

<!-- Pain section -->
<section class="section">
	<div class="section-eyebrow">The Problem</div>
	<h2>Capital raising is eating your business alive</h2>
	<p>You got into real estate to do deals. Instead, you spend most of your time chasing capital. Sound familiar?</p>
	<div class="pain-list">
		{#each [
			{ text: '70% of your time goes to fundraising', desc: ' — networking dinners, conferences, follow-up calls. Meanwhile, your next deal waits.' },
			{ text: 'Placement agents take 1-2% of your raise.', desc: ' On a $10M fund, that\'s $100-200K gone before you close a single deal.' },
			{ text: 'Conference booths cost $5-15K', desc: ' and you walk away with a stack of business cards from people who were "just browsing."' },
			{ text: 'Your email list is tapped out.', desc: ' The same 200 investors see every deal. You need new channels but the ROI is unpredictable.' },
			{ text: 'Investors show up cold.', desc: ' They haven\'t read the deck, don\'t know your track record, and you spend 45 minutes on basics before you can even pitch.' }
		] as pain}
		<div class="pain-item">
			<div class="pain-x">&times;</div>
			<p><strong>{pain.text}</strong>{pain.desc}</p>
		</div>
		{/each}
	</div>
</section>

<!-- Cost comparison -->
<section class="section" style="padding-top: 0;">
	<div class="cost-compare">
		<div class="cost-box old">
			<div class="cost-box-label">What You're Paying Now</div>
			<div class="cost-box-amount">$150,000</div>
			<div class="cost-box-detail">Average placement agent fee on a $10M raise (1.5%). Plus $10K+ in conference costs, travel, and pitch materials. And you still do the follow-up yourself.</div>
		</div>
		<div class="cost-box new">
			<div class="cost-box-label">Cost to List on GYC</div>
			<div class="cost-box-amount">$0</div>
			<div class="cost-box-detail">Same investors. Full analytics. Personalized distribution. Push notifications. Live webinar opportunities. And we never take a percentage of your raise.</div>
		</div>
	</div>
</section>

<!-- Why it's free -->
<section class="section" style="padding-top: 0;">
	<div class="demand-callout">
		<div class="demand-amount">"Why is it free?"</div>
		<div class="demand-text">
			<h3>Honestly? We need your deals.</h3>
			<p>We're building the largest accredited investor community in alternatives. Our investors need quality deal flow to stay engaged. You need distribution. More deals attract more investors, more investors attract more sponsors. We're investing in building that flywheel. That's why listing is free and will stay free.</p>
		</div>
	</div>
</section>

<!-- What you get -->
<section class="section">
	<div class="section-eyebrow">What You Get — All Free</div>
	<h2>Not a stripped-down free tier. Everything.</h2>
	<p>No "upgrade for analytics." No "pay to unlock investor data." Every feature, every sponsor, every deal.</p>
	<div class="value-grid">
		{#each [
			{ icon: '🔔', title: 'Instant push notifications', desc: 'The moment your deal goes live, every investor whose buy box matches gets notified. Not a batch email next week — right now, on their phone.' },
			{ icon: '🎯', title: 'Pre-qualified, intent-driven matches', desc: 'Every investor has completed a buy-box exercise. We know their target asset class, return threshold, check size, and timeline. Your deal only surfaces to investors it actually fits.' },
			{ icon: '📈', title: 'Full analytics dashboard', desc: 'See who viewed your deal, saved it, compared it side-by-side with competitors, or requested an intro. Real-time data, not a monthly PDF.' },
			{ icon: '📨', title: 'Personalized investor emails', desc: 'We don\'t just blast your deal. We tell each investor why it fits: "This 8% pref deal could cover 16% of your remaining income gap." Context converts.' },
			{ icon: '🎓', title: 'Investors who\'ve done their homework', desc: 'Our investors go through structured education. They know how to read a PPM, evaluate a waterfall, and ask the right questions. Less hand-holding, faster closes.' },
			{ icon: '✅', title: 'Build trust before the first call', desc: 'Verify your numbers and answer DD questions upfront. Investors show up to calls informed and ready — not skeptical and starting from scratch.' }
		] as item}
		<div class="value-card">
			<div class="value-icon">{item.icon}</div>
			<h3>{item.title}</h3>
			<p>{item.desc}</p>
		</div>
		{/each}
	</div>
</section>

<!-- Quality -->
<section class="quality-section">
	<div class="quality-inner">
		<div class="section-eyebrow">Quality Control</div>
		<h2>Your deal is in good company</h2>
		<p class="quality-desc">We review every listing before it goes live. This isn't a free-for-all — it's a curated platform that protects your reputation alongside ours.</p>
		<div class="quality-grid">
			{#each [
				{ icon: '🔍', title: 'Every deal reviewed', desc: 'We verify key terms and check for completeness before publishing' },
				{ icon: '🔒', title: 'Accredited only', desc: 'Only verified accredited investors can access deal details' },
				{ icon: '💰', title: 'No pay-to-rank', desc: 'Deals surface based on investor fit, not who paid the most' },
				{ icon: '🆓', title: 'Your brand, protected', desc: 'Professional deal pages that reflect well on your firm' }
			] as item}
			<div class="quality-item">
				<div class="quality-icon">{item.icon}</div>
				<h4>{item.title}</h4>
				<p>{item.desc}</p>
			</div>
			{/each}
		</div>
	</div>
</section>

<!-- Who this is for -->
<section class="section">
	<div class="section-eyebrow">Who This Is For</div>
	<h2>Whether you're raising $2M or $200M</h2>
	<p>Different stage, different needs. Here's how the platform works for you.</p>
	<div class="segment-grid">
		<div class="value-card">
			<div class="value-icon" style="background:#FFF5E6;">🌱</div>
			<h3>Emerging sponsors ($1-10M raises)</h3>
			<p>You have a great deal but a small investor list. We give you instant access to 1,000+ qualified investors and a professional deal page that builds credibility. Punch above your weight without paying a placement agent.</p>
		</div>
		<div class="value-card">
			<div class="value-icon" style="background:#E6F0FF;">🏢</div>
			<h3>Established operators ($10M+ raises)</h3>
			<p>Your existing channels are working but you want new LP relationships. We bring you investors you can't reach through conferences and RIA channels — with analytics to prove the ROI of every listing.</p>
		</div>
	</div>
</section>

<!-- Dashboard preview -->
<section class="preview-section">
	<div class="section-eyebrow" style="color:var(--accent-green, #40E47F);">Your Operator Dashboard</div>
	<h2 style="color:#fff;">Data you've never had from a placement agent</h2>
	<p style="max-width:580px;color:rgba(255,255,255,0.6);margin:0 auto 48px;">Track investor interest in real time. See who's looking, who's comparing, and who's ready to talk.</p>
	<div class="preview-window">
		<div class="preview-bar-dots">
			<div class="preview-dot"></div>
			<div class="preview-dot"></div>
			<div class="preview-dot"></div>
		</div>
		<div class="preview-body">
			<div class="preview-metrics">
				{#each [
					{ label: 'Deal Views', value: '847', delta: '+23% this month' },
					{ label: 'Watchlist Saves', value: '134', delta: '+18% this month' },
					{ label: 'Comparisons', value: '56', delta: '+31% this month' },
					{ label: 'Intro Requests', value: '19', delta: '+12% this month' }
				] as metric}
				<div class="preview-metric">
					<div class="preview-metric-label">{metric.label}</div>
					<div class="preview-metric-value">{metric.value}</div>
					<div class="preview-metric-delta">{metric.delta}</div>
				</div>
				{/each}
			</div>
			<div class="preview-chart">
				<div class="preview-chart-title">Investor Activity by Source</div>
				<div class="preview-bars">
					{#each [
						{ label: 'Email Alert', count: 312, pct: 90, color: 'var(--accent-green, #40E47F)' },
						{ label: 'Browse', count: 187, pct: 54, color: 'var(--primary, #51BE7B)' },
						{ label: 'Compare', count: 142, pct: 41, color: 'var(--primary, #51BE7B)' },
						{ label: 'Webinar', count: 89, pct: 26, color: 'var(--primary, #51BE7B)' },
						{ label: 'Push', count: 67, pct: 19, color: 'var(--primary, #51BE7B)' }
					] as bar}
					<div class="preview-bar-col">
						<div class="preview-bar-count">{bar.count}</div>
						<div class="preview-bar-fill" style="height:{bar.pct}%;background:{bar.color};"></div>
						<div class="preview-bar-label">{bar.label}</div>
					</div>
					{/each}
				</div>
			</div>
		</div>
	</div>
</section>

<!-- How it works -->
<section class="section">
	<div class="section-eyebrow">How It Works</div>
	<h2>Upload. Confirm. Live.</h2>
	<p>No sales calls. No lengthy onboarding. Upload your documents, confirm the details, and matched investors get notified instantly.</p>
	<div class="steps">
		{#each [
			{ title: 'Upload your deck + PPM', desc: 'Drop your pitch deck and PPM below. PDF, PowerPoint, Word — whatever you have.' },
			{ title: 'We auto-extract everything', desc: 'Returns, minimums, hold period, strategy, sponsor history — all pulled automatically. No manual data entry.' },
			{ title: 'Confirm the details', desc: 'Review what we extracted, fix anything we missed, approve your deal profile. Takes 2 minutes.' },
			{ title: 'Investors get notified instantly', desc: 'Push notifications + personalized emails to every matched investor. Your analytics dashboard goes live immediately.' }
		] as step, i}
		<div class="step">
			<div class="step-num">{i + 1}</div>
			<h3>{step.title}</h3>
			<p>{step.desc}</p>
		</div>
		{/each}
	</div>
</section>

<!-- What investors see -->
<section class="investors-see-section">
	<div class="investors-see-inner">
		<div class="section-eyebrow">What Investors See</div>
		<h2>Not a generic blast. A personalized match.</h2>
		<p>Every investor has told us their goal. When your deal matches, here's exactly what they get:</p>
		<div class="proof-grid">
			<div class="proof-card">
				<div class="proof-label">Income-Focused Investor</div>
				<div class="proof-quote">"Based on your goal of $120K/year in passive income, this 8% pref multifamily deal from Apex Capital could cover 16% of your remaining gap. At the $100K minimum, that's $8,000/year in projected distributions."</div>
				<div class="proof-meta">Personalized match sent to 127 investors</div>
			</div>
			<div class="proof-card">
				<div class="proof-label">Growth-Focused Investor</div>
				<div class="proof-quote">"New opportunity matching your buy box: industrial value-add in Tampa with a projected 18% IRR and 2.1x equity multiple. The sponsor has a 12-year track record with $340M AUM."</div>
				<div class="proof-meta">Personalized match sent to 89 investors</div>
			</div>
		</div>
	</div>
</section>

<!-- Friday Deal Webinars -->
<section class="webinar-section">
	<div class="webinar-inner">
		<div class="webinar-content">
			<div class="section-eyebrow" style="color:var(--accent-green, #40E47F);">Friday Deal Showcase</div>
			<h2>Present your deal live to 50+ investors every Friday</h2>
			<p>Two sponsors present each week. 25 minutes each, plus live Q&amp;A. List your deal and we'll invite you to present — your first couple slots are on us.</p>
			<ul class="webinar-details">
				<li>Every Friday at 12pm ET — two deals per session</li>
				<li>40-60 accredited investors attend live</li>
				<li>Recording sent to 1,000+ investor list afterward</li>
				<li>We handle all invites, reminders, and follow-up</li>
				<li>You just show up and present your deal</li>
			</ul>
		</div>
		<div class="webinar-schedule">
			<div class="webinar-schedule-title">Upcoming Friday Slots</div>
			<div class="webinar-slot"><div class="webinar-slot-day">Mar 28</div><div class="webinar-slot-bar filled">Apex Capital — Multifamily Fund IV</div></div>
			<div class="webinar-slot"><div class="webinar-slot-day">Mar 28</div><div class="webinar-slot-bar filled">DLP Lending — Credit Fund</div></div>
			<div class="webinar-slot"><div class="webinar-slot-day">Apr 4</div><div class="webinar-slot-bar filled">Spartan Investment — Self-Storage</div></div>
			<div class="webinar-slot"><div class="webinar-slot-day">Apr 4</div><div class="webinar-slot-bar yours">Your deal here &rarr;</div></div>
			<div class="webinar-slot"><div class="webinar-slot-day">Apr 11</div><div class="webinar-slot-bar open">Open slot</div></div>
			<div class="webinar-slot"><div class="webinar-slot-day">Apr 11</div><div class="webinar-slot-bar open">Open slot</div></div>
		</div>
	</div>
</section>

<!-- Founder -->
<section class="founder-section">
	<div class="founder-inner">
		<div class="founder-photo">PW</div>
		<div class="founder-text">
			<div class="founder-role">From the Founder</div>
			<h3>Pascal Wagner</h3>
			<blockquote>"I'm an LP. I've invested in syndications and funds. Every time, the hardest part was finding deals I could trust and sponsors I could verify. So I built the platform I wished existed as an investor. For sponsors, the value is simple: I've already done the hard work of educating and qualifying these investors. They know what they want. You just need to show up."</blockquote>
		</div>
	</div>
</section>

<!-- FAQ -->
<section class="section">
	<div class="section-eyebrow">Common Questions</div>
	<h2>FAQ</h2>
	<div class="faq-list">
		{#each [
			{ q: 'Who are the investors on your platform?', a: 'Accredited investors — high-income W2 professionals, business owners, physicians, attorneys, dentists — actively deploying capital into alternatives. They\'ve completed a structured buy-box exercise so we know exactly what they want: asset class, return threshold, check size, timeline. These are not browsers.' },
			{ q: 'Why is it free? What\'s the catch?', a: 'No catch. We\'re building the largest accredited investor community in alternatives. Our investors need quality deal flow to stay engaged; you need distribution. The flywheel works when both sides show up. Listing is free and will stay free.' },
			{ q: 'Is this a broker-dealer or placement agent?', a: 'No. We are an educational platform and deal directory. We do not solicit investments, handle funds, or receive transaction-based compensation. All investment decisions happen directly between investor and sponsor.' },
			{ q: 'Will my deal look professional?', a: 'Yes. We review every listing before it goes live. Your deal gets a professionally structured profile page. We verify details and check completeness. This is a curated platform — your deal sits next to other quality offerings, not junk.' },
			{ q: 'How fast can my deal go live?', a: 'Instantly. Upload your deck and PPM, we auto-extract the key terms, you confirm, and it goes live. Matched investors get push notifications right away.' },
			{ q: 'Can I present my deal in a live webinar?', a: 'Yes — every Friday at noon ET, two sponsors present live. When you list a deal, we\'ll invite you. Your first couple slots are on us. We handle invitations, reminders, and follow-up. Average attendance is 40-60 qualified investors, and the recording goes to the full 1,000+ list.' }
		] as faq}
		<div class="faq-item">
			<button class="faq-q" onclick={toggleFaq}>
				{faq.q}
				<svg class="faq-arrow" viewBox="0 0 20 20" fill="currentColor"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"/></svg>
			</button>
			<div class="faq-a">{faq.a}</div>
		</div>
		{/each}
	</div>
</section>

<!-- Submit Deal Form -->
<section class="section form-section" id="submit-deal">
	<div class="form-inner">
		<div class="section-eyebrow">Submit Your Deal</div>
		<h2>Upload your docs. We'll do the rest.</h2>
		<p>Drop your deck and PPM below. We'll auto-extract the key terms, you confirm, and matched investors get notified instantly.</p>

		{#if submitState !== 'success'}
		<form onsubmit={handleDealSubmit}>
			<div class="form-grid">
				<div class="form-group">
					<label class="form-label">Your Name *</label>
					<input type="text" class="form-input" name="name" required placeholder="Jane Smith">
				</div>
				<div class="form-group">
					<label class="form-label">Email *</label>
					<input type="email" class="form-input" name="email" required placeholder="jane@acmecapital.com">
				</div>
				<div class="form-group">
					<label class="form-label">Company / Sponsor Name *</label>
					<input type="text" class="form-input" name="company" required placeholder="Acme Capital Partners">
				</div>
				<div class="form-group">
					<label class="form-label">Deal Name *</label>
					<input type="text" class="form-input" name="dealName" required placeholder="Multifamily Fund IV">
				</div>
				<div class="form-group full">
					<label class="form-label">Pitch Deck *</label>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="form-file-zone" onclick={() => deckFileInput.click()}>
						<div class="form-file-zone-icon">&#128202;</div>
						<div class="form-file-zone-text">Drop your pitch deck here or click to browse</div>
						<div class="form-file-zone-sub">PDF or PowerPoint — up to 25MB</div>
						{#if deckFileName}<div class="form-file-name">{deckFileName}</div>{/if}
					</div>
					<input type="file" bind:this={deckFileInput} name="deck" accept=".pdf,.ppt,.pptx" style="display:none" onchange={showDeckFile}>
				</div>
				<div class="form-group full">
					<label class="form-label">PPM / Offering Memorandum</label>
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="form-file-zone" onclick={() => ppmFileInput.click()}>
						<div class="form-file-zone-icon">&#128196;</div>
						<div class="form-file-zone-text">Drop your PPM here or click to browse</div>
						<div class="form-file-zone-sub">PDF or Word — up to 25MB (optional but helps us extract better terms)</div>
						{#if ppmFileName}<div class="form-file-name">{ppmFileName}</div>{/if}
					</div>
					<input type="file" bind:this={ppmFileInput} name="ppm" accept=".pdf,.doc,.docx" style="display:none" onchange={showPpmFile}>
				</div>
				<div class="form-group full">
					<label class="form-label">Anything else we should know?</label>
					<textarea class="form-textarea" name="notes" placeholder="Track record, current raise status, timeline, co-invest details, or any questions."></textarea>
				</div>
				<div class="form-group full" style="margin-top: 4px;">
					<label class="consent-label">
						<input type="checkbox" name="consent" required class="consent-checkbox">
						<span class="consent-text">I confirm that I am authorized to distribute this offering material and grant Grow Your Cashflow permission to display the deal details, share offering information with accredited investors on the platform, and send notifications about this deal to matched investors. I understand this is an informational listing, not a solicitation, and all investment transactions occur directly between sponsor and investor.</span>
					</label>
				</div>
				<div class="form-group full">
					<button type="submit" class="form-submit" disabled={submitState === 'submitting'}>
						{submitState === 'submitting' ? 'Submitting...' : 'Submit Deal →'}
					</button>
					<div class="form-note">Free to list. We'll extract the details and send you a confirmation to review before going live.</div>
				</div>
			</div>
		</form>
		{:else}
		<div class="form-success">
			<div class="form-success-icon">&#9989;</div>
			<h3>Deal submitted</h3>
			<p style="margin-bottom:32px;">We're extracting details from your documents now. You'll get an email shortly to confirm the deal profile before it goes live to 1,000+ investors.</p>
			<div class="webinar-upsell">
				<div class="webinar-upsell-eyebrow">Bonus: Present Live</div>
				<div class="webinar-upsell-title">Want a Friday webinar slot?</div>
				<p>Present your deal live to 40-60 accredited investors. 25 minutes + Q&amp;A. Recording goes to the full 1,000+ list. Your first couple slots are free.</p>
				<a href="mailto:pascal@growyourcashflow.com?subject=Webinar%20Slot%20Interest&body=Hi%20Pascal%2C%20I%20just%20submitted%20a%20deal%20and%20would%20love%20a%20Friday%20webinar%20slot." class="webinar-upsell-btn">Yes — Book My Free Slot</a>
			</div>
		</div>
		{/if}
	</div>
</section>

<!-- Final CTA -->
<section class="final-cta">
	<h2>Your next investor is already on the platform</h2>
	<p>They've told us what they want. They're comparing deals right now. The only thing missing is yours.</p>
	<a href="#submit-deal" class="hero-cta" onclick={smoothScroll}>Submit Your Deal &rarr;</a>
	<div class="hero-sub">100% free. 1,000+ accredited investors. Live instantly.</div>
</section>

<!-- Footer -->
<footer class="footer">
	&copy; 2026 Grow Your Cashflow. All rights reserved.
</footer>

<style>
	/* ── Base ── */
	:global(body) { margin: 0; padding: 0; }

	/* ── Nav ── */
	.nav { position: fixed; top: 0; left: 0; right: 0; z-index: 100; background: rgba(250,249,245,0.92); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border-light, #EDF1F2); padding: 0 24px; height: 64px; display: flex; align-items: center; justify-content: space-between; }
	.nav-logo { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 20px; color: var(--teal-deep, #1F5159); text-decoration: none; }
	.nav-cta { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 600; background: var(--primary, #51BE7B); color: #fff; border: none; border-radius: var(--radius-sm, 8px); padding: 10px 20px; cursor: pointer; text-decoration: none; transition: background 0.2s; }
	.nav-cta:hover { background: var(--primary-hover, #45A86C); }

	/* ── Hero Dark ── */
	.hero-dark { background: linear-gradient(135deg, var(--teal-midnight, #0A1E21) 0%, var(--teal-deep, #1F5159) 100%); padding: 120px 24px 80px; text-align: center; position: relative; overflow: hidden; }
	.hero-dark::before { content: ''; position: absolute; inset: 0; background: radial-gradient(ellipse at 30% 50%, rgba(81,190,123,0.08) 0%, transparent 60%), radial-gradient(ellipse at 70% 20%, rgba(64,228,127,0.05) 0%, transparent 50%); pointer-events: none; }
	.hero-dark-inner { max-width: 800px; margin: 0 auto; position: relative; z-index: 1; }
	.hero-eyebrow { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-green, #40E47F); margin-bottom: 16px; }
	.hero-dark h1 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: clamp(36px, 5vw, 56px); line-height: 1.15; color: #fff; margin-bottom: 24px; }
	.hero-desc { font-size: 20px; color: rgba(255,255,255,0.6); max-width: 600px; margin: 0 auto 40px; }

	/* Hero Opt-in */
	.hero-optin { max-width: 520px; margin: 0 auto; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); border-radius: 16px; padding: 32px; backdrop-filter: blur(8px); }
	.hero-optin-title { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 15px; font-weight: 700; color: #fff; margin-bottom: 4px; }
	.hero-optin-sub { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 20px; }
	.hero-optin-row { display: flex; gap: 10px; margin-bottom: 10px; }
	.hero-optin-input { flex: 1; font-family: var(--font-body, 'Source Sans 3', sans-serif); font-size: 15px; padding: 14px 16px; border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-sm, 8px); background: rgba(255,255,255,0.08); color: #fff; transition: border-color 0.2s; }
	.hero-optin-input::placeholder { color: rgba(255,255,255,0.35); }
	.hero-optin-input:focus { outline: none; border-color: var(--accent-green, #40E47F); background: rgba(255,255,255,0.12); }
	.hero-optin-select { font-family: var(--font-body, 'Source Sans 3', sans-serif); font-size: 15px; padding: 14px 36px 14px 16px; border: 1px solid rgba(255,255,255,0.15); border-radius: var(--radius-sm, 8px); background: rgba(255,255,255,0.08); color: #fff; appearance: none; cursor: pointer; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='rgba(255,255,255,0.5)' d='M6 8L1 3h10z'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; min-width: 160px; }
	.hero-optin-select:focus { outline: none; border-color: var(--accent-green, #40E47F); }
	.hero-optin-select :global(option) { color: var(--text-dark, #141413); background: #fff; }
	.hero-optin-btn { width: 100%; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 16px; font-weight: 700; background: var(--accent-green, #40E47F); color: var(--teal-midnight, #0A1E21); border: none; border-radius: var(--radius-sm, 8px); padding: 14px; cursor: pointer; transition: background 0.2s, transform 0.15s; }
	.hero-optin-btn:hover { background: #4df590; transform: translateY(-1px); }
	.hero-optin-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
	.hero-optin-fine { font-size: 12px; color: rgba(255,255,255,0.3); margin-top: 12px; }

	/* Hero Opt-in Result */
	.hero-optin-result { text-align: center; padding: 8px 0; }
	.hero-optin-result-amount { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: clamp(40px, 5vw, 56px); color: var(--accent-green, #40E47F); margin-bottom: 4px; }
	.hero-optin-result-label { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.7); margin-bottom: 4px; }
	.hero-optin-result-investors { font-size: 14px; color: rgba(255,255,255,0.5); margin-bottom: 20px; }
	.hero-optin-result-cta { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 15px; font-weight: 600; background: var(--accent-green, #40E47F); color: var(--teal-midnight, #0A1E21); border: none; border-radius: var(--radius-sm, 8px); padding: 14px 28px; cursor: pointer; text-decoration: none; transition: background 0.2s; }
	.hero-optin-result-cta:hover { background: #4df590; }

	/* Trust row */
	.hero-trust-row { display: flex; justify-content: center; gap: 32px; flex-wrap: wrap; margin-top: 32px; }
	.hero-trust-item { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.4); display: flex; align-items: center; gap: 6px; }
	.hero-trust-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-green, #40E47F); }

	/* ── Urgency ── */
	.urgency-banner { background: var(--teal-midnight, #0A1E21); padding: 20px 24px; text-align: center; }
	.urgency-text { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 15px; font-weight: 600; color: rgba(255,255,255,0.8); }
	.urgency-text :global(strong) { color: var(--accent-green, #40E47F); }

	/* ── Section ── */
	.section { max-width: 1000px; margin: 0 auto; padding: 80px 24px; }
	.section-eyebrow { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary, #51BE7B); margin-bottom: 12px; }
	.section h2 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: clamp(28px, 3.5vw, 40px); color: var(--teal-midnight, #0A1E21); margin-bottom: 16px; line-height: 1.2; }
	.section > p { font-size: 18px; color: var(--text-secondary, #607179); max-width: 640px; margin-bottom: 48px; }

	/* ── Pain ── */
	.pain-list { max-width: 640px; }
	.pain-item { display: flex; gap: 16px; padding: 16px 0; border-bottom: 1px solid var(--border-light, #EDF1F2); }
	.pain-item:last-child { border-bottom: none; }
	.pain-x { width: 28px; height: 28px; border-radius: 50%; background: #FEE; color: #D44; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 2px; }
	.pain-item p { font-size: 16px; color: var(--text-secondary, #607179); line-height: 1.5; }
	.pain-item :global(strong) { color: var(--text-dark, #141413); }

	/* ── Cost compare ── */
	.cost-compare { display: flex; gap: 24px; margin: 48px 0; align-items: stretch; }
	.cost-box { flex: 1; border-radius: var(--radius, 12px); padding: 32px 28px; }
	.cost-box.old { background: #FFF5F5; border: 1px solid #FDD; }
	.cost-box.new { background: var(--mint-bg, #E7F5F0); border: 2px solid var(--primary, #51BE7B); }
	.cost-box-label { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 12px; }
	.cost-box.old .cost-box-label { color: #D44; }
	.cost-box.new .cost-box-label { color: var(--primary, #51BE7B); }
	.cost-box-amount { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: clamp(32px, 4vw, 44px); margin-bottom: 8px; }
	.cost-box.old .cost-box-amount { color: #D44; text-decoration: line-through; }
	.cost-box.new .cost-box-amount { color: var(--teal-deep, #1F5159); }
	.cost-box-detail { font-size: 15px; color: var(--text-secondary, #607179); line-height: 1.5; }

	/* ── Demand callout ── */
	.demand-callout { background: linear-gradient(135deg, var(--teal-deep, #1F5159), var(--teal-midnight, #0A1E21)); border-radius: var(--radius, 12px); padding: 48px 40px; display: flex; align-items: center; gap: 40px; margin: 48px 0; color: #fff; }
	.demand-amount { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: clamp(20px, 3vw, 28px); color: var(--accent-green, #40E47F); white-space: normal; max-width: 200px; text-align: center; line-height: 1.3; }
	.demand-text h3 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 20px; font-weight: 700; margin-bottom: 8px; }
	.demand-text p { font-size: 16px; color: rgba(255,255,255,0.7); line-height: 1.5; }

	/* ── Value grid ── */
	.value-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; }
	.value-card { background: var(--bg-card, #fff); border: 1px solid var(--border-light, #EDF1F2); border-radius: var(--radius, 12px); padding: 32px 28px; box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); transition: box-shadow 0.2s, transform 0.15s; }
	.value-card:hover { box-shadow: var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.08)); transform: translateY(-2px); }
	.value-icon { width: 44px; height: 44px; border-radius: 10px; background: var(--mint-bg, #E7F5F0); display: flex; align-items: center; justify-content: center; font-size: 22px; margin-bottom: 20px; }
	.value-card h3 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 17px; font-weight: 700; color: var(--text-dark, #141413); margin-bottom: 8px; }
	.value-card p { font-size: 15px; color: var(--text-secondary, #607179); line-height: 1.55; }

	/* ── Quality ── */
	.quality-section { background: #fff; padding: 60px 24px; border-top: 1px solid var(--border-light, #EDF1F2); border-bottom: 1px solid var(--border-light, #EDF1F2); }
	.quality-inner { max-width: 1000px; margin: 0 auto; text-align: center; }
	.quality-desc { max-width: 560px; margin: 0 auto 32px; font-size: 17px; color: var(--text-secondary, #607179); }
	.quality-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 32px; }
	.quality-item { text-align: center; padding: 20px; }
	.quality-icon { font-size: 28px; margin-bottom: 8px; }
	.quality-item h4 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700; color: var(--text-dark, #141413); margin-bottom: 4px; }
	.quality-item p { font-size: 13px; color: var(--text-muted, #8A9AA0); }

	/* ── Segments ── */
	.segment-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; }

	/* ── Preview section ── */
	.preview-section { background: var(--teal-midnight, #0A1E21); padding: 80px 24px; text-align: center; }
	.preview-window { max-width: 900px; margin: 0 auto; background: var(--bg-cream, #FAF9F5); border-radius: 12px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.3); }
	.preview-bar-dots { background: #e8ede9; padding: 10px 16px; display: flex; gap: 6px; }
	.preview-dot { width: 10px; height: 10px; border-radius: 50%; background: #ccc; }
	.preview-body { padding: 32px; }
	.preview-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
	.preview-metric { background: #fff; border: 1px solid var(--border-light, #EDF1F2); border-radius: var(--radius-sm, 8px); padding: 20px 16px; text-align: left; }
	.preview-metric-label { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #8A9AA0); margin-bottom: 6px; }
	.preview-metric-value { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 28px; color: var(--teal-deep, #1F5159); }
	.preview-metric-delta { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 12px; font-weight: 600; color: var(--primary, #51BE7B); margin-top: 4px; }
	.preview-chart { background: #fff; border: 1px solid var(--border-light, #EDF1F2); border-radius: var(--radius-sm, 8px); padding: 24px; }
	.preview-chart-title { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: var(--text-muted, #8A9AA0); text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 16px; }
	.preview-bars { display: flex; align-items: flex-end; gap: 12px; height: 120px; }
	.preview-bar-col { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; }
	.preview-bar-count { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; color: var(--teal-deep, #1F5159); margin-bottom: 4px; }
	.preview-bar-fill { width: 100%; border-radius: 4px 4px 0 0; min-height: 8px; }
	.preview-bar-label { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 10px; font-weight: 600; color: var(--text-muted, #8A9AA0); }

	/* ── Steps ── */
	.steps { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 32px; }
	.step-num { width: 36px; height: 36px; border-radius: 50%; background: var(--teal-deep, #1F5159); color: #fff; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; margin-bottom: 16px; }
	.step h3 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 16px; font-weight: 700; color: var(--text-dark, #141413); margin-bottom: 6px; }
	.step p { font-size: 15px; color: var(--text-secondary, #607179); }

	/* ── Investors see ── */
	.investors-see-section { background: #fff; padding: 80px 24px; border-top: 1px solid var(--border-light, #EDF1F2); border-bottom: 1px solid var(--border-light, #EDF1F2); }
	.investors-see-inner { max-width: 1000px; margin: 0 auto; }
	.proof-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 24px; margin-top: 36px; }
	.proof-card { background: var(--bg-card, #fff); border: 1px solid var(--border-light, #EDF1F2); border-left: 3px solid var(--primary, #51BE7B); border-radius: var(--radius, 12px); padding: 28px; box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); }
	.proof-label { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: var(--primary, #51BE7B); margin-bottom: 12px; }
	.proof-quote { font-size: 15px; color: var(--text-dark, #141413); line-height: 1.6; margin-bottom: 16px; }
	.proof-meta { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 12px; color: var(--text-muted, #8A9AA0); }

	/* ── Webinar ── */
	.webinar-section { background: linear-gradient(135deg, #0A1E21 0%, #1F5159 100%); padding: 80px 24px; }
	.webinar-inner { max-width: 1000px; margin: 0 auto; display: grid; grid-template-columns: 1fr 1fr; gap: 48px; align-items: center; }
	.webinar-content h2 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: clamp(28px, 3.5vw, 40px); color: #fff; margin-bottom: 16px; line-height: 1.2; }
	.webinar-content > p { font-size: 17px; color: rgba(255,255,255,0.65); margin-bottom: 24px; line-height: 1.6; }
	.webinar-details { list-style: none; padding: 0; }
	.webinar-details li { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 15px; color: rgba(255,255,255,0.85); padding: 8px 0 8px 28px; position: relative; }
	.webinar-details li::before { content: ''; position: absolute; left: 0; top: 13px; width: 12px; height: 12px; border-radius: 50%; background: var(--accent-green, #40E47F); }
	.webinar-schedule { background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: var(--radius, 12px); padding: 32px; }
	.webinar-schedule-title { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-green, #40E47F); margin-bottom: 20px; }
	.webinar-slot { display: flex; align-items: center; gap: 16px; padding: 14px 0; border-bottom: 1px solid rgba(255,255,255,0.08); }
	.webinar-slot:last-child { border-bottom: none; }
	.webinar-slot-day { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.5); width: 40px; flex-shrink: 0; }
	.webinar-slot-bar { flex: 1; height: 36px; border-radius: 6px; display: flex; align-items: center; padding: 0 12px; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; }
	.webinar-slot-bar.filled { background: rgba(81,190,123,0.2); border: 1px solid rgba(81,190,123,0.3); color: var(--accent-green, #40E47F); }
	.webinar-slot-bar.open { background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2); color: rgba(255,255,255,0.4); }
	.webinar-slot-bar.yours { background: rgba(64,228,127,0.15); border: 1px solid var(--accent-green, #40E47F); color: #fff; animation: pulse-border 2s ease-in-out infinite; }
	@keyframes pulse-border { 0%, 100% { border-color: var(--accent-green, #40E47F); } 50% { border-color: rgba(64,228,127,0.4); } }

	/* ── Founder ── */
	.founder-section { background: #fff; border-top: 1px solid var(--border-light, #EDF1F2); border-bottom: 1px solid var(--border-light, #EDF1F2); padding: 80px 24px; }
	.founder-inner { display: flex; gap: 40px; align-items: center; max-width: 800px; margin: 0 auto; }
	.founder-photo { width: 120px; height: 120px; border-radius: 50%; background: var(--mint-bg, #E7F5F0); border: 3px solid var(--primary, #51BE7B); display: flex; align-items: center; justify-content: center; font-size: 48px; flex-shrink: 0; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-weight: 700; color: var(--teal-deep, #1F5159); }
	.founder-role { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: var(--primary, #51BE7B); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; }
	.founder-text h3 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 18px; font-weight: 700; color: var(--text-dark, #141413); margin-bottom: 4px; }
	.founder-text blockquote { font-size: 17px; font-style: italic; color: var(--text-dark, #141413); line-height: 1.6; border-left: 3px solid var(--primary, #51BE7B); padding-left: 16px; margin-top: 12px; }

	/* ── FAQ ── */
	.faq-list { max-width: 700px; }
	.faq-item { border-bottom: 1px solid var(--border-light, #EDF1F2); padding: 20px 0; }
	.faq-q { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 16px; font-weight: 600; color: var(--text-dark, #141413); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: none; border: none; width: 100%; text-align: left; padding: 0; }
	.faq-arrow { width: 20px; height: 20px; transition: transform 0.2s; flex-shrink: 0; color: var(--text-muted, #8A9AA0); }
	:global(.faq-item.open) .faq-arrow { transform: rotate(180deg); }
	.faq-a { font-size: 15px; color: var(--text-secondary, #607179); line-height: 1.6; max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; padding-top: 0; }
	:global(.faq-item.open) .faq-a { max-height: 300px; padding-top: 12px; }

	/* ── Form ── */
	.form-section { background: #fff; border-top: 1px solid var(--border-light, #EDF1F2); }
	.form-inner { max-width: 640px; margin: 0 auto; }
	.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
	.form-group { display: flex; flex-direction: column; gap: 6px; }
	.form-group.full { grid-column: 1 / -1; }
	.form-label { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: var(--text-dark, #141413); }
	.form-input, .form-textarea { font-family: var(--font-body, 'Source Sans 3', sans-serif); font-size: 15px; padding: 12px 14px; border: 1px solid var(--border, #DDE5E8); border-radius: var(--radius-sm, 8px); background: var(--bg-cream, #FAF9F5); color: var(--text-dark, #141413); transition: border-color 0.2s; width: 100%; }
	.form-input:focus, .form-textarea:focus { outline: none; border-color: var(--primary, #51BE7B); box-shadow: 0 0 0 3px rgba(81,190,123,0.1); }
	.form-textarea { resize: vertical; min-height: 80px; }

	.form-file-zone { border: 2px dashed var(--border, #DDE5E8); border-radius: var(--radius, 12px); padding: 32px; text-align: center; cursor: pointer; transition: border-color 0.2s, background 0.2s; background: var(--bg-cream, #FAF9F5); }
	.form-file-zone:hover { border-color: var(--primary, #51BE7B); background: var(--mint-bg, #E7F5F0); }
	:global(.form-file-zone.dragover) { border-color: var(--primary, #51BE7B); background: var(--mint-bg, #E7F5F0); }
	.form-file-zone-icon { font-size: 28px; margin-bottom: 8px; }
	.form-file-zone-text { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 600; color: var(--text-dark, #141413); margin-bottom: 4px; }
	.form-file-zone-sub { font-size: 13px; color: var(--text-muted, #8A9AA0); }
	.form-file-name { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: var(--primary, #51BE7B); margin-top: 8px; }

	.consent-label { display: flex; align-items: flex-start; gap: 10px; cursor: pointer; }
	.consent-checkbox { margin-top: 4px; width: 18px; height: 18px; accent-color: var(--primary, #51BE7B); flex-shrink: 0; }
	.consent-text { font-size: 13px; color: var(--text-secondary, #607179); line-height: 1.5; }

	.form-submit { display: block; width: 100%; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 16px; font-weight: 600; background: var(--primary, #51BE7B); color: #fff; border: none; border-radius: var(--radius, 12px); padding: 16px; cursor: pointer; transition: background 0.2s; margin-top: 8px; }
	.form-submit:hover { background: var(--primary-hover, #45A86C); }
	.form-submit:disabled { opacity: 0.6; cursor: not-allowed; }
	.form-note { font-size: 13px; color: var(--text-muted, #8A9AA0); text-align: center; margin-top: 12px; }

	.form-success { text-align: center; padding: 48px 24px; }
	.form-success-icon { font-size: 48px; margin-bottom: 16px; }
	.form-success h3 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 28px; color: var(--teal-deep, #1F5159); margin-bottom: 12px; }
	.form-success p { font-size: 16px; color: var(--text-secondary, #607179); max-width: 400px; margin: 0 auto; }

	.webinar-upsell { background: linear-gradient(135deg, var(--teal-deep, #1F5159), var(--teal-midnight, #0A1E21)); border-radius: var(--radius, 12px); padding: 28px 32px; text-align: left; max-width: 480px; margin: 0 auto; }
	.webinar-upsell-eyebrow { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-green, #40E47F); margin-bottom: 8px; }
	.webinar-upsell-title { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 22px; color: #fff; margin-bottom: 8px; }
	.webinar-upsell p { font-size: 14px; color: rgba(255,255,255,0.6); margin-bottom: 16px; line-height: 1.5; }
	.webinar-upsell-btn { display: inline-block; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 600; background: var(--accent-green, #40E47F); color: var(--teal-midnight, #0A1E21); border-radius: var(--radius-sm, 8px); padding: 10px 20px; text-decoration: none; }

	/* ── Final CTA ── */
	.final-cta { background: var(--teal-midnight, #0A1E21); padding: 100px 24px; text-align: center; }
	.final-cta h2 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: clamp(30px, 4vw, 44px); color: #fff; margin-bottom: 16px; }
	.final-cta p { font-size: 18px; color: rgba(255,255,255,0.6); max-width: 520px; margin: 0 auto 36px; }
	.hero-cta { display: inline-flex; align-items: center; gap: 8px; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 17px; font-weight: 600; background: var(--primary, #51BE7B); color: #fff; border: none; border-radius: var(--radius, 12px); padding: 18px 40px; cursor: pointer; text-decoration: none; transition: background 0.2s, transform 0.15s; }
	.hero-cta:hover { background: var(--primary-hover, #45A86C); transform: translateY(-1px); }
	.hero-sub { font-size: 14px; color: rgba(255,255,255,0.4); margin-top: 12px; }

	/* ── Footer ── */
	.footer { padding: 32px 24px; text-align: center; border-top: 1px solid var(--border-light, #EDF1F2); font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; color: var(--text-muted, #8A9AA0); }

	/* ── Responsive ── */
	@media (max-width: 768px) {
		.demand-callout { flex-direction: column; text-align: center; padding: 36px 24px; }
		.preview-metrics { grid-template-columns: repeat(2, 1fr); }
		.section { padding: 60px 20px; }
		.hero-optin-row { flex-direction: column; }
		.hero-optin-select { min-width: unset; }
		.hero-trust-row { gap: 16px; }
		.webinar-inner { grid-template-columns: 1fr; }
		.form-grid { grid-template-columns: 1fr; }
		.cost-compare { flex-direction: column; }
		.segment-grid { grid-template-columns: 1fr; }
		.founder-inner { flex-direction: column; text-align: center; }
	}
	@media (max-width: 480px) {
		.preview-metrics { grid-template-columns: 1fr 1fr; }
	}
</style>
