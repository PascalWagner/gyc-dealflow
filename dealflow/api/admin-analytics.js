// Vercel Serverless Function: /api/admin-analytics via Supabase
// REPLACES: admin-analytics.js (Airtable version)
// Returns aggregated user engagement data for admin dashboard
// Shows: hot deals, user funnel, engagement cohorts, top engaged users

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getAdminClient();

    // 1. Fetch all user deal stages
    const { data: stages, error: stagesErr } = await supabase
      .from('user_deal_stages')
      .select('deal_id, stage, user_id, updated_at');

    if (stagesErr) throw stagesErr;

    // 2. Fetch deal names for resolution
    const { data: deals, error: dealsErr } = await supabase
      .from('opportunities')
      .select('id, investment_name');

    if (dealsErr) throw dealsErr;

    const dealNames = {};
    (deals || []).forEach(d => { dealNames[d.id] = d.investment_name || d.id; });

    // Normalize stages
    const STAGE_MAP = { interested: 'saved', duediligence: 'vetting', portfolio: 'invested' };

    // Aggregate
    const dealStats = {};
    const userStats = {};
    const funnel = { saved: 0, vetting: 0, ready: 0, invested: 0, passed: 0 };

    for (const rec of (stages || [])) {
      const dealId = rec.deal_id || '';
      const userId = rec.user_id || '';
      let stage = (rec.stage || '').toLowerCase();
      stage = STAGE_MAP[stage] || stage;
      const updatedAt = rec.updated_at || '';

      // Deal stats
      if (dealId) {
        if (!dealStats[dealId]) {
          dealStats[dealId] = { name: dealNames[dealId] || dealId, saved: 0, vetting: 0, ready: 0, invested: 0, total: 0 };
        }
        if (['saved', 'vetting', 'ready', 'invested'].includes(stage)) {
          dealStats[dealId][stage]++;
          dealStats[dealId].total++;
        }
      }

      // User stats (user_id is typically the user's email)
      if (userId) {
        if (!userStats[userId]) {
          userStats[userId] = { email: userId, saved: 0, vetting: 0, ready: 0, invested: 0, total: 0, lastActive: '' };
        }
        if (['saved', 'vetting', 'ready', 'invested'].includes(stage)) {
          userStats[userId][stage]++;
          userStats[userId].total++;
        }
        if (updatedAt > userStats[userId].lastActive) {
          userStats[userId].lastActive = updatedAt;
        }
      }

      // Funnel
      if (funnel[stage] !== undefined) funnel[stage]++;
    }

    // Hot deals (sorted by total engagement)
    const hotDeals = Object.values(dealStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // Top engaged users
    const topUsers = Object.values(userStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 20)
      .map(u => ({
        email: u.email,
        saved: u.saved,
        vetting: u.vetting,
        ready: u.ready,
        invested: u.invested,
        total: u.total,
        lastActive: u.lastActive
      }));

    const totalUsers = Object.keys(userStats).length;
    const usersInDD = Object.values(userStats).filter(u => u.vetting > 0 || u.ready > 0).length;
    const usersInvested = Object.values(userStats).filter(u => u.invested > 0).length;

    return res.status(200).json({
      summary: {
        totalRecords: (stages || []).length,
        totalUsers,
        usersInDD,
        usersInvested,
        funnel
      },
      hotDeals,
      topUsers,
      fetchedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Admin analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
