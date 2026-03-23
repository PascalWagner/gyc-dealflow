// Vercel Serverless Function: Portfolio PPM Extraction + Enrichment Cascade
// Downloads a previously-uploaded PDF from Supabase Storage, extracts investment
// fields via AI (Claude → OpenAI → Grok fallback chain), then cascades through
// SEC EDGAR, RentCast, Census/BLS, and background checks in parallel.

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

// ── Extraction prompt (LP-portfolio-focused) ────────────────────────────────
const PORTFOLIO_EXTRACTION_PROMPT = `You are an LP portfolio analyst. Extract the following fields from this PPM, subscription agreement, or investment document. Return ONLY valid JSON with these exact keys. Use null for any field you cannot find.

Focus on the INVESTOR'S specific details first (signed amount, entity, date), then fall back to the fund's general terms.

{
  "investmentName": "Full name of the fund or investment offering",
  "sponsor": "Name of the sponsor / management company / GP",
  "ceo": "CEO, Managing Partner, or Fund Manager name",
  "assetClass": "One of: Multi Family, Self Storage, Industrial, Lending, Short Term Rental, Hotels/Hospitality, Mixed-Use, RV/Mobile Home Parks, Business / Other, Land, Senior Living, Car Wash, ATM, Oil & Gas, Other",
  "amountInvested": "The LP's specific commitment/investment amount in dollars (look for signature pages, subscription amount, capital commitment). Number only, no $ or commas",
  "dateInvested": "Date the LP signed or the subscription was executed (YYYY-MM-DD format). Look for signature dates, execution dates, closing dates",
  "status": "One of: Active, Pending, Distributing. Default to Active if fund is operating, Pending if not yet closed",
  "targetIRR": "Target IRR as a percentage number (e.g. 15 for 15%, NOT 0.15)",
  "preferredReturn": "Preferred return as percentage number (e.g. 8 for 8%)",
  "holdPeriod": "Expected hold period in years (number only)",
  "distributionFrequency": "Monthly, Quarterly, Annual, or None",
  "investmentMinimum": "Minimum investment amount in dollars (number only)",
  "investingEntity": "The LP's investing entity name (the subscriber — look for signature blocks, subscriber info sections)",
  "entityInvestedInto": "The legal entity being invested into (the issuer / SPV name)",
  "offeringType": "506(b) or 506(c)",
  "taxForm": "K-1, 1099, etc.",
  "secEntityName": "The exact legal entity name of the issuer as it appears on the PPM cover page (e.g. 'NCG Burgundy Investors LLC'). This is the entity filed with the SEC, not the marketing name",
  "propertyAddress": "Full street address of the property if this is a single-asset deal (include city, state, ZIP if available)",
  "investingGeography": "Geographic focus area — city, state, or region. Include ZIP code if found",
  "zipCode": "ZIP code of the property or primary investment location (5-digit number)"
}

IMPORTANT:
- PRIORITIZE the specific LP/investor details over general fund terms
- For amountInvested: look for "Subscription Amount", "Capital Commitment", "Amount Subscribed" on signature pages. If not found, use the minimum investment amount
- For dateInvested: look for execution dates on signature pages, NOT the offering date
- For investingEntity: look for "Subscriber Name", "Investor Name" in signature blocks
- For targetIRR: return as whole number percentage (15 not 0.15)
- For secEntityName: return the exact legal name, not the marketing name
- For propertyAddress: only include if this is a specific property deal, not a blind pool fund
- If this is a PPM without investor-specific details, extract the fund minimums and terms
- Use null for any field you cannot find — do not guess`;

// ── Main handler ─────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { maxRequests: 10 })) return;

  try {
    const { storagePath } = req.body;

    if (!storagePath) {
      return res.status(400).json({ error: 'storagePath is required' });
    }

    // 1. Download file from Supabase Storage
    const supabase = getAdminClient();
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('deal-decks')
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('Storage download error:', downloadError);
      return res.status(404).json({ error: 'File not found in storage' });
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer());
    console.log(`Portfolio extract: downloaded ${(fileBuffer.length / 1024 / 1024).toFixed(1)}MB from ${storagePath}`);

    // 2. Phase 1: AI Extraction with fallback chain
    let extracted = null;
    let extractionMethod = null;
    let pdfText = null; // Lazy-loaded for text fallbacks

    // Try Claude PDF API first
    if (process.env.ANTHROPIC_API_KEY) {
      try {
        extracted = await extractWithClaudePdf(fileBuffer);
        extractionMethod = 'claude-pdf';
      } catch (e) {
        console.warn('Claude PDF API failed:', e.message);
        // Try Claude with text extraction
        try {
          pdfText = await extractTextFromPdf(fileBuffer);
          if (pdfText && pdfText.length > 200) {
            extracted = await extractWithClaudeText(pdfText);
            extractionMethod = 'claude-text';
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
          extracted = await extractWithOpenAI(pdfText);
          extractionMethod = 'openai';
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
          extracted = await extractWithGrok(pdfText);
          extractionMethod = 'grok';
        }
      } catch (e) {
        console.warn('Grok fallback failed:', e.message);
      }
    }

    // No AI provider succeeded
    if (!extracted) {
      return res.status(200).json({
        success: false,
        error: 'Could not extract data from document. You can add details manually.',
        enrichmentSteps: []
      });
    }

    const fieldsExtracted = Object.keys(extracted).filter(k => extracted[k] !== null && extracted[k] !== undefined).length;
    console.log(`Extraction (${extractionMethod}): ${fieldsExtracted} fields found`);

    // 3. Phases 2-6: Enrichment cascade (all in parallel)
    const enrichmentPromises = {};
    const enrichmentSteps = ['ppm'];

    // SEC EDGAR
    const secQuery = extracted.secEntityName || extracted.investmentName;
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
    const companyName = extracted.sponsor;
    if (personName || companyName) {
      enrichmentPromises.backgroundCheck = runBackgroundCheck(personName, companyName).catch(e => {
        console.warn('Background check failed:', e.message);
        return null;
      });
    }

    // Deal matching
    enrichmentPromises.matchedDeals = matchDeals(supabase, extracted.investmentName, extracted.sponsor).catch(e => {
      console.warn('Deal matching failed:', e.message);
      return [];
    });

    // Await all enrichment in parallel
    const results = {};
    const keys = Object.keys(enrichmentPromises);
    const values = await Promise.all(keys.map(k => enrichmentPromises[k]));
    keys.forEach((k, i) => { results[k] = values[i]; });

    // Track which steps succeeded
    if (results.sec) enrichmentSteps.push('sec');
    if (results.property) enrichmentSteps.push('property');
    if (results.market) enrichmentSteps.push('market');
    if (results.backgroundCheck) enrichmentSteps.push('background');

    return res.status(200).json({
      success: true,
      extracted,
      sec: results.sec || null,
      property: results.property || null,
      market: results.market || null,
      backgroundCheck: results.backgroundCheck || null,
      matchedDeals: results.matchedDeals || [],
      fieldsExtracted,
      method: extractionMethod,
      enrichmentSteps
    });

  } catch (error) {
    console.error('Portfolio extract error:', error);
    return res.status(500).json({ error: 'Extraction failed: ' + error.message });
  }
}

// ── AI Extraction Functions ──────────────────────────────────────────────────

async function extractWithClaudePdf(fileBuffer) {
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
          { type: 'text', text: PORTFOLIO_EXTRACTION_PROMPT }
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

async function extractWithClaudeText(text) {
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
      messages: [{
        role: 'user',
        content: PORTFOLIO_EXTRACTION_PROMPT + '\n\nDOCUMENT TEXT:\n' + truncated
      }]
    })
  });
  if (!resp.ok) throw new Error(`Claude text API: ${resp.status}`);
  return parseJsonFromResponse(await resp.json());
}

async function extractWithOpenAI(text) {
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
        { role: 'system', content: PORTFOLIO_EXTRACTION_PROMPT },
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

async function extractWithGrok(text) {
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
        { role: 'system', content: PORTFOLIO_EXTRACTION_PROMPT },
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

// ── Enrichment Functions (call existing APIs server-side) ────────────────────

const SITE_URL = process.env.SITE_URL || 'https://deals.growyourcashflow.io';

async function runSecEdgar(entityName) {
  const resp = await fetch(`${SITE_URL}/api/sec-edgar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'search', companyName: entityName })
  });
  if (!resp.ok) return null;
  const data = await resp.json();
  if (!data.results || data.results.length === 0) return null;

  // Fetch the top filing
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
  const data = await resp.json();
  return data;
}

// ── Deal Matching ────────────────────────────────────────────────────────────

async function matchDeals(supabase, investmentName, sponsor) {
  if (!investmentName && !sponsor) return [];

  const conditions = [];
  if (investmentName) {
    // Clean the name for fuzzy matching
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

function extractZipFromAddress(address) {
  if (!address) return null;
  const match = address.match(/\b(\d{5})(-\d{4})?\b/);
  return match ? match[1] : null;
}

function extractZipFromGeo(geo) {
  if (!geo) return null;
  const match = geo.match(/\b(\d{5})\b/);
  return match ? match[1] : null;
}
