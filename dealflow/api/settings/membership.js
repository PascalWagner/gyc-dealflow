import { setCors, getUserClient, getAdminClient, verifyAdmin } from '../_supabase.js';
import { getRenewalCheckoutOptions } from '../_billing.js';
import { getMembershipSummary } from '../_subscriptions.js';
import { adminTargetEmail, findTargetUserIdByEmail, isAdminImpersonationRequest } from '../userdata/identity.js';

async function resolveMembershipReadContext(req, supabase, user) {
	if (!isAdminImpersonationRequest(req) || !adminTargetEmail(req)) {
		return {
			client: supabase,
			userId: user.id,
			email: user.email || ''
		};
	}

	const auth = await verifyAdmin(req);
	if (!auth.authorized) {
		const error = new Error(auth.error || 'Admin access required');
		error.statusCode = 403;
		throw error;
	}

	const adminClient = getAdminClient();
	const targetEmail = adminTargetEmail(req);
	const targetUserId = await findTargetUserIdByEmail(adminClient, targetEmail);
	if (!targetUserId) {
		const error = new Error(`No user found for ${targetEmail}`);
		error.statusCode = 404;
		throw error;
	}

	return {
		client: adminClient,
		userId: targetUserId,
		email: targetEmail
	};
}

export default async function handler(req, res) {
	setCors(res);
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

	const token = (req.headers.authorization || '').replace('Bearer ', '');
	if (!token) {
		return res.status(401).json({ error: 'Authorization token required' });
	}

	const supabase = getUserClient(token);
	const {
		data: { user },
		error: authError
	} = await supabase.auth.getUser();
	if (authError || !user) {
		return res.status(401).json({ error: 'Invalid or expired token' });
	}

	const productType = String(req.query.product_type || 'academy').trim().toLowerCase() || 'academy';

	try {
		const { client, userId, email } = await resolveMembershipReadContext(req, supabase, user);
		const { data: profile, error: profileError } = await client
			.from('user_profiles')
			.select('*')
			.eq('id', userId)
			.maybeSingle();

		if (profileError) throw profileError;

		const membership = await getMembershipSummary(client, userId, productType, {
			autoRenew: profile?.auto_renew ?? null,
			fallbackProfile: profile,
			email: email || profile?.email || user.email || '',
			contactId: profile?.ghl_contact_id || ''
		});

		return res.status(200).json({
			...membership,
			renewal_options: productType === 'academy' ? getRenewalCheckoutOptions() : []
		});
	} catch (error) {
		console.error('[SETTINGS MEMBERSHIP] Failed to load membership:', error);
		return res.status(error.statusCode || 500).json({ error: 'Failed to load membership', message: error.message });
	}
}
