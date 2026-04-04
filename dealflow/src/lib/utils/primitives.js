/**
 * Shared primitive utilities — single source of truth for common helpers
 * that were previously duplicated across auth.js, userScopedState.js,
 * dealCardHero.js, DealCard.svelte, and dealPageHelpers.js.
 */

/**
 * Returns true when value is meaningfully present (not null/undefined/"").
 * Treats empty arrays as absent.
 */
export function hasValue(value) {
	if (value === undefined || value === null) return false;
	if (typeof value === 'string') return value.trim() !== '';
	if (Array.isArray(value)) return value.length > 0;
	return true;
}

/**
 * Returns the first argument that passes hasValue(), or null.
 * Trims string values. Does NOT unwrap arrays (use dealCardHero's
 * private version if you need Array[0] behaviour).
 */
export function firstDefined(...values) {
	for (const value of values) {
		if (value === undefined || value === null) continue;
		if (typeof value === 'string' && !value.trim()) continue;
		return value;
	}
	return null;
}

/**
 * JSON.parse with a fallback value on any parse error.
 */
export function safeJsonParse(value, fallback = null) {
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

/**
 * Normalises an email address to lowercase trimmed string.
 */
export function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}
