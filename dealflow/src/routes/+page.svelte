<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	// Root route — server-side redirect to /landing handles this.
	// This fallback prevents users from getting stranded on a blank loader if that redirect misses.
	onMount(() => {
		goto('/landing', { replaceState: true });
	});
</script>

<div class="loading">
	<p>Redirecting to landing...</p>
	<a href="/landing">Continue to landing</a>
</div>

<style>
	.loading {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 12px;
		min-height: 100vh;
		font-family: var(--font-ui);
		color: var(--text-muted);
	}

	.loading a {
		color: var(--primary);
		font-size: 14px;
		font-weight: 600;
		text-decoration: none;
	}

	.loading a:hover {
		text-decoration: underline;
	}
</style>
