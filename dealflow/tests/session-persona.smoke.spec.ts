import { expect, test, type Page } from '@playwright/test';

const ADMIN_EMAIL = 'info@pascalwagner.com';
const FREE_EMAIL = 'test@test.com';
const IMPERSONATED_EMAIL = 'academy-user@example.com';
const SPONSOR_NAME = 'Yield Street';
const SPONSOR_ID = 'sponsor-yield-street';
const PERSON_NAME = 'Michael Weisz';

type SessionUser = {
	email: string;
	name: string;
	fullName: string;
	tier: string;
	isAdmin: boolean;
	token: string;
	refreshToken: string;
};

type UserBundle = {
	portfolio: Array<Record<string, unknown>>;
	stages: Array<Record<string, unknown>>;
	goals: Array<Record<string, unknown>>;
	taxdocs: Array<Record<string, unknown>>;
	plan: Array<Record<string, unknown>>;
};

const userBundles: Record<string, UserBundle> = {
	[ADMIN_EMAIL]: {
		portfolio: [
			{
				id: 'admin-portfolio',
				deal_id: 'deal-admin',
				investment_name: 'Admin Holdco',
				sponsor: 'Admin Sponsor',
				asset_class: 'Industrial',
				amount_invested: 111111,
				status: 'Active'
			}
		],
		stages: [],
		goals: [],
		taxdocs: [],
		plan: []
	},
	[FREE_EMAIL]: {
		portfolio: [],
		stages: [],
		goals: [],
		taxdocs: [],
		plan: []
	},
	[IMPERSONATED_EMAIL]: {
		portfolio: [
			{
				id: 'academy-portfolio',
				deal_id: 'deal-academy',
				investment_name: 'Academy Holdco',
				sponsor: 'Academy Sponsor',
				asset_class: 'Multi Family',
				amount_invested: 222222,
				status: 'Active'
			}
		],
		stages: [],
		goals: [],
		taxdocs: [],
		plan: []
	}
};

function base64UrlEncode(value: string) {
	return Buffer.from(value)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

function fakeJwt(email: string) {
	const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64UrlEncode(JSON.stringify({
		sub: `user-${email}`,
		email,
		role: 'authenticated',
		exp: Math.floor(Date.now() / 1000) + 60 * 60
	}));
	return `${header}.${payload}.signature`;
}

function makeSessionUser(email: string, overrides: Partial<SessionUser> = {}): SessionUser {
	const defaultName = email.split('@')[0];
	const tier = overrides.tier || 'free';
	return {
		email,
		name: overrides.name || defaultName,
		fullName: overrides.fullName || overrides.name || defaultName,
		tier,
		isAdmin: overrides.isAdmin ?? false,
		token: overrides.token || fakeJwt(email),
		refreshToken: overrides.refreshToken || `refresh-${email}`,
		...overrides
	};
}

function decodeAuthEmail(authorizationHeader: string | undefined) {
	if (!authorizationHeader?.startsWith('Bearer ')) return '';
	const [, token] = authorizationHeader.split(' ');
	const payload = token.split('.')[1];
	if (!payload) return '';

	try {
		const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
		const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
		return String(parsed.email || '').toLowerCase();
	} catch {
		return '';
	}
}

async function installCoreApiMocks(page: Page) {
	await page.route('**/api/network**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});

	await page.route('**/api/member/deals**', async (route) => {
		const url = new URL(route.request().url());
		const scope = url.searchParams.get('scope') || 'browse';
		const deals = [
			{
				id: 'deal-yield-1',
				managementCompany: SPONSOR_NAME,
				management_company_id: SPONSOR_ID,
				ceo: PERSON_NAME,
				investmentName: 'Yield Street Industrial Fund',
				assetClass: 'Industrial',
				dealType: 'Fund',
				targetIRR: 0.19,
				preferredReturn: 0.08,
				investmentMinimum: 5000,
				status: 'Open'
			},
			{
				id: 'deal-yield-2',
				managementCompany: SPONSOR_NAME,
				management_company_id: SPONSOR_ID,
				ceo: PERSON_NAME,
				investmentName: 'Yield Street Multi-Family Fund',
				assetClass: 'Multi-Family',
				dealType: 'Syndication',
				targetIRR: 0.16,
				preferredReturn: 0.07,
				investmentMinimum: 25000,
				status: 'Active'
			}
		];

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				deals,
				scope,
				total: deals.length,
				hasMore: false
			})
		});
	});

	await page.route('**/api/deals**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ deals: [{ id: 'deal-1', investmentName: 'Mock Deal' }] })
		});
	});

	await page.route('**/api/sponsor**', async (route) => {
		const url = new URL(route.request().url());
		const company = url.searchParams.get('company');
		const id = url.searchParams.get('id');
		if (company !== SPONSOR_NAME && id !== SPONSOR_ID) {
			await route.fulfill({
				status: 404,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Sponsor not found' })
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				sponsor: {
					id: SPONSOR_ID,
					name: SPONSOR_NAME,
					ceo: PERSON_NAME,
					website: 'https://example.com/yield-street',
					linkedinCeo: 'https://www.linkedin.com/in/michael-weisz/',
					foundingYear: 2015,
					type: 'Operator',
					totalInvestors: 4200,
					assetClasses: ['Industrial', 'Multi-Family'],
					deals: [
						{
							id: 'deal-yield-1',
							name: 'Yield Street Industrial Fund',
							assetClass: 'Industrial',
							dealType: 'Fund',
							targetIRR: 0.19,
							equityMultiple: 1.8,
							prefReturn: 0.08,
							minInvestment: 5000,
							holdPeriod: 5,
							status: 'Open',
							strategy: 'Core Plus'
						}
					]
				}
			})
		});
	});

	await page.route('**/api/person**', async (route) => {
		const url = new URL(route.request().url());
		if (url.searchParams.get('name') !== PERSON_NAME) {
			await route.fulfill({
				status: 404,
				contentType: 'application/json',
				body: JSON.stringify({ error: 'Person not found' })
			});
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				person: {
					name: PERSON_NAME,
					linkedIn: 'https://www.linkedin.com/in/michael-weisz/',
					companies: [
						{
							id: SPONSOR_ID,
							name: SPONSOR_NAME,
							role: 'CEO',
							website: 'https://example.com/yield-street',
							foundingYear: 2015,
							type: 'Operator',
							assetClasses: ['Industrial', 'Multi-Family'],
							dealCount: 2
						}
					],
					deals: [
						{
							id: 'deal-yield-1',
							name: 'Yield Street Industrial Fund',
							companyName: SPONSOR_NAME,
							assetClass: 'Industrial',
							dealType: 'Fund',
							targetIRR: 0.19,
							equityMultiple: 1.8,
							prefReturn: 0.08,
							minInvestment: 5000,
							holdPeriod: 5,
							status: 'Open',
							strategy: 'Core Plus'
						}
					],
					stats: {
						totalDeals: 2,
						totalFirms: 1,
						avgIRR: 0.175,
						avgPrefReturn: 0.075
					}
				}
			})
		});
	});

	await page.route('**/api/background-check**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ results: [] })
		});
	});

	await page.route('**/api/users**', async (route) => {
		const url = new URL(route.request().url());
		const query = (url.searchParams.get('q') || '').toLowerCase();
		const contacts = query.length >= 2
			? [{
				email: IMPERSONATED_EMAIL,
				name: 'Academy User',
				fullName: 'Academy User',
				tier: 'academy'
			}]
			: [];

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, contacts })
		});
	});

	await page.route('**/api/buybox**', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ buyBox: {} })
		});
	});

	await page.route('**/api/userdata**', async (route) => {
		const request = route.request();
		const url = new URL(request.url());
		const method = request.method();

		if (method === 'POST') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ ok: true, record: {} })
			});
			return;
		}

		const type = url.searchParams.get('type') || '';
		if (type === 'notif_prefs') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ notif_frequency: 'weekly' })
			});
			return;
		}

		if (url.searchParams.get('admin') === 'true') {
			const targetEmail = String(url.searchParams.get('email') || '').toLowerCase();
			const bundle = userBundles[targetEmail] || {
				portfolio: [],
				stages: [],
				goals: [],
				taxdocs: [],
				plan: []
			};

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(type ? { [type]: bundle[type as keyof UserBundle] || [] } : bundle)
			});
			return;
		}

		const email = decodeAuthEmail(request.headers().authorization);
		const bundle = userBundles[email] || {
			portfolio: [],
			stages: [],
			goals: [],
			taxdocs: [],
			plan: []
		};
		const records = bundle[type as keyof UserBundle] || [];

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				records,
				count: records.length,
				type,
				fetchedAt: new Date().toISOString()
			})
		});
	});
}

async function seedSession(page: Page, session: SessionUser, options: { portfolio?: unknown[] } = {}) {
	await page.goto('/login');
	await page.evaluate(({ seededSession, portfolio }) => {
		localStorage.clear();
		localStorage.setItem('gycUser', JSON.stringify(seededSession));
		localStorage.setItem('gycPortfolio', JSON.stringify(portfolio || []));
		localStorage.setItem('gycNotifPrefs', JSON.stringify({
			frequency: 'weekly',
			deal_alerts: true,
			weekly_digest: true
		}));
	}, { seededSession: session, portfolio: options.portfolio || [] });
}

test.describe('session and persona smoke', () => {
	test.beforeEach(async ({ page }) => {
		await installCoreApiMocks(page);
	});

	test('free session boots without redirect and shows free tier', async ({ page }) => {
		await seedSession(page, makeSessionUser(FREE_EMAIL, {
			name: 'Free User',
			fullName: 'Free User',
			tier: 'free',
			isAdmin: false
		}));

		await page.goto('/app/settings');

		await expect(page).toHaveURL(/\/app\/settings$/);
		await expect(page.locator('.settings-shell-title')).toHaveText('Settings');
		await expect(page.locator('.user-tier')).toHaveText('Free Plan');
		await expect(page.locator('.view-as-toggle')).toHaveCount(0);
	});

	test('admin session boots with academy tier and admin controls', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}), {
			portfolio: [{ id: 'admin-local', investmentName: 'Admin Local State' }]
		});

		await page.goto('/app/settings');

		await expect(page).toHaveURL(/\/app\/settings$/);
		await expect(page.locator('.settings-shell-title')).toHaveText('Settings');
		await expect(page.locator('.user-tier')).toHaveText('Academy Member');
		await expect(page.locator('.view-as-toggle')).toBeVisible();
		await expect(page.getByText('Admin Dashboard')).toBeVisible();
	});

	test('impersonation keeps admin and academy scoped state separated', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}), {
			portfolio: [{ id: 'admin-local', investmentName: 'Admin Local State' }]
		});

		await page.goto('/app/settings');
		await expect(page.locator('.view-as-toggle')).toBeVisible();

		await page.locator('.view-as-toggle').click();
		await page.locator('.view-as-input').fill('academy');
		await expect(page.locator('.view-as-result')).toHaveCount(1);

		await page.locator('.view-as-result').click();

		await expect(page.locator('.view-as-impersonating')).toBeVisible();
		await expect(page.locator('.view-as-email')).toHaveText(IMPERSONATED_EMAIL);
		await expect(page.locator('.view-as-toggle')).toBeVisible();

		await page.waitForFunction(([adminEmail, impersonatedEmail]) => {
			const currentUser = JSON.parse(localStorage.getItem('gycUser') || 'null');
			const currentPortfolio = localStorage.getItem('gycPortfolio') || '';
			return (
				currentUser?.email === impersonatedEmail &&
				currentUser?.isAdmin === false &&
				typeof localStorage.getItem(`_scopedBundle_${adminEmail}`) === 'string' &&
				typeof localStorage.getItem(`_scopedBundle_${impersonatedEmail}`) === 'string' &&
				currentPortfolio.includes('Academy Holdco')
			);
		}, [ADMIN_EMAIL.toLowerCase(), IMPERSONATED_EMAIL.toLowerCase()]);

		const impersonationState = await page.evaluate(([adminEmail, impersonatedEmail]) => ({
			currentUser: JSON.parse(localStorage.getItem('gycUser') || 'null'),
			adminBundle: localStorage.getItem(`_scopedBundle_${adminEmail}`),
			academyBundle: localStorage.getItem(`_scopedBundle_${impersonatedEmail}`),
			adminRealUser: JSON.parse(localStorage.getItem('_gycAdminRealUser') || 'null'),
			currentPortfolio: localStorage.getItem('gycPortfolio')
		}), [ADMIN_EMAIL.toLowerCase(), IMPERSONATED_EMAIL.toLowerCase()]);

		expect(impersonationState.currentUser?.email).toBe(IMPERSONATED_EMAIL);
		expect(impersonationState.currentUser?.isAdmin).toBe(false);
		expect(impersonationState.adminRealUser?.email).toBe(ADMIN_EMAIL);
		expect(impersonationState.adminBundle).toContain('Admin Local State');
		expect(impersonationState.academyBundle).toContain('Academy Holdco');
		expect(impersonationState.currentPortfolio).toContain('Academy Holdco');

		await page.locator('.view-as-exit').click();

		await page.waitForFunction((adminEmail) => {
			const currentUser = JSON.parse(localStorage.getItem('gycUser') || 'null');
			const currentPortfolio = localStorage.getItem('gycPortfolio') || '';
			return (
				currentUser?.email === adminEmail &&
				currentPortfolio.includes('Admin Local State') &&
				localStorage.getItem('_gycAdminRealUser') === null
			);
		}, ADMIN_EMAIL.toLowerCase());

		const restoredState = await page.evaluate(([adminEmail, impersonatedEmail]) => ({
			currentUser: JSON.parse(localStorage.getItem('gycUser') || 'null'),
			currentPortfolio: localStorage.getItem('gycPortfolio'),
			adminBundle: localStorage.getItem(`_scopedBundle_${adminEmail}`),
			academyBundle: localStorage.getItem(`_scopedBundle_${impersonatedEmail}`)
		}), [ADMIN_EMAIL.toLowerCase(), IMPERSONATED_EMAIL.toLowerCase()]);

		expect(restoredState.currentUser?.email).toBe(ADMIN_EMAIL);
		expect(restoredState.currentPortfolio).toContain('Admin Local State');
		expect(restoredState.adminBundle).toContain('Admin Local State');
		expect(restoredState.academyBundle).toContain('Academy Holdco');
	});

	test('operator cards load sponsor pages and linked person profiles', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/operators');

		const operatorCard = page.locator('.manager-card').first();
		await expect(operatorCard).toBeVisible();
		await expect(operatorCard).toHaveAttribute('href', /\/sponsor\?/);
		await expect(operatorCard.locator('.card-name')).toHaveText(SPONSOR_NAME);

		await operatorCard.click();

		await expect(page).toHaveURL(new RegExp(`/sponsor\\?(company=${encodeURIComponent(SPONSOR_NAME)}|id=${SPONSOR_ID})`));
		await expect(page.locator('.sponsor-name')).toHaveText(SPONSOR_NAME);
		await expect(page.locator('.sponsor-ceo a')).toHaveText(PERSON_NAME);

		await page.locator('.sponsor-ceo a').click();

		await expect(page).toHaveURL(new RegExp(`/person\\?name=${encodeURIComponent(PERSON_NAME)}`));
		await expect(page.locator('.person-header-name')).toHaveText(PERSON_NAME);
		await expect(page.locator('.person-header-role a')).toHaveText(SPONSOR_NAME);
	});

	test('deal card non-control surfaces navigate to the deal detail page', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		await page.locator('.deal-card').first().locator('.card-hero').click();
		await expect(page).toHaveURL(/\/deal\/deal-yield-1$/);

		await page.goBack();
		await expect(page).toHaveURL(/\/app\/deals$/);
		await expect(page.locator('.deal-card').first()).toBeVisible();

		await page.locator('.deal-card').first().locator('.badge').first().click();
		await expect(page).toHaveURL(/\/deal\/deal-yield-1$/);

		await page.goBack();
		await expect(page).toHaveURL(/\/app\/deals$/);
		await expect(page.locator('.deal-card').first()).toBeVisible();

		await page.locator('.deal-card').first().locator('.hero-irr').click();
		await expect(page).toHaveURL(/\/deal\/deal-yield-1$/);

		await page.goBack();
		await expect(page).toHaveURL(/\/app\/deals$/);
		await expect(page.locator('.deal-card').first()).toBeVisible();

		await page.locator('.deal-card').first().locator('.card-title').click();
		await expect(page).toHaveURL(/\/deal\/deal-yield-1$/);
	});

	test('deal card footer controls act locally without opening the detail page', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card')).toHaveCount(2);

		const saveRequest = page.waitForRequest((request) =>
			request.method() === 'POST' &&
			request.url().includes('/api/userdata') &&
			(request.postData() || '').includes('"dealId":"deal-yield-1"') &&
			(request.postData() || '').includes('"review"')
		);
		await page.locator('.deal-card').first().getByRole('button', { name: 'Save Deal' }).click();
		await saveRequest;

		await expect(page).toHaveURL(/\/app\/deals$/);
		await expect(page.locator('.deal-card')).toHaveCount(1);
		await expect(page.locator('.deal-card').first().locator('.card-title')).toContainText('Multi-Family');

		const skipRequest = page.waitForRequest((request) =>
			request.method() === 'POST' &&
			request.url().includes('/api/userdata') &&
			(request.postData() || '').includes('"dealId":"deal-yield-2"') &&
			(request.postData() || '').includes('"skipped"')
		);
		await page.locator('.deal-card').first().getByRole('button', { name: 'Not Interested' }).click();
		await skipRequest;

		await expect(page).toHaveURL(/\/app\/deals$/);
		await expect(page.locator('.deal-card')).toHaveCount(0);
		await expect(page.locator('.empty-title')).toContainText('No deals available');
	});

	test('mobile swipe cards keep hero clicks navigable', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.swipe-card-shell .deal-card').first()).toBeVisible();

		await page.locator('.swipe-card-shell .deal-card').first().locator('.card-hero').click();
		await expect(page).toHaveURL(/\/deal\/deal-yield-1$/);
	});
});
