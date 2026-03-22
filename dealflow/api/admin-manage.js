// Vercel Serverless Function: /api/admin-manage
// Admin CRUD operations for deals, operators, and users in Supabase
// Requires JWT auth + email in ADMIN_EMAILS list

import { getAdminClient, setCors, verifyAdmin } from './_supabase.js';

// --- Deal actions (opportunities table) ---

async function listDeals(supabase, body) {
  const { page = 1, limit = 50, search } = body;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('opportunities')
    .select('*, management_company:management_companies(id, operator_name)', { count: 'exact' })
    .order('added_date', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('investment_name', `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  // Flatten management_company join for frontend
  const flat = (data || []).map(d => ({
    ...d,
    management_company_name: d.management_company?.operator_name || '—',
    management_company: undefined
  }));

  return { data: flat, total: count, page, limit };
}

async function createDeal(supabase, body) {
  // Accept flat fields from admin UI
  const { action, page, limit, search, ...fields } = body;
  const deal = Object.keys(fields).length > 0 ? fields : body.deal;
  if (!deal) throw new Error('Missing deal data');

  const { data, error } = await supabase
    .from('opportunities')
    .insert(deal)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function updateDeal(supabase, body) {
  const { id, updates } = body;
  if (!id) throw new Error('Missing deal id');
  if (!updates || Object.keys(updates).length === 0) throw new Error('Missing updates');

  const { data, error } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function deleteDeal(supabase, body) {
  const { id } = body;
  if (!id) throw new Error('Missing deal id');

  // Soft-delete: set status to Archived (uses status column which always exists)
  // If the `archived` boolean column exists (migration 013), also set it
  const updates = { status: 'Archived' };
  try {
    // Try with archived column first
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...updates, archived: true })
      .eq('id', id)
      .select()
      .single();
    if (error && error.code === '42703') throw new Error('FALLBACK');
    if (error) throw error;
    return { data };
  } catch (e) {
    if (e.message !== 'FALLBACK') throw e;
    // Fallback: archived column doesn't exist yet
    const { data, error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data };
  }
}

async function toggleArchive(supabase, body) {
  const { id, archived } = body;
  if (!id) throw new Error('Missing deal id');

  const shouldArchive = archived !== undefined ? archived : true;
  const updates = { status: shouldArchive ? 'Archived' : 'Active' };
  try {
    const { data, error } = await supabase
      .from('opportunities')
      .update({ ...updates, archived: shouldArchive })
      .eq('id', id)
      .select()
      .single();
    if (error && error.code === '42703') throw new Error('FALLBACK');
    if (error) throw error;
    return { data };
  } catch (e) {
    if (e.message !== 'FALLBACK') throw e;
    const { data, error } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return { data };
  }
}

// --- Operator actions (management_companies table) ---

async function listOperators(supabase, body) {
  const { page = 1, limit = 50, search } = body;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('management_companies')
    .select('*', { count: 'exact' })
    .order('operator_name', { ascending: true })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.ilike('operator_name', `%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  // Map operator_name to name for frontend display
  const flat = (data || []).map(d => ({ ...d, name: d.operator_name }));

  return { data: flat, total: count, page, limit };
}

async function createOperator(supabase, body) {
  const { action, page, limit, search, ...fields } = body;
  const operator = Object.keys(fields).length > 0 ? fields : body.operator;
  if (!operator) throw new Error('Missing operator data');
  // Map 'name' back to 'operator_name'
  if (operator.name && !operator.operator_name) { operator.operator_name = operator.name; delete operator.name; }

  const { data, error } = await supabase
    .from('management_companies')
    .insert(operator)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function updateOperator(supabase, body) {
  const { id, updates } = body;
  if (!id) throw new Error('Missing operator id');
  if (!updates || Object.keys(updates).length === 0) throw new Error('Missing updates');

  const { data, error } = await supabase
    .from('management_companies')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

// --- User actions (user_profiles table) ---

async function listUsers(supabase, body) {
  const { page = 1, limit = 50, search } = body;
  const offset = (page - 1) * limit;

  let query = supabase
    .from('user_profiles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (search) {
    query = query.or(`email.ilike.%${search}%,full_name.ilike.%${search}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;

  return { data, total: count, page, limit };
}

async function updateUserTier(supabase, body) {
  const { id, updates } = body;
  if (!id) throw new Error('Missing user id');
  if (!updates || Object.keys(updates).length === 0) throw new Error('Missing updates');
  // Only allow safe fields
  const allowed = ['full_name', 'tier', 'is_admin'];
  const safe = {};
  for (const k of allowed) { if (updates[k] !== undefined) safe[k] = updates[k]; }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(safe)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

// --- Data Quality ---

const QUALITY_FIELDS = [
  { key: 'investment_name', label: 'Name' },
  { key: 'asset_class', label: 'Asset Class' },
  { key: 'deal_type', label: 'Deal Type' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'investment_strategy', label: 'Inv Strategy' },
  { key: 'target_irr', label: 'Target IRR' },
  { key: 'preferred_return', label: 'Pref Return' },
  { key: 'cash_on_cash', label: 'Cash on Cash' },
  { key: 'investment_minimum', label: 'Minimum' },
  { key: 'hold_period_years', label: 'Hold Period' },
  { key: 'offering_type', label: 'Offering Type' },
  { key: 'offering_size', label: 'Offering Size' },
  { key: 'distributions', label: 'Distributions' },
  { key: 'lp_gp_split', label: 'LP/GP Split' },
  { key: 'fees', label: 'Fees' },
  { key: 'financials', label: 'Financials' },
  { key: 'investing_geography', label: 'Geography' },
  { key: 'instrument', label: 'Instrument' },
  { key: 'deck_url', label: 'Deck' },
  { key: 'ppm_url', label: 'PPM' },
  { key: 'sec_cik', label: 'SEC Filing' },
  { key: 'management_company_id', label: 'Operator' },
  { key: 'purchase_price', label: 'Purchase Price' },
  { key: 'status', label: 'Status' },
];

function computeQuality(deal) {
  const missing = [];
  let filled = 0;
  for (const f of QUALITY_FIELDS) {
    const val = deal[f.key];
    const isFilled = val !== null && val !== undefined && val !== '' && val !== 0 &&
      !(Array.isArray(val) && val.length === 0);
    if (isFilled) filled++;
    else missing.push(f.label);
  }
  let pct = Math.round((filled / QUALITY_FIELDS.length) * 100);
  // Deck, PPM, and SEC filing are required for 100% — cap at 99% if any are missing
  const hasDeck = !!deal.deck_url;
  const hasPPM = !!deal.ppm_url;
  const hasSEC = !!(deal.sec_cik);
  if (pct === 100 && (!hasDeck || !hasPPM || !hasSEC)) pct = 99;
  return {
    pct,
    missing,
    hasDeck,
    hasPPM,
    hasSEC
  };
}

async function listDealsQuality(supabase, body) {
  const { search } = body;

  let query = supabase
    .from('opportunities')
    .select('*, management_company:management_companies(id, operator_name)')
    .is('parent_deal_id', null)
    .order('added_date', { ascending: false });

  if (search) {
    query = query.ilike('investment_name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map(d => {
    const q = computeQuality(d);
    return {
      id: d.id,
      investment_name: d.investment_name,
      asset_class: d.asset_class,
      management_company_id: d.management_company?.id || null,
      management_company_name: d.management_company?.operator_name || '—',
      completeness_pct: q.pct,
      missing_fields: q.missing,
      has_deck: q.hasDeck,
      has_ppm: q.hasPPM,
      has_sec: q.hasSEC,
      added_date: d.added_date
    };
  });

  // Sort by completeness descending (most complete first)
  rows.sort((a, b) => b.completeness_pct - a.completeness_pct);

  const total = rows.length;
  const avgPct = total > 0 ? Math.round(rows.reduce((s, r) => s + r.completeness_pct, 0) / total) : 0;

  return {
    data: rows,
    total,
    stats: {
      total_deals: total,
      avg_completeness: avgPct,
      above_80: rows.filter(r => r.completeness_pct >= 80).length,
      below_50: rows.filter(r => r.completeness_pct < 50).length,
      no_deck: rows.filter(r => !r.has_deck).length,
      no_ppm: rows.filter(r => !r.has_ppm).length,
      no_sec: rows.filter(r => !r.has_sec).length
    }
  };
}

// --- Operator Quality Audit ---

const OPERATOR_QUALITY_FIELDS = [
  { key: 'operator_name', label: 'Name' },
  { key: 'ceo', label: 'CEO' },
  { key: 'website', label: 'Website' },
  { key: 'linkedin_ceo', label: 'LinkedIn' },
  { key: 'invest_clearly_profile', label: 'InvestClearly' },
  { key: 'founding_year', label: 'Founded' },
  { key: 'type', label: 'Type' },
  { key: 'asset_classes', label: 'Asset Classes' },
  { key: 'headquarters', label: 'HQ' },
  { key: 'aum', label: 'AUM' },
  { key: 'description', label: 'Description' },
];

function computeOperatorQuality(op) {
  const missing = [];
  let filled = 0;
  for (const f of OPERATOR_QUALITY_FIELDS) {
    const val = op[f.key];
    const isFilled = val !== null && val !== undefined && val !== '' && val !== 0 &&
      !(Array.isArray(val) && val.length === 0);
    if (isFilled) filled++;
    else missing.push(f.label);
  }
  return {
    pct: Math.round((filled / OPERATOR_QUALITY_FIELDS.length) * 100),
    missing,
    hasWebsite: !!op.website,
    hasLinkedIn: !!op.linkedin_ceo
  };
}

async function listOperatorsQuality(supabase, body) {
  const { search } = body;

  let query = supabase
    .from('management_companies')
    .select('*')
    .order('operator_name', { ascending: true });

  if (search) {
    query = query.ilike('operator_name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Count deals per operator
  const { data: dealCounts } = await supabase
    .from('opportunities')
    .select('management_company_id')
    .is('parent_deal_id', null);

  const countMap = {};
  (dealCounts || []).forEach(d => {
    if (d.management_company_id) {
      countMap[d.management_company_id] = (countMap[d.management_company_id] || 0) + 1;
    }
  });

  const rows = (data || []).map(op => {
    const q = computeOperatorQuality(op);
    return {
      id: op.id,
      name: op.operator_name || op.name,
      type: op.type || '—',
      deal_count: countMap[op.id] || 0,
      completeness_pct: q.pct,
      missing_fields: q.missing,
      has_website: q.hasWebsite,
      has_linkedin: q.hasLinkedIn
    };
  });

  rows.sort((a, b) => b.completeness_pct - a.completeness_pct);

  const total = rows.length;
  const avgPct = total > 0 ? Math.round(rows.reduce((s, r) => s + r.completeness_pct, 0) / total) : 0;

  return {
    data: rows,
    total,
    stats: {
      total_operators: total,
      avg_completeness: avgPct,
      above_80: rows.filter(r => r.completeness_pct >= 80).length,
      below_50: rows.filter(r => r.completeness_pct < 50).length,
      no_website: rows.filter(r => !r.has_website).length,
      no_linkedin: rows.filter(r => !r.has_linkedin).length
    }
  };
}

// --- Deal Intake Wizard ---

async function intakeCreate(supabase, body) {
  const { deal_data, operator_id, create_operator, operator_data } = body;
  if (!deal_data) throw new Error('Missing deal_data');

  let mcId = operator_id;

  // Create operator if needed
  if (create_operator && operator_data) {
    const opRecord = { operator_name: operator_data.name || operator_data.operator_name };
    if (operator_data.website) opRecord.website = operator_data.website;
    if (operator_data.ceo) opRecord.ceo = operator_data.ceo;

    const { data: newOp, error: opErr } = await supabase
      .from('management_companies')
      .insert(opRecord)
      .select()
      .single();
    if (opErr) throw opErr;
    mcId = newOp.id;
  }

  // Set operator on deal
  if (mcId) deal_data.management_company_id = mcId;

  // Insert deal
  const { data: newDeal, error: dealErr } = await supabase
    .from('opportunities')
    .insert(deal_data)
    .select()
    .single();
  if (dealErr) throw dealErr;

  // Seed operator permission record
  if (mcId) {
    await supabase
      .from('operator_permissions')
      .upsert({ management_company_id: mcId }, { onConflict: 'management_company_id' })
      .catch(() => {}); // Don't fail if already exists
  }

  return { data: newDeal, operatorId: mcId };
}

// --- Action router ---

const ACTION_MAP = {
  'list-deals': listDeals,
  'create-deal': createDeal,
  'update-deal': updateDeal,
  'delete-deal': deleteDeal,
  'toggle-archive': toggleArchive,
  'list-operators': listOperators,
  'create-operator': createOperator,
  'update-operator': updateOperator,
  'list-users': listUsers,
  'update-user-tier': updateUserTier,
  'list-deals-quality': listDealsQuality,
  'list-operators-quality': listOperatorsQuality,
  'intake-create': intakeCreate,
};

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  // Verify admin authorization
  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return res.status(403).json({ success: false, error: auth.error });
  }

  try {
    const { action, ...params } = req.body || {};

    if (!action) {
      return res.status(400).json({ success: false, error: 'Missing action parameter' });
    }

    const actionFn = ACTION_MAP[action];
    if (!actionFn) {
      return res.status(400).json({
        success: false,
        error: `Unknown action: ${action}. Valid actions: ${Object.keys(ACTION_MAP).join(', ')}`
      });
    }

    const supabase = getAdminClient();
    const result = await actionFn(supabase, params);

    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Admin manage error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
