import { normalizeAssetClassValue } from './dealReviewSchema.js';

export const MAX_HISTORICAL_RETURN_YEARS = 5;
export const MIN_RETURN_POINTS_FOR_CHART = 2;

const RETURN_SERIES_KEYS = ['historicalReturns', 'historical_returns', 'annualReturns', 'annual_returns'];

export function isDebtOrLendingDeal(deal) {
	const assetClass = normalizeAssetClassValue(deal?.assetClass || deal?.asset_class);
	const normalizedAssetClass = String(assetClass || '').toLowerCase();
	const strategy = String(deal?.strategy || '').toLowerCase();
	const instrument = String(deal?.instrument || '').toLowerCase();
	const name = String(deal?.investmentName || deal?.investment_name || '').toLowerCase();

	if (instrument === 'debt') return true;
	if (strategy === 'lending') return true;
	if (normalizedAssetClass === 'private debt / credit') return true;
	if (normalizedAssetClass.includes('credit') || normalizedAssetClass.includes('debt')) return true;

	if (name.includes('debt fund') || name.includes('credit fund') || name.includes('income fund')) {
		if (strategy === 'lending' || instrument === 'debt' || instrument === 'preferred equity' || deal?.debtPosition || deal?.debt_position) {
			return true;
		}
	}

	return false;
}

export function getDealHistoricalReturns(
	deal,
	{
		maxYears = MAX_HISTORICAL_RETURN_YEARS,
		referenceYear = getLatestCompletedReturnYear()
	} = {}
) {
	const normalizedReferenceYear = normalizeYear(referenceYear) || getLatestCompletedReturnYear();
	const explicitSeries = collectExplicitReturnSeries(deal, {
		maxYears,
		referenceYear: normalizedReferenceYear
	});

	return explicitSeries;
}

export function hasVisibleDealReturnsChart(deal, options = {}) {
	return getDealHistoricalReturns(deal, options).length >= MIN_RETURN_POINTS_FOR_CHART;
}

export function getLatestCompletedReturnYear(now = new Date()) {
	return now.getFullYear() - 1;
}

function collectExplicitReturnSeries(deal, { maxYears, referenceYear }) {
	const seriesFromArray = collectReturnSeriesFromArray(deal, { maxYears, referenceYear });
	if (seriesFromArray.length) return seriesFromArray;

	return collectReturnSeriesFromYearKeys(deal, { maxYears, referenceYear });
}

function collectReturnSeriesFromArray(deal, { maxYears, referenceYear }) {
	for (const key of RETURN_SERIES_KEYS) {
		if (!Array.isArray(deal?.[key]) || !deal[key].length) continue;

		const rawSeries = deal[key];
		const startYear = referenceYear - rawSeries.length + 1;
		const entries = rawSeries.map((entry, index) => {
			if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
				return {
					year: normalizeYear(entry.year || entry.label || entry.period || entry.date),
					value: normalizePercentValue(
						entry.value ?? entry.return ?? entry.annualReturn ?? entry.annual_return ?? entry.percent
					)
				};
			}

			return {
				year: startYear + index,
				value: normalizePercentValue(entry)
			};
		});

		return finalizeReturnSeries(entries, { maxYears, referenceYear });
	}

	return [];
}

function collectReturnSeriesFromYearKeys(deal, { maxYears, referenceYear }) {
	const entries = Object.entries(deal || []).map(([key, value]) => ({
		year: extractReturnYearFromKey(key),
		value: normalizePercentValue(value)
	}));

	return finalizeReturnSeries(entries, { maxYears, referenceYear });
}

function finalizeReturnSeries(entries, { maxYears, referenceYear }) {
	const dedupedByYear = new Map();

	for (const entry of entries || []) {
		const year = normalizeYear(entry?.year);
		const value = normalizePercentValue(entry?.value);
		if (!year || value === null) continue;
		if (year > referenceYear) continue;
		dedupedByYear.set(year, { year, value });
	}

	return [...dedupedByYear.values()]
		.sort((a, b) => a.year - b.year)
		.slice(-maxYears);
}

function normalizePercentValue(value) {
	const numeric = toFiniteNumber(value);
	if (!Number.isFinite(numeric)) return null;
	return Number(((Math.abs(numeric) <= 1 ? numeric * 100 : numeric)).toFixed(2));
}

function normalizeYear(value) {
	if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
	const match = String(value || '').match(/\b(20\d{2})\b/);
	return match ? Number(match[1]) : null;
}

function extractReturnYearFromKey(key) {
	const compactKey = String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
	const match = compactKey.match(/(?:historical|annual|net)?returns?(20\d{2})$/);
	return match ? Number(match[1]) : null;
}

function toFiniteNumber(value) {
	if (typeof value === 'number' && Number.isFinite(value)) return value;

	const parsed = Number.parseFloat(String(value ?? '').replace(/[%,$\s]/g, ''));
	return Number.isFinite(parsed) ? parsed : null;
}
