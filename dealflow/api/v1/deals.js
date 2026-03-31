// Public API v1: GET /api/v1/deals
// Search and filter real estate syndication deals
//
// Query parameters:
//   asset_class    - Filter by asset class (e.g. "Multi Family", "Lending")
//   strategy       - Filter by investment strategy (e.g. "Value-Add", "Core")
//   deal_type      - Filter by deal type ("Syndication" | "Fund")
//   status         - Filter by status ("Active" | "Evergreen" | "Closed")
//   min_irr        - Minimum target IRR (decimal, e.g. 0.15 for 15%)
//   max_irr        - Maximum target IRR
//   min_coc        - Minimum cash-on-cash (decimal)
//   min_pref       - Minimum preferred return (decimal)
//   max_minimum    - Maximum investment minimum (e.g. 50000)
//   geography      - Filter by investing geography (partial match)
//   operator       - Filter by operator/sponsor name (partial match)
//   offering_type  - Filter by offering type (e.g. "506(c)")
//   q              - Full-text search across deal name, operator, geography
//   sort           - Sort field: "newest" | "irr" | "coc" | "minimum" (default: newest)
//   limit          - Results per page, max 100 (default: 50)
//   offset         - Pagination offset (default: 0)
//   include_stale  - Include stale/closed deals (default: false)

import { getAdminClient } from '../_supabase.js';
import { verifyApiKey, logRequest, setApiCors, apiError } from './_auth.js';
import { computePublicDealStaleness, formatPublicDeal } from './deals/shared.js';

export default async function handler(req, res) {
  setApiCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');

  const startTime = Date.now();

  // Authenticate
  const auth = await verifyApiKey(req);
  if (!auth.authorized) {
    if (auth.status === 429) {
      res.setHeader('Retry-After', auth.retryAfter);
    }
    logRequest(null, req, auth.status || 401, startTime);
    return apiError(res, auth.status || 401, auth.error);
  }

  try {
    const supabase = getAdminClient();
    const q = req.query || {};

    // Build query
    let query = supabase
      .from('opportunities')
      .select(`
        *,
        management_company:management_companies (
          id, operator_name, ceo, website, founding_year, type, asset_classes, headquarters, full_cycle_deals
        )
      `)
      .not('investment_name', 'eq', '')
      .is('parent_deal_id', null)       // Only parent deals, not share classes
      .eq('is_visible_to_users', true)  // Only published deals
      .eq('is_506b', false)             // Never expose 506(b) deals via public API
      .not('lifecycle_status', 'eq', 'do_not_publish');

    // Filters
    if (q.asset_class) query = query.eq('asset_class', q.asset_class);
    if (q.strategy) query = query.eq('investment_strategy', q.strategy);
    if (q.deal_type) query = query.eq('deal_type', q.deal_type);
    if (q.status) query = query.eq('status', q.status);
    if (q.offering_type) query = query.eq('offering_type', q.offering_type);
    if (q.min_irr) query = query.gte('target_irr', parseFloat(q.min_irr));
    if (q.max_irr) query = query.lte('target_irr', parseFloat(q.max_irr));
    if (q.min_coc) query = query.gte('cash_on_cash', parseFloat(q.min_coc));
    if (q.min_pref) query = query.gte('preferred_return', parseFloat(q.min_pref));
    if (q.max_minimum) query = query.lte('investment_minimum', parseFloat(q.max_minimum));
    if (q.geography) query = query.ilike('investing_geography', '%' + q.geography + '%');
    if (q.operator) query = query.ilike('management_companies.operator_name', '%' + q.operator + '%');

    // Sort
    const sortMap = {
      newest: ['added_date', { ascending: false }],
      irr: ['target_irr', { ascending: false, nullsFirst: false }],
      coc: ['cash_on_cash', { ascending: false, nullsFirst: false }],
      minimum: ['investment_minimum', { ascending: true, nullsFirst: false }]
    };
    const [sortCol, sortOpts] = sortMap[q.sort] || sortMap.newest;
    query = query.order(sortCol, sortOpts);

    // Pagination
    const limit = Math.min(parseInt(q.limit) || 50, 100);
    const offset = parseInt(q.offset) || 0;
    query = query.range(offset, offset + limit - 1);

    const { data: deals, error, count } = await query;
    if (error) throw error;

    // Staleness filter + transform
    const now = new Date();
    const includeStale = q.include_stale === 'true';

    const results = (deals || [])
      .map((deal) => {
        const stale = computePublicDealStaleness(deal, now);
        return {
          ...formatPublicDeal(deal),
          is_stale: stale.isStale,
          staleness_reason: stale.reason
        };
      })
      .filter(d => includeStale || !d.is_stale);

    // Response
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
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
    console.error('API v1 deals error:', err);
    logRequest(auth.keyRecord, req, 500, startTime);
    return apiError(res, 500, 'Internal server error');
  }
}

