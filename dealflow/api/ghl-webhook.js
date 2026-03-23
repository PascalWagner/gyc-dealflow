// Vercel Serverless Function: /api/ghl-webhook
// Receives payment & subscription events from GoHighLevel
//
// GHL Workflow Setup:
//   1. In GHL → Automations → Create Workflow
//   2. Trigger: "Payment Received" or "Invoice Paid"
//   3. Action: Webhook → POST to https://dealflow.growyourcashflow.io/api/ghl-webhook
//   4. Body: { type, contact_id, email, amount, product, ... }
//
// Supported event types:
//   - payment_received: New payment → update tier, dates, card info
//   - subscription_cancelled: Cancelled → mark auto_renew off
//   - tag_added: Tag change → sync tier

import { getAdminClient, setCors, deriveTier } from './_supabase.js';

const WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Optional: verify webhook secret (set GHL_WEBHOOK_SECRET in env)
  if (WEBHOOK_SECRET) {
    const authHeader = req.headers['x-ghl-signature'] || req.headers['authorization'];
    if (authHeader !== `Bearer ${WEBHOOK_SECRET}` && authHeader !== WEBHOOK_SECRET) {
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }
  }

  const body = req.body || {};
  const eventType = body.type || body.event || 'unknown';

  console.log(`[GHL Webhook] Event: ${eventType}`, JSON.stringify(body).substring(0, 500));

  const supabase = getAdminClient();

  try {
    // ── Payment Received ───────────────────────────────────────────
    if (eventType === 'payment_received' || eventType === 'InvoicePaymentReceived') {
      const email = (body.email || body.contact_email || '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email is required' });

      // Find user in Supabase
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, tier, academy_start, academy_end')
        .eq('email', email)
        .single();

      if (!profile) {
        console.warn(`[GHL Webhook] No user found for email: ${email}`);
        return res.status(200).json({ ok: true, skipped: true, reason: 'user_not_found' });
      }

      // Determine what was purchased based on amount or product name
      const amount = parseFloat(body.amount || body.total || 0);
      const product = (body.product || body.product_name || body.name || '').toLowerCase();

      let updates = {};

      // Academy purchase ($5,000 first year)
      if (product.includes('academy') || product.includes('cashflow') || (amount >= 4500 && amount <= 5500)) {
        updates.tier = 'academy';
        updates.academy_start = new Date().toISOString();
        // First year: end date is 12 months from now
        const endDate = new Date();
        endDate.setFullYear(endDate.getFullYear() + 1);
        updates.academy_end = endDate.toISOString();
        updates.auto_renew = true;
      }
      // Academy renewal ($2,000/yr or $300/mo)
      else if (product.includes('renewal') || product.includes('renew') || (amount >= 1800 && amount <= 2200)) {
        // Annual renewal: extend by 12 months from current end date
        const currentEnd = profile.academy_end ? new Date(profile.academy_end) : new Date();
        const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
        newEnd.setFullYear(newEnd.getFullYear() + 1);
        updates.academy_end = newEnd.toISOString();
        updates.tier = 'academy';
      }
      else if (amount >= 250 && amount <= 350) {
        // Monthly renewal: extend by 1 month
        const currentEnd = profile.academy_end ? new Date(profile.academy_end) : new Date();
        const newEnd = new Date(Math.max(currentEnd.getTime(), Date.now()));
        newEnd.setMonth(newEnd.getMonth() + 1);
        updates.academy_end = newEnd.toISOString();
        updates.tier = 'academy';
      }

      // Card info from GHL payment data (if available)
      if (body.card_last4 || body.last4) {
        updates.card_last4 = body.card_last4 || body.last4;
      }
      if (body.card_brand || body.brand) {
        updates.card_brand = body.card_brand || body.brand;
      }

      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('user_profiles')
          .update(updates)
          .eq('id', profile.id);

        if (error) {
          console.error('[GHL Webhook] Update failed:', error.message);
          return res.status(500).json({ error: 'Failed to update profile' });
        }

        console.log(`[GHL Webhook] Updated ${email}:`, JSON.stringify(updates));
      }

      return res.status(200).json({ ok: true, email, updates });
    }

    // ── Subscription Cancelled ─────────────────────────────────────
    if (eventType === 'subscription_cancelled' || eventType === 'SubscriptionCancelled') {
      const email = (body.email || body.contact_email || '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const { error } = await supabase
        .from('user_profiles')
        .update({ auto_renew: false })
        .eq('email', email);

      if (error) {
        console.error('[GHL Webhook] Cancel update failed:', error.message);
        return res.status(500).json({ error: 'Failed to update' });
      }

      console.log(`[GHL Webhook] Auto-renew disabled for ${email}`);
      return res.status(200).json({ ok: true, email, autoRenew: false });
    }

    // ── Tag Added/Removed (tier sync) ──────────────────────────────
    if (eventType === 'ContactTagUpdate' || eventType === 'tag_added' || eventType === 'tag_removed') {
      const email = (body.email || body.contact_email || '').toLowerCase();
      const tags = body.tags || [];
      if (!email || tags.length === 0) {
        return res.status(200).json({ ok: true, skipped: true, reason: 'no_email_or_tags' });
      }

      const newTier = deriveTier(tags);
      const { error } = await supabase
        .from('user_profiles')
        .update({ tier: newTier })
        .eq('email', email);

      if (error) {
        console.error('[GHL Webhook] Tier sync failed:', error.message);
        return res.status(500).json({ error: 'Failed to sync tier' });
      }

      console.log(`[GHL Webhook] Tier synced for ${email}: ${newTier}`);
      return res.status(200).json({ ok: true, email, tier: newTier });
    }

    // Unknown event — acknowledge but don't process
    console.log(`[GHL Webhook] Unhandled event type: ${eventType}`);
    return res.status(200).json({ ok: true, skipped: true, eventType });

  } catch (err) {
    console.error('[GHL Webhook] Error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
