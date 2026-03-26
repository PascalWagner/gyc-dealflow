<script>
	export let as = 'main';
	export let className = '';
</script>

<svelte:element this={as} class={`ly-main-content ly-sidebar-main ${className}`.trim()}>
	<slot />
</svelte:element>
