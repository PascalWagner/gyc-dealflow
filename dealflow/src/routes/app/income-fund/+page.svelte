<script>
	import { browser } from '$app/environment';
	import WebOnlyNotice from '$lib/components/WebOnlyNotice.svelte';
	import { isNativeApp } from '$lib/utils/platform.js';
	import PageContainer from '$lib/layout/PageContainer.svelte';

	const nativeCompanionMode = browser && isNativeApp();
</script>

<svelte:head>
	<title>GYC Income Fund | GYC</title>
</svelte:head>

<PageContainer className="income-fund-shell">
<div class="if-page">
	<!-- HERO -->
	<div class="if-hero">
		<h1>Build a <span class="green">monthly income stream</span><br>you can actually live on.</h1>
		<p class="if-hero-sub"><strong>$1,667/mo per $250K invested.</strong> One investment. 10 funds. Monthly deposits. We did the vetting so you don&rsquo;t have to.</p>
		<div class="if-hero-stats">
			<div class="if-hero-stat">
				<div class="val">8.0%</div>
				<div class="lbl">Net LP Yield</div>
				<div class="target-note">Targeting 10%+ at scale</div>
			</div>
			<div class="if-hero-stat">
				<div class="val">10</div>
				<div class="lbl">Funds<br>One Portfolio</div>
			</div>
			<div class="if-hero-stat">
				<div class="val">28 mo</div>
				<div class="lbl">Zero Missed Payments</div>
			</div>
		</div>
	</div>

	<!-- CTA CARD -->
	<div class="cta-card">
		<div class="cta-circle"></div>
		<div class="cta-content">
			<div class="cta-heading">{nativeCompanionMode ? 'Continue your review on the web' : 'Want the full picture?'}</div>
			<div class="cta-body">
				{#if nativeCompanionMode}
					Fund documents, investor onboarding, and follow-up scheduling are handled on the web for existing investors.
				{:else}
					The complete data room has everything: fee waterfall, tax treatment, K-1 walkthrough, investment process, risk analysis, fund-by-fund due diligence, and financial statements.
				{/if}
			</div>
			{#if nativeCompanionMode}
				<WebOnlyNotice
					title="Continue on the web"
					message="Fund documents, investor onboarding, and follow-up scheduling are completed on the web."
					href="https://growyourcashflow.io/income-fund"
				/>
			{:else}
				<div class="cta-buttons">
					<a href="https://growyourcashflow.io/income-fund" target="_blank" rel="noopener" class="btn-primary">View Full Data Room &rarr;</a>
					<a href="https://growyourcashflow.io/introcall" target="_blank" rel="noopener" class="btn-outline">&#9742; Book a Call</a>
				</div>
				<div class="cta-email">Or email <a href="mailto:pascal@growyourcashflow.io">pascal@growyourcashflow.io</a></div>
			{/if}
		</div>
	</div>

	<!-- DISCLAIMER -->
	<p class="disclaimer">This material is for informational purposes only and does not constitute an offer to sell or solicitation to buy securities. Any offering will be made only through a Private Placement Memorandum. Past performance is not indicative of future results. For accredited investors only.</p>
</div>
</PageContainer>

<style>
	.income-fund-shell { --ly-frame-max: 960px; }
	.if-page {
		max-width: 960px;
		margin: 0;
	}

	/* ===== Hero ===== */
	.if-hero {
		background: linear-gradient(135deg, #0A1E21 0%, #1A4A3F 100%);
		border-radius: var(--radius-lg);
		padding: 64px 24px;
		text-align: center;
		color: #fff;
	}

	.if-hero h1 {
		font-family: var(--font-headline);
		font-size: 42px;
		color: #fff;
		margin-bottom: 12px;
		letter-spacing: -0.5px;
		line-height: 1.15;
	}

	.if-hero h1 .green {
		color: #51BE7B;
	}

	.if-hero-sub {
		font-family: var(--font-body);
		font-size: 20px;
		color: rgba(255, 255, 255, 0.85);
		max-width: 600px;
		margin: 12px auto 28px;
		line-height: 1.65;
	}

	.if-hero-sub strong {
		color: #fff;
	}

	.if-hero-stats {
		display: flex;
		justify-content: center;
		gap: 40px;
		margin-top: 36px;
		flex-wrap: wrap;
	}

	.if-hero-stat {
		text-align: center;
	}

	.if-hero-stat .val {
		font-family: var(--font-headline);
		font-size: 32px;
		color: var(--primary);
		line-height: 1;
	}

	.if-hero-stat .lbl {
		font-family: var(--font-ui);
		font-size: 11px;
		color: rgba(255, 255, 255, 0.5);
		margin-top: 6px;
		letter-spacing: 0.5px;
		text-transform: uppercase;
	}

	.target-note {
		font-family: var(--font-ui);
		font-size: 10px;
		color: #40E47F;
		margin-top: 4px;
		font-weight: 600;
	}

	/* ===== CTA Card ===== */
	.cta-card {
		background: linear-gradient(135deg, #0A1E21 0%, #0d3840 100%);
		border-radius: var(--radius-lg);
		padding: 40px 32px;
		text-align: center;
		color: #fff;
		position: relative;
		overflow: hidden;
		margin-top: 24px;
	}

	.cta-circle {
		position: absolute;
		top: -40px;
		right: -40px;
		width: 200px;
		height: 200px;
		border-radius: 50%;
		background: rgba(81, 190, 123, 0.05);
	}

	.cta-content {
		position: relative;
	}

	.cta-heading {
		font-family: var(--font-headline);
		font-size: 22px;
		margin-bottom: 8px;
	}

	.cta-body {
		font-family: var(--font-body);
		font-size: 14px;
		color: rgba(255, 255, 255, 0.7);
		margin-bottom: 6px;
		max-width: 520px;
		margin-left: auto;
		margin-right: auto;
		line-height: 1.7;
	}

	.cta-buttons {
		display: flex;
		gap: 12px;
		justify-content: center;
		flex-wrap: wrap;
		margin-top: 20px;
	}

	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		padding: 14px 32px;
		border-radius: 28px;
		background: #51BE7B;
		color: #fff;
		text-decoration: none;
		transition: all 0.15s;
	}

	.btn-primary:hover {
		background: #45A86C;
		transform: translateY(-1px);
	}

	.btn-outline {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		padding: 14px 32px;
		border-radius: 28px;
		background: transparent;
		color: #fff;
		text-decoration: none;
		border: 1.5px solid rgba(255, 255, 255, 0.3);
		transition: all 0.15s;
	}

	.btn-outline:hover {
		border-color: #51BE7B;
		transform: translateY(-1px);
	}

	.cta-email {
		margin-top: 16px;
		font-family: var(--font-ui);
		font-size: 11px;
		color: rgba(255, 255, 255, 0.35);
	}

	.cta-email a {
		color: #51BE7B;
		text-decoration: none;
	}

	/* ===== Disclaimer ===== */
	.disclaimer {
		margin-top: 24px;
		font-family: var(--font-ui);
		font-size: 9px;
		color: var(--text-muted);
		line-height: 1.6;
		text-align: center;
		opacity: 0.5;
	}

	/* ===== Responsive ===== */
	@media (min-width: 769px) and (max-width: 1024px) {
		.if-page {
			max-width: 840px;
			padding: 0 0 40px;
		}

		.if-hero {
			padding: 52px 28px;
		}

		.if-hero h1 {
			font-size: 36px;
		}

		.if-hero-stats {
			gap: 24px;
		}
	}

	@media (max-width: 768px) {
		.if-hero {
			padding: 40px 16px;
		}

		.if-hero h1 {
			font-size: 28px;
		}

		.if-hero-stats {
			gap: 24px;
		}

		.if-hero-stat .val {
			font-size: 24px;
		}

		.if-hero-stat .lbl {
			font-size: 10px;
		}
	}

	@media (max-width: 480px) {
		.if-hero {
			padding: 32px 12px;
		}

		.if-hero h1 {
			font-size: 24px;
		}

		.if-hero-stats {
			flex-direction: column;
			gap: 16px;
		}

		.if-hero-stat .val {
			font-size: 22px;
		}

		.cta-card {
			padding: 28px 16px;
		}

		.cta-heading {
			font-size: 20px;
		}
	}
</style>
