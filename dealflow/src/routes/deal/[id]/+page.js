import { browser } from '$app/environment';
import { getStoredSessionUser } from '$lib/stores/auth.js';
import { applyAdminImpersonationToUrl } from '$lib/utils/userScopedState.js';

export async function load({ params, fetch, url }) {
	const { id } = params;
	const dealUrl = new URL('/api/deals', url.origin);
	dealUrl.searchParams.set('id', id);
	const headers = {};

	if (browser) {
		const storedUser = getStoredSessionUser();
		if (storedUser?.token) {
			headers.Authorization = `Bearer ${storedUser.token}`;
		}
		applyAdminImpersonationToUrl(dealUrl, { sessionUser: storedUser });
	}

	try {
		const res = await fetch(
			`${dealUrl.pathname}${dealUrl.search}`,
			Object.keys(headers).length ? { headers } : undefined
		);
		if (!res.ok) {
			return { deal: null, error: res.status === 404 ? null : 'Failed to load deal' };
		}
		const data = await res.json();
		const deal = data.deal || null;
		return { deal };
	} catch (err) {
		return { deal: null, error: err.message };
	}
}
