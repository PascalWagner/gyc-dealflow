// Vercel Serverless Function: GP Investor Insights
// Returns aggregate, anonymized LP preference data for GP dashboards
//
// Query params:
//   companyId — UUID of the management company (used to highlight GP's asset classes)
//
// Returns:
//   { topAssetClasses, topDealTypes, preferredDistributions, avgCheckSize,
//     topGoals, totalInvestors, topStrategies }

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const companyId = req.query?.companyId;
  if (!companyId || !/^[0-9a-f-]{36}$/i.test(companyId)) {
    return res.status(400).json({ error: 'companyId query param required (UUID)' });
  }

  // Cache for 5 minutes — aggregate data doesn't need to be real-time
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const supabase = getAdminClient();

    // 1. Get GP's asset classes (to mark "YOUR DEALS" later)
    const { data: gpDeals } = await supabase
      .from('opportunities')
      .select('asset_class')
      .eq('management_company_id', companyId)
      .is('parent_deal_id', null);

    const gpAssetClasses = new Set();
    for (const d of (gpDeals || [])) {
      if (d.asset_class) gpAssetClasses.add(d.asset_class);
    }

    // 2. Aggregate buy box preferences
    const { data: buyBoxRows } = await supabase
      .from('user_buy_box')
      .select('asset_classes, check_size, distributions, goal, deal_structure, strategies, completed_at')
      .not('completed_at', 'is', null);

    const completedBuyBoxes = buyBoxRows || [];

    // 3. Aggregate user goals
    const { data: goalRows } = await supabase
      .from('user_goals')
      .select('goal_type, capital_available');

    const goals = goalRows || [];

    // 4. Derive preferences from user_deal_stages (what deals people are saving/vetting)
    const { data: stageRows } = await supabase
      .from('user_deal_stages')
      .select('deal_id, stage, user_id');

    const allStages = stageRows || [];

    // Get unique user count from stages
    const stageUsers = new Set();
    for (const s of allStages) stageUsers.add(s.user_id);

    // Get deal details for stage-based aggregation
    const dealIds = [...new Set(allStages.map(s => s.deal_id))];
    let dealMap = {};
    if (dealIds.length > 0) {
      const { data: dealRows } = await supabase
        .from('opportunities')
        .select('id, asset_class, deal_type, distributions')
        .in('id', dealIds);

      for (const d of (dealRows || [])) {
        dealMap[d.id] = d;
      }
    }

    // 5. Count active opportunities for supplemental stats
    const { data: activeDeals } = await supabase
      .from('opportunities')
      .select('asset_class, deal_type, distributions')
      .is('parent_deal_id', null);

    const allOpps = activeDeals || [];

    // ---- AGGREGATE: Top Asset Classes ----
    const assetClassCounts = {};

    // From buy box preferences (primary source)
    for (const bb of completedBuyBoxes) {
      const classes = bb.asset_classes || [];
      for (const ac of classes) {
        if (ac) assetClassCounts[ac] = (assetClassCounts[ac] || 0) + 1;
      }
    }

    // From deal stages (what people are actually saving/vetting)
    for (const s of allStages) {
      const deal = dealMap[s.deal_id];
      if (deal && deal.asset_class) {
        assetClassCounts[deal.asset_class] = (assetClassCounts[deal.asset_class] || 0) + 0.5; // weight lower
      }
    }

    // If very sparse, supplement from opportunity distribution
    if (Object.keys(assetClassCounts).length < 3) {
      for (const d of allOpps) {
        if (d.asset_class) {
          assetClassCounts[d.asset_class] = (assetClassCounts[d.asset_class] || 0) + 0.1;
        }
      }
    }

    const totalAssetVotes = Object.values(assetClassCounts).reduce((a, b) => a + b, 0) || 1;
    const topAssetClasses = Object.entries(assetClassCounts)
      .map(([name, count]) => ({
        name,
        count: Math.round(count),
        pct: Math.round((count / totalAssetVotes) * 100),
        isGP: gpAssetClasses.has(name)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // ---- AGGREGATE: Deal Structure (Fund vs Syndication only) ----
    // Only count Fund and Syndication — everything else is noise
    const VALID_DEAL_TYPES = new Set(['Fund', 'Syndication']);
    const dealStructureCounts = { 'Fund': 0, 'Syndication': 0 };

    // From deal stages (what LPs are actually saving)
    for (const s of allStages) {
      const deal = dealMap[s.deal_id];
      if (deal && deal.deal_type && VALID_DEAL_TYPES.has(deal.deal_type)) {
        dealStructureCounts[deal.deal_type] += 1;
      }
    }

    // Supplement from all opportunities
    for (const d of allOpps) {
      if (d.deal_type && VALID_DEAL_TYPES.has(d.deal_type)) {
        dealStructureCounts[d.deal_type] += 0.1;
      }
    }

    const totalStructVotes = Object.values(dealStructureCounts).reduce((a, b) => a + b, 0) || 1;
    const topDealTypes = Object.entries(dealStructureCounts)
      .map(([name, count]) => ({
        name,
        count: Math.round(count),
        pct: Math.round((count / totalStructVotes) * 100)
      }))
      .sort((a, b) => b.count - a.count);

    // ---- AGGREGATE: Operator Preferences (from buy box) ----
    // deal_structure field = operator type (Multi-Strategy, Single-Strategy, etc.)
    // operator_size field = operator AUM size preference
    const operatorTypeCounts = {};
    const operatorSizeCounts = {};

    function parseJsonField(val) {
      if (!val) return [];
      if (Array.isArray(val)) return val;
      if (typeof val === 'string') {
        try { const parsed = JSON.parse(val); return Array.isArray(parsed) ? parsed : [parsed]; } catch (e) { return [val]; }
      }
      return [];
    }

    for (const bb of completedBuyBoxes) {
      // Operator type (was incorrectly called deal_structure in buy box)
      for (const item of parseJsonField(bb.deal_structure)) {
        if (item) operatorTypeCounts[item] = (operatorTypeCounts[item] || 0) + 1;
      }
      // Operator size
      for (const item of parseJsonField(bb.operator_size)) {
        if (item) operatorSizeCounts[item] = (operatorSizeCounts[item] || 0) + 1;
      }
    }

    const totalOpTypeVotes = Object.values(operatorTypeCounts).reduce((a, b) => a + b, 0) || 1;
    const operatorPreferences = Object.entries(operatorTypeCounts)
      .map(([name, count]) => ({ name, pct: Math.round((count / totalOpTypeVotes) * 100) }))
      .sort((a, b) => b.pct - a.pct);

    const totalOpSizeVotes = Object.values(operatorSizeCounts).reduce((a, b) => a + b, 0) || 1;
    const operatorSizePrefs = Object.entries(operatorSizeCounts)
      .map(([name, count]) => ({ name, pct: Math.round((count / totalOpSizeVotes) * 100) }))
      .sort((a, b) => b.pct - a.pct);

    // ---- AGGREGATE: Distribution Preferences ----
    const distCounts = {};

    for (const bb of completedBuyBoxes) {
      if (bb.distributions) {
        distCounts[bb.distributions] = (distCounts[bb.distributions] || 0) + 1;
      }
    }

    // Supplement from deal stages
    for (const s of allStages) {
      const deal = dealMap[s.deal_id];
      if (deal && deal.distributions) {
        distCounts[deal.distributions] = (distCounts[deal.distributions] || 0) + 0.5;
      }
    }

    // Supplement from opportunities
    if (Object.keys(distCounts).length < 2) {
      for (const d of allOpps) {
        if (d.distributions) {
          distCounts[d.distributions] = (distCounts[d.distributions] || 0) + 0.1;
        }
      }
    }

    const totalDistVotes = Object.values(distCounts).reduce((a, b) => a + b, 0) || 1;
    const preferredDistributions = Object.entries(distCounts)
      .map(([name, count]) => ({
        name,
        pct: Math.round((count / totalDistVotes) * 100)
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

    // ---- AGGREGATE: Max Check Size Distribution ----
    // This shows what LPs say is their maximum check size
    const checkBuckets = [
      { label: '$10K', min: 0, max: 15000 },
      { label: '$25K', min: 15000, max: 37500 },
      { label: '$50K', min: 37500, max: 75000 },
      { label: '$100K', min: 75000, max: 175000 },
      { label: '$250K', min: 175000, max: 375000 },
      { label: '$500K+', min: 375000, max: Infinity }
    ];

    const checkSizeCounts = {};
    for (const b of checkBuckets) checkSizeCounts[b.label] = 0;

    function bucketCheckSize(val) {
      const num = typeof val === 'string' ? parseFloat(val.replace(/[^0-9.]/g, '')) : val;
      if (!num || num <= 0) return null;
      for (const b of checkBuckets) {
        if (num >= b.min && num < b.max) return b.label;
      }
      return '$500K+';
    }

    // From buy box check_size
    for (const bb of completedBuyBoxes) {
      if (bb.check_size) {
        const bucket = bucketCheckSize(bb.check_size);
        if (bucket) checkSizeCounts[bucket]++;
      }
    }

    // From capital_available in goals (as secondary signal)
    for (const g of goals) {
      if (g.capital_available > 0) {
        const bucket = bucketCheckSize(g.capital_available);
        if (bucket) checkSizeCounts[bucket] += 0.5;
      }
    }

    const totalCheckVotes = Object.values(checkSizeCounts).reduce((a, b) => a + b, 0) || 1;
    const checkSizeDistribution = checkBuckets
      .map(b => ({
        label: b.label,
        count: Math.round(checkSizeCounts[b.label]),
        pct: Math.round((checkSizeCounts[b.label] / totalCheckVotes) * 100)
      }));

    const avgCheckSize = checkSizeDistribution
      .filter(c => c.count > 0)
      .sort((a, b) => b.count - a.count)[0]?.label || 'Not enough data';

    // ---- AGGREGATE: Investor Goals ----
    // Normalize all goal values to 3 canonical options
    const GOAL_MAP = {
      'passive_income': 'Passive Income',
      'income': 'Passive Income',
      'Cash Flow (income now)': 'Passive Income',
      'cash_flow': 'Passive Income',
      'tax_reduction': 'Tax Benefits',
      'tax_benefits': 'Tax Benefits',
      'Tax Savings (shelter income)': 'Tax Benefits',
      'tax': 'Tax Benefits',
      'growth': 'Growth',
      'capital_growth': 'Growth',
      'Wealth Growth (long-term)': 'Growth',
      'appreciation': 'Growth',
    };

    const goalCounts = { 'Passive Income': 0, 'Tax Benefits': 0, 'Growth': 0 };

    // From user_goals
    for (const g of goals) {
      if (g.goal_type) {
        const normalized = GOAL_MAP[g.goal_type] || GOAL_MAP[g.goal_type.toLowerCase()] || null;
        if (normalized) goalCounts[normalized]++;
      }
    }

    // From buy box goal field
    for (const bb of completedBuyBoxes) {
      if (bb.goal) {
        const normalized = GOAL_MAP[bb.goal] || GOAL_MAP[bb.goal.toLowerCase()] || null;
        if (normalized) goalCounts[normalized]++;
      }
    }

    const totalGoalVotes = Object.values(goalCounts).reduce((a, b) => a + b, 0) || 1;
    const topGoals = Object.entries(goalCounts)
      .map(([name, count]) => ({
        name,
        pct: totalGoalVotes > 0 ? Math.round((count / totalGoalVotes) * 100) : 0
      }))
      .sort((a, b) => b.pct - a.pct);

    // ---- Total unique investors ----
    const buyBoxUsers = new Set(completedBuyBoxes.map(() => 'bb')); // approximate
    const goalUsers = new Set(goals.map(() => 'g'));
    // Count distinct users across all sources
    const totalInvestors = Math.max(completedBuyBoxes.length, goals.length, stageUsers.size);

    return res.status(200).json({
      topAssetClasses,
      topDealTypes,
      preferredDistributions,
      avgCheckSize,
      checkSizeDistribution,
      topGoals,
      operatorPreferences,
      operatorSizePrefs,
      totalInvestors,
      gpAssetClasses: [...gpAssetClasses]
    });
  } catch (err) {
    console.error('gp-investor-insights error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
