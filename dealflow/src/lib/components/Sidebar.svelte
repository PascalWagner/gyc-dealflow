<script>
	import { page } from '$app/stores';
	import { user, isLoggedIn, isAdmin, userTier, isAcademy } from '$lib/stores/auth.js';

	let { currentPage = '' } = $props();

	const isFree = $derived($userTier === 'free' && !$isAdmin);

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
				{ page: 'marketintel', icon: 'marketIntel', label: 'Market Intel', paidOnly: true },
				{ page: 'deals', icon: 'deals', label: 'Deal Flow', badge: true },
				{ page: 'managers', icon: 'operators', label: 'Operators' },
				{ page: 'resources', icon: 'resources', label: 'Resources', paidOnly: true }
			]
		},
		{
			label: 'Support',
			items: [
				{ page: 'academy', icon: 'academy', label: 'Cash Flow Academy' },
				{ page: 'incomefund', icon: 'incomefund', label: 'GYC Income Fund' }
			]
		}
	]);

	const accountItems = [
		{ page: 'settings', icon: 'settings', label: 'Settings' }
	];

	const adminItems = [
		{ page: 'admindash', icon: 'schema', label: 'Admin Dashboard' },
		{ page: 'casestudies', icon: 'casestudies', label: 'Member Success' },
		{ page: 'admin-manage', icon: 'manage', label: 'Manage Data' }
	];

	function isActive(itemPage) {
		const dashSubPages = ['buybox', 'portfolio', 'taxprep'];
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
					href="/index.html#{item.page}"
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

		<div class="nav-spacer"></div>

		{#each accountItems as item}
			<a
				class="nav-item"
				class:active={isActive(item.page)}
				href="/index.html#{item.page}"
				onclick={closeMobile}
			>
				<span class="nav-icon">{@html icons[item.icon]}</span>
				{item.label}
			</a>
		{/each}

		{#if $isAdmin}
			<div class="nav-section-label">Admin</div>
			{#each adminItems as item}
				<a
					class="nav-item"
					class:active={isActive(item.page)}
					href="/index.html#{item.page}"
					onclick={closeMobile}
				>
					<span class="nav-icon">{@html icons[item.icon]}</span>
					{item.label}
				</a>
			{/each}
		{/if}
	</nav>
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
		manage: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>'
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
</style>
