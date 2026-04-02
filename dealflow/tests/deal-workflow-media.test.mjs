import test from 'node:test';
import assert from 'node:assert/strict';

import { computeDealCompleteness } from '../src/lib/utils/dealWorkflow.js';
import { evaluateDealOnboardingPublishRules } from '../src/lib/utils/dealOnboardingFlow.js';

const lendingFundSource = {
	investmentName: 'Capital Fund 2',
	sponsor: 'Capital Fund',
	assetClass: 'Private Debt / Credit',
	dealType: 'Fund',
	offeringType: '506(b)',
	offeringStatus: 'Evergreen',
	availableTo: 'Accredited Investors',
	investmentMinimum: 50000,
	shortSummary: 'Variable-return lending fund backed by short-duration real estate loans.',
	investmentStrategy: 'Short-term bridge lending strategy across residential and commercial collateral.',
	cashYield: 0.0913,
	riskNotes: 'Borrower defaults and collateral-value declines can reduce distributions.',
	deckUrl: 'https://example.com/deck.pdf',
	primarySourceContext: 'Primary diligence sources are the deck, the PPM, and the matched SEC filing.',
	financials: 'Audited',
	distributions: 'Monthly',
	redemption: 'Monthly',
	slug: 'capital-fund-2'
};

test('lending-fund completeness does not treat missing uploaded cover art as a blocking issue when the lending hero can render', () => {
	const completeness = computeDealCompleteness(lendingFundSource);

	assert.equal(completeness.hasBlockingIssues, false);
	assert.ok(!completeness.missingRequiredFields.includes('Cover image or hero media'));
});

test('lending-fund onboarding publish rules accept the built-in lending hero as satisfying the media requirement', () => {
	const rules = evaluateDealOnboardingPublishRules(lendingFundSource, { branch: 'lending_fund' });
	const mediaRule = rules.find((rule) => rule.id === 'media_required');

	assert.ok(mediaRule);
	assert.equal(mediaRule.satisfied, true);
});
