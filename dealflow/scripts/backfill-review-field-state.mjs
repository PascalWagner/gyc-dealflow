import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { logReviewEvents } from '../api/_review-events.js';
import {
	DB_COLUMN_REVIEW_FIELD_MAP,
	REVIEW_FIELD_DB_COLUMN_MAP,
	normalizeReviewFieldStateMap
} from '../src/lib/utils/reviewFieldState.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const DEFAULT_ENV_FILE = fs.existsSync('/tmp/dealflow-sandbox.env')
	? '/tmp/dealflow-sandbox.env'
	: path.join(appRoot, '.env.local');

function parseArgs(argv = []) {
	const options = {
		apply: argv.includes('--apply'),
		dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
		dealId: '',
		envFile: process.env.ENV_FILE || DEFAULT_ENV_FILE,
		verbose: argv.includes('--verbose')
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--deal-id' && argv[index + 1]) options.dealId = argv[index + 1];
		if (arg === '--env-file' && argv[index + 1]) options.envFile = argv[index + 1];
	}

	return options;
}

function parseEnvFile(filePath) {
	const values = {};
	if (!fs.existsSync(filePath)) return values;
	const source = fs.readFileSync(filePath, 'utf8');
	for (const line of source.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const separatorIndex = trimmed.indexOf('=');
		if (separatorIndex === -1) continue;
		const key = trimmed.slice(0, separatorIndex).trim();
		let value = trimmed.slice(separatorIndex + 1).trim();
		if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
			value = value.slice(1, -1);
		}
		values[key] = value;
	}
	return values;
}

function assertEnv(label, value) {
	assert.ok(value, `${label} is required`);
}

function hasMeaningfulValue(value) {
	if (value === null || value === undefined) return false;
	if (typeof value === 'string') return value.trim().length > 0;
	if (Array.isArray(value)) return value.length > 0;
	if (typeof value === 'object') return Object.keys(value).length > 0;
	return true;
}

function buildBackfilledEntry(value, at) {
	return {
		aiValue: null,
		aiValuePresent: false,
		adminOverrideActive: true,
		adminOverrideValue: value,
		finalValue: value,
		finalValuePresent: true,
		lastWriter: 'system',
		lastAction: 'backfill_existing_value',
		aiUpdatedAt: '',
		adminEditedAt: at,
		lastUpdatedAt: at,
		adminActorEmail: '',
		adminActorName: '',
		aiSource: ''
	};
}

async function main() {
	const options = parseArgs(process.argv.slice(2));
	const env = {
		...parseEnvFile(options.envFile),
		...process.env
	};

	assertEnv('SUPABASE_URL', env.SUPABASE_URL);
	assertEnv('SUPABASE_SERVICE_ROLE_KEY', env.SUPABASE_SERVICE_ROLE_KEY);

	for (const [key, value] of Object.entries(env)) {
		if (value !== undefined) process.env[key] = value;
	}

	const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false }
	});

	let query = supabase
		.from('opportunities')
		.select('*')
		.order('created_at', { ascending: true });

	if (options.dealId) {
		query = query.eq('id', options.dealId);
	}

	const { data: deals, error: dealsError } = await query;
	if (dealsError) throw dealsError;

	const summary = {
		mode: options.apply ? 'apply' : 'dry-run',
		dealCount: deals.length,
		touchedDeals: 0,
		backfilledFields: 0,
		sampleDeals: []
	};

	for (const deal of deals) {
		const currentState = normalizeReviewFieldStateMap(deal.review_field_state || {});
		const nextState = { ...currentState };
		const now = new Date().toISOString();
		const backfilledFieldKeys = [];

		for (const [columnName, fieldKey] of Object.entries(DB_COLUMN_REVIEW_FIELD_MAP)) {
			if (Object.prototype.hasOwnProperty.call(nextState, fieldKey)) continue;
			if (!Object.prototype.hasOwnProperty.call(deal, columnName)) continue;

			const currentValue = deal[columnName];
			if (!hasMeaningfulValue(currentValue)) continue;

			nextState[fieldKey] = buildBackfilledEntry(currentValue, now);
			backfilledFieldKeys.push(fieldKey);
		}

		if (backfilledFieldKeys.length === 0) continue;

		summary.touchedDeals += 1;
		summary.backfilledFields += backfilledFieldKeys.length;
		const touchedDealSummary = {
			id: deal.id,
			investmentName: deal.investment_name || '',
			backfilledFieldCount: backfilledFieldKeys.length,
			backfilledFieldKeys
		};
		if (options.verbose || options.dealId) {
			summary.sampleDeals.push(touchedDealSummary);
		} else if (summary.sampleDeals.length < 20) {
			summary.sampleDeals.push(touchedDealSummary);
		}

		if (!options.apply) continue;

		const updates = {
			review_field_state: nextState,
			review_state_version: Number(deal.review_state_version || 0) + 1
		};
		if (Object.prototype.hasOwnProperty.call(deal, 'updated_at')) {
			updates.updated_at = now;
		}

		const { error: updateError } = await supabase
			.from('opportunities')
			.update(updates)
			.eq('id', deal.id);
		if (updateError) throw updateError;

		const eventRows = backfilledFieldKeys.map((fieldKey) => ({
			opportunity_id: deal.id,
			field_key: fieldKey,
			event_type: 'backfill_existing_value',
			actor_type: 'system',
			actor_email: '',
			actor_name: '',
			previous_value: null,
			next_value: deal[REVIEW_FIELD_DB_COLUMN_MAP[fieldKey]],
			metadata: {
				source: 'scripts/backfill-review-field-state.mjs',
				mode: 'protect_existing_value'
			}
		}));

		const eventError = await logReviewEvents(supabase, eventRows);
		if (eventError) throw eventError;
	}

	if (!options.verbose && !options.dealId) {
		summary.sampledDeals = summary.sampleDeals.length;
		summary.remainingTouchedDeals = Math.max(0, summary.touchedDeals - summary.sampleDeals.length);
	}

	console.log(JSON.stringify(summary, null, 2));
}

await main();
