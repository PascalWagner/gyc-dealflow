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

  // Also update notif_frequency to 'off' in Supabase
  try {
    const { getAdminClient } = await import('./_supabase.js');
    const supabase = getAdminClient();
    await supabase
      .from('user_profiles')
      .update({ notif_frequency: 'off' })
      .eq('email', email);
  } catch (e) {
    console.error('Failed to update notif_frequency:', e.message);
  }

  // Redirect to Settings → Notifications with unsubscribed flag
  return res.redirect(302, 'https://dealflow.growyourcashflow.io/app/settings?unsubscribed=true');
}
