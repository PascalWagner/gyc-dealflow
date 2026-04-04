import { browser } from '$app/environment';
import { getDeckPreviewUrl } from './dealDetailUi.js';

export function hasViewableDealDeck(deal) {
	const deckUrl = String(deal?.deckUrl || '').trim();
	if (!deckUrl) return false;
	return !deckUrl.includes('airtableusercontent.com');
}

/**
 * Returns the direct URL to open the deck document in a browser tab.
 * Uses getDeckPreviewUrl to normalise Google Drive / Dropbox / PDF links
 * into an embeddable/viewable form.
 *
 * Returns null when the deal has no viewable deck.
 */
export function getDealDeckHref(deal) {
	if (!hasViewableDealDeck(deal)) return null;
	return getDeckPreviewUrl(deal.deckUrl) || null;
}

/**
 * @deprecated Use getDealDeckHref. Previously returned /deal/{id}?deck=1
 * which never triggered the deck viewer because the deal page does not
 * read that query parameter. Kept for any callers that may reference it.
 */
export function getDealDeckViewerHref(deal) {
	return getDealDeckHref(deal);
}

/**
 * Opens the investment deck for a deal directly in a new browser tab.
 * Returns true if a tab was opened, false if the deal has no viewable deck.
 */
export function openDealDeckInNewTab(deal) {
	if (!browser) return false;

	const href = getDealDeckHref(deal);
	if (!href) return false;

	window.open(href, '_blank', 'noopener,noreferrer');
	return true;
}
