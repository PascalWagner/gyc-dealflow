// Vercel Serverless Function: /api/deal-alerts
// Computes which users should be notified about a new deal based on buy box match
// MIGRATED: Now reads users + buy box from Supabase instead of GHL
// DRY RUN ONLY — does NOT send any emails. Returns the match list for admin review.

import { getAdminClient, ASSET_MAP, setCors } from './_supabase.js';

function matchScore(deal, buyBox) {
  let score = 0;
  let maxScore = 0;
  const reasons = [];

  // Asset class match (weight: 3)
  const userAssets = (buyBox.asset_classes || '')
    .split(',').map(s => s.trim()).filter(Boolean).map(a => ASSET_MAP[a] || a);
  if (userAssets.length > 0) {
    maxScore += 3;
    if (userAssets.includes(deal.assetClass)) {
      score += 3;
      reasons.push('Asset class: ' + deal.assetClass);
    }
  }

  // Yield match (weight: 2)
  const minYield = parseFloat(buyBox.min_cash_yield) || 0;
  if (minYield > 0) {
    maxScore += 2;
    const dealYield = deal.preferredReturn || deal.cashOnCash || deal.targetIRR || 0;
    const yieldPct = dealYield > 1 ? dealYield : dealYield * 100;
    if (yieldPct >= minYield) {
      score += 2;
      reasons.push('Yield ' + yieldPct.toFixed(1) + '% >= ' + minYield + '%');
    }
  }

  // Check size (weight: 2)
  const checkSizeStr = buyBox.check_size || '';
  const checkMatch = checkSizeStr.match(/\d+/);
  if (checkMatch) {
    maxScore += 2;
    const userCheck = parseInt(checkMatch[0]) * 1000;
    if (deal.investmentMinimum && deal.investmentMinimum <= userCheck * 1.5) {
      score += 2;
      reasons.push('Min $' + (deal.investmentMinimum / 1000) + 'K fits');
    }
  }

  // Strategy (weight: 1)
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
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { deal } = req.body || {};
  if (!deal || !deal.investmentName) {
    return res.status(400).json({ error: 'deal object with investmentName required' });
  }

  try {
    const supabase = getAdminClient();

    // Fetch users with completed buy boxes from Supabase
    const { data: buyBoxes, error: bbErr } = await supabase
      .from('user_buy_box')
      .select('*, user:user_profiles(email, full_name)')
      .not('completed_at', 'is', null);

    if (bbErr) throw bbErr;

    // Score each user against the deal
    const matches = [];

    for (const bb of (buyBoxes || [])) {
      if (!bb.user?.email) continue;

      const result = matchScore(deal, bb);
      if (result.score >= 0.5) {
        matches.push({
          name: bb.user.full_name || bb.user.email,
          email: bb.user.email,
          matchPct: result.matchPct,
          reasons: result.reasons
        });
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchPct - a.matchPct);

    return res.status(200).json({
      dryRun: true,
      deal: {
        name: deal.investmentName,
        assetClass: deal.assetClass,
        targetIRR: deal.targetIRR,
        minimum: deal.investmentMinimum
      },
      totalUsers: (buyBoxes || []).length,
      totalMatches: matches.length,
      matches,
      message: 'DRY RUN — no emails sent. Review matches above before enabling.'
    });

  } catch (err) {
    console.error('Deal alerts error:', err);
    return res.status(500).json({ error: 'Failed to compute alerts: ' + err.message });
  }
}
