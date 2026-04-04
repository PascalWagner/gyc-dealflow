/**
 * api-serverless-compat.test.mjs
 *
 * Verifies that every src/lib/ module imported by Vercel serverless functions
 * (api/*.js) can be loaded as a plain Node.js module WITHOUT Vite's $lib alias.
 *
 * WHY THIS TEST EXISTS
 * --------------------
 * Vercel API routes run as plain Node.js — they are NOT processed by Vite.
 * SvelteKit's $lib/ alias only works inside the SvelteKit build. If a src/lib/
 * file uses `import ... from '$lib/...'` and an API route imports that file,
 * Node.js throws MODULE_NOT_FOUND at cold-start, crashing the entire function.
 *
 * This happened in April 2026: dealReviewSchema.js started importing from
 * '$lib/constants/dealEnums.js', which broke api/deals/[id].js (deal edit),
 * api/deal-cleanup.js (enrichment), and silently broke any saved deal edits.
 *
 * RULE: Any src/lib/ file reachable from api/ MUST use relative imports only.
 *
 * Run: node --test --import ./scripts/register-codex-alias-loader.mjs tests/api-serverless-compat.test.mjs
 * (The alias loader is NOT involved — this test deliberately skips it to
 *  simulate the raw Node.js environment Vercel uses.)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const ROOT = resolve(import.meta.dirname, '..');

async function canImport(relativePath) {
	const absPath = resolve(ROOT, relativePath);
	const url = pathToFileURL(absPath).href;
	try {
		const mod = await import(url);
		return { ok: true, exports: Object.keys(mod) };
	} catch (err) {
		return { ok: false, error: err.message };
	}
}

// --- Files directly imported by api/ routes ---
// If any of these fail, a Vercel function is crashing at cold-start.

test('dealReviewSchema.js loads without $lib alias (used by api/deals/[id] and api/deal-cleanup)', async () => {
	const result = await canImport('src/lib/utils/dealReviewSchema.js');
	assert.ok(result.ok, `dealReviewSchema failed: ${result.error}`);
	assert.ok(result.exports.includes('dealFieldConfig'), 'missing dealFieldConfig export');
	assert.ok(result.exports.includes('DEAL_ASSET_CLASS_OPTIONS'), 'missing DEAL_ASSET_CLASS_OPTIONS re-export');
});

test('dealEnums.js loads without $lib alias (base constant module)', async () => {
	const result = await canImport('src/lib/constants/dealEnums.js');
	assert.ok(result.ok, `dealEnums failed: ${result.error}`);
	assert.ok(result.exports.includes('DEAL_ASSET_CLASS_OPTIONS'), 'missing DEAL_ASSET_CLASS_OPTIONS');
	assert.ok(result.exports.includes('ASSET_CLASS_ALIASES'), 'missing ASSET_CLASS_ALIASES');
});

test('dealWorkflow.js loads without $lib alias (used by api/deals/[id], api/deal-create, api/deck-upload)', async () => {
	const result = await canImport('src/lib/utils/dealWorkflow.js');
	assert.ok(result.ok, `dealWorkflow failed: ${result.error}`);
	assert.ok(result.exports.includes('slugify'), 'missing slugify export');
});

test('reviewFieldState.js loads without $lib alias (used by api/deals/[id] and api/deal-cleanup)', async () => {
	const result = await canImport('src/lib/utils/reviewFieldState.js');
	assert.ok(result.ok, `reviewFieldState failed: ${result.error}`);
});

test('reviewFieldEvidence.js loads without $lib alias (used by api/deal-cleanup)', async () => {
	const result = await canImport('src/lib/utils/reviewFieldEvidence.js');
	assert.ok(result.ok, `reviewFieldEvidence failed: ${result.error}`);
});

test('dealReturns.js loads without $lib alias (used by api/member/deals/transform and api/market-intel)', async () => {
	const result = await canImport('src/lib/utils/dealReturns.js');
	assert.ok(result.ok, `dealReturns failed: ${result.error}`);
});

test('dealSponsors.js loads without $lib alias (used by api/member/deals/transform and api/member/deals/filters)', async () => {
	const result = await canImport('src/lib/utils/dealSponsors.js');
	assert.ok(result.ok, `dealSponsors failed: ${result.error}`);
});

test('investing-geography.js loads without $lib alias (used by api/member/deals/transform and api/deal-cleanup)', async () => {
	const result = await canImport('src/lib/utils/investing-geography.js');
	assert.ok(result.ok, `investing-geography failed: ${result.error}`);
});

test('investorGoals.js loads without $lib alias (used by api/buybox and api/userdata/ghl)', async () => {
	const result = await canImport('src/lib/utils/investorGoals.js');
	assert.ok(result.ok, `investorGoals failed: ${result.error}`);
});

test('dealSubmission.js loads without $lib alias (used by api/deal-create, api/deck-upload, api/deck-submit)', async () => {
	const result = await canImport('src/lib/utils/dealSubmission.js');
	assert.ok(result.ok, `dealSubmission failed: ${result.error}`);
});

test('access-model.js loads without $lib alias (used by api/deal-create and api/deck-upload)', async () => {
	const result = await canImport('src/lib/auth/access-model.js');
	assert.ok(result.ok, `access-model failed: ${result.error}`);
	assert.ok(result.exports.includes('buildAccessModel'), 'missing buildAccessModel export');
});

test('subscription-model.js loads without $lib alias (used by api/_subscriptions)', async () => {
	const result = await canImport('src/lib/subscriptions/subscription-model.js');
	assert.ok(result.ok, `subscription-model failed: ${result.error}`);
});

test('dealflow-contract.js loads without $lib alias (used by api/gp-deal-performance and others)', async () => {
	const result = await canImport('src/lib/utils/dealflow-contract.js');
	assert.ok(result.ok, `dealflow-contract failed: ${result.error}`);
	assert.ok(result.exports.includes('normalizeStage'), 'missing normalizeStage export');
});

// --- Scan for $lib imports in all api-reachable src/lib files ---
// This catches the pattern before it reaches production.

import { readFileSync, readdirSync, statSync } from 'fs';

function walkFiles(dir, ext = '.js') {
	const results = [];
	for (const entry of readdirSync(dir, { withFileTypes: true })) {
		const full = resolve(dir, entry.name);
		if (entry.isDirectory()) results.push(...walkFiles(full, ext));
		else if (entry.name.endsWith(ext)) results.push(full);
	}
	return results;
}

test('no src/lib/ file imported by api/ uses a $lib/ import alias', () => {
	// Files known to be imported by Vercel API routes
	const apiReachableFiles = [
		'src/lib/utils/dealReviewSchema.js',
		'src/lib/constants/dealEnums.js',
		'src/lib/utils/dealWorkflow.js',
		'src/lib/utils/reviewFieldState.js',
		'src/lib/utils/reviewFieldEvidence.js',
		'src/lib/utils/dealReturns.js',
		'src/lib/utils/dealSponsors.js',
		'src/lib/utils/investing-geography.js',
		'src/lib/utils/investorGoals.js',
		'src/lib/utils/dealSubmission.js',
		'src/lib/auth/access-model.js',
		'src/lib/subscriptions/subscription-model.js',
		'src/lib/utils/dealflow-contract.js',
		'src/lib/utils/dealAnalysis.js',
		'src/lib/onboarding/teamContacts.js',
	];

	const violations = [];
	for (const relPath of apiReachableFiles) {
		const abs = resolve(ROOT, relPath);
		let content;
		try { content = readFileSync(abs, 'utf8'); } catch { continue; }
		const lines = content.split('\n');
		lines.forEach((line, i) => {
			if (/from\s+['"](\$lib\/|\$app\/)/.test(line)) {
				violations.push(`${relPath}:${i + 1}  ${line.trim()}`);
			}
		});
	}

	assert.deepEqual(
		violations,
		[],
		`Found $lib/$app imports in API-reachable files (these break Vercel serverless):\n${violations.join('\n')}`
	);
});
