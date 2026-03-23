// Vercel Serverless Function: CRUD for user-specific data via Supabase
// REPLACES: userdata.js (Airtable version)
//
// What changed:
//   - No more paginated fetches or filterByFormula
//   - RLS handles access control (user can only see own data)
//   - Upsert is native (ON CONFLICT)
//   - ~10x faster response times

import { getUserClient, getAdminClient, verifyAdmin, setCors, ghlFetch } from './_supabase.js';

const TABLE_MAP = {
  stages: 'user_deal_stages',
  portfolio: 'user_portfolio',
  goals: 'user_goals',
  taxdocs: 'user_tax_docs',
  plan: 'user_portfolio_plans'
};

// Map frontend field names → Supabase column names
const FIELD_MAP = {
  stages: {
    'Deal ID': 'deal_id',
    'Stage': 'stage',
    'Notes': 'notes'
  },
  portfolio: {
    'Deal ID': 'deal_id',
    'Investment Name': 'investment_name',
    'Sponsor': 'sponsor',
    'Asset Class': 'asset_class',
    'Amount Invested': 'amount_invested',
    'Date Invested': 'date_invested',
    'Status': 'status',
    'Target IRR': 'target_irr',
    'Distributions Received': 'distributions_received',
    'Hold Period': 'hold_period',
    'Investing Entity': 'investing_entity',
    'Entity Invested Into': 'entity_invested_into',
    'Notes': 'notes'
  },
  goals: {
    'Goal Type': 'goal_type',
    'Current Income': 'current_income',
    'Target Income': 'target_income',
    'Capital Available': 'capital_available',
    'Timeline': 'timeline',
    'Tax Reduction': 'tax_reduction'
  },
  taxdocs: {
    'Tax Year': 'tax_year',
    'Investment Name': 'investment_name',
    'Investing Entity': 'investing_entity',
    'Entity Invested Into': 'entity_invested_into',
    'Form Type': 'form_type',
    'Upload Status': 'upload_status',
    'Date Received': 'date_received',
    'File URL': 'file_url',
    'Portal URL': 'portal_url',
    'Contact': 'contact_name',
    'Contact Email': 'contact_email',
    'Contact Phone': 'contact_phone',
    'Notes': 'notes'
  }
};

// GHL custom field mapping for goals → CRM sync
// Aligned with buybox.js GHL_FIELD_MAP to avoid duplicate fields in GHL
const GHL_GOALS_FIELD_MAP = {
  goal_type: 'contact.primary_investment_objective',          // same as buybox goal
  current_income: 'contact.current_passive_income',           // aligned with buybox baseline_income
  target_income: 'contact.target_passive_income',             // aligned with buybox target_cashflow
  capital_available: 'contact.capital_12_month',              // aligned with buybox capital_12mo
  timeline: 'contact.investment_timeline',                    // aligned with buybox capital_readiness
  tax_reduction: 'contact.tax_offset_target'                  // aligned with buybox taxable_income
};

// Convert numeric capital to GHL SINGLE_OPTIONS range label
function capitalToRange(num) {
  const n = Number(num);
  if (!n || isNaN(n)) return null;
  if (n < 100000) return '<$100k';
  if (n < 250000) return '$100k - $249k';
  if (n < 500000) return '$249k - $499k';
  if (n < 1000000) return '$500k - $999k';
  return '$1M+';
}

// Background sync goals to GHL contact custom fields
async function syncGoalsToGhl(email, goalsRow) {
  try {
    const resp = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`
    );
    if (!resp?.ok) return;

    const data = await resp.json();
    const contact = (data.contacts || [])[0];
    if (!contact) return;

    const customField = {};
    for (const [column, ghlKey] of Object.entries(GHL_GOALS_FIELD_MAP)) {
      const value = goalsRow[column];
      if (value !== undefined && value !== null && value !== '') {
        // deployable_capital is a SINGLE_OPTIONS field — convert number to range label
        if (column === 'capital_available') {
          const rangeLabel = capitalToRange(value);
          if (rangeLabel) customField[ghlKey] = rangeLabel;
        } else {
          customField[ghlKey] = String(value);
        }
      }
    }

    // Also sync the income gap if we have both current and target
    if (goalsRow.target_income && goalsRow.current_income) {
      const gap = Number(goalsRow.target_income) - Number(goalsRow.current_income);
      customField['contact.income_gap'] = String(Math.max(0, gap));
    }

    if (Object.keys(customField).length > 0) {
      await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`, {
        method: 'PUT',
        body: JSON.stringify({ customField })
      });
    }
  } catch (e) {
    console.warn('GHL goals sync error:', e.message);
  }
}

// Convert frontend field names to Supabase column names
function mapFields(type, data) {
  const mapping = FIELD_MAP[type] || {};
  const result = {};
  for (const [key, value] of Object.entries(data)) {
    if (key === '_recordId' || key === 'Email' || key === 'Updated At') continue;
    const column = mapping[key] || key;
    result[column] = value;
  }
  return result;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Extract JWT from Authorization header
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const supabase = getUserClient(token);

  // Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    // Admin impersonation: GET ?admin=true&email=target@example.com&type=...
    // Returns another user's data using admin client (for "View as user" feature)
    if (req.method === 'GET' && req.query.admin === 'true' && req.query.email) {
      const { authorized } = await verifyAdmin(req);
      if (!authorized) return res.status(403).json({ error: 'Admin access required' });
      return await handleAdminGet(req, res);
    }

    switch (req.method) {
      case 'GET': return await handleGet(req, res, supabase, user);
      case 'POST': return await handlePost(req, res, supabase, user);
      case 'DELETE': return await handleDelete(req, res, supabase, user);
      default: return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error(`Error in userdata API (${req.method}):`, err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}

async function handleGet(req, res, supabase, user) {
  const { type } = req.query;

  // Handle notif_prefs: read from user_profiles
  if (type === 'notif_prefs') {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('notif_frequency')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return res.status(200).json({ notif_frequency: data?.notif_frequency || 'weekly' });
  }

  const table = TABLE_MAP[type];
  if (!table) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(TABLE_MAP).join(', ')}` });
  }

  // RLS handles filtering to the current user automatically
  let { data, error } = await supabase
    .from(table)
    .select('*')
    .eq('user_id', user.id);

  if (error) throw error;

  // If goals are empty in Supabase, try to pull from GHL contact
  if (type === 'goals' && (!data || data.length === 0) && user.email) {
    try {
      const ghlResp = await ghlFetch(
        `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(user.email)}`
      );
      if (ghlResp?.ok) {
        const ghlData = await ghlResp.json();
        const contact = (ghlData.contacts || [])[0];
        if (contact?.customField) {
          // Reverse-map GHL fields to Supabase columns
          const cf = {};
          // GHL v1 returns customFields as array of {id, value}
          // Map by field ID (from GHL custom fields list)
          const GHL_ID_MAP = {
            'WIdv6G8BBHk9lBZqsXLy': 'goal_type',               // Primary Investment Goal
            'JDRc9bmJpwCNoXDe6T6a': 'current_income',           // Current Annual Passive Income
            'Auy8hrr2O1G4GZweNaqt': 'target_income',            // Annual Passive Income Goal
            '6FpI05sEc7R7VSl5TK2d': 'capital_available',        // Deployable Capital
          };

          const fields = contact.customFields || contact.customField || [];
          if (Array.isArray(fields)) {
            fields.forEach(f => {
              const mapped = GHL_ID_MAP[f.id];
              if (mapped) cf[mapped] = f.value;
            });
          }

          const goalType = cf.goal_type;
          const targetIncome = cf.target_income;
          const capitalAvailable = cf.capital_available;

          if (goalType || targetIncome || capitalAvailable) {
            // Map GHL goal labels to Supabase goal_type values
            const GOAL_TYPE_MAP = {
              'Cash Flow (income now)': 'passive_income',
              'Equity Growth (wealth later)': 'build_wealth',
              'Tax Optimization (tax shield now)': 'reduce_taxes'
            };

            // Convert GHL range label back to midpoint number
            function rangeToCapital(label) {
              if (!label || typeof label !== 'string') return 0;
              const ranges = {
                '<$100k': 50000,
                '$100k - $249k': 175000,
                '$249k - $499k': 375000,
                '$500k - $999k': 750000,
                '$1M+': 2000000
              };
              return ranges[label] || Number(label) || 0;
            }

            const seedGoals = {
              user_id: user.id,
              goal_type: GOAL_TYPE_MAP[goalType] || goalType || 'passive_income',
              current_income: Number(cf.current_income || 0),
              target_income: Number(targetIncome || 0),
              capital_available: rangeToCapital(capitalAvailable),
              timeline: '5',
              tax_reduction: 0
            };

            // Save to Supabase so we don't pull from GHL again
            const { data: seeded } = await supabase
              .from(table)
              .upsert(seedGoals, { onConflict: 'user_id' })
              .select();

            if (seeded && seeded.length > 0) {
              data = seeded;
            }
          }
        }
      }
    } catch (e) {
      console.warn('GHL goals pull failed:', e.message);
    }
  }

  return res.status(200).json({
    records: data,
    count: data.length,
    type,
    fetchedAt: new Date().toISOString()
  });
}

// Admin endpoint: fetch another user's data by email (for impersonation)
async function handleAdminGet(req, res) {
  const { type, email } = req.query;
  const types = type ? [type] : ['portfolio', 'stages', 'goals', 'taxdocs', 'plan'];
  const adminClient = getAdminClient();

  // Look up user_id by email from auth.users
  const { data: { users }, error: lookupErr } = await adminClient.auth.admin.listUsers();
  const targetUser = (users || []).find(u => u.email === email);
  if (!targetUser) {
    // User hasn't signed up yet — return empty data
    const result = {};
    types.forEach(t => { result[t] = []; });
    return res.status(200).json(result);
  }

  const result = {};
  for (const t of types) {
    const table = TABLE_MAP[t];
    if (!table) continue;
    const { data, error } = await adminClient
      .from(table)
      .select('*')
      .eq('user_id', targetUser.id);
    if (error) throw error;
    result[t] = data || [];
  }

  return res.status(200).json(result);
}

async function handlePost(req, res, supabase, user) {
  const { type, data } = req.body;

  // Special case: profile updates (user_profiles table)
  if (type === 'profile') {
    const allowed = [
      'share_portfolio', 'full_name', 'phone', 'location',
      'share_saved', 'share_dd', 'share_invested', 'allow_follows'
    ];
    const fields = {};
    for (const key of allowed) {
      if (data[key] !== undefined) fields[key] = data[key];
    }
    if (Object.keys(fields).length === 0) {
      return res.status(400).json({ error: 'No valid profile fields to update' });
    }
    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update(fields)
      .eq('id', user.id)
      .select()
      .single();
    if (error) throw error;

    // Sync phone + name to GHL contact (fire-and-forget)
    if (fields.phone || fields.full_name) {
      syncProfileToGhl(user.email, fields).catch(e =>
        console.warn('GHL profile sync failed:', e.message)
      );
    }

    return res.status(200).json({ record: updated, type, updatedAt: new Date().toISOString() });
  }

  // Handle auto-renew preference
  if (type === 'autoRenew') {
    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update({ auto_renew: !!data.autoRenew })
      .eq('id', user.id)
      .select('auto_renew, email')
      .single();
    if (error) throw error;

    // Sync to GHL as a tag
    syncAutoRenewToGhl(updated.email || user.email, !!data.autoRenew).catch(e =>
      console.warn('GHL auto-renew sync failed:', e.message)
    );

    return res.status(200).json({ record: updated, type, updatedAt: new Date().toISOString() });
  }

  // Handle notif_prefs: update user_profiles.notif_frequency + sync GHL tag
  if (type === 'notif_prefs') {
    const freq = data.frequency === 'off' ? 'off' : 'weekly';
    const { data: updated, error } = await supabase
      .from('user_profiles')
      .update({ notif_frequency: freq })
      .eq('id', user.id)
      .select('notif_frequency, email')
      .single();
    if (error) throw error;

    // Background sync to GHL: add/remove deal alert frequency tags
    syncNotifFreqToGhl(updated.email || user.email, freq).catch(e =>
      console.warn('GHL notif freq sync failed:', e.message)
    );

    return res.status(200).json({ record: updated, type, updatedAt: new Date().toISOString() });
  }

  const table = TABLE_MAP[type];
  if (!table) {
    return res.status(400).json({ error: `Invalid type. Must be one of: profile, notif_prefs, ${Object.keys(TABLE_MAP).join(', ')}` });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Data object is required' });
  }

  const fields = mapFields(type, data);
  fields.user_id = user.id;

  let result;

  if (type === 'stages') {
    // Upsert by user_id + deal_id
    if (!fields.deal_id) {
      return res.status(400).json({ error: 'Deal ID is required for stages' });
    }
    const { data: upserted, error } = await supabase
      .from(table)
      .upsert(fields, { onConflict: 'user_id,deal_id' })
      .select()
      .single();
    if (error) throw error;
    result = upserted;

  } else if (type === 'goals') {
    // Upsert by user_id (one record per user)
    const { data: upserted, error } = await supabase
      .from(table)
      .upsert(fields, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    result = upserted;

    // Background sync to GHL custom fields
    syncGoalsToGhl(user.email, result).catch(e =>
      console.warn('GHL goals background sync failed:', e.message)
    );

    // Cross-sync goals into user_buy_box so we have one source of truth
    const buyBoxSync = {};
    if (result.current_income) buyBoxSync.baseline_income = String(result.current_income);
    if (result.target_income) buyBoxSync.target_cashflow = String(result.target_income);
    if (result.tax_reduction) buyBoxSync.taxable_income = String(result.tax_reduction);
    if (result.capital_available) buyBoxSync.capital_12mo = String(result.capital_available);
    if (result.goal_type) {
      const branchMap = { passive_income: 'cashflow', build_wealth: 'growth', reduce_taxes: 'tax' };
      buyBoxSync.branch = branchMap[result.goal_type] || 'cashflow';
      buyBoxSync.goal = result.goal_type;
    }
    if (Object.keys(buyBoxSync).length > 0) {
      await supabase
        .from('user_buy_box')
        .update(buyBoxSync)
        .eq('user_id', user.id)
        .then(() => {})
        .catch(e => console.warn('Goals→BuyBox cross-sync failed:', e.message));
    }

  } else if (type === 'plan') {
    // Upsert by user_id (one plan per user)
    // Plan data comes pre-structured from frontend — pass through directly
    const planFields = {
      user_id: user.id,
      total_capital: data.total_capital || 0,
      check_size: data.check_size || 100000,
      target_annual_income: data.target_annual_income || null,
      target_irr: data.target_irr || null,
      target_tax_offset: data.target_tax_offset || null,
      buckets: data.buckets || [],
      generated_from: data.generated_from || 'manual'
    };
    const { data: upserted, error } = await supabase
      .from('user_portfolio_plans')
      .upsert(planFields, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    result = upserted;

  } else {
    // portfolio, taxdocs: multiple records. Update if ID provided, create otherwise.
    const recordId = data._recordId;
    if (recordId) {
      const { data: updated, error } = await supabase
        .from(table)
        .update(fields)
        .eq('id', recordId)
        .eq('user_id', user.id)  // ensure ownership
        .select()
        .single();
      if (error) throw error;
      result = updated;
    } else {
      const { data: created, error } = await supabase
        .from(table)
        .insert(fields)
        .select()
        .single();
      if (error) throw error;
      result = created;
    }

    // Auto-sync: when a portfolio entry has a deal_id, ensure a pipeline stage exists
    if (type === 'portfolio' && result && result.deal_id) {
      await supabase.from('user_deal_stages').upsert({
        user_id: user.id,
        deal_id: result.deal_id,
        stage: 'invested',
        notes: '',
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id,deal_id', ignoreDuplicates: true }).catch(() => {});
    }
  }

  return res.status(200).json({
    record: result,
    type,
    updatedAt: new Date().toISOString()
  });
}

async function handleDelete(req, res, supabase, user) {
  const { type, recordId } = req.body;
  const table = TABLE_MAP[type];
  if (!table) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(TABLE_MAP).join(', ')}` });
  }
  if (!recordId) {
    return res.status(400).json({ error: 'Record ID is required' });
  }

  // RLS ensures user can only delete own records
  const { error } = await supabase
    .from(table)
    .delete()
    .eq('id', recordId)
    .eq('user_id', user.id);

  if (error) throw error;

  return res.status(200).json({
    deleted: true,
    recordId,
    type,
    deletedAt: new Date().toISOString()
  });
}

// Sync deal alert frequency to GHL as tags
async function syncNotifFreqToGhl(email, freq) {
  if (!email) return;

  const TAG_WEEKLY = 'Deal Alerts - Weekly';
  const TAG_OFF = 'Deal Alerts - Off';

  // Find contact by email
  const searchResp = await ghlFetch(
    `https://services.leadconnectorhq.com/contacts/search/duplicate?email=${encodeURIComponent(email)}&locationId=${process.env.GHL_LOCATION_ID || process.env.GHL_LOCATION}`,
    { method: 'GET' }
  );

  if (!searchResp || !searchResp.ok) return;
  const searchData = await searchResp.json();
  const contact = searchData.contact;
  if (!contact?.id) return;

  const existingTags = contact.tags || [];
  const addTag = freq === 'weekly' ? TAG_WEEKLY : TAG_OFF;
  const removeTag = freq === 'weekly' ? TAG_OFF : TAG_WEEKLY;

  // Remove the opposite tag if present
  if (existingTags.includes(removeTag)) {
    await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}/tags`,
      { method: 'DELETE', body: JSON.stringify({ tags: [removeTag] }) }
    ).catch(() => {});
  }

  // Add the correct tag
  if (!existingTags.includes(addTag)) {
    await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}/tags`,
      { method: 'POST', body: JSON.stringify({ tags: [addTag] }) }
    );
  }
}

// Sync auto-renew preference to GHL as tags
async function syncAutoRenewToGhl(email, autoRenew) {
  if (!email) return;

  const TAG_ON = 'Auto-Renew - On';
  const TAG_OFF = 'Auto-Renew - Off';

  const searchResp = await ghlFetch(
    `https://services.leadconnectorhq.com/contacts/search/duplicate?email=${encodeURIComponent(email)}&locationId=${process.env.GHL_LOCATION_ID || process.env.GHL_LOCATION}`,
    { method: 'GET' }
  );

  if (!searchResp || !searchResp.ok) return;
  const searchData = await searchResp.json();
  const contact = searchData.contact;
  if (!contact?.id) return;

  const existingTags = contact.tags || [];
  const addTag = autoRenew ? TAG_ON : TAG_OFF;
  const removeTag = autoRenew ? TAG_OFF : TAG_ON;

  if (existingTags.includes(removeTag)) {
    await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}/tags`,
      { method: 'DELETE', body: JSON.stringify({ tags: [removeTag] }) }
    ).catch(() => {});
  }

  if (!existingTags.includes(addTag)) {
    await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}/tags`,
      { method: 'POST', body: JSON.stringify({ tags: [addTag] }) }
    );
  }
}

async function syncProfileToGhl(email, fields) {
  if (!email) return;

  const searchResp = await ghlFetch(
    `https://services.leadconnectorhq.com/contacts/search/duplicate?email=${encodeURIComponent(email)}&locationId=${process.env.GHL_LOCATION_ID || process.env.GHL_LOCATION}`,
    { method: 'GET' }
  );

  if (!searchResp || !searchResp.ok) return;
  const searchData = await searchResp.json();
  const contact = searchData.contact;
  if (!contact?.id) return;

  const updates = {};
  if (fields.phone) updates.phone = fields.phone;
  if (fields.full_name) {
    const parts = fields.full_name.trim().split(/\s+/);
    updates.firstName = parts[0] || '';
    updates.lastName = parts.slice(1).join(' ') || '';
  }

  if (Object.keys(updates).length === 0) return;

  await ghlFetch(
    `https://services.leadconnectorhq.com/contacts/${contact.id}`,
    { method: 'PUT', body: JSON.stringify(updates) }
  );
}
