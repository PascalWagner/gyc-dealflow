import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { createClient } from '@supabase/supabase-js';
import {
	ADMIN_REAL_USER_KEY,
	clearUserScopedData,
	currentAdminRealUser
} from '$lib/utils/userScopedState.js';

// ===== Supabase Client =====
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nntzqyufmtypfjpusflm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const ADMIN_EMAILS = [
	'pascal@growyourcashflow.io',
	'pascal@growyourcashflow.com',
	'pascal.wagner@growyourcashflow.com',
	'pascal@pascalwagner.com',
	'info@pascalwagner.com',
	'pascalwagner@gmail.com',
	'pascal.alexander.wagner@gmail.com'
];

export const supabase = browser && SUPABASE_ANON_KEY
	? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
	: null;

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

function isAdminEmail(email) {
	const normalizedEmail = normalizeEmail(email);
	return normalizedEmail ? ADMIN_EMAILS.includes(normalizedEmail) : false;
}

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

export function canonicalizeUserTier(tier, { email = '', isAdmin = false } = {}) {
	if (isAdmin || isAdminEmail(email)) return 'academy';
	const normalizedTier = String(tier || '').trim().toLowerCase();
	if (!normalizedTier || normalizedTier === 'explorer') return 'free';
	return normalizedTier;
}

export function normalizeSessionUser(value) {
	if (!value || typeof value !== 'object') return null;

	const email = normalizeEmail(value.email);
	if (!email) return null;

	const realUser = currentAdminRealUser();
	const realUserEmail = normalizeEmail(realUser?.email);
	const isImpersonating = !!realUserEmail && realUserEmail !== email;

	let token = typeof value.token === 'string' ? value.token : '';
	let refreshToken = typeof value.refreshToken === 'string' ? value.refreshToken : '';

	if (!refreshToken && isImpersonating && typeof realUser?.refreshToken === 'string') {
		refreshToken = realUser.refreshToken;
	}

	if (!hasUsableSessionToken(token) && isImpersonating && typeof realUser?.token === 'string') {
		token = realUser.token;
	}

	const isAdmin = value.isAdmin === true || isAdminEmail(email);
	const name =
		(typeof value.name === 'string' && value.name.trim()) ||
		(typeof value.fullName === 'string' && value.fullName.trim()) ||
		email.split('@')[0];

	return {
		...value,
		email,
		name,
		fullName:
			(typeof value.fullName === 'string' && value.fullName.trim()) ||
			(typeof value.name === 'string' && value.name.trim()) ||
			name,
		token,
		refreshToken,
		tier: canonicalizeUserTier(value.tier, { email, isAdmin }),
		isAdmin,
		tags: Array.isArray(value.tags) ? value.tags : [],
		contactId: value.contactId || null,
		phone: value.phone || '',
		location: value.location || '',
		share_saved: value.share_saved !== false,
		share_dd: value.share_dd !== false,
		share_invested: value.share_invested !== false,
		allow_follows: value.allow_follows !== false
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

// ===== User Store =====
// Shape: { email, token, tier, fullName, id } or null
function createUserStore() {
	// Initialize from localStorage if in browser
	const initial = browser
		? (() => {
			return normalizeSessionUser(safeJsonParse(localStorage.getItem('gycUser') || 'null', null));
		})()
		: null;

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
				supabase?.auth.signOut();
			}
			set(null);
		}
	};
}

export const user = createUserStore();

// ===== Derived Stores =====
export const isLoggedIn = derived(user, ($user) => !!$user?.email);
export const isGuest = derived(user, ($user) => !$user?.email);
export const userEmail = derived(user, ($user) => $user?.email || '');
export const userToken = derived(user, ($user) => $user?.token || '');

export const userTier = derived(user, ($user) => {
	if (!$user) return 'free';
	return canonicalizeUserTier($user.tier, { email: $user.email, isAdmin: $user.isAdmin });
});

export const isAcademy = derived(userTier, ($tier) =>
	['academy', 'founding', 'inner-circle'].includes($tier)
);

export const isAdmin = derived(userEmail, ($email) => {
	return isAdminEmail($email);
});

// ===== Auth Actions =====
export async function login(email) {
	const res = await fetch('/api/auth', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, action: 'magic-link' })
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
