// Vercel Serverless Function: /api/deal-stats via Supabase
// REPLACES: deal-stats.js (Airtable version)
//
// What changed:
//   - Uses the deal_stage_counts VIEW (single indexed query)
//   - No pagination needed
//   - ~10x faster

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dealId = req.query.dealId;
  if (!dealId) {
    return res.status(400).json({ error: 'dealId is required' });
  }

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('deal_stage_counts')
      .select('*')
      .eq('deal_id', dealId)
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows

    return res.status(200).json({
      interested: data?.interested || 0,
      duediligence: data?.duediligence || 0,
      portfolio: data?.portfolio || 0
    });
  } catch (err) {
    console.error('Deal stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch deal stats' });
  }
}
