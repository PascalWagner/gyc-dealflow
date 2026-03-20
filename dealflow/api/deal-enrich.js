// Vercel Serverless Function: /api/deal-enrich
// AI-assisted deal enrichment: accepts PPM text and uses Claude to extract structured deal fields
// Returns pre-filled deal record for human review

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
  const truncated = ppmText.substring(0, 50000);

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
        max_tokens: 2000,
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

    // If dealId provided, save AI extraction alongside human-review flag
    const pat = process.env.AIRTABLE_PAT;
    if (pat && dealId) {
      try {
        // Build Airtable field updates from extracted data
        const fieldMap = {
          investmentStrategy: 'Investment Strategy',
          targetIRR: 'Target IRR',
          preferredReturn: 'Preferred Return',
          cashOnCash: 'Cash on Cash Return',
          equityMultiple: 'Equity Multiple',
          investmentMinimum: 'Investment Minimum',
          holdPeriod: 'Min Hold Period (Yrs)',
          offeringSize: 'Offering Size',
          offeringType: 'Offering Type',
          distributions: 'Distributions',
          lpGpSplit: 'Class A - LP/GP Split',
          fees: 'Fees',
          financials: 'Financials',
          investingGeography: 'Investing Geography',
          instrument: 'Instrument',
          debtPosition: 'Debt Position',
          fundAUM: 'Fund AUM',
          sponsorCoinvest: '% Sponsor In The Deal'
        };

        const airtableFields = {};
        for (const [jsonKey, atKey] of Object.entries(fieldMap)) {
          if (extracted[jsonKey] !== null && extracted[jsonKey] !== undefined) {
            airtableFields[atKey] = extracted[jsonKey];
          }
        }

        // Only update if we extracted meaningful data
        if (Object.keys(airtableFields).length > 0) {
          // Add AI enrichment metadata
          airtableFields['Notes'] = 'AI-enriched on ' + new Date().toISOString().split('T')[0] + ' by ' + (userEmail || 'system') + '. Fields extracted: ' + Object.keys(airtableFields).join(', ') + '. PENDING HUMAN REVIEW.';

          const updateResp = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/tblXFNpOvL0Ub5tVt/${dealId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${pat}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({ fields: airtableFields })
            }
          );

          if (!updateResp.ok) {
            console.warn('Airtable update failed:', await updateResp.text());
          }
        }
      } catch (e) {
        console.warn('Airtable enrichment save error:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      extracted,
      fieldsFound: Object.keys(extracted).filter(k => extracted[k] !== null).length,
      totalFields: Object.keys(extracted).length,
      inputLength: truncated.length,
      model: 'claude-sonnet-4-20250514'
    });

  } catch (err) {
    console.error('Deal enrichment error:', err);
    return res.status(500).json({ error: 'Enrichment failed: ' + err.message });
  }
}
