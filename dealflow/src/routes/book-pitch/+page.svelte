<script>
	import { onMount } from 'svelte';

	let lpCount = $state('1,100+');

	onMount(async () => {
		try {
			const res = await fetch('/api/lp-network-stats');
			const stats = await res.json();
			lpCount = Math.max(stats.totalLPs || 0, 1100).toLocaleString() + '+';
		} catch { /* keep default */ }
	});

	function toggleFaq(e) {
		const item = e.currentTarget.parentElement;
		item.classList.toggle('open');
	}
</script>

<svelte:head>
	<title>Book Your Pitch — GYC Dealflow</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Source+Sans+3:wght@300;400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="page-wrap">
	<div class="content-wrap">

		<!-- Breadcrumb -->
		<div class="breadcrumb">
			<a href="/gp-dashboard">GP Dashboard</a>
			<span class="breadcrumb-sep">/</span>
			<span class="breadcrumb-current">Book Your Pitch</span>
		</div>

		<!-- Hero Banner -->
		<div class="pitch-hero">
			<div class="pitch-hero-inner">
				<div class="pitch-hero-text">
					<div class="pitch-hero-eyebrow">GP Webinar Pitch</div>
					<h1>Pitch Your Deal to Qualified Accredited Investors</h1>
					<p class="pitch-hero-desc">Get a dedicated 90-minute session — 45 minutes to present your deal, followed by 45 minutes of live Q&amp;A. Directly marketed to investors whose buy box matches your deal.</p>
				</div>
				<div class="pitch-hero-price">
					<span class="pitch-hero-price-amount">$1,000</span>
					<span class="pitch-hero-price-label">per pitch slot</span>
				</div>
			</div>
		</div>

		<!-- Audience Stats -->
		<div class="pitch-stats">
			<div class="pitch-stat">
				<div class="pitch-stat-num">{lpCount}</div>
				<div class="pitch-stat-label">Investors in Database</div>
			</div>
			<div class="pitch-stat">
				<div class="pitch-stat-num">8–20</div>
				<div class="pitch-stat-label">Live Attendees</div>
			</div>
			<div class="pitch-stat">
				<div class="pitch-stat-num">500+</div>
				<div class="pitch-stat-label">Avg. YouTube Views</div>
			</div>
			<div class="pitch-stat">
				<div class="pitch-stat-num">100%</div>
				<div class="pitch-stat-label">Recording Access</div>
			</div>
		</div>

		<!-- What's Included -->
		<div class="section-card">
			<div class="section-header"><div class="section-title">What's Included</div></div>
			<div class="section-body">
				<div class="included-grid">
					<div class="included-item">
						<div class="included-item-icon">&#127908;</div>
						<h3>90-Minute Live Session</h3>
						<p>45 minutes to present your deal, team, and track record, followed by 45 minutes of live Q&amp;A with qualified investors.</p>
					</div>
					<div class="included-item">
						<div class="included-item-icon">&#127919;</div>
						<h3>Matched Investor Audience</h3>
						<p>Every LP whose buy box matches your deal gets a personal invitation. No cold audience — warm, qualified, ready to evaluate.</p>
					</div>
					<div class="included-item">
						<div class="included-item-icon">&#127909;</div>
						<h3>Recording + YouTube</h3>
						<p>Your pitch is recorded and shared with our full investor database. Also published on YouTube — top presentations hit 1,500+ views.</p>
					</div>
					<div class="included-item">
						<div class="included-item-icon">&#128202;</div>
						<h3>Post-Event Analytics</h3>
						<p>See exactly who attended, engagement data, and which investors requested a direct introduction to your IR team.</p>
					</div>
				</div>
			</div>
		</div>

		<!-- How It Works -->
		<div class="section-card">
			<div class="section-header"><div class="section-title">How It Works</div></div>
			<div class="section-body">
				<div class="steps-row">
					<div class="step-item">
						<div class="step-num">1</div>
						<h3>Book &amp; Pay</h3>
						<p>Secure your pitch slot with a one-time $1,000 payment. Pick your preferred Thursday.</p>
					</div>
					<div class="step-item">
						<div class="step-num">2</div>
						<h3>Prep Call</h3>
						<p>15-minute prep call to review your deck, refine your pitch, and set expectations.</p>
					</div>
					<div class="step-item">
						<div class="step-num">3</div>
						<h3>Go Live</h3>
						<p>Present to our investor network. We handle the tech, introductions, and moderation.</p>
					</div>
					<div class="step-item">
						<div class="step-num">4</div>
						<h3>Get Intros</h3>
						<p>Receive your investor interest report and warm introductions to high-intent LPs.</p>
					</div>
				</div>
			</div>
		</div>

		<!-- YouTube Social Proof -->
		<div class="youtube-proof">
			<div class="youtube-proof-icon">
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:24px;height:24px;"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
			</div>
			<div class="youtube-proof-text">
				<strong>Presentations also go on YouTube.</strong> Our top operator presentation has <strong>1,500+ views</strong>. The average hits 500+ views within 90 days. Your pitch keeps reaching new investors for months.
			</div>
		</div>

		<!-- Guarantee -->
		<div class="guarantee-banner">
			<div class="guarantee-banner-icon">&#128170;</div>
			<div>
				<h4>Our Guarantee</h4>
				<p>Your presentation is recorded and published to our full investor database and YouTube channel — your pitch keeps reaching new investors for months, not just the live audience.</p>
			</div>
		</div>

		<!-- Payment Section -->
		<div class="payment-section">
			<div class="payment-section-header">
				<h2>Reserve Your Slot</h2>
				<p>Every Thursday at 1:00 PM ET &bull; One operator per week &bull; Pick your date after checkout</p>
			</div>
			<iframe src="https://link.fastpaydirect.com/payment-link/66e09581d780e54a43941ac8" class="payment-embed" title="Payment" scrolling="no"></iframe>
			<p class="cta-fine">One-time $1,000 payment &bull; No recurring fees &bull; Includes everything above</p>
		</div>

		<!-- FAQ -->
		<div class="section-card">
			<div class="section-header"><div class="section-title">Common Questions</div></div>
			<div class="section-body">
				{#each [
					{ q: "What's the format of the webinar?", a: "Each webinar is a 90-minute session — 45 minutes for your presentation, followed by 45 minutes of live Q&A. We handle the Zoom hosting, introductions, and moderation so you can focus on your pitch." },
					{ q: "Who is in the audience?", a: "Your event is directly marketed to every investor whose buy box matches your deal — these are LPs who have already told us they want your asset class, return profile, and check size. No cold audience." },
					{ q: "What happens after the webinar?", a: "Within 48 hours, you'll receive an investor interest report showing who attended, engagement metrics, and which investors want a follow-up conversation. We also send warm introductions to high-intent LPs." },
					{ q: "Can I use my own deck?", a: "Absolutely. During the prep call, we'll review your deck together and offer feedback based on what resonates most with our investor audience. You control the content." },
					{ q: "Do I need to be a GP on the platform already?", a: "We recommend having at least one deal listed on the platform before pitching, so investors can reference your deal page. If you're not listed yet, we can help you get set up during the prep call." },
					{ q: "What if I need to reschedule?", a: "You can reschedule up to 7 days before your webinar date at no cost. We'll work with you to find the next available slot." }
				] as faq}
				<div class="faq-item">
					<button class="faq-q" onclick={toggleFaq}>
						{faq.q}
						<svg class="faq-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9l6 6 6-6"/></svg>
					</button>
					<div class="faq-a">{faq.a}</div>
				</div>
				{/each}
			</div>
		</div>

	</div>
</div>

<style>
	.page-wrap {
		min-height: 100vh;
		background: var(--bg-cream, #FAF9F5);
		font-family: var(--font-body, 'Source Sans 3', sans-serif);
		color: var(--text-dark, #141413);
		line-height: 1.5;
		-webkit-font-smoothing: antialiased;
	}
	.content-wrap { max-width: 1200px; padding: 32px 40px 64px; margin: 0 auto; }

	/* Breadcrumb */
	.breadcrumb { display: flex; align-items: center; gap: 8px; margin-bottom: 24px; }
	.breadcrumb a { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: var(--primary, #51BE7B); text-decoration: none; }
	.breadcrumb a:hover { color: var(--primary-hover, #45A86C); }
	.breadcrumb-sep { font-size: 12px; color: var(--text-muted, #8A9AA0); }
	.breadcrumb-current { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: var(--text-muted, #8A9AA0); }

	/* Hero Banner */
	.pitch-hero {
		background: linear-gradient(135deg, var(--teal-midnight, #0A1E21) 0%, var(--teal-deep, #1F5159) 100%);
		border-radius: var(--radius, 12px);
		padding: 48px 40px;
		position: relative; overflow: hidden;
		margin-bottom: 24px;
	}
	.pitch-hero::before {
		content: ''; position: absolute; inset: 0;
		background: radial-gradient(ellipse at 30% 50%, rgba(81,190,123,0.1) 0%, transparent 60%),
		            radial-gradient(ellipse at 80% 20%, rgba(64,228,127,0.06) 0%, transparent 50%);
		pointer-events: none;
	}
	.pitch-hero-inner { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 32px; }
	.pitch-hero-text { flex: 1; }
	.pitch-hero-eyebrow { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--accent-green, #40E47F); margin-bottom: 12px; }
	.pitch-hero h1 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: clamp(28px, 3vw, 36px); line-height: 1.2; color: #fff; margin-bottom: 12px; }
	.pitch-hero-desc { font-size: 16px; color: rgba(255,255,255,0.6); max-width: 480px; line-height: 1.5; }
	.pitch-hero-price {
		display: flex; flex-direction: column; align-items: center;
		background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12);
		border-radius: var(--radius, 12px); padding: 24px 32px; flex-shrink: 0;
	}
	.pitch-hero-price-amount { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 48px; color: var(--accent-green, #40E47F); line-height: 1; }
	.pitch-hero-price-label { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.45); margin-top: 4px; }

	/* Stats */
	.pitch-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
	.pitch-stat { background: var(--bg-card, #fff); border: 1px solid var(--border-light, #EDF1F2); border-radius: var(--radius-sm, 8px); padding: 20px; text-align: center; box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); }
	.pitch-stat-num { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 28px; color: var(--teal-deep, #1F5159); }
	.pitch-stat-label { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-muted, #8A9AA0); margin-top: 4px; }

	/* Section Cards */
	.section-card { background: var(--bg-card, #fff); border: 1px solid var(--border-light, #EDF1F2); border-radius: var(--radius, 12px); box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); margin-bottom: 24px; overflow: hidden; }
	.section-header { padding: 18px 24px; border-bottom: 1px solid var(--border-light, #EDF1F2); }
	.section-title { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1.5px; color: var(--primary, #51BE7B); }
	.section-body { padding: 24px; }

	/* Included Grid */
	.included-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
	.included-item { padding: 20px; background: var(--off-white, #FAF9F5); border-radius: var(--radius-sm, 8px); border: 1px solid var(--border-light, #EDF1F2); }
	.included-item-icon { font-size: 24px; margin-bottom: 12px; }
	.included-item h3 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700; color: var(--text-dark, #141413); margin-bottom: 6px; }
	.included-item p { font-size: 14px; color: var(--text-secondary, #607179); line-height: 1.5; }

	/* Steps Row */
	.steps-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; }
	.step-item { text-align: center; padding: 20px 16px; position: relative; }
	.step-num { width: 36px; height: 36px; border-radius: 50%; background: var(--teal-deep, #1F5159); color: #fff; font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-weight: 700; font-size: 15px; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
	.step-item h3 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700; color: var(--text-dark, #141413); margin-bottom: 6px; }
	.step-item p { font-size: 13px; color: var(--text-secondary, #607179); line-height: 1.5; }
	.step-item:not(:last-child)::after { content: ''; position: absolute; top: 38px; right: -10px; width: 20px; height: 2px; background: var(--border, #DDE5E8); }

	/* YouTube Proof */
	.youtube-proof { display: flex; align-items: center; gap: 16px; background: var(--bg-card, #fff); border: 1px solid var(--border-light, #EDF1F2); border-left: 4px solid #FF0000; border-radius: var(--radius-sm, 8px); padding: 20px 24px; margin-bottom: 24px; box-shadow: var(--shadow-card, 0 1px 3px rgba(0,0,0,0.06)); }
	.youtube-proof-icon { flex-shrink: 0; color: #FF0000; }
	.youtube-proof-text { font-size: 14px; color: var(--text-secondary, #607179); line-height: 1.5; }
	.youtube-proof-text :global(strong) { color: var(--text-dark, #141413); }

	/* Guarantee */
	.guarantee-banner { background: var(--mint-bg, #E7F5F0); border: 1px solid var(--primary, #51BE7B); border-radius: var(--radius-sm, 8px); padding: 20px 24px; display: flex; align-items: center; gap: 16px; margin-bottom: 24px; }
	.guarantee-banner-icon { font-size: 24px; flex-shrink: 0; }
	.guarantee-banner h4 { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 700; color: var(--teal-deep, #1F5159); margin-bottom: 2px; }
	.guarantee-banner p { font-size: 13px; color: var(--text-secondary, #607179); line-height: 1.4; }

	/* Payment Section */
	.payment-section { background: var(--bg-card, #fff); border: 2px solid var(--primary, #51BE7B); border-radius: var(--radius, 12px); padding: 32px 28px; text-align: center; margin-bottom: 24px; box-shadow: var(--shadow-lg, 0 8px 30px rgba(0,0,0,0.08)); }
	.payment-section-header h2 { font-family: var(--font-headline, 'DM Serif Display', serif); font-size: 28px; color: var(--teal-deep, #1F5159); margin-bottom: 8px; }
	.payment-section-header p { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; color: var(--text-muted, #8A9AA0); margin-bottom: 24px; }
	.payment-embed { width: 100%; height: 700px; border: 1px solid var(--border-light, #EDF1F2); border-radius: var(--radius-sm, 8px); background: #fff; margin-bottom: 4px; overflow: hidden; }
	.cta-fine { font-size: 12px; color: var(--text-muted, #8A9AA0); margin-top: 12px; }

	/* FAQ */
	.faq-item { border-bottom: 1px solid var(--border-light, #EDF1F2); padding: 16px 0; }
	.faq-item:last-child { border-bottom: none; }
	.faq-q { font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif); font-size: 14px; font-weight: 600; color: var(--text-dark, #141413); cursor: pointer; display: flex; align-items: center; justify-content: space-between; gap: 12px; background: none; border: none; width: 100%; text-align: left; padding: 0; }
	.faq-arrow { width: 18px; height: 18px; transition: transform 0.2s; flex-shrink: 0; color: var(--text-muted, #8A9AA0); }
	:global(.faq-item.open) .faq-arrow { transform: rotate(180deg); }
	.faq-a { font-size: 14px; color: var(--text-secondary, #607179); line-height: 1.6; max-height: 0; overflow: hidden; transition: max-height 0.3s ease, padding 0.3s ease; padding-top: 0; }
	:global(.faq-item.open) .faq-a { max-height: 300px; padding-top: 10px; }

	/* Responsive */
	@media (max-width: 1024px) {
		.pitch-stats { grid-template-columns: repeat(2, 1fr); }
		.steps-row { grid-template-columns: repeat(2, 1fr); }
		.step-item::after { display: none; }
	}
	@media (max-width: 768px) {
		.content-wrap { padding: 20px 16px 48px; }
		.pitch-hero { padding: 32px 24px; }
		.pitch-hero-inner { flex-direction: column; text-align: center; }
		.pitch-hero-desc { max-width: none; }
		.pitch-stats { grid-template-columns: repeat(2, 1fr); }
		.included-grid { grid-template-columns: 1fr; }
		.steps-row { grid-template-columns: 1fr; }
		.step-item::after { display: none; }
		.payment-section { padding: 24px 16px; }
		.youtube-proof { flex-direction: column; text-align: center; }
	}
</style>
