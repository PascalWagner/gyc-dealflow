// Vercel Serverless Function: GP Deal Update
// PATCH /api/deals/:id — Allows GPs to update their own deal fields
// Auth: Bearer token + authorized_emails check (same pattern as management-companies settings)

import { getAdminClient, setCors, ADMIN_EMAILS } from '../_supabase.js';

const FIELD_MAP = {
  // camelCase (client) → snake_case (DB)
  investmentName: 'investment_name',
  assetClass: 'asset_class',
  dealType: 'deal_type',
  strategy: 'strategy',
  investmentStrategy: 'investment_strategy',
  targetIRR: 'target_irr',
  preferredReturn: 'preferred_return',
  cashOnCash: 'cash_on_cash',
  equityMultiple: 'equity_multiple',
  investmentMinimum: 'investment_minimum',
  holdPeriod: 'hold_period_years',
  offeringSize: 'offering_size',
  purchasePrice: 'purchase_price',
  offeringType: 'offering_type',
  availableTo: 'available_to',
  distributions: 'distributions',
  lpGpSplit: 'lp_gp_split',
  fees: 'fees',
  financials: 'financials',
  investingGeography: 'investing_geography',
  instrument: 'instrument',
  debtPosition: 'debt_position',
  fundAUM: 'fund_aum',
  redemption: 'redemption',
  sponsorCoinvest: 'sponsor_in_deal_pct',
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
  // Special fields
  status: 'status',
  gpReviewedAt: 'gp_reviewed_at',
};

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

  // Fetch deal to get management_company_id
  const { data: deal, error: dealError } = await supabase
    .from('opportunities')
    .select('id, management_company_id')
    .eq('id', id)
    .single();

  if (dealError || !deal) {
    return res.status(404).json({ error: 'Deal not found' });
  }

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
  const updates = {};
  const updated = [];

  for (const [camelKey, snakeKey] of Object.entries(FIELD_MAP)) {
    if (camelKey in body) {
      updates[snakeKey] = body[camelKey];
      updated.push(camelKey);
    }
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const { error: updateError } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id);

  if (updateError) {
    console.error('Deal update failed:', updateError);
    return res.status(500).json({ error: 'Failed to save deal' });
  }

  return res.status(200).json({ success: true, updated });
}
