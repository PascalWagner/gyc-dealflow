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
        id, deal_number, investment_name, asset_class, deal_type, status,
        target_irr, equity_multiple, preferred_return, cash_on_cash,
        investment_minimum, lp_gp_split, hold_period_years, sponsor_in_deal_pct,
        offering_type, offering_size, investing_geography, investment_strategy,
        distributions, financials, available_to, first_yr_depreciation,
        strategy, instrument, fees, location, property_address,
        debt_position, fund_aum, loan_count, avg_loan_ltv,
        vertical_integration, added_date, created_at, updated_at,
        parent_deal_id, share_class_label,
        sec_cik, date_of_first_sale, total_amount_sold, total_investors,
        management_company:management_companies (
          id, operator_name, ceo, website, founding_year, type, asset_classes, headquarters
        )
      `)
      .not('investment_name', 'eq', '')
      .is('parent_deal_id', null)       // Only parent deals, not share classes
      .eq('is_506b', false)             // Never expose 506(b) deals via public API
      .not('status', 'eq', 'Draft');    // Hide Draft deals from public API (GP must confirm first)

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
      .map(d => {
        const mc = d.management_company || {};
        const stale = computeStaleness(d, now);
        return { ...formatDeal(d, mc), is_stale: stale.isStale, staleness_reason: stale.reason };
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

// Format a deal for the public API (snake_case, clean structure)
function formatDeal(d, mc) {
  return {
    id: d.id,
    deal_number: d.deal_number,
    name: d.investment_name,
    asset_class: d.asset_class,
    deal_type: d.deal_type,
    status: d.status,

    // Financial metrics
    target_irr: d.target_irr,
    equity_multiple: d.equity_multiple,
    preferred_return: d.preferred_return,
    cash_on_cash: d.cash_on_cash,
    investment_minimum: d.investment_minimum,
    lp_gp_split: d.lp_gp_split,
    hold_period_years: d.hold_period_years,
    sponsor_co_invest_pct: d.sponsor_in_deal_pct,
    fees: d.fees || [],

    // Structure
    offering_type: d.offering_type,
    offering_size: d.offering_size,
    investment_strategy: d.investment_strategy,
    strategy: d.strategy,
    instrument: d.instrument,
    distributions: d.distributions,
    financials: d.financials,
    available_to: d.available_to,
    first_yr_depreciation: d.first_yr_depreciation,
    vertical_integration: d.vertical_integration,

    // Location
    geography: d.investing_geography,
    location: d.location,
    property_address: d.property_address,

    // Debt fund specific
    debt_position: d.debt_position,
    fund_aum: d.fund_aum,
    loan_count: d.loan_count,
    avg_loan_ltv: d.avg_loan_ltv,

    // Operator
    operator: mc.id ? {
      id: mc.id,
      name: mc.operator_name,
      ceo: mc.ceo,
      website: mc.website,
      founding_year: mc.founding_year,
      type: mc.type,
      asset_classes: mc.asset_classes || [],
      headquarters: mc.headquarters,
      full_cycle_deals: mc.full_cycle_deals || null
    } : null,

    // SEC
    sec_cik: d.sec_cik || null,
    date_of_first_sale: d.date_of_first_sale,
    total_amount_sold: d.total_amount_sold,
    total_investors: d.total_investors,

    // Timestamps
    added_date: d.added_date,
    updated_at: d.updated_at
  };
}

function computeStaleness(d, now) {
  const added = d.added_date ? new Date(d.added_date) : null;
  const monthsSinceAdded = added ? (now - added) / (1000 * 60 * 60 * 24 * 30.44) : null;
  const status = (d.status || '').toLowerCase();

  if (status === 'closed' || status === 'fully funded' || status === 'completed') {
    return { isStale: true, reason: 'closed' };
  }
  if (status === 'evergreen') {
    return { isStale: false, reason: null };
  }
  const dealType = (d.deal_type || '').toLowerCase();
  const threshold = dealType === 'syndication' ? 18 : 24;
  if (monthsSinceAdded && monthsSinceAdded > threshold) {
    return { isStale: true, reason: 'added_' + Math.round(monthsSinceAdded) + '_months_ago' };
  }
  return { isStale: false, reason: null };
}
