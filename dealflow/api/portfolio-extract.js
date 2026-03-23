// Vercel Serverless Function: Portfolio PPM Extraction + Enrichment Cascade
// Downloads a previously-uploaded PDF from Supabase Storage, extracts investment
// fields via AI (Claude → OpenAI → Grok fallback chain), then cascades through
// SEC EDGAR, RentCast, Census/BLS, and background checks in parallel.
//
// Uses shared _enrichment.js module — same pipeline as deck-upload.js

import { getAdminClient, setCors, rateLimit } from './_supabase.js';
import { extractFromPdf, runEnrichmentCascade } from './_enrichment.js';

// ── Portfolio-specific prompt override ───────────────────────────────────────
// Adds LP-specific field prioritization on top of the standard enrichment prompt
const PORTFOLIO_PROMPT_ADDENDUM = `

ADDITIONAL INSTRUCTIONS FOR PORTFOLIO IMPORT:
- PRIORITIZE the specific LP/investor details over general fund terms
- For amountInvested: look for "Subscription Amount", "Capital Commitment", "Amount Subscribed" on signature pages. If not found, use the minimum investment amount
- For dateInvested: look for execution dates on signature pages, NOT the offering date
- For investingEntity: look for "Subscriber Name", "Investor Name" in signature blocks
- For targetIRR: if you find it as a decimal (0.15), keep it as-is. The system will handle conversion.`;

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

    // 2. AI Extraction with fallback chain (shared module)
    const { extracted, method } = await extractFromPdf(fileBuffer);

    if (!extracted) {
      return res.status(200).json({
        success: false,
        error: 'Could not extract data from document. You can add details manually.',
        enrichmentSteps: []
      });
    }

    const fieldsExtracted = Object.keys(extracted).filter(k => extracted[k] !== null && extracted[k] !== undefined).length;
    console.log(`Extraction (${method}): ${fieldsExtracted} fields found`);

    // 3. Enrichment cascade (shared module)
    const enrichment = await runEnrichmentCascade(extracted, supabase);

    return res.status(200).json({
      success: true,
      extracted,
      ...enrichment,
      fieldsExtracted,
      method,
      enrichmentSteps: ['ppm', ...enrichment.enrichmentSteps]
    });

  } catch (error) {
    console.error('Portfolio extract error:', error);
    return res.status(500).json({ error: 'Extraction failed: ' + error.message });
  }
}
