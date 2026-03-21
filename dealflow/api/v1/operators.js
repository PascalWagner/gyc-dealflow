// Public API v1: GET /api/v1/operators
// List and search operators/sponsors
//
// Query parameters:
//   q              - Search by name (partial match)
//   type           - Filter by type (e.g. "Fund Manager", "Syndicator")
//   asset_class    - Filter by asset class
//   sort           - Sort: "name" | "newest" | "aum" (default: name)
//   limit          - Results per page, max 100 (default: 50)
//   offset         - Pagination offset (default: 0)

import { getAdminClient } from '../_supabase.js';
import { verifyApiKey, logRequest, setApiCors, apiError } from './_auth.js';

export default async function handler(req, res) {
  setApiCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');

  const startTime = Date.now();

  const auth = await verifyApiKey(req);
  if (!auth.authorized) {
    if (auth.status === 429) res.setHeader('Retry-After', auth.retryAfter);
    logRequest(null, req, auth.status || 401, startTime);
    return apiError(res, auth.status || 401, auth.error);
  }

  try {
    const supabase = getAdminClient();
    const q = req.query || {};

    let query = supabase
      .from('management_companies')
      .select('*');

    if (q.q) query = query.ilike('operator_name', '%' + q.q + '%');
    if (q.type) query = query.eq('type', q.type);
    if (q.asset_class) query = query.contains('asset_classes', [q.asset_class]);

    // Sort
    if (q.sort === 'aum') {
      query = query.order('aum', { ascending: false, nullsFirst: false });
    } else if (q.sort === 'newest') {
      query = query.order('created_at', { ascending: false });
    } else {
      query = query.order('operator_name', { ascending: true });
    }

    const limit = Math.min(parseInt(q.limit) || 50, 100);
    const offset = parseInt(q.offset) || 0;
    query = query.range(offset, offset + limit - 1);

    const { data: operators, error } = await query;
    if (error) throw error;

    // Count deals per operator
    const opIds = (operators || []).map(o => o.id);
    let dealCounts = {};
    if (opIds.length > 0) {
      const { data: counts } = await supabase
        .from('opportunities')
        .select('management_company_id')
        .in('management_company_id', opIds)
        .is('parent_deal_id', null)
        .eq('is_506b', false);

      for (const row of (counts || [])) {
        dealCounts[row.management_company_id] = (dealCounts[row.management_company_id] || 0) + 1;
      }
    }

    const results = (operators || []).map(o => ({
      id: o.id,
      name: o.operator_name,
      ceo: o.ceo,
      website: o.website,
      linkedin: o.linkedin_ceo,
      invest_clearly_profile: o.invest_clearly_profile,
      founding_year: o.founding_year,
      type: o.type,
      asset_classes: o.asset_classes || [],
      total_investors: o.total_investors,
      headquarters: o.headquarters,
      aum: o.aum,
      description: o.description,
      deal_count: dealCounts[o.id] || 0,
      updated_at: o.last_updated || o.created_at
    }));

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300');
    logRequest(auth.keyRecord, req, 200, startTime);

    return res.status(200).json({
      data: results,
      pagination: {
        limit,
        offset,
        count: results.length,
        has_more: results.length === limit
      },
      meta: {
        api_version: 'v1',
        fetched_at: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('API v1 operators error:', err);
    logRequest(auth.keyRecord, req, 500, startTime);
    return apiError(res, 500, 'Internal server error');
  }
}
