// Vercel Serverless Function: Send weekly deal alert email
// Usage: GET /api/send-deal-alert?email=info@pascalwagner.com&secret=gyc2026
//
// Admin-only endpoint. Picks the best matching deal for the user's buy box
// and sends the deal card email via GHL.
//
// Set DEAL_ALERT_LIVE=true env var to allow sending to all users.
// Without it, only info@pascalwagner.com can receive alerts.

import { getAdminClient, setCors, ghlFetch } from './_supabase.js';
import { createHmac } from 'crypto';

const ADMIN_EMAIL = 'info@pascalwagner.com';
const SEND_SECRET = process.env.DEAL_ALERT_SECRET || 'gyc2026';
const SAVE_SECRET = process.env.DIGEST_SECRET || process.env.SAVE_SECRET || 'gyc-deal-save-2026';
const BASE = 'https://dealflow.growyourcashflow.io';
const GHL_LOCATION = process.env.GHL_LOCATION_ID || process.env.GHL_LOCATION;

function genToken(email, dealId) {
  return createHmac('sha256', SAVE_SECRET).update(email + ':' + dealId).digest('hex').substring(0, 16);
}

function fp(v) {
  if (!v) return '--';
  return v > 1 ? v.toFixed(1) + '%' : (v * 100).toFixed(1) + '%';
}

function fmtMoney(v) {
  if (!v) return '--';
  return v >= 1e6 ? '$' + (v / 1e6).toFixed(1) + 'M' : v >= 1000 ? '$' + (v / 1000).toFixed(0) + 'K' : '$' + v;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { email, secret, dealId } = req.query;

  // Auth check
  if (secret !== SEND_SECRET) {
    return res.status(401).json({ error: 'Invalid secret' });
  }

  // Safety: only send to admin unless DEAL_ALERT_LIVE is set
  const isLive = process.env.DEAL_ALERT_LIVE === 'true';
  if (!isLive && email !== ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Deal alerts are admin-only. Set DEAL_ALERT_LIVE=true to send to all users.' });
  }

  if (!email) {
    return res.status(400).json({ error: 'Email required' });
  }

  try {
    const supabase = getAdminClient();

    // Check user exists and has weekly frequency
    const { data: user } = await supabase
      .from('user_profiles')
      .select('id, email, notif_frequency')
      .eq('email', email)
      .single();

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    if (user.notif_frequency === 'off') {
      return res.status(200).json({ skipped: true, reason: 'User has deal alerts turned off' });
    }

    // Pick a deal — either specific or best match
    let deal;
    if (dealId) {
      const { data: deals } = await supabase.from('opportunities')
        .select('*, management_companies(operator_name, founding_year)')
        .eq('id', dealId);
      deal = deals?.[0];
    }

    if (!deal) {
      // Pick the newest 506(c) deal with a deck that hasn't been sent to this user
      const { data: userStages } = await supabase.from('user_deal_stages')
        .select('deal_id').eq('user_id', user.id);
      const seenIds = (userStages || []).map(s => s.deal_id);

      const { data: deals } = await supabase.from('opportunities')
        .select('*, management_companies(operator_name, founding_year)')
        .eq('is_506b', false)
        .not('deck_url', 'is', null)
        .not('target_irr', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      // Filter out deals the user has already seen
      const unseen = (deals || []).filter(d => !seenIds.includes(d.id));
      deal = unseen[0] || deals?.[0];
    }

    if (!deal) {
      return res.status(200).json({ skipped: true, reason: 'No deals to send' });
    }

    const mc = deal.management_companies || {};
    const token = genToken(email, deal.id);
    const saveUrl = `${BASE}/api/deal-save?id=${deal.id}&email=${encodeURIComponent(email)}&token=${token}`;
    const skipUrl = `${saveUrl}&action=skip`;
    const viewUrl = `${BASE}/deal.html?id=${deal.id}`;

    const irr = fp(deal.target_irr);
    const min = fmtMoney(deal.investment_minimum);
    const hold = deal.hold_period_years ? deal.hold_period_years + ' Yrs' : '--';
    const emx = deal.equity_multiple ? deal.equity_multiple.toFixed(2) + 'x' : '--';
    const dist = deal.distributions || '--';
    const split = deal.lp_gp_split || '--';
    const founded = mc.founding_year || '--';
    const hasDeck = !!(deal.deck_url || deal.ppm_url);
    const pctFunded = (deal.total_amount_sold && deal.offering_size && deal.offering_size > 0)
      ? Math.round(deal.total_amount_sold / deal.offering_size * 100) : null;
    const raised = deal.total_amount_sold ? fmtMoney(deal.total_amount_sold) : '--';

    const subject = `${deal.investment_name} — ${deal.asset_class || ''}, ${irr} IRR${min !== '--' ? ', ' + min + ' min' : ''}`;

    const noDeckBadge = !hasDeck
      ? `<span style="display:inline-block;background:rgba(245,158,11,0.25);color:#FBBF24;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;margin-left:6px;letter-spacing:0.3px;">No Deck</span>`
      : '';

    const fundingBar = pctFunded
      ? `<tr><td style="background:#fff;padding:0 24px 16px;"><div style="display:flex;justify-content:space-between;font-size:11px;color:#8A9AA0;margin-bottom:6px;"><span>${raised} raised</span><span>${pctFunded}% funded</span></div><div style="background:#F0F0EE;border-radius:4px;height:8px;overflow:hidden;"><div style="background:linear-gradient(90deg,#51BE7B,#3da864);height:100%;border-radius:4px;width:${Math.min(pctFunded, 100)}%;"></div></div></td></tr>`
      : '';

    const desc = `${deal.investment_name} is a ${deal.asset_class || ''} ${deal.deal_type || ''} targeting a ${irr} IRR and ${emx} equity multiple over ${hold}, with a minimum ${min} investment.`;

    // Build the email HTML (same as weekly-digest-preview.html)
    const emailHtml = `<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;">
<tr><td align="center" style="padding-bottom:24px;"><div style="display:inline-block;"><span style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#141413;letter-spacing:-0.3px;">Grow Your Cashflow</span><span style="color:#DDE5E8;margin:0 8px;">&#183;</span><span style="font-size:13px;font-weight:600;color:#51BE7B;letter-spacing:0.3px;">Deal Alert</span></div></td></tr>
<tr><td>
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
<tr><td style="background:linear-gradient(135deg,#1a2332 0%,#2d3748 100%);padding:24px 24px 20px;"><a href="${viewUrl}" style="text-decoration:none;color:inherit;"><div style="margin-bottom:16px;"><span style="display:inline-block;background:rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;margin-right:6px;letter-spacing:0.3px;">${deal.asset_class || ''}</span><span style="display:inline-block;background:rgba(81,190,123,0.25);color:#51BE7B;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:0.3px;">${deal.deal_type || ''}</span>${noDeckBadge}</div><div style="font-size:42px;font-weight:800;color:#51BE7B;line-height:1;">${irr}</div><div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:0.5px;margin-top:6px;">TARGET IRR</div></a></td></tr>
<tr><td style="background:#fff;padding:20px 24px 12px;"><a href="${viewUrl}" style="text-decoration:none;color:inherit;"><div style="font-size:20px;font-weight:700;color:#141413;line-height:1.3;">${deal.investment_name}</div><div style="font-size:13px;color:#607179;margin-top:4px;">${mc.operator_name || ''}</div><div style="font-size:13px;color:#8A9AA0;margin-top:10px;line-height:1.5;">${desc}</div></a></td></tr>
<tr><td style="background:#fff;padding:0 24px;"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #F0F0EE;"><tr><td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">TARGET IRR</div><div style="font-size:15px;font-weight:700;color:#51BE7B;margin-top:2px;">${irr}</div></td><td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">MINIMUM</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${min}</div></td><td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">LOCKUP</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${hold}</div></td><td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">DISTRIBUTION</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${dist}</div></td></tr></table></td></tr>
<tr><td style="background:#fff;padding:0 24px 16px;"><table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #F0F0EE;"><tr><td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">LP/GP SPLIT</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${split}</div></td><td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">EQUITY MULT.</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${emx}</div></td><td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">MANAGER SIZE</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">--</div></td><td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">FOUNDED</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${founded}</div></td></tr></table></td></tr>
${fundingBar}
<tr><td style="background:#fff;padding:8px 24px 20px;"><table cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td style="width:48%;padding-right:6px;"><a href="${skipUrl}" style="display:block;text-align:center;padding:12px;border:2px solid #DDE5E8;border-radius:8px;font-size:13px;font-weight:700;color:#8A9AA0;text-decoration:none;">&#10005; SKIP</a></td><td style="width:52%;padding-left:6px;"><a href="${saveUrl}" style="display:block;text-align:center;padding:12px;background:#51BE7B;border-radius:8px;font-size:13px;font-weight:700;color:#fff;text-decoration:none;">&#128204; SAVE</a></td></tr></table></td></tr>
</table>
</td></tr>
<tr><td align="center" style="padding:16px 0 20px;"><a href="${BASE}" style="font-size:13px;font-weight:600;color:#51BE7B;text-decoration:none;">Browse all deals in the database &#8594;</a></td></tr>
<tr><td><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F0F9F4;border-radius:10px;"><tr><td style="padding:16px 20px;text-align:center;"><div style="font-size:13px;font-weight:700;color:#141413;margin-bottom:4px;">Not the right fit?</div><div style="font-size:12px;color:#607179;margin-bottom:10px;">Update your buy box and we'll send better matches next time.</div><a href="${BASE}/index.html#buybox?step=4" style="font-weight:700;font-size:13px;color:#51BE7B;text-decoration:none;">Update Buy Box &#8594;</a></td></tr></table></td></tr>
<tr><td align="center" style="padding:24px 0 0;"><div style="font-size:11px;color:#8A9AA0;"><a href="${BASE}/index.html#settings" style="color:#8A9AA0;text-decoration:underline;">Manage preferences</a><span style="margin:0 4px;">&#183;</span><a href="${BASE}/api/unsubscribe?email=${encodeURIComponent(email)}" style="color:#8A9AA0;text-decoration:underline;">Unsubscribe</a></div><div style="font-size:11px;color:#C4CDD1;margin-top:8px;">Grow Your Cashflow &#183; growyourcashflow.io</div></td></tr>
</table></td></tr></table>`;

    // Send via GHL email
    // First find the GHL contact
    const searchResp = await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?email=${encodeURIComponent(email)}&locationId=${GHL_LOCATION}`,
      { method: 'GET' }
    );

    let sent = false;
    if (searchResp?.ok) {
      const searchData = await searchResp.json();
      const contactId = searchData.contact?.id;

      if (contactId) {
        // Send email via GHL
        const sendResp = await ghlFetch(
          `https://services.leadconnectorhq.com/contacts/${contactId}/campaigns/emails`,
          {
            method: 'POST',
            body: JSON.stringify({
              emailType: 'html',
              subject,
              html: emailHtml,
              from: 'Grow Your Cashflow <deals@growyourcashflow.io>'
            })
          }
        );

        if (sendResp?.ok) {
          sent = true;
        } else {
          const errText = await sendResp?.text().catch(() => 'unknown');
          console.error('GHL send failed:', errText);
        }
      }
    }

    return res.status(200).json({
      success: true,
      sent,
      deal: deal.investment_name,
      subject,
      email,
      note: sent ? 'Email sent via GHL' : 'Email generated but GHL send may have failed — check logs'
    });

  } catch (err) {
    console.error('Send deal alert error:', err);
    return res.status(500).json({ error: err.message });
  }
}
