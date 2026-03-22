// Vercel Serverless Function: /api/admin-feedback
// Returns all user feedback for the admin dashboard

import { getAdminClient, setCors, verifyAdmin } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const { authorized, error } = await verifyAdmin(req);
  if (!authorized) return res.status(403).json({ error });

  const supabase = getAdminClient();
  const limit = Math.min(parseInt(req.query.limit) || 50, 200);
  const offset = parseInt(req.query.offset) || 0;
  const type = req.query.type;

  let query = supabase
    .from('user_feedback')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (type && ['bug', 'feature', 'question', 'other'].includes(type)) {
    query = query.eq('type', type);
  }

  const { data, error: dbError, count } = await query;
  if (dbError) return res.status(500).json({ error: dbError.message });

  return res.status(200).json({ feedback: data, total: count });
}
