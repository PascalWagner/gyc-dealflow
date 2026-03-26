<script>
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import LegacyPlanWizard from '$lib/components/LegacyPlanWizard.svelte';
	import OnboardingFocusLayout from '$lib/components/onboarding/OnboardingFocusLayout.svelte';
	import { getStoredSessionUser } from '$lib/stores/auth.js';
	import { currentAdminRealUser, getUserScopedCacheSnapshot } from '$lib/utils/userScopedState.js';
	import { hasCompletedPlan, normalizeWizardData } from '$lib/onboarding/planWizard.js';

	let loading = $state(true);
	let wizardData = $state(normalizeWizardData({}));
	let portfolioPlan = $state(null);
	let wizardStage = $state('');
	let wizardBranch = $state('');
	let wizardFlowKey = $state('');
	let wizardComponent = $state(null);

	function syncWizardView(detail = {}) {
		const nextWizard = normalizeWizardData(detail.wizardData || wizardData || {});
		wizardData = nextWizard;
		if (detail.persistedPortfolioPlan && detail.portfolioPlan) {
			portfolioPlan = detail.portfolioPlan;
		}
	}

	function handleWizardState(event) {
		syncWizardView(event.detail || {});
	}

	function routeStateFromLocation() {
		const params = new URLSearchParams(window.location.search);
		wizardStage = params.get('stage') || '';
		wizardBranch = params.get('branch') || '';
		wizardFlowKey = params.get('flow') || '';
	}

	function shouldStayInFocus(hasPlanValue) {
		return !hasPlanValue || Boolean(wizardStage) || Boolean(wizardFlowKey);
	}

	async function exitSetup() {
		await wizardComponent?.persistProgress?.();
		goto('/app/dashboard');
	}

	function maybeRedirectToAppPlan(hasPlanValue) {
		if (!shouldStayInFocus(hasPlanValue)) {
			goto('/app/plan?edit=1', { replaceState: true });
			return true;
		}
		return false;
	}

	onMount(async () => {
		if (!browser) return;

		const sessionUser = getStoredSessionUser();
		if (!sessionUser?.email) {
			goto('/login?return=' + encodeURIComponent('/onboarding/plan' + window.location.search), { replaceState: true });
			return;
		}

		routeStateFromLocation();

		const snapshot = getUserScopedCacheSnapshot();
		portfolioPlan = snapshot.portfolioPlan;
		wizardData = normalizeWizardData(snapshot.buyBoxWizard || {});

		if (maybeRedirectToAppPlan(hasCompletedPlan(wizardData, portfolioPlan))) {
			return;
		}

		try {
			if (!sessionUser?.token) {
				loading = false;
				return;
			}

			const realUser = currentAdminRealUser();
			const isAdminImpersonation =
				!!realUser?.email &&
				realUser.email.toLowerCase() !== String(sessionUser.email || '').toLowerCase();

			const url = new URL('/api/buybox', window.location.origin);
			url.searchParams.set('email', sessionUser.email);
			if (isAdminImpersonation) url.searchParams.set('admin', 'true');

			const response = await fetch(url.pathname + url.search, {
				headers: { Authorization: `Bearer ${sessionUser.token}` }
			});

			if (response.ok) {
				const data = await response.json();
				if (data?.buyBox && Object.keys(data.buyBox).length > 0) {
					wizardData = normalizeWizardData(data.buyBox);
				}
			}
		} catch (error) {
			console.warn('Failed to load focus onboarding state:', error);
		} finally {
			loading = false;
			maybeRedirectToAppPlan(hasCompletedPlan(wizardData, portfolioPlan));
		}
	});
</script>

<svelte:head>
	<title>Setup Your Plan | GYC</title>
</svelte:head>

<OnboardingFocusLayout exitLabel="Skip for now" onExit={exitSetup}>
	{#if loading}
		<div class="focus-loading ob-surface">
			<div class="focus-loading__line short"></div>
			<div class="focus-loading__line long"></div>
			<div class="focus-loading__line medium"></div>
		</div>
	{:else}
		<LegacyPlanWizard
			bind:this={wizardComponent}
			initialData={wizardData}
			forcedStage={wizardStage}
			forcedBranch={wizardBranch}
			forcedFlowKey={wizardFlowKey}
			on:state={handleWizardState}
			on:complete={(event) => goto(event.detail?.redirectTo || '/app/deals')}
		/>
	{/if}
</OnboardingFocusLayout>

<style>
	.focus-loading {
		padding: 28px;
		display: grid;
		gap: 12px;
	}

	.focus-loading__line {
		height: 14px;
		border-radius: 999px;
		background: linear-gradient(90deg, rgba(221, 229, 232, 0.9), rgba(237, 241, 242, 0.7));
	}

	.focus-loading__line.short {
		width: 140px;
	}

	.focus-loading__line.medium {
		width: 72%;
	}

	.focus-loading__line.long {
		width: 92%;
		height: 32px;
	}
</style>
