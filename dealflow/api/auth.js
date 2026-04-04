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

function normalizeSiteOrigin(candidate) {
  try {
    const url = new URL(candidate || DEFAULT_SITE_URL);
    const host = url.hostname.toLowerCase();
    const isAllowedHost =
      host === 'dealflow.growyourcashflow.io' ||
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
    onboardingCompletedAt: safeProfile.onboarding_completed_at || null,
    tosAcceptedAt: safeProfile.tos_accepted_at || null,
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
    console.log(`[AUTH] Magic link requested for ${normalizedEmail} from ${req.headers.origin || 'unknown'}`);

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

    // Generate OTP code and embed in a 1-click login link
    // Scanner-proof: scanners can hit the URL but can't execute the JS that verifies the code
    const siteOrigin = normalizeSiteOrigin(req.body?.siteUrl || req.headers.origin || DEFAULT_SITE_URL);
    const returnTo = normalizeReturnPath(req.body?.returnTo);

    try {
      // Ensure user exists in Supabase Auth
      let { data: userData } = await adminSupabase.auth.admin.listUsers();
      let user = (userData?.users || []).find(u => u.email?.toLowerCase() === normalizedEmail);
      if (!user) {
        const { data: created, error: createErr } = await adminSupabase.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true
        });
        if (createErr && !createErr.message?.includes('already')) {
          return res.status(500).json({ error: createErr.message });
        }
        user = created?.user;
        if (!user) {
          // User was created but we need to re-fetch
          const refetch = await adminSupabase.auth.admin.listUsers();
          user = (refetch.data?.users || []).find(u => u.email?.toLowerCase() === normalizedEmail);
        }
      }

      // Generate 6-digit OTP
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes

      // Store OTP in user metadata
      if (user) {
        await adminSupabase.auth.admin.updateUser(user.id, {
          user_metadata: { ...(user.user_metadata || {}), otp_code: otp, otp_expires: expiresAt }
        });
      }

      // Build the 1-click login URL with OTP embedded
      const loginUrl = new URL('/login', siteOrigin);
      loginUrl.searchParams.set('otp', otp);
      loginUrl.searchParams.set('email', normalizedEmail);
      if (returnTo && returnTo !== '/app/deals') {
        loginUrl.searchParams.set('return', returnTo);
      }
      const confirmUrl = loginUrl.toString();

      // Send via Resend
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        console.error('[AUTH] RESEND_API_KEY not set');
        return res.status(500).json({ error: 'Email service not configured' });
      }

      const sendResp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'Grow Your Cashflow <deals@growyourcashflow.io>',
          to: normalizedEmail,
          subject: 'Log in to GYC Deals',
          html: `<div style="max-width:520px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="background:#1F5159;padding:32px 24px;text-align:center;border-radius:12px 12px 0 0;">
    <div style="font-size:22px;font-weight:700;color:#ffffff;letter-spacing:-0.3px;">Grow Your Cashflow</div>
    <div style="font-size:12px;font-weight:600;color:#51BE7B;letter-spacing:1.5px;text-transform:uppercase;margin-top:4px;">Dealflow Platform</div>
  </div>
  <div style="background:#ffffff;padding:36px 32px;border-left:1px solid #e5e7eb;border-right:1px solid #e5e7eb;">
    <p style="font-size:16px;color:#1a1a1a;margin:0 0 16px;line-height:1.6;">Hi,</p>
    <p style="font-size:16px;color:#1a1a1a;margin:0 0 24px;line-height:1.6;">Click below to log in to your deal database.</p>
    <div style="text-align:center;margin:0 0 24px;">
      <a href="${confirmUrl}" style="display:inline-block;background:#51BE7B;color:#ffffff;font-size:16px;font-weight:700;text-decoration:none;padding:14px 40px;border-radius:8px;">Log in to your account</a>
    </div>
    <p style="font-size:13px;color:#6b7280;margin:0 0 20px;text-align:center;line-height:1.5;">
      Or enter this code manually:
    </p>
    <div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;padding:16px;background:#f5f5f3;border-radius:10px;color:#1a1a1a;margin:0 0 20px;">${otp}</div>
    <p style="font-size:12px;color:#9ca3af;margin:0;text-align:center;line-height:1.5;">
      This code expires in 15 minutes. If you didn't request this, ignore this email.
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
        console.error('[AUTH] Login email send failed:', errText);
        return res.status(500).json({ error: 'Failed to send login email' });
      }

      console.log(`[AUTH] Login email sent to ${normalizedEmail} (OTP-in-link)`);
      return res.status(200).json({ success: true, message: 'Login email sent' });
    } catch (e) {
      console.error('[AUTH] Login email generation failed:', e.message);
      return res.status(500).json({ error: 'Failed to generate login email: ' + e.message });
    }
  }

  // ── Send OTP Code (fallback when magic link expired) ────────────────
  if (action === 'send-otp') {
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });
    console.log(`[AUTH] OTP code requested for ${normalizedEmail}`);

    try {
      // Generate a 6-digit OTP and send via Resend
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      // Store OTP in Supabase (simple key-value in user metadata)
      // First ensure user exists
      let { data: userData } = await adminSupabase.auth.admin.listUsers();
      let user = (userData?.users || []).find(u => u.email?.toLowerCase() === normalizedEmail);
      if (!user) {
        const { data: created } = await adminSupabase.auth.admin.createUser({
          email: normalizedEmail,
          email_confirm: true
        });
        user = created?.user;
      }

      if (user) {
        await adminSupabase.auth.admin.updateUser(user.id, {
          user_metadata: { ...user.user_metadata, otp_code: otp, otp_expires: expiresAt }
        });
      }

      // Send via Resend
      const resendKey = process.env.RESEND_API_KEY;
      if (!resendKey) {
        return res.status(500).json({ error: 'Email service not configured' });
      }

      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'GYC Deals <login@growyourcashflow.io>',
          to: normalizedEmail,
          subject: `Your verification code: ${otp}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
            <h2 style="margin:0 0 8px;">Your verification code</h2>
            <p style="color:#666;margin:0 0 24px;">Enter this code to sign in to GYC Deals</p>
            <div style="font-size:36px;font-weight:800;letter-spacing:8px;text-align:center;padding:24px;background:#f5f5f3;border-radius:12px;margin-bottom:24px;">${otp}</div>
            <p style="color:#999;font-size:13px;">This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.</p>
          </div>`
        })
      });

      console.log(`[AUTH] OTP code sent to ${normalizedEmail}`);
      return res.status(200).json({ success: true });
    } catch (e) {
      console.error('[AUTH] OTP send failed:', e.message);
      return res.status(500).json({ error: 'Failed to send code' });
    }
  }

  // ── Verify OTP Code ────────────────────────────────────────────────
  if (action === 'verify-otp') {
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });
    const code = String(req.body?.code || '').trim();
    if (!code || code.length < 6) return res.status(400).json({ error: 'Invalid code' });
    console.log(`[AUTH] OTP verify for ${normalizedEmail}`);

    try {
      // Look up user and check stored OTP
      let { data: userData } = await adminSupabase.auth.admin.listUsers();
      const user = (userData?.users || []).find(u => u.email?.toLowerCase() === normalizedEmail);
      if (!user) return res.status(404).json({ error: 'User not found' });

      const meta = user.user_metadata || {};
      if (!meta.otp_code || !meta.otp_expires) {
        return res.status(400).json({ error: 'No code was sent. Please request a new one.' });
      }
      if (Date.now() > meta.otp_expires) {
        return res.status(400).json({ error: 'Code expired. Please request a new one.' });
      }
      if (meta.otp_code !== code) {
        return res.status(400).json({ error: 'Incorrect code. Please try again.' });
      }

      // Code is valid — clear it and generate a session token
      await adminSupabase.auth.admin.updateUser(user.id, {
        user_metadata: { ...meta, otp_code: null, otp_expires: null }
      });

      // Generate a magic link token to create a session
      const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email: normalizedEmail
      });

      if (linkErr) {
        return res.status(500).json({ error: 'Session creation failed' });
      }

      // Extract the access token from the link data
      const accessToken = linkData?.properties?.access_token;
      const refreshToken = linkData?.properties?.refresh_token;

      // Do the lookup to get full user data
      const ghl = await getGhlTier(normalizedEmail);
      const isAdmin = isAdminEmail(normalizedEmail);
      const resolvedTier = canonicalizeTier(ghl.tier, normalizedEmail);
      const gpInfo = await detectGpInfo(adminSupabase, normalizedEmail);

      const { profile: existingProfile, subscriptions } = await loadUserProfileContext(adminSupabase, user.id, {
        email: normalizedEmail
      });

      const response = buildAuthResponse({
        email: normalizedEmail,
        name: ghl.name || user.user_metadata?.full_name,
        token: accessToken || '',
        refreshToken: refreshToken || '',
        tier: resolvedTier,
        isAdmin,
        tags: ghl.tags,
        contactId: ghl.contactId,
        authUser: user,
        profile: existingProfile,
        gpInfo,
        subscriptions
      });

      console.log(`[AUTH] OTP verified successfully for ${normalizedEmail}`);
      return res.status(200).json(response);
    } catch (e) {
      console.error('[AUTH] OTP verify failed:', e.message);
      return res.status(500).json({ error: 'Verification failed: ' + e.message });
    }
  }

  // ── Lookup (for existing magic link flow compatibility) ────────────
  if (action === 'lookup') {
    if (!normalizedEmail) return res.status(400).json({ error: 'Email is required' });
    console.log(`[AUTH] Lookup requested for ${normalizedEmail}`);

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
