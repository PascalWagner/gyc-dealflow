// Vercel Serverless Function: /api/deck-submit via Supabase
// REPLACES: deck-submit.js (Airtable version)
// Receives user-submitted deck links and:
// 1. Sends notification email via Resend
// 2. Creates a record in the Supabase deck_submissions table

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dealId, dealName, deckUrl, notes, userEmail, userName, docType } = req.body;

    if (!deckUrl) {
      return res.status(400).json({ error: 'Deck URL is required' });
    }

    const supabase = getAdminClient();
    let emailSent = false;

    // 1. Send notification email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#2C3E2D;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
            <h2 style="margin:0;font-size:18px;">GYC Dealflow — Deck Submission</h2>
          </div>
          <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
            <table style="width:100%;font-size:13px;margin-bottom:16px;">
              <tr><td style="color:#6b7280;padding:4px 8px;width:120px;">Submitted By:</td><td><strong>${userName || 'Unknown'}</strong> (${userEmail || 'N/A'})</td></tr>
              <tr><td style="color:#6b7280;padding:4px 8px;">Deal:</td><td><strong>${dealName || 'Unknown'}</strong></td></tr>
              <tr><td style="color:#6b7280;padding:4px 8px;">Submitted URL:</td><td><a href="${deckUrl}" style="color:#2C3E2D;">${deckUrl}</a></td></tr>
            </table>
            ${notes ? `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:16px;"><p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">Notes:</p><p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${notes}</p></div>` : ''}
          </div>
        </div>
      `;

      try {
        const emailResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'GYC Dealflow <feedback@growyourcashflow.io>',
            reply_to: userEmail || undefined,
            to: ['pascal@growyourcashflow.io'],
            subject: `[Deck Submission] ${dealName || 'Unknown Deal'}`,
            html: emailHtml
          })
        });
        emailSent = emailResp.ok;
      } catch (e) {
        console.warn('Resend email failed:', e.message);
      }
    }

    // 2. Write to Supabase deck_submissions table
    const { error: insertErr } = await supabase.from('deck_submissions').insert({
      deal_id: dealId || null,
      deal_name: dealName || '',
      deck_url: deckUrl,
      notes: notes || '',
      submitted_by_email: userEmail || '',
      submitted_by_name: userName || ''
    });

    if (insertErr) {
      console.warn('Supabase insert failed:', insertErr.message);
    }

    // 3. Update deal record with deck/PPM URL if provided
    if (dealId && deckUrl) {
      const urlField = docType === 'ppm' ? 'ppm_url' : 'deck_url';
      await supabase
        .from('opportunities')
        .update({ [urlField]: deckUrl })
        .eq('id', dealId);
    }

    return res.status(200).json({ success: true, emailSent, supabaseCreated: !insertErr });

  } catch (error) {
    console.error('Deck submit error:', error);
    return res.status(500).json({ error: 'Failed to submit deck' });
  }
}
