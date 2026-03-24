<script>
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { page } from '$app/stores';
	import { user, isLoggedIn, isGuest } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';

	let { children } = $props();

	// Derive current page from URL for sidebar highlighting
	// e.g. /app/deals → 'deals', /app/market-intel → 'market-intel', /app/admin/manage → 'admin-manage'
	const currentPage = $derived.by(() => {
		const path = $page.url.pathname.replace('/app/', '');
		if (path === 'admin/manage') return 'admin-manage';
		if (path === 'admin/outreach') return 'outreach';
		return path || 'dashboard';
	});

	// Auth guard — on client mount, re-hydrate store from localStorage
	onMount(() => {
		const stored = localStorage.getItem('gycUser');
		if (stored && stored !== 'null') {
			try {
				const parsed = JSON.parse(stored);
				if (parsed?.email) {
					user.set(parsed);
					return;
				}
			} catch {}
		}
		// Not logged in — redirect to login
		const returnPath = $page.url.pathname;
		window.location.href = `/login?return=${encodeURIComponent(returnPath)}`;
	});
</script>

{#if $isLoggedIn}
	<div class="app-layout">
		<Sidebar currentPage={currentPage()} />
		<main class="app-main">
			{@render children()}
		</main>
		<!-- Mobile bottom tab bar -->
		<nav class="mobile-tabs">
			<a href="/app/dashboard" class="mobile-tab" class:active={currentPage() === 'dashboard'}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
				<span>Dashboard</span>
			</a>
			<a href="/app/market-intel" class="mobile-tab" class:active={currentPage() === 'market-intel'}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
				<span>Intel</span>
			</a>
			<a href="/app/deals" class="mobile-tab" class:active={currentPage() === 'deals'}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
				<span>Deal Flow</span>
			</a>
			<a href="/app/operators" class="mobile-tab" class:active={currentPage() === 'operators'}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
				<span>Operators</span>
			</a>
			<a href="/app/more" class="mobile-tab" class:active={currentPage() === 'more'}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
				<span>More</span>
			</a>
		</nav>
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

	.mobile-tabs {
		display: none;
		position: fixed;
		bottom: 0;
		left: 0;
		right: 0;
		background: var(--bg-sidebar, #1a1a2e);
		border-top: 1px solid rgba(255,255,255,0.08);
		z-index: 100;
		padding: 6px 0 env(safe-area-inset-bottom, 8px);
	}

	.mobile-tab {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 2px;
		color: rgba(255,255,255,0.5);
		text-decoration: none;
		font-size: 10px;
		font-family: var(--font-ui);
		padding: 4px 0;
		transition: color 0.2s;
	}

	.mobile-tab.active {
		color: var(--primary, #00c9a7);
	}

	.mobile-tab:hover {
		color: rgba(255,255,255,0.8);
	}

	@media (max-width: 768px) {
		.app-main {
			margin-left: 0;
			padding-top: 56px; /* Space for mobile hamburger */
			padding-bottom: 72px; /* Space for bottom tabs */
		}

		.mobile-tabs {
			display: flex;
			justify-content: space-around;
		}
	}
</style>
