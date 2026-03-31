import { ADMIN_EMAILS } from '../_supabase.js';

function normalizeAdminEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isTrackedLpProfile(profile) {
  const email = normalizeAdminEmail(profile?.email);
  return !profile?.is_admin && !ADMIN_EMAILS.includes(email);
}

export function filterTrackedLpProfiles(profiles) {
  return (profiles || []).filter(isTrackedLpProfile);
}

function formatAdminShortDate(value) {
  if (!value) return '--';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '--';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fallbackNameFromEmail(email) {
  const localPart = String(email || '').split('@')[0] || '';
  return localPart
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatMedianDuration(metric) {
  if (!metric || metric.median === null || metric.median === undefined) return '--';
  if (metric.median < 1) return `${Math.round(metric.median * 60)} min`;
  if (metric.median < 24) return `${Math.round(metric.median * 10) / 10} hrs`;
  return `${Math.round((metric.median / 24) * 10) / 10} days`;
}

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

async function getUserEvents(supabase, body) {
  const { email, limit = 30 } = body;
  if (!email) throw new Error('Missing email');

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('email', email.toLowerCase())
    .single();

  if (!profile) throw new Error('User not found');

  const { data, error } = await supabase
    .from('user_events')
    .select('event, data, created_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (error) throw error;
  return { data: data || [] };
}

async function updateUserTier(supabase, body) {
  const { id, updates } = body;
  if (!id) throw new Error('Missing user id');
  if (!updates || Object.keys(updates).length === 0) throw new Error('Missing updates');

  const allowed = ['full_name', 'tier', 'is_admin'];
  const safe = {};
  for (const key of allowed) {
    if (updates[key] !== undefined) safe[key] = updates[key];
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .update(safe)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return { data };
}

async function fetchUserProfilesForMetrics(supabase) {
  const selectAttempts = [
    {
      select:
        'id, email, full_name, created_at, buy_box_complete, funnel_status, deals_viewed_count, deals_saved_count, sessions_count, last_activity_date, tier, is_admin',
      needsDerivedActivity: false
    },
    {
      select: 'id, email, full_name, created_at, tier, is_admin',
      needsDerivedActivity: true
    },
    {
      select: 'id, email, created_at, tier, is_admin',
      needsDerivedActivity: true
    }
  ];

  let lastError = null;

  for (const attempt of selectAttempts) {
    const { data, error } = await supabase.from('user_profiles').select(attempt.select).limit(5000);

    if (!error) {
      const profiles = (data || []).map((profile) => ({
        id: profile.id,
        email: profile.email || '',
        full_name: profile.full_name || '',
        created_at: profile.created_at || null,
        buy_box_complete: Boolean(profile.buy_box_complete),
        funnel_status: profile.funnel_status || 'new',
        deals_viewed_count: profile.deals_viewed_count || 0,
        deals_saved_count: profile.deals_saved_count || 0,
        sessions_count: profile.sessions_count || 0,
        last_activity_date: profile.last_activity_date || null,
        tier: profile.tier || 'free',
        is_admin: Boolean(profile.is_admin)
      }));

      return { profiles, needsDerivedActivity: attempt.needsDerivedActivity };
    }

    if (!String(error.message || '').includes('does not exist')) {
      throw error;
    }

    lastError = error;
  }

  throw lastError || new Error('Failed to load user profiles');
}

async function fetchUserMetricsData(supabase) {
  const { profiles, needsDerivedActivity } = await fetchUserProfilesForMetrics(supabase);

  const { data: events, error: eventsError } = await supabase
    .from('user_events')
    .select('user_id, event, created_at')
    .in('event', [
      'wizard_complete',
      'goals_complete',
      'deal_viewed',
      'deal_saved',
      'call_booked',
      'session_start',
      'page_view',
      'wizard_step',
      'wizard_abandoned',
      'wizard_started'
    ])
    .order('created_at', { ascending: true })
    .limit(10000);

  if (eventsError) throw eventsError;

  const firstEvent = {};
  const eventCounts = {};
  const lastEventDate = {};

  for (const event of events || []) {
    if (!firstEvent[event.user_id]) firstEvent[event.user_id] = {};
    if (!firstEvent[event.user_id][event.event]) {
      firstEvent[event.user_id][event.event] = event.created_at;
    }

    if (!eventCounts[event.user_id]) eventCounts[event.user_id] = {};
    eventCounts[event.user_id][event.event] = (eventCounts[event.user_id][event.event] || 0) + 1;

    if (!lastEventDate[event.user_id] || event.created_at > lastEventDate[event.user_id]) {
      lastEventDate[event.user_id] = event.created_at;
    }
  }

  if (needsDerivedActivity) {
    for (const profile of profiles) {
      const counts = eventCounts[profile.id] || {};
      profile.buy_box_complete = (counts.wizard_complete || 0) > 0;
      profile.deals_viewed_count = counts.deal_viewed || 0;
      profile.deals_saved_count = counts.deal_saved || 0;
      profile.sessions_count = counts.session_start || 0;

      if (counts.call_booked) profile.funnel_status = 'call-booked';
      else if ((counts.deal_saved || 0) >= 3) profile.funnel_status = 'high-intent';
      else if (counts.wizard_complete) profile.funnel_status = 'qualified';
      else if (counts.page_view || counts.deal_viewed) profile.funnel_status = 'exploring';
      else profile.funnel_status = 'new';

      if (lastEventDate[profile.id]) {
        profile.last_activity_date = lastEventDate[profile.id];
      }
    }
  }

  return {
    profiles,
    trackedUsers: filterTrackedLpProfiles(profiles),
    events: events || [],
    firstEvent,
    eventCounts,
    lastEventDate
  };
}

async function userMetrics(supabase) {
  const { trackedUsers, firstEvent } = await fetchUserMetricsData(supabase);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  const totalSignups = trackedUsers.length;
  const signups7d = trackedUsers.filter((user) => user.created_at >= sevenDaysAgo).length;
  const onboarded = trackedUsers.filter((user) => user.buy_box_complete).length;
  const activated = trackedUsers.filter((user) => (user.deals_viewed_count || 0) >= 3).length;
  const savedDeal = trackedUsers.filter((user) => (user.deals_saved_count || 0) >= 1).length;
  const startedDd = trackedUsers.filter((user) =>
    ['high-intent', 'call-booked', 'enrolled'].includes(user.funnel_status)
  ).length;
  const bookedCall = trackedUsers.filter((user) =>
    user.funnel_status === 'call-booked' || user.funnel_status === 'enrolled'
  ).length;

  const funnel = [
    { label: 'Signed Up', count: totalSignups, pct: 100, color: 'var(--primary)' },
    {
      label: 'Completed Onboarding',
      count: onboarded,
      pct: totalSignups ? Math.round((onboarded / totalSignups) * 100) : 0,
      color: '#3b82f6'
    },
    {
      label: 'Viewed 3+ Deals',
      count: activated,
      pct: totalSignups ? Math.round((activated / totalSignups) * 100) : 0,
      color: '#8b5cf6'
    },
    {
      label: 'Saved a Deal',
      count: savedDeal,
      pct: totalSignups ? Math.round((savedDeal / totalSignups) * 100) : 0,
      color: '#10b981'
    },
    {
      label: 'Started DD',
      count: startedDd,
      pct: totalSignups ? Math.round((startedDd / totalSignups) * 100) : 0,
      color: '#14b8a6'
    },
    {
      label: 'Booked a Call',
      count: bookedCall,
      pct: totalSignups ? Math.round((bookedCall / totalSignups) * 100) : 0,
      color: '#f59e0b'
    }
  ];

  const dropoffs = [];
  for (let index = 1; index < funnel.length; index += 1) {
    const previous = funnel[index - 1];
    const current = funnel[index];
    const dropped = previous.count - current.count;
    const dropPct = previous.count > 0 ? Math.round((dropped / previous.count) * 100) : 0;
    dropoffs.push({
      from: previous.label,
      to: current.label,
      dropped,
      dropPct,
      severity: dropPct >= 70 ? 'critical' : dropPct >= 50 ? 'warning' : 'ok'
    });
  }

  function medianHours(userIds, eventName) {
    const deltas = [];

    for (const userId of userIds) {
      const profile = trackedUsers.find((user) => user.id === userId);
      if (!profile) continue;

      const signupTime = new Date(profile.created_at).getTime();
      const eventTime = firstEvent[userId]?.[eventName];
      if (!eventTime) continue;

      const hours = (new Date(eventTime).getTime() - signupTime) / 3600000;
      if (hours >= 0) deltas.push(hours);
    }

    if (deltas.length === 0) return null;

    deltas.sort((a, b) => a - b);
    const midpoint = Math.floor(deltas.length / 2);
    const median =
      deltas.length % 2 ? deltas[midpoint] : (deltas[midpoint - 1] + deltas[midpoint]) / 2;

    return { median: Math.round(median * 10) / 10, samples: deltas.length };
  }

  const trackedUserIds = trackedUsers.map((user) => user.id);
  const ttv = {
    firstOnboard: medianHours(trackedUserIds, 'wizard_complete'),
    firstDealView: medianHours(trackedUserIds, 'deal_viewed'),
    firstSave: medianHours(trackedUserIds, 'deal_saved'),
    firstCallBook: medianHours(trackedUserIds, 'call_booked')
  };

  const timeToValue = [
    {
      key: 'firstOnboard',
      label: 'First Onboarding',
      value: formatMedianDuration(ttv.firstOnboard),
      samples: ttv.firstOnboard?.samples || 0
    },
    {
      key: 'firstDealView',
      label: 'First Deal View',
      value: formatMedianDuration(ttv.firstDealView),
      samples: ttv.firstDealView?.samples || 0
    },
    {
      key: 'firstSave',
      label: 'First Deal Save',
      value: formatMedianDuration(ttv.firstSave),
      samples: ttv.firstSave?.samples || 0
    },
    {
      key: 'firstCallBook',
      label: 'First Call Booked',
      value: formatMedianDuration(ttv.firstCallBook),
      samples: ttv.firstCallBook?.samples || 0
    }
  ];

  const cohorts = [];
  for (let weekIndex = 0; weekIndex < 8; weekIndex += 1) {
    const weekStart = new Date(now.getTime() - (weekIndex + 1) * 7 * 86400000);
    const weekEnd = new Date(now.getTime() - weekIndex * 7 * 86400000);
    const weekLabel = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    const cohortUsers = trackedUsers.filter((user) => {
      const createdAt = new Date(user.created_at);
      return createdAt >= weekStart && createdAt < weekEnd;
    });

    if (cohortUsers.length === 0) continue;

    const count = cohortUsers.length;
    const cohortOnboarded = cohortUsers.filter((user) => user.buy_box_complete).length;
    const cohortActivated = cohortUsers.filter((user) => (user.deals_viewed_count || 0) >= 3).length;
    const cohortSaved = cohortUsers.filter((user) => (user.deals_saved_count || 0) >= 1).length;
    const cohortCalls = cohortUsers.filter((user) =>
      user.funnel_status === 'call-booked' || user.funnel_status === 'enrolled'
    ).length;

    cohorts.push({
      week: weekLabel,
      count,
      signups: count,
      onboarded: count > 0 ? Math.round((cohortOnboarded / count) * 100) : 0,
      active: count > 0 ? Math.round((cohortActivated / count) * 100) : 0,
      activated: count > 0 ? Math.round((cohortActivated / count) * 100) : 0,
      saved: count > 0 ? Math.round((cohortSaved / count) * 100) : 0,
      savedDeal: count > 0 ? Math.round((cohortSaved / count) * 100) : 0,
      call: count > 0 ? Math.round((cohortCalls / count) * 100) : 0,
      bookedCall: count > 0 ? Math.round((cohortCalls / count) * 100) : 0
    });
  }

  const users = trackedUsers
    .map((user) => ({
      id: user.id,
      email: user.email || '',
      name: user.full_name || fallbackNameFromEmail(user.email),
      signedUp: user.created_at,
      lastActive: user.last_activity_date || null,
      onboarded: Boolean(user.buy_box_complete),
      views: user.deals_viewed_count || 0,
      dealsViewed: user.deals_viewed_count || 0,
      saves: user.deals_saved_count || 0,
      dealsSaved: user.deals_saved_count || 0,
      sessions: user.sessions_count || 0,
      funnel: user.funnel_status || 'new',
      tier: user.tier || 'free'
    }))
    .sort((a, b) => new Date(b.signedUp || 0) - new Date(a.signedUp || 0));

  const actionLists = [
    {
      title: 'Needs onboarding',
      items: users
        .filter((user) => !user.onboarded)
        .slice(0, 8)
        .map((user) => ({
          email: user.email || user.name || 'Unknown user',
          meta: `Signed up ${formatAdminShortDate(user.signedUp)}`
        }))
    },
    {
      title: 'Needs activation',
      items: users
        .filter((user) => user.onboarded && user.views < 3)
        .slice(0, 8)
        .map((user) => ({
          email: user.email || user.name || 'Unknown user',
          meta: `${user.views} views, ${user.saves} saves`
        }))
    },
    {
      title: 'High-intent follow-up',
      items: users
        .filter((user) => ['high-intent', 'call-booked', 'enrolled'].includes(user.funnel))
        .slice(0, 8)
        .map((user) => ({
          email: user.email || user.name || 'Unknown user',
          meta: `${user.saves} saves, last active ${formatAdminShortDate(user.lastActive)}`
        }))
    }
  ];

  const wizardStarters = new Set();
  const { data: wizardEvents, error: wizardError } = await supabase
    .from('user_events')
    .select('user_id, event, data, created_at')
    .in('event', ['wizard_started', 'wizard_step', 'wizard_abandoned'])
    .order('created_at', { ascending: true });

  if (wizardError) throw wizardError;

  const wizardStepCounts = {};
  const wizardAbandons = {};

  for (const event of wizardEvents || []) {
    if (!trackedUsers.some((user) => user.id === event.user_id)) continue;

    if (event.event === 'wizard_started') {
      wizardStarters.add(event.user_id);
      continue;
    }

    if (event.event === 'wizard_step') {
      const step = event.data?.step;
      const stepType = event.data?.stepType || 'unknown';
      if (step === undefined) continue;
      if (!wizardStepCounts[step]) wizardStepCounts[step] = { count: 0, label: stepType };
      wizardStepCounts[step].count += 1;
      continue;
    }

    if (event.event === 'wizard_abandoned') {
      wizardStarters.add(event.user_id);
      const step = event.data?.step;
      const stepType = event.data?.stepType || `step_${step || '?'}`;
      wizardAbandons[stepType] = (wizardAbandons[stepType] || 0) + 1;
    }
  }

  const wizardFunnel = Object.entries(wizardStepCounts)
    .map(([step, info]) => ({ step: parseInt(step, 10), label: info.label, usersReached: info.count }))
    .sort((a, b) => a.step - b.step);

  const wizardAbandonList = Object.entries(wizardAbandons)
    .map(([stepType, abandonCount]) => ({ stepType, abandonCount }))
    .sort((a, b) => b.abandonCount - a.abandonCount);

  return {
    summary: { totalSignups, signups7d, onboarded, activated, savedDeal, bookedCall },
    funnel,
    funnelSteps: funnel,
    dropoffs,
    actionLists,
    users,
    userList: users,
    cohorts,
    timeToValue,
    ttv,
    wizardFunnel,
    wizardAbandonList,
    wizardStarters: wizardStarters.size,
    fetchedAt: new Date().toISOString()
  };
}

export const userActions = {
  'list-users': listUsers,
  'user-events': getUserEvents,
  'update-user-tier': updateUserTier,
  'user-metrics': userMetrics
};
