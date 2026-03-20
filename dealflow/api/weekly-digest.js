// Vercel Serverless Function: /api/weekly-digest
// Generates weekly deal digest email content for each user based on buy box match
// Designed to be triggered by Make.com on a weekly schedule (e.g., every Monday 9am ET)
//
// Flow:
//   1. Make.com triggers POST /api/weekly-digest
//   2. This endpoint fetches new deals from Airtable (added in last 7 days)
//   3. For each user with a buy box, computes match scores
//   4. Returns formatted digest data per user
//   5. Make.com iterates results and sends emails via GHL/SendGrid/etc.
//
// Params:
//   POST { dryRun: true }  → preview mode, no side effects
//   POST { dryRun: false } → returns full digest data for Make.com to send

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const GHL_API_KEY = process.env.GHL_API_KEY;
const AIRTABLE_PAT = process.env.AIRTABLE_PAT;
const DIGEST_SECRET = process.env.DIGEST_SECRET || '';

// Asset class mapping for matching
const ASSET_MAP = {
  'Multi-Family': 'Multi Family',
  'Hotels / Hospitality': 'Hotels/Hospitality',
  'Private Debt / Credit': 'Lending',
  'RV / Mobile Home Parks': 'RV/Mobile Home Parks',
  'Short-Term Rentals': 'Short Term Rental'
};

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
    if (userAssets.includes(deal.assetClass)) {
      score += 3;
      reasons.push(deal.assetClass + ' matches your buy box');
    }
  }

  // Yield match (weight: 2)
  const minYield = parseFloat(buyBox.minCashYield) || 0;
  if (minYield > 0) {
    maxScore += 2;
    const dealYield = deal.preferredReturn || deal.cashOnCash || deal.targetIRR || 0;
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
    if (deal.investmentMinimum && deal.investmentMinimum <= userCheck * 1.5) {
      score += 2;
      reasons.push('$' + (deal.investmentMinimum / 1000) + 'K minimum fits your budget');
    }
  }

  // Strategy match (weight: 1)
  const userStrategies = (buyBox.strategies || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  if (userStrategies.length > 0) {
    maxScore += 1;
    if (userStrategies.includes(deal.investmentStrategy)) {
      score += 1;
      reasons.push(deal.investmentStrategy + ' strategy');
    }
  }

  return {
    score: maxScore > 0 ? score / maxScore : 0,
    matchPct: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
    reasons
  };
}

async function fetchRecentDeals(daysBack = 7) {
  if (!AIRTABLE_PAT) throw new Error('AIRTABLE_PAT not set');

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysBack);
  const cutoffISO = cutoffDate.toISOString().split('T')[0];

  const records = [];
  let offset = null;

  do {
    const url = new URL(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent('Opportunities')}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('filterByFormula', `IS_AFTER({Created}, '${cutoffISO}')`);
    if (offset) url.searchParams.set('offset', offset);

    const response = await fetch(url.toString(), {
      headers: { 'Authorization': `Bearer ${AIRTABLE_PAT}` }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Airtable error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);

  return records.map(rec => {
    const f = rec.fields || {};
    return {
      id: rec.id,
      investmentName: f['Investment Name'] || f['Name'] || '',
      assetClass: f['Asset Class'] || '',
      investmentStrategy: f['Investment Strategy'] || '',
      targetIRR: f['Target IRR'] || 0,
      cashOnCash: f['Cash on Cash'] || 0,
      preferredReturn: f['Preferred Return'] || 0,
      investmentMinimum: f['Investment Minimum'] || 0,
      holdPeriod: f['Hold Period'] || '',
      managementCompany: f['Management Company'] || '',
      status: f['Status'] || '',
      distributions: f['Distributions'] || '',
      deckUrl: f['Deck URL'] || ''
    };
  });
}

async function fetchUsersWithBuyBox() {
  if (!GHL_API_KEY) throw new Error('GHL_API_KEY not set');

  // Fetch contacts with dealflow tags
  const allContacts = [];
  let page = 1;
  let hasMore = true;

  while (hasMore && page <= 10) {
    const resp = await fetch(
      `https://rest.gohighlevel.com/v1/contacts/?limit=100&page=${page}`,
      { headers: { 'Authorization': `Bearer ${GHL_API_KEY}` } }
    );

    if (!resp.ok) break;
    const data = await resp.json();
    const contacts = data.contacts || [];
    allContacts.push(...contacts);
    hasMore = contacts.length === 100;
    page++;
  }

  // Filter to users with dealflow tags and extract buy box
  return allContacts
    .filter(c => {
      const tags = (c.tags || []).map(t => t.toLowerCase());
      return tags.some(t =>
        t === 'dealflow-free' || t === 'dealflow-academy' || t === 'dealflow-alumni' ||
        t === 'bought cashflow academy' || t === 'academy-member' || t === 'subscriber'
      );
    })
    .map(c => {
      const customFields = c.customField || [];
      const buyBox = {};

      const FIELD_KEYS = {
        assetClasses: 'contact.asset_class_preference',
        checkSize: 'contact.investment_amount',
        minCashYield: 'contact.minimum_1st_year_cash_on_cash_return',
        minIRR: 'contact.minimum_total_return_requirement_irr',
        strategies: 'contact.strategy_preference'
      };

      for (const cf of customFields) {
        const fieldKey = cf.key || cf.id || '';
        for (const [appKey, ghlKey] of Object.entries(FIELD_KEYS)) {
          if (fieldKey === ghlKey) buyBox[appKey] = cf.value || '';
        }
      }

      const tags = (c.tags || []).map(t => t.toLowerCase());
      let tier = 'free';
      if (tags.includes('dealflow-academy') || tags.includes('bought cashflow academy') || tags.includes('academy-member'))
        tier = 'academy';
      else if (tags.includes('dealflow-alumni'))
        tier = 'alumni';

      return {
        email: c.email,
        name: [c.firstName, c.lastName].filter(Boolean).join(' ') || c.email?.split('@')[0] || 'Investor',
        firstName: c.firstName || c.email?.split('@')[0] || 'there',
        tier,
        buyBox,
        hasBuyBox: Object.keys(buyBox).length > 0
      };
    })
    .filter(u => u.email);
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
      const yieldVal = deal.preferredReturn || deal.cashOnCash || deal.targetIRR || 0;
      const yieldStr = yieldVal > 0 ? (yieldVal > 1 ? yieldVal.toFixed(1) : (yieldVal * 100).toFixed(1)) + '%' : '—';
      const minStr = deal.investmentMinimum ? '$' + (deal.investmentMinimum / 1000).toFixed(0) + 'K' : '—';

      html += `
        <div style="border: 1px solid #DDE5E8; border-radius: 8px; padding: 16px; margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 700; font-size: 14px; color: #141413;">${deal.investmentName}</div>
              <div style="font-size: 12px; color: #607179;">${deal.managementCompany || deal.assetClass}</div>
            </div>
            <div style="background: rgba(81,190,123,0.1); color: #51BE7B; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 20px;">${match.matchPct}% match</div>
          </div>
          <div style="display: flex; gap: 16px; margin-top: 8px; font-size: 12px; color: #607179;">
            <span>Yield: <strong style="color: #141413;">${yieldStr}</strong></span>
            <span>Min: <strong style="color: #141413;">${minStr}</strong></span>
            <span>${deal.assetClass}</span>
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
          <span style="font-weight: 600; color: #141413;">${deal.investmentName}</span>
          <span style="color: #607179;"> · ${deal.assetClass}</span>
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
        <a href="https://growyourcashflow.io/cashflow-academy" style="font-weight: 700; font-size: 12px; color: #3b82f6; text-decoration: none;">Learn more →</a>
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
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  // Simple auth check — Make.com passes secret in header
  const authHeader = req.headers['authorization'] || '';
  if (DIGEST_SECRET && authHeader !== `Bearer ${DIGEST_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { dryRun = true, daysBack = 7 } = req.body || {};

  try {
    // 1. Fetch new deals
    const newDeals = await fetchRecentDeals(daysBack);
    if (newDeals.length === 0) {
      return res.status(200).json({
        message: 'No new deals in the last ' + daysBack + ' days',
        digests: [],
        totalUsers: 0,
        newDeals: 0
      });
    }

    // 2. Fetch users with buy boxes
    const users = await fetchUsersWithBuyBox();

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
          dealName: matchedDeals.sort((a, b) => b.matchPct - a.matchPct)[0].deal.investmentName,
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
