import { QUALITY_FIELDS, computeQuality } from './quality.js';
import { filterTrackedLpProfiles } from './users.js';
import { ADMIN_EMAILS } from '../_supabase.js';

const SUBMISSION_ROLE_ORDER = ['admin', 'gp', 'lp'];
const SUBMISSION_ROLE_LABELS = {
  admin: 'Admin',
  gp: 'GP',
  lp: 'LP'
};

function normalizeSubmissionRole(role, email = '') {
  const normalized = String(role || '').trim().toLowerCase();
  if (SUBMISSION_ROLE_ORDER.includes(normalized)) return normalized;
  if (ADMIN_EMAILS.includes(String(email || '').trim().toLowerCase())) return 'admin';
  return 'admin';
}

function buildRoleCounts(rows = [], resolver = () => 'admin') {
  const counts = Object.fromEntries(SUBMISSION_ROLE_ORDER.map((role) => [role, 0]));

  for (const row of rows) {
    const role = normalizeSubmissionRole(resolver(row), row?.submitted_by_email || row?.submittedByEmail || '');
    counts[role] += 1;
  }

  return counts;
}

function roleBreakdownList(counts = {}, total = 0) {
  return SUBMISSION_ROLE_ORDER.map((role) => {
    const count = Number(counts[role] || 0);
    return {
      role,
      label: SUBMISSION_ROLE_LABELS[role],
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0
    };
  });
}

function countRowsInRange(rows = [], week, { dateField = 'created_at', roleField = 'submitted_by_role' } = {}) {
  const counts = Object.fromEntries(SUBMISSION_ROLE_ORDER.map((role) => [role, 0]));

  for (const row of rows) {
    const dateValue = row?.[dateField];
    if (!dateValue || dateValue < week.start || dateValue >= week.end) continue;
    const role = normalizeSubmissionRole(row?.[roleField], row?.submitted_by_email || '');
    counts[role] += 1;
  }

  return counts;
}

function buildDealSubmissionAttribution({ weeks = [], deals = [], submissions = [] } = {}) {
  const canonicalDeals = (deals || []).filter((deal) => !deal?.parent_deal_id);
  const addActionRows = (submissions || []).filter((row) =>
    ['new_deal', 'existing_deal_link'].includes(String(row?.submission_kind || '').trim().toLowerCase())
  );

  const uniqueDealRoleCounts = buildRoleCounts(canonicalDeals, (row) => row?.submitted_by_role);
  const addActionRoleCounts = buildRoleCounts(addActionRows, (row) => row?.submitted_by_role);
  const totalUniqueDeals = canonicalDeals.length;
  const totalAddActions = addActionRows.length;
  const communityUniqueDeals = (uniqueDealRoleCounts.gp || 0) + (uniqueDealRoleCounts.lp || 0);

  return {
    summary: {
      totalUniqueDeals,
      totalAddActions,
      communityPct: totalUniqueDeals > 0 ? Math.round((communityUniqueDeals / totalUniqueDeals) * 100) : 0,
      adminPct: totalUniqueDeals > 0 ? Math.round(((uniqueDealRoleCounts.admin || 0) / totalUniqueDeals) * 100) : 0,
      gpPct: totalUniqueDeals > 0 ? Math.round(((uniqueDealRoleCounts.gp || 0) / totalUniqueDeals) * 100) : 0,
      lpPct: totalUniqueDeals > 0 ? Math.round(((uniqueDealRoleCounts.lp || 0) / totalUniqueDeals) * 100) : 0
    },
    uniqueByRole: roleBreakdownList(uniqueDealRoleCounts, totalUniqueDeals),
    actionsByRole: roleBreakdownList(addActionRoleCounts, totalAddActions),
    weeklyUnique: weeks.map((week) => ({
      label: week.label,
      ...countRowsInRange(canonicalDeals, week, {
        dateField: 'created_at',
        roleField: 'submitted_by_role'
      })
    })),
    weeklyActions: weeks.map((week) => ({
      label: week.label,
      ...countRowsInRange(addActionRows, week, {
        dateField: 'created_at',
        roleField: 'submitted_by_role'
      })
    })),
    recentSubmissions: addActionRows
      .slice()
      .sort((left, right) => String(right.created_at || '').localeCompare(String(left.created_at || '')))
      .slice(0, 12)
      .map((row) => ({
        id: row.id,
        dealName: row.deal_name || 'Unknown deal',
        submittedByName: row.submitted_by_name || row.submitted_by_email || 'Unknown submitter',
        submittedByRole: normalizeSubmissionRole(row.submitted_by_role, row.submitted_by_email),
        submissionKind: row.submission_kind || '',
        submissionIntent: row.submission_intent || '',
        entrySurface: row.entry_surface || '',
        createdAt: row.created_at
      }))
  };
}

async function growthMetrics(supabase) {
  const now = new Date();
  const weeks = [];
  for (let index = 7; index >= 0; index -= 1) {
    const start = new Date(now);
    start.setDate(now.getDate() - (index + 1) * 7);
    const end = new Date(now);
    end.setDate(now.getDate() - index * 7);
    weeks.push({
      start: start.toISOString(),
      end: end.toISOString(),
      label: index === 0 ? 'This Week' : index === 1 ? 'Last Week' : `${index}w ago`
    });
  }

  const qualityKeys = QUALITY_FIELDS.map((field) => field.key).join(', ');

  const [usersRes, operatorsRes, dealsRes, stagesRes, submissionsRes] = await Promise.all([
    supabase.from('user_profiles').select('id, email, is_admin, created_at', { count: 'exact' }),
    supabase.from('management_companies').select('id, created_at', { count: 'exact' }),
    supabase.from('opportunities').select(`id, added_date, created_at, parent_deal_id, status, submitted_by_role, submitted_by_email, ${qualityKeys}`, { count: 'exact' }),
    supabase.from('user_deal_stages').select('id, stage, updated_at', { count: 'exact' })
    ,
    supabase
      .from('deck_submissions')
      .select('id, deal_id, deal_name, created_at, submitted_by_name, submitted_by_email, submitted_by_role, submission_kind, submission_intent, entry_surface')
  ]);

  const users = filterTrackedLpProfiles(usersRes.data || []);
  const operators = operatorsRes.data || [];
  const deals = dealsRes.data || [];
  const stages = stagesRes.data || [];
  const submissions = submissionsRes.data || [];

  const activeDeals = deals.filter((deal) => deal.status !== 'Archived');
  const completenessScores = activeDeals.map((deal) => computeQuality(deal).pct);
  const complete100 = completenessScores.filter((score) => score === 100).length;
  const complete75 = completenessScores.filter((score) => score >= 75 && score < 100).length;
  const complete50 = completenessScores.filter((score) => score >= 50 && score < 75).length;
  const complete25 = completenessScores.filter((score) => score >= 25 && score < 50).length;
  const completeBelow25 = completenessScores.filter((score) => score < 25).length;
  const avgCompleteness =
    completenessScores.length > 0
      ? Math.round(completenessScores.reduce((left, right) => left + right, 0) / completenessScores.length)
      : 0;

  const missingCounts = {};
  for (const deal of activeDeals) {
    const quality = computeQuality(deal);
    for (const field of quality.missing) {
      missingCounts[field] = (missingCounts[field] || 0) + 1;
    }
  }

  const topMissing = Object.entries(missingCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([field, count]) => ({
      field,
      count,
      pct: activeDeals.length > 0 ? Math.round((count / activeDeals.length) * 100) : 0
    }));

  const completenessByWeek = weeks.map((week) => {
    const dealsExisting = activeDeals.filter((deal) => deal.added_date && deal.added_date < week.end);
    if (dealsExisting.length === 0) return 0;
    const scores = dealsExisting.map((deal) => computeQuality(deal).pct);
    return Math.round(scores.reduce((left, right) => left + right, 0) / scores.length);
  });

  const complete100ByWeek = weeks.map((week) =>
    activeDeals.filter(
      (deal) => deal.added_date && deal.added_date < week.end && computeQuality(deal).pct === 100
    ).length
  );

  function countByWeek(items, dateField) {
    return weeks.map((week) =>
      items.filter((item) => {
        const dateValue = item[dateField];
        return dateValue && dateValue >= week.start && dateValue < week.end;
      }).length
    );
  }

  function cumulativeByWeek(items, dateField) {
    return weeks.map((week) =>
      items.filter((item) => {
        const dateValue = item[dateField];
        return dateValue && dateValue < week.end;
      }).length
    );
  }

  const lpsByWeek = countByWeek(users, 'created_at');
  const gpsByWeek = countByWeek(operators, 'created_at');
  const dealsByWeek = countByWeek(activeDeals, 'added_date');

  const lpsCumulative = cumulativeByWeek(users, 'created_at');
  const gpsCumulative = cumulativeByWeek(operators, 'created_at');
  const dealsCumulative = cumulativeByWeek(activeDeals, 'added_date');

  const portfolioStages = stages.filter((stage) => stage.stage === 'invested' || stage.stage === 'portfolio');
  const dealSubmissionAttribution = buildDealSubmissionAttribution({
    weeks,
    deals,
    submissions
  });

  function growthRate(series) {
    const current = series[series.length - 1] || 0;
    const previous = series[series.length - 2] || 0;
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  const lpDealRatio = activeDeals.length > 0 ? Math.round((users.length / activeDeals.length) * 10) / 10 : 0;
  const constraint =
    users.length < 10 && activeDeals.length > 20
      ? 'demand'
      : activeDeals.length < 10 && users.length > 5
        ? 'supply'
        : 'balanced';

  const recommendations = [];

  if (complete100 === 0) {
    recommendations.push({
      priority: 'high',
      title: 'Zero deals at 100% completeness',
      body: 'No deals have all fields filled including deck, PPM, and SEC filing. Focus on completing your top 10 deals by daily views first.'
    });
  } else if (avgCompleteness < 50) {
    recommendations.push({
      priority: 'high',
      title: `Average deal completeness is only ${avgCompleteness}%`,
      body: `Most deals are missing critical data. Top gaps: ${topMissing
        .slice(0, 3)
        .map((item) => `${item.field} (${item.pct}% missing)`)
        .join(', ')}. Run batch enrichment on these fields.`
    });
  }

  if (constraint === 'demand') {
    recommendations.push({
      priority: 'high',
      title: `You need more LPs — ${users.length} LPs for ${activeDeals.length} deals`,
      body: 'You have plenty of deal supply but not enough eyeballs. Focus on LP acquisition: email your network, post deal breakdowns on LinkedIn, run a free webinar.'
    });
  } else if (constraint === 'supply') {
    recommendations.push({
      priority: 'medium',
      title: `Add more deals — ${activeDeals.length} active deals for ${users.length} LPs`,
      body: 'LPs need variety to find deals that match their buy box. Batch-import operators from SEC filings and prioritize high-demand asset classes.'
    });
  }

  if (growthRate(lpsByWeek) <= 0 && users.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'LP growth stalled this week',
      body: 'No new LPs signed up. Try: personal outreach, social media deal highlights, or a referral incentive for existing members.'
    });
  }

  if (growthRate(gpsByWeek) <= 0 && operators.length > 0) {
    recommendations.push({
      priority: 'medium',
      title: 'No new GPs this week',
      body: 'Supply drives the marketplace. Scrape SEC EDGAR for new Reg D filings, attend meetups, or offer free deal pages to operators.'
    });
  }

  if (users.length < 100) {
    recommendations.push({
      priority: 'low',
      title: 'Pre-100 LP growth tactics',
      body: 'Personal outreach, "deal of the week" content, free workshops, and referral incentives. Every LP matters at this stage.'
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      priority: 'low',
      title: 'Growth is healthy!',
      body: 'All metrics trending up. Document your current growth channels and set WoW growth rate targets.'
    });
  }

  const recommendationPriorityOrder = { high: 0, medium: 1, low: 2 };
  recommendations.sort(
    (left, right) =>
      recommendationPriorityOrder[left.priority] - recommendationPriorityOrder[right.priority]
  );

  return {
    northStar: {
      complete100,
      totalActive: activeDeals.length,
      pct: activeDeals.length > 0 ? Math.round((complete100 / activeDeals.length) * 1000) / 10 : 0,
      avgCompleteness,
      prevWeekComplete100: complete100ByWeek.length >= 2 ? complete100ByWeek[complete100ByWeek.length - 2] : 0
    },
    completeness: {
      histogram: [
        { label: '0-24%', count: completeBelow25 },
        { label: '25-49%', count: complete25 },
        { label: '50-74%', count: complete50 },
        { label: '75-99%', count: complete75 },
        { label: '100%', count: complete100 }
      ],
      topMissing
    },
    marketplace: {
      lps: users.length,
      lps7d: users.filter((user) => user.created_at >= new Date(now - 7 * 86400000).toISOString()).length,
      gps: operators.length,
      gps7d: operators.filter((operator) => operator.created_at >= new Date(now - 7 * 86400000).toISOString()).length,
      deals: activeDeals.length,
      deals7d: activeDeals.filter((deal) => deal.added_date >= new Date(now - 7 * 86400000).toISOString()).length,
      funded: portfolioStages.length,
      lpDealRatio,
      constraint
    },
    dealSubmissionAttribution,
    weekLabels: weeks.map((week) => week.label),
    series: {
      lps: lpsByWeek,
      gps: gpsByWeek,
      deals: dealsByWeek,
      lpsCumulative,
      gpsCumulative,
      dealsCumulative,
      avgCompleteness: completenessByWeek,
      complete100: complete100ByWeek
    },
    growthRates: {
      lps: growthRate(lpsByWeek),
      gps: growthRate(gpsByWeek),
      deals: growthRate(dealsByWeek)
    },
    recommendations
  };
}

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
      Object.values(byAction).sort((a, b) => CTA_ACTION_ORDER.indexOf(a.key) - CTA_ACTION_ORDER.indexOf(b.key))
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

export const analyticsActions = {
  'growth-metrics': growthMetrics,
  'cta-analytics': ctaAnalytics
};
