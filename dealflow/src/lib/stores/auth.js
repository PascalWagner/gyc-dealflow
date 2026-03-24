import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { createClient } from '@supabase/supabase-js';

// ===== Supabase Client =====
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nntzqyufmtypfjpusflm.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = browser && SUPABASE_ANON_KEY
	? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
	: null;

// ===== User Store =====
// Shape: { email, token, tier, fullName, id } or null
function createUserStore() {
	// Initialize from localStorage if in browser
	const initial = browser
		? (() => {
			try {
				const stored = JSON.parse(localStorage.getItem('gycUser') || 'null');
				return stored;
			} catch { return null; }
		})()
		: null;

	const { subscribe, set, update } = writable(initial);

	return {
		subscribe,
		set(value) {
			if (browser) {
				if (value) {
					localStorage.setItem('gycUser', JSON.stringify(value));
				} else {
					localStorage.removeItem('gycUser');
				}
			}
			set(value);
		},
		update,
		logout() {
			if (browser) {
				localStorage.removeItem('gycUser');
				localStorage.removeItem('gycDealStages');
				localStorage.removeItem('gycBuyBoxWizard');
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
	if (!$user) return 'explorer';
	return $user.tier || 'explorer';
});

export const isAcademy = derived(userTier, ($tier) =>
	['academy', 'founding', 'inner-circle'].includes($tier)
);

export const isAdmin = derived(userEmail, ($email) => {
	const ADMIN_EMAILS = [
		'pascal@growyourcashflow.io',
		'pascal@growyourcashflow.com',
		'pascal.wagner@growyourcashflow.com',
		'pascal@pascalwagner.com',
		'info@pascalwagner.com',
		'pascalwagner@gmail.com',
		'pascal.alexander.wagner@gmail.com'
	];
	return ADMIN_EMAILS.includes($email);
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
		user.set(data.user);
	}
	return data;
}
