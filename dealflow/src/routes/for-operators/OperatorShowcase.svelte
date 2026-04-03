<script>
	const navItems = ['Home', 'Profile', 'Opportunities', 'Audience', 'Pitches', 'Insights'];

	const summaryCards = [
		{ label: 'Qualified LPs', value: '1,024', note: 'Across active investor profiles' },
		{ label: 'Active interest', value: '34 saves', note: 'Across your live opportunities' },
		{ label: 'Next move', value: 'Friday pitch', note: 'One open showcase slot this week' }
	];

	const opportunities = [
		{ name: 'North Harbor Credit Fund', type: 'Private credit', signal: '212 matching investors' },
		{ name: 'Blue Mesa Income Fund', type: 'Debt fund', signal: '168 matching investors' },
		{ name: 'Summit Storage Income', type: 'Storage fund', signal: '147 matching investors' }
	];

	const audienceSignals = [
		{ label: 'Most active LP type', value: 'Business owners' },
		{ label: 'Common check size', value: '$50K to $250K' },
		{ label: 'Top strategy interest', value: 'Debt and income funds' },
		{ label: 'Best next action', value: 'Pitch slot available' }
	];

	const pipelineColumns = [
		{ label: 'Viewed', count: '412', items: ['Email alert', 'Browse feed', 'Saved list'] },
		{ label: 'Saved', count: '34', items: ['Blue Mesa', 'North Harbor', 'Summit Credit'] },
		{ label: 'Ready to intro', count: '11', items: ['Family office', 'Dental group', 'RIA client'] }
	];
</script>

<div class="showcase" aria-hidden="true">
	<div class="showcase-grid"></div>
	<div class="signal-chip">Distribution built in</div>

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
						<strong>Manager Workspace</strong>
						<small>Distribution, visibility, and investor signal</small>
					</div>
				</div>

				<div class="nav-list">
					{#each navItems as item, index}
						<div class:item-active={index === 2} class="nav-item">
							<span>{item}</span>
							{#if item === 'Opportunities'}
								<span class="nav-badge">3</span>
							{/if}
						</div>
					{/each}
				</div>

				<div class="access-card">
					<div class="nav-label">Audience</div>
					<div class="access-pill">Qualified LP network</div>
				</div>
			</aside>

			<div class="workspace-main">
				<div class="workspace-top">
					<div>
						<div class="workspace-kicker">Your reach</div>
						<h3>Get your deals in front of serious investors</h3>
						<p>Show up inside the same workflow investors already use to compare what fits.</p>
					</div>
					<div class="status-pill">Live distribution</div>
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
					<section class="panel">
						<div class="panel-head">
							<div>
								<div class="panel-kicker">Opportunities</div>
								<strong>Where qualified attention is building</strong>
							</div>
							<div class="panel-badge">3 live</div>
						</div>

						<div class="deal-list">
							{#each opportunities as item}
								<div class="deal-row">
									<div class="deal-copy">
										<div class="deal-name">{item.name}</div>
										<div class="deal-meta">{item.type}</div>
									</div>
									<div class="deal-signal">{item.signal}</div>
								</div>
							{/each}
						</div>
					</section>

					<section class="panel">
						<div class="panel-kicker">Audience signal</div>
						<div class="review-head">
							<div>
								<h4>How investors are seeing your deals</h4>
								<p>Better context before the first intro call.</p>
							</div>
						</div>

						<div class="signal-list">
							{#each audienceSignals as item}
								<div class="signal-row">
									<div class="signal-label">{item.label}</div>
									<div class="signal-value">{item.value}</div>
								</div>
							{/each}
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
			<div class="panel-kicker">Qualified attention</div>
			<strong>Know who is getting closer to a real conversation.</strong>

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
			radial-gradient(circle at top left, rgba(91, 200, 132, 0.16), transparent 36%),
			radial-gradient(circle at bottom right, rgba(83, 144, 255, 0.08), transparent 34%),
			linear-gradient(155deg, #17353c 0%, #1f4952 62%, #16333a 100%);
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

	.signal-chip {
		position: absolute;
		top: 24px;
		left: 24px;
		z-index: 2;
		padding: 10px 14px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		border: 1px solid rgba(255, 255, 255, 0.12);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 780;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.84);
	}

	.workspace-card,
	.pipeline-card {
		position: absolute;
		border-radius: 30px;
		background: rgba(248, 246, 239, 0.98);
		border: 1px solid rgba(255, 255, 255, 0.6);
		box-shadow: 0 24px 54px rgba(9, 18, 20, 0.18);
		overflow: hidden;
	}

	.workspace-card {
		top: 72px;
		left: 28px;
		right: 34px;
	}

	.pipeline-card {
		right: 26px;
		bottom: 26px;
		width: min(100%, 490px);
	}

	.window-bar {
		display: flex;
		gap: 8px;
		padding: 14px 16px;
		background: #1e282a;
	}

	.window-bar span {
		width: 10px;
		height: 10px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.18);
	}

	.window-bar span:nth-child(1) {
		background: #fb5f57;
	}

	.window-bar span:nth-child(2) {
		background: #fdbc2d;
	}

	.window-bar span:nth-child(3) {
		background: #28c840;
	}

	.workspace-shell {
		display: grid;
		grid-template-columns: 224px minmax(0, 1fr);
		min-height: 430px;
	}

	.workspace-nav {
		padding: 22px 18px 18px;
		background: rgba(236, 236, 232, 0.78);
		border-right: 1px solid rgba(16, 24, 22, 0.08);
	}

	.brand {
		display: flex;
		gap: 12px;
		align-items: flex-start;
	}

	.brand-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		border-radius: 12px;
		background: #0f2321;
		color: white;
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
	}

	.brand strong,
	.workspace-top h3,
	.review-head h4,
	.pipeline-body strong {
		font-family: var(--font-ui);
		font-weight: 800;
		letter-spacing: -0.04em;
		color: #111b18;
	}

	.brand strong {
		display: block;
		font-size: 16px;
	}

	.brand small,
	.workspace-top p,
	.review-head p,
	.summary-note,
	.deal-meta,
	.signal-label,
	.pipeline-label,
	.pipeline-chip,
	.panel-badge {
		font-family: var(--font-ui);
		font-size: 12px;
		line-height: 1.5;
		color: #66767b;
	}

	.nav-list {
		display: grid;
		gap: 8px;
		margin-top: 28px;
	}

	.nav-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 10px 12px;
		border-radius: 14px;
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: #4d5c61;
	}

	.item-active {
		background: white;
		color: #10221d;
		box-shadow: 0 8px 18px rgba(16, 24, 22, 0.06);
	}

	.nav-badge,
	.access-pill,
	.status-pill {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 7px 10px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
	}

	.nav-badge {
		background: rgba(91, 200, 132, 0.14);
		color: #2a8b54;
	}

	.access-card {
		margin-top: 22px;
		padding-top: 22px;
		border-top: 1px solid rgba(16, 24, 22, 0.08);
	}

	.nav-label,
	.workspace-kicker,
	.summary-label,
	.panel-kicker {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 780;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: #74848a;
	}

	.access-pill {
		margin-top: 10px;
		background: rgba(91, 200, 132, 0.16);
		color: #1e7c49;
	}

	.workspace-main {
		padding: 24px 24px 22px;
	}

	.workspace-top {
		display: flex;
		justify-content: space-between;
		gap: 16px;
		align-items: flex-start;
	}

	.workspace-kicker {
		margin-bottom: 10px;
	}

	.workspace-top h3 {
		font-size: 2.05rem;
		line-height: 0.96;
		max-width: 10.4ch;
	}

	.workspace-top p {
		margin: 12px 0 0;
		max-width: 28ch;
		font-size: 14px;
	}

	.status-pill {
		background: rgba(91, 200, 132, 0.14);
		color: #1c7d48;
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
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.86);
		border: 1px solid rgba(17, 27, 24, 0.08);
	}

	.summary-card {
		padding: 16px;
	}

	.summary-value {
		margin-top: 8px;
		font-family: var(--font-ui);
		font-size: 1.22rem;
		font-weight: 800;
		letter-spacing: -0.04em;
		color: #0f1715;
	}

	.content-grid {
		grid-template-columns: minmax(0, 1.06fr) minmax(0, 0.94fr);
		margin-top: 14px;
	}

	.panel {
		padding: 18px;
	}

	.panel-head,
	.review-head,
	.signal-row,
	.deal-row,
	.pipeline-head {
		display: flex;
		justify-content: space-between;
		gap: 12px;
		align-items: flex-start;
	}

	.panel-head strong {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 780;
		letter-spacing: -0.03em;
		color: #13201d;
	}

	.panel-badge {
		padding: 8px 10px;
		border-radius: 999px;
		background: rgba(18, 56, 64, 0.08);
		color: #2f4a4d;
		font-weight: 700;
	}

	.deal-list,
	.signal-list,
	.pipeline-items {
		display: grid;
		gap: 10px;
	}

	.deal-list,
	.signal-list {
		margin-top: 14px;
	}

	.deal-row,
	.signal-row {
		padding: 12px 0;
		border-top: 1px solid rgba(17, 27, 24, 0.08);
	}

	.deal-name,
	.signal-value,
	.pipeline-count {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 780;
		letter-spacing: -0.03em;
		color: #15211e;
	}

	.deal-signal {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: #2c864f;
		text-align: right;
	}

	.review-head h4 {
		font-size: 18px;
	}

	.review-head p {
		margin: 6px 0 0;
		font-size: 13px;
	}

	.pipeline-body {
		padding: 20px;
	}

	.pipeline-body strong {
		display: block;
		margin-top: 10px;
		font-size: 1.7rem;
		line-height: 1;
		max-width: 11ch;
	}

	.pipeline-grid {
		grid-template-columns: repeat(3, minmax(0, 1fr));
		margin-top: 18px;
	}

	.pipeline-column {
		padding: 14px;
	}

	.pipeline-head {
		align-items: baseline;
	}

	.pipeline-count {
		font-size: 1.45rem;
	}

	.pipeline-chip {
		padding: 8px 10px;
		border-radius: 12px;
		background: #f2efe8;
	}

	@media (max-width: 860px) {
		.showcase {
			min-height: 630px;
		}

		.workspace-card {
			left: 18px;
			right: 18px;
		}

		.pipeline-card {
			left: 52px;
			right: 18px;
			width: auto;
		}

		.workspace-shell,
		.content-grid,
		.summary-grid,
		.pipeline-grid {
			grid-template-columns: 1fr;
		}

		.workspace-nav {
			display: none;
		}

		.workspace-top h3 {
			font-size: 1.85rem;
		}
	}

	@media (max-width: 640px) {
		.showcase {
			min-height: 560px;
			border-radius: 28px;
		}

		.signal-chip {
			top: 18px;
			left: 18px;
			font-size: 10px;
		}

		.workspace-card {
			top: 58px;
		}

		.pipeline-card {
			left: 18px;
			bottom: 18px;
		}

		.workspace-main,
		.pipeline-body,
		.panel {
			padding: 16px;
		}

		.workspace-top {
			flex-direction: column;
		}

		.workspace-top h3 {
			font-size: 1.6rem;
		}

		.pipeline-body strong {
			font-size: 1.4rem;
		}
	}
</style>
