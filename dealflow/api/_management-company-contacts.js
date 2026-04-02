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

const LEGACY_CONTACT_SELECT = `
	id,
	management_company_id,
	full_name,
	email,
	phone,
	role,
	linkedin,
	is_primary,
	created_at,
	updated_at
`;

function isMissingContactsTable(error) {
	const message = String(error?.message || '').toLowerCase();
	return error?.code === '42P01' || message.includes('relation "management_company_contacts" does not exist');
}

function isMissingSnapshotColumn(error) {
	const message = String(error?.message || '').toLowerCase();
	return error?.code === '42703' || message.includes('team_contacts');
}

function isMissingContactsColumn(error, columnName = '') {
	const message = String(error?.message || '').toLowerCase();
	const normalizedColumnName = String(columnName || '').trim().toLowerCase();
	return error?.code === '42703'
		|| error?.code === 'PGRST204'
		|| (normalizedColumnName && message.includes(normalizedColumnName));
}

function toDatabaseRows(managementCompanyId, contacts, { legacy = false } = {}) {
	if (legacy) {
		return contacts.map((contact) => ({
			management_company_id: managementCompanyId,
			full_name: [contact.firstName, contact.lastName].filter(Boolean).join(' ').trim(),
			email: contact.email,
			phone: contact.phone || null,
			role: contact.role || null,
			linkedin: contact.linkedinUrl || null,
			is_primary: contact.isPrimary === true
		}));
	}

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

async function loadCompanySnapshotContacts(supabase, managementCompanyId, fallbackContacts = []) {
	const { data: companySnapshot, error: snapshotError } = await supabase
		.from('management_companies')
		.select('team_contacts')
		.eq('id', managementCompanyId)
		.single();

	if (snapshotError) {
		if (isMissingSnapshotColumn(snapshotError)) {
			return normalizeTeamContacts(fallbackContacts, {
				fallbackContact: fallbackContacts[0] || null,
				ensureOne: true
			});
		}
		throw snapshotError;
	}

	return normalizeTeamContacts(companySnapshot?.team_contacts || fallbackContacts, {
		fallbackContact: fallbackContacts[0] || null,
		ensureOne: true
	});
}

async function updateLegacyCompanyFields(supabase, { managementCompanyId, contacts }) {
	const legacyFields = deriveLegacyCompanyContactFields(contacts);
	let existingCompany = null;
	let snapshotColumnAvailable = true;

	let existingCompanyQuery = await supabase
		.from('management_companies')
		.select('ceo, linkedin_ceo, ir_contact_name, ir_contact_email, booking_url, team_contacts')
		.eq('id', managementCompanyId)
		.single();

	if (isMissingSnapshotColumn(existingCompanyQuery.error)) {
		snapshotColumnAvailable = false;
		existingCompanyQuery = await supabase
			.from('management_companies')
			.select('ceo, linkedin_ceo, ir_contact_name, ir_contact_email, booking_url')
			.eq('id', managementCompanyId)
			.single();
	}

	existingCompany = existingCompanyQuery.data;
	const existingCompanyError = existingCompanyQuery.error;

	if (existingCompanyError) throw existingCompanyError;

	const updates = {
		ceo: legacyFields.ceoName || existingCompany?.ceo || '',
		linkedin_ceo: legacyFields.ceoLinkedin || existingCompany?.linkedin_ceo || '',
		ir_contact_name: legacyFields.irContactName || existingCompany?.ir_contact_name || '',
		ir_contact_email: legacyFields.irContactEmail || existingCompany?.ir_contact_email || '',
		booking_url: legacyFields.bookingUrl || existingCompany?.booking_url || null
	};
	if (snapshotColumnAvailable) {
		updates.team_contacts = contacts;
	}

	const { error } = await supabase
		.from('management_companies')
		.update(updates)
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

	let legacyTableMode = false;
	let query = supabase
		.from('management_company_contacts')
		.select(CONTACT_SELECT)
		.eq('management_company_id', managementCompanyId)
		.order('display_order', { ascending: true })
		.order('created_at', { ascending: true });

	let { data, error } = await query;

	if (error) {
		if (isMissingContactsTable(error)) {
			const snapshotContacts = await loadCompanySnapshotContacts(supabase, managementCompanyId, fallbackContacts);
			return { contacts: snapshotContacts, storageMode: 'legacy' };
		}
		if (
			isMissingContactsColumn(error, 'first_name')
			|| isMissingContactsColumn(error, 'last_name')
			|| isMissingContactsColumn(error, 'linkedin_url')
			|| isMissingContactsColumn(error, 'is_investor_relations')
			|| isMissingContactsColumn(error, 'calendar_url')
			|| isMissingContactsColumn(error, 'display_order')
		) {
			legacyTableMode = true;
			({ data, error } = await supabase
				.from('management_company_contacts')
				.select(LEGACY_CONTACT_SELECT)
				.eq('management_company_id', managementCompanyId)
				.order('created_at', { ascending: true }));
			if (error) throw error;
		} else {
			throw error;
		}
	}

	if (!data?.length) {
		const snapshotContacts = await loadCompanySnapshotContacts(supabase, managementCompanyId, fallbackContacts);
		if (snapshotContacts.length > 0) {
			return {
				contacts: snapshotContacts,
				storageMode: 'snapshot'
			};
		}
	}

	const normalized = normalizeTeamContacts(data || [], {
		fallbackContact: fallbackContacts[0] || null,
		ensureOne: true
	});

	return {
		contacts: normalized,
		storageMode: data?.length ? (legacyTableMode ? 'table-legacy' : 'table') : 'legacy'
	};
}

export async function saveManagementCompanyTeamContacts(
	supabase,
	{ managementCompanyId, contacts = [], mode = 'save' } = {}
) {
	if (!managementCompanyId) {
		throw new Error('Management company is required before saving team contacts.');
	}

	const validation = validateTeamContacts(contacts, { mode });
	if (!validation.valid) {
		const error = new Error(validation.formError || 'Invalid team contacts.');
		error.validation = validation;
		throw error;
	}

	const normalizedContacts = normalizeTeamContacts(validation.contacts, { ensureOne: false, preserveEmpty: false });
	console.info('[management-company-contacts] save', {
		managementCompanyId,
		mode,
		contactsReceived: Array.isArray(contacts) ? contacts.length : 0,
		contactsPersisted: normalizedContacts.length
	});
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

	let rows = toDatabaseRows(managementCompanyId, normalizedContacts);
	if (rows.length === 0) {
		return {
			contacts: normalizedContacts,
			legacyFields,
			storageMode: 'table'
		};
	}

	let insertLegacyTableMode = false;
	let { error: insertError } = await supabase
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
		if (
			isMissingContactsColumn(insertError, 'first_name')
			|| isMissingContactsColumn(insertError, 'last_name')
			|| isMissingContactsColumn(insertError, 'linkedin_url')
			|| isMissingContactsColumn(insertError, 'is_investor_relations')
			|| isMissingContactsColumn(insertError, 'calendar_url')
			|| isMissingContactsColumn(insertError, 'display_order')
		) {
			insertLegacyTableMode = true;
			rows = toDatabaseRows(managementCompanyId, normalizedContacts, { legacy: true });
			({ error: insertError } = await supabase
				.from('management_company_contacts')
				.insert(rows));
			if (insertError) throw insertError;
		} else {
			throw insertError;
		}
	}

	return {
		contacts: normalizedContacts,
		legacyFields,
		storageMode: insertLegacyTableMode ? 'table-legacy' : 'table'
	};
}
