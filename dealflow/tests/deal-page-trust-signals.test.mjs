import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDealCashFlowProjection } from '../src/lib/utils/dealCashFlowProjection.js';
import { getDealStateCodes as getInvestingStateCodes } from '../src/lib/utils/investing-geography.js';
import { getDealStateCodes as getDetailStateCodes } from '../src/lib/utils/dealDetailSignals.js';

test('deal geography helpers trust explicit investing states before the geography string suffix', () => {
	const deal = {
		investingStates: ['AZ', 'CO', 'TX'],
		investingGeography: 'AZ, CO, TX, United States'
	};

	assert.deepEqual(getInvestingStateCodes(deal), ['AZ', 'CO', 'TX']);
	assert.deepEqual(getDetailStateCodes(deal), ['AZ', 'CO', 'TX']);
});

test('deal geography helpers do not expand to nationwide when explicit states are listed with United States', () => {
	const deal = {
		investing_geography: 'Arizona, Colorado, Texas, United States'
	};

	assert.deepEqual(getInvestingStateCodes(deal), ['AZ', 'CO', 'TX']);
	assert.deepEqual(getDetailStateCodes(deal), ['AZ', 'CO', 'TX']);
});

test('lending cash flow projection does not use target IRR as a fake yield basis', () => {
	const projection = buildDealCashFlowProjection({
		assetClass: 'Private Debt / Credit',
		dealType: 'Fund',
		targetIRR: 0.14,
		investmentMinimum: 50000,
		holdPeriod: 1
	});

	assert.equal(projection.available, false);
	assert.equal(projection.reason, 'missing_explicit_yield');
});

test('lending cash flow projection honors an explicit hold period even when the offering is evergreen', () => {
	const projection = buildDealCashFlowProjection({
		assetClass: 'Private Debt / Credit',
		dealType: 'Fund',
		cashYield: 0.12,
		investmentMinimum: 50000,
		holdPeriod: 1,
		offeringStatus: 'Evergreen'
	});

	assert.equal(projection.available, true);
	assert.equal(projection.holdYears, 1);
	assert.equal(projection.rows.length, 1);
	assert.equal(projection.rows[0].capReturn, 0);
});

test('evergreen lending cash flow projection stays hidden without an explicit projection horizon', () => {
	const projection = buildDealCashFlowProjection({
		assetClass: 'Private Debt / Credit',
		dealType: 'Fund',
		cashYield: 0.12,
		investmentMinimum: 50000,
		offeringStatus: 'Evergreen'
	});

	assert.equal(projection.available, false);
	assert.equal(projection.reason, 'missing_hold_period');
});
