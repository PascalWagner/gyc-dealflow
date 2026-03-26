<script>
	export let phaseNames = [];
	export let currentPhase = 0;
	export let currentStep = 1;
	export let totalSteps = 1;
	export let title = '';
	export let subtitle = '';

	$: progressPct = totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;
</script>

<div class="ob-progress">
	<div class="ob-phase-strip">
		{#each phaseNames as phase, index}
			<div class="ob-phase-node" class:is-complete={index < currentPhase} class:is-active={index === currentPhase}>
				<span class="ob-phase-number">{index + 1}</span>
				<span class="ob-phase-label">{phase}</span>
			</div>
		{/each}
	</div>

	<div class="ob-progress-bar" aria-hidden="true">
		<span style={`width:${progressPct}%`}></span>
	</div>

	<header class="ob-progress-copy">
		<div class="ob-kicker">Step {currentStep} of {totalSteps}</div>
		<h1 class="ob-title">{title}</h1>
		{#if subtitle}
			<p class="ob-subtitle">{subtitle}</p>
		{/if}
	</header>
</div>

<style>
	.ob-progress {
		display: grid;
		gap: 18px;
	}

	.ob-phase-strip {
		display: flex;
		gap: 10px;
		flex-wrap: wrap;
	}

	.ob-phase-node {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding: 10px 12px;
		border: 1px solid var(--border, #dde5e8);
		border-radius: 999px;
		background: #fff;
		color: var(--text-muted, #607179);
	}

	.ob-phase-node.is-active {
		border-color: rgba(81, 190, 123, 0.4);
		background: rgba(81, 190, 123, 0.08);
		color: var(--text-dark, #141413);
	}

	.ob-phase-node.is-complete {
		border-color: rgba(81, 190, 123, 0.18);
		background: rgba(81, 190, 123, 0.05);
	}

	.ob-phase-number {
		display: inline-flex;
		width: 24px;
		height: 24px;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		background: var(--border-light, #edf1f2);
		font-size: 12px;
		font-weight: 700;
	}

	.ob-phase-node.is-active .ob-phase-number,
	.ob-phase-node.is-complete .ob-phase-number {
		background: var(--primary, #51be7b);
		color: #fff;
	}

	.ob-phase-label {
		font-size: 12px;
		font-weight: 700;
	}

	.ob-progress-bar {
		height: 6px;
		border-radius: 999px;
		background: rgba(221, 229, 232, 0.8);
		overflow: hidden;
	}

	.ob-progress-bar span {
		display: block;
		height: 100%;
		border-radius: 999px;
		background: linear-gradient(90deg, #51be7b 0%, #2fa56a 100%);
	}

	.ob-progress-copy {
		display: grid;
		gap: 0;
	}

	@media (max-width: 640px) {
		.ob-phase-strip {
			gap: 8px;
		}

		.ob-phase-node {
			padding: 8px 10px;
		}

		.ob-phase-label {
			font-size: 11px;
		}
	}
</style>
