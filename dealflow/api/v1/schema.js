// Public API v1: GET /api/v1/schema
// Self-documenting schema — AI agents read this first to understand the API
// No authentication required (public documentation)

import { setApiCors } from './_auth.js';

export default function handler(req, res) {
  setApiCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200');

  return res.status(200).json({
    name: 'Grow Your Cashflow Deal Database API',
    version: 'v1',
    description: 'Structured database of real estate syndication and fund deals for accredited investors. Query deals, compare operators, and filter by investment criteria.',
    base_url: 'https://dealflow.growyourcashflow.io/api/v1',

    authentication: {
      method: 'API Key',
      header: 'X-API-Key',
      alternative: 'Query parameter: ?api_key=YOUR_KEY',
      format: 'gyc_k1_...',
      request_access: 'https://growyourcashflow.com/api-access'
    },

    rate_limits: {
      free: '30 requests/minute',
      pro: '120 requests/minute',
      enterprise: '600 requests/minute'
    },

    endpoints: {
      'GET /api/v1/deals': {
        description: 'Search and filter deals. Returns active, non-506(b) deals by default.',
        authentication: 'required',
        parameters: {
          asset_class: { type: 'string', description: 'Filter by asset class', enum: ['Multi Family', 'Industrial', 'Office', 'Retail', 'Lending', 'Hotels/Hospitality', 'Self Storage', 'RV/Mobile Home Parks', 'Car Wash', 'Short Term Rental', 'ATM', 'Life Insurance', 'Bitcoin Mining', 'Mixed Use', 'Build to Rent', 'Land', 'Medical', 'Data Center', 'Oil & Gas'] },
          strategy: { type: 'string', description: 'Investment strategy', enum: ['Value-Add', 'Core', 'Core-Plus', 'Opportunistic', 'Development', 'Distressed', 'Ground-Up'] },
          deal_type: { type: 'string', enum: ['Syndication', 'Fund'] },
          status: { type: 'string', enum: ['Active', 'Evergreen', 'Closed', 'Fully Funded', 'Completed'] },
          min_irr: { type: 'number', description: 'Minimum target IRR as decimal (0.15 = 15%)' },
          max_irr: { type: 'number', description: 'Maximum target IRR' },
          min_coc: { type: 'number', description: 'Minimum cash-on-cash yield as decimal' },
          min_pref: { type: 'number', description: 'Minimum preferred return as decimal' },
          max_minimum: { type: 'number', description: 'Maximum investment minimum in USD' },
          geography: { type: 'string', description: 'Investing geography (partial match)' },
          operator: { type: 'string', description: 'Operator/sponsor name (partial match)' },
          offering_type: { type: 'string', enum: ['506(c)', '506(b)', 'Regulation A', 'Regulation D'] },
          sort: { type: 'string', enum: ['newest', 'irr', 'coc', 'minimum'], default: 'newest' },
          limit: { type: 'integer', default: 50, max: 100 },
          offset: { type: 'integer', default: 0 },
          include_stale: { type: 'boolean', default: false, description: 'Include deals detected as stale/closed' }
        },
        response: {
          data: '[Deal]',
          pagination: '{ limit, offset, count, has_more }',
          meta: '{ api_version, fetched_at }'
        }
      },

      'GET /api/v1/deals/:id': {
        description: 'Get full detail for a single deal, including share classes and extended operator info.',
        authentication: 'required',
        parameters: {
          id: { type: 'uuid', required: true, description: 'Deal UUID' }
        }
      },

      'GET /api/v1/operators': {
        description: 'List and search operators/sponsors with deal counts.',
        authentication: 'required',
        parameters: {
          q: { type: 'string', description: 'Search by operator name' },
          type: { type: 'string', enum: ['Fund Manager', 'Syndicator', 'Developer', 'REIT'] },
          asset_class: { type: 'string', description: 'Filter by asset class' },
          sort: { type: 'string', enum: ['name', 'newest', 'aum'], default: 'name' },
          limit: { type: 'integer', default: 50, max: 100 },
          offset: { type: 'integer', default: 0 }
        }
      },

      'GET /api/v1/schema': {
        description: 'This endpoint. Returns API documentation as JSON.',
        authentication: 'none'
      }
    },

    deal_schema: {
      id: 'uuid',
      deal_number: 'integer',
      name: 'string — Deal/offering name',
      asset_class: 'string',
      deal_type: 'string — "Syndication" or "Fund"',
      status: 'string — "Active", "Evergreen", "Closed", etc.',
      target_irr: 'number|null — Decimal (0.18 = 18%)',
      equity_multiple: 'number|null',
      preferred_return: 'number|null — Decimal',
      cash_on_cash: 'number|null — Decimal',
      investment_minimum: 'number|null — USD',
      lp_gp_split: 'string|null — e.g. "80/20"',
      hold_period_years: 'number|null',
      sponsor_co_invest_pct: 'number|null — Decimal',
      fees: 'string[] — e.g. ["2% AUM", "20% Performance"]',
      offering_type: 'string|null — e.g. "506(c)"',
      offering_size: 'number|null — USD total raise',
      investment_strategy: 'string|null',
      strategy: 'string|null',
      instrument: 'string|null',
      distributions: 'string|null — e.g. "Quarterly"',
      financials: 'string|null — "audited" or "unaudited"',
      available_to: 'string|null',
      geography: 'string|null',
      location: 'string|null',
      property_address: 'string|null',
      operator: {
        id: 'uuid',
        name: 'string',
        ceo: 'string|null',
        website: 'string|null',
        founding_year: 'integer|null',
        type: 'string|null',
        asset_classes: 'string[]',
        headquarters: 'string|null'
      },
      share_classes: 'ShareClass[]|null — Only on detail endpoint',
      sec_cik: 'string|null — SEC Central Index Key',
      added_date: 'date',
      updated_at: 'timestamp',
      is_stale: 'boolean — Whether deal is likely no longer accepting capital',
      staleness_reason: 'string|null'
    },

    examples: {
      'Find multifamily value-add deals with 15%+ IRR': '/api/v1/deals?asset_class=Multi+Family&strategy=Value-Add&min_irr=0.15',
      'Find deals under $50k minimum': '/api/v1/deals?max_minimum=50000&sort=irr',
      'Search for lending/debt funds': '/api/v1/deals?asset_class=Lending&deal_type=Fund',
      'Find operators in self storage': '/api/v1/operators?asset_class=Self Storage'
    }
  });
}
