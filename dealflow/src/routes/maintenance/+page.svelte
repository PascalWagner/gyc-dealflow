<svelte:head>
	<title>Grow Your Cashflow - Maintenance</title>
	<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
</svelte:head>

<div class="ly-page">
	<div class="ly-frame">
<div class="maintenance">
	<div class="container">
		<div class="brand">Grow Your Cashflow</div>
		<div class="status-pill">
			<span class="status-dot"></span>
			System Upgrade in Progress
		</div>
		<h1>We'll Be Right Back</h1>
		<p class="message">We're currently upgrading our systems to serve you better. This should only take a few minutes.</p>
		<p class="thanks">Thank you for your patience!</p>
		<button class="btn" onclick={() => location.reload()}>Try Again</button>
		<div class="divider"></div>
		<div class="contact">
			Need immediate assistance?<br>
			Email us at <a href="mailto:pascal@growyourcashflow.io">pascal@growyourcashflow.io</a>
		</div>
	</div>
</div>
</div>
</div>

<style>
	.maintenance {
		font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
		background: #0A1E21;
		color: #E8EDE9;
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		-webkit-font-smoothing: antialiased;
	}
	.container {
		max-width: 560px;
		width: 100%;
		text-align: center;
	}
	.brand {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 22px;
		color: #51BE7B;
		margin-bottom: 28px;
		letter-spacing: -0.3px;
	}
	.status-pill {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 8px 20px;
		border-radius: 100px;
		border: 1px solid rgba(81, 190, 123, 0.25);
		background: rgba(81, 190, 123, 0.08);
		font-size: 14px;
		font-weight: 500;
		color: #9DB0B5;
		margin-bottom: 28px;
	}
	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #51BE7B;
		animation: pulse 2s ease-in-out infinite;
	}
	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.4; }
	}
	h1 {
		font-family: 'DM Serif Display', Georgia, serif;
		font-size: 38px;
		font-weight: 400;
		color: #FFFFFF;
		margin-bottom: 16px;
		letter-spacing: -0.5px;
	}
	.message {
		font-size: 16px;
		line-height: 1.6;
		color: #9DB0B5;
		margin-bottom: 8px;
	}
	.thanks {
		font-size: 15px;
		color: #E8EDE9;
		font-weight: 500;
		margin-bottom: 32px;
	}
	.btn {
		display: inline-block;
		padding: 14px 36px;
		background: #51BE7B;
		color: #fff;
		font-family: 'Plus Jakarta Sans', sans-serif;
		font-size: 15px;
		font-weight: 600;
		border: none;
		border-radius: 10px;
		cursor: pointer;
		text-decoration: none;
		transition: background 0.2s ease, transform 0.1s ease;
	}
	.btn:hover { background: #45A86C; }
	.btn:active { transform: scale(0.98); }
	.divider {
		width: 100%;
		max-width: 400px;
		height: 1px;
		background: rgba(255,255,255,0.08);
		margin: 40px auto;
	}
	.contact {
		font-size: 14px;
		color: #607179;
		line-height: 1.7;
	}
	.contact a {
		color: #51BE7B;
		text-decoration: none;
	}
	.contact a:hover { text-decoration: underline; }
</style>
