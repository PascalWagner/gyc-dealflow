// Admin endpoint: Manage API keys
// POST /api/v1/keys — Create a new API key (admin only)
// GET  /api/v1/keys — List all API keys (admin only)
// DELETE /api/v1/keys?id=xxx — Revoke a key (admin only)

import { getAdminClient, verifyAdmin } from '../_supabase.js';
import { setApiCors, apiError, generateApiKey } from './_auth.js';

export default async function handler(req, res) {
  setApiCors(res);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Admin-only
  const admin = await verifyAdmin(req);
  if (!admin.authorized) {
    return apiError(res, 401, admin.error);
  }

  const supabase = getAdminClient();

  // CREATE
  if (req.method === 'POST') {
    const { name, owner_email, tier = 'free', rate_limit_per_min, scopes, expires_in_days, metadata } = req.body || {};

    if (!name || !owner_email) {
      return apiError(res, 400, 'name and owner_email are required');
    }

    const { key, keyHash, keyPrefix } = await generateApiKey();

    const record = {
      key_hash: keyHash,
      key_prefix: keyPrefix,
      name,
      owner_email,
      tier,
      rate_limit_per_min: rate_limit_per_min || (tier === 'enterprise' ? 600 : tier === 'pro' ? 120 : 30),
      scopes: scopes || ['deals:read', 'operators:read'],
      metadata: metadata || {},
      expires_at: expires_in_days ? new Date(Date.now() + expires_in_days * 86400000).toISOString() : null
    };

    const { data, error } = await supabase.from('api_keys').insert(record).select().single();
    if (error) {
      console.error('Error creating API key:', error);
      return apiError(res, 500, 'Failed to create API key');
    }

    // Return the plaintext key ONCE — it can never be retrieved again
    return res.status(201).json({
      message: 'API key created. Save this key — it cannot be retrieved again.',
      api_key: key,
      key_prefix: keyPrefix,
      id: data.id,
      tier: data.tier,
      rate_limit_per_min: data.rate_limit_per_min,
      expires_at: data.expires_at
    });
  }

  // LIST
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('api_keys')
      .select('id, key_prefix, name, owner_email, tier, rate_limit_per_min, scopes, is_active, last_used_at, request_count, metadata, created_at, expires_at')
      .order('created_at', { ascending: false });

    if (error) {
      return apiError(res, 500, 'Failed to list API keys');
    }

    return res.status(200).json({ data });
  }

  // REVOKE
  if (req.method === 'DELETE') {
    const id = req.query?.id;
    if (!id) return apiError(res, 400, 'id query parameter required');

    const { error } = await supabase
      .from('api_keys')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      return apiError(res, 500, 'Failed to revoke API key');
    }

    return res.status(200).json({ message: 'API key revoked' });
  }

  return apiError(res, 405, 'Method not allowed');
}
