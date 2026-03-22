// Vercel Serverless Function: Unsubscribe from deal alerts
// Adds "Unsubscribed" tag in GHL and shows confirmation page

import { setCors } from './_supabase.js';

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION = process.env.GHL_LOCATION_ID || process.env.GHL_LOCATION;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const email = req.query.email;
  if (!email) {
    return res.status(400).send('Missing email parameter');
  }

  let tagged = false;

  try {
    if (GHL_API_KEY) {
      // Search for contact by email
      const searchResp = await fetch(
        `https://services.leadconnectorhq.com/contacts/?query=${encodeURIComponent(email)}&locationId=${GHL_LOCATION}`,
        { headers: { Authorization: `Bearer ${GHL_API_KEY}`, Version: '2021-07-28' } }
      );
      const searchData = await searchResp.json();
      const contact = searchData.contacts?.[0];

      if (contact) {
        // Add "Unsubscribed" tag
        const existingTags = contact.tags || [];
        if (!existingTags.includes('Unsubscribed')) {
          await fetch(
            `https://services.leadconnectorhq.com/contacts/${contact.id}`,
            {
              method: 'PUT',
              headers: {
                Authorization: `Bearer ${GHL_API_KEY}`,
                Version: '2021-07-28',
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                tags: [...existingTags, 'Unsubscribed']
              })
            }
          );
          tagged = true;
        } else {
          tagged = true; // Already unsubscribed
        }
      }
    }
  } catch (err) {
    console.error('Unsubscribe error:', err.message);
  }

  // Show confirmation page
  res.setHeader('Content-Type', 'text/html');
  res.send(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Unsubscribed</title></head>
<body style="margin:0;padding:0;background:#FAF9F5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;">
<div style="text-align:center;max-width:400px;padding:40px 20px;">
  <div style="font-size:48px;margin-bottom:16px;">&#9989;</div>
  <h1 style="font-size:24px;font-weight:700;color:#141413;margin:0 0 12px;">You've been unsubscribed</h1>
  <p style="font-size:14px;color:#607179;line-height:1.6;margin:0 0 24px;">
    You won't receive any more deal alert emails from Grow Your Cashflow.
    You can always re-subscribe from your settings.
  </p>
  <a href="https://dealflow.growyourcashflow.io" style="display:inline-block;padding:12px 24px;background:#51BE7B;color:#fff;font-weight:700;font-size:14px;border-radius:8px;text-decoration:none;">Back to Deal Flow</a>
</div>
</body></html>`);
}
