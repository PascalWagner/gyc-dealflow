import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { makeSessionUser as _makeSessionUser } from '../tests/fixtures/session.mjs';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const USER_EMAIL = 'member@example.com';
const STRICT_PLANNED_ONBOARDING = process.env.STRICT_PLANNED_ONBOARDING === '1';

function makeSessionUser(email = USER_EMAIL) {
	return _makeSessionUser(email, {
		name: 'Plan Tester',
		fullName: 'Plan Tester',
		tier: 'member',
		accessTier: 'member',
		isAdmin: false
	});
}

// Fixture validation: ensure the session user has tosVersion so the plan wizard
// skips the 'Before we continue' TOS gate without a workaround.
// If this assertion fails, update tests/fixtures/session.mjs to include tosVersion.
assert.ok(
	makeSessionUser().tosVersion,
	'Fixture validation: session user must have tosVersion set (see tests/fixtures/session.mjs)'
);

const completedAt = '2026-04-02T12:00:00.000Z';

const branchFixtures = {
	cashflow: {
		wizardData: {
			_branch: 'cashflow',
			branch: 'cashflow',
			goal: 'Cash Flow (income now)',
			dealExperience: 7,
			lpDealsCount: 7,
			reProfessional: 'no',
			baselineIncome: '12000',
			assetClasses: ['Multi-Family', 'Self Storage'],
			strategies: ['Lending', 'Buy & Hold'],
			dealTypes: ['Lending', 'Buy & Hold'],
			checkSize: '99000',
			accreditation: ['net_worth', 'income'],
			targetCashFlow: '50000',
			targetIncome: '50000',
			netWorth: '2500000',
			capital12mo: '$250k-$499k',
			triggerEvent: 'savings',
			capitalReadiness: '30days',
			diversificationPref: 'balanced',
			operatorFocus: 'both',
			lockup: '3',
			distributions: 'Quarterly',
			sharePortfolio: true,
			_completedAt: completedAt
		},
		goalTitle: 'Where are you starting from?',
		reviewGoalTitle: 'How much passive income do you want in 12 months?',
		goalStagePattern: /stage=starting-point/,
		financeTitle: 'What is the max check size you are realistically open to for one deal?',
		preferencesTitle: 'Which asset classes should we prioritize in your deal flow?',
		expectedGoalInputValue: '12000',
		expectedFinanceSelection: '$50K-$99K',
		expectedPreferenceSelection: 'Multi-Family'
	},
	growth: {
		wizardData: {
			_branch: 'growth',
			branch: 'growth',
			goal: 'Equity Growth (wealth later)',
			dealExperience: 11,
			lpDealsCount: 11,
			reProfessional: 'no',
			baselineIncome: '18000',
			assetClasses: ['Multi-Family', 'Industrial'],
			strategies: ['Value-Add', 'Development'],
			dealTypes: ['Value-Add', 'Development'],
			checkSize: '249000',
			accreditation: ['net_worth'],
			growthCapital: '1000000',
			targetGrowth: '1000000',
			growthPriority: 'balanced',
			netWorth: '3200000',
			capital12mo: '$500k-$999k',
			triggerEvent: 'business_exit',
			capitalReadiness: 'now',
			diversificationPref: 'wide',
			operatorFocus: 'specialist',
			lockup: '5',
			distributions: 'Annual',
			sharePortfolio: true,
			_completedAt: completedAt
		},
		goalTitle: "What's your portfolio growth target?",
		reviewGoalTitle: "What's your portfolio growth target?",
		goalStagePattern: /stage=growth-target/,
		financeTitle: 'What is the max check size you are realistically open to for one deal?',
		preferencesTitle: 'Which asset classes should we prioritize in your deal flow?',
		expectedGoalInputValue: '1000000',
		expectedFinanceSelection: '$100K-$249K',
		expectedPreferenceSelection: 'Multi-Family'
	},
	tax: {
		wizardData: {
			_branch: 'tax',
			branch: 'tax',
			goal: 'Tax Optimization (tax shield now)',
			dealExperience: 4,
			lpDealsCount: 4,
			reProfessional: 'yes',
			baselineIncome: '30000',
			assetClasses: ['Multi-Family', 'Oil & Gas / Energy'],
			strategies: ['Value-Add', 'Development'],
			dealTypes: ['Value-Add', 'Development'],
			checkSize: '250000',
			accreditation: ['income', 'licensed'],
			taxableIncome: '250000',
			targetTaxSavings: '250000',
			taxableIncomeBaseline: '900000',
			netWorth: '4100000',
			capital12mo: '$100k-$249k',
			triggerEvent: 'w2_income',
			capitalReadiness: '90days',
			diversificationPref: 'focused',
			operatorFocus: 'diversified',
			lockup: '3',
			distributions: 'Quarterly',
			sharePortfolio: true,
			_completedAt: completedAt
		},
		goalTitle: 'How much income do you want to shelter?',
		reviewGoalTitle: 'How much income do you want to shelter?',
		goalStagePattern: /stage=tax-target/,
		financeTitle: 'What is the max check size you are realistically open to for one deal?',
		preferencesTitle: 'Which asset classes should we prioritize in your deal flow?',
		expectedGoalInputValue: '250000',
		expectedFinanceSelection: '$250K+',
		expectedPreferenceSelection: 'Multi-Family'
	}
};

const partialProgressFixture = {
	_branch: 'cashflow',
	branch: 'cashflow',
	goal: 'Cash Flow (income now)',
	dealExperience: 2,
	lpDealsCount: 2,
	baselineIncome: '5000',
	assetClasses: ['Multi-Family'],
	strategies: ['Lending'],
	dealTypes: ['Lending'],
	targetCashFlow: '24000'
};

const zeroBaselineFixture = {
	_branch: 'cashflow',
	branch: 'cashflow',
	goal: 'Cash Flow (income now)',
	dealExperience: 1,
	lpDealsCount: 1,
	baselineIncome: '0'
};

async function installApiMocks(page, fixture) {
	const requestFailures = [];
	const consoleErrors = [];
	const pageErrors = [];
	let currentBuyBox = structuredClone(fixture);
	let currentPlanRecord = null;
	let currentGoalsRecord = null;

	page.on('requestfailed', (request) => {
		const failureText = request.failure()?.errorText || 'failed';
		if (
			failureText === 'net::ERR_ABORTED' &&
			(request.url().includes('/api/userdata') || request.url().includes('/api/buybox'))
		) {
			return;
		}
		if (request.url().startsWith('https://fonts.googleapis.com/') || request.url().startsWith('https://fonts.gstatic.com/')) {
			return;
		}
		// Ignore third-party analytics/monitoring endpoints aborted on page unload
		if (
			request.url().includes('sentry.io') ||
			request.url().includes('posthog.com') ||
			request.url().includes('i.posthog.com')
		) {
			return;
		}
		requestFailures.push(`${request.method()} ${request.url()} :: ${failureText}`);
	});
	page.on('pageerror', (error) => {
		pageErrors.push(String(error));
	});
	page.on('console', (message) => {
		if (message.type() === 'error') consoleErrors.push(message.text());
	});

	await page.route('**/api/buybox**', async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, buyBox: currentBuyBox })
			});
			return;
		}

		if (route.request().method() === 'DELETE') {
			currentBuyBox = {};
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ success: true, deleted: true })
			});
			return;
		}

		const body = JSON.parse(route.request().postData() || '{}');
		currentBuyBox = structuredClone(body?.wizardData || currentBuyBox);

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true })
		});
	});

	await page.route('**/api/userdata**', async (route) => {
		const url = new URL(route.request().url());
		if (route.request().method() === 'POST') {
			const body = JSON.parse(route.request().postData() || '{}');
			if (body?.type === 'plan') currentPlanRecord = structuredClone(body?.data || null);
			if (body?.type === 'goals') currentGoalsRecord = structuredClone(body?.data || null);
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, record: {} })
			});
			return;
		}

		const type = url.searchParams.get('type');
		if (type) {
			const records = type === 'plan'
				? (currentPlanRecord ? [currentPlanRecord] : [])
				: type === 'goals'
					? (currentGoalsRecord ? [currentGoalsRecord] : [])
					: [];
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					records,
					count: records.length,
					type
				})
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				portfolio: [],
				stages: [],
				goals: [],
				taxdocs: [],
				plan: []
			})
		});
	});

	await page.route('**/api/gp-onboarding**', async (route) => {
		if (route.request().method() === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					profile: null,
					company: null,
					teamContacts: [],
					dealCount: 0,
					hasBuyBox: false,
					agreementStatus: {
						hasAgreement: false,
						hasCurrentAgreement: false,
						agreement: null
					}
				})
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true })
		});
	});

	await page.route('**/api/lp-network-stats**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				totalLPs: 1240,
				accreditedCount: 780,
				activeInvestors: 192,
				goalDistribution: { income: 58, tax: 24, growth: 18 },
				topAssetClasses: [
					{ name: 'Multi-Family', count: 42 },
					{ name: 'Private Debt / Credit', count: 28 },
					{ name: 'Self Storage', count: 19 }
				],
				capitalRanges: {
					'Under $50K': 14,
					'$50K–$100K': 24,
					'$100K–$250K': 36,
					'$250K–$500K': 21,
					'$500K+': 10
				},
				totalSaved: 91,
				totalVetting: 44,
				completedBuyBoxes: 203,
				totalCapitalReady: 18500000
			})
		});
	});

	await page.route('**/api/deals**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				deals: [
					{ id: 'deal-1', investmentName: 'Mock Deal', assetClass: 'Multi-Family', targetIRR: 0.16 }
				]
			})
		});
	});

	await page.route('**/api/member/deals**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				deals: [
					{ id: 'deal-1', investmentName: 'Mock Deal', assetClass: 'Multi-Family', targetIRR: 0.16 }
				],
				total: 1,
				hasMore: false
			})
		});
	});

	await page.route('**/api/plan-market-snapshot**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				rows: [],
				total: 0,
				newThisMonth: 0
			})
		});
	});

	await page.route('**/api/network**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});

	return { consoleErrors, pageErrors, requestFailures };
}

async function seedSession(page) {
	await page.addInitScript(({ sessionUser }) => {
		localStorage.clear();
		localStorage.setItem('gycUser', JSON.stringify(sessionUser));
	}, { sessionUser: makeSessionUser() });
}

async function expectSummaryView(page) {
	await page.waitForURL(/\/app\/plan(?:\?.*)?$/);
	await page.waitForFunction(() => (
		Boolean(
			document.querySelector('.plan-target-card') ||
			document.querySelector('[data-testid="plan-summary-edit"]') ||
			document.querySelector('.roadmap-card')
		)
	));
	assert.equal(await page.locator('.ob-phase-node').count(), 0, 'summary page should not render onboarding phase pills');
}

async function expectWizardShell(page, { clickablePills = true } = {}) {
	await page.waitForSelector('.plan-setup-card');
	assert.equal(
		await page.locator('.plan-setup-card .wizard-card.ob-surface').count(),
		0,
		'wizard should not render an inner surfaced card'
	);

	const phaseMeta = await page.locator('.ob-phase-node').evaluateAll((nodes) =>
		nodes.map((node) => ({
			tag: node.tagName,
			text: node.textContent?.trim() || ''
		}))
	);

	assert.equal(phaseMeta.length, 5, 'wizard should render five onboarding pills');
	if (clickablePills === true) {
		assert.deepEqual(
			phaseMeta.map((item) => item.tag),
			['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON', 'BUTTON'],
			'returning-user wizard pills should render as buttons'
		);
	}
	if (clickablePills === false) {
		assert.deepEqual(
			phaseMeta.map((item) => item.tag),
			['DIV', 'DIV', 'DIV', 'DIV', 'DIV'],
			'fresh-flow wizard pills should remain static until the plan exists'
		);
	}
}

function selectedCards(page, selector) {
	return page.locator(`${selector}.selected, ${selector}.is-selected`);
}

async function runBranchScenario(browser, branch, config) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, config.wizardData);
	await seedSession(page);

	await page.goto(`${BASE_URL}/app/plan`);
	await expectSummaryView(page);

	await page.goto(`${BASE_URL}/app/plan?stage=accreditation&edit=1&branch=${branch}&flow=free`);
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page);
	await assertTitle(page, 'Are you an accredited investor?');
	assert.equal(
		await selectedCards(page, '.option-card').count(),
		config.wizardData.accreditation.length,
		`${branch}: saved accreditation answers should prefill`
	);

	await page.locator('.ob-phase-node').nth(1).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, config.goalTitle);
	assert.match(page.url(), config.goalStagePattern, `${branch}: Goal pill should update the stage query`);
	if (config.expectedGoalInputValue) {
		await page.waitForSelector('.money-input');
		const inputValue = await page.locator('.money-input').inputValue();
		assert.equal(inputValue, config.expectedGoalInputValue, `${branch}: goal input should prefill`);
	}

	await page.locator('.ob-phase-node').nth(2).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, config.financeTitle);
	if (config.expectedFinanceSelection) {
		const selectedText = ((await selectedCards(page, '.option-card').first().textContent()) || '').replace(/\s+/g, ' ').trim();
		assert(selectedText.includes(config.expectedFinanceSelection), `${branch}: finances selection should prefill`);
	}

	await page.locator('.ob-phase-node').nth(3).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, config.preferencesTitle);
	const preferenceText = ((await selectedCards(page, '.choice-card').first().textContent()) || '').replace(/\s+/g, ' ').trim();
	assert(preferenceText.includes(config.expectedPreferenceSelection), `${branch}: preferences selection should prefill`);

	await page.locator('.ob-phase-node').nth(0).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'Are you an accredited investor?');
	assert.equal(
		await selectedCards(page, '.option-card').count(),
		config.wizardData.accreditation.length,
		`${branch}: You pill should land on accreditation with saved answers`
	);

	await page.locator('.ob-phase-node').nth(4).click();
	await page.waitForLoadState('networkidle');
	await expectSummaryView(page);

	assert.deepEqual(errors.consoleErrors, [], `${branch}: console errors`);
	assert.deepEqual(errors.pageErrors, [], `${branch}: page errors`);
	assert.deepEqual(errors.requestFailures, [], `${branch}: request failures`);

	await context.close();
}

async function runPartialProgressScenario(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, partialProgressFixture);
	await seedSession(page);

	await page.goto(`${BASE_URL}/app/plan`);
	await page.waitForLoadState('networkidle');
	await expectSummaryView(page);

	const editButton = page.getByRole('button', { name: 'Edit' }).first();
	await editButton.click();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page);
	await assertTitle(page, 'Your Investment Profile');
	assert.match(page.url(), /stage=profile-review/, 'partial progress: Edit should route to profile review');

	assert.deepEqual(errors.consoleErrors, [], 'partial progress: console errors');
	assert.deepEqual(errors.pageErrors, [], 'partial progress: page errors');
	assert.deepEqual(errors.requestFailures, [], 'partial progress: request failures');

	await context.close();
}

async function runOnboardingEntryScenario(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, {});
	await seedSession(page);

	await page.goto(`${BASE_URL}/onboarding`);
	await page.waitForLoadState('networkidle');
	await page.waitForSelector('.onboarding-card');
	await expectActiveStepTitle(page, 'What should we call you?');
	assert.equal(await page.locator('.lp-network-optin').count(), 0, 'entry flow: LP network checkbox should not live on the name screen');

	await page.locator('#first-name').fill('Plan');
	await page.locator('#last-name').fill('Tester');
	await clickActiveContinue(page);
	// TOS gate is bypassed because the fixture user has tosVersion set (see session.mjs)
	await expectActiveStepTitle(page, 'What best describes you right now?');

	await page.getByRole('button', { name: "I'm an investor (LP)" }).click();
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, "What's your primary investing goal right now?");

	await page.locator('.step.active .goal-card').first().click();
	await expectActiveStepTitle(page, 'Are you an accredited investor?');

	await page.getByRole('button', { name: 'Net worth over $1M' }).click();
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, 'How many passive investments have you made?');

	await page.locator('.deal-count-input').fill('3');
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, 'Do you or your spouse qualify as a Real Estate Professional for tax purposes?');

	await page.getByRole('button', { name: "I'm not sure" }).click();
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, 'Which asset classes should we prioritize in your deal flow?');

	await page.getByRole('button', { name: 'Private Debt / Credit' }).click();
	await page.getByRole('button', { name: 'Multi-Family' }).click();
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, 'Which deal strategies are you open to?');

	await page.getByRole('button', { name: 'Buy & Hold' }).click();
	await page.getByRole('button', { name: 'Value-Add' }).click();
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, 'What is the max check size you are realistically open to for one deal?');

	await page.getByRole('button', { name: '$50K - $99K' }).click();
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, 'Do you want visibility into which other LPs are in a deal?');

	await page.getByRole('button', { name: 'Yes, show me the LP network' }).click();
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, 'Add a profile photo?');

	await page.getByRole('button', { name: 'Skip for Now' }).click();
	await expectActiveStepTitle(page, 'Your deal flow is personalized.');

	await page.getByRole('button', { name: 'Build My Investment Plan' }).click();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page, { clickablePills: null });
	await assertTitle(page, 'Where are you starting from?');
	assert.match(page.url(), /stage=starting-point&flow=paid_cashflow&branch=cashflow/, 'entry flow: member CTA should continue into the plan builder');

	assert.deepEqual(errors.consoleErrors, [], 'entry flow: console errors');
	assert.deepEqual(errors.pageErrors, [], 'entry flow: page errors');
	assert.deepEqual(errors.requestFailures, [], 'entry flow: request failures');

	await context.close();
}

async function runPlannedOnboardingContractScenario(browser) {
	if (!STRICT_PLANNED_ONBOARDING) return;

	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, {});
	await seedSession(page);

	await page.goto(`${BASE_URL}/onboarding`);
	await page.waitForLoadState('networkidle');
	await page.waitForSelector('.onboarding-card');

	await expectActiveStepTitle(page, 'What should we call you?');
	assert.equal(await page.locator('.lp-network-optin').count(), 0, 'planned entry flow: LP network checkbox should not live on the name screen');

	await page.locator('#first-name').fill('Plan');
	await page.locator('#last-name').fill('Tester');
	await clickActiveContinue(page);
	// TOS gate is bypassed because the fixture user has tosVersion set (see session.mjs)
	await expectActiveStepTitle(page, 'What best describes you right now?');

	await page.getByRole('button', { name: "I'm an investor (LP)" }).click();
	await clickActiveContinue(page);
	await expectActiveStepTitle(page, "What's your primary investing goal right now?");

	await page.locator('.step.active .goal-card').first().click();
	await expectActiveStepTitle(page, 'Are you an accredited investor?');
	assert.equal(await page.locator('.goal-card').count() >= 3, true, 'planned entry flow: accreditation should render as selectable cards');

	assert.deepEqual(errors.consoleErrors, [], 'planned entry flow: console errors');
	assert.deepEqual(errors.pageErrors, [], 'planned entry flow: page errors');
	assert.deepEqual(errors.requestFailures, [], 'planned entry flow: request failures');

	await context.close();
}

async function runSavedAnswerHydrationScenario(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, {});
	await seedSession(page);

	await page.goto(`${BASE_URL}/app/plan?stage=starting-point&edit=1&branch=cashflow&flow=free`);
	await page.waitForLoadState('networkidle');
	await page.waitForSelector('.plan-setup-card');
	assert.equal(
		await page.locator('.plan-setup-card .wizard-card.ob-surface').count(),
		0,
		'hydration: wizard should not render an inner surfaced card'
	);
	await assertTitle(page, 'Where are you starting from?');
	assert.equal(await page.locator('.money-input').inputValue(), '', 'hydration: baseline input should start empty before saved data is pushed in');

	await page.evaluate(({ fixture }) => {
		localStorage.setItem(
			'__gycScoped__member%40example.com__gycBuyBoxWizard',
			JSON.stringify(fixture)
		);
		window.dispatchEvent(new CustomEvent('gyc:user-scoped-state-updated'));
	}, { fixture: zeroBaselineFixture });

	await page.waitForFunction(() => document.querySelector('.money-input')?.value === '0');
	assert.equal(await page.locator('.money-input').inputValue(), '0', 'hydration: saved zero baseline should render in the input');
	assert.equal(
		await page.locator('.pill-chip.selected').first().textContent(),
		'$0',
		'hydration: saved zero baseline should keep the preset selected'
	);

	assert.deepEqual(errors.consoleErrors, [], 'hydration: console errors');
	assert.deepEqual(errors.pageErrors, [], 'hydration: page errors');
	assert.deepEqual(errors.requestFailures, [], 'hydration: request failures');

	await context.close();
}

async function assertTitle(page, expected) {
	await page.waitForFunction((title) => {
		const el = document.querySelector('.ob-title');
		return el?.textContent?.trim() === title;
	}, expected);
	assert.equal(
		(await page.locator('.ob-title').textContent())?.trim(),
		expected,
		`expected wizard title "${expected}"`
	);
}

async function assertTitleIncludes(page, expectedSubstring) {
	await page.waitForFunction((needle) => {
		const el = document.querySelector('.ob-title');
		return el?.textContent?.includes(needle);
	}, expectedSubstring);
	const title = (await page.locator('.ob-title').textContent())?.trim() || '';
	assert(title.includes(expectedSubstring), `expected wizard title to include "${expectedSubstring}", received "${title}"`);
}

async function activeStepTitle(page) {
	return ((await page.locator('.step.active .step-title').first().textContent()) || '').trim();
}

async function clickActiveContinue(page) {
	await page.locator('.step.active').getByRole('button', { name: 'Continue' }).click();
}

async function expectActiveStepTitle(page, expected) {
	await page.waitForFunction((title) => {
		const el = document.querySelector('.step.active .step-title');
		return el?.textContent?.trim() === title;
	}, expected);
	assert.equal(await activeStepTitle(page), expected);
}

/**
 * @deprecated No longer called — the fixture user now has tosVersion set (see
 * tests/fixtures/session.mjs) so the onboarding flow skips the TOS gate entirely.
 * Kept for reference in case a test needs to simulate a first-time user.
 *
 * If the TOS gate step is currently active, click all 3 checkboxes and proceed.
 * This step was added after the tests were written (migration 068) and appears
 * after the name step for users whose session does not have tosVersion set.
 */
async function handleTosGateIfPresent(page) {
	const title = await activeStepTitle(page).catch(() => '');
	if (title !== 'Before we continue') return;
	await page.locator('.consent-row').nth(0).click();
	await page.locator('.consent-row').nth(1).click();
	await page.locator('.consent-row').nth(2).click();
	await page.getByRole('button', { name: /I Agree/i }).click();
	await page.waitForFunction(() => {
		const el = document.querySelector('.step.active .step-title');
		return el?.textContent?.trim() !== 'Before we continue';
	}, null, { timeout: 15000 });
}

async function reopenReview(page, branch) {
	await page.goto(`${BASE_URL}/app/plan?stage=profile-review&edit=1&branch=${branch}&flow=paid_${branch}`);
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'Your Investment Profile');
}

async function dragAndDropSlot(page, sourceSelector, targetSelector) {
	await page.evaluate(({ sourceSelector, targetSelector }) => {
		const source = document.querySelector(sourceSelector);
		const target = document.querySelector(targetSelector);
		if (!source || !target) throw new Error(`Missing drag target: ${sourceSelector} -> ${targetSelector}`);
		const dataTransfer = new DataTransfer();
		source.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer }));
		target.dispatchEvent(new DragEvent('dragover', { bubbles: true, cancelable: true, dataTransfer }));
		target.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer }));
		source.dispatchEvent(new DragEvent('dragend', { bubbles: true, cancelable: true, dataTransfer }));
	}, { sourceSelector, targetSelector });
}

async function runReviewScenario(page, branch, config) {
	await reopenReview(page, branch);
	const reviewRows = page.locator('[data-testid^="review-row-"]');
	assert((await reviewRows.count()) >= 18, `${branch}: profile review should show the full question index`);

	await page.locator('[data-testid="review-row-re-professional"]').click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'Do you or your spouse qualify as a Real Estate Professional for tax purposes?');

	await reopenReview(page, branch);
	const goalRow = branch === 'cashflow' ? 'review-row-income-target' : branch === 'growth' ? 'review-row-growth-target' : 'review-row-tax-target';
	await page.locator(`[data-testid="${goalRow}"]`).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, config.reviewGoalTitle);

	await reopenReview(page, branch);
	await page.locator('[data-testid="review-row-distributions"]').click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'How often do you want to get paid?');
}

async function runPlanBuilderInteractionScenario(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, branchFixtures.cashflow.wizardData);
	await seedSession(page);

	await page.goto(`${BASE_URL}/app/plan?stage=plan&edit=1&branch=cashflow&flow=paid_cashflow`);
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page);
	await assertTitleIncludes(page, "Here's your plan to reach");

	const globalCheck = page.locator('[data-testid="plan-global-check"]');
	const globalYield = page.locator('[data-testid="plan-global-yield"]');
	await globalCheck.fill('150000');
	await globalCheck.dispatchEvent('change');
	await globalYield.fill('7.5');
	await globalYield.dispatchEvent('change');
	await page.waitForFunction(() => document.querySelector('[data-testid^="slot-check-"]')?.value === '150000');
	await page.waitForFunction(() => document.querySelector('[data-testid^="slot-yield-"]')?.value === '7.5');

	const firstSlot = page.locator('[data-testid^="plan-slot-"]').first();
	const firstSlotId = await firstSlot.getAttribute('data-testid');
	assert(firstSlotId, 'cashflow: first plan slot test id missing');

	const yearSections = page.locator('[data-testid^="plan-year-"]');
	assert((await yearSections.count()) >= 2, 'cashflow: plan builder should render multiple years');
	const secondYearId = await yearSections.nth(1).getAttribute('data-testid');
	assert(secondYearId, 'cashflow: missing second year test id');
	await dragAndDropSlot(page, `[data-testid="${firstSlotId}"]`, `[data-testid="${secondYearId}"]`);
	await page.waitForFunction(({ slotId, targetYear }) => {
		const yearSection = document.querySelector(`[data-testid="${targetYear}"]`);
		return !!yearSection?.querySelector(`[data-testid="${slotId}"]`);
	}, { slotId: firstSlotId, targetYear: secondYearId });

	await page.waitForTimeout(1500);
	await page.reload();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page);
	await assertTitleIncludes(page, "Here's your plan to reach");
	await page.waitForFunction(({ slotId, targetYear }) => {
		const yearSection = document.querySelector(`[data-testid="${targetYear}"]`);
		const slot = yearSection?.querySelector(`[data-testid="${slotId}"]`);
		if (!slot) return false;
		const slotKey = slotId.replace('plan-slot-', '');
		const checkInput = yearSection.querySelector(`[data-testid="slot-check-${slotKey}"]`);
		const yieldInput = yearSection.querySelector(`[data-testid="slot-yield-${slotKey}"]`);
		return checkInput?.value === '150000' && yieldInput?.value === '7.5';
	}, { slotId: firstSlotId, targetYear: secondYearId });

	await page.getByRole('button', { name: 'Next' }).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'Do you want visibility into which other LPs are in a deal?');
	await page.getByRole('button', { name: 'Build My Plan →' }).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'Your Investment Profile');
	await page.getByRole('button', { name: 'Looks Good →' }).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'Your plan is ready.');
	assert.equal(
		await page.getByRole('button', { name: 'View My Full Plan →' }).count(),
		1,
		'cashflow: completion CTA should point to the full plan'
	);
	await page.getByRole('button', { name: 'View My Full Plan →' }).click();
	await page.waitForLoadState('networkidle');
	await expectSummaryView(page);

	assert.deepEqual(errors.consoleErrors, [], 'plan builder: console errors');
	assert.deepEqual(errors.pageErrors, [], 'plan builder: page errors');
	assert.deepEqual(errors.requestFailures, [], 'plan builder: request failures');

	await context.close();
}

async function runPlanRowOverrideScenario(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, branchFixtures.cashflow.wizardData);
	await seedSession(page);

	await page.goto(`${BASE_URL}/app/plan?stage=plan&edit=1&branch=cashflow&flow=paid_cashflow`);
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page);
	await assertTitleIncludes(page, "Here's your plan to reach");

	const rowAsset = page.locator('[data-testid="slot-asset-1"]');
	const rowCheck = page.locator('[data-testid="slot-check-1"]');
	const rowYield = page.locator('[data-testid="slot-yield-1"]');

	await rowAsset.selectOption('Private Debt / Credit');
	await page.waitForTimeout(500);
	assert.equal(await rowAsset.inputValue(), 'Private Debt / Credit', 'cashflow row override: asset class should update');

	await rowCheck.fill('175000');
	await rowCheck.press('Tab');
	await page.waitForTimeout(500);
	assert.equal(await rowCheck.inputValue(), '175000', 'cashflow row override: check size should update');

	await rowYield.fill('9.5');
	await rowYield.press('Tab');
	await page.waitForTimeout(500);
	assert.equal(await rowYield.inputValue(), '9.5', 'cashflow row override: yield should update');

	await page.waitForTimeout(1500);
	await page.reload();
	await page.waitForLoadState('networkidle');
	assert.equal(await page.locator('[data-testid="slot-asset-1"]').inputValue(), 'Private Debt / Credit', 'cashflow row override: asset class should persist');
	assert.equal(await page.locator('[data-testid="slot-check-1"]').inputValue(), '175000', 'cashflow row override: check size should persist');
	assert.equal(await page.locator('[data-testid="slot-yield-1"]').inputValue(), '9.5', 'cashflow row override: yield should persist');

	assert.deepEqual(errors.consoleErrors, [], 'plan row override: console errors');
	assert.deepEqual(errors.pageErrors, [], 'plan row override: page errors');
	assert.deepEqual(errors.requestFailures, [], 'plan row override: request failures');

	await context.close();
}

async function runRoadmapEditPlanScenario(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, branchFixtures.cashflow.wizardData);
	await seedSession(page);

	await page.goto(`${BASE_URL}/app/plan`);
	await page.waitForLoadState('networkidle');
	await expectSummaryView(page);

	const firstRoadmapRow = page.locator('.roadmap-card .schedule-row-detail').first();
	const initialRoadmapText = ((await firstRoadmapRow.textContent()) || '').replace(/\s+/g, ' ').trim();
	assert(initialRoadmapText.length > 0, 'roadmap edit: summary plan should render at least one roadmap row');

	await page.locator('.roadmap-card .inline-action.green').click();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page);
	await assertTitleIncludes(page, "Here's your plan to reach");

	await page.locator('[data-testid="slot-asset-1"]').selectOption('Private Debt / Credit');
	await page.waitForTimeout(300);
	await page.getByRole('button', { name: 'Back To Plan' }).click();
	await page.waitForLoadState('networkidle');
	await expectSummaryView(page);
	await page.waitForFunction(() => {
		const row = document.querySelector('.roadmap-card .schedule-row-detail');
		return row?.textContent?.includes('Private Debt / Credit');
	});

	const updatedRoadmapText = ((await page.locator('.roadmap-card .schedule-row-detail').first().textContent()) || '').replace(/\s+/g, ' ').trim();
	assert(updatedRoadmapText.includes('Private Debt / Credit'), 'roadmap edit: summary roadmap should reflect step-18 edits');
	assert.notEqual(updatedRoadmapText, initialRoadmapText, 'roadmap edit: summary roadmap row should change after editing step 18');

	assert.deepEqual(errors.consoleErrors, [], 'roadmap edit: console errors');
	assert.deepEqual(errors.pageErrors, [], 'roadmap edit: page errors');
	assert.deepEqual(errors.requestFailures, [], 'roadmap edit: request failures');

	await context.close();
}

async function runPlanSummaryEditScenario(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, branchFixtures.cashflow.wizardData);
	await seedSession(page);

	await page.goto(`${BASE_URL}/app/plan`);
	await page.waitForLoadState('networkidle');
	await expectSummaryView(page);

	await page.locator('[data-testid="plan-summary-edit"]').click();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page);
	await assertTitle(page, 'Your Investment Profile');
	assert.match(
		page.url(),
		/stage=profile-review&flow=paid_cashflow&branch=cashflow&edit=1/,
		'summary edit: should route directly to profile review'
	);

	await page.goBack();
	await page.waitForLoadState('networkidle');
	await expectSummaryView(page);

	await page.goForward();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'Your Investment Profile');

	await page.reload();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page);
	await assertTitle(page, 'Your Investment Profile');

	await page.locator('[data-testid="wizard-start-over"]').click();
	await page.waitForSelector('.confirm-modal-overlay');
	assert.equal(
		(await page.locator('#plan-confirm-title').textContent())?.trim(),
		'Start over?',
		'summary edit: start over modal should use the requested title'
	);
	await page.locator('[data-testid="plan-reset-cancel"]').click();
	await page.waitForSelector('.confirm-modal-overlay', { state: 'detached' });
	await assertTitle(page, 'Your Investment Profile');

	await page.locator('[data-testid="wizard-start-over"]').click();
	await page.locator('[data-testid="plan-reset-confirm"]').click();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page, { clickablePills: null });
	await assertTitle(page, "What's your primary investing goal right now?");
	assert.match(page.url(), /stage=goal&flow=free/, 'summary edit: start over should return to step 1');
	assert.equal(
		await selectedCards(page, '.goal-card').count(),
		0,
		'summary edit: start over should clear previous goal selection'
	);

	assert.deepEqual(errors.consoleErrors, [], 'summary edit: console errors');
	assert.deepEqual(errors.pageErrors, [], 'summary edit: page errors');
	assert.deepEqual(errors.requestFailures, [], 'summary edit: request failures');

	await context.close();
}

async function runNewPlanScenario(browser) {
	const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
	const page = await context.newPage();
	const errors = await installApiMocks(page, branchFixtures.cashflow.wizardData);
	await seedSession(page);

	await page.goto(`${BASE_URL}/app/plan`);
	await page.waitForLoadState('networkidle');
	await expectSummaryView(page);

	await page.locator('[data-testid="plan-summary-new"]').click();
	await page.waitForSelector('.confirm-modal-overlay');
	assert.equal(
		(await page.locator('#plan-confirm-title').textContent())?.trim(),
		'Create a new plan?',
		'new plan: modal should open from the summary action'
	);
	const modalCopy = ((await page.locator('.confirm-modal-copy').textContent()) || '').replace(/\s+/g, ' ').trim();
	assert(
		modalCopy.includes('one active plan') && modalCopy.includes('fresh replacement plan'),
		'new plan: confirmation copy should reflect the single-plan data model'
	);

	await page.locator('[data-testid="plan-reset-confirm"]').click();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page, { clickablePills: null });
	await assertTitle(page, "What's your primary investing goal right now?");
	assert.match(page.url(), /stage=goal&flow=free/, 'new plan: should start at the beginning of the flow');
	assert.equal(
		await selectedCards(page, '.goal-card').count(),
		0,
		'new plan: previous goal selection should be cleared'
	);

	await page.reload();
	await page.waitForLoadState('networkidle');
	await expectWizardShell(page, { clickablePills: null });
	await assertTitle(page, "What's your primary investing goal right now?");

	assert.deepEqual(errors.consoleErrors, [], 'new plan: console errors');
	assert.deepEqual(errors.pageErrors, [], 'new plan: page errors');
	assert.deepEqual(errors.requestFailures, [], 'new plan: request failures');

	await context.close();
}

async function main() {
	const browser = await chromium.launch({ headless: true });
	try {
		for (const [branch, config] of Object.entries(branchFixtures)) {
			await runBranchScenario(browser, branch, config);
			const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
			const page = await context.newPage();
			const errors = await installApiMocks(page, config.wizardData);
			await seedSession(page);
			await runReviewScenario(page, branch, config);
			assert.deepEqual(errors.consoleErrors, [], `${branch} review: console errors`);
			assert.deepEqual(errors.pageErrors, [], `${branch} review: page errors`);
			assert.deepEqual(errors.requestFailures, [], `${branch} review: request failures`);
			await context.close();
		}
		await runPlanBuilderInteractionScenario(browser);
		await runPlanRowOverrideScenario(browser);
		await runRoadmapEditPlanScenario(browser);
		await runPlanSummaryEditScenario(browser);
		await runNewPlanScenario(browser);
		await runOnboardingEntryScenario(browser);
		await runPlannedOnboardingContractScenario(browser);
		await runPartialProgressScenario(browser);
		await runSavedAnswerHydrationScenario(browser);
		console.log('Plan wizard QA passed for cashflow, growth, tax, summary edit entry, Start Over, New Plan replacement flow, onboarding entry smoke, profile review jump scenarios, global plan controls, row overrides, roadmap edit sync, drag-and-drop timing changes, partial-progress returning user scenarios, and saved-answer hydration/prefill.');
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
