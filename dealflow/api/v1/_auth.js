// API v1 Authentication: API key verification
// Keys are passed via X-API-Key header or ?api_key query param

import { getAdminClient } from '../_supabase.js';

// In-memory rate limit buckets (per serverless instance)
const _buckets = new Map();

// Hash an API key using Web Crypto (available in Vercel edge & Node 18+)
async function hashKey(key) {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Verify API key and return the key record
// Returns { authorized, keyRecord, error }
export async function verifyApiKey(req) {
  const key = req.headers['x-api-key'] || req.query?.api_key;

  if (!key) {
    return { authorized: false, error: 'Missing API key. Pass via X-API-Key header or api_key query parameter.' };
  }

  // Validate format
  if (!key.startsWith('gyc_')) {
    return { authorized: false, error: 'Invalid API key format.' };
  }

  const keyHash = await hashKey(key);
  const supabase = getAdminClient();

  const { data: keyRecord, error } = await supabase
    .from('api_keys')
    .select('*')
    .eq('key_hash', keyHash)
    .eq('is_active', true)
    .single();

  if (error || !keyRecord) {
    return { authorized: false, error: 'Invalid or inactive API key.' };
  }

  // Check expiry
  if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
    return { authorized: false, error: 'API key has expired.' };
  }

  // Rate limiting per key
  const now = Date.now();
  let bucket = _buckets.get(keyRecord.id);
  if (!bucket || now - bucket.start > 60_000) {
    bucket = { start: now, count: 0 };
    _buckets.set(keyRecord.id, bucket);
  }
  bucket.count++;

  if (bucket.count > keyRecord.rate_limit_per_min) {
    return {
      authorized: false,
      error: 'Rate limit exceeded. Max ' + keyRecord.rate_limit_per_min + ' requests/minute.',
      status: 429,
      retryAfter: Math.ceil((bucket.start + 60_000 - now) / 1000)
    };
  }

  // Update last_used_at and request_count (fire-and-forget)
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString(), request_count: keyRecord.request_count + 1 })
    .eq('id', keyRecord.id)
    .then(() => {});

  return { authorized: true, keyRecord };
}

// Log an API request (fire-and-forget)
export function logRequest(keyRecord, req, status, startTime) {
  const supabase = getAdminClient();
  supabase
    .from('api_request_log')
    .insert({
      api_key_id: keyRecord?.id || null,
      endpoint: req.url?.split('?')[0] || '',
      method: req.method,
      query_params: req.query || {},
      response_status: status,
      response_time_ms: Date.now() - startTime,
      ip_address: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || '',
      user_agent: req.headers['user-agent'] || ''
    })
    .then(() => {});
}

// CORS headers for API v1
export function setApiCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-API-Key, Content-Type');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Standard error response
export function apiError(res, status, message, details) {
  return res.status(status).json({
    error: { code: status, message, ...(details ? { details } : {}) }
  });
}

// Generate a new API key (for admin endpoint)
export async function generateApiKey() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let key = 'gyc_k1_';
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  const keyHash = await hashKey(key);
  const keyPrefix = key.substring(0, 12);
  return { key, keyHash, keyPrefix };
}
