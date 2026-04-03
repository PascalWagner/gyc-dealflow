import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { getGhlContactByEmail } from '../api/userdata/ghl.js';
import {
	buildCanonicalBuyBoxFromContact,
	buildCanonicalDealBackfill,
	buildCanonicalGoalsFromContact,
	hasMeaningfulValue
} from './lib/sandbox-canonical-state.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const DEFAULT_ENV_FILE = fs.existsSync('/tmp/dealflow-sandbox.env')
	? '/tmp/dealflow-sandbox.env'
	: path.join(appRoot, '.env.local');
const DEFAULT_BASE_URL = 'https://sandbox.growyourcashflow.io';
const DEFAULT_EMAIL = 'info@pascalwagner.com';
const DEFAULT_DEAL_ID = '6706f492-1db4-4925-b562-9c5336217337';

function parseArgs(argv = []) {
	const options = {
		apply: argv.includes('--apply'),
		dryRun: argv.includes('--dry-run') || !argv.includes('--apply'),
		email: process.env.SANDBOX_CANONICAL_EMAIL || DEFAULT_EMAIL,
		dealId: process.env.SANDBOX_CANONICAL_DEAL_ID || DEFAULT_DEAL_ID,
		baseUrl: process.env.BASE_URL || DEFAULT_BASE_URL,
		envFile: process.env.ENV_FILE || DEFAULT_ENV_FILE
	};

	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (arg === '--email' && argv[index + 1]) options.email = argv[index + 1];
		if (arg === '--deal-id' && argv[index + 1]) options.dealId = argv[index + 1];
		if (arg === '--base-url' && argv[index + 1]) options.baseUrl = argv[index + 1];
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

async function expectJson(response, label) {
	const text = await response.text();
	let payload = null;
	try {
		payload = text ? JSON.parse(text) : null;
	} catch {
		payload = text;
	}
	assert.equal(response.ok, true, `${label} failed with ${response.status}: ${JSON.stringify(payload)}`);
	return payload;
}

async function getSessionToken(baseUrl, email) {
	const response = await fetch(`${baseUrl}/api/auth`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			action: 'magic-link',
			email,
			siteUrl: baseUrl
		})
	});
	const payload = await response.json().catch(() => ({}));
	assert.equal(response.ok, true, `Auth failed: ${JSON.stringify(payload)}`);
	assert.ok(payload.token, 'Auth token missing from sandbox auth response');
	return payload;
}

async function backfillUserState({ baseUrl, email, apply }) {
	const ghlContact = await getGhlContactByEmail(email, { hydrateFields: true });
	assert.ok(ghlContact, `No GHL contact found for ${email}`);

	const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
		auth: { persistSession: false }
	});
	const { data: profileRecord, error: profileLookupError } = await admin
		.from('user_profiles')
		.select('*')
		.ilike('email', email)
		.maybeSingle();
	if (profileLookupError) throw profileLookupError;
	assert.ok(profileRecord?.id, `No user_profiles row found for ${email}`);

	const auth = await getSessionToken(baseUrl, email);

	const profilePayload = {
		full_name: profileRecord.full_name || auth?.fullName || auth?.name || email,
		phone: profileRecord.phone || '',
		location: profileRecord.location || '',
		accredited_status: 'Select status',
		investable_capital: '$250K - $1M',
		investment_experience: '4-10 LP investments'
	};
	const avatarUrl = (auth?.avatar_url || profileRecord.avatar_url || '').trim();
	if (avatarUrl) {
		profilePayload.avatar_url = avatarUrl;
	}

	if (apply) {
		const profileResponse = await fetch(`${baseUrl}/api/userdata`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${auth.token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ type: 'profile', data: profilePayload })
		});
		await expectJson(profileResponse, 'POST /api/userdata (profile)');
	}

	const goals = buildCanonicalGoalsFromContact(ghlContact);
	if (apply && goals) {
		const goalsResponse = await fetch(`${baseUrl}/api/userdata`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${auth.token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({ type: 'goals', data: goals })
		});
		await expectJson(goalsResponse, 'POST /api/userdata (goals)');
	}

	const buyBox = buildCanonicalBuyBoxFromContact(ghlContact);
	if (apply && hasMeaningfulValue(buyBox)) {
		const buyBoxResponse = await fetch(`${baseUrl}/api/buybox`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${auth.token}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				wizardData: {
					...buyBox,
					_markComplete: Boolean(buyBox._completedAt)
				}
			})
		});
		await expectJson(buyBoxResponse, 'POST /api/buybox');
	}

	return {
		auth,
		goals,
		buyBox,
		profileRecord
	};
}

async function backfillDealState({ baseUrl, dealId, token, apply }) {
	const headers = {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json'
	};

	const dealResponse = await fetch(`${baseUrl}/api/deals/${encodeURIComponent(dealId)}`, {
		headers
	});
	const dealPayload = await dealResponse.json().catch(() => ({}));
	assert.equal(dealResponse.ok, true, `GET /api/deals/${dealId} failed: ${JSON.stringify(dealPayload)}`);
	const deal = dealPayload?.deal || dealPayload;
	assert.ok(deal, 'Expected deal payload');
	const normalizedDeal = buildCanonicalDealBackfill(deal);

	let cleanupStatus = null;
	let cleanupPayload = null;
	if (apply) {
		const cleanupResponse = await fetch(`${baseUrl}/api/deal-cleanup`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				action: 'review-field-evidence',
				dealId,
				persist: true
			})
		});
		cleanupStatus = cleanupResponse.status;
		cleanupPayload = await cleanupResponse.json().catch(() => ({}));
	}

	return {
		normalizedDeal,
		cleanupStatus,
		cleanupPayload
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
		if (value !== undefined) {
			process.env[key] = value;
		}
	}

	const summary = {
		mode: options.apply ? 'apply' : 'dry-run',
		email: options.email,
		dealId: options.dealId
	};

	const userState = await backfillUserState({
		baseUrl: options.baseUrl,
		email: options.email,
		apply: options.apply
	});

	const dealState = await backfillDealState({
		baseUrl: options.baseUrl,
		dealId: options.dealId,
		token: userState.auth?.token || '',
		apply: options.apply
	});

	summary.userGoals = userState.goals;
	summary.userBuyBox = userState.buyBox;
	summary.dealLifecycleStatus = dealState.normalizedDeal?.lifecycleStatus || null;
	summary.dealLegacyApprovedReviewCompat = dealState.normalizedDeal?.legacyApprovedReviewCompat || false;
	summary.dealCleanupStatus = dealState.cleanupStatus;

	console.log(JSON.stringify(summary, null, 2));
}

await main();
