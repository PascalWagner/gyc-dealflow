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
import { getMembershipSummary } from './_subscriptions.js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DEFAULT_SITE_URL = process.env.SITE_URL || 'https://dealflow.growyourcashflow.io';
const BYPASS_EMAILS = ['test@test.com', 'info@pascalwagner.com'];
const PERSONA_OVERRIDES = {
  'test@test.com': { tier: 'free', isAdmin: false },
  'info@pascalwagner.com': { tier: 'academy', isAdmin: true }
};

export function isSandboxPreviewEnvironment(env = process.env) {
  const vercelEnv = String(env?.VERCEL_ENV || '').trim().toLowerCase();
  const nodeEnv = String(env?.NODE_ENV || '').trim().toLowerCase();
  return vercelEnv === 'preview' || nodeEnv === 'development';
}

export function shouldUseAuthBypass(email, env = process.env) {
  return BYPASS_EMAILS.includes(normalizeEmail(email)) && isSandboxPreviewEnvironment(env);
}

export function normalizeSiteOrigin(candidate) {
  try {
    const url = new URL(candidate || DEFAULT_SITE_URL);
    const host = url.hostname.toLowerCase();
    const isAllowedHost =
      host === 'dealflow.growyourcashflow.io' ||
      host === 'sandbox.growyourcashflow.io' ||
      host.endsWith('.vercel.app') ||
      host === 'localhost' ||
      host === '127.0.0.1';

    if (!isAllowedHost) return DEFAULT_SITE_URL;
    if (!['http:', 'https:'].includes(url.protocol)) return DEFAULT_SITE_URL;
    return url.origin;
  } catch {
    return DEFAULT_SITE_URL;
  }
}

function normalizeReturnPath(candidate) {
  if (!candidate) return '/app/deals';

  try {
    const value = decodeURIComponent(String(candidate));
    if (!value.startsWith('/')) return '/app/deals';
    if (value.startsWith('//')) return '/app/deals';
    return value;
  } catch {
    return '/app/deals';
  }
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function canLookupEmail({ requestEmail = '', tokenEmail = '', isAdmin = false } = {}) {
  const normalizedRequestEmail = normalizeEmail(requestEmail);
  const normalizedTokenEmail = normalizeEmail(tokenEmail);
  if (!normalizedRequestEmail || !normalizedTokenEmail) return false;
  return isAdmin || normalizedRequestEmail === normalizedTokenEmail;
}

function displayNameFromEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  return normalizedEmail.split('@')[0] || '';
}

function isAdminEmail(email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return false;
  if (PERSONA_OVERRIDES[normalizedEmail]?.isAdmin !== undefined) {
    return PERSONA_OVERRIDES[normalizedEmail].isAdmin;
  }
  return ADMIN_EMAILS.includes(normalizedEmail);
}

function canonicalizeTier(tier, email) {
  const normalizedEmail = normalizeEmail(email);
  const overrideTier = PERSONA_OVERRIDES[normalizedEmail]?.tier;
  if (overrideTier) return overrideTier;

  if (isAdminEmail(normalizedEmail)) return 'academy';

  const normalizedTier = String(tier || '').trim().toLowerCase();
  if (!normalizedTier || normalizedTier === 'explorer') return 'free';
  return normalizedTier;
}

function findUserByEmail(users, email) {
  const normalizedEmail = normalizeEmail(email);
  return (users || []).find((user) => normalizeEmail(user.email) === normalizedEmail) || null;
}

async function findUserProfileByEmail(adminSupabase, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  const { data, error } = await adminSupabase
    .from('user_profiles')
    .select('id, email, full_name')
    .ilike('email', normalizedEmail)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findUserRecordByEmail(adminSupabase, email) {
  const normalizedEmail = normalizeEmail(email);
  const profile = await findUserProfileByEmail(adminSupabase, normalizedEmail);
  if (profile?.id) {
    return {
      id: profile.id,
      email: profile.email,
      user_metadata: {
        full_name: profile.full_name || ''
      }
    };
  }

  const perPage = 200;
  let page = 1;

  while (true) {
    const { data, error } = await adminSupabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const users = data?.users || [];
    const matchedUser = findUserByEmail(users, normalizedEmail);
    if (matchedUser) return matchedUser;

    if (users.length < perPage) break;
    page += 1;
  }

  return null;
}

function buildAuthResponse({
  email,
  name,
  token = '',
  refreshToken = '',
  tier = 'free',
  isAdmin,
  tags = [],
  contactId = null,
  profile = null,
  authUser = null,
  gpInfo = null,
  subscriptions = {},
  extra = {}
} = {}) {
  const normalizedEmail = normalizeEmail(email);
  const safeProfile = profile || {};
  const safeUserMetadata = authUser?.user_metadata || {};
  const resolvedIsAdmin = typeof isAdmin === 'boolean' ? isAdmin : isAdminEmail(normalizedEmail);
  const resolvedTier = canonicalizeTier(tier, normalizedEmail);
  const resolvedName = name || safeProfile.full_name || displayNameFromEmail(normalizedEmail);
  const normalizedSubscriptions =
    subscriptions && typeof subscriptions === 'object' && !Array.isArray(subscriptions)
      ? subscriptions
      : {};

  return {
    success: true,
    email: normalizedEmail,
    name: resolvedName,
    fullName: safeProfile.full_name || resolvedName,
    token: token || '',
    refreshToken: refreshToken || '',
    tier: resolvedTier,
    isAdmin: resolvedIsAdmin,
    tags: Array.isArray(tags) ? tags : [],
    contactId: contactId || null,
    phone: safeProfile.phone || null,
    location: safeProfile.location || null,
    avatar_url: safeProfile.avatar_url || safeUserMetadata.avatar_url || null,
    share_activity: safeProfile.share_activity !== false,
    sharePortfolio:
      safeProfile.share_activity !== undefined
        ? safeProfile.share_activity !== false
        : safeProfile.share_portfolio !== false,
    share_saved: safeProfile.share_saved !== false,
    share_dd: safeProfile.share_dd !== false,
    share_invested: safeProfile.share_invested !== false,
    allow_follows: safeProfile.allow_follows !== false,
    accredited_status: safeProfile.accredited_status || '',
    investable_capital: safeProfile.investable_capital || '',
    investment_experience: safeProfile.investment_experience || '',
    onboardingRole: safeProfile.onboarding_role || null,
    gpOnboardingComplete: safeProfile.gp_onboarding_complete || false,
    autoRenew: safeProfile.auto_renew !== false,
    cardLast4: safeProfile.card_last4 || null,
    cardBrand: safeProfile.card_brand || null,
    subscriptions: normalizedSubscriptions,
    ...(gpInfo && {
      gpType: gpInfo.gp_type,
      managementCompanyId: gpInfo.management_company_id,
      managementCompanyName: gpInfo.managementCompanyName
    }),
    ...extra
  };
}

async function detectGpInfo(adminSupabase, email) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;

  try {
    const { data: authMatch } = await adminSupabase
      .from('management_companies')
      .select('id, operator_name')
      .contains('authorized_emails', [normalizedEmail])
      .limit(1)
      .single();

    const { data: ceoMatch } = await adminSupabase
      .from('management_companies')
      .select('id, operator_name')
      .ilike('ceo', normalizedEmail)
      .limit(1)
      .single();

    if (ceoMatch) {
      return {
        gp_type: 'founder',
        management_company_id: ceoMatch.id,
        managementCompanyName: ceoMatch.operator_name
      };
    }

    if (authMatch) {
      return {
        gp_type: 'sponsor',
        management_company_id: authMatch.id,
        managementCompanyName: authMatch.operator_name
      };
    }
  } catch {
    // GP detection is best-effort; don't block auth
  }

  return null;
}

async function loadUserProfile(adminSupabase, userId) {
  if (!userId) return null;

  const { data } = await adminSupabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  return data || null;
}

async function loadUserProfileContext(adminSupabase, userId, { email = '' } = {}) {
  const profile = await loadUserProfile(adminSupabase, userId);
  const academyMembership = await getMembershipSummary(adminSupabase, userId, 'academy', {
    autoRenew: profile?.auto_renew ?? true,
    fallbackProfile: profile,
    email: profile?.email || email || '',
    contactId: profile?.ghl_contact_id || ''
  });

  return {
    profile,
    subscriptions: {
      academy: academyMembership
    }
  };
}

async function retryCreateGhlContact(adminSupabase, userId, email, fullName) {
  if (!userId || !email) return;

  const { data: profile } = await adminSupabase
    .from('user_profiles')
    .select('ghl_contact_id')
    .eq('id', userId)
    .single();

  if (profile?.ghl_contact_id && profile.ghl_contact_id !== 'SYNC_FAILED') return;

  const nameParts = String(fullName || displayNameFromEmail(email)).trim().split(/\s+/);
  ghlFetch('https://rest.gohighlevel.com/v1/contacts/', {
    method: 'POST',
    body: JSON.stringify({
      firstName: nameParts[0] || '',
      lastName: nameParts.slice(1).join(' ') || '',
      email,
      tags: ['dealflow-free']
    })
  }).then(async (resp) => {
    if (resp?.ok) {
      try {
        const ghlData = await resp.json();
        const contactId = ghlData?.contact?.id;
        if (contactId) {
          await adminSupabase.from('user_profiles').update({ ghl_contact_id: contactId }).eq('id', userId);
          console.log(`[GHL SYNC RETRY] Created GHL contact for ${email}: ${contactId}`);
        }
      } catch {}
    } else {
      console.error(`[GHL SYNC RETRY] Failed for ${email}. Status: ${resp?.status}`);
    }
  }).catch(() => {});
}

// Look up GHL contact for tier info (uses ghlFetch with retry)
async function getGhlTier(email) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const resp = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(normalizedEmail)}`
    );
    if (!resp?.ok) {
      return { tier: canonicalizeTier('free', normalizedEmail), tags: [], contactId: null, name: '' };
    }

    const data = await resp.json();
    const contact = (data.contacts || []).find((c) => normalizeEmail(c.email) === normalizedEmail);
    if (!contact) {
      return { tier: canonicalizeTier('free', normalizedEmail), tags: [], contactId: null, name: '' };
    }

    return {
      tier: canonicalizeTier(deriveTier(contact.tags || []), normalizedEmail),
      tags: contact.tags || [],
      contactId: contact.id,
      name: [contact.firstName, contact.lastName].filter(Boolean).join(' ')
    };
  } catch {
    return { tier: canonicalizeTier('free', normalizedEmail), tags: [], contactId: null, name: '' };
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
  const normalizedEmail = normalizeEmail(email);

  // ── Magic Link ─────────────────────────────────────────────────────
  if (action === 'magic-link') {
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });

    // Sandbox/preview bypass: skip email for specific test accounts only outside production.
    if (shouldUseAuthBypass(normalizedEmail)) {
      try {
        // Ensure user exists first
        let { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail
        });
        if (linkErr) {
          // User doesn't exist — create and retry
          await adminSupabase.auth.admin.createUser({ email: normalizedEmail, email_confirm: true });
          const retry = await adminSupabase.auth.admin.generateLink({ type: 'magiclink', email: normalizedEmail });
          linkData = retry.data;
          linkErr = retry.error;
          if (linkErr) throw linkErr;
        }

        // Verify the OTP to get a real session
        const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: 'magiclink'
        });
        if (verifyErr) throw verifyErr;

        // Get tier & GP info via lookup path
        const ghl = await getGhlTier(normalizedEmail);
        const gpInfo = await detectGpInfo(adminSupabase, normalizedEmail);

        return res.status(200).json(buildAuthResponse({
          email: normalizedEmail,
          name: ghl.name,
          token: verifyData.session.access_token,
          refreshToken: verifyData.session.refresh_token,
          tier: ghl.tier,
          isAdmin: isAdminEmail(normalizedEmail),
          tags: ghl.tags,
          contactId: ghl.contactId,
          authUser: verifyData.user,
          gpInfo,
          extra: { bypass: true }
        }));
      } catch (e) {
        console.error('[AUTH BYPASS] Failed:', e.message);
        return res.status(500).json({ error: 'Bypass login failed: ' + e.message });
      }
    }

    // Generate magic link server-side and send via Resend
    // (Supabase's built-in OTP email requires SMTP config we don't have)
    const siteOrigin = normalizeSiteOrigin(req.body?.siteUrl || req.headers.origin || DEFAULT_SITE_URL);
    const returnTo = normalizeReturnPath(req.body?.returnTo);
    const redirectUrl = new URL('/login', siteOrigin);
    if (returnTo) {
      redirectUrl.searchParams.set('return', returnTo);
    }
    const redirectTo = redirectUrl.toString();

    try {
      // Try generateLink — if user doesn't exist, create them first then retry.
      let { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail
      });

      if (linkErr) {
        // User likely doesn't exist — create and retry
        const { error: createErr } = await adminSupabase.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true
        });
        if (createErr && !createErr.message?.includes('already')) {
          return res.status(500).json({ error: createErr.message });
        }
        // Retry generateLink
        const retry = await adminSupabase.auth.admin.generateLink({
          type: 'magiclink',
          email: normalizedEmail
        });
        linkData = retry.data;
        linkErr = retry.error;
        if (linkErr) return res.status(500).json({ error: linkErr.message });
      }

      // Use the action_link from Supabase but rewrite redirect_to
      let confirmUrl = linkData.properties?.action_link;
      if (!confirmUrl) {
        // Fallback: build URL from hashed token
        confirmUrl = `${SUPABASE_URL}/auth/v1/verify?token=${linkData.properties.hashed_token}&type=magiclink&redirect_to=${encodeURIComponent(redirectTo)}`;
      } else {
        // Replace the redirect_to in the action_link
        const u = new URL(confirmUrl);
        u.searchParams.set('redirect_to', redirectTo);
        confirmUrl = u.toString();
      }

      // Send via Resend
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        console.error('[AUTH] RESEND_API_KEY not set — cannot send magic link');
        return res.status(500).json({ error: 'Email service not configured' });
      }

      const sendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Grow Your Cashflow <deals@growyourcashflow.io>',
          to: normalizedEmail,
          subject: 'Your GYC Dealflow Login Link',
          html: `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="background:#0A1E21;padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Grow Your Cashflow</div>
    <div style="font-size:12px;font-weight:600;color:#51BE7B;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;">Dealflow Portal</div>
  </div>
  <div style="background:#ffffff;padding:36px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;">Hi,</p>
    <p style="font-size:16px;color:#1a1a1a;margin:0 0 8px;line-height:1.6;">Your secure login link is ready. Click below to access your deal database.</p>
    <p style="font-size:13px;color:#6b7280;margin:0 0 28px;line-height:1.5;">838 deals across 19 asset classes from 455 sponsors &mdash; updated daily.</p>
    <div style="text-align:center;margin:0 0 28px;">
      <a href="${confirmUrl}" style="display:inline-block;background:#1F5159;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;">Log In to Dealflow</a>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:0;text-align:center;line-height:1.5;">
      <em>This link expires in 15 minutes.</em><br>
      If you didn't request this, you can safely ignore this email.
    </p>
  </div>
  <div style="background:#f9fafb;padding:16px 24px;text-align:center;border-radius:0 0 12px 12px;border:1px solid #e5e7eb;border-top:none;">
    <p style="font-size:11px;color:#9ca3af;margin:0;">Grow Your Cashflow &middot; growyourcashflow.io</p>
  </div>
</div>`
        })
      });

      if (!sendResp.ok) {
        const errText = await sendResp.text().catch(() => 'unknown');
        console.error('[AUTH] Resend magic link failed:', errText);
        return res.status(500).json({ error: 'Failed to send login email' });
      }

      return res.status(200).json({ success: true, message: 'Magic link sent' });
    } catch (e) {
      console.error('[AUTH] Magic link generation failed:', e.message);
      return res.status(500).json({ error: 'Failed to generate login link: ' + e.message });
    }
  }

  // ── Lookup (for existing magic link flow compatibility) ────────────
  if (action === 'lookup') {
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authorization token required' });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: lookupAuthData, error: lookupAuthError } = await supabase.auth.getUser(token);
    if (lookupAuthError || !lookupAuthData?.user?.email) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const requesterEmail = normalizeEmail(lookupAuthData.user.email);
    const requesterIsAdmin = isAdminEmail(requesterEmail);
    if (!canLookupEmail({
      requestEmail: normalizedEmail,
      tokenEmail: requesterEmail,
      isAdmin: requesterIsAdmin
    })) {
      return res.status(403).json({ error: 'Lookup email does not match authenticated user' });
    }

    // Check if user exists in Supabase
    const user = await findUserRecordByEmail(adminSupabase, normalizedEmail);

    // Get tier from GHL
    const ghl = await getGhlTier(normalizedEmail);
    const isAdmin = isAdminEmail(normalizedEmail);
    const resolvedTier = canonicalizeTier(ghl.tier, normalizedEmail);
    const gpInfo = await detectGpInfo(adminSupabase, normalizedEmail);

    if (user) {
      // Update profile with latest tier from GHL + GP info
      const profileData = {
        id: user.id,
        email: normalizedEmail,
        full_name: ghl.name || user.user_metadata?.full_name || displayNameFromEmail(normalizedEmail),
        tier: resolvedTier,
        is_admin: isAdmin,
        ghl_contact_id: ghl.contactId
      };
      if (gpInfo) {
        profileData.gp_type = gpInfo.gp_type;
        profileData.management_company_id = gpInfo.management_company_id;
        profileData.gp_verified = true;
      }
      await adminSupabase.from('user_profiles').upsert(profileData, { onConflict: 'id' });

      // Auto-retry GHL contact creation if missing
      if (!ghl.contactId) {
        await retryCreateGhlContact(
          adminSupabase,
          user.id,
          normalizedEmail,
          user.user_metadata?.full_name || ghl.name || displayNameFromEmail(normalizedEmail)
        );
      }

      // Fetch onboarding state from profile
      const { profile: existingProfile, subscriptions } = await loadUserProfileContext(adminSupabase, user.id, {
        email: normalizedEmail
      });

      return res.status(200).json(buildAuthResponse({
        email: normalizedEmail,
        name: ghl.name || user.user_metadata?.full_name,
        token: 'pending',
        refreshToken: '',
        tier: resolvedTier,
        isAdmin,
        tags: ghl.tags,
        contactId: ghl.contactId,
        authUser: user,
        profile: existingProfile,
        gpInfo,
        subscriptions
      }));
    }

    // User not in Supabase yet — return free tier (still include GP info if detected)
    return res.status(200).json(buildAuthResponse({
      email: normalizedEmail,
      name: ghl.name,
      token: 'pending',
      refreshToken: '',
      tier: resolvedTier,
      isAdmin,
      tags: ghl.tags,
      contactId: ghl.contactId,
      authUser: user,
      gpInfo
    }));
  }

  // ── Login ──────────────────────────────────────────────────────────
  if (action === 'login') {
    if (!normalizedEmail || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
    if (error) {
      return res.status(401).json({ success: false, error: error.message });
    }

    // Get tier from GHL + update profile
    const ghl = await getGhlTier(normalizedEmail);
    const isAdmin = isAdminEmail(normalizedEmail);
    const resolvedTier = canonicalizeTier(ghl.tier, normalizedEmail);
    const gpInfo = await detectGpInfo(adminSupabase, normalizedEmail);

    const loginProfile = {
      id: data.user.id,
      email: normalizedEmail,
      full_name: ghl.name || data.user.user_metadata?.full_name || displayNameFromEmail(normalizedEmail),
      tier: resolvedTier,
      is_admin: isAdmin,
      ghl_contact_id: ghl.contactId
    };
    if (gpInfo) {
      loginProfile.gp_type = gpInfo.gp_type;
      loginProfile.management_company_id = gpInfo.management_company_id;
      loginProfile.gp_verified = true;
    }
    await adminSupabase.from('user_profiles').upsert(loginProfile, { onConflict: 'id' });

    // Auto-retry GHL contact creation for users whose signup sync failed
    if (!ghl.contactId) {
      await retryCreateGhlContact(
        adminSupabase,
        data.user.id,
        normalizedEmail,
        data.user.user_metadata?.full_name || ghl.name || displayNameFromEmail(normalizedEmail)
      );
    }

    const { profile: loginProfileData, subscriptions } = await loadUserProfileContext(adminSupabase, data.user.id, {
      email: normalizedEmail
    });

    return res.status(200).json(buildAuthResponse({
      email: data.user.email,
      name: ghl.name || data.user.user_metadata?.full_name,
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
      tier: resolvedTier,
      isAdmin,
      tags: ghl.tags,
      contactId: ghl.contactId,
      authUser: data.user,
      profile: loginProfileData,
      gpInfo,
      subscriptions
    }));
  }

  // ── Register ───────────────────────────────────────────────────────
  if (action === 'register') {
    if (!normalizedEmail || !firstName || !lastName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Use admin API to create a pre-confirmed user (no confirmation email sent)
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: normalizedEmail,
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
        email: normalizedEmail,
        full_name: `${firstName} ${lastName}`,
        tier: 'free',
        is_admin: false
      }, { onConflict: 'id' });

      // Also create in GHL (with retry) — log failures so we can detect sync issues
      ghlFetch('https://rest.gohighlevel.com/v1/contacts/', {
        method: 'POST',
        body: JSON.stringify({
          firstName, lastName, email: normalizedEmail,
          tags: ['dealflow-free']
        })
      }).then(async (resp) => {
        if (!resp || !resp.ok) {
          console.error(`[GHL SYNC FAIL] Could not create GHL contact for ${normalizedEmail}. Status: ${resp?.status}. Will flag in user_profiles.`);
          // Flag this user so we can retry later
          await adminSupabase.from('user_profiles').update({ ghl_contact_id: 'SYNC_FAILED' }).eq('id', data.user.id);
        } else {
          // Store GHL contact ID for future lookups
          try {
            const ghlData = await resp.json();
            const contactId = ghlData?.contact?.id;
            if (contactId) {
              await adminSupabase.from('user_profiles').update({ ghl_contact_id: contactId }).eq('id', data.user.id);
            }
          } catch {}
        }
      }).catch(async (err) => {
        console.error(`[GHL SYNC FAIL] GHL contact creation threw for ${normalizedEmail}:`, err.message);
        await adminSupabase.from('user_profiles').update({ ghl_contact_id: 'SYNC_FAILED' }).eq('id', data.user.id).catch(() => {});
      });
    }

    return res.status(200).json(buildAuthResponse({
      email: normalizedEmail,
      name: `${firstName} ${lastName}`,
      token: 'pending',
      refreshToken: '',
      tier: 'free',
      authUser: data.user
    }));
  }

  if (action === 'verify') {
    const { token } = req.body || {};
    if (!token) {
      return res.status(400).json({ error: 'token is required' });
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user?.email) {
      return res.status(401).json({ success: false, error: 'Invalid or expired token' });
    }

    const verifiedEmail = normalizeEmail(data.user.email);
    const ghl = await getGhlTier(verifiedEmail);
    const isAdmin = isAdminEmail(verifiedEmail);
    const resolvedTier = canonicalizeTier(ghl.tier, verifiedEmail);
    const gpInfo = await detectGpInfo(adminSupabase, verifiedEmail);

    const profileData = {
      id: data.user.id,
      email: verifiedEmail,
      full_name: ghl.name || data.user.user_metadata?.full_name || displayNameFromEmail(verifiedEmail),
      tier: resolvedTier,
      is_admin: isAdmin,
      ghl_contact_id: ghl.contactId
    };
    if (gpInfo) {
      profileData.gp_type = gpInfo.gp_type;
      profileData.management_company_id = gpInfo.management_company_id;
      profileData.gp_verified = true;
    }
    await adminSupabase.from('user_profiles').upsert(profileData, { onConflict: 'id' });

    const { profile, subscriptions } = await loadUserProfileContext(adminSupabase, data.user.id, {
      email: verifiedEmail
    });
    return res.status(200).json({
      success: true,
      user: buildAuthResponse({
        email: verifiedEmail,
        name: ghl.name || data.user.user_metadata?.full_name,
        token,
        tier: resolvedTier,
        isAdmin,
        tags: ghl.tags,
        contactId: ghl.contactId,
        authUser: data.user,
        profile,
        gpInfo,
        subscriptions
      })
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
