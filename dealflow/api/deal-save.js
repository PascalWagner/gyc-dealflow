// Vercel Serverless Function: One-tap deal save from email
// Usage: GET /api/deal-save?id=DEAL_ID&email=EMAIL&token=HMAC
//
// Saves the deal to the user's pipeline and redirects to the deal page.
// Token = HMAC-SHA256(email + dealId, secret) to prevent abuse.

import { getAdminClient, setCors } from './_supabase.js';
import { createHmac } from 'crypto';

const SAVE_SECRET = process.env.DIGEST_SECRET || process.env.SAVE_SECRET || 'gyc-deal-save-2026';

export function generateSaveToken(email, dealId) {
  return createHmac('sha256', SAVE_SECRET)
    .update(email + ':' + dealId)
    .digest('hex')
    .substring(0, 16);
}

export function generateSaveUrl(dealId, email) {
  const token = generateSaveToken(email, dealId);
  return `https://dealflow.growyourcashflow.io/api/deal-save?id=${dealId}&email=${encodeURIComponent(email)}&token=${token}`;
}

export function generateSkipUrl(dealId, email) {
  const token = generateSaveToken(email, dealId);
  return `https://dealflow.growyourcashflow.io/api/deal-save?id=${dealId}&email=${encodeURIComponent(email)}&token=${token}&action=skip`;
}

export default async function handler(req, res) {
  setCors(res);

  const { id, email, token, action } = req.query;
  // Map to DB stage names (same as deal.html's dbStageMap)
  const stage = action === 'skip' ? 'passed' : 'interested';

  if (!id || !email || !token) {
    return res.redirect(302, `https://dealflow.growyourcashflow.io/deal.html?id=${id || ''}`);
  }

  // Verify token
  const expected = generateSaveToken(email, id);
  if (token !== expected) {
    return res.redirect(302, `https://dealflow.growyourcashflow.io/deal.html?id=${id}`);
  }

  try {
    const supabase = getAdminClient();

    // Find user by email
    const { data: user } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (user) {
      // Try update first (handles existing rows reliably)
      const { data: existing } = await supabase
        .from('user_deal_stages')
        .select('id')
        .eq('user_id', user.id)
        .eq('deal_id', id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('user_deal_stages')
          .update({ stage, updated_at: new Date().toISOString() })
          .eq('user_id', user.id)
          .eq('deal_id', id);
      } else {
        await supabase
          .from('user_deal_stages')
          .insert({
            user_id: user.id,
            deal_id: id,
            stage,
            notes: '',
            updated_at: new Date().toISOString()
          });
      }
    }
  } catch (err) {
    console.error('Deal action error:', err.message);
  }

  // Both Save and Skip go to the deal page with the action result
  const actionParam = stage === 'passed' ? 'skipped=true' : 'saved=true';
  const redirect = `https://dealflow.growyourcashflow.io/deal.html?id=${id}&${actionParam}`;
  return res.redirect(302, redirect);
}
