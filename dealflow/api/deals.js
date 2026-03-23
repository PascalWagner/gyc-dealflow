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

    // Single-deal fetch shortcut: /api/deals?id=UUID
    if (singleId && /^[0-9a-f-]{36}$/i.test(singleId)) {
      const { data: row, error: sErr } = await supabase
        .from('opportunities')
        .select(`*, management_company:management_companies (
          id, operator_name, ceo, website, linkedin_ceo, invest_clearly_profile,
          founding_year, type, asset_classes, total_investors, authorized_emails, booking_url,
          ir_contact_name, ir_contact_email, full_cycle_deals
        )`)
        .eq('id', singleId)
        .single();
      if (sErr || !row) return res.status(404).json({ error: 'Deal not found' });

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
      const { data: children } = await supabase
        .from('opportunities')
        .select('id, share_class_label, investment_name, target_irr, preferred_return, investment_minimum, hold_period_years, lp_gp_split, cash_on_cash, financials')
        .eq('parent_deal_id', singleId);
      const shareClasses = (children && children.length > 0)
        ? children.map(c => ({ id: c.id, label: c.share_class_label || c.investment_name, targetReturn: c.target_irr, preferredReturn: c.preferred_return, investmentMinimum: c.investment_minimum, lockup: c.hold_period_years, lpGpSplit: c.lp_gp_split, financials: c.financials, cashOnCash: c.cash_on_cash }))
        : null;

      const mc = row.management_company || {};
      const deal = {
        id: row.id, dealNumber: row.deal_number, investmentName: row.investment_name,
        assetClass: row.asset_class, dealType: row.deal_type, targetIRR: row.target_irr,
        equityMultiple: row.equity_multiple, preferredReturn: row.preferred_return,
        investmentMinimum: row.investment_minimum, lpGpSplit: row.lp_gp_split,
        holdPeriod: row.hold_period_years, addedDate: row.added_date, status: row.status,
        offeringType: row.offering_type, offeringSize: row.offering_size,
        purchasePrice: row.purchase_price, investingGeography: row.investing_geography,
        investmentStrategy: row.investment_strategy, distributions: row.distributions,
        financials: row.financials, availableTo: row.available_to,
        sponsorInDeal: row.sponsor_in_deal_pct, ceo: mc.ceo || '',
        managementCompany: mc.operator_name || '', managementCompanyId: mc.id || '',
        mcWebsite: mc.website || '', mcFoundingYear: mc.founding_year, mcType: mc.type || '',
        mcLinkedin: mc.linkedin_ceo || '', mcInvestClearly: mc.invest_clearly_profile || '',
        mcTotalInvestors: mc.total_investors, mcBookingUrl: mc.booking_url || '',
        mcAuthorizedEmails: mc.authorized_emails || [],
        mcIrContactName: mc.ir_contact_name || '', mcIrContactEmail: mc.ir_contact_email || '',
        mcFullCycleDeals: mc.full_cycle_deals || null,
        fees: row.fees || [], firstYrDepreciation: row.first_yr_depreciation,
        strategy: row.strategy, instrument: row.instrument, cashOnCash: row.cash_on_cash,
        debtPosition: row.debt_position, fundAUM: row.fund_aum, loanCount: row.loan_count,
        avgLoanLTV: row.avg_loan_ltv, location: row.location, address: row.property_address,
        deckUrl: row.deck_url, ppmUrl: row.ppm_url, subAgreementUrl: row.sub_agreement_url,
        parentDealId: row.parent_deal_id, shareClassLabel: row.share_class_label,
        verticalIntegration: row.vertical_integration, caseStudy: row.case_study || null,
        shareClasses, is506b: row.is_506b || false, issuerEntity: row.issuer_entity || '',
        gpEntity: row.gp_entity || '', sponsorEntity: row.sponsor_entity || '',
        sponsors, unitCount: row.unit_count, yearBuilt: row.year_built,
        squareFootage: row.square_footage, occupancyPct: row.occupancy_pct,
        propertyType: row.property_type, secCik: row.sec_cik || '',
        secEntityName: row.sec_entity_name || '',
        dateOfFirstSale: row.date_of_first_sale, totalAmountSold: row.total_amount_sold,
        totalInvestors: row.total_investors,
        pctFunded: (row.total_amount_sold && row.offering_size && row.offering_size > 0)
          ? Math.round(row.total_amount_sold / row.offering_size * 100) : null,
        acquisitionLoan: row.acquisition_loan, loanToValue: row.loan_to_value,
        loanRate: row.loan_rate, loanTermYears: row.loan_term_years,
        loanIOYears: row.loan_io_years, capexBudget: row.capex_budget,
        closingCosts: row.closing_costs, acquisitionFeePct: row.acquisition_fee_pct,
        assetMgmtFeePct: row.asset_mgmt_fee_pct, propertyMgmtFeePct: row.property_mgmt_fee_pct,
        capitalEventFeePct: row.capital_event_fee_pct, dispositionFeePct: row.disposition_fee_pct,
        constructionMgmtFeePct: row.construction_mgmt_fee_pct,
        waterfallDetails: row.waterfall_details
      };
      return res.status(200).json({ deal });
    }

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
          total_investors,
          authorized_emails,
          booking_url,
          ir_contact_name,
          ir_contact_email,
          full_cycle_deals
        )
      `)
      .not('investment_name', 'eq', '')
      .order('added_date', { ascending: false });

    if (dealsError) throw dealsError;

    // Fetch deal sponsors (multi-sponsor support)
    const { data: sponsorRows } = await supabase
      .from('deal_sponsors')
      .select(`
        deal_id, role, is_primary, display_order,
        company:management_companies (
          id, operator_name, ceo, website, linkedin_ceo,
          invest_clearly_profile, founding_year, type,
          asset_classes, total_investors, booking_url
        )
      `)
      .order('display_order', { ascending: true });

    // Build lookup: deal_id → sponsors[]
    const sponsorsByDeal = {};
    for (const row of (sponsorRows || [])) {
      if (!row.company) continue;
      if (!sponsorsByDeal[row.deal_id]) sponsorsByDeal[row.deal_id] = [];
      sponsorsByDeal[row.deal_id].push({
        id: row.company.id,
        name: row.company.operator_name,
        ceo: row.company.ceo,
        role: row.role,
        isPrimary: row.is_primary,
        website: row.company.website || '',
        linkedin: row.company.linkedin_ceo || '',
        investClearly: row.company.invest_clearly_profile || '',
        foundingYear: row.company.founding_year,
        type: row.company.type || '',
        bookingUrl: row.company.booking_url || '',
        investmentCriteria: [],
        portfolioSnapshot: []
      });
    }

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
          purchasePrice: d.purchase_price,
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
          mcBookingUrl: mc.booking_url || '',
          mcAuthorizedEmails: mc.authorized_emails || [],
          mcIrContactName: mc.ir_contact_name || '',
          mcIrContactEmail: mc.ir_contact_email || '',
          mcFullCycleDeals: mc.full_cycle_deals || null,
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
          // Property details
          unitCount: d.unit_count,
          yearBuilt: d.year_built,
          squareFootage: d.square_footage,
          occupancyPct: d.occupancy_pct,
          propertyType: d.property_type,
          // Sources & Uses / Loan
          acquisitionLoan: d.acquisition_loan,
          loanToValue: d.loan_to_value,
          loanRate: d.loan_rate,
          loanTermYears: d.loan_term_years,
          loanIOYears: d.loan_io_years,
          capexBudget: d.capex_budget,
          closingCosts: d.closing_costs,
          // Fee structure
          acquisitionFeePct: d.acquisition_fee_pct,
          assetMgmtFeePct: d.asset_mgmt_fee_pct,
          propertyMgmtFeePct: d.property_mgmt_fee_pct,
          capitalEventFeePct: d.capital_event_fee_pct,
          dispositionFeePct: d.disposition_fee_pct,
          constructionMgmtFeePct: d.construction_mgmt_fee_pct,
          waterfallDetails: d.waterfall_details,
          // SEC EDGAR fields
          secCik: d.sec_cik || '',
          secEntityName: d.sec_entity_name || '',
          dateOfFirstSale: d.date_of_first_sale,
          totalAmountSold: d.total_amount_sold,
          totalInvestors: d.total_investors,
          pctFunded: (d.total_amount_sold && d.offering_size && d.offering_size > 0)
            ? Math.round(d.total_amount_sold / d.offering_size * 100)
            : null,
          is506b: d.is_506b || false,
          issuerEntity: d.issuer_entity || '',
          gpEntity: d.gp_entity || '',
          sponsorEntity: d.sponsor_entity || '',
          sponsors: sponsorsByDeal[d.id] || []
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
      totalInvestors: mc.total_investors,
      authorizedEmails: mc.authorized_emails || []
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
