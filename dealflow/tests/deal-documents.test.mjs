import test from 'node:test';
import assert from 'node:assert/strict';

import {
	hasViewableDealDeck,
	getDealDeckHref,
	getDealDeckViewerHref,
	openDealDeckInNewTab
} from '../src/lib/utils/dealDocuments.js';

// ---------------------------------------------------------------------------
// hasViewableDealDeck
// ---------------------------------------------------------------------------

test('hasViewableDealDeck: returns true for a Google Drive URL', () => {
	assert.equal(hasViewableDealDeck({ deckUrl: 'https://drive.google.com/file/d/abc123/view' }), true);
});

test('hasViewableDealDeck: returns true for a direct PDF URL', () => {
	assert.equal(hasViewableDealDeck({ deckUrl: 'https://example.com/deck.pdf' }), true);
});

test('hasViewableDealDeck: returns false when deckUrl is null', () => {
	assert.equal(hasViewableDealDeck({ deckUrl: null }), false);
});

test('hasViewableDealDeck: returns false when deckUrl is empty string', () => {
	assert.equal(hasViewableDealDeck({ deckUrl: '' }), false);
});

test('hasViewableDealDeck: returns false for Airtable CDN URL', () => {
	assert.equal(hasViewableDealDeck({ deckUrl: 'https://v5.airtableusercontent.com/abc.pdf' }), false);
});

test('hasViewableDealDeck: returns false when deal is null', () => {
	assert.equal(hasViewableDealDeck(null), false);
});

// ---------------------------------------------------------------------------
// getDealDeckHref — regression: must NOT return a deal-page route
// ---------------------------------------------------------------------------

test('getDealDeckHref: returns a direct document URL, never a /deal/ route', () => {
	const deal = { id: 'deal-1', deckUrl: 'https://drive.google.com/file/d/1CMbf73lxoWHU7OPZWvnA1z81LAanUqxt/view' };
	const href = getDealDeckHref(deal);
	assert.ok(href, 'href should be non-null for a deal with a valid deckUrl');
	assert.ok(
		!href.startsWith('/deal/'),
		`getDealDeckHref must not return a deal-page route — got: ${href}`
	);
});

test('getDealDeckHref: converts Google Drive /view URL to /preview form', () => {
	const deal = { deckUrl: 'https://drive.google.com/file/d/1ABC_xyz/view' };
	const href = getDealDeckHref(deal);
	assert.ok(href?.includes('/preview'), `Expected /preview URL, got: ${href}`);
	assert.ok(!href?.includes('/view'), `Should not contain /view in final URL, got: ${href}`);
});

test('getDealDeckHref: returns null when deck is absent', () => {
	assert.equal(getDealDeckHref({ id: 'deal-1', deckUrl: null }), null);
});

test('getDealDeckHref: returns null for Airtable CDN URL', () => {
	assert.equal(getDealDeckHref({ deckUrl: 'https://v5.airtableusercontent.com/x.pdf' }), null);
});

// ---------------------------------------------------------------------------
// getDealDeckViewerHref — backward-compat shim
// ---------------------------------------------------------------------------

test('getDealDeckViewerHref: is an alias for getDealDeckHref (backward compat)', () => {
	const deal = { deckUrl: 'https://drive.google.com/file/d/1XYZ/view' };
	assert.equal(getDealDeckViewerHref(deal), getDealDeckHref(deal));
});

// ---------------------------------------------------------------------------
// openDealDeckInNewTab — runs in non-browser env (browser=false stub), so
// it should return false without throwing
// ---------------------------------------------------------------------------

test('openDealDeckInNewTab: returns false in non-browser environment', () => {
	// The $app/environment stub sets browser=false, so window.open is never called
	const result = openDealDeckInNewTab({ deckUrl: 'https://drive.google.com/file/d/abc/view' });
	assert.equal(result, false);
});

test('openDealDeckInNewTab: returns false when deal has no deck', () => {
	const result = openDealDeckInNewTab({ deckUrl: null });
	assert.equal(result, false);
});
