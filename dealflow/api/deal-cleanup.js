// Vercel Serverless Function: /api/deal-cleanup
// AI-assisted deal data cleanup with multi-step enrichment pipeline:
//   Step 0: SEC EDGAR Form D lookup (authoritative source of truth)
//   Step 1: Extract from Deck PDF
//   Step 2: Extract from PPM PDF (fill remaining gaps)
//   Step 3: Web search (sponsor website, SEC Edgar, investclearly.com)
// API fallback chain: Gemini (free tier) → Anthropic → OpenAI

import { getAdminClient, setCors, verifyAdmin } from './_supabase.js';
import { XMLParser } from 'fast-xml-parser';

// ── Quality fields to track ──────────────────────────────────────────────────

const QUALITY_FIELDS = [
  { key: 'investment_name', label: 'Name' },
  { key: 'asset_class', label: 'Asset Class' },
  { key: 'deal_type', label: 'Deal Type' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'investment_strategy', label: 'Investment Strategy' },
  { key: 'target_irr', label: 'Target IRR' },
  { key: 'preferred_return', label: 'Preferred Return' },
  { key: 'cash_on_cash', label: 'Cash on Cash' },
  { key: 'investment_minimum', label: 'Minimum Investment' },
  { key: 'hold_period_years', label: 'Hold Period' },
  { key: 'offering_type', label: 'Offering Type' },
  { key: 'offering_size', label: 'Offering Size' },
  { key: 'distributions', label: 'Distributions' },
  { key: 'lp_gp_split', label: 'LP/GP Split' },
  { key: 'fees', label: 'Fees' },
  { key: 'financials', label: 'Financials' },
  { key: 'investing_geography', label: 'Geography' },
  { key: 'instrument', label: 'Instrument' },
  { key: 'management_company_id', label: 'Operator' },
  { key: 'status', label: 'Status' },
];

function getMissingFields(deal) {
  const missing = [];
  for (const f of QUALITY_FIELDS) {
    const val = deal[f.key];
    const isEmpty = val === null || val === undefined || val === '' || val === 0 ||
      (Array.isArray(val) && val.length === 0);
    if (isEmpty) missing.push(f);
  }
  return missing;
}

function getCompletenessPercent(deal) {
  const missing = getMissingFields(deal);
  return Math.round(((QUALITY_FIELDS.length - missing.length) / QUALITY_FIELDS.length) * 100);
}

// ── PDF text extraction (same as deck-upload.js) ─────────────────────────────

function extractTextFromPdfBuffer(buffer) {
  const raw = buffer.toString('latin1');
  const textChunks = [];

  // Method 1: Extract text between BT (Begin Text) and ET (End Text) operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    const parenStrings = match[1].match(/\(([^)]*)\)/g);
    if (parenStrings) {
      for (const s of parenStrings) {
        const cleaned = s.slice(1, -1)
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '')
          .replace(/\\\(/g, '(')
          .replace(/\\\)/g, ')')
          .replace(/\\\\/g, '\\');
        if (cleaned.trim()) textChunks.push(cleaned);
      }
    }
  }

  // Method 2: Fallback for text-heavy PDFs
  if (textChunks.join('').length < 500) {
    const readableRegex = /[\x20-\x7E]{10,}/g;
    let readMatch;
    while ((readMatch = readableRegex.exec(raw)) !== null) {
      const chunk = readMatch[0].trim();
      if (chunk && !/^[A-Fa-f0-9\s]+$/.test(chunk) && !/^[\/\[\]<>{}]+$/.test(chunk)) {
        textChunks.push(chunk);
      }
    }
  }

  return textChunks.join(' ').substring(0, 50000);
}

// ── Extraction prompt (matches deal-enrich.js format) ────────────────────────

const EXTRACTION_PROMPT = `You are a real estate private placement analyst. Extract the following fields from this document text. Return ONLY valid JSON with these exact keys. Use null for any field you cannot find.

{
  "investmentName": "Full name of the fund or investment",
  "managementCompany": "Name of the sponsor / management company",
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
  "offeringSize": "Total offering size in dollars (number only)",
  "offeringType": "506(b) or 506(c)",
  "distributions": "Monthly, Quarterly, Annual, or None",
  "lpGpSplit": "e.g. 80/20",
  "fees": "Full fee structure description",
  "financials": "Audited or Unaudited",
  "investingGeography": "Geographic focus",
  "instrument": "Debt, Equity, Preferred Equity, or Hybrid",
  "status": "One of: open, closed, coming_soon, evergreen, fully_funded, completed"
}

IMPORTANT:
- For percentages, convert to decimals (15% → 0.15)
- For dollar amounts, return raw numbers (no $ or commas)
- If a field clearly doesn't apply to this deal type, use null
- Be precise — only extract what's explicitly stated, don't infer`;

// Map AI extraction keys → Supabase column names
const FIELD_MAP = {
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
  offeringType:        'offering_type',
  distributions:       'distributions',
  lpGpSplit:           'lp_gp_split',
  fees:                'fees',
  financials:          'financials',
  investingGeography:  'investing_geography',
  instrument:          'instrument',
  status:              'status',
};

// ── AI API abstraction with fallback chain ───────────────────────────────────

async function callAI(prompt, { webSearch = false } = {}) {
  const apis = [];

  // Gemini (free tier — try first)
  if (process.env.GEMINI_API_KEY) {
    apis.push({ name: 'gemini', fn: () => callGemini(prompt, webSearch) });
  }
  // Anthropic (fallback)
  if (process.env.ANTHROPIC_API_KEY) {
    apis.push({ name: 'anthropic', fn: () => callAnthropic(prompt, webSearch) });
  }
  // OpenAI (fallback)
  if (process.env.OPENAI_API_KEY) {
    apis.push({ name: 'openai', fn: () => callOpenAI(prompt) });
  }

  if (apis.length === 0) {
    throw new Error('No AI API keys configured (need GEMINI_API_KEY, ANTHROPIC_API_KEY, or OPENAI_API_KEY)');
  }

  const errors = [];
  for (const api of apis) {
    try {
      const result = await api.fn();
      return { ...result, api_used: api.name };
    } catch (err) {
      console.warn(`${api.name} API failed:`, err.message);
      errors.push(`${api.name}: ${err.message}`);
    }
  }

  throw new Error('All AI APIs failed: ' + errors.join(' | '));
}

async function callGemini(prompt, webSearch) {
  const key = process.env.GEMINI_API_KEY;
  const model = 'gemini-2.0-flash';

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: { temperature: 0.1, maxOutputTokens: 4000 },
  };

  // Gemini supports grounding with Google Search
  if (webSearch) {
    body.tools = [{ googleSearch: {} }];
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();
  const text = data.candidates?.[0]?.content?.parts
    ?.filter(p => p.text)
    ?.map(p => p.text)
    ?.join('') || '';

  return { text };
}

async function callAnthropic(prompt, webSearch) {
  const key = process.env.ANTHROPIC_API_KEY;

  const body = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }]
  };

  if (webSearch) {
    body.tools = [{
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 5
    }];
  }

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Anthropic ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();
  let text = '';
  for (const block of (data.content || [])) {
    if (block.type === 'text') text += block.text;
  }

  return { text };
}

async function callOpenAI(prompt) {
  const key = process.env.OPENAI_API_KEY;

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 4000,
      temperature: 0.1,
      messages: [{ role: 'user', content: prompt }]
    })
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`OpenAI ${resp.status}: ${errText.substring(0, 300)}`);
  }

  const data = await resp.json();
  const text = data.choices?.[0]?.message?.content || '';

  return { text };
}

// ── Parse JSON from AI response ──────────────────────────────────────────────

function parseAIResponse(text) {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}

// Map extracted camelCase fields → snake_case DB fields
function mapToDbFields(extracted) {
  const mapped = {};
  for (const [jsonKey, dbCol] of Object.entries(FIELD_MAP)) {
    const val = extracted[jsonKey];
    if (val !== null && val !== undefined) {
      if (dbCol === 'fees' && typeof val === 'string') {
        mapped[dbCol] = [val];
      } else {
        mapped[dbCol] = val;
      }
    }
  }
  // Also handle snake_case keys directly (from web search prompt)
  for (const f of QUALITY_FIELDS) {
    if (extracted[f.key] !== undefined && extracted[f.key] !== null && !mapped[f.key]) {
      if (f.key === 'fees' && typeof extracted[f.key] === 'string') {
        mapped[f.key] = [extracted[f.key]];
      } else {
        mapped[f.key] = extracted[f.key];
      }
    }
  }
  return mapped;
}

// ── Download PDF from Supabase Storage ───────────────────────────────────────

async function downloadPdf(supabase, url) {
  // The deck_url / ppm_url is a signed Supabase storage URL
  // Download the raw bytes
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`PDF download failed: ${resp.status}`);
  const arrayBuf = await resp.arrayBuffer();
  return Buffer.from(arrayBuf);
}

// ── Build web search prompt ──────────────────────────────────────────────────

function buildWebSearchPrompt(deal, operatorName, missingFields) {
  const missingList = missingFields.map(f => `- ${f.label} (field: ${f.key})`).join('\n');

  const knownInfo = [];
  if (deal.investment_name) knownInfo.push(`Fund/Deal Name: ${deal.investment_name}`);
  if (operatorName && operatorName !== '—') knownInfo.push(`Operator/Sponsor: ${operatorName}`);
  if (deal.asset_class) knownInfo.push(`Asset Class: ${deal.asset_class}`);
  if (deal.deal_type) knownInfo.push(`Deal Type: ${deal.deal_type}`);
  if (deal.offering_type) knownInfo.push(`Offering Type: ${deal.offering_type}`);

  return `You are a real estate investment research analyst. Search the web for information about this private placement deal and fill in the missing data fields.

KNOWN INFORMATION:
${knownInfo.join('\n')}

MISSING FIELDS TO FIND:
${missingList}

SEARCH INSTRUCTIONS:
1. Search for "${deal.investment_name}" ${operatorName && operatorName !== '—' ? `by "${operatorName}"` : ''}
2. Check: sponsor's website, SEC EDGAR Form D filings, CrowdStreet, RealCrowd, investclearly.com
3. For each missing field, provide the value if found with reasonable confidence

FIELD FORMAT RULES:
- target_irr, preferred_return, cash_on_cash: decimal (0.15 for 15%)
- investment_minimum, offering_size: raw number in dollars (no $ or commas)
- hold_period_years: number of years
- asset_class: One of: Lending, Multi Family, Self Storage, Industrial, Hotels/Hospitality, RV/Mobile Home Parks, Short Term Rental, Mixed Use, Office, Retail, Oil & Gas, Other
- deal_type: One of: Fund, Syndication, Direct, REIT
- strategy: One of: Core, Core-Plus, Value-Add, Opportunistic, Development, Lending, Distressed
- offering_type: One of: 506(b), 506(c), Reg A, Reg D
- distributions: One of: Monthly, Quarterly, Annual, None
- instrument: One of: Debt, Equity, Preferred Equity, Hybrid
- financials: Audited or Unaudited
- fees: Full fee structure as string
- lp_gp_split: e.g. "80/20"
- investing_geography: Geographic focus area
- investment_strategy: 2-3 sentence LP-facing summary
- status: One of: open, closed, coming_soon, evergreen, fully_funded, completed

Return ONLY valid JSON:
{
  "found_fields": { "field_key": "value" },
  "confidence": { "field_key": "high|medium|low" },
  "sources": ["url or description"],
  "notes": "context about search results"
}

Only include fields you actually found. Be conservative.`;
}

// ── Multi-step enrichment pipeline ───────────────────────────────────────────

async function enrichDeal(supabase, deal, operatorName) {
  const missingFields = getMissingFields(deal);
  if (missingFields.length === 0) {
    return { found_fields: {}, confidence: {}, sources: [], steps: [], notes: 'Already 100% complete' };
  }

  const allFound = {};
  const allConfidence = {};
  const allSources = [];
  const steps = [];

  // Helper: which fields are still missing after merging found data
  function stillMissing() {
    const tempDeal = { ...deal };
    for (const [k, v] of Object.entries(allFound)) {
      if (v !== null && v !== undefined) tempDeal[k] = v;
    }
    return getMissingFields(tempDeal);
  }

  // ── Step 0: SEC EDGAR Form D lookup (authoritative) ───────────────────
  try {
    const searchName = operatorName || deal.investment_name || '';
    if (searchName) {
      const edgarUA = 'GYC Research pascal@growyourcashflow.com';
      const eftsUrl = `https://efts.sec.gov/LATEST/search-index?q=%22${encodeURIComponent(searchName)}%22&forms=D`;
      const eftsResp = await fetch(eftsUrl, { headers: { 'User-Agent': edgarUA } });
      if (eftsResp.ok) {
        const eftsData = await eftsResp.json();
        const hits = (eftsData.hits && eftsData.hits.hits) || [];
        if (hits.length > 0) {
          // Take the highest-scored (most relevant) filing
          const best = hits[0]._source;
          const cik = (best.ciks && best.ciks[0] || '').replace(/^0+/, '');
          const accession = best.adsh;
          if (cik && accession) {
            const accPath = accession.replace(/-/g, '');
            const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${cik}/${accPath}/primary_doc.xml`;
            const xmlResp = await fetch(xmlUrl, { headers: { 'User-Agent': edgarUA } });
            if (xmlResp.ok) {
              const xmlText = await xmlResp.text();
              const parser = new XMLParser({
                ignoreAttributes: true,
                isArray: (name) => ['relatedPersonInfo', 'item', 'relationship'].includes(name)
              });
              const doc = parser.parse(xmlText);
              const sub = doc.edgarSubmission || doc;
              const issuer = sub.primaryIssuer || {};
              const offering = sub.offeringData || {};
              const amounts = offering.offeringSalesAmounts || {};
              const exemptions = offering.federalExemptionsExclusions || {};
              const exemptionItems = Array.isArray(exemptions.item) ? exemptions.item : (exemptions.item ? [exemptions.item] : []);
              const is506b = exemptionItems.some(e => e === '06b');
              const is506c = exemptionItems.some(e => e === '06c');

              // Authoritative fields (always set)
              if (is506b) { allFound.offering_type = '506(b)'; allConfidence.offering_type = 'verified'; }
              else if (is506c) { allFound.offering_type = '506(c)'; allConfidence.offering_type = 'verified'; }
              allFound.is_506b = is506b;
              allFound.sec_cik = cik;
              if (offering.minimumInvestmentAccepted) { allFound.investment_minimum = parseFloat(offering.minimumInvestmentAccepted); allConfidence.investment_minimum = 'verified'; }
              if (amounts.totalOfferingAmount) { allFound.offering_size = parseFloat(amounts.totalOfferingAmount); allConfidence.offering_size = 'verified'; }
              if (amounts.totalAmountSold) { allFound.total_amount_sold = parseFloat(amounts.totalAmountSold); }
              const investors = offering.investors || {};
              if (investors.totalNumberAlreadyInvested) { allFound.total_investors = parseInt(investors.totalNumberAlreadyInvested); }
              const dateOfFirstSale = ((offering.typeOfFiling || {}).dateOfFirstSale || {}).value;
              if (dateOfFirstSale) { allFound.date_of_first_sale = dateOfFirstSale; }

              // Safe-update fields (only if empty)
              if (!deal.investment_name && issuer.entityName) { allFound.investment_name = issuer.entityName; allConfidence.investment_name = 'verified'; }

              allSources.push('SEC EDGAR Form D');
              steps.push(`Step 0 (EDGAR): Found ${best.form} filing for ${(issuer.entityName || searchName)} (CIK ${cik}). ${exemptionItems.map(e => e === '06c' ? '506(c)' : e === '06b' ? '506(b)' : e).join(', ')}, $${(amounts.totalAmountSold || 0).toLocaleString()} sold, ${investors.totalNumberAlreadyInvested || 0} investors.`);

              // Store the filing in sec_filings table
              try {
                await supabase.from('sec_filings').upsert({
                  opportunity_id: deal.id,
                  management_company_id: deal.management_company_id || null,
                  cik, accession_number: accession,
                  filing_type: best.form || 'D',
                  is_latest_amendment: true,
                  entity_name: issuer.entityName || '',
                  entity_type: issuer.entityType || '',
                  jurisdiction: issuer.jurisdictionOfInc || '',
                  year_of_inc: (issuer.yearOfInc || {}).value ? parseInt(issuer.yearOfInc.value) : null,
                  issuer_city: (issuer.issuerAddress || {}).city || '',
                  issuer_state: (issuer.issuerAddress || {}).stateOrCountry || '',
                  issuer_zip: (issuer.issuerAddress || {}).zipCode || '',
                  federal_exemptions: exemptionItems,
                  date_of_first_sale: dateOfFirstSale || null,
                  minimum_investment: offering.minimumInvestmentAccepted ? parseFloat(offering.minimumInvestmentAccepted) : null,
                  total_offering_amount: amounts.totalOfferingAmount ? parseFloat(amounts.totalOfferingAmount) : null,
                  total_amount_sold: amounts.totalAmountSold ? parseFloat(amounts.totalAmountSold) : null,
                  total_remaining: amounts.totalRemaining ? parseFloat(amounts.totalRemaining) : null,
                  total_investors: investors.totalNumberAlreadyInvested ? parseInt(investors.totalNumberAlreadyInvested) : null,
                  has_non_accredited: !!investors.hasNonAccreditedInvestors,
                  issuer_size: (offering.issuerSize || {}).revenueRange || '',
                  industry_group: (offering.industryGroup || {}).industryGroupType || '',
                  is_equity: !!(offering.typesOfSecuritiesOffered || {}).isEquityType,
                  is_debt: !!(offering.typesOfSecuritiesOffered || {}).isDebtType,
                  is_pooled_fund: !!(offering.typesOfSecuritiesOffered || {}).isPooledInvestmentFundType,
                  raw_xml: xmlText,
                  edgar_url: xmlUrl
                }, { onConflict: 'accession_number' });
              } catch (storeErr) { console.error('EDGAR store error:', storeErr); }
            }
          }
        }
      }
    }
  } catch (edgarErr) {
    console.error('EDGAR Step 0 error:', edgarErr);
    steps.push('Step 0 (EDGAR): Error - ' + edgarErr.message);
  }

  // ── Step 1: Extract from Deck PDF ──────────────────────────────────────
  if (deal.deck_url) {
    try {
      const pdfBuffer = await downloadPdf(supabase, deal.deck_url);
      const pdfText = extractTextFromPdfBuffer(pdfBuffer);

      if (pdfText && pdfText.length >= 100) {
        const result = await callAI(EXTRACTION_PROMPT + '\n\nDOCUMENT TEXT:\n' + pdfText);
        const extracted = parseAIResponse(result.text);

        if (extracted) {
          const mapped = mapToDbFields(extracted);
          let deckFieldCount = 0;
          for (const [k, v] of Object.entries(mapped)) {
            if (v !== null && v !== undefined && !allFound[k]) {
              allFound[k] = v;
              allConfidence[k] = 'high';
              deckFieldCount++;
            }
          }
          steps.push({ step: 'deck_pdf', fields_found: deckFieldCount, api: result.api_used });
          allSources.push('Deck PDF');
        } else {
          steps.push({ step: 'deck_pdf', fields_found: 0, note: 'Could not parse AI response' });
        }
      } else {
        steps.push({ step: 'deck_pdf', fields_found: 0, note: 'Insufficient text extracted' });
      }
    } catch (err) {
      steps.push({ step: 'deck_pdf', fields_found: 0, error: err.message });
    }
  } else {
    steps.push({ step: 'deck_pdf', fields_found: 0, note: 'No deck uploaded' });
  }

  // ── Step 2: Extract from PPM PDF (only if still missing fields) ────────
  const afterDeck = stillMissing();
  if (afterDeck.length > 0 && deal.ppm_url) {
    try {
      const pdfBuffer = await downloadPdf(supabase, deal.ppm_url);
      const pdfText = extractTextFromPdfBuffer(pdfBuffer);

      if (pdfText && pdfText.length >= 100) {
        const result = await callAI(EXTRACTION_PROMPT + '\n\nDOCUMENT TEXT:\n' + pdfText);
        const extracted = parseAIResponse(result.text);

        if (extracted) {
          const mapped = mapToDbFields(extracted);
          let ppmFieldCount = 0;
          for (const [k, v] of Object.entries(mapped)) {
            if (v !== null && v !== undefined && !allFound[k]) {
              allFound[k] = v;
              allConfidence[k] = 'high';
              ppmFieldCount++;
            }
          }
          steps.push({ step: 'ppm_pdf', fields_found: ppmFieldCount, api: result.api_used });
          allSources.push('PPM Document');
        } else {
          steps.push({ step: 'ppm_pdf', fields_found: 0, note: 'Could not parse AI response' });
        }
      } else {
        steps.push({ step: 'ppm_pdf', fields_found: 0, note: 'Insufficient text extracted' });
      }
    } catch (err) {
      steps.push({ step: 'ppm_pdf', fields_found: 0, error: err.message });
    }
  } else if (afterDeck.length === 0) {
    steps.push({ step: 'ppm_pdf', fields_found: 0, note: 'All fields already found from deck' });
  } else {
    steps.push({ step: 'ppm_pdf', fields_found: 0, note: 'No PPM uploaded' });
  }

  // ── Step 3: Web search for remaining missing fields ────────────────────
  const afterPpm = stillMissing();
  if (afterPpm.length > 0 && deal.investment_name) {
    try {
      const prompt = buildWebSearchPrompt(deal, operatorName, afterPpm);
      const result = await callAI(prompt, { webSearch: true });
      const parsed = parseAIResponse(result.text);

      if (parsed) {
        const foundFields = parsed.found_fields || parsed;
        let webFieldCount = 0;
        for (const [k, v] of Object.entries(foundFields)) {
          if (v !== null && v !== undefined && !allFound[k]) {
            allFound[k] = v;
            allConfidence[k] = parsed.confidence?.[k] || 'medium';
            webFieldCount++;
          }
        }
        if (parsed.sources) allSources.push(...parsed.sources);
        steps.push({ step: 'web_search', fields_found: webFieldCount, api: result.api_used });
      } else {
        steps.push({ step: 'web_search', fields_found: 0, note: 'Could not parse search results' });
      }
    } catch (err) {
      steps.push({ step: 'web_search', fields_found: 0, error: err.message });
    }
  } else if (afterPpm.length === 0) {
    steps.push({ step: 'web_search', fields_found: 0, note: 'All fields already found' });
  } else {
    steps.push({ step: 'web_search', fields_found: 0, note: 'No deal name for search' });
  }

  return {
    found_fields: allFound,
    confidence: allConfidence,
    sources: allSources,
    steps,
    notes: `Pipeline complete: ${Object.keys(allFound).length} fields found across ${steps.filter(s => s.fields_found > 0).length} steps`
  };
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return res.status(403).json({ success: false, error: auth.error });
  }

  const { action } = req.body || {};

  try {
    const supabase = getAdminClient();

    // Action: get the queue of deals to clean up
    if (action === 'get-queue') {
      const { data, error } = await supabase
        .from('opportunities')
        .select('*, management_company:management_companies(id, operator_name)')
        .is('parent_deal_id', null)
        .order('added_date', { ascending: false });

      if (error) throw error;

      const queue = (data || [])
        .map(d => {
          const missing = getMissingFields(d);
          return {
            id: d.id,
            investment_name: d.investment_name,
            asset_class: d.asset_class,
            operator_name: d.management_company?.operator_name || '—',
            completeness_pct: getCompletenessPercent(d),
            missing_count: missing.length,
            missing_fields: missing.map(f => f.label),
            has_deck: !!d.deck_url,
            has_ppm: !!d.ppm_url,
          };
        })
        .filter(d => d.completeness_pct < 100)
        .sort((a, b) => a.completeness_pct - b.completeness_pct);

      return res.status(200).json({
        success: true,
        queue,
        total: queue.length,
        stats: {
          total_incomplete: queue.length,
          below_50: queue.filter(d => d.completeness_pct < 50).length,
          between_50_80: queue.filter(d => d.completeness_pct >= 50 && d.completeness_pct < 80).length,
          above_80: queue.filter(d => d.completeness_pct >= 80).length,
        }
      });
    }

    // Action: enrich a single deal via multi-step pipeline
    if (action === 'enrich-deal') {
      const { dealId } = req.body;
      if (!dealId) return res.status(400).json({ error: 'Missing dealId' });

      const { data: deal, error: dealErr } = await supabase
        .from('opportunities')
        .select('*, management_company:management_companies(id, operator_name)')
        .eq('id', dealId)
        .single();

      if (dealErr || !deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      const operatorName = deal.management_company?.operator_name || '—';
      const missingFields = getMissingFields(deal);

      if (missingFields.length === 0) {
        return res.status(200).json({
          success: true,
          deal_id: dealId,
          message: 'Deal is already 100% complete',
          found_fields: {},
          steps: [],
          current_data: deal
        });
      }

      // Run the multi-step enrichment pipeline
      const result = await enrichDeal(supabase, deal, operatorName);

      return res.status(200).json({
        success: true,
        deal_id: dealId,
        found_fields: result.found_fields,
        confidence: result.confidence,
        sources: result.sources,
        steps: result.steps,
        notes: result.notes,
        current_data: deal,
        operator_name: operatorName,
        missing_fields: missingFields.map(f => ({ key: f.key, label: f.label }))
      });
    }

    // Action: apply approved enrichments to a deal
    if (action === 'apply-enrichment') {
      const { dealId, updates } = req.body;
      if (!dealId) return res.status(400).json({ error: 'Missing dealId' });
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates to apply' });
      }

      const allowedFields = QUALITY_FIELDS.map(f => f.key).concat([
        'equity_multiple', 'location', 'property_address',
        'available_to', 'debt_position', 'fund_aum',
        'sponsor_in_deal_pct', 'investing_geography'
      ]);

      const safeUpdates = {};
      for (const [key, val] of Object.entries(updates)) {
        if (allowedFields.includes(key) && val !== null && val !== undefined && val !== '') {
          safeUpdates[key] = val;
        }
      }

      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      safeUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('opportunities')
        .update(safeUpdates)
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({
        success: true,
        data,
        fields_updated: Object.keys(safeUpdates).filter(k => k !== 'updated_at')
      });
    }

    return res.status(400).json({ error: 'Unknown action. Valid: get-queue, enrich-deal, apply-enrichment' });

  } catch (err) {
    console.error('Deal cleanup error:', err);
    return res.status(500).json({ error: 'Cleanup failed: ' + err.message });
  }
}
