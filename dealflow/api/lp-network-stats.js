// Vercel Serverless Function: LP Network Stats
// Returns aggregate statistics about the LP investor network for GP-facing pages.
// Used in GP onboarding, GP dashboard, and sponsor profile pages.
//
// No auth required — data is aggregated/anonymized.
// Cached aggressively (15 min) since it changes slowly.

import { getAdminClient, setCors, rateLimit, ghlFetch } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=1800');

  try {
    const supabase = getAdminClient();

    // 1. Total LP count (everyone without a gp_type)
    const { count: totalLPs } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .is('gp_type', null);

    // 2. Buy box data for detailed stats
    const { data: buyBoxes } = await supabase
      .from('user_buy_box')
      .select('accreditation, branch, asset_classes, capital_ready, capital_12mo, capital_90day');

    const boxes = buyBoxes || [];

    // Accredited count — combine buy box data + GHL tags
    const buyBoxAccredited = boxes.filter(b => b.accreditation === 'accredited').length;

    // Also count from GHL: search for contacts tagged as accredited
    let ghlAccredited = 0;
    try {
      const ghlResp = await ghlFetch(
        'https://rest.gohighlevel.com/v1/contacts/?query=accredited&limit=1'
      );
      if (ghlResp && ghlResp.ok) {
        const ghlData = await ghlResp.json();
        // GHL returns meta.total for total matching contacts
        ghlAccredited = ghlData.meta?.total || ghlData.contacts?.length || 0;
      }
    } catch (e) {
      // Non-blocking — fall back to buy box count only
    }

    const accreditedCount = Math.max(buyBoxAccredited, ghlAccredited);

    // Goal distribution (Income / Tax / Growth)
    const goalDist = { income: 0, tax: 0, growth: 0 };
    for (const b of boxes) {
      if (b.branch === 'cashflow') goalDist.income++;
      else if (b.branch === 'tax') goalDist.tax++;
      else if (b.branch === 'growth') goalDist.growth++;
    }

    // Asset class demand (count per class)
    const assetDemand = {};
    for (const b of boxes) {
      if (!Array.isArray(b.asset_classes)) continue;
      for (const ac of b.asset_classes) {
        assetDemand[ac] = (assetDemand[ac] || 0) + 1;
      }
    }
    // Sort by count descending
    const topAssetClasses = Object.entries(assetDemand)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({ name, count }));

    // Capital ranges (check size distribution from capital_ready)
    const capitalRanges = {
      'Under $50K': 0,
      '$50K–$100K': 0,
      '$100K–$250K': 0,
      '$250K–$500K': 0,
      '$500K+': 0
    };
    let totalCapitalReady = 0;
    // Parse capital_ready which stores range strings like "$100k-$249k"
    for (const b of boxes) {
      const cap = (b.capital_ready || b.capital_90day || '').toLowerCase();
      if (!cap) continue;
      // Extract first number
      const match = cap.match(/(\d+)/);
      if (!match) continue;
      const val = parseInt(match[1], 10) * (cap.includes('k') ? 1000 : 1);
      totalCapitalReady += val;
      if (val >= 500000) capitalRanges['$500K+']++;
      else if (val >= 250000) capitalRanges['$250K–$500K']++;
      else if (val >= 100000) capitalRanges['$100K–$250K']++;
      else if (val >= 50000) capitalRanges['$50K–$100K']++;
      else capitalRanges['Under $50K']++;
    }

    // 3. Active users (had activity in last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const { count: activeInvestors } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .is('gp_type', null)
      .gte('last_activity_date', thirtyDaysAgo.toISOString());

    // 4. Total deals saved / vetting (social proof)
    const { count: totalSaved } = await supabase
      .from('user_deal_stages')
      .select('id', { count: 'exact', head: true })
      .in('stage', ['interested', 'saved']);

    const { count: totalVetting } = await supabase
      .from('user_deal_stages')
      .select('id', { count: 'exact', head: true })
      .in('stage', ['vetting', 'duediligence']);

    return res.status(200).json({
      totalLPs: totalLPs || 0,
      accreditedCount: accreditedCount || 0,
      activeInvestors: activeInvestors || 0,
      goalDistribution: goalDist,
      topAssetClasses,
      capitalRanges,
      totalSaved: totalSaved || 0,
      totalVetting: totalVetting || 0,
      completedBuyBoxes: boxes.length,
      totalCapitalReady: totalCapitalReady || 0
    });
  } catch (err) {
    console.error('lp-network-stats error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
