<script>
	import AppShell from '$lib/layout/AppShell.svelte';
	import OfflineNotice from '$lib/components/OfflineNotice.svelte';
	import { page, navigating } from '$app/stores';
	import { user, isAdmin, isLoggedIn, ensureSessionUserToken, getStoredSessionUser } from '$lib/stores/auth.js';
	import { hydrateDealStagesFromCache, hydrateDealStagesFromRows } from '$lib/stores/deals.js';
	import { ADMIN_ONLY_PAGE_KEYS } from '$lib/navigation/app-nav.js';
	import { goto, afterNavigate } from '$app/navigation';
	import { onMount } from 'svelte';
	import {
		hydrateUserScopedData,
		inferAdminEmailForSession,
		restoreScopedUserState
	} from '$lib/utils/userScopedState.js';

	let { children } = $props();

	// Trigger page-in animation after each client-side navigation
	let pageTransitionEl = $state(null);
	afterNavigate(() => {
		if (pageTransitionEl) {
			pageTransitionEl.style.animation = 'none';
			pageTransitionEl.offsetHeight;
			pageTransitionEl.style.animation = '';
		}
	});

	// Auth state
	let authChecked = $state(false);
	let authTimeout = null;
	let redirecting = $state(false);
	let sessionReady = $state(false);

	// Derive current page from URL for sidebar highlighting
	// e.g. /app/deals → 'deals', /app/market-intel → 'market-intel', /app/admin/manage → 'admin-manage'
	const currentPage = $derived.by(() => {
		const path = $page.url.pathname.replace('/app/', '');
		if (path === 'admin/manage') return 'admin-manage';
		if (path === 'admin/outreach') return 'outreach';
		return path || 'dashboard';
	});
	const adminOnlyPages = new Set(ADMIN_ONLY_PAGE_KEYS);

	function redirectToLogin() {
		if (redirecting) return;
		redirecting = true;
		authChecked = true;

		const returnPath = `${$page.url.pathname}${$page.url.search}`;
		goto(`/login?return=${encodeURIComponent(returnPath)}`, { replaceState: true }).catch(() => {});
	}

	function redirectUnauthorizedAdminRoute() {
		if (!adminOnlyPages.has(currentPage) || $isAdmin || $page.url.pathname === '/app/deals') return;
		goto('/app/deals', { replaceState: true }).catch(() => {});
	}

	// Auth guard — on client mount, re-hydrate store from localStorage
	onMount(() => {
		authTimeout = window.setTimeout(() => {
			redirectToLogin();
		}, 5000);

		const boot = async () => {
			const sessionUser = getStoredSessionUser();
			if (sessionUser?.email) {
				restoreScopedUserState(sessionUser);
				hydrateDealStagesFromCache();
				user.set(sessionUser);
				sessionReady = true;
				authChecked = true;
				clearTimeout(authTimeout);

				const tokenState = await ensureSessionUserToken(sessionUser);
				if (!tokenState.ok || !tokenState.session?.token) {
					redirectToLogin();
					return;
				}

				const activeSession = tokenState.session;
				if (tokenState.refreshed) {
					user.set(activeSession);
				}

				const hydration = await hydrateUserScopedData({
					email: activeSession.email,
					token: activeSession.token,
					adminEmail: inferAdminEmailForSession(activeSession)
				}).catch(() => null);

				if (hydration?.ok) {
					// Keep the live stage store aligned with the server-truth bundle we just fetched.
					hydrateDealStagesFromRows(hydration.bundle?.stages || []);
				}
				return;
			}

			clearTimeout(authTimeout);
			redirectToLogin();
		};

		boot();

		return () => {
			if (authTimeout) clearTimeout(authTimeout);
		};
	});

	$effect(() => {
		if (!authChecked || !sessionReady || redirecting || !$isLoggedIn) return;
		redirectUnauthorizedAdminRoute();
	});
</script>

{#if $navigating}
	<div class="nav-progress-bar"></div>
{/if}

{#if $isLoggedIn && sessionReady}
	<OfflineNotice />
	<AppShell {currentPage}>
		<div class="page-transition" bind:this={pageTransitionEl}>
			{@render children()}
		</div>
	</AppShell>
{:else}
	<div class="loading-screen">
		<div class="loading-brand">
			<div class="loading-logo">GYC</div>
			<div class="loading-title">Cashflow Academy</div>
			<div class="loading-spinner"></div>
		</div>
	</div>
{/if}

<style>
	.nav-progress-bar {
		position: fixed;
		top: 0;
		left: 0;
		height: 3px;
		width: 100%;
		background: linear-gradient(90deg, var(--primary, #51BE7B), #2ECC71);
		z-index: 9999;
		box-shadow: 0 0 8px rgba(81, 190, 123, 0.4);
		animation: navProgress 2s ease-out forwards;
	}

	@keyframes navProgress {
		0% { width: 0%; }
		20% { width: 30%; }
		50% { width: 60%; }
		80% { width: 85%; }
		100% { width: 95%; }
	}

	.page-transition {
		animation: pageIn 0.15s ease-out;
		min-width: 0;
		max-width: 100%;
		overflow-x: clip;
	}

	@keyframes pageIn {
		from { opacity: 0.6; }
		to { opacity: 1; }
	}

	.loading-screen {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 100vh;
		min-height: 100dvh;
		background: var(--bg-sidebar, #0A1E21);
		font-family: var(--font-ui);
	}

	.loading-brand {
		text-align: center;
	}

	.loading-logo {
		width: 64px;
		height: 64px;
		border-radius: 16px;
		background: var(--primary, #51BE7B);
		color: #fff;
		font-family: var(--font-headline, 'DM Serif Display', Georgia, serif);
		font-size: 22px;
		font-weight: 700;
		display: flex;
		align-items: center;
		justify-content: center;
		margin: 0 auto 16px;
	}

	.loading-title {
		color: rgba(255, 255, 255, 0.9);
		font-size: 18px;
		font-weight: 600;
		margin-bottom: 24px;
	}

	.loading-spinner {
		width: 24px;
		height: 24px;
		border: 2px solid rgba(255, 255, 255, 0.2);
		border-top-color: var(--primary, #51BE7B);
		border-radius: 50%;
		margin: 0 auto;
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		to { transform: rotate(360deg); }
	}

	@media (min-width: 769px) and (max-width: 1024px) {
		:global(.ly-main-content .mobile-menu-btn) {
			display: none !important;
		}
	}

	@media (max-width: 768px) {
		:global(.ly-main-content .mobile-menu-btn) {
			display: none !important;
		}
	}
</style>
