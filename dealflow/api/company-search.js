// Vercel Serverless Function: Company Search
// Returns management companies matching a search query (typeahead).
//
// GET ?q=blackstone → returns matching companies (name, id, type, asset_classes)

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res)) return;

  const q = (req.query?.q || '').trim();
  if (!q || q.length < 2) return res.status(200).json({ results: [] });

  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

  try {
    const supabase = getAdminClient();

    const { data, error } = await supabase
      .from('management_companies')
      .select('id, operator_name, type, asset_classes, website, ceo, founding_year, linkedin_ceo, ir_contact_name, ir_contact_email, booking_url')
      .ilike('operator_name', '%' + q + '%')
      .order('operator_name')
      .limit(8);

    if (error) throw error;

    return res.status(200).json({ results: data || [] });
  } catch (err) {
    console.error('company-search error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
