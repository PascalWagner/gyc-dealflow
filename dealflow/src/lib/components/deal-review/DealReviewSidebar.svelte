<script>
	import DealOnboardingProgress from '$lib/components/deal-review/DealOnboardingProgress.svelte';
	import DealSourceRail from '$lib/components/deal-review/DealSourceRail.svelte';

	let {
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
</script>

<aside class="deal-review-sidebar">
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

	@media (max-width: 980px) {
		.deal-review-sidebar {
			position: static;
		}
	}
</style>
