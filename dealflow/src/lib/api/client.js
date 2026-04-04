/**
 * Centralized API client for GYC Dealflow.
 *
 * Provides a consistent fetch pattern with:
 * - Auth header injection (reads fresh session token)
 * - JSON request/response handling
 * - Configurable timeout (default 6s, matching userScopedState.js DEFAULT_FETCH_TIMEOUT_MS)
 * - Normalised error shape: { ok, data, error, status }
 *
 * Usage:
 *   import { apiGet, apiPost, apiDelete } from '$lib/api/client.js';
 *
 *   const { ok, data, error } = await apiGet('/api/member/deals?scope=browse');
 *   const { ok, data, error } = await apiPost('/api/userdata', { type: 'goals', ... });
 *
 * NOTE: Existing callers are not required to migrate immediately. This module is
 * purely additive — adopt it gradually as files are touched.
 */

import { browser } from '$app/environment';
import { getFreshSessionToken, getStoredSessionToken } from '$lib/stores/auth.js';

const DEFAULT_TIMEOUT_MS = 6000;

/**
 * Returns a Bearer token, preferring a freshly-validated one.
 * Falls back to the stored token if the refresh fails or takes too long.
 */
async function resolveAuthToken() {
	if (!browser) return '';
	try {
		return (await getFreshSessionToken()) || getStoredSessionToken() || '';
	} catch {
		return getStoredSessionToken() || '';
	}
}

/**
 * Core fetch wrapper used by apiGet / apiPost / apiDelete.
 *
 * @param {string} url
 * @param {RequestInit & { timeoutMs?: number }} options
 * @returns {Promise<{ ok: boolean, data: any, error: string|null, status: number }>}
 */
export async function apiFetch(url, options = {}) {
	const { timeoutMs = DEFAULT_TIMEOUT_MS, headers: extraHeaders = {}, ...rest } = options;

	const token = await resolveAuthToken();
	const headers = {
		'Content-Type': 'application/json',
		...(token ? { Authorization: `Bearer ${token}` } : {}),
		...extraHeaders
	};

	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), timeoutMs);

	let response;
	try {
		response = await fetch(url, {
			...rest,
			headers,
			signal: controller.signal
		});
	} catch (err) {
		clearTimeout(timer);
		const isTimeout = err?.name === 'AbortError';
		return { ok: false, data: null, error: isTimeout ? 'Request timed out' : (err?.message || 'Network error'), status: 0 };
	}

	clearTimeout(timer);

	let data = null;
	try {
		data = await response.json();
	} catch {
		data = {};
	}

	if (!response.ok) {
		const error = data?.error || data?.message || response.statusText || 'Request failed';
		return { ok: false, data, error, status: response.status };
	}

	return { ok: true, data, error: null, status: response.status };
}

/**
 * Authenticated GET request.
 * @param {string} url
 * @param {{ timeoutMs?: number }} [options]
 */
export function apiGet(url, options = {}) {
	return apiFetch(url, { method: 'GET', ...options });
}

/**
 * Authenticated POST request with JSON body.
 * @param {string} url
 * @param {object} body
 * @param {{ timeoutMs?: number }} [options]
 */
export function apiPost(url, body, options = {}) {
	return apiFetch(url, {
		method: 'POST',
		body: JSON.stringify(body ?? {}),
		...options
	});
}

/**
 * Authenticated DELETE request with optional JSON body.
 * @param {string} url
 * @param {object} [body]
 * @param {{ timeoutMs?: number }} [options]
 */
export function apiDelete(url, body, options = {}) {
	return apiFetch(url, {
		method: 'DELETE',
		...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		...options
	});
}
