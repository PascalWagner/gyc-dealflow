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
    supabase.from('user_profiles').select('id, created_at', { count: 'exact' }),
    supabase.from('management_companies').select('id, created_at', { count: 'exact' }),
    supabase.from('opportunities').select(`id, added_date, status, ${qualityKeys}`, { count: 'exact' }),
    supabase.from('user_deal_stages').select('id, stage, updated_at', { count: 'exact' }),
  ]);

  const users = usersRes.data || [];
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

async function fetchCtaAnalyticsRows(supabase) {
  const pageSize = 1000;
  const rows = [];
  let from = 0;
  let total = null;

  while (from < 10000) {
    const { data, error, count } = await supabase
      .from('user_events')
      .select('event, data, created_at', { count: 'exact' })
      .in('event', CTA_ANALYTICS_EVENTS)
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

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

async function ctaAnalytics(supabase) {
  const rows = await fetchCtaAnalyticsRows(supabase);

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
