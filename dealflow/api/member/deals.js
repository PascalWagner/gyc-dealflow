import {
	ADMIN_EMAILS,
	ASSET_MAP,
	getAdminClient,
	resolveUserFromAccessToken,
	rateLimit,
	setCors
} from '../_supabase.js';

const DEAL_SELECT = `*,
management_company:management_companies (
	id, operator_name, ceo, website, linkedin_ceo, invest_clearly_profile,
	founding_year, type, asset_classes, total_investors, authorized_emails, booking_url,
	ir_contact_name, ir_contact_email, full_cycle_deals
)`;

const SPONSOR_SELECT = `deal_id, role, is_primary, display_order,
company:management_companies (
	id, operator_name, ceo, website, linkedin_ceo,
	invest_clearly_profile, founding_year, type, asset_classes,
	total_investors, booking_url, full_cycle_deals
)`;

const ASSET_ALIASES = new Map();
for (const [source, target] of Object.entries(ASSET_MAP || {})) {
	ASSET_ALIASES.set(normalizeKey(source), target);
	ASSET_ALIASES.set(normalizeKey(target), target);
}

export default async function handler(req, res) {
	setCors(res);
	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
	if (!rateLimit(req, res)) return;

	const token = (req.headers.authorization || '').replace('Bearer ', '');
	if (!token) {
		return res.status(401).json({ error: 'Authorization token required' });
	}

	try {
		const { user } = await resolveUserFromAccessToken(token);
		if (!user?.email) {
			return res.status(401).json({ error: 'Invalid or expired token' });
		}

		const adminClient = getAdminClient();
		const [dealsResult, sponsorsResult, profileResult] = await Promise.all([
			adminClient
				.from('opportunities')
				.select(DEAL_SELECT)
				.not('investment_name', 'eq', '')
				.order('added_date', { ascending: false }),
			adminClient
				.from('deal_sponsors')
				.select(SPONSOR_SELECT)
				.order('display_order', { ascending: true }),
			user.id
				? adminClient
					.from('user_profiles')
					.select('is_admin')
					.eq('id', user.id)
					.maybeSingle()
				: Promise.resolve({ data: null, error: null })
		]);

		if (dealsResult.error) throw dealsResult.error;
		if (sponsorsResult.error) throw sponsorsResult.error;
		if (profileResult?.error) throw profileResult.error;

		const isAdmin =
			Boolean(profileResult?.data?.is_admin) ||
			ADMIN_EMAILS.includes(String(user.email || '').trim().toLowerCase());
		const query = req.query || {};
		const scope = String(query.scope || 'browse').trim().toLowerCase();
		const include506b = isAdmin;
		const allDeals = transformDeals(dealsResult.data || [], sponsorsResult.data || [], { include506b });
		const filteredDeals = filterDeals(allDeals, query, scope);
		const browseTotal = scope === 'browse' ? filteredDeals.length : null;
		const { deals, limit, offset, total, hasMore } = paginateDeals(filteredDeals, query, scope);

		return res.status(200).json({
			deals,
			pagination: {
				limit,
				offset,
				total,
				hasMore
			},
			meta: {
				scope,
				browseTotal
			}
		});
	} catch (error) {
		console.error('member/deals error:', error);
		return res.status(500).json({ error: 'Failed to load deals', message: error.message });
	}
}

function normalizeKey(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

function normalizeString(value) {
	return String(value || '').trim().toLowerCase();
}

function normalizeAssetClass(value) {
	const raw = String(value || '').trim();
	if (!raw) return '';
	return ASSET_ALIASES.get(normalizeKey(raw)) || raw;
}

function parseList(value) {
	return String(value || '')
		.split(',')
		.map((item) => item.trim())
		.filter(Boolean);
}

function toNumber(value) {
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : null;
}

function normalizePercentValue(value) {
	const numeric = toNumber(value);
	if (!Number.isFinite(numeric)) return null;
	return numeric > 1 ? numeric / 100 : numeric;
}

function equalsLoose(a, b) {
	return normalizeKey(a) === normalizeKey(b);
}

function includesLoose(haystack, needle) {
	return normalizeString(haystack).includes(normalizeString(needle));
}

function computeStaleness(deal) {
	const now = new Date();
	const added = deal.added_date ? new Date(deal.added_date) : null;
	const monthsSinceAdded = added ? (now - added) / (1000 * 60 * 60 * 24 * 30.44) : null;
	const status = normalizeString(deal.status);

	if (deal.archived === true) {
		return { isStale: true, reason: 'Archived by team' };
	}

	if (status === 'closed' || status === 'fully funded' || status === 'completed') {
		return { isStale: true, reason: 'Closed' };
	}

	if (status === 'evergreen') {
		return { isStale: false, reason: null };
	}

	const dealType = normalizeString(deal.deal_type);
	if (dealType === 'syndication') {
		if (monthsSinceAdded && monthsSinceAdded > 18) {
			return { isStale: true, reason: `Added ${Math.round(monthsSinceAdded)} months ago (syndication)` };
		}
		return { isStale: false, reason: null };
	}

	if (dealType === 'fund') {
		if (monthsSinceAdded && monthsSinceAdded > 24) {
			return { isStale: true, reason: `Added ${Math.round(monthsSinceAdded)} months ago (fund)` };
		}
		return { isStale: false, reason: null };
	}

	if (monthsSinceAdded && monthsSinceAdded > 24) {
		return { isStale: true, reason: `Added ${Math.round(monthsSinceAdded)} months ago` };
	}

	return { isStale: false, reason: null };
}

function transformDeals(allDeals, sponsorRows, { include506b = false } = {}) {
	const sponsorsByDeal = {};

	for (const row of sponsorRows || []) {
		if (!row?.company) continue;
		if (!sponsorsByDeal[row.deal_id]) sponsorsByDeal[row.deal_id] = [];
		sponsorsByDeal[row.deal_id].push({
			id: row.company.id,
			name: row.company.operator_name,
			ceo: row.company.ceo,
			role: row.role,
			isPrimary: row.is_primary,
			website: row.company.website || '',
			linkedin: row.company.linkedin_ceo || '',
			investClearly: row.company.invest_clearly_profile || '',
			foundingYear: row.company.founding_year,
			type: row.company.type || '',
			bookingUrl: row.company.booking_url || '',
			investmentCriteria: [],
			portfolioSnapshot: []
		});
	}

	const parentMap = {};
	const childIds = new Set();

	for (const deal of allDeals || []) {
		if (!deal?.parent_deal_id) continue;
		if (!parentMap[deal.parent_deal_id]) parentMap[deal.parent_deal_id] = [];
		parentMap[deal.parent_deal_id].push({
			id: deal.id,
			label: deal.share_class_label || deal.investment_name,
			targetReturn: deal.target_irr,
			preferredReturn: deal.preferred_return,
			investmentMinimum: deal.investment_minimum,
			lockup: deal.hold_period_years,
			lpGpSplit: deal.lp_gp_split,
			financials: deal.financials,
			cashOnCash: deal.cash_on_cash
		});
		childIds.add(deal.id);
	}

	return (allDeals || [])
		.filter((deal) => !childIds.has(deal.id))
		.filter((deal) => include506b || !deal.is_506b)
		.map((deal) => {
			const managementCompany = deal.management_company || {};
			const staleness = computeStaleness(deal);
			return {
				id: deal.id,
				dealNumber: deal.deal_number,
				investmentName: deal.investment_name,
				assetClass: deal.asset_class,
				dealType: deal.deal_type,
				targetIRR: deal.target_irr,
				equityMultiple: deal.equity_multiple,
				preferredReturn: deal.preferred_return,
				investmentMinimum: deal.investment_minimum,
				lpGpSplit: deal.lp_gp_split,
				holdPeriod: deal.hold_period_years,
				addedDate: deal.added_date,
				status: deal.status,
				offeringType: deal.offering_type,
				offeringSize: deal.offering_size,
				purchasePrice: deal.purchase_price,
				investingGeography: deal.investing_geography,
				investmentStrategy: deal.investment_strategy,
				distributions: deal.distributions,
				financials: deal.financials,
				availableTo: deal.available_to,
				sponsorInDeal: deal.sponsor_in_deal_pct,
				ceo: managementCompany.ceo || '',
				managementCompany: managementCompany.operator_name || '',
				managementCompanyId: managementCompany.id || '',
				mcWebsite: managementCompany.website || '',
				mcFoundingYear: managementCompany.founding_year,
				mcType: managementCompany.type || '',
				mcLinkedin: managementCompany.linkedin_ceo || '',
				mcInvestClearly: managementCompany.invest_clearly_profile || '',
				mcTotalInvestors: managementCompany.total_investors,
				mcBookingUrl: managementCompany.booking_url || '',
				mcAuthorizedEmails: managementCompany.authorized_emails || [],
				mcIrContactName: managementCompany.ir_contact_name || '',
				mcIrContactEmail: managementCompany.ir_contact_email || '',
				mcFullCycleDeals: managementCompany.full_cycle_deals || null,
				fees: deal.fees || [],
				firstYrDepreciation: deal.first_yr_depreciation,
				strategy: deal.strategy,
				instrument: deal.instrument,
				cashOnCash: deal.cash_on_cash,
				debtPosition: deal.debt_position,
				fundAUM: deal.fund_aum,
				loanCount: deal.loan_count,
				avgLoanLTV: deal.avg_loan_ltv,
				location: deal.location,
				address: deal.property_address,
				deckUrl: deal.deck_url,
				ppmUrl: deal.ppm_url,
				subAgreementUrl: deal.sub_agreement_url,
				parentDealId: deal.parent_deal_id,
				shareClassLabel: deal.share_class_label,
				verticalIntegration: deal.vertical_integration,
				caseStudy: deal.case_study || null,
				shareClasses: parentMap[deal.id] || null,
				isStale: staleness.isStale,
				stalenessReason: staleness.reason,
				archived: deal.archived === true,
				unitCount: deal.unit_count,
				yearBuilt: deal.year_built,
				squareFootage: deal.square_footage,
				occupancyPct: deal.occupancy_pct,
				propertyType: deal.property_type,
				acquisitionLoan: deal.acquisition_loan,
				loanToValue: deal.loan_to_value,
				loanRate: deal.loan_rate,
				loanTermYears: deal.loan_term_years,
				loanIOYears: deal.loan_io_years,
				capexBudget: deal.capex_budget,
				closingCosts: deal.closing_costs,
				acquisitionFeePct: deal.acquisition_fee_pct,
				assetMgmtFeePct: deal.asset_mgmt_fee_pct,
				propertyMgmtFeePct: deal.property_mgmt_fee_pct,
				capitalEventFeePct: deal.capital_event_fee_pct,
				dispositionFeePct: deal.disposition_fee_pct,
				constructionMgmtFeePct: deal.construction_mgmt_fee_pct,
				waterfallDetails: deal.waterfall_details,
				secCik: deal.sec_cik || '',
				secEntityName: deal.sec_entity_name || '',
				dateOfFirstSale: deal.date_of_first_sale,
				totalAmountSold: deal.total_amount_sold,
				totalInvestors: deal.total_investors,
				pctFunded:
					deal.total_amount_sold && deal.offering_size && deal.offering_size > 0
						? Math.round((deal.total_amount_sold / deal.offering_size) * 100)
						: null,
				is506b: deal.is_506b || false,
				issuerEntity: deal.issuer_entity || '',
				gpEntity: deal.gp_entity || '',
				sponsorEntity: deal.sponsor_entity || '',
				sponsors: sponsorsByDeal[deal.id] || []
			};
		});
}

function filterDeals(allDeals, query, scope) {
	const ids = new Set(parseList(query.ids));
	const excludedIds = new Set(parseList(query.exclude_ids));
	const search = String(query.q || '').trim();
	const includeArchived = query.include_archived === 'true';
	const assetClass = normalizeAssetClass(query.asset_class);
	const assetClassIn = parseList(query.asset_class_in).map(normalizeAssetClass).filter(Boolean);
	const dealType = String(query.deal_type || '').trim();
	const dealTypeIn = parseList(query.deal_type_in);
	const strategy = String(query.strategy || '').trim();
	const strategyIn = parseList(query.strategy_in);
	const matchAnyStrategyOrDealType = query.match_any_strategy_or_deal_type === 'true';
	const status = String(query.status || '').trim();
	const distributions = String(query.distributions || '').trim();
	const maxMinimum = toNumber(query.max_minimum);
	const maxHoldYears = toNumber(query.max_hold_years);
	const minIrr = normalizePercentValue(query.min_irr);
	const company = String(query.company || '').trim();
	const managementCompanyId = String(query.management_company_id || '').trim();

	let deals = (allDeals || []).filter((deal) => {
		if (scope === 'ids') return ids.has(deal.id);
		if (scope === 'browse' && excludedIds.has(deal.id)) return false;
		return true;
	});

	if (scope === 'browse' && !includeArchived && !search) {
		deals = deals.filter((deal) => !deal.isStale);
	}

	if (assetClass) {
		deals = deals.filter((deal) => normalizeAssetClass(deal.assetClass) === assetClass);
	}

	if (assetClassIn.length) {
		deals = deals.filter((deal) => assetClassIn.includes(normalizeAssetClass(deal.assetClass)));
	}

	if (dealType) {
		deals = deals.filter((deal) => equalsLoose(deal.dealType, dealType));
	}

	if (dealTypeIn.length && !matchAnyStrategyOrDealType) {
		deals = deals.filter((deal) => dealTypeIn.some((value) => equalsLoose(deal.dealType, value)));
	}

	if (strategy) {
		deals = deals.filter((deal) => equalsLoose(deal.strategy, strategy));
	}

	if (strategyIn.length && !matchAnyStrategyOrDealType) {
		deals = deals.filter((deal) => strategyIn.some((value) => equalsLoose(deal.strategy, value)));
	}

	if ((dealTypeIn.length || strategyIn.length) && matchAnyStrategyOrDealType) {
		deals = deals.filter((deal) => {
			const dealTypeMatch = dealTypeIn.some((value) => equalsLoose(deal.dealType, value));
			const strategyMatch = strategyIn.some((value) => equalsLoose(deal.strategy, value));
			return dealTypeMatch || strategyMatch;
		});
	}

	if (status) {
		deals = deals.filter((deal) => equalsLoose(deal.status, status));
	}

	if (distributions) {
		deals = deals.filter((deal) => equalsLoose(deal.distributions, distributions));
	}

	if (Number.isFinite(maxMinimum)) {
		deals = deals.filter((deal) => {
			const minimum = toNumber(deal.investmentMinimum);
			return minimum === null ? true : minimum <= maxMinimum;
		});
	}

	if (Number.isFinite(maxHoldYears)) {
		deals = deals.filter((deal) => {
			const holdPeriod = toNumber(deal.holdPeriod);
			return holdPeriod === null ? true : holdPeriod <= maxHoldYears;
		});
	}

	if (Number.isFinite(minIrr)) {
		deals = deals.filter((deal) => {
			const irr = normalizePercentValue(deal.targetIRR);
			return irr !== null && irr >= minIrr;
		});
	}

	if (company) {
		deals = deals.filter((deal) => includesLoose(deal.managementCompany, company));
	}

	if (managementCompanyId) {
		deals = deals.filter((deal) => String(deal.managementCompanyId || '') === managementCompanyId);
	}

	if (search) {
		const needle = normalizeString(search);
		deals = deals.filter((deal) => buildSearchHaystack(deal).includes(needle));
	}

	return sortDeals(deals, query.sort);
}

function buildSearchHaystack(deal) {
	const sponsorNames = (deal.sponsors || [])
		.map((sponsor) => [sponsor?.name, sponsor?.ceo].filter(Boolean).join(' '))
		.join(' ');

	return [
		deal.investmentName,
		deal.managementCompany,
		deal.assetClass,
		deal.ceo,
		deal.location,
		deal.investingGeography,
		deal.investmentStrategy,
		deal.strategy,
		deal.dealType,
		deal.offeringType,
		deal.address,
		sponsorNames
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();
}

function sortDeals(deals, sortBy) {
	const list = [...(deals || [])];
	const normalizedSort = String(sortBy || 'newest').trim().toLowerCase();

	if (normalizedSort === 'irr') {
		list.sort((a, b) => (toNumber(b.targetIRR) || 0) - (toNumber(a.targetIRR) || 0));
		return list;
	}

	if (normalizedSort === 'min_invest') {
		list.sort((a, b) => (toNumber(a.investmentMinimum) || 0) - (toNumber(b.investmentMinimum) || 0));
		return list;
	}

	if (normalizedSort === 'az') {
		list.sort((a, b) => String(a.investmentName || '').localeCompare(String(b.investmentName || '')));
		return list;
	}

	if (normalizedSort === 'best_match') {
		list.sort((a, b) => scoreBestMatch(b) - scoreBestMatch(a) || compareNewest(a, b));
		return list;
	}

	list.sort(compareNewest);
	return list;
}

function scoreBestMatch(deal) {
	const docScore = deal.deckUrl ? 2 : (deal.ppmUrl || deal.subAgreementUrl) ? 1 : 0;
	const fundingScore = Number.isFinite(toNumber(deal.pctFunded))
		? Math.min(100, Math.max(0, toNumber(deal.pctFunded))) / 100
		: 0;
	const irrScore = normalizePercentValue(deal.targetIRR) || 0;
	return docScore * 1000 + fundingScore * 100 + irrScore * 10;
}

function compareNewest(a, b) {
	const aTime = Date.parse(a.addedDate || '') || 0;
	const bTime = Date.parse(b.addedDate || '') || 0;
	return bTime - aTime;
}

function paginateDeals(filteredDeals, query, scope) {
	const total = filteredDeals.length;
	if (scope === 'catalog') {
		return {
			deals: filteredDeals,
			limit: total,
			offset: 0,
			total,
			hasMore: false
		};
	}

	const requestedLimit = Number.parseInt(query.limit || '24', 10);
	const requestedOffset = Number.parseInt(query.offset || '0', 10);
	const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 24;
	const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0;
	const deals = filteredDeals.slice(offset, offset + limit);

	return {
		deals,
		limit,
		offset,
		total,
		hasMore: offset + deals.length < total
	};
}
