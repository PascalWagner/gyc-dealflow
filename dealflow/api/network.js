// LP Network API — returns aggregated social proof counts for deals
// No auth required for reading counts (they're anonymous aggregates)
// Auth required for avatar upload

import { getAdminClient, getUserClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const action = req.query.action || req.body?.action;

    if (req.method === 'GET' && action === 'counts') {
      return await getDealCounts(req, res);
    }
    if (req.method === 'POST' && action === 'avatar') {
      return await uploadAvatar(req, res);
    }

    return res.status(400).json({ error: 'Invalid action. Use: counts, avatar' });
  } catch (e) {
    console.error('Network API error:', e);
    return res.status(500).json({ error: e.message });
  }
}

// GET /api/network?action=counts
// Returns { dealId: { reviewing: N, invested: N } } for all deals with activity
async function getDealCounts(req, res) {
  const admin = getAdminClient();

  // Get all non-browse stages from users who have share_activity ON
  // Stages: saved, vetting, diligence, decision = "reviewing"
  // Stage: invested = "invested"
  // Stages: browse, passed = not counted
  const { data, error } = await admin
    .from('user_deal_stages')
    .select('deal_id, stage, user_profiles!inner(share_activity)')
    .not('stage', 'in', '("browse","passed")')
    .eq('user_profiles.share_activity', true);

  if (error) {
    // If the join fails (share_activity column might not exist yet), fall back
    // to counting without privacy filter
    console.warn('Network counts join failed, falling back:', error.message);
    const { data: fallback, error: fbErr } = await admin
      .from('user_deal_stages')
      .select('deal_id, stage')
      .not('stage', 'in', '("browse","passed")');

    if (fbErr) throw fbErr;
    return res.status(200).json(aggregateCounts(fallback));
  }

  return res.status(200).json(aggregateCounts(data));
}

function aggregateCounts(rows) {
  const counts = {};
  for (const row of rows || []) {
    const id = row.deal_id;
    if (!counts[id]) counts[id] = { reviewing: 0, invested: 0 };
    if (row.stage === 'invested') {
      counts[id].invested++;
    } else {
      counts[id].reviewing++;
    }
  }
  return counts;
}

// POST /api/network?action=avatar
// Accepts base64 image data, uploads to Supabase Storage
async function uploadAvatar(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Auth required' });

  const supabase = getUserClient(token);
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token' });

  const { imageData } = req.body || {};
  if (!imageData) return res.status(400).json({ error: 'imageData required (base64)' });

  // Decode base64 → buffer
  const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const contentType = imageData.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
  const ext = contentType.split('/')[1] || 'jpg';
  const filePath = `${user.id}/avatar.${ext}`;

  const admin = getAdminClient();

  // Upload to storage (upsert)
  const { error: uploadErr } = await admin.storage
    .from('avatars')
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });

  if (uploadErr) throw uploadErr;

  // Get public URL
  const { data: urlData } = admin.storage.from('avatars').getPublicUrl(filePath);
  const avatarUrl = urlData.publicUrl + '?t=' + Date.now(); // cache bust

  // Save to profile
  const { error: profileErr } = await admin
    .from('user_profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', user.id);

  if (profileErr) throw profileErr;

  return res.status(200).json({ avatarUrl });
}
