import { browser } from '$app/environment';

export const DEAL_REVIEW_STAGES = ['intake', 'review'];

export const DEAL_REVIEW_STAGE_CONFIG = {
	intake: {
		id: 'intake',
		label: 'Upload Sources',
		shortLabel: 'Uploads',
		description: 'Attach the deck or PPM and confirm the sponsor details before extraction.',
		eyebrow: 'Step 1 of 2'
	},
	review: {
		id: 'review',
		label: 'Review Details',
		shortLabel: 'Review',
		description: 'Validate the extracted details, fix gaps, and prepare the deal for publishing.',
		eyebrow: 'Step 2 of 2'
	}
};

export const DEAL_REVIEW_SOURCE_DOC_CONFIG = {
	deck: {
		kind: 'deck',
		label: 'Investment Deck',
		shortLabel: 'Deck',
		fallbackName: 'Investment Deck',
		aliases: ['deckUrl', 'deck_url']
	},
	ppm: {
		kind: 'ppm',
		label: 'PPM',
		shortLabel: 'PPM',
		fallbackName: 'PPM',
		aliases: ['ppmUrl', 'ppm_url']
	}
};

const DEFAULT_STAGE = 'review';
const DEFAULT_BASE_PATH = '/deal-review';
const SOURCE_DOC_KINDS = Object.keys(DEAL_REVIEW_SOURCE_DOC_CONFIG);
const SOURCE_RAIL_STORAGE_PREFIX = 'dealReviewSourceRail';
const VALID_ORIGINS = new Set(['', 'intake', 'queue']);
const STAGE_ALIASES = new Map([
	['intake', 'intake'],
	['source', 'intake'],
	['sources', 'intake'],
	['upload', 'intake'],
	['uploads', 'intake'],
	['docs', 'intake'],
	['documents', 'intake'],
	['review', 'review'],
	['details', 'review'],
	['qa', 'review'],
	['extract', 'review'],
	['extraction', 'review'],
	['publish', 'review']
]);

function normalizeToken(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function coerceBoolean(value, fallback = false) {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	const normalized = normalizeToken(value);
	if (!normalized) return fallback;
	return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function readField(source, aliases = []) {
	for (const alias of aliases) {
		const value = source?.[alias];
		if (value !== undefined && value !== null && String(value).trim()) {
			return String(value).trim();
		}
	}
	return '';
}

function parseUrlLike(value) {
	if (value instanceof URL) return value;
	const raw = String(value || '').trim();
	if (!raw) return null;
	try {
		return new URL(raw);
	} catch {
		try {
			const origin = browser && window?.location?.origin ? window.location.origin : 'http://localhost';
			return new URL(raw, origin);
		} catch {
			return null;
		}
	}
}

function cloneSearchParams(searchParams) {
	if (searchParams instanceof URLSearchParams) {
		return new URLSearchParams(searchParams);
	}
	if (searchParams instanceof URL) {
		return new URLSearchParams(searchParams.searchParams);
	}
	if (typeof searchParams === 'string') {
		const trimmed = searchParams.startsWith('?') ? searchParams.slice(1) : searchParams;
		return new URLSearchParams(trimmed);
	}
	return new URLSearchParams();
}

function safeParseJson(value, fallback) {
	try {
		return value ? JSON.parse(value) : fallback;
	} catch {
		return fallback;
	}
}

function readStorageJson(key, fallback) {
	if (!browser) return fallback;
	return safeParseJson(window.localStorage.getItem(key), fallback);
}

function writeStorageJson(key, value) {
	if (!browser) return value;
	window.localStorage.setItem(key, JSON.stringify(value));
	return value;
}

export function normalizeDealReviewStage(stage, fallback = DEFAULT_STAGE) {
	const normalized = normalizeToken(stage).replace(/_/g, '');
	if (STAGE_ALIASES.has(normalized)) {
		return STAGE_ALIASES.get(normalized);
	}
	if (!fallback) return '';
	return DEAL_REVIEW_STAGES.includes(fallback) ? fallback : DEFAULT_STAGE;
}

export function normalizeDealReviewOrigin(origin = '') {
	const normalized = normalizeToken(origin);
	return VALID_ORIGINS.has(normalized) ? normalized : '';
}

export function normalizeDealReviewSourceKind(kind, fallback = 'deck') {
	const normalized = normalizeToken(kind);
	if (SOURCE_DOC_KINDS.includes(normalized)) return normalized;
	if (!fallback) return '';
	return SOURCE_DOC_KINDS.includes(fallback) ? fallback : 'deck';
}

export function getDealReviewStage(stage) {
	const resolvedStage = normalizeDealReviewStage(stage);
	return {
		...DEAL_REVIEW_STAGE_CONFIG[resolvedStage],
		index: DEAL_REVIEW_STAGES.indexOf(resolvedStage)
	};
}

export function listDealReviewStages(stages = DEAL_REVIEW_STAGES) {
	return (Array.isArray(stages) && stages.length > 0 ? stages : DEAL_REVIEW_STAGES)
		.map((stage) => normalizeDealReviewStage(stage))
		.filter((stage, index, allStages) => allStages.indexOf(stage) === index)
		.map((stage) => ({
			...DEAL_REVIEW_STAGE_CONFIG[stage],
			index: allStagesIndex(stages, stage)
		}));
}

function allStagesIndex(stages, targetStage) {
	const normalizedStages = (Array.isArray(stages) && stages.length > 0 ? stages : DEAL_REVIEW_STAGES).map((stage) =>
		normalizeDealReviewStage(stage)
	);
	return normalizedStages.indexOf(targetStage);
}

export function getDealReviewStageIndex(stage, stages = DEAL_REVIEW_STAGES) {
	return allStagesIndex(stages, normalizeDealReviewStage(stage));
}

export function getAdjacentDealReviewStage(stage, offset = 1, stages = DEAL_REVIEW_STAGES) {
	const stageDefinitions = listDealReviewStages(stages);
	if (stageDefinitions.length === 0) return '';
	const currentIndex = getDealReviewStageIndex(stage, stages);
	const safeIndex = currentIndex >= 0 ? currentIndex : 0;
	const nextIndex = Math.max(0, Math.min(stageDefinitions.length - 1, safeIndex + offset));
	return stageDefinitions[nextIndex]?.id || '';
}

export function resolveDealReviewState(input = {}) {
	const url = parseUrlLike(input.url || (browser ? window.location.href : ''));
	const searchParams = cloneSearchParams(input.searchParams || url?.searchParams);
	const stages = listDealReviewStages(input.stages);
	const stage = normalizeDealReviewStage(
		input.stage
			?? searchParams.get('stage')
			?? searchParams.get('step')
			?? DEFAULT_STAGE,
		DEFAULT_STAGE
	);
	const dealId = String(input.dealId ?? searchParams.get('id') ?? '').trim();
	const from = normalizeDealReviewOrigin(input.from ?? searchParams.get('from') ?? '');
	const extract = coerceBoolean(input.extract ?? searchParams.get('extract') ?? false, false);
	const documentKind = normalizeDealReviewSourceKind(
		input.documentKind ?? searchParams.get('doc') ?? searchParams.get('source') ?? '',
		''
	);
	const currentIndex = Math.max(0, stages.findIndex((candidate) => candidate.id === stage));
	const currentStage = stages[currentIndex] || getDealReviewStage(stage);
	const previousStage = stages[currentIndex - 1]?.id || '';
	const nextStage = stages[currentIndex + 1]?.id || '';

	return {
		dealId,
		stage,
		currentStage,
		stages,
		stageIndex: currentIndex,
		isFirstStage: currentIndex <= 0,
		isLastStage: currentIndex >= stages.length - 1,
		previousStage,
		nextStage,
		from,
		extract,
		documentKind,
		searchParams,
		url
	};
}

export function buildDealReviewSearchParams(options = {}) {
	const {
		dealId = '',
		stage = DEFAULT_STAGE,
		from = '',
		extract = false,
		documentKind = '',
		preserveSearchParams = null,
		stageParam = 'both',
		includeStage = true
	} = options;
	const params = cloneSearchParams(preserveSearchParams);
	const resolvedStage = normalizeDealReviewStage(stage, DEFAULT_STAGE);
	const resolvedFrom = normalizeDealReviewOrigin(from);
	const resolvedDocumentKind = normalizeDealReviewSourceKind(documentKind, '');

	params.delete('id');
	params.delete('stage');
	params.delete('step');
	params.delete('from');
	params.delete('extract');
	params.delete('doc');
	params.delete('source');

	if (String(dealId || '').trim()) {
		params.set('id', String(dealId).trim());
	}

	if (includeStage) {
		if (stageParam === 'stage' || stageParam === 'both') params.set('stage', resolvedStage);
		if (stageParam === 'step' || stageParam === 'both') params.set('step', resolvedStage);
	}

	if (resolvedFrom) {
		params.set('from', resolvedFrom);
	}

	if (coerceBoolean(extract, false)) {
		params.set('extract', '1');
	}

	if (resolvedDocumentKind) {
		params.set('doc', resolvedDocumentKind);
	}

	return params;
}

export function buildDealReviewHref(options = {}) {
	const {
		basePath = DEFAULT_BASE_PATH,
		hash = '',
		preserveSearchParams = null
	} = options;
	const params = buildDealReviewSearchParams({
		...options,
		preserveSearchParams
	});
	const query = params.toString();
	const suffix = query ? `?${query}` : '';
	return `${basePath}${suffix}${hash || ''}`;
}

export function syncDealReviewUrl(options = {}) {
	const {
		url = browser ? window.location.href : '',
		historyMode = 'replace',
		hash = '',
		...stateOptions
	} = options;
	const parsedUrl = parseUrlLike(url);
	const href = buildDealReviewHref({
		...resolveDealReviewState({ url: parsedUrl, ...stateOptions }),
		...stateOptions,
		basePath: parsedUrl?.pathname || options.basePath || DEFAULT_BASE_PATH,
		hash: hash || parsedUrl?.hash || '',
		preserveSearchParams: parsedUrl?.searchParams || stateOptions.preserveSearchParams
	});

	if (browser) {
		const historyMethod = historyMode === 'push' ? 'pushState' : 'replaceState';
		window.history[historyMethod](window.history.state, '', href);
	}

	return href;
}

export async function transitionDealReviewStage(options = {}) {
	const {
		targetStage,
		currentUrl = browser ? window.location.href : '',
		navigate = null,
		save = null,
		saveIfDirty = false,
		dirty = false,
		canLeave = null,
		replaceState = true,
		noScroll = true,
		keepFocus = true,
		basePath = DEFAULT_BASE_PATH,
		stageParam = 'both',
		includeStage = true,
		force = false,
		...stateOptions
	} = options;
	const currentState = resolveDealReviewState({
		url: currentUrl,
		...stateOptions
	});
	const nextStage = normalizeDealReviewStage(targetStage, currentState.stage);
	const nextHref = buildDealReviewHref({
		...currentState,
		...stateOptions,
		stage: nextStage,
		basePath,
		stageParam,
		includeStage,
		preserveSearchParams: currentState.searchParams
	});

	if (!force && currentState.stage === nextStage) {
		return {
			ok: true,
			changed: false,
			saved: false,
			stage: nextStage,
			href: nextHref
		};
	}

	if (typeof canLeave === 'function') {
		const allowed = await canLeave({
			currentStage: currentState.stage,
			targetStage: nextStage,
			state: currentState
		});
		if (allowed === false) {
			return {
				ok: false,
				reason: 'blocked',
				stage: currentState.stage,
				href: nextHref
			};
		}
	}

	let saved = false;
	if (saveIfDirty && dirty && typeof save === 'function') {
		try {
			const result = await save({
				currentStage: currentState.stage,
				targetStage: nextStage,
				state: currentState,
				href: nextHref
			});
			if (result === false || result?.ok === false) {
				return {
					ok: false,
					reason: 'save_failed',
					error: result?.error || null,
					stage: currentState.stage,
					href: nextHref
				};
			}
			saved = true;
		} catch (error) {
			return {
				ok: false,
				reason: 'save_failed',
				error,
				stage: currentState.stage,
				href: nextHref
			};
		}
	}

	if (typeof navigate === 'function') {
		await navigate(nextHref, {
			replaceState,
			noScroll,
			keepFocus
		});
	} else if (browser) {
		if (replaceState) window.location.replace(nextHref);
		else window.location.assign(nextHref);
	}

	return {
		ok: true,
		changed: true,
		saved,
		stage: nextStage,
		href: nextHref
	};
}

export function getDealReviewSourceDocName(url, fallbackLabel) {
	const parsed = parseUrlLike(url);
	if (!parsed) return fallbackLabel;
	const filename = decodeURIComponent(parsed.pathname.split('/').pop() || '').trim();
	return filename || fallbackLabel;
}

export function resolveDealReviewSourceDocs(source = {}, options = {}) {
	const { pendingFiles = {} } = options;
	return SOURCE_DOC_KINDS.map((kind) => {
		const config = DEAL_REVIEW_SOURCE_DOC_CONFIG[kind];
		const pendingFile = pendingFiles?.[kind] || null;
		const url = readField(source, config.aliases);
		const pendingName = String(pendingFile?.name || '').trim();
		const name = pendingName || getDealReviewSourceDocName(url, config.fallbackName);
		const status = pendingName ? 'pending' : url ? 'ready' : 'missing';
		return {
			...config,
			id: kind,
			url,
			name,
			status,
			isPending: Boolean(pendingName),
			isAvailable: Boolean(url || pendingName)
		};
	});
}

export function getDealReviewSourceRailStorageKey(dealId = '') {
	const id = String(dealId || 'global').trim() || 'global';
	return `${SOURCE_RAIL_STORAGE_PREFIX}:${id}`;
}

export function readDealReviewSourceRailState(dealId = '', options = {}) {
	const { defaultCollapsed = false } = options;
	const stored = readStorageJson(getDealReviewSourceRailStorageKey(dealId), {});
	return {
		activeKind: normalizeDealReviewSourceKind(stored?.activeKind, ''),
		lastOpenedKind: normalizeDealReviewSourceKind(stored?.lastOpenedKind, ''),
		collapsed: typeof stored?.collapsed === 'boolean' ? stored.collapsed : defaultCollapsed
	};
}

export function writeDealReviewSourceRailState(dealId = '', nextState = {}) {
	const previous = readDealReviewSourceRailState(dealId);
	return writeStorageJson(getDealReviewSourceRailStorageKey(dealId), {
		...previous,
		...nextState,
		activeKind: normalizeDealReviewSourceKind(nextState.activeKind ?? previous.activeKind, ''),
		lastOpenedKind: normalizeDealReviewSourceKind(nextState.lastOpenedKind ?? previous.lastOpenedKind, ''),
		collapsed: typeof nextState.collapsed === 'boolean' ? nextState.collapsed : previous.collapsed
	});
}

export function resolveDealReviewSourceRailState(options = {}) {
	const {
		dealId = '',
		docs = [],
		selectedKind = '',
		defaultCollapsed = false,
		persistedState = null
	} = options;
	const resolvedDocs = Array.isArray(docs) ? docs : resolveDealReviewSourceDocs(docs);
	const stored = persistedState || readDealReviewSourceRailState(dealId, { defaultCollapsed });
	const preferredKind = normalizeDealReviewSourceKind(selectedKind || stored.activeKind || stored.lastOpenedKind, '');
	const fallbackKind =
		resolvedDocs.find((doc) => doc.kind === preferredKind)?.kind
		|| resolvedDocs.find((doc) => doc.isAvailable)?.kind
		|| resolvedDocs[0]?.kind
		|| '';

	return {
		docs: resolvedDocs,
		activeKind: fallbackKind,
		collapsed: typeof stored.collapsed === 'boolean' ? stored.collapsed : defaultCollapsed
	};
}
