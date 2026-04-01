<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import DealReviewSidebar from '$lib/components/deal-review/DealReviewSidebar.svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';
	import PageHeader from '$lib/layout/PageHeader.svelte';

	const DEFAULT_DEAL_ID = '6706f492-1db4-4925-b562-9c5336217337';

	const mockViews = [
		{
			id: 'extract',
			step: 'Page 1 of 3',
			label: 'Extracted Risks',
			title: 'Review extracted risk findings',
			description: 'The system extracted these from the deck and PPM. You only accept, edit, or reject.'
		},
		{
			id: 'framing',
			step: 'Page 2 of 3',
			label: 'LP Framing',
			title: 'Approve the LP-facing risk structure',
			description: 'Accepted findings become structured tags and a concise LP summary.'
		},
		{
			id: 'coverage',
			step: 'Page 3 of 3',
			label: 'Source Coverage',
			title: 'Check what is actually supported',
			description: 'Before publish, every claim should be backed by a source or marked as missing.'
		}
	];

	const reviewStages = [
		{ id: 'intake', label: 'Intake', title: 'Source files attached' },
		{ id: 'sec', label: 'SEC', title: 'Issuer and filing verified' },
		{ id: 'team', label: 'Team', title: 'LP-facing contacts confirmed' },
		{ id: 'overview', label: 'Overview', title: 'Classification reviewed' },
		{ id: 'details', label: 'Key Details', title: 'Economics validated' },
		{ id: 'risks', label: 'Risk & Sources', title: 'Evidence and framing' },
		{ id: 'summary', label: 'Summary', title: 'Publish QA' }
	];

	const extractedRows = [
		{
			tag: 'Sponsor / execution',
			title: 'Key-person concentration',
			quote: 'The manager is highly dependent on Michael Anderson and a small senior team for sourcing and execution.',
			source: 'PPM §7.2 and deck page 18',
			state: 'Accepted'
		},
		{
			tag: 'Leverage / refinance',
			title: 'Refinance timing risk',
			quote: 'Projected returns assume refinance proceeds in year two and may be lower if rates stay elevated.',
			source: 'Deck page 11 and PPM risk factors',
			state: 'Needs edit'
		},
		{
			tag: 'Market / demand',
			title: 'Phoenix demand sensitivity',
			quote: 'The business plan depends on continued rent growth and demand resilience in the Phoenix submarket.',
			source: 'Deck page 7',
			state: 'Accepted'
		}
	];

	const acceptedRiskTags = [
		'Sponsor / execution',
		'Leverage / refinance',
		'Market / demand',
		'Liquidity',
		'Asset-specific downside'
	];

	const customRiskTags = ['Rate sensitivity'];

	const downsideProtections = [
		'Sponsor co-investment',
		'Reserve accounts',
		'Rate-cap strategy'
	];

	const coverageRows = [
		{
			label: 'Primary risks are explicitly disclosed',
			deck: 'Quoted',
			ppm: 'Quoted',
			sec: 'N/A',
			status: 'Ready'
		},
		{
			label: 'Downside protections are documented',
			deck: 'Implied',
			ppm: 'Quoted',
			sec: 'N/A',
			status: 'Partial'
		},
		{
			label: 'Operator background is source-backed',
			deck: 'Quoted',
			ppm: 'Missing',
			sec: 'N/A',
			status: 'Needs source'
		}
	];

	const publishGaps = [
		'Confirm whether the rate-cap language is contractual or only planned.',
		'Move operator background into extracted findings instead of freeform notes.',
		'Remove any LP-facing claim that has no direct supporting quote.'
	];

	const documentUrls = {
		deck: 'https://example.com/Capital-Fund-2-Capital-Fund-Deck-September-2025.pdf',
		ppm: 'https://example.com/Capital-Fund-2-PPM-CF2-Company-Documents.pdf'
	};

	const dealId = $derived($page.url.searchParams.get('id') || DEFAULT_DEAL_ID);
	const from = $derived($page.url.searchParams.get('from') || 'queue');
	const viewId = $derived.by(() => {
		const requested = $page.url.searchParams.get('view') || 'extract';
		return mockViews.some((view) => view.id === requested) ? requested : 'extract';
	});
	const activeView = $derived(mockViews.find((view) => view.id === viewId) || mockViews[0]);
	const activeViewIndex = $derived(mockViews.findIndex((view) => view.id === viewId));
	const previousView = $derived(activeViewIndex > 0 ? mockViews[activeViewIndex - 1] : null);
	const nextView = $derived(activeViewIndex < mockViews.length - 1 ? mockViews[activeViewIndex + 1] : null);

	function buildViewHref(nextViewId) {
		const params = new URLSearchParams($page.url.searchParams);
		params.set('view', nextViewId);
		params.set('from', from);
		if (dealId) params.set('id', dealId);
		return `/deal-review/risk-redesign?${params.toString()}`;
	}

	function buildStageHref(stageId) {
		if (stageId === 'risks') {
			return buildViewHref(viewId);
		}
		const params = new URLSearchParams();
		params.set('id', dealId);
		params.set('stage', stageId);
		if (stageId === 'intake') params.set('step', 'intake');
		if (stageId === 'summary') params.set('allowSummary', '1');
		params.set('from', from);
		return `/deal-review?${params.toString()}`;
	}

	function tone(value) {
		if (/accepted|ready|quoted/i.test(value)) return 'good';
		if (/edit|partial|implied/i.test(value)) return 'warn';
		if (/missing|needs/i.test(value)) return 'bad';
		return 'neutral';
	}
</script>

<PageContainer className="risk-redesign-page ly-page-stack">
	<PageHeader
		title="Risk Review Concept"
		subtitle="A much simpler Option A split: extraction review, LP framing, then source coverage."
		className="risk-redesign-header"
	>
		<div slot="actions" class="header-actions">
			<a class="ghost-btn" href={buildStageHref('details')}>Back to details</a>
		</div>
	</PageHeader>

	<div class="risk-redesign-layout">
		<div class="mock-stack">
			<nav class="mock-nav" aria-label="Risk redesign pages">
				{#each mockViews as view}
					<a
						class="mock-tab"
						class:is-active={view.id === viewId}
						href={buildViewHref(view.id)}
					>
						<span>{view.step}</span>
						<strong>{view.label}</strong>
					</a>
				{/each}
			</nav>

			<section class="page-intro">
				<div class="page-intro__eyebrow">{activeView.step}</div>
				<h2>{activeView.title}</h2>
				<p>{activeView.description}</p>
			</section>

			{#if viewId === 'extract'}
				<section class="main-card">
					<div class="section-heading">
						<h3>Extracted findings</h3>
						<p>Start with evidence. Nothing here begins as a blank field.</p>
					</div>

					<div class="row-list">
						{#each extractedRows as row}
							<article class="review-row">
								<div class="review-row__meta">
									<span class="row-tag">{row.tag}</span>
									<span class={`pill pill--${tone(row.state)}`}>{row.state}</span>
								</div>
								<h4>{row.title}</h4>
								<p class="row-quote">{row.quote}</p>
								<div class="row-source">{row.source}</div>
								<div class="row-actions">
									<button type="button" class="chip chip--active">Accept</button>
									<button type="button" class="chip">Edit</button>
									<button type="button" class="chip">Reject</button>
								</div>
							</article>
						{/each}
					</div>
				</section>

				<section class="support-card">
					<h3>What this replaces</h3>
					<p>No more giant risk textarea first. The reviewer starts by resolving extracted rows one by one.</p>
				</section>
			{:else if viewId === 'framing'}
				<section class="main-card">
					<div class="section-heading">
						<h3>Primary risk tags</h3>
						<p>Accepted findings roll into a structured taxonomy. You only adjust if the mapping feels wrong.</p>
					</div>

					<div class="token-group">
						{#each acceptedRiskTags as tag}
							<span class="token token--selected">{tag}</span>
						{/each}
						{#each customRiskTags as tag}
							<span class="token">{tag}</span>
						{/each}
						<button type="button" class="chip">Add custom risk</button>
					</div>

					<div class="mini-section">
						<h4>Downside protections</h4>
						<div class="token-group">
							{#each downsideProtections as item}
								<span class="token token--soft">{item}</span>
							{/each}
						</div>
					</div>

					<div class="mini-section">
						<h4>Generated LP-facing summary</h4>
						<div class="summary-box">
							This deal depends on execution against a refinance-driven plan in Phoenix. The main risks are sponsor concentration, rate sensitivity, and market-demand assumptions; downside support comes from sponsor alignment and reserves.
						</div>
					</div>
				</section>

				<section class="support-card">
					<h3>What this replaces</h3>
					<p>Instead of typing long-form risk notes, you approve risk tags, downside protections, and one generated summary.</p>
				</section>
			{:else}
				<section class="main-card">
					<div class="section-heading">
						<h3>Coverage matrix</h3>
						<p>Every publishable claim should be visibly backed by a source.</p>
					</div>

					<div class="matrix">
						<div class="matrix__head">
							<span>Claim</span>
							<span>Deck</span>
							<span>PPM</span>
							<span>SEC</span>
							<span>Status</span>
						</div>
						{#each coverageRows as row}
							<div class="matrix__row">
								<strong>{row.label}</strong>
								<span class={`pill pill--${tone(row.deck)}`}>{row.deck}</span>
								<span class={`pill pill--${tone(row.ppm)}`}>{row.ppm}</span>
								<span class={`pill pill--${tone(row.sec)}`}>{row.sec}</span>
								<span class={`pill pill--${tone(row.status)}`}>{row.status}</span>
							</div>
						{/each}
					</div>
				</section>

				<section class="support-card">
					<h3>Blocks before publish</h3>
					<ul>
						{#each publishGaps as gap}
							<li>{gap}</li>
						{/each}
					</ul>
				</section>
			{/if}

			<div class="footer-actions">
				{#if previousView}
					<a class="ghost-btn" href={buildViewHref(previousView.id)}>Previous</a>
				{:else}
					<span></span>
				{/if}

				{#if nextView}
					<a class="primary-btn" href={buildViewHref(nextView.id)}>Next</a>
				{:else}
					<a class="primary-btn" href={buildStageHref('summary')}>Continue to summary</a>
				{/if}
			</div>
		</div>

		<DealReviewSidebar
			stages={reviewStages}
			currentStage="risks"
			completedStages={['intake', 'sec', 'team', 'overview', 'details']}
			accessibleStages={reviewStages.map((stage) => stage.id)}
			onselect={(stageId) => goto(buildStageHref(stageId))}
			deckUrl={documentUrls.deck}
			ppmUrl={documentUrls.ppm}
			extractionState="success"
		/>
	</div>
</PageContainer>

<style>
	.header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
	}

	.risk-redesign-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 340px);
		gap: 26px;
		align-items: start;
	}

	.mock-stack {
		display: grid;
		gap: 16px;
	}

	.mock-nav {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.mock-tab {
		display: grid;
		gap: 4px;
		padding: 14px 16px;
		border-radius: 18px;
		text-decoration: none;
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid rgba(31, 81, 89, 0.08);
		color: inherit;
	}

	.mock-tab span,
	.page-intro__eyebrow,
	.row-tag {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.mock-tab strong {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.mock-tab.is-active {
		border-color: rgba(81, 190, 123, 0.34);
		background: rgba(248, 252, 248, 0.92);
	}

	.page-intro,
	.main-card,
	.support-card {
		padding: 22px;
		border-radius: 24px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.9);
		box-shadow: 0 14px 30px rgba(16, 37, 42, 0.04);
	}

	.page-intro h2,
	.section-heading h3,
	.support-card h3,
	.review-row h4,
	.mini-section h4 {
		margin: 0;
		font-family: var(--font-ui);
		color: var(--text-dark);
	}

	.page-intro h2 {
		margin-top: 8px;
		font-size: 34px;
		line-height: 1.02;
		letter-spacing: -0.04em;
	}

	.page-intro p,
	.section-heading p,
	.support-card p,
	.review-row p,
	.support-card li,
	.summary-box,
	.row-source {
		margin: 0;
		font-size: 14px;
		line-height: 1.55;
		color: var(--text-secondary);
	}

	.section-heading {
		display: grid;
		gap: 4px;
		margin-bottom: 16px;
	}

	.row-list {
		display: grid;
		gap: 14px;
	}

	.review-row {
		display: grid;
		gap: 10px;
		padding: 16px 0;
		border-top: 1px solid rgba(31, 81, 89, 0.08);
	}

	.review-row:first-child {
		padding-top: 0;
		border-top: none;
	}

	.review-row__meta,
	.row-actions,
	.footer-actions {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 10px;
		flex-wrap: wrap;
	}

	.review-row h4 {
		font-size: 20px;
		line-height: 1.08;
		letter-spacing: -0.03em;
	}

	.row-quote {
		color: var(--text-dark);
	}

	.pill,
	.token,
	.chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 7px 11px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		border: 1px solid rgba(31, 81, 89, 0.1);
		background: rgba(255, 255, 255, 0.82);
		color: var(--text-dark);
	}

	.pill--good,
	.chip--active,
	.token--selected {
		background: rgba(81, 190, 123, 0.12);
		color: #166a45;
		border-color: rgba(81, 190, 123, 0.22);
	}

	.pill--warn {
		background: rgba(241, 177, 78, 0.16);
		color: #9a5d10;
		border-color: rgba(241, 177, 78, 0.24);
	}

	.pill--bad {
		background: rgba(180, 35, 40, 0.08);
		color: #912429;
		border-color: rgba(180, 35, 40, 0.14);
	}

	.token-group {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.token--soft {
		background: rgba(31, 81, 89, 0.06);
	}

	.mini-section {
		display: grid;
		gap: 10px;
		margin-top: 18px;
	}

	.summary-box {
		padding: 14px 16px;
		border-radius: 16px;
		background: rgba(247, 249, 244, 0.95);
		border: 1px solid rgba(31, 81, 89, 0.08);
		color: var(--text-dark);
	}

	.matrix {
		display: grid;
		gap: 10px;
	}

	.matrix__head,
	.matrix__row {
		display: grid;
		grid-template-columns: minmax(0, 2fr) repeat(4, minmax(0, 0.8fr));
		gap: 10px;
		align-items: center;
	}

	.matrix__head {
		padding: 0 2px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.matrix__row {
		padding: 14px 0;
		border-top: 1px solid rgba(31, 81, 89, 0.08);
	}

	.matrix__row:first-of-type {
		border-top: none;
	}

	.matrix__row strong {
		font-size: 14px;
		line-height: 1.45;
		color: var(--text-dark);
	}

	.support-card ul {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 10px;
	}

	.ghost-btn,
	.primary-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 11px 16px;
		border-radius: 999px;
		border: 1px solid rgba(31, 81, 89, 0.12);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		text-decoration: none;
	}

	.ghost-btn {
		background: rgba(255, 255, 255, 0.82);
		color: var(--text-dark);
	}

	.primary-btn {
		background: linear-gradient(135deg, rgba(31, 81, 89, 0.98), rgba(22, 60, 66, 0.98));
		color: #fff;
		border-color: transparent;
	}

	@media (max-width: 1100px) {
		.risk-redesign-layout {
			grid-template-columns: 1fr;
		}

		.mock-nav,
		.matrix__head,
		.matrix__row {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.page-intro h2 {
			font-size: 28px;
		}

		.page-intro,
		.main-card,
		.support-card {
			padding: 18px;
			border-radius: 20px;
		}

		.footer-actions {
			flex-direction: column;
			align-items: stretch;
		}

		.ghost-btn,
		.primary-btn {
			width: 100%;
		}
	}
</style>
