const DOCUMENT_SOURCE_DEFS = [
	{ key: 'deck', label: 'Investment deck', aliases: ['deckUrl', 'deck_url'] },
	{ key: 'ppm', label: 'PPM', aliases: ['ppmUrl', 'ppm_url'] },
	{ key: 'subAgreement', label: 'Subscription agreement', aliases: ['subAgreementUrl', 'sub_agreement_url'] },
	{
		key: 'primarySource',
		label: 'Primary source',
		aliases: ['primarySourceUrl', 'primary_source_url'],
		contextAliases: ['primarySourceContext', 'primary_source_context']
	}
];

const BACKGROUND_SOURCE_DEFS = [
	{ key: 'sec', label: 'SEC EDGAR' },
	{ key: 'finra', label: 'FINRA BrokerCheck' },
	{ key: 'iapd', label: 'IAPD' },
	{ key: 'ofac', label: 'OFAC' },
	{ key: 'court', label: 'Federal courts' },
	{ key: 'courtCompany', label: 'Federal courts (company)' }
];

const FINDING_FIELD_DEFS = [
	{
		key: 'riskNotes',
		label: 'Risk notes',
		aliases: ['riskNotes', 'risk_notes'],
		severity: 'medium',
		docSourceKeys: ['deck', 'ppm', 'primarySource']
	},
	{
		key: 'downsideNotes',
		label: 'Downside case',
		aliases: ['downsideNotes', 'downside_notes'],
		severity: 'medium',
		docSourceKeys: ['deck', 'ppm', 'primarySource']
	},
	{
		key: 'operatorBackground',
		label: 'Operator background',
		aliases: ['operatorBackground', 'operator_background'],
		severity: 'medium',
		docSourceKeys: ['primarySource']
	},
	{
		key: 'keyDates',
		label: 'Key dates',
		aliases: ['keyDates', 'key_dates', 'dateOfFirstSale', 'date_of_first_sale'],
		severity: 'low',
		docSourceKeys: ['deck', 'ppm', 'subAgreement', 'primarySource']
	},
	{
		key: 'redemption',
		label: 'Liquidity / redemption terms',
		aliases: ['redemption', 'liquidityTerms', 'liquidity_terms'],
		severity: 'medium',
		docSourceKeys: ['ppm', 'subAgreement', 'primarySource']
	},
	{
		key: 'feeSummary',
		label: 'Fee summary',
		aliases: ['feeSummary', 'fee_summary', 'fees'],
		severity: 'low',
		docSourceKeys: ['deck', 'ppm', 'primarySource']
	}
];

const REQUIRED_COVERAGE = [
	{
		key: 'coreSource',
		label: 'Core source document',
		description: 'Attach a deck, PPM, subscription agreement, or primary source URL.',
		check: (context) => context.sourceDocuments.length > 0
	},
	{
		key: 'riskNotes',
		label: 'Structured risk notes',
		description: 'Capture the main risks in a dedicated field instead of burying them in freeform copy.',
		check: (context) => hasMeaningfulText(context.fieldValues.riskNotes)
	},
	{
		key: 'downsideNotes',
		label: 'Downside case',
		description: 'Document what breaks the deal and what assumptions are most fragile.',
		check: (context) => hasMeaningfulText(context.fieldValues.downsideNotes)
	},
	{
		key: 'operatorBackground',
		label: 'Operator background validation',
		description: 'Provide structured operator background or attach a background-check result.',
		check: (context) => hasMeaningfulText(context.fieldValues.operatorBackground) || context.backgroundChecks.length > 0
	},
	{
		key: 'keyDates',
		label: 'Key dates',
		description: 'Capture first sale, target close, funding windows, or other timing dependencies.',
		check: (context) => hasMeaningfulText(context.fieldValues.keyDates)
	}
];

export function buildRiskSourceValidationModel(deal, backgroundCheck = null) {
	const normalizedDeal = deal && typeof deal === 'object' ? deal : {};
	// This stage is intentionally derived from existing deal fields plus an optional
	// background-check row so we do not create a second persistence layer for risks.
	const normalizedBackgroundCheck = normalizeBackgroundCheck(backgroundCheck || normalizedDeal.backgroundCheck || null);
	const sourceDocuments = buildSourceDocuments(normalizedDeal);
	const backgroundChecks = buildBackgroundChecks(normalizedBackgroundCheck);
	const fieldValues = Object.fromEntries(
		FINDING_FIELD_DEFS.map((field) => [field.key, sanitizeText(firstMeaningfulValue(normalizedDeal, field.aliases))])
	);
	const findings = [
		...buildFieldBackedFindings(fieldValues, sourceDocuments),
		...buildBackgroundCheckFindings(normalizedBackgroundCheck)
	];
	const missingCoverage = REQUIRED_COVERAGE
		.filter((item) => !item.check({ fieldValues, sourceDocuments, backgroundChecks }))
		.map((item) => ({
			key: item.key,
			label: item.label,
			description: item.description
		}));

	const sourceIndex = buildSourceIndex(sourceDocuments, backgroundChecks);
	const readiness =
		sourceDocuments.length === 0
			? 'missing_sources'
			: missingCoverage.length > 0
				? 'partial'
				: 'ready';

	return {
		readiness,
		readinessLabel: getReadinessLabel(readiness),
		sourceDocuments,
		backgroundChecks,
		findings,
		missingCoverage,
		sourceIndex,
		counts: {
			sourceDocuments: sourceDocuments.length,
			backgroundChecks: backgroundChecks.length,
			findings: findings.length,
			missingCoverage: missingCoverage.length
		},
		summary: buildSummary(readiness, sourceDocuments, backgroundChecks, findings, missingCoverage)
	};
}

export function normalizeBackgroundCheck(backgroundCheck) {
	const rawBackgroundCheck = Array.isArray(backgroundCheck)
		? backgroundCheck[0]
		: (backgroundCheck?.result || backgroundCheck?.results?.[0] || backgroundCheck);

	if (!rawBackgroundCheck || typeof rawBackgroundCheck !== 'object') return null;

	// Background checks can arrive as a live API result or a persisted DB row where
	// source URLs and searched names may be packed into the summary JSON.
	const summary = parseSummary(rawBackgroundCheck.summary);

	return {
		...rawBackgroundCheck,
		sourceUrls:
			rawBackgroundCheck.source_urls
			|| rawBackgroundCheck.sourceUrls
			|| summary?.sourceUrls
			|| {},
		searchedNames:
			rawBackgroundCheck.searched_names
			|| rawBackgroundCheck.searchedNames
			|| summary?.searchedNames
			|| {},
		flags: Array.isArray(rawBackgroundCheck.flags) ? rawBackgroundCheck.flags : [],
		overallStatus:
			rawBackgroundCheck.overall_status
			|| rawBackgroundCheck.overallStatus
			|| 'pending'
	};
}

function buildSourceDocuments(deal) {
	const documents = [];
	const seen = new Set();

	for (const definition of DOCUMENT_SOURCE_DEFS) {
		const url = normalizeUrl(firstMeaningfulValue(deal, definition.aliases));
		if (!url || seen.has(url)) continue;
		seen.add(url);
		documents.push({
			key: definition.key,
			label: definition.label,
			url,
			context: sanitizeText(firstMeaningfulValue(deal, definition.contextAliases || []))
		});
	}

	return documents;
}

function buildBackgroundChecks(backgroundCheck) {
	if (!backgroundCheck) return [];

	return BACKGROUND_SOURCE_DEFS
		.map((definition) => {
			const url = normalizeUrl(backgroundCheck.sourceUrls?.[definition.key]);
			const status = getBackgroundCheckStatus(backgroundCheck, definition.key);
			const detail = getBackgroundCheckDetail(backgroundCheck, definition.key);
			const searchedName = sanitizeText(backgroundCheck.searchedNames?.[definition.key]);
			if (!url && status === 'pending' && !detail && !searchedName) return null;

			return {
				key: definition.key,
				label: definition.label,
				url,
				status,
				statusLabel: getBackgroundCheckStatusLabel(status),
				detail,
				searchedName
			};
		})
		.filter(Boolean);
}

function buildFieldBackedFindings(fieldValues, sourceDocuments) {
	const availableDocumentKeys = new Set(sourceDocuments.map((document) => document.key));

	return FINDING_FIELD_DEFS
		.map((definition) => {
			const rawValue = fieldValues[definition.key];
			if (!hasMeaningfulText(rawValue)) return null;

			return {
				key: definition.key,
				label: definition.label,
				summary: summarizeText(rawValue),
				detail: rawValue,
				severity: definition.severity,
				sourceKeys: definition.docSourceKeys.filter((key) => availableDocumentKeys.has(key)),
				evidenceType: 'structured_field'
			};
		})
		.filter(Boolean);
}

function buildBackgroundCheckFindings(backgroundCheck) {
	if (!backgroundCheck) return [];

	const flags = Array.isArray(backgroundCheck.flags) ? backgroundCheck.flags : [];
	if (flags.length === 0) return [];

	return flags.map((flag, index) => ({
		key: `background-flag-${index + 1}`,
		label: flag.source ? `${flag.source} check` : 'Background check',
		summary: sanitizeText(flag.message) || 'Background check returned a flagged item.',
		detail: sanitizeText(flag.message) || 'Background check returned a flagged item.',
		severity: normalizeSeverity(flag.severity),
		sourceKeys: mapBackgroundFlagSource(flag.source),
		evidenceType: 'background_check'
	}));
}

function buildSourceIndex(sourceDocuments, backgroundChecks) {
	const index = {};
	for (const document of sourceDocuments) index[document.key] = document;
	for (const check of backgroundChecks) index[check.key] = check;
	return index;
}

function buildSummary(readiness, sourceDocuments, backgroundChecks, findings, missingCoverage) {
	if (readiness === 'missing_sources') {
		return 'No source documents are linked yet, so risk validation is still operating without a primary source set.';
	}
	if (findings.length === 0 && backgroundChecks.length === 0) {
		return 'Source documents are present, but there are no structured risk highlights or third-party validation records attached yet.';
	}
	if (missingCoverage.length === 0) {
		return `Risk validation is backed by ${sourceDocuments.length} source document${sourceDocuments.length === 1 ? '' : 's'} and ${findings.length} structured finding${findings.length === 1 ? '' : 's'}.`;
	}
	return `Risk validation has ${findings.length} structured finding${findings.length === 1 ? '' : 's'}, but ${missingCoverage.length} coverage area${missingCoverage.length === 1 ? ' is' : 's are'} still missing.`;
}

function firstMeaningfulValue(record, aliases = []) {
	for (const alias of aliases) {
		if (!alias) continue;
		const value = readPath(record, alias);
		if (hasMeaningfulValue(value)) return value;
	}
	return null;
}

function readPath(record, path) {
	if (!record || !path) return undefined;
	if (!String(path).includes('.')) return record[path];
	return String(path)
		.split('.')
		.reduce((value, part) => (value && typeof value === 'object' ? value[part] : undefined), record);
}

function hasMeaningfulValue(value) {
	if (value === null || value === undefined) return false;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === 'object') return Object.keys(value).length > 0;
	if (typeof value === 'number') return !Number.isNaN(value);
	return String(value).trim().length > 0;
}

function hasMeaningfulText(value) {
	return sanitizeText(value).length > 0;
}

function sanitizeText(value) {
	if (value === null || value === undefined) return '';
	if (typeof value === 'string') return value.trim();
	if (Array.isArray(value)) return value.map((item) => sanitizeText(item)).filter(Boolean).join(' | ').trim();
	if (typeof value === 'object') return JSON.stringify(value);
	return String(value).trim();
}

function summarizeText(value) {
	const text = sanitizeText(value).replace(/\s+/g, ' ');
	if (text.length <= 180) return text;
	return text.slice(0, 177).trimEnd() + '...';
}

function normalizeUrl(value) {
	const text = sanitizeText(value);
	if (!text) return '';
	if (/^https?:\/\//i.test(text)) return text;
	return '';
}

function parseSummary(summary) {
	if (!summary || typeof summary !== 'string' || summary.charAt(0) !== '{') return null;
	try {
		return JSON.parse(summary);
	} catch {
		return null;
	}
}

function getBackgroundCheckStatus(backgroundCheck, key) {
	if (!backgroundCheck) return 'pending';
	let status =
		backgroundCheck[`${key}Status`]
		|| backgroundCheck[`${key}_status`]
		|| 'pending';
	if (key === 'iapd' && status === 'error') status = 'not_found';
	return String(status);
}

function getBackgroundCheckDetail(backgroundCheck, key) {
	switch (key) {
		case 'sec': {
			const count = backgroundCheck.sec_filings_count || backgroundCheck.secFilingsCount || 0;
			return count > 0 ? `${count} filing${count === 1 ? '' : 's'} found` : 'No Form D filings found';
		}
		case 'finra': {
			if (backgroundCheck.finra_found || backgroundCheck.finraFound) {
				const disclosures = backgroundCheck.finra_disclosures || backgroundCheck.finraDisclosures || 0;
				return disclosures > 0 ? `${disclosures} disclosure${disclosures === 1 ? '' : 's'} found` : 'Registered, no disclosures';
			}
			return 'Not registered';
		}
		case 'iapd': {
			if (backgroundCheck.iapd_found || backgroundCheck.iapdFound) {
				const disclosures = backgroundCheck.iapd_disclosures || backgroundCheck.iapdDisclosures || 0;
				return disclosures > 0 ? `${disclosures} disclosure${disclosures === 1 ? '' : 's'} found` : 'Registered adviser, clean record';
			}
			return 'Not found';
		}
		case 'ofac':
			return backgroundCheck.ofac_found || backgroundCheck.ofacFound ? 'Potential match found' : 'No sanctions match';
		case 'court':
		case 'courtCompany': {
			const count = backgroundCheck.court_cases_count || backgroundCheck.courtCasesCount || 0;
			return `${count} case${count === 1 ? '' : 's'} found`;
		}
		default:
			return '';
	}
}

function getBackgroundCheckStatusLabel(status) {
	switch (status) {
		case 'clear':
			return 'Clear';
		case 'flagged':
			return 'Flagged';
		case 'needs_review':
			return 'Needs review';
		case 'not_found':
			return 'Not found';
		case 'not_checked':
			return 'Not checked';
		case 'error':
			return 'Error';
		default:
			return 'Pending';
	}
}

function mapBackgroundFlagSource(source) {
	const normalized = sanitizeText(source).toLowerCase();
	if (!normalized) return [];
	if (normalized.includes('sec')) return ['sec'];
	if (normalized.includes('finra')) return ['finra'];
	if (normalized.includes('iapd')) return ['iapd'];
	if (normalized.includes('ofac')) return ['ofac'];
	if (normalized.includes('court')) return ['court'];
	return [];
}

function normalizeSeverity(value) {
	const normalized = sanitizeText(value).toLowerCase();
	if (normalized === 'high' || normalized === 'medium') return normalized;
	return 'low';
}

function getReadinessLabel(readiness) {
	if (readiness === 'ready') return 'Source-backed';
	if (readiness === 'partial') return 'Partially validated';
	return 'Missing sources';
}
