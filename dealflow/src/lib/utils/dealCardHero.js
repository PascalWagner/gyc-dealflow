import { getDealHistoricalReturns, isDebtOrLendingDeal } from '$lib/utils/dealReturns.js';

const DEFAULT_HERO_PRESET = {
	gradient: 'linear-gradient(135deg, #0A1E21 0%, #1F5159 100%)',
	icon: '🏠'
};

const HERO_PRESETS = [
	{
		match: ['private credit', 'credit'],
		preset: { gradient: 'linear-gradient(135deg, #1a365d 0%, #2563eb 100%)', icon: '🏦' }
	},
	{
		match: ['lending', 'debt'],
		preset: { gradient: 'linear-gradient(135deg, #1a365d 0%, #2563eb 100%)', icon: '💵' }
	},
	{
		match: ['multifamily', 'multi-family', 'multi family'],
		preset: { gradient: 'linear-gradient(135deg, #1a3a5c 0%, #2d6a9f 100%)', icon: '🏢' }
	},
	{
		match: ['industrial'],
		preset: { gradient: 'linear-gradient(135deg, #2d3748 0%, #4a5568 100%)', icon: '🏭' }
	},
	{
		match: ['self storage', 'storage'],
		preset: { gradient: 'linear-gradient(135deg, #5b4a1e 0%, #8b7535 100%)', icon: '📦' }
	},
	{
		match: ['hotel', 'hospitality'],
		preset: { gradient: 'linear-gradient(135deg, #4a235a 0%, #7d3c98 100%)', icon: '🏨' }
	}
];

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

function normalizeText(value) {
	return String(value || '').trim().toLowerCase();
}

function getHeroPreset(assetClassText, isLendingDeal) {
	const normalizedAssetClass = normalizeText(assetClassText);
	if (isLendingDeal) {
		return HERO_PRESETS.find(({ match }) => match.some((token) => normalizedAssetClass.includes(token)))?.preset
			|| HERO_PRESETS[0].preset;
	}

	return HERO_PRESETS.find(({ match }) => match.some((token) => normalizedAssetClass.includes(token)))?.preset
		|| DEFAULT_HERO_PRESET;
}

function getActualHeroImage(deal = {}) {
	return firstDefined(
		deal.propertyImageUrl,
		deal.property_image_url,
		deal.imageUrl,
		deal.image_url
	);
}

export function getLendingHeroLabel(deal = {}) {
	const assetClass = normalizeText(firstDefined(deal.assetClass, deal.asset_class));
	const strategy = normalizeText(firstDefined(deal.strategy, deal.investmentStrategyType));
	const structureType = normalizeText(firstDefined(deal.structureType, deal.structure_type));
	const name = normalizeText(firstDefined(deal.investmentName, deal.investment_name, deal.name));

	if (
		assetClass.includes('credit')
		|| strategy.includes('credit')
		|| structureType.includes('credit')
		|| name.includes('credit')
		|| name.includes('income fund')
	) {
		return 'CREDIT';
	}

	return 'LENDING';
}

function buildHeroBadges({ deal, isLendingDeal, assetClass, dealType, strategyBadge }) {
	const badges = [];
	const primaryBadge = isLendingDeal ? getLendingHeroLabel(deal) : assetClass || 'Real Estate';

	if (hasValue(primaryBadge)) badges.push(primaryBadge);
	if (hasValue(dealType)) badges.push(dealType);
	if (hasValue(strategyBadge)) badges.push(strategyBadge);
	if (firstDefined(deal.auditing, deal.financials, deal.auditStatus, deal.audit_status) === 'Audited') {
		badges.push('Audited');
	}

	return badges;
}

function getHeroHeadline(deal, { isLendingDeal }) {
	if (isLendingDeal) {
		return {
			value: fmtPct(
				firstDefined(
					deal.targetIRR,
					deal.targetIrr,
					deal.target_irr,
					deal.preferredReturn,
					deal.prefReturn,
					deal.pref_return,
					deal.cashOnCash,
					deal.cash_on_cash
				)
			),
			label: 'Target Income'
		};
	}

	return {
		value: fmtPct(firstDefined(deal.targetIRR, deal.targetIrr, deal.target_irr)),
		label: 'Target IRR'
	};
}

export function getDealCardHeroConfig(deal = {}) {
	const assetClass = firstDefined(deal.assetClass, deal.asset_class, 'Real Estate');
	const dealType = firstDefined(deal.dealType, deal.deal_type, 'Fund');
	const strategyBadge = firstDefined(deal.strategy, deal.investmentStrategyType);
	const isLendingDeal = isDebtOrLendingDeal(deal);
	const historicalReturns = getDealHistoricalReturns(deal);
	const actualImageUrl = getActualHeroImage(deal);
	const heroPreset = getHeroPreset(assetClass, isLendingDeal);
	const headline = getHeroHeadline(deal, { isLendingDeal });
	const badges = buildHeroBadges({ deal, isLendingDeal, assetClass, dealType, strategyBadge });

	if (isLendingDeal && historicalReturns.length >= 2) {
		return {
			variant: 'lending-returns',
			badges,
			icon: heroPreset.icon,
			backgroundStyle: 'background:linear-gradient(160deg, #071419 0%, #12313a 52%, #1d4f5a 100%);',
			headlineValue: headline.value,
			headlineLabel: headline.label,
			returnsSeries: historicalReturns,
			imageUrl: '',
			emptyMessage: '',
			showHeadline: false
		};
	}

	if (isLendingDeal) {
		return {
			variant: 'lending-empty',
			badges,
			icon: heroPreset.icon,
			backgroundStyle: 'background:linear-gradient(160deg, #071419 0%, #12313a 52%, #1d4f5a 100%);',
			headlineValue: headline.value,
			headlineLabel: headline.label,
			returnsSeries: [],
			imageUrl: '',
			emptyMessage: 'Annual return history unavailable',
			showHeadline: false
		};
	}

	if (actualImageUrl) {
		return {
			variant: 'standard-image',
			badges,
			icon: '',
			backgroundStyle: `background:linear-gradient(180deg, rgba(0, 0, 0, 0.15) 0%, rgba(0, 0, 0, 0.5) 100%), url(${actualImageUrl});background-size:cover;background-position:center;`,
			headlineValue: headline.value,
			headlineLabel: headline.label,
			returnsSeries: [],
			imageUrl: actualImageUrl,
			emptyMessage: '',
			showHeadline: true
		};
	}

	return {
		variant: 'fallback',
		badges,
		icon: heroPreset.icon,
		backgroundStyle: `background:${heroPreset.gradient};`,
		headlineValue: headline.value,
		headlineLabel: headline.label,
		returnsSeries: [],
		imageUrl: '',
		emptyMessage: '',
		showHeadline: true
	};
}
