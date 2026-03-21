// Vercel Serverless Function: /api/deal-stats via Supabase
// Returns anonymous stage counts + names of investors who opted into sharing
// Named investors are only visible if the requesting user has also opted in (reciprocal)

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const dealId = req.query.dealId;
  if (!dealId) {
    return res.status(400).json({ error: 'dealId is required' });
  }

  try {
    const supabase = getAdminClient();

    // 1. Anonymous stage counts (always available)
    const { data, error } = await supabase
      .from('deal_stage_counts')
      .select('*')
      .eq('deal_id', dealId)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    const result = {
      interested: data?.interested || 0,
      duediligence: data?.duediligence || 0,
      portfolio: data?.portfolio || 0,
      namedInvestors: [],
      namedWatchers: []
    };

    // 2. Check if requesting user has opted in (reciprocal visibility)
    let callerOptedIn = false;
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('share_portfolio')
          .eq('id', user.id)
          .single();
        callerOptedIn = profile?.share_portfolio === true;
      }
    }

    // 3. Only fetch named investors if caller has also opted in
    if (callerOptedIn) {
      const { data: publicInvestors } = await supabase
        .from('user_deal_stages')
        .select('user_id, stage, user_profiles!inner(full_name, share_portfolio)')
        .eq('deal_id', dealId)
        .eq('user_profiles.share_portfolio', true);

      if (publicInvestors) {
        for (const row of publicInvestors) {
          const name = row.user_profiles?.full_name;
          if (!name) continue;
          if (row.stage === 'portfolio') {
            result.namedInvestors.push(name);
          } else {
            result.namedWatchers.push(name);
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
          if (name && !result.namedInvestors.includes(name)) {
            result.namedInvestors.push(name);
          }
        }
      }
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error('Deal stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch deal stats' });
  }
}
