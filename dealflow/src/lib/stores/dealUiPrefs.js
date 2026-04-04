/**
 * Session-persisted UI preferences for the deal browser:
 * - compareDealIds  — which deals are in the comparison tray
 * - dealFlowViewMode — 'grid' | 'compare' | 'map'
 */
import { get, writable } from 'svelte/store';
import {
	currentSessionEmail,
	readScopedSessionJson,
	readScopedSessionString,
	writeScopedSessionJson,
	writeScopedSessionString
} from '$lib/utils/userScopedState.js';
import { MAX_COMPARE_DEALS, DEAL_FLOW_VIEW_MODES } from './dealConstants.js';

const COMPARE_STORAGE_KEY = 'gycCompareDealIds';
const DEAL_FLOW_VIEW_MODE_STORAGE_KEY = 'gycDealFlowViewMode';
const DEAL_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeDealId(value) {
	const normalized = String(value || '').trim();
	return DEAL_ID_PATTERN.test(normalized) ? normalized : '';
}

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
	return DEAL_FLOW_VIEW_MODES.includes(normalized) ? normalized : 'grid';
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
	return normalizeCompareDealIds(
		readScopedSessionJson(COMPARE_STORAGE_KEY, [], { email: currentSessionEmail() }) || []
	);
}

function readCachedDealFlowViewMode() {
	return normalizeDealFlowViewMode(
		readScopedSessionString(DEAL_FLOW_VIEW_MODE_STORAGE_KEY, 'grid', { email: currentSessionEmail() })
	);
}

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
		set(value) { return replace(value); },
		clear() { return replace([]); },
		syncFromSession() { return replace(readCachedCompareDealIds()); },
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
			if (ids.includes(nextId)) return { ok: true, selected: false, ids: replace(ids.filter((id) => id !== nextId)) };
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
		set(value) { return replace(value); },
		reset() { return replace('grid'); },
		syncFromSession() { return replace(readCachedDealFlowViewMode()); }
	};
}

export const compareDealIds = createCompareDealsStore();
export const decisionCompareIds = compareDealIds;
export const dealFlowViewMode = createDealFlowViewModeStore();
