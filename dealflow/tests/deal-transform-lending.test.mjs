import test from 'node:test';
import assert from 'node:assert/strict';

import { transformDeals } from '../api/member/deals/transform.js';

test('single-deal transform preserves lending review fields needed by the review form', () => {
	const [deal] = transformDeals(
		[
			{
				id: '6706f492-1db4-4925-b562-9c5336217337',
				deal_number: 738,
				investment_name: 'Capital Fund 2',
				asset_class: 'Private Debt / Credit',
				deal_branch: 'lending_fund',
				deal_type: 'Fund',
				offering_type: '506(b)',
				status: 'Evergreen',
				available_to: 'Accredited Investors',
				investing_states: ['AZ', 'CO', 'TX'],
				underlying_exposure_types: ['Single Family', 'Commercial Real Estate'],
				investment_strategy: 'Short-term asset-backed bridge lending',
				short_summary: 'Variable-return lending fund backed by short-duration real estate loans.',
				hold_period_years: 1,
				redemption: 'Monthly',
				redemption_notes: '30-day written notice; paid from available capital.',
				distributions: 'Monthly',
				financials: 'Audited',
				lp_gp_split: 0.8,
				fees: 'Servicing fee: 5% of gross monthly income.',
				tax_form: 'K-1',
				additional_term_notes: 'No maximum offering amount disclosed in the 2021 PPM.',
				historical_return_2025: 0.0913,
				snapshot_as_of_date: '2025-09-01',
				fund_aum: 1000000000,
				current_fund_size: 630000000,
				offering_size: 630000000,
				loan_count: 2297,
				current_avg_loan_ltv: 0.66,
				max_allowed_ltv: 0.75,
				current_leverage: 0.52,
				max_allowed_leverage: 0.79,
				fund_founded_year: 2011,
				risk_tags: ['Leverage', 'Liquidity'],
				team_contacts: [{ first_name: 'Michael', last_name: 'Anderson' }],
				source_risk_factors: ['Liquidity is limited by available capital.'],
				highlighted_risks: ['Leverage'],
				management_company: {
					id: 'cad0d99d-675a-4abf-94be-c98902c915f0',
					operator_name: 'Capital Fund',
					website: 'https://capitalfund1.com',
					founding_year: 2009,
					authorized_emails: []
				}
			}
		],
		[],
		[]
	);

	assert.equal(deal.dealBranch, 'lending_fund');
	assert.equal(deal.deal_branch, 'lending_fund');
	assert.equal(deal.companyWebsite, 'https://capitalfund1.com');
	assert.deepEqual(deal.investingStates, ['AZ', 'CO', 'TX']);
	assert.deepEqual(deal.underlyingExposureTypes, ['Single Family', 'Commercial Real Estate']);
	assert.equal(deal.redemptionNotes, '30-day written notice; paid from available capital.');
	assert.equal(deal.taxForm, 'K-1');
	assert.equal(deal.additionalTermNotes, 'No maximum offering amount disclosed in the 2021 PPM.');
	assert.equal(deal.historicalReturn2025, 0.0913);
	assert.deepEqual(deal.riskTags, ['Leverage', 'Liquidity']);
	assert.equal(deal.teamContactsSnapshotSupported, true);
	assert.deepEqual(deal.teamContacts, [{ first_name: 'Michael', last_name: 'Anderson' }]);
	assert.deepEqual(deal.sourceRiskFactors, ['Liquidity is limited by available capital.']);
	assert.deepEqual(deal.highlightedRisks, ['Leverage']);
});

test('single-deal transform derives lending review values from legacy columns when newer columns are missing', () => {
	const [deal] = transformDeals(
		[
			{
				id: 'legacy-lending-deal',
				investment_name: 'Legacy Credit Fund',
				asset_class: 'Private Debt / Credit',
				deal_branch: 'lending_fund',
				deal_type: 'Fund',
				status: 'Evergreen',
				investing_geography: 'AZ, CO, TX, United States',
				investment_strategy: 'Single-family, multifamily, commercial, and land bridge lending strategy.',
				offering_size: 630000000,
				fund_aum: 960000000,
				avg_loan_ltv: 0.66,
				loan_to_value: 0.75,
				cash_yield: 0.0913,
				short_summary: 'Monthly redemption requests are handled from available capital.',
				tax_characteristics: 'The LLC is taxed as a partnership and K-1 is the best current fit.',
				key_dates: 'Fund formed January 3, 2011. Snapshot as of September 1, 2025.',
				highlighted_risks: ['Liquidity can be gated by available capital.', 'Leverage from credit facilities.'],
				risk_notes: 'Underwriting discipline and default/foreclosure outcomes matter.',
				management_company: {
					id: 'cad0d99d-675a-4abf-94be-c98902c915f0',
					operator_name: 'Capital Fund',
					website: 'https://capitalfund1.com',
					founding_year: 2009,
					authorized_emails: []
				}
			}
		],
		[],
		[]
	);

	assert.deepEqual(deal.investingStates, ['AZ', 'CO', 'TX']);
	assert.deepEqual(
		deal.underlyingExposureTypes,
		['Single Family', 'Commercial Real Estate', 'Multifamily', 'Land']
	);
	assert.equal(deal.redemption, 'Monthly');
	assert.equal(deal.taxForm, 'K-1');
	assert.equal(deal.currentFundSize, 630000000);
	assert.equal(deal.currentAvgLoanLtv, 0.66);
	assert.equal(deal.maxAllowedLtv, 0.75);
	assert.equal(deal.currentLeverage, 0.52);
	assert.equal(deal.maxAllowedLeverage, 3);
	assert.equal(deal.fundFoundedYear, 2011);
	assert.equal(deal.snapshotAsOfDate, '2025-09-01');
	assert.deepEqual(deal.riskTags, ['Leverage', 'Liquidity', 'Credit Loss', 'Underwriting']);
	assert.equal(deal.historicalReturn2025, 0.0913);
	assert.equal(deal.teamContactsSnapshotSupported, false);
});

test('single-deal transform infers investing states from spelled-out geography names', () => {
	const [deal] = transformDeals(
		[
			{
				id: 'legacy-lending-geography-text',
				investment_name: 'Capital Fund 2',
				asset_class: 'Private Debt / Credit',
				deal_branch: 'lending_fund',
				deal_type: 'Fund',
				status: 'Evergreen',
				investing_geography: 'Arizona, Colorado, Nevada, California, Oregon, Washington, Texas, United States',
				management_company: {
					id: 'cad0d99d-675a-4abf-94be-c98902c915f0',
					operator_name: 'Capital Fund',
					website: 'https://capitalfund1.com',
					founding_year: 2009,
					authorized_emails: []
				}
			}
		],
		[],
		[]
	);

	assert.deepEqual(deal.investingStates, ['AZ', 'CO', 'NV', 'CA', 'OR', 'WA', 'TX']);
});
