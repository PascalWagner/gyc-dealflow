// Vercel Serverless Function: GP Deal Claim
// Allows operators to claim ownership of a deal listing.
// Stores claim in Supabase, fires Make.com webhook for GP outreach email.

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

const MAKE_WEBHOOK_URL = process.env.MAKE_GP_CLAIM_WEBHOOK;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!rateLimit(req, res, { maxRequests: 5, windowMs: 60_000 })) return;

  // Auth required
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = getAdminClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { dealId, name, email, company, role } = req.body || {};
  if (!dealId || !name || !email || !role) {
    return res.status(400).json({ error: 'dealId, name, email, and role are required' });
  }

  // Check for existing claim on this deal
  const { data: existing } = await supabase
    .from('deal_claims')
    .select('id, status')
    .eq('deal_id', dealId)
    .in('status', ['pending', 'approved'])
    .limit(1);

  if (existing && existing.length > 0) {
    return res.status(409).json({ error: 'This deal already has a pending or approved claim' });
  }

  // Look up deal name for the webhook
  const { data: deal } = await supabase
    .from('opportunities')
    .select('investment_name, management_company_id')
    .eq('id', dealId)
    .single();

  // Insert claim
  const { data: claim, error: insertError } = await supabase
    .from('deal_claims')
    .insert({
      deal_id: dealId,
      claimer_user_id: user.id,
      claimer_email: email,
      claimer_name: name,
      company_name: company,
      role,
      status: 'pending'
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('Deal claim insert error:', insertError);
    return res.status(500).json({ success: false, error: 'Failed to submit claim' });
  }

  // Fire Make.com webhook for GP outreach (non-blocking)
  if (MAKE_WEBHOOK_URL) {
    fetch(MAKE_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        claimId: claim.id,
        dealId,
        dealName: deal?.investment_name || 'Unknown Deal',
        claimerName: name,
        claimerEmail: email,
        company,
        role,
        dealUrl: 'https://deals.growyourcashflow.io/deal.html?id=' + dealId
      })
    }).catch(e => console.error('Make webhook error:', e));
  }

  return res.json({ success: true, claimId: claim.id });
}
