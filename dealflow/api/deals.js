// Vercel Serverless Function: Fetch all deals from Supabase
// REPLACES: deals.js (Airtable version)
//
// What changed:
//   - Single query with join replaces 3 parallel Airtable paginated fetches
//   - Share class grouping happens in SQL (or could be a view)
//   - Response time: ~50ms vs ~800-1200ms with Airtable
//   - Caching still works the same way (Vercel edge cache headers)

import { getAdminClient, setCors, rateLimit } from './_supabase.js';
import {
  applyDealVisibilityQuery,
  applyPublishedCatalogQuery,
  canViewerAccessDeal,
  canViewerAccessRestricted506bDeal,
  resolveDealViewerContext,
  supportsOpportunitySubmittedByEmail
} from './_deal-access.js';
import { transformDeals } from './member/deals/transform.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!rateLimit(req, res)) return;

  // Single-deal fetches skip CDN cache (need fresh data after uploads)
  const singleId = req.query?.id;
  if (singleId) {
    res.setHeader('Cache-Control', 'no-store');
  } else {
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  }

  try {
    const supabase = getAdminClient();
    const viewerContext = await resolveDealViewerContext(req, { supabase });
    const include506b = req.query?.include506b === 'true';
    const supportsSubmittedByEmail = viewerContext.email
      ? await supportsOpportunitySubmittedByEmail(supabase)
      : true;

    // Single-deal fetch shortcut: /api/deals?id=UUID
    if (singleId && /^[0-9a-f-]{36}$/i.test(singleId)) {
      let singleQuery = supabase
        .from('opportunities')
        .select(`*, management_company:management_companies (
          id, operator_name, ceo, website, linkedin_ceo, invest_clearly_profile,
          founding_year, type, asset_classes, total_investors, authorized_emails, booking_url,
          ir_contact_name, ir_contact_email, full_cycle_deals
        )`)
        .eq('id', singleId);
      singleQuery = applyDealVisibilityQuery(singleQuery, viewerContext);
      const { data: row, error: sErr } = await singleQuery.single();
      if (sErr || !row) return res.status(404).json({ error: 'Deal not found' });
      if (!canViewerAccessRestricted506bDeal(row, viewerContext, { include506b })) {
        return res.status(403).json({ error: 'This deal cannot be publicly accessed (506(b) restriction).' });
      }
      if (!canViewerAccessDeal(row, viewerContext)) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      // Fetch sponsors for this deal
      const { data: spRows } = await supabase
        .from('deal_sponsors')
        .select(`deal_id, role, is_primary, display_order,
          company:management_companies (id, operator_name, ceo, website, linkedin_ceo,
            invest_clearly_profile, founding_year, type, asset_classes, total_investors, booking_url, full_cycle_deals)`)
        .eq('deal_id', singleId)
        .order('display_order', { ascending: true });
      const sponsors = (spRows || []).filter(r => r.company).map(r => ({
        id: r.company.id, name: r.company.operator_name, ceo: r.company.ceo,
        role: r.role, isPrimary: r.is_primary, website: r.company.website || '',
        linkedin: r.company.linkedin_ceo || '', investClearly: r.company.invest_clearly_profile || '',
        foundingYear: r.company.founding_year, type: r.company.type || '',
        bookingUrl: r.company.booking_url || '', investmentCriteria: [], portfolioSnapshot: []
      }));

      // Fetch share classes
      let childQuery = supabase
        .from('opportunities')
        .select('id, parent_deal_id, share_class_label, investment_name, target_irr, preferred_return, investment_minimum, hold_period_years, lp_gp_split, cash_on_cash, financials')
        .eq('parent_deal_id', singleId);
      childQuery = applyDealVisibilityQuery(childQuery, viewerContext);
      const { data: children } = await childQuery;
      const deal = transformDeals([row], children || [], spRows || [])[0] || null;
      if (!deal) return res.status(404).json({ error: 'Deal not found' });
      return res.status(200).json({
        deal
      });
    }

    let baseQuery = supabase
        .from('opportunities')
        .select(`
          *,
          management_company:management_companies (
            id, operator_name, ceo, website, linkedin_ceo,
            invest_clearly_profile, founding_year, type, asset_classes,
            total_investors, authorized_emails, booking_url,
            ir_contact_name, ir_contact_email, full_cycle_deals
          )
        `)
        .is('parent_deal_id', null)
        .not('investment_name', 'eq', '')
        .order('added_date', { ascending: false });

    // Filter by management company if requested
    const mgmtCompanyId = req.query?.managementCompanyId;
    if (mgmtCompanyId && /^[0-9a-f-]{36}$/i.test(mgmtCompanyId)) {
      baseQuery = baseQuery.eq('management_company_id', mgmtCompanyId);
    }

    const parentQuery = applyPublishedCatalogQuery(baseQuery, viewerContext, { supportsSubmittedByEmail });

    const { data: parentDeals, error: parentError } = await parentQuery;
    if (parentError) throw parentError;

    const visibleParentDeals = (parentDeals || []).filter((deal) =>
      canViewerAccessRestricted506bDeal(deal, viewerContext, { include506b })
    );
    const parentIds = visibleParentDeals.map((deal) => deal.id).filter(Boolean);

    const [childResult, sponsorsResult] = parentIds.length
      ? await Promise.all([
          applyPublishedCatalogQuery(
            supabase
              .from('opportunities')
              .select(`
                id, parent_deal_id, share_class_label, investment_name, target_irr, preferred_return,
                investment_minimum, hold_period_years, lp_gp_split, cash_on_cash, financials, is_506b
              `)
              .in('parent_deal_id', parentIds)
              .order('created_at', { ascending: true })
          , viewerContext, { supportsSubmittedByEmail }),
          supabase
            .from('deal_sponsors')
            .select(`
              deal_id, role, is_primary, display_order,
              company:management_companies (
                id, operator_name, ceo, website, linkedin_ceo,
                invest_clearly_profile, founding_year, type,
                asset_classes, total_investors, booking_url
              )
            `)
            .in('deal_id', parentIds)
            .order('display_order', { ascending: true })
        ])
      : [{ data: [], error: null }, { data: [], error: null }];

    if (childResult.error) throw childResult.error;
    if (sponsorsResult.error) throw sponsorsResult.error;

    const visibleChildren = (childResult.data || []).filter((deal) =>
      canViewerAccessRestricted506bDeal(deal, viewerContext, { include506b })
    );
    const deals = transformDeals(visibleParentDeals, visibleChildren, sponsorsResult.data || []);

    const mcMap = {};
    for (const deal of visibleParentDeals) {
      const mc = deal.management_company;
      if (mc && mc.id && !mcMap[mc.id]) {
        mcMap[mc.id] = {
          id: mc.id,
          name: mc.operator_name,
          ceo: mc.ceo,
          website: mc.website,
          linkedin: mc.linkedin_ceo,
          foundingYear: mc.founding_year,
          assetClasses: mc.asset_classes || [],
          type: mc.type,
          investClearlyProfile: mc.invest_clearly_profile,
          totalInvestors: mc.total_investors,
          fullCycleDeals: mc.full_cycle_deals || 0,
          authorizedEmails: mc.authorized_emails || []
        };
      }
    }
    const managementCompanies = Object.values(mcMap);

    return res.status(200).json({
      deals,
      managementCompanies,
      people: [],  // People table can be dropped or migrated later if needed
      meta: {
        totalOpportunities: visibleParentDeals.length,
        totalCompanies: managementCompanies.length,
        totalPeople: 0,
        fetchedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Error fetching deals:', err);
    return res.status(500).json({ error: 'Failed to fetch deals', message: err.message });
  }
}
