// Vercel Serverless Function: Deck Upload via Supabase Storage
// REPLACES: deck-upload.js (Make.com → Google Drive version)
//
// What changed:
//   - Files upload directly to Supabase Storage (no Make.com middleman)
//   - Signed URLs for secure access
//   - File metadata tracked in deck_submissions table
//   - Still sends email notification via Resend
//   - Auto-enrichment: PDFs are sent to Claude for field extraction after upload

import { getAdminClient, setCors } from './_supabase.js';
import { extractFromPdf, runEnrichmentCascade } from './_enrichment.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dealId, dealName, filedata, filename, notes, userEmail, userName, docType, companyId } = req.body;

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

    // 2. Update the deal record with the URL (deck_url or ppm_url based on docType)
    let dealUpdated = false;
    let dealUpdateError = null;
    let newDealId = null;
    const isUUID = dealId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dealId);

    if (dealId && deckUrl) {
      const urlField = docType === 'ppm' ? 'ppm_url' : 'deck_url';

      if (!isUUID) {
        // Deal was created locally (Add Deal) — create it in Supabase first
        const baseName = (dealName || '').replace(/ - PPM$/, '');
        const insertRow = {
            investment_name: baseName,
            [urlField]: deckUrl,
            status: 'Draft',
            added_date: new Date().toISOString().split('T')[0]
          };
        // Link to GP's management company if provided
        if (companyId && /^[0-9a-f-]{36}$/i.test(companyId)) {
          insertRow.management_company_id = companyId;
        }
        const { data: newDeal, error: insertErr } = await supabase
          .from('opportunities')
          .insert(insertRow)
          .select('id')
          .single();
        if (insertErr) {
          console.error('Deal insert failed:', insertErr.message, { dealId, baseName });
          dealUpdateError = insertErr.message;
        } else {
          dealUpdated = true;
          newDealId = newDeal.id;
        }
      } else {
        // Normal UUID deal — update existing record
        const { error: updateErr } = await supabase
          .from('opportunities')
          .update({ [urlField]: deckUrl })
          .eq('id', dealId);
        if (updateErr) {
          console.error('Deal update failed:', updateErr.message, updateErr.code, { dealId, urlField });
          dealUpdateError = updateErr.message;
        } else {
          dealUpdated = true;
        }
      }
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

    // 5. Auto-enrich: if PDF, extract fields via AI + run full enrichment cascade
    // PPM is always the source of truth — enrichment runs regardless of upload context
    const isPdf = (filename || '').toLowerCase().endsWith('.pdf');
    let enriched = false;
    let enrichedFields = [];
    let extractedData = null;
    let enrichmentCascade = null;
    let enrichmentError = null;

    if (isPdf) {
      try {
        // AI extraction with fallback chain (Claude → OpenAI → Grok)
        const { extracted, method } = await extractFromPdf(fileBuffer);

        if (extracted) {
          const fieldsFound = Object.keys(extracted).filter(k => extracted[k] !== null && extracted[k] !== undefined);
          enriched = fieldsFound.length > 0;
          enrichedFields = fieldsFound;
          extractedData = extracted;

          console.log(`Deck upload enrichment (${method}): ${fieldsFound.length} fields extracted`);

          // Run full enrichment cascade (SEC, RentCast, Census/BLS, background check)
          try {
            const supabase = getAdminClient();
            enrichmentCascade = await runEnrichmentCascade(extracted, supabase);
          } catch (cascadeErr) {
            console.warn('Enrichment cascade failed (extraction still succeeded):', cascadeErr.message);
          }
        }
      } catch (e) {
        console.error('Auto-enrichment failed (upload still succeeded):', e.message);
        enrichmentError = e.message;
      }
    }

    return res.status(200).json({
      success: true,
      driveUrl: deckUrl,
      dealUpdated,
      ...(newDealId ? { newDealId } : {}),
      ...(dealUpdateError ? { dealUpdateError } : {}),
      enriched,
      enrichedFields,
      extractedData,
      ...(enrichmentCascade ? {
        sec: enrichmentCascade.sec,
        property: enrichmentCascade.property,
        market: enrichmentCascade.market,
        backgroundCheck: enrichmentCascade.backgroundCheck,
        matchedDeals: enrichmentCascade.matchedDeals,
        enrichmentSteps: ['ppm', ...enrichmentCascade.enrichmentSteps]
      } : {}),
      ...(enrichmentError ? { enrichmentError } : {})
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
