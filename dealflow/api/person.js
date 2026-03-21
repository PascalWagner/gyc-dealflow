// Vercel Serverless Function: Fetch person profile + associated firms + deals
//
// Usage:
//   GET /api/person?name=Grant%20Cardone

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name } = req.query;

  if (!name) {
    return res.status(400).json({ error: 'Missing required parameter: name' });
  }

  try {
    const supabase = getAdminClient();

    // 1. Find all management companies where this person is CEO
    const { data: companies, error: mcError } = await supabase
      .from('management_companies')
      .select('*')
      .ilike('ceo', name);

    if (mcError) throw mcError;

    if (!companies || companies.length === 0) {
      return res.status(404).json({ error: 'Person not found' });
    }

    // 2. Get all deals from those companies
    const companyIds = companies.map(c => c.id);
    const { data: deals, error: dealsError } = await supabase
      .from('opportunities')
      .select('*')
      .in('management_company_id', companyIds)
      .order('added_date', { ascending: false });

    if (dealsError) throw dealsError;

    // 3. Build person profile from first match (primary)
    const primary = companies[0];

    // 4. Compute aggregate stats
    const numericValues = (arr) => arr.filter(v => v != null && !isNaN(v));
    const avg = (arr) => {
      const vals = numericValues(arr);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };
    const sum = (arr) => {
      const vals = numericValues(arr);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) : null;
    };

    const stats = {
      totalDeals: deals.length,
      totalFirms: companies.length,
      avgIRR: avg(deals.map(d => d.target_irr)),
      avgEquityMultiple: avg(deals.map(d => d.equity_multiple)),
      avgPrefReturn: avg(deals.map(d => d.preferred_return)),
      totalAUM: sum(deals.map(d => d.fund_aum)),
      avgMinInvestment: avg(deals.map(d => d.investment_minimum))
    };

    // 5. Transform companies
    const transformedCompanies = companies.map(c => ({
      id: c.id,
      name: c.operator_name,
      role: 'CEO',
      website: c.website,
      linkedinCeo: c.linkedin_ceo,
      foundingYear: c.founding_year,
      type: c.type,
      assetClasses: c.asset_classes || [],
      totalInvestors: c.total_investors,
      dealCount: deals.filter(d => d.management_company_id === c.id).length
    }));

    // 6. Transform deals
    const transformedDeals = deals.map(d => {
      const company = companies.find(c => c.id === d.management_company_id);
      return {
        id: d.id,
        name: d.investment_name,
        companyName: company ? company.operator_name : '',
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
      };
    });

    // 7. Return structured response
    return res.status(200).json({
      person: {
        name: primary.ceo,
        linkedIn: primary.linkedin_ceo,
        companies: transformedCompanies,
        deals: transformedDeals,
        stats
      }
    });

  } catch (err) {
    console.error('Error fetching person:', err);
    return res.status(500).json({ error: 'Failed to fetch person', message: err.message });
  }
}
