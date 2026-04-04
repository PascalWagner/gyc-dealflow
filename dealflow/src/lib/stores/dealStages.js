/**
 * Deal stage store — persists and syncs a user's per-deal pipeline stage
 * (filter → review → connect → decide → invested | skipped).
 *
 * Also exports stageCounts derived store (depends on dealCatalog + memberDeals browse total).
 */
import { browser } from '$app/environment';
import { derived, get, writable } from 'svelte/store';
import {
	getFreshSessionToken,
	getStoredSessionToken
} from '$lib/stores/auth.js';
import {
	applyAdminImpersonationToPayload,
	currentSessionEmail,
	isScopedImpersonationActive,
	readScopedJson,
	writeScopedJson
} from '$lib/utils/userScopedState.js';
import { getUiStage, normalizeStage } from '$lib/utils/dealflow-contract.js';

export { STAGE_META, normalizeStage, stageLabel } from '$lib/utils/dealflow-contract.js';

const DEAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeDealId(value) {
	const normalized = String(value || '').trim();
	return DEAL_ID_PATTERN.test(normalized) ? normalized : '';
}

function normalizeStageMap(value) {
	const normalized = {};
	for (const [dealId, stage] of Object.entries(value || {})) {
		const nextDealId = normalizeDealId(dealId);
		if (!nextDealId) continue;
		const nextStage = normalizeStage(stage);
		if (nextStage !== 'filter') normalized[nextDealId] = nextStage;
	}
	return normalized;
}

function mapStageRows(rows) {
	const stages = {};
	for (const row of rows || []) {
		const dealId = normalizeDealId(row?.deal_id);
		if (!dealId || !row?.stage) continue;
		const normalized = normalizeStage(row.stage);
		if (normalized !== 'filter') stages[dealId] = normalized;
	}
	return stages;
}

function persistStageCache(value) {
	writeScopedJson('gycDealStages', value, { email: currentSessionEmail() });
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

function setStageInMap(stageMap, dealId, stage) {
	const nextStages = { ...(stageMap || {}) };
	if (stage === 'filter') {
		delete nextStages[dealId];
	} else {
		nextStages[dealId] = stage;
	}
	return nextStages;
}

async function syncStageToBackend(dealId, stage, skippedFromStage = null) {
	if (!browser) return;
	const token = await getFreshSessionToken() || getStoredSessionToken();
	if (!token) return;

	if (stage === 'filter') {
		const response = await fetch('/api/userdata', {
			method: 'DELETE',
			headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
			body: JSON.stringify(applyAdminImpersonationToPayload({ type: 'stages', dealId }))
		});
		if (!response.ok) {
			const data = await response.json().catch(() => ({}));
			throw new Error(data?.error || 'Failed to clear deal stage');
		}
		return;
	}

	const stageData = { 'Deal ID': dealId, 'Stage': stage };
	if (skippedFromStage != null) stageData['Skipped From Stage'] = skippedFromStage;

	const response = await fetch('/api/userdata', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
		body: JSON.stringify(applyAdminImpersonationToPayload({ type: 'stages', data: stageData }))
	});
	if (!response.ok) {
		const data = await response.json().catch(() => ({}));
		throw new Error(data?.error || 'Failed to save deal stage');
	}
}

// browseTotalCount is set by memberDeals.js and imported here so stageCounts
// can include the live browse count without circular deps.
export const browseTotalCount = writable(null);

export function adjustBrowseCount(previousStage, nextStage) {
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
			if (!nextDealId) return { ok: false, reason: 'invalid', previousStage: 'filter', nextStage: 'filter' };
			if (inFlightByDealId.has(nextDealId)) return inFlightByDealId.get(nextDealId);

			const current = get(base);
			const previousStage = current[nextDealId] || 'filter';
			const nextStage = normalizeStage(stage);
			if (previousStage === nextStage) return { ok: true, previousStage, nextStage, unchanged: true };

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
		getStage(dealId) { return get(base)[dealId] || 'filter'; },
		set(value) { replace(value); },
		hydrateRows(rows) { replace(mapStageRows(rows)); },
		hydrateMap(value) { replace(value); }
	};
}

export const dealStages = createStagesStore();

export function hydrateDealStagesFromRows(rows) { dealStages.hydrateRows(rows); }
export function hydrateDealStagesFromMap(stageMap) { dealStages.hydrateMap(stageMap); }
export function hydrateDealStagesFromCache() { dealStages.hydrateMap(readCachedStageMap()); }

// Imported lazily by deals.js barrel to avoid circular deps at module init time.
// stageCounts needs `deals` (from dealCatalog) and `browseTotalCount` (local).
// We import deals lazily via the barrel in deals.js — see there for the derived store definition.
import { deals } from './dealCatalog.js';

export const stageCounts = derived(
	[deals, dealStages, browseTotalCount],
	([$deals, $stages, $browseTotal]) => {
		const counts = { filter: 0, review: 0, connect: 0, decide: 0, invested: 0, skipped: 0 };
		for (const stage of Object.values($stages || {})) {
			const normalized = getUiStage(stage);
			if (counts[normalized] !== undefined) counts[normalized] += 1;
		}
		counts.filter = $browseTotal ?? Math.max(0, ($deals || []).length - Object.keys($stages || {}).length);
		return counts;
	}
);
