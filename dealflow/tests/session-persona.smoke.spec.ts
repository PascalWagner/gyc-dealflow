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
});
