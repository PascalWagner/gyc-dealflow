export const EM_DASH = '\u2014';

export const DECISION_COMPARE_SECTIONS = [
	{ id: 'assetOverview', title: 'Asset Overview' },
	{ id: 'returns', title: 'Returns' },
	{ id: 'terms', title: 'Terms' },
	{ id: 'additional', title: 'Additional' },
	{ id: 'actions', title: 'Actions' }
];

export const DECISION_COMPARE_FIELDS = [
	{
		id: 'assetClass',
		section: 'assetOverview',
		label: 'Asset Class',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: true,
		accessor: (deal) => deal.assetClass
	},
	{
		id: 'planFit',
		section: 'assetOverview',
		label: 'Plan Fit',
		kind: 'planFit',
		comparison: 'higher',
		alwaysVisible: true,
		accessor: (deal) => deal.planFit
	},
	{
		id: 'irr',
		section: 'returns',
		label: 'Target IRR',
		kind: 'percent',
		comparison: 'higher',
		alwaysVisible: true,
		accessor: (deal) => deal.returns?.irr
	},
	{
		id: 'pref',
		section: 'returns',
		label: 'Preferred Return',
		kind: 'percent',
		comparison: 'higher',
		alwaysVisible: true,
		accessor: (deal) => deal.returns?.pref
	},
	{
		id: 'cashOnCash',
		section: 'returns',
		label: 'Cash-on-Cash',
		kind: 'percent',
		comparison: 'higher',
		alwaysVisible: true,
		accessor: (deal) => deal.returns?.cashOnCash
	},
	{
		id: 'multiple',
		section: 'returns',
		label: 'Equity Multiple',
		kind: 'multiple',
		comparison: 'higher',
		alwaysVisible: true,
		accessor: (deal) => deal.returns?.multiple
	},
	{
		id: 'minimum',
		section: 'terms',
		label: 'Minimum',
		kind: 'money',
		comparison: 'lower',
		alwaysVisible: true,
		accessor: (deal) => deal.terms?.minimum
	},
	{
		id: 'holdPeriod',
		section: 'terms',
		label: 'Hold Period',
		kind: 'years',
		comparison: 'none',
		alwaysVisible: true,
		accessor: (deal) => deal.terms?.holdPeriod
	},
	{
		id: 'leverage',
		section: 'terms',
		label: 'Leverage',
		kind: 'textOrPercent',
		comparison: 'none',
		alwaysVisible: true,
		accessor: (deal) => deal.terms?.leverage
	},
	{
		id: 'distributions',
		section: 'additional',
		label: 'Distributions',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.distributions
	},
	{
		id: 'strategy',
		section: 'additional',
		label: 'Strategy',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.strategy
	},
	{
		id: 'dealType',
		section: 'additional',
		label: 'Deal Type',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.dealType
	},
	{
		id: 'geography',
		section: 'additional',
		label: 'Geography',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.geography
	},
	{
		id: 'sponsorCoInvest',
		section: 'additional',
		label: 'Sponsor Co-Invest',
		kind: 'percent',
		comparison: 'higher',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.sponsorCoInvest
	},
	{
		id: 'lpGpSplit',
		section: 'additional',
		label: 'LP / GP Split',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.lpGpSplit
	},
	{
		id: 'offeringSize',
		section: 'additional',
		label: 'Offering Size',
		kind: 'money',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.offeringSize
	},
	{
		id: 'sponsorAum',
		section: 'additional',
		label: 'Sponsor AUM',
		kind: 'money',
		comparison: 'higher',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.sponsorAum
	},
	{
		id: 'offeringType',
		section: 'additional',
		label: 'Offering Type',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.offeringType
	},
	{
		id: 'availableTo',
		section: 'additional',
		label: 'Available To',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.availableTo
	},
	{
		id: 'status',
		section: 'additional',
		label: 'Status',
		kind: 'text',
		comparison: 'none',
		alwaysVisible: false,
		accessor: (deal) => deal.additional?.status
	},
	{
		id: 'actions',
		section: 'actions',
		label: 'Actions',
		kind: 'actions',
		comparison: 'none',
		alwaysVisible: true,
		accessor: () => null
	}
];

export const OPTIONAL_DECISION_COMPARE_FIELDS = DECISION_COMPARE_FIELDS.filter((field) => !field.alwaysVisible);

function trimTrailingZeros(value) {
	return String(value).replace(/\.0+$/, '').replace(/(\.\d*?[1-9])0+$/, '$1');
}

export function chunkItems(items, size) {
	const chunkSize = Math.max(1, Number(size) || 1);
	const groups = [];

	for (let index = 0; index < items.length; index += chunkSize) {
		groups.push(items.slice(index, index + chunkSize));
	}

	return groups;
}

export function getColumnsForWidth(width) {
	if (width < 768) return 1;
	if (width < 1100) return 2;
	if (width < 1480) return 3;
	return 4;
}

export function normalizeFieldSelection(fieldIds = []) {
	const allowed = new Set(OPTIONAL_DECISION_COMPARE_FIELDS.map((field) => field.id));
	const selected = [];

	for (const fieldId of Array.isArray(fieldIds) ? fieldIds : []) {
		if (!allowed.has(fieldId) || selected.includes(fieldId)) continue;
		selected.push(fieldId);
	}

	return selected;
}

export function getVisibleFieldDefinitions(optionalFieldIds = []) {
	const visibleOptionalIds = new Set(normalizeFieldSelection(optionalFieldIds));

	return DECISION_COMPARE_FIELDS.filter((field) => field.alwaysVisible || visibleOptionalIds.has(field.id));
}

export function getSectionedFields(optionalFieldIds = []) {
	const visibleFields = getVisibleFieldDefinitions(optionalFieldIds);

	return DECISION_COMPARE_SECTIONS.map((section) => ({
		...section,
		fields: visibleFields.filter((field) => field.section === section.id)
	})).filter((section) => section.fields.length > 0);
}

export function toNumber(value) {
	if (value == null || value === '') return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	if (typeof value === 'string') {
		const parsed = parseFloat(value.replace(/[$,%xX,\s]/g, ''));
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

export function normalizePercentValue(value) {
	const numeric = toNumber(value);
	if (numeric === null) return null;
	return Math.abs(numeric) <= 1 ? numeric * 100 : numeric;
}

export function formatPercent(value) {
	const normalized = normalizePercentValue(value);
	return normalized === null ? EM_DASH : `${normalized.toFixed(1)}%`;
}

export function formatMoneyCompact(value) {
	const numeric = toNumber(value);
	if (numeric === null) return EM_DASH;

	const absolute = Math.abs(numeric);
	if (absolute >= 1e9) return `$${trimTrailingZeros((numeric / 1e9).toFixed(1))}B`;
	if (absolute >= 1e6) return `$${trimTrailingZeros((numeric / 1e6).toFixed(1))}M`;
	if (absolute >= 1e3) return `$${trimTrailingZeros((numeric / 1e3).toFixed(0))}K`;
	return `$${trimTrailingZeros(numeric.toFixed(0))}`;
}

export function formatMultiple(value) {
	const numeric = toNumber(value);
	return numeric === null ? EM_DASH : `${numeric.toFixed(2)}x`;
}

export function formatYears(value) {
	const numeric = toNumber(value);
	if (numeric === null) return EM_DASH;
	if (numeric < 1) return `${Math.round(numeric * 12)} mo`;
	return `${trimTrailingZeros(numeric.toFixed(1))} yr`;
}

export function formatText(value) {
	if (Array.isArray(value)) return value.filter(Boolean).join(', ') || EM_DASH;
	return value == null || value === '' ? EM_DASH : String(value);
}

export function formatTextOrPercent(value) {
	if (typeof value === 'string' && /[%a-z]/i.test(value)) return value || EM_DASH;
	const numeric = normalizePercentValue(value);
	return numeric === null ? formatText(value) : `${numeric.toFixed(1)}%`;
}

export function formatFieldValue(field, deal) {
	const value = field.accessor(deal);

	switch (field.kind) {
		case 'percent':
			return formatPercent(value);
		case 'money':
			return formatMoneyCompact(value);
		case 'multiple':
			return formatMultiple(value);
		case 'years':
			return formatYears(value);
		case 'textOrPercent':
			return formatTextOrPercent(value);
		case 'planFit':
			return value == null || value === '' ? EM_DASH : `${value}/5`;
		default:
			return formatText(value);
	}
}

export function buildComparisonMap(deals, fields) {
	const results = {};
	const activeFields = fields || DECISION_COMPARE_FIELDS;

	for (const field of activeFields) {
		if (!['higher', 'lower'].includes(field.comparison)) {
			results[field.id] = { bestDealIds: new Set(), bestValue: null };
			continue;
		}

		const numericValues = deals.map((deal) => {
			const value = field.accessor(deal);
			return field.kind === 'percent' || field.kind === 'textOrPercent'
				? normalizePercentValue(value)
				: toNumber(value);
		});

		const comparableValues = numericValues.filter((value) => value !== null);
		if (comparableValues.length < 2 || new Set(comparableValues).size === 1) {
			results[field.id] = { bestDealIds: new Set(), bestValue: null };
			continue;
		}

		const bestValue = field.comparison === 'higher'
			? Math.max(...comparableValues)
			: Math.min(...comparableValues);

		const bestDealIds = new Set();
		numericValues.forEach((value, index) => {
			if (value === bestValue) bestDealIds.add(deals[index].id);
		});

		results[field.id] = { bestDealIds, bestValue };
	}

	return results;
}
