// Vercel Serverless Function: /api/deal-stats via Supabase
// Returns anonymous stage counts + names of investors who opted into sharing

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

    // 1. Anonymous stage counts (existing view)
    const { data, error } = await supabase
      .from('deal_stage_counts')
      .select('*')
      .eq('deal_id', dealId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // 2. Named investors who opted into sharing (portfolio stage only)
    const { data: publicInvestors } = await supabase
      .from('user_deal_stages')
      .select('user_id, stage, user_profiles!inner(full_name, share_portfolio)')
      .eq('deal_id', dealId)
      .eq('user_profiles.share_portfolio', true);

    // Build named lists by stage
    const namedInvestors = [];
    const namedWatchers = [];
    if (publicInvestors) {
      for (const row of publicInvestors) {
        const name = row.user_profiles?.full_name;
        if (!name) continue;
        if (row.stage === 'portfolio') {
          namedInvestors.push(name);
        } else {
          namedWatchers.push(name);
        }
      }
    }

    // Also check user_portfolio for invested users who opted in
    const { data: portfolioInvestors } = await supabase
      .from('user_portfolio')
      .select('user_id, user_profiles!inner(full_name, share_portfolio)')
      .eq('deal_id', dealId)
      .eq('user_profiles.share_portfolio', true);

    if (portfolioInvestors) {
      for (const row of portfolioInvestors) {
        const name = row.user_profiles?.full_name;
        if (name && !namedInvestors.includes(name)) {
          namedInvestors.push(name);
        }
      }
    }

    return res.status(200).json({
      interested: data?.interested || 0,
      duediligence: data?.duediligence || 0,
      portfolio: data?.portfolio || 0,
      namedInvestors,
      namedWatchers
    });
  } catch (err) {
    console.error('Deal stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch deal stats' });
  }
}
