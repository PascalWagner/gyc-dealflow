// Vercel Serverless Function: Deck Upload via Supabase Storage
// REPLACES: deck-upload.js (Make.com → Google Drive version)
//
// What changed:
//   - Files upload directly to Supabase Storage (no Make.com middleman)
//   - Signed URLs for secure access
//   - File metadata tracked in deck_submissions table
//   - Still sends email notification via Resend
//   - Auto-enrichment: PDFs are sent to Claude for field extraction after upload

import { getAdminClient, setCors } from './_supabase.js';

// ── Extraction prompt (shared with deal-enrich.js) ──────────────────────────
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
  "offeringSize": "Total offering size in dollars (number only)",
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
  "taxForm": "K-1, 1099, etc."
}

IMPORTANT:
- For percentages, convert to decimals (15% → 0.15)
- For dollar amounts, return raw numbers (no $ or commas)
- If a field clearly doesn't apply to this deal type, use null
- Be precise — only extract what's explicitly stated, don't infer`;

// ── Map Claude extraction keys → Supabase column names ──────────────────────
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
  sponsorCoinvest:     'sponsor_in_deal_pct',
};

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dealId, dealName, filedata, filename, notes, userEmail, userName, docType } = req.body;

    if (!filedata || !filename) {
      return res.status(400).json({ error: 'File data and filename are required' });
    }

    const supabase = getAdminClient();
    const cleanDealName = (dealName || 'Unknown').replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
    const storagePath = `deals/${dealId || 'unlinked'}/${cleanDealName} - ${filename}`;

    // 1. Decode base64 and upload to Supabase Storage
    const fileBuffer = Buffer.from(filedata, 'base64');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('deal-decks')
      .upload(storagePath, fileBuffer, {
        contentType: guessContentType(filename),
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get a signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from('deal-decks')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    const deckUrl = urlData?.signedUrl || '';

    // 2. Update the deal record with the URL (deck_url or ppm_url based on docType)
    let dealUpdated = false;
    if (dealId && deckUrl) {
      const urlField = docType === 'ppm' ? 'ppm_url' : 'deck_url';
      const { error: updateErr } = await supabase
        .from('opportunities')
        .update({ [urlField]: deckUrl })
        .eq('id', dealId);
      dealUpdated = !updateErr;
    }

    // 3. Log to deck_submissions table
    await supabase.from('deck_submissions').insert({
      deal_id: dealId || null,
      deal_name: dealName || '',
      deck_url: deckUrl,
      notes: notes || '',
      submitted_by_email: userEmail || '',
      submitted_by_name: userName || ''
    });

    // 4. Send notification email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'GYC Dealflow <feedback@growyourcashflow.io>',
            to: ['pascal@growyourcashflow.io'],
            subject: `[Deck Upload] ${dealName || 'Unknown Deal'}`,
            html: `<p><strong>${userName || 'Someone'}</strong> uploaded a deck for <strong>${dealName}</strong>.</p>
              <p>File: ${filename}</p>
              ${deckUrl ? '<p><a href="' + deckUrl + '">View Deck</a></p>' : ''}
              ${notes ? '<p>Notes: ' + notes + '</p>' : ''}`
          })
        });
      } catch (e) {
        console.warn('Email notification failed:', e.message);
      }
    }

    // 5. Auto-enrich: if PDF and dealId present, extract fields via Claude (best-effort)
    const isPdf = (filename || '').toLowerCase().endsWith('.pdf');
    let enriched = false;
    let enrichedFields = [];
    let enrichmentError = null;

    if (isPdf && dealId && process.env.ANTHROPIC_API_KEY) {
      try {
        const enrichResult = await enrichFromPdfBuffer(fileBuffer, dealId, userEmail, supabase);
        enriched = enrichResult.enriched;
        enrichedFields = enrichResult.enrichedFields;
      } catch (e) {
        console.warn('Auto-enrichment failed (upload still succeeded):', e.message);
        enrichmentError = e.message;
      }
    }

    return res.status(200).json({
      success: true,
      driveUrl: deckUrl,      // keeping same field name for frontend compat
      dealUpdated,
      enriched,
      enrichedFields,
      ...(enrichmentError ? { enrichmentError } : {})
    });

  } catch (error) {
    console.error('Deck upload error:', error);
    return res.status(500).json({ error: 'Failed to upload deck' });
  }
}

// ── PDF text extraction ─────────────────────────────────────────────────────
// Extracts readable text from a PDF buffer using a lightweight approach:
// strips binary content and pulls out text runs between stream markers and
// plain text sequences. Not perfect, but gives Claude enough to work with.
function extractTextFromPdfBuffer(buffer) {
  const raw = buffer.toString('latin1');
  const textChunks = [];

  // Method 1: Extract text between BT (Begin Text) and ET (End Text) operators
  const btEtRegex = /BT\s([\s\S]*?)ET/g;
  let match;
  while ((match = btEtRegex.exec(raw)) !== null) {
    // Pull out strings in parentheses (PDF literal strings)
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

  // Method 2: Also try extracting from stream objects (for text-heavy PDFs)
  if (textChunks.join('').length < 500) {
    // Fallback: grab anything that looks like readable text
    const readableRegex = /[\x20-\x7E]{10,}/g;
    let readMatch;
    while ((readMatch = readableRegex.exec(raw)) !== null) {
      const chunk = readMatch[0].trim();
      // Filter out binary-looking sequences
      if (chunk && !/^[A-Fa-f0-9\s]+$/.test(chunk) && !/^[\/\[\]<>{}]+$/.test(chunk)) {
        textChunks.push(chunk);
      }
    }
  }

  return textChunks.join(' ').substring(0, 50000);
}

// ── Claude enrichment logic ─────────────────────────────────────────────────
async function enrichFromPdfBuffer(fileBuffer, dealId, userEmail, supabase) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const pdfText = extractTextFromPdfBuffer(fileBuffer);

  if (!pdfText || pdfText.length < 100) {
    return { enriched: false, enrichedFields: [], reason: 'Insufficient text extracted from PDF' };
  }

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
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: EXTRACTION_PROMPT + '\n\nDOCUMENT TEXT:\n' + pdfText
      }]
    })
  });

  if (!claudeResp.ok) {
    const errText = await claudeResp.text();
    throw new Error('Claude API error: ' + claudeResp.status + ' ' + errText);
  }

  const claudeData = await claudeResp.json();
  const responseText = claudeData.content?.[0]?.text || '';

  // Parse JSON from response
  const jsonMatch = responseText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON found in Claude response');
  const extracted = JSON.parse(jsonMatch[0]);

  // Build Supabase update from extracted fields
  const supabaseUpdate = {};
  const fieldsFound = [];

  for (const [jsonKey, dbCol] of Object.entries(SUPABASE_FIELD_MAP)) {
    const val = extracted[jsonKey];
    if (val !== null && val !== undefined) {
      // Special handling for fees — Supabase expects text[]
      if (dbCol === 'fees' && typeof val === 'string') {
        supabaseUpdate[dbCol] = [val];
      } else {
        supabaseUpdate[dbCol] = val;
      }
      fieldsFound.push(dbCol);
    }
  }

  if (fieldsFound.length === 0) {
    return { enriched: false, enrichedFields: [], reason: 'No fields extracted' };
  }

  // Save to Supabase — only update fields that are currently empty/null
  // Fetch current record first to avoid overwriting human edits
  const { data: currentDeal } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', dealId)
    .single();

  const safeUpdate = {};
  const actuallyUpdated = [];

  for (const [col, val] of Object.entries(supabaseUpdate)) {
    const current = currentDeal?.[col];
    // Only update if the field is empty/null/zero/blank
    const isEmpty = current === null
      || current === undefined
      || current === ''
      || current === 0
      || (Array.isArray(current) && current.length === 0);

    if (isEmpty) {
      safeUpdate[col] = val;
      actuallyUpdated.push(col);
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

  return {
    enriched: true,
    enrichedFields: actuallyUpdated,
    extractedTotal: fieldsFound.length,
    updatedCount: actuallyUpdated.length,
    skippedCount: fieldsFound.length - actuallyUpdated.length
  };
}

function guessContentType(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  const types = {
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg'
  };
  return types[ext] || 'application/octet-stream';
}
