import test from 'node:test';
import assert from 'node:assert/strict';

import {
	applyReviewFieldStateToDeal,
	buildAdminReviewFieldStateEntry,
	buildAiReviewFieldStateEntry,
	clearAdminOverrideReviewFieldStateEntry,
	resolveFinalReviewFieldValue
} from '../src/lib/utils/reviewFieldState.js';
import { transformDeals } from '../api/member/deals/transform.js';

test('admin overrides become the final authoritative value', () => {
	const entry = buildAdminReviewFieldStateEntry(
		{
			aiValue: 50000,
			aiValuePresent: true
		},
		{
			nextValue: 60000,
			actor: {
				email: 'admin@example.com',
				name: 'Admin Reviewer'
			},
			at: '2026-04-03T12:00:00.000Z'
		}
	);

	assert.equal(entry.adminOverrideActive, true);
	assert.equal(entry.aiValue, 50000);
	assert.equal(entry.adminOverrideValue, 60000);
	assert.equal(resolveFinalReviewFieldValue(entry, null), 60000);
	assert.equal(entry.lastWriter, 'admin');
	assert.equal(entry.lastAction, 'admin_save');
	assert.equal(entry.adminActorEmail, 'admin@example.com');
});

test('AI updates are stored but blocked from overriding admin-edited fields by default', () => {
	const adminEntry = buildAdminReviewFieldStateEntry(
		{
			aiValue: '1% management fee.',
			aiValuePresent: true
		},
		{
			nextValue: '1.5% management fee.'
		}
	);
	const aiEntry = buildAiReviewFieldStateEntry(
		adminEntry,
		{
			nextValue: '2% management fee.',
			overwriteAdmin: false,
			at: '2026-04-03T12:05:00.000Z'
		}
	);

	assert.equal(aiEntry.aiValue, '2% management fee.');
	assert.equal(aiEntry.adminOverrideActive, true);
	assert.equal(aiEntry.adminOverrideValue, '1.5% management fee.');
	assert.equal(resolveFinalReviewFieldValue(aiEntry, null), '1.5% management fee.');
	assert.equal(aiEntry.lastAction, 'ai_update_blocked_by_admin');
});

test('forced AI overwrite clears the admin override and becomes final', () => {
	const adminEntry = buildAdminReviewFieldStateEntry(
		{
			aiValue: 12.4,
			aiValuePresent: true
		},
		{
			nextValue: 13.1
		}
	);
	const overwritten = buildAiReviewFieldStateEntry(
		adminEntry,
		{
			nextValue: 14.2,
			overwriteAdmin: true,
			at: '2026-04-03T12:10:00.000Z'
		}
	);

	assert.equal(overwritten.adminOverrideActive, false);
	assert.equal(overwritten.adminOverrideValue, null);
	assert.equal(resolveFinalReviewFieldValue(overwritten, null), 14.2);
	assert.equal(overwritten.lastAction, 'ai_overwrite_admin');
	assert.equal(overwritten.lastWriter, 'ai');
});

test('reset to extracted value restores the stored AI value as final', () => {
	const adminEntry = buildAdminReviewFieldStateEntry(
		{
			aiValue: 0.08,
			aiValuePresent: true
		},
		{
			nextValue: 0.1
		}
	);
	const reset = clearAdminOverrideReviewFieldStateEntry(
		adminEntry,
		{
			at: '2026-04-03T12:15:00.000Z'
		}
	);

	assert.equal(reset.adminOverrideActive, false);
	assert.equal(reset.adminOverrideValue, null);
	assert.equal(resolveFinalReviewFieldValue(reset, null), 0.08);
	assert.equal(reset.lastAction, 'reset_to_ai');
});

test('applyReviewFieldStateToDeal hydrates canonical and camelCase values from review field state', () => {
	const hydrated = applyReviewFieldStateToDeal({
		investment_minimum: 50000,
		fees: '1% management fee.',
		review_field_state: {
			investmentMinimum: buildAdminReviewFieldStateEntry(
				{
					aiValue: 50000,
					aiValuePresent: true
				},
				{
					nextValue: 60000
				}
			),
			fees: buildAiReviewFieldStateEntry(
				{},
				{
					nextValue: '2% management fee.',
					overwriteAdmin: false
				}
			)
		}
	});

	assert.equal(hydrated.investment_minimum, 60000);
	assert.equal(hydrated.investmentMinimum, 60000);
	assert.equal(hydrated.fees, '2% management fee.');
	assert.equal(hydrated.reviewFieldState.investmentMinimum.adminOverrideActive, true);
});

// ---------------------------------------------------------------------------
// End-to-end pipeline: applyReviewFieldStateToDeal + transformDeals
// Regression: /api/deals called transformDeals on raw DB rows without first
// calling applyReviewFieldStateToDeal, so admin overrides were invisible on
// the deal page even though deal review showed the correct value.
// ---------------------------------------------------------------------------

test('deal page pipeline: applyReviewFieldStateToDeal + transformDeals shows admin-overridden investmentMinimum', () => {
	const rawDbRow = {
		id: 'deal-abc',
		investment_name: 'DLP Lending Fund',
		investment_minimum: 100000,
		review_field_state: {
			investmentMinimum: buildAdminReviewFieldStateEntry(
				{ aiValue: 100000, aiValuePresent: true },
				{
					nextValue: 500000,
					actor: { email: 'admin@gyc.com', name: 'Admin' },
					at: '2026-04-04T00:00:00.000Z'
				}
			)
		}
	};

	const stateAwareRow = applyReviewFieldStateToDeal(rawDbRow);
	const [transformed] = transformDeals([stateAwareRow], [], []);

	assert.equal(
		transformed.investmentMinimum, 500000,
		'deal page must display the admin-overridden value ($500K), not the stale column value ($100K)'
	);
});

test('deal page pipeline: no admin override falls through to the column value', () => {
	const rawDbRow = {
		id: 'deal-xyz',
		investment_name: 'Some Fund',
		investment_minimum: 100000,
		review_field_state: {
			investmentMinimum: {
				aiValue: 100000,
				aiValuePresent: true,
				adminOverrideActive: false
			}
		}
	};

	const stateAwareRow = applyReviewFieldStateToDeal(rawDbRow);
	const [transformed] = transformDeals([stateAwareRow], [], []);

	assert.equal(transformed.investmentMinimum, 100000);
});

test('deal page pipeline: deal with no review_field_state renders column value unchanged', () => {
	const rawDbRow = {
		id: 'deal-xyz2',
		investment_name: 'Another Fund',
		investment_minimum: 250000,
		review_field_state: {}
	};

	const stateAwareRow = applyReviewFieldStateToDeal(rawDbRow);
	const [transformed] = transformDeals([stateAwareRow], [], []);

	assert.equal(transformed.investmentMinimum, 250000);
});

// ---------------------------------------------------------------------------
// SEC-sourced field override protection
// Regression: backfill_existing_value (April 3) wrote stale SEC values as
// adminOverrides. applyReviewFieldStateToDeal then applied those overrides on
// every load, silently winning over correct DB column values.
// totalInvestors and totalAmountSold must ALWAYS come from the DB column.
// ---------------------------------------------------------------------------

test('SEC field protection: totalInvestors override is ignored — DB column wins', () => {
	const deal = {
		id: 'deal-sec-1',
		total_investors: 281,
		review_field_state: {
			totalInvestors: buildAdminReviewFieldStateEntry(
				{ aiValue: 281, aiValuePresent: true },
				{
					nextValue: 999,
					actor: { email: 'system@gyc.com', name: 'system' },
					at: '2026-04-03T00:00:00.000Z'
				}
			)
		}
	};

	const result = applyReviewFieldStateToDeal(deal);
	assert.equal(
		result.total_investors, 281,
		'totalInvestors: DB column (281) must win over stale override (999)'
	);
	assert.equal(result.totalInvestors, 281);
});

test('SEC field protection: totalAmountSold override is ignored — DB column wins', () => {
	const deal = {
		id: 'deal-sec-2',
		total_amount_sold: 106564660,
		review_field_state: {
			totalAmountSold: buildAdminReviewFieldStateEntry(
				{ aiValue: 106564660, aiValuePresent: true },
				{
					nextValue: 1,
					actor: { email: 'system@gyc.com', name: 'system' },
					at: '2026-04-03T00:00:00.000Z'
				}
			)
		}
	};

	const result = applyReviewFieldStateToDeal(deal);
	assert.equal(
		result.total_amount_sold, 106564660,
		'totalAmountSold: DB column (106564660) must win over stale override (1)'
	);
	assert.equal(result.totalAmountSold, 106564660);
});

test('SEC field protection: investmentMinimum remains overridable', () => {
	const deal = {
		id: 'deal-sec-3',
		investment_minimum: 500000,
		review_field_state: {
			investmentMinimum: buildAdminReviewFieldStateEntry(
				{ aiValue: 500000, aiValuePresent: true },
				{
					nextValue: 250000,
					actor: { email: 'admin@gyc.com', name: 'Admin' },
					at: '2026-04-03T00:00:00.000Z'
				}
			)
		}
	};

	const result = applyReviewFieldStateToDeal(deal);
	assert.equal(
		result.investment_minimum, 250000,
		'investmentMinimum override (250000) must still apply — it is legitimately overridable'
	);
	assert.equal(result.investmentMinimum, 250000);
});

test('SEC field protection: non-SEC fields still apply admin overrides normally', () => {
	const deal = {
		id: 'deal-sec-4',
		target_irr: 0.09,
		review_field_state: {
			targetIRR: buildAdminReviewFieldStateEntry(
				{ aiValue: 0.09, aiValuePresent: true },
				{
					nextValue: 0.12,
					actor: { email: 'admin@gyc.com', name: 'Admin' },
					at: '2026-04-03T00:00:00.000Z'
				}
			)
		}
	};

	const result = applyReviewFieldStateToDeal(deal);
	assert.equal(
		result.target_irr, 0.12,
		'targetIRR override must apply — not a SEC-sourced field'
	);
	assert.equal(result.targetIRR, 0.12);
});
