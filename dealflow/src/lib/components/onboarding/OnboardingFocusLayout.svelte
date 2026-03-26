<script>
	import PageContainer from '$lib/layout/PageContainer.svelte';

	export let exitLabel = 'Skip for now';
	export let className = '';
	export let onExit = null;

	function handleExit(event) {
		onExit?.(event);
	}
</script>

<PageContainer className={`ob-shell ob-shell--focus ${className}`.trim()}>
	<div class="ob-shell__frame">
		<div class="ob-shell__topbar">
			<button type="button" class="ob-shell__exit" onclick={handleExit}>{exitLabel}</button>
		</div>
		<div class="ob-shell__body">
			<slot />
		</div>
	</div>
</PageContainer>
