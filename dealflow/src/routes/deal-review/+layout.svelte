<script>
	import AppShell from '$lib/layout/AppShell.svelte';
	import { page } from '$app/stores';
	import { isAdmin } from '$lib/stores/auth.js';

	let { children } = $props();
	const currentPage = $derived(
		$isAdmin && $page.url.searchParams.get('from') === 'queue' ? 'admin-manage' : 'deals'
	);
</script>

<AppShell {currentPage}>
	{@render children()}
</AppShell>
