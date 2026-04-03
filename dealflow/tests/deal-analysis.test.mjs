import test from 'node:test';
import assert from 'node:assert/strict';

import { buildSponsorSummary } from '../src/lib/utils/dealAnalysis.js';

test('buildSponsorSummary reads the sponsor full-cycle metric from either canonical field name', () => {
	const exitSummary = buildSponsorSummary({
		managementCompany: 'Capital Fund',
		mcFoundingYear: 2011,
		fundAUM: 1000000000,
		mcFullCycleExits: 3
	});

	const dealSummary = buildSponsorSummary({
		managementCompany: 'Capital Fund',
		mcFoundingYear: 2011,
		fundAUM: 1000000000,
		mcFullCycleDeals: 3
	});

	assert.match(exitSummary, /3 full-cycle exits/);
	assert.match(dealSummary, /3 full-cycle exits/);
});

test('buildSponsorSummary returns an honest empty state when sponsor data is sparse', () => {
	assert.equal(buildSponsorSummary(null), 'No sponsor data available.');
	assert.equal(buildSponsorSummary({}), 'Sponsor details have not been structured yet.');
	assert.equal(
		buildSponsorSummary({ managementCompany: 'Capital Fund' }),
		'Capital Fund'
	);
});
