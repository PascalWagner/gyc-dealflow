<script>
	import { createEventDispatcher } from 'svelte';
	import {
		DEAL_REVIEW_STAGES,
		getDealReviewStageIndex,
		listDealReviewStages,
		normalizeDealReviewStage
	} from '$lib/utils/dealReviewShell.js';

	export let stages = DEAL_REVIEW_STAGES;
	export let currentStage = 'intake';
	export let completedStages = [];
	export let disabledStages = [];
	export let pendingStage = '';
	export let interactive = true;
	export let ariaLabel = 'Deal review progress';
	export let title = '';
	export let subtitle = '';

	const dispatch = createEventDispatcher();

	$: stageDefinitions = listDealReviewStages(stages);
	$: activeStage = normalizeDealReviewStage(currentStage, stageDefinitions[0]?.id || 'intake');
	$: activeIndex = Math.max(0, getDealReviewStageIndex(activeStage, stageDefinitions.map((stage) => stage.id)));
	$: completedSet = new Set(
		(Array.isArray(completedStages) ? completedStages : [])
			.map((stage) => normalizeDealReviewStage(stage, ''))
			.filter(Boolean)
	);
	$: disabledSet = new Set(
		(Array.isArray(disabledStages) ? disabledStages : [])
			.map((stage) => normalizeDealReviewStage(stage, ''))
			.filter(Boolean)
	);
	$: progressPercent = stageDefinitions.length > 1 ? (activeIndex / (stageDefinitions.length - 1)) * 100 : 100;

	function requestStage(stageDefinition) {
		if (!interactive || disabledSet.has(stageDefinition.id) || pendingStage) return;
		dispatch('stagechange', {
			stage: stageDefinition.id,
			stageIndex: stageDefinition.index,
			currentStage: activeStage,
			currentIndex: activeIndex,
			direction: stageDefinition.index > activeIndex ? 'forward' : stageDefinition.index < activeIndex ? 'back' : 'stay'
		});
	}
</script>

<section class="dr-progress" aria-label={ariaLabel}>
	{#if title || subtitle}
		<header class="dr-progress__copy">
			{#if title}
				<h2>{title}</h2>
			{/if}
			{#if subtitle}
				<p>{subtitle}</p>
			{/if}
		</header>
	{/if}

	<div class="dr-progress__track" aria-hidden="true">
		<span style={`width:${progressPercent}%`}></span>
	</div>

	<ol class="dr-progress__steps">
		{#each stageDefinitions as stageDefinition}
			<li>
				<button
					type="button"
					class="dr-progress__step"
					class:is-active={stageDefinition.id === activeStage}
					class:is-complete={completedSet.has(stageDefinition.id) || stageDefinition.index < activeIndex}
					class:is-pending={pendingStage === stageDefinition.id}
					class:is-disabled={!interactive || disabledSet.has(stageDefinition.id) || Boolean(pendingStage)}
					aria-current={stageDefinition.id === activeStage ? 'step' : undefined}
					disabled={!interactive || disabledSet.has(stageDefinition.id) || Boolean(pendingStage)}
					onclick={() => requestStage(stageDefinition)}
				>
					<span class="dr-progress__number">{stageDefinition.index + 1}</span>
					<span class="dr-progress__meta">
						<span class="dr-progress__label">{stageDefinition.label}</span>
						<span class="dr-progress__description">{stageDefinition.description}</span>
					</span>
				</button>
			</li>
		{/each}
	</ol>
</section>

<style>
	.dr-progress {
		display: grid;
		gap: 16px;
		padding: 20px;
		border: 1px solid rgba(20, 20, 19, 0.08);
		border-radius: 24px;
		background:
			linear-gradient(180deg, rgba(255, 255, 255, 0.98) 0%, rgba(246, 248, 247, 0.98) 100%);
		box-shadow: 0 20px 40px rgba(20, 20, 19, 0.04);
	}

	.dr-progress__copy {
		display: grid;
		gap: 4px;
	}

	.dr-progress__copy h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: #141413;
	}

	.dr-progress__copy p {
		margin: 0;
		font-size: 0.92rem;
		color: #607179;
	}

	.dr-progress__track {
		height: 6px;
		border-radius: 999px;
		overflow: hidden;
		background: rgba(97, 113, 121, 0.14);
	}

	.dr-progress__track span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, #51be7b 0%, #2fa56a 100%);
		transition: width 180ms ease;
	}

	.dr-progress__steps {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		padding: 0;
		margin: 0;
		list-style: none;
	}

	.dr-progress__step {
		width: 100%;
		display: grid;
		grid-template-columns: auto 1fr;
		align-items: start;
		gap: 12px;
		padding: 14px;
		border: 1px solid rgba(20, 20, 19, 0.08);
		border-radius: 18px;
		background: #fff;
		color: inherit;
		text-align: left;
		cursor: pointer;
		transition:
			transform 140ms ease,
			border-color 140ms ease,
			box-shadow 140ms ease,
			background-color 140ms ease;
	}

	.dr-progress__step:hover:not(:disabled) {
		transform: translateY(-1px);
		border-color: rgba(47, 165, 106, 0.36);
		box-shadow: 0 12px 24px rgba(20, 20, 19, 0.06);
	}

	.dr-progress__step.is-active {
		border-color: rgba(47, 165, 106, 0.45);
		background: rgba(81, 190, 123, 0.08);
	}

	.dr-progress__step.is-complete {
		border-color: rgba(47, 165, 106, 0.2);
		background: rgba(81, 190, 123, 0.05);
	}

	.dr-progress__step.is-pending {
		opacity: 0.78;
	}

	.dr-progress__step.is-disabled {
		cursor: default;
		opacity: 0.62;
	}

	.dr-progress__number {
		display: inline-flex;
		width: 30px;
		height: 30px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: rgba(97, 113, 121, 0.12);
		font-size: 0.82rem;
		font-weight: 800;
		color: #141413;
	}

	.dr-progress__step.is-active .dr-progress__number,
	.dr-progress__step.is-complete .dr-progress__number {
		background: #2fa56a;
		color: #fff;
	}

	.dr-progress__meta {
		display: grid;
		gap: 4px;
		min-width: 0;
	}

	.dr-progress__label {
		font-size: 0.94rem;
		font-weight: 700;
		color: #141413;
	}

	.dr-progress__description {
		font-size: 0.82rem;
		line-height: 1.45;
		color: #607179;
	}

	@media (max-width: 720px) {
		.dr-progress {
			padding: 16px;
			border-radius: 20px;
		}

		.dr-progress__steps {
			grid-template-columns: 1fr;
		}
	}
</style>
