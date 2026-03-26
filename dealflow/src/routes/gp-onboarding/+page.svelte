<script>
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import { onMount } from 'svelte';

	// gp-onboarding and onboarding are the same unified flow.
	// Redirect to /onboarding preserving query params and hash.
	onMount(() => {
		const search = $page.url.search || '';
		const hash = $page.url.hash || '';
		goto('/onboarding' + search + hash, { replaceState: true });
	});
</script>

<div class="gp-onboarding-page ly-page">
	<div class="gp-onboarding-shell ly-frame">
		<div class="gp-onboarding-status">
			<p>Redirecting...</p>
		</div>
	</div>
</div>

<style>
	.gp-onboarding-page {
		--ly-frame-max: 900px;
		--ly-frame-pad-desktop: 20px;
		--ly-frame-pad-tablet: 20px;
		--ly-frame-pad-mobile: 8px;
		--ly-frame-pad-top: 40px;
		--ly-frame-pad-bottom: 40px;
		--ly-frame-pad-top-tablet: 20px;
		--ly-frame-pad-bottom-tablet: 20px;
		--ly-frame-pad-top-mobile: 12px;
		--ly-frame-pad-bottom-mobile: 12px;
		min-height: 100vh;
		min-height: 100dvh;
	}

	.gp-onboarding-shell {
		min-height: calc(100dvh - 80px);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.gp-onboarding-status p {
		font-family: var(--font-ui);
		color: var(--text-muted);
		font-size: 14px;
	}

	@media (max-width: 700px) {
		.gp-onboarding-page {
			--ly-frame-pad-mobile: 8px;
			--ly-frame-pad-top-mobile: 12px;
			--ly-frame-pad-bottom-mobile: 12px;
		}

		.gp-onboarding-shell {
			min-height: calc(100dvh - 24px);
		}
	}

	@media (max-width: 380px) {
		.gp-onboarding-page {
			--ly-frame-pad-mobile: 4px;
			--ly-frame-pad-top-mobile: 8px;
			--ly-frame-pad-bottom-mobile: 8px;
		}

		.gp-onboarding-shell {
			min-height: calc(100dvh - 16px);
		}
	}
</style>
