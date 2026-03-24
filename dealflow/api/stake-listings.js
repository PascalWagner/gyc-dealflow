// Vercel Serverless Function: Stake Listings CRUD
// Allows LPs to list portfolio positions for sale (secondaries marketplace)
//
// GET    /api/stake-listings           → list all active listings
// GET    /api/stake-listings?mine=1    → list current user's listings
// POST   /api/stake-listings           → create a new listing
// PATCH  /api/stake-listings?id=UUID   → update a listing
// DELETE /api/stake-listings?id=UUID   → withdraw a listing

import { getAdminClient, setCors, rateLimit } from './_supabase.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!rateLimit(req, res)) return;

  const supabase = getAdminClient();

  // Authenticate user for write operations and "mine" queries
  async function getUser() {
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) return null;
    const token = auth.replace('Bearer ', '');
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return null;
    return user;
  }

  try {
    // ── GET: List stake listings ──
    if (req.method === 'GET') {
      const { mine, status: filterStatus } = req.query;

      if (mine) {
        const user = await getUser();
        if (!user) return res.status(401).json({ error: 'Unauthorized' });

        const { data, error } = await supabase
          .from('stake_listings')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (error) return res.status(500).json({ error: error.message });
        return res.json({ listings: data || [] });
      }

      // Public: active listings only
      let query = supabase
        .from('stake_listings')
        .select('id, investment_name, sponsor, asset_class, amount_invested, asking_price, reason, notes, anonymous, status, created_at, deal_id, contact_email')
        .eq('status', filterStatus || 'active')
        .order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) return res.status(500).json({ error: error.message });

      // Strip contact info from anonymous listings
      const listings = (data || []).map(l => {
        if (l.anonymous) {
          l.contact_email = '';
        }
        return l;
      });

      res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120');
      return res.json({ listings });
    }

    // ── POST: Create a new listing ──
    if (req.method === 'POST') {
      const user = await getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const body = req.body || {};
      const listing = {
        user_id: user.id,
        portfolio_id: body.portfolio_id || null,
        deal_id: body.deal_id || null,
        investment_name: body.investment_name || '',
        sponsor: body.sponsor || '',
        asset_class: body.asset_class || '',
        amount_invested: parseFloat(body.amount_invested) || 0,
        asking_price: body.asking_price ? parseFloat(body.asking_price) : null,
        reason: body.reason || '',
        notes: body.notes || '',
        contact_email: body.contact_email || user.email || '',
        anonymous: !!body.anonymous,
        status: 'active'
      };

      if (!listing.investment_name) {
        return res.status(400).json({ error: 'investment_name is required' });
      }

      const { data, error } = await supabase
        .from('stake_listings')
        .insert(listing)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.status(201).json({ listing: data });
    }

    // ── PATCH: Update a listing ──
    if (req.method === 'PATCH') {
      const user = await getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id is required' });

      const body = req.body || {};
      const updates = {};
      if (body.asking_price !== undefined) updates.asking_price = body.asking_price ? parseFloat(body.asking_price) : null;
      if (body.reason !== undefined) updates.reason = body.reason;
      if (body.notes !== undefined) updates.notes = body.notes;
      if (body.status !== undefined) updates.status = body.status;
      if (body.anonymous !== undefined) updates.anonymous = !!body.anonymous;
      if (body.contact_email !== undefined) updates.contact_email = body.contact_email;
      updates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('stake_listings')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ listing: data });
    }

    // ── DELETE: Withdraw a listing ──
    if (req.method === 'DELETE') {
      const user = await getUser();
      if (!user) return res.status(401).json({ error: 'Unauthorized' });

      const { id } = req.query;
      if (!id) return res.status(400).json({ error: 'id is required' });

      // Soft delete: mark as withdrawn
      const { error } = await supabase
        .from('stake_listings')
        .update({ status: 'withdrawn', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('stake-listings error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
