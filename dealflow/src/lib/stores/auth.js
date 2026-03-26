import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { createClient } from '@supabase/supabase-js';
import {
	ACCESS_TIERS,
	SESSION_VERSION,
	buildAccessModel,
	hasCapability,
	hasRoleFlag,
	normalizeEmail,
	normalizeLegacyTier
} from '$lib/auth/access-model.js';
import {
	ADMIN_REAL_USER_KEY,
	clearSessionScopedData,
	clearUserScopedData,
	currentAdminRealUser
} from '$lib/utils/userScopedState.js';
import { normalizePrivacyProfile } from '$lib/utils/dealflow-contract.js';

// ===== Supabase Client =====
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nntzqyufmtypfjpusflm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = browser && SUPABASE_ANON_KEY
	? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
	: null;

function safeJsonParse(value, fallback = null) {
	try {
		return JSON.parse(value);
	} catch {
		return fallback;
	}
}

function decodeBase64Url(value) {
	if (!value) return null;
	const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
	try {
		return atob(padded);
	} catch {
		return null;
	}
}

function decodeJwtPayload(token) {
	if (!browser || typeof token !== 'string') return null;
	const [, payload] = token.split('.');
	if (!payload) return null;
	return safeJsonParse(decodeBase64Url(payload), null);
}

export function hasUsableSessionToken(token) {
	return typeof token === 'string' && token.split('.').length === 3;
}

function tokenNeedsRefresh(token) {
	if (!hasUsableSessionToken(token)) return true;
	const payload = decodeJwtPayload(token);
	if (!payload?.exp) return false;
	return payload.exp * 1000 <= Date.now() + 60_000;
}

export function canonicalizeUserTier(tier, { isAdmin = false } = {}) {
	return normalizeLegacyTier(tier, { isAdmin });
}

function hasCurrentSessionContract(value) {
	if (!value || typeof value !== 'object') return false;
	if (Number(value.sessionVersion) !== SESSION_VERSION) return false;
	if (!ACCESS_TIERS.includes(String(value.accessTier || '').trim().toLowerCase())) return false;
	if (!value.roleFlags || typeof value.roleFlags !== 'object' || Array.isArray(value.roleFlags)) return false;
	if (!value.capabilities || typeof value.capabilities !== 'object' || Array.isArray(value.capabilities)) return false;
	return true;
}

function coerceSessionContract(value) {
	if (!value || typeof value !== 'object') return null;
	if (hasCurrentSessionContract(value)) return value;

	const email = normalizeEmail(value.email);
	if (!email) return null;

	const accessModel = buildAccessModel({
		...value,
		email
	});

	return {
		...value,
		email,
		sessionVersion: SESSION_VERSION,
		accessTier: accessModel.accessTier,
		roleFlags: accessModel.roleFlags,
		capabilities: accessModel.capabilities
	};
}

export function normalizeSessionUser(value) {
	const sessionLike = coerceSessionContract(value);
	if (!sessionLike) return null;

	const email = normalizeEmail(sessionLike.email);
	if (!email) return null;
	const normalizedPrivacy = normalizePrivacyProfile(sessionLike);

	let token = typeof sessionLike.token === 'string' ? sessionLike.token : '';
	let refreshToken = typeof sessionLike.refreshToken === 'string' ? sessionLike.refreshToken : '';
	const tokenEmail = normalizeEmail(decodeJwtPayload(token)?.email);
	let realUser = currentAdminRealUser();
	let realUserEmail = normalizeEmail(realUser?.email);

	if (!realUserEmail && tokenEmail && tokenEmail !== email) {
		realUser = {
			sessionVersion: SESSION_VERSION,
			email: tokenEmail,
			name: tokenEmail.split('@')[0],
			fullName: tokenEmail.split('@')[0],
			accessTier: 'admin',
			roleFlags: {
				lp: true,
				gp: false,
				admin: true
			},
			capabilities: {
				memberContent: true,
				backgroundChecks: true,
				gpDashboard: true,
				gpCompanySettings: true,
				adminTools: true,
				impersonateUsers: true
			},
			isAdmin: true,
			token,
			refreshToken
		};
		realUserEmail = tokenEmail;
		if (browser) {
			localStorage.setItem(ADMIN_REAL_USER_KEY, JSON.stringify(realUser));
		}
	}

	const isImpersonating = !!realUserEmail && realUserEmail !== email;

	if (!refreshToken && isImpersonating && typeof realUser?.refreshToken === 'string') {
		refreshToken = realUser.refreshToken;
	}

	if (!hasUsableSessionToken(token) && isImpersonating && typeof realUser?.token === 'string') {
		token = realUser.token;
	}

	const accessModel = buildAccessModel({
		...sessionLike,
		email
	});
	const isAdmin = accessModel.roleFlags.admin === true;
	const managementCompany = accessModel.managementCompany;
	const name =
		(typeof sessionLike.name === 'string' && sessionLike.name.trim()) ||
		(typeof sessionLike.fullName === 'string' && sessionLike.fullName.trim()) ||
		email.split('@')[0];

	return {
		...sessionLike,
		...normalizedPrivacy,
		sessionVersion: SESSION_VERSION,
		email,
		name,
		fullName:
			(typeof sessionLike.fullName === 'string' && sessionLike.fullName.trim()) ||
			(typeof sessionLike.name === 'string' && sessionLike.name.trim()) ||
			name,
		token,
		refreshToken,
		accessTier: accessModel.accessTier,
		roleFlags: accessModel.roleFlags,
		capabilities: accessModel.capabilities,
		isAdmin,
		isGP: accessModel.roleFlags.gp === true,
		managementCompany,
		tags: Array.isArray(sessionLike.tags) ? sessionLike.tags : [],
		contactId: sessionLike.contactId || null,
		phone: sessionLike.phone || '',
		location: sessionLike.location || ''
	};
}

export async function ensureSessionUserToken(sessionUser) {
	const normalized = normalizeSessionUser(sessionUser);
	if (!normalized) return { ok: false, session: null, refreshed: false };
	const currentTokenIsValid = !tokenNeedsRefresh(normalized.token);
	if (!tokenNeedsRefresh(normalized.token)) {
		return { ok: true, session: normalized, refreshed: false };
	}
	if (!normalized.refreshToken) {
		return { ok: currentTokenIsValid, session: normalized, refreshed: false };
	}

	try {
		const res = await fetch('/api/auth', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ action: 'refresh', refreshToken: normalized.refreshToken })
		});
		const data = await res.json().catch(() => ({}));
		if (!res.ok || !data?.token) {
			return { ok: currentTokenIsValid, session: normalized, refreshed: false };
		}

		const refreshed = normalizeSessionUser({
			...normalized,
			token: data.token,
			refreshToken: data.refreshToken || normalized.refreshToken
		});
		return { ok: !!refreshed?.token, session: refreshed, refreshed: true };
	} catch {
		return { ok: currentTokenIsValid, session: normalized, refreshed: false };
	}
}

export function getStoredSessionUser() {
	if (!browser) return null;
	const raw = localStorage.getItem('gycUser');
	if (!raw) return null;
	const parsed = safeJsonParse(raw, null);
	const normalized = normalizeSessionUser(parsed);
	if (!normalized && parsed) {
		localStorage.removeItem('gycUser');
		localStorage.removeItem(ADMIN_REAL_USER_KEY);
		clearUserScopedData();
	}
	return normalized;
}

export function getStoredSessionToken() {
	return getStoredSessionUser()?.token || null;
}

// ===== User Store =====
// Shape: backend-issued session contract or null
function createUserStore() {
	// Initialize from localStorage if in browser
	const initial = browser ? getStoredSessionUser() : null;

	const { subscribe, set, update } = writable(initial);

	return {
		subscribe,
		set(value) {
			const normalized = normalizeSessionUser(value);
			if (browser) {
				if (normalized) {
					localStorage.setItem('gycUser', JSON.stringify(normalized));
				} else {
					localStorage.removeItem('gycUser');
				}
			}
			set(normalized);
		},
		update,
		logout() {
			if (browser) {
				localStorage.removeItem('gycUser');
				localStorage.removeItem(ADMIN_REAL_USER_KEY);
				clearUserScopedData();
				clearSessionScopedData();
				supabase?.auth.signOut();
			}
			set(null);
		}
	};
}

export const user = createUserStore();

export function setStoredSessionUser(value) {
	const normalized = normalizeSessionUser(value);
	user.set(normalized);
	return normalized;
}

export function patchStoredSessionUser(patch) {
	const current = getStoredSessionUser();
	const next =
		typeof patch === 'function'
			? patch(current)
			: {
				...(current || {}),
				...(patch || {})
			};
	return setStoredSessionUser(next);
}

// ===== Derived Stores =====
export const isLoggedIn = derived(user, ($user) => !!$user?.email);
export const isGuest = derived(user, ($user) => !$user?.email);
export const userEmail = derived(user, ($user) => $user?.email || '');
export const userToken = derived(user, ($user) => $user?.token || '');

export const accessProfile = derived(user, ($user) => buildAccessModel($user || {}));

export const accessTier = derived(accessProfile, ($profile) => $profile.accessTier);

export const roleFlags = derived(accessProfile, ($profile) => $profile.roleFlags);

export const sessionCapabilities = derived(accessProfile, ($profile) => $profile.capabilities);

export const isMember = derived(accessTier, ($tier) => ['member', 'admin'].includes($tier));

export const isAdmin = derived(roleFlags, ($roleFlags) => $roleFlags.admin === true);

export const isGP = derived(roleFlags, ($roleFlags) => $roleFlags.gp === true);

export function getSessionAccessProfile(sessionUser) {
	return buildAccessModel(sessionUser || {});
}

export function getSessionManagementCompany(sessionUser) {
	return buildAccessModel(sessionUser || {}).managementCompany;
}

export function sessionHasRole(sessionUser, role) {
	return hasRoleFlag(sessionUser || {}, role);
}

export function sessionHasCapability(sessionUser, capability) {
	return hasCapability(sessionUser || {}, capability);
}

// ===== Auth Actions =====
export async function login(email, options = {}) {
	const siteUrl = options.siteUrl || (browser ? window.location.origin : '');
	const returnTo = options.returnTo || (browser ? `${window.location.pathname}${window.location.search}` : '');
	const res = await fetch('/api/auth', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, action: 'magic-link', siteUrl, returnTo })
	});
	return res.json();
}

export async function verifyToken(token) {
	const res = await fetch('/api/auth', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ action: 'verify', token })
	});
	const data = await res.json();
	if (data.user) {
		user.set(normalizeSessionUser(data.user));
	}
	return data;
}
