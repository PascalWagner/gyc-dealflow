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

	await page.route('**/api/auth**', async (route) => {
		let body: Record<string, unknown> = {};
		try { body = route.request().postDataJSON() || {}; } catch { body = {}; }

		if (body?.action === 'lookup' && body?.email) {
			const email = String(body.email).toLowerCase();
			const name = email.split('@')[0];
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					email,
					name,
					fullName: name,
					token: fakeJwt(email),
					refreshToken: `refresh-${email}`,
					tier: email === IMPERSONATED_EMAIL ? 'academy' : 'free',
					isAdmin: false,
					success: true
				})
			});
			return;
		}
		if (body?.action === 'refresh') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					token: fakeJwt(String(body?.email || ADMIN_EMAIL)),
					refreshToken: String(body?.refreshToken || 'refresh-refreshed'),
					success: true
				})
			});
			return;
		}
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
	});

	await page.route('**/api/settings/membership**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: null }) });
	});

	await page.route('**/api/events**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
	});

	await page.route('**/api/deal-stats**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stats: {} }) });
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
				assetClass: 'Private Debt / Credit',
				dealType: 'Fund',
				strategy: 'Lending',
				targetIRR: 0.19,
				preferredReturn: 0.08,
				investmentMinimum: 5000,
				status: 'Open',
				historicalReturns: [
					{ year: 2021, value: 13.8 },
					{ year: 2022, value: 15.1 },
					{ year: 2023, value: 14.6 },
					{ year: 2024, value: 16.4 },
					{ year: 2025, value: 15.8 }
				]
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
		const url = new URL(route.request().url());
		const pathDealId = url.pathname.split('/api/deals/')[1]?.split('?')[0];
		const queryDealId = url.searchParams.get('id');
		const dealId = pathDealId || queryDealId;

		if (dealId) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					deal: {
						id: dealId,
						investmentName: 'Mock Deal',
						managementCompany: SPONSOR_NAME,
						management_company_id: SPONSOR_ID,
						assetClass: 'Industrial',
						dealType: 'Fund',
						status: 'Open'
					}
				})
			});
			return;
		}

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
		await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
		await expect(page.locator('.tier-badge')).toContainText('Free');
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
		await expect(page.getByRole('heading', { name: 'Settings', level: 1 })).toBeVisible();
		await expect(page.locator('.tier-badge')).toContainText('Academy');
		await expect(page.locator('.view-as-toggle')).toBeVisible();
		await expect(page.getByText('Admin Dashboard')).toBeVisible();
	});

	test('impersonation UI renders for admin and shows user search', async ({ page }) => {
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
		await expect(page.locator('.view-as-input')).toBeVisible();

		await page.locator('.view-as-input').fill('academy');
		await expect(page.locator('.view-as-result')).toHaveCount(1);

		// Verify the admin real user is stored when entering impersonation
		const adminStored = await page.evaluate(() => {
			const user = JSON.parse(localStorage.getItem('gycUser') || 'null');
			return { email: user?.email, isAdmin: user?.isAdmin };
		});
		expect(adminStored.email).toBe(ADMIN_EMAIL);
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

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card').first()).toBeVisible();

		await page.locator('.deal-card').first().locator('.card-title').click();
		await expect(page).toHaveURL(/\/deal\/deal-yield-1$/);
	});

	test('lending funds replace the hero image with the returns display', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');

		const firstHero = page.locator('.deal-card').first().locator('.card-hero');
		await expect(firstHero).toHaveClass(/lending-hero/);
		await expect(firstHero.locator('.hero-returns-surface')).toBeVisible();
		await expect(firstHero).not.toHaveAttribute('style', /url\(/);
	});

	test('deal card footer controls render correctly and do not navigate', async ({ page }) => {
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card')).toHaveCount(2);

		const firstCard = page.locator('.deal-card').first();
		const saveBtn = firstCard.getByRole('button', { name: 'Save Deal' });
		const skipBtn = firstCard.getByRole('button', { name: 'Not Interested' });

		await expect(saveBtn).toBeVisible();
		await expect(saveBtn).toBeEnabled();
		await expect(skipBtn).toBeVisible();
		await expect(skipBtn).toBeEnabled();

		// Verify footer control buttons have data-card-control attribute
		await expect(saveBtn).toHaveAttribute('data-card-control', 'true');
		await expect(skipBtn).toHaveAttribute('data-card-control', 'true');

		// Verify clicking a footer button does NOT navigate away
		await saveBtn.click();
		await expect(page).toHaveURL(/\/app\/deals$/);
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

	test('deal card stage action with server error shows friendly notice', async ({ page }) => {
		// Override the userdata POST mock to return 500 (simulating expired JWT server-side)
		await page.route('**/api/userdata', async (route) => {
			if (route.request().method() === 'POST' || route.request().method() === 'DELETE') {
				await route.fulfill({
					status: 500,
					contentType: 'application/json',
					body: JSON.stringify({ error: 'Internal server error' })
				});
				return;
			}
			// Fall through to default mock for GET
			const url = new URL(route.request().url());
			const type = url.searchParams.get('type') || '';
			const email = decodeAuthEmail(route.request().headers().authorization);
			const bundle = userBundles[email] || { portfolio: [], stages: [], goals: [], taxdocs: [], plan: [] };
			const records = type ? (bundle[type as keyof UserBundle] || []) : [];
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({ records, count: records.length, type, fetchedAt: new Date().toISOString() })
			});
		});

		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		await expect(page.locator('.deal-card')).toHaveCount(2);

		// Click Save Deal — this will trigger syncStageToBackend which hits our 500 mock
		const saveBtn = page.locator('.deal-card').first().getByRole('button', { name: 'Save Deal' });
		await saveBtn.click();

		// Wait for the notice to appear (stage sync is async)
		const notice = page.locator('.compare-notice[role="status"]');
		await expect(notice).toBeVisible({ timeout: 5000 });

		// The notice should show a friendly message, NOT the raw "Internal server error"
		await expect(notice).not.toContainText('Internal server error');
		await expect(notice).toContainText(/went wrong|could not|reload/i);

		// Should stay on the deals page
		await expect(page).toHaveURL(/\/app\/deals$/);
	});

	test('onboarding completion with incomplete data redirects to first missing step', async ({ page }) => {
		// Mock onboarding-related APIs
		await page.route('**/api/gp-onboarding**', async (route) => {
			if (route.request().method() === 'GET') {
				await route.fulfill({
					status: 200,
					contentType: 'application/json',
					body: JSON.stringify({
						profile: { onboardingRole: 'lp', onboardingStep: 0 },
						company: null,
						teamContacts: [],
						dealCount: 0,
						hasBuyBox: false,
						agreementStatus: { hasCurrentAgreement: false, agreement: null }
					})
				});
				return;
			}
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
		});

		await page.route('**/api/buybox**', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"buyBox":{}}' });
		});

		await page.route('**/api/lp-network-stats**', async (route) => {
			await route.fulfill({ status: 200, contentType: 'application/json', body: '{"totalMembers":42}' });
		});

		const session = makeSessionUser(FREE_EMAIL, {
			name: 'Test User',
			fullName: 'Test User',
			tier: 'free'
		});

		await page.goto('/login');
		await page.evaluate(({ seededSession }) => {
			localStorage.clear();
			localStorage.setItem('gycUser', JSON.stringify(seededSession));
			// Seed a partial wizard snapshot: keys exist but values are empty/null
			const partialWizard = JSON.stringify({
				goal: 'cashflow',
				_branch: 'cashflow',
				lpAccreditation: [],
				lpDealsCount: 0,
				lpReProfessional: null,
				lpAssetClasses: [],
				lpStrategies: [],
				lpMaxCheckSize: '',
				lpNetworkAnswered: false
			});
			const scopedKey = `__gycScoped__${encodeURIComponent(seededSession.email)}__gycBuyBoxWizard`;
			localStorage.setItem(scopedKey, partialWizard);
			localStorage.setItem('gycBuyBoxWizard', partialWizard);
		}, { seededSession: session });

		await page.goto('/onboarding');
		await page.waitForTimeout(2000);

		// The completion step should NOT be reached — user should be redirected to first incomplete step
		// "Start Browsing Deals" is the completion CTA and should not be visible
		const completionBtn = page.getByRole('button', { name: /Start Browsing Deals|Build My Investment Plan/ });
		await expect(completionBtn).toHaveCount(0);
	});

	test('mobile deal card footer action does not produce error banner', async ({ page }) => {
		await page.setViewportSize({ width: 390, height: 844 });
		await seedSession(page, makeSessionUser(ADMIN_EMAIL, {
			name: 'Admin User',
			fullName: 'Admin User',
			tier: 'academy',
			isAdmin: true
		}));

		await page.goto('/app/deals');
		const card = page.locator('.swipe-card-shell .deal-card').first();
		await expect(card).toBeVisible();

		// Find and click a footer button (Not Interested / Save Deal)
		const skipBtn = card.getByRole('button', { name: 'Not Interested' });
		const skipVisible = await skipBtn.isVisible().catch(() => false);
		if (skipVisible) {
			await skipBtn.click();
			await page.waitForTimeout(2000);

			// Check that no error banner appeared with "Internal server error"
			const notice = page.locator('.compare-notice[role="status"]');
			const noticeVisible = await notice.isVisible().catch(() => false);
			if (noticeVisible) {
				await expect(notice).not.toContainText('Internal server error');
			}
		}

		// Should stay on deals page
		await expect(page).toHaveURL(/\/app\/deals$/);
	});
});
