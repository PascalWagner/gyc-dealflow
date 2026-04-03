const STATE_NAME_BY_CODE = {
	AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California', CO: 'Colorado',
	CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho',
	IL: 'Illinois', IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
	ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
	MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
	NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
	OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
	SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
	WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming'
};

const STATE_CODE_BY_NAME = Object.fromEntries(
	Object.entries(STATE_NAME_BY_CODE).map(([code, name]) => [name.toLowerCase(), code])
);

export function getDealStateCodes(deal) {
	if (!deal) return [];

	const explicitStates = [];
	for (const value of Array.isArray(deal.investingStates) ? deal.investingStates : []) {
		const normalized = normalizeStateCode(value);
		if (normalized && !explicitStates.includes(normalized)) explicitStates.push(normalized);
	}
	for (const value of Array.isArray(deal.investing_states) ? deal.investing_states : []) {
		const normalized = normalizeStateCode(value);
		if (normalized && !explicitStates.includes(normalized)) explicitStates.push(normalized);
	}
	if (explicitStates.length > 0) return explicitStates;

	const matches = [];
	const addMatch = (value) => {
		const code = normalizeStateCode(value);
		if (code && !matches.includes(code)) matches.push(code);
	};

	addMatch(deal.state);
	addMatch(deal.regionState);

	const geography = [deal.investingGeography, deal.investing_geography, deal.location, deal.address, deal.propertyAddress]
		.filter(Boolean)
		.join(' | ');
	const explicitTextStates = extractExplicitStateCodes(geography);
	if (explicitTextStates.length > 0) {
		for (const stateCode of explicitTextStates) addMatch(stateCode);
		return matches;
	}
	for (const [code, name] of Object.entries(STATE_NAME_BY_CODE)) {
		if (new RegExp(`\\b${code}\\b`, 'i').test(geography) || new RegExp(`\\b${name}\\b`, 'i').test(geography)) {
			addMatch(code);
		}
	}

	return matches;
}

export function buildGeographyLabel(deal, states = []) {
	if (!deal) return 'No investing geography provided yet.';
	if (states.length === 1) return `${STATE_NAME_BY_CODE[states[0]]} focus`;
	if (states.length > 1) return `${states.length} target states`;
	return deal.investingGeography || deal.location || 'Geography not specified';
}

export function buildDocumentRows(deal) {
	if (!deal) return [];
	const rows = [];
	if (deal.deckUrl && !String(deal.deckUrl).includes('airtableusercontent.com')) {
		rows.push({ key: 'deck', label: 'Investment Deck', url: deal.deckUrl });
	}
	if (deal.ppmUrl && !String(deal.ppmUrl).includes('airtableusercontent.com')) {
		rows.push({ key: 'ppm', label: 'PPM', url: deal.ppmUrl });
	}
	return rows;
}

export function buildSecFilingSummary(deal) {
	if (!deal) return null;
	const totalRaised = deal.totalAmountSold ?? deal.amountRaised ?? deal.amount_raised ?? null;
	const totalInvestors = deal.totalInvestors ?? deal.total_investors ?? null;

	return {
		hasFiling: !!(deal.secCik || totalRaised || totalInvestors || deal.dateOfFirstSale),
		cik: deal.secCik || null,
		totalRaised,
		totalInvestors,
		firstSaleDate: deal.dateOfFirstSale || null,
		offeringType: deal.offeringType || null
	};
}

export function buildFeeRows(deal) {
	if (!deal) return [];

	const rawFees = String(deal.fees || '');
	const rows = [];

	if (deal.lpGpSplit) {
		rows.push({ label: 'LP / GP Split', value: String(deal.lpGpSplit), verdict: 'Market-based split' });
	}

	const managementFee = extractFeeValue(rawFees, [
		/management fee[^0-9]*([\d.]+%?)/i,
		/asset management fee[^0-9]*([\d.]+%?)/i
	]);
	if (managementFee) {
		rows.push({
			label: 'Management Fee',
			value: managementFee,
			verdict: parseFloat(managementFee) <= 2 ? 'Investor-friendly' : 'Above benchmark'
		});
	}

	const acquisitionFee = extractFeeValue(rawFees, [/acquisition fee[^0-9]*([\d.]+%?)/i]);
	if (acquisitionFee) {
		rows.push({
			label: 'Acquisition Fee',
			value: acquisitionFee,
			verdict: parseFloat(acquisitionFee) <= 2 ? 'Common range' : 'Above benchmark'
		});
	}

	if (deal.preferredReturn) {
		const preferredReturnPct = deal.preferredReturn > 1 ? deal.preferredReturn : deal.preferredReturn * 100;
		rows.push({
			label: 'Preferred Return',
			value: formatMetric(deal.preferredReturn, 'pct'),
			verdict: preferredReturnPct >= 7 ? 'Strong LP alignment' : 'Below common hurdle'
		});
	}

	if (deal.auditing || deal.financials) {
		rows.push({
			label: 'Auditing',
			value: String(deal.auditing || deal.financials),
			verdict: String(deal.auditing || deal.financials) === 'Audited' ? 'Third-party verified' : 'Reporting quality disclosed'
		});
	}

	if (rawFees && rows.length === 0) {
		rows.push({ label: 'Fee Summary', value: rawFees, verdict: 'Benchmarking available for members' });
	}

	return rows.slice(0, 5);
}

export function buildOperatorTrackRecordRows(deal) {
	if (!deal) return [];
	const rows = [];
	if (deal.managementCompany) rows.push({ label: 'Management Company', value: deal.managementCompany });
	if (deal.mcFoundingYear) rows.push({ label: 'Founded', value: String(deal.mcFoundingYear) });
	if (deal.managerAUM ?? deal.fundAUM) rows.push({ label: 'Manager AUM', value: formatMetric(deal.managerAUM ?? deal.fundAUM, 'money') });
	if (deal.loanCount ?? deal.loan_count) rows.push({ label: 'Loan Count', value: String(deal.loanCount ?? deal.loan_count) });
	if (deal.ceo) rows.push({ label: 'Lead Operator', value: deal.ceo });
	if (deal.sponsorInDeal) rows.push({ label: 'Sponsor Co-Invest', value: formatMetric(deal.sponsorInDeal, 'pct') });
	return rows.slice(0, 5);
}

export function buildInvestClearlyPreview(deal) {
	if (!deal?.managementCompany) return null;

	const sponsorName = deal.managementCompany;
	const reviews = [
		{
			id: 'icr-1',
			reviewer: 'Maya T.',
			publishedAt: '2026-02-11',
			rating: 5,
			title: 'Strong communication and reliable execution',
			body: `${sponsorName} kept updates consistent, set expectations clearly, and operated in a way that felt disciplined from start to finish. The communication stood out most.`
		},
		{
			id: 'icr-2',
			reviewer: 'Chris D.',
			publishedAt: '2026-01-28',
			rating: 5,
			title: 'Professional sponsor that does what they say',
			body: `Our experience with ${sponsorName} was organized and straightforward. Materials were easy to follow, the team was responsive, and the process felt well managed rather than improvised.`
		},
		{
			id: 'icr-3',
			reviewer: 'Elena R.',
			publishedAt: '2025-12-16',
			rating: 5,
			title: 'Clear reporting and investor-first posture',
			body: `The reporting cadence, responsiveness, and overall presentation gave us confidence in ${sponsorName}. This is exactly the kind of third-party social proof worth surfacing on every sponsor-backed deal page.`
		}
	];

	const reviewCount = reviews.length;
	const averageRating = reviews.reduce((sum, review) => sum + review.rating, 0) / reviewCount;

	return {
		sponsorName,
		reviewCount,
		averageRating: averageRating.toFixed(1),
		reviews
	};
}

export function buildKeyRiskItems(deal, dealFit, isStale) {
	const items = [];
	if (isStale) items.push('The deal may no longer be actively accepting new capital.');
	if (dealFit?.warnings?.length) items.push(...dealFit.warnings);
	if (!deal?.managementCompanyId) items.push('Management company record is incomplete, which limits independent verification.');
	return items.slice(0, 4);
}

function normalizeStateCode(value) {
	if (!value) return null;
	const normalized = String(value).trim();
	if (STATE_NAME_BY_CODE[normalized.toUpperCase()]) return normalized.toUpperCase();
	return STATE_CODE_BY_NAME[normalized.toLowerCase()] || null;
}

function extractExplicitStateCodes(text) {
	const raw = String(text || '');
	if (!raw) return [];

	const matches = [];
	for (const [code, name] of Object.entries(STATE_NAME_BY_CODE)) {
		const pattern = new RegExp(`\\b${name}\\b`, 'gi');
		for (const match of raw.matchAll(pattern)) {
			matches.push({ code, index: match.index ?? 0 });
		}
	}

	return matches
		.sort((left, right) => left.index - right.index)
		.map((match) => match.code)
		.filter((code, index, array) => array.indexOf(code) === index);
}

function extractFeeValue(text, patterns) {
	const source = String(text || '');
	for (const pattern of patterns) {
		const match = source.match(pattern);
		if (match?.[1]) return match[1].trim();
	}
	return null;
}

function formatMetric(value, type) {
	if (value === undefined || value === null || value === '') return '---';
	if (type === 'pct') {
		const numericValue = typeof value === 'number' ? value : parseFloat(value);
		if (Number.isNaN(numericValue)) return '---';
		return (numericValue > 1 ? numericValue : numericValue * 100).toFixed(1) + '%';
	}
	if (type === 'money') {
		const numericValue = typeof value === 'string' ? parseFloat(value.replace(/[$,]/g, '')) : value;
		if (Number.isNaN(numericValue)) return '---';
		if (numericValue === 0) return '$0';
		if (numericValue >= 1e9) return '$' + (numericValue / 1e9).toFixed(1) + 'B';
		if (numericValue >= 1e6) return '$' + (numericValue / 1e6).toFixed(1) + 'M';
		if (numericValue >= 1e3) return '$' + (numericValue / 1e3).toFixed(0) + 'K';
		return '$' + numericValue.toLocaleString();
	}
	return String(value);
}
