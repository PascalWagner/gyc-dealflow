import fs from 'node:fs';

import { getAdminClient, rateLimit, setCors } from './_supabase.js';
import { getDealHistoricalReturns } from '../src/lib/utils/dealReturns.js';

const SEC_DATA = JSON.parse(
	fs.readFileSync(new URL('../data/sec-market-data.json', import.meta.url), 'utf8')
);

const DEAL_SELECT = `
	*,
	management_company:management_companies (
		operator_name,
		ceo
	)
`;

export default async function handler(req, res) {
	setCors(res);

	if (req.method === 'OPTIONS') return res.status(200).end();
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
	if (!rateLimit(req, res)) return;

	res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');

	try {
		const supabase = getAdminClient();
		const { data, error } = await supabase
			.from('opportunities')
			.select(DEAL_SELECT)
			.not('investment_name', 'eq', '')
			.order('added_date', { ascending: false });

		if (error) throw error;

		return res.status(200).json({
			secData: SEC_DATA,
			deals: transformMarketIntelDeals(data || []),
			meta: {
				totalDeals: data?.length || 0,
				fetchedAt: new Date().toISOString()
			}
		});
	} catch (error) {
		console.error('market-intel error:', error);
		return res.status(500).json({
			error: 'Failed to load market intelligence data',
			message: error.message
		});
	}
}

function computeStaleness(deal) {
	const now = new Date();
	const added = deal.added_date ? new Date(deal.added_date) : null;
	const monthsSinceAdded = added ? (now - added) / (1000 * 60 * 60 * 24 * 30.44) : null;
	const status = String(deal.status || '').trim().toLowerCase();

	if (status === 'closed' || status === 'fully funded' || status === 'completed') {
		return { isStale: true, reason: 'Closed' };
	}

	if (status === 'evergreen') {
		return { isStale: false, reason: null };
	}

	const dealType = String(deal.deal_type || '').trim().toLowerCase();
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

function transformMarketIntelDeals(rows) {
	return rows
		.filter((row) => !row?.is_506b)
		.map((row) => {
			const managementCompany = row.management_company || {};
			const staleness = computeStaleness(row);

			return {
				id: row.id,
				investmentName: row.investment_name,
				assetClass: row.asset_class,
				dealType: row.deal_type,
				targetIRR: row.target_irr,
				preferredReturn: row.preferred_return,
				investmentMinimum: row.investment_minimum,
				lpGpSplit: row.lp_gp_split,
				holdPeriod: row.hold_period_years,
				addedDate: row.added_date,
				createdTime: row.created_at,
				status: row.status,
				offeringSize: row.offering_size,
				distributions: row.distributions,
				financials: row.financials,
				strategy: row.strategy,
				instrument: row.instrument,
				avgLoanLTV: row.avg_loan_ltv,
				avgLoanLTC: row.avg_loan_ltc,
				totalLoansUnderMgmt: row.total_loans_under_mgmt,
				equityCommitments: row.equity_commitments,
				performanceFeePct: row.performance_fee_pct,
				fundAUM: row.fund_aum,
				debtPosition: row.debt_position,
				dealSource: [],
				submittor: '',
				managementCompany: managementCompany.operator_name || '',
				ceo: managementCompany.ceo || '',
				historicalReturns: getDealHistoricalReturns(row),
				isStale: staleness.isStale,
				stalenessReason: staleness.reason
			};
		});
}
