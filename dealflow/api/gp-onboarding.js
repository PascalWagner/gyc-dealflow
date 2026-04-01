// Vercel Serverless Function: GP Onboarding
// Saves/loads GP onboarding progress, company profile, and presentation interest.
//
// GET  ?email=...           → returns onboarding state + company data
// POST { email, step, data } → saves a specific onboarding step

import { getAdminClient, setCors, rateLimit } from './_supabase.js';
import { getLatestGpAgreement, hasCurrentGpAgreement } from './_gp-agreement.js';
import {
  loadManagementCompanyTeamContacts,
  saveManagementCompanyTeamContacts
} from './_management-company-contacts.js';

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!rateLimit(req, res)) return;

  const supabase = getAdminClient();

  // ── GET: Load onboarding state ──
  if (req.method === 'GET') {
    const email = req.query?.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization' });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user?.email) {
        return res.status(401).json({ error: 'Invalid authorization' });
      }
      if (user.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: 'Email does not match authenticated user' });
      }

      // Get user profile
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, gp_type, management_company_id, gp_verified, gp_onboarding_step, gp_onboarding_complete, onboarding_role, presentation_interest')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) return res.status(404).json({ error: 'User not found' });

      const agreement = await getLatestGpAgreement(supabase, profile.id);
      const hasCurrentAgreement = hasCurrentGpAgreement(agreement);

      // Get linked company (if any)
      let company = null;
      let teamContacts = [];
      if (profile.management_company_id) {
        const { data: mc } = await supabase
          .from('management_companies')
          .select('id, operator_name, ceo, website, linkedin_ceo, founding_year, type, asset_classes, authorized_emails, booking_url, ir_contact_name, ir_contact_email, logo_url')
          .eq('id', profile.management_company_id)
          .single();
        company = mc;
        const contactState = await loadManagementCompanyTeamContacts(supabase, {
          managementCompanyId: profile.management_company_id,
          company: mc,
          user: {
            name: profile.full_name,
            email: profile.email
          }
        });
        teamContacts = contactState.contacts;
      }

      // Check if they have any deals
      let dealCount = 0;
      if (profile.management_company_id) {
        const { count } = await supabase
          .from('opportunities')
          .select('id', { count: 'exact', head: true })
          .eq('management_company_id', profile.management_company_id)
          .is('parent_deal_id', null);
        dealCount = count || 0;
      }

      // Check if they have a buy box (for Phase 6)
      const { data: buyBox } = await supabase
        .from('user_buy_box')
        .select('id, completed_at')
        .eq('user_id', profile.id)
        .single();

      return res.status(200).json({
        profile: {
          id: profile.id,
          fullName: profile.full_name,
          email: profile.email,
          gpType: profile.gp_type,
          companyId: profile.management_company_id,
          gpVerified: profile.gp_verified,
          onboardingStep: profile.gp_onboarding_step || 0,
          onboardingComplete: profile.gp_onboarding_complete || false,
          onboardingRole: profile.onboarding_role,
          presentationInterest: profile.presentation_interest
        },
        company,
        teamContacts,
        dealCount,
        hasBuyBox: !!(buyBox && buyBox.completed_at),
        agreementStatus: {
          hasAgreement: !!agreement,
          hasCurrentAgreement,
          agreement: agreement || null
        }
      });
    } catch (e) {
      console.error('GP onboarding GET error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // ── POST: Save onboarding step ──
  if (req.method === 'POST') {
    const { email, step, data } = req.body || {};
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Missing authorization' });
      }
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user?.email) {
        return res.status(401).json({ error: 'Invalid authorization' });
      }
      if (user.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(403).json({ error: 'Email does not match authenticated user' });
      }

      // Look up user
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('id, management_company_id, onboarding_role')
        .eq('email', email.toLowerCase())
        .single();

      if (!profile) return res.status(404).json({ error: 'User not found' });

      const requiresAgreement = (
        step === 'deal-uploaded'
        || step === 'deal-skipped'
        || step === 'presentation'
        || step === 'buybox-interest'
        || (step === 'complete' && data?.role !== 'lp' && profile.onboarding_role !== 'lp')
      );

      if (requiresAgreement) {
        const agreement = await getLatestGpAgreement(supabase, profile.id);
        if (!hasCurrentGpAgreement(agreement)) {
          return res.status(409).json({
            error: 'A current signed operator listing agreement is required before continuing.',
            requiresAgreement: true
          });
        }
      }

      // Step: role-select (Phase 0)
      if (step === 'role-select') {
        await supabase
          .from('user_profiles')
          .update({ onboarding_role: data.role, gp_onboarding_step: 1 })
          .eq('id', profile.id);
        return res.status(200).json({ success: true, step: 1 });
      }

      // Step: company-profile (Phase 2a)
      if (step === 'company-profile') {
        let companyId = profile.management_company_id;

        const companyData = {
          operator_name: data.companyName,
          ceo: data.ceo,
          website: data.website,
          linkedin_ceo: data.linkedinCeo,
          founding_year: data.foundingYear ? parseInt(data.foundingYear, 10) : null,
          type: data.firmType,
          asset_classes: data.assetClasses || []
        };

        if (companyId) {
          // Update existing
          await supabase
            .from('management_companies')
            .update(companyData)
            .eq('id', companyId);
        } else {
          // Create new company
          companyData.authorized_emails = [email.toLowerCase()];
          const { data: newCo, error: coErr } = await supabase
            .from('management_companies')
            .insert(companyData)
            .select('id')
            .single();
          if (coErr) throw coErr;
          companyId = newCo.id;
        }

        // Update user profile
        await supabase
          .from('user_profiles')
          .update({
            management_company_id: companyId,
            gp_type: data.gpType || 'founder',
            gp_verified: true,
            gp_onboarding_step: 2
          })
          .eq('id', profile.id);

        return res.status(200).json({ success: true, step: 2, companyId });
      }

      // Step: team-contacts / ir-contact (Phase 2b)
      if (step === 'team-contacts' || step === 'ir-contact') {
        if (!profile.management_company_id) {
          return res.status(400).json({ error: 'Company not set up yet' });
        }

        const nextTeamContacts = Array.isArray(data?.teamContacts)
          ? data.teamContacts
          : [{
              firstName: data?.irContactFirstName,
              lastName: data?.irContactLastName,
              email: data?.irContactEmail,
              phone: data?.irContactPhone,
              role: data?.role || 'Investor Relations',
              linkedinUrl: data?.irLinkedin,
              isPrimary: true,
              isInvestorRelations: true,
              calendarUrl: data?.bookingUrl
            }];

        let contactState;
        try {
          contactState = await saveManagementCompanyTeamContacts(supabase, {
            managementCompanyId: profile.management_company_id,
            contacts: nextTeamContacts
          });
        } catch (contactError) {
          if (contactError?.validation) {
            return res.status(400).json({
              error: contactError.message,
              contactErrors: contactError.validation.errors || [],
              formError: contactError.validation.formError || contactError.message
            });
          }
          throw contactError;
        }

        await supabase
          .from('user_profiles')
          .update({ gp_onboarding_step: 3 })
          .eq('id', profile.id);

        return res.status(200).json({
          success: true,
          step: 3,
          teamContacts: contactState.contacts,
          storageMode: contactState.storageMode
        });
      }

      // Step: deal-uploaded (Phase 3 — just advance step, deal creation is separate)
      if (step === 'deal-uploaded' || step === 'deal-skipped') {
        const nextStep = 4;
        await supabase
          .from('user_profiles')
          .update({ gp_onboarding_step: nextStep })
          .eq('id', profile.id);
        return res.status(200).json({ success: true, step: nextStep });
      }

      // Step: presentation (Phase 4)
      if (step === 'presentation') {
        await supabase
          .from('user_profiles')
          .update({
            presentation_interest: data.interested === true,
            presentation_interest_date: data.interested ? new Date().toISOString() : null,
            gp_onboarding_step: 5
          })
          .eq('id', profile.id);
        return res.status(200).json({ success: true, step: 5 });
      }

      // Step: complete (Phase 5 → marks onboarding done)
      if (step === 'complete') {
        const isLpCompletion = data?.role === 'lp' || profile.onboarding_role === 'lp';
        if (isLpCompletion) {
          await supabase
            .from('user_profiles')
            .update({
              onboarding_role: 'lp',
              gp_onboarding_step: 1
            })
            .eq('id', profile.id);
          return res.status(200).json({ success: true, step: 1, role: 'lp' });
        }

        await supabase
          .from('user_profiles')
          .update({
            gp_onboarding_step: 6,
            gp_onboarding_complete: true
          })
          .eq('id', profile.id);
        return res.status(200).json({ success: true, step: 6 });
      }

      // Step: buybox-interest (Phase 6 — just record they want to do LP flow too)
      if (step === 'buybox-interest') {
        // They'll be redirected to the buy box wizard; just mark complete
        await supabase
          .from('user_profiles')
          .update({ gp_onboarding_complete: true, gp_onboarding_step: 6 })
          .eq('id', profile.id);
        return res.status(200).json({ success: true, step: 6, redirectToBuyBox: true });
      }

      return res.status(400).json({ error: 'Unknown step: ' + step });
    } catch (e) {
      console.error('GP onboarding POST error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
