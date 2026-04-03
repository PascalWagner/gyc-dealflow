import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCanonicalGoalsFromGhlContact } from '../api/userdata/ghl.js';

test('buildCanonicalGoalsFromGhlContact preserves goal-only contacts without inventing numbers', () => {
	const goals = buildCanonicalGoalsFromGhlContact({
		customFieldsHydrated: [
			{ fieldKey: 'contact.primary_investment_objective', value: 'Cash Flow (income now)' }
		]
	}, { userId: 'user-123' });

	assert.deepEqual(goals, {
		user_id: 'user-123',
		goal_type: 'passive_income',
		current_income: null,
		target_income: null,
		capital_available: null,
		timeline: '',
		tax_reduction: null
	});
});
