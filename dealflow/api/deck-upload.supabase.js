// Vercel Serverless Function: Deck Upload via Supabase Storage
// REPLACES: deck-upload.js (Make.com → Google Drive version)
//
// What changed:
//   - Files upload directly to Supabase Storage (no Make.com middleman)
//   - Signed URLs for secure access
//   - File metadata tracked in deck_submissions table
//   - Still sends email notification via Resend

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dealId, dealName, filedata, filename, notes, userEmail, userName } = req.body;

    if (!filedata || !filename) {
      return res.status(400).json({ error: 'File data and filename are required' });
    }

    const supabase = getAdminClient();
    const cleanDealName = (dealName || 'Unknown').replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
    const storagePath = `deals/${dealId || 'unlinked'}/${cleanDealName} - ${filename}`;

    // 1. Decode base64 and upload to Supabase Storage
    const fileBuffer = Buffer.from(filedata, 'base64');
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('deal-decks')
      .upload(storagePath, fileBuffer, {
        contentType: guessContentType(filename),
        upsert: true
      });

    if (uploadError) throw uploadError;

    // Get a signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from('deal-decks')
      .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

    const deckUrl = urlData?.signedUrl || '';

    // 2. Update the deal record with the deck URL
    let airtableUpdated = false;
    if (dealId && deckUrl) {
      const { error: updateErr } = await supabase
        .from('opportunities')
        .update({ deck_url: deckUrl })
        .eq('id', dealId);
      airtableUpdated = !updateErr;
    }

    // 3. Log to deck_submissions table
    await supabase.from('deck_submissions').insert({
      deal_id: dealId || null,
      deal_name: dealName || '',
      deck_url: deckUrl,
      notes: notes || '',
      submitted_by_email: userEmail || '',
      submitted_by_name: userName || ''
    });

    // 4. Send notification email via Resend
    const resendKey = process.env.RESEND_API_KEY;
    if (resendKey) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'GYC Dealflow <feedback@growyourcashflow.io>',
            to: ['pascal@growyourcashflow.io'],
            subject: `[Deck Upload] ${dealName || 'Unknown Deal'}`,
            html: `<p><strong>${userName || 'Someone'}</strong> uploaded a deck for <strong>${dealName}</strong>.</p>
              <p>File: ${filename}</p>
              ${deckUrl ? '<p><a href="' + deckUrl + '">View Deck</a></p>' : ''}
              ${notes ? '<p>Notes: ' + notes + '</p>' : ''}`
          })
        });
      } catch (e) {
        console.warn('Email notification failed:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      driveUrl: deckUrl,      // keeping same field name for frontend compat
      airtableUpdated
    });

  } catch (error) {
    console.error('Deck upload error:', error);
    return res.status(500).json({ error: 'Failed to upload deck' });
  }
}

function guessContentType(filename) {
  const ext = (filename || '').split('.').pop()?.toLowerCase();
  const types = {
    pdf: 'application/pdf',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ppt: 'application/vnd.ms-powerpoint',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg'
  };
  return types[ext] || 'application/octet-stream';
}
