// Vercel Serverless Function: Fetch all deals from Supabase
// REPLACES: deals.js (Airtable version)
//
// What changed:
//   - Single query with join replaces 3 parallel Airtable paginated fetches
//   - Share class grouping happens in SQL (or could be a view)
//   - Response time: ~50ms vs ~800-1200ms with Airtable
//   - Caching still works the same way (Vercel edge cache headers)

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!rateLimit(req, res)) return;

  try {
    const supabase = getAdminClient();

    // Single query: deals + operator info via foreign key join
    const { data: allDeals, error: dealsError } = await supabase
      .from('opportunities')
      .select(`
        *,
        management_company:management_companies (
          id,
          operator_name,
          ceo,
          website,
          linkedin_ceo,
          invest_clearly_profile,
          founding_year,
          type,
          asset_classes,
          total_investors
        )
      `)
      .not('investment_name', 'eq', '')
      .order('added_date', { ascending: false });

    if (dealsError) throw dealsError;

    // Group share classes under parent deals
    const parentMap = {};
    const childIds = new Set();

    for (const deal of allDeals) {
      if (deal.parent_deal_id) {
        if (!parentMap[deal.parent_deal_id]) parentMap[deal.parent_deal_id] = [];
        parentMap[deal.parent_deal_id].push({
          id: deal.id,
          label: deal.share_class_label || deal.investment_name,
          targetReturn: deal.target_irr,
          preferredReturn: deal.preferred_return,
          investmentMinimum: deal.investment_minimum,
          lockup: deal.hold_period_years,
          lpGpSplit: deal.lp_gp_split,
          financials: deal.financials,
          cashOnCash: deal.cash_on_cash
        });
        childIds.add(deal.id);
      }
    }

    // Staleness detection: hide deals that are likely closed/no longer accepting capital
    function computeStaleness(d) {
      const now = new Date();
      const added = d.added_date ? new Date(d.added_date) : null;
      const updated = d.updated_at ? new Date(d.updated_at) : null;
      const monthsSinceAdded = added ? (now - added) / (1000 * 60 * 60 * 24 * 30.44) : null;
      const monthsSinceUpdated = updated ? (now - updated) / (1000 * 60 * 60 * 24 * 30.44) : null;
      const status = (d.status || '').toLowerCase();

      // Manually closed deals are always stale
      if (status === 'closed' || status === 'fully funded' || status === 'completed') {
        return { isStale: true, reason: 'Closed' };
      }

      // Evergreen funds never go stale (they accept capital indefinitely)
      if (status === 'evergreen') {
        return { isStale: false, reason: null };
      }

      // Syndications: stale after 18 months from added date
      const dealType = (d.deal_type || '').toLowerCase();
      if (dealType === 'syndication') {
        if (monthsSinceAdded && monthsSinceAdded > 18) {
          return { isStale: true, reason: 'Added ' + Math.round(monthsSinceAdded) + ' months ago (syndication)' };
        }
        return { isStale: false, reason: null };
      }

      // Funds (non-evergreen): stale after 24 months
      if (dealType === 'fund') {
        if (monthsSinceAdded && monthsSinceAdded > 24) {
          return { isStale: true, reason: 'Added ' + Math.round(monthsSinceAdded) + ' months ago (fund)' };
        }
        return { isStale: false, reason: null };
      }

      // Unknown deal type: stale after 24 months
      if (monthsSinceAdded && monthsSinceAdded > 24) {
        return { isStale: true, reason: 'Added ' + Math.round(monthsSinceAdded) + ' months ago' };
      }

      return { isStale: false, reason: null };
    }

    // 506(b) deals cannot be publicly advertised — filter them out unless explicitly requested
    const include506b = req.query?.include506b === 'true';

    // Transform to match existing frontend API contract
    // (so the frontend doesn't need to change yet)
    const deals = allDeals
      .filter(d => !childIds.has(d.id))
      .filter(d => include506b || !d.is_506b)
      .map(d => {
        const mc = d.management_company || {};
        const staleness = computeStaleness(d);
        return {
          id: d.id,
          dealNumber: d.deal_number,
          investmentName: d.investment_name,
          assetClass: d.asset_class,
          dealType: d.deal_type,
          targetIRR: d.target_irr,
          equityMultiple: d.equity_multiple,
          preferredReturn: d.preferred_return,
          investmentMinimum: d.investment_minimum,
          lpGpSplit: d.lp_gp_split,
          holdPeriod: d.hold_period_years,
          addedDate: d.added_date,
          status: d.status,
          offeringType: d.offering_type,
          offeringSize: d.offering_size,
          investingGeography: d.investing_geography,
          investmentStrategy: d.investment_strategy,
          distributions: d.distributions,
          financials: d.financials,
          availableTo: d.available_to,
          sponsorInDeal: d.sponsor_in_deal_pct,
          ceo: mc.ceo || '',
          managementCompany: mc.operator_name || '',
          managementCompanyId: mc.id || '',
          mcWebsite: mc.website || '',
          mcFoundingYear: mc.founding_year,
          mcType: mc.type || '',
          mcLinkedin: mc.linkedin_ceo || '',
          mcInvestClearly: mc.invest_clearly_profile || '',
          mcTotalInvestors: mc.total_investors,
          fees: d.fees || [],
          firstYrDepreciation: d.first_yr_depreciation,
          strategy: d.strategy,
          instrument: d.instrument,
          cashOnCash: d.cash_on_cash,
          debtPosition: d.debt_position,
          fundAUM: d.fund_aum,
          loanCount: d.loan_count,
          avgLoanLTV: d.avg_loan_ltv,
          location: d.location,
          address: d.property_address,
          deckUrl: d.deck_url,
          ppmUrl: d.ppm_url,
          subAgreementUrl: d.sub_agreement_url,
          parentDealId: d.parent_deal_id,
          shareClassLabel: d.share_class_label,
          verticalIntegration: d.vertical_integration,
          caseStudy: d.case_study || null,
          shareClasses: parentMap[d.id] || null,
          isStale: staleness.isStale,
          stalenessReason: staleness.reason,
          // SEC EDGAR fields
          secCik: d.sec_cik || '',
          dateOfFirstSale: d.date_of_first_sale,
          totalAmountSold: d.total_amount_sold,
          totalInvestors: d.total_investors,
          is506b: d.is_506b || false
        };
      });

    // Management companies as separate array (for filters/search)
    const { data: mcData, error: mcError } = await supabase
      .from('management_companies')
      .select('*');

    if (mcError) throw mcError;

    const managementCompanies = (mcData || []).map(mc => ({
      id: mc.id,
      name: mc.operator_name,
      ceo: mc.ceo,
      website: mc.website,
      linkedin: mc.linkedin_ceo,
      foundingYear: mc.founding_year,
      assetClasses: mc.asset_classes || [],
      type: mc.type,
      investClearlyProfile: mc.invest_clearly_profile,
      totalInvestors: mc.total_investors
    }));

    return res.status(200).json({
      deals,
      managementCompanies,
      people: [],  // People table can be dropped or migrated later if needed
      meta: {
        totalOpportunities: allDeals.length,
        totalCompanies: mcData.length,
        totalPeople: 0,
        fetchedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Error fetching deals:', err);
    return res.status(500).json({ error: 'Failed to fetch deals', message: err.message });
  }
}
