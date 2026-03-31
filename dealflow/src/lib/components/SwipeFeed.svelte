<script>
	import DealCard from '$lib/components/DealCard.svelte';

	let {
		deals = [],
		compareIds = [],
		getActionModel = () => ({ utilityAction: null, footerActions: [] }),
		getUtilityAnalytics = () => null,
		pendingFooterActionByDealId = {},
		isCompareAtLimit = () => false,
		onutilityaction = () => {},
		onfooteraction = () => {},
		oncardview = () => {}
	} = $props();

	let currentIndex = $state(0);
	let focusedDealId = $state(null);
	let touchStartX = $state(0);
	let touchStartY = $state(0);
	let swipeConsumed = $state(false);

	const SWIPE_THRESHOLD = 56;

	const currentDeal = $derived(deals[currentIndex] || null);
	const compareSet = $derived(new Set(compareIds));
	const currentActionModel = $derived(
		currentDeal ? (getActionModel(currentDeal) ?? { utilityAction: null, footerActions: [] }) : { utilityAction: null, footerActions: [] }
	);
	const currentUtilityAction = $derived(currentActionModel.utilityAction || null);
	const currentUtilityAnalytics = $derived(
		currentDeal ? getUtilityAnalytics(currentDeal, currentUtilityAction) : null
	);
	const pendingFooterActionId = $derived(currentDeal ? pendingFooterActionByDealId[currentDeal.id] || '' : '');
	const stageActionPending = $derived(Boolean(pendingFooterActionId));

	function nextCard() {
		if (currentIndex < deals.length - 1) {
			currentIndex += 1;
		}
	}

	function prevCard() {
		if (currentIndex > 0) {
			currentIndex -= 1;
		}
	}

	function handleTouchStart(event) {
		const touch = event.touches?.[0];
		if (!touch) return;
		touchStartX = touch.clientX;
		touchStartY = touch.clientY;
		swipeConsumed = false;
	}

	function handleTouchEnd(event) {
		const touch = event.changedTouches?.[0];
		if (!touch) return;
		const deltaX = touch.clientX - touchStartX;
		const deltaY = touch.clientY - touchStartY;

		if (Math.abs(deltaX) < SWIPE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) {
			resetTouchState();
			return;
		}

		swipeConsumed = true;
		if (deltaX < 0) nextCard();
		else prevCard();
		resetTouchState();
	}

	function resetTouchState() {
		touchStartX = 0;
		touchStartY = 0;
	}

	function handleCardShellClick(event) {
		if (swipeConsumed) {
			event.preventDefault();
			event.stopPropagation();
			swipeConsumed = false;
			return;
		}
		if (currentDeal?.id) oncardview(currentDeal.id);
	}

	$effect(() => {
		if (deals.length === 0) {
			currentIndex = 0;
			focusedDealId = null;
			return;
		}

		if (focusedDealId) {
			const preservedIndex = deals.findIndex((deal) => deal.id === focusedDealId);
			if (preservedIndex !== -1) {
				currentIndex = preservedIndex;
				return;
			}
		}

		if (currentIndex >= deals.length) currentIndex = deals.length - 1;
		if (currentIndex < 0) currentIndex = 0;
	});

	$effect(() => {
		focusedDealId = currentDeal?.id ?? null;
	});
</script>

<div class="swipe-container">
	{#if deals.length === 0}
		<div class="swipe-empty">
			<div class="swipe-empty-icon">🔍</div>
			<div class="swipe-empty-text">No deals to show</div>
			<div class="swipe-empty-sub">Try adjusting your filters</div>
		</div>
	{:else if currentDeal}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="swipe-card-shell"
			onclick={handleCardShellClick}
			ontouchstart={handleTouchStart}
			ontouchend={handleTouchEnd}
			ontouchcancel={resetTouchState}
		>
			<DealCard
				deal={currentDeal}
				footerActions={currentActionModel.footerActions || []}
				stageActionPending={stageActionPending}
				{pendingFooterActionId}
				utilityAction={currentUtilityAction}
				utilityAnalytics={currentUtilityAnalytics}
				compareSelected={compareSet.has(currentDeal.id)}
				compareAtLimit={isCompareAtLimit(currentDeal.id)}
				{onutilityaction}
				{onfooteraction}
			/>
		</div>

		{#if deals.length > 1}
			<div class="swipe-nav">
				<button class="nav-arrow" onclick={prevCard} disabled={currentIndex === 0} aria-label="Previous deal">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
						<polyline points="15 18 9 12 15 6"></polyline>
					</svg>
				</button>
				<div class="swipe-position">{currentIndex + 1} of {deals.length}</div>
				<button class="nav-arrow" onclick={nextCard} disabled={currentIndex >= deals.length - 1} aria-label="Next deal">
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
						<polyline points="9 18 15 12 9 6"></polyline>
					</svg>
				</button>
			</div>
		{/if}
	{/if}
</div>

<style>
	.swipe-container {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 16px;
		padding-bottom: 0;
	}

	.swipe-card-shell {
		width: 100%;
		max-width: 420px;
		touch-action: pan-y;
	}

	.swipe-card-shell :global(.deal-card) {
		width: 100%;
	}

	.swipe-nav {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.nav-arrow {
		width: 40px;
		height: 40px;
		border-radius: 50%;
		border: 1px solid var(--border);
		background: var(--bg-card);
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		color: var(--text-secondary);
		transition: all 0.15s;
	}

	.nav-arrow:disabled {
		opacity: 0.3;
		cursor: default;
	}

	.nav-arrow:not(:disabled):hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.swipe-position {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-muted);
		min-width: 64px;
		text-align: center;
	}

	.swipe-empty {
		text-align: center;
		padding: 60px 20px;
	}

	.swipe-empty-icon {
		font-size: 40px;
		margin-bottom: 12px;
	}

	.swipe-empty-text {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.swipe-empty-sub {
		font-family: var(--font-ui);
		font-size: 13px;
		color: var(--text-muted);
		margin-top: 4px;
	}

	@media (max-width: 560px) {
		.swipe-container {
			gap: 14px;
			padding-bottom: 0;
		}

		.swipe-card-shell {
			max-width: 100%;
		}
	}
</style>
