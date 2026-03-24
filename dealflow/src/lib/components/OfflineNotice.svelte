<script>
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';

	let online = $state(true);

	onMount(() => {
		if (!browser) return;

		const setOnline = () => {
			online = true;
		};
		const setOffline = () => {
			online = false;
		};

		online = navigator.onLine;
		window.addEventListener('online', setOnline);
		window.addEventListener('offline', setOffline);

		return () => {
			window.removeEventListener('online', setOnline);
			window.removeEventListener('offline', setOffline);
		};
	});
</script>

{#if !online}
	<div class="offline-banner">
		<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
			<line x1="1" y1="1" x2="23" y2="23"/>
			<path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55"/>
			<path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39"/>
			<path d="M10.71 5.05A16 16 0 0 1 22.56 9"/>
			<path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88"/>
			<path d="M8.53 16.11a6 6 0 0 1 6.95 0"/>
			<line x1="12" y1="20" x2="12.01" y2="20"/>
		</svg>
		<span>You're offline. Some features may be unavailable.</span>
	</div>
{/if}

<style>
	.offline-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background: #f59e0b;
		color: #000;
		text-align: center;
		padding: 8px 16px;
		font-family: var(--font-ui, sans-serif);
		font-size: 13px;
		font-weight: 600;
		z-index: 10000;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 8px;
	}
</style>
