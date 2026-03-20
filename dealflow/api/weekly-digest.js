// Vercel Serverless Function: /api/weekly-digest
// Generates weekly deal digest email content for each user based on buy box match
// Designed to be triggered by Make.com on a weekly schedule (e.g., every Monday 9am ET)
//
// MIGRATED: Now reads deals from Supabase and users from user_profiles (with GHL fallback for buy box)
//
// Flow:
//   1. Make.com triggers POST /api/weekly-digest
//   2. This endpoint fetches new deals from Supabase (added in last 7 days)
//   3. For each user with a buy box, computes match scores
//   4. Returns formatted digest data per user
//   5. Make.com iterates results and sends emails via GHL/SendGrid/etc.
//
// Params:
//   POST { dryRun: true }  → preview mode, no side effects
//   POST { dryRun: false } → returns full digest data for Make.com to send

import { getAdminClient, setCors, ASSET_MAP } from './_supabase.js';

const GHL_API_KEY = process.env.GHL_API_KEY;
const DIGEST_SECRET = process.env.DIGEST_SECRET || '';

function matchDealToBuyBox(deal, buyBox) {
  let score = 0;
  let maxScore = 0;
  const reasons = [];

  // Asset class match (weight: 3)
  const userAssets = (buyBox.assetClasses || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(a => ASSET_MAP[a] || a);
  if (userAssets.length > 0) {
    maxScore += 3;
    if (userAssets.includes(deal.asset_class)) {
      score += 3;
      reasons.push(deal.asset_class + ' matches your buy box');
    }
  }

  // Yield match (weight: 2)
  const minYield = parseFloat(buyBox.minCashYield) || 0;
  if (minYield > 0) {
    maxScore += 2;
    const dealYield = deal.preferred_return || deal.cash_on_cash || deal.target_irr || 0;
    const yieldPct = dealYield > 1 ? dealYield : dealYield * 100;
    if (yieldPct >= minYield) {
      score += 2;
      reasons.push(yieldPct.toFixed(1) + '% yield meets your ' + minYield + '% minimum');
    }
  }

  // Check size match (weight: 2)
  const checkSizeStr = buyBox.checkSize || '';
  const checkMatch = checkSizeStr.match(/\d+/);
  if (checkMatch) {
    maxScore += 2;
    const userCheck = parseInt(checkMatch[0]) * 1000;
    if (deal.investment_minimum && deal.investment_minimum <= userCheck * 1.5) {
      score += 2;
      reasons.push('$' + (deal.investment_minimum / 1000) + 'K minimum fits your budget');
    }
  }

  // Strategy match (weight: 1)
  const userStrategies = (buyBox.strategies || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (userStrategies.length > 0) {
    maxScore += 1;
    if (userStrategies.includes(deal.investment_strategy)) {
      score += 1;
      reasons.push(deal.investment_strategy + ' strategy');
    }
  }

  return {
    score: maxScore > 0 ? score / maxScore : 0,
    matchPct: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    reasons
  };
}

async function fetchRecentDeals(supabase, daysBack = 7) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffISO = cutoffDate.toISOString();

  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      id, investment_name, asset_class, investment_strategy,
      target_irr, cash_on_cash, preferred_return, investment_minimum,
      hold_period_years, status, distributions, deck_url,
      management_company:management_companies ( operator_name )
    `)
    .gte('added_date', cutoffISO.split('T')[0])
    .not('investment_name', 'eq', '')
    .order('added_date', { ascending: false });

  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    managementCompany: d.management_company?.operator_name || ''
  }));
}

async function fetchUsersWithBuyBox(supabase) {
  // Get users from Supabase user_profiles
  const { data: profiles, error } = await supabase
    .from('user_profiles')
    .select('id, email, full_name, tier, buy_box_data')
    .not('email', 'is', null);

  if (error) throw error;

  return (profiles || [])
    .filter(p => p.email)
    .map(p => {
      const buyBox = p.buy_box_data || {};
      const firstName = (p.full_name || p.email.split('@')[0]).split(' ')[0] || 'there';
      return {
        email: p.email,
        name: p.full_name || p.email.split('@')[0],
        firstName,
        tier: p.tier || 'free',
        buyBox: {
          assetClasses: buyBox.assetClasses || buyBox.asset_classes || '',
          checkSize: buyBox.checkSize || buyBox.check_size || '',
          minCashYield: buyBox.minCashYield || buyBox.min_cash_yield || '',
          minIRR: buyBox.minIRR || buyBox.min_irr || '',
          strategies: buyBox.strategies || ''
        },
        hasBuyBox: Object.keys(buyBox).length > 0
      };
    });
}

function generateEmailContent(user, matchedDeals, allNewDeals) {
  const firstName = user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1);
  const isAcademy = user.tier === 'academy' || user.tier === 'alumni';

  // Sort matches by score
  const sorted = [...matchedDeals].sort((a, b) => b.matchPct - a.matchPct);
  const topMatches = sorted.slice(0, 5);

  let subject = '';
  if (topMatches.length > 0) {
    subject = `${topMatches.length} new deal${topMatches.length > 1 ? 's' : ''} match your buy box`;
  } else {
    subject = `${allNewDeals.length} new deal${allNewDeals.length > 1 ? 's' : ''} this week on GYC`;
  }

  // Build HTML email body
  let html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #FAF9F5; padding: 32px 20px;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #51BE7B; color: #fff; font-weight: 700; font-size: 12px; padding: 8px 12px; border-radius: 8px;">GYC</div>
      </div>
      <div style="background: #fff; border-radius: 12px; padding: 32px; border: 1px solid #DDE5E8;">
        <h1 style="font-size: 22px; color: #141413; margin: 0 0 8px;">Your Weekly Deal Digest</h1>
        <p style="font-size: 14px; color: #607179; margin: 0 0 24px;">Hey ${firstName}, here's what's new this week.</p>
  `;

  if (topMatches.length > 0) {
    html += `<div style="margin-bottom: 24px;">
      <h2 style="font-size: 14px; color: #51BE7B; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">Buy Box Matches</h2>`;

    for (const match of topMatches) {
      const deal = match.deal;
      const yieldVal = deal.preferred_return || deal.cash_on_cash || deal.target_irr || 0;
      const yieldStr = yieldVal > 0 ? (yieldVal > 1 ? yieldVal.toFixed(1) : (yieldVal * 100).toFixed(1)) + '%' : '\u2014';
      const minStr = deal.investment_minimum ? '$' + (deal.investment_minimum / 1000).toFixed(0) + 'K' : '\u2014';

      html += `
        <div style="border: 1px solid #DDE5E8; border-radius: 8px; padding: 16px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #141413;">${deal.investment_name}</div>
              <div style="font-size: 12px; color: #607179;">${deal.managementCompany || deal.asset_class}</div>
            </div>
            <div style="background: rgba(81,190,123,0.1); color: #51BE7B; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 20px;">${match.matchPct}% match</div>
          </div>
          <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: #607179;">
            <span>Yield: <strong style="color: #141413;">${yieldStr}</strong></span>
            <span>Min: <strong style="color: #141413;">${minStr}</strong></span>
            <span>${deal.asset_class}</span>
          </div>
          ${match.reasons.length > 0 ? '<div style="font-size: 11px; color: #51BE7B; margin-top: 6px;">' + match.reasons[0] + '</div>' : ''}
        </div>`;
    }

    html += `</div>`;
  }

  // Other new deals (not matched)
  const otherDeals = allNewDeals.filter(d => !topMatches.some(m => m.deal.id === d.id)).slice(0, 3);
  if (otherDeals.length > 0) {
    html += `<div style="margin-bottom: 24px;">
      <h2 style="font-size: 14px; color: #607179; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 12px;">Also New This Week</h2>`;

    for (const deal of otherDeals) {
      html += `
        <div style="padding: 8px 0; border-bottom: 1px solid #EDF1F2; font-size: 13px;">
          <span style="font-weight: 600; color: #141413;">${deal.investment_name}</span>
          <span style="color: #607179;"> \u00b7 ${deal.asset_class}</span>
        </div>`;
    }

    html += `</div>`;
  }

  // CTA
  html += `
    <div style="text-align: center; margin-top: 24px;">
      <a href="https://dealflow.growyourcashflow.io" style="display: inline-block; background: #51BE7B; color: #fff; font-weight: 700; font-size: 14px; padding: 12px 32px; border-radius: 8px; text-decoration: none;">View All Deals</a>
    </div>`;

  // Academy upsell for free users
  if (!isAcademy) {
    html += `
      <div style="margin-top: 24px; padding: 16px; background: #EFF6FF; border-radius: 8px; text-align: center;">
        <div style="font-weight: 700; font-size: 13px; color: #141413; margin-bottom: 4px;">Want Pascal's analysis on these deals?</div>
        <div style="font-size: 12px; color: #607179; margin-bottom: 10px;">Academy members get DD checklists, stress tests, and guided deployment.</div>
        <a href="https://growyourcashflow.io/cashflow-academy" style="font-weight: 700; font-size: 12px; color: #3b82f6; text-decoration: none;">Learn more \u2192</a>
      </div>`;
  }

  html += `
      </div>
      <div style="text-align: center; margin-top: 16px; font-size: 11px; color: #8A9AA0;">
        <a href="https://dealflow.growyourcashflow.io/settings" style="color: #8A9AA0;">Manage notification preferences</a>
      </div>
    </div>`;

  return { subject, html };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Simple auth check — Make.com passes secret in header
  const authHeader = req.headers['authorization'] || '';
  if (DIGEST_SECRET && authHeader !== `Bearer ${DIGEST_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Kill switch: Emails are OFF until Pascal sets env var
  //   DIGEST_ENABLED=true in Vercel → Settings → Environment Variables
  const DIGEST_ENABLED = process.env.DIGEST_ENABLED === 'true';
  if (!DIGEST_ENABLED) {
    return res.status(200).json({
      enabled: false,
      message: 'Weekly digest is disabled. Set DIGEST_ENABLED=true in Vercel env vars to activate.'
    });
  }

  const { dryRun = true, daysBack = 7 } = req.body || {};

  try {
    const supabase = getAdminClient();

    // 1. Fetch new deals from Supabase
    const newDeals = await fetchRecentDeals(supabase, daysBack);
    if (newDeals.length === 0) {
      return res.status(200).json({
        message: 'No new deals in the last ' + daysBack + ' days',
        digests: [],
        totalUsers: 0,
        newDeals: 0
      });
    }

    // 2. Fetch users with buy boxes from Supabase
    const users = await fetchUsersWithBuyBox(supabase);

    // 3. Compute matches for each user
    const digests = [];

    for (const user of users) {
      const matchedDeals = [];

      if (user.hasBuyBox) {
        for (const deal of newDeals) {
          const result = matchDealToBuyBox(deal, user.buyBox);
          if (result.score >= 0.4) {
            matchedDeals.push({
              deal,
              matchPct: result.matchPct,
              reasons: result.reasons
            });
          }
        }
      }

      // Skip users with no matches AND no new deals to show
      if (matchedDeals.length === 0 && newDeals.length < 2) continue;

      const { subject, html } = generateEmailContent(user, matchedDeals, newDeals);

      digests.push({
        email: user.email,
        name: user.name,
        firstName: user.firstName,
        tier: user.tier,
        subject,
        html: dryRun ? undefined : html,
        matchCount: matchedDeals.length,
        topMatch: matchedDeals.length > 0 ? {
          dealName: matchedDeals.sort((a, b) => b.matchPct - a.matchPct)[0].deal.investment_name,
          matchPct: matchedDeals.sort((a, b) => b.matchPct - a.matchPct)[0].matchPct
        } : null
      });
    }

    return res.status(200).json({
      dryRun,
      newDeals: newDeals.length,
      totalUsers: users.length,
      digestsGenerated: digests.length,
      digests: dryRun ? digests : digests.map(d => ({ ...d })),
      generatedAt: new Date().toISOString()
    });

  } catch (err) {
    console.error('Weekly digest error:', err);
    return res.status(500).json({ error: 'Failed to generate digests: ' + err.message });
  }
}
