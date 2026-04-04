/**
 * Member deals store — paginated, filtered, cached deal list for authenticated users.
 * Handles fetch, load-more, stale-while-revalidate, and fingerprint-based deduplication.
 */
import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import {
	ensureSessionUserToken,
	getStoredSessionUser,
	setStoredSessionUser
} from '$lib/stores/auth.js';
import {
	applyAdminImpersonationToUrl,
	applyAdminImpersonationToPayload,
	currentSessionEmail,
	isScopedImpersonationActive
} from '$lib/utils/userScopedState.js';
import {
	peekDealflowDealsCache,
	readDealflowDealsCache,
	writeDealflowDealsCache
} from '$lib/utils/dealflowCache.js';
import { MEMBER_DEALS_PAGE_SIZE } from './dealConstants.js';
import { browseTotalCount } from './dealStages.js';

const MEMBER_DEALS_CACHE_REVALIDATE_COOLDOWN_MS = 15000;
const MEMBER_DEALS_CACHE_KEY_PREFIX = 'member-deals-v2';
const DEAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeDealId(value) {
	const normalized = String(value || '').trim();
	return DEAL_ID_PATTERN.test(normalized) ? normalized : '';
}

function normalizeIdList(value) {
	return [...new Set((Array.isArray(value) ? value : []).map((id) => String(id || '').trim()).filter(Boolean))].sort();
}

function resolveMemberDealsInternalFlag(value) {
	if (value === true || value === 'true') return true;
	if (value === false || value === 'false') return false;
	if (!browser) return Boolean(value);
	const session = getStoredSessionUser();
	return Boolean(session?.roleFlags?.admin);
}

function sanitizeMemberDealsOptions(options = {}) {
	return {
		scope: options.scope || 'browse',
		internal: resolveMemberDealsInternalFlag(options.internal),
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

function buildMemberMeta(overrides = {}) {
	return {
		scope: 'browse', limit: MEMBER_DEALS_PAGE_SIZE, offset: 0,
		total: 0, hasMore: false, browseTotal: null, loaded: false,
		cacheKey: '', source: 'network', lastSuccessfulSyncAt: null,
		fingerprint: '', filters: {},
		...overrides
	};
}

function appendUniqueDeals(currentDeals, nextDeals) {
	const byId = new Map((currentDeals || []).map((deal) => [deal.id, deal]));
	for (const deal of nextDeals || []) byId.set(deal.id, deal);
	return [...byId.values()];
}

function computeMemberDealsFingerprint(dealsList = [], meta = {}) {
	const rows = (dealsList || []).map((deal) =>
		[deal?.id || '', deal?.updatedAt || deal?.createdAt || deal?.addedDate || '', deal?.pctFunded ?? '', deal?.status || ''].join(':')
	);
	return [String(meta.scope || 'browse'), String(meta.total || 0), String(meta.hasMore ? 1 : 0), String(meta.browseTotal ?? ''), rows.join('|')].join('::');
}

function buildMemberDealsPayload({ cacheKey, deals: nextDeals = [], meta = {}, pagination = {}, options = {}, source = 'network', lastSuccessfulSyncAt = Date.now(), loaded = true }) {
	const nextMeta = buildMemberMeta({
		scope: meta.scope || options.scope || 'browse',
		limit: pagination.limit || options.limit || MEMBER_DEALS_PAGE_SIZE,
		offset: pagination.offset || 0, total: pagination.total || 0,
		hasMore: Boolean(pagination.hasMore), browseTotal: meta.browseTotal ?? null,
		loaded, cacheKey, source, lastSuccessfulSyncAt, filters: options
	});
	nextMeta.fingerprint = computeMemberDealsFingerprint(nextDeals, nextMeta);
	return { cacheKey, deals: nextDeals, meta: nextMeta, savedAt: Date.now() };
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
	if (browseTotal !== null && browseTotal !== undefined) browseTotalCount.set(browseTotal);
}

function buildMemberDealsUrl(options = {}) {
	const baseOrigin = browser ? window.location.origin : 'http://localhost';
	const url = new URL('/api/member/deals', baseOrigin);
	const internal = resolveMemberDealsInternalFlag(options.internal);
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
	if (internal) url.searchParams.set('internal', 'true');
	if (browser) { applyAdminImpersonationToUrl(url); return `${url.pathname}${url.search}`; }
	return `/api/member/deals?${url.searchParams.toString()}`;
}

async function getMemberDealsAuthHeaders() {
	if (!browser) return {};
	const storedSession = getStoredSessionUser();
	if (!storedSession) return {};
	const { session, refreshed } = await ensureSessionUserToken(storedSession);
	if (refreshed && session) setStoredSessionUser(session);
	const token = session?.token || storedSession.token || '';
	return token ? { Authorization: `Bearer ${token}` } : {};
}

export const memberDeals = writable([]);
export const memberDealsLoading = writable(false);
export const memberDealsLoadingMore = writable(false);
export const memberDealsRefreshing = writable(false);
export const memberDealsError = writable(null);
export const memberDealsMeta = writable(buildMemberMeta());

let activeMemberRequestId = 0;

export function resetMemberDeals() {
	memberDeals.set([]);
	memberDealsLoading.set(false);
	memberDealsLoadingMore.set(false);
	memberDealsRefreshing.set(false);
	memberDealsError.set(null);
	memberDealsMeta.set(buildMemberMeta());
}

export async function queryMemberDeals(options = {}) {
	const res = await fetch(buildMemberDealsUrl({
		...options,
		scope: options.scope || 'browse',
		limit: options.limit || MEMBER_DEALS_PAGE_SIZE,
		offset: options.offset || 0,
		ids: options.ids || []
	}), { headers: await getMemberDealsAuthHeaders() });

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
	const internal = resolveMemberDealsInternalFlag(options.internal);
	const normalizedOptions = { ...options, scope, limit, offset, ids, internal };
	const cacheKey = buildMemberDealsCacheKey(normalizedOptions);
	const currentMeta = get(memberDealsMeta);
	const currentDeals = get(memberDeals);
	const hasCurrentExactResults = currentMeta.loaded && currentMeta.cacheKey === cacheKey;
	const hasVisibleResults = currentDeals.length > 0;
	let cachedPayload = null;

	memberDealsError.set(null);

	if (scope !== 'browse' && ids.length === 0) {
		applyMemberDealsPayload(buildMemberDealsPayload({
			cacheKey, deals: [], meta: { scope, browseTotal: get(browseTotalCount) },
			pagination: { limit, offset: 0, total: 0, hasMore: false },
			options: normalizedOptions, source: 'memory', lastSuccessfulSyncAt: Date.now()
		}));
		return [];
	}

	if (!options.append) {
		cachedPayload = peekDealflowDealsCache(cacheKey);
		if (!cachedPayload) cachedPayload = await readDealflowDealsCache(cacheKey);
	}

	if (!options.append && cachedPayload && requestId === activeMemberRequestId && !hasCurrentExactResults) {
		applyMemberDealsPayload(cachedPayload, { loading: false, refreshing: true });
	}

	const currentPayloadFreshEnough = hasCurrentExactResults && currentMeta.lastSuccessfulSyncAt && Date.now() - currentMeta.lastSuccessfulSyncAt < MEMBER_DEALS_CACHE_REVALIDATE_COOLDOWN_MS;
	const cachedPayloadFreshEnough = !options.append && cachedPayload?.meta?.lastSuccessfulSyncAt && Date.now() - cachedPayload.meta.lastSuccessfulSyncAt < MEMBER_DEALS_CACHE_REVALIDATE_COOLDOWN_MS;

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
		const data = await queryMemberDeals({ ...options, scope, limit, offset, ids });
		const nextDeals = data?.deals || [];
		const mergedDeals = options.append ? appendUniqueDeals(get(memberDeals), nextDeals) : nextDeals;
		const browseTotal = data?.meta?.browseTotal ?? get(browseTotalCount);
		const nextPayload = buildMemberDealsPayload({
			cacheKey, deals: mergedDeals,
			meta: { scope: data?.meta?.scope || scope, browseTotal },
			pagination: { limit: data?.pagination?.limit || limit, offset: options.append ? 0 : data?.pagination?.offset || offset, total: data?.pagination?.total || 0, hasMore: !!data?.pagination?.hasMore },
			options: normalizedOptions, source: 'network', lastSuccessfulSyncAt: Date.now()
		});

		writeDealflowDealsCache(cacheKey, nextPayload);
		if (requestId !== activeMemberRequestId) return nextDeals;

		const currentLiveMeta = get(memberDealsMeta);
		const currentLiveFingerprint = currentLiveMeta.fingerprint || '';
		if (currentLiveMeta.cacheKey === cacheKey && currentLiveFingerprint === nextPayload.meta.fingerprint) {
			memberDealsMeta.set({ ...currentLiveMeta, ...nextPayload.meta });
			memberDealsLoading.set(false);
			memberDealsLoadingMore.set(false);
			memberDealsRefreshing.set(false);
			return nextDeals;
		}

		applyMemberDealsPayload(nextPayload, { loading: false, loadingMore: false, refreshing: false });
		return nextDeals;
	} catch (error) {
		if (requestId === activeMemberRequestId) {
			const stillHasCachedContent = hasVisibleResults || Boolean(cachedPayload) || get(memberDeals).length > 0;
			if (stillHasCachedContent) {
				console.warn('Member deals refresh failed:', error.message);
			} else {
				memberDealsError.set(error.message);
				memberDealsMeta.set(buildMemberMeta({ scope, limit, offset, cacheKey, browseTotal: get(browseTotalCount), filters: normalizedOptions }));
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
		...meta.filters, ...options,
		scope: meta.scope, limit: meta.limit,
		offset: get(memberDeals).length, append: true
	});
}
