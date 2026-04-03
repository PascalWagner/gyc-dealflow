import test from 'node:test';
import assert from 'node:assert/strict';

import {
	filterComparableDeals,
	getComparableDealScore,
	isComparableDealEligible
} from '../src/lib/utils/dealComparables.js';

test('comparable deals require a minimum level of structured comparison data', () => {
	const deals = [
		{
			id: 'strong',
			targetIRR: 0.11,
			preferredReturn: 0.08,
			equityMultiple: 1.6,
			investmentMinimum: 50000,
			holdPeriod: 5
		},
		{
			id: 'borderline',
			targetIRR: 0.1,
			investmentMinimum: 50000,
			holdPeriod: 5
		},
		{
			id: 'weak',
			targetIRR: 0.1,
			investmentMinimum: 50000
		}
	];

	assert.equal(getComparableDealScore(deals[0]), 5);
	assert.equal(isComparableDealEligible(deals[0]), true);
	assert.equal(getComparableDealScore(deals[1]), 3);
	assert.equal(isComparableDealEligible(deals[1]), true);
	assert.equal(getComparableDealScore(deals[2]), 2);
	assert.equal(isComparableDealEligible(deals[2]), false);
	assert.deepEqual(filterComparableDeals(deals), [deals[0], deals[1]]);
});
