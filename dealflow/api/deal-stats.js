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
      _version: 'v3-split-query',
      review: data?.review || data?.interested || 0,
      connect: data?.connect || 0,
      decide: data?.decide || 0,
      invested: data?.invested || data?.portfolio || 0,
      skipped: data?.skipped || 0,
      interested: data?.interested || data?.review || 0,
      duediligence: data?.duediligence || ((data?.connect || 0) + (data?.decide || 0)),
      portfolio: data?.portfolio || data?.invested || 0,
      namedInvestors: [],
      namedWatchers: []
    };

    // 2. Check if requesting user has opted in (reciprocal visibility)
    let callerProfile = null;
    const token = (req.headers.authorization || '').replace('Bearer ', '');
    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('share_saved, share_dd, share_invested, share_activity')
          .eq('id', user.id)
          .single();
        callerProfile = profile;
      }
    }

    // Caller must have at least one sharing toggle on to see named investors
    const callerOptedIn = callerProfile && (
      callerProfile.share_saved || callerProfile.share_dd || callerProfile.share_invested || callerProfile.share_activity
    );

    // 3. Only fetch named investors if caller has also opted in
    if (callerOptedIn) {
      // Fetch deal stages — use granular toggles to filter by stage
      // Two-step query: get stages, then fetch profiles separately
      // (avoids Supabase join issues with nullable FK relationships)
      const { data: stageRows, error: stagesError } = await supabase
        .from('user_deal_stages')
        .select('user_id, stage')
        .eq('deal_id', dealId);

      if (stagesError) console.warn('[deal-stats] stages query error:', stagesError.message);

      let profilesByUserId = {};
      if (stageRows?.length > 0) {
        const userIds = [...new Set(stageRows.map(r => r.user_id))];
        const { data: profiles } = await supabase
          .from('user_profiles')
          .select('id, full_name, avatar_url, share_saved, share_dd, share_invested, share_activity')
          .in('id', userIds);
        if (profiles) {
          for (const p of profiles) profilesByUserId[p.id] = p;
        }
      }

      if (stageRows) {
        for (const row of stageRows) {
          const p = profilesByUserId[row.user_id];
          const name = p?.full_name;
          if (!name) continue;
          const investorInfo = {
            name,
            avatarUrl: p.avatar_url || null,
            visible: p.share_activity !== false
          };
          if ((row.stage === 'invested' || row.stage === 'portfolio') && (p.share_invested || p.share_activity)) {
            result.namedInvestors.push(investorInfo);
          } else if ((row.stage === 'connect' || row.stage === 'decide' || row.stage === 'dd' || row.stage === 'duediligence') && p.share_dd) {
            result.namedWatchers.push(investorInfo);
          } else if ((row.stage === 'review' || row.stage === 'saved' || row.stage === 'interested') && p.share_saved) {
            result.namedWatchers.push(investorInfo);
          }
        }
      }
    }

    // Temporary debug info for investor avatar investigation
    result._debug = {
      callerOptedIn: !!callerOptedIn,
      callerProfile: callerProfile ? { share_saved: callerProfile.share_saved, share_dd: callerProfile.share_dd, share_invested: callerProfile.share_invested, share_activity: callerProfile.share_activity } : null,
      stageRowCount: stageRows?.length ?? -1,
      profileCount: Object.keys(profilesByUserId || {}).length
    };
    return res.status(200).json(result);
  } catch (err) {
    console.error('Deal stats error:', err);
    return res.status(500).json({ error: 'Failed to fetch deal stats' });
  }
}
