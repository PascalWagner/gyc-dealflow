export const QUALITY_FIELDS = [
  { key: 'investment_name', label: 'Name' },
  { key: 'asset_class', label: 'Asset Class' },
  { key: 'deal_type', label: 'Deal Type' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'investment_strategy', label: 'Inv Strategy' },
  { key: 'target_irr', label: 'Target IRR' },
  { key: 'preferred_return', label: 'Pref Return' },
  { key: 'cash_on_cash', label: 'Cash on Cash' },
  { key: 'investment_minimum', label: 'Minimum' },
  { key: 'hold_period_years', label: 'Hold Period' },
  { key: 'offering_type', label: 'Offering Type' },
  { key: 'offering_size', label: 'Offering Size' },
  { key: 'distributions', label: 'Distributions' },
  { key: 'lp_gp_split', label: 'LP/GP Split' },
  { key: 'fees', label: 'Fees' },
  { key: 'financials', label: 'Financials' },
  { key: 'investing_geography', label: 'Geography' },
  { key: 'instrument', label: 'Instrument' },
  { key: 'deck_url', label: 'Deck' },
  { key: 'ppm_url', label: 'PPM' },
  { key: 'sec_cik', label: 'SEC Filing' },
  { key: 'management_company_id', label: 'Operator' },
  { key: 'purchase_price', label: 'Purchase Price' },
  { key: 'status', label: 'Status' }
];

export function computeQuality(deal) {
  const missing = [];
  let filled = 0;

  for (const field of QUALITY_FIELDS) {
    const value = deal[field.key];
    const isFilled =
      value !== null &&
      value !== undefined &&
      value !== '' &&
      value !== 0 &&
      !(Array.isArray(value) && value.length === 0);

    if (isFilled) filled += 1;
    else missing.push(field.label);
  }

  let pct = Math.round((filled / QUALITY_FIELDS.length) * 100);
  const hasDeck = !!deal.deck_url;
  const hasPPM = !!deal.ppm_url;
  const hasSEC = !!deal.sec_cik;
  if (pct === 100 && (!hasDeck || !hasPPM || !hasSEC)) pct = 99;

  return { pct, missing, hasDeck, hasPPM, hasSEC };
}

async function listDealsQuality(supabase, body) {
  const { search } = body;

  let query = supabase
    .from('opportunities')
    .select('*, management_company:management_companies(id, operator_name)')
    .is('parent_deal_id', null)
    .order('added_date', { ascending: false });

  if (search) {
    query = query.ilike('investment_name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []).map((deal) => {
    const quality = computeQuality(deal);
    return {
      id: deal.id,
      investment_name: deal.investment_name,
      asset_class: deal.asset_class,
      management_company_id: deal.management_company?.id || null,
      management_company_name: deal.management_company?.operator_name || '—',
      completeness_pct: quality.pct,
      missing_fields: quality.missing,
      has_deck: quality.hasDeck,
      has_ppm: quality.hasPPM,
      has_sec: quality.hasSEC,
      added_date: deal.added_date
    };
  });

  rows.sort((a, b) => b.completeness_pct - a.completeness_pct);

  const total = rows.length;
  const avgPct = total > 0 ? Math.round(rows.reduce((sum, row) => sum + row.completeness_pct, 0) / total) : 0;

  return {
    data: rows,
    total,
    stats: {
      total_deals: total,
      avg_completeness: avgPct,
      above_80: rows.filter((row) => row.completeness_pct >= 80).length,
      below_50: rows.filter((row) => row.completeness_pct < 50).length,
      no_deck: rows.filter((row) => !row.has_deck).length,
      no_ppm: rows.filter((row) => !row.has_ppm).length,
      no_sec: rows.filter((row) => !row.has_sec).length
    }
  };
}

const OPERATOR_QUALITY_FIELDS = [
  { key: 'operator_name', label: 'Name' },
  { key: 'ceo', label: 'CEO' },
  { key: 'website', label: 'Website' },
  { key: 'linkedin_ceo', label: 'LinkedIn' },
  { key: 'invest_clearly_profile', label: 'InvestClearly' },
  { key: 'founding_year', label: 'Founded' },
  { key: 'type', label: 'Type' },
  { key: 'asset_classes', label: 'Asset Classes' },
  { key: 'headquarters', label: 'HQ' },
  { key: 'aum', label: 'AUM' },
  { key: 'description', label: 'Description' }
];

function computeOperatorQuality(operator) {
  const missing = [];
  let filled = 0;

  for (const field of OPERATOR_QUALITY_FIELDS) {
    const value = operator[field.key];
    const isFilled =
      value !== null &&
      value !== undefined &&
      value !== '' &&
      value !== 0 &&
      !(Array.isArray(value) && value.length === 0);

    if (isFilled) filled += 1;
    else missing.push(field.label);
  }

  return {
    pct: Math.round((filled / OPERATOR_QUALITY_FIELDS.length) * 100),
    missing,
    hasWebsite: !!operator.website,
    hasLinkedIn: !!operator.linkedin_ceo
  };
}

async function listOperatorsQuality(supabase, body) {
  const { search } = body;

  let query = supabase
    .from('management_companies')
    .select('*')
    .order('operator_name', { ascending: true });

  if (search) {
    query = query.ilike('operator_name', `%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;

  const { data: dealCounts } = await supabase
    .from('opportunities')
    .select('management_company_id')
    .is('parent_deal_id', null);

  const countMap = {};
  for (const deal of dealCounts || []) {
    if (deal.management_company_id) {
      countMap[deal.management_company_id] = (countMap[deal.management_company_id] || 0) + 1;
    }
  }

  const rows = (data || []).map((operator) => {
    const quality = computeOperatorQuality(operator);
    return {
      id: operator.id,
      name: operator.operator_name || operator.name,
      type: operator.type || '—',
      deal_count: countMap[operator.id] || 0,
      completeness_pct: quality.pct,
      missing_fields: quality.missing,
      has_website: quality.hasWebsite,
      has_linkedin: quality.hasLinkedIn
    };
  });

  rows.sort((a, b) => b.completeness_pct - a.completeness_pct);

  const total = rows.length;
  const avgPct = total > 0 ? Math.round(rows.reduce((sum, row) => sum + row.completeness_pct, 0) / total) : 0;

  return {
    data: rows,
    total,
    stats: {
      total_operators: total,
      avg_completeness: avgPct,
      above_80: rows.filter((row) => row.completeness_pct >= 80).length,
      below_50: rows.filter((row) => row.completeness_pct < 50).length,
      no_website: rows.filter((row) => !row.has_website).length,
      no_linkedin: rows.filter((row) => !row.has_linkedin).length
    }
  };
}

export const qualityActions = {
  'list-deals-quality': listDealsQuality,
  'list-operators-quality': listOperatorsQuality
};
