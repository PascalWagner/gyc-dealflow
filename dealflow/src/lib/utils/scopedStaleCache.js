import { browser } from '$app/environment';
import { currentSessionEmail, readScopedJson, writeScopedJson } from '$lib/utils/userScopedState.js';

const memoryCache = new Map();

function buildMemoryKey(baseKey, email) {
	return `${String(email || '')}::${baseKey}`;
}

function cloneSerializable(value) {
	if (value === null || value === undefined) return value;
	try {
		return JSON.parse(JSON.stringify(value));
	} catch {
		return value;
	}
}

export function readScopedStaleCache(baseKey, { maxAgeMs = Infinity, email = currentSessionEmail() } = {}) {
	if (!browser) return null;
	const memoryKey = buildMemoryKey(baseKey, email);
	let record = memoryCache.get(memoryKey) || null;

	if (!record) {
		record = readScopedJson(baseKey, null, { email });
		if (record) {
			memoryCache.set(memoryKey, record);
		}
	}

	if (!record || typeof record !== 'object') return null;
	const fetchedAt = Number(record.fetchedAt || 0);
	const value = cloneSerializable(record.value);
	return {
		value,
		fetchedAt,
		ageMs: fetchedAt ? Date.now() - fetchedAt : Infinity,
		fresh: fetchedAt ? Date.now() - fetchedAt <= maxAgeMs : false
	};
}

export function writeScopedStaleCache(baseKey, value, { email = currentSessionEmail(), fetchedAt = Date.now() } = {}) {
	if (!browser) return null;
	const record = {
		value: cloneSerializable(value),
		fetchedAt
	};
	const memoryKey = buildMemoryKey(baseKey, email);
	memoryCache.set(memoryKey, record);
	writeScopedJson(baseKey, record, { email });
	return cloneSerializable(record);
}
