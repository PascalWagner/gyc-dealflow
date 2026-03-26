<script>
	export let exitLabel = '';
	export let className = '';
	export let onExit = null;

	function handleExit(event) {
		onExit?.(event);
	}
</script>

<div class={`ob-shell ob-shell--app ${className}`.trim()}>
	<div class="ob-shell__frame">
		{#if exitLabel}
			<div class="ob-shell__topbar">
				<button type="button" class="ob-shell__exit" onclick={handleExit}>{exitLabel}</button>
			</div>
		{/if}
		<div class="ob-shell__body">
			<slot />
		</div>
	</div>
</div>
