// Vercel Serverless Function: Authentication via Supabase Auth
// REPLACES: auth.js (GHL-based auth)
//
// What changed:
//   - Supabase Auth handles password hashing, sessions, JWT tokens
//   - No more hand-rolled SHA-256 or storing hashes in GHL custom fields
//   - Magic link / OTP built-in
//   - Same JWT works for web + iOS
//   - Still syncs tier from GHL tags (GHL remains the CRM)

import { createClient } from '@supabase/supabase-js';
import { setCors, ADMIN_EMAILS, deriveTier, rateLimit, ghlFetch } from './_supabase.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Look up GHL contact for tier info (uses ghlFetch with retry)
async function getGhlTier(email) {
  try {
    const resp = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`
    );
    if (!resp?.ok) return { tier: 'free', tags: [], contactId: null };

    const data = await resp.json();
    const contact = (data.contacts || []).find(c => c.email?.toLowerCase() === email.toLowerCase());
    if (!contact) return { tier: 'free', tags: [], contactId: null };

    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());
    return {
      tier: isAdmin ? 'academy' : deriveTier(contact.tags || []),
      tags: contact.tags || [],
      contactId: contact.id,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(' ')
    };
  } catch {
    return { tier: 'free', tags: [], contactId: null };
  }
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!rateLimit(req, res, { maxRequests: 20 })) return; // Stricter limit for auth

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const adminSupabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  const { action, email, password, firstName, lastName } = req.body || {};

  // ── Magic Link ─────────────────────────────────────────────────────
  if (action === 'magic-link') {
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Use site URL for redirect (Vercel sets this, fallback to prod)
    const siteUrl = process.env.SITE_URL || 'https://dealflow.growyourcashflow.io';
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: siteUrl + '/deal-login.html' }
    });
    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ success: true, message: 'Magic link sent' });
  }

  // ── Lookup (for existing magic link flow compatibility) ────────────
  if (action === 'lookup') {
    if (!email) return res.status(400).json({ error: 'Email is required' });

    // Check if user exists in Supabase
    const { data: { users } } = await adminSupabase.auth.admin.listUsers();
    const user = users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

    // Get tier from GHL
    const ghl = await getGhlTier(email);
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

    // ── GP Detection ────────────────────────────────────────────────
    // Check if user is a GP (operator/sponsor) by matching email against
    // management_companies.authorized_emails array or ceo field
    let gpInfo = null;
    try {
      const emailLower = email.toLowerCase();

      // Check authorized_emails array (contains operator)
      const { data: authMatch } = await adminSupabase
        .from('management_companies')
        .select('id, operator_name')
        .contains('authorized_emails', [emailLower])
        .limit(1)
        .single();

      // Check CEO field (case-insensitive)
      const { data: ceoMatch } = await adminSupabase
        .from('management_companies')
        .select('id, operator_name')
        .ilike('ceo', emailLower)
        .limit(1)
        .single();

      if (ceoMatch) {
        gpInfo = { gp_type: 'founder', management_company_id: ceoMatch.id, managementCompanyName: ceoMatch.operator_name };
      } else if (authMatch) {
        gpInfo = { gp_type: 'sponsor', management_company_id: authMatch.id, managementCompanyName: authMatch.operator_name };
      }
    } catch {
      // GP detection is best-effort; don't block auth
    }

    if (user) {
      // Update profile with latest tier from GHL + GP info
      const profileData = {
        id: user.id,
        email: email.toLowerCase(),
        full_name: ghl.name || user.user_metadata?.full_name || email.split('@')[0],
        tier: isAdmin ? 'academy' : ghl.tier,
        is_admin: isAdmin,
        ghl_contact_id: ghl.contactId
      };
      if (gpInfo) {
        profileData.gp_type = gpInfo.gp_type;
        profileData.management_company_id = gpInfo.management_company_id;
        profileData.gp_verified = true;
      }
      await adminSupabase.from('user_profiles').upsert(profileData, { onConflict: 'id' });

      // Fetch onboarding state from profile
      const { data: existingProfile } = await adminSupabase
        .from('user_profiles')
        .select('onboarding_role, gp_onboarding_complete, gp_type, academy_start, academy_end, auto_renew, card_last4, card_brand')
        .eq('id', user.id)
        .single();

      return res.status(200).json({
        success: true,
        email,
        name: ghl.name || user.user_metadata?.full_name || email.split('@')[0],
        contactId: ghl.contactId,
        tier: isAdmin ? 'academy' : ghl.tier,
        isAdmin,
        tags: ghl.tags,
        token: user.id, // placeholder — real flow uses Supabase session tokens
        onboardingRole: existingProfile?.onboarding_role || null,
        gpOnboardingComplete: existingProfile?.gp_onboarding_complete || false,
        academyStart: existingProfile?.academy_start || null,
        academyEnd: existingProfile?.academy_end || null,
        autoRenew: existingProfile?.auto_renew !== false,
        cardLast4: existingProfile?.card_last4 || null,
        cardBrand: existingProfile?.card_brand || null,
        ...(gpInfo && {
          gpType: gpInfo.gp_type,
          managementCompanyId: gpInfo.management_company_id,
          managementCompanyName: gpInfo.managementCompanyName
        })
      });
    }

    // User not in Supabase yet — return free tier (still include GP info if detected)
    return res.status(200).json({
      success: true,
      email,
      name: ghl.name || email.split('@')[0],
      tier: 'free',
      token: 'pending',
      ...(gpInfo && {
        gpType: gpInfo.gp_type,
        managementCompanyId: gpInfo.management_company_id,
        managementCompanyName: gpInfo.managementCompanyName
      })
    });
  }

  // ── Login ──────────────────────────────────────────────────────────
  if (action === 'login') {
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      return res.status(401).json({ success: false, error: error.message });
    }

    // Get tier from GHL + update profile
    const ghl = await getGhlTier(email);
    const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

    // GP detection (same logic as lookup)
    let gpInfo = null;
    try {
      const emailLower = email.toLowerCase();
      const { data: authMatch } = await adminSupabase
        .from('management_companies')
        .select('id, operator_name')
        .contains('authorized_emails', [emailLower])
        .limit(1)
        .single();
      const { data: ceoMatch } = await adminSupabase
        .from('management_companies')
        .select('id, operator_name')
        .ilike('ceo', emailLower)
        .limit(1)
        .single();
      if (ceoMatch) {
        gpInfo = { gp_type: 'founder', management_company_id: ceoMatch.id, managementCompanyName: ceoMatch.operator_name };
      } else if (authMatch) {
        gpInfo = { gp_type: 'sponsor', management_company_id: authMatch.id, managementCompanyName: authMatch.operator_name };
      }
    } catch {}

    const loginProfile = {
      id: data.user.id,
      email: email.toLowerCase(),
      full_name: ghl.name || data.user.user_metadata?.full_name || email.split('@')[0],
      tier: isAdmin ? 'academy' : ghl.tier,
      is_admin: isAdmin,
      ghl_contact_id: ghl.contactId
    };
    if (gpInfo) {
      loginProfile.gp_type = gpInfo.gp_type;
      loginProfile.management_company_id = gpInfo.management_company_id;
      loginProfile.gp_verified = true;
    }
    await adminSupabase.from('user_profiles').upsert(loginProfile, { onConflict: 'id' });

    // Fetch academy dates
    const { data: loginProfileData } = await adminSupabase
      .from('user_profiles')
      .select('academy_start, academy_end, auto_renew, card_last4, card_brand')
      .eq('id', data.user.id)
      .single();

    return res.status(200).json({
      success: true,
      email: data.user.email,
      name: ghl.name || data.user.user_metadata?.full_name || email.split('@')[0],
      contactId: ghl.contactId,
      tier: isAdmin ? 'academy' : ghl.tier,
      isAdmin,
      token: data.session.access_token,        // real JWT for API calls
      refreshToken: data.session.refresh_token, // for token refresh
      academyStart: loginProfileData?.academy_start || null,
      academyEnd: loginProfileData?.academy_end || null,
      autoRenew: loginProfileData?.auto_renew !== false,
      cardLast4: loginProfileData?.card_last4 || null,
      cardBrand: loginProfileData?.card_brand || null,
      ...(gpInfo && {
        gpType: gpInfo.gp_type,
        managementCompanyId: gpInfo.management_company_id,
        managementCompanyName: gpInfo.managementCompanyName
      })
    });
  }

  // ── Register ───────────────────────────────────────────────────────
  if (action === 'register') {
    if (!email || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Use admin API to create a pre-confirmed user (no confirmation email sent)
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password: password || crypto.randomUUID(),
      email_confirm: true, // Auto-confirm — no "Confirm Your Signup" email
      user_metadata: { full_name: `${firstName} ${lastName}` }
    });

    if (error) {
      if (error.message?.includes('already')) {
        return res.status(409).json({ success: false, error: 'An account with this email already exists. Try signing in instead.' });
      }
      return res.status(500).json({ success: false, error: error.message });
    }

    // Create profile
    if (data.user) {
      await adminSupabase.from('user_profiles').upsert({
        id: data.user.id,
        email: email.toLowerCase(),
        full_name: `${firstName} ${lastName}`,
        tier: 'free',
        is_admin: false
      }, { onConflict: 'id' });

      // Also create in GHL (with retry)
      ghlFetch('https://rest.gohighlevel.com/v1/contacts/', {
        method: 'POST',
        body: JSON.stringify({
          firstName, lastName, email,
          tags: ['dealflow-free']
        })
      }).catch(() => {}); // best effort, don't block response
    }

    return res.status(200).json({
      success: true,
      email,
      name: `${firstName} ${lastName}`,
      tier: 'free',
      token: 'pending' // User will get a magic link to actually sign in
    });
  }

  // ── Refresh Token ────────────────────────────────────────────────
  if (action === 'refresh') {
    const { refreshToken } = req.body || {};
    if (!refreshToken) {
      return res.status(400).json({ error: 'refreshToken is required' });
    }

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });
    if (error) {
      return res.status(401).json({ success: false, error: error.message });
    }

    return res.status(200).json({
      success: true,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at
    });
  }

  return res.status(400).json({ error: 'Invalid action' });
}
