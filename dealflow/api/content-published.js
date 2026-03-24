import { getAdminClient, rateLimit, setCors, verifyAdmin } from './_supabase.js';
import {
	ARCHIVE_OPTIONS,
	CTA_OPTIONS,
	EVERGREEN_OPTIONS,
	FORMAT_OPTIONS,
	ORIGIN_OPTIONS,
	PLATFORM_OPTIONS,
	REPURPOSE_OPTIONS,
	applyFilters,
	buildMetrics,
	buildSimilarItems,
	emptyListResponse,
	isSetupError,
	normalizePayload,
	serializeContent
} from './_published-library.js';

async function fetchAllContent(supabase) {
	const { data, error } = await supabase
		.from('published_contents')
		.select('*, published_distributions(*)')
		.order('last_published_at', { ascending: false, nullsFirst: false });
	if (error) throw error;
	return (data || []).map(serializeContent);
}

function listOptions(items) {
	return {
		platforms: PLATFORM_OPTIONS,
		formats: FORMAT_OPTIONS,
		topics: Array.from(new Set(items.map((item) => item.primary_topic).filter(Boolean))).sort(),
		cta: CTA_OPTIONS,
		evergreen: EVERGREEN_OPTIONS,
		repurpose: REPURPOSE_OPTIONS,
		origin: ORIGIN_OPTIONS,
		archive: ARCHIVE_OPTIONS
	};
}

async function handleList(req, res, supabase) {
	const rows = await fetchAllContent(supabase);
	const filters = {
		platform: req.query.platform,
		format: req.query.format,
		primary_topic: req.query.primary_topic,
		evergreen_status: req.query.evergreen_status,
		repurpose_potential: req.query.repurpose_potential,
		archive_status: req.query.archive_status,
		q: req.query.q,
		view: req.query.view
	};
	const items = applyFilters(rows, filters);
	return res.status(200).json({
		setupRequired: false,
		items,
		metrics: buildMetrics(rows),
		visibleCount: items.length,
		options: listOptions(rows)
	});
}

async function handleDetail(req, res, supabase) {
	const rows = await fetchAllContent(supabase);
	const requestedId = String(req.query.id || req.query.content_id || '').trim();
	const item = rows.find((row) => row.id === requestedId || row.content_id === requestedId);
	if (!item) return res.status(404).json({ error: 'Published content not found' });
	return res.status(200).json({
		setupRequired: false,
		item: {
			...item,
			similar_items: buildSimilarItems(item, rows)
		}
	});
}

async function handleUpsert(req, res, supabase, actorEmail) {
	const payload = req.body || {};
	let existing = null;

	if (payload.id) {
		const { data, error } = await supabase.from('published_contents').select('*').eq('id', payload.id).single();
		if (error) throw error;
		existing = data;
	}

	const normalized = normalizePayload(payload, existing, actorEmail);
	if (!normalized.content.title || !normalized.content.primary_topic || !normalized.content.hook || !normalized.content.canonical_content_text) {
		return res.status(400).json({ error: 'Title, topic, hook, and canonical content text are required.' });
	}

	let savedContentId = existing?.id || null;
	if (existing) {
		const { data, error } = await supabase
			.from('published_contents')
			.update(normalized.content)
			.eq('id', existing.id)
			.select('id')
			.single();
		if (error) throw error;
		savedContentId = data.id;
		const { error: deleteError } = await supabase
			.from('published_distributions')
			.delete()
			.eq('published_content_id', savedContentId);
		if (deleteError) throw deleteError;
	} else {
		const { data, error } = await supabase
			.from('published_contents')
			.insert(normalized.content)
			.select('id')
			.single();
		if (error) throw error;
		savedContentId = data.id;
	}

	if (normalized.distributions.length) {
		const rows = normalized.distributions.map((distribution) => ({
			...distribution,
			published_content_id: savedContentId
		}));
		const { error } = await supabase.from('published_distributions').insert(rows);
		if (error) throw error;
	}

	req.query = { ...req.query, id: savedContentId };
	return handleDetail(req, res, supabase);
}

function setupResponse(res) {
	return res.status(200).json({
		...emptyListResponse(),
		setupRequired: true,
		setupMessage:
			'Published library tables are not available yet. Apply supabase/migrations/044_published_library.sql, then reload.'
	});
}

export default async function handler(req, res) {
	setCors(res);
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (!rateLimit(req, res)) return;

	const { authorized, error, user } = await verifyAdmin(req);
	if (!authorized) return res.status(403).json({ error });

	const supabase = getAdminClient();

	try {
		if (req.method === 'GET') {
			if (req.query.id || req.query.content_id) return handleDetail(req, res, supabase);
			return handleList(req, res, supabase);
		}

		if (req.method === 'POST' || req.method === 'PATCH') {
			return handleUpsert(req, res, supabase, user?.email || '');
		}

		return res.status(405).json({ error: 'Method not allowed' });
	} catch (err) {
		if (isSetupError(err)) return setupResponse(res);
		console.error('content-published error', err);
		return res.status(500).json({ error: err.message || 'Unexpected error' });
	}
}
