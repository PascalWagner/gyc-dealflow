/**
 * sponsor-search-error.test.mjs
 *
 * Unit tests for the sponsor search error handling logic extracted from
 * FieldRenderer.svelte (runSponsorSearch behavior).
 *
 * Tests the three states required by WS17:
 *   1. fetch throws    → sponsorSearchError set, sponsorResults empty
 *   2. response.ok false → sponsorSearchError set, sponsorResults empty
 *   3. success with empty results → sponsorSearchError null, sponsorResults empty
 */

import test from 'node:test';
import assert from 'node:assert/strict';

// ── Extracted logic mirror ────────────────────────────────────────────────────
// Mirrors runSponsorSearch from FieldRenderer.svelte exactly,
// taking the fetch implementation as a parameter for testability.

async function runSponsorSearch(query, fetchImpl) {
	const trimmed = String(query || '').trim();
	const state = {
		sponsorResults: [],
		sponsorSearchError: null,
		sponsorLoading: false,
		sponsorSearchDone: false
	};

	if (trimmed.length < 2) {
		return state;
	}

	state.sponsorSearchError = null;
	state.sponsorLoading = true;
	try {
		const response = await fetchImpl(`/api/company-search?q=${encodeURIComponent(trimmed)}`);
		if (!response.ok) {
			throw new Error(`Search failed (${response.status})`);
		}
		const payload = await response.json().catch(() => ({}));
		state.sponsorResults = Array.isArray(payload?.results) ? payload.results : [];
	} catch {
		state.sponsorResults = [];
		state.sponsorSearchError = 'Sponsor search unavailable — enter manually or try again';
	} finally {
		state.sponsorLoading = false;
		state.sponsorSearchDone = true;
	}

	return state;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('when fetch throws, sponsorSearchError is set and sponsorResults is empty', async () => {
	const fetchThatThrows = async () => {
		throw new TypeError('Failed to fetch');
	};

	const state = await runSponsorSearch('Blackstone', fetchThatThrows);

	assert.equal(
		state.sponsorSearchError,
		'Sponsor search unavailable — enter manually or try again',
		'error message should be set'
	);
	assert.deepEqual(state.sponsorResults, [], 'results should be empty on error');
	assert.equal(state.sponsorLoading, false, 'loading should be false after completion');
	assert.equal(state.sponsorSearchDone, true, 'searchDone should be true');
});

test('when response.ok is false, sponsorSearchError is set and sponsorResults is empty', async () => {
	const fetchReturning500 = async () => ({
		ok: false,
		status: 500,
		json: async () => ({ error: 'Internal server error' })
	});

	const state = await runSponsorSearch('Blackstone', fetchReturning500);

	assert.equal(
		state.sponsorSearchError,
		'Sponsor search unavailable — enter manually or try again',
		'error message should be set on non-ok response'
	);
	assert.deepEqual(state.sponsorResults, [], 'results should be empty on error response');
	assert.equal(state.sponsorSearchDone, true, 'searchDone should be true');
});

test('when response.ok is false with 404, sponsorSearchError is set', async () => {
	const fetchReturning404 = async () => ({
		ok: false,
		status: 404,
		json: async () => ({})
	});

	const state = await runSponsorSearch('Blackstone', fetchReturning404);

	assert.ok(state.sponsorSearchError, 'error message should be set on 404');
	assert.deepEqual(state.sponsorResults, [], 'results should be empty');
});

test('when search succeeds with empty results, sponsorSearchError is null', async () => {
	const fetchReturningEmpty = async () => ({
		ok: true,
		status: 200,
		json: async () => ({ results: [] })
	});

	const state = await runSponsorSearch('NoResultsExpected', fetchReturningEmpty);

	assert.equal(state.sponsorSearchError, null, 'error should be null on successful empty response');
	assert.deepEqual(state.sponsorResults, [], 'results should be empty');
	assert.equal(state.sponsorSearchDone, true, 'searchDone should be true (to trigger no-results UI)');
	assert.equal(state.sponsorLoading, false, 'loading should be false');
});

test('when search succeeds with results, sponsorSearchError is null and results populated', async () => {
	const mockResults = [
		{ id: 'abc', operator_name: 'Blackstone', type: 'PE', asset_classes: ['Multifamily'] }
	];
	const fetchReturningResults = async () => ({
		ok: true,
		status: 200,
		json: async () => ({ results: mockResults })
	});

	const state = await runSponsorSearch('Blackstone', fetchReturningResults);

	assert.equal(state.sponsorSearchError, null, 'error should be null on successful search');
	assert.deepEqual(state.sponsorResults, mockResults, 'results should be populated');
});

test('when query is too short (<2 chars), error is cleared and search does not run', async () => {
	let fetchCalled = false;
	const fetchSpy = async () => {
		fetchCalled = true;
		return { ok: true, status: 200, json: async () => ({ results: [] }) };
	};

	const state = await runSponsorSearch('B', fetchSpy);

	assert.equal(fetchCalled, false, 'fetch should not be called for short queries');
	assert.equal(state.sponsorSearchError, null, 'error should be null');
	assert.equal(state.sponsorSearchDone, false, 'searchDone should be false for short query');
});

test('when query is empty, error is cleared and search does not run', async () => {
	let fetchCalled = false;
	const fetchSpy = async () => {
		fetchCalled = true;
		return { ok: true, status: 200, json: async () => ({ results: [] }) };
	};

	const state = await runSponsorSearch('', fetchSpy);

	assert.equal(fetchCalled, false, 'fetch should not be called for empty query');
	assert.equal(state.sponsorSearchError, null, 'error should be null');
});
