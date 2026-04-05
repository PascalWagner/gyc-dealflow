/**
 * sponsor-dedup.test.mjs
 *
 * Unit tests for the three-phase sponsor lookup logic in api/deal-create.js.
 * Tests the pure decision logic extracted as a helper to avoid needing
 * a live Supabase connection.
 *
 * Phase A — exact match   → reuse existing id, skip B and C
 * Phase B — similar match → return requiresSponsorConfirmation (no insert)
 * Phase C — no match      → insert new management_company row
 * confirmedNewSponsor     → skip Phase B, go straight to Phase C
 */

import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Mirrors the three-phase sponsor resolution logic from api/deal-create.js.
 * Takes injectable async functions for each DB call so it can be tested
 * without a real Supabase connection.
 *
 * @param {object} options
 * @param {string} options.trimmedSponsor
 * @param {boolean} options.confirmedNewSponsor
 * @param {() => Promise<{id}|null>} options.exactMatch    - Phase A lookup
 * @param {() => Promise<Array>}    options.similarSearch  - Phase B RPC
 * @param {() => Promise<{id}>}     options.insertCompany  - Phase C insert
 * @returns {Promise<{managementCompanyId: string|null, requiresSponsorConfirmation?: true, similarSponsors?: Array}>}
 */
async function resolveSponsor({ trimmedSponsor, confirmedNewSponsor, exactMatch, similarSearch, insertCompany }) {
	// Phase A
	const existing = await exactMatch(trimmedSponsor);
	if (existing?.id) {
		return { managementCompanyId: existing.id };
	}

	// Phase B (skipped when confirmedNewSponsor)
	if (!confirmedNewSponsor) {
		const similar = await similarSearch(trimmedSponsor);
		if (Array.isArray(similar) && similar.length > 0) {
			return { managementCompanyId: null, requiresSponsorConfirmation: true, similarSponsors: similar };
		}
	}

	// Phase C
	const newRow = await insertCompany(trimmedSponsor);
	return { managementCompanyId: newRow?.id || null };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('Phase A: exact match reuses existing id and skips B and C', async () => {
	let similarCalled = false;
	let insertCalled = false;

	const result = await resolveSponsor({
		trimmedSponsor: 'DLP Capital',
		confirmedNewSponsor: false,
		exactMatch: async () => ({ id: 'existing-uuid' }),
		similarSearch: async () => { similarCalled = true; return []; },
		insertCompany: async () => { insertCalled = true; return { id: 'new-uuid' }; }
	});

	assert.equal(result.managementCompanyId, 'existing-uuid');
	assert.equal(result.requiresSponsorConfirmation, undefined);
	assert.equal(similarCalled, false, 'Phase B should not run when Phase A matches');
	assert.equal(insertCalled, false, 'Phase C should not run when Phase A matches');
});

test('Phase B: similar match returns requiresSponsorConfirmation without inserting', async () => {
	let insertCalled = false;

	const mockSimilar = [
		{ id: 'existing-uuid', operator_name: 'DLP Capital', website: 'dlpcapital.com', type: 'Debt Fund' }
	];

	const result = await resolveSponsor({
		trimmedSponsor: 'DLP Capital Partners',
		confirmedNewSponsor: false,
		exactMatch: async () => null,
		similarSearch: async () => mockSimilar,
		insertCompany: async () => { insertCalled = true; return { id: 'new-uuid' }; }
	});

	assert.equal(result.requiresSponsorConfirmation, true);
	assert.deepEqual(result.similarSponsors, mockSimilar);
	assert.equal(result.managementCompanyId, null);
	assert.equal(insertCalled, false, 'Phase C must not run when Phase B returns matches');
});

test('Phase C: no match creates new management_company row', async () => {
	const result = await resolveSponsor({
		trimmedSponsor: 'Brand New Capital',
		confirmedNewSponsor: false,
		exactMatch: async () => null,
		similarSearch: async () => [],
		insertCompany: async () => ({ id: 'created-uuid' })
	});

	assert.equal(result.managementCompanyId, 'created-uuid');
	assert.equal(result.requiresSponsorConfirmation, undefined);
});

test('confirmedNewSponsor skips Phase B and goes straight to Phase C', async () => {
	let similarCalled = false;

	const result = await resolveSponsor({
		trimmedSponsor: 'DLP Capital Partners',
		confirmedNewSponsor: true,
		exactMatch: async () => null,
		similarSearch: async () => { similarCalled = true; return [{ id: 'x', operator_name: 'DLP Capital' }]; },
		insertCompany: async () => ({ id: 'new-uuid' })
	});

	assert.equal(result.managementCompanyId, 'new-uuid');
	assert.equal(result.requiresSponsorConfirmation, undefined);
	assert.equal(similarCalled, false, 'Phase B must be skipped when confirmedNewSponsor is true');
});

test('Phase B with empty similar results proceeds to Phase C', async () => {
	const result = await resolveSponsor({
		trimmedSponsor: 'Totally Unique Fund',
		confirmedNewSponsor: false,
		exactMatch: async () => null,
		similarSearch: async () => [],
		insertCompany: async () => ({ id: 'created-uuid' })
	});

	assert.equal(result.managementCompanyId, 'created-uuid');
	assert.equal(result.requiresSponsorConfirmation, undefined);
});

test('Phase B with null similar result (RPC failure) proceeds to Phase C', async () => {
	const result = await resolveSponsor({
		trimmedSponsor: 'Some Fund',
		confirmedNewSponsor: false,
		exactMatch: async () => null,
		similarSearch: async () => null, // null as if RPC errored and returned null
		insertCompany: async () => ({ id: 'created-uuid' })
	});

	assert.equal(result.managementCompanyId, 'created-uuid');
	assert.equal(result.requiresSponsorConfirmation, undefined);
});
