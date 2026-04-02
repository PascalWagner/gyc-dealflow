export const STATE_NAME_BY_CODE = {
	AL: 'Alabama',
	AK: 'Alaska',
	AZ: 'Arizona',
	AR: 'Arkansas',
	CA: 'California',
	CO: 'Colorado',
	CT: 'Connecticut',
	DE: 'Delaware',
	FL: 'Florida',
	GA: 'Georgia',
	HI: 'Hawaii',
	ID: 'Idaho',
	IL: 'Illinois',
	IN: 'Indiana',
	IA: 'Iowa',
	KS: 'Kansas',
	KY: 'Kentucky',
	LA: 'Louisiana',
	ME: 'Maine',
	MD: 'Maryland',
	MA: 'Massachusetts',
	MI: 'Michigan',
	MN: 'Minnesota',
	MS: 'Mississippi',
	MO: 'Missouri',
	MT: 'Montana',
	NE: 'Nebraska',
	NV: 'Nevada',
	NH: 'New Hampshire',
	NJ: 'New Jersey',
	NM: 'New Mexico',
	NY: 'New York',
	NC: 'North Carolina',
	ND: 'North Dakota',
	OH: 'Ohio',
	OK: 'Oklahoma',
	OR: 'Oregon',
	PA: 'Pennsylvania',
	RI: 'Rhode Island',
	SC: 'South Carolina',
	SD: 'South Dakota',
	TN: 'Tennessee',
	TX: 'Texas',
	UT: 'Utah',
	VT: 'Vermont',
	VA: 'Virginia',
	WA: 'Washington',
	WV: 'West Virginia',
	WI: 'Wisconsin',
	WY: 'Wyoming'
};

function escapeRegExp(value) {
	return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const STATE_CODE_BY_NAME = Object.fromEntries(
	Object.entries(STATE_NAME_BY_CODE).map(([code, name]) => [name.toLowerCase(), code])
);

const ALL_STATE_CODES = Object.keys(STATE_NAME_BY_CODE);
const ORDERED_STATE_ENTRIES = Object.entries(STATE_NAME_BY_CODE)
	.sort(([, leftName], [, rightName]) => rightName.length - leftName.length);

const REGION_STATE_GROUPS = {
	nationwide: ALL_STATE_CODES,
	national: ALL_STATE_CODES,
	usa: ALL_STATE_CODES,
	'united states': ALL_STATE_CODES,
	'all states': ALL_STATE_CODES,
	southeast: ['FL', 'GA', 'SC', 'NC', 'VA', 'TN', 'AL', 'MS', 'LA', 'AR', 'KY', 'WV'],
	southwest: ['TX', 'AZ', 'NM', 'OK', 'NV'],
	northeast: ['NY', 'NJ', 'CT', 'MA', 'PA', 'ME', 'NH', 'VT', 'RI', 'DE', 'MD'],
	midwest: ['OH', 'MI', 'IN', 'IL', 'WI', 'MN', 'IA', 'MO', 'KS', 'NE', 'SD', 'ND'],
	'west coast': ['CA', 'OR', 'WA'],
	'pacific northwest': ['OR', 'WA', 'ID'],
	'sun belt': ['FL', 'GA', 'SC', 'NC', 'TX', 'AZ', 'NM', 'NV', 'CA', 'TN', 'AL', 'LA'],
	'east coast': ['FL', 'GA', 'SC', 'NC', 'VA', 'MD', 'DE', 'NJ', 'NY', 'CT', 'RI', 'MA', 'NH', 'ME']
};

const DOCUMENT_GEOGRAPHY_CONTEXT_PATTERNS = [
	/\bprimary focus\b/i,
	/\bwestern region\b/i,
	/\bcurrent core markets?\b/i,
	/\bfuture core markets?\b/i,
	/\bnew core markets?\b/i,
	/\bmarket expansion\b/i,
	/\bbreakdown by state\b/i,
	/\bportfolio construction\b/i,
	/\bfast-growing sunbelt states?\b/i,
	/\bincluding\b/i,
	/\blocated primarily\b/i,
	/\blocation of real property\b/i,
	/\blocation of properties\b/i,
	/\binvest in properties\b/i,
	/\bmake loans\b/i,
	/\boperates in\b/i,
	/\bfootprint\b/i
];

const DOCUMENT_GEOGRAPHY_EXCLUSION_PATTERNS = [
	/\bsources?:/i,
	/\bdepartment of commerce\b/i,
	/\beconomic development\b/i,
	/\bpress release\b/i,
	/\bannual review\b/i,
	/\byear in review\b/i,
	/\bmassachusetts or similar business trust\b/i,
	/\bborn in\b/i,
	/\blives in\b/i,
	/\buniversity\b/i,
	/\bstate bar\b/i,
	/\barizona act\b/i,
	/\barizona rules\b/i,
	/\barizona corporation commission\b/i,
	/\bgoverning law\b/i,
	/\btax law\b/i,
	/\bstate and local tax\b/i
];

function normalizeDocumentLine(value) {
	return String(value || '')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/\s+/g, ' ')
		.trim();
}

function collapseBrokenStateLines(lines) {
	const collapsed = [];
	for (let index = 0; index < lines.length; index += 1) {
		const current = normalizeDocumentLine(lines[index]);
		const next = normalizeDocumentLine(lines[index + 1]);
		if (!current) continue;

		const combined = normalizeStateCode(`${current} ${next}`);
		if (!normalizeStateCode(current) && next && combined) {
			collapsed.push(STATE_NAME_BY_CODE[combined] || `${current} ${next}`);
			index += 1;
			continue;
		}

		collapsed.push(current);
	}
	return collapsed;
}

function extractDocumentStateCodes(text) {
	const rawLines = String(text || '').split(/\r?\n/);
	if (rawLines.length === 0) return [];

	const lines = collapseBrokenStateLines(rawLines);
	const extracted = [];
	const seen = new Set();

	const addStatesFromText = (value) => {
		for (const stateCode of extractExplicitStateCodes(value)) {
			appendState(extracted, seen, stateCode);
		}
	};

	for (let index = 0; index < lines.length; index += 1) {
		const line = normalizeDocumentLine(lines[index]);
		if (!line) continue;

		const nearbyLines = lines
			.slice(Math.max(0, index - 15), Math.min(lines.length, index + 16))
			.map((entry) => normalizeDocumentLine(entry))
			.filter(Boolean);
		const nearbyText = nearbyLines.join(' ');
		const stateCount = extractExplicitStateCodes(line).length;
		const hasContext = DOCUMENT_GEOGRAPHY_CONTEXT_PATTERNS.some((pattern) => pattern.test(line) || pattern.test(nearbyText));
		const hasExclusion = DOCUMENT_GEOGRAPHY_EXCLUSION_PATTERNS.some((pattern) => pattern.test(line));

		if (hasExclusion) continue;
		if (stateCount >= 2) {
			addStatesFromText(line);
			continue;
		}
		if (stateCount >= 1 && hasContext) {
			addStatesFromText(line);
		}
	}

	return extracted;
}

function appendState(matches, seen, stateCode) {
	if (!stateCode || seen.has(stateCode)) return;
	seen.add(stateCode);
	matches.push(stateCode);
}

function isCreditDeal(deal) {
	const text = [
		deal?.assetClass,
		deal?.strategy,
		deal?.investmentType,
		deal?.investmentName
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
	return /credit|debt|loan|lending|note/.test(text);
}

function formatUnitCount(value) {
	const numeric = Number(String(value || '').replace(/,/g, '').trim());
	if (!Number.isFinite(numeric) || numeric <= 0) return null;
	return numeric.toLocaleString('en-US');
}

function stateListLabel(stateCodes) {
	const stateNames = stateCodes.map((code) => STATE_NAME_BY_CODE[code] || code);
	if (stateNames.length === 0) return '';
	if (stateNames.length === 1) return stateNames[0];
	if (stateNames.length === 2) return `${stateNames[0]} and ${stateNames[1]}`;
	return `${stateNames.slice(0, -1).join(', ')}, and ${stateNames[stateNames.length - 1]}`;
}

export function normalizeStateCode(value) {
	if (!value) return null;
	const normalized = String(value).trim();
	if (STATE_NAME_BY_CODE[normalized.toUpperCase()]) return normalized.toUpperCase();
	return STATE_CODE_BY_NAME[normalized.toLowerCase()] || null;
}

export function mergeStateCodeLists(...lists) {
	const merged = [];
	const seen = new Set();

	for (const list of lists) {
		for (const value of Array.isArray(list) ? list : []) {
			const stateCode = normalizeStateCode(value);
			if (!stateCode || seen.has(stateCode)) continue;
			seen.add(stateCode);
			merged.push(stateCode);
		}
	}

	return merged;
}

export function extractExplicitStateCodes(text) {
	const raw = String(text || '');
	if (!raw) return [];

	const matches = [];
	for (const [stateCode, stateName] of ORDERED_STATE_ENTRIES) {
		const pattern = new RegExp(`\\b${escapeRegExp(stateName)}\\b`, 'gi');
		for (const match of raw.matchAll(pattern)) {
			matches.push({
				stateCode,
				index: match.index ?? 0
			});
		}
	}

	return mergeStateCodeLists(
		matches
			.sort((left, right) => left.index - right.index)
			.map((match) => match.stateCode)
	);
}

export function buildDocumentInvestingStateSignals({ ppmText = '', deckText = '' } = {}) {
	const ppmStates = extractDocumentStateCodes(ppmText);
	const deckStates = extractDocumentStateCodes(deckText);
	const suggestedStates = mergeStateCodeLists(ppmStates, deckStates);

	return {
		ppmStates,
		deckStates,
		suggestedStates
	};
}

export function formatStateCodesAsGeographyValue(stateCodes, { includeCountry = true } = {}) {
	const normalizedStates = mergeStateCodeLists(stateCodes);
	if (normalizedStates.length === 0) return includeCountry ? 'United States' : '';
	return includeCountry
		? `${normalizedStates.join(', ')}, United States`
		: normalizedStates.join(', ');
}

export function getDealStateCodes(deal) {
	if (!deal) return [];

	const matches = [];
	const seen = new Set();
	const geographyText = [
		deal.state,
		deal.regionState,
		deal.investingGeography,
		deal.location,
		deal.address,
		deal.propertyAddress
	]
		.filter(Boolean)
		.join(' ');

	appendState(matches, seen, normalizeStateCode(deal.state));
	appendState(matches, seen, normalizeStateCode(deal.regionState));

	const lowerText = geographyText.toLowerCase();
	for (const [regionLabel, regionStates] of Object.entries(REGION_STATE_GROUPS)) {
		if (!lowerText.includes(regionLabel)) continue;
		for (const stateCode of regionStates) appendState(matches, seen, stateCode);
	}

	for (const [stateCode, stateName] of Object.entries(STATE_NAME_BY_CODE)) {
		if (new RegExp(`\\b${stateName}\\b`, 'i').test(geographyText)) {
			appendState(matches, seen, stateCode);
		}
	}

	const abbrRe = /\b([A-Z]{2})\b/g;
	let abbrMatch;
	while ((abbrMatch = abbrRe.exec(geographyText)) !== null) {
		appendState(matches, seen, normalizeStateCode(abbrMatch[1]));
	}

	return matches;
}

export function buildInvestingGeographyModel(deal) {
	const highlightedStates = getDealStateCodes(deal);
	const isNationwide = highlightedStates.length > 40;
	const geographyLabel =
		deal?.investingGeography ||
		deal?.location ||
		(highlightedStates.length === 1
			? `${STATE_NAME_BY_CODE[highlightedStates[0]]} focus`
			: highlightedStates.length > 1
				? `${highlightedStates.length} target states`
				: 'Geography not specified');

	let description = '';
	if (isNationwide) {
		description =
			'This deal invests across the entire United States, providing broad geographic diversification across multiple markets and regions.';
	} else if (highlightedStates.length > 5) {
		description = `This deal targets properties across ${highlightedStates.length} states, offering regional diversification across ${geographyLabel} markets.`;
	} else if (highlightedStates.length > 1) {
		description = `This deal focuses on ${stateListLabel(highlightedStates)}.`;
	} else if (highlightedStates.length === 1) {
		description = `This deal is concentrated in ${STATE_NAME_BY_CODE[highlightedStates[0]] || highlightedStates[0]}.`;
	} else {
		const creditLabel = isCreditDeal(deal) ? 'providing loans' : 'investing';
		description = `Specific geographic data is not yet available for this deal. The operator has not disclosed which states they are ${creditLabel} in, or the geography data is still being processed.`;
	}

	const metaItems = [];
	if (deal?.assetClass) metaItems.push({ label: 'Asset Class', value: deal.assetClass });
	if (deal?.strategy) metaItems.push({ label: 'Strategy', value: deal.strategy });
	const formattedUnits = formatUnitCount(deal?.unitCount);
	if (formattedUnits) metaItems.push({ label: 'Units', value: formattedUnits });
	if (deal?.propertyType) metaItems.push({ label: 'Property Type', value: deal.propertyType });

	return {
		highlightedStates,
		highlightedStateSet: new Set(highlightedStates),
		isNationwide,
		allHighlighted: isNationwide,
		badgeLabel: highlightedStates.length > 0 ? (isNationwide ? 'Nationwide' : geographyLabel) : 'Not Disclosed',
		address: deal?.address || deal?.propertyAddress || '',
		description,
		metaItems
	};
}
