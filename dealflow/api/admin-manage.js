// Vercel Serverless Function: /api/admin-manage
// Admin CRUD operations for deals, operators, and users in Supabase
// Requires JWT auth + email in ADMIN_EMAILS list

import { getAdminClient, setCors, ADMIN_EMAILS } from './_supabase.js';

async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing or invalid Authorization header' };
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = getAdminClient();

  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { authorized: false, error: 'Invalid or expired token' };
  }

  if (!ADMIN_EMAILS.includes(user.email)) {
    return { authorized: false, error: 'Not authorized as admin' };
  }

  return { authorized: true, user };
}

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

  const { data, error } = await supabase
    .from('opportunities')
    .update({ archived: true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function toggleArchive(supabase, body) {
  const { id, archived } = body;
  if (!id) throw new Error('Missing deal id');

  const { data, error } = await supabase
    .from('opportunities')
    .update({ archived: archived !== undefined ? archived : true })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { data };
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
