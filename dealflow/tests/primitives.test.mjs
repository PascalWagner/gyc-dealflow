import test from 'node:test';
import assert from 'node:assert/strict';

import { formatLpGpSplit, formatLpSharePercent, formatHoldPeriod } from '../src/lib/utils/primitives.js';

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

// ---------------------------------------------------------------------------
// formatHoldPeriod
// ---------------------------------------------------------------------------

// Regression: raw float 3.1153846153846154 rendered verbatim, overflowing stat
// card on mobile. The function must cap precision to 1 decimal place.
test('formatHoldPeriod: long float rounds to 1 decimal — the core mobile overflow regression', () => {
	assert.equal(formatHoldPeriod(3.1153846153846154), '3.1 yrs');
});

test('formatHoldPeriod: whole number strips trailing zero (5.0 → "5 yrs")', () => {
	assert.equal(formatHoldPeriod(5.0), '5 yrs');
});

test('formatHoldPeriod: exactly 1 yr uses singular form', () => {
	assert.equal(formatHoldPeriod(1.0), '1 yr');
});

test('formatHoldPeriod: 1.5 → "1.5 yrs"', () => {
	assert.equal(formatHoldPeriod(1.5), '1.5 yrs');
});

test('formatHoldPeriod: 0 returns "—"', () => {
	assert.equal(formatHoldPeriod(0), '—');
});

test('formatHoldPeriod: null returns "—"', () => {
	assert.equal(formatHoldPeriod(null), '—');
});

test('formatHoldPeriod: undefined returns "—"', () => {
	assert.equal(formatHoldPeriod(undefined), '—');
});

test('formatHoldPeriod: negative value returns "—"', () => {
	assert.equal(formatHoldPeriod(-1), '—');
});

test('formatHoldPeriod: very large value still rounds to 1 decimal', () => {
	assert.equal(formatHoldPeriod(25.9999999), '26 yrs');
});
