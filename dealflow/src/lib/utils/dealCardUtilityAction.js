import { hasViewableDealDeck } from '$lib/utils/dealDocuments.js';
import { trackUserEventFireAndForget } from '$lib/utils/analytics.js';

export const DEAL_CARD_UTILITY_ACTIONS = {
	COMPARE: 'compare',
	VIEW_DECK: 'viewDeck',
	REQUEST_INTRODUCTION: 'requestIntroduction',
	NONE: 'none'
};

export const DEAL_CARD_FOOTER_ACTIONS = {
	SKIP: 'skip',
	SAVE: 'save',
	READY_TO_CONNECT: 'readyToConnect',
	TALKED_TO_OPERATOR: 'talkedToOperator',
	BACK_TO_CONNECT: 'backToConnect',
	WIRED_MONEY: 'wiredMoney',
	TRACKING: 'tracking',
	RECONSIDER: 'reconsider'
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
			id: DEAL_CARD_FOOTER_ACTIONS.SKIP,
			label: 'Skip',
			next: 'skipped',
			icon: 'x',
			danger: true
		},
		{
			id: DEAL_CARD_FOOTER_ACTIONS.SAVE,
			label: 'Save',
			next: 'review',
			icon: 'bookmark',
			primary: true
		}
	],
	review: [
		{
			id: DEAL_CARD_FOOTER_ACTIONS.SKIP,
			label: 'Skip',
			next: 'skipped',
			icon: 'x',
			danger: true
		},
		{
			id: DEAL_CARD_FOOTER_ACTIONS.READY_TO_CONNECT,
			label: 'Ready to Connect',
			next: 'connect',
			icon: 'check',
			primary: true
		}
	],
	connect: [
		{
			id: DEAL_CARD_FOOTER_ACTIONS.SKIP,
			label: 'Skip',
			next: 'skipped',
			icon: 'x',
			danger: true
		},
		{
			id: DEAL_CARD_FOOTER_ACTIONS.TALKED_TO_OPERATOR,
			label: "I've Talked to the Operator",
			next: 'decide',
			icon: 'check',
			primary: true
		}
	],
	decide: [
		{
			id: DEAL_CARD_FOOTER_ACTIONS.BACK_TO_CONNECT,
			label: 'Back to Connect',
			next: 'connect',
			icon: 'back'
		},
		{
			id: DEAL_CARD_FOOTER_ACTIONS.WIRED_MONEY,
			label: "I've Wired the Money",
			next: 'invested',
			icon: 'money',
			primary: true
		}
	],
	invested: [
		{
			id: DEAL_CARD_FOOTER_ACTIONS.TRACKING,
			label: 'Tracking',
			icon: 'tracking',
			status: true,
			full: true,
			disabled: true
		}
	],
	skipped: [
		{
			id: DEAL_CARD_FOOTER_ACTIONS.RECONSIDER,
			label: 'Reconsider',
			next: 'review',
			icon: 'refresh',
			primary: true,
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
