<script>
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
			title: 'Review what the documents actually say',
			description: 'Every row starts with extracted evidence from the deck, PPM, or SEC. The reviewer only accepts, edits, or rejects.'
		},
		{
			id: 'framing',
			step: 'Page 2 of 3',
			label: 'LP Risk Framing',
			title: 'Approve the LP-facing risk structure',
			description: 'Turn accepted findings into structured tags, downside framing, and a concise LP-ready summary without writing from scratch.'
		},
		{
			id: 'coverage',
			step: 'Page 3 of 3',
			label: 'Source Coverage',
			title: 'Confirm what is actually backed by evidence',
			description: 'The last pass is an evidence audit: which claims are quoted, implied, or still unsupported before publish.'
		}
	];

	const reviewStages = [
		{ id: 'intake', label: 'Intake', title: 'Source files attached' },
		{ id: 'sec', label: 'SEC', title: 'Issuer and filing verified' },
		{ id: 'team', label: 'Team', title: 'LP-facing contacts confirmed' },
		{ id: 'overview', label: 'Overview', title: 'Classification and summary reviewed' },
		{ id: 'details', label: 'Key Details', title: 'Economics and terms validated' },
		{ id: 'risks', label: 'Risk & Sources', title: 'Evidence, framing, and coverage' },
		{ id: 'summary', label: 'Summary', title: 'Publish QA' }
	];

	const jobsToBeDone = [
		'Validate extracted findings instead of typing blank fields.',
		'Approve LP-facing risk tags and downside framing from source-backed suggestions.',
		'Spot unsupported claims before anything is publishable.'
	];

	const extractedFindings = [
		{
			category: 'Sponsor / execution',
			title: 'Key-person concentration around Michael Anderson',
			confidence: 'High confidence',
			status: 'Accepted',
			statusTone: 'accepted',
			sourceSet: ['PPM', 'Deck'],
			sourceLine: 'PPM §7.2, deck page 18',
			quote: '"The Manager and its affiliates are highly dependent on Michael Anderson and a small senior team for sourcing, underwriting, and execution."',
			rationale: 'Good auto-detected risk because it is explicit, investor-relevant, and repeated across both docs.',
			nextAction: 'Maps to primary risk tag: Key person'
		},
		{
			category: 'Leverage / refinance',
			title: 'Refinance timing depends on rate environment',
			confidence: 'Medium confidence',
			status: 'Needs reviewer edit',
			statusTone: 'review',
			sourceSet: ['Deck', 'PPM'],
			sourceLine: 'Deck page 11, PPM risk factors',
			quote: '"Returns assume refinance proceeds in year two. If rates remain elevated, distributions and projected IRR may be lower."',
			rationale: 'The signal is correct, but the wording should be tightened before it becomes LP-facing copy.',
			nextAction: 'Revise wording, then accept as Leverage / refinance'
		},
		{
			category: 'Market / demand',
			title: 'Phoenix rent-growth assumptions may compress',
			confidence: 'High confidence',
			status: 'Accepted',
			statusTone: 'accepted',
			sourceSet: ['Deck'],
			sourceLine: 'Deck page 7 underwriting assumptions',
			quote: '"The business plan depends on continued demand resilience and rent growth in the Phoenix submarket."',
			rationale: 'This is a clean market-risk extraction with clear geographic scope.',
			nextAction: 'Accepted into LP-facing risk structure'
		},
		{
			category: 'Downside protection',
			title: 'Sponsor co-investment reduces first-loss concern',
			confidence: 'Medium confidence',
			status: 'Rejected from risk list',
			statusTone: 'rejected',
			sourceSet: ['PPM'],
			sourceLine: 'PPM alignment section',
			quote: '"The sponsor expects to invest alongside LPs."',
			rationale: 'Useful, but this belongs in downside protections instead of primary risks.',
			nextAction: 'Move to downside protection signal'
		}
	];

	const taxonomies = [
		{ label: 'Market / demand', state: 'selected' },
		{ label: 'Sponsor / execution', state: 'selected' },
		{ label: 'Leverage / refinance', state: 'selected' },
		{ label: 'Liquidity', state: 'selected' },
		{ label: 'Concentration', state: 'idle' },
		{ label: 'Construction / capex', state: 'idle' },
		{ label: 'Tenant / occupancy', state: 'idle' },
		{ label: 'Regulatory / legal', state: 'idle' },
		{ label: 'Fund structure / fees', state: 'idle' },
		{ label: 'Key person', state: 'selected' },
		{ label: 'Geographic concentration', state: 'idle' },
		{ label: 'Asset-specific downside', state: 'selected' }
	];

	const customTags = ['Rate sensitivity', 'Phoenix lease-up risk'];

	const downsideProtections = [
		{
			label: 'Sponsor co-investment',
			detail: 'PPM and deck both reference sponsor capital alongside LPs.',
			source: 'PPM + Deck',
			state: 'accepted'
		},
		{
			label: 'Interest-rate cap / hedge',
			detail: 'Deck references a rate-cap strategy, but the exact structure should be verified.',
			source: 'Deck only',
			state: 'review'
		},
		{
			label: 'Cash reserve and capex reserve',
			detail: 'PPM shows reserves; good candidate to display as downside context instead of prose.',
			source: 'PPM',
			state: 'accepted'
		}
	];

	const framingSections = [
		{
			label: 'Primary risks',
			value: 'Sponsor execution, leverage / refinance, market demand, asset-specific downside, liquidity',
			helper: 'Structured taxonomy first, custom add-ons second.'
		},
		{
			label: 'Downside protections',
			value: 'Sponsor co-investment, reserve accounts, rate-cap strategy',
			helper: 'These should come from extracted evidence, not new typing.'
		},
		{
			label: 'LP-facing summary',
			value: 'This deal depends on execution against a refinance-driven business plan in Phoenix. The main risks are sponsor concentration, rate sensitivity, and lease-up assumptions; downside support comes from sponsor alignment and reserves.',
			helper: 'Auto-generated from accepted findings, editable only as a last resort.'
		}
	];

	const coverageRows = [
		{
			claim: 'Primary risks are explicitly disclosed',
			deck: 'Quoted',
			ppm: 'Quoted',
			sec: 'Not relevant',
			status: 'ready'
		},
		{
			claim: 'Downside protections are documented',
			deck: 'Implied',
			ppm: 'Quoted',
			sec: 'Not relevant',
			status: 'partial'
		},
		{
			claim: 'Operator background / track record is source-backed',
			deck: 'Quoted',
			ppm: 'Missing',
			sec: 'Not relevant',
			status: 'partial'
		},
		{
			claim: 'Key timeline dates are documented',
			deck: 'Quoted',
			ppm: 'Quoted',
			sec: 'Not relevant',
			status: 'ready'
		},
		{
			claim: 'Any claim shown to LPs has at least one attached source',
			deck: 'Partial',
			ppm: 'Partial',
			sec: 'Partial',
			status: 'review'
		}
	];

	const publishGaps = [
		'Confirm whether the rate-cap detail is actually contractual or only planned.',
		'Move operator-background evidence out of freeform notes into a structured extracted finding.',
		'Drop any LP-facing claim that has no direct source quote.'
	];

	const followUps = [
		'If a claim only exists in the deck, surface that as lower-confidence than a PPM-backed claim.',
		'If a risk tag is custom, require one supporting quote before publish.',
		'If a field stays empty after extraction, show “no source found” instead of a blank input.'
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

	function buildLiveRiskHref() {
		const params = new URLSearchParams();
		params.set('id', dealId);
		params.set('stage', 'risks');
		params.set('from', from);
		return `/deal-review?${params.toString()}`;
	}

	function badgeTone(value) {
		if (/accepted|ready|quoted/i.test(value)) return 'good';
		if (/review|partial|implied/i.test(value)) return 'warn';
		if (/rejected|missing/i.test(value)) return 'soft';
		return 'neutral';
	}
</script>

<PageContainer className="risk-redesign-page ly-page-stack">
	<PageHeader
		title="Risk & Sources Mockup"
		subtitle="Option A: split the current step into three lightweight review pages that start with extracted evidence, not blank authoring."
		className="risk-redesign-header"
	>
		<div slot="actions" class="mock-header-actions">
			<a class="ghost-btn" href={buildLiveRiskHref()}>Back to live step</a>
			<a class="primary-btn" href={buildViewHref('extract')}>Open mockup flow</a>
		</div>
	</PageHeader>

	<div class="risk-redesign-layout">
		<div class="mockup-stack">
			<section class="concept-hero">
				<div class="concept-hero__eyebrow">Reviewer-first redesign</div>
				<h2>{activeView.title}</h2>
				<p>{activeView.description}</p>

				<div class="concept-jobs">
					{#each jobsToBeDone as job}
						<div class="concept-job">{job}</div>
					{/each}
				</div>

				<div class="concept-callout">
					<strong>No blank writing.</strong>
					<span>Every field in this split flow begins as an extracted candidate from the deck, PPM, or SEC filing. The reviewer validates, edits, or rejects.</span>
				</div>
			</section>

			<nav class="mock-nav" aria-label="Risk redesign pages">
				{#each mockViews as view}
					<a
						class="mock-nav__item"
						class:is-active={view.id === viewId}
						href={buildViewHref(view.id)}
					>
						<span>{view.step}</span>
						<strong>{view.label}</strong>
					</a>
				{/each}
			</nav>

			{#if viewId === 'extract'}
				<section class="mock-panel mock-panel--hero">
					<div class="panel-kicker">Page 1 · Extracted risks</div>
					<div class="panel-heading">
						<div>
							<h3>Everything starts as evidence-backed findings</h3>
							<p>The reviewer sees extracted risk candidates with source snippets, suggested categories, and confidence. No empty text areas.</p>
						</div>
						<div class="summary-pill-grid">
							<div class="summary-pill">
								<span>Findings</span>
								<strong>11</strong>
							</div>
							<div class="summary-pill">
								<span>High confidence</span>
								<strong>6</strong>
							</div>
							<div class="summary-pill">
								<span>Needs review</span>
								<strong>2</strong>
							</div>
						</div>
					</div>
				</section>

				<div class="mock-grid mock-grid--extract">
					<section class="mock-panel">
						<div class="panel-heading">
							<div>
								<h3>Extracted findings</h3>
								<p>Each finding carries a source, quote, and suggested placement in the risk model.</p>
							</div>
						</div>

						<div class="finding-list">
							{#each extractedFindings as finding}
								<article class="finding-card">
									<div class="finding-card__top">
										<div>
											<div class="finding-card__kicker">{finding.category}</div>
											<h4>{finding.title}</h4>
										</div>
										<div class="finding-card__status">
											<span class={`status-badge status-badge--${badgeTone(finding.confidence)}`}>{finding.confidence}</span>
											<span class={`status-badge status-badge--${finding.statusTone}`}>{finding.status}</span>
										</div>
									</div>

									<div class="source-chip-row">
										{#each finding.sourceSet as source}
											<span class="source-chip">{source}</span>
										{/each}
										<span class="source-meta">{finding.sourceLine}</span>
									</div>

									<blockquote>{finding.quote}</blockquote>

									<div class="finding-detail">
										<strong>Reviewer note</strong>
										<p>{finding.rationale}</p>
									</div>

									<div class="finding-actions">
										<button type="button" class="action-chip action-chip--accept">Accept</button>
										<button type="button" class="action-chip">Edit placement</button>
										<button type="button" class="action-chip">Reject</button>
										<span class="finding-next">{finding.nextAction}</span>
									</div>
								</article>
							{/each}
						</div>
					</section>

					<section class="mock-panel">
						<div class="panel-heading">
							<div>
								<h3>Batch review lane</h3>
								<p>Instead of typing, the reviewer resolves extracted rows in a lightweight queue.</p>
							</div>
						</div>

						<div class="review-lane">
							<div class="review-lane__card">
								<span class="lane-label">Auto-route</span>
								<strong>Accepted findings feed LP risk tags automatically</strong>
								<p>Accepted evidence flows forward into the next page so the reviewer never re-enters the same idea.</p>
							</div>
							<div class="review-lane__card">
								<span class="lane-label">Needs edit</span>
								<strong>Only low-confidence wording opens an edit state</strong>
								<p>That keeps the reviewer in validation mode instead of turning the page into a blank writing exercise.</p>
							</div>
							<div class="review-lane__card">
								<span class="lane-label">Downstream effect</span>
								<strong>Rejected findings disappear from LP-facing framing</strong>
								<p>The risk page becomes a clean review queue, not a freeform notes dump.</p>
							</div>
						</div>
					</section>
				</div>
			{:else if viewId === 'framing'}
				<section class="mock-panel mock-panel--hero">
					<div class="panel-kicker">Page 2 · LP risk framing</div>
					<div class="panel-heading">
						<div>
							<h3>Structure the LP-facing story without writing from scratch</h3>
							<p>This page turns accepted findings into a structured taxonomy, downside protections, and one concise generated summary.</p>
						</div>
					</div>
				</section>

				<div class="mock-grid mock-grid--framing">
					<section class="mock-panel">
						<div class="panel-heading">
							<div>
								<h3>Primary risk tags</h3>
								<p>These are structured tags, not a giant text blob. Reviewers can add a custom tag only when extraction misses nuance.</p>
							</div>
						</div>

						<div class="taxonomy-grid">
							{#each taxonomies as item}
								<button
									type="button"
									class="taxonomy-chip"
									class:is-selected={item.state === 'selected'}
								>
									{item.label}
								</button>
							{/each}
						</div>

						<div class="custom-tag-card">
							<div>
								<span class="lane-label">Custom additions</span>
								<strong>Only for nuance that extraction missed</strong>
							</div>
							<div class="custom-tag-row">
								{#each customTags as tag}
									<span class="custom-tag">{tag}</span>
								{/each}
								<button type="button" class="action-chip">Add custom risk</button>
							</div>
						</div>
					</section>

					<section class="mock-panel">
						<div class="panel-heading">
							<div>
								<h3>Downside protections</h3>
								<p>Signals that reduce loss severity live here instead of getting mixed into the main risk list.</p>
							</div>
						</div>

						<div class="protection-list">
							{#each downsideProtections as protection}
								<div class="protection-card">
									<div class="protection-card__top">
										<strong>{protection.label}</strong>
										<span class={`status-badge status-badge--${badgeTone(protection.state)}`}>{protection.state}</span>
									</div>
									<p>{protection.detail}</p>
									<span class="source-meta">{protection.source}</span>
								</div>
							{/each}
						</div>
					</section>

					<section class="mock-panel mock-panel--span">
						<div class="panel-heading">
							<div>
								<h3>Generated LP-facing framing</h3>
								<p>The system composes a concise summary from accepted findings. Reviewers only tweak if the generated story feels off.</p>
							</div>
							<button type="button" class="ghost-btn ghost-btn--small">Regenerate from accepted findings</button>
						</div>

						<div class="framing-grid">
							{#each framingSections as section}
								<div class="framing-card">
									<span>{section.label}</span>
									<strong>{section.value}</strong>
									<small>{section.helper}</small>
								</div>
							{/each}
						</div>
					</section>
				</div>
			{:else}
				<section class="mock-panel mock-panel--hero">
					<div class="panel-kicker">Page 3 · Source coverage</div>
					<div class="panel-heading">
						<div>
							<h3>Audit what is actually supported before publish</h3>
							<p>Claims that make it into the listing should be visibly backed by deck, PPM, or SEC evidence. This page is an audit surface, not a writing surface.</p>
						</div>
						<div class="summary-pill-grid">
							<div class="summary-pill">
								<span>Claims audited</span>
								<strong>14</strong>
							</div>
							<div class="summary-pill">
								<span>Fully backed</span>
								<strong>9</strong>
							</div>
							<div class="summary-pill">
								<span>Needs source</span>
								<strong>3</strong>
							</div>
						</div>
					</div>
				</section>

				<div class="mock-grid mock-grid--coverage">
					<section class="mock-panel mock-panel--span">
						<div class="panel-heading">
							<div>
								<h3>Evidence matrix</h3>
								<p>Each publishable claim is checked against deck, PPM, and SEC so unsupported language cannot quietly slip through.</p>
							</div>
						</div>

						<div class="evidence-table">
							<div class="evidence-table__row evidence-table__row--header">
								<span>Claim</span>
								<span>Deck</span>
								<span>PPM</span>
								<span>SEC</span>
								<span>Status</span>
							</div>
							{#each coverageRows as row}
								<div class="evidence-table__row">
									<strong>{row.claim}</strong>
									<span class={`matrix-pill matrix-pill--${badgeTone(row.deck)}`}>{row.deck}</span>
									<span class={`matrix-pill matrix-pill--${badgeTone(row.ppm)}`}>{row.ppm}</span>
									<span class={`matrix-pill matrix-pill--${badgeTone(row.sec)}`}>{row.sec}</span>
									<span class={`status-badge status-badge--${badgeTone(row.status)}`}>{row.status}</span>
								</div>
							{/each}
						</div>
					</section>

					<section class="mock-panel">
						<div class="panel-heading">
							<div>
								<h3>Gaps before publish</h3>
								<p>These are the only issues that should still demand reviewer attention.</p>
							</div>
						</div>

						<ul class="gap-list">
							{#each publishGaps as gap}
								<li>{gap}</li>
							{/each}
						</ul>
					</section>

					<section class="mock-panel">
						<div class="panel-heading">
							<div>
								<h3>Policy choices</h3>
								<p>This is where we encode the nuance you called out.</p>
							</div>
						</div>

						<ul class="gap-list gap-list--compact">
							{#each followUps as note}
								<li>{note}</li>
							{/each}
						</ul>
					</section>
				</div>
			{/if}

			<div class="mock-footer">
				{#if previousView}
					<a class="ghost-btn" href={buildViewHref(previousView.id)}>Previous page</a>
				{:else}
					<span></span>
				{/if}

				{#if nextView}
					<a class="primary-btn" href={buildViewHref(nextView.id)}>Next page</a>
				{:else}
					<a class="primary-btn" href={buildLiveRiskHref()}>Back to live step</a>
				{/if}
			</div>
		</div>

		<DealReviewSidebar
			stages={reviewStages}
			currentStage="risks"
			completedStages={['intake', 'sec', 'team', 'overview', 'details']}
			accessibleStages={reviewStages.map((stage) => stage.id)}
			deckUrl={documentUrls.deck}
			ppmUrl={documentUrls.ppm}
			extractionState="success"
		/>
	</div>
</PageContainer>

<style>
	.mock-header-actions {
		display: flex;
		align-items: center;
		gap: 10px;
		flex-wrap: wrap;
	}

	.risk-redesign-layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(300px, 340px);
		gap: 26px;
		align-items: start;
	}

	.mockup-stack {
		display: grid;
		gap: 18px;
	}

	.concept-hero,
	.mock-panel {
		padding: 24px;
		border-radius: 28px;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.94), rgba(251, 250, 245, 0.94)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.12), transparent 44%);
		box-shadow: 0 18px 34px rgba(18, 37, 41, 0.05);
	}

	.concept-hero__eyebrow,
	.panel-kicker,
	.lane-label,
	.framing-card span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	h2,
	h3,
	h4 {
		margin: 0;
		font-family: var(--font-ui);
		color: var(--text-dark);
	}

	.concept-hero h2 {
		margin-top: 10px;
		font-size: clamp(30px, 4vw, 42px);
		line-height: 1.02;
		letter-spacing: -0.04em;
		max-width: 14ch;
	}

	.concept-hero p,
	.mock-panel p,
	blockquote,
	.gap-list li {
		margin: 0;
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.concept-hero {
		display: grid;
		gap: 18px;
	}

	.concept-jobs {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.concept-job,
	.summary-pill,
	.review-lane__card,
	.custom-tag-card,
	.protection-card,
	.framing-card {
		padding: 16px;
		border-radius: 20px;
		background: rgba(255, 255, 255, 0.72);
		border: 1px solid rgba(31, 81, 89, 0.08);
	}

	.concept-job {
		font-size: 13px;
		line-height: 1.55;
		color: var(--text-dark);
	}

	.concept-callout {
		display: grid;
		gap: 4px;
		padding: 16px 18px;
		border-radius: 22px;
		background: linear-gradient(135deg, rgba(31, 81, 89, 0.94), rgba(18, 43, 48, 0.94));
		color: rgba(255, 255, 255, 0.86);
	}

	.concept-callout strong {
		font-family: var(--font-ui);
		font-size: 14px;
		color: #fff;
	}

	.mock-nav {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
	}

	.mock-nav__item {
		display: grid;
		gap: 6px;
		padding: 16px 18px;
		border-radius: 22px;
		text-decoration: none;
		border: 1px solid rgba(31, 81, 89, 0.08);
		background: rgba(255, 255, 255, 0.7);
		color: inherit;
		transition: transform 0.16s ease, border-color 0.16s ease, background 0.16s ease;
	}

	.mock-nav__item:hover {
		transform: translateY(-1px);
		border-color: rgba(81, 190, 123, 0.24);
	}

	.mock-nav__item span {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.mock-nav__item strong {
		font-family: var(--font-ui);
		font-size: 15px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.mock-nav__item.is-active {
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.88), rgba(247, 251, 247, 0.88)),
			radial-gradient(circle at right top, rgba(81, 190, 123, 0.16), transparent 52%);
		border-color: rgba(81, 190, 123, 0.34);
		box-shadow: 0 0 0 2px rgba(81, 190, 123, 0.08);
	}

	.mock-panel--hero {
		padding-top: 20px;
	}

	.panel-heading {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		margin-bottom: 18px;
	}

	.panel-heading h3 {
		font-size: 28px;
		line-height: 1.05;
		letter-spacing: -0.04em;
		margin-bottom: 6px;
		max-width: 15ch;
	}

	.summary-pill-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 10px;
		min-width: min(360px, 100%);
	}

	.summary-pill span {
		display: block;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
		margin-bottom: 8px;
	}

	.summary-pill strong {
		font-family: var(--font-ui);
		font-size: 28px;
		line-height: 1;
		letter-spacing: -0.05em;
		color: var(--text-dark);
	}

	.mock-grid {
		display: grid;
		gap: 18px;
	}

	.mock-grid--extract {
		grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.8fr);
	}

	.mock-grid--framing,
	.mock-grid--coverage {
		grid-template-columns: repeat(2, minmax(0, 1fr));
	}

	.mock-panel--span {
		grid-column: 1 / -1;
	}

	.finding-list,
	.review-lane,
	.protection-list {
		display: grid;
		gap: 14px;
	}

	.finding-card {
		padding: 18px;
		border-radius: 22px;
		background: rgba(255, 255, 255, 0.78);
		border: 1px solid rgba(31, 81, 89, 0.08);
		display: grid;
		gap: 14px;
	}

	.finding-card__top,
	.finding-actions,
	.protection-card__top {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 12px;
		flex-wrap: wrap;
	}

	.finding-card__kicker {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: var(--text-muted);
		margin-bottom: 6px;
	}

	.finding-card h4 {
		font-size: 20px;
		line-height: 1.08;
		letter-spacing: -0.03em;
		max-width: 22ch;
	}

	.finding-card__status {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.status-badge,
	.matrix-pill,
	.source-chip,
	.custom-tag,
	.action-chip {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 8px 12px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		border: 1px solid transparent;
	}

	.status-badge--good,
	.matrix-pill--good,
	.action-chip--accept {
		background: rgba(81, 190, 123, 0.12);
		color: #166a45;
		border-color: rgba(81, 190, 123, 0.18);
	}

	.status-badge--warn,
	.matrix-pill--warn {
		background: rgba(241, 177, 78, 0.14);
		color: #9a5d10;
		border-color: rgba(241, 177, 78, 0.22);
	}

	.status-badge--soft,
	.matrix-pill--soft {
		background: rgba(31, 81, 89, 0.08);
		color: #45666d;
		border-color: rgba(31, 81, 89, 0.12);
	}

	.status-badge--accepted {
		background: rgba(31, 81, 89, 0.92);
		color: #fff;
	}

	.status-badge--review {
		background: rgba(245, 177, 78, 0.2);
		color: #8b5412;
	}

	.status-badge--rejected {
		background: rgba(255, 255, 255, 0.78);
		color: var(--text-secondary);
		border-color: rgba(31, 81, 89, 0.12);
	}

	.source-chip {
		padding: 6px 10px;
		background: rgba(31, 81, 89, 0.06);
		color: var(--text-dark);
	}

	.source-chip-row {
		display: flex;
		align-items: center;
		gap: 8px;
		flex-wrap: wrap;
	}

	.source-meta,
	.finding-next,
	.framing-card small {
		font-size: 12px;
		line-height: 1.5;
		color: var(--text-muted);
	}

	blockquote {
		padding: 16px 18px;
		border-left: 3px solid rgba(81, 190, 123, 0.56);
		border-radius: 16px;
		background: rgba(247, 251, 247, 0.9);
	}

	.finding-detail {
		display: grid;
		gap: 6px;
	}

	.finding-detail strong,
	.custom-tag-card strong,
	.review-lane__card strong,
	.protection-card strong,
	.framing-card strong {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 800;
		color: var(--text-dark);
	}

	.action-chip {
		background: rgba(255, 255, 255, 0.82);
		border-color: rgba(31, 81, 89, 0.12);
		color: var(--text-dark);
	}

	.review-lane__card {
		display: grid;
		gap: 6px;
	}

	.taxonomy-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 10px;
	}

	.taxonomy-chip {
		padding: 10px 14px;
		border-radius: 16px;
		border: 1px solid rgba(31, 81, 89, 0.1);
		background: rgba(255, 255, 255, 0.72);
		color: var(--text-dark);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
	}

	.taxonomy-chip.is-selected {
		background: rgba(81, 190, 123, 0.12);
		border-color: rgba(81, 190, 123, 0.3);
		color: #166a45;
	}

	.custom-tag-card,
	.protection-card {
		display: grid;
		gap: 12px;
	}

	.custom-tag-row {
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
	}

	.custom-tag {
		background: rgba(31, 81, 89, 0.08);
		color: var(--text-dark);
	}

	.framing-grid {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 12px;
	}

	.framing-card {
		display: grid;
		gap: 10px;
	}

	.evidence-table {
		display: grid;
		gap: 10px;
	}

	.evidence-table__row {
		display: grid;
		grid-template-columns: minmax(0, 2fr) repeat(4, minmax(0, 0.8fr));
		gap: 10px;
		align-items: center;
		padding: 14px 16px;
		border-radius: 18px;
		background: rgba(255, 255, 255, 0.74);
		border: 1px solid rgba(31, 81, 89, 0.08);
	}

	.evidence-table__row--header {
		background: transparent;
		border: none;
		padding: 0 4px 6px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: var(--text-muted);
	}

	.evidence-table__row strong {
		font-size: 14px;
		line-height: 1.45;
		color: var(--text-dark);
	}

	.gap-list {
		margin: 0;
		padding-left: 18px;
		display: grid;
		gap: 10px;
	}

	.gap-list--compact {
		gap: 12px;
	}

	.mock-footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.ghost-btn,
	.primary-btn,
	.ghost-btn--small {
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
		letter-spacing: 0.02em;
	}

	.ghost-btn,
	.ghost-btn--small {
		background: rgba(255, 255, 255, 0.82);
		color: var(--text-dark);
	}

	.primary-btn {
		background: linear-gradient(135deg, rgba(31, 81, 89, 0.98), rgba(22, 60, 66, 0.98));
		color: #fff;
		border-color: transparent;
		box-shadow: 0 10px 18px rgba(19, 46, 50, 0.14);
	}

	.ghost-btn--small {
		padding: 9px 12px;
		font-size: 11px;
	}

	@media (max-width: 1100px) {
		.risk-redesign-layout {
			grid-template-columns: 1fr;
		}

		.summary-pill-grid,
		.framing-grid,
		.concept-jobs,
		.mock-nav,
		.mock-grid--extract,
		.mock-grid--framing,
		.mock-grid--coverage {
			grid-template-columns: 1fr;
		}

		.evidence-table__row {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.concept-hero,
		.mock-panel {
			padding: 18px;
			border-radius: 22px;
		}

		.panel-heading {
			flex-direction: column;
		}

		.mock-footer {
			flex-direction: column;
			align-items: stretch;
		}

		.ghost-btn,
		.primary-btn,
		.ghost-btn--small {
			width: 100%;
		}
	}
</style>
