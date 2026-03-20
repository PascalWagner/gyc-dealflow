// Vercel Serverless Function: /api/admin-analytics
// Returns aggregated user engagement data for admin dashboard
// Shows: hot deals, user funnel, engagement cohorts, top engaged users

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not set' });
  }

  try {
    // Fetch ALL User Deal Stages records
    const records = [];
    let offset = null;

    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('User Deal Stages')}`);
      url.searchParams.set('pageSize', '100');
      url.searchParams.append('fields[]', 'Deal ID');
      url.searchParams.append('fields[]', 'Stage');
      url.searchParams.append('fields[]', 'Email');
      url.searchParams.append('fields[]', 'Updated At');
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${pat}` }
      });
      if (!response.ok) throw new Error('Airtable error ' + response.status);

      const data = await response.json();
      records.push(...(data.records || []));
      offset = data.offset || null;
    } while (offset);

    // Also fetch deals for name resolution
    const dealsUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblXFNpOvL0Ub5tVt`);
    dealsUrl.searchParams.set('pageSize', '100');
    dealsUrl.searchParams.append('fields[]', 'Investment Name / Address');

    const dealsResp = await fetch(dealsUrl.toString(), {
      headers: { 'Authorization': `Bearer ${pat}` }
    });
    const dealsData = dealsResp.ok ? await dealsResp.json() : { records: [] };
    const dealNames = {};
    (dealsData.records || []).forEach(r => {
      dealNames[r.id] = (r.fields || {})['Investment Name / Address'] || r.id;
    });

    // Normalize stages
    const STAGE_MAP = { interested: 'saved', duediligence: 'vetting', portfolio: 'invested' };

    // === Aggregate ===

    // 1. Per-deal engagement (hot deals)
    const dealStats = {};
    // 2. Per-user engagement
    const userStats = {};
    // 3. Funnel counts
    const funnel = { saved: 0, vetting: 0, ready: 0, invested: 0, passed: 0 };

    for (const rec of records) {
      const f = rec.fields || {};
      const dealId = f['Deal ID'] || '';
      const email = f['Email'] || '';
      let stage = (f['Stage'] || '').toLowerCase();
      stage = STAGE_MAP[stage] || stage;
      const updatedAt = f['Updated At'] || '';

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

      // User stats
      if (email) {
        if (!userStats[email]) {
          userStats[email] = { email, saved: 0, vetting: 0, ready: 0, invested: 0, total: 0, lastActive: '' };
        }
        if (['saved', 'vetting', 'ready', 'invested'].includes(stage)) {
          userStats[email][stage]++;
          userStats[email].total++;
        }
        if (updatedAt > userStats[email].lastActive) {
          userStats[email].lastActive = updatedAt;
        }
      }

      // Funnel
      if (funnel[stage] !== undefined) funnel[stage]++;
    }

    // Hot deals (sorted by total engagement)
    const hotDeals = Object.values(dealStats)
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    // Top engaged users (sorted by total actions)
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

    // Unique users with engagement
    const totalUsers = Object.keys(userStats).length;
    const usersInDD = Object.values(userStats).filter(u => u.vetting > 0 || u.ready > 0).length;
    const usersInvested = Object.values(userStats).filter(u => u.invested > 0).length;

    return res.status(200).json({
      summary: {
        totalRecords: records.length,
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
