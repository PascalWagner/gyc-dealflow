import { hasViewableDealDeck } from '$lib/utils/dealDocuments.js';
import { trackUserEventFireAndForget } from '$lib/utils/analytics.js';

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
	MARK_INVESTED: 'markInvested',
	TRACKING: 'tracking',
	RECONSIDER: 'reconsider'
};

export const DEAL_CARD_FOOTER_ACTION_TYPES = {
	NOT_INTERESTED: 'notInterested',
	BACK: 'back',
	FORWARD: 'forward',
	STATUS: 'status'
};

export const dealCardUtilityActionByStage = {
	filter: { show: false, action: DEAL_CARD_UTILITY_ACTIONS.NONE },
	review: { show: true, label: 'View Deck', action: DEAL_CARD_UTILITY_ACTIONS.VIEW_DECK },
	connect: { show: true, label: 'Request Introduction', action: DEAL_CARD_UTILITY_ACTIONS.REQUEST_INTRODUCTION },
	decide: { show: false, action: DEAL_CARD_UTILITY_ACTIONS.NONE },
	invested: { show: true, label: '+ Compare', action: DEAL_CARD_UTILITY_ACTIONS.COMPARE },
	skipped: { show: true, label: '+ Compare', action: DEAL_CARD_UTILITY_ACTIONS.COMPARE }
};

export const dealCardFooterActionsByStage = {
	filter: [
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
	],
	review: [
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
	],
	connect: [
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
	],
	decide: [
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
		},
		{
			id: DEAL_CARD_FOOTER_ACTIONS.MARK_INVESTED,
			label: "I'm Investing",
			next: 'invested',
			icon: 'money',
			tone: 'primary',
			actionType: DEAL_CARD_FOOTER_ACTION_TYPES.FORWARD
		}
	],
	invested: [
		{
			id: DEAL_CARD_FOOTER_ACTIONS.TRACKING,
			label: 'Tracking',
			icon: 'tracking',
			tone: 'status',
			actionType: DEAL_CARD_FOOTER_ACTION_TYPES.STATUS,
			full: true,
			disabled: true
		}
	],
	skipped: [
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
};

const seenUtilityImpressions = new Set();
const seenDisabledUtilityImpressions = new Set();

function normalizeStage(stage) {
	const normalized = String(stage || '').trim().toLowerCase();
	return dealCardUtilityActionByStage[normalized] ? normalized : 'filter';
}

function normalizeViewMode(viewMode) {
	const normalized = String(viewMode || '').trim().toLowerCase();
	return normalized === 'map' ? 'location' : normalized || 'grid';
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

function getImpressionKey(payload) {
	return [
		payload.dealId,
		payload.pipelineStage,
		payload.viewMode,
		payload.utilityActionType,
		payload.labelShown,
		payload.isDisabled ? '1' : '0',
		payload.compareModeActive ? '1' : '0'
	].join(':');
}

export function getDealCardUtilityAction({ deal, pipelineStage, viewMode }) {
	const stage = normalizeStage(pipelineStage);
	const normalizedViewMode = normalizeViewMode(viewMode);
	const compareModeActive = normalizedViewMode === 'compare';

	if (compareModeActive) {
		return {
			show: true,
			label: '+ Compare',
			action: DEAL_CARD_UTILITY_ACTIONS.COMPARE,
			disabled: false
		};
	}

	const baseAction = dealCardUtilityActionByStage[stage] || dealCardUtilityActionByStage.filter;
	if (!baseAction.show) {
		return { ...baseAction };
	}

	if (stage === 'review' && !hasViewableDealDeck(deal)) {
		return {
			show: true,
			label: 'No Deck Available',
			action: DEAL_CARD_UTILITY_ACTIONS.NONE,
			disabled: true,
			reason: 'noDeck'
		};
	}

	return {
		...baseAction,
		disabled: false
	};
}

export function getDealCardFooterActions(pipelineStage) {
	const stage = normalizeStage(pipelineStage);
	const baseActions = dealCardFooterActionsByStage[stage] || dealCardFooterActionsByStage.filter;
	return baseActions.map((action) => ({ ...action }));
}

export function getDealCardActionModel({ deal, pipelineStage, viewMode }) {
	return {
		utilityAction: getDealCardUtilityAction({ deal, pipelineStage, viewMode }),
		footerActions: getDealCardFooterActions(pipelineStage)
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

export function getDealCardUtilityActionLabel(utilityAction, { compareSelected = false, compareAtLimit = false } = {}) {
	if (!utilityAction?.show) return '';

	if (utilityAction.action === DEAL_CARD_UTILITY_ACTIONS.COMPARE) {
		if (compareSelected) return 'Remove Compare';
		if (compareAtLimit) return 'Compare Full';
	}

	return utilityAction.label || '';
}

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

export function trackDealCardUtilityActionImpression(payload) {
	const normalizedPayload = normalizeUtilityAnalyticsPayload(payload);
	const impressionKey = getImpressionKey(normalizedPayload);
	if (seenUtilityImpressions.has(impressionKey)) return;
	seenUtilityImpressions.add(impressionKey);
	trackUserEventFireAndForget('deal_card_utility_cta_impression', normalizedPayload);
}

export function trackDealCardUtilityActionDisabledImpression(payload) {
	const normalizedPayload = normalizeUtilityAnalyticsPayload(payload);
	const impressionKey = getImpressionKey(normalizedPayload);
	if (seenDisabledUtilityImpressions.has(impressionKey)) return;
	seenDisabledUtilityImpressions.add(impressionKey);
	trackUserEventFireAndForget('deal_card_utility_cta_disabled_impression', normalizedPayload);
}

export function trackDealCardUtilityActionClick(payload) {
	trackUserEventFireAndForget('deal_card_utility_cta_clicked', normalizeUtilityAnalyticsPayload(payload));
}

export function trackDealCardRequestIntroOpened(payload) {
	trackUserEventFireAndForget('deal_card_request_intro_opened', normalizeUtilityAnalyticsPayload(payload));
}

export function trackDealCardViewDeckClicked(payload) {
	trackUserEventFireAndForget('deal_card_view_deck_clicked', normalizeUtilityAnalyticsPayload(payload));
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
	trackUserEventFireAndForget(eventName, normalizedPayload);
}
