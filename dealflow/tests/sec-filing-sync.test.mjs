import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDealUpdatesFromSecFiling } from '../api/_sec-edgar.js';

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
