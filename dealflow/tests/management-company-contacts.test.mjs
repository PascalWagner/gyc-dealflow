import assert from 'node:assert/strict';
import test from 'node:test';

import { loadManagementCompanyTeamContacts } from '../api/_management-company-contacts.js';

function createQuery(result, { resolveOnOrderCall = null } = {}) {
	let orderCalls = 0;

	return {
		select() {
			return this;
		},
		eq() {
			return this;
		},
		order() {
			orderCalls += 1;
			if (resolveOnOrderCall !== null && orderCalls >= resolveOnOrderCall) {
				return Promise.resolve(result);
			}
			return this;
		},
		single() {
			return Promise.resolve(result);
		}
	};
}

function createSupabase({ contactsResult, snapshotResult }) {
	return {
		from(table) {
			if (table === 'management_company_contacts') {
				return createQuery(contactsResult, { resolveOnOrderCall: 2 });
			}
			if (table === 'management_companies') {
				return createQuery(snapshotResult);
			}
			throw new Error(`Unexpected table requested in test: ${table}`);
		}
	};
}

const fallbackCompany = {
	operator_name: 'Atlas Capital',
	ceo: 'Jane Doe',
	linkedin_ceo: 'https://linkedin.com/in/jane-doe',
	ir_contact_name: 'Alex Investor',
	ir_contact_email: 'alex@atlascapital.test',
	booking_url: 'https://cal.com/atlas-capital'
};

test('empty persisted snapshot stays empty instead of rebuilding legacy fallback contacts', async () => {
	const supabase = createSupabase({
		contactsResult: { data: [], error: null },
		snapshotResult: { data: { team_contacts: [] }, error: null }
	});

	const result = await loadManagementCompanyTeamContacts(supabase, {
		managementCompanyId: 'management-company-1',
		company: fallbackCompany
	});

	assert.equal(result.storageMode, 'snapshot');
	assert.deepEqual(result.contacts, []);
});

test('snapshot-only environments keep an empty snapshot authoritative when the contacts table is unavailable', async () => {
	const supabase = createSupabase({
		contactsResult: {
			data: null,
			error: { code: '42P01', message: 'relation "management_company_contacts" does not exist' }
		},
		snapshotResult: { data: { team_contacts: [] }, error: null }
	});

	const result = await loadManagementCompanyTeamContacts(supabase, {
		managementCompanyId: 'management-company-2',
		company: fallbackCompany
	});

	assert.equal(result.storageMode, 'snapshot');
	assert.deepEqual(result.contacts, []);
});

test('legacy fallback still hydrates contacts when snapshot storage is unavailable', async () => {
	const supabase = createSupabase({
		contactsResult: { data: [], error: null },
		snapshotResult: {
			data: null,
			error: { code: '42703', message: 'column management_companies.team_contacts does not exist' }
		}
	});

	const result = await loadManagementCompanyTeamContacts(supabase, {
		managementCompanyId: 'management-company-3',
		company: fallbackCompany
	});

	assert.equal(result.storageMode, 'legacy');
	assert.equal(result.contacts.length, 2);
	assert.equal(result.contacts[0].firstName, 'Jane');
	assert.equal(result.contacts[0].isPrimary, true);
	assert.equal(result.contacts[1].email, 'alex@atlascapital.test');
	assert.equal(result.contacts[1].isInvestorRelations, true);
});
