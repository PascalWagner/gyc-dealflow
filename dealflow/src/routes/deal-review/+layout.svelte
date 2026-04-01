<script>
	import AuthenticatedAppShellLayout from '$lib/layout/AuthenticatedAppShellLayout.svelte';
	import { page } from '$app/stores';
	import { isAdmin } from '$lib/stores/auth.js';

	let { children } = $props();
	const currentPage = $derived(
		$isAdmin && $page.url.searchParams.get('from') === 'queue' ? 'admin-manage' : 'deals'
	);
</script>

<AuthenticatedAppShellLayout {currentPage}>
	{@render children()}
</AuthenticatedAppShellLayout>
