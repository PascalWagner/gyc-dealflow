// Shared Supabase client for all API endpoints
// Uses the service_role key server-side (bypasses RLS for admin operations)
// and the anon key for user-scoped queries (respects RLS)

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Admin client: bypasses RLS. Use for admin operations and data reads
// that need to see all data (like the public deals endpoint).
let _adminClient = null;
export function getAdminClient() {
  if (!_adminClient) {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
    }
    _adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { persistSession: false }
    });
  }
  return _adminClient;
}

// User client: respects RLS. Pass the user's JWT to scope queries.
export function getUserClient(accessToken) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    }
  });
}

// Shared admin email list (single source of truth)
export const ADMIN_EMAILS = [
  'pascal@growyourcashflow.com',
  'pascalwagner@gmail.com',
  'pascal.wagner@growyourcashflow.com',
  'info@pascalwagner.com',
  'pascal@growyourcashflow.io'
];

// Asset class name mapping (GHL/wizard values → database values)
export const ASSET_MAP = {
  'Multi-Family': 'Multi Family',
  'Hotels / Hospitality': 'Hotels/Hospitality',
  'Private Debt / Credit': 'Lending',
  'RV / Mobile Home Parks': 'RV/Mobile Home Parks',
  'Short-Term Rentals': 'Short Term Rental'
};

// Derive user tier from GHL tags
export function deriveTier(tags) {
  const t = (tags || []).map(s => (s || '').toLowerCase());
  if (t.includes('dealflow-academy') || t.includes('bought cashflow academy') || t.includes('academy-member') || t.includes('cashflow-academy') || t.includes('academy member'))
    return 'academy';
  if (t.includes('dealflow-alumni'))
    return 'alumni';
  if (t.includes('investor-member') || t.includes('fund-investor') || t.includes('investor member'))
    return 'investor';
  return 'free';
}

// Admin auth verification (reused across admin endpoints)
export async function verifyAdmin(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { authorized: false, error: 'Missing or invalid Authorization header' };
  }
  const token = authHeader.replace('Bearer ', '');
  const supabase = getAdminClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return { authorized: false, error: 'Invalid or expired token' };
  }
  if (!ADMIN_EMAILS.includes(user.email)) {
    return { authorized: false, error: 'Not authorized as admin' };
  }
  return { authorized: true, user };
}

// Simple in-memory rate limiter (per serverless instance)
// Resets when the instance cold-starts, so this is soft protection
const _rateBuckets = new Map();
const RATE_WINDOW_MS = 60_000; // 1 minute
const RATE_MAX_REQUESTS = 60;  // 60 requests per minute per IP

export function rateLimit(req, res, { maxRequests = RATE_MAX_REQUESTS, windowMs = RATE_WINDOW_MS } = {}) {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();

  let bucket = _rateBuckets.get(ip);
  if (!bucket || now - bucket.start > windowMs) {
    bucket = { start: now, count: 0 };
    _rateBuckets.set(ip, bucket);
  }

  bucket.count++;

  if (bucket.count > maxRequests) {
    res.setHeader('Retry-After', Math.ceil((bucket.start + windowMs - now) / 1000));
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return false;
  }

  // Prune stale entries periodically (every 100 requests)
  if (_rateBuckets.size > 100) {
    for (const [key, val] of _rateBuckets) {
      if (now - val.start > windowMs) _rateBuckets.delete(key);
    }
  }

  return true;
}

// GHL API call with retry (1 retry after 1s delay)
const GHL_API_KEY = process.env.GHL_API_KEY;
export async function ghlFetch(url, options = {}) {
  if (!GHL_API_KEY) return null;

  const opts = {
    ...options,
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const resp = await fetch(url, opts);
      if (resp.ok) return resp;
      // Retry on 429 (rate limit) or 5xx (server error)
      if (resp.status === 429 || resp.status >= 500) {
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 1000));
          continue;
        }
      }
      return resp; // Return non-retryable errors as-is
    } catch (e) {
      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      console.warn('GHL fetch failed after retry:', e.message);
      return null;
    }
  }
  return null;
}

// CORS helper (reused across all endpoints)
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
