import { browser } from '$app/environment';

export function hasViewableDealDeck(deal) {
	const deckUrl = String(deal?.deckUrl || '').trim();
	if (!deckUrl) return false;
	return !deckUrl.includes('airtableusercontent.com');
}

export function getDealDeckViewerHref(deal) {
	if (!deal?.id || !hasViewableDealDeck(deal)) return null;
	return `/deal/${deal.id}?deck=1`;
}

export function openDealDeckInNewTab(deal) {
	if (!browser) return false;

	const href = getDealDeckViewerHref(deal);
	if (!href) return false;

	window.open(href, '_blank', 'noopener,noreferrer');
	return true;
}
