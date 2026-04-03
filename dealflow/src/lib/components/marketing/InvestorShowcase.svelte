<script>
	let { mode = 'hero' } = $props();

	const planStats = [
		{ label: 'Primary goal', value: '$120K/yr passive income' },
		{ label: 'Check size', value: '$100K to $150K' },
		{ label: 'Focus', value: 'Debt, self storage, multifamily' }
	];

	const matchedDeals = [
		{
			name: 'Blue Mesa Income Fund IV',
			sponsor: 'Blue Mesa Capital',
			match: '97% match',
			yield: '11.2% cash yield',
			status: 'Open'
		},
		{
			name: 'North Harbor Storage Fund',
			sponsor: 'North Harbor Partners',
			match: '93% match',
			yield: '8.5% pref + 17.0% IRR',
			status: 'Review'
		},
		{
			name: 'Summit Credit Opportunities',
			sponsor: 'Summit Credit',
			match: '91% match',
			yield: '10.4% target yield',
			status: 'New'
		}
	];

	const sponsorChecks = [
		{ label: 'Structure', value: '506(c) Form D on file' },
		{ label: 'Track record', value: '$420M AUM, 12 realized deals' },
		{ label: 'Focus', value: 'Private credit and income strategies' }
	];
</script>

<div class:compact={mode === 'compact'} class="showcase" aria-hidden="true">
	<div class="showcase-orb showcase-orb--top"></div>
	<div class="showcase-orb showcase-orb--bottom"></div>
	<div class="showcase-grid"></div>

	<div class="floating-pill floating-pill--top">838 live deals</div>
	<div class="floating-pill floating-pill--bottom">455 sponsors tracked</div>

	<section class="window window--main">
		<div class="window-chrome">
			<span></span>
			<span></span>
			<span></span>
		</div>
		<div class="window-body">
			<div class="window-kicker">Investor plan</div>
			<div class="window-heading-row">
				<div>
					<h3>Build your buy box first</h3>
					<p>See opportunities through your own goals, timeline, and check size.</p>
				</div>
				<div class="goal-chip">Free workflow</div>
			</div>

			<div class="plan-grid">
				{#each planStats as stat}
					<div class="plan-card">
						<div class="plan-label">{stat.label}</div>
						<div class="plan-value">{stat.value}</div>
					</div>
				{/each}
			</div>

			<div class="roadmap-shell">
				<div class="roadmap-header">
					<div class="roadmap-title">Recommended sequence</div>
					<div class="roadmap-note">Start with income and diversification</div>
				</div>
				<div class="roadmap-track">
					<div class="roadmap-step roadmap-step--active">
						<span>1</span>
						<div>
							<strong>Debt funds</strong>
							<small>Cash flow first</small>
						</div>
					</div>
					<div class="roadmap-step">
						<span>2</span>
						<div>
							<strong>Storage / multifamily</strong>
							<small>Blend yield and upside</small>
						</div>
					</div>
					<div class="roadmap-step">
						<span>3</span>
						<div>
							<strong>Tax-advantaged plays</strong>
							<small>Add selectively</small>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<section class="window window--matches">
		<div class="window-chrome">
			<span></span>
			<span></span>
			<span></span>
		</div>
		<div class="window-body window-body--dense">
			<div class="window-kicker">Matched deals</div>
			<h3 class="side-heading">What deserves diligence now</h3>
			<div class="match-list">
				{#each matchedDeals as deal}
					<div class="match-card">
						<div class="match-row">
							<div>
								<div class="match-name">{deal.name}</div>
								<div class="match-sponsor">{deal.sponsor}</div>
							</div>
							<div class="match-badge">{deal.match}</div>
						</div>
						<div class="match-yield">{deal.yield}</div>
						<div class={`match-status match-status--${deal.status.toLowerCase()}`}>{deal.status}</div>
					</div>
				{/each}
			</div>
		</div>
	</section>

	<section class="window window--sponsor">
		<div class="window-chrome">
			<span></span>
			<span></span>
			<span></span>
		</div>
		<div class="window-body window-body--dense">
			<div class="window-kicker">Sponsor snapshot</div>
			<div class="sponsor-header">
				<div class="sponsor-mark">NC</div>
				<div>
					<h3>North Harbor Partners</h3>
					<p>Income-oriented operator review</p>
				</div>
			</div>
			<div class="sponsor-checks">
				{#each sponsorChecks as item}
					<div class="sponsor-check">
						<div class="sponsor-check-label">{item.label}</div>
						<div class="sponsor-check-value">{item.value}</div>
					</div>
				{/each}
			</div>
		</div>
	</section>
</div>

<style>
	.showcase {
		position: relative;
		min-height: 640px;
		width: min(100%, 620px);
		margin-inline: auto;
		border-radius: 34px;
		background:
			radial-gradient(circle at top left, rgba(81, 190, 123, 0.16), transparent 34%),
			radial-gradient(circle at bottom right, rgba(59, 130, 246, 0.18), transparent 28%),
			linear-gradient(160deg, #0d2327 0%, #12353b 54%, #0d2327 100%);
		box-shadow: 0 32px 90px rgba(10, 30, 33, 0.28);
		overflow: hidden;
		isolation: isolate;
	}

	.showcase.compact {
		min-height: 520px;
		width: min(100%, 540px);
	}

	.showcase-grid {
		position: absolute;
		inset: 0;
		background-image:
			linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
		background-size: 44px 44px;
		mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.7), transparent 100%);
	}

	.showcase-orb {
		position: absolute;
		border-radius: 999px;
		filter: blur(18px);
		opacity: 0.75;
	}

	.showcase-orb--top {
		width: 220px;
		height: 220px;
		top: -40px;
		right: -30px;
		background: rgba(81, 190, 123, 0.16);
	}

	.showcase-orb--bottom {
		width: 260px;
		height: 260px;
		left: -60px;
		bottom: -90px;
		background: rgba(59, 130, 246, 0.14);
	}

	.window {
		position: absolute;
		border: 1px solid rgba(255, 255, 255, 0.18);
		border-radius: 24px;
		background: rgba(249, 250, 245, 0.98);
		box-shadow: 0 28px 60px rgba(2, 10, 12, 0.3);
		overflow: hidden;
	}

	.window--main {
		left: 26px;
		top: 54px;
		width: 70%;
		transform: rotate(-2deg);
	}

	.window--matches {
		top: 38px;
		right: 22px;
		width: 44%;
		transform: rotate(4deg);
	}

	.window--sponsor {
		left: 102px;
		bottom: 32px;
		width: 46%;
		transform: rotate(-4deg);
	}

	.compact .window--main {
		top: 46px;
		left: 18px;
		width: 72%;
	}

	.compact .window--matches {
		top: 28px;
		right: 18px;
		width: 46%;
	}

	.compact .window--sponsor {
		left: 78px;
		bottom: 24px;
		width: 48%;
	}

	.window-chrome {
		display: flex;
		gap: 6px;
		padding: 12px 14px;
		background: #22292c;
	}

	.window-chrome span {
		width: 10px;
		height: 10px;
		border-radius: 999px;
	}

	.window-chrome span:nth-child(1) {
		background: #ff5f57;
	}

	.window-chrome span:nth-child(2) {
		background: #ffbd2e;
	}

	.window-chrome span:nth-child(3) {
		background: #28ca41;
	}

	.window-body {
		display: grid;
		gap: 18px;
		padding: 22px;
		font-family: var(--font-ui);
	}

	.window-body--dense {
		gap: 14px;
		padding: 18px;
	}

	.window-kicker {
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.12em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.window-heading-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
	}

	.window-heading-row h3,
	.side-heading,
	.sponsor-header h3 {
		margin: 0;
		font-family: var(--font-headline);
		font-size: 28px;
		line-height: 1.02;
		color: var(--text-dark);
	}

	.side-heading,
	.sponsor-header h3 {
		font-size: 22px;
	}

	.window-heading-row p,
	.sponsor-header p {
		margin: 8px 0 0;
		font-size: 13px;
		line-height: 1.5;
		color: var(--text-secondary);
		max-width: 250px;
	}

	.goal-chip,
	.floating-pill,
	.match-badge,
	.match-status {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.01em;
	}

	.goal-chip {
		padding: 10px 14px;
		background: rgba(81, 190, 123, 0.12);
		color: #1b8a45;
		white-space: nowrap;
	}

	.plan-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.plan-card {
		padding: 14px;
		border-radius: 18px;
		background: #ffffff;
		border: 1px solid rgba(221, 229, 232, 0.9);
	}

	.plan-label {
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.plan-value {
		margin-top: 8px;
		font-size: 14px;
		font-weight: 700;
		line-height: 1.4;
		color: var(--text-dark);
	}

	.roadmap-shell {
		padding: 16px;
		border-radius: 20px;
		background: linear-gradient(145deg, #0f2a2e, #163b42);
		color: white;
	}

	.roadmap-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		margin-bottom: 14px;
	}

	.roadmap-title {
		font-size: 14px;
		font-weight: 800;
	}

	.roadmap-note {
		font-size: 11px;
		color: rgba(255, 255, 255, 0.72);
	}

	.roadmap-track {
		display: grid;
		gap: 10px;
	}

	.roadmap-step {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 10px 12px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.08);
	}

	.roadmap-step--active {
		background: rgba(81, 190, 123, 0.18);
	}

	.roadmap-step span {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 26px;
		height: 26px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.14);
		font-size: 12px;
		font-weight: 800;
	}

	.roadmap-step strong,
	.roadmap-step small {
		display: block;
	}

	.roadmap-step strong {
		font-size: 12px;
		font-weight: 700;
	}

	.roadmap-step small {
		margin-top: 2px;
		font-size: 11px;
		color: rgba(255, 255, 255, 0.72);
	}

	.match-list,
	.sponsor-checks {
		display: grid;
		gap: 10px;
	}

	.match-card,
	.sponsor-check {
		padding: 12px;
		border-radius: 16px;
		background: #ffffff;
		border: 1px solid rgba(221, 229, 232, 0.9);
	}

	.match-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 10px;
	}

	.match-name {
		font-size: 12px;
		font-weight: 800;
		line-height: 1.35;
		color: var(--text-dark);
	}

	.match-sponsor,
	.match-yield,
	.sponsor-check-label {
		font-size: 11px;
		line-height: 1.4;
		color: var(--text-secondary);
	}

	.match-yield {
		margin-top: 8px;
	}

	.match-badge {
		padding: 8px 10px;
		background: rgba(31, 81, 89, 0.08);
		color: var(--teal);
		white-space: nowrap;
	}

	.match-status {
		margin-top: 10px;
		padding: 6px 10px;
		background: rgba(81, 190, 123, 0.12);
		color: #1b8a45;
	}

	.match-status--review {
		background: rgba(245, 158, 11, 0.16);
		color: #a16207;
	}

	.match-status--new {
		background: rgba(59, 130, 246, 0.12);
		color: #1d4ed8;
	}

	.sponsor-header {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.sponsor-mark {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 42px;
		height: 42px;
		border-radius: 14px;
		background: linear-gradient(135deg, #10353b, #1f5159);
		color: white;
		font-size: 14px;
		font-weight: 800;
	}

	.sponsor-check-label {
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: var(--text-muted);
	}

	.sponsor-check-value {
		margin-top: 6px;
		font-size: 12px;
		font-weight: 700;
		line-height: 1.45;
		color: var(--text-dark);
	}

	.floating-pill {
		position: absolute;
		padding: 10px 14px;
		border: 1px solid rgba(255, 255, 255, 0.18);
		background: rgba(255, 255, 255, 0.1);
		backdrop-filter: blur(14px);
		color: white;
		box-shadow: 0 14px 30px rgba(2, 10, 12, 0.2);
		z-index: 2;
	}

	.floating-pill--top {
		right: 18px;
		top: 14px;
	}

	.floating-pill--bottom {
		left: 18px;
		bottom: 12px;
	}

	@media (max-width: 900px) {
		.showcase {
			min-height: 560px;
		}

		.window--main {
			left: 18px;
			width: 76%;
		}

		.window--matches {
			right: 18px;
			width: 50%;
		}

		.window--sponsor {
			left: 56px;
			width: 58%;
		}

		.window-heading-row h3 {
			font-size: 24px;
		}

		.plan-grid {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 640px) {
		.showcase,
		.showcase.compact {
			min-height: 520px;
			width: 100%;
		}

		.window--main {
			left: 14px;
			top: 58px;
			width: calc(100% - 116px);
		}

		.window--matches {
			top: 22px;
			right: 14px;
			width: 54%;
		}

		.window--sponsor {
			left: 36px;
			bottom: 22px;
			width: calc(100% - 110px);
		}

		.window-body {
			padding: 16px;
			gap: 14px;
		}

		.window-heading-row {
			flex-direction: column;
		}

		.window-heading-row h3,
		.side-heading,
		.sponsor-header h3 {
			font-size: 20px;
		}

		.floating-pill {
			font-size: 10px;
			padding: 8px 10px;
		}
	}
</style>
