// Vercel Serverless Function: CRUD for user-specific data via Supabase
// REPLACES: userdata.js (Airtable version)
//
// What changed:
//   - No more paginated fetches or filterByFormula
//   - RLS handles access control (user can only see own data)
//   - Upsert is native (ON CONFLICT)
//   - ~10x faster response times

import { getUserClient, setCors, ghlFetch } from './_supabase.js';

const TABLE_MAP = {
  stages: 'user_deal_stages',
  portfolio: 'user_portfolio',
  goals: 'user_goals',
  taxdocs: 'user_tax_docs'
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
// Verified against actual GHL custom fields (March 20, 2026)
// All fields exist in GHL under Contact > Buy Box / Intro Call folders
const GHL_GOALS_FIELD_MAP = {
  goal_type: 'contact.primary_investment_objective',          // "Primary Investment Goal"
  current_income: 'contact.current_monthly_passive_income',   // "Current Annual Passive Income"
  target_income: 'contact.monthly_passive_income_goal',       // "Annual Passive Income Goal"
  capital_available: 'contact.deployable_capital',            // "Deployable Capital" (SINGLE_OPTIONS — use capitalToRange())
  timeline: 'contact.investment_timeline',                    // "Investment Timeline" (Number)
  tax_reduction: 'contact.tax_reduction_target'               // "Tax Reduction Target" (Monetary)
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

async function handlePost(req, res, supabase, user) {
  const { type, data } = req.body;
  const table = TABLE_MAP[type];
  if (!table) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(TABLE_MAP).join(', ')}` });
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
