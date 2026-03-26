<script>
	import '$lib/css/theme.css';
	import '$lib/css/layout.css';

	let { children } = $props();
</script>

<div class="app-shell">
	{@render children()}
</div>

<style>
	.app-shell {
		min-height: 100vh;
		min-height: 100dvh;
	}
</style>
