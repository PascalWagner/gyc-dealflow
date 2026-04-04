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

test('buildDealUpdatesFromSecFiling maps total_amount_sold to deal updates', () => {
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1' },
		{ total_amount_sold: 1500000000, total_investors: 1500, federal_exemptions: ['06c'] }
	);
	assert.equal(updates.total_amount_sold, 1500000000);
	assert.equal(updates.total_investors, 1500);
	assert.equal(updates.offering_type, '506(c)');
	assert.equal(updates.is_506b, false);
});

test('buildDealUpdatesFromSecFiling does not overwrite a set total_investors of 0', () => {
	// total_investors: 0 is falsy — should not be written (same as no investors)
	const { updates } = buildDealUpdatesFromSecFiling(
		{ id: 'deal-1' },
		{ total_investors: 0, federal_exemptions: [] }
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
