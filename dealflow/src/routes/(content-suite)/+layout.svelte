<script>
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import ContentSuiteSidebar from '$lib/components/ContentSuiteSidebar.svelte';
	import { getStoredSessionUser, isAdmin, user } from '$lib/stores/auth.js';

	let { children } = $props();
	let ready = $state(false);

	onMount(() => {
		const sessionUser = getStoredSessionUser();
		if (sessionUser?.email) {
			user.set(sessionUser);
		}

		if (!(sessionUser?.isAdmin || $isAdmin)) {
			const returnPath = $page.url.pathname;
			goto(`/login?return=${encodeURIComponent(returnPath)}`);
			return;
		}

		ready = true;
	});
</script>

{#if ready}
	<div class="content-suite-layout">
		<ContentSuiteSidebar />
		<main class="content-suite-main">
			{@render children()}
		</main>
	</div>
{:else}
	<div class="suite-loading">Loading content workspace...</div>
{/if}

<style>
	:global(body) {
		background: #f5f6fb;
	}

	.content-suite-layout {
		min-height: 100vh;
		display: flex;
		background: #f5f6fb;
	}

	.content-suite-main {
		flex: 1;
		min-width: 0;
	}

	.suite-loading {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		font-family: var(--font-ui, 'Plus Jakarta Sans', sans-serif);
		color: #667085;
	}

	@media (max-width: 900px) {
		.content-suite-layout {
			flex-direction: column;
		}
	}
</style>
