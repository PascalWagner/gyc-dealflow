// Vercel Serverless Function: /api/deck-submit
// Receives user-submitted deck links and:
// 1. Sends notification email via Resend
// 2. Creates a record in the Deck Submissions Airtable table

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { dealId, dealName, deckUrl, notes, userEmail, userName } = req.body;

    if (!deckUrl) {
      return res.status(400).json({ error: 'Deck URL is required' });
    }

    const submittedAt = new Date().toISOString();
    let emailSent = false;
    let airtableCreated = false;

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
              <tr><td style="color:#6b7280;padding:4px 8px;">Deal ID:</td><td>${dealId || 'N/A'}</td></tr>
              <tr><td style="color:#6b7280;padding:4px 8px;">Submitted URL:</td><td><a href="${deckUrl}" style="color:#2C3E2D;">${deckUrl}</a></td></tr>
              <tr><td style="color:#6b7280;padding:4px 8px;">Time:</td><td>${new Date(submittedAt).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td></tr>
            </table>
            ${notes ? `<div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:16px;"><p style="margin:0 0 4px 0;font-size:12px;color:#6b7280;">Notes:</p><p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${notes}</p></div>` : ''}
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

    // 2. Write to Airtable Deck Submissions table
    const pat = process.env.AIRTABLE_PAT;
    const deckSubmissionsTableId = process.env.DECK_SUBMISSIONS_TABLE_ID;
    if (pat && deckSubmissionsTableId) {
      try {
        const airtableResp = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${deckSubmissionsTableId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            records: [{
              fields: {
                'Deal ID': dealId || '',
                'Deal Name': dealName || '',
                'Submitted URL': deckUrl,
                'Notes': notes || '',
                'Submitted By Email': userEmail || '',
                'Submitted By Name': userName || '',
                'Status': 'Pending',
                'Submitted At': submittedAt
              }
            }]
          })
        });
        airtableCreated = airtableResp.ok;
        if (!airtableResp.ok) {
          const errText = await airtableResp.text();
          console.warn('Airtable create failed:', errText);
        }
      } catch (e) {
        console.warn('Airtable write failed:', e.message);
      }
    }

    console.log('Deck submission received:', { dealId, dealName, deckUrl, emailSent, airtableCreated });
    return res.status(200).json({ success: true, emailSent, airtableCreated });

  } catch (error) {
    console.error('Deck submit error:', error);
    return res.status(500).json({ error: 'Failed to submit deck' });
  }
}
