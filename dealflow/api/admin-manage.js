// Vercel Serverless Function: /api/admin-manage
// Admin CRUD operations for deals, operators, and users in Supabase
// Requires JWT auth + email in ADMIN_EMAILS list

import { ADMIN_EMAILS, getAdminClient, setCors, verifyAdmin } from './_supabase.js';

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

async function getUserEvents(supabase, body) {
  const { email, limit = 30 } = body;
  if (!email) throw new Error('Missing email');

  // Look up user_id from email
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

function normalizeAdminEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isTrackedLpProfile(profile) {
  const email = normalizeAdminEmail(profile?.email);
  return !profile?.is_admin && !ADMIN_EMAILS.includes(email);
}

function filterTrackedLpProfiles(profiles) {
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

async function fetchUserProfilesForMetrics(supabase) {
  const selectAttempts = [
    {
      select: 'id, email, full_name, created_at, buy_box_complete, funnel_status, deals_viewed_count, deals_saved_count, sessions_count, last_activity_date, tier, is_admin',
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
    const { data, error } = await supabase
      .from('user_profiles')
      .select(attempt.select)
      .limit(5000);

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

  const { data: events, error: evtErr } = await supabase
    .from('user_events')
    .select('user_id, event, created_at')
    .in('event', ['wizard_complete', 'goals_complete', 'deal_viewed', 'deal_saved', 'call_booked', 'session_start', 'page_view', 'wizard_step', 'wizard_abandoned', 'wizard_started'])
    .order('created_at', { ascending: true })
    .limit(10000);

  if (evtErr) throw evtErr;

  const firstEvent = {};
  const eventCounts = {};
  const lastEventDate = {};

  for (const evt of (events || [])) {
    if (!firstEvent[evt.user_id]) firstEvent[evt.user_id] = {};
    if (!firstEvent[evt.user_id][evt.event]) {
      firstEvent[evt.user_id][evt.event] = evt.created_at;
    }

    if (!eventCounts[evt.user_id]) eventCounts[evt.user_id] = {};
    eventCounts[evt.user_id][evt.event] = (eventCounts[evt.user_id][evt.event] || 0) + 1;

    if (!lastEventDate[evt.user_id] || evt.created_at > lastEventDate[evt.user_id]) {
      lastEventDate[evt.user_id] = evt.created_at;
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

  const trackedUsers = filterTrackedLpProfiles(profiles);

  return {
    profiles,
    trackedUsers,
    events: events || [],
    firstEvent,
    eventCounts,
    lastEventDate
  };
}

async function userMetrics(supabase) {
  const { trackedUsers, events, firstEvent } = await fetchUserMetricsData(supabase);
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();

  const totalSignups = trackedUsers.length;
  const signups7d = trackedUsers.filter((user) => user.created_at >= sevenDaysAgo).length;
  const onboarded = trackedUsers.filter((user) => user.buy_box_complete).length;
  const activated = trackedUsers.filter((user) => (user.deals_viewed_count || 0) >= 3).length;
  const savedDeal = trackedUsers.filter((user) => (user.deals_saved_count || 0) >= 1).length;
  const startedDd = trackedUsers.filter((user) => ['high-intent', 'call-booked', 'enrolled'].includes(user.funnel_status)).length;
  const bookedCall = trackedUsers.filter((user) => user.funnel_status === 'call-booked' || user.funnel_status === 'enrolled').length;

  const funnel = [
    { label: 'Signed Up', count: totalSignups, pct: 100, color: 'var(--primary)' },
    { label: 'Completed Onboarding', count: onboarded, pct: totalSignups ? Math.round((onboarded / totalSignups) * 100) : 0, color: '#3b82f6' },
    { label: 'Viewed 3+ Deals', count: activated, pct: totalSignups ? Math.round((activated / totalSignups) * 100) : 0, color: '#8b5cf6' },
    { label: 'Saved a Deal', count: savedDeal, pct: totalSignups ? Math.round((savedDeal / totalSignups) * 100) : 0, color: '#10b981' },
    { label: 'Started DD', count: startedDd, pct: totalSignups ? Math.round((startedDd / totalSignups) * 100) : 0, color: '#14b8a6' },
    { label: 'Booked a Call', count: bookedCall, pct: totalSignups ? Math.round((bookedCall / totalSignups) * 100) : 0, color: '#f59e0b' }
  ];

  const dropoffs = [];
  for (let i = 1; i < funnel.length; i++) {
    const previous = funnel[i - 1];
    const current = funnel[i];
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
    const median = deltas.length % 2 ? deltas[midpoint] : (deltas[midpoint - 1] + deltas[midpoint]) / 2;

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
    { key: 'firstOnboard', label: 'First Onboarding', value: formatMedianDuration(ttv.firstOnboard), samples: ttv.firstOnboard?.samples || 0 },
    { key: 'firstDealView', label: 'First Deal View', value: formatMedianDuration(ttv.firstDealView), samples: ttv.firstDealView?.samples || 0 },
    { key: 'firstSave', label: 'First Deal Save', value: formatMedianDuration(ttv.firstSave), samples: ttv.firstSave?.samples || 0 },
    { key: 'firstCallBook', label: 'First Call Booked', value: formatMedianDuration(ttv.firstCallBook), samples: ttv.firstCallBook?.samples || 0 }
  ];

  const cohorts = [];
  for (let weekIndex = 0; weekIndex < 8; weekIndex++) {
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
    const cohortCalls = cohortUsers.filter((user) => user.funnel_status === 'call-booked' || user.funnel_status === 'enrolled').length;

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
  const { data: wizEvents, error: wizErr } = await supabase
    .from('user_events')
    .select('user_id, event, data, created_at')
    .in('event', ['wizard_started', 'wizard_step', 'wizard_abandoned'])
    .order('created_at', { ascending: true });

  if (wizErr) throw wizErr;

  const wizardStepCounts = {};
  const wizardAbandons = {};

  for (const evt of (wizEvents || [])) {
    if (!trackedUsers.some((user) => user.id === evt.user_id)) continue;

    if (evt.event === 'wizard_started') {
      wizardStarters.add(evt.user_id);
      continue;
    }

    if (evt.event === 'wizard_step') {
      const step = evt.data?.step;
      const stepType = evt.data?.stepType || 'unknown';
      if (step === undefined) continue;
      if (!wizardStepCounts[step]) wizardStepCounts[step] = { count: 0, label: stepType };
      wizardStepCounts[step].count += 1;
      continue;
    }

    if (evt.event === 'wizard_abandoned') {
      wizardStarters.add(evt.user_id);
      const step = evt.data?.step;
      const stepType = evt.data?.stepType || `step_${step || '?'}`;
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

// --- Growth metrics (Overview + Users dashboard) ---

async function growthMetrics(supabase) {
  const now = new Date();
  const weeks = [];
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now);
    start.setDate(now.getDate() - (i + 1) * 7);
    const end = new Date(now);
    end.setDate(now.getDate() - i * 7);
    weeks.push({ start: start.toISOString(), end: end.toISOString(), label: i === 0 ? 'This Week' : i === 1 ? 'Last Week' : `${i}w ago` });
  }

  // Select all quality fields for completeness calculation
  const qualityKeys = QUALITY_FIELDS.map(f => f.key).join(', ');

  // Fetch all raw data in parallel
  const [usersRes, opsRes, dealsRes, stagesRes] = await Promise.all([
    supabase.from('user_profiles').select('id, email, is_admin, created_at', { count: 'exact' }),
    supabase.from('management_companies').select('id, created_at', { count: 'exact' }),
    supabase.from('opportunities').select(`id, added_date, status, ${qualityKeys}`, { count: 'exact' }),
    supabase.from('user_deal_stages').select('id, stage, updated_at', { count: 'exact' }),
  ]);

  const users = filterTrackedLpProfiles(usersRes.data || []);
  const ops = opsRes.data || [];
  const deals = dealsRes.data || [];
  const stages = stagesRes.data || [];

  // --- Deal completeness ---
  const activeDeals = deals.filter(d => d.status !== 'Archived');
  const completenessScores = activeDeals.map(d => computeQuality(d).pct);
  const complete100 = completenessScores.filter(p => p === 100).length;
  const complete75 = completenessScores.filter(p => p >= 75 && p < 100).length;
  const complete50 = completenessScores.filter(p => p >= 50 && p < 75).length;
  const complete25 = completenessScores.filter(p => p >= 25 && p < 50).length;
  const completeBelow25 = completenessScores.filter(p => p < 25).length;
  const avgCompleteness = completenessScores.length > 0 ? Math.round(completenessScores.reduce((a, b) => a + b, 0) / completenessScores.length) : 0;

  // Top missing fields across all active deals
  const missingCounts = {};
  activeDeals.forEach(d => {
    const q = computeQuality(d);
    q.missing.forEach(f => { missingCounts[f] = (missingCounts[f] || 0) + 1; });
  });
  const topMissing = Object.entries(missingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([field, count]) => ({ field, count, pct: activeDeals.length > 0 ? Math.round(count / activeDeals.length * 100) : 0 }));

  // Completeness trend: compute avg completeness per week based on deals that existed by that week's end
  const completenessByWeek = weeks.map(w => {
    const dealsExisting = activeDeals.filter(d => d.added_date && d.added_date < w.end);
    if (dealsExisting.length === 0) return 0;
    const scores = dealsExisting.map(d => computeQuality(d).pct);
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });

  // Count deals at 100% completeness per week (cumulative snapshot)
  const complete100ByWeek = weeks.map(w => {
    return activeDeals.filter(d => d.added_date && d.added_date < w.end && computeQuality(d).pct === 100).length;
  });

  // --- Week-over-week counts ---
  function countByWeek(items, dateField) {
    return weeks.map(w => {
      return items.filter(item => {
        const d = item[dateField];
        return d && d >= w.start && d < w.end;
      }).length;
    });
  }

  // Cumulative totals per week
  function cumulativeByWeek(items, dateField) {
    return weeks.map(w => items.filter(item => {
      const d = item[dateField];
      return d && d < w.end;
    }).length);
  }

  const lpsByWeek = countByWeek(users, 'created_at');
  const gpsByWeek = countByWeek(ops, 'created_at');
  const dealsByWeek = countByWeek(activeDeals, 'added_date');

  const lpsCumulative = cumulativeByWeek(users, 'created_at');
  const gpsCumulative = cumulativeByWeek(ops, 'created_at');
  const dealsCumulative = cumulativeByWeek(activeDeals, 'added_date');

  // Portfolio = funded
  const portfolioStages = stages.filter(s => s.stage === 'invested' || s.stage === 'portfolio');

  // Growth rates (this week vs last week)
  function growthRate(arr) {
    const curr = arr[arr.length - 1] || 0;
    const prev = arr[arr.length - 2] || 0;
    if (prev === 0) return curr > 0 ? 100 : 0;
    return Math.round(((curr - prev) / prev) * 100);
  }

  // --- Supply/demand balance ---
  const lpDealRatio = activeDeals.length > 0 ? Math.round(users.length / activeDeals.length * 10) / 10 : 0;
  const constraint = users.length < 10 && activeDeals.length > 20 ? 'demand' :
    activeDeals.length < 10 && users.length > 5 ? 'supply' : 'balanced';

  // --- Data-driven recommendations ---
  const recommendations = [];

  // Completeness recommendations
  if (complete100 === 0) {
    recommendations.push({ priority: 'high', title: 'Zero deals at 100% completeness', body: 'No deals have all fields filled including deck, PPM, and SEC filing. Focus on completing your top 10 deals by daily views first.' });
  } else if (avgCompleteness < 50) {
    recommendations.push({ priority: 'high', title: 'Average deal completeness is only ' + avgCompleteness + '%', body: 'Most deals are missing critical data. Top gaps: ' + topMissing.slice(0, 3).map(m => m.field + ' (' + m.pct + '% missing)').join(', ') + '. Run batch enrichment on these fields.' });
  }

  // Supply/demand
  if (constraint === 'demand') {
    recommendations.push({ priority: 'high', title: 'You need more LPs — ' + users.length + ' LPs for ' + activeDeals.length + ' deals', body: 'You have plenty of deal supply but not enough eyeballs. Focus on LP acquisition: email your network, post deal breakdowns on LinkedIn, run a free webinar.' });
  } else if (constraint === 'supply') {
    recommendations.push({ priority: 'medium', title: 'Add more deals — ' + activeDeals.length + ' active deals for ' + users.length + ' LPs', body: 'LPs need variety to find deals that match their buy box. Batch-import operators from SEC filings and prioritize high-demand asset classes.' });
  }

  // LP growth
  if (growthRate(lpsByWeek) <= 0 && users.length > 0) {
    recommendations.push({ priority: 'medium', title: 'LP growth stalled this week', body: 'No new LPs signed up. Try: personal outreach, social media deal highlights, or a referral incentive for existing members.' });
  }

  // GP growth
  if (growthRate(gpsByWeek) <= 0 && ops.length > 0) {
    recommendations.push({ priority: 'medium', title: 'No new GPs this week', body: 'Supply drives the marketplace. Scrape SEC EDGAR for new Reg D filings, attend meetups, or offer free deal pages to operators.' });
  }

  // Pre-100 LP tactics
  if (users.length < 100) {
    recommendations.push({ priority: 'low', title: 'Pre-100 LP growth tactics', body: 'Personal outreach, "deal of the week" content, free workshops, and referral incentives. Every LP matters at this stage.' });
  }

  // Healthy state
  if (recommendations.length === 0) {
    recommendations.push({ priority: 'low', title: 'Growth is healthy!', body: 'All metrics trending up. Document your current growth channels and set WoW growth rate targets.' });
  }

  recommendations.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.priority] - { high: 0, medium: 1, low: 2 }[b.priority]));

  return {
    // North Star
    northStar: {
      complete100,
      totalActive: activeDeals.length,
      pct: activeDeals.length > 0 ? Math.round(complete100 / activeDeals.length * 100 * 10) / 10 : 0,
      avgCompleteness,
      prevWeekComplete100: complete100ByWeek.length >= 2 ? complete100ByWeek[complete100ByWeek.length - 2] : 0,
    },
    // Completeness distribution
    completeness: {
      histogram: [
        { label: '0-24%', count: completeBelow25 },
        { label: '25-49%', count: complete25 },
        { label: '50-74%', count: complete50 },
        { label: '75-99%', count: complete75 },
        { label: '100%', count: complete100 },
      ],
      topMissing,
    },
    // Marketplace health
    marketplace: {
      lps: users.length,
      lps7d: users.filter(u => u.created_at >= new Date(now - 7 * 86400000).toISOString()).length,
      gps: ops.length,
      gps7d: ops.filter(o => o.created_at >= new Date(now - 7 * 86400000).toISOString()).length,
      deals: activeDeals.length,
      deals7d: activeDeals.filter(d => d.added_date >= new Date(now - 7 * 86400000).toISOString()).length,
      funded: portfolioStages.length,
      lpDealRatio,
      constraint,
    },
    // Trends
    weekLabels: weeks.map(w => w.label),
    series: {
      lps: lpsByWeek,
      gps: gpsByWeek,
      deals: dealsByWeek,
      lpsCumulative,
      gpsCumulative,
      dealsCumulative,
      avgCompleteness: completenessByWeek,
      complete100: complete100ByWeek,
    },
    growthRates: {
      lps: growthRate(lpsByWeek),
      gps: growthRate(gpsByWeek),
      deals: growthRate(dealsByWeek),
    },
    recommendations,
  };
}

// --- Browse any table (admin schema viewer) ---

const BROWSABLE_TABLES = [
  'opportunities', 'management_companies', 'user_profiles', 'user_buy_box',
  'user_deal_stages', 'user_events', 'user_goals', 'user_portfolio',
  'dd_checklist', 'deal_qa', 'investment_memos', 'deck_submissions',
  'operator_permissions', 'operator_interactions', 'deal_stage_counts',
  'sec_filings', 'related_persons', 'deal_sponsors', 'background_checks',
  'gdrive_deck_files', 'api_keys', 'api_request_log', 'intro_requests'
];

async function browseTable(supabase, body) {
  const { table, page = 1, limit = 50 } = body;
  if (!table || !BROWSABLE_TABLES.includes(table)) {
    throw new Error(`Invalid table. Allowed: ${BROWSABLE_TABLES.join(', ')}`);
  }
  const offset = (page - 1) * limit;
  const { data, error, count } = await supabase
    .from(table)
    .select('*', { count: 'exact' })
    .range(offset, offset + limit - 1)
    .limit(limit);

  if (error) throw error;
  return { data: data || [], total: count, page, limit };
}

// --- Table row counts (schema page) ---

async function tableCounts(supabase) {
  const counts = {};
  await Promise.all(BROWSABLE_TABLES.map(async (table) => {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      counts[table] = error ? null : count;
    } catch { counts[table] = null; }
  }));
  return { counts };
}

// --- List intro requests ---

async function listIntros(supabase, params) {
  const search = (params?.search || '').trim();
  let query = supabase
    .from('intro_requests')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .limit(100);
  if (search) {
    query = query.or(`user_email.ilike.%${search}%,deal_name.ilike.%${search}%,operator_name.ilike.%${search}%`);
  }
  const { data, error, count } = await query;

  if (error) {
    // Table may not exist yet
    console.warn('intro_requests query failed:', error.message);
    return { intros: [], total: 0 };
  }
  return { data: data || [], total: count || 0 };
}

// --- Deal card utility CTA analytics ---

const CTA_ANALYTICS_EVENTS = [
  'deal_card_utility_cta_impression',
  'deal_card_utility_cta_clicked',
  'deal_card_utility_cta_disabled_impression',
  'deal_card_request_intro_opened',
  'deal_card_view_deck_clicked'
];

const CTA_STAGE_ORDER = ['filter', 'review', 'connect', 'decide', 'invested', 'skipped'];
const CTA_ACTION_ORDER = ['Compare', 'View Deck', 'Request Introduction', 'No Deck Available'];
const CTA_RANGE_OPTIONS = ['7d', '30d', 'all'];

function normalizeCtaStage(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return CTA_STAGE_ORDER.includes(normalized) ? normalized : 'filter';
}

function normalizeCtaViewMode(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'map' ? 'location' : normalized || 'grid';
}

function getCtaActionLabel(data = {}) {
  if (data.reason === 'noDeck' || data.labelShown === 'No Deck Available') return 'No Deck Available';
  switch (data.utilityActionType) {
    case 'compare':
      return 'Compare';
    case 'viewDeck':
      return 'View Deck';
    case 'requestIntroduction':
      return 'Request Introduction';
    default:
      return data.labelShown || 'None';
  }
}

function initCtaMetric(key, label = key) {
  return {
    key,
    label,
    impressions: 0,
    clicks: 0,
    ctr: 0,
    disabledImpressions: 0,
    requestIntroOpens: 0,
    viewDeckClicks: 0
  };
}

function normalizeCtaRange(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return CTA_RANGE_OPTIONS.includes(normalized) ? normalized : '30d';
}

function getCtaRangeStart(range) {
  if (range === 'all') return null;
  const days = range === '7d' ? 7 : 30;
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - (days - 1));
  return start.toISOString();
}

function getRecentTrendBuckets(rows, range) {
  const counts = new Map();

  for (const row of rows) {
    if (!row?.created_at) continue;
    const dayKey = String(row.created_at).slice(0, 10);
    if (!counts.has(dayKey)) {
      counts.set(dayKey, initCtaMetric(dayKey, dayKey));
    }
    applyCtaMetric(counts.get(dayKey), row.event);
  }

  const sorted = finalizeCtaMetrics(
    [...counts.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, bucket]) => bucket)
  );

  const trendRows = range === 'all' ? sorted.slice(-30) : sorted;
  return trendRows.map((row) => ({
    ...row,
    date: row.key,
    label: row.key.slice(5).replace('-', '/')
  }));
}

function ensureBucket(map, key, label = key) {
  if (!map[key]) {
    map[key] = initCtaMetric(key, label);
  }
  return map[key];
}

function applyCtaMetric(bucket, event) {
  if (!bucket) return;

  if (event === 'deal_card_utility_cta_impression') {
    bucket.impressions += 1;
    return;
  }

  if (event === 'deal_card_utility_cta_disabled_impression') {
    bucket.impressions += 1;
    bucket.disabledImpressions += 1;
    return;
  }

  if (event === 'deal_card_utility_cta_clicked') {
    bucket.clicks += 1;
    return;
  }

  if (event === 'deal_card_request_intro_opened') {
    bucket.requestIntroOpens += 1;
    return;
  }

  if (event === 'deal_card_view_deck_clicked') {
    bucket.viewDeckClicks += 1;
  }
}

function finalizeCtaMetrics(rows) {
  return rows.map((row) => ({
    ...row,
    ctr: row.impressions > 0 ? Math.round((row.clicks / row.impressions) * 1000) / 10 : 0
  }));
}

async function fetchCtaAnalyticsRows(supabase, { range = '30d' } = {}) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;
  let total = null;
  const normalizedRange = normalizeCtaRange(range);
  const rangeStart = getCtaRangeStart(normalizedRange);

  while (from < 10000) {
    let query = supabase
      .from('user_events')
      .select('event, data, created_at', { count: 'exact' })
      .in('event', CTA_ANALYTICS_EVENTS)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (rangeStart) {
      query = query.gte('created_at', rangeStart);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    if (total === null && typeof count === 'number') total = count;

    const nextRows = data || [];
    rows.push(...nextRows);

    if (nextRows.length < pageSize || (typeof total === 'number' && rows.length >= total)) {
      break;
    }

    from += pageSize;
  }

  return rows;
}

async function ctaAnalytics(supabase, params = {}) {
  const range = normalizeCtaRange(params.range);
  const rows = await fetchCtaAnalyticsRows(supabase, { range });

  const overview = initCtaMetric('overview', 'Overview');
  const byStage = Object.fromEntries(CTA_STAGE_ORDER.map((stage) => [stage, initCtaMetric(stage, stage)]));
  const byAction = Object.fromEntries(CTA_ACTION_ORDER.map((action) => [action, initCtaMetric(action, action)]));
  const byViewMode = {};
  const byDeckAvailability = {
    deckAvailable: initCtaMetric('deckAvailable', 'Deck Available'),
    noDeck: initCtaMetric('noDeck', 'No Deck')
  };

  const recentEvents = rows.slice(0, 40).map((row) => {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    return {
      timestamp: row.created_at,
      event: row.event,
      deal: data.dealName || data.dealId || 'Unknown deal',
      dealId: data.dealId || '',
      stage: normalizeCtaStage(data.pipelineStage),
      action: getCtaActionLabel(data),
      label: data.labelShown || '',
      userRole: data.userRole || '',
      viewMode: normalizeCtaViewMode(data.viewMode),
      deckAvailable: Boolean(data.deckAvailable),
      compareModeActive: Boolean(data.compareModeActive)
    };
  });

  for (const row of rows) {
    const data = row.data && typeof row.data === 'object' ? row.data : {};
    const stage = normalizeCtaStage(data.pipelineStage);
    const actionLabel = getCtaActionLabel(data);
    const viewMode = normalizeCtaViewMode(data.viewMode);
    const deckKey = data.deckAvailable ? 'deckAvailable' : 'noDeck';

    applyCtaMetric(overview, row.event);
    applyCtaMetric(ensureBucket(byStage, stage, stage), row.event);
    applyCtaMetric(ensureBucket(byAction, actionLabel, actionLabel), row.event);
    applyCtaMetric(ensureBucket(byViewMode, viewMode, viewMode), row.event);
    applyCtaMetric(byDeckAvailability[deckKey], row.event);
  }

  const finalizedOverview = finalizeCtaMetrics([overview])[0];

  return {
    range,
    overview: {
      ...finalizedOverview,
      totalEvents: rows.length
    },
    byStage: finalizeCtaMetrics(CTA_STAGE_ORDER.map((stage) => byStage[stage])),
    byAction: finalizeCtaMetrics(
      Object.values(byAction).sort((a, b) => {
        return CTA_ACTION_ORDER.indexOf(a.key) - CTA_ACTION_ORDER.indexOf(b.key);
      })
    ),
    byViewMode: finalizeCtaMetrics(
      Object.values(byViewMode).sort((a, b) => a.label.localeCompare(b.label))
    ),
    byDeckAvailability: finalizeCtaMetrics([
      byDeckAvailability.deckAvailable,
      byDeckAvailability.noDeck
    ]),
    dailyTrend: getRecentTrendBuckets(rows, range),
    recentEvents
  };
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
  'user-events': getUserEvents,
  'update-user-tier': updateUserTier,
  'list-deals-quality': listDealsQuality,
  'list-operators-quality': listOperatorsQuality,
  'intake-create': intakeCreate,
  'user-metrics': userMetrics,
  'growth-metrics': growthMetrics,
  'list-intros': listIntros,
  'cta-analytics': ctaAnalytics,
  'browse-table': browseTable,
  'table-counts': tableCounts,
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
