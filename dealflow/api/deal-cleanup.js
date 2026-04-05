// Vercel Serverless Function: /api/deal-cleanup
// AI-assisted deal data cleanup with multi-step enrichment pipeline:
//   Step 0: SEC EDGAR Form D lookup (authoritative source of truth)
//   Step 1: Extract from Deck PDF
//   Step 2: Extract from PPM PDF (fill remaining gaps)
//   Step 3: Web search (sponsor website, SEC Edgar, investclearly.com)
// API fallback chain: Gemini (free tier) → Anthropic → OpenAI

import { createRequire } from 'node:module';
import { getAdminClient, setCors, verifyAdmin } from './_supabase.js';
import { logReviewEvents } from './_review-events.js';
import { captureApiError, captureApiWarning } from './_sentry.js';
import { fetchAndStoreSecFiling, findSecMatchesForDeal } from './_sec-edgar.js';
import {
  buildDocumentInvestingStateSignals,
  extractExplicitStateCodes,
  formatStateCodesAsGeographyValue,
  mergeStateCodeLists
} from '../src/lib/utils/investing-geography.js';
import {
  buildReviewFieldEvidenceMap,
  normalizeReviewFieldEvidenceMap
} from '../src/lib/utils/reviewFieldEvidence.js';
import { dealFieldConfig } from '../src/lib/utils/dealReviewSchema.js';
import {
  applyReviewFieldStateToDeal,
  buildAiReviewFieldStateEntry,
  getReviewFieldDbColumn,
  getReviewFieldKeyForColumn,
  normalizeReviewFieldStateMap,
  resolveFinalReviewFieldValue
} from '../src/lib/utils/reviewFieldState.js';
import { computeExtractionConflicts } from './_reconciliation.js';

const EXTRACTION_TEXT_LIMIT = 120000;
const require = createRequire(import.meta.url);
let pdfNodePrimitivesReady = false;
let pdfNodePrimitivesWarningShown = false;
let pdfJsModulePromise = null;
let pdfJsWorkerModulePromise = null;

function ensurePdfNodePrimitives() {
  if (pdfNodePrimitivesReady) return;

  try {
    const canvas = require('@napi-rs/canvas');
    if (typeof globalThis.DOMMatrix === 'undefined' && canvas?.DOMMatrix) {
      globalThis.DOMMatrix = canvas.DOMMatrix;
    }
    if (typeof globalThis.DOMPoint === 'undefined' && canvas?.DOMPoint) {
      globalThis.DOMPoint = canvas.DOMPoint;
    }
    if (typeof globalThis.DOMRect === 'undefined' && canvas?.DOMRect) {
      globalThis.DOMRect = canvas.DOMRect;
    }
    if (typeof globalThis.ImageData === 'undefined' && canvas?.ImageData) {
      globalThis.ImageData = canvas.ImageData;
    }
    if (typeof globalThis.Path2D === 'undefined' && canvas?.Path2D) {
      globalThis.Path2D = canvas.Path2D;
    }
    pdfNodePrimitivesReady = true;
  } catch (error) {
    if (!pdfNodePrimitivesWarningShown) {
      pdfNodePrimitivesWarningShown = true;
      console.warn('[deal-cleanup] failed to initialize PDF node primitives', {
        message: error?.message || 'unknown_error'
      });
    }
  }
}

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
  { key: 'short_summary', label: 'Short Summary' },
  { key: 'underlying_exposure_types', label: 'Underlying Exposure Types' },
  { key: 'status', label: 'Status' },
  { key: 'risk_notes', label: 'Risk Notes' },
  { key: 'risk_tags', label: 'Risk Tags' },
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

function normalizeWhitespace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeDocumentText(value) {
  return String(value || '')
    .replace(/\r/g, '\n')
    .replace(/\u0000/g, '')
    .split('\n')
    .map((line) => normalizeWhitespace(line.replace(/([a-z])([A-Z])/g, '$1 $2')))
    .filter(Boolean)
    .join('\n');
}

function extractTextFromPdfBufferHeuristic(buffer) {
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

  return textChunks.join('\n').substring(0, EXTRACTION_TEXT_LIMIT);
}

async function getPdfJsModule() {
  if (!pdfJsModulePromise) {
    pdfJsModulePromise = import('pdfjs-dist/legacy/build/pdf.mjs');
  }
  return pdfJsModulePromise;
}

async function ensurePdfJsWorkerGlobal() {
  if (globalThis.pdfjsWorker?.WorkerMessageHandler) return globalThis.pdfjsWorker;

  if (!pdfJsWorkerModulePromise) {
    pdfJsWorkerModulePromise = import('pdfjs-dist/legacy/build/pdf.worker.mjs').then((workerModule) => {
      globalThis.pdfjsWorker = workerModule;
      return workerModule;
    });
  }

  return pdfJsWorkerModulePromise;
}

function buildPdfPageLines(textItems = []) {
  const lines = [];

  for (const item of textItems) {
    const value = String(item?.str || '').trim();
    if (!value) continue;

    const x = Number(item?.transform?.[4] || 0);
    const y = Number(item?.transform?.[5] || 0);

    let line = lines.find((entry) => Math.abs(entry.y - y) < 2);
    if (!line) {
      line = { y, parts: [] };
      lines.push(line);
    }

    line.parts.push({ x, value });
  }

  return lines
    .sort((left, right) => right.y - left.y)
    .map((line) =>
      line.parts
        .sort((left, right) => left.x - right.x)
        .map((part) => part.value)
        .join(' ')
    )
    .filter(Boolean);
}

async function extractPdfSnapshotFromBufferWithPdfJs(buffer) {
  ensurePdfNodePrimitives();
  await ensurePdfJsWorkerGlobal();

  const pdfjs = await getPdfJsModule();
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useWorkerFetch: false,
    isEvalSupported: false,
    verbosity: 0
  });

  const pdf = await loadingTask.promise;
  const pageChunks = [];
  const pages = [];

  try {
    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const pageLines = buildPdfPageLines(content?.items || []);
      const pageText = pageLines.join('\n');
      if (pageText) pageChunks.push(pageText);
      pages.push({
        pageNumber,
        lines: pageLines.map((text, index) => ({
          lineNumber: index + 1,
          text
        })),
        text: pageText
      });
    }
  } finally {
    await pdf.destroy();
  }

  return {
    text: pageChunks.join('\n\n'),
    pages
  };
}

function mergeDocumentText(...values) {
  const lines = [];
  const seen = new Set();

  for (const value of values) {
    const normalized = normalizeDocumentText(value);
    if (!normalized) continue;

    for (const line of normalized.split('\n')) {
      const cleaned = normalizeWhitespace(line);
      if (!cleaned) continue;
      const key = cleaned.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(cleaned);
    }
  }

  return lines.join('\n').slice(0, EXTRACTION_TEXT_LIMIT);
}

async function extractPdfSnapshotFromBuffer(buffer) {
  const heuristicText = extractTextFromPdfBufferHeuristic(buffer);
  let parsedSnapshot = { text: '', pages: [] };

  try {
    parsedSnapshot = await extractPdfSnapshotFromBufferWithPdfJs(buffer);
  } catch (error) {
    console.warn('[deal-cleanup] pdfjs extraction failed', {
      message: error?.message || 'unknown_error'
    });
  }

  return {
    text: mergeDocumentText(parsedSnapshot.text, heuristicText),
    pages: parsedSnapshot.pages || []
  };
}

async function extractTextFromPdfBuffer(buffer) {
  const snapshot = await extractPdfSnapshotFromBuffer(buffer);
  return snapshot.text;
}

function parseSupabaseStorageLocation(url = '') {
  try {
    const parsed = new URL(url);
    const signMarker = '/storage/v1/object/sign/';
    const publicMarker = '/storage/v1/object/public/';
    const authenticatedMarker = '/storage/v1/object/authenticated/';
    const marker = [signMarker, publicMarker, authenticatedMarker].find((value) => parsed.pathname.includes(value));
    if (!marker) return null;

    const [, remainder = ''] = parsed.pathname.split(marker);
    const segments = remainder.split('/').filter(Boolean);
    if (segments.length < 2) return null;
    const bucket = segments.shift();
    const path = decodeURIComponent(segments.join('/'));
    if (!bucket || !path) return null;
    return { bucket, path };
  } catch {
    return null;
  }
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
  "shortSummary": "2-3 sentence investor-facing summary of the deal: what it is, why it exists, and what an investor should understand immediately. Write for a sophisticated LP scanning a deal listing — clear, direct, no jargon.",
  "underlyingExposureTypes": "Array of asset or receivable types this fund lends against or invests in. Only use values from this list: [\"Multifamily\", \"Single Family\", \"Commercial Real Estate\", \"Industrial\", \"Retail\", \"Office\", \"Hospitality\", \"Self Storage\", \"Land\", \"Medical Receivables\", \"Aviation\", \"Education\", \"Consumer\", \"Small Business\", \"Equipment\", \"Mixed Portfolio\", \"Other\"]. Return null if this is not a lending fund or the underlying collateral is not described.",
  "targetIRR": "Target IRR as decimal (e.g. 0.15 for 15%)",
  "preferredReturn": "Preferred return as decimal (e.g. 0.08 for 8%)",
  "cashOnCash": "Cash on cash return as decimal if mentioned",
  "equityMultiple": "Target equity multiple (e.g. 2.0)",
  "investmentMinimum": "Minimum investment in dollars (number only)",
  "holdPeriod": "Hold period / lockup in years (number only)",
  "offeringSize": "Total offering size / equity raise in dollars (number only)",
  "purchasePrice": "Actual property purchase price from Sources & Uses table (number only). This is the total acquisition cost of the property, NOT the equity raise. For example if a building costs $26M and LPs raise $7.5M, the purchase price is 26000000",
  "offeringType": "506(b) or 506(c)",
  "availableTo": "Accredited Investors, Non-Accredited Investors, Both, or Qualified Purchasers if stated",
  "distributions": "Monthly, Quarterly, Annual, or None",
  "lpGpSplit": "e.g. 80/20",
  "fees": "Full fee structure description",
  "financials": "Audited or Unaudited",
  "investingGeography": "Geographic focus",
  "instrument": "Debt, Equity, Preferred Equity, or Hybrid",
  "secEntityName": "The exact legal entity name of the issuer as it appears in the PPM. This is the SEC filing entity, not the marketing name.",
  "issuerEntity": "The exact legal issuer entity being offered to the investor. Prefer the named Company or issuer from the PPM cover and opening paragraphs.",
  "gpEntity": "General partner or governing legal entity if explicitly named",
  "sponsorEntity": "Sponsor, manager, or operating entity legal name if explicitly named",
  "servicingAgentEntity": "Servicing, origination, or affiliated operating entity legal name if explicitly named",
  "issuerEntityType": "Issuer entity type exactly as stated",
  "issuerJurisdiction": "Issuer jurisdiction / state of formation exactly as stated",
  "issuerAddress": "Issuer mailing or business address exactly as stated",
  "issuerPhone": "Issuer phone number exactly as stated",
  "relatedPeople": "Array of people named in the PPM with role context, e.g. [{\"name\": \"Michael C. Anderson\", \"role\": \"President\"}]",
  "status": "One of: open, closed, coming_soon, evergreen, fully_funded, completed",
  "sourceRiskFactors": "Array of risk factors from the Risk Factors section. For each risk: {\"tag\": \"one of [Leverage, Liquidity, Credit Loss, Concentration, Refinancing, Interest Rate, Sponsor, Key Personnel, Execution, Regulatory, Valuation, Counterparty, Tax, Operational, Insufficient Cash Flow, Transfer Restrictions, Unspecified Investments, Litigation, Limited Recourse, Economic/Market Conditions, Capital Call Risk, Nonperforming Loans, Environmental]\", \"title\": \"Short LP-friendly title\", \"quote\": \"Key sentence from the document\", \"source\": \"PPM §X / page Y\"}. Skip boilerplate risks (terrorism, pandemics, acts of God, general economic uncertainty, cybersecurity, force majeure). Focus on risks SPECIFIC to this deal.",
  "riskTags": "Array of risk tag strings from the standardized list: [Leverage, Liquidity, Credit Loss, Concentration, Refinancing, Interest Rate, Sponsor, Key Personnel, Execution, Regulatory, Valuation, Counterparty, Tax, Operational, Insufficient Cash Flow, Transfer Restrictions, Unspecified Investments, Litigation, Limited Recourse, Economic/Market Conditions, Capital Call Risk, Nonperforming Loans, Environmental]. Include ONLY tags that apply to this specific deal.",
  "riskNotes": "2-4 sentence LP-facing summary of the key risks. Write for an accredited investor — be specific about what could go wrong. Do NOT copy PPM legalese."
}

IMPORTANT:
- For percentages, convert to decimals (15% → 0.15)
- For dollar amounts, return raw numbers (no $ or commas)
- If a field clearly doesn't apply to this deal type, use null
- Be precise — only extract what's explicitly stated, don't infer
- For secEntityName and issuerEntity, return the exact legal issuer name rather than the marketing name
- Use the full document as context, not only the cover pages, but prefer the most formal issuer definition when multiple names appear`;

const SEC_IDENTITY_PROMPT = `You are a private placement compliance analyst. Extract the exact SEC issuer identity and related legal entities from this full PPM, offering memorandum, or subscription document. Return ONLY valid JSON with these exact keys and use null when unknown.

{
  "issuerEntity": "Exact legal issuer entity being offered to the investor",
  "secEntityName": "Exact legal entity name that would appear on a Form D filing, if stated",
  "gpEntity": "General partner or governing entity if explicitly stated",
  "sponsorEntity": "Sponsor, manager, or operating entity legal name if explicitly stated",
  "servicingAgentEntity": "Servicing or loan-origination legal entity if explicitly stated",
  "issuerEntityType": "Issuer entity type exactly as stated",
  "issuerJurisdiction": "Issuer jurisdiction / state of formation exactly as stated",
  "issuerAddress": "Issuer mailing or business address exactly as stated",
  "issuerPhone": "Issuer phone number exactly as stated",
  "offeringType": "506(b), 506(c), Reg D, Reg A, or other if explicitly stated",
  "investmentMinimum": "Minimum investment in dollars (number only)",
  "relatedPeople": "Array of key people named in the PPM with role context, e.g. [{\"name\": \"Michael C. Anderson\", \"role\": \"President\"}]"
}

IMPORTANT:
- Prefer the named Company or issuer from the formal opening language over marketing names.
- Use the full document as context, not just the first pages.
- Do not infer a legal entity if the document does not explicitly state it.`;

// Use shared field map — only keys present in AI output get persisted
import { getDealFieldMapWithHistoricalReturns } from './_field-map.js';
const FIELD_MAP = getDealFieldMapWithHistoricalReturns();

function cleanEntityValue(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function dedupeStrings(values = []) {
  const seen = new Set();
  const deduped = [];
  for (const value of values) {
    const cleaned = cleanEntityValue(value);
    if (!cleaned) continue;
    const key = cleaned.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(cleaned);
  }
  return deduped;
}

function extractIssuerHintFromText(text) {
  const raw = String(text || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const patterns = [
    /([A-Z][A-Za-z0-9,&.'’()\- ]+?\b(?:LLC|L\.L\.C\.|LP|L\.P\.|INC\.?|CORP\.?|TRUST))\s*,?\s+an?\s+[A-Za-z ,\-]+limited liability company/i,
    /([A-Z][A-Za-z0-9,&.'’()\- ]+?\b(?:LLC|L\.L\.C\.|LP|L\.P\.|INC\.?|CORP\.?|TRUST))\s+is pleased to offer/i,
    /Private Placement Memorandum[^A-Za-z0-9]+([A-Z][A-Za-z0-9,&.'’()\- ]+?\b(?:LLC|L\.L\.C\.|LP|L\.P\.|INC\.?|CORP\.?|TRUST))/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match?.[1]) return cleanEntityValue(match[1]);
  }

  return '';
}

function mergeSecIdentityFields(target, identity = {}) {
  if (identity.issuerEntity && !target.issuer_entity) {
    target.issuer_entity = identity.issuerEntity;
  }
  if ((identity.secEntityName || identity.issuerEntity) && !target.sec_entity_name) {
    target.sec_entity_name = identity.secEntityName || identity.issuerEntity;
  }
  if (identity.gpEntity && !target.gp_entity) {
    target.gp_entity = identity.gpEntity;
  }
  if (identity.sponsorEntity && !target.sponsor_entity) {
    target.sponsor_entity = identity.sponsorEntity;
  }
  if (identity.offeringType && !target.offering_type) {
    target.offering_type = identity.offeringType;
  }
  if (identity.investmentMinimum && !target.investment_minimum) {
    target.investment_minimum = identity.investmentMinimum;
  }
}

function buildSecIdentityContext(extracted = {}, ppmText = '') {
  const issuerHint = extractIssuerHintFromText(ppmText);
  const issuerEntity = cleanEntityValue(
    extracted.issuerEntity || extracted.secEntityName || extracted.entityInvestedInto || issuerHint
  );
  const secEntityName = cleanEntityValue(extracted.secEntityName || issuerEntity);
  const gpEntity = cleanEntityValue(extracted.gpEntity);
  const sponsorEntity = cleanEntityValue(extracted.sponsorEntity || extracted.managementCompany);
  const servicingAgentEntity = cleanEntityValue(extracted.servicingAgentEntity);

  return {
    issuerEntity,
    secEntityName,
    gpEntity,
    sponsorEntity,
    servicingAgentEntity,
    offeringType: cleanEntityValue(extracted.offeringType),
    investmentMinimum: (() => {
      const rawMinimum =
        typeof extracted.investmentMinimum === 'number'
          ? extracted.investmentMinimum
          : extracted.investmentMinimum
            ? Number(String(extracted.investmentMinimum).replace(/[$,]/g, '').trim())
            : null;
      return Number.isFinite(rawMinimum) ? rawMinimum : null;
    })(),
    queryPriority: dedupeStrings([
      issuerEntity,
      secEntityName,
      extracted.investmentName,
      sponsorEntity,
      servicingAgentEntity
    ])
  };
}

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
  try {
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'GYC Research pascal@growyourcashflow.com'
      }
    });
    if (resp.ok) {
      const arrayBuf = await resp.arrayBuffer();
      return Buffer.from(arrayBuf);
    }
  } catch {}

  const storageLocation = parseSupabaseStorageLocation(url);
  if (!storageLocation) throw new Error('PDF download failed');

  const { data, error } = await supabase.storage.from(storageLocation.bucket).download(storageLocation.path);
  if (error || !data) throw new Error(error?.message || 'storage_download_failed');

  return Buffer.from(await data.arrayBuffer());
}

async function loadDealSourceTexts(supabase, deal) {
  const sourceTexts = {
    ppmText: '',
    ppmPages: [],
    deckText: '',
    deckPages: []
  };

  if (deal?.ppm_url) {
    const ppmBuffer = await downloadPdf(supabase, deal.ppm_url);
    const ppmSnapshot = await extractPdfSnapshotFromBuffer(ppmBuffer);
    sourceTexts.ppmText = ppmSnapshot.text;
    sourceTexts.ppmPages = ppmSnapshot.pages;
  }

  if (deal?.deck_url) {
    const deckBuffer = await downloadPdf(supabase, deal.deck_url);
    const deckSnapshot = await extractPdfSnapshotFromBuffer(deckBuffer);
    sourceTexts.deckText = deckSnapshot.text;
    sourceTexts.deckPages = deckSnapshot.pages;
  }

  return sourceTexts;
}

async function loadDealLinkedSecFiling(supabase, dealId) {
  const { data: verificationRecord, error: verificationError } = await supabase
    .from('deal_sec_verification')
    .select('sec_filing:sec_filings(*)')
    .eq('opportunity_id', dealId)
    .maybeSingle();

  if (verificationError && !['PGRST116', '42P01', 'PGRST205'].includes(verificationError.code)) {
    throw verificationError;
  }

  if (verificationRecord?.sec_filing) return verificationRecord.sec_filing;

  const { data: filing, error: filingError } = await supabase
    .from('sec_filings')
    .select('*')
    .eq('opportunity_id', dealId)
    .order('is_latest_amendment', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (filingError && !['PGRST116', '42P01', 'PGRST205'].includes(filingError.code)) {
    throw filingError;
  }

  return filing || null;
}

function getReviewEvidenceFieldKeys(fieldKeys = []) {
  const requestedFieldKeys = Array.isArray(fieldKeys) ? fieldKeys.filter(Boolean) : [];
  if (requestedFieldKeys.length > 0) return [...new Set(requestedFieldKeys)];

  return Object.keys(dealFieldConfig).filter((fieldKey) => fieldKey !== 'teamContacts');
}

function buildReviewEvidenceDocuments(deal, sourceTexts = {}) {
  return {
    ppm: {
      text: sourceTexts.ppmText || '',
      pages: sourceTexts.ppmPages || [],
      url: deal?.ppm_url || deal?.ppmUrl || ''
    },
    deck: {
      text: sourceTexts.deckText || '',
      pages: sourceTexts.deckPages || [],
      url: deal?.deck_url || deal?.deckUrl || ''
    }
  };
}

function buildClassificationSignals(deal, { ppmText = '', deckText = '' } = {}) {
  const documentSignals = buildDocumentInvestingStateSignals({ ppmText, deckText });
  const currentStates = mergeStateCodeLists(
    deal?.investing_states || deal?.investingStates || [],
    extractExplicitStateCodes(deal?.investing_geography || deal?.investingGeography || deal?.location || '')
  );
  const suggestedStates = documentSignals.suggestedStates;

  return {
    ppmStates: documentSignals.ppmStates,
    deckStates: documentSignals.deckStates,
    suggestedStates,
    currentStates,
    missingSuggestedStates: suggestedStates.filter((stateCode) => !currentStates.includes(stateCode)),
    extraCurrentStates: currentStates.filter((stateCode) => !suggestedStates.includes(stateCode))
  };
}

function filterFoundFieldUpdates(foundFields = {}, requestedFieldKeys = []) {
  const normalizedFieldKeys = Array.from(new Set((requestedFieldKeys || []).filter(Boolean)));
  if (normalizedFieldKeys.length === 0) {
    return foundFields;
  }

  const requestedSet = new Set(normalizedFieldKeys);
  return Object.fromEntries(
    Object.entries(foundFields).filter(([key]) => {
      const translatedFieldKey = getReviewFieldKeyForColumn(key);
      return requestedSet.has(key) || requestedSet.has(translatedFieldKey);
    })
  );
}


// ── Auto-resolve helper ──────────────────────────────────────────────────────

/**
 * Write auto-resolved fields (fields with no prior aiValue) directly to
 * review_field_state without requiring reviewer interaction.  Also
 * materializes values to the corresponding flat DB columns where available.
 *
 * @param {object} supabase          Supabase admin client
 * @param {string} dealId            UUID of the deal
 * @param {object} dealRow           Current DB row for the deal
 * @param {Array}  autoResolvedFields From computeConflictsFromState().autoResolved
 * @param {string} runId             extraction_runs.id — stamped on each entry
 */
async function applyAutoResolvedToReviewState(supabase, dealId, dealRow, autoResolvedFields, runId) {
  if (!autoResolvedFields || autoResolvedFields.length === 0) return;

  const availableColumns = new Set(Object.keys(dealRow || {}));
  if (!availableColumns.has('review_field_state')) return;

  const reviewFieldState = normalizeReviewFieldStateMap(dealRow.review_field_state || {});
  const nextReviewFieldState = { ...reviewFieldState };
  const materializedUpdates = {};
  const now = new Date().toISOString();

  for (const { fieldKey, extractedValue } of autoResolvedFields) {
    nextReviewFieldState[fieldKey] = buildAiReviewFieldStateEntry({}, {
      nextValue: extractedValue,
      source: 'ai_extraction',
      at: now,
      extractionRunId: runId
    });
    const columnName = getReviewFieldDbColumn(fieldKey);
    if (
      columnName
      && availableColumns.has(columnName)
      && extractedValue !== null
      && extractedValue !== undefined
      && extractedValue !== ''
    ) {
      materializedUpdates[columnName] = extractedValue;
    }
  }

  materializedUpdates.review_field_state = nextReviewFieldState;
  materializedUpdates.updated_at = now;

  const { error } = await supabase
    .from('opportunities')
    .update(materializedUpdates)
    .eq('id', dealId);

  if (error) {
    throw new Error(`applyAutoResolvedToReviewState: DB update failed: ${error.message}`);
  }
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

async function enrichDeal(supabase, deal, operatorName, { forceRun = false } = {}) {
  const missingFields = getMissingFields(deal);
  if (missingFields.length === 0 && !forceRun) {
    return { found_fields: {}, confidence: {}, sources: [], steps: [], notes: 'Already 100% complete' };
  }

  const allFound = {};
  const allConfidence = {};
  const allSources = [];
  const steps = [];
  let ppmTextCache = '';
  let deckTextCache = '';
  let secIdentity = {
    issuerEntity: cleanEntityValue(deal.issuer_entity),
    secEntityName: cleanEntityValue(deal.sec_entity_name || deal.issuer_entity),
    gpEntity: cleanEntityValue(deal.gp_entity),
    sponsorEntity: cleanEntityValue(deal.sponsor_entity || operatorName),
    servicingAgentEntity: '',
    offeringType: cleanEntityValue(deal.offering_type),
    investmentMinimum: deal.investment_minimum || null,
    queryPriority: dedupeStrings([deal.issuer_entity, deal.sec_entity_name, deal.investment_name, operatorName])
  };

  // Helper: which fields are still missing after merging found data.
  // When forceRun=true, always reports at least one missing entry so that
  // the PPM extraction step runs even if standard quality fields are all filled.
  function stillMissing() {
    const tempDeal = { ...deal };
    for (const [k, v] of Object.entries(allFound)) {
      if (v !== null && v !== undefined) tempDeal[k] = v;
    }
    const missing = getMissingFields(tempDeal);
    if (forceRun && missing.length === 0) {
      return [{ key: '__forced__', label: 'forced re-extraction' }];
    }
    return missing;
  }

  // ── Step 0a: Extract issuer identity from the full PPM before SEC search ─
  if (deal.ppm_url) {
    try {
      const pdfBuffer = await downloadPdf(supabase, deal.ppm_url);
      ppmTextCache = await extractTextFromPdfBuffer(pdfBuffer);

      const heuristicIssuer = extractIssuerHintFromText(ppmTextCache);
      let identityFieldCount = heuristicIssuer ? 1 : 0;
      const identityStep = { step: 'ppm_issuer_identity', fields_found: 0, note: '' };

      if (ppmTextCache && ppmTextCache.length >= 100) {
        const result = await callAI(SEC_IDENTITY_PROMPT + '\n\nDOCUMENT TEXT:\n' + ppmTextCache);
        const extracted = parseAIResponse(result.text) || {};
        secIdentity = buildSecIdentityContext(
          {
            ...extracted,
            issuerEntity: extracted.issuerEntity || heuristicIssuer || extracted.secEntityName
          },
          ppmTextCache
        );

        const beforeMergeCount = Object.keys(allFound).length;
        mergeSecIdentityFields(allFound, secIdentity);
        identityFieldCount += Object.keys(allFound).length - beforeMergeCount;
        if (secIdentity.issuerEntity) allConfidence.issuer_entity = 'high';
        if (secIdentity.secEntityName || secIdentity.issuerEntity) allConfidence.sec_entity_name = 'high';
        if (secIdentity.gpEntity) allConfidence.gp_entity = 'high';
        if (secIdentity.sponsorEntity) allConfidence.sponsor_entity = 'high';
        identityStep.fields_found = identityFieldCount;
        identityStep.api = result.api_used;
        identityStep.note = secIdentity.issuerEntity
          ? `Primary issuer entity identified as ${secIdentity.issuerEntity}.`
          : 'No exact issuer legal entity was identified from the PPM.';
      } else {
        identityStep.note = 'PPM text was too sparse for issuer extraction.';
      }

      steps.push(identityStep);
    } catch (err) {
      steps.push({ step: 'ppm_issuer_identity', fields_found: 0, error: err.message });
    }
  } else {
    steps.push({ step: 'ppm_issuer_identity', fields_found: 0, note: 'No PPM uploaded' });
  }

  // ── Step 0b: SEC EDGAR Form D lookup (authoritative) ──────────────────
  try {
    const searchSeed = {
      ...deal,
      investment_name: deal.investment_name || secIdentity.issuerEntity || secIdentity.secEntityName || '',
      sponsor_name: deal.sponsor_name || (operatorName && operatorName !== '—' ? operatorName : ''),
      issuer_entity: secIdentity.issuerEntity || deal.issuer_entity || '',
      gp_entity: secIdentity.gpEntity || deal.gp_entity || '',
      sponsor_entity: secIdentity.sponsorEntity || deal.sponsor_entity || '',
      offering_type: deal.offering_type || secIdentity.offeringType || '',
      investment_minimum: deal.investment_minimum || secIdentity.investmentMinimum || null,
      management_company: {
        operator_name: operatorName && operatorName !== '—' ? operatorName : '',
        legal_entity: secIdentity.sponsorEntity || ''
      }
    };
    const secSearch = await findSecMatchesForDeal(searchSeed, { maxQueries: 8 });
    if (secSearch.bestMatch) {
      const stored = await fetchAndStoreSecFiling({
        supabase,
        match: secSearch.bestMatch,
        opportunityId: deal.id,
        managementCompanyId: deal.management_company_id || null
      });
      const filing = stored.filing || {};
      const is506b = Array.isArray(filing.federal_exemptions) && filing.federal_exemptions.includes('06b');
      const is506c = Array.isArray(filing.federal_exemptions) && filing.federal_exemptions.includes('06c');

      if (is506b) { allFound.offering_type = '506(b)'; allConfidence.offering_type = 'verified'; }
      else if (is506c) { allFound.offering_type = '506(c)'; allConfidence.offering_type = 'verified'; }
      if (is506b) allFound.is_506b = true;
      if (filing.cik) allFound.sec_cik = filing.cik;
      if (filing.minimum_investment) { allFound.investment_minimum = filing.minimum_investment; allConfidence.investment_minimum = 'verified'; }
      if (filing.total_offering_amount) { allFound.offering_size = filing.total_offering_amount; allConfidence.offering_size = 'verified'; }
      if (filing.total_amount_sold) allFound.total_amount_sold = filing.total_amount_sold;
      if (filing.total_investors) allFound.total_investors = filing.total_investors;
      if (filing.date_of_first_sale) allFound.date_of_first_sale = filing.date_of_first_sale;
      if (!deal.investment_name && filing.entity_name) { allFound.investment_name = filing.entity_name; allConfidence.investment_name = 'verified'; }
      if (filing.entity_name && !allFound.issuer_entity) {
        allFound.issuer_entity = filing.entity_name;
        allFound.sec_entity_name = filing.entity_name;
        allConfidence.issuer_entity = 'verified';
        allConfidence.sec_entity_name = 'verified';
      }

      allSources.push('SEC EDGAR Form D');
      steps.push({
        step: 'sec_form_d',
        fields_found: ['offering_type', 'sec_cik', 'investment_minimum', 'offering_size', 'total_amount_sold', 'total_investors', 'date_of_first_sale', 'issuer_entity']
          .filter((key) => allFound[key] !== undefined && allFound[key] !== null && allFound[key] !== '')
          .length,
        matched_entity: filing.entity_name || secSearch.bestMatch.entityName || '',
        accession: filing.accession_number || secSearch.bestMatch.accession || '',
        cik: filing.cik || secSearch.bestMatch.cik || '',
        queries: secSearch.queries,
        note: `Matched SEC filing ${filing.accession_number || secSearch.bestMatch.accession || ''} using ${secIdentity.issuerEntity ? 'issuer legal entity first' : 'deal-name first'} search order.`
      });
    } else {
      steps.push({
        step: 'sec_form_d',
        fields_found: 0,
        queries: secSearch.queries,
        note: 'No SEC Form D match found from the current issuer, deal, and sponsor search terms.'
      });
    }
  } catch (edgarErr) {
    console.error('EDGAR Step 0 error:', edgarErr);
    steps.push({ step: 'sec_form_d', fields_found: 0, error: edgarErr.message });
  }

  // ── Step 1: Extract from Deck PDF ──────────────────────────────────────
  if (deal.deck_url) {
    try {
      if (!deckTextCache) {
        const pdfBuffer = await downloadPdf(supabase, deal.deck_url);
        deckTextCache = await extractTextFromPdfBuffer(pdfBuffer);
      }
      const pdfText = deckTextCache;

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
      if (!ppmTextCache) {
        const pdfBuffer = await downloadPdf(supabase, deal.ppm_url);
        ppmTextCache = await extractTextFromPdfBuffer(pdfBuffer);
      }
      const pdfText = ppmTextCache;

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
          mergeSecIdentityFields(allFound, buildSecIdentityContext(extracted, pdfText));
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

  const classificationSignals = buildClassificationSignals(deal, {
    ppmText: ppmTextCache,
    deckText: deckTextCache
  });
  if (classificationSignals.suggestedStates.length > 0) {
    allFound.investing_states = classificationSignals.suggestedStates;
    allConfidence.investing_states = 'high';
    allFound.investing_geography = formatStateCodesAsGeographyValue(classificationSignals.suggestedStates);
    allConfidence.investing_geography = 'high';
    steps.push({
      step: 'classification_geography',
      fields_found: 2,
      ppm_states: classificationSignals.ppmStates,
      deck_states: classificationSignals.deckStates,
      suggested_states: classificationSignals.suggestedStates,
      note: classificationSignals.missingSuggestedStates.length > 0
        ? `Merged ${classificationSignals.missingSuggestedStates.length} additional states from the source documents into the Classification suggestion set.`
        : 'Source-document geography was merged into the Classification suggestion set.'
    });
  }

  // Expand historicalReturns array into individual year fields
  if (Array.isArray(allFound.historicalReturns) && allFound.historicalReturns.length > 0) {
    for (const entry of allFound.historicalReturns) {
      const year = entry?.year;
      const value = entry?.value;
      if (year && year >= 2015 && year <= 2099 && value != null) {
        const fieldKey = `historicalReturn${year}`;
        if (!allFound[fieldKey]) {
          allFound[fieldKey] = typeof value === 'number' && Math.abs(value) <= 1
            ? value * 100  // Convert decimal to percentage
            : value;
        }
      }
    }
    delete allFound.historicalReturns;
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
  const adminUser = auth.user || null;

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
    if (action === 'classification-signals') {
      const { dealId } = req.body;
      if (!dealId) return res.status(400).json({ error: 'Missing dealId' });

      const { data: deal, error: dealErr } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', dealId)
        .single();

      if (dealErr) {
        console.error('[deal-cleanup/classification-signals] deal lookup failed', {
          dealId,
          message: dealErr.message
        });
        return res.status(500).json({ error: 'Failed to inspect the deal record' });
      }

      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      const { ppmText, deckText } = await loadDealSourceTexts(supabase, deal);
      const signals = buildClassificationSignals(deal, { ppmText, deckText });

      return res.status(200).json({
        success: true,
        deal_id: dealId,
        ...signals
      });
    }

    if (action === 'review-field-evidence') {
      const { dealId, fieldKeys, persist = true } = req.body || {};
      if (!dealId) return res.status(400).json({ error: 'Missing dealId' });

      const { data: deal, error: dealErr } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', dealId)
        .single();

      if (dealErr) {
        console.error('[deal-cleanup/review-field-evidence] deal lookup failed', {
          dealId,
          message: dealErr.message
        });
        return res.status(500).json({ error: 'Failed to inspect the deal record' });
      }

      if (!deal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      const reviewFieldKeys = getReviewEvidenceFieldKeys(fieldKeys);
      const sourceTexts = await loadDealSourceTexts(supabase, deal);
      const filing = await loadDealLinkedSecFiling(supabase, dealId);
      const nextEvidence = buildReviewFieldEvidenceMap({
        deal,
        fieldKeys: reviewFieldKeys,
        documents: buildReviewEvidenceDocuments(deal, sourceTexts),
        filing
      });

      const existingEvidence = normalizeReviewFieldEvidenceMap(deal.review_field_evidence || {});
      const mergedEvidence = { ...existingEvidence };
      for (const fieldKey of reviewFieldKeys) {
        delete mergedEvidence[fieldKey];
      }
      Object.assign(mergedEvidence, normalizeReviewFieldEvidenceMap(nextEvidence));

      let updatedDeal = deal;
      if (persist === true && 'review_field_evidence' in deal) {
        const { data: persistedDeal, error: persistError } = await supabase
          .from('opportunities')
          .update({
            review_field_evidence: mergedEvidence,
            updated_at: new Date().toISOString()
          })
          .eq('id', dealId)
          .select('*')
          .single();

        if (persistError) {
          console.error('[deal-cleanup/review-field-evidence] persist failed', {
            dealId,
            message: persistError.message
          });
          return res.status(500).json({ error: 'Failed to persist review field evidence' });
        }

        updatedDeal = persistedDeal || deal;
      } else {
        updatedDeal = {
          ...deal,
          review_field_evidence: mergedEvidence
        };
      }

      return res.status(200).json({
        success: true,
        deal_id: dealId,
        field_keys: reviewFieldKeys,
        field_evidence: nextEvidence,
        review_field_evidence: mergedEvidence,
        deal: updatedDeal
      });
    }

    // Action: enrich a single deal via multi-step pipeline
    if (action === 'enrich-deal') {
      const {
        dealId,
        fieldKeys = [],
        documentRef = null,   // deck_submissions.id — used for deduplication
        triggeredBy = 'manual'
      } = req.body;
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
      // When specific fieldKeys are requested, always run extraction even if the deal
      // appears "complete" by the standard quality-fields check — the caller is explicitly
      // asking for those fields to be (re-)extracted and written to review_field_state.
      const forceRun = fieldKeys.length > 0;

      if (missingFields.length === 0 && !forceRun) {
        return res.status(200).json({
          success: true,
          deal_id: dealId,
          message: 'Deal is already 100% complete',
          found_fields: {},
          steps: [],
          current_data: deal
        });
      }

      // Deduplication: if a document_ref is provided, check whether a complete
      // or partial extraction run already exists for that exact document.
      // Avoids re-running the expensive pipeline on the same PDF twice.
      if (documentRef) {
        const { data: existingRun } = await supabase
          .from('extraction_runs')
          .select('id, status, fields_extracted, extraction_source')
          .eq('deal_id', dealId)
          .eq('document_ref', documentRef)
          .in('status', ['complete', 'partial'])
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingRun) {
          console.log(`[deal-cleanup/enrich-deal] skipping re-extraction — run ${existingRun.id} already exists for document_ref ${documentRef} (status=${existingRun.status})`);
          console.info('[deal-cleanup/enrich-deal] extraction_skipped_duplicate', { dealId, existingRunId: existingRun.id, documentRef });
          return res.status(200).json({
            success: true,
            deal_id: dealId,
            skipped: true,
            existing_run_id: existingRun.id,
            existing_run_status: existingRun.status,
            found_fields: existingRun.fields_extracted || {},
            sources: existingRun.extraction_source ? [existingRun.extraction_source] : [],
            steps: [],
            notes: `Skipped — extraction run ${existingRun.id} already exists for this document (status=${existingRun.status})`,
            current_data: deal,
            operator_name: operatorName,
            missing_fields: missingFields.map(f => ({ key: f.key, label: f.label }))
          });
        }
      }

      // Insert extraction_runs row before starting (status='running')
      let extractionRunId = null;
      const runInsert = {
        deal_id: dealId,
        triggered_by: triggeredBy,
        document_ref: documentRef || null,
        status: 'running',
        started_at: new Date().toISOString()
      };
      const { data: runRow, error: runInsertError } = await supabase
        .from('extraction_runs')
        .insert(runInsert)
        .select('id')
        .single();
      if (runInsertError) {
        // Non-fatal: extraction proceeds even if run tracking fails
        console.warn('[deal-cleanup/enrich-deal] failed to insert extraction_run:', runInsertError.message);
      } else {
        extractionRunId = runRow?.id || null;
      }
      console.info('[deal-cleanup/enrich-deal] extraction_started', { dealId, triggeredBy, documentRef, extractionRunId });

      // Run the multi-step enrichment pipeline
      let result;
      let runStatus = 'failed';
      let runErrorDetail = null;
      try {
        result = await enrichDeal(supabase, deal, operatorName, { forceRun });
        const hasStepErrors = result.steps.some(s => s.error);
        runStatus = hasStepErrors ? 'partial' : 'complete';
        if (hasStepErrors) {
          runErrorDetail = result.steps
            .filter(s => s.error)
            .map(s => `${s.step}: ${s.error}`)
            .join('; ');
          captureApiWarning('extraction_partial', {
            endpoint: 'POST /api/deal-cleanup enrich-deal',
            dealId,
            documentRef,
            failedSteps: result.steps.filter(s => s.error).map(s => ({ step: s.step, error: s.error }))
          });
        }
      } catch (enrichErr) {
        runStatus = 'failed';
        runErrorDetail = enrichErr.message;
        captureApiError(enrichErr, {
          endpoint: 'POST /api/deal-cleanup enrich-deal',
          dealId,
          documentRef,
          extractionRunId
        });
        console.info('[deal-cleanup/enrich-deal] extraction_failed', { dealId, documentRef, extractionRunId, failureReason: enrichErr.message });
        // Update run row to failed before re-throwing
        if (extractionRunId) {
          await supabase.from('extraction_runs').update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_detail: enrichErr.message
          }).eq('id', extractionRunId);
        }
        throw enrichErr;
      }

      // Update extraction_runs row: status, completed_at, fields_extracted, extraction_source
      if (extractionRunId) {
        const primaryStep = result.steps.find(s => s.fields_found > 0 && s.api);
        const extractionSource = primaryStep?.api || null;
        await supabase.from('extraction_runs').update({
          status: runStatus,
          completed_at: new Date().toISOString(),
          fields_extracted: result.found_fields || {},
          extraction_source: extractionSource,
          error_detail: runErrorDetail
        }).eq('id', extractionRunId);
        const fieldsExtractedCount = Object.keys(result.found_fields || {}).length;
        console.info('[deal-cleanup/enrich-deal] extraction_completed', {
          dealId,
          extractionRunId,
          runStatus,
          fieldsExtracted: fieldsExtractedCount,
          source: extractionSource,
          documentRef
        });
      }

      // ── Conflict detection + auto-resolution ────────────────────────────────
      // Run after the extraction_runs row is finalized.  partialFailures from
      // WS4 do not block this — we operate on whatever was successfully extracted.
      let pendingReconciliationId = null;
      let autoResolvedCount = 0;
      let conflictCount = 0;
      let protectedCount = 0;

      if (extractionRunId && runStatus !== 'failed') {
        try {
          const conflictResult = await computeExtractionConflicts(dealId, extractionRunId, supabase);
          autoResolvedCount = conflictResult.autoResolved.length;
          conflictCount = conflictResult.conflicts.length;
          protectedCount = conflictResult.protected.length;

          // Apply auto-resolved fields immediately — no reviewer decision needed.
          if (conflictResult.autoResolved.length > 0) {
            await applyAutoResolvedToReviewState(
              supabase, dealId, deal, conflictResult.autoResolved, extractionRunId
            );
          }

          // Insert a reconciliation task for fields that need reviewer attention.
          if (conflictResult.conflicts.length > 0) {
            const { data: reconTask, error: reconInsertError } = await supabase
              .from('reconciliation_tasks')
              .insert({
                deal_id: dealId,
                extraction_run_id: extractionRunId,
                status: 'pending',
                conflict_fields: conflictResult.conflicts
              })
              .select('id')
              .single();

            if (reconInsertError) {
              console.warn('[deal-cleanup/enrich-deal] reconciliation_tasks insert failed (non-fatal)', {
                dealId,
                extractionRunId,
                message: reconInsertError.message
              });
            } else {
              pendingReconciliationId = reconTask?.id || null;
              console.info('[deal-cleanup/enrich-deal] reconciliation task created', {
                dealId,
                extractionRunId,
                conflictCount,
                autoResolvedCount,
                protectedCount,
                pendingReconciliationId
              });
            }
          }
        } catch (conflictErr) {
          // Non-fatal: conflict detection failure must not fail the extraction response.
          console.warn('[deal-cleanup/enrich-deal] conflict detection failed (non-fatal)', {
            dealId,
            extractionRunId,
            message: conflictErr?.message || 'unknown_error'
          });
        }
      }

      const filteredFoundFields = filterFoundFieldUpdates(result.found_fields, fieldKeys);
      const filteredConfidence = Object.fromEntries(
        Object.entries(result.confidence || {}).filter(([fieldKey]) =>
          Object.prototype.hasOwnProperty.call(filteredFoundFields, fieldKey)
        )
      );

      return res.status(200).json({
        success: true,
        deal_id: dealId,
        extraction_run_id: extractionRunId,
        run_status: runStatus,
        found_fields: filteredFoundFields,
        confidence: filteredConfidence,
        sources: result.sources,
        steps: result.steps,
        notes: result.notes,
        current_data: deal,
        operator_name: operatorName,
        missing_fields: missingFields.map(f => ({ key: f.key, label: f.label })),
        pending_reconciliation_id: pendingReconciliationId,
        auto_resolved_count: autoResolvedCount,
        conflict_count: conflictCount,
        protected_count: protectedCount
      });
    }

    // Action: apply approved enrichments to a deal
    if (action === 'apply-enrichment') {
      const {
        dealId,
        updates,
        overwriteAdmin = false,
        forceFieldKeys = [],
        // extractionRunId links each aiValue entry back to its source run.
        // Pass this from the enrich-deal response when confirming enrichment.
        extractionRunId = ''
      } = req.body;
      if (!dealId) return res.status(400).json({ error: 'Missing dealId' });
      if (!updates || Object.keys(updates).length === 0) {
        return res.status(400).json({ error: 'No updates to apply' });
      }

      const { data: currentDeal, error: currentDealError } = await supabase
        .from('opportunities')
        .select('*')
        .eq('id', dealId)
        .single();

      if (currentDealError) {
        console.error('[deal-cleanup/apply-enrichment] deal lookup failed', {
          dealId,
          message: currentDealError.message
        });
        return res.status(500).json({ error: 'Failed to load the deal before applying enrichment' });
      }

      if (!currentDeal) {
        return res.status(404).json({ error: 'Deal not found' });
      }

      const availableColumns = new Set(Object.keys(currentDeal || {}));
      const reviewFieldStateSupported = availableColumns.has('review_field_state');
      const reviewStateVersionSupported = availableColumns.has('review_state_version');
      const actorEmail = String(adminUser?.email || '').trim().toLowerCase();
      const actorName = String(adminUser?.user_metadata?.full_name || adminUser?.user_metadata?.name || '').trim();

      const allowedFields = Array.from(new Set([
        ...QUALITY_FIELDS.map(f => f.key),
        ...Object.values(FIELD_MAP),
        'equity_multiple',
        'location',
        'property_address',
        'available_to',
        'debt_position',
        'fund_aum',
        'sponsor_in_deal_pct',
        'investing_geography',
        'investing_states',
        'sec_cik',
        'date_of_first_sale',
        'total_amount_sold',
        'total_investors',
        'is_506b'
      ]));

      const safeUpdates = {};
      for (const [key, val] of Object.entries(updates)) {
        if (allowedFields.includes(key) && val !== null && val !== undefined && val !== '') {
          safeUpdates[key] = val;
        }
      }

      if (
        Array.isArray(safeUpdates.investing_states)
        && safeUpdates.investing_states.length > 0
        && !availableColumns.has('investing_states')
        && availableColumns.has('investing_geography')
        && !safeUpdates.investing_geography
      ) {
        safeUpdates.investing_geography = formatStateCodesAsGeographyValue(safeUpdates.investing_states);
      }

      for (const key of Object.keys(safeUpdates)) {
        const stateBackedFieldKey = getReviewFieldKeyForColumn(key);
        if (
          !availableColumns.has(key)
          && key !== 'updated_at'
          && !(reviewFieldStateSupported && stateBackedFieldKey)
        ) {
          delete safeUpdates[key];
        }
      }

      if (Object.keys(safeUpdates).length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      const forcedFieldKeySet = new Set((Array.isArray(forceFieldKeys) ? forceFieldKeys : []).filter(Boolean));
      const reviewFieldState = normalizeReviewFieldStateMap(currentDeal.review_field_state || {});
      const nextReviewFieldState = { ...reviewFieldState };
      const eventRows = [];
      const appliedFields = [];
      const blockedFields = [];
      const storedAiFields = [];
      const materializedUpdates = {};
      const now = new Date().toISOString();

      for (const [key, value] of Object.entries(safeUpdates)) {
        const fieldKey = getReviewFieldKeyForColumn(key);
        const canTrackReviewField = reviewFieldStateSupported && fieldKey;

        if (!canTrackReviewField) {
          materializedUpdates[key] = value;
          appliedFields.push(fieldKey || key);
          continue;
        }

        const previousEntry = nextReviewFieldState[fieldKey];
        const previousFinalValue = resolveFinalReviewFieldValue(previousEntry, currentDeal?.[key]);
        const shouldForceOverwrite = overwriteAdmin === true || forcedFieldKeySet.has(fieldKey);
        const nextEntry = buildAiReviewFieldStateEntry(previousEntry, {
          nextValue: value,
          overwriteAdmin: shouldForceOverwrite,
          source: 'ai_extraction',
          at: now,
          extractionRunId
        });
        nextReviewFieldState[fieldKey] = nextEntry;
        storedAiFields.push(fieldKey);

        const nextFinalValue = resolveFinalReviewFieldValue(nextEntry, currentDeal?.[key]);
        const wasBlockedByAdmin = previousEntry?.adminOverrideActive === true && !shouldForceOverwrite;
        const canMaterializeToColumn = availableColumns.has(key);

        if (wasBlockedByAdmin) {
          blockedFields.push(fieldKey);
        } else {
          if (canMaterializeToColumn) {
            materializedUpdates[key] = nextFinalValue;
          }
          appliedFields.push(fieldKey);
        }

        eventRows.push({
          opportunity_id: dealId,
          field_key: fieldKey,
          event_type: wasBlockedByAdmin ? 'ai_update_blocked_by_admin' : (shouldForceOverwrite ? 'ai_overwrite_admin' : 'ai_apply'),
          actor_type: 'ai',
          actor_email: '',
          actor_name: '',
          previous_value: previousFinalValue,
          next_value: value,
          metadata: {
            requestedByEmail: actorEmail,
            requestedByName: actorName,
            overwriteAdmin: shouldForceOverwrite,
            materializedToColumn: !wasBlockedByAdmin && canMaterializeToColumn
          }
        });
      }

      if (reviewFieldStateSupported) {
        materializedUpdates.review_field_state = nextReviewFieldState;
      }
      if (reviewStateVersionSupported) {
        materializedUpdates.review_state_version = Number(currentDeal.review_state_version || 0) + 1;
      }

      safeUpdates.updated_at = now;
      materializedUpdates.updated_at = now;

      const { data, error } = await supabase
        .from('opportunities')
        .update(materializedUpdates)
        .eq('id', dealId)
        .select()
        .single();

      if (error) throw error;

      await logReviewEvents(supabase, eventRows);

      return res.status(200).json({
        success: true,
        data,
        deal: {
          ...applyReviewFieldStateToDeal(data),
          reviewFieldState: normalizeReviewFieldStateMap(data?.review_field_state || {}),
          reviewStateVersion: Number(data?.review_state_version || 0)
        },
        fields_updated: appliedFields,
        blocked_fields: blockedFields,
        stored_ai_fields: storedAiFields
      });
    }

    // Action: get deals missing decks with GDrive matches
    if (action === 'deck-audit') {
      const { data: deals, error: dealsErr } = await supabase
        .from('opportunities')
        .select('id, investment_name, asset_class, deal_type, deck_url, ppm_url, management_company:management_companies(id, operator_name)')
        .is('parent_deal_id', null)
        .order('investment_name');

      if (dealsErr) throw dealsErr;

      // Get GDrive file index
      const { data: gdriveFiles } = await supabase
        .from('gdrive_deck_files')
        .select('*')
        .order('deal_name');

      // Stop words that cause false-positive matches
      const STOP_WORDS = new Set([
        'fund','capital','group','partners','investment','investments','real','estate',
        'properties','holdings','income','equity','the','and','for','llc','lp','inc',
        'asset','management','opportunity','opportunities','advisors','ventures',
        'realty','development','financial','trust','portfolio','credit','lending',
        'senior','bridge','growth','value','core','plus','one','two','three',
      ]);

      function fuzzyMatch(dealName, fileName) {
        const dn = dealName.toLowerCase().trim();
        const fn = fileName.toLowerCase().trim();
        if (!dn || !fn || dn.length < 3 || fn.length < 3) return { match: false, score: 0 };
        // Exact match
        if (fn === dn) return { match: true, score: 100 };
        // Substring match (either direction, but require at least 5 chars)
        if (dn.length >= 5 && fn.includes(dn)) return { match: true, score: 90 };
        if (fn.length >= 5 && dn.includes(fn)) return { match: true, score: 85 };
        // Word overlap: filter out stop words, require ≥2 significant words
        const dealWords = dn.split(/[\s\-_,]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
        const fileWords = fn.split(/[\s\-_,]+/).filter(w => w.length > 2 && !STOP_WORDS.has(w));
        if (dealWords.length === 0 || fileWords.length === 0) return { match: false, score: 0 };
        const overlap = dealWords.filter(w => fileWords.some(fw => fw === w));
        const minWords = Math.min(dealWords.length, fileWords.length);
        // Require at least 2 non-stop-word exact matches, and ≥50% of the shorter name's words
        if (overlap.length >= 2 && overlap.length >= minWords * 0.5) {
          return { match: true, score: 50 + Math.round((overlap.length / minWords) * 30) };
        }
        return { match: false, score: 0 };
      }

      // Detect broken Airtable CDN links
      function isBrokenUrl(url) {
        if (!url) return false;
        return url.includes('airtableusercontent.com') || url.includes('dl.airtable.com');
      }

      const withDeck = [];
      const withoutDeck = [];
      const brokenDeck = [];

      for (const d of (deals || [])) {
        const hasDeck = !!d.deck_url;
        const broken = isBrokenUrl(d.deck_url);
        const hasPpm = !!d.ppm_url;
        const dealName = (d.investment_name || '');
        const operatorName = d.management_company?.operator_name || '';

        // Find matching GDrive files (fuzzy match with scoring)
        const matches = (gdriveFiles || []).map(f => {
          const result = fuzzyMatch(dealName, f.deal_name);
          if (!result.match) return null;
          return {
            gdrive_id: f.gdrive_id,
            file_name: f.file_name,
            doc_type: f.doc_type,
            file_size: f.file_size,
            folder: f.folder,
            score: result.score,
            view_url: `https://drive.google.com/file/d/${f.gdrive_id}/view`,
          };
        }).filter(Boolean).sort((a, b) => b.score - a.score);

        const entry = {
          id: d.id,
          investment_name: d.investment_name || '—',
          asset_class: d.asset_class || '',
          operator_name: operatorName,
          has_deck: hasDeck && !broken,
          has_ppm: hasPpm,
          deck_url: d.deck_url || '',
          broken_url: broken,
          gdrive_matches: matches,
          match_count: matches.length,
        };

        if (broken) brokenDeck.push(entry);
        else if (hasDeck) withDeck.push(entry);
        else withoutDeck.push(entry);
      }

      return res.status(200).json({
        success: true,
        stats: {
          total: deals.length,
          with_deck: withDeck.length,
          without_deck: withoutDeck.length,
          broken_deck: brokenDeck.length,
          gdrive_files: (gdriveFiles || []).length,
          auto_matchable: [...withoutDeck, ...brokenDeck].filter(d => d.match_count > 0).length,
        },
        without_deck: withoutDeck,
        with_deck: withDeck,
        broken_deck: brokenDeck,
      });
    }

    // Action: search GDrive files index by keyword
    if (action === 'search-gdrive') {
      const { query } = req.body;
      if (!query || query.length < 2) return res.status(400).json({ error: 'Query too short' });

      const { data: files } = await supabase
        .from('gdrive_deck_files')
        .select('*')
        .ilike('deal_name', `%${query}%`)
        .order('deal_name')
        .limit(20);

      return res.status(200).json({
        success: true,
        results: (files || []).map(f => ({
          gdrive_id: f.gdrive_id,
          file_name: f.file_name,
          doc_type: f.doc_type,
          file_size: f.file_size,
          deal_name: f.deal_name,
          view_url: `https://drive.google.com/file/d/${f.gdrive_id}/view`,
        })),
      });
    }

    // Action: clear a broken deck_url from a deal
    if (action === 'clear-deck') {
      const { dealId } = req.body;
      if (!dealId) return res.status(400).json({ error: 'Missing dealId' });

      const { data, error } = await supabase
        .from('opportunities')
        .update({ deck_url: null, updated_at: new Date().toISOString() })
        .eq('id', dealId)
        .select('id, investment_name')
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, data });
    }

    // Action: attach a GDrive file as a deal's deck_url
    if (action === 'attach-deck') {
      const { dealId, deckUrl, docType } = req.body;
      if (!dealId || !deckUrl) return res.status(400).json({ error: 'Missing dealId or deckUrl' });

      const field = docType === 'ppm' ? 'ppm_url' : docType === 'sub' ? 'sub_agreement_url' : 'deck_url';

      const { data, error } = await supabase
        .from('opportunities')
        .update({ [field]: deckUrl, updated_at: new Date().toISOString() })
        .eq('id', dealId)
        .select('id, investment_name, deck_url, ppm_url')
        .single();

      if (error) throw error;

      return res.status(200).json({ success: true, data, field_updated: field });
    }

    return res.status(400).json({ error: 'Unknown action. Valid: get-queue, classification-signals, review-field-evidence, enrich-deal, apply-enrichment, deck-audit, attach-deck, search-gdrive, clear-deck' });

  } catch (err) {
    console.error('Deal cleanup error:', err);
    return res.status(500).json({ error: 'Cleanup failed: ' + err.message });
  }
}
