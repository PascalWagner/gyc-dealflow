// Vercel Serverless Function: /api/deal-qa via Supabase
// REPLACES: deal-qa.js (Airtable version)
// Per-deal Q&A system — investors submit questions, Pascal answers
// GET: fetch Q&A for a deal
// POST: submit a question, answer, or upvote

import { getAdminClient, setCors } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  const supabase = getAdminClient();

  // GET: Fetch Q&A for a deal
  if (req.method === 'GET') {
    const dealId = req.query.dealId;
    if (!dealId) return res.status(400).json({ error: 'dealId required' });

    try {
      const { data, error } = await supabase
        .from('deal_qa')
        .select('*')
        .eq('deal_id', dealId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const questions = (data || []).map(r => ({
        id: r.id,
        question: r.question || '',
        askedBy: r.asked_by_name || 'Anonymous',
        askedAt: r.created_at || '',
        answer: r.answer || null,
        answeredBy: r.answered_by || null,
        answeredAt: r.answered_at || null,
        upvotes: r.upvotes || 0,
        status: r.status || 'pending'
      }));

      // Sort: answered first, then pending
      questions.sort((a, b) => {
        if (a.answer && !b.answer) return -1;
        if (!a.answer && b.answer) return 1;
        return 0;
      });

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.status(200).json({ questions, count: questions.length });
    } catch (err) {
      console.error('Deal Q&A fetch error:', err);
      return res.status(500).json({ error: 'Failed to fetch Q&A' });
    }
  }

  // POST: Submit a question, answer, or upvote
  if (req.method === 'POST') {
    const { dealId, dealName, question, answer, recordId, userEmail, userName, action } = req.body || {};

    // Submit a new question
    if (action === 'ask') {
      if (!dealId || !question) {
        return res.status(400).json({ error: 'dealId and question required' });
      }

      try {
        const { data, error } = await supabase
          .from('deal_qa')
          .insert({
            deal_id: dealId,
            deal_name: dealName || '',
            question,
            asked_by_email: userEmail || '',
            asked_by_name: userName || 'Anonymous',
            status: 'pending',
            upvotes: 0
          })
          .select('id')
          .single();

        if (error) throw error;
        return res.status(200).json({ success: true, recordId: data.id });
      } catch (err) {
        console.error('Q&A submit error:', err);
        return res.status(500).json({ error: 'Failed to submit question' });
      }
    }

    // Submit an answer (admin only)
    if (action === 'answer') {
      if (!recordId || !answer) {
        return res.status(400).json({ error: 'recordId and answer required' });
      }

      try {
        const { error } = await supabase
          .from('deal_qa')
          .update({
            answer,
            answered_by: userName || 'Pascal',
            answered_at: new Date().toISOString(),
            status: 'answered',
            updated_at: new Date().toISOString()
          })
          .eq('id', recordId);

        if (error) throw error;
        return res.status(200).json({ success: true });
      } catch (err) {
        console.error('Q&A answer error:', err);
        return res.status(500).json({ error: 'Failed to submit answer' });
      }
    }

    // Upvote a question
    if (action === 'upvote') {
      if (!recordId) return res.status(400).json({ error: 'recordId required' });

      try {
        // Atomic increment via RPC (avoids race condition)
        const { data: newVotes, error: rpcErr } = await supabase
          .rpc('increment_upvote', { row_id: recordId });

        if (!rpcErr) {
          return res.status(200).json({ success: true, upvotes: newVotes });
        }

        // Fallback if RPC not yet created: read-then-write
        console.warn('increment_upvote RPC not found, using fallback:', rpcErr.message);
        const { data: current, error: fetchErr } = await supabase
          .from('deal_qa')
          .select('upvotes')
          .eq('id', recordId)
          .single();
        if (fetchErr) throw fetchErr;
        const fallbackVotes = (current?.upvotes || 0) + 1;
        const { error: updateErr } = await supabase
          .from('deal_qa')
          .update({ upvotes: fallbackVotes, updated_at: new Date().toISOString() })
          .eq('id', recordId);
        if (updateErr) throw updateErr;
        return res.status(200).json({ success: true, upvotes: fallbackVotes });
      } catch (err) {
        return res.status(500).json({ error: 'Failed to upvote' });
      }
    }

    return res.status(400).json({ error: 'Invalid action. Use: ask, answer, upvote' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
