// Vercel Serverless Function: Portfolio Document Upload
// Persists LP-uploaded PPMs/subscription docs to Supabase Storage.
// Always stores the file first so it's safe even if extraction fails later.
// Supports chunked uploads for files > 3.5MB (Vercel 4.5MB body limit).

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

// In-memory chunk buffer (cleared after assembly)
const _chunkBuffers = new Map();

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  try {
    const { filedata, filename, userEmail, chunk, chunkIndex, totalChunks, uploadId } = req.body;

    if (!filename) {
      return res.status(400).json({ error: 'filename is required' });
    }

    const supabase = getAdminClient();
    const emailSlug = (userEmail || 'anonymous').replace(/[^a-zA-Z0-9@._-]/g, '');
    const timestamp = Date.now();
    const cleanFilename = (filename || 'document.pdf').replace(/[^a-zA-Z0-9.\-_ ]/g, '');
    const storagePath = `portfolio-docs/${emailSlug}/${timestamp}-${cleanFilename}`;

    // ── Chunked upload mode ──────────────────────────────────────────────
    if (totalChunks && totalChunks > 1) {
      if (!uploadId || chunkIndex === undefined || !chunk) {
        return res.status(400).json({ error: 'Chunked upload requires uploadId, chunkIndex, and chunk' });
      }

      // Store chunk in memory
      if (!_chunkBuffers.has(uploadId)) {
        _chunkBuffers.set(uploadId, { chunks: new Array(totalChunks).fill(null), received: 0, storagePath });
      }

      const state = _chunkBuffers.get(uploadId);
      state.chunks[chunkIndex] = chunk;
      state.received++;

      // Not all chunks yet — acknowledge and wait
      if (state.received < totalChunks) {
        return res.status(200).json({ success: true, chunksReceived: state.received, totalChunks, waiting: true });
      }

      // All chunks received — assemble and upload
      const fullBase64 = state.chunks.join('');
      _chunkBuffers.delete(uploadId); // Free memory immediately

      const fileBuffer = Buffer.from(fullBase64, 'base64');
      return await uploadAndRespond(supabase, fileBuffer, state.storagePath, res);
    }

    // ── Single upload mode ───────────────────────────────────────────────
    if (!filedata) {
      return res.status(400).json({ error: 'filedata (base64) is required for single uploads' });
    }

    const fileBuffer = Buffer.from(filedata, 'base64');
    return await uploadAndRespond(supabase, fileBuffer, storagePath, res);

  } catch (error) {
    console.error('Portfolio upload error:', error);
    return res.status(500).json({ error: 'Failed to upload document' });
  }
}

async function uploadAndRespond(supabase, fileBuffer, storagePath, res) {
  // Upload to Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('deal-decks')
    .upload(storagePath, fileBuffer, {
      contentType: 'application/pdf',
      upsert: true
    });

  if (uploadError) {
    console.error('Supabase storage upload error:', uploadError);
    return res.status(500).json({ error: 'Failed to store document: ' + uploadError.message });
  }

  // Get a signed URL (valid for 1 year)
  const { data: urlData } = await supabase.storage
    .from('deal-decks')
    .createSignedUrl(storagePath, 60 * 60 * 24 * 365);

  return res.status(200).json({
    success: true,
    storagePath,
    signedUrl: urlData?.signedUrl || '',
    fileSize: fileBuffer.length
  });
}
