import test from 'node:test';
import assert from 'node:assert/strict';

import { pickDealReviewInitialTeamContacts } from '../src/lib/onboarding/teamContacts.js';

test('deal review preserves a persisted deal snapshot over sponsor defaults', () => {
	const result = pickDealReviewInitialTeamContacts({
		dealContacts: [
			{
				id: 'deal-1',
				firstName: 'Dana',
				lastName: 'Snapshot',
				email: 'dana.snapshot@example.com',
				role: 'Investor Relations',
				isInvestorRelations: true
			}
		],
		companyContacts: [
			{
				id: 'company-1',
				firstName: 'Chris',
				lastName: 'Company',
				email: 'chris.company@example.com',
				role: 'CEO',
				isPrimary: true
			}
		]
	});

	assert.equal(result[0]?.email, 'dana.snapshot@example.com');
});

test('deal review falls back to sponsor contacts when no deal snapshot exists', () => {
	const result = pickDealReviewInitialTeamContacts({
		dealContacts: [],
		companyContacts: [
			{
				id: 'company-1',
				firstName: 'Chris',
				lastName: 'Company',
				email: 'chris.company@example.com',
				role: 'CEO',
				isPrimary: true
			}
		]
	});

	assert.equal(result[0]?.email, 'chris.company@example.com');
});

