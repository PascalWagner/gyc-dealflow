<script>
	import OnboardingPhaseStrip from '$lib/components/onboarding/OnboardingPhaseStrip.svelte';

	export let phaseNames = [];
	export let phaseItems = [];
	export let currentPhase = 0;
	export let currentStep = 1;
	export let totalSteps = 1;
	export let title = '';
	export let subtitle = '';
	export let showProgressBar = true;
	export let showHeader = true;

	$: progressPct = totalSteps > 1 ? ((currentStep - 1) / (totalSteps - 1)) * 100 : 0;
	$: resolvedPhaseItems =
		Array.isArray(phaseItems) && phaseItems.length
			? phaseItems
			: phaseNames.map((phase) => ({ label: phase }));
</script>

<div class="ob-progress">
	<OnboardingPhaseStrip items={resolvedPhaseItems} {currentPhase} />

	{#if showProgressBar}
		<div class="ob-progress-bar" aria-hidden="true">
			<span style={`width:${progressPct}%`}></span>
		</div>
	{/if}

	{#if showHeader}
		<header class="ob-progress-copy">
			<div class="ob-kicker">Step {currentStep} of {totalSteps}</div>
			<h1 class="ob-title">{title}</h1>
			{#if subtitle}
				<p class="ob-subtitle">{subtitle}</p>
			{/if}
		</header>
	{/if}
</div>

<style>
	.ob-progress {
		display: grid;
		gap: 18px;
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
</style>
