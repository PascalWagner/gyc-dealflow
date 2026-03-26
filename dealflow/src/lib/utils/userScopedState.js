import { browser } from '$app/environment';
import { normalizeStage } from '$lib/utils/dealflow-contract.js';

export const ADMIN_REAL_USER_KEY = '_gycAdminRealUser';

const SCOPED_BUNDLE_PREFIX = '_scopedBundle_';
const SCOPED_STORAGE_PREFIX = '__gycScoped__';
const SESSION_SCOPED_STORAGE_PREFIX = '__gycSessionScoped__';
const USER_SCOPED_JSON_KEYS = new Set(['gycDealStages', 'gycDecisionCompareDeals']);
const LEGACY_SCOPED_JSON_ALIASES = new Map([
	['gycCompareDeals', 'gycDecisionCompareDeals']
]);
let activeHydrationId = 0;
const DEFAULT_FETCH_TIMEOUT_MS = 6000;

const STATIC_SCOPED_KEYS = [
	'gycPortfolio',
	'gycDealStages',
	'gycBuyBox',
	'gycBuyBoxWizard',
	'gycBuyBoxComplete',
	'gycGoals',
	'gycDistributions',
	'gycFirstActivity',
	'gycOnboardingComplete',
	'gycFundNudgeDismissed',
	'gycTaxDocs',
	'gycPortfolioPlan',
	'gycDeckViews',
	'gycQAUpvoted',
	'gycIntroRequests',
	'gycCompareDeals',
	'gycDecisionCompareDeals',
	'gycNotifPrefs'
];

const PREFIX_SCOPED_KEYS = [
	'gycDDChecklist_',
	'gycDeckViewed_',
	'gycIntroCount_',
	'gycIntroRequested_',
	'gycDailyDeals_'
];

function safeJsonParse(value, fallback) {
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function storage() {
	return browser ? window.localStorage : null;
}

function sessionStorageArea() {
	return browser ? window.sessionStorage : null;
}

function sessionUserFromStorage() {
	if (!browser) return null;
	return safeJsonParse(localStorage.getItem('gycUser'), null);
}

export function currentSessionEmail() {
	const currentUser = sessionUserFromStorage();
	return normalizeEmail(currentUser?.email);
}

export function isScopedImpersonationActive(email = currentSessionEmail()) {
	const normalizedEmail = normalizeEmail(email);
	const realEmail = normalizeEmail(currentAdminRealUser()?.email);
	return !!realEmail && !!normalizedEmail && realEmail !== normalizedEmail;
}

export function getScopedImpersonationContext(sessionUser = null) {
	const sessionEmail = normalizeEmail(sessionUser?.email || currentSessionEmail());
	const adminEmail = normalizeEmail(currentAdminRealUser()?.email);
	return {
		sessionEmail,
		adminEmail,
		isImpersonating: !!adminEmail && !!sessionEmail && adminEmail !== sessionEmail
	};
}

export function applyAdminImpersonationToUrl(url, { sessionUser = null } = {}) {
	const context = getScopedImpersonationContext(sessionUser);
	if (!context.isImpersonating || !context.sessionEmail) return url;
	url.searchParams.set('admin', 'true');
	url.searchParams.set('email', context.sessionEmail);
	return url;
}

export function applyAdminImpersonationToPayload(payload = {}, { sessionUser = null } = {}) {
	const context = getScopedImpersonationContext(sessionUser);
	if (!context.isImpersonating || !context.sessionEmail) return payload;
	return {
		...payload,
		admin: true,
		email: payload?.email || context.sessionEmail
	};
}

function scopedBundleKey(email) {
	return `${SCOPED_BUNDLE_PREFIX}${normalizeEmail(email)}`;
}

export function scopedStorageKey(baseKey, email = currentSessionEmail()) {
	const normalizedEmail = normalizeEmail(email);
	if (!normalizedEmail) return baseKey;
	return `${SCOPED_STORAGE_PREFIX}${encodeURIComponent(normalizedEmail)}__${baseKey}`;
}

export function scopedSessionStorageKey(baseKey, email = currentSessionEmail()) {
	const normalizedEmail = normalizeEmail(email);
	const suffix = normalizedEmail ? `${encodeURIComponent(normalizedEmail)}__${baseKey}` : baseKey;
	return `${SESSION_SCOPED_STORAGE_PREFIX}${suffix}`;
}

function isUserScopedKey(key) {
	return USER_SCOPED_JSON_KEYS.has(key);
}

function canonicalScopedKey(key) {
	return LEGACY_SCOPED_JSON_ALIASES.get(key) || key;
}

function shouldMigrateLegacyScopedData(email) {
	const normalizedEmail = normalizeEmail(email);
	return !!normalizedEmail && normalizedEmail === currentSessionEmail() && !isScopedImpersonationActive(normalizedEmail);
}

function scopedKeyList() {
	const storageArea = storage();
	if (!storageArea) return [];
	const keys = new Set(STATIC_SCOPED_KEYS);
	for (let i = 0; i < storageArea.length; i += 1) {
		const key = storageArea.key(i);
		if (!key) continue;
		if (PREFIX_SCOPED_KEYS.some((prefix) => key.startsWith(prefix))) {
			keys.add(key);
		}
	}
	return [...keys];
}

export function clearUserScopedData() {
	const storageArea = storage();
	if (!storageArea) return;
	for (const key of scopedKeyList()) {
		storageArea.removeItem(key);
	}
}

export function clearSessionScopedData() {
	const storageArea = sessionStorageArea();
	if (!storageArea) return;

	const keys = [];
	for (let i = 0; i < storageArea.length; i += 1) {
		const key = storageArea.key(i);
		if (key?.startsWith(SESSION_SCOPED_STORAGE_PREFIX)) {
			keys.push(key);
		}
	}

	for (const key of keys) {
		storageArea.removeItem(key);
	}
}

export function saveUserScopedData(email) {
	const storageArea = storage();
	const normalizedEmail = normalizeEmail(email);
	if (!storageArea || !normalizedEmail) return;
	const bundle = {};
	for (const key of scopedKeyList()) {
		const canonicalKey = canonicalScopedKey(key);
		if (isUserScopedKey(canonicalKey)) {
			const scopedValue = storageArea.getItem(scopedStorageKey(canonicalKey, normalizedEmail));
			if (scopedValue !== null) {
				bundle[canonicalKey] = scopedValue;
				continue;
			}

			const legacyKeys = canonicalKey === 'gycDecisionCompareDeals'
				? [canonicalKey, 'gycCompareDeals']
				: [canonicalKey];
			for (const legacyKey of legacyKeys) {
				const legacyValue = storageArea.getItem(legacyKey);
				if (legacyValue === null) continue;
				bundle[canonicalKey] = legacyValue;
				storageArea.setItem(scopedStorageKey(canonicalKey, normalizedEmail), legacyValue);
				break;
			}
			continue;
		}

		const value = storageArea.getItem(key);
		if (value !== null) {
			bundle[canonicalKey] = value;
		}
	}
	storageArea.setItem(scopedBundleKey(normalizedEmail), JSON.stringify(bundle));
}

export function loadUserScopedData(email) {
	const storageArea = storage();
	const normalizedEmail = normalizeEmail(email);
	if (!storageArea || !normalizedEmail) return false;
	clearUserScopedData();
	const saved = storageArea.getItem(scopedBundleKey(normalizedEmail));
	if (!saved) return false;
	const bundle = safeJsonParse(saved, {});
	for (const [key, value] of Object.entries(bundle)) {
		const canonicalKey = canonicalScopedKey(key);
		if (isUserScopedKey(canonicalKey)) {
			storageArea.setItem(scopedStorageKey(canonicalKey, normalizedEmail), value);
		} else {
			storageArea.setItem(canonicalKey, value);
		}
	}
	return true;
}

function persistJson(key, value, storageArea = storage()) {
	if (!storageArea) return;
	if (value === null || value === undefined) {
		storageArea.removeItem(key);
		return;
	}
	storageArea.setItem(key, JSON.stringify(value));
}

function persistString(key, value, storageArea = storage()) {
	if (!storageArea) return;
	if (value === null || value === undefined || value === '') {
		storageArea.removeItem(key);
		return;
	}
	storageArea.setItem(key, value);
}

export function readUserScopedJson(key, fallback = null) {
	const storageArea = storage();
	if (!storageArea) return fallback;
	const parsed = safeJsonParse(storageArea.getItem(key), fallback);
	return parsed === null ? fallback : parsed;
}

export function readUserScopedString(key, fallback = '') {
	const storageArea = storage();
	if (!storageArea) return fallback;
	const value = storageArea.getItem(key);
	return value === null ? fallback : value;
}

export function writeUserScopedJson(key, value) {
	persistJson(key, value);
}

export function writeUserScopedString(key, value) {
	persistString(key, value);
}

export function readScopedJson(key, fallback = null, { email = currentSessionEmail(), migrateLegacy = false, legacyKeys = [] } = {}) {
	const storageArea = storage();
	if (!storageArea) return fallback;

	const canonicalKey = canonicalScopedKey(key);
	const scopedValue = storageArea.getItem(scopedStorageKey(canonicalKey, email));
	if (scopedValue !== null) {
		const parsed = safeJsonParse(scopedValue, fallback);
		return parsed === null ? fallback : parsed;
	}

	if (migrateLegacy && shouldMigrateLegacyScopedData(email)) {
		const candidates = legacyKeys.length ? legacyKeys : [canonicalKey];
		for (const legacyKey of candidates) {
			const legacyValue = storageArea.getItem(legacyKey);
			if (legacyValue === null) continue;
			storageArea.setItem(scopedStorageKey(canonicalKey, email), legacyValue);
			const parsed = safeJsonParse(legacyValue, fallback);
			return parsed === null ? fallback : parsed;
		}
	}

	return fallback;
}

export function readScopedString(key, fallback = '', options = {}) {
	const storageArea = storage();
	if (!storageArea) return fallback;
	const canonicalKey = canonicalScopedKey(key);
	const value = storageArea.getItem(scopedStorageKey(canonicalKey, options?.email));
	return value === null ? fallback : value;
}

export function writeScopedJson(key, value, { email = currentSessionEmail() } = {}) {
	persistJson(scopedStorageKey(canonicalScopedKey(key), email), value);
}

export function writeScopedString(key, value, { email = currentSessionEmail() } = {}) {
	persistString(scopedStorageKey(canonicalScopedKey(key), email), value);
}

export function readScopedSessionJson(key, fallback = null, { email = currentSessionEmail() } = {}) {
	const storageArea = sessionStorageArea();
	if (!storageArea) return fallback;
	const parsed = safeJsonParse(storageArea.getItem(scopedSessionStorageKey(canonicalScopedKey(key), email)), fallback);
	return parsed === null ? fallback : parsed;
}

export function readScopedSessionString(key, fallback = '', { email = currentSessionEmail() } = {}) {
	const storageArea = sessionStorageArea();
	if (!storageArea) return fallback;
	const value = storageArea.getItem(scopedSessionStorageKey(canonicalScopedKey(key), email));
	return value === null ? fallback : value;
}

export function writeScopedSessionJson(key, value, { email = currentSessionEmail() } = {}) {
	persistJson(scopedSessionStorageKey(canonicalScopedKey(key), email), value, sessionStorageArea());
}

export function writeScopedSessionString(key, value, { email = currentSessionEmail() } = {}) {
	persistString(scopedSessionStorageKey(canonicalScopedKey(key), email), value, sessionStorageArea());
}

export function getUserScopedCacheSnapshot() {
	const sessionEmail = currentSessionEmail();
	return {
		portfolio: readUserScopedJson('gycPortfolio', []),
		stages: readScopedJson('gycDealStages', {}, { email: sessionEmail, migrateLegacy: true }),
		goals: readUserScopedJson('gycGoals', null),
		distributions: readUserScopedJson('gycDistributions', []),
		taxDocs: readUserScopedJson('gycTaxDocs', []),
		buyBoxWizard: readUserScopedJson('gycBuyBoxWizard', {}),
		portfolioPlan: readUserScopedJson('gycPortfolioPlan', null),
		notifPrefs: readUserScopedJson('gycNotifPrefs', null),
		decisionCompareIds: readScopedSessionJson('gycCompareDealIds', [], { email: sessionEmail })
	};
}

function mapPortfolio(rows) {
	return (rows || []).map((row) => ({
		id: row.id || `inv_${Math.random().toString(36).slice(2, 9)}`,
		dealId: row.deal_id || '',
		investmentName: row.investment_name || '',
		sponsor: row.sponsor || '',
		assetClass: row.asset_class || '',
		amountInvested: row.amount_invested || 0,
		dateInvested: row.date_invested || '',
		status: row.status || 'Active',
		targetIRR: row.target_irr || '',
		distributionsReceived: row.distributions_received || 0,
		holdPeriod: row.hold_period || '',
		investingEntity: row.investing_entity || '',
		entityInvestedInto: row.entity_invested_into || '',
		notes: row.notes || '',
		_recordId: row.id || undefined
	}));
}

function mapStages(rows) {
	const stages = {};
	for (const row of rows || []) {
		if (row.deal_id && row.stage) {
			stages[row.deal_id] = normalizeStage(row.stage);
		}
	}
	return stages;
}

function mapGoals(rows) {
	const goal = rows?.[0];
	if (!goal) return null;
	return {
		goalType: goal.goal_type || 'passive_income',
		currentIncome: goal.current_income || 0,
		targetIncome: goal.target_income || 0,
		capitalAvailable: goal.capital_available || '',
		timeline: goal.timeline || '5',
		taxReduction: goal.tax_reduction || 0
	};
}

function mapTaxDocs(rows) {
	return (rows || []).map((row) => ({
		id: row.id,
		taxYear: row.tax_year || '',
		investmentName: row.investment_name || '',
		investingEntity: row.investing_entity || '',
		entityInvestedInto: row.entity_invested_into || '',
		formType: row.form_type || '',
		uploadStatus: row.upload_status || 'Pending',
		dateReceived: row.date_received || '',
		fileUrl: row.file_url || '',
		portalUrl: row.portal_url || '',
		contactName: row.contact_name || '',
		contactEmail: row.contact_email || '',
		contactPhone: row.contact_phone || '',
		notes: row.notes || '',
		_recordId: row.id || undefined
	}));
}

function mapPlan(rows) {
	const plan = rows?.[0];
	if (!plan) return null;
	return {
		...plan,
		target_income: plan.target_income || plan.target_annual_income || null,
		target_annual_income: plan.target_annual_income || plan.target_income || null,
		slots: Array.isArray(plan.slots) ? plan.slots : Array.isArray(plan.buckets) ? plan.buckets : [],
		buckets: Array.isArray(plan.buckets) ? plan.buckets : Array.isArray(plan.slots) ? plan.slots : []
	};
}

async function fetchJson(url, headers = {}, { timeoutMs = DEFAULT_FETCH_TIMEOUT_MS } = {}) {
	const controller = typeof AbortController === 'function' ? new AbortController() : null;
	const timeoutId = controller && timeoutMs > 0
		? globalThis.setTimeout(() => controller.abort(), timeoutMs)
		: null;

	try {
		const response = await fetch(url, {
			headers,
			...(controller ? { signal: controller.signal } : {})
		});
		if (!response.ok) {
			throw new Error(`${response.status} ${response.statusText}`);
		}
		return response.json();
	} catch (error) {
		if (error?.name === 'AbortError') {
			throw new Error(`Request timed out for ${url}`);
		}
		throw error;
	} finally {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}
	}
}

async function fetchCurrentUserBundle(token) {
	const headers = { Authorization: `Bearer ${token}` };
	const types = ['portfolio', 'stages', 'goals', 'taxdocs', 'plan'];
	const entries = await Promise.all(types.map(async (type) => {
		const data = await fetchJson(`/api/userdata?type=${type}`, headers);
		return [type, data?.records || []];
	}));
	return Object.fromEntries(entries);
}

async function fetchAdminBundle(token, email) {
	return fetchJson(`/api/userdata?admin=true&email=${encodeURIComponent(email)}`, {
		Authorization: `Bearer ${token}`
	});
}

function applyUserBundle(bundle, buyBox, email) {
	const storageArea = storage();
	persistJson('gycPortfolio', mapPortfolio(bundle?.portfolio || []));
	writeScopedJson('gycDealStages', mapStages(bundle?.stages || []), { email });
	persistJson('gycGoals', mapGoals(bundle?.goals || []));
	persistJson('gycTaxDocs', mapTaxDocs(bundle?.taxdocs || []));
	persistJson('gycPortfolioPlan', mapPlan(bundle?.plan || []));

	if (buyBox && Object.keys(buyBox).length > 0) {
		persistJson('gycBuyBox', buyBox);
		persistJson('gycBuyBoxWizard', buyBox);
		if (buyBox._branch || buyBox.goal) {
			persistString('gycBuyBoxComplete', 'true');
		}
	} else if (storageArea) {
		storageArea.removeItem('gycBuyBox');
		storageArea.removeItem('gycBuyBoxWizard');
		storageArea.removeItem('gycBuyBoxComplete');
	}
}

export function currentAdminRealUser() {
	if (!browser) return null;
	return safeJsonParse(localStorage.getItem(ADMIN_REAL_USER_KEY), null);
}

export async function hydrateUserScopedData({ email, token, adminEmail } = {}) {
	const normalizedEmail = normalizeEmail(email);
	const normalizedAdminEmail = normalizeEmail(adminEmail);
	if (!browser || !normalizedEmail || !token) return { ok: false, reason: 'missing-auth' };

	const hydrationId = ++activeHydrationId;

	let bundle = null;
	let buyBox = {};

	try {
		bundle = normalizedAdminEmail && normalizedAdminEmail !== normalizedEmail
			? await fetchAdminBundle(token, normalizedEmail)
			: await fetchCurrentUserBundle(token);
	} catch (error) {
		return { ok: false, reason: 'userdata-failed', error };
	}

	try {
		const buyBoxUrl = new URL('/api/buybox', window.location.origin);
		buyBoxUrl.searchParams.set('email', normalizedEmail);
		if (normalizedAdminEmail && normalizedAdminEmail !== normalizedEmail) {
			buyBoxUrl.searchParams.set('admin', 'true');
		}
		const buyBoxResponse = await fetchJson(buyBoxUrl.pathname + buyBoxUrl.search, {
			Authorization: `Bearer ${token}`
		});
		buyBox = buyBoxResponse?.buyBox || {};
	} catch {
		buyBox = {};
	}

	if (hydrationId !== activeHydrationId) {
		return { ok: false, reason: 'stale-hydration' };
	}

	applyUserBundle(bundle, buyBox, normalizedEmail);
	saveUserScopedData(normalizedEmail);
	return { ok: true, bundle, buyBox };
}

export function inferAdminEmailForSession(sessionUser) {
	const realUser = currentAdminRealUser();
	if (realUser?.email && realUser.email.toLowerCase() !== sessionUser?.email?.toLowerCase()) {
		return realUser.email;
	}
	return null;
}

export function restoreScopedUserState(sessionUser) {
	if (!browser || !sessionUser?.email) return false;
	return loadUserScopedData(sessionUser.email);
}
