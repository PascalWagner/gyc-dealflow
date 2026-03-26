<script>
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import PlanFitMeter from '$lib/components/PlanFitMeter.svelte';
	import {
		OPTIONAL_DECISION_COMPARE_FIELDS,
		buildComparisonMap,
		chunkItems,
		formatFieldValue,
		formatMoneyCompact,
		formatPercent,
		getColumnsForWidth,
		getSectionedFields,
		getVisibleFieldDefinitions,
		normalizeFieldSelection
	} from '$lib/utils/decisionCompare.js';

	let {
		deals = [],
		remainingDeals = [],
		totalDealsInDecision = null,
		maxDeals = 6,
		fieldStorageKey = 'gycDecisionCompareVisibleFields',
		onremove = () => {},
		onadd = () => {},
		onopen = () => {},
		onstagechange = () => {}
	} = $props();

	let viewportWidth = $state(browser ? window.innerWidth : 1440);
	let optionalFieldIds = $state([]);
	let fieldPickerOpen = $state(false);
	let fieldPreferencesReady = $state(!browser);
	let fieldPickerRoot;

	const selectedDeals = $derived(deals.slice(0, maxDeals));
	const totalDecisionDeals = $derived(totalDealsInDecision ?? (selectedDeals.length + remainingDeals.length));
	const dealColumns = $derived(getColumnsForWidth(viewportWidth));
	const dealGroups = $derived(chunkItems(selectedDeals, dealColumns));
	const visibleFields = $derived(getVisibleFieldDefinitions(optionalFieldIds));
	const visibleSections = $derived(getSectionedFields(optionalFieldIds));
	const comparisonMap = $derived(buildComparisonMap(selectedDeals, visibleFields));
	const lastContentSectionId = $derived(
		visibleSections
			.filter((section) => section.id !== 'actions')
			.at(-1)?.id ?? null
	);
	const canCompare = $derived(selectedDeals.length >= 2);
	const canAddMore = $derived(selectedDeals.length < maxDeals);

	function handleOptionalFieldToggle(fieldId, checked) {
		const nextIds = checked
			? normalizeFieldSelection([...optionalFieldIds, fieldId])
			: optionalFieldIds.filter((id) => id !== fieldId);

		optionalFieldIds = nextIds;
	}

	onMount(() => {
		if (!browser) return undefined;

		try {
			const storedIds = JSON.parse(localStorage.getItem(fieldStorageKey) || '[]');
			optionalFieldIds = normalizeFieldSelection(storedIds);
		} catch {
			optionalFieldIds = [];
		}
		fieldPreferencesReady = true;

		const handleResize = () => {
			viewportWidth = window.innerWidth;
		};

		const handlePointerDown = (event) => {
			if (!fieldPickerOpen) return;
			if (fieldPickerRoot?.contains(event.target)) return;
			fieldPickerOpen = false;
		};

		window.addEventListener('resize', handleResize);
		window.addEventListener('pointerdown', handlePointerDown);

		return () => {
			window.removeEventListener('resize', handleResize);
			window.removeEventListener('pointerdown', handlePointerDown);
		};
	});

	$effect(() => {
		if (!browser || !fieldPreferencesReady) return;
		localStorage.setItem(fieldStorageKey, JSON.stringify(optionalFieldIds));
	});
</script>

{#if totalDecisionDeals > 0}
	<div class="decision-status-banner" class:is-positive={totalDecisionDeals >= 3}>
		{#if totalDecisionDeals >= 3}
			<span class="banner-icon">✓</span>
			<span>Great - {totalDecisionDeals} deals to compare. Review below before committing capital.</span>
		{:else}
			<span class="banner-icon">!</span>
			<span>Compare at least 3 deals before investing. You currently have {totalDecisionDeals} in Decide.</span>
		{/if}
	</div>
{/if}

{#if canCompare}
	<div class="compare-blocks">
		{#each dealGroups as dealGroup, groupIndex (groupIndex)}
			<div class="compare-table-wrap">
				<table class="compare-table" style={`--deal-count:${dealGroup.length};`}>
					<thead>
						<tr>
							<th class="col-label header-corner"></th>
							{#each dealGroup as deal}
								<th class="deal-header">
									<button class="compare-remove-btn" onclick={() => onremove(deal.id)} title="Remove from comparison" type="button">
										&times;
									</button>
									<button class="deal-header-name" onclick={() => onopen(deal.id)} type="button">
										{deal.name}
									</button>
									<div class="deal-header-sponsor">{deal.sponsor || '\u2014'}</div>
								</th>
							{/each}
						</tr>
					</thead>
					<tbody>
						{#each visibleSections as section}
							<tr class="section-row">
								<td colspan={dealGroup.length + 1}>{section.title}</td>
							</tr>

							{#each section.fields as field}
								<tr class:actions-row={field.kind === 'actions'}>
									<td class="col-label">{field.label}</td>
									{#each dealGroup as deal}
										{@const isBestValue = comparisonMap[field.id]?.bestDealIds?.has(deal.id)}
										<td class="col-deal" class:best-val={isBestValue}>
											{#if field.kind === 'planFit'}
												<PlanFitMeter score={field.accessor(deal)} highlight={isBestValue} />
											{:else if field.kind === 'actions'}
												<div class="action-group">
													<button class="compare-action-btn" onclick={() => onstagechange(deal.id, 'connect')} type="button">
														Back to DD
													</button>
													<button class="compare-action-btn primary" onclick={() => onstagechange(deal.id, 'invested')} type="button">
														Mark as Invested
													</button>
												</div>
											{:else}
												<span class="cell-value">{formatFieldValue(field, deal)}</span>
											{/if}
										</td>
									{/each}
								</tr>
							{/each}

							{#if groupIndex === 0 && section.id === lastContentSectionId && OPTIONAL_DECISION_COMPARE_FIELDS.length > 0}
								<tr class="field-toggle-row">
									<td colspan={dealGroup.length + 1}>
										<div class="compare-add-fields" bind:this={fieldPickerRoot}>
											<button class="compare-add-fields-btn" onclick={() => fieldPickerOpen = !fieldPickerOpen} type="button">
												<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" aria-hidden="true">
													<line x1="12" y1="5" x2="12" y2="19"></line>
													<line x1="5" y1="12" x2="19" y2="12"></line>
												</svg>
												Add / remove fields
											</button>

											{#if fieldPickerOpen}
												<div class="compare-field-picker">
													{#each OPTIONAL_DECISION_COMPARE_FIELDS as field}
														<label class="compare-field-option">
															<input
																type="checkbox"
																checked={optionalFieldIds.includes(field.id)}
																onchange={(event) => handleOptionalFieldToggle(field.id, event.currentTarget.checked)}
															/>
															<span>{field.label}</span>
														</label>
													{/each}
												</div>
											{/if}
										</div>
									</td>
								</tr>
							{/if}
						{/each}
					</tbody>
				</table>
			</div>
		{/each}
	</div>
{:else}
	<div class="compare-empty">
		<div class="compare-empty-title">Select at least 2 deals to compare</div>
		<div class="compare-empty-copy">
			{#if totalDecisionDeals >= 2}
				Choose finalists from the cards below and this view will render the full Decide comparison table.
			{:else}
				Move at least 2 deals into Decide to unlock side-by-side comparison.
			{/if}
		</div>
	</div>
{/if}

{#if remainingDeals.length > 0}
	<div class="remaining-section">
		<div class="remaining-section-title">{remainingDeals.length} More Deal{remainingDeals.length === 1 ? '' : 's'} In Decision</div>
		<div class="remaining-grid">
			{#each remainingDeals as deal}
				<article class="remaining-card">
					<div class="remaining-pill">{deal.assetClass || 'Deal'}</div>
					<button class="remaining-name" onclick={() => onopen(deal.id)} type="button">
						{deal.name}
					</button>
					<div class="remaining-sponsor">{deal.sponsor || '\u2014'}</div>
					<div class="remaining-meta">
						<span>IRR {formatPercent(deal.returns?.irr)}</span>
						<span>Min {formatMoneyCompact(deal.terms?.minimum)}</span>
					</div>
					<button class="remaining-cta" onclick={() => onadd(deal.id)} disabled={!canAddMore} type="button">
						{canAddMore ? '+ Add to Compare' : 'Comparison Full'}
					</button>
				</article>
			{/each}
		</div>
	</div>
{/if}

<style>
	.decision-status-banner {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 12px 16px;
		border-radius: 12px;
		border: 1px solid rgba(245, 158, 11, 0.22);
		background: rgba(245, 158, 11, 0.06);
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 600;
		color: #b45309;
	}

	.decision-status-banner.is-positive {
		border-color: rgba(5, 150, 105, 0.18);
		background: rgba(5, 150, 105, 0.05);
		color: #059669;
	}

	.banner-icon {
		flex-shrink: 0;
	}

	.compare-blocks {
		display: grid;
		gap: 18px;
	}

	.compare-table-wrap {
		border: 1px solid var(--border);
		border-radius: 16px;
		background: var(--bg-card);
		box-shadow: var(--shadow-card);
	}

	.compare-table {
		width: 100%;
		border-collapse: separate;
		border-spacing: 0;
		table-layout: fixed;
		font-family: var(--font-ui);
		font-size: 13px;
	}

	.compare-table th,
	.compare-table td {
		padding: 10px 12px;
		border-bottom: 1px solid var(--border-light, var(--border));
		vertical-align: middle;
	}

	.compare-table thead th {
		position: sticky;
		top: 0;
		z-index: 2;
		background: var(--bg-card);
	}

	.header-corner {
		width: 128px;
		min-width: 128px;
	}

	.col-label {
		width: 128px;
		min-width: 128px;
		text-align: left;
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.5px;
		text-transform: uppercase;
		color: var(--text-muted);
		background: var(--bg-card);
	}

	.deal-header {
		position: relative;
		padding: 18px 18px 16px;
		text-align: center;
		border-bottom: 2px solid var(--border);
	}

	.deal-header-name {
		border: none;
		background: none;
		padding: 0;
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		line-height: 1.35;
		text-decoration: underline;
		color: var(--text-dark);
		cursor: pointer;
	}

	.deal-header-sponsor {
		margin-top: 4px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-muted);
	}

	.compare-remove-btn {
		position: absolute;
		top: 8px;
		right: 8px;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 22px;
		height: 22px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: var(--bg-hover, rgba(15, 23, 42, 0.03));
		color: var(--text-muted);
		font-size: 14px;
		line-height: 1;
		cursor: pointer;
	}

	.compare-remove-btn:hover {
		border-color: #fca5a5;
		background: #fee2e2;
		color: #ef4444;
	}

	.section-row td {
		padding: 14px 12px 6px;
		border-bottom: none;
		font-size: 11px;
		font-weight: 800;
		letter-spacing: 1px;
		text-transform: uppercase;
		color: var(--primary);
		background: var(--bg-card);
	}

	.col-deal {
		text-align: center;
		color: var(--text-dark);
	}

	.cell-value {
		display: block;
		font-size: 15px;
		font-weight: 700;
		color: inherit;
	}

	.best-val {
		background: rgba(81, 190, 123, 0.08);
		color: var(--primary);
	}

	.field-toggle-row td {
		padding: 8px 12px;
		border-bottom: none;
	}

	.compare-add-fields {
		position: relative;
		display: flex;
		justify-content: center;
	}

	.compare-add-fields-btn {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 6px 14px;
		border: 1px dashed var(--border);
		border-radius: 999px;
		background: transparent;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-muted);
		cursor: pointer;
	}

	.compare-add-fields-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.compare-field-picker {
		position: absolute;
		left: 50%;
		bottom: calc(100% + 8px);
		transform: translateX(-50%);
		display: grid;
		gap: 2px;
		min-width: 190px;
		padding: 8px 4px;
		border: 1px solid var(--border);
		border-radius: 12px;
		background: var(--bg-card);
		box-shadow: 0 16px 40px rgba(15, 23, 42, 0.12);
		z-index: 5;
	}

	.compare-field-option {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 10px;
		border-radius: 8px;
		font-size: 12px;
		color: var(--text-dark);
		cursor: pointer;
	}

	.compare-field-option:hover {
		background: var(--bg-hover, rgba(15, 23, 42, 0.03));
	}

	.compare-field-option input[type='checkbox'] {
		accent-color: var(--primary);
	}

	.actions-row td {
		padding-top: 12px;
		padding-bottom: 12px;
		border-bottom: none;
	}

	.action-group {
		display: flex;
		gap: 6px;
	}

	.compare-action-btn {
		flex: 1;
		padding: 8px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--bg-card);
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 700;
		color: var(--text-dark);
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.compare-action-btn:hover {
		border-color: var(--primary);
		color: var(--primary);
	}

	.compare-action-btn.primary {
		border-color: var(--primary);
		background: var(--primary);
		color: #fff;
	}

	.compare-action-btn.primary:hover {
		opacity: 0.92;
		color: #fff;
	}

	.compare-empty {
		padding: 36px 28px;
		border: 1px dashed var(--border);
		border-radius: 16px;
		background: var(--bg-card);
		text-align: center;
	}

	.compare-empty-title {
		font-family: var(--font-ui);
		font-size: 16px;
		font-weight: 700;
		color: var(--text-dark);
	}

	.compare-empty-copy {
		margin-top: 6px;
		font-family: var(--font-body);
		font-size: 13px;
		line-height: 1.6;
		color: var(--text-secondary);
	}

	.remaining-section {
		display: grid;
		gap: 14px;
	}

	.remaining-section-title {
		font-family: var(--font-ui);
		font-size: 12px;
		font-weight: 800;
		letter-spacing: 0.7px;
		text-transform: uppercase;
		color: var(--text-muted);
	}

	.remaining-grid {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		gap: 12px;
	}

	.remaining-card {
		display: grid;
		align-content: start;
		gap: 8px;
		padding: 14px;
		border: 1px solid var(--border);
		border-radius: 14px;
		background: var(--bg-card);
		box-shadow: var(--shadow-card);
	}

	.remaining-pill {
		justify-self: start;
		padding: 3px 8px;
		border-radius: 999px;
		background: var(--green-bg, rgba(81, 190, 123, 0.12));
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.3px;
		text-transform: uppercase;
		color: var(--green, var(--primary));
	}

	.remaining-name {
		border: none;
		background: none;
		padding: 0;
		text-align: left;
		font-family: var(--font-ui);
		font-size: 13px;
		font-weight: 700;
		line-height: 1.4;
		text-decoration: underline;
		color: var(--text-dark);
		cursor: pointer;
	}

	.remaining-sponsor {
		font-size: 11px;
		color: var(--text-muted);
	}

	.remaining-meta {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		font-size: 11px;
		font-weight: 600;
		color: var(--text-secondary);
	}

	.remaining-cta {
		margin-top: 6px;
		padding: 8px 12px;
		border: 1px solid rgba(168, 85, 247, 0.22);
		border-radius: 8px;
		background: rgba(168, 85, 247, 0.06);
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: #a855f7;
		cursor: pointer;
	}

	.remaining-cta:disabled {
		border-color: var(--border);
		background: var(--bg-hover, rgba(15, 23, 42, 0.03));
		color: var(--text-muted);
		cursor: not-allowed;
	}

	@media (max-width: 1479px) {
		.remaining-grid {
			grid-template-columns: repeat(3, minmax(0, 1fr));
		}
	}

	@media (max-width: 1099px) {
		.remaining-grid {
			grid-template-columns: repeat(2, minmax(0, 1fr));
		}
	}

	@media (max-width: 767px) {
		.compare-table th,
		.compare-table td {
			padding: 10px 10px;
		}

		.header-corner,
		.col-label {
			width: 112px;
			min-width: 112px;
			font-size: 10px;
		}

		.deal-header-name {
			font-size: 15px;
		}

		.cell-value {
			font-size: 14px;
		}

		.action-group {
			flex-direction: column;
		}

		.remaining-grid {
			grid-template-columns: 1fr;
		}
	}
</style>
