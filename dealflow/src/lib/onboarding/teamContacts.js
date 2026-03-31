const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const TEAM_CONTACT_ROLE_OPTIONS = [
	'Founder / Managing Partner',
	'Investor Relations',
	'Capital Raising',
	'Acquisitions',
	'Asset Management',
	'Operations',
	'Finance',
	'Legal / Compliance',
	'Marketing',
	'Other'
];

export function splitFullName(value = '') {
	const parts = String(value || '')
		.trim()
		.split(/\s+/)
		.filter(Boolean);

	return {
		firstName: parts[0] || '',
		lastName: parts.slice(1).join(' ')
	};
}

export function teamContactFullName(contact = {}) {
	return [String(contact.firstName || '').trim(), String(contact.lastName || '').trim()]
		.filter(Boolean)
		.join(' ')
		.trim();
}

export function createEmptyTeamContact(overrides = {}) {
	return {
		id: '',
		firstName: '',
		lastName: '',
		email: '',
		phone: '',
		role: '',
		linkedinUrl: '',
		isPrimary: false,
		isInvestorRelations: false,
		calendarUrl: '',
		...overrides
	};
}

export function normalizeTeamContact(contact = {}, index = 0) {
	return {
		id: String(contact.id || '').trim(),
		firstName: String(contact.firstName || contact.first_name || '').trim(),
		lastName: String(contact.lastName || contact.last_name || '').trim(),
		email: String(contact.email || '').trim().toLowerCase(),
		phone: String(contact.phone || '').trim(),
		role: String(contact.role || '').trim(),
		linkedinUrl: String(contact.linkedinUrl || contact.linkedin_url || '').trim(),
		isPrimary: contact.isPrimary === true || contact.is_primary === true || index === 0,
		isInvestorRelations:
			contact.isInvestorRelations === true ||
			contact.is_investor_relations === true ||
			false,
		calendarUrl: String(contact.calendarUrl || contact.calendar_url || '').trim()
	};
}

export function normalizeTeamContacts(contacts = [], { fallbackContact = null, ensureOne = true } = {}) {
	const source = Array.isArray(contacts) ? contacts : [];
	const normalized = source
		.map((contact, index) => normalizeTeamContact(contact, index))
		.filter((contact) =>
			Object.values(contact).some((value) => {
				if (typeof value === 'boolean') return value;
				return String(value || '').trim().length > 0;
			})
		);

	if (normalized.length === 0 && fallbackContact) {
		normalized.push(normalizeTeamContact(fallbackContact, 0));
	}

	if (normalized.length === 0 && ensureOne) {
		return [createEmptyTeamContact({ isPrimary: true, isInvestorRelations: true })];
	}

	const primaryIndex = normalized.findIndex((contact) => contact.isPrimary === true);
	const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : 0;
	return normalized.map((contact, index) => ({
		...contact,
		isPrimary: index === resolvedPrimaryIndex
	}));
}

export function pickPrimaryTeamContact(contacts = []) {
	const normalized = normalizeTeamContacts(contacts, { ensureOne: false });
	return normalized.find((contact) => contact.isPrimary) || normalized[0] || null;
}

export function pickInvestorRelationsContact(contacts = []) {
	const normalized = normalizeTeamContacts(contacts, { ensureOne: false });
	return normalized.find((contact) => contact.isInvestorRelations) || pickPrimaryTeamContact(normalized);
}

function isValidUrl(value, { requireLinkedIn = false } = {}) {
	if (!String(value || '').trim()) return true;

	try {
		const url = new URL(value);
		if (!['http:', 'https:'].includes(url.protocol)) return false;
		if (requireLinkedIn && !url.hostname.toLowerCase().includes('linkedin.com')) return false;
		return true;
	} catch {
		return false;
	}
}

function hasMeaningfulContactValues(contact = {}) {
	return [
		contact.firstName,
		contact.lastName,
		contact.email,
		contact.phone,
		contact.role,
		contact.linkedinUrl,
		contact.calendarUrl
	]
		.map((value) => String(value || '').trim())
		.some(Boolean);
}

export function validateTeamContacts(contacts = []) {
	const normalized = normalizeTeamContacts(contacts, { ensureOne: false });
	const errors = normalized.map(() => ({}));

	if (normalized.length === 0) {
		return {
			valid: false,
			contacts: [],
			errors: [],
			formError: 'Add at least one team contact.'
		};
	}

	let hasFilledContact = false;

	for (const [index, contact] of normalized.entries()) {
		const nextErrors = {};
		const hasValues = hasMeaningfulContactValues(contact);
		if (!hasValues) {
			errors[index] = nextErrors;
			continue;
		}

		hasFilledContact = true;

		if (!contact.firstName) nextErrors.firstName = 'First name is required.';
		if (!contact.lastName) nextErrors.lastName = 'Last name is required.';
		if (!EMAIL_PATTERN.test(contact.email)) nextErrors.email = 'Enter a valid email address.';
		if (contact.linkedinUrl && !isValidUrl(contact.linkedinUrl, { requireLinkedIn: true })) {
			nextErrors.linkedinUrl = 'Enter a valid LinkedIn URL.';
		}
		if (contact.calendarUrl && !isValidUrl(contact.calendarUrl)) {
			nextErrors.calendarUrl = 'Enter a valid calendar URL.';
		}

		errors[index] = nextErrors;
	}

	if (!hasFilledContact) {
		return {
			valid: false,
			contacts: normalized,
			errors,
			formError: 'Add at least one team contact.'
		};
	}

	if (!normalized.some((contact) => contact.isPrimary && EMAIL_PATTERN.test(contact.email))) {
		return {
			valid: false,
			contacts: normalized,
			errors,
			formError: 'Choose one valid primary contact.'
		};
	}

	if (!normalized.some((contact) => contact.isInvestorRelations && EMAIL_PATTERN.test(contact.email))) {
		return {
			valid: false,
			contacts: normalized,
			errors,
			formError: 'Mark at least one investor-relations contact.'
		};
	}

	return {
		valid: errors.every((entry) => Object.keys(entry).length === 0),
		contacts: normalized,
		errors,
		formError: errors.some((entry) => Object.keys(entry).length > 0)
			? 'Fix the highlighted contact fields.'
			: ''
	};
}

export function buildFallbackTeamContacts({ company = null, user = null } = {}) {
	const contacts = [];
	const companyName = String(company?.ir_contact_name || company?.ceo || '').trim();
	const companyEmail = String(company?.ir_contact_email || '').trim().toLowerCase();
	const companyLinkedin = String(company?.linkedin_url || company?.linkedin_ceo || '').trim();
	const calendarUrl = String(company?.booking_url || company?.calendar_url || '').trim();

	if (companyName || companyEmail || companyLinkedin || calendarUrl) {
		const split = splitFullName(companyName);
		contacts.push(createEmptyTeamContact({
			firstName: split.firstName,
			lastName: split.lastName,
			email: companyEmail,
			role: company?.ir_contact_name || company?.ir_contact_email ? 'Investor Relations' : '',
			linkedinUrl: companyLinkedin,
			isPrimary: true,
			isInvestorRelations: Boolean(company?.ir_contact_name || company?.ir_contact_email || calendarUrl),
			calendarUrl
		}));
	}

	if (contacts.length === 0 && user?.email) {
		const split = splitFullName(user?.name || user?.fullName || '');
		contacts.push(createEmptyTeamContact({
			firstName: split.firstName,
			lastName: split.lastName,
			email: String(user.email || '').trim().toLowerCase(),
			role: 'Investor Relations',
			isPrimary: true,
			isInvestorRelations: true
		}));
	}

	return normalizeTeamContacts(contacts, { ensureOne: true });
}

export function deriveLegacyCompanyContactFields(contacts = []) {
	const primaryContact = pickPrimaryTeamContact(contacts);
	const irContact = pickInvestorRelationsContact(contacts) || primaryContact;

	return {
		primaryContact,
		irContact,
		irContactName: teamContactFullName(irContact),
		irContactEmail: String(irContact?.email || '').trim().toLowerCase(),
		bookingUrl: String(irContact?.calendarUrl || primaryContact?.calendarUrl || '').trim()
	};
}

export function serializeTeamContactsForApi(contacts = []) {
	return normalizeTeamContacts(contacts, { ensureOne: false }).map((contact) => ({
		id: contact.id || undefined,
		firstName: contact.firstName,
		lastName: contact.lastName,
		email: contact.email,
		phone: contact.phone,
		role: contact.role,
		linkedinUrl: contact.linkedinUrl,
		isPrimary: contact.isPrimary,
		isInvestorRelations: contact.isInvestorRelations,
		calendarUrl: contact.calendarUrl
	}));
}
