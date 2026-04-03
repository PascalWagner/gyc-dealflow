import test from 'node:test';
import assert from 'node:assert/strict';

import {
	hasCompletedPlan,
	hasSavedInvestorProfile,
	normalizeWizardData
} from '../src/lib/onboarding/planWizard.js';

test('completed onboarding profile does not count as a completed full plan by itself', () => {
	const profileOnly = normalizeWizardData({
		_branch: 'cashflow',
		goal: 'Cash Flow (income now)',
		accreditation: ['net_worth'],
		dealExperience: 3,
		reProfessional: 'no',
		assetClasses: ['Private Debt / Credit'],
		strategies: ['Lending / Credit'],
		checkSize: '50000',
		_completedAt: '2026-04-03T13:32:30.253+00:00'
	});

	assert.equal(hasSavedInvestorProfile(profileOnly, null), true);
	assert.equal(hasCompletedPlan(profileOnly, null), false);
});

test('portfolio buckets still count as a completed plan', () => {
	const profileOnly = normalizeWizardData({
		_branch: 'cashflow',
		goal: 'Cash Flow (income now)',
		accreditation: ['net_worth'],
		dealExperience: 3,
		reProfessional: 'no',
		assetClasses: ['Private Debt / Credit'],
		strategies: ['Lending / Credit'],
		checkSize: '50000',
		_completedAt: '2026-04-03T13:32:30.253+00:00'
	});

	assert.equal(hasCompletedPlan(profileOnly, { buckets: [{ year: 1, assetClass: 'Private Debt / Credit' }] }), true);
});
