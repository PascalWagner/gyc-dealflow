import { setCors, getUserClient } from '../_supabase.js';
import { getMembershipSummary } from '../_subscriptions.js';

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
		const { data: profile, error: profileError } = await supabase
			.from('user_profiles')
			.select('*')
			.eq('id', user.id)
			.maybeSingle();

		if (profileError) throw profileError;

		const membership = await getMembershipSummary(supabase, user.id, productType, {
			autoRenew: profile?.auto_renew ?? true,
			fallbackProfile: profile,
			email: user.email || profile?.email || '',
			contactId: profile?.ghl_contact_id || ''
		});

		return res.status(200).json(membership);
	} catch (error) {
		console.error('[SETTINGS MEMBERSHIP] Failed to load membership:', error);
		return res.status(500).json({ error: 'Failed to load membership', message: error.message });
	}
}
