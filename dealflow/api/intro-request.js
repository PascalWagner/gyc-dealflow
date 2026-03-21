// Vercel Serverless Function: Request Introduction
// Looks up user's GHL contact, adds a note, and tags them.
// Stores request in Supabase for tracking.

import { getAdminClient, setCors, rateLimit, ghlFetch } from './_supabase.js';

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

  const { dealId, dealName, operatorName, operatorCeo, message } = req.body || {};
  if (!dealName || !operatorName) {
    return res.status(400).json({ error: 'dealName and operatorName are required' });
  }

  try {
    // 1. Store in Supabase
    const { error: insertError } = await supabase
      .from('intro_requests')
      .insert({
        user_id: user.id,
        user_email: user.email,
        deal_id: dealId || null,
        deal_name: dealName,
        operator_name: operatorName,
        operator_ceo: operatorCeo || null,
        message: message || null,
        status: 'pending'
      });

    // Table may not exist yet — log but don't fail
    if (insertError) {
      console.warn('intro_requests insert failed (table may not exist):', insertError.message);
    }

    // 2. Look up GHL contact by email
    const ghlResp = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(user.email)}`
    );

    let ghlContactId = null;
    if (ghlResp?.ok) {
      const ghlData = await ghlResp.json();
      const contact = (ghlData.contacts || [])[0];
      if (contact) {
        ghlContactId = contact.id;

        // 3. Add note to contact
        const noteBody = [
          `🤝 Introduction Requested`,
          `Deal: ${dealName}`,
          `Operator: ${operatorName}`,
          operatorCeo ? `CEO/Contact: ${operatorCeo}` : null,
          message ? `Message: ${message}` : null,
          `Date: ${new Date().toISOString().split('T')[0]}`,
          `Source: Deal Database`
        ].filter(Boolean).join('\n');

        await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${ghlContactId}/notes`, {
          method: 'POST',
          body: JSON.stringify({ body: noteBody })
        });

        // 4. Add tag for pipeline tracking
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

    return res.status(200).json({
      success: true,
      ghlSynced: !!ghlContactId
    });
  } catch (err) {
    console.error('intro-request error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
