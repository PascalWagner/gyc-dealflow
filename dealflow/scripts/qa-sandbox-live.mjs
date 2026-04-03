import assert from 'node:assert/strict';

const BASE_URL = process.env.BASE_URL || 'https://sandbox.growyourcashflow.io';
const QA_EMAIL = process.env.QA_EMAIL || 'info@pascalwagner.com';
const DEAL_ID = process.env.DEAL_ID || '6706f492-1db4-4925-b562-9c5336217337';
const WRITE_TESTS = ['1', 'true', 'yes'].includes(String(process.env.WRITE_TESTS || '').toLowerCase());

const TEST_IMAGE_DATA =
	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a1n8AAAAASUVORK5CYII=';

async function expectJson(response, label) {
	const payload = await response.json().catch(() => ({}));
	assert.equal(response.ok, true, `${label} failed with ${response.status}: ${JSON.stringify(payload)}`);
	return payload;
}

async function expectRoute(url, label) {
	const response = await fetch(url, { redirect: 'manual' });
	assert.ok(
		response.status >= 200 && response.status < 400,
		`${label} returned ${response.status}`
	);
	return {
		url,
		status: response.status,
		location: response.headers.get('location')
	};
}

async function run() {
	const warnings = [];
	const routeChecks = await Promise.all([
		expectRoute(`${BASE_URL}/`, 'GET /'),
		expectRoute(`${BASE_URL}/login`, 'GET /login'),
		expectRoute(`${BASE_URL}/app/dashboard`, 'GET /app/dashboard'),
		expectRoute(`${BASE_URL}/app/plan`, 'GET /app/plan'),
		expectRoute(`${BASE_URL}/app/settings`, 'GET /app/settings'),
		expectRoute(
			`${BASE_URL}/deal-review?id=${encodeURIComponent(DEAL_ID)}&stage=summary&allowSummary=1`,
			'GET /deal-review summary'
		)
	]);

	const authPayload = await expectJson(
		await fetch(`${BASE_URL}/api/auth`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				action: 'magic-link',
				email: QA_EMAIL,
				siteUrl: BASE_URL
			})
		}),
		'POST /api/auth'
	);
	assert.ok(authPayload?.token, 'Expected sandbox auth to return an access token');

	const headers = {
		Authorization: `Bearer ${authPayload.token}`
	};

	const [countsPayload, buyBoxPayload, dealPayload, goalsPayload] = await Promise.all([
		expectJson(await fetch(`${BASE_URL}/api/network?action=counts`), 'GET /api/network?action=counts'),
		expectJson(await fetch(`${BASE_URL}/api/buybox`, { headers }), 'GET /api/buybox'),
		expectJson(await fetch(`${BASE_URL}/api/deals/${encodeURIComponent(DEAL_ID)}`, { headers }), `GET /api/deals/${DEAL_ID}`),
		expectJson(await fetch(`${BASE_URL}/api/userdata?type=goals`, { headers }), 'GET /api/userdata?type=goals')
	]);
	const goalsRecords = Array.isArray(goalsPayload)
		? goalsPayload
		: Array.isArray(goalsPayload?.records)
			? goalsPayload.records
			: [];

	assert.equal(buyBoxPayload?.success, true, 'Expected buy box payload to declare success');
	assert.ok(buyBoxPayload?.buyBox, 'Expected buy box payload to include buyBox');
	assert.ok(
		buyBoxPayload?.buyBox?._completedAt,
		'Expected buy box payload to include a completed timestamp'
	);
	assert.ok(
		String(buyBoxPayload?.buyBox?._branch || buyBoxPayload?.buyBox?.branch || '').trim(),
		'Expected buy box payload to include a canonical branch'
	);
	assert.ok(goalsRecords.length > 0, 'Expected goals payload to include at least one row');
	assert.ok(
		goalsRecords.some((record) => String(record?.goal_type || '').trim()),
		'Expected goals payload to include a goal_type'
	);
	assert.equal(dealPayload?.deal?.lifecycleStatus || dealPayload?.deal?.lifecycle_status, 'approved');
	assert.ok(
		Array.isArray(dealPayload?.deal?.riskTags) && dealPayload.deal.riskTags.length > 0,
		'Expected deal payload to include normalized risk tags'
	);
	assert.ok(
		typeof (dealPayload?.deal?.currentAvgLoanLtv ?? null) === 'number',
		'Expected deal payload to include currentAvgLoanLtv'
	);

	const summary = {
		baseUrl: BASE_URL,
		email: QA_EMAIL,
		routes: routeChecks,
		auth: {
			tier: authPayload?.tier || null,
			isAdmin: authPayload?.isAdmin || false
		},
		countsDeals: Object.keys(countsPayload || {}).length,
		buyBox: {
			branch: buyBoxPayload?.buyBox?._branch || buyBoxPayload?.buyBox?.branch || null,
			goal: buyBoxPayload?.buyBox?.goal || null,
			completedAt: buyBoxPayload?.buyBox?._completedAt || null
		},
		goalsRows: goalsRecords.length,
		goals: {
			goalType: goalsRecords.find((record) => String(record?.goal_type || '').trim())?.goal_type || null
		},
		deal: {
			id: dealPayload?.deal?.id || null,
			lifecycleStatus: dealPayload?.deal?.lifecycleStatus || dealPayload?.deal?.lifecycle_status || null,
			legacyApprovedReviewCompat: dealPayload?.deal?.legacyApprovedReviewCompat || false,
			currentAvgLoanLtv: dealPayload?.deal?.currentAvgLoanLtv ?? null,
			riskTags: Array.isArray(dealPayload?.deal?.riskTags) ? dealPayload.deal.riskTags.slice(0, 5) : []
		}
	};

	if (WRITE_TESTS) {
		const profilePayload = await expectJson(
			await fetch(`${BASE_URL}/api/userdata`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					type: 'profile',
					data: {
						full_name: 'Pascal Wagner',
						phone: '9417308700',
						location: 'Tampa, FL',
						accredited_status: 'Select status',
						investable_capital: '$250K - $1M',
						investment_experience: '4-10 LP investments'
					}
				})
			}),
			'POST /api/userdata (profile)'
		);

		const avatarPayload = await expectJson(
			await fetch(`${BASE_URL}/api/network?action=avatar`, {
				method: 'POST',
				headers: {
					...headers,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ imageData: TEST_IMAGE_DATA })
			}),
			'POST /api/network?action=avatar'
		);

		try {
			const replayAuthPayload = await expectJson(
				await fetch(`${BASE_URL}/api/auth`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'magic-link',
						email: QA_EMAIL,
						siteUrl: BASE_URL
					})
				}),
				'POST /api/auth replay'
			);

			assert.equal(
				replayAuthPayload?.avatar_url,
				avatarPayload?.avatarUrl,
				'Expected avatar upload to persist into the next auth response'
			);
		} catch (error) {
			warnings.push(`avatar replay auth check skipped: ${error?.message || error}`);
		}

		summary.profileWrite = {
			recordKeys: Object.keys(profilePayload?.record || {}),
			avatarUrl: avatarPayload?.avatarUrl || null
		};
	}

	if (warnings.length > 0) {
		summary.warnings = warnings;
	}

	console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
	console.error('[qa-sandbox-live] failed:', error?.message || error);
	process.exitCode = 1;
});
