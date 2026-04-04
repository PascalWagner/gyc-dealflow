/**
 * deal-enums.test.mjs
 *
 * Validates that src/lib/constants/dealEnums.js contains the correct option arrays
 * and alias maps. These values drive dropdowns, API filter params, and data normalization
 * across the entire app — a silent corruption here breaks many features at once.
 *
 * Run: node --test --import ./scripts/register-codex-alias-loader.mjs tests/deal-enums.test.mjs
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
	DEAL_ASSET_CLASS_OPTIONS,
	DEAL_TYPE_OPTIONS,
	OFFERING_STATUS_OPTIONS,
	LENDING_FUND_OFFERING_STATUS_OPTIONS,
	AVAILABLE_TO_OPTIONS,
	DISTRIBUTIONS_OPTIONS,
	FINANCIALS_OPTIONS,
	INSTRUMENT_OPTIONS,
	DEBT_POSITION_OPTIONS,
	TAX_FORM_OPTIONS,
	UNDERLYING_EXPOSURE_TYPE_OPTIONS,
	RISK_TAG_OPTIONS,
	COUNTRY_OPTIONS,
	STATE_OPTIONS,
	HISTORICAL_RETURN_YEARS,
	ASSET_CLASS_ALIASES,
	DEAL_TYPE_ALIASES,
	OFFERING_STATUS_ALIASES,
	AVAILABLE_TO_ALIASES,
	DISTRIBUTIONS_ALIASES,
	FINANCIALS_ALIASES,
	INSTRUMENT_ALIASES,
	DEBT_POSITION_ALIASES,
	TAX_FORM_ALIASES
} from '$lib/constants/dealEnums.js';

// --- Option array integrity ---

test('all option arrays are non-empty arrays of non-empty strings', () => {
	const arrays = [
		['DEAL_ASSET_CLASS_OPTIONS', DEAL_ASSET_CLASS_OPTIONS],
		['DEAL_TYPE_OPTIONS', DEAL_TYPE_OPTIONS],
		['OFFERING_STATUS_OPTIONS', OFFERING_STATUS_OPTIONS],
		['LENDING_FUND_OFFERING_STATUS_OPTIONS', LENDING_FUND_OFFERING_STATUS_OPTIONS],
		['AVAILABLE_TO_OPTIONS', AVAILABLE_TO_OPTIONS],
		['DISTRIBUTIONS_OPTIONS', DISTRIBUTIONS_OPTIONS],
		['FINANCIALS_OPTIONS', FINANCIALS_OPTIONS],
		['INSTRUMENT_OPTIONS', INSTRUMENT_OPTIONS],
		['DEBT_POSITION_OPTIONS', DEBT_POSITION_OPTIONS],
		['TAX_FORM_OPTIONS', TAX_FORM_OPTIONS],
		['UNDERLYING_EXPOSURE_TYPE_OPTIONS', UNDERLYING_EXPOSURE_TYPE_OPTIONS],
		['RISK_TAG_OPTIONS', RISK_TAG_OPTIONS],
		['COUNTRY_OPTIONS', COUNTRY_OPTIONS],
		['STATE_OPTIONS', STATE_OPTIONS]
	];
	for (const [name, arr] of arrays) {
		assert.ok(Array.isArray(arr), `${name} must be an array`);
		assert.ok(arr.length > 0, `${name} must not be empty`);
		for (const item of arr) {
			assert.equal(typeof item, 'string', `${name} items must be strings, got ${typeof item}`);
			assert.ok(item.length > 0, `${name} items must not be empty strings`);
		}
	}
});

test('DEAL_ASSET_CLASS_OPTIONS contains expected real estate categories', () => {
	assert.ok(DEAL_ASSET_CLASS_OPTIONS.includes('Multi-Family'));
	assert.ok(DEAL_ASSET_CLASS_OPTIONS.includes('Industrial'));
	assert.ok(DEAL_ASSET_CLASS_OPTIONS.includes('Private Debt / Credit'));
	assert.ok(DEAL_ASSET_CLASS_OPTIONS.includes('Self Storage'));
	assert.ok(DEAL_ASSET_CLASS_OPTIONS.includes('Hotels/Hospitality'));
});

test('DEAL_TYPE_OPTIONS contains Fund and Syndication', () => {
	assert.ok(DEAL_TYPE_OPTIONS.includes('Fund'));
	assert.ok(DEAL_TYPE_OPTIONS.includes('Syndication'));
	assert.ok(DEAL_TYPE_OPTIONS.includes('Direct'));
	assert.ok(DEAL_TYPE_OPTIONS.includes('Joint Venture'));
});

test('OFFERING_STATUS_OPTIONS contains lifecycle status values', () => {
	assert.ok(OFFERING_STATUS_OPTIONS.includes('Open to invest'));
	assert.ok(OFFERING_STATUS_OPTIONS.includes('Fully Funded'));
	assert.ok(OFFERING_STATUS_OPTIONS.includes('Closed'));
	assert.ok(OFFERING_STATUS_OPTIONS.includes('Completed'));
	assert.ok(OFFERING_STATUS_OPTIONS.includes('Evergreen'));
});

test('STATE_OPTIONS has all 50 states plus DC (51 entries)', () => {
	assert.equal(STATE_OPTIONS.length, 51);
	assert.ok(STATE_OPTIONS.includes('CA'));
	assert.ok(STATE_OPTIONS.includes('NY'));
	assert.ok(STATE_OPTIONS.includes('TX'));
	assert.ok(STATE_OPTIONS.includes('FL'));
	assert.ok(STATE_OPTIONS.includes('DC'));
});

test('no duplicate values in any option array', () => {
	const arrays = [
		['DEAL_ASSET_CLASS_OPTIONS', DEAL_ASSET_CLASS_OPTIONS],
		['DEAL_TYPE_OPTIONS', DEAL_TYPE_OPTIONS],
		['OFFERING_STATUS_OPTIONS', OFFERING_STATUS_OPTIONS],
		['AVAILABLE_TO_OPTIONS', AVAILABLE_TO_OPTIONS],
		['DISTRIBUTIONS_OPTIONS', DISTRIBUTIONS_OPTIONS],
		['STATE_OPTIONS', STATE_OPTIONS]
	];
	for (const [name, arr] of arrays) {
		const seen = new Set();
		for (const item of arr) {
			assert.ok(!seen.has(item), `${name} has duplicate value: "${item}"`);
			seen.add(item);
		}
	}
});

// --- HISTORICAL_RETURN_YEARS ---

test('HISTORICAL_RETURN_YEARS starts at 2015 and ends last calendar year', () => {
	const currentYear = new Date().getFullYear();
	assert.ok(Array.isArray(HISTORICAL_RETURN_YEARS));
	assert.ok(HISTORICAL_RETURN_YEARS.length > 0);
	assert.equal(HISTORICAL_RETURN_YEARS[0], 2015);
	assert.equal(HISTORICAL_RETURN_YEARS[HISTORICAL_RETURN_YEARS.length - 1], currentYear - 1);
});

test('HISTORICAL_RETURN_YEARS is a contiguous sequence with no gaps', () => {
	for (let i = 1; i < HISTORICAL_RETURN_YEARS.length; i++) {
		assert.equal(
			HISTORICAL_RETURN_YEARS[i],
			HISTORICAL_RETURN_YEARS[i - 1] + 1,
			`Gap in HISTORICAL_RETURN_YEARS at index ${i}`
		);
	}
});

// --- Alias map integrity: every alias must resolve to a value in its option array ---

test('ASSET_CLASS_ALIASES all resolve to valid DEAL_ASSET_CLASS_OPTIONS values', () => {
	const valid = new Set(DEAL_ASSET_CLASS_OPTIONS);
	for (const [alias, value] of Object.entries(ASSET_CLASS_ALIASES)) {
		assert.ok(valid.has(value), `ASSET_CLASS_ALIASES["${alias}"] = "${value}" not in DEAL_ASSET_CLASS_OPTIONS`);
	}
});

test('DEAL_TYPE_ALIASES all resolve to valid DEAL_TYPE_OPTIONS values', () => {
	const valid = new Set(DEAL_TYPE_OPTIONS);
	for (const [alias, value] of Object.entries(DEAL_TYPE_ALIASES)) {
		assert.ok(valid.has(value), `DEAL_TYPE_ALIASES["${alias}"] = "${value}" not in DEAL_TYPE_OPTIONS`);
	}
});

test('OFFERING_STATUS_ALIASES all resolve to valid OFFERING_STATUS_OPTIONS values', () => {
	const valid = new Set(OFFERING_STATUS_OPTIONS);
	for (const [alias, value] of Object.entries(OFFERING_STATUS_ALIASES)) {
		assert.ok(valid.has(value), `OFFERING_STATUS_ALIASES["${alias}"] = "${value}" not in OFFERING_STATUS_OPTIONS`);
	}
});

test('AVAILABLE_TO_ALIASES all resolve to valid AVAILABLE_TO_OPTIONS values', () => {
	const valid = new Set(AVAILABLE_TO_OPTIONS);
	for (const [alias, value] of Object.entries(AVAILABLE_TO_ALIASES)) {
		assert.ok(valid.has(value), `AVAILABLE_TO_ALIASES["${alias}"] = "${value}" not in AVAILABLE_TO_OPTIONS`);
	}
});

test('DISTRIBUTIONS_ALIASES all resolve to valid DISTRIBUTIONS_OPTIONS values', () => {
	const valid = new Set(DISTRIBUTIONS_OPTIONS);
	for (const [alias, value] of Object.entries(DISTRIBUTIONS_ALIASES)) {
		assert.ok(valid.has(value), `DISTRIBUTIONS_ALIASES["${alias}"] = "${value}" not in DISTRIBUTIONS_OPTIONS`);
	}
});

test('FINANCIALS_ALIASES all resolve to valid FINANCIALS_OPTIONS values', () => {
	const valid = new Set(FINANCIALS_OPTIONS);
	for (const [alias, value] of Object.entries(FINANCIALS_ALIASES)) {
		assert.ok(valid.has(value), `FINANCIALS_ALIASES["${alias}"] = "${value}" not in FINANCIALS_OPTIONS`);
	}
});

test('INSTRUMENT_ALIASES all resolve to valid INSTRUMENT_OPTIONS values', () => {
	const valid = new Set(INSTRUMENT_OPTIONS);
	for (const [alias, value] of Object.entries(INSTRUMENT_ALIASES)) {
		assert.ok(valid.has(value), `INSTRUMENT_ALIASES["${alias}"] = "${value}" not in INSTRUMENT_OPTIONS`);
	}
});

test('DEBT_POSITION_ALIASES all resolve to valid DEBT_POSITION_OPTIONS values', () => {
	const valid = new Set(DEBT_POSITION_OPTIONS);
	for (const [alias, value] of Object.entries(DEBT_POSITION_ALIASES)) {
		assert.ok(valid.has(value), `DEBT_POSITION_ALIASES["${alias}"] = "${value}" not in DEBT_POSITION_OPTIONS`);
	}
});

test('TAX_FORM_ALIASES all resolve to valid TAX_FORM_OPTIONS values', () => {
	const valid = new Set(TAX_FORM_OPTIONS);
	for (const [alias, value] of Object.entries(TAX_FORM_ALIASES)) {
		assert.ok(valid.has(value), `TAX_FORM_ALIASES["${alias}"] = "${value}" not in TAX_FORM_OPTIONS`);
	}
});

// --- Common alias lookups that the app relies on ---

test('common asset class aliases normalize correctly', () => {
	assert.equal(ASSET_CLASS_ALIASES['multifamily'], 'Multi-Family');
	assert.equal(ASSET_CLASS_ALIASES['private debt'], 'Private Debt / Credit');
	assert.equal(ASSET_CLASS_ALIASES['debt fund'], 'Private Debt / Credit');
	assert.equal(ASSET_CLASS_ALIASES['hospitality'], 'Hotels/Hospitality');
	assert.equal(ASSET_CLASS_ALIASES['manufactured housing'], 'RV/Mobile Home Parks');
});

test('common deal type aliases normalize correctly', () => {
	assert.equal(DEAL_TYPE_ALIASES['syndicated'], 'Syndication');
	assert.equal(DEAL_TYPE_ALIASES['jv'], 'Joint Venture');
	assert.equal(DEAL_TYPE_ALIASES['fund'], 'Fund');
});

test('common offering status aliases normalize correctly', () => {
	assert.equal(OFFERING_STATUS_ALIASES['open'], 'Open to invest');
	assert.equal(OFFERING_STATUS_ALIASES['currently open'], 'Open to invest');
	assert.equal(OFFERING_STATUS_ALIASES['full cycle'], 'Completed');
	assert.equal(OFFERING_STATUS_ALIASES['funded'], 'Fully Funded');
});

test('distributions aliases include at-exit variants', () => {
	assert.equal(DISTRIBUTIONS_ALIASES['at exit'], 'At Exit');
	assert.equal(DISTRIBUTIONS_ALIASES['exit only'], 'At Exit');
	assert.equal(DISTRIBUTIONS_ALIASES['capital event'], 'At Exit');
});
