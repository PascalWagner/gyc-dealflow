<script>
	import Sidebar from '$lib/components/Sidebar.svelte';
	import OfflineNotice from '$lib/components/OfflineNotice.svelte';
	import { page, navigating } from '$app/stores';
	import { user, isLoggedIn, ensureSessionUserToken, normalizeSessionUser } from '$lib/stores/auth.js';
	import { tapLight } from '$lib/utils/haptics.js';
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

	function redirectToLogin() {
		if (redirecting) return;
		redirecting = true;
		authChecked = true;

		const returnPath = `${$page.url.pathname}${$page.url.search}`;
		goto(`/login?return=${encodeURIComponent(returnPath)}`, { replaceState: true }).catch(() => {});
	}

	// Auth guard — on client mount, re-hydrate store from localStorage
	onMount(() => {
		authTimeout = window.setTimeout(() => {
			redirectToLogin();
		}, 5000);

		const boot = async () => {
			const sessionUser = normalizeSessionUser(JSON.parse(localStorage.getItem('gycUser') || 'null'));
			if (sessionUser?.email) {
				restoreScopedUserState(sessionUser);
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

				await hydrateUserScopedData({
					email: activeSession.email,
					token: activeSession.token,
					adminEmail: inferAdminEmailForSession(activeSession)
				}).catch(() => {});
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
</script>

{#if $navigating}
	<div class="nav-progress-bar"></div>
{/if}

{#if $isLoggedIn && sessionReady}
	<OfflineNotice />
	<div class="app-layout">
		<Sidebar currentPage={currentPage} />
		<main class="app-main">
			<div class="page-transition" bind:this={pageTransitionEl}>
				{@render children()}
			</div>
		</main>
		<!-- Mobile bottom tab bar -->
		<nav class="mobile-tabs">
			<a href="/app/dashboard" class="mobile-tab" class:active={currentPage === 'dashboard'} onclick={tapLight}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
				<span>Dashboard</span>
			</a>
			<a href="/app/market-intel" class="mobile-tab" class:active={currentPage === 'market-intel'} onclick={tapLight}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
				<span>Intel</span>
			</a>
			<a href="/app/deals" class="mobile-tab" class:active={currentPage === 'deals'} onclick={tapLight}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
				<span>Deal Flow</span>
			</a>
			<a href="/app/operators" class="mobile-tab" class:active={currentPage === 'operators'} onclick={tapLight}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>
				<span>Operators</span>
			</a>
			<a href="/app/more" class="mobile-tab" class:active={currentPage === 'more'} onclick={tapLight}>
				<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
				<span>More</span>
			</a>
		</nav>
	</div>
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
	}

	@keyframes pageIn {
		from { opacity: 0.6; }
		to { opacity: 1; }
	}

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

	@media (min-width: 769px) and (max-width: 1024px) {
		.app-main {
			margin-left: 0;
			padding-top: 56px;
			padding-bottom: 72px;
		}

		.mobile-tabs {
			display: flex;
			justify-content: space-around;
		}

		.mobile-tab {
			font-size: 12px;
			padding: 8px 0;
			min-width: 64px;
			min-height: 44px;
		}

		.mobile-tab svg {
			width: 24px;
			height: 24px;
		}
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
