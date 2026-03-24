<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	// gp-onboarding and onboarding are the same unified flow.
	// Redirect to /onboarding preserving query params and hash.
	onMount(() => {
		const search = $page.url.search || '';
		const hash = $page.url.hash || '';
		goto('/onboarding' + search + hash, { replaceState: true });
	});
</script>

<div style="min-height:100vh;display:flex;align-items:center;justify-content:center;">
	<p style="font-family:var(--font-ui);color:var(--text-muted);font-size:14px;">Redirecting...</p>
</div>
