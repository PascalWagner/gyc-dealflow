<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { user, isLoggedIn, isAdmin, userTier, isAcademy } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';

	let { currentPage = '' } = $props();

	let isDark = $state(false);

	onMount(() => {
		const saved = localStorage.getItem('gyc-theme');
		if (saved === 'dark') {
			isDark = true;
			document.documentElement.classList.add('dark');
			document.documentElement.classList.remove('light');
		} else if (saved === 'light') {
			isDark = false;
			document.documentElement.classList.add('light');
			document.documentElement.classList.remove('dark');
		} else {
			// No preference saved — check system preference
			isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
			if (isDark) {
				document.documentElement.classList.add('dark');
			}
		}
	});

	function toggleTheme() {
		isDark = !isDark;
		if (isDark) {
			document.documentElement.classList.add('dark');
			document.documentElement.classList.remove('light');
			localStorage.setItem('gyc-theme', 'dark');
		} else {
			document.documentElement.classList.remove('dark');
			document.documentElement.classList.add('light');
			localStorage.setItem('gyc-theme', 'light');
		}
	}

	const isFree = $derived($userTier === 'free' && !$isAdmin);

	// Route map: page key → SvelteKit route
	const routes = {
		dashboard: '/app/dashboard',
		deals: '/app/deals',
		'market-intel': '/app/market-intel',
		operators: '/app/operators',
		resources: '/app/resources',
		academy: '/app/academy',
		'income-fund': '/app/income-fund',
		settings: '/app/settings',
		admin: '/app/admin',
		'case-studies': '/app/case-studies',
		'admin-manage': '/app/admin/manage',
		outreach: '/app/admin/outreach',
		portfolio: '/app/portfolio',
		goals: '/app/goals',
		plan: '/app/plan',
		'tax-prep': '/app/tax-prep',
		assets: '/app/assets',
		'find-gp': '/app/find-gp',
		saved: '/app/saved',
		'deal-flow-stats': '/app/deal-flow-stats',
		more: '/app/more'
	};

	function href(pageKey) {
		return routes[pageKey] || `/app/${pageKey}`;
	}

	// Navigation items
	const navSections = $derived([
		{
			label: 'Home',
			items: [
				{ page: 'dashboard', icon: 'dashboard', label: 'Dashboard' }
			]
		},
		{
			label: 'Research',
			items: [
				{ page: 'market-intel', icon: 'marketIntel', label: 'Market Intel', paidOnly: true },
				{ page: 'deals', icon: 'deals', label: 'Deal Flow', badge: true },
				{ page: 'operators', icon: 'operators', label: 'Operators' },
				{ page: 'resources', icon: 'resources', label: 'Resources', paidOnly: true }
			]
		},
		{
			label: 'Support',
			items: [
				{ page: 'academy', icon: 'academy', label: 'Cash Flow Academy' },
				{ page: 'income-fund', icon: 'incomefund', label: 'GYC Income Fund' }
			]
		}
	]);

	const accountItems = [
		{ page: 'settings', icon: 'settings', label: 'Settings' }
	];

	const adminItems = [
		{ page: 'admin', icon: 'schema', label: 'Admin Dashboard' },
		{ page: 'case-studies', icon: 'casestudies', label: 'Member Success' },
		{ page: 'admin-manage', icon: 'manage', label: 'Manage Data' },
		{ page: 'outreach', icon: 'outreach', label: 'Outreach' }
	];

	// User display info
	const userName = $derived($user?.name || $user?.fullName || $user?.email?.split('@')[0] || '');
	const userEmail = $derived($user?.email || '');
	const tierLabel = $derived({
		free: 'Free',
		academy: 'Academy',
		founding: 'Founding',
		'inner-circle': 'Inner Circle',
		alumni: 'Alumni'
	}[$userTier] || $userTier || 'Free');
	const tierClass = $derived($userTier === 'free' ? 'tier-free' : 'tier-paid');

	// Check if user is a GP (has management company)
	const isGP = $derived(!!($user?.managementCompanyId || $user?.isGP));

	// Feedback
	let showFeedback = $state(false);
	let feedbackText = $state('');
	let feedbackRating = $state(0);
	let feedbackSending = $state(false);

	async function submitFeedback() {
		if (!feedbackText.trim()) return;
		feedbackSending = true;
		try {
			const stored = browser ? JSON.parse(localStorage.getItem('gycUser') || '{}') : {};
			await fetch('/api/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (stored.token || '') },
				body: JSON.stringify({ rating: feedbackRating, text: feedbackText, page: currentPage })
			});
			feedbackText = '';
			feedbackRating = 0;
			showFeedback = false;
		} catch (e) { console.warn('Feedback failed:', e); }
		finally { feedbackSending = false; }
	}

	function isActive(itemPage) {
		const dashSubPages = ['portfolio', 'goals', 'plan', 'tax-prep'];
		if (itemPage === currentPage) return true;
		if (itemPage === 'dashboard' && dashSubPages.includes(currentPage)) return true;
		return false;
	}

	let mobileOpen = $state(false);

	function closeMobile() {
		mobileOpen = false;
	}
</script>

<!-- Mobile hamburger -->
<button class="sidebar-hamburger" onclick={() => mobileOpen = !mobileOpen} aria-label="Toggle menu">
	<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="24" height="24">
		{#if mobileOpen}
			<line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
		{:else}
			<line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/>
		{/if}
	</svg>
</button>

<!-- Backdrop -->
{#if mobileOpen}
	<button class="sidebar-backdrop" onclick={closeMobile} aria-label="Close menu"></button>
{/if}

<aside class="sidebar" class:open={mobileOpen}>
	<div class="sidebar-logo">
		<div class="sidebar-logo-text">Grow Your Cashflow</div>
	</div>

	<nav class="sidebar-nav">
		{#each navSections as section}
			<div class="nav-section-label">{section.label}</div>
			{#each section.items as item}
				<a
					class="nav-item"
					class:active={isActive(item.page)}
					href={href(item.page)}
					onclick={closeMobile}
				>
					<span class="nav-icon">{@html icons[item.icon]}</span>
					{item.label}
					{#if item.paidOnly && isFree}
						<svg class="nav-lock" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12">
							<rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
						</svg>
					{/if}
				</a>
			{/each}
		{/each}

		<!-- GP Portal -->
		{#if isGP || $isAdmin}
			<div class="nav-section-label">GP Portal</div>
			<a class="nav-item" class:active={currentPage === 'gp-dashboard'} href="/gp-dashboard" onclick={closeMobile}>
				<span class="nav-icon">{@html icons.gpdashboard}</span>
				GP Dashboard
			</a>
		{/if}

		<div class="nav-spacer"></div>

		<!-- Account -->
		{#each accountItems as item}
			<a
				class="nav-item"
				class:active={isActive(item.page)}
				href={href(item.page)}
				onclick={closeMobile}
			>
				<span class="nav-icon">{@html icons[item.icon]}</span>
				{item.label}
			</a>
		{/each}

		<!-- Admin -->
		{#if $isAdmin}
			<div class="nav-section-label">Admin</div>
			{#each adminItems as item}
				<a
					class="nav-item"
					class:active={isActive(item.page)}
					href={href(item.page)}
					onclick={closeMobile}
				>
					<span class="nav-icon">{@html icons[item.icon]}</span>
					{item.label}
				</a>
			{/each}
		{/if}

		<button class="nav-item feedback-btn" onclick={() => showFeedback = !showFeedback}>
			<span class="nav-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg></span>
			Feedback
		</button>

		{#if showFeedback}
			<div class="feedback-form">
				<div class="feedback-stars">
					{#each [1,2,3,4,5] as star}
						<button class="star-btn" class:active={feedbackRating >= star} onclick={() => feedbackRating = star}>&#9733;</button>
					{/each}
				</div>
				<textarea class="feedback-input" rows="3" placeholder="What could be better?" bind:value={feedbackText}></textarea>
				<button class="feedback-submit" onclick={submitFeedback} disabled={feedbackSending}>
					{feedbackSending ? 'Sending...' : 'Send Feedback'}
				</button>
			</div>
		{/if}

		<button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle dark mode">
			<span class="nav-icon">
				{#if isDark}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
						<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
					</svg>
				{/if}
			</span>
			{isDark ? 'Light Mode' : 'Dark Mode'}
		</button>
	</nav>

	<!-- User profile at bottom -->
	{#if $isLoggedIn && userName}
		<a class="sidebar-user" href="/app/settings" onclick={closeMobile}>
			<div class="user-avatar">{userName.charAt(0).toUpperCase()}</div>
			<div class="user-info">
				<div class="user-name">{userName}</div>
				<div class="user-tier {tierClass}">{tierLabel}</div>
			</div>
			<svg class="user-gear" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
		</a>
	{/if}
</aside>

<script module>
	// SVG icons (shared across all instances)
	const icons = {
		dashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>',
		deals: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
		operators: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
		marketIntel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>',
		resources: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>',
		academy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
		incomefund: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>',
		settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
		schema: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>',
		casestudies: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>',
		manage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
		outreach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>',
		gpdashboard: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>'
	};
</script>

<style>
	.sidebar {
		position: fixed;
		left: 0; top: 0; bottom: 0;
		width: 240px;
		background: var(--bg-sidebar);
		display: flex;
		flex-direction: column;
		z-index: 100;
		transition: transform 0.3s ease;
	}

	.sidebar-logo {
		padding: 20px 24px;
		display: flex;
		align-items: center;
		gap: 12px;
		border-bottom: 1px solid rgba(255,255,255,0.06);
	}

	.sidebar-logo-text {
		font-family: var(--font-headline);
		font-size: 18px;
		font-weight: 400;
		color: #fff;
		letter-spacing: -0.3px;
	}

	.sidebar-nav {
		flex: 1;
		padding: 12px 0;
		overflow-y: auto;
		display: flex;
		flex-direction: column;
	}

	.nav-section-label {
		padding: 16px 24px 8px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 1.5px;
		color: rgba(255,255,255,0.3);
	}

	.nav-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px 10px 24px;
		color: var(--text-sidebar);
		cursor: pointer;
		transition: all var(--transition);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 500;
		text-decoration: none;
	}

	.nav-item:hover { background: var(--bg-sidebar-hover); color: #fff; }
	.nav-item.active { background: var(--bg-sidebar-active); color: var(--text-sidebar-active); }

	.nav-icon { width: 18px; height: 18px; flex-shrink: 0; display: flex; }
	.nav-icon :global(svg) { width: 18px; height: 18px; }

	.nav-lock { margin-left: auto; opacity: 0.35; flex-shrink: 0; }

	.nav-spacer { margin-top: auto; }

	.theme-toggle {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 16px 10px 24px;
		margin: 8px 0;
		color: var(--text-sidebar);
		cursor: pointer;
		transition: all var(--transition);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 500;
		background: none;
		border: none;
		width: 100%;
		text-align: left;
	}
	.theme-toggle:hover { background: var(--bg-sidebar-hover); color: #fff; }

	.sidebar-hamburger {
		display: none;
		position: fixed;
		top: 12px;
		left: 12px;
		z-index: 200;
		background: var(--bg-sidebar);
		border: none;
		border-radius: 8px;
		padding: 8px;
		color: #fff;
		cursor: pointer;
	}

	.sidebar-backdrop {
		display: none;
		position: fixed;
		inset: 0;
		background: rgba(0,0,0,0.5);
		z-index: 99;
		border: none;
		cursor: default;
	}

	@media (max-width: 768px) {
		.sidebar {
			transform: translateX(-100%);
		}
		.sidebar.open {
			transform: translateX(0);
		}
		.sidebar-hamburger {
			display: flex;
		}
		.sidebar-backdrop {
			display: block;
		}
	}

	/* User profile */
	.sidebar-user {
		display: flex; align-items: center; gap: 10px; padding: 16px 20px;
		border-bottom: 1px solid rgba(255,255,255,0.06);
	}
	.user-avatar {
		width: 32px; height: 32px; border-radius: 50%; background: var(--primary, #51BE7B);
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-ui); font-size: 13px; font-weight: 700; color: #fff; flex-shrink: 0;
	}
	.user-info { min-width: 0; }
	.sidebar-user { text-decoration: none; cursor: pointer; transition: background 0.15s; }
	.sidebar-user:hover { background: var(--bg-sidebar-hover); }
	.user-gear { opacity: 0.4; flex-shrink: 0; margin-left: auto; }
	.user-name { font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.user-tier { font-family: var(--font-ui); font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
	.tier-free { color: rgba(255,255,255,0.4); }
	.tier-paid { color: #51BE7B; }

	/* Feedback */
	.feedback-btn { border: none; background: none; width: 100%; text-align: left; }
	.feedback-form { padding: 8px 20px 12px; }
	.feedback-stars { display: flex; gap: 4px; margin-bottom: 8px; }
	.star-btn { background: none; border: none; font-size: 18px; color: rgba(255,255,255,0.2); cursor: pointer; padding: 0; }
	.star-btn.active { color: #fbbf24; }
	.feedback-input {
		width: 100%; padding: 8px 10px; border: 1px solid rgba(255,255,255,0.1);
		border-radius: 6px; background: rgba(255,255,255,0.05); color: #fff;
		font-family: var(--font-ui); font-size: 12px; resize: none; box-sizing: border-box;
	}
	.feedback-submit {
		margin-top: 6px; padding: 6px 14px; background: var(--primary, #51BE7B);
		color: #fff; border: none; border-radius: 6px; font-family: var(--font-ui);
		font-size: 11px; font-weight: 700; cursor: pointer; width: 100%;
	}
	.feedback-submit:disabled { opacity: 0.5; }
</style>
