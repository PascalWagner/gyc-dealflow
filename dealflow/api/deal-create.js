// Vercel Serverless Function: Create or link a deal from member intake
// Authenticated users can either create a new deal submission or attach an
// existing deal to themselves. All intake actions are attributed for admin
// analytics and routed into the standard deal review workflow.

import { ADMIN_EMAILS, getAdminClient, rateLimit, setCors } from './_supabase.js';
import { buildAccessModel } from '../src/lib/auth/access-model.js';
import { buildNewDealDefaults, normalizeLifecycleStatus } from '../src/lib/utils/dealWorkflow.js';
import {
	normalizeSubmissionIntent,
	normalizeSubmissionKind,
	normalizeSubmissionSurface
} from '../src/lib/utils/dealSubmission.js';

function normalizeEmail(value) {
	return String(value || '').trim().toLowerCase();
}

function normalizeDisplayText(value) {
	return String(value || '').trim();
}

function inferSubmitterRole(accessModel) {
	if (accessModel?.roleFlags?.admin) return 'admin';
	if (accessModel?.roleFlags?.gp) return 'gp';
	return 'lp';
}

async function resolveSubmitterContext(supabase, user) {
	const email = normalizeEmail(user?.email);
	let profile = null;

	if (user?.id) {
		const { data } = await supabase
			.from('user_profiles')
			.select('id, email, full_name, management_company_id, is_admin')
			.eq('id', user.id)
			.maybeSingle();
		profile = data || null;
	}

	let managementCompanyId = profile?.management_company_id || null;
	if (!managementCompanyId && email) {
		const { data: company } = await supabase
			.from('management_companies')
			.select('id')
			.contains('authorized_emails', [email])
			.limit(1)
			.maybeSingle();
		managementCompanyId = company?.id || null;
	}

	const accessModel = buildAccessModel({
		email,
		is_admin: profile?.is_admin === true || ADMIN_EMAILS.includes(email),
		management_company_id: managementCompanyId,
		managementCompany: managementCompanyId ? { id: managementCompanyId } : null
	});

	return {
		userId: user?.id || profile?.id || null,
		email,
		name: normalizeDisplayText(profile?.full_name || user?.user_metadata?.full_name || user?.user_metadata?.name || ''),
		managementCompanyId,
		role: inferSubmitterRole(accessModel)
	};
}

async function logDealSubmission(supabase, submission = {}) {
	await supabase.from('deck_submissions').insert({
		deal_id: submission.dealId || null,
		deal_name: submission.dealName || '',
		deck_url: '',
		doc_type: '',
		notes: submission.notes || '',
		submitted_by_id: submission.submitter?.userId || null,
		submitted_by_name: submission.submitter?.name || '',
		submitted_by_email: submission.submitter?.email || '',
		submitted_by_role: submission.submitter?.role || 'admin',
		submission_kind: normalizeSubmissionKind(submission.submissionKind, 'new_deal'),
		submission_intent: normalizeSubmissionIntent(submission.intent, 'interested'),
		entry_surface: normalizeSubmissionSurface(submission.surface, 'deal_flow'),
		created_new_deal: submission.createdNewDeal === true,
		linked_existing_deal: submission.linkedExistingDeal === true
	});
}

export default async function handler(req, res) {
	setCors(res);
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	if (!rateLimit(req, res, { maxRequests: 10 })) return;

	try {
		const authHeader = req.headers.authorization || '';
		if (!authHeader.startsWith('Bearer ')) {
			return res.status(401).json({ error: 'Authorization token required' });
		}

		const token = authHeader.replace('Bearer ', '').trim();
		const supabase = getAdminClient();
		const {
			data: { user },
			error: authError
		} = await supabase.auth.getUser(token);

		if (authError || !user?.email) {
			return res.status(401).json({ error: 'Invalid or expired token' });
		}

		const {
			existingDealId,
			investmentName,
			sponsor,
			website,
			lifecycleStatus,
			intent,
			entrySurface,
			confirmedNewSponsor
		} = req.body || {};

		const normalizedIntent = normalizeSubmissionIntent(intent, 'interested');
		const normalizedSurface = normalizeSubmissionSurface(entrySurface, 'deal_flow');
		const submitter = await resolveSubmitterContext(supabase, user);

		const trimmedExistingDealId = normalizeDisplayText(existingDealId);
		if (trimmedExistingDealId) {
			const { data: existingDeal, error: existingDealError } = await supabase
				.from('opportunities')
				.select('id, investment_name, sponsor_name, lifecycle_status')
				.eq('id', trimmedExistingDealId)
				.maybeSingle();

			if (existingDealError || !existingDeal) {
				return res.status(404).json({ error: 'Existing deal not found' });
			}

			await logDealSubmission(supabase, {
				dealId: existingDeal.id,
				dealName: existingDeal.investment_name || investmentName || '',
				submitter,
				submissionKind: 'existing_deal_link',
				intent: normalizedIntent,
				surface: normalizedSurface,
				createdNewDeal: false,
				linkedExistingDeal: true,
				notes: 'User linked an existing deal from intake'
			}).catch((error) => {
				console.warn('Existing deal intake log failed:', error?.message || error);
			});

			return res.status(200).json({
				success: true,
				dealId: existingDeal.id,
				investmentName: existingDeal.investment_name,
				sponsorName: existingDeal.sponsor_name || '',
				lifecycleStatus: existingDeal.lifecycle_status || 'published',
				managementCompanyId: null,
				createdNewDeal: false,
				linkedExistingDeal: true
			});
		}

		const trimmedName = normalizeDisplayText(investmentName);
		const trimmedSponsor = normalizeDisplayText(sponsor);
		const trimmedWebsite = normalizeDisplayText(website);

		if (!trimmedName || !trimmedSponsor) {
			return res.status(400).json({ error: 'Investment name and sponsor are required' });
		}

		let managementCompanyId = null;

		// Phase A — exact match (case-insensitive)
		const { data: existingCompany } = await supabase
			.from('management_companies')
			.select('id')
			.ilike('operator_name', trimmedSponsor)
			.limit(1)
			.maybeSingle();

		if (existingCompany?.id) {
			managementCompanyId = existingCompany.id;
		} else if (!confirmedNewSponsor) {
			// Phase B — similarity check to catch near-duplicates (e.g. "DLP Capital" vs "DLP Capital Partners")
			// Only runs when the caller hasn't already confirmed they want a new record.
			const { data: similarRows } = await supabase.rpc('find_similar_sponsors', {
				p_name: trimmedSponsor,
				p_threshold: 0.45,
				p_limit: 3
			});

			if (Array.isArray(similarRows) && similarRows.length > 0) {
				return res.status(200).json({
					success: false,
					requiresSponsorConfirmation: true,
					similarSponsors: similarRows,
					submittedSponsor: trimmedSponsor,
					submittedWebsite: trimmedWebsite
				});
			}
		}

		if (!managementCompanyId) {
			// Phase C — no match; create a new management_company row
			const { data: newCompany, error: companyError } = await supabase
				.from('management_companies')
				.insert({
					operator_name: trimmedSponsor,
					website: trimmedWebsite || null
				})
				.select('id')
				.single();

			if (companyError) {
				console.error('Failed to create operator:', companyError.message);
			} else {
				managementCompanyId = newCompany.id;
			}
		}

		const requestedLifecycleStatus = normalizeLifecycleStatus(lifecycleStatus || 'in_review');

		const { data: deal, error: dealError } = await supabase
			.from('opportunities')
			.insert({
				...buildNewDealDefaults({
					investment_name: trimmedName,
					sponsor_name: trimmedSponsor
				}),
				investment_name: trimmedName,
				management_company_id: managementCompanyId,
				sponsor_name: trimmedSponsor,
				lifecycle_status: requestedLifecycleStatus,
				is_visible_to_users: requestedLifecycleStatus === 'published',
				status: 'Open to Invest',
				added_date: new Date().toISOString().split('T')[0],
				submission_intent: normalizedIntent,
				submission_surface: normalizedSurface,
				submitted_by_id: submitter.userId,
				submitted_by_name: submitter.name || '',
				submitted_by_email: submitter.email || '',
				submitted_by_role: submitter.role
			})
			.select('id, investment_name, sponsor_name, lifecycle_status')
			.single();

		if (dealError || !deal?.id) {
			console.error('Failed to create deal:', dealError?.message || dealError);
			return res.status(500).json({ error: `Failed to create deal: ${dealError?.message || 'Unknown error'}` });
		}

		if (managementCompanyId) {
			await supabase.from('deal_sponsors').insert({
				deal_id: deal.id,
				company_id: managementCompanyId,
				role: 'sponsor',
				is_primary: true,
				display_order: 0
			}).catch(() => {});
		}

		await logDealSubmission(supabase, {
			dealId: deal.id,
			dealName: trimmedName,
			submitter,
			submissionKind: 'new_deal',
			intent: normalizedIntent,
			surface: normalizedSurface,
			createdNewDeal: true,
			linkedExistingDeal: false,
			notes: 'User-submitted deal intake'
		}).catch((error) => {
			console.warn('Deal intake log failed:', error?.message || error);
		});

		return res.status(200).json({
			success: true,
			dealId: deal.id,
			investmentName: deal.investment_name,
			sponsorName: deal.sponsor_name || trimmedSponsor,
			lifecycleStatus: deal.lifecycle_status || requestedLifecycleStatus,
			managementCompanyId,
			createdNewDeal: true,
			linkedExistingDeal: false
		});
	} catch (error) {
		console.error('Deal create error:', error);
		return res.status(500).json({ error: 'Failed to create deal' });
	}
}
