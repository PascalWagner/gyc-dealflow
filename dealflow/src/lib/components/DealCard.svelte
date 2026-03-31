<script>
	import { goto } from '$app/navigation';
	import DealReturnsMiniChart from '$lib/components/DealReturnsMiniChart.svelte';
	import { networkCounts } from '$lib/stores/deals.js';
	import {
		getDealCardUtilityActionLabel,
		trackDealCardUtilityActionDisabledImpression,
		trackDealCardUtilityActionImpression
	} from '$lib/utils/dealCardUtilityAction.js';
	import { getDealHeroImage } from '$lib/utils/dealHero.js';
	import { getDealHistoricalReturns, isDebtOrLendingDeal } from '$lib/utils/dealReturns.js';
	import { tapLight } from '$lib/utils/haptics.js';

	let {
		deal,
		utilityAction = null,
		utilityAnalytics = null,
		footerActions = [],
		stageActionPending = false,
		pendingFooterActionId = '',
		compareSelected = false,
		compareAtLimit = false,
		onutilityaction = () => {},
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
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '—';
		return (n > 1 ? n : n * 100).toFixed(1) + '%';
	}

	function fmtMoney(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(String(val).replace(/[$,]/g, '')) : val;
		if (isNaN(n)) return '—';
		if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
		if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
		if (n >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
		return '$' + n.toLocaleString();
	}

	function fmtMultiple(val) {
		if (!val) return '—';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (isNaN(n)) return '—';
		return n.toFixed(2) + 'x';
	}

	function formatHold(val) {
		if (val === undefined || val === null || val === '') return '—';
		if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open';
		const n = typeof val === 'string' ? parseFloat(val) : val;
		if (!isNaN(n)) {
			if (n < 1) return `${Math.round(n * 12)} Mos`;
			return `${n} ${n === 1 ? 'Yr' : 'Yrs'}`;
		}
		return val;
	}

	function formatDist(value) {
		return hasValue(value) ? value : '—';
	}

	function getManagerTier(sizeValue) {
		const size =
			typeof sizeValue === 'string'
				? parseFloat(String(sizeValue).replace(/[$,]/g, ''))
				: Number(sizeValue);
		if (!size) return { range: '—' };
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
		return clean.slice(0, 137).replace(/[,;:\s]+$/, '') + '...';
	}

	function handleFooterAction(event, action) {
		event.stopPropagation();
		if (!action.next || action.disabled || stageActionPending) return;
		tapLight();
		onfooteraction({ deal, action });
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

	function handleUtilityAction(event) {
		event.stopPropagation();
		if (!utilityAction?.show || utilityAction?.disabled || stageActionPending) return;
		tapLight();
		onutilityaction({
			deal,
			utilityAction,
			utilityAnalytics: {
				...(utilityAnalytics || {}),
				labelShown: utilityLabel,
				isDisabled: Boolean(utilityAction?.disabled)
			}
		});
	}

	const assetHeroes = {
		'Private Credit': { gradient: 'linear-gradient(135deg, #1a365d 0%, #2563eb 100%)', icon: '🏦' },
		'Multifamily': { gradient: 'linear-gradient(135deg, #1a3a5c 0%, #2d6a9f 100%)', icon: '🏢' },
		'Multi-Family': { gradient: 'linear-gradient(135deg, #1a3a5c 0%, #2d6a9f 100%)', icon: '🏢' },
		'Industrial': { gradient: 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)', icon: '🏭' },
		'Self Storage': { gradient: 'linear-gradient(135deg, #5b4a1e 0%, #8b7535 100%)', icon: '📦' },
		'Hotels/Hospitality': { gradient: 'linear-gradient(135deg, #4a235a 0%, #7d3c98 100%)', icon: '🏨' },
		'Lending': { gradient: 'linear-gradient(135deg, #1a365d 0%, #2563eb 100%)', icon: '💵' }
	};

	const assetClass = $derived(firstDefined(deal.assetClass, deal.asset_class, 'Real Estate'));
	const dealType = $derived(firstDefined(deal.dealType, deal.deal_type, 'Fund'));
	const strategyBadge = $derived(firstDefined(deal.strategy, deal.investmentStrategyType));
	const targetIrr = $derived(firstDefined(deal.targetIRR, deal.targetIrr, deal.target_irr));
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
	const totalRaised = $derived(firstDefined(deal.totalAmountSold, deal.amountRaised, deal.amount_raised));
	const offeringSize = $derived(firstDefined(deal.offeringSize, deal.offering_size));
	const pctFundedValue = $derived(
		firstDefined(deal.pctFunded, deal.pct_funded, deal.fundingPercentage, deal.funding_percentage)
	);
	const titleText = $derived(
		firstDefined(deal.investmentName, deal.investment_name, deal.name, 'Untitled Deal')
	);
	const sponsorText = $derived(
		firstDefined(
			deal.managementCompany,
			deal.management_company,
			deal.operator,
			deal.operatorName,
			deal.operator_name,
			deal.companyName
		)
	);
	const locationText = $derived(
		firstDefined(deal.location, deal.cityState, deal.city_state, deal.city, deal.market)
	);
	const subtitleText = $derived.by(() => {
		const parts = [sponsorText, locationText].filter(hasValue);
		return parts.length ? parts.join(' • ') : '—';
	});
	const subtitleIsPlaceholder = $derived(subtitleText === '—');
	const heroBadges = $derived.by(() => {
		const list = [assetClass, dealType, strategyBadge];
		if (firstDefined(deal.financials, deal.auditStatus, deal.audit_status) === 'Audited') {
			list.push('Audited');
		}
		return list.filter(hasValue);
	});
	const hero = $derived(
		assetHeroes[assetClass] || {
			gradient: 'linear-gradient(135deg, #0A1E21 0%, #1F5159 100%)',
			icon: '🏠'
		}
	);
	const heroImg = $derived(
		firstDefined(
			deal.propertyImageUrl,
			deal.property_image_url,
			getDealHeroImage(deal),
			deal.imageUrl,
			deal.image_url
		)
	);
	const historicalReturns = $derived(getDealHistoricalReturns(deal));
	const usesReturnsHero = $derived(isDebtOrLendingDeal(deal));
	const showReturnsHeroChart = $derived(usesReturnsHero && historicalReturns.length >= 2);
	const heroStyle = $derived.by(() => {
		if (usesReturnsHero) {
			return 'background:linear-gradient(160deg, #071419 0%, #12313a 52%, #1d4f5a 100%);';
		}
		if (heroImg) {
			return `background:linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.5) 100%), url(${heroImg});background-size:cover;background-position:center;`;
		}
			return `background:${hero.gradient};`;
		});
	const managerTier = $derived(getManagerTier(managerAum));
	const strategySummary = $derived(getStrategySummary(deal));
	const summaryText = $derived(strategySummary || '—');
	const summaryIsPlaceholder = $derived(!strategySummary);
	const heroHeadlineValue = $derived(fmtPct(targetIrr));
	const fundingPct = $derived(pctFundedValue ? Math.min(Number(pctFundedValue), 100) : 0);
	const fundingPctLabel = $derived(
		pctFundedValue ? `${Math.round(Number(pctFundedValue))}% funded` : '—'
	);
	const hasFunding = $derived(hasValue(totalRaised) && hasValue(offeringSize) && hasValue(pctFundedValue));
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
		getDealCardUtilityActionLabel(utilityAction, {
			compareSelected,
			compareAtLimit
		})
	);
	const utilityVisible = $derived(Boolean(utilityAction?.show && utilityLabel));
	const socialCounts = $derived($networkCounts[deal.id] || null);
	const networkProof = $derived.by(() => {
		if (!socialCounts) return null;
		if ((socialCounts.invested || 0) >= 1) {
			return {
				text: `${socialCounts.invested} LP${socialCounts.invested === 1 ? '' : 's'} from the network ${socialCounts.invested === 1 ? 'has' : 'have'} invested`,
				emphasis: true
			};
		}
		return null;
	});
	const networkProofText = $derived(networkProof?.text || 'No network activity yet');
	const networkProofIsPlaceholder = $derived(!networkProof);

	$effect(() => {
		if (!utilityVisible || !utilityAnalytics) return;
		const payload = {
			...utilityAnalytics,
			labelShown: utilityLabel,
			isDisabled: Boolean(utilityAction?.disabled)
		};
		if (payload.isDisabled) trackDealCardUtilityActionDisabledImpression(payload);
		else trackDealCardUtilityActionImpression(payload);
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
		class:lending-hero={usesReturnsHero}
		class:lending-hero-empty={usesReturnsHero && !showReturnsHeroChart}
			style={heroStyle}
		>
			<div class="hero-badges" aria-label="Deal tags">
				{#each heroBadges as badgeText}
					<span class="badge" class:audit={badgeText === 'Audited'}>{badgeText}</span>
				{/each}
				{#if hasNoDeck}
					<span class="no-deck-bubble">No Deck</span>
				{/if}
			</div>

			<div class="hero-visual">
				{#if usesReturnsHero}
					<div class="hero-returns-surface" aria-hidden="true">
						{#if showReturnsHeroChart}
							<DealReturnsMiniChart series={historicalReturns} variant="hero" />
						{:else}
							<div class="hero-returns-empty">
								<span class="hero-returns-empty-label">5 Year Returns</span>
								<span class="hero-returns-empty-copy">Annual return history unavailable</span>
							</div>
						{/if}
					</div>
				{:else}
				{#if !heroImg}
					<div class="hero-icon">{hero.icon}</div>
				{/if}
				{/if}
			</div>

			<div class="hero-headline">
				<span class="irr-value" class:is-placeholder={heroHeadlineValue === '—'}>{heroHeadlineValue}</span>
				<span class="irr-label">Target IRR</span>
			</div>
		</div>

		<div class="card-body">
			<div class="card-copy">
				<div class="card-title">{titleText}</div>
				<div class="card-subtitle" class:is-placeholder={subtitleIsPlaceholder}>{subtitleText}</div>
				<div class="card-summary" class:is-placeholder={summaryIsPlaceholder}>{summaryText}</div>
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

			<div class="card-meta">
				<div class="funding-bar" class:no-data={!hasFunding}>
					<div class="funding-labels">
						<span>{hasFunding ? `${fmtMoney(totalRaised)} raised` : 'SEC filing data not available'}</span>
						<span>{fundingPctLabel}</span>
					</div>
					<div class="funding-track">
						<div class="funding-fill" style="width:{fundingPct}%"></div>
					</div>
				</div>
				<div
					class="network-proof"
					class:is-invested={networkProof?.emphasis}
					class:is-placeholder={networkProofIsPlaceholder}
				>
					<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
						<circle cx="9" cy="7" r="4"></circle>
						<path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
						<path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
					</svg>
					<span>{networkProofText}</span>
				</div>
			</div>
		</div>

		<div class="card-footer">
			<div class="card-utility-row">
				{#if utilityVisible}
					<button
						data-card-control="true"
						class="card-btn utility-btn"
					class:btn-compare-selected={utilityAction?.action === 'compare' && compareSelected}
					class:btn-compare-limit={utilityAction?.action === 'compare' && compareAtLimit && !compareSelected}
					class:btn-utility-disabled={utilityAction?.disabled}
					aria-pressed={utilityAction?.action === 'compare' ? compareSelected : undefined}
					disabled={utilityAction?.disabled || stageActionPending}
					onclick={handleUtilityAction}
				>
					{#if utilityAction?.action === 'compare'}
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
					{:else if utilityAction?.action === 'viewDeck'}
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
				{:else}
					<div class="card-utility-placeholder" aria-hidden="true"></div>
				{/if}
			</div>

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
	</div>
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
		display: flex;
		flex-direction: column;
		position: relative;
		height: 100%;
		min-height: 100%;
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

	.card-hero.lending-hero {
		gap: 10px;
	}

	.hero-badges {
		display: flex;
		gap: 6px;
		flex-wrap: nowrap;
		min-height: 24px;
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
		flex: 1;
		min-height: 0;
		pointer-events: none;
	}

	.hero-returns-empty {
		height: 100%;
		min-height: 108px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 6px;
		padding: 0 2px 4px;
		box-sizing: border-box;
	}

	.hero-returns-empty-label {
		font-family: var(--font-ui);
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(255, 255, 255, 0.44);
	}

	.hero-returns-empty-copy {
		font-family: var(--font-ui);
		font-size: 11px;
		font-weight: 600;
		line-height: 1.45;
		color: rgba(255, 255, 255, 0.56);
		max-width: 172px;
	}

	.hero-headline {
		position: relative;
		z-index: 1;
		display: flex;
		flex-direction: column;
		align-self: flex-start;
		justify-content: flex-end;
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
		text-decoration: none;
		color: inherit;
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.card-copy {
		padding: 12px 15px 10px;
		display: grid;
		grid-template-rows: calc(2 * 1.3em) calc(1 * 1.35em) calc(2 * 1.4em);
		row-gap: 4px;
	}

	.card-title {
		font-family: var(--font-ui);
		font-size: 14px;
		font-weight: 700;
		color: var(--text-dark);
		margin-bottom: 2px;
		line-height: 1.3;
		letter-spacing: -0.2px;
		padding: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		block-size: calc(2 * 1.3em);
	}

	.card-subtitle {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 500;
		padding: 0;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
		block-size: calc(1 * 1.35em);
	}

	.card-summary {
		font-family: var(--font-body);
		font-size: 12px;
		color: var(--text-secondary);
		line-height: 1.4;
		padding: 0;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		block-size: calc(2 * 1.4em);
	}

	.card-subtitle.is-placeholder,
	.card-summary.is-placeholder {
		color: var(--text-muted);
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

	.metric:nth-child(4n) { border-right: none; }
	.metric:nth-last-child(-n + 4) { border-bottom: none; }

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

	.card-meta {
		margin-top: auto;
	}

	.funding-bar {
		padding: 8px 12px 10px;
		min-height: 44px;
		box-sizing: border-box;
	}

	.funding-labels {
		display: flex;
		justify-content: space-between;
		font-family: var(--font-ui);
		font-size: 10px;
		color: var(--text-muted);
			margin-bottom: 4px;
			gap: 12px;
		}

	.funding-labels span {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.funding-labels span:first-child {
		color: var(--primary);
		font-weight: 600;
	}

	.funding-track {
		height: 5px;
		background: var(--border);
		border-radius: 3px;
		overflow: hidden;
	}

	.funding-fill {
		height: 100%;
		border-radius: 3px;
		background: var(--primary);
	}

	.funding-bar.no-data .funding-fill {
		width: 100%;
		background: var(--border);
	}

	.funding-fill.empty {
		width: 100%;
		background: var(--border);
	}

	.funding-bar.no-data .funding-labels span:first-child {
		color: var(--text-muted);
		font-weight: 500;
		font-style: italic;
	}

	.card-footer {
		padding: 10px 14px 12px;
		border-top: 1px solid var(--border-light);
		margin-top: auto;
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.card-utility-row {
		display: flex;
		min-height: 38px;
	}

	.card-utility-placeholder {
		flex: 1 1 100%;
		min-height: 38px;
		border-radius: 10px;
		border: 1px dashed rgba(148, 163, 184, 0.16);
		background: rgba(148, 163, 184, 0.04);
	}

	.card-actions-row {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
		min-height: 42px;
	}

	.network-proof {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px 8px;
		font-family: var(--font-body);
			font-size: 11px;
			color: var(--text-secondary);
			line-height: 1.4;
			min-height: 30px;
			box-sizing: border-box;
		}

	.network-proof svg {
		width: 14px;
		height: 14px;
		flex-shrink: 0;
		opacity: 0.72;
	}

	.network-proof.is-invested {
		color: var(--primary);
		font-weight: 600;
	}

	.network-proof.is-placeholder {
		color: var(--text-muted);
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

	.btn-full { flex: 1 1 100%; }

	.card-btn:disabled {
		opacity: 0.84;
		cursor: default;
	}

	.btn-loading {
		opacity: 1;
	}

	.utility-btn {
		flex: 1 1 100%;
		min-height: 38px;
		padding: 9px 12px;
		font-size: 10px;
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
		to { transform: rotate(360deg); }
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

		.card-actions-row {
			gap: 7px;
		}

		.card-btn {
			flex-basis: 104px;
		}

		.card-hero.lending-hero {
			padding-bottom: 10px;
		}

		.hero-returns-empty {
			min-height: 96px;
		}
	}
</style>
