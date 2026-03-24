import { ADMIN_EMAILS, getAdminClient, getUserClient, setCors, rateLimit } from './_supabase.js';
import { getMemberEvents } from './_member-events.js';

const ACADEMY_TIERS = new Set(['academy', 'founding', 'inner-circle']);

export default async function handler(req, res) {
	setCors(res);
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
	if (!rateLimit(req, res, { maxRequests: 30, windowMs: 60_000 })) return;

	const token = (req.headers.authorization || '').replace('Bearer ', '');
	if (!token) {
		return res.status(401).json({ error: 'Authorization token required' });
	}

	try {
		const userClient = getUserClient(token);
		const {
			data: { user },
			error: authError
		} = await userClient.auth.getUser();
		if (authError || !user) {
			return res.status(401).json({ error: 'Invalid or expired token' });
		}

		const admin = getAdminClient();
		const { data: profile, error: profileError } = await admin
			.from('user_profiles')
			.select('tier, is_admin')
			.eq('id', user.id)
			.single();

		if (profileError || !profile) {
			return res.status(404).json({ error: 'User profile not found' });
		}

		const isAdmin = Boolean(profile.is_admin) || ADMIN_EMAILS.includes((user.email || '').toLowerCase());
		if (!isAdmin && !ACADEMY_TIERS.has((profile.tier || '').toLowerCase())) {
			return res.status(403).json({ error: 'Cashflow Academy membership required' });
		}

		const programSlug = req.query.programSlug || 'cashflow_academy';
		const eventType = req.query.eventType || 'office_hours';
		const rawLimit = Number.parseInt(req.query.limit || '6', 10);
		const limit = Number.isFinite(rawLimit) ? Math.min(Math.max(rawLimit, 1), 24) : 6;

		const payload = await getMemberEvents({ programSlug, eventType, limit });
		return res.status(200).json({
			...payload,
			nextSession: payload.events[0] || null,
			upcomingSessions: payload.events
		});
	} catch (error) {
		console.error('member-events error:', error);
		return res.status(500).json({ error: 'Failed to load member events' });
	}
}
