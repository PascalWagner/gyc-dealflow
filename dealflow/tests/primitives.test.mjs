import test from 'node:test';
import assert from 'node:assert/strict';

import { formatLpGpSplit, formatLpSharePercent } from '../src/lib/utils/primitives.js';

// ---------------------------------------------------------------------------
// formatLpGpSplit
// ---------------------------------------------------------------------------

test('formatLpGpSplit: decimal fraction 0.8 → "80/20"', () => {
	assert.equal(formatLpGpSplit('0.8'), '80/20');
});

test('formatLpGpSplit: decimal fraction 0.75 → "75/25"', () => {
	assert.equal(formatLpGpSplit('0.75'), '75/25');
});

test('formatLpGpSplit: bare percentage "80" → "80/20"', () => {
	assert.equal(formatLpGpSplit('80'), '80/20');
});

test('formatLpGpSplit: percentage with sign "80%" → "80/20"', () => {
	assert.equal(formatLpGpSplit('80%'), '80/20');
});

test('formatLpGpSplit: already in X/Y form "80/20" passes through as "80/20"', () => {
	assert.equal(formatLpGpSplit('80/20'), '80/20');
});

test('formatLpGpSplit: raw number 0.8 → "80/20"', () => {
	assert.equal(formatLpGpSplit(0.8), '80/20');
});

test('formatLpGpSplit: null returns "—"', () => {
	assert.equal(formatLpGpSplit(null), '—');
});

test('formatLpGpSplit: undefined returns "—"', () => {
	assert.equal(formatLpGpSplit(undefined), '—');
});

test('formatLpGpSplit: empty string returns "—"', () => {
	assert.equal(formatLpGpSplit(''), '—');
});

test('formatLpGpSplit: non-numeric string passes through as-is', () => {
	assert.equal(formatLpGpSplit('N/A'), 'N/A');
});

// ---------------------------------------------------------------------------
// formatLpSharePercent
// ---------------------------------------------------------------------------

test('formatLpSharePercent: decimal fraction 0.8 → "80%"', () => {
	assert.equal(formatLpSharePercent('0.8'), '80%');
});

test('formatLpSharePercent: "80/20" → "80%"', () => {
	assert.equal(formatLpSharePercent('80/20'), '80%');
});

test('formatLpSharePercent: decimal fraction 0.75 → "75%"', () => {
	assert.equal(formatLpSharePercent('0.75'), '75%');
});

test('formatLpSharePercent: bare percentage "80" → "80%"', () => {
	assert.equal(formatLpSharePercent('80'), '80%');
});

test('formatLpSharePercent: null returns null', () => {
	assert.equal(formatLpSharePercent(null), null);
});

test('formatLpSharePercent: undefined returns null', () => {
	assert.equal(formatLpSharePercent(undefined), null);
});

test('formatLpSharePercent: empty string returns null', () => {
	assert.equal(formatLpSharePercent(''), null);
});
