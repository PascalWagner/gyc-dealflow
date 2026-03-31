// Vercel Serverless Function: /api/deal-stats-bulk via Supabase
// REPLACES: deal-stats-bulk.js (Airtable version)
// Returns aggregated stage counts for ALL deals in one call
// Used for social proof counters on deal cards
//
// Uses the deal_stage_counts VIEW — single indexed query, no pagination

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('deal_stage_counts')
      .select('*');

    if (error) throw error;

    // Transform from array of rows to { dealId: { saved, vetting, invested } } map
    const dealStats = {};
    for (const row of (data || [])) {
      const reviewCount = row.review || row.interested || 0;
      const vettingCount = (row.connect || 0) + (row.decide || 0) || row.duediligence || 0;
      const investedCount = row.invested || row.portfolio || 0;
      dealStats[row.deal_id] = {
        saved: reviewCount,
        vetting: vettingCount,
        invested: investedCount
      };
    }

    return res.status(200).json({
      stats: dealStats,
      totalRecords: (data || []).length,
      fetchedAt: new Date().toISOString()
    });
  } catch (err) {
    console.error('Bulk deal stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch deal stats' });
  }
}
