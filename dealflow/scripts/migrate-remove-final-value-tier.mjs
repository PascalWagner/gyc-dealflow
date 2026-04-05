/**
 * migrate-remove-final-value-tier.mjs
 *
 * One-time migration to clean up `finalValue` / `finalValuePresent` from
 * every deal's `review_field_state` JSONB column.
 *
 * Background (deal-review-audit.md §3.1):
 *   The finalValue tier was eliminated because every code path that wrote
 *   to finalValue also wrote the same value to either aiValue (AI paths) or
 *   adminOverrideValue (human paths) simultaneously. finalValue was always
 *   redundant — it mirrored a higher-priority value and was never the sole
 *   source of truth.
 *
 * Classification logic applied per field entry:
 *   - adminOverrideActive=true → redundant copy of adminOverrideValue → just clear finalValue
 *   - aiValuePresent=true      → redundant copy of aiValue            → just clear finalValue
 *   - neither (anomalous)      → only data source; treat as AI value  → promote to aiValue, clear finalValue
 *
 * This script is IDEMPOTENT: running it on already-migrated data is a no-op
 * because entries without finalValue keys are skipped immediately.
 *
 * Usage:
 *   node scripts/migrate-remove-final-value-tier.mjs --dry-run   # preview, no writes
 *   node scripts/migrate-remove-final-value-tier.mjs --apply     # write to DB
 *
 * Optional flags:
 *   --deal-id <uuid>      restrict to a single deal
 *   --env-file <path>     path to .env file (default: .env.local or /tmp/dealflow-sandbox.env)
 *   --verbose             log every field touched, not just summaries
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const DEFAULT_ENV_FILE = fs.existsSync('/tmp/dealflow-sandbox.env')
	? '/tmp/dealflow-sandbox.env'
	: path.join(appRoot, '.env.local');

// ---------------------------------------------------------------------------
// Args
// ---------------------------------------------------------------------------

function parseArgs(argv = []) {
	const options = {
		apply: argv.includes('--apply'),
		dryRun: !argv.includes('--apply'),
		dealId: '',
		envFile: process.env.ENV_FILE || DEFAULT_ENV_FILE,
		verbose: argv.includes('--verbose')
	};
	for (let i = 0; i < argv.length; i++) {
		if (argv[i] === '--deal-id' && argv[i + 1]) options.dealId = argv[i + 1];
		if (argv[i] === '--env-file' && argv[i + 1]) options.envFile = argv[i + 1];
	}
	return options;
}

// ---------------------------------------------------------------------------
// Env / Supabase
// ---------------------------------------------------------------------------

function loadEnv(envFile) {
	if (!fs.existsSync(envFile)) {
		console.error(`[migrate] env file not found: ${envFile}`);
		process.exit(1);
	}
	const raw = fs.readFileSync(envFile, 'utf8');
	for (const line of raw.split('\n')) {
		const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
		if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
	}
}

function getSupabaseClient() {
	const url = process.env.SUPABASE_URL || process.env.PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
	if (!url || !key) {
		console.error('[migrate] SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
		process.exit(1);
	}
	return createClient(url, key);
}

// ---------------------------------------------------------------------------
// Migration logic
// ---------------------------------------------------------------------------

function hasFinalValue(entry) {
	return (
		entry !== null &&
		typeof entry === 'object' &&
		(Object.prototype.hasOwnProperty.call(entry, 'finalValue') ||
			Object.prototype.hasOwnProperty.call(entry, 'finalValuePresent'))
	);
}

/**
 * Classify a single entry and return the migrated version.
 * Returns null if the entry needs no migration (no finalValue keys).
 *
 * @returns {{ migrated: object, classification: string, oldFinalValue: unknown } | null}
 */
function migrateEntry(fieldKey, entry) {
	if (!hasFinalValue(entry)) return null;

	const oldFinalValue = entry.finalValue;
	const migrated = { ...entry };
	delete migrated.finalValue;
	delete migrated.finalValuePresent;

	let classification;

	if (entry.adminOverrideActive === true) {
		// finalValue was a redundant copy of adminOverrideValue — safe to drop
		classification = 'admin_override_redundant';
	} else if (entry.aiValuePresent === true || Object.prototype.hasOwnProperty.call(entry, 'aiValue')) {
		// finalValue was a redundant copy of aiValue — safe to drop
		classification = 'ai_value_redundant';
	} else {
		// Anomalous: finalValue was the only data source.
		// Promote it to aiValue so it survives the tier removal.
		classification = 'anomalous_promote_to_ai';
		migrated.aiValue = oldFinalValue;
		migrated.aiValuePresent = true;
	}

	return { migrated, classification, oldFinalValue };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
	const opts = parseArgs(process.argv.slice(2));
	loadEnv(opts.envFile);

	const mode = opts.apply ? 'APPLY' : 'DRY-RUN';
	console.log(`[migrate] mode=${mode} envFile=${opts.envFile}${opts.dealId ? ` dealId=${opts.dealId}` : ''}`);

	const supabase = getSupabaseClient();

	// Fetch deals: all, or a single deal if --deal-id is specified.
	let query = supabase
		.from('opportunities')
		.select('id, investment_name, review_field_state');

	if (opts.dealId) {
		query = query.eq('id', opts.dealId);
	}

	const { data: deals, error } = await query;
	if (error) {
		console.error('[migrate] fetch failed:', error.message);
		process.exit(1);
	}

	console.log(`[migrate] fetched ${deals.length} deal(s)`);

	const summary = {
		dealsScanned: deals.length,
		dealsWithFinalValue: 0,
		dealsUpdated: 0,
		fieldsTotal: 0,
		fieldsByClassification: {}
	};

	for (const deal of deals) {
		const state = deal.review_field_state;
		if (!state || typeof state !== 'object') continue;

		const nextState = { ...state };
		let dealChanged = false;

		for (const [fieldKey, entry] of Object.entries(state)) {
			if (!entry || typeof entry !== 'object') continue;

			const result = migrateEntry(fieldKey, entry);
			if (!result) continue; // no finalValue — skip

			const { migrated, classification, oldFinalValue } = result;
			nextState[fieldKey] = migrated;
			dealChanged = true;
			summary.fieldsTotal++;
			summary.fieldsByClassification[classification] = (summary.fieldsByClassification[classification] || 0) + 1;

			if (opts.verbose || classification === 'anomalous_promote_to_ai') {
				console.log(`[migrate]  deal=${deal.id} field=${fieldKey} classification=${classification} oldFinalValue=${JSON.stringify(oldFinalValue)}`);
			}
		}

		if (!dealChanged) continue;

		summary.dealsWithFinalValue++;

		if (!opts.apply) {
			console.log(`[migrate] [dry-run] would update deal ${deal.id} (${deal.investment_name})`);
			continue;
		}

		const { error: updateError } = await supabase
			.from('opportunities')
			.update({ review_field_state: nextState })
			.eq('id', deal.id);

		if (updateError) {
			console.error(`[migrate] update failed for deal ${deal.id}:`, updateError.message);
		} else {
			summary.dealsUpdated++;
			console.log(`[migrate] updated deal ${deal.id} (${deal.investment_name})`);
		}
	}

	console.log('\n[migrate] Summary:');
	console.log(`  Deals scanned:            ${summary.dealsScanned}`);
	console.log(`  Deals with finalValue:     ${summary.dealsWithFinalValue}`);
	console.log(`  Deals updated:             ${opts.apply ? summary.dealsUpdated : 'n/a (dry-run)'}`);
	console.log(`  Fields migrated:           ${summary.fieldsTotal}`);
	if (Object.keys(summary.fieldsByClassification).length) {
		for (const [cls, count] of Object.entries(summary.fieldsByClassification)) {
			console.log(`    ${cls}: ${count}`);
		}
	}
	console.log(`\n[migrate] ${opts.apply ? 'Done.' : 'Dry-run complete. Run with --apply to write changes.'}`);
}

main().catch((err) => {
	console.error('[migrate] fatal:', err);
	process.exit(1);
});
