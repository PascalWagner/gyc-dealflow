<script>
	import { createEventDispatcher } from 'svelte';
	import DealReviewSourceDocRail from '$lib/components/deal-review/DealReviewSourceDocRail.svelte';
	import DealReviewStageProgress from '$lib/components/deal-review/DealReviewStageProgress.svelte';
	import {
		DEAL_REVIEW_STAGES,
		buildDealReviewHref,
		listDealReviewStages,
		normalizeDealReviewStage,
		transitionDealReviewStage
	} from '$lib/utils/dealReviewShell.js';

	export let dealId = '';
	export let currentStage = 'review';
	export let stages = DEAL_REVIEW_STAGES;
	export let title = '';
	export let subtitle = '';
	export let eyebrow = '';
	export let dirty = false;
	export let busy = false;
	export let from = '';
	export let extract = false;
	export let selectedDocumentKind = '';
	export let deal = null;
	export let documents = [];
	export let pendingFiles = {};
	export let basePath = '/deal-review';
	export let stageParam = 'both';
	export let persistSourceRail = true;
	export let interactiveStages = true;
	export let saveBeforeNavigate = null;
	export let canLeaveStage = null;
	export let navigate = null;

	const dispatch = createEventDispatcher();

	let transitionError = '';
	let pendingStage = '';

	$: stageDefinitions = listDealReviewStages(stages);
	$: activeStage = normalizeDealReviewStage(currentStage, stageDefinitions[0]?.id || 'intake');
	$: completedStages = stageDefinitions
		.filter((stageDefinition) => stageDefinition.index < stageDefinitions.findIndex((item) => item.id === activeStage))
		.map((stageDefinition) => stageDefinition.id);

	function hrefForStage(stage) {
		return buildDealReviewHref({
			dealId,
			stage,
			from,
			extract,
			documentKind: selectedDocumentKind,
			basePath,
			stageParam
		});
	}

	async function handleStageChange(event) {
		const targetStage = event.detail?.stage;
		if (!targetStage || !interactiveStages || busy || pendingStage) return;

		pendingStage = targetStage;
		transitionError = '';

		const result = await transitionDealReviewStage({
			targetStage,
			dealId,
			from,
			extract,
			documentKind: selectedDocumentKind,
			navigate,
			save: saveBeforeNavigate,
			saveIfDirty: Boolean(saveBeforeNavigate),
			dirty,
			canLeave: canLeaveStage,
			basePath,
			stageParam
		});

		if (!result.ok) {
			transitionError = result?.error?.message || 'Could not change stages right now.';
			dispatch('transitionerror', {
				...result,
				targetStage
			});
		} else {
			dispatch('stagechange', result);
		}

		pendingStage = '';
	}

	function forwardDocumentEvent(type, event) {
		dispatch(type, event.detail);
	}
</script>

<section class="dr-shell">
	<header class="dr-shell__header">
		<div class="dr-shell__copy">
			{#if eyebrow}
				<div class="dr-shell__eyebrow">{eyebrow}</div>
			{/if}
			{#if title}
				<h1>{title}</h1>
			{/if}
			{#if subtitle}
				<p>{subtitle}</p>
			{/if}
		</div>
		<div class="dr-shell__header-actions">
			<slot name="header-actions" />
		</div>
	</header>

	<DealReviewStageProgress
		stages={stageDefinitions.map((stageDefinition) => stageDefinition.id)}
		currentStage={activeStage}
		completedStages={completedStages}
		pendingStage={pendingStage}
		interactive={interactiveStages && !busy}
		title="Workflow"
		subtitle="Stage changes can trigger autosave before navigation."
		on:stagechange={handleStageChange}
	/>

	{#if transitionError}
		<div class="dr-shell__error">{transitionError}</div>
	{/if}

	<div class="dr-shell__layout">
		<div class="dr-shell__main">
			<slot />
		</div>

		<div class="dr-shell__rail">
			<DealReviewSourceDocRail
				dealId={dealId}
				deal={deal}
				documents={documents}
				pendingFiles={pendingFiles}
				selectedKind={selectedDocumentKind}
				persist={persistSourceRail}
				on:select={(event) => forwardDocumentEvent('docselect', event)}
				on:open={(event) => forwardDocumentEvent('docopen', event)}
				on:missing={(event) => forwardDocumentEvent('docmissing', event)}
				on:toggle={(event) => forwardDocumentEvent('doctoggle', event)}
			/>
			<slot name="rail-footer" hrefForStage={hrefForStage} />
		</div>
	</div>
</section>

<style>
	.dr-shell {
		display: grid;
		gap: 20px;
	}

	.dr-shell__header {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 20px;
	}

	.dr-shell__copy {
		display: grid;
		gap: 6px;
	}

	.dr-shell__eyebrow {
		font-size: 0.74rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		color: #607179;
	}

	.dr-shell__copy h1 {
		margin: 0;
		font-size: clamp(1.8rem, 3vw, 2.5rem);
		line-height: 1.05;
		color: #141413;
	}

	.dr-shell__copy p {
		margin: 0;
		max-width: 64ch;
		font-size: 0.98rem;
		line-height: 1.6;
		color: #607179;
	}

	.dr-shell__header-actions {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.dr-shell__error {
		padding: 14px 16px;
		border-radius: 18px;
		border: 1px solid rgba(175, 66, 47, 0.16);
		background: rgba(175, 66, 47, 0.08);
		color: #8f3323;
		font-size: 0.92rem;
		font-weight: 600;
	}

	.dr-shell__layout {
		display: grid;
		grid-template-columns: minmax(0, 1fr) 320px;
		gap: 20px;
		align-items: start;
	}

	.dr-shell__main {
		min-width: 0;
	}

	.dr-shell__rail {
		display: grid;
		gap: 12px;
	}

	@media (max-width: 1100px) {
		.dr-shell__layout {
			grid-template-columns: 1fr;
		}
	}

	@media (max-width: 720px) {
		.dr-shell__header {
			flex-direction: column;
			align-items: stretch;
		}
	}
</style>
