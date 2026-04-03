// Vercel Serverless Function: User Agreement
// Records user acceptance of Platform Terms of Service.
// GET  → returns latest agreement status for authenticated user
// POST { acceptedTos, acceptedPrivacy, acceptedDisclaimer } → creates acceptance record

import { getAdminClient, setCors, rateLimit } from './_supabase.js';
import { CURRENT_USER_AGREEMENT_VERSION, getLatestUserAgreement, hasCurrentUserAgreement } from './_user-agreement.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!rateLimit(req, res)) return;

  const supabase = getAdminClient();

  // Auth check
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization' });
  }
  const token = authHeader.replace('Bearer ', '');

  let userId = null;
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (user) {
    userId = user.id;
  } else {
    // Fallback: decode JWT for expired tokens
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload?.sub) userId = payload.sub;
    } catch {}
  }
  if (!userId) {
    return res.status(401).json({ error: 'Invalid authorization' });
  }

  // GET: Check agreement status
  if (req.method === 'GET') {
    try {
      const agreement = await getLatestUserAgreement(supabase, userId);
      const hasCurrentVersion = hasCurrentUserAgreement(agreement);

      return res.status(200).json({
        agreement: agreement || null,
        hasCurrentVersion,
        currentVersion: CURRENT_USER_AGREEMENT_VERSION
      });
    } catch (e) {
      console.error('User agreement GET error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST: Record acceptance
  if (req.method === 'POST') {
    const { acceptedTos, acceptedPrivacy, acceptedDisclaimer } = req.body || {};

    if (!acceptedTos || !acceptedPrivacy || !acceptedDisclaimer) {
      return res.status(400).json({ error: 'All three consents must be accepted' });
    }

    try {
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const { data: record, error } = await supabase
        .from('user_agreements')
        .insert({
          user_id: userId,
          agreement_type: 'platform_tos',
          agreement_version: CURRENT_USER_AGREEMENT_VERSION,
          accepted_tos: true,
          accepted_privacy: true,
          accepted_disclaimer: true,
          accepted_at: new Date().toISOString(),
          ip_address: ip,
          user_agent: userAgent
        })
        .select('id, accepted_at')
        .single();

      if (error) throw error;

      // Update fast-path column on profiles
      await supabase
        .from('user_profiles')
        .update({ tos_accepted_version: CURRENT_USER_AGREEMENT_VERSION })
        .eq('id', userId);

      return res.status(200).json({
        success: true,
        agreementId: record.id,
        acceptedAt: record.accepted_at,
        version: CURRENT_USER_AGREEMENT_VERSION
      });
    } catch (e) {
      console.error('User agreement POST error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
