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

    // ---- AGGREGATE: Top Deal Types ----
    const dealTypeCounts = {};

    // From buy box deal_structure field (can be string, array, or JSON-encoded array)
    for (const bb of completedBuyBoxes) {
      if (bb.deal_structure) {
        let structures = bb.deal_structure;
        // Parse if it's a JSON string
        if (typeof structures === 'string') {
          try { structures = JSON.parse(structures); } catch (e) { /* keep as string */ }
        }
        // Handle array of structures
        if (Array.isArray(structures)) {
          for (const s of structures) {
            if (s && typeof s === 'string') {
              dealTypeCounts[s] = (dealTypeCounts[s] || 0) + 1;
            }
          }
        } else if (typeof structures === 'string') {
          dealTypeCounts[structures] = (dealTypeCounts[structures] || 0) + 1;
        }
      }
    }

    // From deal stages
    for (const s of allStages) {
      const deal = dealMap[s.deal_id];
      if (deal && deal.deal_type) {
        dealTypeCounts[deal.deal_type] = (dealTypeCounts[deal.deal_type] || 0) + 0.5;
      }
    }

    // Supplement from opportunities
    if (Object.keys(dealTypeCounts).length < 3) {
      for (const d of allOpps) {
        if (d.deal_type) {
          dealTypeCounts[d.deal_type] = (dealTypeCounts[d.deal_type] || 0) + 0.1;
        }
      }
    }

    const totalTypeVotes = Object.values(dealTypeCounts).reduce((a, b) => a + b, 0) || 1;
    const topDealTypes = Object.entries(dealTypeCounts)
      .map(([name, count]) => ({
        name,
        count: Math.round(count),
        pct: Math.round((count / totalTypeVotes) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);

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

    // ---- AGGREGATE: Check Size Distribution ----
    const checkSizeRanges = {};

    // Bucket a numeric value into a range
    function bucketCheckSize(val) {
      if (val <= 0) return null;
      if (val < 25000) return 'Under $25K';
      if (val < 50000) return '$25K–$50K';
      if (val < 100000) return '$50K–$100K';
      if (val < 250000) return '$100K–$250K';
      if (val < 500000) return '$250K–$500K';
      return '$500K+';
    }

    // From buy box check_size (could be text range or numeric)
    for (const bb of completedBuyBoxes) {
      if (bb.check_size) {
        let range = bb.check_size;
        if (typeof range === 'number') {
          range = bucketCheckSize(range);
        }
        if (range) checkSizeRanges[range] = (checkSizeRanges[range] || 0) + 1;
      }
    }

    // From capital_available in goals
    for (const g of goals) {
      if (g.capital_available > 0) {
        const range = bucketCheckSize(g.capital_available);
        if (range) checkSizeRanges[range] = (checkSizeRanges[range] || 0) + 0.5;
      }
    }

    const totalCheckVotes = Object.values(checkSizeRanges).reduce((a, b) => a + b, 0) || 1;
    const checkSizeDistribution = Object.entries(checkSizeRanges)
      .map(([name, count]) => ({
        name,
        pct: Math.round((count / totalCheckVotes) * 100)
      }))
      .sort((a, b) => b.pct - a.pct);

    // Most common for backward compat
    const avgCheckSize = checkSizeDistribution.length > 0 ? checkSizeDistribution[0].name : 'Not enough data';

    // ---- AGGREGATE: Top Goals ----
    const goalCounts = {};

    // From user_goals
    for (const g of goals) {
      if (g.goal_type) {
        goalCounts[g.goal_type] = (goalCounts[g.goal_type] || 0) + 1;
      }
    }

    // From buy box goal field
    for (const bb of completedBuyBoxes) {
      if (bb.goal) {
        goalCounts[bb.goal] = (goalCounts[bb.goal] || 0) + 1;
      }
    }

    const totalGoalVotes = Object.values(goalCounts).reduce((a, b) => a + b, 0) || 1;
    const topGoals = Object.entries(goalCounts)
      .map(([name, count]) => ({
        name,
        pct: Math.round((count / totalGoalVotes) * 100)
      }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);

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
      totalInvestors,
      gpAssetClasses: [...gpAssetClasses]
    });
  } catch (err) {
    console.error('gp-investor-insights error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
