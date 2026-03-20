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

// CORS helper (reused across all endpoints)
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
