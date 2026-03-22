// Vercel Serverless Function: Create a new deal (user-submitted)
// Allows any authenticated user to submit a deal to the database
// (no admin auth required — deals are created with user_submitted=true)

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { maxRequests: 10 })) return;

  try {
    const { investmentName, sponsor, website, userEmail, userName } = req.body;

    if (!investmentName || !sponsor) {
      return res.status(400).json({ error: 'Investment name and sponsor are required' });
    }

    const supabase = getAdminClient();

    // 1. Find or create the management company (operator)
    let mcId = null;
    const { data: existingMc } = await supabase
      .from('management_companies')
      .select('id')
      .ilike('operator_name', sponsor.trim())
      .limit(1)
      .single();

    if (existingMc) {
      mcId = existingMc.id;
    } else {
      const { data: newMc, error: mcErr } = await supabase
        .from('management_companies')
        .insert({
          operator_name: sponsor.trim(),
          website: website || null
        })
        .select('id')
        .single();
      if (mcErr) {
        console.error('Failed to create operator:', mcErr.message);
      } else {
        mcId = newMc.id;
      }
    }

    // 2. Create the deal
    const { data: deal, error: dealErr } = await supabase
      .from('opportunities')
      .insert({
        investment_name: investmentName.trim(),
        management_company_id: mcId,
        status: 'Open to Invest',
        added_date: new Date().toISOString().split('T')[0],
        user_submitted: true
      })
      .select('id, investment_name')
      .single();

    if (dealErr) {
      console.error('Failed to create deal:', dealErr.message);
      return res.status(500).json({ error: 'Failed to create deal: ' + dealErr.message });
    }

    // 3. Link operator as primary sponsor
    if (mcId && deal) {
      await supabase.from('deal_sponsors').insert({
        deal_id: deal.id,
        company_id: mcId,
        role: 'sponsor',
        is_primary: true,
        display_order: 0
      }).catch(() => {});
    }

    // 4. Log submission
    if (userEmail) {
      await supabase.from('deck_submissions').insert({
        deal_id: deal.id,
        deal_name: investmentName,
        notes: 'User-submitted deal',
        submitted_by_email: userEmail,
        submitted_by_name: userName || ''
      }).catch(() => {});
    }

    return res.status(200).json({
      success: true,
      dealId: deal.id,
      investmentName: deal.investment_name,
      managementCompanyId: mcId
    });

  } catch (error) {
    console.error('Deal create error:', error);
    return res.status(500).json({ error: 'Failed to create deal' });
  }
}
