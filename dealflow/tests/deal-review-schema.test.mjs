/**
 * deal-review-schema.test.mjs
 *
 * Unit tests for the three core deal review functions identified in
 * docs/deal-review-audit.md §5.2 (Automated Test Strategy) and
 * Recommendation #2 (Build test infrastructure first):
 *
 *   resolveFinalReviewFieldValue()  — reviewFieldState.js
 *   buildDealReviewPayload()        — dealReviewSchema.js (frontend normalization)
 *   normalizeDealReviewPatch()      — dealReviewSchema.js (backend normalization)
 *
 * These are the functions most likely to regress during the planned refactor.
 * No production code was modified to make any test here pass.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
	resolveFinalReviewFieldValue,
	buildAiReviewFieldStateEntry,
	normalizeReviewFieldStateEntry
} from '../src/lib/utils/reviewFieldState.js';
import {
	buildDealReviewPayload,
	normalizeDealReviewPatch,
	normalizeEnumValue
} from '../src/lib/utils/dealReviewSchema.js';
import {
	buildCascadeStatus,
	shouldSkipExtraction,
	runEnrichmentCascade
} from '../api/_enrichment.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run buildDealReviewPayload for a single field and return the payload value
 * for that field.  Uses includeFieldKeys to prevent unrelated post-processing
 * (slug generation, offeringType compliance pass) from polluting the result.
 *
 * NOTE: offeringStatus is remapped to `status` by buildDealReviewPayload even
 * when isolated via includeFieldKeys — use checkOfferingStatus() for that field.
 */
function buildField(fieldKey, rawValue) {
	const { payload } = buildDealReviewPayload(
		{ [fieldKey]: rawValue },
		{ includeFieldKeys: [fieldKey] }
	);
	return payload[fieldKey];
}

/** Special helper for offeringStatus which gets remapped to payload.status. */
function buildOfferingStatus(rawValue) {
	const { payload } = buildDealReviewPayload(
		{ offeringStatus: rawValue },
		{ includeFieldKeys: ['offeringStatus'] }
	);
	return payload.status; // remapped by buildDealReviewPayload
}

// ===========================================================================
// 1. resolveFinalReviewFieldValue()
//    Three-tier resolution + edge cases for null vs absent values.
//    Tier order: adminOverride > aiValue > fallback (flat column)
//    finalValue tier was eliminated — see deal-review-audit.md §3.1
// ===========================================================================

// -- Tier 1: admin override --------------------------------------------------

test('resolveFinalReviewFieldValue: adminOverrideActive=true returns adminOverrideValue', () => {
	const entry = {
		adminOverrideActive: true,
		adminOverrideValue: 500000,
		aiValue: 100000,
		aiValuePresent: true
	};
	assert.equal(resolveFinalReviewFieldValue(entry, 99999), 500000);
});

test('resolveFinalReviewFieldValue: admin override wins over aiValue and fallback', () => {
	const entry = {
		adminOverrideActive: true,
		adminOverrideValue: 'admin-set',
		aiValue: 'ai-value',
		aiValuePresent: true
	};
	assert.equal(resolveFinalReviewFieldValue(entry, 'db-column'), 'admin-set');
});

test('resolveFinalReviewFieldValue: adminOverrideActive=true but adminOverrideValue=null returns null — NOT fallback', () => {
	// When an admin explicitly clears a field to null that is a deliberate
	// act. The fallback (DB column) must NOT leak through. This is the
	// precedence-logic bug the audit doc flags under Recommendation #5.
	const entry = { adminOverrideActive: true, adminOverrideValue: null };
	const result = resolveFinalReviewFieldValue(entry, 'FALLBACK_MUST_NOT_APPEAR');
	assert.equal(result, null,
		'Admin override of null must return null, not the fallback value');
});

// -- Tier 2: AI value --------------------------------------------------------

test('resolveFinalReviewFieldValue: aiValuePresent=true (no admin override) returns aiValue', () => {
	const entry = { adminOverrideActive: false, aiValue: 100000, aiValuePresent: true };
	assert.equal(resolveFinalReviewFieldValue(entry, 99999), 100000);
});

test('resolveFinalReviewFieldValue: aiValue wins over fallback when no admin override', () => {
	const entry = {
		adminOverrideActive: false,
		aiValue: 'from-ai',
		aiValuePresent: true
	};
	assert.equal(resolveFinalReviewFieldValue(entry, 'db-col'), 'from-ai');
});

test('resolveFinalReviewFieldValue: aiValuePresent=true but aiValue=null returns null — NOT fallback', () => {
	// AI extracted the field and found nothing. That is a valid extraction
	// result, not an absent result. The fallback must not leak through.
	const entry = { aiValue: null, aiValuePresent: true };
	const result = resolveFinalReviewFieldValue(entry, 'FALLBACK_MUST_NOT_APPEAR');
	assert.equal(result, null,
		'AI-present null must return null, not the fallback value');
});

test('resolveFinalReviewFieldValue: having the aiValue key (hasOwn) implies aiValuePresent even without explicit flag', () => {
	// normalizeReviewFieldStateEntry: aiValuePresent = aiValuePresent===true || hasOwn(entry, 'aiValue')
	// An entry written before aiValuePresent existed still resolves correctly.
	const entry = { aiValue: 0 }; // no aiValuePresent key
	assert.equal(resolveFinalReviewFieldValue(entry, 'FALLBACK'), 0);
});

// -- Tier 3: fallback (flat column) ------------------------------------------

test('resolveFinalReviewFieldValue: empty entry returns fallbackValue', () => {
	assert.equal(resolveFinalReviewFieldValue({}, 'DB_COLUMN_VALUE'), 'DB_COLUMN_VALUE');
});

test('resolveFinalReviewFieldValue: undefined fallback returns undefined when no tier matches', () => {
	assert.equal(resolveFinalReviewFieldValue({}), undefined);
});

// -- Null / empty string / absent behaviour ----------------------------------

test('resolveFinalReviewFieldValue: empty string aiValue is a present value, not absent', () => {
	// Empty string IS a deliberate value (admin cleared text to "").
	// It returns '' and must NOT fall through to the fallback.
	const withEmpty = { aiValue: '' };
	assert.equal(resolveFinalReviewFieldValue(withEmpty, 'FALLBACK'), '');
});

test('resolveFinalReviewFieldValue: no aiValue key is absent — falls through to fallback', () => {
	// Contrast with the test above: the key is not present at all.
	const withoutKey = { aiValuePresent: false };
	assert.equal(resolveFinalReviewFieldValue(withoutKey, 'FALLBACK'), 'FALLBACK');
});


// ===========================================================================
// 2. buildDealReviewPayload() — frontend normalization
//    Audit §5.2: "test normalization for every field type (%, $, numeric, enum)"
// ===========================================================================

// -- Currency (type: 'currency') ---------------------------------------------

test('buildDealReviewPayload: currency strips $ and commas — "$1,500" → 1500', () => {
	assert.equal(buildField('investmentMinimum', '$1,500'), 1500);
});

test('buildDealReviewPayload: currency handles large amounts — "$1,000,000" → 1000000', () => {
	assert.equal(buildField('investmentMinimum', '$1,000,000'), 1000000);
});

test('buildDealReviewPayload: currency as plain number passes through', () => {
	assert.equal(buildField('investmentMinimum', 50000), 50000);
});

test('buildDealReviewPayload: empty string on currency field produces null, not 0', () => {
	assert.equal(buildField('investmentMinimum', ''), null);
});

test('buildDealReviewPayload: empty string on number field produces null, not 0', () => {
	assert.equal(buildField('totalInvestors', ''), null);
});

// -- Percentage (type: 'percentage') -----------------------------------------

test('buildDealReviewPayload: "15%" stored as decimal 0.15, not whole number 15', () => {
	assert.equal(buildField('targetIRR', '15%'), 0.15);
});

test('buildDealReviewPayload: "12" (bare number > 1) treated as 12% → stored as 0.12', () => {
	// parsePercentInput: if Math.abs(value) > 1, divide by 100
	assert.equal(buildField('targetIRR', '12'), 0.12);
});

test('buildDealReviewPayload: "0.12" (already decimal ≤ 1) is NOT divided again → stays 0.12', () => {
	// Regression guard: 0.12 must not become 0.0012
	assert.equal(buildField('targetIRR', '0.12'), 0.12);
});

test('buildDealReviewPayload: empty string on percentage field produces null, not 0', () => {
	assert.equal(buildField('targetIRR', ''), null);
});

test('buildDealReviewPayload: "0%" stored as 0, not null', () => {
	assert.equal(buildField('targetIRR', '0%'), 0);
});

// -- Enum fields (type: 'string_enum') ----------------------------------------

test('buildDealReviewPayload: dealType alias "syndication" → canonical "Syndication"', () => {
	assert.equal(buildField('dealType', 'syndication'), 'Syndication');
});

test('buildDealReviewPayload: dealType alias "jv" → canonical "Joint Venture"', () => {
	assert.equal(buildField('dealType', 'jv'), 'Joint Venture');
});

test('buildDealReviewPayload: instrument alias "loan" → canonical "Debt"', () => {
	assert.equal(buildField('instrument', 'loan'), 'Debt');
});

test('buildDealReviewPayload: instrument alias "preferred" → canonical "Preferred Equity"', () => {
	assert.equal(buildField('instrument', 'preferred'), 'Preferred Equity');
});

test('buildDealReviewPayload: distributions alias "monthly" → canonical "Monthly" (exact case)', () => {
	assert.equal(buildField('distributions', 'monthly'), 'Monthly');
});

test('buildDealReviewPayload: offeringStatus alias "open" → canonical "Open to invest" (via remapped status key)', () => {
	// offeringStatus is special: buildDealReviewPayload remaps payload.offeringStatus → payload.status
	assert.equal(buildOfferingStatus('open'), 'Open to invest');
});

test('buildDealReviewPayload: unknown enum value with allowUnknown=false produces empty string', () => {
	// Reject bad data rather than silently write garbage to the DB.
	assert.equal(buildField('dealType', 'not-a-real-type'), '');
});

test('buildDealReviewPayload: enum is case-insensitive — "FUND" → "Fund"', () => {
	assert.equal(buildField('dealType', 'FUND'), 'Fund');
});

// -- Boolean fields ----------------------------------------------------------

// NOTE: There is no type:'boolean' in dealFieldConfig. The only boolean-aware
// field outside the main loop is createManagementCompany (handled specially in
// normalizeDealReviewPatch but NOT in buildDealReviewPayload).
//
// If a future refactor adds a boolean field type to dealFieldConfig, it MUST
// have an explicit type branch — the current catch-all path is:
//   String(rawValue || '').trim()
// which would cast true → "true" and false → "".
//
// The test below documents this gap as a regression reference.
test('buildDealReviewPayload [documentation]: boolean true passed to a string_free field becomes the string "true"', () => {
	// This is the CURRENT behaviour, not the desired behaviour.
	// If a boolean field type is added to dealFieldConfig this test should be
	// updated to assert the correct type-safe handling.
	const result = buildField('investmentName', true);
	assert.equal(result, 'true',
		'String coercion: if this fails, a boolean type branch has been added — update this test to verify it produces a real boolean, not a string');
});

// -- String fields -----------------------------------------------------------

test('buildDealReviewPayload: string field is trimmed', () => {
	assert.equal(buildField('investmentName', '  DLP Lending Fund  '), 'DLP Lending Fund');
});

test('buildDealReviewPayload: null string field coerces to empty string', () => {
	assert.equal(buildField('investmentName', null), '');
});


// ===========================================================================
// 3. normalizeDealReviewPatch() — backend normalization
//    Audit §5.2: "verify parity with frontend, verify no double-conversion"
// ===========================================================================

// -- Parity: frontend and backend must agree on the same input ---------------

test('normalizeDealReviewPatch parity: currency "investmentMinimum" — "$500,000" → 500000', () => {
	const raw = { investmentMinimum: '$500,000' };
	const { payload: front } = buildDealReviewPayload(raw, { includeFieldKeys: ['investmentMinimum'] });
	const { values: back } = normalizeDealReviewPatch(raw);
	assert.equal(front.investmentMinimum, 500000, 'frontend');
	assert.equal(back.investmentMinimum, 500000, 'backend');
	assert.equal(front.investmentMinimum, back.investmentMinimum, 'frontend === backend');
});

test('normalizeDealReviewPatch parity: percentage "targetIRR" — "8%" → 0.08', () => {
	const raw = { targetIRR: '8%' };
	const { payload: front } = buildDealReviewPayload(raw, { includeFieldKeys: ['targetIRR'] });
	const { values: back } = normalizeDealReviewPatch(raw);
	assert.equal(front.targetIRR, 0.08, 'frontend');
	assert.equal(back.targetIRR, 0.08, 'backend');
	assert.equal(front.targetIRR, back.targetIRR, 'frontend === backend');
});

test('normalizeDealReviewPatch parity: enum "instrument" — "debt" → "Debt"', () => {
	const raw = { instrument: 'debt' };
	const { payload: front } = buildDealReviewPayload(raw, { includeFieldKeys: ['instrument'] });
	const { values: back } = normalizeDealReviewPatch(raw);
	assert.equal(front.instrument, 'Debt', 'frontend');
	assert.equal(back.instrument, 'Debt', 'backend');
	assert.equal(front.instrument, back.instrument, 'frontend === backend');
});

test('normalizeDealReviewPatch parity: string "investmentName" — trims whitespace', () => {
	const raw = { investmentName: '  My Fund  ' };
	const { payload: front } = buildDealReviewPayload(raw, { includeFieldKeys: ['investmentName'] });
	const { values: back } = normalizeDealReviewPatch(raw);
	assert.equal(front.investmentName, 'My Fund', 'frontend');
	assert.equal(back.investmentName, 'My Fund', 'backend');
	assert.equal(front.investmentName, back.investmentName, 'frontend === backend');
});

test('normalizeDealReviewPatch parity: enum "distributions" — "quarterly" → "Quarterly"', () => {
	const raw = { distributions: 'quarterly' };
	const { payload: front } = buildDealReviewPayload(raw, { includeFieldKeys: ['distributions'] });
	const { values: back } = normalizeDealReviewPatch(raw);
	assert.equal(front.distributions, 'Quarterly', 'frontend');
	assert.equal(back.distributions, 'Quarterly', 'backend');
	assert.equal(front.distributions, back.distributions, 'frontend === backend');
});

// -- Boolean: normalizeDealReviewPatch correctly handles createManagementCompany
//    This field is NOT in dealFieldConfig so buildDealReviewPayload doesn't see it.

test('normalizeDealReviewPatch: createManagementCompany=true stored as boolean true (not string)', () => {
	const { values } = normalizeDealReviewPatch({ createManagementCompany: true });
	assert.strictEqual(values.createManagementCompany, true);
	assert.equal(typeof values.createManagementCompany, 'boolean');
});

test('normalizeDealReviewPatch: createManagementCompany="yes" is falsy — only strict true passes', () => {
	const { values } = normalizeDealReviewPatch({ createManagementCompany: 'yes' });
	assert.strictEqual(values.createManagementCompany, false);
});

// -- No double-conversion of already-decimal percentages ---------------------

test('normalizeDealReviewPatch: percentage 0.15 is NOT double-converted to 0.0015', () => {
	// A value that has already been normalized (0.15) must arrive unchanged.
	// parsePercentInput: if Math.abs(value) <= 1, return as-is.
	const { values } = normalizeDealReviewPatch({ targetIRR: 0.15 });
	assert.equal(values.targetIRR, 0.15,
		'0.15 must not be divided by 100 again to become 0.0015');
});

test('normalizeDealReviewPatch: percentage 0 is stored as 0, not null', () => {
	const { values } = normalizeDealReviewPatch({ targetIRR: 0 });
	assert.equal(values.targetIRR, 0);
});

// -- Unknown / out-of-map fields ---------------------------------------------

// CURRENT BEHAVIOUR (documented, not desired):
// normalizeDealReviewPatch starts with `const normalized = { ...body }` so any
// key in `body` that is NOT in dealFieldConfig passes through unmodified into
// `values`. This means an unknown field like `hackerField` will appear in the
// output and could be written to the DB if the PATCH handler does not filter.
//
// The audit doc (§5.2) and Recommendation #4 flag this as a risk:
// "Consolidate field mapping to one canonical file — eliminates a whole class
// of future bugs."
//
// TODO: Once the PATCH handler is refactored to only write fields in
// REVIEW_FIELD_DB_COLUMN_MAP, add a test here that confirms unknown fields
// never reach the UPDATE query (integration test against a real Supabase row).

test('normalizeDealReviewPatch [current behaviour]: unknown field passes through unmodified', () => {
	// This test documents current behaviour — NOT an assertion that this is safe.
	// If this test starts failing, it means the schema is now rejecting unknown
	// fields, which is the DESIRED outcome. Flip the assertion accordingly.
	const { values } = normalizeDealReviewPatch({ investmentName: 'Good Fund', notInSchema: 'surprise' });
	assert.equal(values.investmentName, 'Good Fund', 'known field normalized correctly');
	assert.equal(values.notInSchema, 'surprise',
		'CURRENT: unknown fields pass through — update this test once the schema rejects them');
});

test('normalizeDealReviewPatch: only fields present in body are processed (sparse patch)', () => {
	// Backend only normalizes keys that exist in the body; absent keys are not
	// defaulted to null (unlike buildDealReviewPayload which processes all fields).
	const { values } = normalizeDealReviewPatch({ investmentMinimum: '$100,000' });
	assert.equal(values.investmentMinimum, 100000);
	assert.equal('targetIRR' in values, false,
		'targetIRR was not in the patch body — must not appear in normalized output');
});

// -- offeringStatus / status remapping ---------------------------------------

test('normalizeDealReviewPatch: offeringStatus is mirrored to status key', () => {
	// normalizeDealReviewPatch adds `status` as an alias but does NOT delete
	// `offeringStatus` (contrast: buildDealReviewPayload deletes offeringStatus).
	const { values } = normalizeDealReviewPatch({ offeringStatus: 'open' });
	assert.equal(values.status, 'Open to invest');
	assert.equal(values.offeringStatus, 'Open to invest');
});

// -- Validation errors -------------------------------------------------------

test('normalizeDealReviewPatch: invalid UUID for managementCompanyId produces an error', () => {
	const { errors } = normalizeDealReviewPatch({ managementCompanyId: 'not-a-uuid' });
	assert.ok(errors.managementCompanyId, 'should report a managementCompanyId error');
});

test('normalizeDealReviewPatch: valid UUID for managementCompanyId produces no error', () => {
	const { errors } = normalizeDealReviewPatch({
		managementCompanyId: '123e4567-e89b-12d3-a456-426614174000'
	});
	assert.equal(errors.managementCompanyId, undefined);
});

test('normalizeDealReviewPatch: bad enum value produces an error for that field', () => {
	const { values, errors } = normalizeDealReviewPatch({ instrument: 'definitely-not-canonical' });
	assert.equal(values.instrument, '', 'unknown enum collapses to empty string');
	assert.ok(errors.instrument, 'should report an instrument error');
});

// -- reviewStateVersion conflict (stale version → 409) -----------------------

// TODO [Integration test — requires real Supabase connection]:
//
// This test cannot be written as a pure unit test because the version check
// lives in the PATCH handler of api/deals/[id].js, not in normalizeDealReviewPatch.
//
// To enable this test:
//   1. Set up a test Supabase instance (or use the existing sandbox with a
//      dedicated test deal row).
//   2. Seed a deal row with a known review_state_version (e.g. version=1).
//   3. PATCH it with reviewStateVersion=0 (intentionally stale).
//   4. Assert the response status is 409.
//   5. Re-fetch the row and assert no fields changed (version still 1,
//      review_field_state unchanged).
//
// Pseudocode (uncomment and fill in when a test DB fixture exists):
//
// test('PATCH /api/deals/[id]: stale reviewStateVersion returns 409 with no DB mutation', async () => {
//   const dealId = SEED_DEAL_ID;
//   const currentVersion = await getReviewStateVersion(dealId);
//
//   const response = await fetch(`/api/deals/${dealId}`, {
//     method: 'PATCH',
//     headers: { Authorization: `Bearer ${ADMIN_TOKEN}`, 'Content-Type': 'application/json' },
//     body: JSON.stringify({
//       investmentMinimum: 999999,
//       reviewStateVersion: currentVersion - 1  // intentionally stale
//     })
//   });
//
//   assert.equal(response.status, 409);
//
//   const refetched = await getReviewStateVersion(dealId);
//   assert.equal(refetched, currentVersion, 'version must be unchanged');
//
//   const deal = await getDeal(dealId);
//   assert.notEqual(deal.investment_minimum, 999999, 'field must not have been written');
// });

// ===========================================================================
// Extraction cascade resilience — buildCascadeStatus / shouldSkipExtraction
// ===========================================================================
//
// These tests cover Workstream 4 from deal-review-audit.md §6.1:
//   • runEnrichmentCascade returns status 'partial' when a secondary step
//     fails, but still preserves primary extracted fields.
//   • shouldSkipExtraction correctly gates re-extraction against existing runs.
//
// buildCascadeStatus and shouldSkipExtraction are pure helpers exported from
// api/_enrichment.js for easy unit testing without network calls.

test('buildCascadeStatus: no failed steps → "complete"', () => {
	assert.equal(buildCascadeStatus([]), 'complete');
});

test('buildCascadeStatus: one failed secondary step → "partial"', () => {
	assert.equal(buildCascadeStatus([{ step: 'sec', error: 'timeout' }]), 'partial');
});

test('buildCascadeStatus: multiple failed steps → "partial"', () => {
	const failures = [
		{ step: 'sec', error: 'timeout' },
		{ step: 'property', error: 'RentCast 503' }
	];
	assert.equal(buildCascadeStatus(failures), 'partial');
});

test('buildCascadeStatus: null/undefined input treated as no failures → "complete"', () => {
	// Defensive: callers should always pass an array, but guard just in case.
	assert.equal(buildCascadeStatus(null), 'complete');
	assert.equal(buildCascadeStatus(undefined), 'complete');
});

// Cascade integration: runEnrichmentCascade with an empty extracted object fires
// no secondary lookups (no entity names, no address, no supabase), so partialFailures
// should be empty and status should be 'complete'.
test('runEnrichmentCascade with empty extracted object: no secondary failures, status complete', async () => {
	const result = await runEnrichmentCascade({}, null);
	assert.equal(result.status, 'complete', 'status should be complete when no secondaries were attempted');
	assert.deepEqual(result.partialFailures, [], 'no failures when no secondaries ran');
	assert.deepEqual(result.matchedDeals, [], 'no matched deals when supabase is null');
	assert.ok(Array.isArray(result.enrichmentSteps), 'enrichmentSteps should be an array');
});

// Deduplication: shouldSkipExtraction gate
test('shouldSkipExtraction: null run → do not skip', () => {
	assert.equal(shouldSkipExtraction(null), false);
});

test('shouldSkipExtraction: undefined run → do not skip', () => {
	assert.equal(shouldSkipExtraction(undefined), false);
});

test('shouldSkipExtraction: status "complete" → skip', () => {
	assert.equal(shouldSkipExtraction({ status: 'complete' }), true);
});

test('shouldSkipExtraction: status "partial" → skip (primary extraction succeeded)', () => {
	assert.equal(shouldSkipExtraction({ status: 'partial' }), true);
});

test('shouldSkipExtraction: status "running" → do not skip (still in progress)', () => {
	assert.equal(shouldSkipExtraction({ status: 'running' }), false);
});

test('shouldSkipExtraction: status "failed" → do not skip (should retry)', () => {
	assert.equal(shouldSkipExtraction({ status: 'failed' }), false);
});

// extractionRunId propagation through reviewFieldState
test('buildAiReviewFieldStateEntry: extractionRunId is stored when provided', () => {
	const runId = 'a1b2c3d4-0000-0000-0000-000000000001';
	const entry = buildAiReviewFieldStateEntry({}, {
		nextValue: 'Lending Fund',
		source: 'ai_extraction',
		extractionRunId: runId
	});
	assert.equal(entry.extractionRunId, runId, 'extractionRunId should be set on the entry');
	assert.equal(entry.aiValue, 'Lending Fund');
	assert.equal(entry.aiValuePresent, true);
});

test('buildAiReviewFieldStateEntry: extractionRunId defaults to empty string when not provided', () => {
	const entry = buildAiReviewFieldStateEntry({}, { nextValue: 42 });
	assert.equal(entry.extractionRunId, '', 'extractionRunId should be empty string when absent');
});

test('normalizeReviewFieldStateEntry: preserves extractionRunId from stored entry', () => {
	const runId = 'a1b2c3d4-0000-0000-0000-000000000002';
	const normalized = normalizeReviewFieldStateEntry({
		aiValue: 'test',
		aiValuePresent: true,
		extractionRunId: runId
	});
	assert.equal(normalized.extractionRunId, runId, 'normalize should preserve extractionRunId');
});

test('normalizeReviewFieldStateEntry: extractionRunId defaults to empty string when absent', () => {
	const normalized = normalizeReviewFieldStateEntry({ aiValue: 'test', aiValuePresent: true });
	assert.equal(normalized.extractionRunId, '', 'missing extractionRunId should default to empty string');
});
