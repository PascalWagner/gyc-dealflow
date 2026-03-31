// Vercel Serverless Function: Event Pipeline via Supabase
// REPLACES: events.js (GHL-only version)
//
// What changed:
//   - Events are stored in a proper log table (queryable, aggregatable)
//   - Still syncs tags + fields to GHL for CRM automations
//   - You can now run analytics queries on user behavior

import {
  getAdminClient,
  setCors,
  rateLimit,
  ghlFetch,
  resolveUserFromAccessToken,
  verifyAdmin
} from './_supabase.js';
import {
  expectEnum,
  isPlainObject,
  normalizeNonEmptyString,
  requireObjectBody
} from './_validation.js';

const EVENT_TAGS = {
  wizard_complete: 'wizard-complete',
  goals_complete: 'goals-set',
  academy_cta_clicked: 'academy-interest',
  call_booked: 'call-booked',
  fund_cta_clicked: 'fund-interest'
};

const THRESHOLD_TAGS = {
  deal_saved: { tag: 'high-intent', threshold: 3 },
  session_start: { tag: 'engaged-explorer', threshold: 3 }
};

const FUNNEL_ORDER = ['new', 'onboarding', 'qualified', 'high-intent', 'call-booked', 'enrolled'];
const EVENT_FUNNEL = {
  wizard_complete: 'qualified',
  deal_saved: 'high-intent',
  call_booked: 'call-booked'
};
const VALID_EVENTS = [
  'academy_cta_clicked',
  'call_booked',
  'deal_saved',
  'deal_viewed',
  'fund_cta_clicked',
  'goals_complete',
  'page_view',
  'session_start',
  'wizard_abandoned',
  'wizard_complete',
  'wizard_started',
  'wizard_step'
];

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

async function syncEventToGhl(email, event, data) {
  try {
    const resp = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`
    );
    if (!resp?.ok) return { fieldsUpdated: 0, tagsAdded: [] };

    const ghlData = await resp.json();
    const contact = (ghlData.contacts || [])[0];
    if (!contact) return { fieldsUpdated: 0, tagsAdded: [] };

    const fullResp = await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`);
    if (!fullResp?.ok) return { fieldsUpdated: 0, tagsAdded: [] };
    const full = await fullResp.json();

    const contactData = full.contact || full;
    const existingTags = contactData.tags || [];
    const customField = {};
    const tagsToAdd = [];

    customField['contact.last_activity_date'] = new Date().toISOString();

    if (event === 'deal_viewed' && data?.viewCount !== undefined)
      customField['contact.deals_viewed_count'] = String(data.viewCount);
    if (event === 'deal_saved' && data?.saveCount !== undefined)
      customField['contact.deals_saved_count'] = String(data.saveCount);
    if (event === 'session_start' && data?.sessionCount !== undefined)
      customField['contact.sessions_count'] = String(data.sessionCount);
    if (event === 'wizard_complete')
      customField['contact.buy_box_complete'] = 'true';
    if (event === 'goals_complete' && data) {
      if (data.incomeGoal !== undefined) customField['contact.monthly_passive_income_goal'] = String(data.incomeGoal);
      if (data.incomeGap !== undefined) customField['contact.income_gap'] = String(data.incomeGap);
    }

    // Direct tags
    if (EVENT_TAGS[event] && !existingTags.includes(EVENT_TAGS[event]))
      tagsToAdd.push(EVENT_TAGS[event]);

    // Threshold tags
    const threshold = THRESHOLD_TAGS[event];
    if (threshold) {
      const count = event === 'deal_saved' ? data?.saveCount : data?.sessionCount;
      if (count >= threshold.threshold && !existingTags.includes(threshold.tag))
        tagsToAdd.push(threshold.tag);
    }

    // Funnel status
    const newFunnel = EVENT_FUNNEL[event];
    if (newFunnel) {
      const currentFunnel = (contactData.customField || [])
        .find(f => f.key === 'contact.funnel_status')?.value || 'new';
      if (FUNNEL_ORDER.indexOf(newFunnel) > FUNNEL_ORDER.indexOf(currentFunnel)) {
        customField['contact.funnel_status'] = newFunnel;
      }
    }

    const updatePayload = {};
    if (Object.keys(customField).length > 0) updatePayload.customField = customField;
    if (tagsToAdd.length > 0) updatePayload.tags = [...existingTags, ...tagsToAdd];

    if (Object.keys(updatePayload).length > 0) {
      await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`, {
        method: 'PUT',
        body: JSON.stringify(updatePayload)
      });
    }

    return { fieldsUpdated: Object.keys(customField).length, tagsAdded: tagsToAdd };
  } catch (e) {
    console.warn('GHL event sync error:', e.message);
    return { fieldsUpdated: 0, tagsAdded: [] };
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const body = requireObjectBody(req, res);
  if (!body) return;

  const requestedEmailInput = normalizeNonEmptyString(body.email);
  let event = normalizeNonEmptyString(body.event);
  const data = body.data === undefined ? {} : body.data;

  if (!requestedEmailInput || !event) {
    return res.status(400).json({ error: 'email and event required' });
  }
  try {
    event = expectEnum(event, 'event', VALID_EVENTS);
  } catch (error) {
    return res.status(400).json({ error: error.message });
  }
  if (!isPlainObject(data)) {
    return res.status(400).json({ error: 'data must be a JSON object when provided' });
  }

  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const { user, authError } = await resolveUserFromAccessToken(token);
  const authenticatedEmail = normalizeEmail(user?.email);
  const requestedEmail = normalizeEmail(requestedEmailInput);
  if (!user?.id || !authenticatedEmail) {
    return res.status(401).json({ error: authError?.message || 'Invalid or expired token' });
  }

  if (requestedEmail !== authenticatedEmail) {
    const adminAuth = await verifyAdmin(req);
    if (!adminAuth.authorized) {
      return res.status(403).json({ error: 'Admin access required for cross-user events' });
    }
  }

  try {
    const supabase = getAdminClient();

    // Look up user
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', requestedEmail)
      .single();

    if (!profile) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Store event in Supabase immediately (the source of truth)
    const { error: insertError } = await supabase
      .from('user_events')
      .insert({
        user_id: profile.id,
        event,
        data: data || {}
      });

    if (insertError) throw insertError;

    // Update activity summary on user_profiles (best-effort, columns may not exist)
    try {
      const profileUpdate = { last_activity_date: new Date().toISOString() };
      if (event === 'deal_viewed' && data?.viewCount !== undefined)
        profileUpdate.deals_viewed_count = data.viewCount;
      if (event === 'deal_saved' && data?.saveCount !== undefined)
        profileUpdate.deals_saved_count = data.saveCount;
      if (event === 'session_start' && data?.sessionCount !== undefined)
        profileUpdate.sessions_count = data.sessionCount;
      if (event === 'wizard_complete')
        profileUpdate.buy_box_complete = true;

      // Funnel status: only advance, never regress
      const newFunnel = EVENT_FUNNEL[event];
      if (newFunnel) {
        const { data: currentProfile } = await supabase
          .from('user_profiles')
          .select('funnel_status')
          .eq('id', profile.id)
          .single();
        const currentStatus = currentProfile?.funnel_status || 'new';
        if (FUNNEL_ORDER.indexOf(newFunnel) > FUNNEL_ORDER.indexOf(currentStatus)) {
          profileUpdate.funnel_status = newFunnel;
        }
      }

      await supabase
        .from('user_profiles')
        .update(profileUpdate)
        .eq('id', profile.id);
    } catch (profileErr) {
      // Activity columns may not exist yet — event is already stored, so this is non-fatal
      console.warn('Profile update skipped (columns may not exist):', profileErr.message);
    }

    // Always try GHL sync — but never block or fail the response
    // If GHL is down or rate-limited, the cron job catches it later
    let ghlResult = { fieldsUpdated: 0, tagsAdded: [] };
    try {
      ghlResult = await syncEventToGhl(requestedEmail, event, data);
    } catch (ghlErr) {
      console.warn('GHL sync failed (will retry via cron):', ghlErr.message);
    }

    return res.status(200).json({
      success: true,
      event,
      fieldsUpdated: ghlResult.fieldsUpdated,
      tagsAdded: ghlResult.tagsAdded
    });

  } catch (e) {
    console.error('Event pipeline error:', e);
    return res.status(500).json({ error: e.message });
  }
}
