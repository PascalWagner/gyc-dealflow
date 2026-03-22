// Vercel Serverless Function: One-click email unsubscribe
// Usage: GET /api/email-unsubscribe?email=EMAIL&token=HMAC&type=digest
//
// Adds "Unsubscribed" tag in GHL and updates user_profiles preferences.
// Redirects to a confirmation page.

import { getAdminClient, setCors, ghlFetch } from './_supabase.js';
import { createHmac } from 'crypto';

const SECRET = process.env.DIGEST_SECRET || process.env.SAVE_SECRET || 'gyc-deal-save-2026';
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID || '';

function verifyToken(email, token) {
  const expected = createHmac('sha256', SECRET)
    .update('unsub:' + email)
    .digest('hex')
    .substring(0, 16);
  return token === expected;
}

export function generateUnsubUrl(email) {
  const token = createHmac('sha256', SECRET)
    .update('unsub:' + email)
    .digest('hex')
    .substring(0, 16);
  return `https://dealflow.growyourcashflow.io/api/email-unsubscribe?email=${encodeURIComponent(email)}&token=${token}`;
}

export default async function handler(req, res) {
  setCors(res);

  const { email, token, type } = req.query;
  if (!email || !token || !verifyToken(email, token)) {
    return res.status(400).send('Invalid unsubscribe link');
  }

  try {
    const supabase = getAdminClient();

    // 1. Update user_profiles — set unsubscribed flag
    await supabase
      .from('user_profiles')
      .update({ email_digest_enabled: false, updated_at: new Date().toISOString() })
      .eq('email', email);

    // 2. Add "Unsubscribed" tag in GHL
    // First find the contact by email
    const searchResp = await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/search/duplicate?email=${encodeURIComponent(email)}&locationId=${GHL_LOCATION_ID}`,
      { method: 'GET' }
    );

    if (searchResp && searchResp.ok) {
      const searchData = await searchResp.json();
      const contactId = searchData.contact?.id;
      if (contactId) {
        // Add Unsubscribed tag
        await ghlFetch(
          `https://services.leadconnectorhq.com/contacts/${contactId}/tags`,
          {
            method: 'POST',
            body: JSON.stringify({ tags: ['Unsubscribed'] })
          }
        );
      }
    }
  } catch (err) {
    console.error('Unsubscribe error:', err.message);
  }

  // Show confirmation page
  res.setHeader('Content-Type', 'text/html');
  return res.status(200).send(`<!DOCTYPE html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed</title></head>
<body style="margin:0;padding:60px 20px;background:#FAF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;">
  <div style="max-width:400px;margin:0 auto;">
    <div style="font-size:48px;margin-bottom:16px;">&#9989;</div>
    <h1 style="font-size:22px;color:#141413;margin:0 0 8px;">You've been unsubscribed</h1>
    <p style="font-size:14px;color:#607179;line-height:1.6;">You won't receive any more deal alert emails. You can re-subscribe anytime from your settings.</p>
    <a href="https://dealflow.growyourcashflow.io" style="display:inline-block;margin-top:20px;padding:12px 32px;background:#51BE7B;color:#fff;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;">Back to Deal Flow</a>
  </div>
</body></html>`);
}
