// Single source of truth for deal field mappings (opportunities table).
// Maps camelCase JSON keys to snake_case Supabase columns.
//
// Used by: _enrichment.js, deal-enrich.js, deal-confirm-enrichment.js,
//          deal-cleanup.js, deals/[id].js
// Frontend mirror: src/lib/utils/reviewFieldState.js

const CURRENT_YEAR = new Date().getFullYear();

// ── Base deal field map ─────────────────────────────────────────────────────
// Union of all fields across the 5 API persistence paths.
// A larger map is safe — each consumer only persists keys present in its input.

export const DEAL_FIELD_MAP = {
  // Core identity
  investmentName: 'investment_name',
  managementCompanyId: 'management_company_id',
  sponsorName: 'sponsor_name',
  slug: 'slug',

  // Classification
  assetClass: 'asset_class',
  dealType: 'deal_type',
  strategy: 'strategy',
  investmentStrategy: 'investment_strategy',
  offeringType: 'offering_type',
  availableTo: 'available_to',
  instrument: 'instrument',
  debtPosition: 'debt_position',
  shortSummary: 'short_summary',
  investingGeography: 'investing_geography',
  investingStates: 'investing_states',
  underlyingExposureTypes: 'underlying_exposure_types',

  // Returns & terms
  targetIRR: 'target_irr',
  preferredReturn: 'preferred_return',
  cashOnCash: 'cash_on_cash',
  cashYield: 'cash_yield',
  equityMultiple: 'equity_multiple',
  investmentMinimum: 'investment_minimum',
  holdPeriod: 'hold_period_years',
  offeringSize: 'offering_size',
  distributions: 'distributions',
  lpGpSplit: 'lp_gp_split',
  redemption: 'redemption',
  redemptionNotes: 'redemption_notes',
  additionalTermNotes: 'additional_term_notes',
  taxForm: 'tax_form',

  // Fees
  fees: 'fees',
  feeSummary: 'fee_summary',
  financials: 'financials',
  acquisitionFeePct: 'acquisition_fee_pct',
  assetMgmtFeePct: 'asset_mgmt_fee_pct',
  propertyMgmtFeePct: 'property_mgmt_fee_pct',
  capitalEventFeePct: 'capital_event_fee_pct',
  dispositionFeePct: 'disposition_fee_pct',
  constructionMgmtFeePct: 'construction_mgmt_fee_pct',
  performanceFeePct: 'performance_fee_pct',
  waterfallDetails: 'waterfall_details',

  // Sponsor / operator
  sponsorInDeal: 'sponsor_in_deal_pct',
  operatorBackground: 'operator_background',
  fundFoundedYear: 'fund_founded_year',
  firmFoundedYear: 'firm_founded_year',
  taxCharacteristics: 'tax_characteristics',

  // Fund metrics
  fundAUM: 'fund_aum',
  // managerAUM needs its own DB column (manager_aum) — not mapped until migration added
  currentFundSize: 'current_fund_size',
  loanCount: 'loan_count',
  avgLoanLtv: 'avg_loan_ltv',
  currentAvgLoanLtv: 'current_avg_loan_ltv',
  maxAllowedLtv: 'max_allowed_ltv',
  currentLeverage: 'current_leverage',
  maxAllowedLeverage: 'max_allowed_leverage',
  snapshotAsOfDate: 'snapshot_as_of_date',
  totalLoansUnderMgmt: 'total_loans_under_mgmt',
  equityCommitments: 'equity_commitments',
  avgLoanLTC: 'avg_loan_ltc',
  inceptionDate: 'inception_date',
  fundTerm: 'fund_term',

  // Property-specific
  purchasePrice: 'purchase_price',
  propertyAddress: 'property_address',
  unitCount: 'unit_count',
  yearBuilt: 'year_built',
  squareFootage: 'square_footage',
  occupancyPct: 'occupancy_pct',
  propertyType: 'property_type',
  acquisitionLoan: 'acquisition_loan',
  loanToValue: 'loan_to_value',
  loanRate: 'loan_rate',
  loanTermYears: 'loan_term_years',
  loanIOYears: 'loan_io_years',
  capexBudget: 'capex_budget',
  closingCosts: 'closing_costs',

  // Documents & media
  deckUrl: 'deck_url',
  ppmUrl: 'ppm_url',
  subAgreementUrl: 'sub_agreement_url',
  coverImageUrl: 'cover_image_url',
  heroMediaUrl: 'hero_media_url',
  primarySourceContext: 'primary_source_context',
  primarySourceUrl: 'primary_source_url',
  riskNotes: 'risk_notes',
  downsideNotes: 'downside_notes',
  keyDates: 'key_dates',

  // SEC compliance
  issuerEntity: 'issuer_entity',
  gpEntity: 'gp_entity',
  sponsorEntity: 'sponsor_entity',
  secEntityName: 'sec_entity_name',
  secCik: 'sec_cik',
  dateOfFirstSale: 'date_of_first_sale',
  totalAmountSold: 'total_amount_sold',
  totalInvestors: 'total_investors',
  is506b: 'is_506b',
  secVerificationState: 'sec_verification_state',
  secVerificationNotes: 'sec_verification_notes',
  secLookupState: 'sec_lookup_state',
  secFilingId: 'sec_filing_id',

  // Structured arrays
  tags: 'tags',
  teamContacts: 'team_contacts',
  sourceRiskFactors: 'source_risk_factors',
  highlightedRisks: 'highlighted_risks',
  riskTags: 'risk_tags',

  // Admin / lifecycle
  dealBranch: 'deal_branch',
  status: 'status',
  gpReviewedAt: 'gp_reviewed_at',
  lifecycleStatus: 'lifecycle_status',
  isVisibleToUsers: 'is_visible_to_users',
};

// ── Historical returns (dynamic year entries) ───────────────────────────────

export const HISTORICAL_RETURN_YEARS = [];
for (let year = 2015; year < CURRENT_YEAR; year++) {
  HISTORICAL_RETURN_YEARS.push(year);
}

export function getDealFieldMapWithHistoricalReturns() {
  const map = { ...DEAL_FIELD_MAP };
  for (const year of HISTORICAL_RETURN_YEARS) {
    map[`historicalReturn${year}`] = `historical_return_${year}`;
  }
  return map;
}

// ── Numeric columns (need sanitization before DB write) ─────────────────────

export const NUMERIC_DEAL_COLS = new Set([
  'target_irr', 'preferred_return', 'cash_on_cash', 'cash_yield',
  'equity_multiple', 'investment_minimum', 'hold_period_years',
  'offering_size', 'purchase_price', 'sponsor_in_deal_pct', 'fund_aum',
  'total_loans_under_mgmt', 'equity_commitments', 'avg_loan_ltc',
  'performance_fee_pct', 'current_fund_size', 'loan_count',
  'avg_loan_ltv', 'current_avg_loan_ltv', 'max_allowed_ltv',
  'current_leverage', 'max_allowed_leverage',
  'fund_founded_year', 'firm_founded_year',
  'unit_count', 'year_built', 'square_footage', 'occupancy_pct',
  'acquisition_loan', 'loan_to_value', 'loan_rate',
  'loan_term_years', 'loan_io_years',
  'capex_budget', 'closing_costs',
  'acquisition_fee_pct', 'asset_mgmt_fee_pct', 'property_mgmt_fee_pct',
  'capital_event_fee_pct', 'disposition_fee_pct', 'construction_mgmt_fee_pct',
  'total_investors', 'total_amount_sold',
]);

// Add historical return columns
for (const year of HISTORICAL_RETURN_YEARS) {
  NUMERIC_DEAL_COLS.add(`historical_return_${year}`);
}

// ── JSON array columns ──────────────────────────────────────────────────────

export const JSON_ARRAY_DEAL_COLS = new Set([
  'team_contacts', 'source_risk_factors', 'highlighted_risks',
  'investing_states', 'underlying_exposure_types', 'risk_tags',
]);

// ── Helpers ─────────────────────────────────────────────────────────────────

export function sanitizeNumericValue(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number(String(value).replace(/[$,%]/g, '').replace(/,/g, '').trim());
  return Number.isFinite(n) ? n : null;
}
