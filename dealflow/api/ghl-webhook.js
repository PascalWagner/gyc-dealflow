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
//   - payment_received: New payment → update tier + normalized subscription metadata
//   - subscription_cancelled: Cancelled → clear renewal metadata on the matching subscription
//   - tag_added: Tag change → sync tier

import { getAdminClient, setCors, deriveTier } from './_supabase.js';
import { getActiveSubscription, isMissingSubscriptionsTableError, SUBSCRIPTIONS_TABLE } from './_subscriptions.js';
import { classifyGhlBillingEvent, extractGhlBillingIdentifiers } from './_billing.js';

const WEBHOOK_SECRET = process.env.GHL_WEBHOOK_SECRET;

function addMonths(baseDate, months) {
  const nextDate = new Date(baseDate);
  nextDate.setMonth(nextDate.getMonth() + months);
  return nextDate;
}

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

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, tier')
        .eq('email', email)
        .single();

      if (!profile) {
        console.warn(`[GHL Webhook] No user found for email: ${email}`);
        return res.status(200).json({ ok: true, skipped: true, reason: 'user_not_found' });
      }

      const billingMatch = classifyGhlBillingEvent(body);
      let profileUpdates = {};
      let activeSubscription = null;

      try {
        activeSubscription = await getActiveSubscription(supabase, profile.id, 'academy');
      } catch (subscriptionError) {
        if (!isMissingSubscriptionsTableError(subscriptionError)) throw subscriptionError;
      }

      let subscriptionInsert = null;
      let subscriptionUpdate = null;
      const now = new Date();
      const nowIso = now.toISOString();

      if (billingMatch?.kind === 'academy_purchase') {
        profileUpdates.tier = 'academy';
        const endDate = new Date(now);
        endDate.setFullYear(endDate.getFullYear() + 1);
        const endDateIso = endDate.toISOString();
        const subscriptionPatch = {
          status: 'active',
          end_date: endDateIso,
          renewal_date: endDateIso,
          is_lifetime: false,
          billing_provider: billingMatch.billing_provider,
          external_subscription_id: billingMatch.external_subscription_id || activeSubscription?.external_subscription_id || null,
          external_product_id: billingMatch.external_product_id,
          external_price_id: billingMatch.external_price_id,
          billing_management_url: billingMatch.billing_management_url || activeSubscription?.billing_management_url || null
        };

        if (activeSubscription) {
          subscriptionUpdate = subscriptionPatch;
        } else {
          subscriptionInsert = {
            user_id: profile.id,
            product_type: 'academy',
            start_date: nowIso,
            ...subscriptionPatch
          };
        }
      } else if (billingMatch?.kind === 'renewal_annual') {
        profileUpdates.tier = 'academy';
        const baseDate = activeSubscription?.end_date ? new Date(activeSubscription.end_date) : now;
        const newEnd = new Date(Math.max(baseDate.getTime(), Date.now()));
        newEnd.setFullYear(newEnd.getFullYear() + 1);
        const newEndIso = newEnd.toISOString();
        const subscriptionPatch = {
          status: 'active',
          end_date: newEndIso,
          renewal_date: newEndIso,
          is_lifetime: false,
          billing_provider: billingMatch.billing_provider,
          external_subscription_id: billingMatch.external_subscription_id || activeSubscription?.external_subscription_id || null,
          external_product_id: billingMatch.external_product_id,
          external_price_id: billingMatch.external_price_id,
          billing_management_url: billingMatch.billing_management_url || activeSubscription?.billing_management_url || null
        };

        if (activeSubscription) {
          subscriptionUpdate = subscriptionPatch;
        } else {
          subscriptionInsert = {
            user_id: profile.id,
            product_type: 'academy',
            start_date: nowIso,
            ...subscriptionPatch
          };
        }
      } else if (billingMatch?.kind === 'renewal_monthly') {
        profileUpdates.tier = 'academy';
        const baseDate = activeSubscription?.end_date ? new Date(activeSubscription.end_date) : now;
        const newEnd = addMonths(new Date(Math.max(baseDate.getTime(), Date.now())), 1);
        const newEndIso = newEnd.toISOString();
        const subscriptionPatch = {
          status: 'active',
          end_date: newEndIso,
          renewal_date: newEndIso,
          is_lifetime: false,
          billing_provider: billingMatch.billing_provider,
          external_subscription_id: billingMatch.external_subscription_id || activeSubscription?.external_subscription_id || null,
          external_product_id: billingMatch.external_product_id,
          external_price_id: billingMatch.external_price_id,
          billing_management_url: billingMatch.billing_management_url || activeSubscription?.billing_management_url || null
        };

        if (activeSubscription) {
          subscriptionUpdate = subscriptionPatch;
        } else {
          subscriptionInsert = {
            user_id: profile.id,
            product_type: 'academy',
            start_date: nowIso,
            ...subscriptionPatch
          };
        }
      }

      if (Object.keys(profileUpdates).length > 0) {
        const { error } = await supabase
          .from('user_profiles')
          .update(profileUpdates)
          .eq('id', profile.id);

        if (error) {
          console.error('[GHL Webhook] Update failed:', error.message);
          return res.status(500).json({ error: 'Failed to update profile' });
        }

        console.log(`[GHL Webhook] Updated ${email}:`, JSON.stringify(profileUpdates));
      }

      try {
        if (subscriptionUpdate && activeSubscription?.id) {
          const { error: subscriptionError } = await supabase
            .from(SUBSCRIPTIONS_TABLE)
            .update(subscriptionUpdate)
            .eq('id', activeSubscription.id);
          if (subscriptionError) throw subscriptionError;
        } else if (subscriptionInsert) {
          const { error: subscriptionError } = await supabase
            .from(SUBSCRIPTIONS_TABLE)
            .insert(subscriptionInsert);
          if (subscriptionError) throw subscriptionError;
        }
      } catch (subscriptionError) {
        if (!isMissingSubscriptionsTableError(subscriptionError)) {
          console.error('[GHL Webhook] Subscription update failed:', subscriptionError.message);
          return res.status(500).json({ error: 'Failed to update subscription' });
        }
      }

      return res.status(200).json({
        ok: true,
        email,
        updates: profileUpdates,
        subscription: subscriptionUpdate || subscriptionInsert
      });
    }

    // ── Subscription Cancelled ─────────────────────────────────────
    if (eventType === 'subscription_cancelled' || eventType === 'SubscriptionCancelled') {
      const email = (body.email || body.contact_email || '').toLowerCase();
      if (!email) return res.status(400).json({ error: 'Email is required' });

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();

      try {
        const { subscriptionId } = extractGhlBillingIdentifiers(body);
        let subscriptionQuery = null;

        if (subscriptionId) {
          subscriptionQuery = supabase
            .from(SUBSCRIPTIONS_TABLE)
            .update({ renewal_date: null })
            .eq('external_subscription_id', subscriptionId);
        } else {
          const activeSubscription = await getActiveSubscription(supabase, profile?.id || null, 'academy');
          if (activeSubscription?.id) {
            subscriptionQuery = supabase
              .from(SUBSCRIPTIONS_TABLE)
              .update({ renewal_date: null })
              .eq('id', activeSubscription.id);
          }
        }

        if (subscriptionQuery) {
          const { error: subscriptionError } = await subscriptionQuery;
          if (subscriptionError) throw subscriptionError;
        }
      } catch (subscriptionError) {
        if (!isMissingSubscriptionsTableError(subscriptionError)) {
          console.error('[GHL Webhook] Subscription cancel sync failed:', subscriptionError.message);
          return res.status(500).json({ error: 'Failed to update subscription renewal' });
        }
      }

      console.log(`[GHL Webhook] Renewal metadata cleared for ${email}`);
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
