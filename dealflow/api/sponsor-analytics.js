// Vercel Serverless Function: /api/sponsor-analytics
// Returns anonymized LP engagement metrics for a sponsor's deals
// Used for GP-facing analytics on the sponsor profile page

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const companyName = req.query.company;
  if (!companyName) {
    return res.status(400).json({ error: 'company parameter is required' });
  }

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT not set' });
  }

  try {
    // 1. Find all deals by this management company
    const dealsUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblXFNpOvL0Ub5tVt`);
    dealsUrl.searchParams.set('pageSize', '100');
    dealsUrl.searchParams.append('fields[]', 'Investment Name / Address');
    dealsUrl.searchParams.append('fields[]', 'Status');
    dealsUrl.searchParams.append('fields[]', 'Asset Class');

    // We'll need to resolve management company via linked record, so fetch all and filter client-side
    // OR use the Management Company table to find deal IDs
    const mcUrl = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblRczR8Eok31ZhJj`);
    mcUrl.searchParams.set('filterByFormula', `{Operator Name}='${companyName.replace(/'/g, "\\'")}'`);
    mcUrl.searchParams.set('pageSize', '1');

    const mcResp = await fetch(mcUrl.toString(), {
      headers: { 'Authorization': `Bearer ${pat}` }
    });
    if (!mcResp.ok) throw new Error('MC lookup failed');
    const mcData = await mcResp.json();

    if (!mcData.records || mcData.records.length === 0) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    const mcRecord = mcData.records[0];
    const mcId = mcRecord.id;
    const dealIds = mcRecord.fields['Deal IDs'] || [];

    if (dealIds.length === 0) {
      return res.status(200).json({ analytics: { totalDeals: 0, engagement: {} } });
    }

    // 2. Get stage data for these deals from User Deal Stages
    const stageRecords = [];
    let offset = null;

    // Build OR formula for all deal IDs
    const dealIdFormulas = dealIds.map(id => `{Deal ID}='${id}'`);
    const filterFormula = dealIdFormulas.length === 1
      ? dealIdFormulas[0]
      : `OR(${dealIdFormulas.join(',')})`;

    do {
      const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('User Deal Stages')}`);
      url.searchParams.set('pageSize', '100');
      url.searchParams.set('filterByFormula', filterFormula);
      url.searchParams.append('fields[]', 'Deal ID');
      url.searchParams.append('fields[]', 'Stage');
      if (offset) url.searchParams.set('offset', offset);

      const response = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${pat}` }
      });
      if (!response.ok) throw new Error('Stage fetch failed');

      const data = await response.json();
      stageRecords.push(...(data.records || []));
      offset = data.offset || null;
    } while (offset);

    // 3. Aggregate by deal
    const STAGE_MAP = { interested: 'saved', duediligence: 'vetting', portfolio: 'invested' };
    const dealEngagement = {};

    for (const rec of stageRecords) {
      const f = rec.fields || {};
      const dealId = f['Deal ID'];
      if (!dealId) continue;

      let stage = (f['Stage'] || '').toLowerCase();
      stage = STAGE_MAP[stage] || stage;

      if (!dealEngagement[dealId]) {
        dealEngagement[dealId] = { saved: 0, vetting: 0, ready: 0, invested: 0, total: 0 };
      }

      if (['saved', 'vetting', 'ready', 'invested'].includes(stage)) {
        dealEngagement[dealId][stage]++;
        dealEngagement[dealId].total++;
      }
    }

    // 4. Compute aggregate metrics
    let totalWatching = 0;
    let totalInDD = 0;
    let totalInvested = 0;
    let dealsWithEngagement = 0;

    for (const de of Object.values(dealEngagement)) {
      totalWatching += de.total;
      totalInDD += de.vetting + de.ready;
      totalInvested += de.invested;
      if (de.total > 0) dealsWithEngagement++;
    }

    // 5. Return anonymized analytics (no user emails, names, or identifying info)
    return res.status(200).json({
      analytics: {
        sponsorName: companyName,
        totalDeals: dealIds.length,
        dealsWithEngagement,
        totalInvestorsWatching: totalWatching,
        investorsInDD: totalInDD,
        investorsInvested: totalInvested,
        dealBreakdown: Object.entries(dealEngagement).map(([dealId, counts]) => ({
          dealId,
          watching: counts.total,
          inDD: counts.vetting + counts.ready,
          invested: counts.invested
        })),
        fetchedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Sponsor analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
