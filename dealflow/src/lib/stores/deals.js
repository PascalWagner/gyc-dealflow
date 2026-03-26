import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import {
	ensureSessionUserToken,
	getStoredSessionToken,
	getStoredSessionUser,
	setStoredSessionUser
} from '$lib/stores/auth.js';
import {
	applyAdminImpersonationToPayload,
	currentSessionEmail,
	isScopedImpersonationActive,
	readScopedJson,
	writeScopedJson
} from '$lib/utils/userScopedState.js';
import {
	OUTCOME_UI_STAGES,
	PIPELINE_UI_STAGES,
	STAGE_META,
	getUiStage,
	normalizeStage,
	stageLabel
} from '$lib/utils/dealflow-contract.js';

export const PIPELINE_STAGES = PIPELINE_UI_STAGES;
export const OUTCOME_STAGES = OUTCOME_UI_STAGES;
export const ALL_STAGES = [...PIPELINE_STAGES, ...OUTCOME_STAGES];
export const MEMBER_DEALS_PAGE_SIZE = 24;

function persistStageCache(value) {
	writeScopedJson('gycDealStages', value, { email: currentSessionEmail() });
}

const DECISION_COMPARE_STORAGE_KEY = 'gycDecisionCompareDeals';
const LEGACY_COMPARE_STORAGE_KEY = 'gycCompareDeals';

export const MAX_DECISION_COMPARE = 3;

function normalizeDecisionCompareIds(value) {
	const ids = [];
	const seen = new Set();

	for (const item of Array.isArray(value) ? value : []) {
		const nextId = String(typeof item === 'string' ? item : item?.id || '').trim();
		if (!nextId || seen.has(nextId)) continue;
		seen.add(nextId);
		ids.push(nextId);
		if (ids.length >= MAX_DECISION_COMPARE) break;
	}

	return ids;
}

function persistDecisionCompareIds(value) {
	writeScopedJson(DECISION_COMPARE_STORAGE_KEY, normalizeDecisionCompareIds(value), {
		email: currentSessionEmail()
	});
}

function readCachedDecisionCompareIds() {
	const sessionEmail = currentSessionEmail();
	const shouldMigrateLegacy = !isScopedImpersonationActive(sessionEmail);
	const scopedValue = readScopedJson(DECISION_COMPARE_STORAGE_KEY, null, {
		email: sessionEmail,
		migrateLegacy: shouldMigrateLegacy,
		legacyKeys: [DECISION_COMPARE_STORAGE_KEY, LEGACY_COMPARE_STORAGE_KEY]
	});
	return normalizeDecisionCompareIds(scopedValue || []);
}

function normalizeStageMap(value) {
	const normalized = {};
	for (const [dealId, stage] of Object.entries(value || {})) {
		const nextStage = normalizeStage(stage);
		if (nextStage !== 'filter') {
			normalized[dealId] = nextStage;
		}
	}
	return normalized;
}

function readCachedStageMap() {
	const sessionEmail = currentSessionEmail();
	const shouldMigrateLegacy = !isScopedImpersonationActive(sessionEmail);
	const scopedValue = readScopedJson('gycDealStages', null, {
		email: sessionEmail,
		migrateLegacy: shouldMigrateLegacy,
		legacyKeys: ['gycDealStages']
	});
	return normalizeStageMap(scopedValue || {});
}

function mapStageRows(rows) {
	const stages = {};
	for (const row of rows || []) {
		if (!row?.deal_id || !row?.stage) continue;
		const normalized = normalizeStage(row.stage);
		if (normalized !== 'filter') {
			stages[row.deal_id] = normalized;
		}
	}
	return stages;
}

function buildMemberMeta(overrides = {}) {
	return {
		scope: 'browse',
		limit: MEMBER_DEALS_PAGE_SIZE,
		offset: 0,
		total: 0,
		hasMore: false,
		browseTotal: null,
		loaded: false,
		filters: {},
		...overrides
	};
}

function appendUniqueDeals(currentDeals, nextDeals) {
	const byId = new Map((currentDeals || []).map((deal) => [deal.id, deal]));
	for (const deal of nextDeals || []) {
		byId.set(deal.id, deal);
	}
	return [...byId.values()];
}

export { STAGE_META, normalizeStage, stageLabel };

export const deals = writable([]);
export const dealsLoading = writable(false);
export const dealsError = writable(null);

export const memberDeals = writable([]);
export const memberDealsLoading = writable(false);
export const memberDealsLoadingMore = writable(false);
export const memberDealsError = writable(null);
export const memberDealsMeta = writable(buildMemberMeta());

export const networkCounts = writable({});

const browseTotalCount = writable(null);

let catalogLoaded = false;
let catalogPromise = null;
let networkCountsLoaded = false;
let activeMemberRequestId = 0;

function adjustBrowseCount(previousStage, nextStage) {
	browseTotalCount.update((count) => {
		if (count === null || count === undefined) return count;
		if (previousStage === 'filter' && nextStage !== 'filter') return Math.max(0, count - 1);
		if (previousStage !== 'filter' && nextStage === 'filter') return count + 1;
		return count;
	});
}

function createStagesStore() {
	const base = writable(readCachedStageMap());
	const { subscribe, set: baseSet } = base;

	function replace(value, { persist = true } = {}) {
		const normalized = normalizeStageMap(value);
		if (persist) persistStageCache(normalized);
		baseSet(normalized);
		return normalized;
	}

	return {
		subscribe,
		setStage(dealId, stage) {
			const current = get(base);
			const previousStage = current[dealId] || 'filter';
			const nextStage = normalizeStage(stage);
			const nextStages = { ...current };

			if (nextStage === 'filter') {
				delete nextStages[dealId];
			} else {
				nextStages[dealId] = nextStage;
			}

			replace(nextStages);
			adjustBrowseCount(previousStage, nextStage);
			syncStageToBackend(dealId, nextStage);
		},
		getStage(dealId) {
			return get(base)[dealId] || 'filter';
		},
		set(value) {
			replace(value);
		},
		hydrateRows(rows) {
			replace(mapStageRows(rows));
		},
		hydrateMap(value) {
			replace(value);
		}
	};
}

export const dealStages = createStagesStore();

function createDecisionCompareStore() {
	const base = writable(readCachedDecisionCompareIds());
	const { subscribe, set: baseSet } = base;

	function replace(value) {
		const normalized = normalizeDecisionCompareIds(value);
		persistDecisionCompareIds(normalized);
		baseSet(normalized);
		return normalized;
	}

	function currentIds() {
		return get(base);
	}

	return {
		subscribe,
		set(value) {
			return replace(value);
		},
		clear() {
			return replace([]);
		},
		syncFromStorage() {
			return replace(readCachedDecisionCompareIds());
		},
		add(dealId) {
			const nextId = String(dealId || '').trim();
			const ids = currentIds();
			if (!nextId) return { ok: false, reason: 'invalid', ids };
			if (ids.includes(nextId)) return { ok: false, reason: 'exists', ids };
			if (ids.length >= MAX_DECISION_COMPARE) return { ok: false, reason: 'max', ids };
			return { ok: true, ids: replace([...ids, nextId]) };
		},
		remove(dealId) {
			const ids = replace(currentIds().filter((id) => id !== dealId));
			return { ok: true, ids };
		},
		toggle(dealId) {
			const nextId = String(dealId || '').trim();
			const ids = currentIds();
			if (ids.includes(nextId)) {
				return { ok: true, selected: false, ids: replace(ids.filter((id) => id !== nextId)) };
			}
			if (!nextId) return { ok: false, reason: 'invalid', selected: false, ids };
			if (ids.length >= MAX_DECISION_COMPARE) return { ok: false, reason: 'max', selected: false, ids };
			return { ok: true, selected: true, ids: replace([...ids, nextId]) };
		},
		prune(validIds) {
			const allowedIds = new Set(normalizeDecisionCompareIds(validIds));
			const ids = currentIds().filter((id) => allowedIds.has(id));
			return { ok: true, ids: replace(ids) };
		}
	};
}

export const decisionCompareIds = createDecisionCompareStore();

export const stageCounts = derived([deals, dealStages, browseTotalCount], ([$deals, $stages, $browseTotal]) => {
	const counts = { filter: 0, review: 0, connect: 0, decide: 0, invested: 0, skipped: 0 };

	for (const stage of Object.values($stages || {})) {
		const normalized = getUiStage(stage);
		if (counts[normalized] !== undefined) {
			counts[normalized] += 1;
		}
	}

	counts.filter = $browseTotal ?? Math.max(0, ($deals || []).length - Object.keys($stages || {}).length);
	return counts;
});

export function hydrateDealStagesFromRows(rows) {
	dealStages.hydrateRows(rows);
}

export function hydrateDealStagesFromMap(stageMap) {
	dealStages.hydrateMap(stageMap);
}

export function hydrateDealStagesFromCache() {
	dealStages.hydrateMap(readCachedStageMap());
}

export function resetMemberDeals() {
	memberDeals.set([]);
	memberDealsError.set(null);
	memberDealsMeta.set(buildMemberMeta());
}

export async function fetchNetworkCounts(force = false) {
	if (!browser) return;
	if (networkCountsLoaded && !force) return;

	try {
		const res = await fetch('/api/network?action=counts');
		if (!res.ok) throw new Error('Failed to load network counts');
		const data = await res.json();
		networkCounts.set(data || {});
		networkCountsLoaded = true;
	} catch (error) {
		console.warn('Network counts failed:', error.message);
	}
}

async function getMemberDealsAuthHeaders() {
	if (!browser) return {};

	const storedSession = getStoredSessionUser();
	if (!storedSession) return {};

	const { session, refreshed } = await ensureSessionUserToken(storedSession);
	if (refreshed && session) {
		setStoredSessionUser(session);
	}

	const token = session?.token || storedSession.token || '';
	return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchDeals({ force = false } = {}) {
	if (catalogLoaded && !force) return get(deals);
	if (catalogPromise && !force) return catalogPromise;

	catalogPromise = (async () => {
		dealsLoading.set(true);
		dealsError.set(null);

		try {
			const res = await fetch('/api/member/deals?scope=catalog', {
				headers: await getMemberDealsAuthHeaders()
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.error || 'Failed to load deals catalog');
			}
			const data = await res.json();
			const nextDeals = data?.deals || [];
			deals.set(nextDeals);
			catalogLoaded = true;
			return nextDeals;
		} catch (error) {
			dealsError.set(error.message);
			throw error;
		} finally {
			dealsLoading.set(false);
			catalogPromise = null;
		}
	})();

	return catalogPromise;
}

function buildMemberDealsUrl(options = {}) {
	const params = new URLSearchParams();
	params.set('scope', options.scope || 'browse');
	params.set('limit', String(options.limit || MEMBER_DEALS_PAGE_SIZE));
	params.set('offset', String(options.offset || 0));

	if (options.ids?.length) params.set('ids', options.ids.join(','));
	if (options.excludeIds?.length) params.set('exclude_ids', options.excludeIds.join(','));
	if (options.search) params.set('q', options.search);
	if (options.assetClass) params.set('asset_class', options.assetClass);
	if (options.assetClassIn?.length) params.set('asset_class_in', options.assetClassIn.join(','));
	if (options.dealType) params.set('deal_type', options.dealType);
	if (options.dealTypeIn?.length) params.set('deal_type_in', options.dealTypeIn.join(','));
	if (options.strategy) params.set('strategy', options.strategy);
	if (options.strategyIn?.length) params.set('strategy_in', options.strategyIn.join(','));
	if (options.status) params.set('status', options.status);
	if (options.distributions) params.set('distributions', options.distributions);
	if (options.maxInvest) params.set('max_minimum', options.maxInvest);
	if (options.maxLockup) params.set('max_hold_years', options.maxLockup);
	if (options.minIRR) params.set('min_irr', options.minIRR);
	if (options.sortBy) params.set('sort', options.sortBy);
	if (options.showArchived) params.set('include_archived', 'true');
	if (options.company) params.set('company', options.company);
	if (options.managementCompanyId) params.set('management_company_id', options.managementCompanyId);
	if (options.matchAnyStrategyOrDealType) params.set('match_any_strategy_or_deal_type', 'true');

	return `/api/member/deals?${params.toString()}`;
}

export async function queryMemberDeals(options = {}) {
	const res = await fetch(buildMemberDealsUrl({
		...options,
		scope: options.scope || 'browse',
		limit: options.limit || MEMBER_DEALS_PAGE_SIZE,
		offset: options.offset || 0,
		ids: options.ids || []
	}), {
		headers: await getMemberDealsAuthHeaders()
	});

	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(data?.error || 'Failed to load deals');
	}

	return res.json();
}

export async function fetchMemberDeals(options = {}) {
	const requestId = ++activeMemberRequestId;
	const scope = options.scope || 'browse';
	const limit = options.limit || MEMBER_DEALS_PAGE_SIZE;
	const offset = options.offset || 0;
	const ids = options.ids || [];

	memberDealsError.set(null);

	if (scope !== 'browse' && ids.length === 0) {
		memberDeals.set([]);
		memberDealsMeta.set(buildMemberMeta({
			scope,
			limit,
			offset: 0,
			total: 0,
			hasMore: false,
			browseTotal: get(browseTotalCount),
			loaded: true,
			filters: options
		}));
		return [];
	}

	if (options.append) {
		memberDealsLoadingMore.set(true);
	} else {
		memberDealsLoading.set(true);
		memberDeals.set([]);
	}

	try {
		fetchNetworkCounts().catch(() => {});

		const data = await queryMemberDeals({
			...options,
			scope,
			limit,
			offset,
			ids
		});
		const nextDeals = data?.deals || [];

		if (requestId !== activeMemberRequestId) {
			return nextDeals;
		}

		if (options.append) {
			memberDeals.update((current) => appendUniqueDeals(current, nextDeals));
		} else {
			memberDeals.set(nextDeals);
		}

		const browseTotal = data?.meta?.browseTotal;
		if (browseTotal !== null && browseTotal !== undefined) {
			browseTotalCount.set(browseTotal);
		}

		memberDealsMeta.set(buildMemberMeta({
			scope: data?.meta?.scope || scope,
			limit: data?.pagination?.limit || limit,
			offset: data?.pagination?.offset || offset,
			total: data?.pagination?.total || 0,
			hasMore: !!data?.pagination?.hasMore,
			browseTotal: browseTotal ?? get(browseTotalCount),
			loaded: true,
			filters: options
		}));

		return nextDeals;
	} catch (error) {
		if (requestId === activeMemberRequestId) {
			memberDealsError.set(error.message);
			memberDealsMeta.set(buildMemberMeta({
				scope,
				limit,
				offset,
				browseTotal: get(browseTotalCount),
				filters: options
			}));
		}
		return [];
	} finally {
		if (requestId === activeMemberRequestId) {
			memberDealsLoading.set(false);
			memberDealsLoadingMore.set(false);
		}
	}
}

export async function loadMoreMemberDeals(options = {}) {
	const meta = get(memberDealsMeta);
	if (!meta.hasMore || get(memberDealsLoadingMore) || get(memberDealsLoading)) return [];

	return fetchMemberDeals({
		...meta.filters,
		...options,
		scope: meta.scope,
		limit: meta.limit,
		offset: get(memberDeals).length,
		append: true
	});
}

async function syncStageToBackend(dealId, stage) {
	if (!browser) return;

	try {
		const token = getStoredSessionToken();
		if (!token) return;

		if (stage === 'filter') {
			await fetch('/api/userdata', {
				method: 'DELETE',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${token}`
				},
				body: JSON.stringify(applyAdminImpersonationToPayload({
					type: 'stages',
					dealId
				}))
			});
			return;
		}

		await fetch('/api/userdata', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${token}`
			},
				body: JSON.stringify(applyAdminImpersonationToPayload({
					type: 'stages',
					data: {
						'Deal ID': dealId,
						'Stage': stage
					}
				}))
			});
	} catch (error) {
		console.warn('Stage sync failed:', error.message);
	}
}
