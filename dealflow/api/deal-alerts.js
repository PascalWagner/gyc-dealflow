// Vercel Serverless Function: /api/deal-alerts
// Computes which users should be notified about a new deal based on buy box match
// DRY RUN ONLY — does NOT send any emails. Returns the match list for admin review.
// When ready to go live, add email sending logic and enable via env var.

const GHL_API_KEY = process.env.GHL_API_KEY;

// Buy box field keys in GHL
const FIELD_KEYS = {
  assetClasses: 'contact.asset_class_preference',
  checkSize: 'contact.investment_amount',
  minCashYield: 'contact.minimum_1st_year_cash_on_cash_return',
  minIRR: 'contact.minimum_total_return_requirement_irr',
  instruments: 'contact.investing_instrument',
  lockup: 'contact.lockup_period_tolerance',
  strategies: 'contact.strategy_preference',
  goal: 'contact.primary_investment_objective'
};

// Asset class name mapping (GHL values → Airtable values)
const ASSET_MAP = {
  'Multi-Family': 'Multi Family',
  'Hotels / Hospitality': 'Hotels/Hospitality',
  'Private Debt / Credit': 'Lending',
  'RV / Mobile Home Parks': 'RV/Mobile Home Parks',
  'Short-Term Rentals': 'Short Term Rental'
};

function matchScore(deal, buyBox) {
  let score = 0;
  let maxScore = 0;
  const reasons = [];

  // Asset class match
  const userAssets = (buyBox.assetClasses || '').split(',').map(s => s.trim()).filter(Boolean).map(a => ASSET_MAP[a] || a);
  if (userAssets.length > 0) {
    maxScore += 3;
    if (userAssets.includes(deal.assetClass)) {
      score += 3;
      reasons.push('Asset class: ' + deal.assetClass);
    }
  }

  // Yield match
  const minYield = parseFloat(buyBox.minCashYield) || 0;
  if (minYield > 0) {
    maxScore += 2;
    const dealYield = deal.preferredReturn || deal.cashOnCash || deal.targetIRR || 0;
    const yieldPct = dealYield > 1 ? dealYield : dealYield * 100;
    if (yieldPct >= minYield) {
      score += 2;
      reasons.push('Yield ' + yieldPct.toFixed(1) + '% >= ' + minYield + '%');
    }
  }

  // Check size
  const checkSizeStr = buyBox.checkSize || '';
  const checkMatch = checkSizeStr.match(/\d+/);
  if (checkMatch) {
    maxScore += 2;
    const userCheck = parseInt(checkMatch[0]) * 1000;
    if (deal.investmentMinimum && deal.investmentMinimum <= userCheck * 1.5) {
      score += 2;
      reasons.push('Min $' + (deal.investmentMinimum / 1000) + 'K fits');
    }
  }

  // Strategy
  const userStrategies = (buyBox.strategies || '').split(',').map(s => s.trim()).filter(Boolean);
  if (userStrategies.length > 0) {
    maxScore += 1;
    if (userStrategies.includes(deal.strategy)) {
      score += 1;
      reasons.push(deal.strategy + ' strategy');
    }
  }

  return {
    score: maxScore > 0 ? score / maxScore : 0,
    reasons,
    matchPct: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!GHL_API_KEY) {
    return res.status(500).json({ error: 'GHL_API_KEY not configured' });
  }

  const { deal } = req.body || {};
  if (!deal || !deal.investmentName) {
    return res.status(400).json({ error: 'deal object with investmentName required' });
  }

  try {
    // Fetch all contacts with buy box data from GHL
    // Use search endpoint with tag filter for users who have completed wizard
    const searchResp = await fetch('https://rest.gohighlevel.com/v1/contacts/?limit=100&query=wizard-complete', {
      headers: { 'Authorization': `Bearer ${GHL_API_KEY}` }
    });

    if (!searchResp.ok) {
      throw new Error('GHL contacts fetch failed: ' + searchResp.status);
    }

    const searchData = await searchResp.json();
    const contacts = searchData.contacts || [];

    // Score each contact against the deal
    const matches = [];

    for (const contact of contacts) {
      const customFields = contact.customField || [];
      const buyBox = {};

      // Extract buy box fields from custom fields
      for (const cf of customFields) {
        const fieldKey = cf.key || cf.id || '';
        for (const [appKey, ghlKey] of Object.entries(FIELD_KEYS)) {
          if (fieldKey === ghlKey) {
            buyBox[appKey] = cf.value || '';
          }
        }
      }

      // Skip contacts with no buy box data
      if (Object.keys(buyBox).length === 0) continue;

      const result = matchScore(deal, buyBox);
      if (result.score >= 0.5) {
        matches.push({
          name: [contact.firstName, contact.lastName].filter(Boolean).join(' ') || contact.email,
          email: contact.email,
          matchPct: result.matchPct,
          reasons: result.reasons
        });
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchPct - a.matchPct);

    // ============================================================
    // DRY RUN: No emails are sent. This is preview-only.
    // When ready to go live:
    // 1. Add DEAL_ALERTS_ENABLED=true env var
    // 2. Add email sending logic using Resend
    // 3. Track sent alerts to prevent duplicates
    // ============================================================

    return res.status(200).json({
      dryRun: true,
      deal: {
        name: deal.investmentName,
        assetClass: deal.assetClass,
        targetIRR: deal.targetIRR,
        minimum: deal.investmentMinimum
      },
      totalContacts: contacts.length,
      totalMatches: matches.length,
      matches: matches,
      message: 'DRY RUN — no emails sent. Review matches above before enabling.'
    });

  } catch (err) {
    console.error('Deal alerts error:', err);
    return res.status(500).json({ error: 'Failed to compute alerts: ' + err.message });
  }
}
