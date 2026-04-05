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

/**
 * Parses an LP share from any stored format and returns the fractional value
 * (0–1), or null if the input cannot be interpreted.
 *
 * Handles all formats seen in the wild:
 *   "0.8"   → 0.8   (decimal fraction stored by older enrichment)
 *   "80/20" → 0.8   (X/Y string — LP portion is X)
 *   "80"    → 0.8   (bare integer percentage)
 *   "80%"   → 0.8   (percentage with sign)
 *   0.8     → 0.8   (raw number)
 */
function parseLpShare(value) {
	if (value === null || value === undefined || value === '') return null;
	const str = String(value).trim();

	// X/Y format (e.g. "80/20") — LP is the first number
	const slashMatch = str.match(/^(\d+(?:\.\d+)?)\s*\/\s*\d+(?:\.\d+)?$/);
	if (slashMatch) {
		const lp = parseFloat(slashMatch[1]);
		return lp > 1 ? lp / 100 : lp;
	}

	// Bare number or percentage string (e.g. "0.8", "80", "80%")
	const num = parseFloat(str.replace('%', ''));
	if (!isNaN(num)) {
		return num > 1 ? num / 100 : num;
	}

	return null;
}

/**
 * Formats an LP/GP split for investor-facing display in fee schedules
 * and accordion headers.
 *
 *   "0.8"   → "80/20"
 *   "80/20" → "80/20"  (passthrough)
 *   "0.75"  → "75/25"
 *   null    → "—"
 *
 * @param {string|number|null} value
 * @returns {string}
 */
export function formatLpGpSplit(value) {
	const lpShare = parseLpShare(value);
	if (lpShare === null) {
		const str = value != null ? String(value).trim() : '';
		return str !== '' ? str : '—';
	}
	const lpPct = Math.round(lpShare * 100);
	const gpPct = 100 - lpPct;
	return `${lpPct}/${gpPct}`;
}

/**
 * Formats an LP share as a plain percentage string for compensation cards.
 * Returns null when the value cannot be parsed so the caller can skip rendering.
 *
 *   "0.8"   → "80%"
 *   "80/20" → "80%"
 *   "0.75"  → "75%"
 *   null    → null
 *
 * @param {string|number|null} value
 * @returns {string|null}
 */
export function formatLpSharePercent(value) {
	const lpShare = parseLpShare(value);
	if (lpShare === null) return null;
	return `${Math.round(lpShare * 100)}%`;
}

/**
 * Formats a hold period (in years) for display in portfolio metric cards.
 * Rounds to at most 1 decimal place and strips trailing zeros.
 *
 * Raw float inputs like 3.1153846153846154 are a known source of UI overflow
 * on mobile — this function is the single enforcement point for that constraint.
 *
 *   3.1153846... → "3.1 yrs"
 *   5.0          → "5 yrs"
 *   1.0          → "1 yr"
 *   0 / null     → "—"
 *
 * @param {number|string|null} value  Hold period in years
 * @returns {string}
 */
export function formatHoldPeriod(value) {
	const amount = Number(value || 0);
	if (!Number.isFinite(amount) || amount <= 0) return '—';
	// Round to 1 decimal; parseFloat strips trailing zero ("3.0" → 3, "3.1" → 3.1)
	const rounded = parseFloat(amount.toFixed(1));
	return `${rounded} yr${rounded === 1 ? '' : 's'}`;
}
