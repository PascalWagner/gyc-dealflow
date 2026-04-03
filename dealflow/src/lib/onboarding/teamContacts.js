const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTO_FILL_CONFIDENCE_THRESHOLD = 0.72;
const OPERATOR_ROLE_PATTERN = /founder|chief executive officer|ceo|president|managing partner|principal|managing director|partner/i;
const INVESTOR_RELATIONS_ROLE_PATTERN = /investor relations|investor contact|capital formation|capital raising/i;
let teamContactCounter = 0;

export const TEAM_CONTACT_ROLE_OPTIONS = [
	'Founder / Managing Partner',
	'CEO',
	'President',
	'Managing Partner',
	'Principal',
	'Investor Relations',
	'Capital Formation',
	'Capital Raising',
	'Acquisitions',
	'Asset Management',
	'Operations',
	'Finance',
	'Legal / Compliance',
	'Marketing',
	'Other'
];

export function createTeamContactId(prefix = 'team-contact') {
	teamContactCounter += 1;
	return `${prefix}-${Date.now().toString(36)}-${teamContactCounter.toString(36)}`;
}

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
		id: createTeamContactId(),
		firstName: '',
		lastName: '',
		email: '',
		phone: '',
		role: '',
		company: '',
		linkedinUrl: '',
		isPrimary: false,
		isInvestorRelations: false,
		calendarUrl: '',
		confidence: null,
		sourceType: '',
		sourceDocumentId: '',
		matchReason: '',
		isSuggested: false,
		isUserEdited: false,
		displayOrder: 0,
		...overrides
	};
}

export function normalizeTeamContact(contact = {}, index = 0) {
	const splitName = splitFullName(contact.fullName || contact.full_name || '');
	const normalizedFirstName = String(contact.firstName || contact.first_name || '').trim() || splitName.firstName;
	const normalizedLastName = String(contact.lastName || contact.last_name || '').trim() || splitName.lastName;
	const normalizedRole = String(contact.role || contact.title || '').trim();
	return {
		id: String(contact.id || contact.clientId || '').trim() || createTeamContactId(),
		firstName: normalizedFirstName,
		lastName: normalizedLastName,
		email: String(contact.email || '').trim().toLowerCase(),
		phone: String(contact.phone || '').trim(),
		role: normalizedRole,
		company: String(contact.company || contact.company_name || '').trim(),
		linkedinUrl: String(contact.linkedinUrl || contact.linkedin_url || contact.linkedin || '').trim(),
		isPrimary: contact.isPrimary === true || contact.is_primary === true,
		isInvestorRelations:
			contact.isInvestorRelations === true ||
			contact.is_investor_relations === true ||
			INVESTOR_RELATIONS_ROLE_PATTERN.test(normalizedRole) ||
			false,
		calendarUrl: String(contact.calendarUrl || contact.calendar_url || '').trim(),
		confidence:
			typeof contact.confidence === 'number'
				? contact.confidence
				: Number.isFinite(Number(contact.confidence))
					? Number(contact.confidence)
					: null,
		sourceType: String(contact.sourceType || contact.source_type || '').trim(),
		sourceDocumentId: String(contact.sourceDocumentId || contact.source_document_id || '').trim(),
		matchReason: String(contact.matchReason || contact.match_reason || '').trim(),
		isSuggested: contact.isSuggested === true || contact.is_suggested === true,
		isUserEdited: contact.isUserEdited === true || contact.is_user_edited === true,
		displayOrder: Number.isFinite(Number(contact.displayOrder ?? contact.display_order))
			? Number(contact.displayOrder ?? contact.display_order)
			: index
	};
}

export function hasMeaningfulContactValues(contact = {}) {
	return [
		contact.firstName,
		contact.lastName,
		contact.email,
		contact.phone,
		contact.role,
		contact.company,
		contact.linkedinUrl,
		contact.calendarUrl
	]
		.map((value) => String(value || '').trim())
		.some(Boolean);
}

function hasValidEmailValue(value = '') {
	return EMAIL_PATTERN.test(String(value || '').trim().toLowerCase());
}

function hasPhoneValue(value = '') {
	return String(value || '').trim().length > 0;
}

function hasDirectOperatorChannel(contact = {}) {
	return hasValidEmailValue(contact.email) || hasPhoneValue(contact.phone);
}

function operatorRoleScore(contact = {}) {
	if (!hasMeaningfulContactValues(contact) && !contact.isPrimary) return Number.NEGATIVE_INFINITY;

	const role = String(contact.role || '').trim().toLowerCase();
	let score = 0;
	if (contact.isPrimary) score += 4;
	if (OPERATOR_ROLE_PATTERN.test(role)) score += 5;
	if (hasValidEmailValue(contact.email)) score += 1.5;
	if (hasPhoneValue(contact.phone)) score += 1.25;
	if (contact.linkedinUrl) score += 0.25;
	if (contact.isInvestorRelations && !contact.isPrimary) score -= 0.75;
	return score;
}

function investorRelationsRoleScore(contact = {}) {
	if (!hasMeaningfulContactValues(contact) && !contact.isInvestorRelations) return Number.NEGATIVE_INFINITY;

	const role = String(contact.role || '').trim().toLowerCase();
	let score = 0;
	if (contact.isInvestorRelations) score += 4;
	if (INVESTOR_RELATIONS_ROLE_PATTERN.test(role)) score += 5;
	if (hasValidEmailValue(contact.email)) score += 2.5;
	if (hasPhoneValue(contact.phone)) score += 0.25;
	if (contact.calendarUrl) score += 0.75;
	if (contact.isPrimary && !contact.isInvestorRelations) score -= 0.5;
	return score;
}

function sortContactsByScore(contacts = [], scorer = () => 0) {
	return [...contacts]
		.map((contact) => ({
			contact,
			score: scorer(contact)
		}))
		.sort((left, right) => right.score - left.score);
}

function selectBestRoleAssignments(contacts = []) {
	const normalized = normalizeTeamContacts(contacts, { ensureOne: false, preserveEmpty: true });
	if (normalized.length === 0) {
		return {
			operatorLead: null,
			investorRelations: null
		};
	}

	const currentOperator = normalized.find((contact) => contact.isPrimary) || null;
	const currentInvestorRelations = normalized.find((contact) => contact.isInvestorRelations) || null;

	let operatorLead = currentOperator;
	const currentOperatorLooksIntentional = Boolean(
		currentOperator && (
			hasDirectOperatorChannel(currentOperator) ||
			OPERATOR_ROLE_PATTERN.test(String(currentOperator.role || '').trim().toLowerCase())
		)
	);
	if (!currentOperatorLooksIntentional) {
		operatorLead = sortContactsByScore(normalized, operatorRoleScore)[0]?.contact || currentOperator || normalized[0];
	}
	if (!operatorLead) operatorLead = normalized[0];

	const otherContacts = normalized.filter((contact) => contact.id !== operatorLead?.id);
	const irCandidates = sortContactsByScore(otherContacts, investorRelationsRoleScore);
	const allIrCandidates = sortContactsByScore(normalized, investorRelationsRoleScore);

	let investorRelations = currentInvestorRelations;
	const currentInvestorRelationsIsUsable = Boolean(
		currentInvestorRelations && hasValidEmailValue(currentInvestorRelations.email)
	);
	if (!currentInvestorRelationsIsUsable) {
		investorRelations =
			irCandidates.find((entry) => hasValidEmailValue(entry.contact.email))?.contact
			|| allIrCandidates.find((entry) => hasValidEmailValue(entry.contact.email))?.contact
			|| irCandidates[0]?.contact
			|| currentInvestorRelations
			|| operatorLead;
	}
	if (!investorRelations) investorRelations = operatorLead;

	return {
		operatorLead,
		investorRelations
	};
}

export function normalizeTeamContacts(
	contacts = [],
	{ fallbackContact = null, ensureOne = true, preserveEmpty = false } = {}
) {
	const source = Array.isArray(contacts) ? contacts : [];
	const normalized = source
		.map((contact, index) => normalizeTeamContact(contact, index))
		.filter((contact) => preserveEmpty || hasMeaningfulContactValues(contact) || contact.isPrimary || contact.isInvestorRelations);

	if (normalized.length === 0 && fallbackContact) {
		normalized.push(normalizeTeamContact(fallbackContact, 0));
	}

	if (normalized.length === 0 && ensureOne) {
		return [createEmptyTeamContact({ isPrimary: true })];
	}

	const primaryIndex = normalized.findIndex((contact) => contact.isPrimary === true);
	const resolvedPrimaryIndex = primaryIndex >= 0 ? primaryIndex : (ensureOne && normalized.length > 0 ? 0 : -1);
	return normalized.map((contact, index) => ({
		...contact,
		isPrimary: resolvedPrimaryIndex >= 0 ? index === resolvedPrimaryIndex : false
	}));
}

export function pickPrimaryTeamContact(contacts = []) {
	const selection = selectBestRoleAssignments(contacts);
	if (selection.operatorLead) return selection.operatorLead;
	const normalized = normalizeTeamContacts(contacts, { ensureOne: false, preserveEmpty: false });
	return normalized[0] || null;
}

export function pickInvestorRelationsContact(contacts = []) {
	const selection = selectBestRoleAssignments(contacts);
	return selection.investorRelations || selection.operatorLead || null;
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

export function deriveTeamRoleAssignments(contacts = []) {
	const normalized = rebalanceTeamRoleAssignments(contacts, { preserveEmpty: true });
	const operatorLead = normalized.find((contact) => contact.isPrimary) || null;
	const investorRelations = normalized.find((contact) => contact.isInvestorRelations) || null;
	const assignedIds = new Set(
		[operatorLead?.id, investorRelations?.id]
			.map((value) => String(value || '').trim())
			.filter(Boolean)
	);

	return {
		operatorLead,
		investorRelations,
		samePersonHandlesBothRoles: Boolean(operatorLead?.id && operatorLead.id === investorRelations?.id),
		additionalContacts: normalized.filter((contact) => !assignedIds.has(contact.id))
	};
}

export function rebalanceTeamRoleAssignments(
	contacts = [],
	{ preserveEmpty = true } = {}
) {
	const normalized = normalizeTeamContacts(contacts, { ensureOne: false, preserveEmpty });
	const { operatorLead, investorRelations } = selectBestRoleAssignments(normalized);

	return normalized.map((contact) => ({
		...contact,
		isPrimary: Boolean(operatorLead?.id) && contact.id === operatorLead.id,
		isInvestorRelations: Boolean(investorRelations?.id) && contact.id === investorRelations.id
	}));
}

export function validateTeamContacts(contacts = [], { mode = 'continue' } = {}) {
	const normalized = rebalanceTeamRoleAssignments(contacts, { preserveEmpty: true });
	const errors = normalized.map(() => ({}));
	const filledContacts = normalized.filter((contact) => hasMeaningfulContactValues(contact));
	const strictMode = mode === 'continue';

	if (filledContacts.length === 0 && strictMode) {
		return {
			valid: false,
			contacts: filledContacts,
			errors,
			formError: 'Add at least one team contact.'
		};
	}

	for (const [index, contact] of normalized.entries()) {
		const nextErrors = {};
		const hasValues = hasMeaningfulContactValues(contact);
		if (!hasValues) {
			errors[index] = nextErrors;
			continue;
		}
		if (strictMode) {
			if (!contact.firstName) nextErrors.firstName = 'First name is required.';
			if (!contact.lastName) nextErrors.lastName = 'Last name is required.';
			if (contact.email && !hasValidEmailValue(contact.email)) {
				nextErrors.email = 'Enter a valid email address.';
			}
			if (contact.isInvestorRelations && !hasValidEmailValue(contact.email)) {
				nextErrors.email = 'Enter a valid email address.';
			}
		} else if (contact.email && !hasValidEmailValue(contact.email)) {
			nextErrors.email = 'Enter a valid email address.';
		}
		if (contact.linkedinUrl && !isValidUrl(contact.linkedinUrl, { requireLinkedIn: true })) {
			nextErrors.linkedinUrl = 'Enter a valid LinkedIn URL.';
		}
		if (contact.calendarUrl && !isValidUrl(contact.calendarUrl)) {
			nextErrors.calendarUrl = 'Enter a valid calendar URL.';
		}

		errors[index] = nextErrors;
	}

	if (strictMode && !filledContacts.some((contact) => contact.isPrimary && hasDirectOperatorChannel(contact))) {
		return {
			valid: false,
			contacts: filledContacts,
			errors,
			formError: 'Assign a reachable CEO / operator lead contact.'
		};
	}

	if (strictMode && !filledContacts.some((contact) => contact.isInvestorRelations && hasValidEmailValue(contact.email))) {
		return {
			valid: false,
			contacts: filledContacts,
			errors,
			formError: 'Assign a valid investor relations contact.'
		};
	}

	return {
		valid: strictMode
			? errors.every((entry) => Object.keys(entry).length === 0) && filledContacts.length > 0
			: errors.every((entry) => Object.keys(entry).length === 0),
		contacts: filledContacts,
		errors,
		formError: strictMode && errors.some((entry) => Object.keys(entry).length > 0)
			? 'Fix the highlighted contact fields.'
			: ''
	};
}

export function buildFallbackTeamContacts({ company = null, user = null, includeUserFallback = true } = {}) {
	const contacts = [];
	const ceoName = String(company?.ceo || '').trim();
	const companyLinkedin = String(company?.linkedin_url || company?.linkedin_ceo || '').trim();
	const irName = String(company?.ir_contact_name || '').trim();
	const irEmail = String(company?.ir_contact_email || '').trim().toLowerCase();
	const calendarUrl = String(company?.booking_url || company?.calendar_url || '').trim();

	if (ceoName || companyLinkedin) {
		const split = splitFullName(ceoName);
		contacts.push(createEmptyTeamContact({
			firstName: split.firstName,
			lastName: split.lastName,
			role: 'CEO',
			company: String(company?.operator_name || '').trim(),
			linkedinUrl: companyLinkedin,
			isPrimary: true
		}));
	}

	if (irName || irEmail || calendarUrl) {
		const split = splitFullName(irName);
		contacts.push(createEmptyTeamContact({
			firstName: split.firstName,
			lastName: split.lastName,
			email: irEmail,
			role: 'Investor Relations',
			company: String(company?.operator_name || '').trim(),
			isPrimary: contacts.length === 0,
			isInvestorRelations: true,
			calendarUrl
		}));
	}

	if (contacts.length === 0 && includeUserFallback && user?.email) {
		const split = splitFullName(user?.name || user?.fullName || '');
		contacts.push(createEmptyTeamContact({
			firstName: split.firstName,
			lastName: split.lastName,
			email: String(user.email || '').trim().toLowerCase(),
			role: 'Investor Relations',
			company: '',
			isPrimary: true,
			isInvestorRelations: true
		}));
	}

	return normalizeTeamContacts(contacts, { ensureOne: false, preserveEmpty: false });
}

export function deriveLegacyCompanyContactFields(contacts = []) {
	const primaryContact = pickPrimaryTeamContact(contacts);
	const irContact = pickInvestorRelationsContact(contacts) || primaryContact;

	return {
		primaryContact,
		irContact,
		ceoName: teamContactFullName(primaryContact),
		ceoLinkedin: String(primaryContact?.linkedinUrl || '').trim(),
		irContactName: teamContactFullName(irContact),
		irContactEmail: String(irContact?.email || '').trim().toLowerCase(),
		bookingUrl: String(irContact?.calendarUrl || primaryContact?.calendarUrl || '').trim()
	};
}

export function pickDealReviewInitialTeamContacts({ dealContacts = [], companyContacts = [] } = {}) {
	const normalizedDealContacts = normalizeTeamContacts(dealContacts, {
		ensureOne: false,
		preserveEmpty: true
	});
	const normalizedCompanyContacts = normalizeTeamContacts(companyContacts, {
		ensureOne: false,
		preserveEmpty: true
	});
	const persistedDealContacts = normalizeTeamContacts(dealContacts, {
		ensureOne: false,
		preserveEmpty: false
	});
	const persistedCompanyContacts = normalizeTeamContacts(companyContacts, {
		ensureOne: false,
		preserveEmpty: false
	});

	if (persistedDealContacts.length > 0) return normalizedDealContacts;
	if (persistedCompanyContacts.length > 0) return normalizedCompanyContacts;
	return normalizedDealContacts.length > 0 ? normalizedDealContacts : normalizedCompanyContacts;
}

export function serializeTeamContactsForApi(contacts = []) {
	return rebalanceTeamRoleAssignments(contacts, { preserveEmpty: false }).map((contact) => ({
		id: contact.id || undefined,
		firstName: contact.firstName,
		lastName: contact.lastName,
		email: contact.email,
		phone: contact.phone,
		role: contact.role,
		company: contact.company,
		linkedinUrl: contact.linkedinUrl,
		isPrimary: contact.isPrimary,
		isInvestorRelations: contact.isInvestorRelations,
		calendarUrl: contact.calendarUrl,
		confidence: contact.confidence,
		sourceType: contact.sourceType,
		sourceDocumentId: contact.sourceDocumentId,
		matchReason: contact.matchReason,
		isSuggested: contact.isSuggested,
		isUserEdited: contact.isUserEdited
	}));
}

function normalizeNameKey(value = '') {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ');
}

function getContactNameKey(contact = {}) {
	return normalizeNameKey(teamContactFullName(contact));
}

function getContactMatchKey(contact = {}) {
	const email = String(contact.email || '').trim().toLowerCase();
	if (email) return `email:${email}`;
	const name = getContactNameKey(contact);
	return name ? `name:${name}` : '';
}

function getContactRoleBucket(contact = {}) {
	const role = String(contact.role || '').trim().toLowerCase();
	if (contact.isInvestorRelations || INVESTOR_RELATIONS_ROLE_PATTERN.test(role)) return 'ir';
	if (contact.isPrimary || OPERATOR_ROLE_PATTERN.test(role)) return 'operator';
	return role || '';
}

function scoreNameMatch(existingContact = {}, candidateContact = {}) {
	let score = 0;
	if (candidateContact.isPrimary === existingContact.isPrimary) score += 4;
	if (candidateContact.isInvestorRelations === existingContact.isInvestorRelations) score += 4;

	const existingRoleBucket = getContactRoleBucket(existingContact);
	const candidateRoleBucket = getContactRoleBucket(candidateContact);
	if (existingRoleBucket && candidateRoleBucket && existingRoleBucket === candidateRoleBucket) {
		score += 3;
	}

	const existingRole = String(existingContact.role || '').trim().toLowerCase();
	const candidateRole = String(candidateContact.role || '').trim().toLowerCase();
	if (existingRole && candidateRole && existingRole === candidateRole) {
		score += 2;
	}

	const existingPhone = String(existingContact.phone || '').trim();
	const candidatePhone = String(candidateContact.phone || '').trim();
	if (existingPhone && candidatePhone && existingPhone === candidatePhone) {
		score += 1;
	}

	return score;
}

export function mergeSuggestedTeamContacts(existingContacts = [], suggestedContacts = [], options = {}) {
	const appendUnmatched = String(options?.appendUnmatched || 'all').trim().toLowerCase() || 'all';
	const contacts = normalizeTeamContacts(existingContacts, {
		ensureOne: false,
		preserveEmpty: true
	});
	const suggestions = normalizeTeamContacts(suggestedContacts, {
		ensureOne: false,
		preserveEmpty: false
	});
	const decisions = [];

	const findContactIndex = (candidate) => {
		const candidateKey = getContactMatchKey(candidate);
		if (!candidateKey) return -1;
		const exactIndex = contacts.findIndex((contact) => getContactMatchKey(contact) === candidateKey);
		if (exactIndex >= 0) return exactIndex;

		const candidateNameKey = getContactNameKey(candidate);
		if (!candidateNameKey) return -1;

		const nameMatches = contacts
			.map((contact, index) => ({ contact, index }))
			.filter(({ contact }) => getContactNameKey(contact) === candidateNameKey);

		if (nameMatches.length === 0) return -1;
		if (nameMatches.length === 1) return nameMatches[0].index;

		nameMatches.sort(
			(left, right) => scoreNameMatch(right.contact, candidate) - scoreNameMatch(left.contact, candidate)
		);
		return nameMatches[0]?.index ?? -1;
	};

	const fillField = (target, suggestion, key, value, sourceType) => {
		if (!String(value || '').trim()) return target;
		if (String(target[key] || '').trim()) return target;
		if (typeof suggestion?.confidence === 'number' && suggestion.confidence < AUTO_FILL_CONFIDENCE_THRESHOLD) {
			decisions.push({
				contactId: target.id,
				field: key,
				sourceType,
				skipped: true,
				reason: 'low_confidence'
			});
			return target;
		}
		decisions.push({
			contactId: target.id,
			field: key,
			sourceType
		});
		return {
			...target,
			[key]: value
		};
	};

	for (const suggestion of suggestions) {
		const existingIndex = findContactIndex(suggestion);
		if (existingIndex >= 0) {
			let merged = {
				...contacts[existingIndex]
			};

			for (const key of ['firstName', 'lastName', 'email', 'phone', 'role', 'company', 'linkedinUrl', 'calendarUrl']) {
				merged = fillField(merged, suggestion, key, suggestion[key], suggestion.sourceType || 'suggestion');
			}

			if (!merged.isPrimary && suggestion.isPrimary) {
				merged.isPrimary = true;
				decisions.push({ contactId: merged.id, field: 'isPrimary', sourceType: suggestion.sourceType || 'suggestion' });
			}
			if (!merged.isInvestorRelations && suggestion.isInvestorRelations) {
				merged.isInvestorRelations = true;
				decisions.push({ contactId: merged.id, field: 'isInvestorRelations', sourceType: suggestion.sourceType || 'suggestion' });
			}
			if (!merged.matchReason && suggestion.matchReason) merged.matchReason = suggestion.matchReason;
			if (!merged.sourceType && suggestion.sourceType) merged.sourceType = suggestion.sourceType;
			if (merged.confidence === null && suggestion.confidence !== null) merged.confidence = suggestion.confidence;
			merged.isSuggested = merged.isSuggested || suggestion.isSuggested;
			contacts[existingIndex] = merged;
			continue;
		}

		const shouldAppend =
			appendUnmatched === 'all'
			|| (appendUnmatched === 'required_roles_only' && (suggestion.isPrimary || suggestion.isInvestorRelations));
		if (!shouldAppend) {
			decisions.push({
				contactId: suggestion.id,
				field: 'contact',
				sourceType: suggestion.sourceType || 'suggestion',
				skipped: true,
				reason: 'suppressed_unmatched_suggestion'
			});
			continue;
		}

		contacts.push({
			...suggestion,
			id: suggestion.id || createTeamContactId(),
			isSuggested: suggestion.isSuggested !== false
		});
		decisions.push({
			contactId: suggestion.id,
			field: 'contact',
			sourceType: suggestion.sourceType || 'suggestion'
		});
	}

	if (!contacts.some((contact) => contact.isPrimary)) {
		const operatorCandidate = contacts.find((contact) => contact.isPrimary) || contacts[0] || null;
		if (operatorCandidate) {
			contacts.forEach((contact) => {
				contact.isPrimary = contact.id === operatorCandidate.id;
			});
		}
	}

	return {
		contacts: rebalanceTeamRoleAssignments(contacts, { preserveEmpty: true }),
		decisions
	};
}
