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

    // Dev bypass: skip email for specific test accounts
    const BYPASS_EMAILS = ['test@test.com', 'info@pascalwagner.com'];
    if (BYPASS_EMAILS.includes(email.toLowerCase())) {
      try {
        // Generate magic link server-side (no email sent)
        const { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
          type: 'magiclink',
          email
        });
        if (linkErr) throw linkErr;

        // Verify the OTP to get a real session
        const { data: verifyData, error: verifyErr } = await supabase.auth.verifyOtp({
          token_hash: linkData.properties.hashed_token,
          type: 'magiclink'
        });
        if (verifyErr) throw verifyErr;

        // Get tier & GP info via lookup path
        const ghl = await getGhlTier(email);
        const isAdmin = ADMIN_EMAILS.includes(email.toLowerCase());

        return res.status(200).json({
          success: true,
          bypass: true,
          email,
          token: verifyData.session.access_token,
          refreshToken: verifyData.session.refresh_token,
          name: ghl.name || email.split('@')[0],
          tier: isAdmin ? 'academy' : ghl.tier,
          isAdmin,
          tags: ghl.tags,
          contactId: ghl.contactId
        });
      } catch (e) {
        console.error('[AUTH BYPASS] Failed:', e.message);
        return res.status(500).json({ error: 'Bypass login failed: ' + e.message });
      }
    }

    // Generate magic link server-side and send via Resend
    // (Supabase's built-in OTP email requires SMTP config we don't have)
    const siteUrl = process.env.SITE_URL || 'https://dealflow.growyourcashflow.io';
    const redirectTo = siteUrl + '/deal-login.html';

    try {
      // Try generateLink — if user doesn't exist, create them first then retry.
      let { data: linkData, error: linkErr } = await adminSupabase.auth.admin.generateLink({
        type: 'magiclink',
        email
      });

      if (linkErr) {
        // User likely doesn't exist — create and retry
        const { error: createErr } = await adminSupabase.auth.admin.createUser({
          email,
          email_confirm: true
        });
        if (createErr && !createErr.message?.includes('already')) {
          return res.status(500).json({ error: createErr.message });
        }
        // Retry generateLink
        const retry = await adminSupabase.auth.admin.generateLink({
          type: 'magiclink',
          email
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
          to: email,
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

      // Auto-retry GHL contact creation if missing
      if (!ghl.contactId) {
        const { data: profile } = await adminSupabase
          .from('user_profiles')
          .select('ghl_contact_id')
          .eq('id', user.id)
          .single();

        if (!profile?.ghl_contact_id || profile.ghl_contact_id === 'SYNC_FAILED') {
          const userName = user.user_metadata?.full_name || email.split('@')[0];
          const nameParts = userName.split(' ');
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
                  await adminSupabase.from('user_profiles').update({ ghl_contact_id: contactId }).eq('id', user.id);
                  console.log(`[GHL SYNC RETRY] Created GHL contact for ${email}: ${contactId}`);
                }
              } catch {}
            } else {
              console.error(`[GHL SYNC RETRY] Failed for ${email}. Status: ${resp?.status}`);
            }
          }).catch(() => {});
        }
      }

      // Fetch onboarding state from profile
      const { data: existingProfile } = await adminSupabase
        .from('user_profiles')
        .select('onboarding_role, gp_onboarding_complete, gp_type, academy_start, academy_end, auto_renew, card_last4, card_brand, phone, location, share_saved, share_dd, share_invested, allow_follows')
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
        phone: existingProfile?.phone || null,
        location: existingProfile?.location || null,
        share_saved: existingProfile?.share_saved !== false,
        share_dd: existingProfile?.share_dd !== false,
        share_invested: existingProfile?.share_invested !== false,
        allow_follows: existingProfile?.allow_follows !== false,
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

    // Auto-retry GHL contact creation for users whose signup sync failed
    if (!ghl.contactId) {
      const { data: profile } = await adminSupabase
        .from('user_profiles')
        .select('ghl_contact_id')
        .eq('id', data.user.id)
        .single();

      if (!profile?.ghl_contact_id || profile.ghl_contact_id === 'SYNC_FAILED') {
        const userName = data.user.user_metadata?.full_name || email.split('@')[0];
        const nameParts = userName.split(' ');
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
                await adminSupabase.from('user_profiles').update({ ghl_contact_id: contactId }).eq('id', data.user.id);
                console.log(`[GHL SYNC RETRY] Created GHL contact for ${email}: ${contactId}`);
              }
            } catch {}
          } else {
            console.error(`[GHL SYNC RETRY] Failed again for ${email}. Status: ${resp?.status}`);
          }
        }).catch(() => {});
      }
    }

    // Fetch academy dates
    const { data: loginProfileData } = await adminSupabase
      .from('user_profiles')
      .select('academy_start, academy_end, auto_renew, card_last4, card_brand, phone, location')
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
      phone: loginProfileData?.phone || null,
      location: loginProfileData?.location || null,
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

      // Also create in GHL (with retry) — log failures so we can detect sync issues
      ghlFetch('https://rest.gohighlevel.com/v1/contacts/', {
        method: 'POST',
        body: JSON.stringify({
          firstName, lastName, email,
          tags: ['dealflow-free']
        })
      }).then(async (resp) => {
        if (!resp || !resp.ok) {
          console.error(`[GHL SYNC FAIL] Could not create GHL contact for ${email}. Status: ${resp?.status}. Will flag in user_profiles.`);
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
        console.error(`[GHL SYNC FAIL] GHL contact creation threw for ${email}:`, err.message);
        await adminSupabase.from('user_profiles').update({ ghl_contact_id: 'SYNC_FAILED' }).eq('id', data.user.id).catch(() => {});
      });
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
