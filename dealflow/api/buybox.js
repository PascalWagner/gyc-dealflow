// Vercel Serverless Function: Buy Box Preferences via Supabase
// REPLACES: buybox.js (GHL custom fields version)
//
// What changed:
//   - Preferences stored in Supabase (fast, queryable, proper schema)
//   - Still syncs to GHL on write (so your automations keep working)
//   - Read is instant (~20ms vs ~500ms from GHL)

import {
  getAdminClient,
  getUserClient,
  setCors,
  rateLimit,
  ghlFetch,
  resolveUserFromAccessToken,
  verifyAdmin
} from './_supabase.js';
import {
  expectBooleanish,
  expectPlainObject,
  expectOptionalString,
  requireObjectBody,
  RequestValidationError,
  sendValidationError
} from './_validation.js';

// GHL field mapping (for sync): Supabase column → GHL custom field key
// Only active v3 wizard fields — v1/v2 dead fields removed
const GHL_FIELD_MAP = {
  trigger_event: 'contact.investment_trigger_event',
  net_worth: 'contact.networth',
  asset_classes: 'contact.asset_class_preference',
  lockup: 'contact.lockup_period_tolerance',
  strategies: 'contact.strategy_preference',
  distributions: 'contact.distribution_frequency_options',
  accreditation: 'contact.accreditation_type',
  goal: 'contact.primary_investment_objective',
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
  operator_focus: 'contact.operator_focus_preference',
  share_portfolio: 'contact.lp_network_optin',
  diversification_pref: 'contact.diversification_preference',
  lp_deals_count: 'contact.lp_deals_count'
};

// Map frontend wizard keys → Supabase column names
// Only active v3 wizard fields — v1/v2 dead mappings removed
const WIZARD_TO_COLUMN = {
  triggerEvent: 'trigger_event',
  netWorth: 'net_worth',
  checkSize: 'check_size',
  assetClasses: 'asset_classes',
  lockup: 'lockup',
  strategies: 'strategies',
  distributions: 'distributions',
  accreditation: 'accreditation',
  goal: 'goal',
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
  sharePortfolio: 'share_portfolio',
  diversificationPref: 'diversification_pref',
  lpDealsCount: 'lp_deals_count'
};

// Reverse: column → wizard key (for GET response)
const COLUMN_TO_WIZARD = {};
for (const [wiz, col] of Object.entries(WIZARD_TO_COLUMN)) {
  COLUMN_TO_WIZARD[col] = wiz;
}

const ARRAY_COLUMNS = new Set(['asset_classes', 'strategies', 'deal_types']);
const GOAL_TYPE_TO_BRANCH = {
  passive_income: 'cashflow',
  build_wealth: 'growth',
  reduce_taxes: 'tax'
};
const BRANCH_TO_GOAL_LABEL = {
  cashflow: 'Cash Flow (income now)',
  growth: 'Equity Growth (wealth later)',
  tax: 'Tax Optimization (tax shield now)'
};

function decodeNestedJson(value) {
  let current = value;
  for (let i = 0; i < 6; i += 1) {
    if (typeof current !== 'string') break;
    const trimmed = current.trim();
    if (!trimmed) return '';
    if (!['[', '{', '"'].includes(trimmed[0])) break;
    try {
      current = JSON.parse(trimmed);
    } catch {
      break;
    }
  }
  return current;
}

function flattenStrings(value) {
  if (Array.isArray(value)) {
    return value.flatMap(flattenStrings);
  }
  if (value === null || value === undefined) return [];
  const decoded = decodeNestedJson(value);
  if (decoded !== value) {
    return flattenStrings(decoded);
  }
  if (typeof decoded === 'string') {
    return decoded
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
  }
  return [String(decoded).trim()].filter(Boolean);
}

function normalizeWizardValue(column, value) {
  const decoded = decodeNestedJson(value);

  if (ARRAY_COLUMNS.has(column)) {
    return [...new Set(flattenStrings(decoded))];
  }

  if (column === 'accreditation') {
    const flattened = [...new Set(flattenStrings(decoded))];
    if (flattened.length === 0) return '';
    return flattened.length === 1 ? flattened[0] : flattened;
  }

  return decoded;
}

function applyGoalsOverlay(wizardBuyBox, goalsRow) {
  if (!goalsRow) return wizardBuyBox;

  const next = { ...wizardBuyBox };
  const branch = GOAL_TYPE_TO_BRANCH[String(goalsRow.goal_type || '').trim().toLowerCase()]
    || String(next._branch || '').trim().toLowerCase()
    || '';

  if (branch) {
    next._branch = branch;
    next.branch = branch;
    next.goal = BRANCH_TO_GOAL_LABEL[branch] || next.goal || branch;
  }

  if (goalsRow.current_income !== undefined && goalsRow.current_income !== null) {
    next.baselineIncome = goalsRow.current_income;
  }

  if (goalsRow.capital_available !== undefined && goalsRow.capital_available !== null && goalsRow.capital_available !== '') {
    next.capital12mo = goalsRow.capital_available;
  }

  if (goalsRow.timeline !== undefined && goalsRow.timeline !== null && goalsRow.timeline !== '') {
    next.capitalReadiness = String(goalsRow.timeline);
  }

  if (branch === 'growth') {
    if (goalsRow.target_income !== undefined && goalsRow.target_income !== null && goalsRow.target_income !== '') {
      next.growthCapital = goalsRow.target_income;
      next.targetGrowth = goalsRow.target_income;
    }
  } else if (branch === 'tax') {
    if (goalsRow.tax_reduction !== undefined && goalsRow.tax_reduction !== null && goalsRow.tax_reduction !== '') {
      next.taxableIncome = goalsRow.tax_reduction;
      next.targetTaxSavings = goalsRow.tax_reduction;
    }
  } else if (goalsRow.target_income !== undefined && goalsRow.target_income !== null && goalsRow.target_income !== '') {
    next.targetCashFlow = goalsRow.target_income;
    next.targetIncome = goalsRow.target_income;
  }

  return next;
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

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function resolveBuyBoxContext(req, requestedEmail, { allowImpersonation = false } = {}) {
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Authorization token required' };
  }

  const { user, authError } = await resolveUserFromAccessToken(token);
  const authenticatedEmail = normalizeEmail(user?.email);
  if (!user?.id || !authenticatedEmail) {
    return { ok: false, status: 401, error: authError?.message || 'Invalid or expired token' };
  }

  const normalizedRequestedEmail = normalizeEmail(requestedEmail);
  const wantsImpersonation =
    allowImpersonation &&
    normalizedRequestedEmail &&
    normalizedRequestedEmail !== authenticatedEmail;

  if (!wantsImpersonation) {
    return {
      ok: true,
      token,
      user,
      email: authenticatedEmail,
      isAdminImpersonation: false
    };
  }

  const adminAuth = await verifyAdmin(req);
  if (!adminAuth.authorized) {
    return { ok: false, status: 403, error: 'Admin access required for impersonation' };
  }

  return {
    ok: true,
    token,
    user,
    email: normalizedRequestedEmail,
    isAdminImpersonation: true
  };
}

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!rateLimit(req, res)) return;

  // GET: Fetch buy box
  if (req.method === 'GET') {
    let requestedEmail = '';
    let allowImpersonation = false;
    try {
      requestedEmail = expectOptionalString(req.query?.email, 'email', '');
      allowImpersonation = expectBooleanish(req.query?.admin, 'admin', false);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return sendValidationError(res, error);
      }
      throw error;
    }

    const context = await resolveBuyBoxContext(req, requestedEmail, {
      allowImpersonation
    });
    if (!context.ok) {
      return res.status(context.status).json({ error: context.error });
    }

    try {
      const supabase = context.isAdminImpersonation
        ? getAdminClient()
        : getUserClient(context.token);

      // Look up user profile by verified identity unless an admin is explicitly impersonating.
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id, full_name')
        .eq(context.isAdminImpersonation ? 'email' : 'id', context.isAdminImpersonation ? context.email : context.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (!profile) {
        return res.status(404).json({ error: 'User not found', buyBox: {} });
      }

      // Get buy box
      const { data: buyBox, error: buyBoxError } = await supabase
        .from('user_buy_box')
        .select('*')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (buyBoxError) throw buyBoxError;

      const { data: goalsRow, error: goalsError } = await supabase
        .from('user_goals')
        .select('goal_type, current_income, target_income, capital_available, timeline, tax_reduction')
        .eq('user_id', profile.id)
        .maybeSingle();
      if (goalsError) throw goalsError;

      // Convert column names back to wizard keys for frontend compatibility
      let wizardBuyBox = {};
      if (buyBox) {
        for (const [column, wizKey] of Object.entries(COLUMN_TO_WIZARD)) {
          if (buyBox[column] !== undefined && buyBox[column] !== null) {
            wizardBuyBox[wizKey] = normalizeWizardValue(column, buyBox[column]);
          }
        }

        const branch = String(buyBox.branch || wizardBuyBox._branch || '').toLowerCase();
        const targetValue = normalizeWizardValue('target_cashflow', buyBox.target_cashflow);
        if (targetValue !== undefined && targetValue !== null && targetValue !== '') {
          if (branch === 'growth') {
            wizardBuyBox.growthCapital = targetValue;
            wizardBuyBox.targetGrowth = targetValue;
          } else {
            wizardBuyBox.targetCashFlow = targetValue;
            wizardBuyBox.targetIncome = targetValue;
          }
        }

        if (wizardBuyBox.lpDealsCount !== undefined && wizardBuyBox.dealExperience === undefined) {
          wizardBuyBox.dealExperience = wizardBuyBox.lpDealsCount;
        }

        if (buyBox.completed_at) {
          wizardBuyBox._completedAt = buyBox.completed_at;
        }
      }

      wizardBuyBox = applyGoalsOverlay(wizardBuyBox, goalsRow);

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
    const body = requireObjectBody(req, res);
    if (!body) return;

    let email = '';
    let wizardData = null;
    let allowImpersonation = false;
    try {
      email = expectOptionalString(body.email, 'email', '');
      wizardData = expectPlainObject(body.wizardData, 'wizardData');
      allowImpersonation = expectBooleanish(body.admin, 'admin', false);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return sendValidationError(res, error);
      }
      throw error;
    }

    const context = await resolveBuyBoxContext(req, email, {
      allowImpersonation
    });
    if (!context.ok) {
      return res.status(context.status).json({ error: context.error });
    }

    try {
      const supabase = context.isAdminImpersonation
        ? getAdminClient()
        : getUserClient(context.token);

      // Look up the target user through verified identity, not caller-supplied email.
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq(context.isAdminImpersonation ? 'email' : 'id', context.isAdminImpersonation ? context.email : context.user.id)
        .maybeSingle();
      if (profileError) throw profileError;

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

      if (!row.lp_deals_count && wizardData.dealExperience !== undefined && wizardData.dealExperience !== null && wizardData.dealExperience !== '') {
        row.lp_deals_count = wizardData.dealExperience;
      }

      const branch = String(wizardData._branch || wizardData.branch || '').toLowerCase();
      if (!row.target_cashflow && wizardData.growthCapital !== undefined && wizardData.growthCapital !== null && wizardData.growthCapital !== '' && branch === 'growth') {
        row.target_cashflow = wizardData.growthCapital;
      }

      if (wizardData._markComplete === true) {
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
      syncToGhl(context.email, saved).catch(() => {});

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
