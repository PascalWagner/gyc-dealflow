import { browser } from '$app/environment'
import { currentSessionEmail } from '$lib/utils/userScopedState.js'

const DEALFLOW_DB_NAME = 'gyc-dealflow'
const DEALFLOW_DB_VERSION = 1
const DEALS_CACHE_STORE = 'deals_cache'
const DEALFLOW_UI_STATE_STORE = 'dealflow_ui_state'
const CACHE_SCHEMA_VERSION = 1

const dealCacheMemory = new Map()
const uiStateMemory = new Map()

let dbPromise = null

function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase()
}

function cloneSerializable(value) {
	if (value === null || value === undefined) return value
	if (typeof structuredClone === 'function') return structuredClone(value)
	return JSON.parse(JSON.stringify(value))
}

function buildScopedKey(baseKey, email = currentSessionEmail()) {
	const normalizedEmail = normalizeEmail(email) || 'anonymous'
	return `${CACHE_SCHEMA_VERSION}:${normalizedEmail}:${String(baseKey || '').trim()}`
}

function isIndexedDbAvailable() {
	return browser && typeof indexedDB !== 'undefined'
}

function openDealflowDb() {
	if (!isIndexedDbAvailable()) return Promise.resolve(null)
	if (dbPromise) return dbPromise

	dbPromise = new Promise((resolve, reject) => {
		const request = indexedDB.open(DEALFLOW_DB_NAME, DEALFLOW_DB_VERSION)

		request.onerror = () => reject(request.error || new Error('IndexedDB open failed'))
		request.onsuccess = () => resolve(request.result)
		request.onupgradeneeded = () => {
			const db = request.result
			if (!db.objectStoreNames.contains(DEALS_CACHE_STORE)) {
				db.createObjectStore(DEALS_CACHE_STORE, { keyPath: 'key' })
			}
			if (!db.objectStoreNames.contains(DEALFLOW_UI_STATE_STORE)) {
				db.createObjectStore(DEALFLOW_UI_STATE_STORE, { keyPath: 'key' })
			}
		}
	}).catch((error) => {
		console.warn('Dealflow IndexedDB unavailable:', error?.message || error)
		dbPromise = null
		return null
	})

	return dbPromise
}

async function readRecord(storeName, scopedKey) {
	const db = await openDealflowDb()
	if (!db) return null

	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readonly')
		const store = tx.objectStore(storeName)
		const request = store.get(scopedKey)

		request.onerror = () => reject(request.error || new Error(`IndexedDB read failed for ${storeName}`))
		request.onsuccess = () => resolve(request.result || null)
	})
}

async function writeRecord(storeName, record) {
	const db = await openDealflowDb()
	if (!db) return

	return new Promise((resolve, reject) => {
		const tx = db.transaction(storeName, 'readwrite')
		const store = tx.objectStore(storeName)
		const request = store.put(record)

		request.onerror = () => reject(request.error || new Error(`IndexedDB write failed for ${storeName}`))
		request.onsuccess = () => resolve(record)
	})
}

function writeMemoryCache(map, scopedKey, value) {
	const nextValue = cloneSerializable(value)
	map.set(scopedKey, nextValue)
	return nextValue
}

function readMemoryCache(map, scopedKey) {
	if (!map.has(scopedKey)) return null
	return cloneSerializable(map.get(scopedKey))
}

export function peekDealflowDealsCache(baseKey, { email = currentSessionEmail() } = {}) {
	return readMemoryCache(dealCacheMemory, buildScopedKey(baseKey, email))
}

export async function readDealflowDealsCache(baseKey, { email = currentSessionEmail() } = {}) {
	const scopedKey = buildScopedKey(baseKey, email)
	const memoryValue = readMemoryCache(dealCacheMemory, scopedKey)
	if (memoryValue) return memoryValue

	const record = await readRecord(DEALS_CACHE_STORE, scopedKey).catch(() => null)
	if (!record?.value || record.version !== CACHE_SCHEMA_VERSION) return null
	return writeMemoryCache(dealCacheMemory, scopedKey, record.value)
}

export async function writeDealflowDealsCache(baseKey, value, { email = currentSessionEmail() } = {}) {
	const scopedKey = buildScopedKey(baseKey, email)
	const cachedValue = writeMemoryCache(dealCacheMemory, scopedKey, value)

	writeRecord(DEALS_CACHE_STORE, {
		key: scopedKey,
		version: CACHE_SCHEMA_VERSION,
		updatedAt: Date.now(),
		value: cachedValue
	}).catch((error) => {
		console.warn('Dealflow deals cache write failed:', error?.message || error)
	})

	return cachedValue
}

export function peekDealflowUiState(baseKey, { email = currentSessionEmail() } = {}) {
	return readMemoryCache(uiStateMemory, buildScopedKey(baseKey, email))
}

export async function readDealflowUiState(baseKey, { email = currentSessionEmail() } = {}) {
	const scopedKey = buildScopedKey(baseKey, email)
	const memoryValue = readMemoryCache(uiStateMemory, scopedKey)
	if (memoryValue) return memoryValue

	const record = await readRecord(DEALFLOW_UI_STATE_STORE, scopedKey).catch(() => null)
	if (!record?.value || record.version !== CACHE_SCHEMA_VERSION) return null
	return writeMemoryCache(uiStateMemory, scopedKey, record.value)
}

export async function writeDealflowUiState(baseKey, value, { email = currentSessionEmail() } = {}) {
	const scopedKey = buildScopedKey(baseKey, email)
	const cachedValue = writeMemoryCache(uiStateMemory, scopedKey, value)

	writeRecord(DEALFLOW_UI_STATE_STORE, {
		key: scopedKey,
		version: CACHE_SCHEMA_VERSION,
		updatedAt: Date.now(),
		value: cachedValue
	}).catch((error) => {
		console.warn('Dealflow UI cache write failed:', error?.message || error)
	})

	return cachedValue
}
