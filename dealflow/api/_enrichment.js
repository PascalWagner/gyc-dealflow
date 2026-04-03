// Shared Enrichment Pipeline
// Used by both deck-upload.js and portfolio-extract.js
// The PPM is always the source of truth for deal data.
//
// Pipeline: AI extraction → SEC EDGAR → RentCast → Census/BLS → Background Check
// All enrichment phases (2-5) run in parallel after AI extraction completes.

const SITE_URL = process.env.SITE_URL || 'https://deals.growyourcashflow.io';
const EXTRACTION_TEXT_LIMIT = 120000;

// ── Full enrichment prompt (PPM is source of truth) ──────────────────────────
export const ENRICHMENT_PROMPT = `You are a real estate private placement analyst. Extract the following fields from this PPM, offering memorandum, subscription agreement, or pitch deck. Return ONLY valid JSON with these exact keys. Use null for any field you cannot find.

If this is a PPM or subscription agreement, prioritize the INVESTOR'S specific details (signed amount, entity, date) and fall back to the fund's general terms.

{
  "investmentName": "Full name of the fund or investment offering",
  "managementCompany": "Name of the sponsor / management company / GP",
  "ceo": "CEO, Managing Partner, or Fund Manager name",
  "assetClass": "One of: Multi Family, Self Storage, Industrial, Lending, Short Term Rental, Hotels/Hospitality, Mixed-Use, RV/Mobile Home Parks, Business / Other, Land, Senior Living, Car Wash, ATM, Oil & Gas, Other",
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
  "lpGpSplit": "e.g. 80/20",
  "fees": "Full fee structure description",
  "financials": "Audited or Unaudited",
  "investingGeography": "Geographic focus",
  "instrument": "Debt, Equity, Preferred Equity, or Hybrid",
  "debtPosition": "Senior, Mezzanine, Bridge, etc. (if lending/debt)",
  "fundAUM": "Current fund AUM (total assets) in dollars if mentioned",
  "totalLoansUnderMgmt": "Total loans under management in dollars (lending funds only — this is the total loan book including leverage, distinct from fund AUM)",
  "equityCommitments": "Total equity commitments / capital under management in dollars (LP capital only, distinct from fund AUM)",
  "avgLoanLTC": "Weighted average loan-to-cost ratio as decimal (0.74 = 74%) for lending funds",
  "performanceFeePct": "Performance fee / carried interest as decimal (0.20 = 20%). This is the GP's share of profits above the preferred return",
  "inceptionDate": "Fund inception / launch date (YYYY-MM-DD)",
  "fundTerm": "Fund term description (e.g. 'Evergreen', '7 years', '10 years with two 1-year extensions')",
  "redemption": "Redemption terms if mentioned",
  "sponsorCoinvest": "GP co-investment percentage or amount if mentioned",
  "taxForm": "K-1, 1099, etc.",
  "secEntityName": "The exact legal entity name of the issuer as it appears on the PPM cover page (e.g. 'NCG Burgundy Investors LLC'). This is the entity filed with the SEC, not the marketing name",
  "issuerEntity": "The exact legal issuer entity being offered to the investor. Prefer the named Company or issuer from the PPM cover and opening paragraph.",
  "gpEntity": "General partner or governing entity if explicitly named in the PPM",
  "sponsorEntity": "Sponsor, manager, or operating entity legal name if explicitly named in the PPM",
  "servicingAgentEntity": "Servicing or loan-origination legal entity if explicitly named in the PPM",
  "issuerEntityType": "Issuer entity type exactly as stated (e.g. Limited Liability Company, Limited Partnership)",
  "issuerJurisdiction": "Issuer jurisdiction / state of formation exactly as stated",
  "issuerAddress": "Issuer mailing or business address exactly as stated",
  "issuerPhone": "Issuer phone number exactly as stated",
  "relatedPeople": "Array of key people named in the PPM with role context, e.g. [{\"name\": \"Michael C. Anderson\", \"role\": \"President\"}]",
  "propertyAddress": "Full street address of the property if a single-asset deal (include city, state, ZIP)",
  "zipCode": "ZIP code of the property or primary investment location (5-digit number)",
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
  "waterfallDetails": "Array of waterfall tiers, e.g. [{\\"tier\\": \\"First\\", \\"threshold\\": \\"8% pref\\", \\"split\\": \\"100/0 LP/GP\\"}, {\\"tier\\": \\"Second\\", \\"threshold\\": \\"above 8%\\", \\"split\\": \\"80/20 LP/GP\\"}]",
  "amountInvested": "The LP's specific commitment/investment amount in dollars (look for signature pages, subscription amount). Number only",
  "dateInvested": "Date the LP signed or subscription was executed (YYYY-MM-DD). Look for signature dates",
  "investingEntity": "The LP's investing entity name (subscriber — look for signature blocks)",
  "entityInvestedInto": "The legal entity being invested into (issuer / SPV name)",
  "historicalReturns": "Array of completed full-year annual returns. Each entry: {\"year\": 2024, \"value\": 10.23, \"type\": \"non_drip\"}. Extract from annualized returns tables, historical performance sections, or fund reports. Use NON-DRIP returns when both DRIP and Non-DRIP are available. Only include completed full calendar years — exclude YTD or partial-year data. Values should be percentages (10.23 = 10.23%, NOT decimals). Look for headings like 'Annualized Returns', 'Historical Returns', 'Fund Performance', 'Annual Net Returns', 'Non-DRIP Avg'."
}

IMPORTANT:
- For percentages, convert to decimals (15% -> 0.15) EXCEPT historicalReturns which uses whole percentages
- For dollar amounts, return raw numbers (no $ or commas)
- If a field clearly doesn't apply to this deal type, use null
- Be precise — only extract what's explicitly stated, don't infer
- For the waterfall, return a JSON array of tier objects
- purchasePrice is the PROPERTY acquisition cost from Sources & Uses, NOT the equity raise (offeringSize)
- For fees, extract BOTH the "fees" field (full text description) AND the individual fee percentage fields
- PRIORITIZE investor-specific details (amountInvested, dateInvested, investingEntity) from signature pages
- For secEntityName and issuerEntity: return the exact legal entity name, not the marketing name
- Use the full document as context, not only the cover pages, but prefer the most formal issuer definitions when multiple names are present
- For historicalReturns: prefer NON-DRIP annual returns over DRIP. Do NOT confuse target returns with actual historical returns. Do NOT include the current incomplete year as a full-year return. Look for annualized returns tables with monthly columns plus an average column
- For lending funds: distinguish between totalLoansUnderMgmt (total loan book), fundAUM (total assets), and equityCommitments (LP capital). These are three distinct numbers
- performanceFeePct is the GP's share above the hurdle (e.g. 20% → 0.20). This is NOT the same as lpGpSplit — the split describes how profits are shared (80/20), the performance fee is the GP fee percentage`;

// ── AI Extraction with fallback chain ────────────────────────────────────────

/**
 * Extract fields from a PDF buffer using AI with fallback chain:
 * Claude PDF → Claude text → OpenAI → Grok
 * @param {Buffer} fileBuffer - The PDF file as a Buffer
 * @param {string} [prompt] - Custom extraction prompt (defaults to ENRICHMENT_PROMPT)
 * @returns {{ extracted: object|null, method: string|null }}
 */
export async function extractFromPdf(fileBuffer, prompt) {
  const extractionPrompt = prompt || ENRICHMENT_PROMPT;
  let extracted = null;
  let method = null;
  let pdfText = null;

  // Try Claude PDF API first
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      extracted = await callClaudePdf(fileBuffer, extractionPrompt);
      method = 'claude-pdf';
    } catch (e) {
      console.warn('Claude PDF API failed:', e.message);
      try {
        pdfText = await extractTextFromPdf(fileBuffer);
        if (pdfText && pdfText.length > 200) {
          extracted = await callClaudeText(pdfText, extractionPrompt);
          method = 'claude-text';
        }
      } catch (e2) {
        console.warn('Claude text fallback failed:', e2.message);
      }
    }
  }

  // Fallback: OpenAI GPT-4o
  if (!extracted && process.env.OPENAI_API_KEY) {
    try {
      if (!pdfText) pdfText = await extractTextFromPdf(fileBuffer);
      if (pdfText && pdfText.length > 200) {
        extracted = await callOpenAI(pdfText, extractionPrompt);
        method = 'openai';
      }
    } catch (e) {
      console.warn('OpenAI fallback failed:', e.message);
    }
  }

  // Fallback: Grok (xAI)
  if (!extracted && process.env.XAI_API_KEY) {
    try {
      if (!pdfText) pdfText = await extractTextFromPdf(fileBuffer);
      if (pdfText && pdfText.length > 200) {
        extracted = await callGrok(pdfText, extractionPrompt);
        method = 'grok';
      }
    } catch (e) {
      console.warn('Grok fallback failed:', e.message);
    }
  }

  return { extracted, method };
}

// ── Enrichment Cascade ───────────────────────────────────────────────────────

/**
 * Run enrichment cascade in parallel given extracted data.
 * @param {object} extracted - Fields extracted from AI
 * @param {object} supabase - Supabase admin client (for deal matching)
 * @returns {{ sec, property, market, backgroundCheck, matchedDeals, enrichmentSteps }}
 */
export async function runEnrichmentCascade(extracted, supabase) {
  const enrichmentPromises = {};
  const enrichmentSteps = [];

  // SEC EDGAR
  const secQuery =
    extracted.issuerEntity
    || extracted.secEntityName
    || extracted.investmentName
    || extracted.managementCompany;
  if (secQuery) {
    enrichmentPromises.sec = runSecEdgar(secQuery).catch(e => {
      console.warn('SEC enrichment failed:', e.message);
      return null;
    });
  }

  // RentCast property data
  if (extracted.propertyAddress) {
    enrichmentPromises.property = runPropertyLookup(extracted.propertyAddress).catch(e => {
      console.warn('Property lookup failed:', e.message);
      return null;
    });
  }

  // Census + BLS market data
  const zip = extracted.zipCode || extractZipFromAddress(extracted.propertyAddress) || extractZipFromGeo(extracted.investingGeography);
  if (zip) {
    enrichmentPromises.market = runMarketData(zip).catch(e => {
      console.warn('Market data failed:', e.message);
      return null;
    });
  }

  // Background check on CEO/sponsor
  const personName = extracted.ceo;
  const companyName = extracted.managementCompany || extracted.sponsor;
  if (personName || companyName) {
    enrichmentPromises.backgroundCheck = runBackgroundCheck(personName, companyName).catch(e => {
      console.warn('Background check failed:', e.message);
      return null;
    });
  }

  // Sponsor track record (all SEC filings for this sponsor)
  const sponsorQuery = extracted.managementCompany || extracted.sponsor;
  if (sponsorQuery) {
    enrichmentPromises.sponsorTrackRecord = runSponsorTrackRecord(sponsorQuery).catch(e => {
      console.warn('Sponsor track record failed:', e.message);
      return null;
    });
  }

  // Deal matching
  if (supabase) {
    enrichmentPromises.matchedDeals = matchDeals(supabase, extracted.investmentName, extracted.managementCompany || extracted.sponsor).catch(e => {
      console.warn('Deal matching failed:', e.message);
      return [];
    });
  }

  // Await all in parallel
  const results = {};
  const keys = Object.keys(enrichmentPromises);
  const values = await Promise.all(keys.map(k => enrichmentPromises[k]));
  keys.forEach((k, i) => { results[k] = values[i]; });

  if (results.sec) enrichmentSteps.push('sec');
  if (results.property) enrichmentSteps.push('property');
  if (results.market) enrichmentSteps.push('market');
  if (results.backgroundCheck) enrichmentSteps.push('background');
  if (results.sponsorTrackRecord) enrichmentSteps.push('sponsor-track-record');

  // Write extracted fields to the opportunities table (safe — only fills empty fields)
  let dbWriteResult = null;
  if (supabase && results.matchedDeals && results.matchedDeals.length > 0) {
    const dealId = results.matchedDeals[0].id;
    dbWriteResult = await persistToDatabase(supabase, dealId, extracted).catch(e => {
      console.warn('DB write failed:', e.message);
      return null;
    });
    if (dbWriteResult) enrichmentSteps.push('db-write');
  }

  return {
    sec: results.sec || null,
    property: results.property || null,
    market: results.market || null,
    backgroundCheck: results.backgroundCheck || null,
    sponsorTrackRecord: results.sponsorTrackRecord || null,
    matchedDeals: results.matchedDeals || [],
    dbWrite: dbWriteResult,
    enrichmentSteps
  };
}

// ── Internal API callers ─────────────────────────────────────────────────────

async function callClaudePdf(fileBuffer, prompt) {
  const pdfBase64 = fileBuffer.toString('base64');
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'anthropic-beta': 'pdfs-2024-09-25',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: prompt }
        ]
      }]
    })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Claude PDF API: ${resp.status} ${errText.substring(0, 200)}`);
  }
  return parseJsonFromResponse(await resp.json());
}

async function callClaudeText(text, prompt) {
  const truncated = text.substring(0, EXTRACTION_TEXT_LIMIT);
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt + '\n\nDOCUMENT TEXT:\n' + truncated }]
    })
  });
  if (!resp.ok) throw new Error(`Claude text API: ${resp.status}`);
  return parseJsonFromResponse(await resp.json());
}

async function callOpenAI(text, prompt) {
  const truncated = text.substring(0, EXTRACTION_TEXT_LIMIT);
  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      max_tokens: 4000,
      temperature: 0,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'DOCUMENT TEXT:\n' + truncated }
      ]
    })
  });
  if (!resp.ok) throw new Error(`OpenAI API: ${resp.status}`);
  const data = await resp.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in OpenAI response');
  return JSON.parse(jsonMatch[0]);
}

async function callGrok(text, prompt) {
  const truncated = text.substring(0, EXTRACTION_TEXT_LIMIT);
  const resp = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.XAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'grok-3',
      max_tokens: 4000,
      temperature: 0,
      messages: [
        { role: 'system', content: prompt },
        { role: 'user', content: 'DOCUMENT TEXT:\n' + truncated }
      ]
    })
  });
  if (!resp.ok) throw new Error(`Grok API: ${resp.status}`);
  const data = await resp.json();
  const responseText = data.choices?.[0]?.message?.content || '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Grok response');
  return JSON.parse(jsonMatch[0]);
}

function parseJsonFromResponse(claudeData) {
  const responseText = claudeData.content?.[0]?.text || '';
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');
  return JSON.parse(jsonMatch[0]);
}

async function extractTextFromPdf(fileBuffer) {
  try {
    const { default: pdfParse } = await import('pdf-parse/lib/pdf-parse.js');
    const result = await pdfParse(fileBuffer);
    return result.text;
  } catch (e) {
    console.warn('pdf-parse failed:', e.message);
    return null;
  }
}

// ── Enrichment source callers ────────────────────────────────────────────────

async function runSecEdgar(entityName) {
  const resp = await fetch(`${SITE_URL}/api/sec-edgar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', companyName: entityName })
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.results || data.results.length === 0) return null;

  const top = data.results[0];
  if (top.cik && top.accession) {
    try {
      const filingResp = await fetch(`${SITE_URL}/api/sec-edgar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'fetch-filing', cik: top.cik, accession: top.accession })
      });
      if (filingResp.ok) {
        const filingData = await filingResp.json();
        return { found: true, search: top, filing: filingData.parsed || null, relatedPersons: filingData.relatedPersons || [] };
      }
    } catch (e) {
      console.warn('SEC filing fetch failed:', e.message);
    }
  }
  return { found: true, search: top, filing: null, relatedPersons: [] };
}

async function runPropertyLookup(address) {
  const resp = await fetch(`${SITE_URL}/api/property?address=${encodeURIComponent(address)}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.success && !data.properties) return null;
  return { found: true, details: data.properties?.[0] || data };
}

async function runMarketData(zip) {
  const resp = await fetch(`${SITE_URL}/api/market-data?zip=${encodeURIComponent(zip)}`);
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.success) return null;
  return { found: true, ...data };
}

async function runBackgroundCheck(personName, companyName) {
  const body = { action: 'run' };
  if (personName) body.personName = personName;
  if (companyName) body.companyName = companyName;
  const resp = await fetch(`${SITE_URL}/api/background-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!resp.ok) return null;
  return await resp.json();
}

async function matchDeals(supabase, investmentName, sponsor) {
  if (!investmentName && !sponsor) return [];

  const conditions = [];
  if (investmentName) {
    const cleaned = investmentName.replace(/\b(LLC|LP|Inc|Fund|Capital|Partners|Group|Investors)\b/gi, '').trim();
    if (cleaned.length > 3) conditions.push(`investment_name.ilike.%${cleaned}%`);
  }
  if (sponsor) {
    const cleaned = sponsor.replace(/\b(LLC|LP|Inc|Capital|Partners|Group|Management)\b/gi, '').trim();
    if (cleaned.length > 3) conditions.push(`management_companies.operator_name.ilike.%${cleaned}%`);
  }

  if (conditions.length === 0) return [];

  const { data: matches } = await supabase
    .from('opportunities')
    .select('id, investment_name, asset_class, management_company_id, management_companies(operator_name)')
    .or(conditions.join(','))
    .limit(3);

  return (matches || []).map(m => ({
    id: m.id,
    investmentName: m.investment_name,
    sponsor: m.management_companies?.operator_name || '',
    assetClass: m.asset_class || ''
  }));
}

// ── Sponsor Track Record ─────────────────────────────────────────────────────

const EDGAR_USER_AGENT = 'GYC Research pascal@growyourcashflow.com';
const EFTS_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';

async function runSponsorTrackRecord(sponsorName) {
  // Search SEC EDGAR for ALL Form D filings by this sponsor
  const cleaned = sponsorName.replace(/\b(LLC|LP|Inc|Capital|Partners|Group|Management|Fund)\b/gi, '').trim();
  if (cleaned.length < 3) return null;

  const url = `${EFTS_SEARCH_URL}?q=%22${encodeURIComponent(cleaned)}%22&forms=D&dateRange=custom&startdt=2000-01-01`;
  const resp = await fetch(url, {
    headers: { 'User-Agent': EDGAR_USER_AGENT }
  });
  if (!resp.ok) return null;
  const data = await resp.json();

  const hits = (data.hits && data.hits.hits) || [];
  const totalFilings = (data.hits && data.hits.total && data.hits.total.value) || hits.length;

  if (hits.length === 0) return null;

  // Parse all filings
  const filings = hits.map(h => {
    const s = h._source || {};
    return {
      entityName: (s.display_names && s.display_names[0]) || '',
      fileDate: s.file_date || '',
      form: s.form || 'D',
      location: (s.biz_locations && s.biz_locations[0]) || '',
      cik: ((s.ciks && s.ciks[0]) || '').replace(/^0+/, '')
    };
  });

  // Deduplicate by entity name (amendments create multiple entries)
  const uniqueDeals = new Map();
  for (const f of filings) {
    const key = f.entityName.toLowerCase().replace(/\s+/g, ' ').trim();
    if (!uniqueDeals.has(key) || f.fileDate > uniqueDeals.get(key).fileDate) {
      uniqueDeals.set(key, f);
    }
  }

  // Build track record summary
  const deals = [...uniqueDeals.values()].sort((a, b) => (b.fileDate || '').localeCompare(a.fileDate || ''));
  const years = deals.map(d => d.fileDate ? parseInt(d.fileDate.substring(0, 4)) : null).filter(Boolean);
  const firstYear = years.length > 0 ? Math.min(...years) : null;
  const latestYear = years.length > 0 ? Math.max(...years) : null;

  // Geography breakdown
  const geoCounts = {};
  for (const d of deals) {
    if (d.location) {
      geoCounts[d.location] = (geoCounts[d.location] || 0) + 1;
    }
  }
  const topLocations = Object.entries(geoCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([location, count]) => ({ location, count }));

  return {
    found: true,
    sponsorName: cleaned,
    totalFilings,
    uniqueDeals: deals.length,
    yearsActive: firstYear && latestYear ? latestYear - firstYear + 1 : null,
    firstFiling: firstYear,
    latestFiling: latestYear,
    topLocations,
    deals: deals.slice(0, 20).map(d => ({
      name: d.entityName,
      date: d.fileDate,
      location: d.location
    }))
  };
}

// ── Database Persistence ─────────────────────────────────────────────────────

// Field mapping: extracted JSON keys → Supabase column names
const SUPABASE_FIELD_MAP = {
  assetClass:             'asset_class',
  dealType:               'deal_type',
  strategy:               'strategy',
  investmentStrategy:     'investment_strategy',
  targetIRR:              'target_irr',
  preferredReturn:        'preferred_return',
  cashOnCash:             'cash_on_cash',
  equityMultiple:         'equity_multiple',
  investmentMinimum:      'investment_minimum',
  holdPeriod:             'hold_period_years',
  offeringSize:           'offering_size',
  offeringType:           'offering_type',
  availableTo:            'available_to',
  distributions:          'distributions',
  lpGpSplit:              'lp_gp_split',
  fees:                   'fees',
  financials:             'financials',
  investingGeography:     'investing_geography',
  instrument:             'instrument',
  debtPosition:           'debt_position',
  fundAUM:                'fund_aum',
  totalLoansUnderMgmt:    'total_loans_under_mgmt',
  equityCommitments:      'equity_commitments',
  avgLoanLTC:             'avg_loan_ltc',
  performanceFeePct:      'performance_fee_pct',
  inceptionDate:          'inception_date',
  fundTerm:               'fund_term',
  sponsorCoinvest:        'sponsor_in_deal_pct',
  purchasePrice:          'purchase_price',
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

const NUMERIC_COLS = new Set([
  'target_irr', 'preferred_return', 'cash_on_cash', 'equity_multiple',
  'investment_minimum', 'hold_period_years', 'offering_size', 'purchase_price',
  'sponsor_in_deal_pct', 'fund_aum', 'total_loans_under_mgmt',
  'equity_commitments', 'avg_loan_ltc', 'performance_fee_pct',
  'unit_count', 'year_built',
  'square_footage', 'occupancy_pct', 'acquisition_loan', 'loan_to_value',
  'loan_rate', 'loan_term_years', 'loan_io_years', 'capex_budget',
  'closing_costs', 'acquisition_fee_pct', 'asset_mgmt_fee_pct',
  'property_mgmt_fee_pct', 'capital_event_fee_pct', 'disposition_fee_pct',
  'construction_mgmt_fee_pct'
]);

/**
 * Persist extracted fields to the opportunities table.
 * Safe update: only fills empty fields, never overwrites human edits.
 * @param {object} supabase - Supabase admin client
 * @param {string} dealId - UUID of the opportunity record
 * @param {object} extracted - Fields extracted from AI
 * @returns {{ updated: number, fields: string[] } | null}
 */
async function persistToDatabase(supabase, dealId, extracted) {
  if (!dealId || !extracted) return null;

  // Build update object from field map
  const supabaseUpdate = {};
  for (const [jsonKey, dbCol] of Object.entries(SUPABASE_FIELD_MAP)) {
    const val = extracted[jsonKey];
    if (val === null || val === undefined) continue;

    // Sanitize numeric fields
    let cleanVal = val;
    if (NUMERIC_COLS.has(dbCol) && typeof val === 'string') {
      const numStr = val.replace(/[$,%]/g, '').replace(/,/g, '');
      const match = numStr.match(/-?[\d.]+/);
      if (match) {
        cleanVal = parseFloat(match[0]);
        if (isNaN(cleanVal)) continue;
      } else {
        continue;
      }
    }

    if (dbCol === 'fees' && typeof cleanVal === 'string') {
      supabaseUpdate[dbCol] = [cleanVal];
    } else {
      supabaseUpdate[dbCol] = cleanVal;
    }
  }

  if (Object.keys(supabaseUpdate).length === 0) return null;

  // Fetch current record to avoid overwriting
  const { data: currentDeal } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', dealId)
    .single();

  if (!currentDeal) return null;

  const safeUpdate = {};
  const fieldsUpdated = [];
  for (const [col, val] of Object.entries(supabaseUpdate)) {
    const current = currentDeal[col];
    const isEmpty = current === null
      || current === undefined
      || current === ''
      || current === 0
      || (Array.isArray(current) && current.length === 0);

    if (isEmpty) {
      safeUpdate[col] = val;
      fieldsUpdated.push(col);
    }
  }

  if (fieldsUpdated.length === 0) return { updated: 0, fields: [] };

  safeUpdate.updated_at = new Date().toISOString();
  const { error } = await supabase
    .from('opportunities')
    .update(safeUpdate)
    .eq('id', dealId);

  if (error) {
    console.error('DB persist error:', error.message);
    return null;
  }

  console.log(`Persisted ${fieldsUpdated.length} fields to opportunity ${dealId}: ${fieldsUpdated.join(', ')}`);
  return { updated: fieldsUpdated.length, fields: fieldsUpdated };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function extractZipFromAddress(address) {
  if (!address) return null;
  const match = address.match(/\b(\d{5})(-\d{4})?\b/);
  return match ? match[1] : null;
}

export function extractZipFromGeo(geo) {
  if (!geo) return null;
  const match = geo.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}
