import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import {
	ensureSessionUserToken,
	getStoredSessionToken,
	getStoredSessionUser,
	setStoredSessionUser
} from '$lib/stores/auth.js';
import {
	applyAdminImpersonationToUrl,
	applyAdminImpersonationToPayload,
	currentSessionEmail,
	isScopedImpersonationActive,
	readScopedJson,
	readScopedSessionJson,
	readScopedSessionString,
	writeScopedJson,
	writeScopedSessionJson,
	writeScopedSessionString
} from '$lib/utils/userScopedState.js';
import {
	peekDealflowDealsCache,
	readDealflowDealsCache,
	writeDealflowDealsCache
} from '$lib/utils/dealflowCache.js';
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
const MEMBER_DEALS_CACHE_REVALIDATE_COOLDOWN_MS = 15000;
const MEMBER_DEALS_CACHE_KEY_PREFIX = 'member-deals-v2';
const DEAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeDealId(value) {
	const normalized = String(value || '').trim();
	return DEAL_ID_PATTERN.test(normalized) ? normalized : '';
}

function persistStageCache(value) {
	writeScopedJson('gycDealStages', value, { email: currentSessionEmail() });
}

const COMPARE_STORAGE_KEY = 'gycCompareDealIds';
const DEAL_FLOW_VIEW_MODE_STORAGE_KEY = 'gycDealFlowViewMode';
const VIEW_MODES = ['grid', 'compare', 'map'];

export const MAX_COMPARE_DEALS = 3;
export const MAX_DECISION_COMPARE = MAX_COMPARE_DEALS;
export const DEAL_FLOW_VIEW_MODES = VIEW_MODES;

function normalizeCompareDealIds(value) {
	const ids = [];
	const seen = new Set();

	for (const item of Array.isArray(value) ? value : []) {
		const nextId = normalizeDealId(typeof item === 'string' ? item : item?.id || '');
		if (!nextId || seen.has(nextId)) continue;
		seen.add(nextId);
		ids.push(nextId);
		if (ids.length >= MAX_COMPARE_DEALS) break;
	}

	return ids;
}

function normalizeDealFlowViewMode(value) {
	const normalized = String(value || '').trim().toLowerCase();
	if (normalized === 'location') return 'map';
	return VIEW_MODES.includes(normalized) ? normalized : 'grid';
}

function persistCompareDealIds(value) {
	writeScopedSessionJson(COMPARE_STORAGE_KEY, normalizeCompareDealIds(value), {
		email: currentSessionEmail()
	});
}

function persistDealFlowViewMode(value) {
	writeScopedSessionString(DEAL_FLOW_VIEW_MODE_STORAGE_KEY, normalizeDealFlowViewMode(value), {
		email: currentSessionEmail()
	});
}

function readCachedCompareDealIds() {
	return normalizeCompareDealIds(readScopedSessionJson(COMPARE_STORAGE_KEY, [], {
		email: currentSessionEmail()
	}) || []);
}

function readCachedDealFlowViewMode() {
	return normalizeDealFlowViewMode(readScopedSessionString(DEAL_FLOW_VIEW_MODE_STORAGE_KEY, 'grid', {
		email: currentSessionEmail()
	}));
}

function normalizeStageMap(value) {
	const normalized = {};
	for (const [dealId, stage] of Object.entries(value || {})) {
		const nextDealId = normalizeDealId(dealId);
		if (!nextDealId) continue;
		const nextStage = normalizeStage(stage);
		if (nextStage !== 'filter') {
			normalized[nextDealId] = nextStage;
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
		const dealId = normalizeDealId(row?.deal_id);
		if (!dealId || !row?.stage) continue;
		const normalized = normalizeStage(row.stage);
		if (normalized !== 'filter') {
			stages[dealId] = normalized;
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
		cacheKey: '',
		source: 'network',
		lastSuccessfulSyncAt: null,
		fingerprint: '',
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

function normalizeIdList(value) {
	return [...new Set((Array.isArray(value) ? value : []).map((id) => String(id || '').trim()).filter(Boolean))].sort();
}

function sanitizeMemberDealsOptions(options = {}) {
	return {
		scope: options.scope || 'browse',
		internal: Boolean(options.internal),
		limit: Number(options.limit || MEMBER_DEALS_PAGE_SIZE),
		ids: normalizeIdList(options.ids),
		excludeIds: normalizeIdList(options.excludeIds),
		search: String(options.search || '').trim(),
		assetClass: String(options.assetClass || '').trim(),
		assetClassIn: normalizeIdList(options.assetClassIn),
		dealType: String(options.dealType || '').trim(),
		dealTypeIn: normalizeIdList(options.dealTypeIn),
		strategy: String(options.strategy || '').trim(),
		strategyIn: normalizeIdList(options.strategyIn),
		status: String(options.status || '').trim(),
		distributions: String(options.distributions || '').trim(),
		maxInvest: String(options.maxInvest || '').trim(),
		maxLockup: String(options.maxLockup || '').trim(),
		minIRR: String(options.minIRR || '').trim(),
		sortBy: String(options.sortBy || '').trim(),
		showArchived: Boolean(options.showArchived),
		company: String(options.company || '').trim(),
		managementCompanyId: String(options.managementCompanyId || '').trim(),
		matchAnyStrategyOrDealType: Boolean(options.matchAnyStrategyOrDealType)
	};
}

function buildMemberDealsCacheKey(options = {}) {
	return `${MEMBER_DEALS_CACHE_KEY_PREFIX}:${JSON.stringify(sanitizeMemberDealsOptions(options))}`;
}

function computeMemberDealsFingerprint(dealsList = [], meta = {}) {
	const rows = (dealsList || []).map((deal) =>
		[
			deal?.id || '',
			deal?.updatedAt || deal?.createdAt || deal?.addedDate || '',
			deal?.pctFunded ?? '',
			deal?.status || ''
		].join(':')
	);

	return [
		String(meta.scope || 'browse'),
		String(meta.total || 0),
		String(meta.hasMore ? 1 : 0),
		String(meta.browseTotal ?? ''),
		rows.join('|')
	].join('::');
}

function buildMemberDealsPayload({
	cacheKey,
	deals: nextDeals = [],
	meta = {},
	pagination = {},
	options = {},
	source = 'network',
	lastSuccessfulSyncAt = Date.now(),
	loaded = true
}) {
	const nextMeta = buildMemberMeta({
		scope: meta.scope || options.scope || 'browse',
		limit: pagination.limit || options.limit || MEMBER_DEALS_PAGE_SIZE,
		offset: pagination.offset || 0,
		total: pagination.total || 0,
		hasMore: Boolean(pagination.hasMore),
		browseTotal: meta.browseTotal ?? null,
		loaded,
		cacheKey,
		source,
		lastSuccessfulSyncAt,
		filters: options
	});

	nextMeta.fingerprint = computeMemberDealsFingerprint(nextDeals, nextMeta);

	return {
		cacheKey,
		deals: nextDeals,
		meta: nextMeta,
		savedAt: Date.now()
	};
}

function applyMemberDealsPayload(payload, { loading = false, loadingMore = false, refreshing = false } = {}) {
	if (!payload) return;
	memberDeals.set(payload.deals || []);
	memberDealsMeta.set(payload.meta || buildMemberMeta());
	memberDealsError.set(null);
	memberDealsLoading.set(Boolean(loading));
	memberDealsLoadingMore.set(Boolean(loadingMore));
	memberDealsRefreshing.set(Boolean(refreshing));

	const browseTotal = payload.meta?.browseTotal;
	if (browseTotal !== null && browseTotal !== undefined) {
		browseTotalCount.set(browseTotal);
	}
}

export { STAGE_META, normalizeStage, stageLabel };

export const deals = writable([]);
export const dealsLoading = writable(false);
export const dealsError = writable(null);

export const memberDeals = writable([]);
export const memberDealsLoading = writable(false);
export const memberDealsLoadingMore = writable(false);
export const memberDealsRefreshing = writable(false);
export const memberDealsError = writable(null);
export const memberDealsMeta = writable(buildMemberMeta());

const browseTotalCount = writable(null);

let catalogLoaded = false;
let catalogPromise = null;
let activeMemberRequestId = 0;

function adjustBrowseCount(previousStage, nextStage) {
	browseTotalCount.update((count) => {
		if (count === null || count === undefined) return count;
		if (previousStage === 'filter' && nextStage !== 'filter') return Math.max(0, count - 1);
		if (previousStage !== 'filter' && nextStage === 'filter') return count + 1;
		return count;
	});
}

function setStageInMap(stageMap, dealId, stage) {
	const nextStages = { ...(stageMap || {}) };
	if (stage === 'filter') {
		delete nextStages[dealId];
	} else {
		nextStages[dealId] = stage;
	}
	return nextStages;
}

function createStagesStore() {
	const base = writable(readCachedStageMap());
	const { subscribe, set: baseSet } = base;
	const inFlightByDealId = new Map();

	function replace(value, { persist = true } = {}) {
		const normalized = normalizeStageMap(value);
		if (persist) persistStageCache(normalized);
		baseSet(normalized);
		return normalized;
	}

	return {
		subscribe,
		async setStage(dealId, stage) {
			const nextDealId = normalizeDealId(dealId);
			if (!nextDealId) {
				return { ok: false, reason: 'invalid', previousStage: 'filter', nextStage: 'filter' };
			}

			if (inFlightByDealId.has(nextDealId)) {
				return inFlightByDealId.get(nextDealId);
			}

			const current = get(base);
			const previousStage = current[nextDealId] || 'filter';
			const nextStage = normalizeStage(stage);
			if (previousStage === nextStage) {
				return { ok: true, previousStage, nextStage, unchanged: true };
			}

			const nextStages = setStageInMap(current, nextDealId, nextStage);
			replace(nextStages);
			adjustBrowseCount(previousStage, nextStage);

			const request = (async () => {
				try {
					await syncStageToBackend(nextDealId, nextStage, nextStage === 'skipped' ? previousStage : null);
					return { ok: true, previousStage, nextStage, unchanged: false };
				} catch (error) {
					const latest = get(base);
					const revertedStages = setStageInMap(latest, nextDealId, previousStage);
					replace(revertedStages);
					adjustBrowseCount(nextStage, previousStage);
					console.warn('Stage sync failed:', error.message);
					return { ok: false, previousStage, nextStage, error };
				} finally {
					inFlightByDealId.delete(nextDealId);
				}
			})();

			inFlightByDealId.set(nextDealId, request);
			return request;
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

function createCompareDealsStore() {
	const base = writable(readCachedCompareDealIds());
	const { subscribe, set: baseSet } = base;

	function replace(value) {
		const normalized = normalizeCompareDealIds(value);
		persistCompareDealIds(normalized);
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
		syncFromSession() {
			return replace(readCachedCompareDealIds());
		},
		add(dealId) {
			const nextId = String(dealId || '').trim();
			const ids = currentIds();
			if (!nextId) return { ok: false, reason: 'invalid', ids };
			if (ids.includes(nextId)) return { ok: false, reason: 'exists', ids };
			if (ids.length >= MAX_COMPARE_DEALS) return { ok: false, reason: 'max', ids };
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
			if (ids.length >= MAX_COMPARE_DEALS) return { ok: false, reason: 'max', selected: false, ids };
			return { ok: true, selected: true, ids: replace([...ids, nextId]) };
		},
		prune(validIds) {
			const allowedIds = new Set(normalizeCompareDealIds(validIds));
			const ids = currentIds().filter((id) => allowedIds.has(id));
			return { ok: true, ids: replace(ids) };
		}
	};
}

function createDealFlowViewModeStore() {
	const base = writable(readCachedDealFlowViewMode());
	const { subscribe, set: baseSet } = base;

	function replace(value) {
		const normalized = normalizeDealFlowViewMode(value);
		persistDealFlowViewMode(normalized);
		baseSet(normalized);
		return normalized;
	}

	return {
		subscribe,
		set(value) {
			return replace(value);
		},
		reset() {
			return replace('grid');
		},
		syncFromSession() {
			return replace(readCachedDealFlowViewMode());
		}
	};
}

export const compareDealIds = createCompareDealsStore();
export const decisionCompareIds = compareDealIds;
export const dealFlowViewMode = createDealFlowViewModeStore();

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
	memberDealsLoading.set(false);
	memberDealsLoadingMore.set(false);
	memberDealsRefreshing.set(false);
	memberDealsError.set(null);
	memberDealsMeta.set(buildMemberMeta());
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
			const res = await fetch(buildMemberDealsUrl({ scope: 'catalog' }), {
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
	const baseOrigin = browser ? window.location.origin : 'http://localhost';
	const url = new URL('/api/member/deals', baseOrigin);
	url.searchParams.set('scope', options.scope || 'browse');
	url.searchParams.set('limit', String(options.limit || MEMBER_DEALS_PAGE_SIZE));
	url.searchParams.set('offset', String(options.offset || 0));

	if (options.ids?.length) url.searchParams.set('ids', options.ids.join(','));
	if (options.excludeIds?.length) url.searchParams.set('exclude_ids', options.excludeIds.join(','));
	if (options.search) url.searchParams.set('q', options.search);
	if (options.assetClass) url.searchParams.set('asset_class', options.assetClass);
	if (options.assetClassIn?.length) url.searchParams.set('asset_class_in', options.assetClassIn.join(','));
	if (options.dealType) url.searchParams.set('deal_type', options.dealType);
	if (options.dealTypeIn?.length) url.searchParams.set('deal_type_in', options.dealTypeIn.join(','));
	if (options.strategy) url.searchParams.set('strategy', options.strategy);
	if (options.strategyIn?.length) url.searchParams.set('strategy_in', options.strategyIn.join(','));
	if (options.status) url.searchParams.set('status', options.status);
	if (options.distributions) url.searchParams.set('distributions', options.distributions);
	if (options.maxInvest) url.searchParams.set('max_minimum', options.maxInvest);
	if (options.maxLockup) url.searchParams.set('max_hold_years', options.maxLockup);
	if (options.minIRR) url.searchParams.set('min_irr', options.minIRR);
	if (options.sortBy) url.searchParams.set('sort', options.sortBy);
	if (options.showArchived) url.searchParams.set('include_archived', 'true');
	if (options.company) url.searchParams.set('company', options.company);
	if (options.managementCompanyId) url.searchParams.set('management_company_id', options.managementCompanyId);
	if (options.matchAnyStrategyOrDealType) url.searchParams.set('match_any_strategy_or_deal_type', 'true');
	if (options.internal) url.searchParams.set('internal', 'true');

	if (browser) {
		applyAdminImpersonationToUrl(url);
		return `${url.pathname}${url.search}`;
	}

	return `/api/member/deals?${url.searchParams.toString()}`;
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
	const normalizedOptions = {
		...options,
		scope,
		limit,
		offset,
		ids
	};
	const cacheKey = buildMemberDealsCacheKey(normalizedOptions);
	const currentMeta = get(memberDealsMeta);
	const currentDeals = get(memberDeals);
	const hasCurrentExactResults = currentMeta.loaded && currentMeta.cacheKey === cacheKey;
	const hasVisibleResults = currentDeals.length > 0;
	let cachedPayload = null;

	memberDealsError.set(null);

	if (scope !== 'browse' && ids.length === 0) {
		applyMemberDealsPayload(buildMemberDealsPayload({
			cacheKey,
			deals: [],
			meta: {
				scope,
				browseTotal: get(browseTotalCount)
			},
			pagination: {
				limit,
				offset: 0,
				total: 0,
				hasMore: false
			},
			options: normalizedOptions,
			source: 'memory',
			lastSuccessfulSyncAt: Date.now()
		}));
		return [];
	}

	if (!options.append) {
		// Reuse the last query payload instantly before revalidating so Deal Flow never blanks on revisit.
		cachedPayload = peekDealflowDealsCache(cacheKey);
		if (!cachedPayload) {
			cachedPayload = await readDealflowDealsCache(cacheKey);
		}
	}

	if (!options.append && cachedPayload && requestId === activeMemberRequestId && !hasCurrentExactResults) {
		applyMemberDealsPayload(cachedPayload, {
			loading: false,
			refreshing: true
		});
	}

	const currentPayloadFreshEnough =
		hasCurrentExactResults &&
		currentMeta.lastSuccessfulSyncAt &&
		Date.now() - currentMeta.lastSuccessfulSyncAt < MEMBER_DEALS_CACHE_REVALIDATE_COOLDOWN_MS;
	const cachedPayloadFreshEnough =
		!options.append &&
		cachedPayload?.meta?.lastSuccessfulSyncAt &&
		Date.now() - cachedPayload.meta.lastSuccessfulSyncAt < MEMBER_DEALS_CACHE_REVALIDATE_COOLDOWN_MS;

	if (!options.force && !options.append && (currentPayloadFreshEnough || (cachedPayloadFreshEnough && !hasCurrentExactResults))) {
		memberDealsLoading.set(false);
		memberDealsLoadingMore.set(false);
		memberDealsRefreshing.set(false);
		return get(memberDeals);
	}

	if (options.append) {
		memberDealsLoadingMore.set(true);
		memberDealsRefreshing.set(false);
	} else if (!cachedPayload && !hasCurrentExactResults && !hasVisibleResults) {
		memberDealsLoading.set(true);
		memberDealsRefreshing.set(false);
	} else {
		memberDealsLoading.set(false);
		memberDealsRefreshing.set(true);
	}

	try {
		const data = await queryMemberDeals({
			...options,
			scope,
			limit,
			offset,
			ids
		});
		const nextDeals = data?.deals || [];
		const mergedDeals = options.append ? appendUniqueDeals(get(memberDeals), nextDeals) : nextDeals;
		const browseTotal = data?.meta?.browseTotal ?? get(browseTotalCount);
		const nextPayload = buildMemberDealsPayload({
			cacheKey,
			deals: mergedDeals,
			meta: {
				scope: data?.meta?.scope || scope,
				browseTotal
			},
			pagination: {
				limit: data?.pagination?.limit || limit,
				offset: options.append ? 0 : data?.pagination?.offset || offset,
				total: data?.pagination?.total || 0,
				hasMore: !!data?.pagination?.hasMore
			},
			options: normalizedOptions,
			source: 'network',
			lastSuccessfulSyncAt: Date.now()
		});

		writeDealflowDealsCache(cacheKey, nextPayload);

		if (requestId !== activeMemberRequestId) {
			return nextDeals;
		}

		const currentLiveMeta = get(memberDealsMeta);
		const currentLiveFingerprint = currentLiveMeta.fingerprint || '';
		if (currentLiveMeta.cacheKey === cacheKey && currentLiveFingerprint === nextPayload.meta.fingerprint) {
			memberDealsMeta.set({
				...currentLiveMeta,
				...nextPayload.meta
			});
			memberDealsLoading.set(false);
			memberDealsLoadingMore.set(false);
			memberDealsRefreshing.set(false);
			return nextDeals;
		}

		applyMemberDealsPayload(nextPayload, {
			loading: false,
			loadingMore: false,
			refreshing: false
		});

		return nextDeals;
	} catch (error) {
		if (requestId === activeMemberRequestId) {
			const stillHasCachedContent = hasVisibleResults || Boolean(cachedPayload) || get(memberDeals).length > 0;
			if (stillHasCachedContent) {
				console.warn('Member deals refresh failed:', error.message);
			} else {
				memberDealsError.set(error.message);
				memberDealsMeta.set(buildMemberMeta({
					scope,
					limit,
					offset,
					cacheKey,
					browseTotal: get(browseTotalCount),
					filters: normalizedOptions
				}));
			}
		}
		return [];
	} finally {
		if (requestId === activeMemberRequestId) {
			memberDealsLoading.set(false);
			memberDealsLoadingMore.set(false);
			memberDealsRefreshing.set(false);
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

async function syncStageToBackend(dealId, stage, skippedFromStage = null) {
	if (!browser) return;

	const token = getStoredSessionToken();
	if (!token) return;

	if (stage === 'filter') {
		const response = await fetch('/api/userdata', {
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

		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data?.error || 'Failed to clear deal stage');
		}

		return;
	}

	const stageData = {
		'Deal ID': dealId,
		'Stage': stage
	};
	if (skippedFromStage != null) {
		stageData['Skipped From Stage'] = skippedFromStage;
	}

	const response = await fetch('/api/userdata', {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`
		},
		body: JSON.stringify(applyAdminImpersonationToPayload({
			type: 'stages',
			data: stageData
		}))
	});

	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		throw new Error(data?.error || 'Failed to save deal stage');
	}
}
