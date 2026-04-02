import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const BASE_URL = process.env.BASE_URL || 'http://127.0.0.1:4173';
const USER_EMAIL = 'member@example.com';

function base64UrlEncode(value) {
	return Buffer.from(value)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function fakeJwt(email) {
	const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64UrlEncode(JSON.stringify({
		sub: `user-${email}`,
		email,
		role: 'authenticated',
		exp: Math.floor(Date.now() / 1000) + 60 * 60
	}));
	return `${header}.${payload}.signature`;
}

function makeSessionUser(email = USER_EMAIL) {
	return {
		email,
		name: 'Plan Tester',
		fullName: 'Plan Tester',
		tier: 'member',
		accessTier: 'member',
		isAdmin: false,
		token: fakeJwt(email),
		refreshToken: `refresh-${email}`
	};
}

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
			maxOperatorPct: '20',
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
		goalTitle: 'How much passive income do you want in 12 months?',
		financeTitle: "What's your total net worth?",
		preferencesTitle: 'Concentrated or diversified?',
		expectedGoalValue: '50000',
		expectedFinanceValue: '2500000',
		expectedGoalCard: 'Replace my income',
		expectedPreferenceSelection: 'Balanced'
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
			maxOperatorPct: '33',
			accreditation: ['net_worth'],
			growthCapital: '1000000',
			targetGrowth: '1000000',
			growthPriority: 'balanced',
			netWorth: '3200000',
			taxableIncomeBaseline: '650000',
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
		financeTitle: 'What matters more - upside or safety?',
		preferencesTitle: 'Concentrated or diversified?',
		expectedGoalValue: '1000000',
		expectedGoalCard: 'Build generational wealth',
		expectedFinanceSelection: 'Balanced - some cash now, some growth',
		expectedPreferenceSelection: 'Maximum Diversification'
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
			maxOperatorPct: '20',
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
		financeTitle: "What's your total net worth?",
		preferencesTitle: 'Concentrated or diversified?',
		expectedGoalValue: '250000',
		expectedFinanceValue: '4100000',
		expectedGoalCard: 'Keep more of what I make',
		expectedPreferenceSelection: 'Focused'
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

async function installApiMocks(page, fixture) {
	const requestFailures = [];
	const consoleErrors = [];
	const pageErrors = [];

	page.on('requestfailed', (request) => {
		if (request.url().startsWith('https://fonts.googleapis.com/') || request.url().startsWith('https://fonts.gstatic.com/')) {
			return;
		}
		requestFailures.push(`${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'failed'}`);
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
				body: JSON.stringify({ success: true, buyBox: fixture })
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true })
		});
	});

	await page.route('**/api/userdata**', async (route) => {
		const url = new URL(route.request().url());
		if (route.request().method() === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, record: {} })
			});
			return;
		}

		const type = url.searchParams.get('type');
		if (type) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ records: [], count: 0, type })
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
	await page.waitForSelector('.plan-target-card');
	assert.equal(await page.locator('.ob-phase-node').count(), 0, 'summary page should not render onboarding phase pills');
}

async function expectWizardShell(page) {
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
	assert.deepEqual(
		phaseMeta.map((item) => item.tag),
		['BUTTON', 'BUTTON', 'BUTTON', 'BUTTON', 'BUTTON'],
		'returning-user wizard pills should render as buttons'
	);
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
	assert.match(page.url(), /stage=(income-target|growth-target|tax-target)/, `${branch}: Goal pill should update the stage query`);
	assert.equal(await page.locator('.money-input').inputValue(), config.expectedGoalValue, `${branch}: goal input should prefill`);

	await page.locator('.ob-phase-node').nth(2).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, config.financeTitle);
	if (config.expectedFinanceValue) {
		assert.equal(await page.locator('.money-input').inputValue(), config.expectedFinanceValue, `${branch}: finances input should prefill`);
	}
	if (config.expectedFinanceSelection) {
		const selectedText = ((await selectedCards(page, '.option-card').first().textContent()) || '').replace(/\s+/g, ' ').trim();
		assert(selectedText.includes(config.expectedFinanceSelection), `${branch}: finances selection should prefill`);
	}

	await page.locator('.ob-phase-node').nth(3).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, config.preferencesTitle);
	const preferenceText = ((await selectedCards(page, '.option-card').first().textContent()) || '').replace(/\s+/g, ' ').trim();
	assert(preferenceText.includes(config.expectedPreferenceSelection), `${branch}: preferences selection should prefill`);

	await page.locator('.ob-phase-node').nth(0).click();
	await page.waitForLoadState('networkidle');
	await assertTitle(page, 'What do you want your money to do for you?');
	const selectedGoalCard = ((await selectedCards(page, '.goal-card').first().textContent()) || '').replace(/\s+/g, ' ').trim();
	assert(selectedGoalCard.includes(config.expectedGoalCard), `${branch}: You pill should land on the saved goal card`);

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
	await assertTitle(page, 'What do you want your money to do for you?');

	assert.deepEqual(errors.consoleErrors, [], 'partial progress: console errors');
	assert.deepEqual(errors.pageErrors, [], 'partial progress: page errors');
	assert.deepEqual(errors.requestFailures, [], 'partial progress: request failures');

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

async function main() {
	const browser = await chromium.launch({ headless: true });
	try {
		for (const [branch, config] of Object.entries(branchFixtures)) {
			await runBranchScenario(browser, branch, config);
		}
		await runPartialProgressScenario(browser);
		console.log('Plan wizard QA passed for cashflow, growth, tax, and partial-progress returning user scenarios.');
	} finally {
		await browser.close();
	}
}

main().catch((error) => {
	console.error(error);
	process.exitCode = 1;
});
