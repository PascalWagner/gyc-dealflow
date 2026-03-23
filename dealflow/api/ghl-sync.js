// Vercel Serverless Function: /api/ghl-sync
// Batch syncs user activity from Supabase → GHL
// Run on a schedule (e.g. every 2 hours via cron) or manually from admin
//
// Architecture: events.js stores everything to Supabase immediately.
// This endpoint reads aggregated activity and syncs to GHL in bulk,
// avoiding per-event GHL API calls that cause rate limiting.

import { getAdminClient, setCors, ghlFetch } from './_supabase.js';

const FUNNEL_ORDER = ['new', 'onboarding', 'qualified', 'high-intent', 'call-booked', 'enrolled'];

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Accept GET (for cron) or POST (for manual trigger)
  const isCron = req.headers['x-vercel-cron'] === '1';
  const secret = req.query.secret || req.headers['x-sync-secret'];
  const isAdmin = secret === process.env.SYNC_SECRET;

  // Basic auth: either cron header, secret param, or POST with auth
  if (!isCron && !isAdmin && req.method !== 'POST') {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const supabase = getAdminClient();

    // Get all non-admin users
    const { data: users, error: usersErr } = await supabase
      .from('user_profiles')
      .select('id, email, ghl_contact_id')
      .limit(2000);

    if (usersErr) throw usersErr;

    // Get aggregated event counts per user
    const { data: events, error: evtErr } = await supabase
      .from('user_events')
      .select('user_id, event, created_at')
      .order('created_at', { ascending: false })
      .limit(50000);

    if (evtErr) throw evtErr;

    // Aggregate per user
    const userActivity = {};
    for (const evt of (events || [])) {
      if (!userActivity[evt.user_id]) {
        userActivity[evt.user_id] = { counts: {}, lastActivity: evt.created_at };
      }
      const ua = userActivity[evt.user_id];
      ua.counts[evt.event] = (ua.counts[evt.event] || 0) + 1;
      if (evt.created_at > ua.lastActivity) ua.lastActivity = evt.created_at;
    }

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const user of (users || [])) {
      const activity = userActivity[user.id];
      if (!activity) { skipped++; continue; }

      try {
        // Look up GHL contact
        const lookupResp = await ghlFetch(
          `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(user.email)}`
        );
        if (!lookupResp?.ok) { skipped++; continue; }

        const ghlData = await lookupResp.json();
        const contact = (ghlData.contacts || [])[0];
        if (!contact) { skipped++; continue; }

        const fullResp = await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`);
        if (!fullResp?.ok) { skipped++; continue; }
        const full = await fullResp.json();
        const contactData = full.contact || full;
        const existingTags = contactData.tags || [];

        const counts = activity.counts;
        const customField = {};
        const tagsToAdd = [];

        // Sync activity fields
        customField['contact.last_activity_date'] = activity.lastActivity;
        if (counts.deal_viewed) customField['contact.deals_viewed_count'] = String(counts.deal_viewed);
        if (counts.deal_saved) customField['contact.deals_saved_count'] = String(counts.deal_saved);
        if (counts.session_start) customField['contact.sessions_count'] = String(counts.session_start);
        if (counts.wizard_complete) customField['contact.buy_box_complete'] = 'true';

        // Tags
        if (counts.wizard_complete && !existingTags.includes('wizard-complete'))
          tagsToAdd.push('wizard-complete');
        if (counts.goals_complete && !existingTags.includes('goals-set'))
          tagsToAdd.push('goals-set');
        if (counts.call_booked && !existingTags.includes('call-booked'))
          tagsToAdd.push('call-booked');
        if ((counts.deal_saved || 0) >= 3 && !existingTags.includes('high-intent'))
          tagsToAdd.push('high-intent');
        if ((counts.session_start || 0) >= 3 && !existingTags.includes('engaged-explorer'))
          tagsToAdd.push('engaged-explorer');

        // Funnel status
        let newFunnel = 'new';
        if (counts.call_booked) newFunnel = 'call-booked';
        else if ((counts.deal_saved || 0) >= 3) newFunnel = 'high-intent';
        else if (counts.wizard_complete) newFunnel = 'qualified';

        const currentFunnel = (contactData.customField || [])
          .find(f => f.key === 'contact.funnel_status')?.value || 'new';
        if (FUNNEL_ORDER.indexOf(newFunnel) > FUNNEL_ORDER.indexOf(currentFunnel)) {
          customField['contact.funnel_status'] = newFunnel;
        }

        const updatePayload = {};
        if (Object.keys(customField).length > 0) updatePayload.customField = customField;
        if (tagsToAdd.length > 0) updatePayload.tags = [...existingTags, ...tagsToAdd];

        if (Object.keys(updatePayload).length > 0) {
          await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`, {
            method: 'PUT',
            body: JSON.stringify(updatePayload)
          });
          synced++;
        } else {
          skipped++;
        }
      } catch (e) {
        console.warn('GHL sync error for', user.email, e.message);
        errors++;
      }
    }

    return res.status(200).json({
      success: true,
      synced,
      skipped,
      errors,
      totalUsers: (users || []).length,
      syncedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('GHL batch sync error:', err);
    return res.status(500).json({ error: err.message });
  }
}
