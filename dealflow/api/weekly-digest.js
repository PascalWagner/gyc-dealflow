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
import { generateSaveUrl, generateSkipUrl } from './deal-save.js';

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
      id, investment_name, asset_class, investment_strategy, strategy,
      target_irr, cash_on_cash, preferred_return, investment_minimum,
      hold_period_years, status, distributions, deck_url, deal_type,
      offering_size, total_amount_sold, lp_gp_split, instrument,
      management_company:management_companies ( operator_name )
    `)
    .gte('added_date', cutoffISO.split('T')[0])
    .not('investment_name', 'eq', '')
    .order('added_date', { ascending: false });

  if (error) throw error;
  return (data || []).map(d => ({
    ...d,
    managementCompany: d.management_company?.operator_name || '',
    pctFunded: (d.total_amount_sold && d.offering_size && d.offering_size > 0)
      ? Math.round(d.total_amount_sold / d.offering_size * 100) : null
  }));
}

async function fetchAlmostFullDeals(supabase) {
  // Deals 70-99% funded based on SEC data — urgency/scarcity plays
  const { data, error } = await supabase
    .from('opportunities')
    .select(`
      id, investment_name, asset_class, investment_strategy, strategy,
      target_irr, cash_on_cash, preferred_return, investment_minimum,
      hold_period_years, status, distributions, deck_url, deal_type,
      offering_size, total_amount_sold, lp_gp_split, instrument,
      management_company:management_companies ( operator_name )
    `)
    .not('total_amount_sold', 'is', null)
    .not('offering_size', 'is', null)
    .gt('offering_size', 0)
    .not('investment_name', 'eq', '')
    .order('total_amount_sold', { ascending: false });

  if (error) throw error;
  return (data || [])
    .map(d => ({
      ...d,
      managementCompany: d.management_company?.operator_name || '',
      pctFunded: Math.round(d.total_amount_sold / d.offering_size * 100)
    }))
    .filter(d => d.pctFunded >= 70 && d.pctFunded < 100);
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

// Fetch social proof: how many LPs saved each deal
async function fetchDealSaveStats(supabase, dealIds) {
  if (!dealIds.length) return {};
  const { data } = await supabase
    .from('deal_stages')
    .select('deal_id')
    .in('deal_id', dealIds)
    .eq('stage', 'saved');
  const counts = {};
  for (const row of (data || [])) {
    counts[row.deal_id] = (counts[row.deal_id] || 0) + 1;
  }
  return counts;
}

// Render a single deal as an email-safe card (table-based for email clients)
function dealCard(deal, opts = {}) {
  const BASE = 'https://dealflow.growyourcashflow.io';
  const viewUrl = `${BASE}/deal.html?id=${deal.id}`;
  const imageUrl = `${BASE}/api/deal-card-og?id=${deal.id}`;
  const saveUrl = opts.email ? generateSaveUrl(deal.id, opts.email) : `${BASE}/deal.html?id=${deal.id}&action=save`;

  const yieldVal = deal.preferred_return || deal.cash_on_cash || deal.target_irr || 0;
  const yieldPct = yieldVal > 1 ? yieldVal.toFixed(1) : (yieldVal * 100).toFixed(1);
  const yieldLabel = deal.preferred_return ? 'PREF RETURN' : deal.cash_on_cash ? 'CASH ON CASH' : 'TARGET IRR';
  const minVal = deal.investment_minimum;
  const minStr = minVal >= 1000000 ? '$' + (minVal / 1000000).toFixed(1) + 'M' : minVal >= 1000 ? '$' + (minVal / 1000).toFixed(0) + 'K' : minVal ? '$' + minVal : '\u2014';
  const holdStr = deal.hold_period_years ? deal.hold_period_years + ' Yrs' : '\u2014';
  const splitStr = deal.lp_gp_split && /\d+\s*\/\s*\d+/.test(deal.lp_gp_split) ? deal.lp_gp_split : '\u2014';
  const distStr = deal.distributions || '\u2014';

  // Badge colors
  const acBg = '#1a3a2a'; // dark teal like the platform hero
  const badgeStyle = 'display:inline-block;padding:3px 8px;border-radius:4px;font-size:10px;font-weight:700;letter-spacing:0.5px;color:#fff;margin-right:4px;';

  // Almost full badge
  const almostFullBadge = opts.pctFunded && opts.pctFunded >= 70 && opts.pctFunded < 100
    ? `<span style="${badgeStyle}background:#EF4444;">${opts.pctFunded}% FUNDED</span>` : '';
  const matchBadge = opts.matchPct && opts.matchPct >= 60
    ? `<span style="${badgeStyle}background:#51BE7B;">${opts.matchPct}% MATCH</span>` : '';

  return `
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:16px;border-radius:12px;overflow:hidden;border:1px solid #DDE5E8;background:#fff;">
      <!-- Hero bar with badges + yield -->
      <tr><td style="background:${acBg};padding:16px 20px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td style="vertical-align:top;">
            <span style="${badgeStyle}background:rgba(255,255,255,0.2);">${deal.asset_class || ''}</span>
            <span style="${badgeStyle}background:rgba(255,255,255,0.2);">${deal.deal_type || 'Fund'}</span>
            ${almostFullBadge}${matchBadge}
          </td>
          <td style="text-align:right;vertical-align:top;">
            ${yieldVal > 0 ? `<div style="font-size:28px;font-weight:800;color:#51BE7B;line-height:1;">${yieldPct}%</div>
            <div style="font-size:9px;font-weight:700;color:rgba(255,255,255,0.5);letter-spacing:1px;margin-top:2px;">${yieldLabel}</div>` : ''}
          </td>
        </tr></table>
      </td></tr>
      <!-- Deal name + operator -->
      <tr><td style="padding:16px 20px 8px;">
        <div style="font-size:16px;font-weight:700;color:#141413;line-height:1.3;">${deal.investment_name}</div>
        <div style="font-size:13px;color:#607179;margin-top:2px;">${deal.managementCompany || ''}</div>
      </td></tr>
      <!-- Metrics row -->
      <tr><td style="padding:4px 20px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td style="width:25%;vertical-align:top;">
            <div style="font-size:9px;font-weight:700;color:#8A9AA0;text-transform:uppercase;letter-spacing:0.5px;">Minimum</div>
            <div style="font-size:13px;font-weight:700;color:#141413;margin-top:2px;">${minStr}</div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="font-size:9px;font-weight:700;color:#8A9AA0;text-transform:uppercase;letter-spacing:0.5px;">Hold</div>
            <div style="font-size:13px;font-weight:700;color:#141413;margin-top:2px;">${holdStr}</div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="font-size:9px;font-weight:700;color:#8A9AA0;text-transform:uppercase;letter-spacing:0.5px;">LP/GP</div>
            <div style="font-size:13px;font-weight:700;color:#141413;margin-top:2px;">${splitStr}</div>
          </td>
          <td style="width:25%;vertical-align:top;">
            <div style="font-size:9px;font-weight:700;color:#8A9AA0;text-transform:uppercase;letter-spacing:0.5px;">Dist.</div>
            <div style="font-size:13px;font-weight:700;color:#141413;margin-top:2px;">${distStr}</div>
          </td>
        </tr></table>
      </td></tr>
      <!-- Funding progress bar -->
      ${opts.pctFunded && opts.pctFunded > 0 ? `
      <tr><td style="padding:4px 20px 12px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td style="font-size:10px;color:#8A9AA0;">$${deal.total_amount_sold >= 1000000 ? (deal.total_amount_sold / 1000000).toFixed(1) + 'M' : (deal.total_amount_sold / 1000).toFixed(0) + 'K'} of $${deal.offering_size >= 1000000 ? (deal.offering_size / 1000000).toFixed(1) + 'M' : (deal.offering_size / 1000).toFixed(0) + 'K'} raised</td>
          <td style="font-size:10px;color:#8A9AA0;text-align:right;">${opts.pctFunded}% funded</td>
        </tr></table>
        <div style="height:8px;border-radius:4px;overflow:hidden;background:#EDF1F2;margin-top:4px;">
          <div style="width:${Math.min(opts.pctFunded, 100)}%;height:100%;background:${opts.pctFunded >= 90 ? '#EF4444' : opts.pctFunded >= 70 ? '#F59E0B' : '#51BE7B'};border-radius:4px;"></div>
        </div>
      </td></tr>` : ''}
      <!-- Social proof -->
      ${opts.saveCount > 0 ? `
      <tr><td style="padding:0 20px 12px;">
        <div style="font-size:11px;color:#8A9AA0;">\u{1f465} ${opts.saveCount} LP${opts.saveCount > 1 ? 's' : ''} saved this deal</div>
      </td></tr>` : ''}
      <!-- Action buttons -->
      <tr><td style="padding:0 20px 16px;">
        <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
          <td style="width:48%;padding-right:6px;">
            <a href="${viewUrl}" style="display:block;text-align:center;padding:12px;border:1px solid #DDE5E8;border-radius:8px;font-size:13px;font-weight:700;color:#8A9AA0;text-decoration:none;">\u2715 Skip</a>
          </td>
          <td style="width:52%;padding-left:6px;">
            <a href="${saveUrl}" style="display:block;text-align:center;padding:12px;background:#51BE7B;border-radius:8px;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">\ud83d\udccc Save Deal</a>
          </td>
        </tr></table>
      </td></tr>
    </table>`;
}

function generateEmailContent(user, matchedDeals, allNewDeals, almostFullDeals = [], saveStats = {}) {
  const firstName = user.firstName.charAt(0).toUpperCase() + user.firstName.slice(1);
  const isAcademy = user.tier === 'academy' || user.tier === 'alumni';

  const sorted = [...matchedDeals].sort((a, b) => b.matchPct - a.matchPct);
  const topMatches = sorted.slice(0, 3);
  const urgentDeals = [...almostFullDeals].sort((a, b) => b.pctFunded - a.pctFunded).slice(0, 2);

  // Pick the ONE hero deal — best match first, then urgent, then newest
  const heroDeal = topMatches[0]?.deal || urgentDeals[0] || allNewDeals[0];
  const heroMatch = topMatches[0] || null;
  const heroUrgent = !heroMatch && urgentDeals[0] ? urgentDeals[0] : null;
  const heroPctFunded = heroDeal?.pctFunded || (heroDeal?.total_amount_sold && heroDeal?.offering_size ? Math.round(heroDeal.total_amount_sold / heroDeal.offering_size * 100) : null);

  if (!heroDeal) return null;

  // Personalized subject line — the deal IS the subject
  const yieldVal = heroDeal.preferred_return || heroDeal.cash_on_cash || heroDeal.target_irr || 0;
  const yieldPct = yieldVal > 1 ? yieldVal.toFixed(1) : (yieldVal * 100).toFixed(1);
  const min = heroDeal.investment_minimum;
  const minStr = min >= 1000000 ? '$' + (min / 1000000).toFixed(1) + 'M' : min >= 1000 ? '$' + (min / 1000).toFixed(0) + 'K min' : '';
  const splitStr = heroDeal.lp_gp_split && /\d+\s*\/\s*\d+/.test(heroDeal.lp_gp_split) ? heroDeal.lp_gp_split + ' split' : '';
  const parts = [heroDeal.asset_class, yieldVal > 0 ? yieldPct + '% pref' : '', splitStr, minStr].filter(Boolean);
  let subject = heroDeal.investment_name + ' \u2014 ' + parts.slice(0, 3).join(', ');
  if (heroPctFunded >= 70) subject = heroDeal.investment_name + ' is ' + heroPctFunded + '% funded \u2014 ' + parts.slice(0, 2).join(', ');

  // "Why you're seeing this" line
  let whyLine = '';
  if (heroMatch && heroMatch.reasons.length > 0) {
    whyLine = 'This matches your buy box: ' + heroMatch.reasons.join(', ');
  } else if (user.hasBuyBox) {
    const bbParts = [];
    if (user.buyBox.assetClasses) bbParts.push(user.buyBox.assetClasses.split(',')[0]);
    if (user.buyBox.checkSize) bbParts.push(user.buyBox.checkSize + ' check size');
    if (bbParts.length) whyLine = 'Based on your buy box: ' + bbParts.join(', ');
  }

  // Other deals count
  const otherCount = allNewDeals.filter(d => d.id !== heroDeal.id).length + urgentDeals.filter(d => d.id !== heroDeal.id).length;

  const BASE = 'https://dealflow.growyourcashflow.io';
  const imageUrl = `${BASE}/api/deal-card-og?id=${heroDeal.id}`;
  const viewUrl = `${BASE}/deal.html?id=${heroDeal.id}`;
  const saveUrl = user.email ? generateSaveUrl(heroDeal.id, user.email) : `${BASE}/deal.html?id=${heroDeal.id}&action=save`;
  const heroSaveCount = saveStats[heroDeal.id] || 0;

  let html = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
  <body style="margin:0;padding:0;background:#FAF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF9F5;"><tr><td align="center" style="padding:32px 16px;">
  <table cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;">
    <!-- Logo -->
    <tr><td align="center" style="padding-bottom:20px;">
      <div style="display:inline-block;background:#51BE7B;color:#fff;font-weight:800;font-size:12px;padding:7px 12px;border-radius:8px;letter-spacing:0.5px;">GYC DEAL FLOW</div>
    </td></tr>
    <!-- Why you're seeing this -->
    ${whyLine ? `<tr><td style="padding-bottom:16px;">
      <div style="font-size:13px;color:#51BE7B;font-weight:600;">${whyLine}</div>
    </td></tr>` : ''}
    <!-- Hero card as image (pixel-perfect across email clients) -->
    <tr><td>
      <a href="${viewUrl}" style="text-decoration:none;">
        <img src="${imageUrl}" alt="${heroDeal.investment_name}" width="480" style="width:100%;max-width:480px;border-radius:12px;display:block;" />
      </a>
    </td></tr>
    <!-- Social proof + funding -->
    <tr><td style="padding:12px 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        ${heroSaveCount > 0 ? `<td style="font-size:12px;color:#8A9AA0;">\u{1f465} ${heroSaveCount} LP${heroSaveCount > 1 ? 's' : ''} saved this deal</td>` : '<td></td>'}
        ${heroPctFunded && heroPctFunded >= 30 ? `<td style="font-size:12px;color:${heroPctFunded >= 70 ? '#EF4444' : '#8A9AA0'};text-align:right;font-weight:${heroPctFunded >= 70 ? '700' : '400'};">${heroPctFunded}% funded</td>` : '<td></td>'}
      </tr></table>
    </td></tr>
    <!-- Action buttons -->
    <tr><td style="padding-bottom:16px;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td style="width:48%;padding-right:6px;">
          <a href="${BASE}" style="display:block;text-align:center;padding:14px;border:1px solid #DDE5E8;border-radius:10px;font-size:14px;font-weight:700;color:#8A9AA0;text-decoration:none;">\u2715 Skip</a>
        </td>
        <td style="width:52%;padding-left:6px;">
          <a href="${saveUrl}" style="display:block;text-align:center;padding:14px;background:#51BE7B;border-radius:10px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">\ud83d\udccc Save Deal</a>
        </td>
      </tr></table>
    </td></tr>
    <!-- More deals link -->
    ${otherCount > 0 ? `<tr><td align="center" style="padding:8px 0 16px;">
      <a href="${BASE}" style="font-size:13px;font-weight:600;color:#51BE7B;text-decoration:none;">+ ${otherCount} more deal${otherCount > 1 ? 's' : ''} waiting for you \u2192</a>
    </td></tr>` : ''}
    <!-- Buy box nudge -->
    ${!user.hasBuyBox ? `<tr><td style="padding:8px 0;">
      <table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F0F9F4;border-radius:10px;"><tr><td style="padding:16px 20px;text-align:center;">
        <div style="font-size:13px;font-weight:700;color:#141413;margin-bottom:4px;">Get better deal matches</div>
        <div style="font-size:12px;color:#607179;margin-bottom:10px;">Tell us what you're looking for and we'll send deals that fit.</div>
        <a href="${BASE}/#buybox" style="font-weight:700;font-size:13px;color:#51BE7B;text-decoration:none;">Set Up Buy Box \u2192</a>
      </td></tr></table>
    </td></tr>` : ''}
    <!-- Footer -->
    <tr><td align="center" style="padding:20px 0 0;">
      <div style="font-size:11px;color:#8A9AA0;">
        <a href="${BASE}/settings" style="color:#8A9AA0;text-decoration:underline;">Manage preferences</a>
        &nbsp;\u00b7&nbsp;
        <a href="${BASE}/settings?unsub=digest" style="color:#8A9AA0;text-decoration:underline;">Unsubscribe</a>
      </div>
    </td></tr>
  </table></td></tr></table></body></html>`;

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

    // 1. Fetch new deals + almost-full deals from Supabase
    const newDeals = await fetchRecentDeals(supabase, daysBack);
    const almostFullDeals = await fetchAlmostFullDeals(supabase);

    if (newDeals.length === 0 && almostFullDeals.length === 0) {
      return res.status(200).json({
        message: 'No new deals or urgent deals to report',
        digests: [],
        totalUsers: 0,
        newDeals: 0
      });
    }

    // 2. Fetch users with buy boxes from Supabase
    const users = await fetchUsersWithBuyBox(supabase);

    // 2b. Fetch social proof stats (how many LPs saved each deal)
    const allDealIds = [...newDeals, ...almostFullDeals].map(d => d.id);
    const saveStats = await fetchDealSaveStats(supabase, allDealIds);

    // 3. Compute matches for each user
    const digests = [];

    for (const user of users) {
      const matchedDeals = [];

      if (user.hasBuyBox) {
        // Match against new deals
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

      // Skip users with nothing to show
      if (matchedDeals.length === 0 && newDeals.length < 2 && almostFullDeals.length === 0) continue;

      const result = generateEmailContent(user, matchedDeals, newDeals, almostFullDeals, saveStats);
      if (!result) continue;
      const { subject, html } = result;

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
