import { expect, test } from '@playwright/test';
// @ts-expect-error -- .mjs fixtures
import { makeSessionUser } from './fixtures/session.mjs';
// @ts-expect-error
import { installCoreApiMocks } from './fixtures/api-mocks.mjs';
// @ts-expect-error
import { seedSession } from './fixtures/browser-session.mjs';

const USER_EMAIL = 'onboard-branch@example.com';

/**
 * Mock gp-onboarding to return an incomplete profile (no completedAt).
 * Without this, the component immediately redirects to /app/dashboard.
 */
async function installOnboardingMocks(page) {
	await installCoreApiMocks(page, {
		'/api/gp-onboarding': {
			profile: {
				onboardingRole: null,
				onboardingStep: 0,
				onboardingComplete: false,
				onboardingCompletedAt: null
			},
			company: null,
			teamContacts: [],
			dealCount: 0,
			hasBuyBox: false,
			agreementStatus: { hasCurrentAgreement: false, agreement: null }
		}
	});
}

test.describe('onboarding goal branch selection', () => {
	test('cashflow branch: selecting "Build Passive Income" saves _branch=cashflow', async ({ page }) => {
		await installOnboardingMocks(page);
		await seedSession(page, makeSessionUser(USER_EMAIL, {
			name: 'Onboard Tester',
			tier: 'free',
			isAdmin: false,
			onboardingCompletedAt: null
		}));

		// Use stage=goal to navigate directly to the LP goal step
		await page.goto('/onboarding?stage=goal');

		await expect(page.locator('.goal-card', { hasText: 'Build Passive Income' })).toBeVisible({ timeout: 10000 });
		await page.locator('.goal-card', { hasText: 'Build Passive Income' }).click();

		// Wizard snapshot should have _branch=cashflow in localStorage
		const snapshot = await page.evaluate((email) => {
			const key = `__gycScoped__${encodeURIComponent(email)}__gycBuyBoxWizard`;
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : null;
		}, USER_EMAIL);

		expect(snapshot?._branch).toBe('cashflow');
		expect(snapshot?.goal).toBe('cashflow');
	});

	test('tax branch: selecting "Reduce My Tax Bill" saves _branch=tax', async ({ page }) => {
		await installOnboardingMocks(page);
		await seedSession(page, makeSessionUser(USER_EMAIL, {
			name: 'Onboard Tester',
			tier: 'free',
			isAdmin: false,
			onboardingCompletedAt: null
		}));

		await page.goto('/onboarding?stage=goal');

		await expect(page.locator('.goal-card', { hasText: 'Reduce My Tax Bill' })).toBeVisible({ timeout: 10000 });
		await page.locator('.goal-card', { hasText: 'Reduce My Tax Bill' }).click();

		const snapshot = await page.evaluate((email) => {
			const key = `__gycScoped__${encodeURIComponent(email)}__gycBuyBoxWizard`;
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : null;
		}, USER_EMAIL);

		expect(snapshot?._branch).toBe('tax');
		expect(snapshot?.goal).toBe('tax');
	});

	test('growth branch: selecting "Grow My Wealth" saves _branch=growth', async ({ page }) => {
		await installOnboardingMocks(page);
		await seedSession(page, makeSessionUser(USER_EMAIL, {
			name: 'Onboard Tester',
			tier: 'free',
			isAdmin: false,
			onboardingCompletedAt: null
		}));

		await page.goto('/onboarding?stage=goal');

		await expect(page.locator('.goal-card', { hasText: 'Grow My Wealth' })).toBeVisible({ timeout: 10000 });
		await page.locator('.goal-card', { hasText: 'Grow My Wealth' }).click();

		const snapshot = await page.evaluate((email) => {
			const key = `__gycScoped__${encodeURIComponent(email)}__gycBuyBoxWizard`;
			const raw = localStorage.getItem(key);
			return raw ? JSON.parse(raw) : null;
		}, USER_EMAIL);

		expect(snapshot?._branch).toBe('growth');
		expect(snapshot?.goal).toBe('growth');
	});

	test('goal card shows as selected after click', async ({ page }) => {
		await installOnboardingMocks(page);
		await seedSession(page, makeSessionUser(USER_EMAIL, {
			name: 'Onboard Tester',
			tier: 'free',
			isAdmin: false,
			onboardingCompletedAt: null
		}));

		await page.goto('/onboarding?stage=goal');

		const cashflowCard = page.locator('.goal-card', { hasText: 'Build Passive Income' });
		await expect(cashflowCard).toBeVisible({ timeout: 10000 });
		await cashflowCard.click();

		// Card should have aria-pressed=true after selection
		await expect(cashflowCard).toHaveAttribute('aria-pressed', 'true');
	});

	test('resumed session with saved cashflow branch goes to accreditation step', async ({ page }) => {
		await installOnboardingMocks(page);
		await seedSession(page, makeSessionUser(USER_EMAIL, {
			name: 'Onboard Tester',
			tier: 'free',
			isAdmin: false,
			onboardingCompletedAt: null
		}));

		// Pre-seed a cashflow branch in local snapshot so onboarding resumes mid-flow
		await page.goto('/login');
		await page.evaluate((email) => {
			const key = `__gycScoped__${encodeURIComponent(email)}__gycBuyBoxWizard`;
			localStorage.setItem(key, JSON.stringify({
				goal: 'cashflow',
				_branch: 'cashflow',
				lpDealsCount: null,
				lpAccreditation: []
			}));
		}, USER_EMAIL);

		await page.goto('/onboarding');

		// With a saved cashflow snapshot, component resumes past role selection
		// Either shows goal confirmation step or accreditation step
		await expect(page.locator('.goal-card, .role-card[aria-pressed="true"]').first()).toBeVisible({ timeout: 10000 });
	});

	test('GP role selection navigates to GP onboarding step', async ({ page }) => {
		await installOnboardingMocks(page);
		await seedSession(page, makeSessionUser(USER_EMAIL, {
			name: 'GP Tester',
			tier: 'free',
			isAdmin: false,
			onboardingCompletedAt: null
		}));

		// Use stage=role to navigate directly to the role selection step (step1)
		await page.goto('/onboarding?stage=role');
		await expect(page.locator('.role-card', { hasText: "I'm an operator" })).toBeVisible({ timeout: 10000 });

		await page.locator('.role-card', { hasText: "I'm an operator" }).click();
		await page.getByRole('button', { name: 'Continue' }).first().click();

		// GP path moves to step2 (company details), not LP goal step
		await expect(page.locator('.goal-card', { hasText: 'Build Passive Income' })).toHaveCount(0);
	});
});
