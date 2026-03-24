const KNOWN_SETUP_ERRORS = ['42P01', '42703'];

export const PLATFORM_OPTIONS = ['linkedin', 'youtube', 'instagram', 'x', 'email', 'podcast'];
export const FORMAT_OPTIONS = ['text_post', 'carousel', 'video', 'podcast', 'newsletter', 'short_form_video', 'clip'];
export const CTA_OPTIONS = ['none', 'comment', 'dm', 'reply', 'book_call', 'apply', 'read_more', 'watch', 'download'];
export const EVERGREEN_OPTIONS = ['evergreen', 'timely', 'campaign'];
export const REPURPOSE_OPTIONS = ['low', 'medium', 'high'];
export const ORIGIN_OPTIONS = ['original', 'repurposed', 'remix'];
export const ARCHIVE_OPTIONS = ['incomplete', 'archived'];

export function isSetupError(error) {
	if (!error) return false;
	if (KNOWN_SETUP_ERRORS.includes(error.code)) return true;
	const message = String(error.message || '').toLowerCase();
	return message.includes('published_contents') || message.includes('published_distributions');
}

export function slugify(value = '') {
	return String(value)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 200) || 'published-item';
}

export function generateContentId() {
	const year = new Date().getUTCFullYear();
	const suffix = Date.now().toString().slice(-6);
	return `PUB-${year}-${suffix}`;
}

function asArray(value) {
	if (Array.isArray(value)) return value;
	if (!value) return [];
	return [value];
}

function sanitizeTags(tags) {
	return Array.from(
		new Set(
			asArray(tags)
				.map((tag) => String(tag || '').trim())
				.filter(Boolean)
		)
	);
}

function asInteger(value) {
	const parsed = Number(value || 0);
	return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function asNumber(value) {
	const parsed = Number(value || 0);
	return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeDateTime(value) {
	if (!value) return null;
	return new Date(value).toISOString();
}

export function computeDistributionMetrics(distribution) {
	const item = {
		platform: distribution.platform || 'linkedin',
		published_url: String(distribution.published_url || '').trim(),
		published_at: normalizeDateTime(distribution.published_at),
		platform_handle: String(distribution.platform_handle || '').trim() || null,
		variant_label: String(distribution.variant_label || '').trim() || null,
		platform_text: String(distribution.platform_text || '').trim() || null,
		preview_image_url: String(distribution.preview_image_url || '').trim() || null,
		impressions: asInteger(distribution.impressions),
		views: asInteger(distribution.views),
		likes: asInteger(distribution.likes),
		comments: asInteger(distribution.comments),
		shares: asInteger(distribution.shares),
		saves: asInteger(distribution.saves),
		clicks: asInteger(distribution.clicks),
		replies: asInteger(distribution.replies),
		raw_metrics: distribution.raw_metrics && typeof distribution.raw_metrics === 'object' ? distribution.raw_metrics : {}
	};

	const engagements = item.likes + item.comments + item.shares + item.saves + item.clicks + item.replies;
	const base = item.views || item.impressions;
	item.engagement_rate = base ? Number(((engagements / base) * 100).toFixed(2)) : 0;
	item.performance_score = Number(
		(
			engagements +
			item.comments * 1.5 +
			item.shares * 2.5 +
			item.saves * 2 +
			item.clicks * 1.8 +
			base * 0.01
		).toFixed(2)
	);
	return item;
}

export function buildSearchDocument(content, distributions) {
	return [
		content.title,
		content.primary_topic,
		...(content.theme_tags || []),
		content.hook,
		content.canonical_content_text,
		content.content_summary,
		content.ai_retrieval_notes,
		...distributions.flatMap((item) => [item.platform, item.platform_text, item.variant_label, item.platform_handle])
	]
		.filter(Boolean)
		.join('\n');
}

export function rollupContent(content, distributions) {
	const timestamps = distributions
		.map((item) => item.published_at)
		.filter(Boolean)
		.sort();
	const totalViews = distributions.reduce((sum, item) => sum + (item.views || item.impressions || 0), 0);
	const totalEngagements = distributions.reduce(
		(sum, item) => sum + item.likes + item.comments + item.shares + item.saves + item.clicks + item.replies,
		0
	);
	const bestDistribution = distributions
		.slice()
		.sort((a, b) => (b.performance_score || 0) - (a.performance_score || 0))[0];
	const archiveComplete = Boolean(
		content.source_doc_url &&
		content.drive_folder_url &&
		content.preview_image_url &&
		String(content.canonical_content_text || '').trim() &&
		distributions.length
	);

	return {
		...content,
		first_published_at: timestamps[0] || null,
		last_published_at: timestamps[timestamps.length - 1] || null,
		best_platform: bestDistribution?.platform || null,
		best_platform_score: bestDistribution?.performance_score || 0,
		aggregate_performance_score: Number(
			distributions.reduce((sum, item) => sum + (item.performance_score || 0), 0).toFixed(2)
		),
		total_views: totalViews,
		total_engagements: totalEngagements,
		archive_complete: archiveComplete,
		archive_status: archiveComplete ? 'archived' : 'incomplete',
		search_document: buildSearchDocument(content, distributions)
	};
}

export function normalizePayload(payload, existingContent = null, actorEmail = '') {
	const distributions = (payload.distributions || [])
		.map(computeDistributionMetrics)
		.filter((item) => item.published_url && item.published_at);

	const content = {
		content_id: payload.content_id || existingContent?.content_id || generateContentId(),
		title: String(payload.title || existingContent?.title || '').trim(),
		slug: slugify(payload.slug || payload.title || existingContent?.title || ''),
		content_group_id: String(payload.content_group_id || existingContent?.content_group_id || '').trim() || null,
		primary_topic: String(payload.primary_topic || existingContent?.primary_topic || '').trim(),
		theme_tags: sanitizeTags(payload.theme_tags ?? existingContent?.theme_tags ?? []),
		format: String(payload.format || existingContent?.format || 'text_post').trim(),
		hook: String(payload.hook || existingContent?.hook || '').trim(),
		canonical_content_text: String(payload.canonical_content_text || existingContent?.canonical_content_text || '').trim(),
		content_summary: String(payload.content_summary || existingContent?.content_summary || '').trim() || null,
		cta_type: String(payload.cta_type || existingContent?.cta_type || 'none').trim(),
		evergreen_status: String(payload.evergreen_status || existingContent?.evergreen_status || 'evergreen').trim(),
		repurpose_potential: String(payload.repurpose_potential || existingContent?.repurpose_potential || 'medium').trim(),
		origin_type: String(payload.origin_type || existingContent?.origin_type || 'original').trim(),
		source_doc_url: String(payload.source_doc_url || existingContent?.source_doc_url || '').trim() || null,
		drive_folder_url: String(payload.drive_folder_url || existingContent?.drive_folder_url || '').trim() || null,
		preview_image_url: String(payload.preview_image_url || existingContent?.preview_image_url || '').trim() || null,
		ai_retrieval_notes: String(payload.ai_retrieval_notes || existingContent?.ai_retrieval_notes || '').trim() || null,
		created_by_email: existingContent?.created_by_email || actorEmail || null,
		updated_at: new Date().toISOString()
	};

	return {
		content: rollupContent(content, distributions),
		distributions
	};
}

export function serializeContent(record) {
	const distributions = (record.published_distributions || [])
		.slice()
		.sort((a, b) => new Date(a.published_at || 0).getTime() - new Date(b.published_at || 0).getTime())
		.map((item) => ({
			id: item.id,
			platform: item.platform,
			published_url: item.published_url,
			published_at: item.published_at,
			platform_handle: item.platform_handle,
			variant_label: item.variant_label,
			platform_text: item.platform_text,
			preview_image_url: item.preview_image_url,
			impressions: item.impressions || 0,
			views: item.views || 0,
			likes: item.likes || 0,
			comments: item.comments || 0,
			shares: item.shares || 0,
			saves: item.saves || 0,
			clicks: item.clicks || 0,
			replies: item.replies || 0,
			engagement_rate: asNumber(item.engagement_rate),
			performance_score: asNumber(item.performance_score)
		}));

	return {
		id: record.id,
		content_id: record.content_id,
		title: record.title,
		slug: record.slug,
		content_group_id: record.content_group_id,
		primary_topic: record.primary_topic,
		theme_tags: record.theme_tags || [],
		format: record.format,
		hook: record.hook,
		canonical_content_text: record.canonical_content_text,
		content_summary: record.content_summary,
		cta_type: record.cta_type,
		evergreen_status: record.evergreen_status,
		repurpose_potential: record.repurpose_potential,
		origin_type: record.origin_type,
		source_doc_url: record.source_doc_url,
		drive_folder_url: record.drive_folder_url,
		preview_image_url: record.preview_image_url,
		archive_status: record.archive_status,
		archive_complete: Boolean(record.archive_complete),
		ai_retrieval_notes: record.ai_retrieval_notes,
		search_document: record.search_document,
		first_published_at: record.first_published_at,
		last_published_at: record.last_published_at,
		best_platform: record.best_platform,
		best_platform_score: asNumber(record.best_platform_score),
		aggregate_performance_score: asNumber(record.aggregate_performance_score),
		total_views: asInteger(record.total_views),
		total_engagements: asInteger(record.total_engagements),
		platforms: Array.from(new Set(distributions.map((item) => item.platform))),
		distributions
	};
}

export function buildMetrics(items) {
	return {
		total_records: items.length,
		archived: items.filter((item) => item.archive_complete).length,
		incomplete: items.filter((item) => !item.archive_complete).length,
		evergreen: items.filter((item) => item.evergreen_status === 'evergreen').length,
		repurpose_high: items.filter((item) => item.repurpose_potential === 'high').length,
		multi_platform: items.filter((item) => item.platforms.length > 1).length,
		top_performers: items.filter((item) => item.aggregate_performance_score >= 1200).length
	};
}

function scoreMatch(item, query) {
	const q = query.toLowerCase();
	let score = 0;
	if ((item.title || '').toLowerCase().includes(q)) score += 8;
	if ((item.hook || '').toLowerCase().includes(q)) score += 7;
	if ((item.primary_topic || '').toLowerCase().includes(q)) score += 5;
	if ((item.search_document || '').toLowerCase().includes(q)) score += 2;
	for (const token of q.split(/\s+/).filter(Boolean)) {
		if ((item.title || '').toLowerCase().includes(token)) score += 2;
		if ((item.hook || '').toLowerCase().includes(token)) score += 1.5;
		if ((item.primary_topic || '').toLowerCase().includes(token)) score += 1.2;
		if ((item.search_document || '').toLowerCase().includes(token)) score += 0.5;
	}
	return score;
}

export function applyFilters(items, filters) {
	const normalized = items.slice().filter((item) => {
		if (filters.platform && !item.platforms.includes(filters.platform)) return false;
		if (filters.format && item.format !== filters.format) return false;
		if (filters.primary_topic && item.primary_topic !== filters.primary_topic) return false;
		if (filters.evergreen_status && item.evergreen_status !== filters.evergreen_status) return false;
		if (filters.repurpose_potential && item.repurpose_potential !== filters.repurpose_potential) return false;
		if (filters.archive_status && item.archive_status !== filters.archive_status) return false;
		return true;
	});

	const view = filters.view || 'all';
	let visible = normalized;
	if (view === 'top_performers') visible = visible.filter((item) => item.aggregate_performance_score > 0);
	if (view === 'evergreen') visible = visible.filter((item) => item.evergreen_status === 'evergreen');
	if (view === 'repurpose') visible = visible.filter((item) => item.repurpose_potential === 'high');
	if (view === 'missing') visible = visible.filter((item) => !item.archive_complete);

	const query = String(filters.q || '').trim();
	if (query) {
		visible = visible
			.map((item) => ({ score: scoreMatch(item, query), item }))
			.filter((pair) => pair.score > 0)
			.sort((a, b) => b.score - a.score || b.item.aggregate_performance_score - a.item.aggregate_performance_score)
			.map((pair) => pair.item);
	} else {
		visible.sort((a, b) => {
			const dateDiff = new Date(b.last_published_at || 0).getTime() - new Date(a.last_published_at || 0).getTime();
			if (view === 'top_performers') {
				return b.aggregate_performance_score - a.aggregate_performance_score || dateDiff;
			}
			return dateDiff || b.aggregate_performance_score - a.aggregate_performance_score;
		});
	}

	return visible;
}

export function buildSimilarItems(content, items, limit = 4) {
	const contentTags = new Set(content.theme_tags || []);
	const contentPlatforms = new Set(content.platforms || []);
	return items
		.filter((item) => item.id !== content.id)
		.map((item) => {
			let score = 0;
			if (item.primary_topic === content.primary_topic) score += 4;
			score += (item.theme_tags || []).filter((tag) => contentTags.has(tag)).length * 1.8;
			if (item.format === content.format) score += 1;
			score += item.platforms.filter((platform) => contentPlatforms.has(platform)).length * 0.7;
			return { score, item };
		})
		.filter((pair) => pair.score > 0)
		.sort((a, b) => b.score - a.score || b.item.aggregate_performance_score - a.item.aggregate_performance_score)
		.slice(0, limit)
		.map((pair) => ({
			id: pair.item.id,
			content_id: pair.item.content_id,
			title: pair.item.title,
			primary_topic: pair.item.primary_topic,
			preview_image_url: pair.item.preview_image_url,
			aggregate_performance_score: pair.item.aggregate_performance_score
		}));
}

export function emptyListResponse() {
	return {
		setupRequired: false,
		items: [],
		metrics: buildMetrics([]),
		options: {
			platforms: PLATFORM_OPTIONS,
			formats: FORMAT_OPTIONS,
			topics: []
		}
	};
}
