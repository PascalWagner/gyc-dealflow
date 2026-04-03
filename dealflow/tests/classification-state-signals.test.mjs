import test from 'node:test';
import assert from 'node:assert/strict';

import {
	buildDocumentInvestingStateSignals
} from '../src/lib/utils/investing-geography.js';
import {
	buildDealReviewPayload,
	buildDealReviewCompletenessModel,
	createDealReviewFormFromDeal,
	normalizeDealReviewPatch
} from '../src/lib/utils/dealReviewSchema.js';

function assertCloseTo(actual, expected, epsilon = 1e-9) {
	assert.ok(Math.abs(actual - expected) <= epsilon, `expected ${actual} to be within ${epsilon} of ${expected}`);
}

test('document geography signals merge PPM and deck states into a stable union', () => {
	const ppmText = `
		The Company focuses on Arizona, Colorado, Nevada, California, Oregon, Washington, and Texas.
	`;
	const deckText = `
		Current core markets include Arizona, Colorado, Texas, Tennessee, Georgia, and Utah.
		Future core markets include North Carolina and Alabama.
	`;

	const signals = buildDocumentInvestingStateSignals({ ppmText, deckText });

	assert.deepEqual(signals.ppmStates, ['AZ', 'CO', 'NV', 'CA', 'OR', 'WA', 'TX']);
	assert.deepEqual(signals.deckStates, ['AZ', 'CO', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']);
	assert.deepEqual(signals.suggestedStates, ['AZ', 'CO', 'NV', 'CA', 'OR', 'WA', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']);
});

test('document geography signals ignore incidental state mentions outside lending-footprint context', () => {
	const ppmText = `
		Capital Fund II, LLC is an Arizona limited liability company.
		The Company intends to make loans across the United States, with a primary focus in Arizona, Colorado, Nevada, California, Oregon, Washington, and Texas.
		A corporation, Massachusetts or similar business trust, partnership, or limited liability company may subscribe.
		Mike was born in Illinois and moved to Arizona when he was very young.
	`;
	const deckText = `
		Arizona\tColorado\tTexas
		Tennessee\tGeorgia\tUtah
		Principal Balance Breakdown by State

		Current core markets
		Future core markets
		NORTH
		CAROLINA
		In 2022, North Carolina received a record $19B in investments.
		LEGEND
		* Sources: 2022 Alabama Economic Development Impact Report; South Carolina Department of Commerce Press Release.
		JANUARY 2024
		TEXAS (2021)
		#3 by market share
		(9.2024 - 8.2025)
		ALABAMA
		In 2022, Alabama received a record $10.1B in investments.
	`;

	const signals = buildDocumentInvestingStateSignals({ ppmText, deckText });

	assert.deepEqual(signals.ppmStates, ['AZ', 'CO', 'NV', 'CA', 'OR', 'WA', 'TX']);
	assert.deepEqual(signals.deckStates, ['AZ', 'CO', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']);
	assert.deepEqual(signals.suggestedStates, ['AZ', 'CO', 'NV', 'CA', 'OR', 'WA', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']);
});

test('document geography signals recover state names when PDF extraction glues section headings onto them', () => {
	const deckText = `
		Arizona Colorado Texas
		Tennessee Georgia UtahPORTFOLIO CONSTRUCTION
		Principal Balance Breakdown by State
		Current core markets Future core markets
		NORTH CAROLINA In 2022, North Carolina received a record $19B in investments.
		Opportunity * Sources: 2022 Alabama Economic Development Impact Report; South Carolina Department of Commerce Press Release.
		ALABAMA In 2022, Alabama received a record $10.1B in investments.
	`;

	const signals = buildDocumentInvestingStateSignals({ ppmText: '', deckText });

	assert.deepEqual(signals.deckStates, ['AZ', 'CO', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']);
	assert.deepEqual(signals.suggestedStates, ['AZ', 'CO', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']);
});

test('deal review form hydrates 506(b) and investing states from legacy compliance/geography fields', () => {
	const { form } = createDealReviewFormFromDeal({
		is_506b: true,
		investing_geography: 'AZ, CO, NV, CA, OR, WA, TX, United States'
	});

	assert.equal(form.offeringType, '506(b)');
	assert.deepEqual(form.investingStates, ['AZ', 'CO', 'NV', 'CA', 'OR', 'WA', 'TX']);
});

test('classification payload syncs 506(b) into is506b when offering type is saved', () => {
	const { payload, errors } = buildDealReviewPayload(
		{
			offeringType: '506(b)'
		},
		{
			includeFieldKeys: ['offeringType']
		}
	);

	assert.deepEqual(errors, {});
	assert.equal(payload.offeringType, '506(b)');
	assert.equal(payload.is506b, true);
});

test('classification payload persists selected investing states through geography for older schemas', () => {
	const { payload, errors } = buildDealReviewPayload(
		{
			investingStates: ['AZ', 'CO', 'NV', 'CA', 'OR', 'WA', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']
		},
		{
			includeFieldKeys: ['investingStates']
		}
	);

	assert.deepEqual(errors, {});
	assert.deepEqual(payload.investingStates, ['AZ', 'CO', 'NV', 'CA', 'OR', 'WA', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']);
	assert.equal(payload.investingGeography, 'AZ, CO, NV, CA, OR, WA, TX, TN, GA, UT, NC, AL, United States');
});

test('unrelated stage saves do not clear offering type compliance fields', () => {
	const { payload, errors } = buildDealReviewPayload(
		{
			offeringType: '506(b)',
			fees: 'Management fee: 1%'
		},
		{
			includeFieldKeys: ['fees']
		}
	);

	assert.deepEqual(errors, {});
	assert.equal(payload.fees, 'Management fee: 1%');
	assert.equal('offeringType' in payload, false);
	assert.equal('is506b' in payload, false);
});

test('normalized review patches keep 506(b) available from legacy booleans', () => {
	const { values, errors } = normalizeDealReviewPatch({
		is_506b: true
	});

	assert.deepEqual(errors, {});
	assert.equal(values.offeringType, '506(b)');
	assert.equal(values.is506b, true);
});

test('normalized review patches derive geography from selected states when no direct geography is provided', () => {
	const { values, errors } = normalizeDealReviewPatch({
		investingStates: ['AZ', 'CO', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']
	});

	assert.deepEqual(errors, {});
	assert.deepEqual(values.investingStates, ['AZ', 'CO', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL']);
	assert.equal(values.investingGeography, 'AZ, CO, TX, TN, GA, UT, NC, AL, United States');
});

test('historical return payload saves percent-point values without scaling them down', () => {
	const { payload, errors } = buildDealReviewPayload(
		{
			historicalReturn2024: '11.11',
			targetIRR: '11.11'
		},
		{
			includeFieldKeys: ['historicalReturn2024', 'targetIRR']
		}
	);

	assert.deepEqual(errors, {});
	assert.equal(payload.historicalReturn2024, 11.11);
	assertCloseTo(payload.targetIRR, 0.1111);
});

test('normalized review patches keep historical returns in percent points', () => {
	const { values, errors } = normalizeDealReviewPatch({
		historicalReturn2024: '11.11',
		preferredReturn: '11.11'
	});

	assert.deepEqual(errors, {});
	assert.equal(values.historicalReturn2024, 11.11);
	assertCloseTo(values.preferredReturn, 0.1111);
});

test('deal review completeness model preserves historical return percent-point values', () => {
	const completeness = buildDealReviewCompletenessModel(
		{
			investmentName: 'Example Deal',
			historicalReturn2024: '11.11',
			targetIRR: '11.11'
		},
		{}
	);

	assert.equal(completeness.historicalReturn2024, 11.11);
	assertCloseTo(completeness.targetIRR, 0.1111);
});
