<script>
	import { page } from '$app/stores';
	import { onMount } from 'svelte';
	import { get } from 'svelte/store';
	import { user, isLoggedIn, isAdmin, userTier, isAcademy } from '$lib/stores/auth.js';
	import { browser } from '$app/environment';
	import { deals, fetchDeals } from '$lib/stores/deals.js';
	import { selectionChanged } from '$lib/utils/haptics.js';

	let { currentPage = '' } = $props();

	let isDark = $state(false);

	onMount(() => {
		if (!get(deals).length) {
			fetchDeals();
		}

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
		selectionChanged();
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
		'office-hours': '/app/office-hours',
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
				{ page: 'office-hours', icon: 'officehours', label: 'Office Hours', paidOnly: true },
				{ page: 'income-fund', icon: 'incomefund', label: 'GYC Income Fund' }
			]
		}
	]);

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
		academy: 'Academy Member',
		founding: 'Founding',
		'inner-circle': 'Inner Circle',
		alumni: 'Alumni'
	}[$userTier] || $userTier || 'Free');
	const tierClass = $derived($userTier === 'free' ? 'tier-free' : 'tier-paid');
	const dealFlowCount = $derived($deals.length || 0);

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

	// View As (admin impersonation)
	const ADMIN_REAL_USER_KEY = '_gycAdminRealUser';
	let showViewAsDropdown = $state(false);
	let viewAsSearch = $state('');
	let viewAsResults = $state([]);
	let viewAsUser = $state(null);

	const isImpersonating = $derived(browser ? !!localStorage.getItem(ADMIN_REAL_USER_KEY) : false);
	const impersonatedName = $derived.by(() => {
		if (!browser) return '';
		const u = JSON.parse(localStorage.getItem('gycUser') || '{}');
		return u?.name || u?.email?.split('@')[0] || '';
	});
	const impersonatedEmail = $derived.by(() => {
		if (!browser) return '';
		return JSON.parse(localStorage.getItem('gycUser') || '{}')?.email || '';
	});

	async function searchViewAsUsers(query) {
		viewAsSearch = query;
		if (!query || query.length < 2) { viewAsResults = []; return; }
		try {
			const realUser = JSON.parse(localStorage.getItem(ADMIN_REAL_USER_KEY) || 'null');
			const currentUser = JSON.parse(localStorage.getItem('gycUser') || '{}');
			const adminEmail = (realUser?.email || currentUser?.email || '').trim();
			if (!adminEmail) {
				viewAsResults = [];
				return;
			}

			const res = await fetch(`/api/users?q=${encodeURIComponent(query)}&admin=${encodeURIComponent(adminEmail)}`);
			if (res.ok) {
				const data = await res.json();
				const contacts = Array.isArray(data?.contacts)
					? data.contacts
					: Array.isArray(data?.users)
						? data.users
						: Array.isArray(data)
							? data
							: [];
				viewAsResults = contacts
					.filter((contact) => contact?.email && contact.email.toLowerCase() !== adminEmail.toLowerCase())
					.slice(0, 8);
			} else {
				viewAsResults = [];
			}
		} catch (e) { viewAsResults = []; }
	}

	function viewAs(targetUser) {
		if (!browser) return;
		const currentUser = JSON.parse(localStorage.getItem('gycUser') || '{}');
		if (!localStorage.getItem(ADMIN_REAL_USER_KEY)) {
			localStorage.setItem(ADMIN_REAL_USER_KEY, JSON.stringify(currentUser));
		}
		localStorage.setItem('gycUser', JSON.stringify({
			...targetUser,
			name: targetUser.name || targetUser.fullName || targetUser.email?.split('@')[0] || '',
			fullName: targetUser.fullName || targetUser.name || '',
			token: currentUser.token,
			isAdmin: false
		}));
		showViewAsDropdown = false;
		viewAsSearch = '';
		viewAsResults = [];
		window.location.reload();
	}

	function exitViewAs() {
		if (!browser) return;
		const realUser = JSON.parse(localStorage.getItem(ADMIN_REAL_USER_KEY) || '{}');
		if (realUser.email) {
			localStorage.setItem('gycUser', JSON.stringify(realUser));
		}
		localStorage.removeItem(ADMIN_REAL_USER_KEY);
		window.location.reload();
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

<aside id="sidebar" class="sidebar" class:open={mobileOpen}>
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
					{#if item.badge && dealFlowCount > 0}
						<span class="nav-badge">{dealFlowCount}</span>
					{/if}
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

			<!-- View As -->
			<div class="view-as-section">
				{#if isImpersonating}
					<div class="view-as-impersonating">
						<div class="view-as-header">
							<svg viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
							<span class="view-as-label">Viewing as</span>
						</div>
						<div class="view-as-name">{impersonatedName}</div>
						<div class="view-as-email">{impersonatedEmail}</div>
						<button class="view-as-exit" onclick={exitViewAs}>
							<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="10" height="10"><polyline points="15 18 9 12 15 6"/></svg>
							Back to My Account
						</button>
					</div>
				{/if}
				<button class="view-as-toggle" onclick={() => showViewAsDropdown = !showViewAsDropdown}>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
					View as another user
				</button>
				{#if showViewAsDropdown}
					<div class="view-as-dropdown">
						<input
							type="text"
							class="view-as-input"
							placeholder="Search by name or email..."
							bind:value={viewAsSearch}
							oninput={(e) => searchViewAsUsers(e.target.value)}
						/>
						<div class="view-as-results">
							{#each viewAsResults as u}
								<button class="view-as-result" onclick={() => viewAs(u)}>
									<div class="view-as-result-name">{u.name || u.email?.split('@')[0] || 'Unknown'}</div>
									<div class="view-as-result-meta">
										<div class="view-as-result-email">{u.email}</div>
										{#if u.tier}
											<span class="view-as-result-tier" class:tier-paid={u.tier !== 'free'}>{u.tier === 'academy' ? 'Academy' : u.tier}</span>
										{/if}
									</div>
								</button>
							{/each}
							{#if viewAsSearch.length >= 2 && viewAsResults.length === 0}
								<div class="view-as-no-results">No users found</div>
							{/if}
						</div>
					</div>
				{/if}
			</div>
		{/if}

	</nav>

	<div class="sidebar-footer">
		<button class="sidebar-feedback" onclick={() => showFeedback = !showFeedback}>
			<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
				<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
				<polyline points="22,6 12,13 2,6"/>
			</svg>
			Send Feedback
		</button>

		{#if showFeedback}
			<div class="feedback-form">
				<div class="feedback-stars">
					{#each [1,2,3,4,5] as star}
						<button class="star-btn" class:active={feedbackRating >= star} onclick={() => feedbackRating = star} aria-label={`Rate ${star} star${star === 1 ? '' : 's'}`}>&#9733;</button>
					{/each}
				</div>
				<textarea class="feedback-input" rows="3" placeholder="What could be better?" bind:value={feedbackText}></textarea>
				<button class="feedback-submit" onclick={submitFeedback} disabled={feedbackSending}>
					{feedbackSending ? 'Sending...' : 'Send Feedback'}
				</button>
			</div>
		{/if}

		<button class="theme-toggle" onclick={toggleTheme} aria-label="Toggle color mode">
			<span class="theme-toggle-icon">
				{#if isDark}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
					</svg>
				{:else}
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
						<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
					</svg>
				{/if}
			</span>
			<span>{isDark ? 'Dark Mode' : 'Light Mode'}</span>
			<span class="toggle-track" class:on={isDark}>
				<span class="toggle-thumb"></span>
			</span>
		</button>

		<a
			class="footer-link"
			class:active={isActive('settings')}
			href={href('settings')}
			onclick={closeMobile}
		>
			<span class="nav-icon">{@html icons.settings}</span>
			Settings
		</a>
	</div>

	<!-- User profile at bottom -->
	{#if $isLoggedIn && userName}
		<a class="sidebar-user" href="/app/settings" onclick={closeMobile}>
			<div class="user-avatar">{userName.charAt(0).toUpperCase()}</div>
			<div class="user-info">
				<div class="user-name">{userName}</div>
				<div class="user-tier {tierClass}">{tierLabel}</div>
			</div>
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
		officehours: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/><path d="M7 3v4"/><path d="M17 3v4"/></svg>',
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
		position: relative;
	}

	.nav-item:hover { background: var(--bg-sidebar-hover); color: #fff; }
	.nav-item.active { background: var(--bg-sidebar-active); color: var(--text-sidebar-active); }
	.nav-item.active::before {
		content: '';
		position: absolute;
		left: 0; top: 4px; bottom: 4px;
		width: 3px;
		background: var(--primary, #51BE7B);
		border-radius: 0 2px 2px 0;
	}

	.nav-icon { width: 18px; height: 18px; flex-shrink: 0; display: flex; }
	.nav-icon :global(svg) { width: 18px; height: 18px; }

	.nav-lock { margin-left: auto; opacity: 0.35; flex-shrink: 0; }
	.nav-badge {
		margin-left: auto;
		padding: 2px 8px;
		border-radius: 999px;
		background: var(--primary);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		line-height: 1.5;
		box-shadow: 0 2px 8px rgba(81, 190, 123, 0.22);
	}

	.nav-spacer { margin-top: auto; }

	.sidebar-footer {
		padding: 16px 24px;
		border-top: 1px solid rgba(255,255,255,0.06);
	}

	.sidebar-feedback,
	.theme-toggle,
	.footer-link {
		display: flex;
		align-items: center;
		gap: 10px;
		width: 100%;
		padding: 4px 0;
		background: none;
		border: none;
		color: var(--text-sidebar);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 500;
		text-align: left;
		cursor: pointer;
		opacity: 0.8;
		transition: color var(--transition), opacity var(--transition);
	}
	.sidebar-feedback:hover,
	.theme-toggle:hover,
	.footer-link:hover {
		color: #fff;
		opacity: 1;
	}
	.footer-link {
		margin-top: 8px;
		text-decoration: none;
	}
	.footer-link.active {
		color: #fff;
		opacity: 1;
	}
	.theme-toggle {
		margin-top: 8px;
	}
	.theme-toggle-icon {
		display: flex;
		width: 16px;
		height: 16px;
		flex-shrink: 0;
	}
	.toggle-track {
		width: 40px;
		height: 22px;
		margin-left: auto;
		background: rgba(255,255,255,0.18);
		border-radius: 11px;
		position: relative;
		transition: background var(--transition);
		flex-shrink: 0;
	}
	.toggle-track.on {
		background: var(--teal-deep, #1F5159);
	}
	.toggle-thumb {
		width: 18px;
		height: 18px;
		background: #fff;
		border-radius: 50%;
		position: absolute;
		top: 2px;
		left: 2px;
		box-shadow: 0 1px 3px rgba(0,0,0,0.18);
		transition: transform var(--transition);
	}
	.toggle-track.on .toggle-thumb {
		transform: translateX(18px);
	}

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

	@media (max-width: 1024px) {
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
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 16px 24px;
		border-top: 1px solid rgba(255,255,255,0.06);
		color: rgba(255,255,255,0.32);
	}
	.user-avatar {
		width: 34px;
		height: 34px;
		border-radius: 50%;
		background: var(--teal-deep, #1F5159);
		display: flex; align-items: center; justify-content: center;
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--accent-green, #40E47F);
		flex-shrink: 0;
	}
	.user-info { flex: 1; min-width: 0; }
	.sidebar-user { text-decoration: none; cursor: pointer; transition: background 0.15s; }
	.sidebar-user:hover { background: var(--bg-sidebar-hover); }
	.user-name { font-family: var(--font-ui); font-size: 13px; font-weight: 600; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
	.user-tier { font-family: var(--font-ui); font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 2px; }
	.tier-free { color: rgba(255,255,255,0.4); }
	.tier-paid { color: var(--accent-green, #40E47F); }

	/* Feedback */
	.feedback-form {
		margin: 10px 0 0;
		padding: 14px 14px 12px;
		border: 1px solid rgba(255,255,255,0.08);
		border-radius: 12px;
		background: rgba(255,255,255,0.05);
		box-shadow: 0 16px 34px rgba(0,0,0,0.22);
	}
	.feedback-stars { display: flex; gap: 6px; margin-bottom: 10px; }
	.star-btn { background: none; border: none; font-size: 18px; color: rgba(255,255,255,0.2); cursor: pointer; padding: 0; }
	.star-btn.active { color: #fbbf24; }
	.feedback-input {
		width: 100%;
		padding: 10px 12px;
		border: 1px solid rgba(255,255,255,0.1);
		border-radius: 8px;
		background: rgba(0,0,0,0.16);
		color: #fff;
		font-family: var(--font-ui);
		font-size: 12px;
		line-height: 1.45;
		resize: none;
		box-sizing: border-box;
	}
	.feedback-submit {
		margin-top: 10px;
		padding: 9px 14px;
		background: var(--primary, #51BE7B);
		color: #fff;
		border: none;
		border-radius: 8px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		cursor: pointer;
		width: 100%;
	}
	.feedback-submit:disabled { opacity: 0.5; }

	/* View As */
	.view-as-section { padding: 4px 16px 8px; }
	.view-as-impersonating {
		background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25);
		border-radius: 8px; padding: 8px 10px; margin-bottom: 4px;
	}
	.view-as-header { display: flex; align-items: center; gap: 6px; margin-bottom: 4px; }
	.view-as-label { font-size: 10px; font-weight: 700; color: #f59e0b; text-transform: uppercase; letter-spacing: 0.5px; }
	.view-as-name { font-size: 12px; font-weight: 700; color: #fff; }
	.view-as-email { font-size: 10px; color: var(--text-muted); margin-bottom: 6px; }
	.view-as-exit {
		width: 100%; padding: 4px 8px; background: transparent; border: 1px solid rgba(255,255,255,0.15);
		border-radius: 6px; font-family: var(--font-ui); font-size: 10px; font-weight: 700;
		cursor: pointer; color: rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; gap: 4px;
	}
	.view-as-exit:hover { border-color: rgba(255,255,255,0.3); color: #fff; }
	.view-as-toggle {
		display: flex; align-items: center; gap: 6px; cursor: pointer; padding: 4px 0;
		background: none; border: none; font-family: var(--font-ui); font-size: 10px;
		font-weight: 600; color: var(--text-muted); width: 100%; text-align: left;
	}
	.view-as-toggle:hover { color: rgba(255,255,255,0.7); }
	.view-as-dropdown {
		position: absolute; bottom: 100%; left: 16px; right: 16px;
		background: var(--bg-card, #fff); border: 1px solid var(--border, #ddd); border-radius: 8px;
		box-shadow: 0 -8px 24px rgba(0,0,0,0.15); z-index: 200; margin-bottom: 4px; overflow: hidden;
	}
	.view-as-input {
		width: 100%; padding: 8px 10px; border: none; border-bottom: 1px solid var(--border-light, #eee);
		font-family: var(--font-body); font-size: 12px; color: var(--text-dark, #141413);
		background: transparent; box-sizing: border-box; outline: none;
	}
	.view-as-results { max-height: 200px; overflow-y: auto; }
	.view-as-result {
		display: block; width: 100%; padding: 8px 10px; background: none; border: none;
		text-align: left; cursor: pointer; transition: background 0.1s;
	}
	.view-as-result:hover { background: rgba(81,190,123,0.08); }
	.view-as-result-name { font-family: var(--font-ui); font-size: 12px; font-weight: 600; color: var(--text-dark, #141413); }
	.view-as-result-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
	.view-as-result-email { font-size: 10px; color: var(--text-muted, #8A9AA0); }
	.view-as-result-tier {
		flex-shrink: 0;
		padding: 2px 8px;
		border-radius: 999px;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		background: rgba(138,154,160,0.12);
		color: var(--text-muted, #8A9AA0);
	}
	.view-as-result-tier.tier-paid {
		background: rgba(81,190,123,0.12);
		color: var(--primary);
	}
	.view-as-no-results { padding: 12px; text-align: center; font-size: 11px; color: var(--text-muted); }
</style>
