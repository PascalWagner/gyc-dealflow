import { getDealOperatorName } from '../../../src/lib/utils/dealSponsors.js';
import {
	equalsLoose,
	includesLoose,
	normalizeAssetClass,
	normalizePercentValue,
	normalizeString,
	toNumber
} from './query.js';

function buildSearchHaystack(deal) {
	const operatorName = getDealOperatorName(deal, '');
	const sponsorNames = (deal.sponsors || [])
		.map((sponsor) => [sponsor?.name, sponsor?.ceo].filter(Boolean).join(' '))
		.join(' ');

	return [
		deal.investmentName,
		operatorName,
		deal.managementCompany,
		deal.assetClass,
		deal.ceo,
		deal.location,
		deal.investingGeography,
		deal.investmentStrategy,
		deal.strategy,
		deal.dealType,
		deal.offeringType,
		deal.address,
		sponsorNames
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
}

function scoreBestMatch(deal) {
	const docScore = deal.deckUrl ? 2 : (deal.ppmUrl || deal.subAgreementUrl) ? 1 : 0;
	const fundingScore = Number.isFinite(toNumber(deal.pctFunded))
		? Math.min(100, Math.max(0, toNumber(deal.pctFunded))) / 100
		: 0;
	const irrScore = normalizePercentValue(deal.targetIRR) || 0;
	return docScore * 1000 + fundingScore * 100 + irrScore * 10;
}

function compareNewest(a, b) {
	const aTime = Date.parse(a.addedDate || '') || 0;
	const bTime = Date.parse(b.addedDate || '') || 0;
	return bTime - aTime;
}

function sortDeals(deals, sortBy) {
	const list = [...(deals || [])];
	const normalizedSort = String(sortBy || 'newest').trim().toLowerCase();

	if (normalizedSort === 'irr') {
		list.sort((a, b) => (toNumber(b.targetIRR) || 0) - (toNumber(a.targetIRR) || 0));
		return list;
	}

	if (normalizedSort === 'min_invest') {
		list.sort((a, b) => (toNumber(a.investmentMinimum) || 0) - (toNumber(b.investmentMinimum) || 0));
		return list;
	}

	if (normalizedSort === 'az') {
		list.sort((a, b) =>
			String(a.investmentName || '').localeCompare(String(b.investmentName || ''))
		);
		return list;
	}

	if (normalizedSort === 'best_match') {
		list.sort((a, b) => scoreBestMatch(b) - scoreBestMatch(a) || compareNewest(a, b));
		return list;
	}

	list.sort(compareNewest);
	return list;
}

export function filterDeals(allDeals, normalizedQuery) {
	let deals = [...(allDeals || [])];

	if (normalizedQuery.scope === 'ids') {
		deals = deals.filter((deal) => normalizedQuery.ids.includes(deal.id));
	} else if (normalizedQuery.scope === 'browse' && normalizedQuery.excludedIds.size) {
		deals = deals.filter((deal) => !normalizedQuery.excludedIds.has(deal.id));
	}

	if (normalizedQuery.scope === 'browse' && !normalizedQuery.includeArchived && !normalizedQuery.search) {
		deals = deals.filter((deal) => !deal.isStale);
	}

	if (normalizedQuery.assetClass) {
		deals = deals.filter(
			(deal) => normalizeAssetClass(deal.assetClass) === normalizedQuery.assetClass
		);
	}

	if (normalizedQuery.assetClassIn.length) {
		deals = deals.filter((deal) =>
			normalizedQuery.assetClassIn.includes(normalizeAssetClass(deal.assetClass))
		);
	}

	if (normalizedQuery.dealType) {
		deals = deals.filter((deal) => equalsLoose(deal.dealType, normalizedQuery.dealType));
	}

	if (normalizedQuery.dealTypeIn.length && !normalizedQuery.matchAnyStrategyOrDealType) {
		deals = deals.filter((deal) =>
			normalizedQuery.dealTypeIn.some((value) => equalsLoose(deal.dealType, value))
		);
	}

	if (normalizedQuery.strategy) {
		deals = deals.filter((deal) => equalsLoose(deal.strategy, normalizedQuery.strategy));
	}

	if (normalizedQuery.strategyIn.length && !normalizedQuery.matchAnyStrategyOrDealType) {
		deals = deals.filter((deal) =>
			normalizedQuery.strategyIn.some((value) => equalsLoose(deal.strategy, value))
		);
	}

	if (
		(normalizedQuery.dealTypeIn.length || normalizedQuery.strategyIn.length) &&
		normalizedQuery.matchAnyStrategyOrDealType
	) {
		deals = deals.filter((deal) => {
			const dealTypeMatch = normalizedQuery.dealTypeIn.some((value) =>
				equalsLoose(deal.dealType, value)
			);
			const strategyMatch = normalizedQuery.strategyIn.some((value) =>
				equalsLoose(deal.strategy, value)
			);
			return dealTypeMatch || strategyMatch;
		});
	}

	if (normalizedQuery.status) {
		deals = deals.filter((deal) => equalsLoose(deal.status, normalizedQuery.status));
	}

	if (normalizedQuery.distributions) {
		deals = deals.filter((deal) =>
			equalsLoose(deal.distributions, normalizedQuery.distributions)
		);
	}

	if (Number.isFinite(normalizedQuery.maxMinimum)) {
		deals = deals.filter((deal) => {
			const minimum = toNumber(deal.investmentMinimum);
			return minimum === null ? true : minimum <= normalizedQuery.maxMinimum;
		});
	}

	if (Number.isFinite(normalizedQuery.maxHoldYears)) {
		deals = deals.filter((deal) => {
			const holdPeriod = toNumber(deal.holdPeriod);
			return holdPeriod === null ? true : holdPeriod <= normalizedQuery.maxHoldYears;
		});
	}

	if (Number.isFinite(normalizedQuery.minIrr)) {
		deals = deals.filter((deal) => {
			const irr = normalizePercentValue(deal.targetIRR);
			return irr !== null && irr >= normalizedQuery.minIrr;
		});
	}

	if (normalizedQuery.company) {
		deals = deals.filter((deal) =>
			includesLoose(getDealOperatorName(deal, ''), normalizedQuery.company)
			|| includesLoose(deal.managementCompany, normalizedQuery.company)
		);
	}

	if (normalizedQuery.managementCompanyId) {
		deals = deals.filter(
			(deal) => String(deal.managementCompanyId || '') === normalizedQuery.managementCompanyId
		);
	}

	if (normalizedQuery.search) {
		const needle = normalizeString(normalizedQuery.search);
		deals = deals.filter((deal) => buildSearchHaystack(deal).includes(needle));
	}

	return sortDeals(deals, normalizedQuery.sort);
}

export function paginateDeals(filteredDeals, normalizedQuery) {
	const total = filteredDeals.length;

	if (normalizedQuery.scope === 'catalog') {
		return {
			deals: filteredDeals,
			limit: total,
			offset: 0,
			total,
			hasMore: false
		};
	}

	const deals = filteredDeals.slice(
		normalizedQuery.offset,
		normalizedQuery.offset + normalizedQuery.limit
	);

	return {
		deals,
		limit: normalizedQuery.limit,
		offset: normalizedQuery.offset,
		total,
		hasMore: normalizedQuery.offset + deals.length < total
	};
}
