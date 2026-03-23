// Vercel Serverless Function: Co-Investment Invite Links
// POST: Creates an invite link for a deal (auth required)
// GET: Looks up invite link metadata by code (public)

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

function generateCode() {
  var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  var code = '';
  for (var i = 0; i < 8; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getAdminClient();

  // GET: Look up invite by code (public, no auth needed)
  if (req.method === 'GET') {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: 'code param required' });

    const { data, error } = await supabase
      .from('invite_links')
      .select('id, deal_id, inviter_name, inviter_email, created_at')
      .eq('code', code)
      .single();

    if (error || !data) return res.json({ success: false });

    return res.json({
      success: true,
      inviterName: data.inviter_name,
      dealId: data.deal_id
    });
  }

  // POST: Create invite link (auth required)
  if (req.method !== 'POST') return res.status(405).json({ error: 'GET or POST only' });
  if (!rateLimit(req, res, { maxRequests: 30, windowMs: 60_000 })) return;

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const { dealId } = req.body || {};
  if (!dealId) return res.status(400).json({ error: 'dealId required' });

  // Look up user profile for name
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('first_name, last_name')
    .eq('user_id', user.id)
    .single();

  const inviterName = profile
    ? ((profile.first_name || '') + ' ' + (profile.last_name || '')).trim() || user.email.split('@')[0]
    : user.email.split('@')[0];

  const code = generateCode();

  const { data: link, error: insertError } = await supabase
    .from('invite_links')
    .insert({
      code,
      deal_id: dealId,
      inviter_user_id: user.id,
      inviter_email: user.email,
      inviter_name: inviterName
    })
    .select('code')
    .single();

  if (insertError) {
    console.error('Invite insert error:', insertError);
    return res.status(500).json({ success: false, error: 'Failed to create invite' });
  }

  return res.json({ success: true, code: link.code });
}
