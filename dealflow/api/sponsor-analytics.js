// Vercel Serverless Function: /api/sponsor-analytics via Supabase
// REPLACES: sponsor-analytics.js (Airtable version)
// Returns anonymized LP engagement metrics for a sponsor's deals
// Used for GP-facing analytics on the sponsor profile page

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const companyName = req.query.company;
  if (!companyName) {
    return res.status(400).json({ error: 'company parameter is required' });
  }

  try {
    const supabase = getAdminClient();

    // 1. Find management company
    const { data: mc, error: mcErr } = await supabase
      .from('management_companies')
      .select('id, operator_name')
      .ilike('operator_name', companyName)
      .single();

    if (mcErr || !mc) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    // 2. Find all deals for this sponsor
    const { data: deals, error: dealsErr } = await supabase
      .from('opportunities')
      .select('id, investment_name')
      .eq('management_company_id', mc.id);

    if (dealsErr) throw dealsErr;

    const dealIds = (deals || []).map(d => d.id);
    if (dealIds.length === 0) {
      return res.status(200).json({
        analytics: {
          sponsorName: mc.operator_name,
          totalDeals: 0,
          dealsWithEngagement: 0,
          totalInvestorsWatching: 0,
          investorsInDD: 0,
          investorsInvested: 0,
          dealBreakdown: [],
          fetchedAt: new Date().toISOString()
        }
      });
    }

    // 3. Get stage counts from the view
    const { data: stageCounts, error: stageErr } = await supabase
      .from('deal_stage_counts')
      .select('*')
      .in('deal_id', dealIds);

    if (stageErr) throw stageErr;

    // 4. Aggregate
    let totalWatching = 0;
    let totalInDD = 0;
    let totalInvested = 0;
    let dealsWithEngagement = 0;

    const dealBreakdown = (stageCounts || []).map(row => {
      const watching = (row.interested || 0) + (row.duediligence || 0) + (row.portfolio || 0);
      const inDD = row.duediligence || 0;
      const invested = row.portfolio || 0;

      totalWatching += watching;
      totalInDD += inDD;
      totalInvested += invested;
      if (watching > 0) dealsWithEngagement++;

      return {
        dealId: row.deal_id,
        watching,
        inDD,
        invested
      };
    });

    return res.status(200).json({
      analytics: {
        sponsorName: mc.operator_name,
        totalDeals: dealIds.length,
        dealsWithEngagement,
        totalInvestorsWatching: totalWatching,
        investorsInDD: totalInDD,
        investorsInvested: totalInvested,
        dealBreakdown,
        fetchedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Sponsor analytics error:', err);
    return res.status(500).json({ error: 'Failed to fetch analytics' });
  }
}
