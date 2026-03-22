// Vercel Serverless Function: Buy Box Preferences via Supabase
// REPLACES: buybox.js (GHL custom fields version)
//
// What changed:
//   - Preferences stored in Supabase (fast, queryable, proper schema)
//   - Still syncs to GHL on write (so your automations keep working)
//   - Read is instant (~20ms vs ~500ms from GHL)

import { getAdminClient, getUserClient, setCors, rateLimit, ghlFetch } from './_supabase.js';

// GHL field mapping (for sync): Supabase column → GHL custom field key
const GHL_FIELD_MAP = {
  trigger_event: 'contact.investment_trigger_event',
  check_size: 'contact.investment_amount',
  net_worth: 'contact.networth',
  capital_ready: 'contact.capital_availability',
  urgency: 'contact.deployment_urgency',
  asset_classes: 'contact.asset_class_preference',
  entity: 'contact.how_will_you_be_making_this_investment',
  min_cash_yield: 'contact.minimum_1st_year_cash_on_cash_return',
  min_irr: 'contact.minimum_total_return_requirement_irr',
  instruments: 'contact.investing_instrument',
  lockup: 'contact.lockup_period_tolerance',
  deal_structure: 'contact.firm_focus_preference',
  strategies: 'contact.strategy_preference',
  operator_size: 'contact.operator_size_preference',
  redemption: 'contact.redemptions',
  distributions: 'contact.distribution_frequency_options',
  operator_strategy: 'contact.diversification_preference',
  financial_reporting: 'contact.audited_financials_requirement',
  accreditation: 'contact.accreditation_type',
  goal: 'contact.primary_investment_objective',
  fund_source: 'contact.where_is_the_money_coming_from',
  // New fields synced to GHL
  branch: 'contact.onboarding_branch',
  income_structure: 'contact.income_source_type',
  re_professional: 'contact.re_professional_status',
  baseline_income: 'contact.current_passive_income',
  target_cashflow: 'contact.target_passive_income',
  taxable_income: 'contact.tax_offset_target',
  taxable_income_baseline: 'contact.annual_taxable_income',
  growth_priority: 'contact.growth_investment_priority',
  capital_12mo: 'contact.capital_12_month',
  capital_90day: 'contact.capital_90_day',
  capital_readiness: 'contact.investment_timeline',
  max_loss_pct: 'contact.max_loss_tolerance',
  operator_focus: 'contact.operator_focus_preference'
};

// Map frontend wizard keys → Supabase column names
const WIZARD_TO_COLUMN = {
  triggerEvent: 'trigger_event',       // was 'trigger' — fixed to match frontend key
  trigger: 'trigger_event',           // keep backwards compat for old data
  checkSize: 'check_size',
  networth: 'net_worth',
  capitalReady: 'capital_ready',
  urgency: 'urgency',
  assetClasses: 'asset_classes',
  entity: 'entity',
  minCashYield: 'min_cash_yield',
  minIRR: 'min_irr',
  instruments: 'instruments',
  lockup: 'lockup',
  dealStructure: 'deal_structure',
  strategies: 'strategies',
  operatorSize: 'operator_size',
  redemption: 'redemption',
  distributions: 'distributions',
  operatorStrategy: 'operator_strategy',
  financialReporting: 'financial_reporting',
  accreditation: 'accreditation',
  goal: 'goal',
  fundSource: 'fund_source',
  // New onboarding fields (migration 030)
  _branch: 'branch',
  baselineIncome: 'baseline_income',
  targetCashFlow: 'target_cashflow',
  taxableIncome: 'taxable_income',
  taxableIncomeBaseline: 'taxable_income_baseline',
  growthPriority: 'growth_priority',
  incomeStructure: 'income_structure',
  reProfessional: 're_professional',
  maxOperatorPct: 'max_loss_pct',
  capital12mo: 'capital_12mo',
  capital90Day: 'capital_90day',
  capitalReadiness: 'capital_readiness',
  operatorFocus: 'operator_focus',
  sharePortfolio: 'share_portfolio'
};

// Reverse: column → wizard key (for GET response)
const COLUMN_TO_WIZARD = {};
for (const [wiz, col] of Object.entries(WIZARD_TO_COLUMN)) {
  COLUMN_TO_WIZARD[col] = wiz;
}

async function syncToGhl(email, buyBoxRow) {
  try {
    const resp = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`
    );
    if (!resp?.ok) return;

    const data = await resp.json();
    const contact = (data.contacts || [])[0];
    if (!contact) return;

    // Build custom field update
    const customField = {};
    for (const [column, ghlKey] of Object.entries(GHL_FIELD_MAP)) {
      const value = buyBoxRow[column];
      if (value !== undefined && value !== null && value !== '') {
        customField[ghlKey] = Array.isArray(value) ? value.join(', ') : String(value);
      }
    }

    if (Object.keys(customField).length > 0) {
      await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`, {
        method: 'PUT',
        body: JSON.stringify({ customField })
      });
    }
  } catch (e) {
    console.warn('GHL buy box sync error:', e.message);
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!rateLimit(req, res)) return;

  const token = (req.headers.authorization || '').replace('Bearer ', '');

  // GET: Fetch buy box
  if (req.method === 'GET') {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
      const supabase = getAdminClient();

      // Look up user profile by email
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) {
        return res.status(404).json({ error: 'User not found', buyBox: {} });
      }

      // Get buy box
      const { data: buyBox } = await supabase
        .from('user_buy_box')
        .select('*')
        .eq('user_id', profile.id)
        .single();

      // Convert column names back to wizard keys for frontend compatibility
      const wizardBuyBox = {};
      if (buyBox) {
        for (const [column, wizKey] of Object.entries(COLUMN_TO_WIZARD)) {
          if (buyBox[column] !== undefined && buyBox[column] !== null) {
            wizardBuyBox[wizKey] = buyBox[column];
          }
        }
      }

      return res.status(200).json({
        success: true,
        contactId: profile.id,
        name: profile.full_name,
        buyBox: wizardBuyBox
      });
    } catch (e) {
      console.error('Buy box fetch error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST: Save buy box
  if (req.method === 'POST') {
    const { email, wizardData } = req.body || {};
    if (!email || !wizardData) {
      return res.status(400).json({ error: 'Email and wizardData required' });
    }

    try {
      const supabase = getAdminClient();

      // Look up user
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Convert wizard keys to column names
      const row = { user_id: profile.id };
      for (const [wizKey, value] of Object.entries(wizardData)) {
        const column = WIZARD_TO_COLUMN[wizKey];
        if (column && value !== undefined && value !== null && value !== '') {
          row[column] = value;
        }
      }

      // Check if wizard is complete (all required fields filled)
      if (wizardData.goal && wizardData.accreditation) {
        row.completed_at = new Date().toISOString();
      }

      // Upsert
      const { data: saved, error } = await supabase
        .from('user_buy_box')
        .upsert(row, { onConflict: 'user_id' })
        .select()
        .single();

      if (error) throw error;

      // Sync to GHL in background (don't block response)
      syncToGhl(email, saved).catch(() => {});

      return res.status(200).json({
        success: true,
        contactId: profile.id,
        fieldsUpdated: Object.keys(row).length - 1 // minus user_id
      });
    } catch (e) {
      console.error('Buy box save error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
