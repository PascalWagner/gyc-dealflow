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

const STATE_CODE_BY_NAME = Object.fromEntries(
	Object.entries(STATE_NAME_BY_CODE).map(([code, name]) => [name.toLowerCase(), code])
);

const ALL_STATE_CODES = Object.keys(STATE_NAME_BY_CODE);

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
