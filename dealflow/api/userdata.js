// Vercel Serverless Function: CRUD for user-specific data via Supabase
// REPLACES: userdata.js (Airtable version)
//
// What changed:
//   - No more paginated fetches or filterByFormula
//   - RLS handles access control (user can only see own data)
//   - Upsert is native (ON CONFLICT)
//   - ~10x faster response times

import { getUserClient, verifyAdmin, setCors } from './_supabase.js';
import { RequestValidationError, sendValidationError } from './_validation.js';
import { handleUserdataAdminGet, handleUserdataGet } from './userdata/read.js';
import { handleUserdataDelete, handleUserdataPost } from './userdata/write.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Admin impersonation reads use the verified admin bearer token path instead
  // of the user-scoped Supabase client because they target another user's data.
  if (req.method === 'GET' && req.query.admin === 'true' && req.query.email) {
    try {
      const { authorized } = await verifyAdmin(req);
      if (!authorized) return res.status(403).json({ error: 'Admin access required' });
      return await handleUserdataAdminGet(req, res);
    } catch (err) {
      console.error('Admin userdata fetch failed:', err);
      return res.status(500).json({ error: 'Internal server error', message: err.message });
    }
  }

  // Extract JWT from Authorization header
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const supabase = getUserClient(token);

  // Get the authenticated user
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  try {
    switch (req.method) {
      case 'GET': return await handleUserdataGet(req, res, supabase, user);
      case 'POST': return await handleUserdataPost(req, res, supabase, user);
      case 'DELETE': return await handleUserdataDelete(req, res, supabase, user);
      default: return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    if (err instanceof RequestValidationError) {
      return sendValidationError(res, err);
    }
    console.error(`Error in userdata API (${req.method}):`, err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}


