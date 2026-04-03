import test from 'node:test';
import assert from 'node:assert/strict';

import {
	filterComparableDeals,
	getComparableMetricConfig,
	getComparableMetricValue,
	isComparableDealEligible
} from '../src/lib/utils/dealComparables.js';

test('equity comparable config preserves the classic investor metrics', () => {
	const deal = {
		assetClass: 'Multifamily',
		dealType: 'Syndication'
	};

	const metrics = getComparableMetricConfig(deal);

	assert.deepEqual(
		metrics.map((metric) => metric.label),
		['Target IRR', 'Pref Return', 'Eq Multiple', 'Minimum', 'Hold Period']
	);
});

test('lending comparable config swaps in income-oriented comparison fields', () => {
	const deal = {
		assetClass: 'Private Debt / Credit',
		dealType: 'Fund',
		strategy: 'lending'
	};

	const metrics = getComparableMetricConfig(deal);

	assert.deepEqual(
		metrics.map((metric) => metric.label),
		['Target Yield', 'Distributions', 'Minimum', 'Lockup', 'Manager AUM']
	);
});

test('lending comparable eligibility does not require equity-only metrics', () => {
	const referenceDeal = {
		assetClass: 'Private Debt / Credit',
		dealType: 'Fund',
		strategy: 'lending'
	};

	const eligibleDeal = {
		targetIRR: 0.095,
		distributions: 'Monthly',
		investmentMinimum: 50000,
		holdPeriod: 1
	};

	const ineligibleDeal = {
		targetIRR: 0.095,
		investmentMinimum: 50000
	};

	assert.equal(isComparableDealEligible(eligibleDeal, referenceDeal), true);
	assert.equal(isComparableDealEligible(ineligibleDeal, referenceDeal), false);
	assert.equal(
		getComparableMetricValue(
			{ fundAUM: 125000000 },
			getComparableMetricConfig(referenceDeal)[4]
		),
		125000000
	);
});

test('filterComparableDeals removes weak equity comparables', () => {
	const referenceDeal = {
		assetClass: 'Multifamily',
		dealType: 'Syndication'
	};

	const comparables = [
		{
			id: 'strong-equity',
			targetIRR: 0.17,
			preferredReturn: 0.08,
			equityMultiple: 2.1,
			investmentMinimum: 50000,
			holdPeriod: 5
		},
		{
			id: 'weak-equity',
			targetIRR: 0.16,
			investmentMinimum: 50000
		}
	];

	assert.deepEqual(
		filterComparableDeals(comparables, referenceDeal).map((deal) => deal.id),
		['strong-equity']
	);
});
