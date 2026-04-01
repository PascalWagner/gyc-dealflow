<script>
	import Sidebar from '$lib/components/Sidebar.svelte';
	import MainContent from '$lib/layout/MainContent.svelte';
	import { PRIMARY_MOBILE_NAV_ITEMS } from '$lib/navigation/app-nav.js';
	import { tapLight } from '$lib/utils/haptics.js';

	export let currentPage = 'dashboard';
	export let className = '';
	export let showMobileTabs = true;

	const mobileNavItems = PRIMARY_MOBILE_NAV_ITEMS;
	const mobileTabBarOffset = 'calc(72px + env(safe-area-inset-bottom, 0px))';
</script>

<div
	class={`ly-app-shell ly-sidebar-shell ${className}`.trim()}
	style={showMobileTabs
		? `--ly-mobile-tab-bar-offset: ${mobileTabBarOffset}; --ly-main-pad-bottom-tablet: ${mobileTabBarOffset}; --ly-main-pad-bottom-mobile: ${mobileTabBarOffset};`
		: ''}
>
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
