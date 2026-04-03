import test from 'node:test';
import assert from 'node:assert/strict';

import {
	applyReviewFieldStateToDeal,
	buildAdminReviewFieldStateEntry,
	buildAiReviewFieldStateEntry,
	clearAdminOverrideReviewFieldStateEntry,
	resolveFinalReviewFieldValue
} from '../src/lib/utils/reviewFieldState.js';

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
