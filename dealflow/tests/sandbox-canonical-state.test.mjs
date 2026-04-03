import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildCanonicalBuyBoxFromContact,
	buildCanonicalDealBackfill,
	buildCanonicalGoalsFromContact
} from '../scripts/lib/sandbox-canonical-state.mjs';

const contactFixture = {
	tags: ['wizard-complete'],
	dateUpdated: '2026-04-03T12:00:00.000Z',
	customFieldsHydrated: [
		{ fieldKey: 'contact.primary_investment_objective', value: 'Cash Flow (income now)' },
		{ fieldKey: 'contact.current_passive_income', value: '12000' },
		{ fieldKey: 'contact.target_passive_income', value: '50000' },
		{ fieldKey: 'contact.capital_12_month', value: '$250k-$499k' },
		{ fieldKey: 'contact.investment_timeline', value: '30days' },
		{ fieldKey: 'contact.tax_offset_target', value: '0' },
		{ fieldKey: 'contact.networth', value: '2500000' },
		{ fieldKey: 'contact.asset_class_preference', value: ['Multi-Family', 'Self Storage'] },
		{ fieldKey: 'contact.lockup_period_tolerance', value: '3' },
		{ fieldKey: 'contact.strategy_preference', value: ['Lending', 'Buy & Hold'] },
		{ fieldKey: 'contact.distribution_frequency_options', value: ['Quarterly'] },
		{ fieldKey: 'contact.accreditation_type', value: ['net_worth', 'income'] },
		{ fieldKey: 'contact.onboarding_branch', value: '' },
		{ fieldKey: 'contact.current_passive_income', value: '12000' },
		{ fieldKey: 'contact.target_passive_income', value: '50000' },
		{ fieldKey: 'contact.lp_deals_count', value: '7' }
	]
};

const dealFixture = {
	id: '6706f492-1db4-4925-b562-9c5336217337',
	investment_name: 'Capital Fund 2',
	deal_branch: 'lending_fund',
	lifecycle_status: 'approved',
	management_company: {
		founding_year: 2013,
		website: 'https://capitalfund1.com'
	},
	fund_aum: 960000000,
	loan_count: 2297,
	avg_loan_ltv: 0.66,
	loan_to_value: 0.75,
	offering_size: 75000000,
	highlighted_risks: ['Leverage', 'Liquidity', 'Credit Loss'],
	source_risk_factors: ['Redemptions are paid from available capital.']
};

test('buildCanonicalGoalsFromContact maps hydrated GHL fields into canonical goals state', () => {
	const goals = buildCanonicalGoalsFromContact(contactFixture);
	assert.deepEqual(goals, {
		goal_type: 'passive_income',
		current_income: 12000,
		target_income: 50000,
		capital_available: 375000,
		timeline: '30days',
		tax_reduction: 0
	});
});

test('buildCanonicalGoalsFromContact preserves a goal-only seed without inventing numeric values', () => {
	const goals = buildCanonicalGoalsFromContact({
		customFieldsHydrated: [
			{ fieldKey: 'contact.primary_investment_objective', value: 'Cash Flow (income now)' }
		]
	});

	assert.deepEqual(goals, {
		goal_type: 'passive_income',
		current_income: null,
		target_income: null,
		capital_available: null,
		timeline: '',
		tax_reduction: null
	});
});

test('buildCanonicalBuyBoxFromContact maps hydrated GHL fields into canonical buy box state', () => {
	const buyBox = buildCanonicalBuyBoxFromContact(contactFixture);
	assert.equal(buyBox.goal, 'Cash Flow (income now)');
	assert.equal(buyBox.branch, 'cashflow');
	assert.equal(buyBox._completedAt, '2026-04-03T12:00:00.000Z');
	assert.deepEqual(buyBox.assetClasses, ['Multi-Family', 'Self Storage']);
	assert.equal(buyBox.dealExperience, 7);
});

test('buildCanonicalDealBackfill derives legacy lending compatibility fields', () => {
	const deal = buildCanonicalDealBackfill(dealFixture);
	assert.equal(deal.lifecycleStatus, 'approved');
	assert.equal(deal.legacyApprovedReviewCompat, true);
	assert.equal(deal.currentAvgLoanLtv, 0.66);
	assert.equal(deal.maxAllowedLtv, 0.75);
	assert.ok(Array.isArray(deal.riskTags));
	assert.equal(deal.riskTags[0], 'Leverage');
});
