<script>
	export let as = 'section';
	export let className = '';
</script>

<svelte:element this={as} class={`ly-page ly-page-container ${className}`.trim()}>
	<slot />
</svelte:element>
