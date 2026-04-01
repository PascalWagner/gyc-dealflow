<script>
	import DealOnboardingProgress from '$lib/components/deal-review/DealOnboardingProgress.svelte';
	import DealSourceRail from '$lib/components/deal-review/DealSourceRail.svelte';

	let {
		completeness = {
			completenessScore: 0,
			readinessLabel: 'Needs setup',
			hasBlockingIssues: true,
			missingRequiredFields: [],
			missingRecommendedFields: []
		},
		canPublishFromQueue = false,
		stages = [],
		currentStage = 'intake',
		completedStages = [],
		accessibleStages = [],
		onselect = () => {},
		deckUrl = '',
		ppmUrl = '',
		subAgreementUrl = '',
		extractionState = 'idle'
	} = $props();

	const requiredPreview = $derived((completeness?.missingRequiredFields || []).slice(0, 3));
	const recommendedPreview = $derived((completeness?.missingRecommendedFields || []).slice(0, 2));
	const extraRequiredCount = $derived(
		Math.max(0, (completeness?.missingRequiredFields || []).length - requiredPreview.length)
	);
	const extraRecommendedCount = $derived(
		Math.max(0, (completeness?.missingRecommendedFields || []).length - recommendedPreview.length)
	);
	const focusLine = $derived.by(() => {
		if (requiredPreview.length === 0) return 'No blocking gaps remain.';
		const items = [...requiredPreview];
		if (extraRequiredCount > 0) items.push(`+${extraRequiredCount} more`);
		return items.join(', ');
	});
	const polishLine = $derived.by(() => {
		if (recommendedPreview.length === 0) return '';
		const items = [...recommendedPreview];
		if (extraRecommendedCount > 0) items.push(`+${extraRecommendedCount} more`);
		return items.join(', ');
	});
</script>

<aside class="deal-review-sidebar">
	<section class="sidebar-card sidebar-card--completeness">
		<div class="sidebar-card__header">
			<div>
				<div class="sidebar-card__eyebrow">Completeness</div>
				<div class="sidebar-card__score">{completeness.completenessScore}%</div>
			</div>
			<span class={`sidebar-card__badge ${completeness.hasBlockingIssues ? 'is-blocked' : 'is-ready'}`}>
				{completeness.hasBlockingIssues ? 'Blocked' : 'Ready'}
			</span>
		</div>

		<div class="sidebar-card__score-row">
			<div class="sidebar-card__score">{completeness.completenessScore}%</div>
			<p class="sidebar-card__summary">{completeness.readinessLabel}</p>
		</div>

		<div class="sidebar-card__progress" aria-hidden="true">
			<div class="sidebar-card__progress-fill" style={`width:${completeness.completenessScore}%`}></div>
		</div>

		<div class="sidebar-card__meta-grid">
			<div class="sidebar-card__meta">
				<span>Required</span>
				<strong>{completeness.missingRequiredFields.length} gap{completeness.missingRequiredFields.length === 1 ? '' : 's'}</strong>
			</div>
			<div class="sidebar-card__meta">
				<span>Recommended</span>
				<strong>{completeness.missingRecommendedFields.length} item{completeness.missingRecommendedFields.length === 1 ? '' : 's'}</strong>
			</div>
		</div>

		<div class="sidebar-card__group">
			<div class="sidebar-card__group-label">Focus now</div>
			<p class="sidebar-card__focus-line">{focusLine}</p>
		</div>

		{#if polishLine}
			<div class="sidebar-card__group">
				<div class="sidebar-card__group-label">Tighten later</div>
				<p class="sidebar-card__focus-line sidebar-card__focus-line--muted">{polishLine}</p>
			</div>
		{/if}

		<p class="sidebar-card__footnote">
			{#if canPublishFromQueue}
				This deal can publish once you’re comfortable making it live.
			{:else}
				Keep this unpublished until the required gaps are resolved.
			{/if}
		</p>
	</section>

	<DealOnboardingProgress
		stages={stages}
		currentStage={currentStage}
		completedStages={completedStages}
		accessibleStages={accessibleStages}
		onselect={onselect}
		variant="sidebar"
		title="Deal Review Flow"
	/>

	<DealSourceRail
		deckUrl={deckUrl}
		ppmUrl={ppmUrl}
		subAgreementUrl={subAgreementUrl}
		extractionState={extractionState}
	/>
</aside>

<style>
	.deal-review-sidebar {
		display: grid;
		gap: 14px;
		position: sticky;
		top: 24px;
	}

	.sidebar-card {
		padding: 20px;
		border-radius: 24px;
		border: 1px solid rgba(31, 81, 89, 0.1);
		background:
			linear-gradient(180deg, rgba(252, 251, 247, 0.98), rgba(245, 246, 241, 0.98)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.1), transparent 44%);
		box-shadow: 0 18px 40px rgba(16, 37, 42, 0.06);
	}

	.sidebar-card--completeness {
		background:
			linear-gradient(180deg, rgba(17, 40, 45, 0.98), rgba(24, 56, 62, 0.96)),
			radial-gradient(circle at top right, rgba(81, 190, 123, 0.22), transparent 46%);
		border-color: rgba(81, 190, 123, 0.14);
		color: #f6fbf8;
	}

	.sidebar-card__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 14px;
	}

	.sidebar-card__score-row {
		display: grid;
		gap: 8px;
		margin-top: 16px;
	}

	.sidebar-card__eyebrow,
	.sidebar-card__group-label,
	.sidebar-card__meta span {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.sidebar-card__eyebrow,
	.sidebar-card__group-label {
		color: rgba(246, 251, 248, 0.68);
	}

	.sidebar-card__score {
		font-family: var(--font-ui);
		font-size: clamp(2.2rem, 2.8vw, 2.8rem);
		font-weight: 800;
		line-height: 0.96;
		color: #ffffff;
	}

	.sidebar-card__badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		padding: 6px 11px;
		border-radius: 999px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 0.02em;
		white-space: nowrap;
	}

	.sidebar-card__badge.is-ready {
		background: rgba(81, 190, 123, 0.18);
		color: #ffffff;
	}

	.sidebar-card__badge.is-blocked {
		background: rgba(255, 255, 255, 0.12);
		color: rgba(255, 255, 255, 0.92);
	}

	.sidebar-card__progress {
		margin-top: 2px;
		height: 8px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.12);
		overflow: hidden;
	}

	.sidebar-card__progress-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, #51be7b, #9de3b5);
	}

	.sidebar-card__summary,
	.sidebar-card__footnote {
		font-size: 13px;
		line-height: 1.55;
		color: rgba(246, 251, 248, 0.78);
	}

	.sidebar-card__meta-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 10px;
		margin-top: 16px;
	}

	.sidebar-card__meta {
		padding: 12px 14px;
		border-radius: 16px;
		background: rgba(255, 255, 255, 0.07);
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		gap: 10px;
	}

	.sidebar-card__meta strong {
		font-family: var(--font-ui);
		font-size: 0.95rem;
		font-weight: 800;
		color: #ffffff;
		text-align: right;
	}

	.sidebar-card__group {
		margin-top: 14px;
		display: grid;
		gap: 6px;
	}

	.sidebar-card__focus-line {
		margin: 0;
		font-size: 13px;
		line-height: 1.55;
		color: #ffffff;
	}

	.sidebar-card__focus-line--muted {
		color: rgba(246, 251, 248, 0.76);
	}

	.sidebar-card__footnote {
		margin: 16px 0 0;
	}

	@media (max-width: 980px) {
		.deal-review-sidebar {
			position: static;
		}
	}
</style>
