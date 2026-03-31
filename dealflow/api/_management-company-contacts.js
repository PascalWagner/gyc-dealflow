import {
	buildFallbackTeamContacts,
	deriveLegacyCompanyContactFields,
	normalizeTeamContacts,
	validateTeamContacts
} from '../src/lib/onboarding/teamContacts.js';

const CONTACT_SELECT = `
	id,
	management_company_id,
	first_name,
	last_name,
	email,
	phone,
	role,
	linkedin_url,
	is_primary,
	is_investor_relations,
	calendar_url,
	display_order,
	created_at,
	updated_at
`;

function isMissingContactsTable(error) {
	const message = String(error?.message || '').toLowerCase();
	return error?.code === '42P01' || message.includes('management_company_contacts');
}

function toDatabaseRows(managementCompanyId, contacts) {
	return contacts.map((contact, index) => ({
		management_company_id: managementCompanyId,
		first_name: contact.firstName,
		last_name: contact.lastName,
		email: contact.email,
		phone: contact.phone || null,
		role: contact.role || null,
		linkedin_url: contact.linkedinUrl || null,
		is_primary: contact.isPrimary === true,
		is_investor_relations: contact.isInvestorRelations === true,
		calendar_url: contact.calendarUrl || null,
		display_order: index
	}));
}

async function updateLegacyCompanyFields(supabase, { managementCompanyId, contacts }) {
	const legacyFields = deriveLegacyCompanyContactFields(contacts);
	const { error } = await supabase
		.from('management_companies')
		.update({
			ir_contact_name: legacyFields.irContactName,
			ir_contact_email: legacyFields.irContactEmail,
			booking_url: legacyFields.bookingUrl || null
		})
		.eq('id', managementCompanyId);

	if (error) throw error;
	return legacyFields;
}

export async function loadManagementCompanyTeamContacts(
	supabase,
	{ managementCompanyId, company = null, user = null } = {}
) {
	const fallbackContacts = buildFallbackTeamContacts({ company, user });
	if (!managementCompanyId) return { contacts: fallbackContacts, storageMode: 'legacy' };

	const { data, error } = await supabase
		.from('management_company_contacts')
		.select(CONTACT_SELECT)
		.eq('management_company_id', managementCompanyId)
		.order('display_order', { ascending: true })
		.order('created_at', { ascending: true });

	if (error) {
		if (isMissingContactsTable(error)) {
			return { contacts: fallbackContacts, storageMode: 'legacy' };
		}
		throw error;
	}

	const normalized = normalizeTeamContacts(data || [], {
		fallbackContact: fallbackContacts[0] || null,
		ensureOne: true
	});

	return {
		contacts: normalized,
		storageMode: data?.length ? 'table' : 'legacy'
	};
}

export async function saveManagementCompanyTeamContacts(
	supabase,
	{ managementCompanyId, contacts = [] } = {}
) {
	if (!managementCompanyId) {
		throw new Error('Management company is required before saving team contacts.');
	}

	const validation = validateTeamContacts(contacts);
	if (!validation.valid) {
		const error = new Error(validation.formError || 'Invalid team contacts.');
		error.validation = validation;
		throw error;
	}

	const normalizedContacts = normalizeTeamContacts(validation.contacts, { ensureOne: false });
	const legacyFields = await updateLegacyCompanyFields(supabase, {
		managementCompanyId,
		contacts: normalizedContacts
	});

	const { error: deleteError } = await supabase
		.from('management_company_contacts')
		.delete()
		.eq('management_company_id', managementCompanyId);

	if (deleteError) {
		if (isMissingContactsTable(deleteError)) {
			return {
				contacts: normalizedContacts,
				legacyFields,
				storageMode: 'legacy'
			};
		}
		throw deleteError;
	}

	const rows = toDatabaseRows(managementCompanyId, normalizedContacts);
	if (rows.length === 0) {
		return {
			contacts: normalizedContacts,
			legacyFields,
			storageMode: 'table'
		};
	}

	const { error: insertError } = await supabase
		.from('management_company_contacts')
		.insert(rows);

	if (insertError) {
		if (isMissingContactsTable(insertError)) {
			return {
				contacts: normalizedContacts,
				legacyFields,
				storageMode: 'legacy'
			};
		}
		throw insertError;
	}

	return {
		contacts: normalizedContacts,
		legacyFields,
		storageMode: 'table'
	};
}
