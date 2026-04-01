import { ASSET_ALIASES } from './constants.js';

const DEAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeKey(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

export function normalizeString(value) {
	return String(value || '').trim().toLowerCase();
}

export function normalizeAssetClass(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';
	return ASSET_ALIASES.get(normalizeKey(raw)) || raw;
}

export function parseList(value) {
	return String(value || '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

export function normalizeDealId(value) {
	const normalized = String(value || '').trim();
	return DEAL_ID_PATTERN.test(normalized) ? normalized : '';
}

export function parseDealIdList(value) {
	return parseList(value)
		.map((item) => normalizeDealId(item))
		.filter(Boolean);
}

export function toNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

export function normalizePercentValue(value) {
	const numeric = toNumber(value);
	if (!Number.isFinite(numeric)) return null;
	return numeric > 1 ? numeric / 100 : numeric;
}

export function equalsLoose(a, b) {
	return normalizeKey(a) === normalizeKey(b);
}

export function includesLoose(haystack, needle) {
	return normalizeString(haystack).includes(normalizeString(needle));
}

export function normalizeMemberDealsQuery(query = {}) {
	return {
		scope: String(query.scope || 'browse').trim().toLowerCase(),
		internal: query.internal === 'true',
		ids: parseDealIdList(query.ids),
		excludedIds: new Set(parseDealIdList(query.exclude_ids)),
		search: String(query.q || '').trim(),
		includeArchived: query.include_archived === 'true',
		assetClass: normalizeAssetClass(query.asset_class),
		assetClassIn: parseList(query.asset_class_in).map(normalizeAssetClass).filter(Boolean),
		dealType: String(query.deal_type || '').trim(),
		dealTypeIn: parseList(query.deal_type_in),
		strategy: String(query.strategy || '').trim(),
		strategyIn: parseList(query.strategy_in),
		matchAnyStrategyOrDealType: query.match_any_strategy_or_deal_type === 'true',
		status: String(query.status || '').trim(),
		distributions: String(query.distributions || '').trim(),
		maxMinimum: toNumber(query.max_minimum),
		maxHoldYears: toNumber(query.max_hold_years),
		minIrr: normalizePercentValue(query.min_irr),
		company: String(query.company || '').trim(),
		managementCompanyId: String(query.management_company_id || '').trim(),
		sort: String(query.sort || 'newest').trim().toLowerCase(),
		limit: (() => {
			const requested = Number.parseInt(query.limit || '24', 10);
			return Number.isFinite(requested) ? Math.min(Math.max(requested, 1), 100) : 24;
		})(),
		offset: (() => {
			const requested = Number.parseInt(query.offset || '0', 10);
			return Number.isFinite(requested) ? Math.max(requested, 0) : 0;
		})()
	};
}
