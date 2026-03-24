<script>
	import { onMount } from 'svelte';
	// TODO: Migrate dashboard from index.html#dashboard
	// For now, redirect to the static version
	onMount(() => { window.location.href = '/index.html#dashboard'; });
</script>
<div style="display:flex;align-items:center;justify-content:center;min-height:60vh;font-family:var(--font-ui);color:var(--text-muted);">Loading dashboard...</div>
