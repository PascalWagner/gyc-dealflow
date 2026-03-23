// Vercel Serverless Function: /api/admin-saas-metrics
// SaaS health metrics: signup funnel, activation rates, drop-off points, time-to-value
// Answers: Where do users get stuck? What's the aha moment? How fast do they get there?

import { getAdminClient, setCors } from './_supabase.js';

const ADMIN_EMAILS = ['pascal@growyourcashflow.com', 'pascalwagner@gmail.com', 'pascal.wagner@growyourcashflow.com', 'pascal@growyourcashflow.io', 'info@pascalwagner.com'];

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getAdminClient();

    // 1. All user profiles — try full columns, fall back to basic if migration 031 not applied
    let profiles;
    const fullSelect = 'id, email, created_at, buy_box_complete, funnel_status, deals_viewed_count, deals_saved_count, sessions_count, last_activity_date, tier, is_admin';
    const basicSelect = 'id, email, created_at, tier, is_admin';

    const { data: fullData, error: fullErr } = await supabase
      .from('user_profiles')
      .select(fullSelect)
      .limit(5000);

    if (fullErr && fullErr.message && fullErr.message.includes('does not exist')) {
      // Activity columns not yet added — use basic query + derive from events
      const { data: basicData, error: basicErr } = await supabase
        .from('user_profiles')
        .select(basicSelect)
        .limit(5000);
      if (basicErr) throw basicErr;
      profiles = (basicData || []).map(p => ({
        ...p,
        buy_box_complete: false,
        funnel_status: 'new',
        deals_viewed_count: 0,
        deals_saved_count: 0,
        sessions_count: 0,
        last_activity_date: null
      }));
    } else if (fullErr) {
      throw fullErr;
    } else {
      profiles = fullData;
    }

    // 2. Key events with timestamps for time-to-value calculations
    const { data: events, error: evtErr } = await supabase
      .from('user_events')
      .select('user_id, event, created_at')
      .in('event', ['wizard_complete', 'goals_complete', 'deal_viewed', 'deal_saved', 'call_booked', 'session_start', 'wizard_step', 'wizard_abandoned', 'wizard_started'])
      .order('created_at', { ascending: true })
      .limit(10000);

    if (evtErr) throw evtErr;

    // Index: first occurrence of each event per user
    const firstEvent = {}; // { userId: { eventName: timestamp } }
    for (const evt of (events || [])) {
      if (!firstEvent[evt.user_id]) firstEvent[evt.user_id] = {};
      if (!firstEvent[evt.user_id][evt.event]) {
        firstEvent[evt.user_id][evt.event] = evt.created_at;
      }
    }

    // Enrich profiles from events if activity columns are missing
    if (fullErr) {
      // Count events per user to derive activity metrics
      const eventCounts = {}; // { userId: { deal_viewed: N, deal_saved: N, ... } }
      for (const evt of (events || [])) {
        if (!eventCounts[evt.user_id]) eventCounts[evt.user_id] = {};
        eventCounts[evt.user_id][evt.event] = (eventCounts[evt.user_id][evt.event] || 0) + 1;
      }
      for (const p of profiles) {
        const counts = eventCounts[p.id] || {};
        p.buy_box_complete = (counts.wizard_complete || 0) > 0;
        p.deals_viewed_count = counts.deal_viewed || 0;
        p.deals_saved_count = counts.deal_saved || 0;
        p.sessions_count = counts.session_start || 0;
        if (counts.call_booked) p.funnel_status = 'call-booked';
        else if ((counts.deal_saved || 0) >= 3) p.funnel_status = 'high-intent';
        else if (counts.wizard_complete) p.funnel_status = 'qualified';
        else p.funnel_status = 'new';
      }
    }

    const now = new Date();
    const sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();

    // --- Funnel Counts ---
    const users = (profiles || []).filter(p => !p.is_admin && !ADMIN_EMAILS.includes((p.email || '').toLowerCase()));
    const totalSignups = users.length;
    const signups7d = users.filter(u => u.created_at >= sevenDaysAgo).length;

    const onboarded = users.filter(u => u.buy_box_complete).length;
    const activated = users.filter(u => (u.deals_viewed_count || 0) >= 3).length;
    const savedDeal = users.filter(u => (u.deals_saved_count || 0) >= 1).length;
    const bookedCall = users.filter(u => u.funnel_status === 'call-booked' || u.funnel_status === 'enrolled').length;

    // --- Funnel Steps (for bar visualization) ---
    const funnelSteps = [
      { label: 'Signed Up', count: totalSignups, pct: 100 },
      { label: 'Completed Onboarding', count: onboarded, pct: totalSignups ? Math.round(onboarded / totalSignups * 100) : 0 },
      { label: 'Viewed 3+ Deals', count: activated, pct: totalSignups ? Math.round(activated / totalSignups * 100) : 0 },
      { label: 'Saved a Deal', count: savedDeal, pct: totalSignups ? Math.round(savedDeal / totalSignups * 100) : 0 },
      { label: 'Started DD', count: users.filter(u => ['high-intent', 'call-booked', 'enrolled'].includes(u.funnel_status)).length, pct: 0 },
      { label: 'Booked a Call', count: bookedCall, pct: totalSignups ? Math.round(bookedCall / totalSignups * 100) : 0 }
    ];
    funnelSteps[4].pct = totalSignups ? Math.round(funnelSteps[4].count / totalSignups * 100) : 0;

    // --- Drop-off Analysis ---
    const dropoffs = [];
    for (let i = 1; i < funnelSteps.length; i++) {
      const prev = funnelSteps[i - 1];
      const curr = funnelSteps[i];
      const dropped = prev.count - curr.count;
      const dropPct = prev.count > 0 ? Math.round(dropped / prev.count * 100) : 0;
      dropoffs.push({
        from: prev.label,
        to: curr.label,
        dropped,
        dropPct,
        severity: dropPct >= 70 ? 'critical' : dropPct >= 50 ? 'warning' : 'ok'
      });
    }

    // --- Time to Value (median hours to reach each milestone) ---
    function medianHours(userIds, eventName) {
      const deltas = [];
      for (const uid of userIds) {
        const profile = users.find(u => u.id === uid);
        if (!profile) continue;
        const signupTime = new Date(profile.created_at).getTime();
        const eventTime = firstEvent[uid]?.[eventName];
        if (eventTime) {
          const hours = (new Date(eventTime).getTime() - signupTime) / 3600000;
          if (hours >= 0) deltas.push(hours);
        }
      }
      if (deltas.length === 0) return null;
      deltas.sort((a, b) => a - b);
      const mid = Math.floor(deltas.length / 2);
      const median = deltas.length % 2 ? deltas[mid] : (deltas[mid - 1] + deltas[mid]) / 2;
      return { median: Math.round(median * 10) / 10, samples: deltas.length };
    }

    const userIds = users.map(u => u.id);
    const ttv = {
      firstOnboard: medianHours(userIds, 'wizard_complete'),
      firstDealView: medianHours(userIds, 'deal_viewed'),
      firstSave: medianHours(userIds, 'deal_saved'),
      firstCallBook: medianHours(userIds, 'call_booked')
    };

    // --- Weekly Cohorts (last 8 weeks) ---
    const cohorts = [];
    for (let w = 0; w < 8; w++) {
      const weekStart = new Date(now - (w + 1) * 7 * 86400000);
      const weekEnd = new Date(now - w * 7 * 86400000);
      const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const cohortUsers = users.filter(u => {
        const d = new Date(u.created_at);
        return d >= weekStart && d < weekEnd;
      });

      if (cohortUsers.length === 0) continue;

      const ct = cohortUsers.length;
      const onb = cohortUsers.filter(u => u.buy_box_complete).length;
      const act = cohortUsers.filter(u => (u.deals_viewed_count || 0) >= 3).length;
      const sav = cohortUsers.filter(u => (u.deals_saved_count || 0) >= 1).length;
      const cal = cohortUsers.filter(u => u.funnel_status === 'call-booked' || u.funnel_status === 'enrolled').length;

      cohorts.push({
        week: weekLabel,
        signups: ct,
        onboarded: ct > 0 ? Math.round(onb / ct * 100) : 0,
        activated: ct > 0 ? Math.round(act / ct * 100) : 0,
        savedDeal: ct > 0 ? Math.round(sav / ct * 100) : 0,
        bookedCall: ct > 0 ? Math.round(cal / ct * 100) : 0
      });
    }

    // --- User List (all signups with their journey) ---
    const userList = users.map(u => ({
      id: u.id,
      email: u.email,
      signedUp: u.created_at,
      lastActive: u.last_activity_date || null,
      onboarded: !!u.buy_box_complete,
      dealsViewed: u.deals_viewed_count || 0,
      dealsSaved: u.deals_saved_count || 0,
      sessions: u.sessions_count || 0,
      funnel: u.funnel_status || 'new',
      tier: u.tier || 'free'
    })).sort((a, b) => new Date(b.signedUp) - new Date(a.signedUp));

    // --- Wizard Step Funnel ---
    // Count how many users reached each wizard step
    const wizardStepCounts = {}; // { stepIndex: Set<userId> }
    const wizardAbandons = {};   // { stepType: count }
    let wizardStarters = new Set();

    for (const evt of (events || [])) {
      if (evt.event === 'wizard_started') {
        wizardStarters.add(evt.user_id);
      }
      if (evt.event === 'wizard_step') {
        // evt was stored with data but we only have created_at in our select
        // We need data for step info — re-query if needed
      }
      if (evt.event === 'wizard_abandoned') {
        wizardStarters.add(evt.user_id);
      }
    }

    // Re-query wizard events with data payload for step details
    const { data: wizEvents } = await supabase
      .from('user_events')
      .select('user_id, event, data, created_at')
      .in('event', ['wizard_step', 'wizard_abandoned'])
      .order('created_at', { ascending: true });

    const userMaxStep = {}; // track highest step each user reached
    for (const evt of (wizEvents || [])) {
      const step = evt.data?.step;
      const stepType = evt.data?.stepType || 'unknown';
      if (evt.event === 'wizard_step' && step !== undefined) {
        if (!userMaxStep[evt.user_id] || step > userMaxStep[evt.user_id]) {
          userMaxStep[evt.user_id] = step;
        }
        if (!wizardStepCounts[step]) wizardStepCounts[step] = { count: 0, label: stepType };
        wizardStepCounts[step].count++;
      }
      if (evt.event === 'wizard_abandoned') {
        const label = stepType || 'step_' + (step || '?');
        wizardAbandons[label] = (wizardAbandons[label] || 0) + 1;
      }
    }

    // Build wizard funnel array sorted by step index
    const wizardFunnel = Object.entries(wizardStepCounts)
      .map(([step, info]) => ({ step: parseInt(step), label: info.label, usersReached: info.count }))
      .sort((a, b) => a.step - b.step);

    const wizardAbandonList = Object.entries(wizardAbandons)
      .map(([label, count]) => ({ stepType: label, abandonCount: count }))
      .sort((a, b) => b.abandonCount - a.abandonCount);

    return res.status(200).json({
      summary: { totalSignups, signups7d, onboarded, activated, savedDeal, bookedCall },
      funnelSteps,
      dropoffs,
      ttv,
      cohorts,
      userList,
      wizardFunnel,
      wizardAbandonList,
      wizardStarters: wizardStarters.size,
      fetchedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('SaaS metrics error:', err);
    return res.status(500).json({ error: 'Failed to fetch SaaS metrics', detail: err.message });
  }
}
