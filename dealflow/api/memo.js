// Vercel Serverless Function: /api/memo
// GET ?dealId=xxx&email=xxx  — fetch memo for a user+deal
// POST { dealId, email, ...fields }  — upsert memo

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getAdminClient();

  // GET: fetch memo
  if (req.method === 'GET') {
    const { dealId, email } = req.query;
    if (!dealId || !email) {
      return res.status(400).json({ error: 'dealId and email required' });
    }

    const { data, error } = await supabase
      .from('investment_memos')
      .select('*')
      .eq('user_email', email)
      .eq('deal_id', dealId)
      .maybeSingle();

    if (error) {
      console.error('Memo fetch error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      memo: data || null
    });
  }

  // POST: upsert memo
  if (req.method === 'POST') {
    const {
      dealId, email, dealName, thesis, risks, reflection,
      buyBoxMatch, ddAnswers, dealSnapshot, stage
    } = req.body || {};

    if (!dealId || !email) {
      return res.status(400).json({ error: 'dealId and email required' });
    }

    // Build upsert payload — only include fields that were sent
    const payload = {
      user_email: email,
      deal_id: dealId
    };
    if (dealName !== undefined) payload.deal_name = dealName;
    if (thesis !== undefined) payload.thesis = thesis;
    if (risks !== undefined) payload.risks = risks;
    if (reflection !== undefined) payload.reflection = reflection;
    if (buyBoxMatch !== undefined) payload.buy_box_match = buyBoxMatch;
    if (ddAnswers !== undefined) payload.dd_answers = ddAnswers;
    if (dealSnapshot !== undefined) payload.deal_snapshot = dealSnapshot;
    if (stage !== undefined) payload.stage = stage;

    const { data, error } = await supabase
      .from('investment_memos')
      .upsert(payload, {
        onConflict: 'user_email,deal_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Memo upsert error:', error);
      return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({
      success: true,
      memo: data
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
