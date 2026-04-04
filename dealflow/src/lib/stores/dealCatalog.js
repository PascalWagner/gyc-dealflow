/**
 * Catalog store — the full published deal list (scope=catalog).
 * Used by components that need to reference any deal by ID without pagination.
 */
import { browser } from '$app/environment';
import { get, writable } from 'svelte/store';
import {
	ensureSessionUserToken,
	getStoredSessionUser,
	setStoredSessionUser
} from '$lib/stores/auth.js';

export const deals = writable([]);
export const dealsLoading = writable(false);
export const dealsError = writable(null);

let catalogLoaded = false;
let catalogPromise = null;

async function getCatalogAuthHeaders() {
	if (!browser) return {};
	const storedSession = getStoredSessionUser();
	if (!storedSession) return {};
	const { session, refreshed } = await ensureSessionUserToken(storedSession);
	if (refreshed && session) setStoredSessionUser(session);
	const token = session?.token || storedSession.token || '';
	return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function fetchDeals({ force = false } = {}) {
	if (catalogLoaded && !force) return get(deals);
	if (catalogPromise && !force) return catalogPromise;

	catalogPromise = (async () => {
		dealsLoading.set(true);
		dealsError.set(null);
		try {
			const baseOrigin = browser ? window.location.origin : 'http://localhost';
			const res = await fetch(`${browser ? '' : baseOrigin}/api/member/deals?scope=catalog`, {
				headers: await getCatalogAuthHeaders()
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data?.error || 'Failed to load deals catalog');
			}
			const data = await res.json();
			const nextDeals = data?.deals || [];
			deals.set(nextDeals);
			catalogLoaded = true;
			return nextDeals;
		} catch (error) {
			dealsError.set(error.message);
			throw error;
		} finally {
			dealsLoading.set(false);
			catalogPromise = null;
		}
	})();

	return catalogPromise;
}
