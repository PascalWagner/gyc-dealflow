<svelte:head>
	<title>Home Hierarchy Mockup | GYC</title>
</svelte:head>

<script>
	const sidebarItems = [
		{ label: 'Home', active: true },
		{ label: 'Plan' },
		{ label: 'Deals', badge: '844' },
		{ label: 'Portfolio' },
		{ label: 'Resources', section: 'Support' },
		{ label: 'Office Hours' },
		{ label: 'Income Fund', section: 'Offerings' },
		{ label: 'Cash Flow Academy' }
	];

	const secondaryActions = [
		{
			title: 'You have 7 deals to review',
			copy: 'Pick one and work through the checklist.',
			link: 'Review Deals'
		},
		{
			title: 'Review your plan',
			copy: 'Keep your roadmap and next move aligned with what you are actually targeting.',
			link: 'Review Plan'
		},
		{
			title: 'Add a deal you are evaluating or already invested in',
			copy: 'Make sure it lands in the right place right away.',
			link: 'Add Deal'
		}
	];
</script>

<div class="mockup-shell">
	<aside class="sidebar">
		<div class="brand">Grow Your Cashflow</div>
		<nav class="sidebar-nav">
			{#each sidebarItems as item, index}
				{#if item.section}
					<div class="sidebar-section" class:sidebar-section--spaced={index > 0}>{item.section}</div>
				{/if}
				<div class:sidebar-link-active={item.active} class="sidebar-link">
					<span>{item.label}</span>
					{#if item.badge}
						<span class="sidebar-badge">{item.badge}</span>
					{/if}
				</div>
			{/each}
		</nav>
	</aside>

	<main class="mockup-main">
		<div class="page-header">
			<div>
				<h1>Home</h1>
				<p>Your dashboard for progress, priorities, and next actions.</p>
			</div>
			<div class="mockup-pill">Typography Hierarchy Mockup</div>
		</div>

		<section class="card card--coach">
			<div class="card-eyebrow">Your Investing Coach</div>
			<h2 class="card-title card-title--coach">Welcome back, Pascal.</h2>
			<p class="card-support card-support--strong">
				You’re building toward $100,000/yr in passive income.
			</p>
			<p class="card-meta">
				The fastest way to make progress is to browse deals that fit your plan.
			</p>
		</section>

		<section class="card">
			<div class="card-eyebrow">Passive Income Goal</div>
			<div class="goal-header">
				<div class="goal-value">$0 / $100,000 per year</div>
				<div class="goal-progress">0%</div>
			</div>
			<div class="goal-bar" aria-hidden="true">
				<div class="goal-bar-fill" style="width: 0%;"></div>
			</div>
			<div class="goal-meta">1 active investment · $545,000 deployed</div>
		</section>

		<section class="card card--action">
			<div class="card-eyebrow">What To Do Next</div>
			<div class="action-hero">
				<div class="action-copy">
					<h2 class="card-title card-title--action">5 deals ready to connect</h2>
					<p class="card-support">
						Request an intro with the operator. This is the clearest next move on your dashboard right now.
					</p>
				</div>
				<a class="action-button" href="/">Connect Now</a>
			</div>

			<div class="card-subhead">Also On Deck</div>
			<div class="action-list">
				{#each secondaryActions as action}
					<div class="action-row">
						<div class="action-row-copy">
							<div class="action-row-title">{action.title}</div>
							<div class="action-row-meta">{action.copy}</div>
						</div>
						<a class="action-row-link" href="/">{action.link} →</a>
					</div>
				{/each}
			</div>
		</section>
	</main>
</div>

<style>
	:global(body) {
		margin: 0;
		background: var(--bg-cream);
		color: var(--text-dark);
	}

	.mockup-shell {
		min-height: 100vh;
		display: grid;
		grid-template-columns: 248px minmax(0, 1fr);
	}

	.sidebar {
		background: var(--bg-sidebar);
		color: var(--text-sidebar);
		padding: 26px 0 22px;
		border-right: 1px solid rgba(255, 255, 255, 0.06);
	}

	.brand {
		padding: 0 16px 22px;
		font-family: var(--font-headline);
		font-size: 18px;
		line-height: 1.1;
		color: #fff;
	}

	.sidebar-nav {
		display: grid;
		gap: 2px;
	}

	.sidebar-section {
		padding: 20px 16px 8px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.6px;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.34);
	}

	.sidebar-section--spaced {
		padding-top: 28px;
	}

	.sidebar-link {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		font-family: var(--font-ui);
		font-size: 15px;
		color: inherit;
	}

	.sidebar-link-active {
		background: var(--bg-sidebar-active);
		color: #fff;
	}

	.sidebar-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 24px;
		height: 24px;
		padding: 0 8px;
		border-radius: 999px;
		background: var(--primary);
		color: #fff;
		font-size: 12px;
		font-weight: 800;
	}

	.mockup-main {
		padding: 28px 28px 56px;
		max-width: 1180px;
	}

	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 24px;
	}

	h1 {
		margin: 0;
		font-family: var(--font-headline);
		font-size: 40px;
		line-height: 1.05;
	}

	.page-header p {
		margin: 10px 0 0;
		font-family: var(--font-body);
		font-size: 18px;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.mockup-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 9px 14px;
		border-radius: 999px;
		background: rgba(81, 190, 123, 0.1);
		color: var(--primary);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.3px;
		white-space: nowrap;
	}

	.card {
		background: var(--surface-1);
		border: 1px solid var(--surface-border);
		border-radius: 24px;
		box-shadow: var(--surface-shadow);
		padding: 28px 32px;
		margin-bottom: 18px;
	}

	.card--coach {
		background: linear-gradient(135deg, rgba(81, 190, 123, 0.08), rgba(59, 130, 246, 0.04)), #fff;
		border-color: var(--surface-border-accent);
	}

	.card--action {
		padding-bottom: 10px;
	}

	.card-eyebrow,
	.card-subhead {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 1.5px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.card-eyebrow {
		margin-bottom: 14px;
	}

	.card--coach .card-eyebrow {
		color: var(--primary);
	}

	.card-title {
		margin: 0;
		color: var(--text-dark);
	}

	.card-title--coach {
		font-family: var(--font-headline);
		font-size: clamp(40px, 4.2vw, 54px);
		line-height: 0.98;
		letter-spacing: -0.5px;
	}

	.card-title--action {
		font-family: var(--font-ui);
		font-size: clamp(28px, 3vw, 38px);
		font-weight: 800;
		line-height: 1.05;
		letter-spacing: -0.4px;
	}

	.card-support {
		margin: 12px 0 0;
		font-family: var(--font-ui);
		font-size: 19px;
		line-height: 1.45;
		color: var(--text-dark);
	}

	.card-support--strong {
		font-weight: 600;
	}

	.card-meta {
		margin: 12px 0 0;
		max-width: 780px;
		font-family: var(--font-body);
		font-size: 17px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.goal-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 16px;
	}

	.goal-value {
		font-family: var(--font-ui);
		font-size: clamp(32px, 3.2vw, 44px);
		font-weight: 800;
		line-height: 1;
		letter-spacing: -0.7px;
		color: var(--text-dark);
	}

	.goal-progress {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 800;
		color: var(--primary);
	}

	.goal-bar {
		height: 12px;
		border-radius: 999px;
		background: var(--border-light);
		overflow: hidden;
	}

	.goal-bar-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #4db870, #45b86e);
	}

	.goal-meta {
		margin-top: 18px;
		padding-top: 18px;
		border-top: 1px solid var(--border-light);
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.5;
		color: var(--text-muted);
	}

	.action-hero {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 22px;
		margin-bottom: 24px;
	}

	.action-copy {
		max-width: 760px;
	}

	.action-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 14px 20px;
		border-radius: 14px;
		background: var(--primary);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		text-decoration: none;
		white-space: nowrap;
		box-shadow: 0 10px 24px rgba(81, 190, 123, 0.24);
	}

	.card-subhead {
		margin-bottom: 8px;
	}

	.action-list {
		border-top: 1px solid var(--border-light);
	}

	.action-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 18px;
		padding: 18px 0;
		border-bottom: 1px solid var(--border-light);
	}

	.action-row-copy {
		min-width: 0;
	}

	.action-row-title {
		font-family: var(--font-ui);
		font-size: 17px;
		font-weight: 700;
		line-height: 1.35;
		color: var(--text-dark);
	}

	.action-row-meta {
		margin-top: 4px;
		font-family: var(--font-body);
		font-size: 15px;
		line-height: 1.5;
		color: var(--text-secondary);
	}

	.action-row-link {
		flex-shrink: 0;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--primary);
		text-decoration: none;
		white-space: nowrap;
	}

	@media (max-width: 980px) {
		.mockup-shell {
			grid-template-columns: 1fr;
		}

		.sidebar {
			display: none;
		}

		.mockup-main {
			padding: 22px 16px 40px;
		}

		.page-header,
		.action-hero,
		.goal-header {
			flex-direction: column;
			align-items: flex-start;
		}

		.card {
			padding: 22px 20px;
			border-radius: 20px;
		}

		h1 {
			font-size: 34px;
		}

		.page-header p,
		.card-support,
		.card-meta {
			font-size: 16px;
		}

		.goal-value {
			font-size: 30px;
		}

		.action-button {
			width: 100%;
		}

		.action-row {
			flex-direction: column;
			align-items: flex-start;
		}
	}
</style>
