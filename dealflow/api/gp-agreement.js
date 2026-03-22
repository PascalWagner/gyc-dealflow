// Vercel Serverless Function: GP Agreement
// Records operator acceptance of the Operator Listing Agreement.
//
// GET  ?email=...  → returns latest agreement status for this user
// POST { email, signatoryName, signatoryEmail, signatoryTitle, offeringType,
//        acceptedTos, acceptedListing, acceptedDataAccuracy, acceptedRecording,
//        agreementTextHash }
//     → creates immutable acceptance record

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

const CURRENT_VERSION = '1.0';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!rateLimit(req, res)) return;

  const supabase = getAdminClient();

  // ── GET: Check if user has accepted current terms ──
  if (req.method === 'GET') {
    const email = req.query?.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, management_company_id')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) return res.status(404).json({ error: 'User not found' });

      // Get latest agreement for this user
      const { data: agreement } = await supabase
        .from('gp_agreements')
        .select('*')
        .eq('user_id', profile.id)
        .order('accepted_at', { ascending: false })
        .limit(1)
        .single();

      return res.status(200).json({
        hasAgreement: !!agreement,
        currentVersion: CURRENT_VERSION,
        isCurrentVersion: agreement ? agreement.agreement_version === CURRENT_VERSION : false,
        agreement: agreement || null
      });
    } catch (e) {
      console.error('GP agreement GET error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: Record agreement acceptance ──
  if (req.method === 'POST') {
    const {
      email, signatoryName, signatoryEmail, signatoryTitle, offeringType,
      acceptedTos, acceptedListing, acceptedDataAccuracy, acceptedRecording,
      agreementTextHash
    } = req.body || {};

    if (!email || !signatoryName || !signatoryEmail) {
      return res.status(400).json({ error: 'Email, signatoryName, and signatoryEmail required' });
    }

    if (!acceptedTos || !acceptedListing || !acceptedDataAccuracy) {
      return res.status(400).json({ error: 'All required terms must be accepted' });
    }

    try {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, management_company_id')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) return res.status(404).json({ error: 'User not found' });

      // Extract IP and user agent for legal record
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      // Insert immutable record
      const { data: record, error } = await supabase
        .from('gp_agreements')
        .insert({
          user_id: profile.id,
          management_company_id: profile.management_company_id,
          agreement_version: CURRENT_VERSION,
          offering_type: offeringType || '506c',
          accepted_tos: acceptedTos === true,
          accepted_listing: acceptedListing === true,
          accepted_data_accuracy: acceptedDataAccuracy === true,
          accepted_recording: acceptedRecording === true,
          ip_address: ip,
          user_agent: userAgent,
          signatory_name: signatoryName,
          signatory_email: signatoryEmail,
          signatory_title: signatoryTitle || null,
          agreement_text_hash: agreementTextHash || null
        })
        .select('id, accepted_at')
        .single();

      if (error) throw error;

      // Also update onboarding step
      await supabase
        .from('user_profiles')
        .update({ gp_onboarding_step: 4 })
        .eq('id', profile.id);

      return res.status(200).json({
        success: true,
        agreementId: record.id,
        acceptedAt: record.accepted_at,
        version: CURRENT_VERSION
      });
    } catch (e) {
      console.error('GP agreement POST error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
