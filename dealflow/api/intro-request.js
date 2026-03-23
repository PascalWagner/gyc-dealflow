// Vercel Serverless Function: Request Introduction
// Sends warm intro email via Resend, syncs to GHL, stores in Supabase.
// If no operator contact on file, emails Pascal to find one.

import { getAdminClient, setCors, rateLimit, ghlFetch } from './_supabase.js';

const PASCAL_EMAIL = 'pascal@growyourcashflow.io';
const BASE = 'https://deals.growyourcashflow.io';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!rateLimit(req, res, { maxRequests: 10, windowMs: 60_000 })) return;

  // Authenticate user
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

  const { dealId, dealName, operatorName, operatorCeo, managementCompanyId, message } = req.body || {};
  if (!dealName || !operatorName) {
    return res.status(400).json({ error: 'dealName and operatorName are required' });
  }

  // Get user's display name from profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();
  const userName = profile?.full_name || user.email.split('@')[0];

  try {
    // 1. Find the best operator contact (IR > operator_permissions > none)
    // TODO: Re-enable auto-intro once flow is validated
    // For now, all intros route to Pascal for manual handling
    let contactEmail = '';
    let contactName = '';

    // 2. Store in Supabase (non-blocking — don't fail the request if DB insert fails)
    try {
      // Validate deal_id is a proper UUID before inserting, otherwise set null
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeDealId = dealId && uuidRegex.test(dealId) ? dealId : null;

      const { error: insertError } = await supabase
        .from('intro_requests')
        .insert({
          user_id: user.id,
          user_email: user.email,
          deal_id: safeDealId,
          deal_name: dealName,
          operator_name: operatorName,
          operator_ceo: operatorCeo || null,
          message: message || null,
          status: 'pending'
        });
      if (insertError) {
        console.warn('intro_requests insert failed:', insertError.message);
      }
    } catch (dbErr) {
      console.warn('intro_requests insert threw:', dbErr.message);
    }

    // 3. Send email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    let emailSent = false;

    if (resendKey) {
      if (contactEmail) {
        // WARM INTRO: email operator contact, CC the LP
        const greeting = contactName ? contactName.split(' ')[0] : 'there';
        const introHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.6;max-width:560px;">
  <p>Hi ${greeting},</p>
  <p><strong>${userName}</strong> is a member of the <a href="https://growyourcashflow.com" style="color:#51BE7B;text-decoration:none;font-weight:600;">Grow Your Cashflow</a> investor community and is interested in learning more about <strong>${dealName}</strong>.</p>
  <p>I'm connecting you two so you can schedule a call and answer any questions.</p>
  ${message ? `<p style="padding:12px 16px;background:#f7fafc;border-left:3px solid #51BE7B;border-radius:4px;margin:16px 0;font-size:14px;color:#4a5568;"><em>${message}</em></p>` : ''}
  <p>${userName} is CC'd on this email — feel free to reply all to coordinate.</p>
  <p style="margin-top:24px;">Best,<br><strong>Pascal Wagner</strong><br>Founder, Grow Your Cashflow<br><a href="mailto:pascal@growyourcashflow.com" style="color:#51BE7B;text-decoration:none;">pascal@growyourcashflow.com</a></p>
</div>`;

        const sendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Pascal Wagner <deals@growyourcashflow.io>',
            to: [contactEmail],
            cc: [user.email],
            subject: `Introduction: ${userName} ↔ ${operatorName} — ${dealName}`,
            html: introHtml,
            reply_to: PASCAL_EMAIL
          })
        });
        emailSent = sendResp.ok;
        if (!sendResp.ok) {
          console.error('Resend intro email failed:', await sendResp.text().catch(() => 'unknown'));
        }
      } else {
        // NO CONTACT: email Pascal to find one
        const alertHtml = `
<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;line-height:1.6;max-width:560px;">
  <p style="font-size:16px;font-weight:700;color:#e53e3e;">⚠️ Intro Requested — No IR Contact on File</p>
  <table style="width:100%;border-collapse:collapse;margin:12px 0;">
    <tr><td style="padding:6px 0;font-weight:600;width:120px;">LP:</td><td>${userName} (${user.email})</td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Deal:</td><td><a href="${BASE}/deal.html?id=${dealId}" style="color:#51BE7B;">${dealName}</a></td></tr>
    <tr><td style="padding:6px 0;font-weight:600;">Operator:</td><td>${operatorName}</td></tr>
    ${operatorCeo ? `<tr><td style="padding:6px 0;font-weight:600;">CEO:</td><td>${operatorCeo}</td></tr>` : ''}
    ${message ? `<tr><td style="padding:6px 0;font-weight:600;">Message:</td><td>${message}</td></tr>` : ''}
  </table>
  <p><strong>Action needed:</strong> Find an IR or investor relations contact at ${operatorName} and make the introduction manually.</p>
  ${managementCompanyId ? `<p><a href="${BASE}/sponsor.html?id=${managementCompanyId}" style="color:#51BE7B;font-weight:600;">View Operator Page →</a></p>` : ''}
</div>`;

        const sendResp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Grow Your Cashflow <deals@growyourcashflow.io>',
            to: [PASCAL_EMAIL],
            subject: `🤝 Find IR Contact: ${userName} wants intro to ${operatorName}`,
            html: alertHtml
          })
        });
        emailSent = sendResp.ok;
        if (!sendResp.ok) {
          console.error('Resend alert email failed:', await sendResp.text().catch(() => 'unknown'));
        }
      }
    }

    // 4. GHL sync — add note + tag (non-blocking)
    let ghlContactId = null;
    try {
      const ghlResp = await ghlFetch(
        `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(user.email)}`
      );
      if (ghlResp?.ok) {
        const ghlData = await ghlResp.json();
        const contact = (ghlData.contacts || [])[0];
        if (contact) {
          ghlContactId = contact.id;
          const noteBody = [
            `🤝 Introduction Requested`,
            `Deal: ${dealName}`,
            `Operator: ${operatorName}`,
            'No IR contact — Pascal notified',
            `Date: ${new Date().toISOString().split('T')[0]}`,
            `Source: Deal Database`
          ].join('\n');
          await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${ghlContactId}/notes`, {
            method: 'POST',
            body: JSON.stringify({ body: noteBody })
          });
          const fullResp = await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${ghlContactId}`);
          if (fullResp?.ok) {
            const full = await fullResp.json();
            const existingTags = (full.contact || full).tags || [];
            if (!existingTags.includes('intro-requested')) {
              await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${ghlContactId}`, {
                method: 'PUT',
                body: JSON.stringify({ tags: [...existingTags, 'intro-requested'] })
              });
            }
          }
        }
      }
    } catch (ghlErr) {
      console.warn('GHL sync failed (non-blocking):', ghlErr.message);
    }

    // 5. Slack notification (non-blocking)
    try {
      const slackWebhook = process.env.SLACK_INTRO_WEBHOOK_URL;
      if (slackWebhook) {
        await fetch(slackWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `🤝 *New Intro Request*\n• *Deal:* ${dealName}\n• *Operator:* ${operatorName}\n• *LP:* ${userName} (${user.email})\n• *Contact:* ⚠️ No IR contact — Pascal notified\n• *Date:* ${new Date().toISOString().split('T')[0]}`
          })
        });
      }
    } catch (slackErr) {
      console.warn('Slack notification failed:', slackErr.message);
    }

    return res.status(200).json({
      success: true,
      introSent: !!contactEmail && emailSent,
      ghlSynced: !!ghlContactId
    });
  } catch (err) {
    console.error('intro-request error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
