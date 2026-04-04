/**
 * dealEnums.js — Enum option arrays and alias maps for deal fields.
 *
 * Pure data: no imports, no side-effects. Consumed by:
 *   dealReviewSchema.js  — ENUM_CONFIG, dealFieldConfig, field normalization
 *   FilterBar.svelte     — populates filter dropdowns
 *   (and others via dealReviewSchema re-exports)
 */

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
	'Key Personnel',
	'Execution',
	'Regulatory',
	'Valuation',
	'Counterparty',
	'Tax',
	'Operational',
	'Insufficient Cash Flow',
	'Transfer Restrictions',
	'Unspecified Investments',
	'Litigation',
	'Limited Recourse',
	'Economic/Market Conditions',
	'Capital Call Risk',
	'Nonperforming Loans',
	'Environmental'
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

// --- Alias maps (lowercase input → canonical option value) ---

export const ASSET_CLASS_ALIASES = {
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

export const DEAL_TYPE_ALIASES = {
	fund: 'Fund',
	syndication: 'Syndication',
	syndicated: 'Syndication',
	direct: 'Direct',
	'joint venture': 'Joint Venture',
	jv: 'Joint Venture',
	portfolio: 'Portfolio'
};

export const OFFERING_STATUS_ALIASES = {
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

export const AVAILABLE_TO_ALIASES = {
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

export const DISTRIBUTIONS_ALIASES = {
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

export const FINANCIALS_ALIASES = {
	audited: 'Audited',
	reviewed: 'Reviewed',
	unaudited: 'Unaudited',
	'not audited': 'Unaudited',
	unknown: 'Unknown'
};

export const INSTRUMENT_ALIASES = {
	debt: 'Debt',
	loan: 'Debt',
	equity: 'Equity',
	'preferred equity': 'Preferred Equity',
	preferred: 'Preferred Equity',
	hybrid: 'Hybrid',
	fund: 'Fund'
};

export const DEBT_POSITION_ALIASES = {
	senior: 'Senior',
	'first lien': 'First Lien',
	'second lien': 'Second Lien',
	mezz: 'Mezzanine',
	mezzanine: 'Mezzanine',
	'preferred equity': 'Preferred Equity',
	other: 'Other'
};

export const TAX_FORM_ALIASES = {
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
