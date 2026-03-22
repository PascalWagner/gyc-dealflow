// Vercel Serverless Function: /api/feedback
// Receives user feedback, stores in Supabase, and sends email notification

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { type, message, userEmail, userName, page, timestamp, userAgent, screenshot } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // ---- Store in Supabase ----
    let screenshotUrl = null;
    const supabase = getAdminClient();

    // Upload screenshot to Supabase Storage if provided
    if (screenshot && screenshot.startsWith('data:image/')) {
      try {
        const match = screenshot.match(/^data:image\/(\w+);base64,(.+)$/);
        if (match) {
          const ext = match[1];
          const buffer = Buffer.from(match[2], 'base64');
          const path = `feedback/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

          const { error: upErr } = await supabase.storage
            .from('feedback-screenshots')
            .upload(path, buffer, { contentType: `image/${ext}`, upsert: true });

          if (!upErr) {
            const { data: urlData } = await supabase.storage
              .from('feedback-screenshots')
              .createSignedUrl(path, 60 * 60 * 24 * 365); // 1 year
            screenshotUrl = urlData?.signedUrl || null;
          } else {
            console.warn('Screenshot upload failed:', upErr.message);
          }
        }
      } catch (e) {
        console.warn('Screenshot processing failed:', e.message);
      }
    }

    // Insert feedback record
    const { error: dbErr } = await supabase.from('user_feedback').insert({
      user_email: userEmail || 'anonymous',
      user_name: userName || null,
      type: type || 'other',
      message,
      screenshot_url: screenshotUrl,
      page: page || null,
      user_agent: userAgent || null
    });

    if (dbErr) {
      console.warn('Feedback DB insert failed:', dbErr.message);
      // Continue to email — don't lose the feedback
    }

    // ---- Send email notification ----
    const typeLabel = { bug: 'Bug Report', feature: 'Feature Request', question: 'Question', other: 'Other' }[type] || type;

    // Escape HTML to prevent XSS in email
    function esc(str) {
      if (!str) return '';
      return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    const screenshotHtml = screenshotUrl
      ? `<div style="margin-bottom:16px;"><p style="font-size:12px;color:#6b7280;margin-bottom:8px;">Attached Screenshot:</p><img src="${screenshotUrl}" style="max-width:100%;border:1px solid #e5e7eb;border-radius:6px;" /></div>`
      : screenshot
        ? `<div style="margin-bottom:16px;"><p style="font-size:12px;color:#6b7280;margin-bottom:8px;">Attached Screenshot:</p><img src="${screenshot}" style="max-width:100%;border:1px solid #e5e7eb;border-radius:6px;" /></div>`
        : '';

    const emailHtml = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
        <div style="background:#2C3E2D;color:#fff;padding:20px 24px;border-radius:8px 8px 0 0;">
          <h2 style="margin:0;font-size:18px;">GYC Dealflow — ${esc(typeLabel)}</h2>
        </div>
        <div style="padding:24px;background:#f9fafb;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
          <table style="width:100%;font-size:13px;margin-bottom:16px;">
            <tr><td style="color:#6b7280;padding:4px 8px;width:100px;">From:</td><td><strong>${esc(userName)}</strong> (${esc(userEmail)})</td></tr>
            <tr><td style="color:#6b7280;padding:4px 8px;">Type:</td><td>${esc(typeLabel)}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 8px;">Page:</td><td>${esc(page)}</td></tr>
            <tr><td style="color:#6b7280;padding:4px 8px;">Time:</td><td>${new Date(timestamp).toLocaleString('en-US', { timeZone: 'America/New_York' })}</td></tr>
          </table>
          <div style="background:#fff;border:1px solid #e5e7eb;border-radius:6px;padding:16px;margin-bottom:16px;">
            <p style="margin:0;font-size:14px;line-height:1.6;white-space:pre-wrap;">${esc(message)}</p>
          </div>
          ${screenshotHtml}
          <div style="font-size:11px;color:#9ca3af;border-top:1px solid #e5e7eb;padding-top:12px;">
            User Agent: ${esc(userAgent) || 'N/A'}
          </div>
        </div>
      </div>
    `;

    // Try Resend first (if API key is available)
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      const emailResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'GYC Dealflow <feedback@growyourcashflow.io>',
          reply_to: userEmail,
          to: ['pascal@growyourcashflow.io'],
          subject: `[GYC Dealflow] ${typeLabel} from ${userName}`,
          html: emailHtml
        })
      });

      if (emailResp.ok) {
        return res.status(200).json({ success: true, method: 'resend' });
      }
    }

    // Fallback: Make.com webhook
    const webhookUrl = process.env.FEEDBACK_WEBHOOK_URL;
    if (webhookUrl) {
      const webhookResp = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: typeLabel,
          message,
          userEmail,
          userName,
          page,
          timestamp,
          screenshot: screenshot ? 'attached' : 'none'
        })
      });

      if (webhookResp.ok) {
        return res.status(200).json({ success: true, method: 'webhook' });
      }
    }

    // If no email service configured, still return success (stored in DB)
    console.log('Feedback received (no email service configured):', { type, message, userEmail, userName, page });
    return res.status(200).json({ success: true, method: 'logged' });

  } catch (error) {
    console.error('Feedback error:', error);
    return res.status(500).json({ error: 'Failed to submit feedback' });
  }
}
