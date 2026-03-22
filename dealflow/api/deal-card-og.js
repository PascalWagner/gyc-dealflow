// Vercel Serverless Function: Renders a deal card as an HTML page (screenshot-ready)
// Usage: /api/deal-card-og?id=UUID
//
// Returns a standalone HTML page styled as the deal card.
// Can be screenshotted for email, or linked as "view in browser".

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  const dealId = req.query.id;
  if (!dealId) return res.status(400).send('Missing id');

  try {
    const supabase = getAdminClient();
    const { data: deal, error } = await supabase
      .from('opportunities')
      .select(`*, management_company:management_companies(operator_name, founding_year, total_investors)`)
      .eq('id', dealId)
      .single();

    if (error || !deal) return res.status(404).send('Deal not found');

    const mc = deal.management_company || {};
    const yieldVal = deal.preferred_return || deal.cash_on_cash || deal.target_irr || 0;
    const yieldPct = yieldVal > 1 ? yieldVal.toFixed(1) : (yieldVal * 100).toFixed(1);
    const yieldLabel = deal.preferred_return ? 'PREF RETURN' : deal.cash_on_cash ? 'CASH ON CASH' : 'TARGET IRR';
    const min = deal.investment_minimum || 0;
    const minStr = min >= 1000000 ? '$' + (min / 1000000).toFixed(1) + 'M' : min >= 1000 ? '$' + (min / 1000).toFixed(0) + 'K' : min ? '$' + min : '\u2014';
    const holdStr = deal.hold_period_years ? deal.hold_period_years + ' Yrs' : '\u2014';
    const splitStr = deal.lp_gp_split || '\u2014';
    const distStr = deal.distributions || '\u2014';
    const emx = deal.equity_multiple ? deal.equity_multiple.toFixed(2) + 'x' : '\u2014';
    const inv = mc.total_investors || 0;
    const tierLabel = inv >= 500 ? 'Established' : inv >= 100 ? 'Growing' : inv > 0 ? 'Emerging' : '\u2014';
    const pctFunded = (deal.total_amount_sold && deal.offering_size && deal.offering_size > 0)
      ? Math.round(deal.total_amount_sold / deal.offering_size * 100) : null;
    const strategy = (deal.investment_strategy || '').substring(0, 180);
    const fundedColor = pctFunded >= 90 ? '#EF4444' : pctFunded >= 70 ? '#F59E0B' : '#51BE7B';

    const html = `<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=480">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #FAF9F5; display: flex; justify-content: center; padding: 20px; }
  .card { width: 480px; background: #fff; border-radius: 16px; overflow: hidden; border: 1px solid #DDE5E8; }
  .hero { background: #1a3a2a; padding: 24px 28px; display: flex; justify-content: space-between; align-items: flex-start; }
  .badges { display: flex; flex-wrap: wrap; gap: 6px; }
  .badge { display: inline-block; padding: 4px 10px; border-radius: 5px; font-size: 11px; font-weight: 700; letter-spacing: 0.5px; color: #fff; background: rgba(255,255,255,0.15); }
  .badge-red { background: #EF4444; }
  .yield { text-align: right; }
  .yield-num { font-size: 36px; font-weight: 800; color: #51BE7B; line-height: 1; }
  .yield-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.4); letter-spacing: 1px; margin-top: 4px; }
  .body { padding: 20px 28px; }
  .title { font-size: 20px; font-weight: 700; color: #141413; line-height: 1.3; }
  .operator { font-size: 14px; color: #607179; margin-top: 4px; }
  .strategy { font-size: 13px; color: #8A9AA0; line-height: 1.5; margin-top: 8px; }
  .divider { margin: 0 28px; border-top: 1px solid #EDF1F2; }
  .metrics { display: flex; padding: 16px 28px; }
  .metrics-bottom { display: flex; padding: 0 28px 20px; }
  .metric { flex: 1; }
  .metric-label { font-size: 9px; font-weight: 700; color: #8A9AA0; text-transform: uppercase; letter-spacing: 0.5px; }
  .metric-value { font-size: 14px; font-weight: 700; color: #141413; margin-top: 4px; }
  .metric-value.green { color: #51BE7B; }
  .metric-sm .metric-value { font-size: 13px; }
  .funding { padding: 0 28px 20px; }
  .funding-bar-bg { height: 8px; border-radius: 4px; background: #EDF1F2; overflow: hidden; margin-top: 4px; }
  .funding-bar { height: 100%; border-radius: 4px; }
  .funding-meta { display: flex; justify-content: space-between; font-size: 10px; color: #8A9AA0; margin-bottom: 4px; }
</style></head><body>
<div class="card">
  <div class="hero">
    <div class="badges">
      <span class="badge">${deal.asset_class || ''}</span>
      <span class="badge">${deal.deal_type || 'Fund'}</span>
      ${pctFunded && pctFunded >= 70 && pctFunded < 100 ? '<span class="badge badge-red">' + pctFunded + '% FUNDED</span>' : ''}
    </div>
    <div class="yield">
      ${yieldVal > 0 ? '<div class="yield-num">' + yieldPct + '%</div><div class="yield-label">' + yieldLabel + '</div>' : ''}
    </div>
  </div>
  <div class="body">
    <div class="title">${deal.investment_name}</div>
    <div class="operator">${mc.operator_name || ''}</div>
    ${strategy ? '<div class="strategy">' + strategy + (strategy.length >= 175 ? '...' : '') + '</div>' : ''}
  </div>
  <div class="divider"></div>
  <div class="metrics">
    <div class="metric"><div class="metric-label">Target Income</div><div class="metric-value green">${yieldPct}%</div></div>
    <div class="metric"><div class="metric-label">Minimum</div><div class="metric-value">${minStr}</div></div>
    <div class="metric"><div class="metric-label">Lockup</div><div class="metric-value">${holdStr}</div></div>
    <div class="metric"><div class="metric-label">Distribution</div><div class="metric-value">${distStr}</div></div>
  </div>
  <div class="metrics-bottom metric-sm">
    <div class="metric"><div class="metric-label">LP/GP Split</div><div class="metric-value">${splitStr}</div></div>
    <div class="metric"><div class="metric-label">Equity Mult.</div><div class="metric-value">${emx}</div></div>
    <div class="metric"><div class="metric-label">Manager Size</div><div class="metric-value">${tierLabel}</div></div>
    <div class="metric"><div class="metric-label">Founded</div><div class="metric-value">${mc.founding_year || '\u2014'}</div></div>
  </div>
  ${pctFunded && pctFunded > 0 ? `
  <div class="funding">
    <div class="funding-meta">
      <span>$${deal.total_amount_sold >= 1000000 ? (deal.total_amount_sold / 1000000).toFixed(1) + 'M' : (deal.total_amount_sold / 1000).toFixed(0) + 'K'} raised</span>
      <span>${pctFunded}% funded</span>
    </div>
    <div class="funding-bar-bg"><div class="funding-bar" style="width:${Math.min(pctFunded, 100)}%;background:${fundedColor};"></div></div>
  </div>` : ''}
</div>
</body></html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).send(html);
  } catch (err) {
    return res.status(500).send('Error: ' + err.message);
  }
}
