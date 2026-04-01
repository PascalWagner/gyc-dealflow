import { ADMIN_EMAILS, getAdminClient, setCors } from './_supabase.js';
import { extractFromPdf } from './_enrichment.js';
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
const EXTRACTION_TEXT_LIMIT = 120000;
const CONTACT_FIELD_TARGETS = [
	'full name',
	'role / title',
	'email address',
	'phone number',
	'LinkedIn URL',
	'calendar URL',
	'operator-lead signal',
	'investor-relations signal'
];
const CONTACT_SCAN_RULES = [
	{
		id: 'sec_related_people',
		label: 'SEC related persons',
		description: 'Load every related person from the matched SEC filing and attach the filing phone number when available.',
		targets: ['full name', 'role / title', 'phone number', 'operator-lead signal']
	},
	{
		id: 'known_name_window',
		label: 'Known-name window scan',
		description: 'Search deck and PPM around each known person name, allowing for middle initials and loose formatting.',
		targets: ['email address', 'phone number', 'LinkedIn URL', 'calendar URL', 'role / title']
	},
	{
		id: 'email_contact_block',
		label: 'Email contact block scan',
		description: 'Search around every explicit email address and capture nearby names, phone numbers, and roles.',
		targets: ['full name', 'email address', 'phone number', 'role / title']
	},
	{
		id: 'phone_contact_block',
		label: 'Phone contact block scan',
		description: 'Search around every explicit phone number and capture nearby names, email addresses, and roles.',
		targets: ['full name', 'phone number', 'email address', 'role / title']
	},
	{
		id: 'role_anchor_scan',
		label: 'Role-anchor scan',
		description: 'Search around cues like investor relations, capital formation, and for more information.',
		targets: ['investor-relations signal', 'full name', 'email address', 'phone number', 'calendar URL']
	},
	{
		id: 'document_ai_contacts',
		label: 'Document AI contact extraction',
		description: 'Ask the document extractor to return every explicit sponsor contact and mark LP-facing roles.',
		targets: ['all contact fields', 'operator-lead signal', 'investor-relations signal']
	}
];
const CONTACT_EXTRACTION_PROMPT = `You are extracting LP-facing sponsor contacts from a private placement memorandum or pitch deck. Return ONLY valid JSON in this exact shape:
{
  "contacts": [
    {
      "name": "Full name",
      "role": "Exact role if stated",
      "email": "Email if stated",
      "phone": "Phone if stated",
      "linkedinUrl": "LinkedIn URL if stated",
      "calendarUrl": "Calendar URL if stated",
      "isPrimary": true,
      "isInvestorRelations": false,
      "confidence": "high"
    }
  ]
}

Rules:
- Only include contacts explicitly present in the document.
- Include every explicit sponsor/operator contact you can find. If multiple contacts are present, return all of them.
- Prefer the two LP-facing contacts first, but do not omit additional named contacts with phone, email, calendar, or LinkedIn details.
- Set isPrimary true for CEO, President, Founder, Managing Partner, Principal, Managing Director, or equivalent operator lead.
- Set isInvestorRelations true for Investor Relations, Capital Formation, Capital Raising, Investor Contact, or a "for more information" LP contact.
- Use empty strings for missing fields.
- Do not invent names, emails, or phone numbers.
- Return no prose, only JSON.`;

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

function hasValidEmail(value = '') {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim().toLowerCase());
}

function hasPhone(value = '') {
	return Boolean(normalizeWhitespace(value));
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

function summarizeCandidate(candidate = {}) {
	const name = normalizeWhitespace(candidate.name || candidate.fullName || teamContactFullName(candidate));
	return {
		name,
		role: normalizeWhitespace(candidate.role),
		email: normalizeWhitespace(candidate.email).toLowerCase(),
		phone: normalizeWhitespace(candidate.phone),
		linkedinUrl: normalizeWhitespace(candidate.linkedinUrl),
		calendarUrl: normalizeWhitespace(candidate.calendarUrl),
		sourceType: normalizeWhitespace(candidate.sourceType),
		sourceDocumentId: normalizeWhitespace(candidate.sourceDocumentId),
		confidence: typeof candidate.confidence === 'number'
			? Number(candidate.confidence.toFixed(2))
			: null,
		isPrimary: candidate.isPrimary === true,
		isInvestorRelations: candidate.isInvestorRelations === true,
		matchReason: normalizeWhitespace(candidate.matchReason)
	};
}

function mergeDiagnosticSummary(existing = {}, next = {}) {
	const merged = { ...existing };
	for (const key of ['name', 'role', 'email', 'phone', 'linkedinUrl', 'calendarUrl', 'sourceType', 'sourceDocumentId']) {
		if (!normalizeWhitespace(merged[key]) && normalizeWhitespace(next[key])) {
			merged[key] = next[key];
		}
	}
	merged.matchReason = addReason(merged.matchReason, next.matchReason);
	if (merged.confidence === null || (next.confidence ?? 0) > (merged.confidence ?? 0)) {
		merged.confidence = next.confidence;
	}
	merged.isPrimary = merged.isPrimary || next.isPrimary;
	merged.isInvestorRelations = merged.isInvestorRelations || next.isInvestorRelations;
	return merged;
}

function dedupeDiagnosticContacts(candidates = []) {
	const summaries = [];
	const indexByKey = new Map();

	for (const candidate of candidates) {
		const summary = summarizeCandidate(candidate);
		if (
			!summary.name &&
			!summary.email &&
			!summary.phone &&
			!summary.role &&
			!summary.linkedinUrl &&
			!summary.calendarUrl
		) {
			continue;
		}

		const key = summary.email
			? `email:${summary.email}`
			: summary.name
				? `name:${normalizeNameKey(summary.name)}`
				: summary.phone
					? `phone:${summary.phone}`
					: `summary:${summaries.length}`;
		const existingIndex = indexByKey.get(key);
		if (existingIndex === undefined) {
			indexByKey.set(key, summaries.length);
			summaries.push(summary);
			continue;
		}
		summaries[existingIndex] = mergeDiagnosticSummary(summaries[existingIndex], summary);
	}

	return summaries;
}

function createRuleDiagnostics(ruleId = '') {
	const rule = CONTACT_SCAN_RULES.find((entry) => entry.id === ruleId);
	return {
		id: ruleId,
		label: rule?.label || ruleId,
		description: rule?.description || '',
		targets: Array.isArray(rule?.targets) ? [...rule.targets] : [],
		ran: false,
		note: '',
		hitCount: 0,
		contacts: []
	};
}

function createDocumentDiagnostics(documentId = '', url = '') {
	return {
		documentId,
		urlPresent: Boolean(url),
		bufferAvailable: false,
		textLength: 0,
		rules: CONTACT_SCAN_RULES
			.filter((rule) => rule.id !== 'sec_related_people')
			.map((rule) => createRuleDiagnostics(rule.id))
	};
}

function createExtractionDiagnostics({ dealId = '', companyName = '', ppmUrl = '', deckUrl = '' } = {}) {
	return {
		dealId,
		companyName,
		fieldTargets: [...CONTACT_FIELD_TARGETS],
		scanRules: CONTACT_SCAN_RULES.map((rule) => ({
			...rule,
			targets: Array.isArray(rule.targets) ? [...rule.targets] : []
		})),
		knownNames: [],
		sources: {
			managementCompany: {
				contactCount: 0,
				contacts: []
			},
			sec: {
				available: false,
				filingId: '',
				filingDate: '',
				entityName: '',
				issuerPhone: '',
				edgarUrl: '',
				relatedPeopleCount: 0,
				rules: [createRuleDiagnostics('sec_related_people')]
			},
			ppm: createDocumentDiagnostics('ppm', ppmUrl),
			deck: createDocumentDiagnostics('deck', deckUrl)
		},
		warnings: [],
		finalContacts: [],
		assignments: {}
	};
}

function getRuleDiagnostics(container = {}, ruleId = '') {
	if (!container || !Array.isArray(container.rules)) return null;
	let ruleDiagnostics = container.rules.find((entry) => entry.id === ruleId) || null;
	if (!ruleDiagnostics) {
		ruleDiagnostics = createRuleDiagnostics(ruleId);
		container.rules.push(ruleDiagnostics);
	}
	return ruleDiagnostics;
}

function setRuleDiagnostics(container = {}, ruleId = '', matches = [], { ran = true, note = '' } = {}) {
	const ruleDiagnostics = getRuleDiagnostics(container, ruleId);
	if (!ruleDiagnostics) return;

	ruleDiagnostics.ran = ran;
	ruleDiagnostics.note = note;
	ruleDiagnostics.contacts = dedupeDiagnosticContacts(matches);
	ruleDiagnostics.hitCount = ruleDiagnostics.contacts.length;
}

function setDocumentStatus(documentDiagnostics = {}, document = {}) {
	documentDiagnostics.bufferAvailable = Boolean(document?.buffer);
	documentDiagnostics.textLength = normalizeWhitespace(document?.text || '').length;
}

function extractTextFromPdfBufferHeuristic(buffer) {
	const raw = buffer.toString('latin1');
	const textChunks = [];

	const btEtRegex = /BT\s([\s\S]*?)ET/g;
	let match;
	while ((match = btEtRegex.exec(raw)) !== null) {
		const parenStrings = match[1].match(/\(([^)]*)\)/g);
		if (!parenStrings) continue;
		for (const value of parenStrings) {
			const cleaned = value.slice(1, -1)
				.replace(/\\n/g, '\n')
				.replace(/\\r/g, '')
				.replace(/\\\(/g, '(')
				.replace(/\\\)/g, ')')
				.replace(/\\\\/g, '\\');
			if (cleaned.trim()) textChunks.push(cleaned);
		}
	}

	if (textChunks.join('').length < 500) {
		const readableRegex = /[\x20-\x7E]{10,}/g;
		let readableMatch;
		while ((readableMatch = readableRegex.exec(raw)) !== null) {
			const chunk = readableMatch[0].trim();
			if (chunk && !/^[A-Fa-f0-9\s]+$/.test(chunk) && !/^[\/\[\]<>{}]+$/.test(chunk)) {
				textChunks.push(chunk);
			}
		}
	}

	return textChunks.join(' ').substring(0, EXTRACTION_TEXT_LIMIT);
}

function parseSupabaseStorageLocation(url = '') {
	try {
		const parsed = new URL(url);
		const signMarker = '/storage/v1/object/sign/';
		const publicMarker = '/storage/v1/object/public/';
		const authenticatedMarker = '/storage/v1/object/authenticated/';
		const marker = [signMarker, publicMarker, authenticatedMarker].find((value) => parsed.pathname.includes(value));
		if (!marker) return null;

		const [, remainder = ''] = parsed.pathname.split(marker);
		const segments = remainder.split('/').filter(Boolean);
		if (segments.length < 2) return null;
		const bucket = segments.shift();
		const path = decodeURIComponent(segments.join('/'));
		if (!bucket || !path) return null;
		return { bucket, path };
	} catch {
		return null;
	}
}

async function downloadPdfBuffer(supabase, url = '') {
	if (!url) return null;

	try {
		const response = await fetch(url, {
			headers: {
				'User-Agent': 'GYC Research pascal@growyourcashflow.com'
			}
		});
		if (response.ok) {
			return Buffer.from(await response.arrayBuffer());
		}
	} catch {}

	const storageLocation = parseSupabaseStorageLocation(url);
	if (!storageLocation) {
		throw new Error('document_download_failed');
	}

	const { data, error } = await supabase.storage.from(storageLocation.bucket).download(storageLocation.path);
	if (error || !data) {
		throw new Error(error?.message || 'storage_download_failed');
	}

	return Buffer.from(await data.arrayBuffer());
}

async function extractTextFromPdfBuffer(buffer) {
	const heuristicText = normalizeWhitespace(extractTextFromPdfBufferHeuristic(buffer));
	let parsedText = '';

	try {
		const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
		const result = await pdfParse(buffer);
		parsedText = normalizeWhitespace(result.text || '');
	} catch (error) {
		console.warn('[deal-team-contacts] pdf-parse failed', {
			message: error?.message || 'unknown_error'
		});
	}

	const combined = [parsedText, heuristicText]
		.filter(Boolean)
		.reduce((accumulator, value) => {
			if (!value) return accumulator;
			if (accumulator.includes(value)) return accumulator;
			return `${accumulator} ${value}`.trim();
		}, '');

	return normalizeWhitespace(combined).slice(0, EXTRACTION_TEXT_LIMIT);
}

async function extractTextFromPdf(supabase, url = '') {
	if (!url) return { text: '', buffer: null };
	try {
		const fileBuffer = await downloadPdfBuffer(supabase, url);
		return {
			text: await extractTextFromPdfBuffer(fileBuffer),
			buffer: fileBuffer
		};
	} catch (error) {
		console.warn('[deal-team-contacts] pdf extraction failed', {
			url,
			message: error?.message || 'unknown_error'
		});
		return {
			text: '',
			buffer: null
		};
	}
}

function buildFlexibleNameRegex(fullName = '') {
	const parts = normalizeWhitespace(fullName)
		.split(/\s+/)
		.filter(Boolean)
		.map((part) => part.replace(/[^A-Za-z0-9.'’-]/g, ''));
	if (parts.length === 0) return null;
	if (parts.length === 1) {
		return new RegExp(`\\b${escapeRegExp(parts[0])}\\b`, 'ig');
	}

	const firstName = parts[0];
	const lastName = parts[parts.length - 1];
	return new RegExp(
		`\\b${escapeRegExp(firstName)}(?:\\s+[A-Z][a-z.'’-]+|\\s+[A-Z]\\.?)?\\s+${escapeRegExp(lastName)}\\b`,
		'ig'
	);
}

function extractPossibleNames(window = '') {
	return [...window.matchAll(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z.'’-]+){1,3})\b/g)]
		.map((match) => normalizeWhitespace(match[1]))
		.filter((value) => value && !NAME_BLOCKLIST.test(value));
}

function scanKnownName(text = '', fullName = '', { sourceType = '', sourceDocumentId = '', companyName = '' } = {}) {
	const query = normalizeWhitespace(fullName);
	if (!text || !query) return [];
	const matches = [];
	const regex = buildFlexibleNameRegex(query);
	if (!regex) return matches;
	let match;
	while ((match = regex.exec(text)) !== null && matches.length < 4) {
		const start = Math.max(0, match.index - 320);
		const end = Math.min(text.length, match.index + match[0].length + 320);
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
		const window = text.slice(Math.max(0, index - 260), Math.min(text.length, index + email.length + 260));
		const role = inferRole(window, '');
		const possibleNames = extractPossibleNames(window);
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

function scanPhoneContactBlocks(text = '', { sourceType = '', sourceDocumentId = '', companyName = '' } = {}) {
	const candidates = [];
	for (const phone of findAll(PHONE_REGEX, text).slice(0, 16)) {
		const index = text.indexOf(phone);
		if (index < 0) continue;
		const window = text.slice(Math.max(0, index - 260), Math.min(text.length, index + phone.length + 260));
		const role = inferRole(window, '');
		const possibleNames = extractPossibleNames(window);
		const name = possibleNames[0] || '';
		const email = firstMatch(EMAIL_REGEX, window);
		const linkedinUrl = pickLinkedInUrl(window);
		const calendarUrl = pickCalendarUrl(window);

		if (!name && !email && !role) continue;

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
			confidence: sourceType === 'ppm' ? 0.74 : 0.62,
			matchReason: `${sourceType.toUpperCase()} phone contact block`
		});
	}
	return candidates;
}

function scanRoleAnchors(text = '', { sourceType = '', sourceDocumentId = '', companyName = '' } = {}) {
	const anchorRegex = /\b(investor relations|capital formation|capital raising|for more information|for additional information|contact us|questions\??)\b/ig;
	const candidates = [];
	let match;
	while ((match = anchorRegex.exec(text)) !== null && candidates.length < 8) {
		const window = text.slice(Math.max(0, match.index - 220), Math.min(text.length, match.index + match[0].length + 320));
		const possibleNames = extractPossibleNames(window);
		const name = possibleNames[0] || '';
		const email = firstMatch(EMAIL_REGEX, window);
		const phone = firstMatch(PHONE_REGEX, window);
		const linkedinUrl = pickLinkedInUrl(window);
		const calendarUrl = pickCalendarUrl(window);

		if (!name && !email && !phone) continue;

		candidates.push({
			firstName: splitFullName(name).firstName,
			lastName: splitFullName(name).lastName,
			email,
			phone,
			role: inferRole(window, 'Investor Relations'),
			company: companyName,
			linkedinUrl,
			calendarUrl,
			sourceType,
			sourceDocumentId,
			confidence: sourceType === 'ppm' ? 0.76 : 0.64,
			matchReason: `${sourceType.toUpperCase()} role anchor`
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

function normalizeAiConfidence(value = '') {
	const normalized = normalizeWhitespace(value).toLowerCase();
	if (normalized === 'high') return 0.9;
	if (normalized === 'medium') return 0.72;
	if (normalized === 'low') return 0.56;
	return 0.68;
}

function hasReachableOperatorCandidate(candidates = []) {
	return candidates.some((candidate) =>
		hasExplicitExecutiveRole(candidate.role) && (hasValidEmail(candidate.email) || hasPhone(candidate.phone))
	);
}

function hasInvestorRelationsCandidate(candidates = []) {
	return candidates.some((candidate) =>
		hasExplicitInvestorRelationsRole(candidate.role) && hasValidEmail(candidate.email)
	);
}

function shouldRunDocumentAi(candidates = []) {
	if (!hasReachableOperatorCandidate(candidates)) return true;
	if (!hasInvestorRelationsCandidate(candidates)) return true;
	return !candidates.some((candidate) => hasValidEmail(candidate.email));
}

async function extractContactsWithAi(fileBuffer, { sourceType = '', sourceDocumentId = '', companyName = '' } = {}) {
	if (!fileBuffer) return [];

	try {
		const { extracted } = await extractFromPdf(fileBuffer, CONTACT_EXTRACTION_PROMPT);
		const contacts = Array.isArray(extracted?.contacts) ? extracted.contacts : [];
		return contacts
			.map((contact) => {
				const fullName = normalizeWhitespace(contact?.name || '');
				const split = splitFullName(fullName);
				return {
					firstName: split.firstName,
					lastName: split.lastName,
					email: normalizeWhitespace(contact?.email).toLowerCase(),
					phone: normalizeWhitespace(contact?.phone),
					role: normalizeWhitespace(contact?.role),
					company: companyName,
					linkedinUrl: normalizeWhitespace(contact?.linkedinUrl),
					calendarUrl: normalizeWhitespace(contact?.calendarUrl),
					sourceType,
					sourceDocumentId,
					confidence: normalizeAiConfidence(contact?.confidence),
					matchReason: `${sourceType.toUpperCase()} AI contact extraction`,
					isPrimary: contact?.isPrimary === true,
					isInvestorRelations: contact?.isInvestorRelations === true
				};
			})
			.filter((contact) => teamContactFullName(contact) || contact.email);
	} catch (error) {
		console.warn('[deal-team-contacts] AI contact extraction failed', {
			sourceType,
			message: error?.message || 'unknown_error'
		});
		return [];
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
		const diagnostics = createExtractionDiagnostics({
			dealId,
			companyName,
			ppmUrl: deal.ppm_url || '',
			deckUrl: deal.deck_url || ''
		});
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
		diagnostics.sources.managementCompany.contacts = dedupeDiagnosticContacts(fallbackContacts);
		diagnostics.sources.managementCompany.contactCount = diagnostics.sources.managementCompany.contacts.length;

		for (const contact of fallbackContacts) {
			upsertCandidate(candidates, contact, {
				sourceType: 'management_company',
				confidence: 0.82,
				matchReason: 'Existing sponsor metadata'
			});
		}

		const secContacts = await loadSecContacts(supabase, dealId);
		warnings.push(...secContacts.warnings);
		diagnostics.sources.sec.available = Boolean(secContacts.filing?.id);
		diagnostics.sources.sec.filingId = secContacts.filing?.id || '';
		diagnostics.sources.sec.filingDate = secContacts.filing?.filing_date || '';
		diagnostics.sources.sec.entityName = secContacts.filing?.entity_name || '';
		diagnostics.sources.sec.issuerPhone = secContacts.filing?.issuer_phone || '';
		diagnostics.sources.sec.edgarUrl = secContacts.filing?.edgar_url || '';
		diagnostics.sources.sec.relatedPeopleCount = Array.isArray(secContacts.relatedPeople)
			? secContacts.relatedPeople.length
			: 0;
		const secRuleMatches = [];
		for (const person of secContacts.relatedPeople || []) {
			const relationships = Array.isArray(person.relationships) ? person.relationships.join(', ') : '';
			const secMatch = {
				firstName: person.first_name || '',
				lastName: person.last_name || '',
				role: inferRole(`${relationships} ${person.relationship_clarification || ''}`, relationships || ''),
				phone: secContacts.filing?.issuer_phone || '',
				company: inferCompanyLine(deal, secContacts.filing),
				isPrimary: EXECUTIVE_ROLE_PATTERNS.some((pattern) => pattern.test(relationships)),
				isInvestorRelations: INVESTOR_RELATIONS_PATTERNS.some((pattern) => pattern.test(relationships)),
				sourceType: 'sec_filing',
				sourceDocumentId: secContacts.filing?.id || '',
				confidence: 0.9,
				matchReason: `SEC related person${relationships ? `: ${relationships}` : ''}`
			};
			upsertCandidate(candidates, secMatch, secMatch);
			secRuleMatches.push(secMatch);
		}
		setRuleDiagnostics(diagnostics.sources.sec, 'sec_related_people', secRuleMatches, {
			ran: Boolean(secContacts.filing?.id),
			note: secContacts.filing?.id
				? ''
				: 'No matched SEC filing was available for related-person extraction.'
		});

		const knownNames = [...new Set(
			candidates
				.map((candidate) => teamContactFullName(candidate))
				.filter(Boolean)
		)];
		diagnostics.knownNames = knownNames;

		const ppmDocument = await extractTextFromPdf(supabase, deal.ppm_url || '');
		if (!ppmDocument.text && deal.ppm_url) warnings.push('ppm_text_unavailable');
		const deckDocument = await extractTextFromPdf(supabase, deal.deck_url || '');
		if (!deckDocument.text && deal.deck_url) warnings.push('deck_text_unavailable');
		setDocumentStatus(diagnostics.sources.ppm, ppmDocument);
		setDocumentStatus(diagnostics.sources.deck, deckDocument);

		const ppmKnownNameMatches = [];
		const deckKnownNameMatches = [];
		for (const name of knownNames) {
			const ppmMatches = scanKnownName(ppmDocument.text, name, {
				sourceType: 'ppm',
				sourceDocumentId: 'ppm',
				companyName
			});
			ppmKnownNameMatches.push(...ppmMatches);
			for (const match of ppmMatches) {
				upsertCandidate(candidates, match, match);
			}

			const deckMatches = scanKnownName(deckDocument.text, name, {
				sourceType: 'deck',
				sourceDocumentId: 'deck',
				companyName
			});
			deckKnownNameMatches.push(...deckMatches);
			for (const match of deckMatches) {
				upsertCandidate(candidates, match, match);
			}
		}
		setRuleDiagnostics(diagnostics.sources.ppm, 'known_name_window', ppmKnownNameMatches, {
			ran: knownNames.length > 0 && Boolean(ppmDocument.text),
			note: !knownNames.length
				? 'No known names were available to anchor the scan.'
				: !ppmDocument.text
					? 'PPM text was unavailable.'
					: ''
		});
		setRuleDiagnostics(diagnostics.sources.deck, 'known_name_window', deckKnownNameMatches, {
			ran: knownNames.length > 0 && Boolean(deckDocument.text),
			note: !knownNames.length
				? 'No known names were available to anchor the scan.'
				: !deckDocument.text
					? 'Deck text was unavailable.'
					: ''
		});

		const ppmEmailMatches = scanEmailContactBlocks(ppmDocument.text, {
			sourceType: 'ppm',
			sourceDocumentId: 'ppm',
			companyName
		});
		for (const match of ppmEmailMatches) {
			upsertCandidate(candidates, match, match);
		}
		setRuleDiagnostics(diagnostics.sources.ppm, 'email_contact_block', ppmEmailMatches, {
			ran: Boolean(ppmDocument.text),
			note: ppmDocument.text ? '' : 'PPM text was unavailable.'
		});

		const deckEmailMatches = scanEmailContactBlocks(deckDocument.text, {
			sourceType: 'deck',
			sourceDocumentId: 'deck',
			companyName
		});
		for (const match of deckEmailMatches) {
			upsertCandidate(candidates, match, match);
		}
		setRuleDiagnostics(diagnostics.sources.deck, 'email_contact_block', deckEmailMatches, {
			ran: Boolean(deckDocument.text),
			note: deckDocument.text ? '' : 'Deck text was unavailable.'
		});

		const ppmPhoneMatches = scanPhoneContactBlocks(ppmDocument.text, {
			sourceType: 'ppm',
			sourceDocumentId: 'ppm',
			companyName
		});
		for (const match of ppmPhoneMatches) {
			upsertCandidate(candidates, match, match);
		}
		setRuleDiagnostics(diagnostics.sources.ppm, 'phone_contact_block', ppmPhoneMatches, {
			ran: Boolean(ppmDocument.text),
			note: ppmDocument.text ? '' : 'PPM text was unavailable.'
		});

		const deckPhoneMatches = scanPhoneContactBlocks(deckDocument.text, {
			sourceType: 'deck',
			sourceDocumentId: 'deck',
			companyName
		});
		for (const match of deckPhoneMatches) {
			upsertCandidate(candidates, match, match);
		}
		setRuleDiagnostics(diagnostics.sources.deck, 'phone_contact_block', deckPhoneMatches, {
			ran: Boolean(deckDocument.text),
			note: deckDocument.text ? '' : 'Deck text was unavailable.'
		});

		const ppmRoleMatches = scanRoleAnchors(ppmDocument.text, {
			sourceType: 'ppm',
			sourceDocumentId: 'ppm',
			companyName
		});
		for (const match of ppmRoleMatches) {
			upsertCandidate(candidates, match, match);
		}
		setRuleDiagnostics(diagnostics.sources.ppm, 'role_anchor_scan', ppmRoleMatches, {
			ran: Boolean(ppmDocument.text),
			note: ppmDocument.text ? '' : 'PPM text was unavailable.'
		});

		const deckRoleMatches = scanRoleAnchors(deckDocument.text, {
			sourceType: 'deck',
			sourceDocumentId: 'deck',
			companyName
		});
		for (const match of deckRoleMatches) {
			upsertCandidate(candidates, match, match);
		}
		setRuleDiagnostics(diagnostics.sources.deck, 'role_anchor_scan', deckRoleMatches, {
			ran: Boolean(deckDocument.text),
			note: deckDocument.text ? '' : 'Deck text was unavailable.'
		});

		const shouldRunAi = shouldRunDocumentAi(candidates);
		if (shouldRunAi) {
			const ppmAiMatches = await extractContactsWithAi(ppmDocument.buffer, {
				sourceType: 'ppm',
				sourceDocumentId: 'ppm',
				companyName
			});
			for (const match of ppmAiMatches) {
				upsertCandidate(candidates, match, match);
			}
			setRuleDiagnostics(diagnostics.sources.ppm, 'document_ai_contacts', ppmAiMatches, {
				ran: Boolean(ppmDocument.buffer),
				note: ppmDocument.buffer ? '' : 'PPM file buffer was unavailable for AI extraction.'
			});

			const deckAiMatches = await extractContactsWithAi(deckDocument.buffer, {
				sourceType: 'deck',
				sourceDocumentId: 'deck',
				companyName
			});
			for (const match of deckAiMatches) {
				upsertCandidate(candidates, match, match);
			}
			setRuleDiagnostics(diagnostics.sources.deck, 'document_ai_contacts', deckAiMatches, {
				ran: Boolean(deckDocument.buffer),
				note: deckDocument.buffer ? '' : 'Deck file buffer was unavailable for AI extraction.'
			});
		} else {
			setRuleDiagnostics(diagnostics.sources.ppm, 'document_ai_contacts', [], {
				ran: false,
				note: 'Skipped because the rule-based scan already found a reachable operator and an IR contact.'
			});
			setRuleDiagnostics(diagnostics.sources.deck, 'document_ai_contacts', [], {
				ran: false,
				note: 'Skipped because the rule-based scan already found a reachable operator and an IR contact.'
			});
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
		diagnostics.warnings = [...warnings];
		diagnostics.finalContacts = dedupeDiagnosticContacts(normalizedSuggestions);
		diagnostics.assignments = {
			operatorLeadContactId: operatorLead?.id || '',
			investorRelationsContactId: samePersonHandlesBothRoles
				? operatorLead?.id || ''
				: investorRelations?.id || '',
			samePersonHandlesBothRoles
		};

		console.info('[deal-team-contacts] suggestions built', {
			dealId,
			candidateCount: normalizedSuggestions.length,
			operatorLeadContactId: operatorLead?.id || '',
			investorRelationsContactId: investorRelations?.id || '',
			samePersonHandlesBothRoles,
			warnings
		});
		console.info('[deal-team-contacts] extraction diagnostics', {
			dealId,
			diagnostics
		});

		return res.status(200).json({
			success: true,
			contacts: normalizedSuggestions,
			operatorLeadContactId: operatorLead?.id || '',
			investorRelationsContactId: samePersonHandlesBothRoles
				? operatorLead?.id || ''
				: investorRelations?.id || '',
			samePersonHandlesBothRoles,
			warnings,
			diagnostics
		});
	} catch (error) {
		console.error('[deal-team-contacts] failed', {
			dealId,
			message: error?.message || 'unknown_error'
		});
		return res.status(500).json({ error: 'Could not build team contact suggestions.' });
	}
}
