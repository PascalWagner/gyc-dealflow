// Vercel Serverless Function: /api/admin-saas-metrics
// Legacy endpoint kept for compatibility, now backed by the shared admin
// metrics module and the same verified-admin boundary as /api/admin-manage.

import { getAdminClient, setCors, verifyAdmin } from './_supabase.js';
import { userMetrics } from './admin-manage/users.js';

export default async function handler(req, res) {
  setCors(res);
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return res.status(403).json({ success: false, error: auth.error });
  }

  try {
    const supabase = getAdminClient();
    const result = await userMetrics(supabase);
    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    console.error('admin-saas-metrics error', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
