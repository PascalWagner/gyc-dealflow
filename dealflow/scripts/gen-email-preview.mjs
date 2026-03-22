import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';
import { writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

const sb = createClient(
  'https://nntzqyufmtypfjpusflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udHpxeXVmbXR5cGZqcHVzZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk3NTY3OSwiZXhwIjoyMDg5NTUxNjc5fQ.Hx5hs5AAE7Rorw4OvyfA4UKDr7zWk0-GfNgToc0eGFw'
);

const DEAL_ID = process.argv[2] || '4088aa9d-78ab-4dcd-91c8-8a18f16503b5';
const EMAIL = 'info@pascalwagner.com';
const BASE = 'https://dealflow.growyourcashflow.io';

function genToken(dealId) {
  return createHmac('sha256', 'gyc-deal-save-2026').update(EMAIL + ':' + dealId).digest('hex').substring(0, 16);
}

const { data: deals, error: dealErr } = await sb.from('opportunities')
  .select('id, investment_name, asset_class, deal_type, target_irr, preferred_return, investment_minimum, hold_period_years, equity_multiple, distributions, lp_gp_split, deck_url, ppm_url, total_amount_sold, offering_size, management_companies(operator_name, founding_year)')
  .eq('id', DEAL_ID);
if (dealErr) { console.error('Query error:', dealErr); process.exit(1); }

const deal = deals?.[0];
if (!deal) { console.error('Deal not found:', DEAL_ID); process.exit(1); }

const mc = deal.management_companies || {};
const token = genToken(deal.id);
const saveUrl = `${BASE}/api/deal-save?id=${deal.id}&email=${encodeURIComponent(EMAIL)}&token=${token}`;
const skipUrl = `${saveUrl}&action=skip`;
const viewUrl = `${BASE}/deal.html?id=${deal.id}`;

// Format values exactly like platform card
const fp = v => !v ? '--' : v > 1 ? v.toFixed(1) + '%' : (v * 100).toFixed(1) + '%';
const irr = fp(deal.target_irr);
const min = deal.investment_minimum >= 1e6 ? '$' + (deal.investment_minimum / 1e6).toFixed(1) + 'M'
  : deal.investment_minimum >= 1000 ? '$' + (deal.investment_minimum / 1000).toFixed(0) + 'K' : '--';
const hold = deal.hold_period_years ? deal.hold_period_years + ' Yrs' : '--';
const emx = deal.equity_multiple ? deal.equity_multiple.toFixed(2) + 'x' : '--';
const dist = deal.distributions || '--';
const split = deal.lp_gp_split || '--';
const mgrSize = mc.aum_category || '--';
const founded = mc.founding_year || '--';
const hasDeck = !!(deal.deck_url || deal.ppm_url);
const pctFunded = (deal.total_amount_sold && deal.offering_size && deal.offering_size > 0)
  ? Math.round(deal.total_amount_sold / deal.offering_size * 100) : null;
const raised = deal.total_amount_sold ? '$' + (deal.total_amount_sold / 1e6).toFixed(1) + 'M' : '--';
const desc = `${deal.investment_name} is a ${deal.asset_class || ''} ${deal.deal_type || ''} targeting a ${irr} IRR and ${emx} equity multiple over ${hold}, with a minimum ${min} investment.`;
const subject = `${deal.investment_name} — ${deal.asset_class || ''}, ${irr} IRR${min !== '--' ? ', ' + min + ' min' : ''}`;
const { count } = await sb.from('opportunities').select('id', { count: 'exact', head: true }).eq('is_506b', false).not('deck_url', 'is', null);

const noDeckBadge = !hasDeck
  ? `<span style="display:inline-block;background:rgba(245,158,11,0.25);color:#FBBF24;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;margin-left:6px;letter-spacing:0.3px;">No Deck</span>`
  : '';

const fundingBar = pctFunded
  ? `<tr><td style="background:#fff;padding:0 24px 20px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;color:#8A9AA0;margin-bottom:6px;">
        <span>${raised} raised</span><span>${pctFunded}% funded</span>
      </div>
      <div style="background:#F0F0EE;border-radius:4px;height:8px;overflow:hidden;">
        <div style="background:linear-gradient(90deg,#51BE7B,#3da864);height:100%;border-radius:4px;width:${Math.min(pctFunded, 100)}%;"></div>
      </div>
    </td></tr>`
  : '';

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${subject}</title></head>
<body style="margin:0;padding:0;background:#FAF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">

<!-- Simulated email header -->
<div style="background:#fff;border-bottom:1px solid #e5e5e5;padding:16px 24px;font-size:12px;color:#8A9AA0;max-width:520px;margin:0 auto;">
  <div style="color:#141413;font-weight:600;font-size:13px;">Grow Your Cashflow &lt;deals@growyourcashflow.io&gt;</div>
  <div style="margin-top:4px;"><strong style="color:#141413;">Subject:</strong> ${subject}</div>
  <div style="margin-top:2px;"><strong style="color:#141413;">To:</strong> ${EMAIL}</div>
</div>

<table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#FAF9F5;"><tr><td align="center" style="padding:32px 16px;">
<table cellpadding="0" cellspacing="0" border="0" width="480" style="max-width:480px;">

<!-- Header -->
<tr><td align="center" style="padding-bottom:24px;">
  <div style="display:inline-block;">
    <span style="font-family:Georgia,serif;font-size:18px;font-weight:700;color:#141413;letter-spacing:-0.3px;">Grow Your Cashflow</span>
    <span style="color:#DDE5E8;margin:0 8px;">&#183;</span>
    <span style="font-size:13px;font-weight:600;color:#51BE7B;letter-spacing:0.3px;">Deal Alert</span>
  </div>
</td></tr>

<!-- Deal Card (clickable) — matches platform card layout exactly -->
<tr><td>
<a href="${viewUrl}" style="text-decoration:none;color:inherit;display:block;">
<table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);cursor:pointer;">

  <!-- Card Hero: badges + Target IRR -->
  <tr><td style="background:linear-gradient(135deg,#1a2332 0%,#2d3748 100%);padding:24px 24px 20px;">
    <div style="margin-bottom:16px;">
      <span style="display:inline-block;background:rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;margin-right:6px;letter-spacing:0.3px;">${deal.asset_class || ''}</span>
      <span style="display:inline-block;background:rgba(81,190,123,0.25);color:#51BE7B;font-size:11px;font-weight:700;padding:4px 10px;border-radius:4px;letter-spacing:0.3px;">${deal.deal_type || ''}</span>
      ${noDeckBadge}
    </div>
    <div style="font-size:42px;font-weight:800;color:#51BE7B;line-height:1;">${irr}</div>
    <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.5);letter-spacing:0.5px;margin-top:6px;">TARGET IRR</div>
  </td></tr>

  <!-- Deal Name + Operator + Description -->
  <tr><td style="background:#fff;padding:20px 24px 12px;">
    <div style="font-size:20px;font-weight:700;color:#141413;line-height:1.3;">${deal.investment_name}</div>
    <div style="font-size:13px;color:#607179;margin-top:4px;">${mc.operator_name || ''}</div>
    <div style="font-size:13px;color:#8A9AA0;margin-top:10px;line-height:1.5;">${desc}${desc.length >= 180 ? '...' : ''}</div>
  </td></tr>

  <!-- Metrics Row 1: TARGET IRR, MINIMUM, LOCKUP, DISTRIBUTION -->
  <tr><td style="background:#fff;padding:0 24px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #F0F0EE;"><tr>
      <td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">TARGET IRR</div><div style="font-size:15px;font-weight:700;color:#51BE7B;margin-top:2px;">${irr}</div></td>
      <td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">MINIMUM</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${min}</div></td>
      <td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">LOCKUP</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${hold}</div></td>
      <td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">DISTRIBUTION</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${dist}</div></td>
    </tr></table>
  </td></tr>

  <!-- Metrics Row 2: LP/GP SPLIT, EQUITY MULT., MANAGER SIZE, FOUNDED -->
  <tr><td style="background:#fff;padding:0 24px 16px;">
    <table cellpadding="0" cellspacing="0" border="0" width="100%" style="border-top:1px solid #F0F0EE;"><tr>
      <td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">LP/GP SPLIT</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${split}</div></td>
      <td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">EQUITY MULT.</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${emx}</div></td>
      <td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">MANAGER SIZE</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${mgrSize}</div></td>
      <td style="padding:14px 0;width:25%;"><div style="font-size:10px;font-weight:600;color:#8A9AA0;letter-spacing:0.5px;">FOUNDED</div><div style="font-size:15px;font-weight:700;color:#141413;margin-top:2px;">${founded}</div></td>
    </tr></table>
  </td></tr>

  ${fundingBar}

</table>
</a>
</td></tr>

<!-- Skip + Save buttons -->
<tr><td style="padding:16px 0 20px;">
  <table cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
    <td style="width:48%;padding-right:8px;"><a href="${skipUrl}" style="display:block;text-align:center;padding:14px;border:2px solid #DDE5E8;border-radius:10px;font-size:14px;font-weight:700;color:#8A9AA0;text-decoration:none;">&#10005; Skip</a></td>
    <td style="width:52%;padding-left:8px;"><a href="${saveUrl}" style="display:block;text-align:center;padding:14px;background:#51BE7B;border-radius:10px;font-size:14px;font-weight:700;color:#fff;text-decoration:none;">&#128204; Save Deal</a></td>
  </tr></table>
</td></tr>

<!-- More deals -->
<tr><td align="center" style="padding:4px 0 20px;"><a href="${BASE}" style="font-size:13px;font-weight:600;color:#51BE7B;text-decoration:none;">+ ${(count || 400) - 1} more deals in the database &#8594;</a></td></tr>

<!-- Buy box nudge -->
<tr><td><table cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#F0F9F4;border-radius:10px;"><tr><td style="padding:16px 20px;text-align:center;">
  <div style="font-size:13px;font-weight:700;color:#141413;margin-bottom:4px;">Not the right fit?</div>
  <div style="font-size:12px;color:#607179;margin-bottom:10px;">Update your buy box and we'll send better matches next time.</div>
  <a href="${BASE}/index.html#buybox?step=4" style="font-weight:700;font-size:13px;color:#51BE7B;text-decoration:none;">Update Buy Box &#8594;</a>
</td></tr></table></td></tr>

<!-- Footer -->
<tr><td align="center" style="padding:24px 0 0;">
  <div style="font-size:11px;color:#8A9AA0;">
    <a href="${BASE}/index.html#settings" style="color:#8A9AA0;text-decoration:underline;">Manage preferences</a>
    <span style="margin:0 4px;">&#183;</span>
    <a href="${BASE}/api/unsubscribe?email=${encodeURIComponent(EMAIL)}" style="color:#8A9AA0;text-decoration:underline;">Unsubscribe</a>
  </div>
  <div style="font-size:11px;color:#C4CDD1;margin-top:8px;">Grow Your Cashflow &#183; growyourcashflow.io</div>
</td></tr>

</table></td></tr></table></body></html>`;

writeFileSync(join(__dirname, '..', 'weekly-digest-preview.html'), html);
console.log('Done!');
console.log('Subject:', subject);
console.log('Deal:', deal.investment_name, '|', mc.operator_name);
console.log('Hero: Target IRR =', irr);
console.log('Funded:', pctFunded ? pctFunded + '%' : 'N/A');
console.log('Has deck:', hasDeck);
