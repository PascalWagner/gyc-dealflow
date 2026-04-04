// LP Network API — returns aggregated social proof counts for deals
// No auth required for reading counts (they're anonymous aggregates)
// Auth required for avatar upload

import { getAdminClient, getUserClient, setCors } from './_supabase.js';
import { loadUserProfileRecord, persistUserAvatarUrl } from './_user-profile.js';

const AVATAR_BUCKET = String(
  process.env.SUPABASE_AVATAR_BUCKET || process.env.SUPABASE_AVATARS_BUCKET || 'avatars'
).trim() || 'avatars';

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

function isBucketNotFoundError(error) {
  return /bucket.+not found/i.test(String(error?.message || error || ''));
}

function sendAvatarStorageUnavailable(res) {
  return res.status(503).json({
    error: 'Profile photo uploads are not configured for this environment.',
    code: 'avatar_storage_unavailable'
  });
}

async function ensureAvatarBucket(admin) {
  const { error } = await admin.storage.createBucket(AVATAR_BUCKET, { public: true });
  if (error && !/already exists/i.test(String(error.message || ''))) {
    throw error;
  }
}

async function uploadAvatarObject(admin, filePath, buffer, contentType) {
  return admin.storage
    .from(AVATAR_BUCKET)
    .upload(filePath, buffer, {
      contentType,
      upsert: true
    });
}

// POST /api/network?action=avatar
// Accepts base64 image data, uploads to Supabase Storage
async function uploadAvatar(req, res) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Auth required' });

  // Validate auth: try getUser first, fall back to JWT decode for bypass/expired tokens
  const admin = getAdminClient();
  let user = null;
  try {
    const supabase = getUserClient(token);
    const { data: { user: authUser } } = await supabase.auth.getUser();
    if (authUser) user = authUser;
  } catch {}
  if (!user) {
    try {
      const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
      if (payload?.sub) {
        // Look up user by ID from JWT
        const { data: { user: adminUser } } = await admin.auth.admin.getUserById(payload.sub);
        if (adminUser) user = adminUser;
      }
    } catch {}
  }
  if (!user) return res.status(401).json({ error: 'Invalid token' });

  const { imageData } = req.body || {};
  if (!imageData) return res.status(400).json({ error: 'imageData required (base64)' });

  // Decode base64 → buffer
  const base64 = imageData.replace(/^data:image\/\w+;base64,/, '');
  const buffer = Buffer.from(base64, 'base64');
  const contentType = imageData.match(/^data:(image\/\w+);/)?.[1] || 'image/jpeg';
  const ext = contentType.split('/')[1] || 'jpg';
  const filePath = `${user.id}/avatar.${ext}`;

  // Heal the sandbox if the avatar bucket was never provisioned.
  let { error: uploadErr } = await uploadAvatarObject(admin, filePath, buffer, contentType);
  if (uploadErr && isBucketNotFoundError(uploadErr)) {
    try {
      await ensureAvatarBucket(admin);
      ({ error: uploadErr } = await uploadAvatarObject(admin, filePath, buffer, contentType));
    } catch (bucketError) {
      if (isBucketNotFoundError(bucketError) || isBucketNotFoundError(uploadErr)) {
        return sendAvatarStorageUnavailable(res);
      }
      throw bucketError;
    }
  }

  if (uploadErr && isBucketNotFoundError(uploadErr)) {
    return sendAvatarStorageUnavailable(res);
  }

  if (uploadErr) throw uploadErr;

  // Get public URL
  const { data: urlData } = admin.storage.from(AVATAR_BUCKET).getPublicUrl(filePath);
  const avatarUrl = urlData.publicUrl + '?t=' + Date.now(); // cache bust

  const profileRecord = await loadUserProfileRecord(admin, user.id);
  await persistUserAvatarUrl({
    admin,
    userId: user.id,
    avatarUrl,
    profileRecord
  });

  return res.status(200).json({ avatarUrl });
}
