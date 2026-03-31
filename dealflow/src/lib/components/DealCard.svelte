<script>
	import { goto } from '$app/navigation';
	import DealReturnsMiniChart from '$lib/components/DealReturnsMiniChart.svelte';
	import { getDealCardHeroConfig } from '$lib/utils/dealCardHero.js';
	import {
		getDealCardActionLabel,
		trackDealCardCompareActionDisabledImpression,
		trackDealCardCompareActionImpression,
		trackDealCardUtilityActionDisabledImpression,
		trackDealCardUtilityActionImpression
	} from '$lib/utils/dealCardUtilityAction.js';
	import { getDealOperatorName } from '$lib/utils/dealSponsors.js';
	import { tapLight } from '$lib/utils/haptics.js';

	let {
		deal,
		utilityAction = null,
		utilityAnalytics = null,
		compareAction = null,
		compareAnalytics = null,
		footerActions = [],
		stageActionPending = false,
		pendingFooterActionId = '',
		compareSelected = false,
		compareAtLimit = false,
		oncontrolaction = () => {},
		onfooteraction = () => {}
	} = $props();

	const CARD_CONTROL_SELECTOR = [
		'button',
		'a',
		'input',
		'select',
		'textarea',
		'summary',
		'[role="button"]',
		'[data-card-control="true"]'
	].join(', ');

	function hasValue(value) {
		if (value === undefined || value === null) return false;
		if (typeof value === 'string') return value.trim() !== '';
		if (Array.isArray(value)) return value.length > 0;
		return true;
	}

	function firstDefined(...values) {
		for (const value of values) {
			if (!hasValue(value)) continue;
			if (Array.isArray(value)) return value[0];
			return typeof value === 'string' ? value.trim() : value;
		}
		return '';
	}

	function fmtPct(val) {
		if (!hasValue(val)) return '—';
		const numeric = typeof val === 'string' ? Number.parseFloat(val) : Number(val);
		if (!Number.isFinite(numeric)) return '—';
		return `${(numeric > 1 ? numeric : numeric * 100).toFixed(1)}%`;
	}

	function fmtMoney(val) {
		if (!hasValue(val)) return '—';
		const numeric = typeof val === 'string' ? Number.parseFloat(String(val).replace(/[$,]/g, '')) : Number(val);
		if (!Number.isFinite(numeric)) return '—';
		if (numeric >= 1e9) return `$${(numeric / 1e9).toFixed(1)}B`;
		if (numeric >= 1e6) return `$${(numeric / 1e6).toFixed(1)}M`;
		if (numeric >= 1e3) return `$${(numeric / 1e3).toFixed(0)}K`;
		return `$${numeric.toLocaleString()}`;
	}

	function fmtMultiple(val) {
		if (!hasValue(val)) return '—';
		const numeric = typeof val === 'string' ? Number.parseFloat(val) : Number(val);
		if (!Number.isFinite(numeric)) return '—';
		return `${numeric.toFixed(2)}x`;
	}

	function formatHold(val) {
		if (!hasValue(val)) return '—';
		if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open';
		const numeric = typeof val === 'string' ? Number.parseFloat(val) : Number(val);
		if (Number.isFinite(numeric)) {
			if (numeric < 1) return `${Math.round(numeric * 12)} Mos`;
			return `${numeric} ${numeric === 1 ? 'Yr' : 'Yrs'}`;
		}
		return val;
	}

	function formatDist(value) {
		return hasValue(value) ? value : '—';
	}

	function getManagerTier(sizeValue) {
		const size =
			typeof sizeValue === 'string'
				? Number.parseFloat(String(sizeValue).replace(/[$,]/g, ''))
				: Number(sizeValue);
		if (!Number.isFinite(size) || size <= 0) return { range: '—' };
		if (size >= 1000000000) return { range: '$1B+' };
		if (size >= 100000000) return { range: '$100M-1B' };
		if (size >= 50000000) return { range: '$50-100M' };
		return { range: '<$50M' };
	}

	function getStrategySummary(inputDeal) {
		const text = firstDefined(
			inputDeal.investmentStrategy,
			inputDeal.summary,
			inputDeal.description,
			inputDeal.teaser
		);
		if (!text) return '';
		const firstSentence = text.split(/(?<=[.!?])\s+/)[0];
		const clean = (firstSentence || text).trim();
		if (clean.length <= 140) return clean;
		return `${clean.slice(0, 137).replace(/[,;:\s]+$/, '')}...`;
	}

	function isCardControlTarget(target) {
		return target instanceof Element && Boolean(target.closest(CARD_CONTROL_SELECTOR));
	}

	function openDeal() {
		tapLight();
		goto(`/deal/${deal.id}`);
	}

	function handleCardClick(event) {
		if (isCardControlTarget(event.target)) return;
		openDeal();
	}

	function handleCardKeydown(event) {
		if (isCardControlTarget(event.target)) return;
		if (event.key !== 'Enter' && event.key !== ' ') return;
		event.preventDefault();
		openDeal();
	}

	function handleFooterAction(event, action) {
		event.stopPropagation();
		if (!action.next || action.disabled || stageActionPending) return;
		tapLight();
		onfooteraction({ deal, action });
	}

	function dispatchControlAction(event, action, analytics, labelShown, kind) {
		event.stopPropagation();
		if (!action?.show || action?.disabled || stageActionPending) return;
		tapLight();
		oncontrolaction({
			deal,
			kind,
			action,
			analytics: {
				...(analytics || {}),
				labelShown,
				isDisabled: Boolean(action?.disabled)
			}
		});
	}

	function trackVisibleControlImpression(action, analytics, labelShown, kind) {
		if (!action?.show || !analytics || !labelShown) return;
		const payload = {
			...analytics,
			labelShown,
			isDisabled: Boolean(action?.disabled)
		};
		if (payload.isDisabled) {
			if (kind === 'compare') {
				trackDealCardCompareActionDisabledImpression(payload);
				return;
			}
			trackDealCardUtilityActionDisabledImpression(payload);
			return;
		}
		if (kind === 'compare') {
			trackDealCardCompareActionImpression(payload);
			return;
		}
		trackDealCardUtilityActionImpression(payload);
	}

	const heroConfig = $derived(getDealCardHeroConfig(deal));
	const titleText = $derived(
		firstDefined(deal.investmentName, deal.investment_name, deal.name, 'Untitled Deal')
	);
	const managerText = $derived(
		getDealOperatorName(
			deal,
			firstDefined(
				deal.managementCompany,
				deal.management_company,
				deal.operator,
				deal.operatorName,
				deal.operator_name,
				deal.companyName
			)
		)
	);
	const descriptionText = $derived(getStrategySummary(deal));

	const preferredReturn = $derived(firstDefined(deal.preferredReturn, deal.prefReturn, deal.pref_return));
	const minimumInvestment = $derived(
		firstDefined(
			deal.investmentMinimum,
			deal.minimumInvestment,
			deal.minimum_investment,
			deal.minInvestment,
			deal.min_investment
		)
	);
	const holdPeriod = $derived(firstDefined(deal.holdPeriod, deal.hold_period));
	const distributionValue = $derived(
		firstDefined(deal.distributionFrequency, deal.distributions, deal.distribution_frequency)
	);
	const lpGpSplitValue = $derived(firstDefined(deal.lpGpSplit, deal.lp_gp_split));
	const equityMultipleValue = $derived(firstDefined(deal.equityMultiple, deal.equity_multiple));
	const managerAum = $derived(
		firstDefined(
			deal.fundAUM,
			deal.offeringSize,
			deal.offering_size,
			deal.aum,
			deal.managementCompanyAUM,
			deal.managerAUM,
			deal.manager_aum
		)
	);
	const foundedYear = $derived(firstDefined(deal.mcFoundingYear, deal.foundedYear, deal.founded_year));
	const managerTier = $derived(getManagerTier(managerAum));
	const hasNoDeck = $derived(
		!(
			firstDefined(
				deal.deckUrl,
				deal.deck_url,
				deal.ppmUrl,
				deal.ppm_url,
				deal.subAgreementUrl,
				deal.sub_agreement_url
			)
		)
	);

	const utilityLabel = $derived(
		getDealCardActionLabel(utilityAction, {
			compareSelected,
			compareAtLimit
		})
	);
	const compareLabel = $derived(
		getDealCardActionLabel(compareAction, {
			compareSelected,
			compareAtLimit
		})
	);

	const utilityVisible = $derived(Boolean(utilityAction?.show && utilityLabel));
	const compareVisible = $derived(Boolean(compareAction?.show && compareLabel));
	const footerVisible = $derived(compareVisible || utilityVisible || footerActions.length > 0);

	$effect(() => {
		trackVisibleControlImpression(utilityAction, utilityAnalytics, utilityLabel, 'utility');
		trackVisibleControlImpression(compareAction, compareAnalytics, compareLabel, 'compare');
	});
</script>

<div
	class="deal-card"
	class:is-compared={compareSelected}
	role="link"
	tabindex="0"
	aria-label={`Open ${titleText || 'deal'}`}
	onclick={handleCardClick}
	onkeydown={handleCardKeydown}
>
	<div
		class="card-hero"
		class:lending-hero={heroConfig.variant === 'lending-returns'}
		style={heroConfig.backgroundStyle}
	>
		<div class="hero-badges" aria-label="Deal tags">
			{#each heroConfig.badges as badgeText}
				<span class="badge" class:audit={badgeText === 'Audited'}>{badgeText}</span>
			{/each}
			{#if hasNoDeck}
				<span class="no-deck-bubble">No Deck</span>
			{/if}
		</div>

		<div class="hero-visual">
			{#if heroConfig.variant === 'lending-returns'}
				<div class="hero-returns-surface" aria-hidden="true">
					<DealReturnsMiniChart series={heroConfig.returnsSeries} variant="hero" />
				</div>
			{:else if heroConfig.variant === 'fallback' && heroConfig.icon}
				<div class="hero-icon">{heroConfig.icon}</div>
			{/if}
		</div>

		<div class="hero-headline">
			<span class="irr-value" class:is-placeholder={heroConfig.headlineValue === '—'}>{heroConfig.headlineValue}</span>
			<span class="irr-label">{heroConfig.headlineLabel}</span>
		</div>
	</div>

	<div class="card-body">
		<div class="card-copy">
			<div class="card-title">{titleText}</div>
			{#if managerText}
				<div class="card-manager">{managerText}</div>
			{/if}
			{#if descriptionText}
				<div class="card-description">{descriptionText}</div>
			{/if}
		</div>

		<div class="metrics">
			<div class="metric">
				<div class="metric-label">Pref Return</div>
				<div class="metric-value highlight">{fmtPct(preferredReturn)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Minimum</div>
				<div class="metric-value">{fmtMoney(minimumInvestment)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Lockup</div>
				<div class="metric-value">{formatHold(holdPeriod)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Distribution</div>
				<div class="metric-value">{formatDist(distributionValue)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">LP/GP Split</div>
				<div class="metric-value">{lpGpSplitValue && /\d+\s*\/\s*\d+/.test(lpGpSplitValue) ? lpGpSplitValue : '—'}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Equity Mult.</div>
				<div class="metric-value">{fmtMultiple(equityMultipleValue)}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Manager AUM</div>
				<div class="metric-value">{managerTier.range}</div>
			</div>
			<div class="metric">
				<div class="metric-label">Founded</div>
				<div class="metric-value">{foundedYear || '—'}</div>
			</div>
		</div>
	</div>

	{#if footerVisible}
		<div class="card-footer">
			{#if compareVisible || utilityVisible}
				<div class="card-secondary-row">
					{#if compareVisible}
						<button
							data-card-control="true"
							class="card-btn secondary-btn"
							class:btn-compare-selected={compareAction?.action === 'compare' && compareSelected}
							class:btn-compare-limit={compareAction?.action === 'compare' && compareAtLimit && !compareSelected}
							aria-pressed={compareAction?.action === 'compare' ? compareSelected : undefined}
							disabled={compareAction?.disabled || stageActionPending}
							onclick={(event) => dispatchControlAction(event, compareAction, compareAnalytics, compareLabel, 'compare')}
						>
							{#if compareAction?.action === 'compare'}
								{#if compareSelected}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="5" y1="12" x2="19" y2="12"></line>
									</svg>
								{:else}
									<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
										<line x1="12" y1="5" x2="12" y2="19"></line>
										<line x1="5" y1="12" x2="19" y2="12"></line>
									</svg>
								{/if}
							{/if}
							{compareLabel}
						</button>
					{/if}

					{#if utilityVisible}
						<button
							data-card-control="true"
							class="card-btn secondary-btn"
							class:btn-utility-disabled={utilityAction?.disabled}
							disabled={utilityAction?.disabled || stageActionPending}
							onclick={(event) => dispatchControlAction(event, utilityAction, utilityAnalytics, utilityLabel, 'utility')}
						>
							{#if utilityAction?.action === 'viewDeck'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
									<polyline points="14 2 14 8 20 8"></polyline>
								</svg>
							{:else if utilityAction?.action === 'requestIntroduction'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path>
									<circle cx="9" cy="7" r="4"></circle>
									<line x1="19" y1="8" x2="19" y2="14"></line>
									<line x1="16" y1="11" x2="22" y2="11"></line>
								</svg>
							{:else}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<circle cx="12" cy="12" r="10"></circle>
									<line x1="15" y1="9" x2="9" y2="15"></line>
									<line x1="9" y1="9" x2="15" y2="15"></line>
								</svg>
							{/if}
							{utilityLabel}
						</button>
					{/if}
				</div>
			{/if}

			{#if footerActions.length > 0}
				<div class="card-actions-row">
					{#each footerActions as action}
						{@const isLoadingAction = stageActionPending && pendingFooterActionId === action.id}
						<button
							data-card-control="true"
							class="card-btn"
							class:btn-primary={action.tone === 'primary'}
							class:btn-negative={action.tone === 'negative'}
							class:btn-neutral={action.tone === 'neutral'}
							class:btn-status={action.tone === 'status'}
							class:btn-full={action.full}
							class:btn-loading={isLoadingAction}
							aria-busy={isLoadingAction}
							disabled={action.disabled || stageActionPending}
							onclick={(event) => handleFooterAction(event, action)}
						>
							{#if isLoadingAction}
								<span class="btn-spinner" aria-hidden="true"></span>
							{:else if action.icon === 'x'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<line x1="18" y1="6" x2="6" y2="18"></line>
									<line x1="6" y1="6" x2="18" y2="18"></line>
								</svg>
							{:else if action.icon === 'bookmark'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
								</svg>
							{:else if action.icon === 'check'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M9 11l3 3L22 4"></path>
									<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path>
								</svg>
							{:else if action.icon === 'back'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="15 18 9 12 15 6"></polyline>
								</svg>
							{:else if action.icon === 'money' || action.icon === 'tracking'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
									<polyline points="22 4 12 14.01 9 11.01"></polyline>
								</svg>
							{:else if action.icon === 'refresh'}
								<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
									<polyline points="1 4 1 10 7 10"></polyline>
									<path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
								</svg>
							{/if}
							{action.label}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.deal-card {
		background: var(--bg-card);
		border-radius: var(--radius);
		border: 1px solid var(--border);
		box-shadow: var(--shadow-card);
		overflow: hidden;
		cursor: pointer;
		transition: all 0.25s ease;
		position: relative;
	}

	.deal-card:hover {
		box-shadow: var(--shadow-card-hover);
		transform: translateY(-2px);
		border-color: #D4C9AD;
	}

	.deal-card:focus-visible {
		outline: 2px solid rgba(81, 190, 123, 0.55);
		outline-offset: 3px;
	}

	.deal-card.is-compared {
		border-color: rgba(81, 190, 123, 0.35);
		box-shadow: 0 0 0 2px rgba(81, 190, 123, 0.12), var(--shadow-card);
	}

	.card-hero {
		position: relative;
		padding: 12px 16px 8px;
		height: 184px;
		box-sizing: border-box;
		overflow: hidden;
		display: grid;
		grid-template-rows: auto 1fr auto;
		gap: 10px;
	}

	.hero-badges {
		display: flex;
		gap: 6px;
		flex-wrap: nowrap;
		overflow: hidden;
		position: relative;
		z-index: 1;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		padding: 3px 10px;
		border-radius: 20px;
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 700;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		background: rgba(0, 0, 0, 0.36);
		color: rgba(255, 255, 255, 0.92);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		border: 1px solid rgba(255, 255, 255, 0.12);
		flex: 0 1 auto;
		max-width: 46%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.badge.audit {
		background: rgba(81, 190, 123, 0.25);
		color: #7DEFA5;
	}

	.no-deck-bubble {
		background: #fbbf24;
		color: #78350f;
		font-size: 10px;
		font-weight: 700;
		padding: 2px 8px;
		border-radius: 10px;
		letter-spacing: 0.3px;
		font-family: var(--font-ui);
		text-transform: none;
		flex: 0 0 auto;
		max-width: 36%;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.hero-visual {
		position: relative;
		min-height: 0;
	}

	.hero-icon {
		font-size: 46px;
		position: absolute;
		right: -4px;
		bottom: -12px;
		opacity: 0.14;
		filter: grayscale(1) brightness(1.6);
		pointer-events: none;
	}

	.hero-returns-surface {
		position: relative;
		z-index: 1;
		height: 100%;
		min-height: 0;
		pointer-events: none;
	}

	.hero-headline {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-self: flex-start;
		min-height: 42px;
	}

	.irr-value {
		display: block;
		font-family: var(--font-ui);
		font-size: 28px;
		font-weight: 800;
		color: #fff;
		letter-spacing: -0.5px;
		line-height: 1;
	}

	.irr-value.is-placeholder {
		color: rgba(255, 255, 255, 0.84);
	}

	.irr-label {
		font-family: var(--font-ui);
		font-size: 10px;
		font-weight: 600;
		color: rgba(255, 255, 255, 0.55);
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin-top: 2px;
	}

	.card-body {
		padding: 0;
		color: inherit;
	}

	.card-copy {
		padding: 12px 15px 10px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.card-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		line-height: 1.3;
		letter-spacing: -0.2px;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-manager,
	.card-description {
		font-family: var(--font-body);
		font-size: 12px;
		line-height: 1.4;
		display: -webkit-box;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.card-manager {
		color: var(--text-muted);
		font-weight: 500;
		-webkit-line-clamp: 1;
	}

	.card-description {
		color: var(--text-secondary);
		-webkit-line-clamp: 2;
	}

	.metrics {
		display: grid;
		grid-template-columns: repeat(4, minmax(0, 1fr));
		grid-auto-rows: minmax(52px, 52px);
		gap: 0;
		border-top: 1px solid var(--border);
	}

	.metric {
		display: flex;
		flex-direction: column;
		min-width: 0;
		padding: 7px 9px;
		border-right: 1px solid var(--border);
		border-bottom: 1px solid var(--border);
	}

	.metric:nth-child(4n) {
		border-right: none;
	}

	.metric:nth-last-child(-n + 4) {
		border-bottom: none;
	}

	.metric-label {
		font-family: var(--font-ui);
		font-size: 8px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		color: var(--text-muted);
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.metric-value {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		color: var(--text-dark);
		margin-top: 2px;
		line-height: 1.2;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.metric-value.highlight {
		color: var(--primary);
	}

	.card-footer {
		padding: 10px 14px 12px;
		border-top: 1px solid var(--border-light);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.card-secondary-row,
	.card-actions-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.card-btn {
		flex: 1 1 96px;
		min-width: 0;
		min-height: 42px;
		padding: 10px 12px;
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 700;
		letter-spacing: 0.15px;
		line-height: 1.15;
		border-radius: 10px;
		cursor: pointer;
		transition: all var(--transition);
		text-align: center;
		border: 1px solid var(--border);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 6px;
		background: #fff;
		color: var(--text-secondary);
		box-sizing: border-box;
	}

	.card-btn:hover:not(:disabled) {
		transform: translateY(-1px);
	}

	.card-btn svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
	}

	.secondary-btn {
		flex-basis: 100%;
		min-height: 38px;
		padding: 9px 12px;
		font-size: 10px;
	}

	.card-secondary-row .secondary-btn {
		flex: 1 1 140px;
	}

	.btn-primary {
		background: var(--primary);
		color: #fff;
		border-color: var(--primary);
		box-shadow: 0 8px 16px rgba(81, 190, 123, 0.18);
	}

	.btn-primary:hover:not(:disabled) {
		background: var(--primary-hover);
		border-color: var(--primary-hover);
		color: #fff;
		box-shadow: 0 10px 18px rgba(81, 190, 123, 0.24);
	}

	.btn-negative {
		color: #c74f4f;
		border-color: rgba(199, 79, 79, 0.26);
	}

	.btn-negative:hover:not(:disabled) {
		color: #b63d3d;
		border-color: rgba(199, 79, 79, 0.42);
		background: rgba(199, 79, 79, 0.06);
	}

	.btn-neutral {
		color: var(--text-secondary);
		border-color: rgba(15, 23, 42, 0.1);
	}

	.btn-neutral:hover:not(:disabled) {
		color: var(--text-dark);
		border-color: rgba(15, 23, 42, 0.16);
		background: rgba(15, 23, 42, 0.04);
	}

	.btn-status {
		background: rgba(81, 190, 123, 0.08);
		border-color: rgba(81, 190, 123, 0.2);
		color: var(--primary);
		cursor: default;
	}

	.btn-status:hover:not(:disabled) {
		transform: none;
		background: rgba(81, 190, 123, 0.08);
		border-color: rgba(81, 190, 123, 0.2);
		color: var(--primary);
	}

	.btn-full {
		flex: 1 1 100%;
	}

	.card-btn:disabled {
		opacity: 0.84;
		cursor: default;
	}

	.btn-loading {
		opacity: 1;
	}

	.btn-compare-selected {
		background: rgba(81, 190, 123, 0.12);
		border-color: rgba(81, 190, 123, 0.34);
		color: var(--primary);
	}

	.btn-compare-selected:hover:not(:disabled) {
		background: rgba(81, 190, 123, 0.18);
		border-color: rgba(81, 190, 123, 0.46);
		color: var(--primary);
	}

	.btn-compare-limit {
		border-color: rgba(245, 158, 11, 0.28);
		color: #b7791f;
		background: rgba(245, 158, 11, 0.08);
	}

	.btn-utility-disabled {
		border-style: dashed;
		border-color: rgba(148, 163, 184, 0.28);
		background: rgba(148, 163, 184, 0.08);
		color: var(--text-muted);
	}

	.btn-spinner {
		width: 14px;
		height: 14px;
		border-radius: 999px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		animation: card-btn-spin 0.8s linear infinite;
		flex-shrink: 0;
	}

	@keyframes card-btn-spin {
		to {
			transform: rotate(360deg);
		}
	}

	@media (max-width: 1200px) {
		.metric {
			padding: 7px 8px;
		}
	}

	@media (max-width: 560px) {
		.metric {
			padding: 6px 6px;
		}

		.metric-label {
			font-size: 8px;
		}

		.metric-value {
			font-size: 10px;
		}

		.card-actions-row,
		.card-secondary-row {
			gap: 7px;
		}

		.card-btn {
			flex-basis: 104px;
		}

		.card-secondary-row .secondary-btn {
			flex-basis: 100%;
		}
	}
</style>
