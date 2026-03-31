import { getDealHistoricalReturns } from '../../../src/lib/utils/dealReturns.js';
import { getDealOperator } from '../../../src/lib/utils/dealSponsors.js';

export function computePublicDealStaleness(deal, now = new Date()) {
	const added = deal.added_date ? new Date(deal.added_date) : null;
	const monthsSinceAdded = added ? (now - added) / (1000 * 60 * 60 * 24 * 30.44) : null;
	const status = String(deal.status || '').toLowerCase();

	if (status === 'closed' || status === 'fully funded' || status === 'completed') {
		return { isStale: true, reason: 'closed' };
	}
	if (status === 'evergreen') {
		return { isStale: false, reason: null };
	}

	const dealType = String(deal.deal_type || '').toLowerCase();
	const threshold = dealType === 'syndication' ? 18 : 24;
	if (monthsSinceAdded && monthsSinceAdded > threshold) {
		return { isStale: true, reason: `added_${Math.round(monthsSinceAdded)}_months_ago` };
	}

	return { isStale: false, reason: null };
}

export function formatPublicDeal(deal, { shareClasses = null } = {}) {
	const managementCompany = deal.management_company || {};
	const operator = getDealOperator({
		managementCompany: managementCompany.operator_name || '',
		ceo: managementCompany.ceo || '',
		managementCompanyId: managementCompany.id || '',
		mcFoundingYear: managementCompany.founding_year,
		mcWebsite: managementCompany.website || ''
	});

	const formattedDeal = {
		id: deal.id,
		deal_number: deal.deal_number,
		name: deal.investment_name,
		asset_class: deal.asset_class,
		deal_type: deal.deal_type,
		status: deal.status,

		target_irr: deal.target_irr,
		equity_multiple: deal.equity_multiple,
		preferred_return: deal.preferred_return,
		cash_on_cash: deal.cash_on_cash,
		investment_minimum: deal.investment_minimum,
		lp_gp_split: deal.lp_gp_split,
		hold_period_years: deal.hold_period_years,
		sponsor_co_invest_pct: deal.sponsor_in_deal_pct,
		fees: deal.fees || [],

		offering_type: deal.offering_type,
		offering_size: deal.offering_size,
		investment_strategy: deal.investment_strategy,
		strategy: deal.strategy,
		instrument: deal.instrument,
		distributions: deal.distributions,
		financials: deal.financials,
		available_to: deal.available_to,
		first_yr_depreciation: deal.first_yr_depreciation,
		vertical_integration: deal.vertical_integration,

		geography: deal.investing_geography,
		location: deal.location,
		property_address: deal.property_address,

		debt_position: deal.debt_position,
		fund_aum: deal.fund_aum,
		loan_count: deal.loan_count,
		avg_loan_ltv: deal.avg_loan_ltv,

		operator: operator.managementCompanyId
			? {
				id: operator.managementCompanyId,
				name: operator.name,
				ceo: operator.ceo || '',
				website: operator.website || '',
				linkedin: managementCompany.linkedin_ceo || '',
				invest_clearly_profile: managementCompany.invest_clearly_profile || '',
				founding_year: operator.foundingYear,
				type: managementCompany.type || '',
				asset_classes: managementCompany.asset_classes || [],
				total_investors: managementCompany.total_investors,
				headquarters: managementCompany.headquarters,
				aum: managementCompany.aum,
				description: managementCompany.description,
				booking_url: managementCompany.booking_url,
				full_cycle_deals: managementCompany.full_cycle_deals || null
			}
			: null,

		share_classes: shareClasses,

		sec_cik: deal.sec_cik || null,
		date_of_first_sale: deal.date_of_first_sale,
		total_amount_sold: deal.total_amount_sold,
		total_investors: deal.total_investors,

		added_date: deal.added_date,
		updated_at: deal.updated_at
	};

	return {
		...formattedDeal,
		historical_returns: getDealHistoricalReturns({
			...deal,
			...formattedDeal
		}).map((entry) => ({
			year: entry.year,
			value: entry.value
		}))
	};
}
