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

test('evergreen lending fund with short holdPeriod defaults to 5-year projection', () => {
	const projection = buildDealCashFlowProjection({
		assetClass: 'Private Debt / Credit',
		dealType: 'Fund',
		cashYield: 0.12,
		investmentMinimum: 50000,
		holdPeriod: 1,
		offeringStatus: 'Evergreen'
	});

	assert.equal(projection.available, true);
	assert.equal(projection.holdYears, 5);
	assert.equal(projection.rows.length, 5);
});

test('evergreen lending fund with no holdPeriod defaults to 5-year projection', () => {
	const projection = buildDealCashFlowProjection({
		assetClass: 'Private Debt / Credit',
		dealType: 'Fund',
		cashYield: 0.12,
		investmentMinimum: 50000,
		offeringStatus: 'Evergreen'
	});

	assert.equal(projection.available, true);
	assert.equal(projection.holdYears, 5);
	assert.equal(projection.rows.length, 5);
});

// ---------------------------------------------------------------------------
// buildSecFilingSummary — Latest Filing field
// ---------------------------------------------------------------------------

import { buildSecFilingSummary } from '../src/lib/utils/dealDetailSignals.js';

test('buildSecFilingSummary includes latestFilingDate from secLatestFilingDate', () => {
	const result = buildSecFilingSummary({
		secCik: '1622059',
		dateOfFirstSale: '2014-10-06',
		secLatestFilingDate: '2026-03-02',
		totalAmountSold: 628887587,
		totalInvestors: 1503
	});
	assert.equal(result.latestFilingDate, '2026-03-02');
	assert.equal(result.firstSaleDate, '2014-10-06');
	assert.equal(result.totalRaised, 628887587);
	assert.equal(result.totalInvestors, 1503);
	assert.equal(result.hasFiling, true);
});

test('buildSecFilingSummary latestFilingDate is null when secLatestFilingDate absent', () => {
	const result = buildSecFilingSummary({
		secCik: '1622059',
		totalAmountSold: 100000
	});
	assert.equal(result.latestFilingDate, null);
	assert.equal(result.hasFiling, true);
});

test('buildSecFilingSummary latestFilingDate differs from firstSaleDate for multi-amendment deals', () => {
	const result = buildSecFilingSummary({
		secCik: '1622059',
		dateOfFirstSale: '2014-10-06',
		secLatestFilingDate: '2026-03-02'
	});
	assert.notEqual(result.latestFilingDate, result.firstSaleDate);
	assert.equal(result.latestFilingDate, '2026-03-02');
	assert.equal(result.firstSaleDate, '2014-10-06');
});

test('buildSecFilingSummary returns null for null deal', () => {
	assert.equal(buildSecFilingSummary(null), null);
});
