<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import PageContainer from '$lib/layout/PageContainer.svelte';

	function buildPlanRedirect() {
		const params = new URLSearchParams(window.location.search);
		const nextParams = new URLSearchParams();
		for (const key of ['stage', 'branch', 'edit', 'wizard']) {
			const value = params.get(key);
			if (value) nextParams.set(key, value);
		}
		const query = nextParams.toString();
		return `/app/plan${query ? `?${query}` : ''}`;
	}

	onMount(() => {
		if (!browser) return;
		goto(buildPlanRedirect(), { replaceState: true });
	});
</script>

<svelte:head>
	<title>Plan | GYC</title>
</svelte:head>

<PageContainer className="plan-redirect-shell">
	<div class="plan-redirect-card">
		<div class="plan-redirect-title">Opening your plan</div>
		<div class="plan-redirect-copy">Plan setup now lives inside the main app experience.</div>
	</div>
</PageContainer>

<style>
	.plan-redirect-shell {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 24px;
		background: var(--bg-page, #f6f8f7);
	}

	.plan-redirect-card {
		width: min(100%, 420px);
		padding: 24px;
		border-radius: 18px;
		border: 1px solid var(--border, #dde5e8);
		background: var(--bg-card, #fff);
		box-shadow: 0 16px 48px rgba(7, 20, 19, 0.08);
		text-align: center;
	}

	.plan-redirect-title {
		font-family: var(--font-ui);
		font-size: 18px;
		font-weight: 700;
		color: var(--text-dark, #141413);
		margin-bottom: 8px;
	}

	.plan-redirect-copy {
		font-size: 14px;
		line-height: 1.6;
		color: var(--text-secondary, #607179);
	}
</style>
