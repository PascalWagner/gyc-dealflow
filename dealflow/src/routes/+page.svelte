<script>
	// Root route — server-side redirect to /landing handles this.
	// This component is a fallback if the server redirect doesn't fire.
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
