import { dealFieldConfig } from './dealReviewSchema.js';
import {
	STATE_NAME_BY_CODE,
	buildDocumentInvestingStateSignals,
	mergeStateCodeLists
} from './investing-geography.js';

const NARRATIVE_STOP_WORDS = new Set([
	'the', 'and', 'for', 'with', 'that', 'this', 'from', 'into', 'across', 'their', 'there',
	'then', 'than', 'when', 'where', 'will', 'would', 'could', 'should', 'have', 'has', 'had',
	'been', 'being', 'about', 'through', 'over', 'under', 'after', 'before', 'between', 'while',
	'into', 'onto', 'your', 'they', 'them', 'its', 'our', 'out', 'are', 'was', 'were', 'not',
	'only', 'each', 'which', 'these', 'those', 'more', 'most', 'just', 'very', 'also', 'than',
	'deal', 'fund', 'funds', 'investor', 'investors', 'company', 'sponsor', 'reviewer', 'notes',
	'source', 'summary', 'returns', 'return', 'annual', 'current', 'currently', 'focused'
]);

const SEC_EVIDENCE_FIELD_KEYS = new Set([
	'offeringType',
	'availableTo',
	'investmentMinimum',
	'secEntityName',
	'issuerEntity',
	'secCik',
	'dateOfFirstSale',
	'totalAmountSold',
	'totalInvestors'
]);

function normalizeWhitespace(value = '') {
	return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeSearchText(value = '') {
	return normalizeWhitespace(value)
		.toLowerCase()
		.replace(/[^\w$%./()-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function toArray(value) {
	if (Array.isArray(value)) {
		return value.map((item) => normalizeWhitespace(item)).filter(Boolean);
	}
	if (value === null || value === undefined || value === '') return [];
	return [normalizeWhitespace(value)].filter(Boolean);
}

function isMeaningfulValue(value) {
	if (Array.isArray(value)) return value.length > 0;
	if (value && typeof value === 'object') return Object.keys(value).length > 0;
	return normalizeWhitespace(value) !== '';
}

function uniqTerms(values = []) {
	const seen = new Set();
	const deduped = [];
	for (const value of values) {
		const normalized = normalizeSearchText(value);
		if (!normalized || seen.has(normalized)) continue;
		seen.add(normalized);
		deduped.push(String(value).trim());
	}
	return deduped;
}

function readFieldValue(source = {}, aliases = []) {
	for (const alias of aliases) {
		if (alias in source) {
			const value = source[alias];
			if (isMeaningfulValue(value)) return value;
		}
	}
	return undefined;
}

export function readReviewFieldValue(source = {}, fieldKey = '') {
	const field = dealFieldConfig[fieldKey];
	if (!field) return source?.[fieldKey];

	if (field.type === 'entity_reference') {
		const id = normalizeWhitespace(readFieldValue(source, field.readIdFrom || []));
		const name = normalizeWhitespace(readFieldValue(source, field.readNameFrom || []));
		return { id, name };
	}

	return readFieldValue(source, field.readFrom || [fieldKey]);
}

function normalizeLineNumber(value) {
	return Number.isFinite(Number(value)) ? Number(value) : null;
}

export function normalizeReviewFieldEvidenceEntry(entry = {}) {
	return {
		sourceType: normalizeWhitespace(entry.sourceType || entry.source_type || '').toLowerCase() || 'explicit',
		document: normalizeWhitespace(entry.document || '').toLowerCase(),
		label: normalizeWhitespace(entry.label || ''),
		page: Number.isFinite(Number(entry.page)) ? Number(entry.page) : null,
		line: normalizeLineNumber(entry.line),
		snippet: normalizeWhitespace(entry.snippet || ''),
		note: normalizeWhitespace(entry.note || ''),
		url: normalizeWhitespace(entry.url || ''),
		confidence: normalizeWhitespace(entry.confidence || '').toLowerCase()
	};
}

function buildEvidenceEntrySignature(entry = {}) {
	return [
		entry.sourceType || '',
		entry.document || '',
		entry.label || '',
		entry.page ?? '',
		entry.line ?? '',
		entry.snippet || '',
		entry.note || '',
		entry.url || ''
	].join('|');
}

export function normalizeReviewFieldEvidenceMap(value = {}) {
	const raw = value && typeof value === 'object' ? value : {};
	const normalized = {};

	for (const [fieldKey, entries] of Object.entries(raw)) {
		const list = toArray(entries).length === 0 && !Array.isArray(entries)
			? []
			: (Array.isArray(entries) ? entries : [entries]);
		const deduped = [];
		const seen = new Set();

		for (const candidate of list) {
			const normalizedEntry = normalizeReviewFieldEvidenceEntry(candidate);
			if (
				!normalizedEntry.document &&
				!normalizedEntry.url &&
				!normalizedEntry.note &&
				!normalizedEntry.snippet
			) {
				continue;
			}
			const signature = buildEvidenceEntrySignature(normalizedEntry);
			if (seen.has(signature)) continue;
			seen.add(signature);
			deduped.push(normalizedEntry);
		}

		if (deduped.length > 0) {
			normalized[fieldKey] = deduped;
		}
	}

	return normalized;
}

export function mergeReviewFieldEvidenceMaps(...maps) {
	const merged = {};
	for (const map of maps) {
		const normalized = normalizeReviewFieldEvidenceMap(map);
		for (const [fieldKey, entries] of Object.entries(normalized)) {
			merged[fieldKey] = normalizeReviewFieldEvidenceMap({
				[fieldKey]: [...(merged[fieldKey] || []), ...entries]
			})[fieldKey];
		}
	}
	return merged;
}

function formatCurrencyTerms(value) {
	const numericValue = typeof value === 'number' ? value : Number(String(value || '').replace(/[$,]/g, '').trim());
	if (!Number.isFinite(numericValue)) return [];
	const rounded = Math.round(numericValue);
	const withCommas = rounded.toLocaleString('en-US');
	return uniqTerms([
		`$${withCommas}`,
		`${withCommas}`,
		String(rounded)
	]);
}

function formatPercentTerms(value) {
	const numericValue = typeof value === 'number' ? value : Number(String(value || '').replace(/[%]/g, '').trim());
	if (!Number.isFinite(numericValue)) return [];
	const percent = Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue;
	const rounded = Number(percent.toFixed(2));
	const integer = Number(percent.toFixed(0));
	return uniqTerms([
		`${rounded}%`,
		`${rounded.toFixed(2)}%`,
		`${rounded.toFixed(1)}%`,
		`${integer}%`,
		String(numericValue)
	]);
}

function formatNumberTerms(value) {
	const numericValue = typeof value === 'number' ? value : Number(String(value || '').replace(/,/g, '').trim());
	if (!Number.isFinite(numericValue)) return [];
	const rounded = Math.round(numericValue);
	return uniqTerms([
		rounded.toLocaleString('en-US'),
		String(rounded),
		String(numericValue)
	]);
}

function buildNarrativeTerms(value = '') {
	return uniqTerms(
		normalizeWhitespace(value)
			.split(/[^A-Za-z0-9]+/)
			.map((token) => token.trim().toLowerCase())
			.filter((token) => token.length >= 4 && !NARRATIVE_STOP_WORDS.has(token))
			.slice(0, 6)
	);
}

function getOfferingTypeTerms(value = '') {
	const normalized = normalizeWhitespace(value).toLowerCase();
	if (normalized === '506(b)') return ['506(b)', 'rule 506(b)'];
	if (normalized === '506(c)') return ['506(c)', 'rule 506(c)'];
	return uniqTerms([value]);
}

function getFinancialTerms(value = '') {
	const normalized = normalizeWhitespace(value).toLowerCase();
	if (normalized === 'audited') return ['audited', 'audit', 'annual financial audit', 'annual audit'];
	if (normalized === 'reviewed') return ['reviewed'];
	if (normalized === 'unaudited') return ['unaudited', 'not audited'];
	return uniqTerms([value]);
}

function getAvailabilityTerms(value = '') {
	const normalized = normalizeWhitespace(value).toLowerCase();
	if (normalized === 'accredited investors') return ['accredited', 'accredited investors'];
	if (normalized === 'non-accredited investors') return ['non-accredited', 'non accredited'];
	if (normalized === 'both') return ['accredited', 'non-accredited'];
	return uniqTerms([value]);
}

function getLpShareTerms(value) {
	const numericValue = typeof value === 'number' ? value : Number(String(value || '').replace(/[%]/g, '').trim());
	if (!Number.isFinite(numericValue)) return [];
	const percent = Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue;
	const gpShare = Math.max(0, 100 - percent);
	return uniqTerms([
		`${Number(percent.toFixed(0))}%`,
		`${Number(percent.toFixed(0))}/${Number(gpShare.toFixed(0))}`,
		`${Number(percent.toFixed(0))}-${Number(gpShare.toFixed(0))}`,
		`${Number(percent.toFixed(0))}% of`,
		`${Number(gpShare.toFixed(0))}% of`
	]);
}

function getArrayTerms(fieldKey, value = []) {
	const list = Array.isArray(value) ? value : toArray(value);
	if (fieldKey === 'investingStates' || fieldKey === 'investingGeography') {
		return uniqTerms(
			mergeStateCodeLists(list).flatMap((stateCode) => [stateCode, STATE_NAME_BY_CODE[stateCode] || stateCode])
		);
	}
	return uniqTerms(list);
}

function getFieldSearchTerms(fieldKey, value) {
	switch (fieldKey) {
		case 'investmentName':
		case 'secEntityName':
		case 'issuerEntity':
		case 'gpEntity':
		case 'sponsorEntity':
		case 'companyWebsite':
			return uniqTerms([value]);
		case 'assetClass':
		case 'dealType':
		case 'strategy':
		case 'offeringStatus':
		case 'distributions':
		case 'redemption':
		case 'taxForm':
			return uniqTerms([value]);
		case 'offeringType':
			return getOfferingTypeTerms(value);
		case 'availableTo':
			return getAvailabilityTerms(value);
		case 'financials':
			return getFinancialTerms(value);
		case 'investmentMinimum':
		case 'offeringSize':
		case 'purchasePrice':
		case 'fundAUM':
		case 'currentFundSize':
		case 'loanCount':
		case 'totalAmountSold':
			return formatCurrencyTerms(value).concat(formatNumberTerms(value));
		case 'currentAvgLoanLtv':
		case 'maxAllowedLtv':
		case 'currentLeverage':
		case 'maxAllowedLeverage':
		case 'preferredReturn':
		case 'targetIRR':
		case 'cashOnCash':
		case 'cashYield':
		case 'historicalReturn2015':
		case 'historicalReturn2016':
		case 'historicalReturn2017':
		case 'historicalReturn2018':
		case 'historicalReturn2019':
		case 'historicalReturn2020':
		case 'historicalReturn2021':
		case 'historicalReturn2022':
		case 'historicalReturn2023':
		case 'historicalReturn2024':
		case 'historicalReturn2025':
			return formatPercentTerms(value);
		case 'lpGpSplit':
			return getLpShareTerms(value);
		case 'holdPeriod':
		case 'fundFoundedYear':
		case 'firmFoundedYear':
		case 'totalInvestors':
		case 'secCik':
			return formatNumberTerms(value).concat(uniqTerms([value]));
		case 'underlyingExposureTypes':
		case 'riskTags':
		case 'investingStates':
		case 'investingGeography':
			return getArrayTerms(fieldKey, value);
		case 'investmentStrategy':
		case 'shortSummary':
		case 'fees':
		case 'riskNotes':
		case 'downsideNotes':
		case 'additionalTermNotes':
		case 'operatorBackground':
		case 'keyDates':
		case 'redemptionNotes':
		case 'primarySourceContext':
			return buildNarrativeTerms(Array.isArray(value) ? value.join(' ') : value);
		default:
			if (Array.isArray(value)) return getArrayTerms(fieldKey, value);
			return uniqTerms([value]).concat(buildNarrativeTerms(value));
	}
}

function buildSearchableRows(pages = []) {
	const rows = [];
	for (const page of pages) {
		const lines = Array.isArray(page?.lines) ? page.lines : [];
		for (let index = 0; index < lines.length; index += 1) {
			const currentLine = normalizeWhitespace(lines[index]?.text || lines[index] || '');
			if (!currentLine) continue;
			const window = lines
				.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2))
				.map((line) => normalizeWhitespace(line?.text || line || ''))
				.filter(Boolean)
				.join(' ');
			rows.push({
				page: page.pageNumber || page.page || null,
				line: lines[index]?.lineNumber || index + 1,
				snippet: currentLine,
				context: normalizeWhitespace(window)
			});
		}
	}
	return rows;
}

function findBestDocumentMatch(pages = [], terms = [], { minimumMatches = 1 } = {}) {
	const normalizedTerms = uniqTerms(terms);
	if (normalizedTerms.length === 0) return null;
	const rows = buildSearchableRows(pages);
	let bestMatch = null;

	for (const row of rows) {
		const normalizedContext = normalizeSearchText(row.context);
		const normalizedSnippet = normalizeSearchText(row.snippet);
		let score = 0;
		let matches = 0;

		for (const term of normalizedTerms) {
			const normalizedTerm = normalizeSearchText(term);
			if (!normalizedTerm) continue;
			if (normalizedSnippet.includes(normalizedTerm)) {
				score += 3;
				matches += 1;
			} else if (normalizedContext.includes(normalizedTerm)) {
				score += 1;
				matches += 1;
			}
		}

		if (matches < minimumMatches || score === 0) continue;
		if (!bestMatch || score > bestMatch.score) {
			bestMatch = {
				page: row.page,
				line: row.line,
				snippet: row.context || row.snippet,
				score,
				matches
			};
		}
	}

	return bestMatch;
}

function documentLabel(document = '') {
	if (document === 'ppm') return 'PPM';
	if (document === 'deck') return 'Deck';
	if (document === 'sec') return 'EDGAR';
	if (document === 'manual') return 'Reviewer';
	if (document === 'web') return 'External';
	return 'Source';
}

function buildDocumentEvidenceEntry({ fieldKey, document, match, note = '', sourceType = 'explicit' }) {
	if (!match) return null;
	return normalizeReviewFieldEvidenceEntry({
		sourceType,
		document,
		label: documentLabel(document),
		page: match.page,
		line: match.line,
		snippet: match.snippet,
		note
	});
}

function buildSecEvidenceEntries(fieldKey, deal = {}, filing = null) {
	if (!SEC_EVIDENCE_FIELD_KEYS.has(fieldKey) || !filing) return [];

	const edgarUrl = normalizeWhitespace(filing?.edgar_url || filing?.edgarUrl || '');
	const base = {
		sourceType: 'verified',
		document: 'sec',
		label: 'EDGAR',
		url: edgarUrl
	};

	switch (fieldKey) {
		case 'offeringType': {
			const exemptions = Array.isArray(filing?.federal_exemptions) ? filing.federal_exemptions : [];
			const offeringType = exemptions.includes('06b') ? '506(b)' : exemptions.includes('06c') ? '506(c)' : '';
			if (!offeringType) return [];
			return [{
				...base,
				note: `Verified from the saved Form D exemptions as ${offeringType}.`,
				snippet: `Federal exemptions: ${exemptions.join(', ') || offeringType}`
			}];
		}
		case 'availableTo':
			return [{
				...base,
				note: filing?.has_non_accredited === true
					? 'SEC filing reports non-accredited investors.'
					: 'SEC filing does not report non-accredited investors.',
				snippet: filing?.has_non_accredited === true ? 'Non-accredited investors reported.' : 'No non-accredited investors reported.'
			}];
		case 'investmentMinimum':
			if (!isMeaningfulValue(filing?.minimum_investment)) return [];
			return [{
				...base,
				note: 'Verified against the saved SEC filing minimum investment.',
				snippet: `Minimum investment: $${Number(filing.minimum_investment).toLocaleString('en-US')}`
			}];
		case 'secEntityName':
		case 'issuerEntity':
			if (!normalizeWhitespace(filing?.entity_name)) return [];
			return [{
				...base,
				note: 'Verified against the matched SEC issuer entity.',
				snippet: `Issuer: ${filing.entity_name}`
			}];
		case 'secCik':
			if (!normalizeWhitespace(filing?.cik)) return [];
			return [{
				...base,
				note: 'Verified against the matched SEC filing.',
				snippet: `CIK: ${filing.cik}`
			}];
		case 'dateOfFirstSale':
			if (!normalizeWhitespace(filing?.date_of_first_sale)) return [];
			return [{
				...base,
				note: 'Verified against the matched SEC filing.',
				snippet: `Date of first sale: ${filing.date_of_first_sale}`
			}];
		case 'totalAmountSold':
			if (!isMeaningfulValue(filing?.total_amount_sold)) return [];
			return [{
				...base,
				note: 'Verified against the matched SEC filing.',
				snippet: `Total amount sold: $${Number(filing.total_amount_sold).toLocaleString('en-US')}`
			}];
		case 'totalInvestors':
			if (!isMeaningfulValue(filing?.total_investors)) return [];
			return [{
				...base,
				note: 'Verified against the matched SEC filing.',
				snippet: `Total investors: ${filing.total_investors}`
			}];
		default:
			return [];
	}
}

function buildGeographyEvidenceEntries(fieldKey, documents = {}) {
	if (!['investingStates', 'investingGeography'].includes(fieldKey)) return [];
	const ppmText = documents?.ppm?.text || '';
	const deckText = documents?.deck?.text || '';
	const signals = buildDocumentInvestingStateSignals({ ppmText, deckText });
	const entries = [];

	if (signals.ppmStates.length > 0) {
		const match = findBestDocumentMatch(documents?.ppm?.pages || [], getArrayTerms(fieldKey, signals.ppmStates), {
			minimumMatches: Math.min(2, signals.ppmStates.length)
		});
		if (match) {
			entries.push(buildDocumentEvidenceEntry({
				fieldKey,
				document: 'ppm',
				match,
				sourceType: 'derived',
				note: `PPM states: ${signals.ppmStates.map((state) => STATE_NAME_BY_CODE[state] || state).join(', ')}.`
			}));
		}
	}

	if (signals.deckStates.length > 0) {
		const match = findBestDocumentMatch(documents?.deck?.pages || [], getArrayTerms(fieldKey, signals.deckStates), {
			minimumMatches: Math.min(2, signals.deckStates.length)
		});
		if (match) {
			entries.push(buildDocumentEvidenceEntry({
				fieldKey,
				document: 'deck',
				match,
				sourceType: 'derived',
				note: `Deck states: ${signals.deckStates.map((state) => STATE_NAME_BY_CODE[state] || state).join(', ')}.`
			}));
		}
	}

	return entries.filter(Boolean);
}

function buildFieldEvidenceEntries(fieldKey, value, documents = {}) {
	if (!isMeaningfulValue(value)) return [];
	if (fieldKey === 'investingStates' || fieldKey === 'investingGeography') {
		return buildGeographyEvidenceEntries(fieldKey, documents);
	}

	const searchTerms = getFieldSearchTerms(fieldKey, value);
	if (searchTerms.length === 0) return [];

	const minimumMatches =
		fieldKey === 'investmentStrategy' ||
		fieldKey === 'shortSummary' ||
		fieldKey === 'fees' ||
		fieldKey === 'riskNotes' ||
		fieldKey === 'downsideNotes' ||
		fieldKey === 'additionalTermNotes'
			? Math.min(2, searchTerms.length)
			: 1;

	const results = [];
	for (const document of ['ppm', 'deck']) {
		const pages = documents?.[document]?.pages || [];
		if (pages.length === 0) continue;
		const match = findBestDocumentMatch(pages, searchTerms, { minimumMatches });
		if (!match) continue;
		results.push(
			buildDocumentEvidenceEntry({
				fieldKey,
				document,
				match,
				sourceType:
					fieldKey === 'lpGpSplit' ||
					fieldKey === 'investmentStrategy' ||
					fieldKey === 'shortSummary' ||
					fieldKey === 'fees'
						? 'derived'
						: 'explicit'
			})
		);
	}

	return results.filter(Boolean);
}

export function buildReviewFieldEvidenceMap({
	deal = {},
	fieldKeys = [],
	documents = {},
	filing = null
} = {}) {
	const normalizedFieldKeys = Array.from(new Set((fieldKeys || []).filter(Boolean)));
	const evidence = {};

	for (const fieldKey of normalizedFieldKeys) {
		const value = readReviewFieldValue(deal, fieldKey);
		const entries = [
			...buildSecEvidenceEntries(fieldKey, deal, filing),
			...buildFieldEvidenceEntries(fieldKey, value, documents)
		];
		if (entries.length > 0) {
			evidence[fieldKey] = normalizeReviewFieldEvidenceMap({ [fieldKey]: entries })[fieldKey];
		}
	}

	return evidence;
}

export function buildReviewFieldEvidenceHref(entry = {}, documentUrls = {}) {
	const normalized = normalizeReviewFieldEvidenceEntry(entry);
	if (normalized.url) return normalized.url;

	const documentUrl =
		normalized.document === 'ppm'
			? normalizeWhitespace(documentUrls?.ppmUrl || documentUrls?.ppm || '')
			: normalized.document === 'deck'
				? normalizeWhitespace(documentUrls?.deckUrl || documentUrls?.deck || '')
				: normalized.document === 'sub'
					? normalizeWhitespace(documentUrls?.subAgreementUrl || documentUrls?.sub || '')
					: '';

	if (!documentUrl) return '';
	if (!normalized.page) return documentUrl;
	return `${documentUrl}#page=${normalized.page}`;
}

export function formatReviewFieldEvidenceAnchor(entry = {}) {
	const normalized = normalizeReviewFieldEvidenceEntry(entry);
	const parts = [normalized.label || documentLabel(normalized.document)];
	if (normalized.page) parts.push(`p.${normalized.page}`);
	if (normalized.line) parts.push(`line ${normalized.line}`);
	return parts.join(' · ');
}

export function getReviewFieldEvidenceTone(entries = [], value) {
	if (entries.length > 0) return 'neutral';
	return isMeaningfulValue(value) ? 'warning' : 'muted';
}
