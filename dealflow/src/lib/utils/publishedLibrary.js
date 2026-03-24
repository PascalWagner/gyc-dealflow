export const PLATFORM_OPTIONS = ['linkedin', 'youtube', 'instagram', 'x', 'email', 'podcast'];
export const FORMAT_OPTIONS = [
	'text_post',
	'carousel',
	'video',
	'podcast',
	'newsletter',
	'short_form_video',
	'clip'
];
export const CTA_OPTIONS = ['none', 'comment', 'dm', 'reply', 'book_call', 'apply', 'read_more', 'watch', 'download'];
export const EVERGREEN_OPTIONS = ['evergreen', 'timely', 'campaign'];
export const REPURPOSE_OPTIONS = ['low', 'medium', 'high'];
export const ORIGIN_OPTIONS = ['original', 'repurposed', 'remix'];
export const ARCHIVE_OPTIONS = ['incomplete', 'archived'];
export const LIBRARY_VIEWS = [
	{ value: 'all', label: 'All' },
	{ value: 'top_performers', label: 'Top Performers' },
	{ value: 'evergreen', label: 'Evergreen' },
	{ value: 'repurpose', label: 'Repurpose' },
	{ value: 'missing', label: 'Missing Assets' }
];

export function emptyDistribution() {
	return {
		platform: 'linkedin',
		published_url: '',
		published_at: '',
		platform_handle: '',
		variant_label: '',
		platform_text: '',
		preview_image_url: '',
		impressions: 0,
		views: 0,
		likes: 0,
		comments: 0,
		shares: 0,
		saves: 0,
		clicks: 0,
		replies: 0
	};
}

export function emptyPublishedRecord() {
	return {
		title: '',
		content_group_id: '',
		primary_topic: '',
		theme_tags_input: '',
		format: 'text_post',
		hook: '',
		canonical_content_text: '',
		content_summary: '',
		cta_type: 'none',
		evergreen_status: 'evergreen',
		repurpose_potential: 'medium',
		origin_type: 'original',
		preview_image_url: '',
		source_doc_url: '',
		drive_folder_url: '',
		ai_retrieval_notes: ''
	};
}

export function formatPlatformLabel(value) {
	if (!value) return '';
	if (value === 'x') return 'X';
	return value
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function formatEnumLabel(value) {
	if (!value) return '';
	return value
		.split('_')
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(' ');
}

export function formatCount(value) {
	const number = Number(value || 0);
	return new Intl.NumberFormat('en-US', { notation: number >= 1000 ? 'compact' : 'standard' }).format(number);
}

export function formatDateTime(value) {
	if (!value) return 'No publish date';
	try {
		return new Date(value).toLocaleString();
	} catch {
		return value;
	}
}

export function formatDate(value) {
	if (!value) return 'No publish date';
	try {
		return new Date(value).toLocaleDateString();
	} catch {
		return value;
	}
}
