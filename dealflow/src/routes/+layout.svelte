<script>
	import '$lib/css/theme.css';
	import { user, isLoggedIn, isGuest, userTier } from '$lib/stores/auth.js';
	import { page } from '$app/stores';

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
