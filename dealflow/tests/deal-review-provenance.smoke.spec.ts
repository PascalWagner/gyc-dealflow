import { expect, test, type Page } from '@playwright/test';

const DEAL_ID = '6706f492-1db4-4925-b562-9c5336217337';
const MANAGEMENT_COMPANY_ID = '6dc45666-92d6-4690-90bb-e5c05d9099b6';
const ADMIN_EMAIL = 'info@pascalwagner.com';
const SESSION_VERSION = 3;

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

function makeAdminSession() {
	return {
		sessionVersion: SESSION_VERSION,
		email: ADMIN_EMAIL,
		name: 'Pascal Wagner',
		fullName: 'Pascal Wagner',
		accessTier: 'admin',
		roleFlags: {
			lp: true,
			gp: true,
			admin: true
		},
		capabilities: {
			memberContent: true,
			backgroundChecks: true,
			gpDashboard: true,
			gpCompanySettings: true,
			adminTools: true,
			impersonateUsers: true
		},
		isAdmin: true,
		token: fakeJwt(ADMIN_EMAIL),
		refreshToken: `refresh-${ADMIN_EMAIL}`
	};
}

function buildReadyLendingDeal() {
	return {
		id: DEAL_ID,
		investment_name: 'Capital Fund 2',
		sponsor_name: 'Capital Fund',
		management_company_id: MANAGEMENT_COMPANY_ID,
		companyWebsite: 'https://capitalfund.com',
		deck_url: 'https://example.com/capital-fund-2-deck.pdf',
		ppm_url: 'https://example.com/capital-fund-2-ppm.pdf',
		deal_branch: 'lending_fund',
		sec_filing_id: 'sec-filing-1',
		lifecycle_status: 'in_review',
		is_visible_to_users: false,
		deal_type: 'Fund',
		offering_type: '506(b)',
		offering_status: 'Evergreen',
		available_to: 'Both',
		investment_strategy: 'Variable-return lending fund focused on short-term, primarily first-position, asset-backed real estate loans.',
		underlying_exposure_types: ['Single Family', 'Multifamily', 'Commercial'],
		investing_states: ['AZ', 'CO', 'CA', 'NV', 'OR', 'WA', 'TX', 'TN', 'GA', 'UT', 'NC', 'AL'],
		short_summary: 'Capital Fund II is Capital Fund’s variable-return lending vehicle.',
		investment_minimum: 50000,
		hold_period_years: 1,
		redemption: 'Monthly',
		distributions: 'Monthly',
		preferred_return: null,
		financials: 'Audited',
		lp_gp_split: 80,
		redemption_notes: 'Monthly redemption windows subject to available liquidity.',
		tax_form: 'K-1',
		additional_term_notes: '',
		fees: '1% management fee.',
		historical_return_2024: 12.4,
		snapshot_as_of_date: '2025-09-01',
		fund_aum: 115000000,
		current_fund_size: 60509144,
		offering_size: 75000000,
		loan_count: 868,
		current_avg_loan_ltv: 63,
		max_allowed_ltv: 75,
		current_leverage: 45,
		max_allowed_leverage: 60,
		firm_founded_year: 2010,
		fund_founded_year: 2020,
		risk_tags: ['Liquidity', 'Leverage'],
		team_contacts: [
			{
				firstName: 'Michael',
				lastName: 'Anderson',
				email: 'test@test.com',
				phone: '480-889-6100',
				role: 'CEO',
				company: 'Capital Fund',
				isPrimary: true,
				isInvestorRelations: false,
				linkedinUrl: 'https://linkedin.com/in/michael-anderson',
				calendarUrl: ''
			},
			{
				firstName: 'Michael',
				lastName: 'Anderson',
				email: 'info@pascalwagner.com',
				phone: '',
				role: 'Investor Relations',
				company: 'Capital Fund',
				isPrimary: false,
				isInvestorRelations: true,
				linkedinUrl: '',
				calendarUrl: ''
			}
		],
		review_field_evidence: {}
	};
}

function buildStaticTermsEvidence() {
	return {
		investmentMinimum: [
			{
				sourceType: 'explicit',
				document: 'ppm',
				label: 'PPM',
				page: 17,
				line: 2,
				snippet: 'Minimum investment accepted from each investor is $50,000.'
			}
		],
		financials: [
			{
				sourceType: 'derived',
				document: 'deck',
				label: 'Deck',
				page: 13,
				line: 1,
				snippet: 'CF2 annual financial audit completed by Armanino LLP.'
			}
		],
		lpGpSplit: [
			{
				sourceType: 'derived',
				document: 'ppm',
				label: 'PPM',
				page: 17,
				line: 3,
				snippet: '80% of Company Net Cash Flow shall be distributed to the Class A Members and 20% to the Class B Member.'
			}
		]
	};
}

async function seedSession(page: Page) {
	await page.goto('/login');
	await page.evaluate((seededSession) => {
		localStorage.clear();
		localStorage.setItem('gycUser', JSON.stringify(seededSession));
	}, makeAdminSession());
}

async function installReviewFlowMocks(page: Page, {
	deal = buildReadyLendingDeal(),
	evidence = buildStaticTermsEvidence()
}: {
	deal?: Record<string, unknown>;
	evidence?: Record<string, unknown>;
} = {}) {
	const mutableDeal = structuredClone(deal);
	const lifecyclePatches: Array<Record<string, unknown>> = [];

	await page.route('**/api/network**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});

	await page.route('**/api/auth**', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true }) });
	});

	await page.route(`**/api/deals?id=${DEAL_ID}`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ deal: mutableDeal })
		});
	});

	await page.route(`**/api/deals/${DEAL_ID}`, async (route) => {
		if (route.request().method() !== 'PATCH') {
			await route.fallback();
			return;
		}

		const body = route.request().postDataJSON() as Record<string, unknown>;
		if (body.lifecycleStatus) {
			lifecyclePatches.push(body);
			mutableDeal.lifecycle_status = body.lifecycleStatus;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				success: true,
				deal: mutableDeal
			})
		});
	});

	await page.route(`**/api/sec-verification?dealId=${DEAL_ID}`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				view: {
					currentStatus: 'verified'
				},
				record: {
					status: 'verified',
					last_checked_at: '2026-03-31T23:11:44.000Z'
				}
			})
		});
	});

	await page.route(`**/api/management-companies/${MANAGEMENT_COMPANY_ID}/settings`, async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				teamContacts: mutableDeal.team_contacts
			})
		});
	});

	await page.route('**/api/deal-team-contacts', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				contacts: [],
				warnings: [],
				diagnostics: null
			})
		});
	});

	await page.route('**/api/deal-cleanup', async (route) => {
		const body = route.request().postDataJSON() as Record<string, unknown>;
		if (body.action === 'review-field-evidence') {
			const fieldKeys = Array.isArray(body.fieldKeys) ? body.fieldKeys : [];
			const nextEvidence = Object.fromEntries(
				fieldKeys
					.filter((fieldKey) => typeof fieldKey === 'string' && evidence[fieldKey])
					.map((fieldKey) => [fieldKey, evidence[fieldKey]])
			);
			mutableDeal.review_field_evidence = {
				...(mutableDeal.review_field_evidence as Record<string, unknown> || {}),
				...nextEvidence
			};

			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					field_evidence: nextEvidence,
					review_field_evidence: mutableDeal.review_field_evidence,
					deal: mutableDeal
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

	return {
		lifecyclePatches,
		mutableDeal
	};
}

test.describe('deal review provenance smoke', () => {
	test('static terms renders field-level citations and unsourced fallbacks', async ({ page }) => {
		await installReviewFlowMocks(page);
		await seedSession(page);

		await page.goto(`/deal-review?id=${DEAL_ID}&stage=static_terms&from=queue`);

		await expect(page.getByRole('heading', { name: 'Capture the durable fund terms' }).nth(1)).toBeVisible();
		await expect(page.locator('.field-evidence__link', { hasText: 'Deck · p.13 · line 1' })).toHaveAttribute(
			'href',
			'https://example.com/capital-fund-2-deck.pdf#page=13'
		);
		await expect(page.getByText('CF2 annual financial audit completed by Armanino LLP.')).toBeVisible();
		await expect(page.locator('.field-evidence__link', { hasText: 'PPM · p.17 · line 3' })).toHaveAttribute(
			'href',
			'https://example.com/capital-fund-2-ppm.pdf#page=17'
		);
		await expect(page.getByText('80% of Company Net Cash Flow shall be distributed to the Class A Members and 20% to the Class B Member.')).toBeVisible();
		await expect(page.getByText('No source citation is saved for this field yet.').first()).toBeVisible();
		await expect(
			page.getByText('This saved value is still missing a supporting citation. Treat it as unresolved until a source is linked.').first()
		).toBeVisible();
	});

	test('summary save no longer throws failed-to-save when it should approve the deal', async ({ page }) => {
		const { lifecyclePatches } = await installReviewFlowMocks(page);
		await seedSession(page);

		await page.goto(`/deal-review?id=${DEAL_ID}&stage=summary&allowSummary=1&from=queue`);

		await expect(page.getByRole('heading', { name: 'Summary and publish readiness' })).toBeVisible();
		await expect.poll(() => lifecyclePatches.length).toBeGreaterThan(0);

		await page.getByRole('button', { name: 'Save changes' }).click();

		await expect(page.getByText(/approved and ready for publishing/i)).toBeVisible();
		await expect(page.getByText('Failed to save deal')).toHaveCount(0);
	});
});
