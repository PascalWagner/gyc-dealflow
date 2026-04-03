import {
	CANONICAL_OFFERING_TYPES,
	normalizeDealComplianceFields,
	normalizeOfferingType
} from './dealflow-contract.js';
import { formatStateCodesAsGeographyValue, mergeStateCodeLists } from './investing-geography.js';
import { slugify } from './dealWorkflow.js';

export const DEAL_ASSET_CLASS_OPTIONS = [
	'Multi-Family',
	'Industrial',
	'Self Storage',
	'Hotels/Hospitality',
	'Private Debt / Credit',
	'Single Family',
	'RV/Mobile Home Parks',
	'Mixed-Use',
	'Retail',
	'Office',
	'Short Term Rental',
	'Business / Other',
	'Oil & Gas / Energy',
	'Medical',
	'Land'
];

export const DEAL_TYPE_OPTIONS = ['Fund', 'Syndication', 'Direct', 'Joint Venture', 'Portfolio'];
export const OFFERING_STATUS_OPTIONS = [
	'Open to invest',
	'Evergreen',
	'Coming Soon',
	'Paused',
	'Fully Funded',
	'Closed',
	'Completed'
];
export const LENDING_FUND_OFFERING_STATUS_OPTIONS = ['Currently Open', 'Evergreen', 'Full', 'Full Cycle'];
export const AVAILABLE_TO_OPTIONS = ['Accredited Investors', 'Non-Accredited Investors', 'Both'];
export const DISTRIBUTIONS_OPTIONS = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'At Exit', 'None'];
export const FINANCIALS_OPTIONS = ['Audited', 'Reviewed', 'Unaudited', 'Unknown'];
export const INSTRUMENT_OPTIONS = ['Debt', 'Equity', 'Preferred Equity', 'Hybrid', 'Fund'];
export const DEBT_POSITION_OPTIONS = ['Senior', 'First Lien', 'Second Lien', 'Mezzanine', 'Preferred Equity', 'Other'];
export const TAX_FORM_OPTIONS = ['K-1', '1099-DIV', '1099-INT', '1099-B', 'Other'];
export const UNDERLYING_EXPOSURE_TYPE_OPTIONS = [
	'Multifamily',
	'Single Family',
	'Commercial Real Estate',
	'Industrial',
	'Retail',
	'Office',
	'Hospitality',
	'Self Storage',
	'Land',
	'Medical Receivables',
	'Aviation',
	'Education',
	'Consumer',
	'Small Business',
	'Equipment',
	'Mixed Portfolio',
	'Other'
];
export const RISK_TAG_OPTIONS = [
	'Leverage',
	'Liquidity',
	'Credit Loss',
	'Concentration',
	'Refinancing',
	'Interest Rate',
	'Sponsor',
	'Underwriting',
	'Execution',
	'Regulatory',
	'Valuation',
	'Counterparty',
	'Tax',
	'Operational',
	'Reporting',
	'Other'
];
export const COUNTRY_OPTIONS = ['United States', 'Canada', 'Mexico', 'Other'];
export const STATE_OPTIONS = [
	'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
	'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
	'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'
];
const HISTORICAL_RETURN_START_YEAR = 2015;
const HISTORICAL_RETURN_END_YEAR = new Date().getFullYear() - 1;
export const HISTORICAL_RETURN_YEARS = Array.from(
	{ length: Math.max(0, HISTORICAL_RETURN_END_YEAR - HISTORICAL_RETURN_START_YEAR + 1) },
	(_, index) => HISTORICAL_RETURN_START_YEAR + index
);

const ASSET_CLASS_ALIASES = {
	'multi family': 'Multi-Family',
	'multifamily': 'Multi-Family',
	'multi-family': 'Multi-Family',
	'apartments': 'Multi-Family',
	'lending': 'Private Debt / Credit',
	'private lending': 'Private Debt / Credit',
	'private debt': 'Private Debt / Credit',
	'private credit': 'Private Debt / Credit',
	'private debt / credit': 'Private Debt / Credit',
	'private debt credit': 'Private Debt / Credit',
	'debt': 'Private Debt / Credit',
	'credit': 'Private Debt / Credit',
	'debt fund': 'Private Debt / Credit',
	'bridge lending': 'Private Debt / Credit',
	'bridge loan': 'Private Debt / Credit',
	'hotel': 'Hotels/Hospitality',
	'hotels': 'Hotels/Hospitality',
	'hospitality': 'Hotels/Hospitality',
	'rv': 'RV/Mobile Home Parks',
	'mobile home parks': 'RV/Mobile Home Parks',
	'manufactured housing': 'RV/Mobile Home Parks',
	'str': 'Short Term Rental',
	'short term rental': 'Short Term Rental',
	'business': 'Business / Other',
	'other': 'Business / Other',
	'business / other': 'Business / Other',
	'mixed use': 'Mixed-Use',
	'mixed-use': 'Mixed-Use',
	'oil and gas': 'Oil & Gas / Energy',
	'oil & gas': 'Oil & Gas / Energy',
	'energy': 'Oil & Gas / Energy',
	'single-family': 'Single Family',
	'single family': 'Single Family'
};

const DEAL_TYPE_ALIASES = {
	fund: 'Fund',
	syndication: 'Syndication',
	syndicated: 'Syndication',
	direct: 'Direct',
	'joint venture': 'Joint Venture',
	jv: 'Joint Venture',
	portfolio: 'Portfolio'
};

const OFFERING_STATUS_ALIASES = {
	open: 'Open to invest',
	'open to invest': 'Open to invest',
	'open to invest now': 'Open to invest',
	'currently open': 'Open to invest',
	live: 'Open to invest',
	active: 'Open to invest',
	'coming soon': 'Coming Soon',
	upcoming: 'Coming Soon',
	evergreen: 'Evergreen',
	rolling: 'Evergreen',
	full: 'Fully Funded',
	'fully funded': 'Fully Funded',
	funded: 'Fully Funded',
	paused: 'Paused',
	closed: 'Closed',
	completed: 'Completed',
	'full cycle': 'Completed'
};

const AVAILABLE_TO_ALIASES = {
	accredited: 'Accredited Investors',
	'accredited only': 'Accredited Investors',
	'accredited investors': 'Accredited Investors',
	members: 'Accredited Investors',
	'members only': 'Accredited Investors',
	'non-accredited': 'Non-Accredited Investors',
	'non accredited': 'Non-Accredited Investors',
	'non-accredited investors': 'Non-Accredited Investors',
	both: 'Both',
	all: 'Both',
	everyone: 'Both'
};

const DISTRIBUTIONS_ALIASES = {
	monthly: 'Monthly',
	quarterly: 'Quarterly',
	qtr: 'Quarterly',
	'semi annual': 'Semi-Annual',
	semiannual: 'Semi-Annual',
	annual: 'Annual',
	yearly: 'Annual',
	none: 'None',
	'no distributions': 'None',
	'capital event': 'At Exit',
	'exit only': 'At Exit',
	'at exit': 'At Exit'
};

const FINANCIALS_ALIASES = {
	audited: 'Audited',
	reviewed: 'Reviewed',
	unaudited: 'Unaudited',
	'not audited': 'Unaudited',
	unknown: 'Unknown'
};

const INSTRUMENT_ALIASES = {
	debt: 'Debt',
	loan: 'Debt',
	equity: 'Equity',
	'preferred equity': 'Preferred Equity',
	preferred: 'Preferred Equity',
	hybrid: 'Hybrid',
	fund: 'Fund'
};

const DEBT_POSITION_ALIASES = {
	senior: 'Senior',
	'first lien': 'First Lien',
	'second lien': 'Second Lien',
	mezz: 'Mezzanine',
	mezzanine: 'Mezzanine',
	'preferred equity': 'Preferred Equity',
	other: 'Other'
};

const TAX_FORM_ALIASES = {
	'k1': 'K-1',
	'k-1': 'K-1',
	'1099 div': '1099-DIV',
	'1099-div': '1099-DIV',
	'1099 int': '1099-INT',
	'1099-int': '1099-INT',
	'1099 b': '1099-B',
	'1099-b': '1099-B',
	other: 'Other'
};

function buildHistoricalReturnFieldConfig(year) {
	return {
		key: `historicalReturn${year}`,
		label: String(year),
		type: 'percentage',
		input: 'number',
		step: 0.01,
		section: 'historicalPerformance',
		requiredForPublish: false,
		placeholder: '0.00',
		helperText: 'Enter the net annual return to LPs for this completed year. Negative values are allowed.',
		readFrom: [
			`historicalReturn${year}`,
			`historical_return_${year}`,
			`annualReturn${year}`,
			`annual_return_${year}`,
			`netReturn${year}`,
			`net_return_${year}`
		]
	};
}

function parseLpShareInput(value) {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value === 'string' && value.includes('/')) {
		const [lpShare] = value.split('/');
		const numericValue = parseLooseNumber(lpShare);
		if (numericValue === null) return null;
		return Math.abs(numericValue) > 1 ? numericValue / 100 : numericValue;
	}
	const numericValue = parseLooseNumber(value);
	if (numericValue === null) return null;
	return Math.abs(numericValue) > 1 ? numericValue / 100 : numericValue;
}

function formatLpShareDisplay(value) {
	const parsed = parseLpShareInput(value);
	if (parsed === null) return '';
	return formatPercentDisplay(parsed);
}

function normalizeReturnFieldKey(fieldKey) {
	return /^historicalReturn20\d{2}$/i.test(fieldKey);
}

const ENUM_CONFIG = {
	assetClass: { options: DEAL_ASSET_CLASS_OPTIONS, aliases: ASSET_CLASS_ALIASES },
	dealType: { options: DEAL_TYPE_OPTIONS, aliases: DEAL_TYPE_ALIASES },
	offeringType: { options: CANONICAL_OFFERING_TYPES, aliases: null },
	offeringStatus: { options: OFFERING_STATUS_OPTIONS, aliases: OFFERING_STATUS_ALIASES },
	secVerificationState: {
		options: ['Verified', 'Pending', "Haven't Filed Yet", 'Not Applicable', 'Skipped'],
		aliases: {
			verified: 'Verified',
			pending: 'Pending',
			'have not filed yet': "Haven't Filed Yet",
			'haven t filed yet': "Haven't Filed Yet",
			'not applicable': 'Not Applicable',
			skipped: 'Skipped'
		}
	},
	secLookupState: {
		options: ['Matched', 'Need New Record', 'Skip For Now', 'No Match', 'Not Applicable'],
		aliases: {
			matched: 'Matched',
			'find new record': 'Need New Record',
			'find a new record': 'Need New Record',
			'new record': 'Need New Record',
			'skip for now': 'Skip For Now',
			skipped: 'Skip For Now',
			'no match': 'No Match',
			'not applicable': 'Not Applicable'
		}
	},
	availableTo: { options: AVAILABLE_TO_OPTIONS, aliases: AVAILABLE_TO_ALIASES },
	distributions: { options: DISTRIBUTIONS_OPTIONS, aliases: DISTRIBUTIONS_ALIASES },
	financials: { options: FINANCIALS_OPTIONS, aliases: FINANCIALS_ALIASES },
	redemption: {
		options: ['Monthly', 'Quarterly', 'Annual', 'At Exit'],
		aliases: {
			monthly: 'Monthly',
			quarterly: 'Quarterly',
			annual: 'Annual',
			yearly: 'Annual',
			'annually': 'Annual',
			'once a year': 'Annual',
			'exit only': 'At Exit',
			'at exit': 'At Exit',
			'liquidity window monthly': 'Monthly',
			'liquidity window quarterly': 'Quarterly'
		}
	},
	underlyingExposureTypes: { options: UNDERLYING_EXPOSURE_TYPE_OPTIONS, aliases: null },
	riskTags: { options: RISK_TAG_OPTIONS, aliases: null },
	instrument: { options: INSTRUMENT_OPTIONS, aliases: INSTRUMENT_ALIASES },
	debtPosition: { options: DEBT_POSITION_OPTIONS, aliases: DEBT_POSITION_ALIASES },
	taxForm: { options: TAX_FORM_OPTIONS, aliases: TAX_FORM_ALIASES }
};

const DEFAULT_LOCATION = { city: '', state: '', country: 'United States' };
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function normalizeToken(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[\u2013\u2014]/g, '-')
		.replace(/[^a-z0-9%()+/&-]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function readField(source, aliases = []) {
	for (const alias of aliases) {
		const value = source?.[alias];
		if (value !== undefined && value !== null) return value;
	}
	return undefined;
}

export function normalizeAssetClassValue(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';

	const token = normalizeToken(raw);
	if (!token) return '';

	const aliasMatch = ASSET_CLASS_ALIASES[token];
	if (aliasMatch) return aliasMatch;

	const exactMatch = DEAL_ASSET_CLASS_OPTIONS.find((option) => option.toLowerCase() === raw.toLowerCase());
	return exactMatch || raw;
}

function ensureArray(value) {
	if (Array.isArray(value)) {
		return value.map((item) => String(item || '').trim()).filter(Boolean);
	}
	return String(value || '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function normalizeTeamContacts(value) {
	if (!Array.isArray(value)) return [];
	return value
		.map((entry, index) => ({
			firstName: String(entry?.firstName || '').trim(),
			lastName: String(entry?.lastName || '').trim(),
			email: String(entry?.email || '').trim(),
			phone: String(entry?.phone || '').trim(),
			role: String(entry?.role || '').trim(),
			linkedinUrl: String(entry?.linkedinUrl || '').trim(),
			calendarUrl: String(entry?.calendarUrl || '').trim(),
			isPrimary: entry?.isPrimary === true,
			isInvestorRelations: entry?.isInvestorRelations === true,
			displayOrder: Number.isFinite(entry?.displayOrder) ? entry.displayOrder : index
		}))
		.filter((entry) => entry.firstName || entry.lastName || entry.email || entry.role);
}

function parseLooseNumber(value) {
	if (value === null || value === undefined || value === '') return null;
	if (typeof value === 'number') return Number.isFinite(value) ? value : null;
	const cleaned = String(value)
		.replace(/[$,%]/g, '')
		.replace(/,/g, '')
		.trim();
	if (!cleaned) return null;
	const numericValue = Number(cleaned);
	return Number.isFinite(numericValue) ? numericValue : null;
}

function formatNumber(value, { maximumFractionDigits = 2 } = {}) {
	const numericValue = parseLooseNumber(value);
	if (numericValue === null) return '';
	return new Intl.NumberFormat('en-US', {
		maximumFractionDigits,
		minimumFractionDigits: 0
	}).format(numericValue);
}

function formatPercentDisplay(value) {
	const numericValue = parseLooseNumber(value);
	if (numericValue === null) return '';
	const percentValue = Math.abs(numericValue) <= 1 ? numericValue * 100 : numericValue;
	return formatNumber(percentValue, { maximumFractionDigits: 2 });
}

function parsePercentInput(value) {
	const numericValue = parseLooseNumber(value);
	if (numericValue === null) return null;
	return Math.abs(numericValue) > 1 ? numericValue / 100 : numericValue;
}

function parseReviewPercentageInput(fieldKey, value) {
	return normalizeReturnFieldKey(fieldKey) ? parseLooseNumber(value) : parsePercentInput(value);
}

export function parseLocationValue(value) {
	if (value && typeof value === 'object' && !Array.isArray(value)) {
		return {
			city: String(value.city || '').trim(),
			state: String(value.state || '').trim().toUpperCase(),
			country: String(value.country || DEFAULT_LOCATION.country).trim()
		};
	}

	const raw = String(value || '').trim();
	if (!raw) return { ...DEFAULT_LOCATION };

	const parts = raw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);

	if (parts.length === 1) {
		return { ...DEFAULT_LOCATION, city: parts[0] };
	}

	if (parts.length === 2) {
		const [city, stateOrCountry] = parts;
		if (stateOrCountry.length <= 3) {
			return { city, state: stateOrCountry.toUpperCase(), country: DEFAULT_LOCATION.country };
		}
		return { city, state: '', country: stateOrCountry };
	}

	const [city, state, ...rest] = parts;
	return {
		city,
		state: String(state || '').toUpperCase(),
		country: rest.join(', ') || DEFAULT_LOCATION.country
	};
}

export function formatLocationValue(location) {
	const parsed = parseLocationValue(location);
	return [parsed.city, parsed.state, parsed.country].filter(Boolean).join(', ');
}

export function normalizeEnumValue(fieldKey, value, { allowUnknown = false } = {}) {
	if (fieldKey === 'assetClass') {
		const normalizedAssetClass = normalizeAssetClassValue(value);
		if (!normalizedAssetClass) return { value: '', warning: '' };
		if (DEAL_ASSET_CLASS_OPTIONS.some((option) => option.toLowerCase() === normalizedAssetClass.toLowerCase())) {
			return { value: normalizedAssetClass, warning: '' };
		}
		return allowUnknown
			? {
					value: String(value || '').trim(),
					warning: 'Choose one of the canonical asset classes before publishing.'
				}
			: {
					value: '',
					warning: 'Choose one of the canonical asset classes before publishing.'
				};
	}

	if (fieldKey === 'offeringType') {
		const normalized = normalizeOfferingType(value, { empty: '' });
		if (!normalized) return { value: '', warning: '' };
		if (CANONICAL_OFFERING_TYPES.includes(normalized)) return { value: normalized, warning: '' };
		return allowUnknown
			? { value: String(value || '').trim(), warning: 'Choose one of the canonical offering types before publishing.' }
			: { value: '', warning: 'Choose one of the canonical offering types before publishing.' };
	}

	const enumConfig = ENUM_CONFIG[fieldKey];
	if (!enumConfig) return { value: String(value || '').trim(), warning: '' };

	const raw = String(value || '').trim();
	if (!raw) return { value: '', warning: '' };

	const exactMatch = enumConfig.options.find((option) => option.toLowerCase() === raw.toLowerCase());
	if (exactMatch) return { value: exactMatch, warning: '' };

	const aliasMatch = enumConfig.aliases?.[normalizeToken(raw)];
	if (aliasMatch) return { value: aliasMatch, warning: '' };

	return allowUnknown
		? { value: raw, warning: `Imported value "${raw}" is not in the canonical list yet. Choose the closest structured option before publishing.` }
		: { value: '', warning: `Imported value "${raw}" is not in the canonical list yet. Choose the closest structured option before publishing.` };
}

function coercePrimitiveField(field, rawValue) {
	if (field?.key === 'lpGpSplit') return formatLpShareDisplay(rawValue);
	if (field.type === 'currency') return formatNumber(rawValue, { maximumFractionDigits: 0 });
	if (field.type === 'percentage') return formatPercentDisplay(rawValue);
	if (field.type === 'number') return formatNumber(rawValue);
	if (field.type === 'multi_select') return ensureArray(rawValue);
	return String(rawValue ?? '').trim();
}

export const dealFieldConfig = {
	investmentName: {
		key: 'investmentName',
		label: 'Deal name',
		type: 'string_free',
		input: 'text',
		section: 'core',
		span: 2,
		requiredForPublish: true,
		placeholder: 'Sunrise Multifamily Fund II',
		helperText: 'Use the actual deal or fund name that should appear live in Deal Flow.',
		readFrom: ['investmentName', 'investment_name', 'name']
	},
	sponsor: {
		key: 'sponsor',
		label: 'Sponsor',
		type: 'entity_reference',
		section: 'core',
		span: 1,
		requiredForPublish: true,
		helperText: 'Link this deal to an existing sponsor record, or create a new sponsor if it does not exist yet.',
		readIdFrom: ['managementCompanyId', 'management_company_id'],
		readNameFrom: ['sponsorName', 'sponsor_name', 'managementCompany', 'management_company_name', 'sponsor']
	},
	companyWebsite: {
		key: 'companyWebsite',
		label: 'Management company website',
		type: 'string_free',
		input: 'url',
		section: 'core',
		requiredForPublish: false,
		placeholder: 'https://...',
		helperText: 'Use the sponsor or management company website, not a third-party marketplace listing.',
		readFrom: ['companyWebsite', 'mcWebsite', 'website']
	},
	assetClass: {
		key: 'assetClass',
		label: 'Asset class',
		type: 'string_enum',
		section: 'core',
		options: DEAL_ASSET_CLASS_OPTIONS,
		searchable: true,
		requiredForPublish: true,
		placeholder: 'Choose an asset class',
		helperText: 'Structured asset classes keep filters, analytics, and comparisons clean.',
		readFrom: ['assetClass', 'asset_class']
	},
	slug: {
		key: 'slug',
		label: 'Slug',
		type: 'string_free',
		input: 'text',
		section: 'core',
		span: 2,
		requiredForPublish: true,
		placeholder: 'sunrise-multifamily-fund-ii',
		helperText: 'Used for stable URLs. Keep it short and human-readable.',
		actionLabel: 'Generate from name',
		readFrom: ['slug']
	},
	dealType: {
		key: 'dealType',
		label: 'Deal type',
		type: 'string_enum',
		section: 'core',
		options: DEAL_TYPE_OPTIONS,
		requiredForPublish: false,
		placeholder: 'Select deal type',
		helperText: 'Fund vs syndication vs direct deal should be structured, not free text.',
		readFrom: ['dealType', 'deal_type']
	},
	offeringType: {
		key: 'offeringType',
		label: 'Offering type',
		type: 'string_enum',
		section: 'core',
		options: CANONICAL_OFFERING_TYPES,
		requiredForPublish: false,
		helperText: '506(b), 506(c), Regulation A, and similar compliance structure.',
		readFrom: ['offeringType', 'offering_type']
	},
	offeringStatus: {
		key: 'offeringStatus',
		label: 'Offering status',
		type: 'string_enum',
		section: 'core',
		options: OFFERING_STATUS_OPTIONS,
		requiredForPublish: true,
		helperText: 'This is the deal’s live fundraising status, not the QA lifecycle status.',
		readFrom: ['offeringStatus', 'offering_status', 'status']
	},
	secVerificationState: {
		key: 'secVerificationState',
		label: 'SEC verification state',
		type: 'string_enum',
		section: 'core',
		options: ['Verified', 'Pending', "Haven't Filed Yet", 'Not Applicable', 'Skipped'],
		requiredForPublish: false,
		helperText: 'Track whether the SEC match was verified, skipped, or explicitly marked not applicable.',
		readFrom: ['secVerificationState', 'sec_verification_state']
	},
	secLookupState: {
		key: 'secLookupState',
		label: 'SEC lookup status',
		type: 'string_enum',
		section: 'core',
		options: ['Matched', 'Need New Record', 'Skip For Now', 'No Match', 'Not Applicable'],
		requiredForPublish: false,
		helperText: 'Capture whether the SEC lookup matched, needs a new record, or should be skipped for now.',
		readFrom: ['secLookupState', 'sec_lookup_state']
	},
	secVerificationNotes: {
		key: 'secVerificationNotes',
		label: 'SEC notes',
		type: 'string_free',
		input: 'textarea',
		rows: 3,
		section: 'core',
		span: 2,
		requiredForPublish: false,
		placeholder: 'Why was this filing accepted, skipped, or marked as not applicable?',
		helperText: 'Use this for reviewer context and SEC override notes.',
		readFrom: ['secVerificationNotes', 'sec_verification_notes']
	},
	secEntityName: {
		key: 'secEntityName',
		label: 'SEC entity name',
		type: 'string_free',
		input: 'text',
		section: 'core',
		requiredForPublish: false,
		placeholder: 'Issuer legal entity name',
		helperText: 'Use the exact filing entity name if available.',
		readFrom: ['secEntityName', 'sec_entity_name']
	},
	secFilingId: {
		key: 'secFilingId',
		label: 'SEC filing ID',
		type: 'string_free',
		input: 'text',
		section: 'core',
		requiredForPublish: false,
		placeholder: 'Accession number or filing identifier',
		helperText: 'Store the matched filing accession or internal identifier.',
		readFrom: ['secFilingId', 'sec_filing_id']
	},
	secCik: {
		key: 'secCik',
		label: 'CIK',
		type: 'string_free',
		input: 'text',
		section: 'core',
		requiredForPublish: false,
		placeholder: '0001234567',
		helperText: 'Central Index Key for the issuer if available.',
		readFrom: ['secCik', 'sec_cik']
	},
	issuerEntity: {
		key: 'issuerEntity',
		label: 'Issuer entity',
		type: 'string_free',
		input: 'text',
		section: 'core',
		requiredForPublish: false,
		placeholder: 'Issuer legal entity name',
		helperText: 'Capture the operating issuer or fund entity exactly as filed.',
		readFrom: ['issuerEntity', 'issuer_entity']
	},
	gpEntity: {
		key: 'gpEntity',
		label: 'GP entity',
		type: 'string_free',
		input: 'text',
		section: 'core',
		requiredForPublish: false,
		placeholder: 'General partner legal name',
		helperText: 'Capture the general partner entity if it is disclosed.',
		readFrom: ['gpEntity', 'gp_entity']
	},
	sponsorEntity: {
		key: 'sponsorEntity',
		label: 'Sponsor entity',
		type: 'string_free',
		input: 'text',
		section: 'core',
		requiredForPublish: false,
		placeholder: 'Sponsor / manager legal name',
		helperText: 'Capture the sponsor or manager legal entity if disclosed.',
		readFrom: ['sponsorEntity', 'sponsor_entity']
	},
	teamContacts: {
		key: 'teamContacts',
		label: 'Contacts',
		type: 'team_contacts',
		section: 'contacts',
		span: 2,
		requiredForPublish: false,
		helperText: 'Add the CEO, operator, and investor relations contacts for the deal.',
		readFrom: ['teamContacts', 'team_contacts']
	},
	dateOfFirstSale: {
		key: 'dateOfFirstSale',
		label: 'Date of first sale',
		type: 'string_free',
		input: 'date',
		section: 'core',
		requiredForPublish: false,
		helperText: 'First sale date from the filing if it is available.',
		readFrom: ['dateOfFirstSale', 'date_of_first_sale']
	},
	totalAmountSold: {
		key: 'totalAmountSold',
		label: 'Total amount sold',
		type: 'currency',
		section: 'core',
		requiredForPublish: false,
		placeholder: '1,000,000',
		helperText: 'The amount sold to date in the filing.',
		readFrom: ['totalAmountSold', 'total_amount_sold']
	},
	totalInvestors: {
		key: 'totalInvestors',
		label: 'Total investors',
		type: 'number',
		section: 'core',
		requiredForPublish: false,
		placeholder: '25',
		helperText: 'Total number of investors if disclosed.',
		readFrom: ['totalInvestors', 'total_investors']
	},
	availableTo: {
		key: 'availableTo',
		label: 'Available to',
		type: 'string_enum',
		section: 'core',
		options: AVAILABLE_TO_OPTIONS,
		requiredForPublish: false,
		helperText: 'Who is the offering intended for?',
		readFrom: ['availableTo', 'available_to']
	},
	investmentMinimum: {
		key: 'investmentMinimum',
		label: 'Minimum investment',
		type: 'currency',
		section: 'core',
		requiredForPublish: true,
		placeholder: '50,000',
		helperText: 'Enter whole dollars. The UI will format it for you.',
		readFrom: ['investmentMinimum', 'investment_minimum', 'minimumInvestment']
	},
	investingGeography: {
		key: 'investingGeography',
		label: 'Geography / market',
		type: 'location',
		section: 'core',
		requiredForPublish: false,
		helperText: 'Capture this as city / state / country instead of a raw market string.',
		readFrom: ['investingGeography', 'investing_geography', 'location']
	},
	investingStates: {
		key: 'investingStates',
		label: 'Investing states',
		type: 'multi_select',
		section: 'core',
		options: STATE_OPTIONS,
		requiredForPublish: false,
		helperText: 'Select every state the lending fund targets. Choose All States if it is nationwide.',
		readFrom: ['investingStates', 'investing_states']
	},
	underlyingExposureTypes: {
		key: 'underlyingExposureTypes',
		label: 'Underlying exposure types',
		type: 'multi_select',
		section: 'core',
		options: UNDERLYING_EXPOSURE_TYPE_OPTIONS,
		requiredForPublish: false,
		helperText: 'Select the asset or receivable types this fund lends against.',
		readFrom: ['underlyingExposureTypes', 'underlying_exposure_types']
	},
	shortSummary: {
		key: 'shortSummary',
		label: 'Short summary',
		type: 'string_free',
		input: 'textarea',
		rows: 4,
		section: 'core',
		span: 2,
		requiredForPublish: true,
		placeholder: 'What is the deal, why does it exist, and what should an investor understand immediately?',
		helperText: 'Keep this clear and scannable. It drives listing quality and first impressions.',
		readFrom: ['shortSummary', 'short_summary']
	},
	investmentStrategy: {
		key: 'investmentStrategy',
		label: 'Strategy / tags context',
		type: 'string_free',
		input: 'textarea',
		rows: 3,
		section: 'core',
		span: 2,
		requiredForPublish: false,
		placeholder: 'Value-add multifamily in growth markets, bridge lending, income-focused note strategy...',
		helperText: 'Use this for qualitative context that does not fit into structured tags yet.',
		readFrom: ['investmentStrategy', 'investment_strategy', 'strategy']
	},
	offeringSize: {
		key: 'offeringSize',
		label: 'Max fund size',
		type: 'currency',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '10,000,000',
		helperText: 'Use the fund maximum or total raise size if disclosed.',
		readFrom: ['offeringSize', 'offering_size']
	},
	instrument: {
		key: 'instrument',
		label: 'Instrument',
		type: 'string_enum',
		section: 'returns',
		options: INSTRUMENT_OPTIONS,
		requiredForPublish: false,
		helperText: 'Use a structured instrument type so branching and analytics stay consistent.',
		readFrom: ['instrument']
	},
	targetIRR: {
		key: 'targetIRR',
		label: 'Target IRR',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '13',
		helperText: 'Enter a percent like 13 for 13%. We save it as a decimal under the hood.',
		readFrom: ['targetIRR', 'target_irr']
	},
	cashYield: {
		key: 'cashYield',
		label: 'Cash yield',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '8',
		helperText: 'Use cash yield / cash-on-cash as a structured percentage.',
		readFrom: ['cashYield', 'cash_yield', 'cashOnCash', 'cash_on_cash']
	},
	preferredReturn: {
		key: 'preferredReturn',
		label: 'Preferred return',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '8',
		helperText: 'Enter a percent like 8 for 8%.',
		readFrom: ['preferredReturn', 'preferred_return']
	},
	equityMultiple: {
		key: 'equityMultiple',
		label: 'Equity multiple',
		type: 'number',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '2.0',
		helperText: 'Use the expected equity multiple, for example 2.0x.',
		readFrom: ['equityMultiple', 'equity_multiple']
	},
	sponsorInDeal: {
		key: 'sponsorInDeal',
		label: 'Sponsor co-invest',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '5',
		helperText: 'Percent of sponsor capital in the deal, if disclosed.',
		readFrom: ['sponsorInDeal', 'sponsorCoinvest', 'sponsor_in_deal_pct']
	},
	holdPeriod: {
		key: 'holdPeriod',
		label: 'Hold period (years)',
		type: 'number',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '5',
		helperText: 'Duration should be numeric years, not prose.',
		readFrom: ['holdPeriod', 'hold_period_years']
	},
	distributions: {
		key: 'distributions',
		label: 'Distributions',
		type: 'string_enum',
		section: 'returns',
		options: DISTRIBUTIONS_OPTIONS,
		requiredForPublish: false,
		helperText: 'How often LPs are expected to receive distributions.',
		readFrom: ['distributions', 'distributionFrequency', 'distribution_frequency']
	},
	redemption: {
		key: 'redemption',
		label: 'Redemption frequency',
		type: 'string_enum',
		section: 'returns',
		options: ['Monthly', 'Quarterly', 'Annual', 'At Exit'],
		requiredForPublish: false,
		helperText: 'How often LPs can redeem or exit capital.',
		readFrom: ['redemption', 'redemptionFrequency', 'redemption_frequency']
	},
	redemptionNotes: {
		key: 'redemptionNotes',
		label: 'Redemption notes',
		type: 'string_free',
		input: 'textarea',
		rows: 3,
		section: 'returns',
		span: 2,
		requiredForPublish: false,
		placeholder: 'Lockup, notice periods, gates, or any special liquidity nuance...',
		helperText: 'Use this for the nuance behind the frequency dropdown.',
		readFrom: ['redemptionNotes', 'redemption_notes']
	},
	lpGpSplit: {
		key: 'lpGpSplit',
		label: 'LP share (%)',
		type: 'percentage',
		input: 'number',
		min: 0,
		max: 100,
		step: 1,
		section: 'returns',
		requiredForPublish: false,
		placeholder: '80',
		helperText: 'Enter the LP share as a percentage. For an 80/20 split, enter 80.',
		readFrom: ['lpGpSplit', 'lp_gp_split', 'lpSharePct', 'lp_share_pct']
	},
	fees: {
		key: 'fees',
		label: 'Fees',
		type: 'string_free',
		input: 'textarea',
		rows: 4,
		section: 'returns',
		span: 2,
		requiredForPublish: false,
		placeholder: 'Management fee, incentive fee, servicing fee, redemption fee...',
		helperText: 'Use one line per fee or a short structured summary of the fee stack.',
		readFrom: ['fees', 'feeSummary', 'fee_summary']
	},
	feeSummary: {
		key: 'feeSummary',
		label: 'Fee summary (legacy)',
		type: 'string_free',
		input: 'textarea',
		rows: 3,
		section: 'returns',
		span: 2,
		requiredForPublish: false,
		placeholder: 'Acquisition, asset management, disposition, promote...',
		helperText: 'Capture the relevant fees in one concise summary.',
		readFrom: ['feeSummary', 'fee_summary']
	},
	debtPosition: {
		key: 'debtPosition',
		label: 'Debt position',
		type: 'string_enum',
		section: 'returns',
		options: DEBT_POSITION_OPTIONS,
		requiredForPublish: false,
		helperText: 'Capture where this sits in the capital stack if it is a debt or credit deal.',
		readFrom: ['debtPosition', 'debt_position']
	},
	fundAUM: {
		key: 'fundAUM',
		label: 'Manager AUM',
		type: 'currency',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '100,000,000',
		helperText: 'Use the manager or sponsor AUM if it is disclosed.',
		readFrom: ['fundAUM', 'fund_aum', 'managerAUM', 'manager_aum']
	},
	currentFundSize: {
		key: 'currentFundSize',
		label: 'Current fund size',
		type: 'currency',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '100,000,000',
		helperText: 'Use the current fund size or NAV-style snapshot if disclosed.',
		readFrom: ['currentFundSize', 'current_fund_size']
	},
	loanCount: {
		key: 'loanCount',
		label: 'Loan count',
		type: 'number',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '25',
		helperText: 'Important for distinguishing a lending fund from a single-loan opportunity.',
		readFrom: ['loanCount', 'loan_count']
	},
	avgLoanLtv: {
		key: 'avgLoanLtv',
		label: 'Average loan LTV',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '65',
		helperText: 'Average LTV across the portfolio or credit book if disclosed.',
		readFrom: ['avgLoanLtv', 'avg_loan_ltv']
	},
	currentAvgLoanLtv: {
		key: 'currentAvgLoanLtv',
		label: 'Current average loan LTV',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '65',
		helperText: 'The current portfolio average LTV as of the snapshot date.',
		readFrom: ['currentAvgLoanLtv', 'current_avg_loan_ltv']
	},
	avgLoanLTC: {
		key: 'avgLoanLTC',
		label: 'Average loan LTC',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '74',
		helperText: 'Weighted average loan-to-cost ratio across the portfolio.',
		readFrom: ['avgLoanLTC', 'avg_loan_ltc']
	},
	totalLoansUnderMgmt: {
		key: 'totalLoansUnderMgmt',
		label: 'Total loans under management',
		type: 'currency',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '1,000,000,000',
		helperText: 'Total loan book including leverage. Distinct from Fund AUM and equity commitments.',
		readFrom: ['totalLoansUnderMgmt', 'total_loans_under_mgmt']
	},
	equityCommitments: {
		key: 'equityCommitments',
		label: 'Equity commitments',
		type: 'currency',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '500,000,000',
		helperText: 'Total LP equity / capital under management. Distinct from Fund AUM and total loans.',
		readFrom: ['equityCommitments', 'equity_commitments']
	},
	performanceFeePct: {
		key: 'performanceFeePct',
		label: 'Performance fee',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '20',
		helperText: 'The GP carried interest / performance fee above the preferred return hurdle.',
		readFrom: ['performanceFeePct', 'performance_fee_pct']
	},
	inceptionDate: {
		key: 'inceptionDate',
		label: 'Inception date',
		type: 'string_free',
		input: 'date',
		section: 'returns',
		requiredForPublish: false,
		helperText: 'The fund launch or inception date.',
		readFrom: ['inceptionDate', 'inception_date']
	},
	fundTerm: {
		key: 'fundTerm',
		label: 'Fund term',
		type: 'string_free',
		section: 'returns',
		requiredForPublish: false,
		placeholder: 'Evergreen',
		helperText: 'Fund term (e.g. Evergreen, 7 years, 10 years with extensions).',
		readFrom: ['fundTerm', 'fund_term']
	},
	maxAllowedLtv: {
		key: 'maxAllowedLtv',
		label: 'Max allowed LTV',
		type: 'percentage',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '75',
		helperText: 'Maximum LTV the fund is allowed to hold under its current strategy or policy.',
		readFrom: ['maxAllowedLtv', 'max_allowed_ltv']
	},
	currentLeverage: {
		key: 'currentLeverage',
		label: 'Current leverage',
		type: 'number',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '1.5',
		helperText: 'Use debt-to-equity leverage as a ratio, for example 1.5x.',
		readFrom: ['currentLeverage', 'current_leverage']
	},
	maxAllowedLeverage: {
		key: 'maxAllowedLeverage',
		label: 'Max allowed leverage',
		type: 'number',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '2.0',
		helperText: 'The maximum leverage the fund is allowed to use.',
		readFrom: ['maxAllowedLeverage', 'max_allowed_leverage']
	},
	snapshotAsOfDate: {
		key: 'snapshotAsOfDate',
		label: 'Snapshot as of',
		type: 'string_free',
		input: 'date',
		section: 'returns',
		requiredForPublish: true,
		helperText: 'Use the date the current portfolio snapshot was captured.',
		readFrom: ['snapshotAsOfDate', 'snapshot_as_of_date']
	},
	fundFoundedYear: {
		key: 'fundFoundedYear',
		label: 'Fund founded year',
		type: 'number',
		section: 'returns',
		requiredForPublish: false,
		placeholder: '2022',
		helperText: 'Use the fund inception year, not the firm inception year.',
		readFrom: ['fundFoundedYear', 'fund_founded_year']
	},
	firmFoundedYear: {
		key: 'firmFoundedYear',
		label: 'Firm founded year',
		type: 'number',
		section: 'trust',
		requiredForPublish: false,
		placeholder: '2018',
		helperText: 'Use the management company or sponsor founding year.',
		readFrom: ['firmFoundedYear', 'firm_founded_year', 'mcFoundingYear']
	},
	...Object.fromEntries(HISTORICAL_RETURN_YEARS.map((year) => [buildHistoricalReturnFieldConfig(year).key, buildHistoricalReturnFieldConfig(year)])),
	financials: {
		key: 'financials',
		label: 'Auditing',
		type: 'string_enum',
		section: 'returns',
		options: FINANCIALS_OPTIONS,
		requiredForPublish: false,
		helperText: 'Use a structured financial reporting status.',
		readFrom: ['financials', 'auditing', 'auditStatus', 'audit_status']
	},
	taxForm: {
		key: 'taxForm',
		label: 'Tax form',
		type: 'string_enum',
		section: 'returns',
		options: TAX_FORM_OPTIONS,
		requiredForPublish: false,
		helperText: 'Choose the expected investor tax form if it is known.',
		readFrom: ['taxForm', 'tax_form']
	},
	taxCharacteristics: {
		key: 'taxCharacteristics',
		label: 'Tax characteristics',
		type: 'string_free',
		input: 'textarea',
		rows: 3,
		section: 'returns',
		span: 2,
		requiredForPublish: false,
		placeholder: 'K-1 timing, depreciation profile, 1099, state filing considerations...',
		helperText: 'Keep tax nuance in long-form text until there is a dedicated tax schema.',
		readFrom: ['taxCharacteristics', 'tax_characteristics']
	},
	additionalTermNotes: {
		key: 'additionalTermNotes',
		label: 'Additional term notes',
		type: 'string_free',
		input: 'textarea',
		rows: 3,
		section: 'returns',
		span: 2,
		requiredForPublish: false,
		placeholder: 'Anything else the reviewer should know about the static terms?',
		helperText: 'Use this for carry nuances, side letters, or one-off term details.',
		readFrom: ['additionalTermNotes', 'additional_term_notes']
	},
	riskTags: {
		key: 'riskTags',
		label: 'Risk tags',
		type: 'multi_select',
		section: 'risk',
		options: RISK_TAG_OPTIONS,
		requiredForPublish: false,
		helperText: 'Select the standard risk categories that apply to this deal.',
		readFrom: ['riskTags', 'risk_tags']
	},
	riskNotes: {
		key: 'riskNotes',
		label: 'Risk notes',
		type: 'string_free',
		input: 'textarea',
		rows: 4,
		section: 'risk',
		span: 2,
		requiredForPublish: true,
		placeholder: 'Market, leverage, execution, concentration, sponsor, or structure risks...',
		helperText: 'This should help LPs understand what could go wrong.',
		readFrom: ['riskNotes', 'risk_notes']
	},
	downsideNotes: {
		key: 'downsideNotes',
		label: 'Downside notes',
		type: 'string_free',
		input: 'textarea',
		rows: 4,
		section: 'risk',
		span: 2,
		requiredForPublish: false,
		placeholder: 'What happens if underwriting assumptions miss? How is downside absorbed?',
		helperText: 'Use this for downside protection and loss-absorption details.',
		readFrom: ['downsideNotes', 'downside_notes']
	},
	operatorBackground: {
		key: 'operatorBackground',
		label: 'Operator background',
		type: 'string_free',
		input: 'textarea',
		rows: 4,
		section: 'trust',
		span: 2,
		requiredForPublish: false,
		placeholder: 'Track record, team credibility, prior exits, and relevant context...',
		helperText: 'Use this for the key sponsor/operator diligence context.',
		readFrom: ['operatorBackground', 'operator_background']
	},
	propertyAddress: {
		key: 'propertyAddress',
		label: 'Property address',
		type: 'string_free',
		input: 'text',
		section: 'risk',
		span: 2,
		requiredForPublish: false,
		placeholder: '123 Main Street, Dallas, TX',
		helperText: 'Use the actual property address when this is a single-asset or property-specific deal.',
		readFrom: ['propertyAddress', 'property_address']
	},
	propertyType: {
		key: 'propertyType',
		label: 'Property type',
		type: 'string_free',
		input: 'text',
		section: 'risk',
		requiredForPublish: false,
		placeholder: 'Class A multifamily, industrial warehouse, medical office...',
		helperText: 'This can stay freeform for now until we add a deeper property taxonomy.',
		readFrom: ['propertyType', 'property_type']
	},
	purchasePrice: {
		key: 'purchasePrice',
		label: 'Purchase price',
		type: 'currency',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '26,000,000',
		helperText: 'Use the actual acquisition cost, not just the LP equity raise.',
		readFrom: ['purchasePrice', 'purchase_price']
	},
	unitCount: {
		key: 'unitCount',
		label: 'Unit count',
		type: 'number',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '180',
		helperText: 'Use the property unit count when relevant.',
		readFrom: ['unitCount', 'unit_count']
	},
	yearBuilt: {
		key: 'yearBuilt',
		label: 'Year built',
		type: 'number',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '1998',
		helperText: 'Helpful context for property age and capex expectations.',
		readFrom: ['yearBuilt', 'year_built']
	},
	squareFootage: {
		key: 'squareFootage',
		label: 'Square footage',
		type: 'number',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '125000',
		helperText: 'Use total rentable or gross square footage when disclosed.',
		readFrom: ['squareFootage', 'square_footage']
	},
	occupancyPct: {
		key: 'occupancyPct',
		label: 'Occupancy',
		type: 'percentage',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '93',
		helperText: 'Current or in-place occupancy percentage.',
		readFrom: ['occupancyPct', 'occupancy_pct']
	},
	acquisitionLoan: {
		key: 'acquisitionLoan',
		label: 'Acquisition loan',
		type: 'currency',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '18,000,000',
		helperText: 'Debt size at acquisition if this is a real-estate operating deal.',
		readFrom: ['acquisitionLoan', 'acquisition_loan']
	},
	loanToValue: {
		key: 'loanToValue',
		label: 'Loan to value',
		type: 'percentage',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '70',
		helperText: 'Use LTV for both property debt and single-loan credit deals.',
		readFrom: ['loanToValue', 'loan_to_value']
	},
	loanRate: {
		key: 'loanRate',
		label: 'Loan rate',
		type: 'percentage',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '9.5',
		helperText: 'Interest rate or coupon for a credit or loan offering.',
		readFrom: ['loanRate', 'loan_rate']
	},
	loanTermYears: {
		key: 'loanTermYears',
		label: 'Loan term (years)',
		type: 'number',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '3',
		helperText: 'Loan term or note duration in years.',
		readFrom: ['loanTermYears', 'loan_term_years']
	},
	loanIOYears: {
		key: 'loanIOYears',
		label: 'Interest-only years',
		type: 'number',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '1',
		helperText: 'Use this when the property or loan includes an IO period.',
		readFrom: ['loanIOYears', 'loan_io_years']
	},
	capexBudget: {
		key: 'capexBudget',
		label: 'Capex budget',
		type: 'currency',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '2,500,000',
		helperText: 'Capital improvements budget if disclosed.',
		readFrom: ['capexBudget', 'capex_budget']
	},
	closingCosts: {
		key: 'closingCosts',
		label: 'Closing costs',
		type: 'currency',
		section: 'risk',
		requiredForPublish: false,
		placeholder: '450,000',
		helperText: 'Use known closing and transaction costs.',
		readFrom: ['closingCosts', 'closing_costs']
	},
	keyDates: {
		key: 'keyDates',
		label: 'Key dates',
		type: 'string_free',
		input: 'textarea',
		rows: 3,
		section: 'risk',
		span: 2,
		requiredForPublish: false,
		placeholder: 'Launch date, target close, first distribution, extension options, maturity...',
		helperText: 'Keep the critical timeline visible without burying it in notes.',
		readFrom: ['keyDates', 'key_dates']
	},
	coverImageUrl: {
		key: 'coverImageUrl',
		label: 'Cover image URL',
		type: 'string_free',
		input: 'url',
		section: 'media',
		requiredForPublish: false,
		placeholder: 'https://...',
		helperText: 'Use a direct asset URL for the primary image.',
		readFrom: ['coverImageUrl', 'cover_image_url', 'property_image_url', 'image_url']
	},
	heroMediaUrl: {
		key: 'heroMediaUrl',
		label: 'Hero media URL',
		type: 'string_free',
		input: 'url',
		section: 'media',
		requiredForPublish: false,
		placeholder: 'https://...',
		helperText: 'Optional alternate hero media if the card/detail page needs something richer.',
		readFrom: ['heroMediaUrl', 'hero_media_url']
	},
	deckUrl: {
		key: 'deckUrl',
		label: 'Deck URL',
		type: 'string_free',
		input: 'url',
		section: 'media',
		requiredForPublish: false,
		placeholder: 'https://...',
		helperText: 'Link to the deck or primary investor material.',
		readFrom: ['deckUrl', 'deck_url']
	},
	primarySourceUrl: {
		key: 'primarySourceUrl',
		label: 'Primary source URL',
		type: 'string_free',
		input: 'url',
		section: 'media',
		requiredForPublish: false,
		placeholder: 'https://...',
		helperText: 'The source of truth if the deck is not enough.',
		readFrom: ['primarySourceUrl', 'primary_source_url']
	},
	primarySourceContext: {
		key: 'primarySourceContext',
		label: 'Primary source / CTA context',
		type: 'string_free',
		input: 'textarea',
		rows: 3,
		section: 'media',
		span: 2,
		requiredForPublish: true,
		placeholder: 'What is the source of truth here and what should a user do next?',
		helperText: 'Explain the source context or what should happen next for the LP.',
		readFrom: ['primarySourceContext', 'primary_source_context']
	},
	tags: {
		key: 'tags',
		label: 'Tags',
		type: 'multi_select',
		section: 'media',
		span: 2,
		requiredForPublish: false,
		helperText: 'Press Enter or comma to add tags. Remove anything noisy before publishing.',
		readFrom: ['tags']
	}
};

export const dealReviewSections = [
	{
		id: 'core',
		title: 'Source package and classification',
		description: 'These fields define the structured identity and lending-fund taxonomy for the deal.',
		fields: [
			'investmentName',
			'sponsor',
			'companyWebsite',
			'assetClass',
			'slug',
			'dealType',
			'offeringType',
			'offeringStatus',
			'availableTo',
			'investingGeography',
			'investingStates',
			'underlyingExposureTypes',
			'shortSummary',
			'investmentStrategy'
		]
	},
	{
		id: 'sec',
		title: 'SEC and issuer details',
		description: 'Capture filing status, issuer identity, and the legal record that validates the deal.',
		fields: [
			'secLookupState',
			'secVerificationState',
			'secVerificationNotes',
			'secEntityName',
			'secFilingId',
			'secCik',
			'issuerEntity',
			'gpEntity',
			'sponsorEntity',
			'dateOfFirstSale',
			'totalAmountSold',
			'totalInvestors'
		]
	},
	{
		id: 'returns',
		title: 'Static terms',
		description: 'Capture the fixed lending-fund terms that shape the LP experience.',
		fields: [
			'investmentMinimum',
			'holdPeriod',
			'redemption',
			'redemptionNotes',
			'distributions',
			'preferredReturn',
			'lpGpSplit',
			'fees',
			'feeSummary',
			'additionalTermNotes',
			'financials',
			'fundFoundedYear'
		]
	},
	{
		id: 'historicalPerformance',
		title: 'Historical performance',
		description: 'Enter completed-year net returns to LPs as percentage values.',
		fields: HISTORICAL_RETURN_YEARS.map((year) => `historicalReturn${year}`)
	},
	{
		id: 'trust',
		title: 'Sponsor trust',
		description: 'Capture the durable firm-level trust signals that help an LP understand the manager.',
		fields: ['firmFoundedYear', 'operatorBackground']
	},
	{
		id: 'contacts',
		title: 'Contacts',
		description: 'Capture the operator, CEO, and investor relations contacts for the deal.',
		fields: ['teamContacts']
	},
	{
		id: 'snapshot',
		title: 'Current portfolio snapshot',
		description: 'Capture the latest dated operating metrics for the fund.',
		fields: [
			'snapshotAsOfDate',
			'offeringSize',
			'currentFundSize',
			'fundAUM',
			'totalLoansUnderMgmt',
			'equityCommitments',
			'loanCount',
			'currentAvgLoanLtv',
			'avgLoanLTC',
			'maxAllowedLtv',
			'currentLeverage',
			'maxAllowedLeverage',
			'performanceFeePct',
			'inceptionDate',
			'fundTerm'
		]
	},
	{
		id: 'risk',
		title: 'Risk and diligence notes',
		description: 'Use standardized tags plus concise notes to capture the risks and context.',
		fields: ['riskTags', 'riskNotes', 'downsideNotes', 'keyDates', 'taxCharacteristics']
	},
	{
		id: 'media',
		title: 'Media and source context',
		description: 'Publishable deals need evidence, usable media, and a clear source/CTA trail.',
		fields: ['coverImageUrl', 'heroMediaUrl', 'deckUrl', 'primarySourceUrl', 'primarySourceContext', 'tags']
	}
];

function getEmptyValue(field) {
	switch (field.type) {
		case 'entity_reference':
			return { id: '', name: '', createIfMissing: false };
		case 'location':
			return { ...DEFAULT_LOCATION };
		case 'multi_select':
			return [];
		case 'team_contacts':
			return [];
		default:
			return '';
	}
}

export function createEmptyDealReviewForm() {
	return Object.fromEntries(
		Object.values(dealFieldConfig).map((field) => [field.key, getEmptyValue(field)])
	);
}

export function getDealReviewFieldWarning(fieldKey, value) {
	const field = dealFieldConfig[fieldKey];
	if (!field || field.type !== 'string_enum') return '';
	const normalized = normalizeEnumValue(fieldKey, value, { allowUnknown: true });
	return normalized.warning || '';
}

export function createDealReviewFormFromDeal(source) {
	const form = createEmptyDealReviewForm();
	const warnings = {};
	const normalizedCompliance = normalizeDealComplianceFields(source || {});

	for (const field of Object.values(dealFieldConfig)) {
		if (field.type === 'entity_reference') {
			form[field.key] = {
				id: String(readField(source, field.readIdFrom) || '').trim(),
				name: String(readField(source, field.readNameFrom) || '').trim(),
				createIfMissing: false
			};
			continue;
		}

		if (field.type === 'location') {
			form[field.key] = parseLocationValue(readField(source, field.readFrom));
			continue;
		}

		if (field.type === 'team_contacts') {
			form[field.key] = normalizeTeamContacts(readField(source, field.readFrom));
			continue;
		}

		if (field.type === 'string_enum') {
			const normalized = normalizeEnumValue(field.key, readField(source, field.readFrom), {
				allowUnknown: true
			});
			form[field.key] = normalized.value;
			if (normalized.warning) warnings[field.key] = normalized.warning;
			continue;
		}

		form[field.key] = coercePrimitiveField(field, readField(source, field.readFrom));
	}

	form.offeringType = normalizedCompliance.offeringType || form.offeringType;
	const derivedInvestingStates = mergeStateCodeLists(
		form.investingStates,
		ensureArray(readField(source, ['investingGeography', 'investing_geography', 'location'])),
		[source?.state, source?.regionState]
	);
	if (derivedInvestingStates.length > 0) {
		form.investingStates = derivedInvestingStates;
	}

	if (!form.slug && form.investmentName) {
		form.slug = slugify(form.investmentName);
	}

	return { form, warnings };
}

export function formatDealReviewFieldDisplay(fieldKey, value) {
	const field = dealFieldConfig[fieldKey];
	if (!field) return value;
	if (field.key === 'lpGpSplit') return formatLpShareDisplay(value);
	if (field.type === 'currency') return formatNumber(value, { maximumFractionDigits: 0 });
	if (field.type === 'percentage') return formatPercentDisplay(value);
	if (field.type === 'number') return formatNumber(value);
	if (field.type === 'team_contacts') return Array.isArray(value) ? value : [];
	return value;
}

function buildEntityReferencePayload(value) {
	const name = String(value?.name || '').trim();
	const id = String(value?.id || '').trim();
	const createIfMissing = value?.createIfMissing === true;

	if (!name) {
		return {
			value: {
				sponsorName: '',
				managementCompanyId: '',
				createManagementCompany: false
			},
			error: ''
		};
	}

	if (id) {
		return {
			value: {
				sponsorName: name,
				managementCompanyId: id,
				createManagementCompany: false
			},
			error: UUID_PATTERN.test(id) ? '' : 'Select a valid sponsor record.'
		};
	}

	if (createIfMissing) {
		return {
			value: {
				sponsorName: name,
				managementCompanyId: '',
				createManagementCompany: true
			},
			error: ''
		};
	}

	return {
		value: {
			sponsorName: name,
			managementCompanyId: '',
			createManagementCompany: false
		},
		error: 'Select an existing sponsor or choose create new.'
	};
}

function buildLocationPayload(value) {
	const parsed = parseLocationValue(value);
	return {
		value: formatLocationValue(parsed),
		error: ''
	};
}

export function buildDealReviewPayload(form, options = {}) {
	const includeFieldKeys = Array.isArray(options?.includeFieldKeys) && options.includeFieldKeys.length > 0
		? new Set(options.includeFieldKeys)
		: null;
	const payload = {};
	const errors = {};

	for (const field of Object.values(dealFieldConfig)) {
		if (includeFieldKeys && !includeFieldKeys.has(field.key)) continue;
		const rawValue = form[field.key];

		if (field.type === 'entity_reference') {
			const entityResult = buildEntityReferencePayload(rawValue);
			Object.assign(payload, entityResult.value);
			if (entityResult.error) errors[field.key] = entityResult.error;
			continue;
		}

		if (field.type === 'location') {
			const locationResult = buildLocationPayload(rawValue);
			payload[field.key] = locationResult.value;
			continue;
		}

		if (field.type === 'multi_select') {
			payload[field.key] = ensureArray(rawValue);
			continue;
		}

		if (field.type === 'team_contacts') {
			payload[field.key] = normalizeTeamContacts(rawValue);
			continue;
		}

		if (field.key === 'lpGpSplit') {
			payload[field.key] = parseLpShareInput(rawValue);
			if (String(rawValue || '').trim() && payload[field.key] === null) {
				errors[field.key] = 'Enter a valid LP share percentage.';
			}
			continue;
		}

		if (field.type === 'currency' || field.type === 'number') {
			payload[field.key] = parseLooseNumber(rawValue);
			if (String(rawValue || '').trim() && payload[field.key] === null) {
				errors[field.key] = 'Enter a valid number.';
			}
			continue;
		}

		if (field.type === 'percentage') {
			payload[field.key] = parseReviewPercentageInput(field.key, rawValue);
			if (String(rawValue || '').trim() && payload[field.key] === null) {
				errors[field.key] = 'Enter a valid percentage.';
			}
			continue;
		}

		if (field.type === 'string_enum') {
			const normalized = normalizeEnumValue(field.key, rawValue, { allowUnknown: false });
			payload[field.key] = normalized.value;
			if (String(rawValue || '').trim() && !normalized.value) {
				errors[field.key] = normalized.warning || 'Choose one of the allowed options.';
			}
			continue;
		}

		payload[field.key] = String(rawValue || '').trim();
	}

	if (!includeFieldKeys || includeFieldKeys.has('slug') || includeFieldKeys.has('investmentName')) {
		payload.slug = payload.slug || slugify(payload.investmentName);
	}

	if (!includeFieldKeys || includeFieldKeys.has('offeringStatus')) {
		payload.status = payload.offeringStatus || '';
		delete payload.offeringStatus;
	}

	if (!includeFieldKeys || includeFieldKeys.has('offeringType')) {
		const normalizedCompliance = normalizeDealComplianceFields(payload);
		payload.offeringType = normalizedCompliance.offeringType;
		payload.is506b = normalizedCompliance.is506b;
	}

	if (!includeFieldKeys || includeFieldKeys.has('investingStates')) {
		const normalizedStateCodes = ensureArray(payload.investingStates);
		payload.investingStates = normalizedStateCodes;
		if (normalizedStateCodes.length > 0) {
			payload.investingGeography = formatStateCodesAsGeographyValue(normalizedStateCodes);
		}
	}

	return { payload, errors };
}

export function normalizeDealReviewPatch(body = {}) {
	const normalized = { ...body };
	const errors = {};

	for (const field of Object.values(dealFieldConfig)) {
		if (field.type === 'entity_reference' || field.type === 'location') continue;
		if (!(field.key in body)) continue;

		const value = body[field.key];

		if (field.type === 'multi_select') {
			normalized[field.key] = ensureArray(value);
			continue;
		}

		if (field.type === 'team_contacts') {
			normalized[field.key] = normalizeTeamContacts(value);
			continue;
		}

		if (field.key === 'lpGpSplit') {
			const parsed = parseLpShareInput(value);
			normalized[field.key] = parsed;
			if (value !== null && value !== '' && parsed === null) {
				errors[field.key] = 'Enter a valid LP share percentage.';
			}
			continue;
		}

		if (field.type === 'currency' || field.type === 'number') {
			const parsed = parseLooseNumber(value);
			normalized[field.key] = parsed;
			if (value !== null && value !== '' && parsed === null) {
				errors[field.key] = 'Enter a valid number.';
			}
			continue;
		}

		if (field.type === 'percentage') {
			const parsed = parseReviewPercentageInput(field.key, value);
			normalized[field.key] = parsed;
			if (value !== null && value !== '' && parsed === null) {
				errors[field.key] = 'Enter a valid percentage.';
			}
			continue;
		}

		if (field.type === 'string_enum') {
			const normalizedEnum = normalizeEnumValue(field.key, value, { allowUnknown: false });
			normalized[field.key] = normalizedEnum.value;
			if (value && !normalizedEnum.value) {
				errors[field.key] = normalizedEnum.warning || 'Choose one of the allowed options.';
			}
			continue;
		}

		normalized[field.key] = String(value || '').trim();
	}

	if ('offeringStatus' in normalized) {
		normalized.status = normalized.offeringStatus;
	}

	if ('managementCompanyId' in body) {
		const id = String(body.managementCompanyId || '').trim();
		normalized.managementCompanyId = id;
		if (id && !UUID_PATTERN.test(id)) {
			errors.managementCompanyId = 'Select a valid sponsor record.';
		}
	}

	if ('sponsorName' in body) {
		normalized.sponsorName = String(body.sponsorName || '').trim();
	}

	if ('createManagementCompany' in body) {
		normalized.createManagementCompany = body.createManagementCompany === true;
	}

	if ('companyWebsite' in body) {
		normalized.companyWebsite = String(body.companyWebsite || '').trim();
	}

	const normalizedCompliance = normalizeDealComplianceFields(normalized);
	if ('offeringType' in normalized || 'is506b' in normalized || 'is_506b' in body) {
		normalized.offeringType = normalizedCompliance.offeringType;
		normalized.is506b = normalizedCompliance.is506b;
	}

	if ('investingStates' in normalized) {
		normalized.investingStates = ensureArray(normalized.investingStates);
		if (
			normalized.investingStates.length > 0
			&& !('investingGeography' in normalized)
			&& !('investing_geography' in body)
		) {
			normalized.investingGeography = formatStateCodesAsGeographyValue(normalized.investingStates);
		}
	}

	return { values: normalized, errors };
}

export function buildDealReviewCompletenessModel(form, existingDeal) {
	return {
		investmentName: form.investmentName,
		sponsorName: form.sponsor?.name || '',
		slug: form.slug || slugify(form.investmentName),
		assetClass: form.assetClass,
		shortSummary: form.shortSummary,
		investmentMinimum: parseLooseNumber(form.investmentMinimum),
		status: form.offeringStatus,
		offeringSize: parseLooseNumber(form.offeringSize),
		currentFundSize: parseLooseNumber(form.currentFundSize),
		fundAUM: parseLooseNumber(form.fundAUM),
		totalLoansUnderMgmt: parseLooseNumber(form.totalLoansUnderMgmt),
		equityCommitments: parseLooseNumber(form.equityCommitments),
		loanCount: parseLooseNumber(form.loanCount),
		currentAvgLoanLtv: parsePercentInput(form.currentAvgLoanLtv),
		avgLoanLTC: parsePercentInput(form.avgLoanLTC),
		maxAllowedLtv: parsePercentInput(form.maxAllowedLtv),
		currentLeverage: parseLooseNumber(form.currentLeverage),
		maxAllowedLeverage: parseLooseNumber(form.maxAllowedLeverage),
		performanceFeePct: parsePercentInput(form.performanceFeePct),
		inceptionDate: form.inceptionDate,
		fundTerm: form.fundTerm,
		snapshotAsOfDate: form.snapshotAsOfDate,
		fundFoundedYear: parseLooseNumber(form.fundFoundedYear),
		firmFoundedYear: parseLooseNumber(form.firmFoundedYear),
		secLookupState: form.secLookupState,
		coverImageUrl: form.coverImageUrl,
		heroMediaUrl: form.heroMediaUrl,
		targetIRR: parsePercentInput(form.targetIRR),
		cashYield: parsePercentInput(form.cashYield),
		preferredReturn: parsePercentInput(form.preferredReturn),
		equityMultiple: parseLooseNumber(form.equityMultiple),
		redemption: form.redemption,
		redemptionNotes: form.redemptionNotes,
		lpGpSplit: parseLpShareInput(form.lpGpSplit),
		fees: form.fees,
		feeSummary: form.feeSummary,
		additionalTermNotes: form.additionalTermNotes,
		riskTags: ensureArray(form.riskTags),
		riskNotes: form.riskNotes,
		downsideNotes: form.downsideNotes,
		deckUrl: form.deckUrl,
		primarySourceUrl: form.primarySourceUrl,
		primarySourceContext: form.primarySourceContext,
		holdPeriod: parseLooseNumber(form.holdPeriod),
		investingGeography: formatLocationValue(form.investingGeography),
		financials: form.financials,
		taxCharacteristics: form.taxCharacteristics,
		tags: ensureArray(form.tags),
		investmentStrategy: form.investmentStrategy,
		investingStates: ensureArray(form.investingStates),
		underlyingExposureTypes: ensureArray(form.underlyingExposureTypes),
		teamContacts: Array.isArray(form.teamContacts) ? form.teamContacts : [],
		secVerificationState: form.secVerificationState,
		secVerificationNotes: form.secVerificationNotes,
		secEntityName: form.secEntityName,
		secFilingId: form.secFilingId,
		secCik: form.secCik,
		issuerEntity: form.issuerEntity,
		gpEntity: form.gpEntity,
		sponsorEntity: form.sponsorEntity,
		dateOfFirstSale: form.dateOfFirstSale,
		totalAmountSold: parseLooseNumber(form.totalAmountSold),
		totalInvestors: parseLooseNumber(form.totalInvestors),
		...Object.fromEntries(HISTORICAL_RETURN_YEARS.map((year) => [
			`historicalReturn${year}`,
			parseReviewPercentageInput(`historicalReturn${year}`, form[`historicalReturn${year}`])
		])),
		operatorBackground: form.operatorBackground,
		keyDates: form.keyDates,
		updatedAt: existingDeal?.updatedAt || existingDeal?.updated_at || null
	};
}
