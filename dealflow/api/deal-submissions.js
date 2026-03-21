// Vercel Serverless Function: Get document submissions for a deal
// Returns who uploaded what documents and when.

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const dealId = req.query.dealId;
  if (!dealId) return res.status(400).json({ error: 'dealId is required' });

  try {
    const supabase = getAdminClient();
    let query = supabase
      .from('deck_submissions')
      .select('id, deal_id, deal_name, deck_url, notes, submitted_by_email, submitted_by_name, created_at')
      .order('created_at', { ascending: false });

    // If dealId is 'all', return all submissions (admin view); otherwise filter by deal
    if (dealId !== 'all') {
      query = query.eq('deal_id', dealId);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;

    if (error) throw error;

    return res.status(200).json({ submissions: data || [] });
  } catch (error) {
    console.error('Submissions fetch error:', error);
    return res.status(500).json({ error: 'Failed to fetch submissions' });
  }
}
