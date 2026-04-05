import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDealUpdatesFromSecFiling } from '../api/_sec-edgar.js';

// ---------------------------------------------------------------------------
// Existing tests (buildDealUpdatesFromSecFiling)
// ---------------------------------------------------------------------------

test('confirmed SEC filing repairs stale SEC identity fields on the deal', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{
			sec_entity_name: 'AGM Capital Fund II, LLC',
			issuer_entity: '',
			sec_cik: '1776558'
		},
		{
			entity_name: 'Capital Fund II, LLC',
			cik: '1533539',
			federal_exemptions: ['06b']
		},
		{ forceIdentitySync: true }
	);

	assert.equal(updates.sec_entity_name, 'Capital Fund II, LLC');
	assert.equal(updates.issuer_entity, 'Capital Fund II, LLC');
	assert.equal(updates.sec_cik, '1533539');
	assert.equal(updates.offering_type, '506(b)');
	assert.equal(updates.is_506b, true);
});

test('confirmed SEC filing preserves an explicit issuer entity that differs from the SEC name', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{
			sec_entity_name: 'Old Sec Name, LLC',
			issuer_entity: 'Borrower Holdings SPV, LLC',
			sec_cik: '1776558'
		},
		{
			entity_name: 'Capital Fund II, LLC',
			cik: '1533539',
			federal_exemptions: ['06b']
		},
		{ forceIdentitySync: true }
	);

	assert.equal(updates.sec_entity_name, 'Capital Fund II, LLC');
	assert.equal(updates.sec_cik, '1533539');
	assert.equal('issuer_entity' in updates, false);
});

// ---------------------------------------------------------------------------
// New tests: buildFilingRow isLatest parameter
// ---------------------------------------------------------------------------

// We test buildFilingRow indirectly via upsertParsedSecFiling's DB row shape.
// Since we can't call DB in unit tests, we import _sec-edgar internals by
// verifying that upsertParsedSecFiling is exported with the expected signature.

test('buildDealUpdatesFromSecFiling maps total_amount_sold to deal updates when is_latest_amendment', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1' },
		{ is_latest_amendment: true, total_amount_sold: 1500000000, total_investors: 1500, federal_exemptions: ['06c'] }
	);
	assert.equal(updates.total_amount_sold, 1500000000);
	assert.equal(updates.total_investors, 1500);
	assert.equal(updates.offering_type, '506(c)');
	assert.equal(updates.is_506b, false);
});

test('buildDealUpdatesFromSecFiling does NOT write total_amount_sold or total_investors from a non-latest filing', () => {
	// Regression: deal_sec_verification may link an old filing (e.g. 2017 Form D) while the deal
	// already has correct stats from a newer filing. applySecFilingToDeal is called on every
	// /api/sec-verification GET, so without this guard the old stats would overwrite on every page load.
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1' },
		{ is_latest_amendment: false, total_amount_sold: 13118333, total_investors: 73, federal_exemptions: ['06c'] }
	);
	assert.equal('total_amount_sold' in updates, false,
		'old filing must NOT overwrite total_amount_sold');
	assert.equal('total_investors' in updates, false,
		'old filing must NOT overwrite total_investors');
});

test('buildDealUpdatesFromSecFiling does not overwrite a set total_investors of 0', () => {
	// total_investors: 0 is falsy — should not be written (same as no investors)
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1' },
		{ is_latest_amendment: true, total_investors: 0, federal_exemptions: [] }
	);
	assert.equal('total_investors' in updates, false);
});

test('buildDealUpdatesFromSecFiling maps is_debt instrument when not set on deal', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1', instrument: null },
		{ is_debt: true, is_equity: false, is_pooled_fund: false, federal_exemptions: [] }
	);
	assert.equal(updates.instrument, 'debt');
});

test('buildDealUpdatesFromSecFiling does not overwrite existing instrument', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1', instrument: 'equity' },
		{ is_debt: true, is_equity: false, is_pooled_fund: false, federal_exemptions: [] }
	);
	assert.equal('instrument' in updates, false);
});

test('buildDealUpdatesFromSecFiling sets investment_minimum from filing when deal has none', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1', investment_minimum: null },
		{ minimum_investment: 100000, federal_exemptions: [] }
	);
	assert.equal(updates.investment_minimum, 100000);
});

test('buildDealUpdatesFromSecFiling does not overwrite a manually set investment_minimum', () => {
	// Regression: DLP Lending Fund minimum was manually raised to $500K but
	// every SEC sync reset it to $100K (the Form D registered value).
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1', investment_minimum: 500000 },
		{ minimum_investment: 100000, federal_exemptions: [] }
	);
	assert.equal('investment_minimum' in updates, false,
		'SEC filing must not overwrite a manually curated investment_minimum');
});

// ---------------------------------------------------------------------------
// New tests: markLatestFilingForCik contract (via mocked Supabase)
// ---------------------------------------------------------------------------

/**
 * Build a minimal Supabase mock that records the calls made to it.
 * markLatestFilingForCik should:
 *   1. SELECT id, filing_date WHERE cik=X AND filing_date IS NOT NULL ORDER BY filing_date DESC LIMIT 1
 *   2. UPDATE is_latest_amendment = false WHERE cik=X
 *   3. UPDATE is_latest_amendment = true WHERE id = <newest.id>
 */

import { markLatestFilingForCik } from '../api/_sec-edgar.js';

function makeMockSupabase({ newestRow = { id: 'filing-99', filing_date: '2024-06-01' }, fetchError = null, clearError = null, setError = null } = {}) {
	const calls = [];

	// Each chainable method returns an object that tracks calls and resolves at .maybeSingle() or the last awaited step.
	function makeQueryChain({ resolveWith }) {
		const chain = {
			_filters: [],
			select(cols) { this._op = 'select'; this._cols = cols; return this; },
			update(data) { this._op = 'update'; this._data = data; return this; },
			eq(col, val) { this._filters.push({ eq: [col, val] }); return this; },
			not(col, op, val) { this._filters.push({ not: [col, op, val] }); return this; },
			order(col, opts) { this._order = [col, opts]; return this; },
			limit(n) { this._limit = n; return this; },
			async maybeSingle() {
				calls.push({ op: this._op, cols: this._cols, data: this._data, filters: this._filters });
				return resolveWith;
			},
			then(resolve, reject) {
				calls.push({ op: this._op, data: this._data, filters: this._filters });
				resolve(resolveWith);
			}
		};
		return chain;
	}

	const mock = {
		_calls: calls,
		from(table) {
			return {
				table,
				select(cols) {
					return makeQueryChain({ resolveWith: { data: newestRow, error: fetchError } }).select(cols);
				},
				update(data) {
					const isSet = data?.is_latest_amendment === true;
					const err = isSet ? setError : clearError;
					return makeQueryChain({ resolveWith: { data: null, error: err } }).update(data);
				}
			};
		}
	};
	return mock;
}

test('markLatestFilingForCik returns the newest filing row', async () => {
	const supabase = makeMockSupabase({ newestRow: { id: 'filing-42', filing_date: '2024-09-15' } });
	const result = await markLatestFilingForCik('1234567', supabase);
	assert.equal(result.id, 'filing-42');
	assert.equal(result.filing_date, '2024-09-15');
});

test('markLatestFilingForCik returns null when no filings exist for the CIK', async () => {
	const supabase = makeMockSupabase({ newestRow: null });
	const result = await markLatestFilingForCik('9999999', supabase);
	assert.equal(result, null);
});

test('markLatestFilingForCik throws when CIK is empty', async () => {
	const supabase = makeMockSupabase();
	await assert.rejects(() => markLatestFilingForCik('', supabase), /CIK is required/);
});

test('markLatestFilingForCik strips leading zeros from CIK', async () => {
	let capturedCik = null;
	const supabase = {
		from() {
			return {
				select() {
					return {
						eq(col, val) { if (col === 'cik') capturedCik = val; return this; },
						not() { return this; },
						order() { return this; },
						limit() { return this; },
						async maybeSingle() { return { data: null, error: null }; }
					};
				}
			};
		}
	};
	await markLatestFilingForCik('0001234567', supabase);
	assert.equal(capturedCik, '1234567');
});

// ---------------------------------------------------------------------------
// Regression tests: bugs discovered during live execution (April 2026)
// ---------------------------------------------------------------------------

import { fetchAllFilingsForCik, EFTS_SEARCH_URL } from '../api/_sec-edgar.js';

/**
 * Regression: EDGAR EFTS requires zero-padded 10-digit CIK.
 * fetchAllFilingsForCik was stripping leading zeros before building the URL
 * (normalizedCik = '1622059'), resulting in 0 hits from EFTS for every search.
 * The padded form ('0001622059') is what EFTS expects.
 *
 * Fixed: paddedCik = normalizedCik.padStart(10, '0') used in search URL.
 */
test('fetchAllFilingsForCik uses zero-padded CIK in EFTS search URL', async () => {
	let capturedUrl = null;

	// Intercept the fetch call to inspect the URL without hitting the network
	const origFetch = globalThis.fetch;
	globalThis.fetch = async (url, opts) => {
		capturedUrl = String(url);
		// Return empty hits so the function exits cleanly
		return {
			ok: true,
			json: async () => ({ hits: { hits: [] } })
		};
	};

	try {
		await fetchAllFilingsForCik('1622059', null, {});
	} finally {
		globalThis.fetch = origFetch;
	}

	assert.ok(capturedUrl, 'fetch was called');
	// Must use padded CIK, not the stripped form
	assert.ok(capturedUrl.includes('ciks=0001622059'), `URL should use padded CIK 0001622059, got: ${capturedUrl}`);
	assert.ok(!capturedUrl.includes('ciks=1622059&') && !capturedUrl.endsWith('ciks=1622059'),
		`URL must NOT use un-padded CIK 1622059, got: ${capturedUrl}`);
});

test('fetchAllFilingsForCik pads short CIKs correctly', async () => {
	let capturedUrl = null;
	const origFetch = globalThis.fetch;
	globalThis.fetch = async (url) => {
		capturedUrl = String(url);
		return { ok: true, json: async () => ({ hits: { hits: [] } }) };
	};
	try {
		await fetchAllFilingsForCik('12345', null, {});
	} finally {
		globalThis.fetch = origFetch;
	}
	assert.ok(capturedUrl.includes('ciks=0000012345'), `Short CIK should be padded to 10 digits, got: ${capturedUrl}`);
});

/**
 * Regression: refreshSecFilingsForDeal previously selected non-existent columns
 * (issuer_entity, sec_entity_name) from opportunities, causing Supabase to return
 * a 42703 "column does not exist" error that was then reported as "Deal not found".
 *
 * Fixed: only select columns that exist on the opportunities table.
 * We test this by verifying the SELECT clause does NOT request those columns.
 */
import { refreshSecFilingsForDeal } from '../api/_sec-edgar.js';

test('refreshSecFilingsForDeal does not select non-existent columns (issuer_entity, sec_entity_name)', async () => {
	let capturedSelectCols = null;

	// Mock supabase — capture what columns are selected, return "deal not found" after
	const supabase = {
		from(table) {
			if (table === 'opportunities') {
				return {
					select(cols) {
						capturedSelectCols = cols;
						return {
							eq() { return this; },
							single: async () => ({ data: null, error: { message: 'intentional test stop' } })
						};
					}
				};
			}
			return { select() { return this; }, eq() { return this; } };
		}
	};

	// Will throw because we returned null deal — that's expected, we just want the SELECT cols
	try {
		await refreshSecFilingsForDeal('fake-deal-id', supabase);
	} catch (e) {
		// Expected — we stopped at the deal lookup
	}

	assert.ok(capturedSelectCols !== null, 'SELECT was called');
	assert.ok(!capturedSelectCols.includes('issuer_entity'),
		`issuer_entity is not a real column and must not be selected. Got: ${capturedSelectCols}`);
	assert.ok(!capturedSelectCols.includes('sec_entity_name'),
		`sec_entity_name is not a real column and must not be selected. Got: ${capturedSelectCols}`);
	// investment_minimum MUST be selected so the guard !deal.investment_minimum works correctly
	// Regression: omitting it caused the guard to always evaluate true (undefined is falsy),
	// which meant every refreshSecFilingsForDeal call silently overwrote manually-set minimums.
	assert.ok(capturedSelectCols.includes('investment_minimum'),
		`investment_minimum must be selected so the overwrite guard works. Got: ${capturedSelectCols}`);
});

test('buildDealUpdatesFromSecFiling maps filing_date to sec_latest_filing_date', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1' },
		{ is_latest_amendment: true, filing_date: '2026-03-02', total_amount_sold: 628887587, total_investors: 1503, federal_exemptions: ['06c'] }
	);
	assert.equal(updates.sec_latest_filing_date, '2026-03-02');
	assert.equal(updates.total_amount_sold, 628887587);
	assert.equal(updates.total_investors, 1503);
});

test('buildDealUpdatesFromSecFiling does not set sec_latest_filing_date when filing_date is absent', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1' },
		{ total_amount_sold: 100000, federal_exemptions: [] }
	);
	assert.equal('sec_latest_filing_date' in updates, false);
});
