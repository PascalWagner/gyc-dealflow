/**
 * Shared Playwright API mocks.
 * Requires a Playwright Page instance — do NOT import from unit tests.
 *
 * Usage:
 *   await installCoreApiMocks(page);                    // default mocks
 *   await installCoreApiMocks(page, {
 *     '/api/buybox': { buyBox: { assetClasses: ['Industrial'] } }
 *   });                                                  // override specific endpoints
 */

import { fakeJwt, decodeAuthEmail } from './jwt.mjs';

const ADMIN_EMAIL = 'info@pascalwagner.com';
const IMPERSONATED_EMAIL = 'academy-user@example.com';
const SPONSOR_NAME = 'Yield Street';
const SPONSOR_ID = 'sponsor-yield-street';
const PERSON_NAME = 'Michael Weisz';

const DEFAULT_DEALS = [
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

const DEFAULT_USER_BUNDLES = {
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

const EMPTY_BUNDLE = { portfolio: [], stages: [], goals: [], taxdocs: [], plan: [] };

export { ADMIN_EMAIL, IMPERSONATED_EMAIL, SPONSOR_NAME, SPONSOR_ID, PERSON_NAME, DEFAULT_DEALS };

export async function installCoreApiMocks(page, overrides = {}) {
	// Helper: if an override exists for a pattern, use it directly
	function hasOverride(pattern) {
		return Object.keys(overrides).some((key) => pattern.includes(key));
	}

	async function fulfillOverride(route, pattern) {
		const key = Object.keys(overrides).find((k) => pattern.includes(k));
		if (key) {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(overrides[key])
			});
			return true;
		}
		return false;
	}

	await page.route('**/api/network**', async (route) => {
		if (await fulfillOverride(route, '/api/network')) return;
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
	});

	await page.route('**/api/auth**', async (route) => {
		if (await fulfillOverride(route, '/api/auth')) return;

		let body = {};
		try { body = route.request().postDataJSON() || {}; } catch { body = {}; }

		if (body?.action === 'lookup' && body?.email) {
			const email = String(body.email).toLowerCase();
			const name = email.split('@')[0];
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					email, name, fullName: name,
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
		if (await fulfillOverride(route, '/api/settings/membership')) return;
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ subscription: null }) });
	});

	await page.route('**/api/events**', async (route) => {
		if (await fulfillOverride(route, '/api/events')) return;
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
	});

	await page.route('**/api/deal-stats**', async (route) => {
		if (await fulfillOverride(route, '/api/deal-stats')) return;
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ stats: {} }) });
	});

	await page.route('**/api/member/deals**', async (route) => {
		if (await fulfillOverride(route, '/api/member/deals')) return;

		const url = new URL(route.request().url());
		const scope = url.searchParams.get('scope') || 'browse';
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				deals: DEFAULT_DEALS,
				scope,
				total: DEFAULT_DEALS.length,
				hasMore: false
			})
		});
	});

	await page.route('**/api/deals**', async (route) => {
		if (await fulfillOverride(route, '/api/deals')) return;

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
		if (await fulfillOverride(route, '/api/sponsor')) return;

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
		if (await fulfillOverride(route, '/api/person')) return;

		const url = new URL(route.request().url());
		if (url.searchParams.get('name') !== PERSON_NAME) {
			await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'Person not found' }) });
			return;
		}

		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({
				person: {
					name: PERSON_NAME,
					linkedIn: 'https://www.linkedin.com/in/michael-weisz/',
					companies: [{
						id: SPONSOR_ID, name: SPONSOR_NAME, role: 'CEO',
						website: 'https://example.com/yield-street', foundingYear: 2015,
						type: 'Operator', assetClasses: ['Industrial', 'Multi-Family'], dealCount: 2
					}],
					deals: [{
						id: 'deal-yield-1', name: 'Yield Street Industrial Fund', companyName: SPONSOR_NAME,
						assetClass: 'Industrial', dealType: 'Fund', targetIRR: 0.19, equityMultiple: 1.8,
						prefReturn: 0.08, minInvestment: 5000, holdPeriod: 5, status: 'Open', strategy: 'Core Plus'
					}],
					stats: { totalDeals: 2, totalFirms: 1, avgIRR: 0.175, avgPrefReturn: 0.075 }
				}
			})
		});
	});

	await page.route('**/api/background-check**', async (route) => {
		if (await fulfillOverride(route, '/api/background-check')) return;
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ results: [] }) });
	});

	await page.route('**/api/users**', async (route) => {
		if (await fulfillOverride(route, '/api/users')) return;

		const url = new URL(route.request().url());
		const query = (url.searchParams.get('q') || '').toLowerCase();
		const contacts = query.length >= 2
			? [{ email: IMPERSONATED_EMAIL, name: 'Academy User', fullName: 'Academy User', tier: 'academy' }]
			: [];
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: JSON.stringify({ success: true, contacts })
		});
	});

	await page.route('**/api/gp-onboarding**', async (route) => {
		if (await fulfillOverride(route, '/api/gp-onboarding')) return;
		const email = decodeAuthEmail(route.request().headers().authorization);
		if (route.request().method() === 'GET') {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					profile: {
						onboardingRole: 'lp',
						onboardingStep: 0,
						onboardingComplete: true,
						onboardingCompletedAt: new Date().toISOString()
					},
					company: null,
					teamContacts: [],
					dealCount: 0,
					hasBuyBox: true,
					agreementStatus: { hasCurrentAgreement: false, agreement: null }
				})
			});
			return;
		}
		await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
	});

	await page.route('**/api/buybox**', async (route) => {
		if (await fulfillOverride(route, '/api/buybox')) return;
		await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ buyBox: {} }) });
	});

	await page.route('**/api/userdata**', async (route) => {
		if (await fulfillOverride(route, '/api/userdata')) return;

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
			const bundle = DEFAULT_USER_BUNDLES[targetEmail] || EMPTY_BUNDLE;
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify(type ? { [type]: bundle[type] || [] } : bundle)
			});
			return;
		}

		const email = decodeAuthEmail(request.headers().authorization);
		const bundle = DEFAULT_USER_BUNDLES[email] || EMPTY_BUNDLE;
		const records = bundle[type] || [];

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
