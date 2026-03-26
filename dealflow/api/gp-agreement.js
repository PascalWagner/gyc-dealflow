// Vercel Serverless Function: GP Agreement
// Records operator acceptance of the Operator Listing Agreement.
// Stores the full agreement text in the DB and generates a PDF receipt in Supabase Storage.
//
// GET  ?email=...  → returns latest agreement status for this user
// POST { email, signatoryName, signatoryEmail, signatoryTitle, offeringType,
//        acceptedTos, acceptedListing, acceptedDataAccuracy, acceptedRecording,
//        agreementText, agreementTextHash }
//     → creates immutable acceptance record + PDF

import { getAdminClient, setCors, rateLimit } from './_supabase.js';
import { CURRENT_GP_AGREEMENT_VERSION, getLatestGpAgreement, hasCurrentGpAgreement } from './_gp-agreement.js';

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
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization' });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user?.email) {
        return res.status(401).json({ error: 'Invalid authorization' });
      }
      if (user.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: 'Email does not match authenticated user' });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, management_company_id')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) return res.status(404).json({ error: 'User not found' });

      const agreement = await getLatestGpAgreement(supabase, profile.id);
      const hasCurrentAgreement = hasCurrentGpAgreement(agreement);

      return res.status(200).json({
        hasAgreement: !!agreement,
        currentVersion: CURRENT_GP_AGREEMENT_VERSION,
        isCurrentVersion: hasCurrentAgreement,
        hasCurrentAgreement,
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
      agreementText, agreementTextHash
    } = req.body || {};

    if (!email || !signatoryName || !signatoryEmail) {
      return res.status(400).json({ error: 'Email, signatoryName, and signatoryEmail required' });
    }
    if (!acceptedTos || !acceptedListing || !acceptedDataAccuracy || !acceptedRecording) {
      return res.status(400).json({ error: 'All required terms must be accepted' });
    }
    if (!agreementText) {
      return res.status(400).json({ error: 'Agreement text is required for the legal record' });
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization' });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user?.email) {
        return res.status(401).json({ error: 'Invalid authorization' });
      }
      if (user.email.toLowerCase() !== email.toLowerCase() || user.email.toLowerCase() !== signatoryEmail.toLowerCase()) {
        return res.status(403).json({ error: 'Agreement signer must match authenticated user' });
      }

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, management_company_id, full_name')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) return res.status(404).json({ error: 'User not found' });

      // Extract IP and user agent for legal record
      const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.socket?.remoteAddress
        || 'unknown';
      const userAgent = req.headers['user-agent'] || 'unknown';

      const acceptedAt = new Date().toISOString();

      // Build the PDF as HTML → stored as a self-contained HTML file (renders as PDF when printed)
      const pdfHtml = buildAgreementPdf({
        agreementText,
        signatoryName,
        signatoryEmail,
        signatoryTitle,
        offeringType: offeringType || '506c',
        acceptedAt,
        ip,
        version: CURRENT_GP_AGREEMENT_VERSION,
        acceptedTos,
        acceptedListing,
        acceptedDataAccuracy,
        acceptedRecording
      });

      // Upload PDF to Supabase Storage
      let pdfUrl = null;
      try {
        const fileName = `agreements/${profile.id}/${CURRENT_GP_AGREEMENT_VERSION}_${Date.now()}.html`;
        const { data: uploadData, error: uploadErr } = await supabase.storage
          .from('deal-decks') // reuse existing bucket
          .upload(fileName, Buffer.from(pdfHtml, 'utf-8'), {
            contentType: 'text/html',
            upsert: false
          });

        if (!uploadErr && uploadData) {
          const { data: urlData } = supabase.storage
            .from('deal-decks')
            .getPublicUrl(fileName);
          pdfUrl = urlData?.publicUrl || null;
        }
      } catch (storageErr) {
        console.warn('PDF storage failed (non-blocking):', storageErr.message);
        // Non-blocking — agreement still saved in DB with full text
      }

      // Insert immutable record with full agreement text
      const { data: record, error } = await supabase
        .from('gp_agreements')
        .insert({
          user_id: profile.id,
          management_company_id: profile.management_company_id,
          agreement_version: CURRENT_GP_AGREEMENT_VERSION,
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
          agreement_text_hash: agreementTextHash || null,
          agreement_text: agreementText,
          agreement_pdf_url: pdfUrl,
          accepted_at: acceptedAt
        })
        .select('id, accepted_at, agreement_pdf_url')
        .single();

      if (error) throw error;

      // Update onboarding step
      await supabase
        .from('user_profiles')
        .update({ gp_onboarding_step: 4 })
        .eq('id', profile.id);

      return res.status(200).json({
        success: true,
        agreementId: record.id,
        acceptedAt: record.accepted_at,
        pdfUrl: record.agreement_pdf_url,
        version: CURRENT_GP_AGREEMENT_VERSION
      });
    } catch (e) {
      console.error('GP agreement POST error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// Build a self-contained HTML document that serves as the signed agreement receipt.
// This can be printed to PDF from any browser, and contains all the legal details.
function buildAgreementPdf({ agreementText, signatoryName, signatoryEmail, signatoryTitle, offeringType, acceptedAt, ip, version, acceptedTos, acceptedListing, acceptedDataAccuracy, acceptedRecording }) {
  const date = new Date(acceptedAt);
  const dateStr = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short' });

  const offeringLabel = {
    '506c': 'Regulation D 506(c)',
    '506b': 'Regulation D 506(b)',
    'reg_a': 'Regulation A+',
    'other': 'Other / Not Yet Determined'
  }[offeringType] || offeringType;

  const esc = (s) => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Signed Operator Listing Agreement — ${esc(signatoryName)}</title>
<style>
  body { font-family: 'Georgia', 'Times New Roman', serif; max-width: 720px; margin: 40px auto; padding: 0 24px; color: #1a1a1a; line-height: 1.7; font-size: 14px; }
  h1 { font-size: 22px; text-align: center; margin-bottom: 4px; }
  .subtitle { text-align: center; color: #666; font-size: 13px; margin-bottom: 32px; }
  .meta-box { background: #f8f8f8; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px 24px; margin-bottom: 28px; }
  .meta-row { display: flex; margin-bottom: 6px; }
  .meta-label { font-weight: bold; width: 180px; flex-shrink: 0; font-size: 13px; }
  .meta-value { font-size: 13px; }
  h2 { font-size: 16px; margin-top: 28px; margin-bottom: 8px; border-bottom: 1px solid #e0e0e0; padding-bottom: 4px; }
  .agreement-body { white-space: pre-wrap; }
  .consent-section { background: #f0faf4; border: 1px solid #c8e6d4; border-radius: 8px; padding: 20px 24px; margin: 28px 0; }
  .consent-item { margin-bottom: 8px; font-size: 13px; }
  .consent-item .check { color: #22863a; font-weight: bold; margin-right: 8px; }
  .consent-item .uncheck { color: #999; margin-right: 8px; }
  .signature-box { border: 2px solid #1a1a1a; border-radius: 8px; padding: 24px; margin: 28px 0; text-align: center; }
  .sig-name { font-family: 'Brush Script MT', 'Segoe Script', cursive; font-size: 32px; color: #1a1a1a; margin-bottom: 4px; }
  .sig-line { border-top: 1px solid #1a1a1a; width: 300px; margin: 0 auto 8px; }
  .sig-meta { font-size: 12px; color: #666; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e0e0e0; font-size: 11px; color: #999; text-align: center; }
  @media print { body { margin: 0; } .meta-box { break-inside: avoid; } }
</style>
</head>
<body>
<h1>Operator Listing Agreement</h1>
<div class="subtitle">Grow Your Cashflow LLC — Executed Copy</div>

<div class="meta-box">
  <div class="meta-row"><div class="meta-label">Agreement Version:</div><div class="meta-value">${esc(version)}</div></div>
  <div class="meta-row"><div class="meta-label">Date Signed:</div><div class="meta-value">${esc(dateStr)} at ${esc(timeStr)}</div></div>
  <div class="meta-row"><div class="meta-label">Signatory:</div><div class="meta-value">${esc(signatoryName)}${signatoryTitle ? ' — ' + esc(signatoryTitle) : ''}</div></div>
  <div class="meta-row"><div class="meta-label">Email:</div><div class="meta-value">${esc(signatoryEmail)}</div></div>
  <div class="meta-row"><div class="meta-label">Offering Type:</div><div class="meta-value">${esc(offeringLabel)}</div></div>
  <div class="meta-row"><div class="meta-label">IP Address:</div><div class="meta-value">${esc(ip)}</div></div>
</div>

<h2>Agreement Text</h2>
<div class="agreement-body">${esc(agreementText)}</div>

<div class="consent-section">
  <strong>Consents Given:</strong>
  <div class="consent-item"><span class="${acceptedTos ? 'check' : 'uncheck'}">${acceptedTos ? '[X]' : '[ ]'}</span> Platform Terms of Service and Operator Listing Agreement</div>
  <div class="consent-item"><span class="${acceptedListing ? 'check' : 'uncheck'}">${acceptedListing ? '[X]' : '[ ]'}</span> Authorization to display, distribute, and promote deal</div>
  <div class="consent-item"><span class="${acceptedDataAccuracy ? 'check' : 'uncheck'}">${acceptedDataAccuracy ? '[X]' : '[ ]'}</span> Data accuracy and authorization representation</div>
  <div class="consent-item"><span class="${acceptedRecording ? 'check' : 'uncheck'}">${acceptedRecording ? '[X]' : '[ ]'}</span> Recording and distribution consent</div>
</div>

<div class="signature-box">
  <div class="sig-name">${esc(signatoryName)}</div>
  <div class="sig-line"></div>
  <div class="sig-meta">${esc(signatoryName)}${signatoryTitle ? ', ' + esc(signatoryTitle) : ''}</div>
  <div class="sig-meta">${esc(dateStr)}</div>
</div>

<div class="footer">
  This is a digitally executed copy of the Grow Your Cashflow Operator Listing Agreement v${esc(version)}.<br>
  Signed electronically on ${esc(dateStr)} at ${esc(timeStr)} from IP ${esc(ip)}.<br>
  Document ID: Will be assigned upon storage.
</div>
</body>
</html>`;
}
