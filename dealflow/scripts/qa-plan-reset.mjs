import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appRoot = path.resolve(__dirname, '..');
const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const envFilePath = process.env.ENV_FILE || path.join(appRoot, '.env.local');

function parseEnvFile(filePath) {
	const values = {};
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

const env = {
	...parseEnvFile(envFilePath),
	...process.env
};

const supabaseUrl = env.SUPABASE_URL;
const supabaseAnonKey = env.SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

assert.ok(supabaseUrl, 'SUPABASE_URL is required');
assert.ok(supabaseAnonKey, 'SUPABASE_ANON_KEY is required');
assert.ok(supabaseServiceRoleKey, 'SUPABASE_SERVICE_ROLE_KEY is required');

const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
	auth: { persistSession: false }
});
const anon = createClient(supabaseUrl, supabaseAnonKey, {
	auth: { persistSession: false }
});

function uniqueEmail() {
	return `codex-plan-reset-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
}

function isMissingTableError(error, tableName) {
	return String(error?.message || '').includes(`Could not find the table 'public.${tableName}'`);
}

async function expectJsonResponse(response, label) {
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

async function cleanupUserArtifacts(userId) {
	await admin.from('user_buy_box').delete().eq('user_id', userId);
	await admin.from('user_goals').delete().eq('user_id', userId);
	await admin.from('user_portfolio_plans').delete().eq('user_id', userId);
	await admin.from('user_profiles').delete().eq('id', userId);
}

async function run() {
	const email = uniqueEmail();
	const password = `CodexReset!${Date.now()}Aa1`;
	let userId = null;
	let planStorageAvailable = true;

	try {
		const { data: created, error: createError } = await admin.auth.admin.createUser({
			email,
			password,
			email_confirm: true,
			user_metadata: { full_name: 'Codex Reset QA' }
		});
		if (createError) throw createError;

		userId = created?.user?.id;
		assert.ok(userId, 'Expected admin.createUser() to return a user id');

		const profileUpsert = await admin.from('user_profiles').upsert({
			id: userId,
			email,
			full_name: 'Codex Reset QA',
			tier: 'investor',
			is_admin: false
		}, { onConflict: 'id' });
		if (profileUpsert.error) throw profileUpsert.error;

		const { data: signedIn, error: signInError } = await anon.auth.signInWithPassword({
			email,
			password
		});
		if (signInError) throw signInError;

		const token = signedIn?.session?.access_token;
		assert.ok(token, 'Expected sign-in to produce an access token');

		const buyBoxSeed = await admin.from('user_buy_box').upsert({
			user_id: userId,
			branch: 'cashflow',
			goal: 'Cash Flow (income now)',
			baseline_income: '12000',
			target_cashflow: '50000',
			asset_classes: ['Multi-Family'],
			strategies: ['Lending']
		}, { onConflict: 'user_id' });
		if (buyBoxSeed.error) throw buyBoxSeed.error;

		const goalsSeed = await admin.from('user_goals').upsert({
			user_id: userId,
			goal_type: 'passive_income',
			current_income: 12000,
			target_income: 50000,
			capital_available: 250000,
			timeline: '30days',
			tax_reduction: 0
		}, { onConflict: 'user_id' });
		if (goalsSeed.error) throw goalsSeed.error;

		const planSeed = await admin.from('user_portfolio_plans').upsert({
			user_id: userId,
			total_capital: 500000,
			check_size: 100000,
			target_annual_income: 50000,
			target_irr: null,
			target_tax_offset: null,
			buckets: [{ year: 1, assetClass: 'Multi Family', check: 100000, yield: 8 }],
			generated_from: 'wizard'
		}, { onConflict: 'user_id' });
		if (planSeed.error) {
			if (isMissingTableError(planSeed.error, 'user_portfolio_plans')) {
				planStorageAvailable = false;
			} else {
				throw planSeed.error;
			}
		}

		const headers = {
			Authorization: `Bearer ${token}`,
			'Content-Type': 'application/json'
		};

		await expectJsonResponse(await fetch(`${BASE_URL}/api/buybox`, {
			method: 'DELETE',
			headers,
			body: JSON.stringify({})
		}), 'DELETE /api/buybox');

		const { data: deletedBuyBox, error: deletedBuyBoxError } = await admin
			.from('user_buy_box')
			.select('user_id')
			.eq('user_id', userId)
			.maybeSingle();
		if (deletedBuyBoxError) throw deletedBuyBoxError;
		assert.equal(deletedBuyBox, null, 'Expected reset to delete the buy box row');

		const planResetPayload = await expectJsonResponse(await fetch(`${BASE_URL}/api/userdata`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				type: 'goals',
				data: {
					goal_type: '',
					current_income: null,
					target_income: null,
					capital_available: null,
					timeline: '',
					tax_reduction: null
				}
			})
		}), 'POST /api/userdata (goals reset)');

		await expectJsonResponse(await fetch(`${BASE_URL}/api/userdata`, {
			method: 'POST',
			headers,
			body: JSON.stringify({
				type: 'plan',
				data: {
					total_capital: 0,
					check_size: 100000,
					target_annual_income: null,
					target_irr: null,
					target_tax_offset: null,
					buckets: [],
					generated_from: 'wizard'
				}
			})
		}), 'POST /api/userdata (plan reset)');

		if (planResetPayload?.persisted === false) {
			planStorageAvailable = false;
		}

		const { data: goalsRow, error: goalsReadError } = await admin
			.from('user_goals')
			.select('goal_type, current_income, target_income, capital_available, timeline, tax_reduction')
			.eq('user_id', userId)
			.maybeSingle();
		if (goalsReadError) throw goalsReadError;
		assert.ok(goalsRow, 'Expected reset flow to preserve a user_goals row');
		assert.equal(goalsRow.goal_type, '');
		assert.equal(goalsRow.current_income, null);
		assert.equal(goalsRow.target_income, null);
		assert.equal(goalsRow.capital_available, null);
		assert.equal(goalsRow.timeline, '');
		assert.equal(goalsRow.tax_reduction, null);

		if (planStorageAvailable) {
			const { data: planRow, error: planReadError } = await admin
				.from('user_portfolio_plans')
				.select('total_capital, check_size, target_annual_income, target_irr, target_tax_offset, buckets, generated_from')
				.eq('user_id', userId)
				.maybeSingle();
			if (planReadError) throw planReadError;
			assert.ok(planRow, 'Expected reset flow to preserve a user_portfolio_plans row');
			assert.equal(planRow.total_capital, 0);
			assert.equal(planRow.check_size, 100000);
			assert.equal(planRow.target_annual_income, null);
			assert.equal(planRow.target_irr, null);
			assert.equal(planRow.target_tax_offset, null);
			assert.deepEqual(planRow.buckets || [], []);
			assert.equal(planRow.generated_from, 'wizard');
		}

		console.log(`Plan reset QA passed against ${BASE_URL}`);
	} finally {
		if (userId) {
			await cleanupUserArtifacts(userId).catch(() => {});
			await admin.auth.admin.deleteUser(userId).catch(() => {});
		}
	}
}

await run();
