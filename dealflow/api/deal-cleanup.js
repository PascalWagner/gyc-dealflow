// Vercel Serverless Function: /api/deal-cleanup
// AI-assisted deal data cleanup: searches the web for missing deal information
// Processes deals one at a time, returning suggested field values for admin review

import { getAdminClient, setCors, verifyAdmin } from './_supabase.js';

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

// Build a search-friendly prompt for Claude with web search
function buildEnrichmentPrompt(deal, operatorName, missingFields) {
  const missingList = missingFields.map(f => `- ${f.label} (database field: ${f.key})`).join('\n');

  const knownInfo = [];
  if (deal.investment_name) knownInfo.push(`Fund/Deal Name: ${deal.investment_name}`);
  if (operatorName && operatorName !== '—') knownInfo.push(`Operator/Sponsor: ${operatorName}`);
  if (deal.asset_class) knownInfo.push(`Asset Class: ${deal.asset_class}`);
  if (deal.deal_type) knownInfo.push(`Deal Type: ${deal.deal_type}`);
  if (deal.location) knownInfo.push(`Location: ${deal.location}`);
  if (deal.target_irr) knownInfo.push(`Target IRR: ${deal.target_irr}`);
  if (deal.offering_type) knownInfo.push(`Offering Type: ${deal.offering_type}`);
  if (deal.investment_strategy) knownInfo.push(`Strategy: ${deal.investment_strategy}`);

  return `You are a real estate investment research analyst. I need you to search the web for information about this real estate private placement deal and fill in any missing data fields.

KNOWN INFORMATION:
${knownInfo.join('\n')}

MISSING FIELDS TO FIND:
${missingList}

INSTRUCTIONS:
1. Search for "${deal.investment_name}" ${operatorName && operatorName !== '—' ? `by "${operatorName}"` : ''} to find offering details, SEC filings, investor presentations, or fund marketing materials.
2. Look for SEC EDGAR filings (Form D), CrowdStreet listings, RealCrowd listings, or the sponsor's own website.
3. For each missing field, provide the value if you can find it with reasonable confidence.
4. Return ONLY valid JSON with the exact database field keys listed below.

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
- fees: Full fee structure as string (e.g. "2% management fee, 20% promote above 8% pref")
- lp_gp_split: e.g. "80/20"
- investing_geography: Geographic focus area
- investment_strategy: 2-3 sentence LP-facing summary
- status: One of: open, closed, coming_soon, evergreen, fully_funded, completed

Return JSON like:
{
  "found_fields": {
    "field_key": "value",
    ...
  },
  "confidence": {
    "field_key": "high|medium|low",
    ...
  },
  "sources": ["url or description of where info was found"],
  "notes": "Any relevant context about the search results"
}

Only include fields you actually found information for. Use null for fields you searched for but couldn't find. Be conservative — only include data you're confident about.`;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Verify admin
  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return res.status(403).json({ success: false, error: auth.error });
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
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

      // Compute completeness and sort worst-first, filter out 100% complete
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

    // Action: enrich a single deal
    if (action === 'enrich-deal') {
      const { dealId } = req.body;
      if (!dealId) return res.status(400).json({ error: 'Missing dealId' });

      // Fetch the full deal record
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
          current_data: deal
        });
      }

      // Call Claude with web search to find missing data
      const prompt = buildEnrichmentPrompt(deal, operatorName, missingFields);

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
          tools: [{
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 5
          }],
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!claudeResp.ok) {
        const errText = await claudeResp.text();
        throw new Error('Claude API error: ' + claudeResp.status + ' ' + errText);
      }

      const claudeData = await claudeResp.json();

      // Extract the text response (may be after tool use blocks)
      let responseText = '';
      for (const block of (claudeData.content || [])) {
        if (block.type === 'text') {
          responseText += block.text;
        }
      }

      // Parse JSON from response
      let enrichResult;
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON found in response');
        enrichResult = JSON.parse(jsonMatch[0]);
      } catch (parseErr) {
        return res.status(200).json({
          success: true,
          deal_id: dealId,
          found_fields: {},
          confidence: {},
          sources: [],
          notes: 'AI search completed but could not find structured data for this deal.',
          raw_response: responseText.substring(0, 1000),
          current_data: deal,
          operator_name: operatorName,
          missing_fields: missingFields.map(f => ({ key: f.key, label: f.label }))
        });
      }

      return res.status(200).json({
        success: true,
        deal_id: dealId,
        found_fields: enrichResult.found_fields || {},
        confidence: enrichResult.confidence || {},
        sources: enrichResult.sources || [],
        notes: enrichResult.notes || '',
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

      // Sanitize updates - only allow known fields
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
