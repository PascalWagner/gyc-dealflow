<script>
	const navGroups = [
		{
			label: '',
			items: [
				{ label: 'Home' },
				{ label: 'Plan', active: true },
				{ label: 'Deals', badge: '838' },
				{ label: 'Saved' },
				{ label: 'Portfolio' }
			]
		},
		{
			label: 'Resources',
			items: [{ label: 'Library' }, { label: 'Office Hours' }]
		}
	];

	const summaryCards = [
		{ label: 'Income goal', value: '$100K / year', note: 'Passive income target' },
		{ label: 'Timeline', value: '3 to 5 years', note: 'Deployment window' },
		{ label: 'Next move', value: '2 deals shortlisted', note: 'Blue Mesa + North Harbor' }
	];

	const matchedDeals = [
		{
			name: 'Blue Mesa Income Fund IV',
			type: 'Private credit',
			yield: '11.2% cash income',
			fit: '97%'
		},
		{
			name: 'North Harbor Storage Fund',
			type: 'Storage',
			yield: '8.5% base + upside',
			fit: '93%'
		},
		{
			name: 'Summit Credit Opportunities',
			type: 'Debt fund',
			yield: '10.4% target income',
			fit: '91%'
		}
	];

	const diligenceChecks = [
		{ label: 'SEC filing', value: '506(c) filed', tone: 'good' },
		{ label: 'Operator history', value: '$420M managed', tone: 'good' },
		{ label: 'First-loss capital', value: '4.0% GP capital', tone: 'good' },
		{ label: 'Main risk', value: 'Short track record', tone: 'watch' }
	];

	const questions = [
		'What happens if defaults spike for two quarters?',
		'How much principal sits ahead of LP capital?',
		'What changed from the last fund vintage?'
	];

	const pipelineColumns = [
		{
			label: 'Saved',
			count: '12',
			items: ['Blue Mesa', 'Summit Credit', 'Cedar Ridge']
		},
		{
			label: 'In review',
			count: '4',
			items: ['North Harbor', 'Harbor Lending']
		},
		{
			label: 'Ready to call',
			count: '2',
			items: ['North Harbor GP']
		}
	];
</script>

<div class="showcase" aria-hidden="true">
	<div class="showcase-grid"></div>
	<div class="showcase-glow showcase-glow--top"></div>
	<div class="showcase-glow showcase-glow--bottom"></div>
	<div class="signal-chip">Plan before the pitch</div>

	<section class="workspace-card">
		<div class="window-bar">
			<span></span>
			<span></span>
			<span></span>
		</div>

		<div class="workspace-shell">
			<aside class="workspace-nav">
				<div class="brand">
					<div class="brand-mark">G</div>
					<div>
						<strong>Investor Workspace</strong>
						<small>Plan, deals, and diligence in one place</small>
					</div>
				</div>

				{#each navGroups as group}
					<div class="nav-group">
						{#if group.label}
							<div class="nav-label">{group.label}</div>
						{/if}

						<div class="nav-list">
							{#each group.items as item}
								<div class:item-active={item.active} class="nav-item">
									<span>{item.label}</span>
									{#if item.badge}
										<span class="nav-badge">{item.badge}</span>
									{/if}
								</div>
							{/each}
						</div>
					</div>
				{/each}

				<div class="access-card">
					<div class="nav-label">Access</div>
					<div class="access-pill">Free</div>
				</div>
			</aside>

			<div class="workspace-main">
				<div class="workspace-top">
					<div>
						<div class="workspace-kicker">Your process</div>
						<h3>Build your income plan</h3>
						<p>See what fits, review what matters, and know your next move.</p>
					</div>
					<div class="status-pill">Live workspace</div>
				</div>

				<div class="summary-grid">
					{#each summaryCards as item}
						<div class="summary-card">
							<div class="summary-label">{item.label}</div>
							<div class="summary-value">{item.value}</div>
							<div class="summary-note">{item.note}</div>
						</div>
					{/each}
				</div>

				<div class="content-grid">
					<section class="panel panel--matches">
						<div class="panel-head">
							<div>
								<div class="panel-kicker">Deals that fit</div>
								<strong>What to review next</strong>
							</div>
							<div class="panel-badge">838 live deals</div>
						</div>

						<div class="deal-list">
							{#each matchedDeals as item}
								<div class="deal-row">
									<div class="deal-copy">
										<div class="deal-name">{item.name}</div>
										<div class="deal-meta">{item.type} · {item.yield}</div>
									</div>
									<div class="fit-pill">{item.fit}</div>
								</div>
							{/each}
						</div>
					</section>

					<section class="panel panel--review">
						<div class="panel-kicker">Manager review</div>
						<div class="review-head">
							<div>
								<h4>North Harbor Partners</h4>
								<p>Quick diligence view before you take the pitch call.</p>
							</div>
							<div class="score-card">
								<span>Fit</span>
								<strong>93</strong>
							</div>
						</div>

						<div class="check-list">
							{#each diligenceChecks as item}
								<div class="check-row">
									<div>
										<div class="check-label">{item.label}</div>
										<div class="check-value">{item.value}</div>
									</div>
									<div class:check-dot--watch={item.tone === 'watch'} class="check-dot"></div>
								</div>
							{/each}
						</div>

						<div class="question-block">
							<div class="question-title">Questions to ask</div>
							<ul>
								{#each questions as item}
									<li>{item}</li>
								{/each}
							</ul>
						</div>
					</section>
				</div>
			</div>
		</div>
	</section>

	<section class="pipeline-card">
		<div class="window-bar">
			<span></span>
			<span></span>
			<span></span>
		</div>
		<div class="pipeline-body">
			<div class="panel-kicker">Saved pipeline</div>
			<strong>Know what deserves your time.</strong>
			<div class="pipeline-grid">
				{#each pipelineColumns as column}
					<div class="pipeline-column">
						<div class="pipeline-head">
							<div class="pipeline-count">{column.count}</div>
							<div class="pipeline-label">{column.label}</div>
						</div>
						<div class="pipeline-items">
							{#each column.items as item}
								<div class="pipeline-chip">{item}</div>
							{/each}
						</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
</div>

<style>
	.showcase {
		position: relative;
		min-height: 700px;
		width: min(100%, 680px);
		margin-inline: auto;
		border-radius: 38px;
		background:
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.18), transparent 34%),
			radial-gradient(circle at bottom right, rgba(83, 144, 255, 0.1), transparent 36%),
			linear-gradient(155deg, #16333a 0%, #1c4952 62%, #17353c 100%);
		box-shadow: 0 34px 86px rgba(12, 28, 31, 0.2);
		overflow: hidden;
		isolation: isolate;
	}

	.showcase-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.04) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
		background-size: 42px 42px;
		mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.74), transparent 100%);
	}

	.showcase-glow {
		position: absolute;
		border-radius: 999px;
		filter: blur(26px);
		opacity: 0.75;
	}

	.showcase-glow--top {
		top: -42px;
		right: -36px;
		width: 220px;
		height: 220px;
		background: rgba(91, 200, 132, 0.16);
	}

	.showcase-glow--bottom {
		left: -58px;
		bottom: -66px;
		width: 250px;
		height: 250px;
		background: rgba(82, 144, 255, 0.14);
	}

	.signal-chip {
		position: absolute;
		top: 24px;
		left: 28px;
		display: inline-flex;
		align-items: center;
		padding: 10px 14px;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(255, 255, 255, 0.16);
		backdrop-filter: blur(12px);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 820;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: white;
	}

	.workspace-card,
	.pipeline-card {
		position: absolute;
		overflow: hidden;
		border-radius: 28px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(248, 249, 244, 0.98);
		box-shadow: 0 24px 60px rgba(4, 10, 12, 0.22);
	}

	.workspace-card {
		inset: 52px 24px 126px 24px;
	}

	.pipeline-card {
		left: 44px;
		right: 170px;
		bottom: 28px;
		transform: rotate(-1.2deg);
	}

	.window-bar {
		display: flex;
		gap: 6px;
		padding: 13px 16px;
		background: #1f282b;
	}

	.window-bar span {
		width: 10px;
		height: 10px;
		border-radius: 999px;
	}

	.window-bar span:nth-child(1) {
		background: #ff5f57;
	}

	.window-bar span:nth-child(2) {
		background: #ffbd2e;
	}

	.window-bar span:nth-child(3) {
		background: #28ca41;
	}

	.workspace-shell {
		display: grid;
		grid-template-columns: 180px minmax(0, 1fr);
		min-height: 100%;
	}

	.workspace-nav {
		padding: 18px 16px;
		background: rgba(14, 33, 38, 0.04);
		border-right: 1px solid rgba(17, 31, 28, 0.08);
	}

	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
		font-family: var(--font-ui);
	}

	.brand strong,
	.pipeline-body strong,
	.panel-head strong {
		display: block;
		font-family: var(--font-ui);
		font-weight: 820;
		color: #13272c;
	}

	.brand small {
		display: block;
		margin-top: 4px;
		font-size: 12px;
		color: #66757b;
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 38px;
		height: 38px;
		border-radius: 12px;
		background: #123840;
		color: white;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 820;
	}

	.nav-group {
		margin-top: 22px;
	}

	.nav-label {
		margin-bottom: 10px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 820;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #758389;
	}

	.nav-list {
		display: grid;
		gap: 10px;
	}

	.nav-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
		padding: 11px 12px;
		border-radius: 14px;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 720;
		color: #435359;
	}

	.item-active {
		background: rgba(91, 200, 132, 0.16);
		color: #26593a;
	}

	.nav-badge,
	.access-pill,
	.panel-badge,
	.fit-pill,
	.status-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 7px 10px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 820;
	}

	.nav-badge,
	.access-pill,
	.panel-badge {
		background: rgba(18, 56, 64, 0.08);
		color: #123840;
	}

	.access-card {
		margin-top: 24px;
		padding-top: 18px;
		border-top: 1px solid rgba(17, 31, 28, 0.08);
	}

	.workspace-main {
		padding: 22px;
	}

	.workspace-top,
	.panel-head,
	.review-head,
	.pipeline-head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14px;
	}

	.workspace-kicker,
	.panel-kicker,
	.summary-label,
	.check-label,
	.pipeline-label,
	.question-title {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 820;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #75848a;
	}

	.workspace-top h3,
	.review-head h4 {
		margin: 10px 0 0;
		font-family: var(--font-ui);
		font-weight: 820;
		letter-spacing: -0.045em;
		color: #13272c;
	}

	.workspace-top h3 {
		font-size: 34px;
		line-height: 1;
	}

	.review-head h4 {
		font-size: 22px;
		line-height: 1.05;
	}

	.workspace-top p,
	.review-head p,
	.summary-note,
	.deal-meta,
	.check-value,
	.question-block li {
		margin: 10px 0 0;
		font-family: var(--font-ui);
		font-size: 14px;
		line-height: 1.5;
		color: #56676d;
	}

	.status-pill {
		background: rgba(91, 200, 132, 0.16);
		color: #2a663d;
	}

	.summary-grid,
	.content-grid,
	.pipeline-grid {
		display: grid;
		gap: 14px;
	}

	.summary-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 20px;
	}

	.summary-card,
	.panel,
	.pipeline-column {
		border-radius: 20px;
		border: 1px solid rgba(17, 31, 28, 0.08);
		background: white;
	}

	.summary-card {
		padding: 14px;
	}

	.summary-value,
	.pipeline-count,
	.score-card strong {
		margin-top: 8px;
		font-family: var(--font-ui);
		font-size: 22px;
		font-weight: 820;
		line-height: 1.1;
		color: #13272c;
	}

	.content-grid {
		grid-template-columns: minmax(0, 1.08fr) minmax(0, 0.92fr);
		margin-top: 16px;
	}

	.panel {
		padding: 16px;
	}

	.deal-list,
	.check-list {
		display: grid;
		gap: 12px;
		margin-top: 16px;
	}

	.deal-row,
	.check-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		padding: 14px;
		border-radius: 16px;
		background: rgba(248, 249, 244, 0.94);
		border: 1px solid rgba(17, 31, 28, 0.08);
	}

	.deal-name {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 820;
		color: #13272c;
	}

	.fit-pill {
		background: rgba(91, 200, 132, 0.16);
		color: #2f9e60;
	}

	.score-card {
		display: inline-flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		width: 62px;
		height: 62px;
		border-radius: 18px;
		background: rgba(91, 200, 132, 0.16);
	}

	.score-card span {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 820;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: #6e7f85;
	}

	.check-dot {
		width: 12px;
		height: 12px;
		border-radius: 999px;
		background: #5bc884;
	}

	.check-dot--watch {
		background: #ffbd2e;
	}

	.question-block {
		margin-top: 16px;
		padding-top: 16px;
		border-top: 1px solid rgba(17, 31, 28, 0.08);
	}

	.question-block ul {
		display: grid;
		gap: 8px;
		margin: 12px 0 0;
		padding-left: 18px;
	}

	.pipeline-body {
		padding: 16px;
	}

	.pipeline-body strong {
		margin-top: 10px;
		font-size: 20px;
		line-height: 1.08;
	}

	.pipeline-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 14px;
	}

	.pipeline-column {
		padding: 14px 12px;
	}

	.pipeline-items {
		display: grid;
		gap: 8px;
		margin-top: 12px;
	}

	.pipeline-chip {
		padding: 8px 10px;
		border-radius: 12px;
		background: rgba(248, 249, 244, 0.94);
		border: 1px solid rgba(17, 31, 28, 0.08);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 720;
		color: #445359;
	}

	@media (max-width: 920px) {
		.showcase {
			min-height: 620px;
			width: min(100%, 600px);
		}

		.workspace-card {
			inset: 46px 18px 112px 18px;
		}

		.pipeline-card {
			left: 24px;
			right: 120px;
		}

		.workspace-shell {
			grid-template-columns: 152px minmax(0, 1fr);
		}

		.workspace-top h3 {
			font-size: 30px;
		}

		.summary-grid,
		.content-grid,
		.pipeline-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.showcase {
			min-height: 560px;
			width: 100%;
			border-radius: 30px;
		}

		.signal-chip {
			left: 18px;
			top: 18px;
		}

		.workspace-card {
			inset: 44px 12px 124px 12px;
		}

		.pipeline-card {
			left: 16px;
			right: 16px;
			bottom: 18px;
			transform: none;
		}

		.workspace-shell {
			grid-template-columns: 1fr;
		}

		.workspace-nav {
			display: none;
		}

		.workspace-main {
			padding: 18px;
		}

		.workspace-top h3 {
			font-size: 26px;
		}
	}
</style>
