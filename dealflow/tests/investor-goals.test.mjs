import test from 'node:test';
import assert from 'node:assert/strict';

import {
	BRANCH_TO_GOAL_LABEL,
	capitalToRangeLabel,
	goalLabelForBranch,
	goalTypeForValue,
	normalizeGoalBranchValue,
	rangeLabelToCapital
} from '../src/lib/utils/investorGoals.js';

test('normalizeGoalBranchValue resolves labels, goal types, and branch aliases', () => {
	assert.equal(normalizeGoalBranchValue('Cash Flow (income now)'), 'cashflow');
	assert.equal(normalizeGoalBranchValue('build_wealth'), 'growth');
	assert.equal(normalizeGoalBranchValue('Tax Optimization (tax shield now)'), 'tax');
	assert.equal(normalizeGoalBranchValue('cash flow'), 'cashflow');
	assert.equal(normalizeGoalBranchValue(''), '');
});

test('goal helpers preserve canonical labels and types', () => {
	assert.equal(goalTypeForValue('Equity Growth (wealth later)'), 'build_wealth');
	assert.equal(goalTypeForValue('tax'), 'reduce_taxes');
	assert.equal(goalLabelForBranch('cashflow'), BRANCH_TO_GOAL_LABEL.cashflow);
	assert.equal(goalLabelForBranch('reduce_taxes'), BRANCH_TO_GOAL_LABEL.tax);
});

test('capital range helpers round-trip sandbox goal ranges', () => {
	assert.equal(rangeLabelToCapital('$250k-$1m'), 625000);
	assert.equal(rangeLabelToCapital('$500k - $999k'), 750000);
	assert.equal(capitalToRangeLabel(625000), '$500k - $999k');
	assert.equal(capitalToRangeLabel(2000000), '$1M+');
});
