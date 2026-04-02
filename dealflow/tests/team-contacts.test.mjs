import test from 'node:test';
import assert from 'node:assert/strict';

import {
	mergeSuggestedTeamContacts,
	normalizeTeamContact
} from '../src/lib/onboarding/teamContacts.js';

test('legacy investor-relations rows infer the IR assignment from the role text', () => {
	const contact = normalizeTeamContact({
		full_name: 'Michael Anderson',
		role: 'Investor Relations',
		email: 'info@example.com'
	});

	assert.equal(contact.firstName, 'Michael');
	assert.equal(contact.lastName, 'Anderson');
	assert.equal(contact.isInvestorRelations, true);
});

test('suggested operator details merge into an edited operator contact with the same name', () => {
	const existingContacts = [
		{
			id: 'operator-1',
			firstName: 'Michael',
			lastName: 'Anderson',
			email: 'test@test.com',
			phone: '480-889-6100',
			role: 'CEO',
			company: '',
			isPrimary: true,
			isInvestorRelations: false
		},
		{
			id: 'ir-1',
			firstName: 'Michael',
			lastName: 'Anderson',
			email: 'info@pascalwagner.com',
			phone: '',
			role: 'Investor Relations',
			company: '',
			isPrimary: false,
			isInvestorRelations: true
		}
	];

	const suggestedContacts = [
		{
			id: 'suggested-operator',
			firstName: 'Michael',
			lastName: 'Anderson',
			email: '',
			phone: '480-889-6100',
			role: 'CEO',
			company: 'Capital Fund',
			isPrimary: true,
			isInvestorRelations: false,
			sourceType: 'management_company'
		},
		{
			id: 'suggested-ir',
			firstName: 'Michael',
			lastName: 'Anderson',
			email: 'info@pascalwagner.com',
			phone: '',
			role: 'Investor Relations',
			company: 'Capital Fund',
			isPrimary: false,
			isInvestorRelations: true,
			sourceType: 'management_company'
		}
	];

	const result = mergeSuggestedTeamContacts(existingContacts, suggestedContacts);

	assert.equal(result.contacts.length, 2);

	const operator = result.contacts.find((contact) => contact.id === 'operator-1');
	const investorRelations = result.contacts.find((contact) => contact.id === 'ir-1');

	assert.equal(operator?.company, 'Capital Fund');
	assert.equal(operator?.email, 'test@test.com');
	assert.equal(operator?.isPrimary, true);
	assert.equal(operator?.isInvestorRelations, false);

	assert.equal(investorRelations?.company, 'Capital Fund');
	assert.equal(investorRelations?.email, 'info@pascalwagner.com');
	assert.equal(investorRelations?.isInvestorRelations, true);
});
