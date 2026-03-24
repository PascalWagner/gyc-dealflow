<script>
	// Root route — redirects to the static landing page during migration.
	// Once we migrate landing.html to Svelte, this becomes the real landing page.
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	onMount(() => {
		// During migration, redirect to the static landing page
		window.location.href = '/landing.html';
	});
</script>

<div class="loading">
	<p>Loading...</p>
</div>

<style>
	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		font-family: var(--font-ui);
		color: var(--text-muted);
	}
</style>
