// Vercel Serverless Function: /api/deck-upload
// Receives a file (base64), uploads to Google Drive via Make.com webhook,
// then updates the Airtable deal record with the Google Drive link.

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const MAKE_WEBHOOK_URL = 'https://hook.us2.make.com/544g51hytahrevpcl1ar9ndk4oly693m';
const LP_DEALS_FOLDER_ID = '1U6eGgHING3Qzhn3xSgDWyA0Nh59ETU_S';

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
    const { dealId, dealName, filedata, filename, notes, userEmail, userName } = req.body;

    if (!filedata || !filename) {
      return res.status(400).json({ error: 'File data and filename are required' });
    }

    // Clean filename: prepend deal name for organization
    const cleanDealName = (dealName || 'Unknown').replace(/[^a-zA-Z0-9\s\-]/g, '').trim();
    const uploadFilename = cleanDealName + ' - ' + filename;

    // 1. Upload to Google Drive via Make.com webhook
    let driveUrl = null;
    try {
      const makeResp = await fetch(MAKE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: uploadFilename,
          folderId: LP_DEALS_FOLDER_ID,
          filedata: filedata // base64 string
        })
      });

      if (makeResp.ok) {
        const makeData = await makeResp.json().catch(() => null);
        // Make webhook may return the file ID or URL
        if (makeData && makeData.webViewLink) {
          driveUrl = makeData.webViewLink;
        } else if (makeData && makeData.id) {
          driveUrl = 'https://drive.google.com/file/d/' + makeData.id + '/view';
        } else {
          // Fallback: construct URL from folder
          driveUrl = 'https://drive.google.com/drive/folders/' + LP_DEALS_FOLDER_ID;
        }
        console.log('File uploaded to Google Drive:', uploadFilename);
      } else {
        const errText = await makeResp.text();
        console.warn('Make webhook upload failed:', makeResp.status, errText);
        // Still continue — we'll note the failure
      }
    } catch (e) {
      console.warn('Make webhook error:', e.message);
    }

    // 2. Update the deal record in Airtable with the deck URL (if we got one)
    let airtableUpdated = false;
    const pat = process.env.AIRTABLE_PAT;
    const dealsTableId = process.env.DEALS_TABLE_ID || 'tblH0XMVhk9gdDAi4';

    if (pat && dealId && driveUrl) {
      try {
        // First, find the Airtable record by our deal ID
        const searchResp = await fetch(
          `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${dealsTableId}?filterByFormula={Deal ID}="${dealId}"&maxRecords=1`,
          { headers: { 'Authorization': `Bearer ${pat}` } }
        );
        const searchData = await searchResp.json();

        if (searchData.records && searchData.records.length > 0) {
          const recordId = searchData.records[0].id;
          // Update the deck URL field
          const updateResp = await fetch(
            `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${dealsTableId}/${recordId}`,
            {
              method: 'PATCH',
              headers: {
                'Authorization': `Bearer ${pat}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                fields: {
                  'Deck URL': driveUrl
                }
              })
            }
          );
          airtableUpdated = updateResp.ok;
          if (!updateResp.ok) {
            console.warn('Airtable update failed:', await updateResp.text());
          }
        }
      } catch (e) {
        console.warn('Airtable update error:', e.message);
      }
    }

    // 3. Also log to Deck Submissions table
    const deckSubmissionsTableId = process.env.DECK_SUBMISSIONS_TABLE_ID || 'tblXLMqI1TxT9eBQY';
    if (pat && deckSubmissionsTableId) {
      try {
        await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${deckSubmissionsTableId}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${pat}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            records: [{
              fields: {
                'Deal Name': (dealName || '') + ' — ' + new Date().toLocaleDateString(),
                'Deal ID': dealId || '',
                'Notes': 'File uploaded: ' + uploadFilename + (driveUrl ? '\nDrive URL: ' + driveUrl : '') + '\nSubmitted by: ' + (userName || '') + ' (' + (userEmail || '') + ')' + (notes ? '\nNotes: ' + notes : ''),
                'Submitted By Name': userName || (userEmail || '')
              }
            }]
          })
        });
      } catch (e) {
        console.warn('Deck submissions log error:', e.message);
      }
    }

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
              <p>File: ${uploadFilename}</p>
              ${driveUrl ? '<p><a href="' + driveUrl + '">View in Google Drive</a></p>' : ''}
              ${notes ? '<p>Notes: ' + notes + '</p>' : ''}`
          })
        });
      } catch (e) {
        console.warn('Email notification failed:', e.message);
      }
    }

    return res.status(200).json({
      success: true,
      driveUrl: driveUrl,
      airtableUpdated: airtableUpdated
    });

  } catch (error) {
    console.error('Deck upload error:', error);
    return res.status(500).json({ error: 'Failed to upload deck' });
  }
}
