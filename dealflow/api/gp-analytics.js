// Vercel Serverless Function: GP Analytics
// Returns LP activity data for a given management company's deals
//
// Query params:
//   companyId — UUID of the management company
//
// Returns:
//   { dealViews: {dealId: count}, totalSaves: N, totalVetting: N, totalInvested: N,
//     recentActivity: [{user_id, deal_id, stage, updated_at}] }

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

  // Short cache — analytics should be reasonably fresh
  res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');

  try {
    const supabase = getAdminClient();

    // 1. Get all deal IDs for this company (direct ownership + deal_sponsors)
    const { data: ownedDeals, error: ownedErr } = await supabase
      .from('opportunities')
      .select('id')
      .eq('management_company_id', companyId)
      .is('parent_deal_id', null);

    if (ownedErr) throw ownedErr;

    const { data: sponsoredRows } = await supabase
      .from('deal_sponsors')
      .select('deal_id')
      .eq('company_id', companyId);

    // Merge into unique set of deal IDs
    const dealIdSet = new Set();
    for (const d of (ownedDeals || [])) dealIdSet.add(d.id);
    for (const s of (sponsoredRows || [])) dealIdSet.add(s.deal_id);
    const dealIds = Array.from(dealIdSet);

    if (dealIds.length === 0) {
      return res.status(200).json({
        dealViews: {},
        totalSaves: 0,
        totalVetting: 0,
        totalInvested: 0,
        recentActivity: [],
        weeklyActivity: []
      });
    }

    // 2. Query user_deal_stages for these deals
    const { data: stages, error: stagesErr } = await supabase
      .from('user_deal_stages')
      .select('user_id, deal_id, stage, updated_at')
      .in('deal_id', dealIds)
      .order('updated_at', { ascending: false });

    if (stagesErr) throw stagesErr;

    const allStages = stages || [];

    // 3. Aggregate counts
    const dealViews = {};
    let totalSaves = 0;
    let totalVetting = 0;
    let totalInvested = 0;

    for (const s of allStages) {
      // Count total interactions per deal
      dealViews[s.deal_id] = (dealViews[s.deal_id] || 0) + 1;

      if (s.stage === 'interested') totalSaves++;
      else if (s.stage === 'duediligence') totalVetting++;
      else if (s.stage === 'portfolio') totalInvested++;
    }

    // 4. Recent activity (last 10)
    const recentActivity = allStages.slice(0, 10).map(s => ({
      user_id: s.user_id,
      deal_id: s.deal_id,
      stage: s.stage,
      updated_at: s.updated_at
    }));

    // 5. Weekly activity aggregation (last 8 weeks)
    const now = new Date();
    const weeklyMap = {};
    // Pre-fill last 8 weeks with zeros
    for (let i = 0; i < 8; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - d.getDay() + 1 - i * 7); // Monday of each week
      const key = d.toISOString().slice(0, 10);
      weeklyMap[key] = { week: key, interested: 0, duediligence: 0, portfolio: 0 };
    }

    for (const s of allStages) {
      if (!s.updated_at) continue;
      const dt = new Date(s.updated_at);
      // Find Monday of this date's week
      const day = dt.getDay();
      const monday = new Date(dt);
      monday.setDate(monday.getDate() - ((day + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      if (weeklyMap[key]) {
        if (s.stage === 'interested') weeklyMap[key].interested++;
        else if (s.stage === 'duediligence') weeklyMap[key].duediligence++;
        else if (s.stage === 'portfolio') weeklyMap[key].portfolio++;
      }
    }

    // Sort ascending by week
    const weeklyActivity = Object.values(weeklyMap).sort((a, b) => a.week.localeCompare(b.week));

    return res.status(200).json({
      dealViews,
      totalSaves,
      totalVetting,
      totalInvested,
      recentActivity,
      weeklyActivity
    });
  } catch (err) {
    console.error('gp-analytics error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
