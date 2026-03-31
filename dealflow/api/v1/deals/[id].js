// Public API v1: GET /api/v1/deals/:id
// Fetch a single deal by UUID with full detail including share classes

import { getAdminClient } from '../../_supabase.js';
import { verifyApiKey, logRequest, setApiCors, apiError } from '../_auth.js';
import { formatPublicDeal } from '../deals/shared.js';

export default async function handler(req, res) {
  setApiCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return apiError(res, 405, 'Method not allowed');

  const startTime = Date.now();
  const { id } = req.query;

  if (!id || !/^[0-9a-f-]{36}$/.test(id)) {
    return apiError(res, 400, 'Invalid deal ID. Must be a UUID.');
  }

  const auth = await verifyApiKey(req);
  if (!auth.authorized) {
    if (auth.status === 429) res.setHeader('Retry-After', auth.retryAfter);
    logRequest(null, req, auth.status || 401, startTime);
    return apiError(res, auth.status || 401, auth.error);
  }

  try {
    const supabase = getAdminClient();

    const { data: deal, error } = await supabase
      .from('opportunities')
      .select(`
        *,
        management_company:management_companies (
          id, operator_name, ceo, website, linkedin_ceo, invest_clearly_profile,
          founding_year, type, asset_classes, total_investors, headquarters,
          aum, description, booking_url, full_cycle_deals
        )
      `)
      .eq('is_visible_to_users', true)
      .eq('id', id)
      .single();

    if (error || !deal) {
      logRequest(auth.keyRecord, req, 404, startTime);
      return apiError(res, 404, 'Deal not found');
    }

    // Block 506(b) from public API
    if (deal.is_506b) {
      logRequest(auth.keyRecord, req, 403, startTime);
      return apiError(res, 403, 'This deal cannot be publicly accessed (506(b) restriction).');
    }

    // Fetch share classes if this is a parent deal
    let shareClasses = null;
    const { data: children } = await supabase
      .from('opportunities')
      .select('id, share_class_label, investment_name, target_irr, preferred_return, investment_minimum, hold_period_years, lp_gp_split, cash_on_cash, financials')
      .eq('is_visible_to_users', true)
      .eq('parent_deal_id', id);

    if (children && children.length > 0) {
      shareClasses = children.map(c => ({
        id: c.id,
        label: c.share_class_label || c.investment_name,
        target_irr: c.target_irr,
        preferred_return: c.preferred_return,
        investment_minimum: c.investment_minimum,
        hold_period_years: c.hold_period_years,
        lp_gp_split: c.lp_gp_split,
        cash_on_cash: c.cash_on_cash,
        financials: c.financials
      }));
    }

    const result = formatPublicDeal(deal, { shareClasses });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
    logRequest(auth.keyRecord, req, 200, startTime);

    return res.status(200).json({
      data: result,
      meta: {
        api_version: 'v1',
        fetched_at: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('API v1 deal detail error:', err);
    logRequest(auth.keyRecord, req, 500, startTime);
    return apiError(res, 500, 'Internal server error');
  }
}
