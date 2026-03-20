// Vercel Serverless Function: /api/operator-outreach
// Operator permission tracking + outreach email generation
// Admin-only endpoint for managing 506(b) compliance

import { getAdminClient, setCors, verifyAdmin } from './_supabase.js';

// --- Priority score for outreach sorting ---
// Higher = should be worked next. Backlog operators with lots of deals float up.
function computePriority(row) {
  const dealScore = (row.deal_count || 0) * 10;
  const typeScore = row.offering_type === '506b' ? 5 : row.offering_type === 'unknown' ? 3 : 0;
  // Pre-outreach stages get higher urgency so they surface for planning
  const statusScore = {
    backlog: 4,
    researching: 3,
    ready_to_contact: 5,  // highest — these are prepped and waiting
    contacted: 1,
    follow_up: 2,
    in_discussion: 1,
    approved: 0,
    denied: 0
  }[row.outreach_status] || 0;
  return dealScore + typeScore + statusScore;
}

// --- List all operators with permission status ---
async function listOutreach(supabase, params) {
  const { page = 1, limit = 50, search, status, sort } = params;

  // Fetch all (small dataset ~25 operators) for priority sorting
  let query = supabase
    .from('operators_with_permissions')
    .select('*');

  if (search) {
    query = query.or(`operator_name.ilike.%${search}%,contact_name.ilike.%${search}%,contact_email.ilike.%${search}%`);
  }
  if (status && status !== 'all') {
    query = query.eq('outreach_status', status);
  }

  const { data, error } = await query;
  if (error) throw error;

  // Compute priority and sort
  const rows = (data || []).map(r => ({ ...r, priority: computePriority(r) }));
  if (sort === 'alpha') {
    rows.sort((a, b) => (a.operator_name || '').localeCompare(b.operator_name || ''));
  } else {
    // Default: priority descending (highest priority first)
    rows.sort((a, b) => b.priority - a.priority);
  }

  // Paginate in JS
  const total = rows.length;
  const offset = (page - 1) * limit;
  const paged = rows.slice(offset, offset + limit);

  return { data: paged, total, page, limit };
}

// --- Get single operator permission record ---
async function getOutreach(supabase, params) {
  const { managementCompanyId } = params;
  if (!managementCompanyId) throw new Error('Missing managementCompanyId');

  const { data, error } = await supabase
    .from('operators_with_permissions')
    .select('*')
    .eq('id', managementCompanyId)
    .single();

  if (error) throw error;
  return { data };
}

// --- Upsert permission record (with auto-logging) ---
async function upsertOutreach(supabase, params, adminUser) {
  const { managementCompanyId, ...fields } = params;
  if (!managementCompanyId) throw new Error('Missing managementCompanyId');

  // Remove non-DB fields
  delete fields.action;

  // Fetch existing record to detect changes
  const { data: existing } = await supabase
    .from('operator_permissions')
    .select('outreach_status, permission_granted')
    .eq('management_company_id', managementCompanyId)
    .single();

  const record = {
    management_company_id: managementCompanyId,
    ...fields
  };

  // Auto-set outreach_date when first actual contact happens (not during planning stages)
  const contactStages = ['contacted', 'follow_up', 'in_discussion', 'approved', 'denied'];
  if (fields.outreach_status && contactStages.includes(fields.outreach_status) && !fields.outreach_date) {
    record.outreach_date = new Date().toISOString();
  }
  if (fields.permission_granted === true && !fields.permission_date) {
    record.permission_date = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from('operator_permissions')
    .upsert(record, { onConflict: 'management_company_id' })
    .select()
    .single();

  if (error) throw error;

  // Auto-log status changes
  const adminEmail = adminUser?.email || 'admin';
  const oldStatus = existing?.outreach_status || 'backlog';
  const newStatus = fields.outreach_status;
  if (newStatus && newStatus !== oldStatus) {
    await supabase.from('operator_interactions').insert({
      management_company_id: managementCompanyId,
      interaction_type: 'status_change',
      note: `Status changed from "${oldStatus}" to "${newStatus}"`,
      metadata: { old_status: oldStatus, new_status: newStatus },
      created_by: adminEmail
    }).catch(() => {}); // Don't fail the upsert if logging fails
  }

  // Auto-log permission changes
  const oldPerm = existing?.permission_granted || false;
  if (fields.permission_granted === true && !oldPerm) {
    await supabase.from('operator_interactions').insert({
      management_company_id: managementCompanyId,
      interaction_type: 'permission_granted',
      note: fields.permission_scope || 'Permission granted',
      metadata: { scope: fields.permission_scope, proof: fields.permission_proof_url },
      created_by: adminEmail
    }).catch(() => {});
  } else if (fields.permission_granted === false && oldPerm) {
    await supabase.from('operator_interactions').insert({
      management_company_id: managementCompanyId,
      interaction_type: 'permission_denied',
      note: 'Permission revoked',
      metadata: {},
      created_by: adminEmail
    }).catch(() => {});
  }

  return { data };
}

// --- Bulk status update (mark multiple as contacted) ---
async function bulkUpdateStatus(supabase, params) {
  const { ids, outreach_status, outreach_method } = params;
  if (!ids || !ids.length) throw new Error('Missing ids array');
  if (!outreach_status) throw new Error('Missing outreach_status');

  const records = ids.map(managementCompanyId => ({
    management_company_id: managementCompanyId,
    outreach_status,
    outreach_method: outreach_method || null,
    outreach_date: new Date().toISOString()
  }));

  const { data, error } = await supabase
    .from('operator_permissions')
    .upsert(records, { onConflict: 'management_company_id' })
    .select();

  if (error) throw error;
  return { data, updated: records.length };
}

// --- Generate outreach email for an operator ---
async function generateEmail(supabase, params) {
  const { managementCompanyId, template = 'initial' } = params;
  if (!managementCompanyId) throw new Error('Missing managementCompanyId');

  // Get operator details
  const { data: mc, error } = await supabase
    .from('management_companies')
    .select('*')
    .eq('id', managementCompanyId)
    .single();
  if (error) throw error;

  // Get their deals
  const { data: deals } = await supabase
    .from('opportunities')
    .select('investment_name, asset_class, offering_type, status')
    .eq('management_company_id', managementCompanyId)
    .is('parent_deal_id', null);

  const ceoFirst = mc.ceo ? mc.ceo.split(' ')[0] : 'there';
  const dealNames = (deals || []).map(d => d.investment_name).join(', ');
  const dealCount = (deals || []).length;

  const templates = {
    initial: {
      subject: `Partnership Opportunity — Grow Your Cashflow x ${mc.operator_name}`,
      body: `Hi ${ceoFirst},

I'm Pascal Wagner, founder of Grow Your Cashflow — a platform that helps accredited investors evaluate and compare private market opportunities side-by-side.

We've been tracking ${mc.operator_name}${dealCount > 0 ? ` and currently have ${dealCount} of your offering${dealCount > 1 ? 's' : ''} (${dealNames}) in our database` : ''}.

I wanted to reach out for two reasons:

1. **Permission to share** — Some of your materials may be marked confidential, and I want to make sure we have your explicit permission to display deal metrics and documents to our verified accredited investor community. We can tailor exactly what's shown (metrics only, deck included, PPM access, etc.).

2. **Distribution partnership** — Our investors are actively evaluating deals and deploying capital. Having your offering properly featured (with your approval) means more qualified eyes on your deal.

Would you be open to a quick call to discuss? I'd love to understand how we can best represent ${mc.operator_name} to our community.

Happy to share more about our platform and investor base beforehand.

Best,
Pascal Wagner
Founder, Grow Your Cashflow
pascal@growyourcashflow.com`
    },
    follow_up: {
      subject: `Following up — ${mc.operator_name} on Grow Your Cashflow`,
      body: `Hi ${ceoFirst},

Just circling back on my previous email about featuring ${mc.operator_name} on Grow Your Cashflow.

We have a growing community of accredited investors actively comparing private market deals. Getting your explicit permission to share your offering details ensures we represent your fund accurately and compliantly.

Quick summary of what I need:
- Your OK to display deal metrics (target returns, minimums, etc.) to verified accredited investors
- Whether you'd like us to include the deck/PPM or just high-level data
- A point of contact for investor inquiries

Takes 5 minutes. Worth it for the distribution.

Best,
Pascal Wagner
pascal@growyourcashflow.com`
    },
    performance_request: {
      subject: `Investor update request — ${mc.operator_name}`,
      body: `Hi ${ceoFirst},

Our investors who are tracking ${mc.operator_name} have been asking about performance updates. Would you be open to sharing periodic updates (quarterly or as available) that we can pass along to interested investors?

This could include:
- Distribution payments made
- Portfolio/fund performance metrics
- Any material updates (new acquisitions, exits, etc.)

This helps our investors stay informed and builds confidence in your offering — which translates to more capital interest.

Let me know if this works for you.

Best,
Pascal Wagner
pascal@growyourcashflow.com`
    }
  };

  const email = templates[template];
  if (!email) throw new Error(`Unknown template: ${template}. Options: ${Object.keys(templates).join(', ')}`);

  return {
    template,
    operatorName: mc.operator_name,
    contactEmail: null, // User fills in the email manually
    subject: email.subject,
    body: email.body,
    deals: deals || []
  };
}

// --- Stats summary ---
async function outreachStats(supabase) {
  const { data: all, error } = await supabase
    .from('operators_with_permissions')
    .select('outreach_status, permission_granted, offering_type, deal_count');

  if (error) throw error;

  const stats = {
    total: all.length,
    backlog: 0,
    researching: 0,
    ready_to_contact: 0,
    contacted: 0,
    follow_up: 0,
    in_discussion: 0,
    approved: 0,
    denied: 0,
    permission_rate: 0,
    deals_covered: 0,
    deals_total: 0
  };

  for (const row of all) {
    const s = row.outreach_status || 'backlog';
    stats[s] = (stats[s] || 0) + 1;
    stats.deals_total += row.deal_count || 0;
    if (row.permission_granted) stats.deals_covered += row.deal_count || 0;
  }

  const decided = stats.approved + stats.denied;
  stats.permission_rate = decided > 0 ? Math.round((stats.approved / decided) * 100) : 0;

  return { stats };
}

// --- Seed permission records for any operators that don't have one ---
async function seedPermissions(supabase) {
  // Get all operators that don't have a permission record yet
  const { data: operators, error: mcErr } = await supabase
    .from('management_companies')
    .select('id');
  if (mcErr) throw mcErr;

  const { data: existing, error: exErr } = await supabase
    .from('operator_permissions')
    .select('management_company_id');
  if (exErr) throw exErr;

  const existingIds = new Set((existing || []).map(r => r.management_company_id));
  const toSeed = (operators || []).filter(o => !existingIds.has(o.id));

  if (toSeed.length === 0) return { seeded: 0, message: 'All operators already have permission records' };

  const records = toSeed.map(o => ({ management_company_id: o.id }));
  const { data, error } = await supabase
    .from('operator_permissions')
    .insert(records)
    .select();
  if (error) throw error;

  return { seeded: data.length, message: `Created ${data.length} new permission records` };
}

// --- Log an interaction ---
async function logInteraction(supabase, params, adminUser) {
  const { managementCompanyId, type, note, metadata } = params;
  if (!managementCompanyId) throw new Error('Missing managementCompanyId');
  if (!type) throw new Error('Missing interaction type');

  const { data, error } = await supabase
    .from('operator_interactions')
    .insert({
      management_company_id: managementCompanyId,
      interaction_type: type,
      note: note || '',
      metadata: metadata || {},
      created_by: adminUser?.email || 'admin'
    })
    .select()
    .single();

  if (error) throw error;
  return { data };
}

// --- List interactions for an operator ---
async function listInteractions(supabase, params) {
  const { managementCompanyId, limit = 50 } = params;
  if (!managementCompanyId) throw new Error('Missing managementCompanyId');

  const { data, error } = await supabase
    .from('operator_interactions')
    .select('*')
    .eq('management_company_id', managementCompanyId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return { data: data || [] };
}

// --- Action router ---
const ACTION_MAP = {
  'list': listOutreach,
  'get': getOutreach,
  'upsert': upsertOutreach,
  'bulk-update': bulkUpdateStatus,
  'generate-email': generateEmail,
  'stats': outreachStats,
  'seed': seedPermissions,
  'log-interaction': logInteraction,
  'list-interactions': listInteractions,
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ success: false, error: 'Method not allowed' });

  const auth = await verifyAdmin(req);
  if (!auth.authorized) return res.status(403).json({ success: false, error: auth.error });

  try {
    const { action, ...params } = req.body || {};
    if (!action) return res.status(400).json({ success: false, error: 'Missing action' });

    const actionFn = ACTION_MAP[action];
    if (!actionFn) {
      return res.status(400).json({
        success: false,
        error: `Unknown action: ${action}. Valid: ${Object.keys(ACTION_MAP).join(', ')}`
      });
    }

    const supabase = getAdminClient();
    const result = await actionFn(supabase, params, auth.user);
    return res.status(200).json({ success: true, ...result });
  } catch (err) {
    console.error('Operator outreach error:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
