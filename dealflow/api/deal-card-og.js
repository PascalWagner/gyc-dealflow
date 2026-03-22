// Vercel Edge Function: Renders a deal card as a PNG image for emails
// Usage: /api/deal-card-og?id=UUID
//
// Uses @vercel/og (Satori) to render JSX → PNG at the edge.
// The image looks identical across all email clients.

import { ImageResponse } from '@vercel/og';
import { getAdminClient } from './_supabase.js';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get('id');

  if (!dealId) {
    return new Response('Missing id', { status: 400 });
  }

  // Fetch deal data
  const supabase = getAdminClient();
  const { data: deal, error } = await supabase
    .from('opportunities')
    .select(`*, management_company:management_companies(operator_name, founding_year, total_investors)`)
    .eq('id', dealId)
    .single();

  if (error || !deal) {
    return new Response('Deal not found', { status: 404 });
  }

  const mc = deal.management_company || {};
  const yieldVal = deal.preferred_return || deal.cash_on_cash || deal.target_irr || 0;
  const yieldPct = yieldVal > 1 ? yieldVal.toFixed(1) : (yieldVal * 100).toFixed(1);
  const yieldLabel = deal.preferred_return ? 'PREF RETURN' : deal.cash_on_cash ? 'CASH ON CASH' : 'TARGET IRR';
  const min = deal.investment_minimum;
  const minStr = min >= 1000000 ? '$' + (min / 1000000).toFixed(1) + 'M' : min >= 1000 ? '$' + (min / 1000).toFixed(0) + 'K' : min ? '$' + min : '—';
  const holdStr = deal.hold_period_years ? deal.hold_period_years + ' Yrs' : '—';
  const splitStr = deal.lp_gp_split || '—';
  const distStr = deal.distributions || '—';
  const emx = deal.equity_multiple ? deal.equity_multiple.toFixed(2) + 'x' : '—';
  const inv = mc.total_investors || 0;
  const tierLabel = inv >= 500 ? 'Established' : inv >= 100 ? 'Growing' : inv > 0 ? 'Emerging' : '—';
  const pctFunded = (deal.total_amount_sold && deal.offering_size && deal.offering_size > 0)
    ? Math.round(deal.total_amount_sold / deal.offering_size * 100) : null;
  const strategy = (deal.investment_strategy || '').substring(0, 160);

  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', width: '480px',
        background: '#fff', borderRadius: '16px', overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
        border: '1px solid #DDE5E8',
      }}>
        {/* Hero */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          background: '#1a3a2a', padding: '24px 28px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '4px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>{deal.asset_class || ''}</span>
              <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '4px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>{deal.deal_type || 'Fund'}</span>
              {pctFunded >= 70 && pctFunded < 100 && (
                <span style={{ background: '#EF4444', color: '#fff', padding: '4px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 700 }}>{pctFunded}% FUNDED</span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '36px', fontWeight: 800, color: '#51BE7B', lineHeight: 1 }}>{yieldPct}%</span>
            <span style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '1px', marginTop: '4px' }}>{yieldLabel}</span>
          </div>
        </div>

        {/* Body */}
        <div style={{ display: 'flex', flexDirection: 'column', padding: '20px 28px' }}>
          <span style={{ fontSize: '20px', fontWeight: 700, color: '#141413', lineHeight: 1.3 }}>{deal.investment_name}</span>
          <span style={{ fontSize: '14px', color: '#607179', marginTop: '4px' }}>{mc.operator_name || ''}</span>
          {strategy && <span style={{ fontSize: '13px', color: '#8A9AA0', lineHeight: 1.5, marginTop: '8px' }}>{strategy}{strategy.length >= 155 ? '...' : ''}</span>}
        </div>

        {/* Divider */}
        <div style={{ display: 'flex', margin: '0 28px', borderTop: '1px solid #EDF1F2' }} />

        {/* Metrics row 1 */}
        <div style={{ display: 'flex', padding: '16px 28px', gap: '0' }}>
          {[
            { label: 'Target Income', value: yieldPct + '%', color: '#51BE7B' },
            { label: 'Minimum', value: minStr },
            { label: 'Lockup', value: holdStr },
            { label: 'Distribution', value: distStr },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#8A9AA0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</span>
              <span style={{ fontSize: '14px', fontWeight: 700, color: m.color || '#141413', marginTop: '4px' }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Metrics row 2 */}
        <div style={{ display: 'flex', padding: '0 28px 20px', gap: '0' }}>
          {[
            { label: 'LP/GP Split', value: splitStr },
            { label: 'Equity Mult.', value: emx },
            { label: 'Manager Size', value: tierLabel },
            { label: 'Founded', value: mc.founding_year ? String(mc.founding_year) : '—' },
          ].map((m, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#8A9AA0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{m.label}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#141413', marginTop: '4px' }}>{m.value}</span>
            </div>
          ))}
        </div>

        {/* Funding progress bar */}
        {pctFunded > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 28px 20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#8A9AA0', marginBottom: '4px' }}>
              <span>${(deal.total_amount_sold / 1000000).toFixed(1)}M raised</span>
              <span>{pctFunded}% funded</span>
            </div>
            <div style={{ display: 'flex', height: '8px', borderRadius: '4px', overflow: 'hidden', background: '#EDF1F2' }}>
              <div style={{ width: `${Math.min(pctFunded, 100)}%`, background: pctFunded >= 90 ? '#EF4444' : pctFunded >= 70 ? '#F59E0B' : '#51BE7B', borderRadius: '4px' }} />
            </div>
          </div>
        )}
      </div>
    ),
    {
      width: 480,
      height: pctFunded > 0 ? 520 : 480,
    }
  );
}
