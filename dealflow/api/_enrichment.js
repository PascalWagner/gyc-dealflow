// Shared Enrichment Pipeline
// Used by both deck-upload.js and portfolio-extract.js
// The PPM is always the source of truth for deal data.
//
// Pipeline: AI extraction → SEC EDGAR → RentCast → Census/BLS → Background Check
// All enrichment phases (2-5) run in parallel after AI extraction completes.

const SITE_URL = process.env.SITE_URL || 'https://deals.growyourcashflow.io';

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
  "fundAUM": "Current AUM in dollars if mentioned",
  "redemption": "Redemption terms if mentioned",
  "sponsorCoinvest": "GP co-investment percentage or amount if mentioned",
  "taxForm": "K-1, 1099, etc.",
  "secEntityName": "The exact legal entity name of the issuer as it appears on the PPM cover page (e.g. 'NCG Burgundy Investors LLC'). This is the entity filed with the SEC, not the marketing name",
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
  "entityInvestedInto": "The legal entity being invested into (issuer / SPV name)"
}

IMPORTANT:
- For percentages, convert to decimals (15% -> 0.15)
- For dollar amounts, return raw numbers (no $ or commas)
- If a field clearly doesn't apply to this deal type, use null
- Be precise — only extract what's explicitly stated, don't infer
- For the waterfall, return a JSON array of tier objects
- purchasePrice is the PROPERTY acquisition cost from Sources & Uses, NOT the equity raise (offeringSize)
- For fees, extract BOTH the "fees" field (full text description) AND the individual fee percentage fields
- PRIORITIZE investor-specific details (amountInvested, dateInvested, investingEntity) from signature pages
- For secEntityName: return the exact legal entity name, not the marketing name`;

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
  const secQuery = extracted.secEntityName || extracted.investmentName || extracted.managementCompany;
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

  return {
    sec: results.sec || null,
    property: results.property || null,
    market: results.market || null,
    backgroundCheck: results.backgroundCheck || null,
    matchedDeals: results.matchedDeals || [],
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
  const truncated = text.substring(0, 50000);
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
  const truncated = text.substring(0, 80000);
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
  const truncated = text.substring(0, 80000);
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
