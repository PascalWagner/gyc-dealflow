<script>
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MainContent from '$lib/layout/MainContent.svelte';
	import { tapLight } from '$lib/utils/haptics.js';

	export let currentPage = 'dashboard';
	export let className = '';
	export let showMobileTabs = true;

	const mobileNavItems = [
		{
			href: '/app/dashboard',
			label: 'Dashboard',
			key: 'dashboard',
			icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>'
		},
		{
			href: '/app/market-intel',
			label: 'Intel',
			key: 'market-intel',
			icon: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>'
		},
		{
			href: '/app/deals',
			label: 'Deal Flow',
			key: 'deals',
			icon: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>'
		},
		{
			href: '/app/operators',
			label: 'Operators',
			key: 'operators',
			icon: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>'
		},
		{
			href: '/app/more',
			label: 'More',
			key: 'more',
			icon: '<circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/>'
		}
	];
</script>

<div class={`ly-app-shell ly-sidebar-shell ${className}`.trim()}>
	<Sidebar {currentPage} />

	<MainContent>
		<slot />
	</MainContent>

	{#if showMobileTabs}
		<nav class="mobile-tabs ly-mobile-tabs" aria-label="Primary navigation">
			{#each mobileNavItems as item}
				<a
					href={item.href}
					class="mobile-tab ly-mobile-tab"
					class:active={currentPage === item.key}
					onclick={tapLight}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
						{@html item.icon}
					</svg>
					<span>{item.label}</span>
				</a>
			{/each}
		</nav>
	{/if}
</div>
