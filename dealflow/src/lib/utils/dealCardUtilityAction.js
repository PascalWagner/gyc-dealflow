import { hasViewableDealDeck } from '$lib/utils/dealDocuments.js';
import { normalizeStage as normalizePipelineStage } from '$lib/utils/dealflow-contract.js';

let analyticsModulePromise = null;

export const DEAL_CARD_UTILITY_ACTIONS = {
	COMPARE: 'compare',
	VIEW_DECK: 'viewDeck',
	REQUEST_INTRODUCTION: 'requestIntroduction',
	NONE: 'none'
};

export const DEAL_CARD_FOOTER_ACTIONS = {
	NOT_INTERESTED: 'notInterested',
	SAVE_DEAL: 'saveDeal',
	READY_TO_CONNECT: 'readyToConnect',
	BACK_TO_REVIEW: 'backToReview',
	READY_TO_DECIDE: 'readyToDecide',
	BACK_TO_CONNECT: 'backToConnect',
	RECONSIDER: 'reconsider'
};

export const DEAL_CARD_FOOTER_ACTION_TYPES = {
	NOT_INTERESTED: 'notInterested',
	BACK: 'back',
	FORWARD: 'forward'
};

const HIDDEN_UTILITY_ACTION = {
	show: false,
	action: DEAL_CARD_UTILITY_ACTIONS.NONE
};

const dealCardStageFooterConfigByStage = {
	filter: {
		allowCompare: true,
		utilityAction: HIDDEN_UTILITY_ACTION,
		footerActions: [
			{
				id: DEAL_CARD_FOOTER_ACTIONS.NOT_INTERESTED,
				label: 'Not Interested',
				next: 'skipped',
				icon: 'x',
				tone: 'negative',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.NOT_INTERESTED
			},
			{
				id: DEAL_CARD_FOOTER_ACTIONS.SAVE_DEAL,
				label: 'Save Deal',
				next: 'review',
				icon: 'bookmark',
				tone: 'primary',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.FORWARD
			}
		]
	},
	review: {
		allowCompare: true,
		utilityAction: {
			show: true,
			label: 'View Deck',
			action: DEAL_CARD_UTILITY_ACTIONS.VIEW_DECK
		},
		footerActions: [
			{
				id: DEAL_CARD_FOOTER_ACTIONS.NOT_INTERESTED,
				label: 'Not Interested',
				next: 'skipped',
				icon: 'x',
				tone: 'negative',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.NOT_INTERESTED
			},
			{
				id: DEAL_CARD_FOOTER_ACTIONS.READY_TO_CONNECT,
				label: 'Ready to Connect',
				next: 'connect',
				icon: 'check',
				tone: 'primary',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.FORWARD
			}
		]
	},
	connect: {
		allowCompare: true,
		utilityAction: {
			show: true,
			label: 'Request Introduction',
			action: DEAL_CARD_UTILITY_ACTIONS.REQUEST_INTRODUCTION
		},
		footerActions: [
			{
				id: DEAL_CARD_FOOTER_ACTIONS.NOT_INTERESTED,
				label: 'Not Interested',
				next: 'skipped',
				icon: 'x',
				tone: 'negative',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.NOT_INTERESTED
			},
			{
				id: DEAL_CARD_FOOTER_ACTIONS.BACK_TO_REVIEW,
				label: 'Back to Review',
				next: 'review',
				icon: 'back',
				tone: 'neutral',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.BACK
			},
			{
				id: DEAL_CARD_FOOTER_ACTIONS.READY_TO_DECIDE,
				label: 'Ready to Decide',
				next: 'decide',
				icon: 'check',
				tone: 'primary',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.FORWARD
			}
		]
	},
	decide: {
		allowCompare: true,
		utilityAction: HIDDEN_UTILITY_ACTION,
		footerActions: [
			{
				id: DEAL_CARD_FOOTER_ACTIONS.NOT_INTERESTED,
				label: 'Not Interested',
				next: 'skipped',
				icon: 'x',
				tone: 'negative',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.NOT_INTERESTED
			},
			{
				id: DEAL_CARD_FOOTER_ACTIONS.BACK_TO_CONNECT,
				label: 'Back to Connect',
				next: 'connect',
				icon: 'back',
				tone: 'neutral',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.BACK
			}
		]
	},
	invested: {
		allowCompare: false,
		utilityAction: HIDDEN_UTILITY_ACTION,
		footerActions: []
	},
	skipped: {
		allowCompare: false,
		utilityAction: HIDDEN_UTILITY_ACTION,
		footerActions: [
			{
				id: DEAL_CARD_FOOTER_ACTIONS.RECONSIDER,
				label: 'Reconsider Deal',
				next: 'review',
				icon: 'refresh',
				tone: 'primary',
				actionType: DEAL_CARD_FOOTER_ACTION_TYPES.FORWARD,
				full: true
			}
		]
	}
};

const dealCardCompareActionByViewMode = {
	grid: HIDDEN_UTILITY_ACTION,
	compare: {
		show: true,
		label: '+ Compare',
		action: DEAL_CARD_UTILITY_ACTIONS.COMPARE,
		disabled: false
	},
	map: HIDDEN_UTILITY_ACTION
};

const seenUtilityImpressions = new Set();
const seenDisabledUtilityImpressions = new Set();
const seenCompareImpressions = new Set();
const seenDisabledCompareImpressions = new Set();

function trackDealCardEvent(eventName, payload) {
	if (!eventName) return;
	analyticsModulePromise ||= import('$lib/utils/analytics.js');
	void analyticsModulePromise
		.then(({ trackUserEventFireAndForget }) => {
			trackUserEventFireAndForget(eventName, payload);
		})
		.catch(() => {});
}

function normalizeStage(stage) {
	return normalizePipelineStage(stage);
}

function normalizeViewMode(viewMode) {
	const normalized = String(viewMode || '').trim().toLowerCase();
	return normalized === 'location' ? 'map' : normalized || 'grid';
}

function normalizeUtilityAnalyticsPayload(payload = {}) {
	return {
		dealId: payload.dealId || '',
		dealName: payload.dealName || '',
		pipelineStage: normalizeStage(payload.pipelineStage),
		viewMode: normalizeViewMode(payload.viewMode),
		utilityActionType: payload.utilityActionType || DEAL_CARD_UTILITY_ACTIONS.NONE,
		labelShown: payload.labelShown || '',
		deckAvailable: Boolean(payload.deckAvailable),
		isDisabled: Boolean(payload.isDisabled),
		userRole: payload.userRole || '',
		accessTier: payload.accessTier || '',
		sourcePage: payload.sourcePage || 'dealFlow',
		compareModeActive: Boolean(payload.compareModeActive),
		reason: payload.reason || ''
	};
}

function normalizeCompareAnalyticsPayload(payload = {}) {
	return {
		dealId: payload.dealId || '',
		dealName: payload.dealName || '',
		pipelineStage: normalizeStage(payload.pipelineStage),
		viewMode: normalizeViewMode(payload.viewMode),
		compareActionType: payload.compareActionType || DEAL_CARD_UTILITY_ACTIONS.COMPARE,
		labelShown: payload.labelShown || '',
		isDisabled: Boolean(payload.isDisabled),
		userRole: payload.userRole || '',
		accessTier: payload.accessTier || '',
		sourcePage: payload.sourcePage || 'dealFlow',
		compareModeActive: Boolean(payload.compareModeActive),
		compareSelected: Boolean(payload.compareSelected),
		compareAtLimit: Boolean(payload.compareAtLimit)
	};
}

function normalizeFooterAnalyticsPayload(payload = {}) {
	return {
		dealId: payload.dealId || '',
		dealName: payload.dealName || '',
		currentPipeline: normalizeStage(payload.currentPipeline),
		destinationPipeline: normalizeStage(payload.destinationPipeline),
		actionId: payload.actionId || '',
		actionType: payload.actionType || '',
		labelShown: payload.labelShown || '',
		cardContext: payload.cardContext || 'dealFlow',
		userId: payload.userId || '',
		userRole: payload.userRole || ''
	};
}

function getImpressionKey(payload, actionTypeKey) {
	return [
		payload.dealId,
		payload.pipelineStage,
		payload.viewMode,
		payload[actionTypeKey],
		payload.labelShown,
		payload.isDisabled ? '1' : '0',
		payload.compareModeActive ? '1' : '0'
	].join(':');
}

export function getDealCardFooterConfig({ deal, pipelineStage }) {
	const stage = normalizeStage(pipelineStage);
	const baseConfig = dealCardStageFooterConfigByStage[stage] || dealCardStageFooterConfigByStage.filter;
	const utilityAction = baseConfig.utilityAction?.show ? { ...baseConfig.utilityAction } : { ...HIDDEN_UTILITY_ACTION };

	if (stage === 'review' && deal && utilityAction.show && !hasViewableDealDeck(deal)) {
		return {
			allowCompare: baseConfig.allowCompare !== false,
			utilityAction: {
				show: true,
				label: 'No Deck Available',
				action: DEAL_CARD_UTILITY_ACTIONS.NONE,
				disabled: true,
				reason: 'noDeck'
			},
			footerActions: baseConfig.footerActions.map((action) => ({ ...action }))
		};
	}

	return {
		allowCompare: baseConfig.allowCompare !== false,
		utilityAction: utilityAction.show
			? {
				...utilityAction,
				disabled: Boolean(utilityAction.disabled)
			}
			: { ...HIDDEN_UTILITY_ACTION },
		footerActions: baseConfig.footerActions.map((action) => ({ ...action }))
	};
}

export function getDealCardCompareAction({ viewMode }) {
	const normalizedViewMode = normalizeViewMode(viewMode);
	const baseAction = dealCardCompareActionByViewMode[normalizedViewMode] || HIDDEN_UTILITY_ACTION;

	if (!baseAction.show) {
		return { ...HIDDEN_UTILITY_ACTION };
	}

	return {
		...baseAction,
		disabled: false
	};
}

export function getDealCardActionModel({ deal, pipelineStage, viewMode }) {
	const footerConfig = getDealCardFooterConfig({ deal, pipelineStage });

	return {
		allowCompare: footerConfig.allowCompare,
		utilityAction: footerConfig.utilityAction,
		compareAction: footerConfig.allowCompare
			? getDealCardCompareAction({ viewMode })
			: { ...HIDDEN_UTILITY_ACTION },
		footerActions: footerConfig.footerActions
	};
}

export function buildDealCardFooterAnalyticsPayload({
	deal,
	currentPipeline,
	destinationPipeline,
	action,
	userId = '',
	userRole = ''
}) {
	return normalizeFooterAnalyticsPayload({
		dealId: deal?.id || '',
		dealName: deal?.investmentName || deal?.name || '',
		currentPipeline,
		destinationPipeline,
		actionId: action?.id || '',
		actionType: action?.actionType || '',
		labelShown: action?.label || '',
		cardContext: 'dealFlow',
		userId,
		userRole
	});
}

export function getDealCardActionLabel(action, { compareSelected = false, compareAtLimit = false } = {}) {
	if (!action?.show) return '';

	if (action.action === DEAL_CARD_UTILITY_ACTIONS.COMPARE) {
		if (compareSelected) return 'Remove Compare';
		if (compareAtLimit) return 'Compare Full';
	}

	return action.label || '';
}

export const getDealCardUtilityActionLabel = getDealCardActionLabel;

export function buildDealCardUtilityAnalyticsPayload({
	deal,
	pipelineStage,
	viewMode,
	utilityAction,
	labelShown = '',
	userRole = '',
	accessTier = '',
	compareModeActive = false
}) {
	return normalizeUtilityAnalyticsPayload({
		dealId: deal?.id || '',
		dealName: deal?.investmentName || deal?.name || '',
		pipelineStage,
		viewMode,
		utilityActionType: utilityAction?.action || DEAL_CARD_UTILITY_ACTIONS.NONE,
		labelShown,
		deckAvailable: hasViewableDealDeck(deal),
		isDisabled: Boolean(utilityAction?.disabled),
		userRole,
		accessTier,
		sourcePage: 'dealFlow',
		compareModeActive,
		reason: utilityAction?.reason || ''
	});
}

export function buildDealCardCompareAnalyticsPayload({
	deal,
	pipelineStage,
	viewMode,
	compareAction,
	labelShown = '',
	userRole = '',
	accessTier = '',
	compareModeActive = false,
	compareSelected = false,
	compareAtLimit = false
}) {
	return normalizeCompareAnalyticsPayload({
		dealId: deal?.id || '',
		dealName: deal?.investmentName || deal?.name || '',
		pipelineStage,
		viewMode,
		compareActionType: compareAction?.action || DEAL_CARD_UTILITY_ACTIONS.COMPARE,
		labelShown,
		isDisabled: Boolean(compareAction?.disabled),
		userRole,
		accessTier,
		sourcePage: 'dealFlow',
		compareModeActive,
		compareSelected,
		compareAtLimit
	});
}

export function trackDealCardUtilityActionImpression(payload) {
	const normalizedPayload = normalizeUtilityAnalyticsPayload(payload);
	const impressionKey = getImpressionKey(normalizedPayload, 'utilityActionType');
	if (seenUtilityImpressions.has(impressionKey)) return;
	seenUtilityImpressions.add(impressionKey);
	trackDealCardEvent('deal_card_utility_cta_impression', normalizedPayload);
}

export function trackDealCardUtilityActionDisabledImpression(payload) {
	const normalizedPayload = normalizeUtilityAnalyticsPayload(payload);
	const impressionKey = getImpressionKey(normalizedPayload, 'utilityActionType');
	if (seenDisabledUtilityImpressions.has(impressionKey)) return;
	seenDisabledUtilityImpressions.add(impressionKey);
	trackDealCardEvent('deal_card_utility_cta_disabled_impression', normalizedPayload);
}

export function trackDealCardUtilityActionClick(payload) {
	trackDealCardEvent('deal_card_utility_cta_clicked', normalizeUtilityAnalyticsPayload(payload));
}

export function trackDealCardCompareActionImpression(payload) {
	const normalizedPayload = normalizeCompareAnalyticsPayload(payload);
	const impressionKey = getImpressionKey(normalizedPayload, 'compareActionType');
	if (seenCompareImpressions.has(impressionKey)) return;
	seenCompareImpressions.add(impressionKey);
	trackDealCardEvent('deal_card_compare_impression', normalizedPayload);
}

export function trackDealCardCompareActionDisabledImpression(payload) {
	const normalizedPayload = normalizeCompareAnalyticsPayload(payload);
	const impressionKey = getImpressionKey(normalizedPayload, 'compareActionType');
	if (seenDisabledCompareImpressions.has(impressionKey)) return;
	seenDisabledCompareImpressions.add(impressionKey);
	trackDealCardEvent('deal_card_compare_disabled_impression', normalizedPayload);
}

export function trackDealCardCompareActionClick(payload) {
	trackDealCardEvent('deal_card_compare_clicked', normalizeCompareAnalyticsPayload(payload));
}

export function trackDealCardRequestIntroOpened(payload) {
	trackDealCardEvent('deal_card_request_intro_opened', normalizeUtilityAnalyticsPayload(payload));
}

export function trackDealCardViewDeckClicked(payload) {
	trackDealCardEvent('deal_card_view_deck_clicked', normalizeUtilityAnalyticsPayload(payload));
}

export function trackDealCardFooterActionClick(payload) {
	const normalizedPayload = normalizeFooterAnalyticsPayload(payload);
	let eventName = '';

	if (normalizedPayload.actionType === DEAL_CARD_FOOTER_ACTION_TYPES.NOT_INTERESTED) {
		eventName = 'deal_card_not_interested_clicked';
	} else if (normalizedPayload.actionType === DEAL_CARD_FOOTER_ACTION_TYPES.BACK) {
		eventName = 'deal_card_back_clicked';
	} else if (normalizedPayload.actionType === DEAL_CARD_FOOTER_ACTION_TYPES.FORWARD) {
		eventName = 'deal_card_forward_clicked';
	}

	if (!eventName) return;
	trackDealCardEvent(eventName, normalizedPayload);
}
