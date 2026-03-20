// Vercel Serverless Function: Fetch sponsor (management company) profile + deals + stats
// REPLACES: Make.com webhook in sponsor.html
//
// Usage:
//   GET /api/sponsor?id=UUID
//   GET /api/sponsor?company=CompanyName

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, company } = req.query;

  if (!id && !company) {
    return res.status(400).json({ error: 'Missing required parameter: id or company' });
  }

  try {
    const supabase = getAdminClient();

    // 1. Fetch the management company
    let mcQuery = supabase.from('management_companies').select('*');

    if (id) {
      mcQuery = mcQuery.eq('id', id).single();
    } else {
      mcQuery = mcQuery.ilike('operator_name', company).single();
    }

    const { data: mc, error: mcError } = await mcQuery;

    if (mcError || !mc) {
      return res.status(404).json({ error: 'Sponsor not found' });
    }

    // 2. Fetch all deals for this management company
    const { data: deals, error: dealsError } = await supabase
      .from('opportunities')
      .select('*')
      .eq('management_company_id', mc.id)
      .order('added_date', { ascending: false });

    if (dealsError) throw dealsError;

    // 3. Compute aggregate stats
    const numericValues = (arr) => arr.filter(v => v != null && !isNaN(v));
    const avg = (arr) => {
      const vals = numericValues(arr);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const sum = (arr) => {
      const vals = numericValues(arr);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };

    const currentYear = new Date().getFullYear();
    const yearsInBusiness = mc.founding_year ? currentYear - mc.founding_year : null;

    const stats = {
      totalDeals: deals.length,
      avgIRR: avg(deals.map(d => d.target_irr)),
      avgEquityMultiple: avg(deals.map(d => d.equity_multiple)),
      avgPrefReturn: avg(deals.map(d => d.preferred_return)),
      totalAUM: sum(deals.map(d => d.fund_aum)),
      avgMinInvestment: avg(deals.map(d => d.investment_minimum))
    };

    // 4. Transform deals
    const transformedDeals = deals.map(d => ({
      id: d.id,
      name: d.investment_name,
      assetClass: d.asset_class,
      dealType: d.deal_type,
      targetIRR: d.target_irr,
      equityMultiple: d.equity_multiple,
      prefReturn: d.preferred_return,
      minInvestment: d.investment_minimum,
      holdPeriod: d.hold_period_years,
      status: d.status,
      strategy: d.strategy,
      addedDate: d.added_date,
      cashOnCash: d.cash_on_cash,
      distributions: d.distributions,
      fundAUM: d.fund_aum
    }));

    // 5. Return structured response
    return res.status(200).json({
      sponsor: {
        id: mc.id,
        name: mc.operator_name,
        ceo: mc.ceo,
        website: mc.website,
        linkedinCeo: mc.linkedin_ceo,
        foundingYear: mc.founding_year,
        type: mc.type,
        investClearlyUrl: mc.invest_clearly_profile,
        totalInvestors: mc.total_investors,
        assetClasses: mc.asset_classes || [],
        yearsInBusiness,
        totalAUM: stats.totalAUM,
        deals: transformedDeals,
        stats
      }
    });

  } catch (err) {
    console.error('Error fetching sponsor:', err);
    return res.status(500).json({ error: 'Failed to fetch sponsor', message: err.message });
  }
}
