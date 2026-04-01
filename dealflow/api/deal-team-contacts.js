import { ADMIN_EMAILS, getAdminClient, setCors } from './_supabase.js';
import { fetchFilingXml, parseFormD } from './_sec-edgar.js';
import {
	buildFallbackTeamContacts,
	createTeamContactId,
	normalizeTeamContacts,
	splitFullName,
	teamContactFullName
} from '../src/lib/onboarding/teamContacts.js';

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_REGEX = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]*)\d{3}[-.\s]*\d{4}/g;
const URL_REGEX = /https?:\/\/[^\s)]+/gi;
const CALENDAR_HOST_PATTERNS = [
	'calendly.com',
	'meetings.hubspot.com',
	'scheduleonce.com',
	'youcanbook.me',
	'acuityscheduling.com'
];
const EXECUTIVE_ROLE_PATTERNS = [
	/chief executive officer/i,
	/\bceo\b/i,
	/\bfounder\b/i,
	/\bmanaging partner\b/i,
	/\bprincipal\b/i,
	/\bpresident\b/i,
	/\bmanaging director\b/i,
	/\bpartner\b/i
];
const INVESTOR_RELATIONS_PATTERNS = [
	/\binvestor relations\b/i,
	/\binvestor contact\b/i,
	/\bcapital formation\b/i,
	/\bcapital raising\b/i,
	/\bhead of investor relations\b/i,
	/\bdirector of investor relations\b/i,
	/\bfor more information\b/i,
	/\bfor additional information\b/i
];
const NAME_BLOCKLIST = /\b(fund|capital|management|company|investor|relations|contact|email|phone|calendly|linkedin|llc|lp|inc|group)\b/i;
const HIGH_CONFIDENCE_OPERATOR_THRESHOLD = 0.82;
const HIGH_CONFIDENCE_IR_THRESHOLD = 0.78;

function isMissingVerificationTable(error) {
	if (!error) return false;
	if (['42P01', 'PGRST205', 'PGRST116'].includes(error.code)) return true;
	const message = String(error.message || '').toLowerCase();
	return message.includes('deal_sec_verification') || message.includes('deal sec verification');
}

function normalizeWhitespace(value = '') {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeNameKey(value = '') {
	return normalizeWhitespace(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

function escapeRegExp(value = '') {
	return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function firstMatch(regex, value = '') {
	const match = String(value || '').match(regex);
	return match ? normalizeWhitespace(match[0]) : '';
}

function findAll(regex, value = '') {
	return [...String(value || '').matchAll(regex)].map((match) => normalizeWhitespace(match[0])).filter(Boolean);
}

function pickCalendarUrl(text = '') {
	const urls = findAll(URL_REGEX, text);
	return urls.find((value) => CALENDAR_HOST_PATTERNS.some((host) => value.toLowerCase().includes(host))) || '';
}

function pickLinkedInUrl(text = '') {
	const urls = findAll(URL_REGEX, text);
	return urls.find((value) => value.toLowerCase().includes('linkedin.com')) || '';
}

function inferRole(windowText = '', fallback = '') {
	const window = normalizeWhitespace(windowText);
	if (!window) return fallback;
	if (INVESTOR_RELATIONS_PATTERNS.some((pattern) => pattern.test(window))) return 'Investor Relations';
	if (EXECUTIVE_ROLE_PATTERNS.some((pattern) => pattern.test(window))) {
		if (/\bmanaging partner\b/i.test(window)) return 'Managing Partner';
		if (/\bprincipal\b/i.test(window)) return 'Principal';
		if (/\bpresident\b/i.test(window)) return 'President';
		return 'CEO';
	}
	return fallback;
}

function inferCompanyLine(deal = {}, filing = null) {
	return normalizeWhitespace(
		deal?.management_company?.operator_name
		|| deal?.sponsor_name
		|| deal?.investment_name
		|| filing?.entity_name
		|| ''
	);
}

function mergeCandidateField(existing, key, nextValue) {
	if (!normalizeWhitespace(nextValue)) return existing;
	if (normalizeWhitespace(existing[key])) return existing;
	return {
		...existing,
		[key]: nextValue
	};
}

function addReason(existing = '', nextReason = '') {
	const parts = [existing, nextReason].map((value) => normalizeWhitespace(value)).filter(Boolean);
	return [...new Set(parts)].join(' · ');
}

function findCandidateIndex(candidates, patch) {
	const candidateEmail = normalizeWhitespace(patch.email).toLowerCase();
	if (candidateEmail) {
		return candidates.findIndex((candidate) => normalizeWhitespace(candidate.email).toLowerCase() === candidateEmail);
	}
	const candidateName = normalizeNameKey(patch.fullName || teamContactFullName(patch));
	if (!candidateName) return -1;
	return candidates.findIndex((candidate) => normalizeNameKey(teamContactFullName(candidate)) === candidateName);
}

function upsertCandidate(candidates, patch, context = {}) {
	const fullName = normalizeWhitespace(patch.fullName || teamContactFullName(patch));
	const email = normalizeWhitespace(patch.email).toLowerCase();
	if (!fullName && !email) return;

	const nextPatch = {
		id: patch.id || createTeamContactId('suggested-contact'),
		firstName: patch.firstName || splitFullName(fullName).firstName,
		lastName: patch.lastName || splitFullName(fullName).lastName,
		email,
		phone: normalizeWhitespace(patch.phone),
		role: normalizeWhitespace(patch.role),
		company: normalizeWhitespace(patch.company),
		linkedinUrl: normalizeWhitespace(patch.linkedinUrl),
		calendarUrl: normalizeWhitespace(patch.calendarUrl),
		sourceType: context.sourceType || patch.sourceType || '',
		sourceDocumentId: context.sourceDocumentId || patch.sourceDocumentId || '',
		confidence: typeof context.confidence === 'number' ? context.confidence : patch.confidence ?? null,
		matchReason: normalizeWhitespace(context.matchReason || patch.matchReason),
		isSuggested: true,
		isPrimary: patch.isPrimary === true,
		isInvestorRelations: patch.isInvestorRelations === true
	};

	const existingIndex = findCandidateIndex(candidates, {
		...nextPatch,
		fullName
	});

	if (existingIndex === -1) {
		candidates.push(nextPatch);
		return;
	}

	let merged = { ...candidates[existingIndex] };
	for (const key of ['firstName', 'lastName', 'email', 'phone', 'role', 'company', 'linkedinUrl', 'calendarUrl']) {
		merged = mergeCandidateField(merged, key, nextPatch[key]);
	}
	merged.isPrimary = merged.isPrimary || nextPatch.isPrimary;
	merged.isInvestorRelations = merged.isInvestorRelations || nextPatch.isInvestorRelations;
	merged.sourceType = merged.sourceType || nextPatch.sourceType;
	merged.sourceDocumentId = merged.sourceDocumentId || nextPatch.sourceDocumentId;
	merged.matchReason = addReason(merged.matchReason, nextPatch.matchReason);
	if (merged.confidence === null || (nextPatch.confidence ?? 0) > (merged.confidence ?? 0)) {
		merged.confidence = nextPatch.confidence;
	}
	candidates[existingIndex] = merged;
}

async function extractTextFromPdf(url = '') {
	if (!url) return '';
	try {
		const response = await fetch(url);
		if (!response.ok) throw new Error(`download_failed_${response.status}`);
		const fileBuffer = Buffer.from(await response.arrayBuffer());
		const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
		const result = await pdfParse(fileBuffer);
		return normalizeWhitespace(result.text || '');
	} catch (error) {
		console.warn('[deal-team-contacts] pdf extraction failed', {
			url,
			message: error?.message || 'unknown_error'
		});
		return '';
	}
}

function scanKnownName(text = '', fullName = '', { sourceType = '', sourceDocumentId = '', companyName = '' } = {}) {
	const query = normalizeWhitespace(fullName);
	if (!text || !query) return [];
	const matches = [];
	const regex = new RegExp(escapeRegExp(query), 'ig');
	let match;
	while ((match = regex.exec(text)) !== null && matches.length < 4) {
		const start = Math.max(0, match.index - 220);
		const end = Math.min(text.length, match.index + query.length + 220);
		const window = text.slice(start, end);
		const email = firstMatch(EMAIL_REGEX, window);
		const phone = firstMatch(PHONE_REGEX, window);
		const linkedinUrl = pickLinkedInUrl(window);
		const calendarUrl = pickCalendarUrl(window);
		const role = inferRole(window, '');

		if (!email && !phone && !linkedinUrl && !calendarUrl && !role) continue;

		matches.push({
			firstName: splitFullName(query).firstName,
			lastName: splitFullName(query).lastName,
			email,
			phone,
			role,
			company: companyName,
			linkedinUrl,
			calendarUrl,
			sourceType,
			sourceDocumentId,
			confidence: sourceType === 'ppm' ? 0.88 : 0.72,
			matchReason: `${sourceType.toUpperCase()} matched ${query}`
		});
	}
	return matches;
}

function scanEmailContactBlocks(text = '', { sourceType = '', sourceDocumentId = '', companyName = '' } = {}) {
	const candidates = [];
	for (const email of findAll(EMAIL_REGEX, text).slice(0, 12)) {
		const index = text.toLowerCase().indexOf(email.toLowerCase());
		if (index < 0) continue;
		const window = text.slice(Math.max(0, index - 180), Math.min(text.length, index + email.length + 180));
		const role = inferRole(window, '');
		const possibleNames = [...window.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z.'’-]+){1,2})\b/g)]
			.map((match) => normalizeWhitespace(match[1]))
			.filter((value) => value && !NAME_BLOCKLIST.test(value));
		const name = possibleNames[0] || '';
		const phone = firstMatch(PHONE_REGEX, window);
		const linkedinUrl = pickLinkedInUrl(window);
		const calendarUrl = pickCalendarUrl(window);

		if (!name && !role) continue;

		candidates.push({
			firstName: splitFullName(name).firstName,
			lastName: splitFullName(name).lastName,
			email,
			phone,
			role,
			company: companyName,
			linkedinUrl,
			calendarUrl,
			sourceType,
			sourceDocumentId,
			confidence: sourceType === 'ppm' ? 0.68 : 0.56,
			matchReason: `${sourceType.toUpperCase()} contact block`
		});
	}
	return candidates;
}

function rankOperatorLead(candidate = {}) {
	const role = normalizeWhitespace(candidate.role).toLowerCase();
	let score = candidate.confidence || 0;
	if (/ceo|chief executive officer|founder|managing partner|principal|president|partner/.test(role)) score += 3;
	if (candidate.email) score += 0.5;
	if (candidate.phone) score += 0.25;
	return score;
}

function rankInvestorRelations(candidate = {}) {
	const role = normalizeWhitespace(candidate.role).toLowerCase();
	let score = candidate.confidence || 0;
	if (/investor relations|capital formation|capital raising/.test(role)) score += 3;
	if (candidate.calendarUrl) score += 1;
	if (candidate.email) score += 0.75;
	return score;
}

function hasExplicitExecutiveRole(role = '') {
	return /ceo|chief executive officer|founder|managing partner|principal|president|managing director|partner/.test(
		normalizeWhitespace(role).toLowerCase()
	);
}

function hasExplicitInvestorRelationsRole(role = '') {
	return /investor relations|investor contact|capital formation|capital raising/.test(
		normalizeWhitespace(role).toLowerCase()
	);
}

function shouldAutoAssignOperator(candidate = {}) {
	const confidence = candidate.confidence ?? 0;
	return confidence >= HIGH_CONFIDENCE_OPERATOR_THRESHOLD
		|| (confidence >= 0.68 && hasExplicitExecutiveRole(candidate.role));
}

function shouldAutoAssignInvestorRelations(candidate = {}) {
	const confidence = candidate.confidence ?? 0;
	return confidence >= HIGH_CONFIDENCE_IR_THRESHOLD
		|| (confidence >= 0.64 && hasExplicitInvestorRelationsRole(candidate.role));
}

function normalizeParsedRelatedPeople(parsed = {}) {
	return Array.isArray(parsed.relatedPersons)
		? parsed.relatedPersons.map((person) => ({
			first_name: person.firstName || '',
			last_name: person.lastName || '',
			street: person.street || '',
			city: person.city || '',
			state: person.state || '',
			zip: person.zip || '',
			relationships: Array.isArray(person.relationships) ? person.relationships : [],
			relationship_clarification: person.clarification || ''
		}))
		: [];
}

async function hydrateSparseSecContacts(supabase, filing = null, relatedPeople = []) {
	const warnings = [];
	if (!filing?.id) {
		return {
			filing: null,
			relatedPeople: [],
			warnings
		};
	}

	const needsPhone = !normalizeWhitespace(filing.issuer_phone);
	const needsRelatedPeople = !Array.isArray(relatedPeople) || relatedPeople.length === 0;
	if (!needsPhone && !needsRelatedPeople) {
		return {
			filing,
			relatedPeople,
			warnings
		};
	}

	let xml = String(filing.raw_xml || '').trim();
	let edgarUrl = normalizeWhitespace(filing.edgar_url);
	let parsed = null;

	if (xml) {
		try {
			parsed = parseFormD(xml);
		} catch (error) {
			warnings.push(`sec_raw_xml_parse:${error?.message || 'unknown_error'}`);
		}
	}

	if (!parsed) {
		try {
			const fetched = await fetchFilingXml(filing.cik || '', filing.accession_number || '');
			xml = fetched.xml || '';
			edgarUrl = fetched.url || edgarUrl;
			parsed = parseFormD(xml);
		} catch (error) {
			warnings.push(`sec_filing_fetch:${error?.message || 'unknown_error'}`);
			return {
				filing,
				relatedPeople,
				warnings
			};
		}
	}

	const filingUpdates = {};
	if (!normalizeWhitespace(filing.issuer_phone) && normalizeWhitespace(parsed.issuerPhone)) {
		filingUpdates.issuer_phone = normalizeWhitespace(parsed.issuerPhone);
	}
	if (!normalizeWhitespace(filing.raw_xml) && xml) {
		filingUpdates.raw_xml = xml;
	}
	if (!normalizeWhitespace(filing.edgar_url) && edgarUrl) {
		filingUpdates.edgar_url = edgarUrl;
	}

	let nextRelatedPeople = Array.isArray(relatedPeople) ? relatedPeople : [];
	if (needsRelatedPeople) {
		nextRelatedPeople = normalizeParsedRelatedPeople(parsed);
	}

	if (Object.keys(filingUpdates).length > 0) {
		try {
			await supabase
				.from('sec_filings')
				.update(filingUpdates)
				.eq('id', filing.id);
			filing = {
				...filing,
				...filingUpdates
			};
		} catch (error) {
			warnings.push(`sec_filing_backfill:${error?.message || 'unknown_error'}`);
		}
	}

	if (needsRelatedPeople && nextRelatedPeople.length > 0) {
		try {
			await supabase.from('related_persons').delete().eq('sec_filing_id', filing.id);
			const { error } = await supabase.from('related_persons').insert(
				nextRelatedPeople.map((person) => ({
					sec_filing_id: filing.id,
					management_company_id: filing.management_company_id || null,
					first_name: person.first_name,
					last_name: person.last_name,
					street: person.street || '',
					city: person.city || '',
					state: person.state || '',
					zip: person.zip || '',
					relationships: person.relationships,
					relationship_clarification: person.relationship_clarification || ''
				}))
			);
			if (error) throw error;
		} catch (error) {
			warnings.push(`related_person_backfill:${error?.message || 'unknown_error'}`);
		}
	}

	return {
		filing,
		relatedPeople: nextRelatedPeople,
		warnings
	};
}

async function loadSecContacts(supabase, dealId) {
	const warnings = [];
	let filing = null;

	try {
		const { data: verificationRecord, error: verificationError } = await supabase
			.from('deal_sec_verification')
			.select('sec_filing_id')
			.eq('opportunity_id', dealId)
			.maybeSingle();
		if (verificationError && !isMissingVerificationTable(verificationError)) {
			throw verificationError;
		}

		if (verificationRecord?.sec_filing_id) {
			const { data: explicitFiling, error: explicitFilingError } = await supabase
				.from('sec_filings')
				.select('id, management_company_id, cik, accession_number, entity_name, issuer_phone, raw_xml, filing_date, edgar_url, is_latest_amendment')
				.eq('id', verificationRecord.sec_filing_id)
				.maybeSingle();
			if (explicitFilingError) throw explicitFilingError;
			filing = explicitFiling || null;
		}
	} catch (error) {
		warnings.push(`sec_verification_lookup:${error?.message || 'unknown_error'}`);
	}

	try {
		if (!filing?.id) {
			const { data: latestFiling, error: filingError } = await supabase
				.from('sec_filings')
				.select('id, management_company_id, cik, accession_number, entity_name, issuer_phone, raw_xml, filing_date, edgar_url, is_latest_amendment')
				.eq('opportunity_id', dealId)
				.eq('is_latest_amendment', true)
				.order('filing_date', { ascending: false })
				.limit(1)
				.maybeSingle();
			if (filingError) throw filingError;
			filing = latestFiling || null;
		}
	} catch (error) {
		warnings.push(`sec_filing_lookup:${error?.message || 'unknown_error'}`);
	}

	if (!filing?.id) return { filing: null, relatedPeople: [], warnings };

	try {
		const { data: relatedPeople, error: relatedPeopleError } = await supabase
			.from('related_persons')
			.select('first_name, last_name, relationships, relationship_clarification')
			.eq('sec_filing_id', filing.id);
		if (relatedPeopleError) throw relatedPeopleError;
		const hydrated = await hydrateSparseSecContacts(supabase, filing, relatedPeople || []);
		return {
			filing: hydrated.filing,
			relatedPeople: hydrated.relatedPeople,
			warnings: [...warnings, ...hydrated.warnings]
		};
	} catch (error) {
		warnings.push(`related_person_lookup:${error?.message || 'unknown_error'}`);
		const hydrated = await hydrateSparseSecContacts(supabase, filing, []);
		return {
			filing: hydrated.filing,
			relatedPeople: hydrated.relatedPeople,
			warnings: [...warnings, ...hydrated.warnings]
		};
	}
}

export default async function handler(req, res) {
	setCors(res);
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

	const { dealId } = req.body || {};
	if (!dealId || !/^[0-9a-f-]{36}$/i.test(dealId)) {
		return res.status(400).json({ error: 'Invalid deal ID' });
	}

	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith('Bearer ')) {
		return res.status(401).json({ error: 'Missing authorization' });
	}

	const token = authHeader.replace('Bearer ', '');
	const supabase = getAdminClient();
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser(token);

	if (authError || !user) {
		return res.status(401).json({ error: 'Invalid token' });
	}

	try {
		const { data: deal, error: dealError } = await supabase
			.from('opportunities')
			.select(`
				id,
				investment_name,
				sponsor_name,
				deck_url,
				ppm_url,
				management_company_id,
				management_company:management_companies(
					id,
					operator_name,
					authorized_emails,
					ceo,
					linkedin_ceo,
					ir_contact_name,
					ir_contact_email,
					booking_url
				)
			`)
			.eq('id', dealId)
			.single();

		if (dealError || !deal) {
			return res.status(404).json({ error: 'Deal not found' });
		}

		const isAdmin = ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());
		const authorizedEmails = (deal.management_company?.authorized_emails || []).map((value) => String(value || '').toLowerCase());
		if (!isAdmin && !authorizedEmails.includes(String(user.email || '').toLowerCase())) {
			return res.status(403).json({ error: 'Not authorized for this deal' });
		}

		const warnings = [];
		const companyName = inferCompanyLine(deal);
		const candidates = [];
		const fallbackContacts = buildFallbackTeamContacts({
			company: {
				operator_name: deal.management_company?.operator_name || '',
				ceo: deal.management_company?.ceo || '',
				linkedin_ceo: deal.management_company?.linkedin_ceo || '',
				ir_contact_name: deal.management_company?.ir_contact_name || '',
				ir_contact_email: deal.management_company?.ir_contact_email || '',
				booking_url: deal.management_company?.booking_url || ''
			},
			includeUserFallback: false
		});

		for (const contact of fallbackContacts) {
			upsertCandidate(candidates, contact, {
				sourceType: 'management_company',
				confidence: 0.82,
				matchReason: 'Existing sponsor metadata'
			});
		}

		const secContacts = await loadSecContacts(supabase, dealId);
		warnings.push(...secContacts.warnings);
		for (const person of secContacts.relatedPeople || []) {
			const fullName = [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
			const relationships = Array.isArray(person.relationships) ? person.relationships.join(', ') : '';
			upsertCandidate(candidates, {
				firstName: person.first_name || '',
				lastName: person.last_name || '',
				role: inferRole(`${relationships} ${person.relationship_clarification || ''}`, relationships || ''),
				phone: secContacts.filing?.issuer_phone || '',
				company: inferCompanyLine(deal, secContacts.filing),
				isPrimary: EXECUTIVE_ROLE_PATTERNS.some((pattern) => pattern.test(relationships)),
				isInvestorRelations: INVESTOR_RELATIONS_PATTERNS.some((pattern) => pattern.test(relationships))
			}, {
				sourceType: 'sec_filing',
				sourceDocumentId: secContacts.filing?.id || '',
				confidence: 0.9,
				matchReason: `SEC related person${relationships ? `: ${relationships}` : ''}`
			});
		}

		const knownNames = [...new Set(
			candidates
				.map((candidate) => teamContactFullName(candidate))
				.filter(Boolean)
		)];

		const ppmText = await extractTextFromPdf(deal.ppm_url || '');
		if (!ppmText && deal.ppm_url) warnings.push('ppm_text_unavailable');
		const deckText = await extractTextFromPdf(deal.deck_url || '');
		if (!deckText && deal.deck_url) warnings.push('deck_text_unavailable');

		for (const name of knownNames) {
			for (const match of scanKnownName(ppmText, name, {
				sourceType: 'ppm',
				sourceDocumentId: 'ppm',
				companyName
			})) {
				upsertCandidate(candidates, match, match);
			}
			for (const match of scanKnownName(deckText, name, {
				sourceType: 'deck',
				sourceDocumentId: 'deck',
				companyName
			})) {
				upsertCandidate(candidates, match, match);
			}
		}

		for (const match of scanEmailContactBlocks(ppmText, {
			sourceType: 'ppm',
			sourceDocumentId: 'ppm',
			companyName
		})) {
			upsertCandidate(candidates, match, match);
		}

		for (const match of scanEmailContactBlocks(deckText, {
			sourceType: 'deck',
			sourceDocumentId: 'deck',
			companyName
		})) {
			upsertCandidate(candidates, match, match);
		}

		const normalizedSuggestions = normalizeTeamContacts(candidates, {
			ensureOne: false,
			preserveEmpty: false
		}).sort((left, right) => {
			const leftScore = Math.max(rankOperatorLead(left), rankInvestorRelations(left));
			const rightScore = Math.max(rankOperatorLead(right), rankInvestorRelations(right));
			return rightScore - leftScore;
		});

		const rankedOperatorLead = normalizedSuggestions
			.slice()
			.sort((left, right) => rankOperatorLead(right) - rankOperatorLead(left))[0] || null;
		const rankedInvestorRelations = normalizedSuggestions
			.slice()
			.sort((left, right) => rankInvestorRelations(right) - rankInvestorRelations(left))[0] || null;
		const operatorLead = shouldAutoAssignOperator(rankedOperatorLead || {}) ? rankedOperatorLead : null;
		const investorRelations = shouldAutoAssignInvestorRelations(rankedInvestorRelations || {})
			? rankedInvestorRelations
			: null;
		const samePersonHandlesBothRoles = Boolean(
			operatorLead?.id &&
			(
				!investorRelations?.id ||
				operatorLead.id === investorRelations.id ||
				rankInvestorRelations(investorRelations) < 1
			)
		);

		for (const candidate of normalizedSuggestions) {
			candidate.isPrimary = candidate.id === operatorLead?.id;
			candidate.isInvestorRelations = samePersonHandlesBothRoles
				? candidate.id === operatorLead?.id
				: candidate.id === investorRelations?.id;
		}

		console.info('[deal-team-contacts] suggestions built', {
			dealId,
			candidateCount: normalizedSuggestions.length,
			operatorLeadContactId: operatorLead?.id || '',
			investorRelationsContactId: investorRelations?.id || '',
			samePersonHandlesBothRoles,
			warnings
		});

		return res.status(200).json({
			success: true,
			contacts: normalizedSuggestions,
			operatorLeadContactId: operatorLead?.id || '',
			investorRelationsContactId: samePersonHandlesBothRoles
				? operatorLead?.id || ''
				: investorRelations?.id || '',
			samePersonHandlesBothRoles,
			warnings
		});
	} catch (error) {
		console.error('[deal-team-contacts] failed', {
			dealId,
			message: error?.message || 'unknown_error'
		});
		return res.status(500).json({ error: 'Could not build team contact suggestions.' });
	}
}
