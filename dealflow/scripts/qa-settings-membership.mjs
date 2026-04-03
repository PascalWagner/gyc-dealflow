import { chromium } from '@playwright/test';

const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:4173';
const fakeToken =
	'eyJhbGciOiJub25lIn0.eyJlbWFpbCI6Im1lbWJlckBleGFtcGxlLmNvbSIsImV4cCI6OTk5OTk5OTk5OX0.';

const pendingRenewalOptions = [
	{
		key: 'annual',
		label: 'Annual Membership',
		amount_label: '$250/yr',
		description: 'Renew yearly through Deal Flow Membership.',
		available: false
	},
	{
		key: 'monthly',
		label: 'Monthly Membership',
		amount_label: '$29/mo',
		description: 'Renew monthly through Deal Flow Membership.',
		available: false
	}
];

const scenarios = [
	{
		name: 'lifetime',
		user: {
			email: 'info@pascalwagner.com',
			token: fakeToken,
			accessTier: 'member',
			tier: 'academy',
			isAdmin: true,
			name: 'Pascal Wagner',
			fullName: 'Pascal Wagner',
			subscriptions: {}
		},
		membership: {
			product_type: 'academy',
			status: 'active',
			start_date: '2023-01-01T00:00:00.000Z',
			end_date: null,
			renewal_date: null,
			is_lifetime: true,
			billing_state: 'lifetime',
			billing_provider: 'manual',
			external_subscription_id: null,
			billing_management_url: null,
			renewal_options: pendingRenewalOptions
		},
		checks: async (page) => {
			const body = await page.locator('body').innerText();
			if (!body.includes('Lifetime access')) throw new Error('Lifetime label missing');
			if (body.includes('After your first year')) {
				throw new Error('Lifetime view should hide alumni note');
			}
			const button = page.getByRole('button', { name: 'Not Needed' });
			if (!(await button.isDisabled())) {
				throw new Error('Lifetime billing button should be disabled');
			}
		}
	},
	{
		name: 'renewal',
		user: {
			email: 'member@example.com',
			token: fakeToken,
			accessTier: 'member',
			tier: 'academy',
			isAdmin: false,
			name: 'Member Example',
			fullName: 'Member Example',
			subscriptions: {}
		},
		membership: {
			product_type: 'academy',
			status: 'active',
			start_date: '2025-11-13T00:00:00.000Z',
			end_date: '2026-12-31T23:59:59.000Z',
			renewal_date: '2026-12-31T23:59:59.000Z',
			is_lifetime: false,
			billing_state: 'renewal',
			billing_provider: 'ghl',
			external_subscription_id: null,
			billing_management_url: null,
			renewal_options: pendingRenewalOptions
		},
		checks: async (page) => {
			const button = page.getByRole('button', { name: 'Choose Renewal Plan' });
			if (!(await button.isEnabled())) {
				throw new Error('Renewal button should be enabled');
			}
			await button.click();
			await page.waitForSelector('text=Choose Your Renewal Plan');
			const pendingCount = await page.locator('text=Link Pending').count();
			if (pendingCount !== 2) {
				throw new Error(`Expected 2 pending renewal links, saw ${pendingCount}`);
			}
		}
	},
	{
		name: 'manage',
		user: {
			email: 'member@example.com',
			token: fakeToken,
			accessTier: 'member',
			tier: 'academy',
			isAdmin: false,
			name: 'Member Example',
			fullName: 'Member Example',
			subscriptions: {}
		},
		membership: {
			product_type: 'academy',
			status: 'active',
			start_date: '2025-11-13T00:00:00.000Z',
			end_date: '2026-12-31T23:59:59.000Z',
			renewal_date: '2026-12-31T23:59:59.000Z',
			is_lifetime: false,
			billing_state: 'manage',
			billing_provider: 'ghl',
			external_subscription_id: 'sub_live_123',
			billing_management_url: 'https://example.com/manage-card',
			renewal_options: pendingRenewalOptions
		},
		checks: async (page) => {
			const popupPromise = page.waitForEvent('popup');
			await page.getByRole('button', { name: 'Update Card' }).click();
			const popup = await popupPromise;
			await popup.waitForLoadState('domcontentloaded');
			if (!popup.url().startsWith('https://example.com/manage-card')) {
				throw new Error(`Unexpected popup URL: ${popup.url()}`);
			}
			await popup.close();
		}
	}
];

const browser = await chromium.launch({ headless: true });

try {
	for (const scenario of scenarios) {
		const context = await browser.newContext();
		const page = await context.newPage();

		await page.route('**/api/auth', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					email: scenario.user.email,
					name: scenario.user.name,
					fullName: scenario.user.fullName,
					tier: scenario.user.tier,
					isAdmin: scenario.user.isAdmin,
					subscriptions: { academy: scenario.membership }
				})
			});
		});

		await page.route('**/api/settings/membership?**', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(scenario.membership)
			});
		});

		await page.addInitScript((user) => {
			localStorage.setItem('gycUser', JSON.stringify(user));
		}, scenario.user);

		await page.goto(`${baseUrl}/app/settings?tab=plan`, { waitUntil: 'networkidle' });
		await scenario.checks(page);
		console.log(`QA PASS: ${scenario.name}`);
		await context.close();
	}
} finally {
	await browser.close();
}
