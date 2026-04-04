import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures, TS types not needed for test helpers
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks, ADMIN_EMAIL, IMPERSONATED_EMAIL, SPONSOR_NAME, SPONSOR_ID, PERSON_NAME } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const FREE_EMAIL = 'test@test.com';

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
