<script>
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { page } from '$app/stores';
	import { user, isLoggedIn, isGuest } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Derive current page from URL for sidebar highlighting
	const currentPage = $derived($page.url.pathname.split('/').pop() || 'dashboard');

	// Auth guard — redirect to login if not authenticated
	onMount(() => {
		if (!$isLoggedIn) {
			const returnPath = $page.url.pathname;
			goto(`/login?return=${encodeURIComponent(returnPath)}`);
		}
	});
</script>

{#if $isLoggedIn}
	<div class="app-layout">
		<Sidebar {currentPage} />
		<main class="app-main">
			{@render children()}
		</main>
	</div>
{:else}
	<div class="loading-screen">
		<p>Loading...</p>
	</div>
{/if}

<style>
	.app-layout {
		display: flex;
		min-height: 100vh;
		min-height: 100dvh;
	}

	.app-main {
		flex: 1;
		margin-left: 240px;
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--bg-cream);
	}

	.loading-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		font-family: var(--font-ui);
		color: var(--text-muted);
	}

	@media (max-width: 768px) {
		.app-main {
			margin-left: 0;
			padding-top: 56px; /* Space for mobile hamburger */
		}
	}
</style>
