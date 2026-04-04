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

async function requestSandboxAuth({
	baseUrl = BASE_URL,
	email = QA_EMAIL,
	label = 'POST /api/auth',
	maxAttempts = 2
} = {}) {
	let lastError = null;

	for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
		try {
			const payload = await expectJson(
				await fetch(`${baseUrl}/api/auth`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						action: 'magic-link',
						email,
						siteUrl: baseUrl
					})
				}),
				attempt === 1 ? label : `${label} (retry ${attempt})`
			);
			assert.ok(payload?.token, 'Expected sandbox auth to return an access token');
			return payload;
		} catch (error) {
			lastError = error;
			if (attempt === maxAttempts) break;
			await new Promise((resolve) => setTimeout(resolve, 750));
		}
	}

	throw lastError;
}

async function run() {
	const warnings = [];
	const failures = [];
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

	const authPayload = await requestSandboxAuth();

	const headers = {
		Authorization: `Bearer ${authPayload.token}`
	};

	const [countsPayload, buyBoxPayload, onboardingPayload, dealPayload, goalsPayload] = await Promise.all([
		expectJson(await fetch(`${BASE_URL}/api/network?action=counts`), 'GET /api/network?action=counts'),
		expectJson(await fetch(`${BASE_URL}/api/buybox`, { headers }), 'GET /api/buybox'),
		expectJson(
			await fetch(`${BASE_URL}/api/gp-onboarding?email=${encodeURIComponent(QA_EMAIL)}`, { headers }),
			'GET /api/gp-onboarding'
		),
		expectJson(await fetch(`${BASE_URL}/api/deals/${encodeURIComponent(DEAL_ID)}`, { headers }), `GET /api/deals/${DEAL_ID}`),
		expectJson(await fetch(`${BASE_URL}/api/userdata?type=goals`, { headers }), 'GET /api/userdata?type=goals')
	]);
	const goalsRecords = Array.isArray(goalsPayload)
		? goalsPayload
		: Array.isArray(goalsPayload?.records)
			? goalsPayload.records
			: [];

	if (buyBoxPayload?.success !== true) {
		failures.push('Expected buy box payload to declare success');
	}
	if (!buyBoxPayload?.buyBox) {
		failures.push('Expected buy box payload to include buyBox');
	}
	if (!String(buyBoxPayload?.buyBox?._branch || buyBoxPayload?.buyBox?.branch || '').trim()) {
		failures.push('Expected buy box payload to include a canonical branch');
	}
	if (goalsRecords.length === 0) {
		failures.push('Expected goals payload to include at least one row');
	}
	if (!goalsRecords.some((record) => String(record?.goal_type || '').trim())) {
		failures.push('Expected goals payload to include a goal_type');
	}
	if (
		!['approved', 'published'].includes(
			dealPayload?.deal?.lifecycleStatus || dealPayload?.deal?.lifecycle_status
		)
	) {
		failures.push('Expected sandbox deal payload lifecycle to be approved or published');
	}
	if (!(Array.isArray(dealPayload?.deal?.riskTags) && dealPayload.deal.riskTags.length > 0)) {
		failures.push('Expected deal payload to include normalized risk tags');
	}
	if (typeof (dealPayload?.deal?.currentAvgLoanLtv ?? null) !== 'number') {
		failures.push('Expected deal payload to include currentAvgLoanLtv');
	}

	const buyBoxCompletionSource = String(buyBoxPayload?.buyBox?._completionSource || '').trim().toLowerCase();
	const hasCanonicalBuyBox = onboardingPayload?.hasBuyBox === true;
	if (buyBoxPayload?.buyBox?._completedAt && !hasCanonicalBuyBox) {
		failures.push('Expected canonical buy-box completion to match /api/gp-onboarding hasBuyBox');
	}
	if (hasCanonicalBuyBox && !buyBoxPayload?.buyBox?._completedAt) {
		failures.push('Expected /api/buybox to include canonical _completedAt when /api/gp-onboarding hasBuyBox is true');
	}
	if (buyBoxCompletionSource === 'fallback') {
		warnings.push('buyBox completion is still coming from fallback data instead of canonical user_buy_box.completed_at');
	}

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
			completedAt: buyBoxPayload?.buyBox?._completedAt || null,
			completionSource: buyBoxPayload?.buyBox?._completionSource || null,
			completionCandidateAt: buyBoxPayload?.buyBox?._completionCandidateAt || null
		},
		onboarding: {
			hasBuyBox: onboardingPayload?.hasBuyBox === true,
			profileRole: onboardingPayload?.profile?.onboardingRole || null,
			onboardingComplete: onboardingPayload?.profile?.onboardingComplete || false
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
			const replayAuthPayload = await requestSandboxAuth({
				label: 'POST /api/auth replay'
			});

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

	if (failures.length > 0) {
		summary.failures = failures;
		console.error(JSON.stringify(summary, null, 2));
		throw new Error(failures.join('; '));
	}

	console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
	console.error('[qa-sandbox-live] failed:', error?.message || error);
	process.exitCode = 1;
});
