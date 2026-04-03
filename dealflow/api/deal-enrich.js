// Vercel Serverless Function: /api/deal-enrich
// AI-assisted deal enrichment: accepts PPM text and uses Claude to extract structured deal fields
// Returns pre-filled deal record for human review
//
// MIGRATED: Now writes to Supabase instead of Airtable

import { getAdminClient, setCors } from './_supabase.js';

const EXTRACTION_TEXT_LIMIT = 120000;

const EXTRACTION_PROMPT = `You are a real estate private placement analyst. Extract the following fields from this PPM/offering document text. Return ONLY valid JSON with these exact keys. Use null for any field you cannot find.

{
  "investmentName": "Full name of the fund or investment",
  "managementCompany": "Name of the sponsor / management company",
  "ceo": "CEO or Managing Partner name",
  "assetClass": "One of: Lending, Multi Family, Self Storage, Industrial, Hotels/Hospitality, RV/Mobile Home Parks, Short Term Rental, Mixed Use, Office, Retail, Oil & Gas, Other",
  "dealType": "One of: Fund, Syndication, Direct, REIT",
  "strategy": "One of: Core, Core-Plus, Value-Add, Opportunistic, Development, Lending, Distressed",
  "investmentStrategy": "2-3 sentence LP-facing summary of the investment strategy",
  "targetIRR": "Target IRR as decimal (e.g. 0.15 for 15%)",
  "preferredReturn": "Preferred return as decimal (e.g. 0.08 for 8%)",
  "cashOnCash": "Cash on cash return as decimal if mentioned",
  "equityMultiple": "Target equity multiple (e.g. 2.0)",
  "investmentMinimum": "Minimum investment in dollars (number only)",
  "holdPeriod": "Hold period / lockup in years (number only)",
  "offeringSize": "Total offering size / equity raise in dollars (number only)",
  "purchasePrice": "Actual property purchase price from Sources & Uses table (number only). This is the total acquisition cost of the property, NOT the equity raise",
  "offeringType": "506(b) or 506(c)",
  "availableTo": "Accredited Investors, Qualified Purchasers, etc.",
  "distributions": "Monthly, Quarterly, Annual, or None",
  "lpGpSplit": "LP/GP profit split ONLY in the format 'XX/XX' (e.g. '80/20', '70/30'). Must be two numbers separated by a slash. If the deal uses a fee-only structure (e.g. management fee, asset fee) with no profit split, return null.",
  "fees": "Full fee structure description",
  "financials": "Audited or Unaudited",
  "investingGeography": "Geographic focus",
  "instrument": "Debt, Equity, Preferred Equity, or Hybrid",
  "debtPosition": "Senior, Mezzanine, Bridge, etc. (if lending/debt)",
  "fundAUM": "Current AUM in dollars if mentioned",
  "redemption": "Redemption terms if mentioned",
  "sponsorCoinvest": "GP co-investment percentage or amount if mentioned",
  "taxForm": "K-1, 1099, etc.",
  "secEntityName": "The exact legal entity name of the issuer as it appears on the PPM cover page (e.g. 'NCG Burgundy Investors LLC'). This is the entity filed with the SEC, not the marketing name.",
  "issuerEntity": "The exact legal issuer entity being offered to the investor. Prefer the Company or issuer defined in the PPM opening paragraphs.",
  "gpEntity": "General partner or governing legal entity if explicitly named.",
  "sponsorEntity": "Sponsor, manager, or operating entity legal name if explicitly named.",
  "servicingAgentEntity": "Servicing or loan-origination legal entity if explicitly named.",
  "issuerEntityType": "Issuer entity type exactly as stated.",
  "issuerJurisdiction": "Issuer jurisdiction / state of formation exactly as stated.",
  "issuerAddress": "Issuer mailing or business address exactly as stated.",
  "issuerPhone": "Issuer phone number exactly as stated.",
  "propertyAddress": "Full street address of the property if a single-asset deal",
  "unitCount": "Number of units (apartments, storage units, etc.)",
  "yearBuilt": "Year the property was built",
  "squareFootage": "Total square footage",
  "occupancyPct": "Current occupancy as decimal (0.92 = 92%)",
  "propertyType": "Garden Style, Mid-Rise, High-Rise, Townhome, etc.",
  "acquisitionLoan": "Senior debt / acquisition loan amount (number only)",
  "loanToValue": "Loan-to-value ratio as decimal (0.75 = 75%)",
  "loanRate": "Interest rate on acquisition loan as decimal",
  "loanTermYears": "Loan term in years",
  "loanIOYears": "Interest-only period in years",
  "capexBudget": "Capital expenditure / renovation budget in dollars",
  "closingCosts": "Closing costs in dollars",
  "acquisitionFeePct": "One-time acquisition fee as decimal (0.02 = 2%)",
  "assetMgmtFeePct": "Annual asset management fee as decimal",
  "propertyMgmtFeePct": "Property management fee as decimal",
  "capitalEventFeePct": "Capital event / disposition fee as decimal",
  "dispositionFeePct": "Disposition fee as decimal (if separate from capital event fee)",
  "constructionMgmtFeePct": "Construction management fee as decimal",
  "waterfallDetails": "Array of waterfall tiers, e.g. [{\"tier\": \"First\", \"threshold\": \"8% pref\", \"split\": \"100/0 LP/GP\"}, {\"tier\": \"Second\", \"threshold\": \"above 8%\", \"split\": \"80/20 LP/GP\"}]"
}

IMPORTANT:
- For percentages, convert to decimals (15% → 0.15)
- For dollar amounts, return raw numbers (no $ or commas)
- If a field clearly doesn't apply to this deal type, use null
- Be precise — only extract what's explicitly stated, don't infer
- For the waterfall, return a JSON array of tier objects with "tier", "threshold", and "split" keys
- purchasePrice is the PROPERTY acquisition cost from Sources & Uses, NOT the equity raise (offeringSize)
- For fees, extract BOTH the "fees" field (full text description) AND the individual fee percentage fields
- For secEntityName and issuerEntity, return the exact legal issuer name rather than the marketing name`;

// Map Claude extraction keys → Supabase column names
const SUPABASE_FIELD_MAP = {
  investmentName:      'investment_name',
  assetClass:          'asset_class',
  dealType:            'deal_type',
  strategy:            'strategy',
  investmentStrategy:  'investment_strategy',
  targetIRR:           'target_irr',
  preferredReturn:     'preferred_return',
  cashOnCash:          'cash_on_cash',
  equityMultiple:      'equity_multiple',
  investmentMinimum:   'investment_minimum',
  holdPeriod:          'hold_period_years',
  offeringSize:        'offering_size',
  purchasePrice:       'purchase_price',
  offeringType:        'offering_type',
  availableTo:         'available_to',
  distributions:       'distributions',
  lpGpSplit:           'lp_gp_split',
  fees:                'fees',
  financials:          'financials',
  investingGeography:  'investing_geography',
  instrument:          'instrument',
  debtPosition:        'debt_position',
  fundAUM:             'fund_aum',
  totalLoansUnderMgmt: 'total_loans_under_mgmt',
  equityCommitments:   'equity_commitments',
  avgLoanLTC:          'avg_loan_ltc',
  performanceFeePct:   'performance_fee_pct',
  inceptionDate:       'inception_date',
  fundTerm:            'fund_term',
  sponsorCoinvest:     'sponsor_in_deal_pct',
  propertyAddress:        'property_address',
  unitCount:              'unit_count',
  yearBuilt:              'year_built',
  squareFootage:          'square_footage',
  occupancyPct:           'occupancy_pct',
  propertyType:           'property_type',
  acquisitionLoan:        'acquisition_loan',
  loanToValue:            'loan_to_value',
  loanRate:               'loan_rate',
  loanTermYears:          'loan_term_years',
  loanIOYears:            'loan_io_years',
  capexBudget:            'capex_budget',
  closingCosts:           'closing_costs',
  acquisitionFeePct:      'acquisition_fee_pct',
  assetMgmtFeePct:        'asset_mgmt_fee_pct',
  propertyMgmtFeePct:     'property_mgmt_fee_pct',
  capitalEventFeePct:     'capital_event_fee_pct',
  dispositionFeePct:      'disposition_fee_pct',
  constructionMgmtFeePct: 'construction_mgmt_fee_pct',
  waterfallDetails:       'waterfall_details',
  secEntityName:          'sec_entity_name',
  issuerEntity:           'issuer_entity',
  gpEntity:               'gp_entity',
  sponsorEntity:          'sponsor_entity',
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { ppmText, dealId, userEmail } = req.body || {};
  if (!ppmText || ppmText.length < 100) {
    return res.status(400).json({ error: 'ppmText is required (minimum 100 characters)' });
  }

  // Truncate to ~50K chars to stay within context limits
  const truncated = ppmText.substring(0, EXTRACTION_TEXT_LIMIT);

  try {
    // Call Claude API for extraction
    const claudeResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: EXTRACTION_PROMPT + '\n\nDOCUMENT TEXT:\n' + truncated
        }]
      })
    });

    if (!claudeResp.ok) {
      const errText = await claudeResp.text();
      throw new Error('Claude API error: ' + claudeResp.status + ' ' + errText);
    }

    const claudeData = await claudeResp.json();
    const responseText = claudeData.content?.[0]?.text || '';

    // Extract JSON from response (handle markdown code blocks)
    let extracted;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error('No JSON found in response');
      extracted = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      return res.status(422).json({
        error: 'Failed to parse extraction results',
        rawResponse: responseText.substring(0, 500)
      });
    }

    // If dealId provided, save to Supabase (only update empty fields)
    if (dealId) {
      try {
        const supabase = getAdminClient();

        // Build Supabase update from extracted fields
        const supabaseUpdate = {};
        const fieldsFound = [];

        for (const [jsonKey, dbCol] of Object.entries(SUPABASE_FIELD_MAP)) {
          const val = extracted[jsonKey];
          if (val !== null && val !== undefined) {
            if (dbCol === 'fees' && typeof val === 'string') {
              supabaseUpdate[dbCol] = [val];
            } else {
              supabaseUpdate[dbCol] = val;
            }
            fieldsFound.push(dbCol);
          }
        }

        if (fieldsFound.length > 0) {
          // Fetch current record to avoid overwriting human edits
          const { data: currentDeal } = await supabase
            .from('opportunities')
            .select('*')
            .eq('id', dealId)
            .single();

          const safeUpdate = {};
          for (const [col, val] of Object.entries(supabaseUpdate)) {
            const current = currentDeal?.[col];
            const isEmpty = current === null
              || current === undefined
              || current === ''
              || current === 0
              || (Array.isArray(current) && current.length === 0);

            if (isEmpty) {
              safeUpdate[col] = val;
            }
          }

          if (Object.keys(safeUpdate).length > 0) {
            safeUpdate.updated_at = new Date().toISOString();

            const { error: updateErr } = await supabase
              .from('opportunities')
              .update(safeUpdate)
              .eq('id', dealId);

            if (updateErr) {
              console.warn('Supabase enrichment update failed:', updateErr.message);
            }
          }
        }
      } catch (e) {
        console.warn('Enrichment save error:', e.message);
      }
    }

    // Trigger background check if we have a management company + CEO
    let bgCheckResult = null;
    if (extracted.managementCompany || extracted.ceo) {
      try {
        const bgPersonName = extracted.ceo || extracted.managementCompany;
        const bgCompanyName = extracted.managementCompany || '';

        // Find management company ID if we have a dealId
        let mcId = null;
        if (dealId) {
          const supabase = getAdminClient();
          const { data: deal } = await supabase.from('opportunities').select('management_company_id').eq('id', dealId).single();
          mcId = deal?.management_company_id || null;
        }

        // Call the background check API internally
        const bgUrl = `https://${req.headers.host}/api/background-check`;
        const bgResp = await fetch(bgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'enrich',
            personName: bgPersonName,
            companyName: bgCompanyName,
            managementCompanyId: mcId
          })
        });
        if (bgResp.ok) {
          bgCheckResult = await bgResp.json();
        }
      } catch (bgErr) {
        console.warn('Background check during enrichment failed (non-fatal):', bgErr.message);
      }
    }

    return res.status(200).json({
      success: true,
      extracted,
      fieldsFound: Object.keys(extracted).filter(k => extracted[k] !== null).length,
      totalFields: Object.keys(extracted).length,
      inputLength: truncated.length,
      model: 'claude-sonnet-4-20250514',
      backgroundCheck: bgCheckResult ? { status: bgCheckResult.result?.overall_status || 'completed' } : null
    });

  } catch (err) {
    console.error('Deal enrichment error:', err);
    return res.status(500).json({ error: 'Enrichment failed: ' + err.message });
  }
}
