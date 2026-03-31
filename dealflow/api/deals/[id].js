// Vercel Serverless Function: GP Deal Update
// PATCH /api/deals/:id — Allows GPs to update their own deal fields
// Auth: Bearer token + authorized_emails check (same pattern as management-companies settings)

import { getAdminClient, setCors, ADMIN_EMAILS } from '../_supabase.js';
import { resolveDealWorkflowMutation, slugify } from '../../src/lib/utils/dealWorkflow.js';
import { normalizeDealReviewPatch } from '../../src/lib/utils/dealReviewSchema.js';

const FIELD_MAP = {
  // camelCase (client) → snake_case (DB)
  investmentName: 'investment_name',
  managementCompanyId: 'management_company_id',
  assetClass: 'asset_class',
  dealType: 'deal_type',
  strategy: 'strategy',
  investmentStrategy: 'investment_strategy',
  targetIRR: 'target_irr',
  preferredReturn: 'preferred_return',
  cashOnCash: 'cash_on_cash',
  cashYield: 'cash_yield',
  equityMultiple: 'equity_multiple',
  investmentMinimum: 'investment_minimum',
  holdPeriod: 'hold_period_years',
  offeringSize: 'offering_size',
  purchasePrice: 'purchase_price',
  offeringType: 'offering_type',
  offeringSize: 'offering_size',
  availableTo: 'available_to',
  distributions: 'distributions',
  lpGpSplit: 'lp_gp_split',
  fees: 'fees',
  financials: 'financials',
  instrument: 'instrument',
  shortSummary: 'short_summary',
  coverImageUrl: 'cover_image_url',
  heroMediaUrl: 'hero_media_url',
  riskNotes: 'risk_notes',
  downsideNotes: 'downside_notes',
  deckUrl: 'deck_url',
  ppmUrl: 'ppm_url',
  subAgreementUrl: 'sub_agreement_url',
  feeSummary: 'fee_summary',
  taxCharacteristics: 'tax_characteristics',
  operatorBackground: 'operator_background',
  keyDates: 'key_dates',
  primarySourceContext: 'primary_source_context',
  primarySourceUrl: 'primary_source_url',
  sponsorName: 'sponsor_name',
  slug: 'slug',
  investingGeography: 'investing_geography',
  debtPosition: 'debt_position',
  fundAUM: 'fund_aum',
  loanCount: 'loan_count',
  avgLoanLtv: 'avg_loan_ltv',
  redemption: 'redemption',
  sponsorCoinvest: 'sponsor_in_deal_pct',
  sponsorInDeal: 'sponsor_in_deal_pct',
  taxForm: 'tax_form',
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
  acquisitionFeePct: 'acquisition_fee_pct',
  assetMgmtFeePct: 'asset_mgmt_fee_pct',
  propertyMgmtFeePct: 'property_mgmt_fee_pct',
  capitalEventFeePct: 'capital_event_fee_pct',
  dispositionFeePct: 'disposition_fee_pct',
  constructionMgmtFeePct: 'construction_mgmt_fee_pct',
  tags: 'tags',
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
  secFilingId: 'sec_filing_id',
  dealBranch: 'deal_branch',
  teamContacts: 'team_contacts',
  sourceRiskFactors: 'source_risk_factors',
  highlightedRisks: 'highlighted_risks',
  // Special fields
  status: 'status',
  gpReviewedAt: 'gp_reviewed_at',
  lifecycleStatus: 'lifecycle_status',
  isVisibleToUsers: 'is_visible_to_users',
};

const NUMERIC_FIELD_KEYS = new Set([
  'targetIRR',
  'preferredReturn',
  'cashOnCash',
  'cashYield',
  'equityMultiple',
  'investmentMinimum',
  'holdPeriod',
  'offeringSize',
  'purchasePrice',
  'fundAUM',
  'sponsorCoinvest',
  'sponsorInDeal',
  'unitCount',
  'yearBuilt',
  'squareFootage',
  'occupancyPct',
  'acquisitionLoan',
  'loanToValue',
  'loanRate',
  'loanTermYears',
  'loanIOYears',
  'capexBudget',
  'closingCosts',
  'acquisitionFeePct',
  'assetMgmtFeePct',
  'propertyMgmtFeePct',
  'capitalEventFeePct',
  'dispositionFeePct',
  'constructionMgmtFeePct',
  'loanCount',
  'totalInvestors',
]);

const JSON_ARRAY_FIELD_KEYS = new Set(['teamContacts', 'sourceRiskFactors', 'highlightedRisks']);

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split('\n')
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

function normalizeValue(key, value) {
  if (value === undefined) return value;
  if (key === 'managementCompanyId') {
    const trimmed = String(value || '').trim();
    return trimmed || null;
  }
  if (key === 'secFilingId') {
    const trimmed = String(value || '').trim();
    return trimmed || null;
  }
  if (key === 'tags') {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (key === 'teamContacts') {
    return normalizeTeamContacts(value);
  }
  if (key === 'sourceRiskFactors' || key === 'highlightedRisks') {
    return normalizeStringArray(value);
  }
  if (NUMERIC_FIELD_KEYS.has(key)) {
    if (value === null || value === '') return null;
    const numericValue =
      typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(numericValue) ? numericValue : null;
  }
  return value;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });

  const { id } = req.query;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return res.status(400).json({ error: 'Invalid deal ID' });
  }

  // Authenticate via Bearer token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = getAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Fetch deal to get management_company_id and current workflow fields
  const { data: deal, error: dealError } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single();

  if (dealError || !deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

  const availableColumns = new Set(Object.keys(deal || {}));

  // Verify: user must be in authorized_emails for this deal's company, or be admin
  const isAdmin = ADMIN_EMAILS.includes(user.email.toLowerCase());

  if (!isAdmin) {
    if (!deal.management_company_id) {
      return res.status(403).json({ error: 'Deal has no linked company' });
    }

    const { data: company } = await supabase
      .from('management_companies')
      .select('authorized_emails')
      .eq('id', deal.management_company_id)
      .single();

    const authorizedEmails = (company?.authorized_emails || []).map(e => e.toLowerCase());
    if (!authorizedEmails.includes(user.email.toLowerCase())) {
      return res.status(403).json({ error: 'Not authorized for this deal' });
    }
  }

  // Build update object from whitelisted fields
  const body = req.body || {};
  const { values: normalizedBody, errors: reviewFieldErrors } = normalizeDealReviewPatch(body);
  if (Object.keys(reviewFieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Invalid deal update',
      fieldErrors: reviewFieldErrors
    });
  }

  const candidateBody = {
    ...body,
    ...normalizedBody
  };
  const requestedSponsorName = String(candidateBody.sponsorName || '').trim();
  const requestedCompanyWebsite =
    'companyWebsite' in candidateBody ? String(candidateBody.companyWebsite || '').trim() : undefined;
  let touchedManagementCompany = false;
  let resolvedCompanyWebsite = deal.management_company?.website || '';

  if (candidateBody.createManagementCompany === true && !candidateBody.managementCompanyId && requestedSponsorName) {
    const { data: createdCompany, error: createCompanyError } = await supabase
      .from('management_companies')
      .insert({
        operator_name: requestedSponsorName,
        website: requestedCompanyWebsite || null
      })
      .select('id, operator_name')
      .single();

    if (createCompanyError || !createdCompany) {
      return res.status(500).json({ error: 'Failed to create sponsor record' });
    }

    candidateBody.managementCompanyId = createdCompany.id;
    candidateBody.sponsorName = createdCompany.operator_name;
    touchedManagementCompany = true;
    resolvedCompanyWebsite = requestedCompanyWebsite || '';

    await supabase
      .from('operator_permissions')
      .upsert({ management_company_id: createdCompany.id }, { onConflict: 'management_company_id' })
      .catch(() => {});
  } else if (candidateBody.managementCompanyId) {
    const { data: linkedCompany, error: linkedCompanyError } = await supabase
      .from('management_companies')
      .select('id, operator_name, website')
      .eq('id', candidateBody.managementCompanyId)
      .single();

    if (linkedCompanyError || !linkedCompany) {
      return res.status(400).json({ error: 'Selected sponsor record was not found' });
    }

    const companyPatch = {};
    if (requestedSponsorName && requestedSponsorName !== linkedCompany.operator_name) {
      companyPatch.operator_name = requestedSponsorName;
    }
    if (requestedCompanyWebsite !== undefined) {
      companyPatch.website = requestedCompanyWebsite || null;
    }

    let nextCompany = linkedCompany;
    if (Object.keys(companyPatch).length > 0) {
      const { data: updatedCompany, error: updateCompanyError } = await supabase
        .from('management_companies')
        .update(companyPatch)
        .eq('id', linkedCompany.id)
        .select('id, operator_name, website')
        .single();

      if (updateCompanyError || !updatedCompany) {
        return res.status(500).json({ error: 'Failed to update sponsor record' });
      }

      nextCompany = updatedCompany;
      touchedManagementCompany = true;
    }

    candidateBody.sponsorName = nextCompany.operator_name;
    resolvedCompanyWebsite = nextCompany.website || '';
  }

  const updates = {};
  const updated = [];
  const omitted = [];

  for (const [camelKey, snakeKey] of Object.entries(FIELD_MAP)) {
    if (camelKey in candidateBody) {
      if (!availableColumns.has(snakeKey)) {
        omitted.push(camelKey);
        continue;
      }
      updates[snakeKey] = normalizeValue(camelKey, candidateBody[camelKey]);
      updated.push(camelKey);
    }
  }

  if (Object.keys(updates).length === 0 && touchedManagementCompany && availableColumns.has('updated_at')) {
    updates.updated_at = new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  if (updates.investment_name && !updates.slug && availableColumns.has('slug')) {
    updates.slug = slugify(updates.investment_name);
  }
  if (availableColumns.has('sponsor_name') && !updates.sponsor_name && candidateBody.sponsorName !== undefined) {
    updates.sponsor_name = String(candidateBody.sponsorName || '').trim();
  }

  if (updates.lifecycle_status !== undefined || updates.is_visible_to_users !== undefined) {
    const resolution = resolveDealWorkflowMutation(deal, updates);
    if (resolution.error) {
      return res.status(400).json({ error: resolution.error });
    }
    updates.lifecycle_status = resolution.lifecycleStatus;
    updates.is_visible_to_users = resolution.isVisibleToUsers;
  }

  const { data: updatedDeal, error: updateError } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('Deal update failed:', updateError);
    return res.status(500).json({ error: 'Failed to save deal' });
  }

  return res.status(200).json({
    success: true,
    updated,
    omitted,
    deal: {
      ...updatedDeal,
      slug: updatedDeal?.slug || slugify(updatedDeal?.investment_name || ''),
      mcWebsite: resolvedCompanyWebsite,
      companyWebsite: resolvedCompanyWebsite
    }
  });
}
