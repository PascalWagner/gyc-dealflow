import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { getStoredSessionToken } from '$lib/stores/auth.js';

function safeJsonParse(value, fallback) {
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

// ===== Pipeline Stages =====
export const PIPELINE_STAGES = ['browse', 'saved', 'diligence', 'decision'];
export const OUTCOME_STAGES = ['invested', 'passed'];
export const ALL_STAGES = [...PIPELINE_STAGES, ...OUTCOME_STAGES];
export const MAX_DECISION_COMPARE = 3;

export const STAGE_META = {
	browse:    { label: 'Filter',   color: 'var(--primary)',  icon: '🔍' },
	saved:     { label: 'Review',   color: '#3b82f6',        icon: '📋' },
	diligence: { label: 'Connect',  color: '#f97316',        icon: '🤝' },
	decision:  { label: 'Decide',   color: '#a855f7',        icon: '⭐' },
	invested:  { label: 'Invested', color: '#059669',        icon: '💰' },
	passed:    { label: 'Skipped',  color: 'var(--text-muted)', icon: '👋' }
};

// Legacy stage names map to new names (for DB backward compat)
const LEGACY_MAP = {
	'new': 'browse',
	'interested': 'saved',
	'duediligence': 'saved',  // vetting merged into review/saved
	'vetting': 'saved',
	'portfolio': 'invested',
	'ready': 'decision'
};

export function normalizeStage(stage) {
	if (!stage) return 'browse';
	return LEGACY_MAP[stage] || stage;
}

export function stageLabel(stage) {
	return STAGE_META[normalizeStage(stage)]?.label || 'Filter';
}

const DECISION_COMPARE_STORAGE_KEY = 'gycDecisionCompareDeals';
const LEGACY_COMPARE_STORAGE_KEY = 'gycCompareDeals';

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

function readCachedDecisionCompareIds() {
	if (!browser) return [];

	const current = localStorage.getItem(DECISION_COMPARE_STORAGE_KEY);
	if (current !== null) {
		return normalizeDecisionCompareIds(safeJsonParse(current, []));
	}

	const migrated = normalizeDecisionCompareIds(safeJsonParse(localStorage.getItem(LEGACY_COMPARE_STORAGE_KEY) || '[]', []));
	if (migrated.length) {
		localStorage.setItem(DECISION_COMPARE_STORAGE_KEY, JSON.stringify(migrated));
	}
	return migrated;
}

function persistDecisionCompareIds(value) {
	if (!browser) return;
	localStorage.setItem(DECISION_COMPARE_STORAGE_KEY, JSON.stringify(normalizeDecisionCompareIds(value)));
}

// ===== Deals Store =====
export const deals = writable([]);
export const dealsLoading = writable(true);
export const dealsError = writable(null);
export const networkCounts = writable({});
let networkCountsLoaded = false;

// ===== Deal Stages Store =====
// Map of dealId → stage
function createStagesStore() {
	const initial = browser
		? (() => {
			try {
				const stored = JSON.parse(localStorage.getItem('gycDealStages') || '{}');
				// Normalize any legacy stage names
				const normalized = {};
				for (const [id, stage] of Object.entries(stored)) {
					normalized[id] = normalizeStage(stage);
				}
				return normalized;
			} catch { return {}; }
		})()
		: {};

	const { subscribe, set, update } = writable(initial);

	return {
		subscribe,
		setStage(dealId, stage) {
			update(stages => {
				const normalized = normalizeStage(stage);
				if (normalized === 'browse') {
					delete stages[dealId];
				} else {
					stages[dealId] = normalized;
				}
				if (browser) {
					localStorage.setItem('gycDealStages', JSON.stringify(stages));
				}
				return { ...stages };
			});
			// Sync to backend
			syncStageToBackend(dealId, stage);
		},
		getStage(dealId) {
			let current;
			subscribe(s => current = s)();
			return current[dealId] || 'browse';
		},
		set(value) {
			if (browser) {
				localStorage.setItem('gycDealStages', JSON.stringify(value));
			}
			set(value);
		}
	};
}

export const dealStages = createStagesStore();

function createDecisionCompareStore() {
	const initial = browser ? readCachedDecisionCompareIds() : [];
	const { subscribe, set } = writable(initial);

	function replace(value) {
		const normalized = normalizeDecisionCompareIds(value);
		persistDecisionCompareIds(normalized);
		set(normalized);
		return normalized;
	}

	let currentIds = initial;
	subscribe((value) => {
		currentIds = value;
	});

	return {
		subscribe,
		set(value) {
			return replace(value);
		},
		clear() {
			return replace([]);
		},
		add(dealId) {
			const nextId = String(dealId || '').trim();
			if (!nextId) return { ok: false, reason: 'invalid', ids: currentIds };
			if (currentIds.includes(nextId)) return { ok: false, reason: 'exists', ids: currentIds };
			if (currentIds.length >= MAX_DECISION_COMPARE) return { ok: false, reason: 'max', ids: currentIds };
			return { ok: true, ids: replace([...currentIds, nextId]) };
		},
		remove(dealId) {
			return { ok: true, ids: replace(currentIds.filter((id) => id !== dealId)) };
		},
		toggle(dealId) {
			const nextId = String(dealId || '').trim();
			if (currentIds.includes(nextId)) {
				return { ok: true, selected: false, ids: replace(currentIds.filter((id) => id !== nextId)) };
			}
			if (!nextId) return { ok: false, reason: 'invalid', selected: false, ids: currentIds };
			if (currentIds.length >= MAX_DECISION_COMPARE) return { ok: false, reason: 'max', selected: false, ids: currentIds };
			return { ok: true, selected: true, ids: replace([...currentIds, nextId]) };
		}
	};
}

export const decisionCompareIds = createDecisionCompareStore();

// ===== Stage Counts =====
export const stageCounts = derived([deals, dealStages], ([$deals, $stages]) => {
	const counts = { browse: 0, saved: 0, diligence: 0, decision: 0, invested: 0, passed: 0 };
	for (const deal of $deals) {
		const stage = $stages[deal.id] || 'browse';
		if (counts[stage] !== undefined) {
			counts[stage]++;
		}
	}
	return counts;
});

// ===== API =====
export async function fetchNetworkCounts(force = false) {
	if (!browser) return;
	if (networkCountsLoaded && !force) return;
	try {
		const res = await fetch('/api/network?action=counts');
		if (!res.ok) throw new Error('Failed to load network counts');
		const data = await res.json();
		networkCounts.set(data || {});
		networkCountsLoaded = true;
	} catch (err) {
		console.warn('Network counts failed:', err.message);
	}
}

export async function fetchDeals() {
	dealsLoading.set(true);
	dealsError.set(null);
	try {
		// Fire network counts in background — don't block deals loading on it
		fetchNetworkCounts().catch(() => {});
		const res = await fetch('/api/deals');
		if (!res.ok) throw new Error('Failed to load deals');
		const data = await res.json();
		deals.set(data.deals || data || []);
	} catch (err) {
		dealsError.set(err.message);
	} finally {
		dealsLoading.set(false);
	}
}

async function syncStageToBackend(dealId, stage) {
	if (!browser) return;
	try {
		const token = getStoredSessionToken();
		if (!token) return;
		await fetch('/api/userdata', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'Authorization': `Bearer ${token}`
			},
			body: JSON.stringify({
				type: 'stages',
				data: { 'Deal ID': dealId, 'Stage': stage }
			})
		});
	} catch (err) {
		console.warn('Stage sync failed:', err.message);
	}
}
