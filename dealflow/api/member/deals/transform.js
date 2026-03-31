import { getDealHistoricalReturns } from '../../../src/lib/utils/dealReturns.js';
import { getDealOperator } from '../../../src/lib/utils/dealSponsors.js';
import { normalizeString } from './query.js';
import { getDealResolvedSlug, resolveDealLifecycleStatus, resolveDealVisibility } from '../../../src/lib/utils/dealWorkflow.js';

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

export function transformDeals(parentDeals, childShareClasses, sponsorRows) {
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

	const shareClassesByParent = {};
	for (const deal of childShareClasses || []) {
		if (!deal?.parent_deal_id) continue;
		if (!shareClassesByParent[deal.parent_deal_id]) shareClassesByParent[deal.parent_deal_id] = [];
		shareClassesByParent[deal.parent_deal_id].push({
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
	}

	return (parentDeals || []).map((deal) => {
		const managementCompany = deal.management_company || {};
		const staleness = computeStaleness(deal);
		const normalizedSponsors = sponsorsByDeal[deal.id] || [];
		const operator = getDealOperator({
			sponsors: normalizedSponsors,
			managementCompany: managementCompany.operator_name || '',
			sponsor: deal.sponsor_name || '',
			ceo: managementCompany.ceo || '',
			managementCompanyId: managementCompany.id || '',
			mcFoundingYear: managementCompany.founding_year,
			mcWebsite: managementCompany.website || ''
		});
		const normalizedDeal = {
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
			createdAt: deal.created_at,
			updatedAt: deal.updated_at,
			status: deal.status,
			lifecycleStatus: resolveDealLifecycleStatus(deal),
			isVisibleToUsers: resolveDealVisibility(deal),
			submissionIntent: deal.submission_intent || '',
			submissionSurface: deal.submission_surface || '',
			submittedByRole: deal.submitted_by_role || '',
			submittedByName: deal.submitted_by_name || '',
			submittedByEmail: deal.submitted_by_email || '',
			slug: getDealResolvedSlug(deal),
			offeringType: deal.offering_type,
			offeringSize: deal.offering_size,
			purchasePrice: deal.purchase_price,
			investingGeography: deal.investing_geography,
			investmentStrategy: deal.investment_strategy,
			distributions: deal.distributions,
			financials: deal.financials,
			availableTo: deal.available_to,
			sponsorInDeal: deal.sponsor_in_deal_pct,
			sponsorName: operator.name || '',
			ceo: operator.ceo || managementCompany.ceo || '',
			managementCompany: operator.name || '',
			managementCompanyId: operator.managementCompanyId || managementCompany.id || '',
			mcWebsite: operator.website || managementCompany.website || '',
			mcFoundingYear: operator.foundingYear || managementCompany.founding_year,
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
			shortSummary: deal.short_summary || '',
			coverImageUrl: deal.cover_image_url || deal.property_image_url || deal.image_url || '',
			heroMediaUrl: deal.hero_media_url || '',
			riskNotes: deal.risk_notes || '',
			downsideNotes: deal.downside_notes || '',
			deckUrl: deal.deck_url,
			ppmUrl: deal.ppm_url,
			subAgreementUrl: deal.sub_agreement_url,
			primarySourceContext: deal.primary_source_context || '',
			primarySourceUrl: deal.primary_source_url || '',
			cashYield: deal.cash_yield,
			feeSummary: deal.fee_summary || '',
			taxCharacteristics: deal.tax_characteristics || '',
			tags: deal.tags || [],
			operatorBackground: deal.operator_background || '',
			keyDates: deal.key_dates || '',
			parentDealId: deal.parent_deal_id,
			shareClassLabel: deal.share_class_label,
			verticalIntegration: deal.vertical_integration,
			caseStudy: deal.case_study || null,
			shareClasses: shareClassesByParent[deal.id] || null,
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
			sponsors: normalizedSponsors
		};

		return {
			...normalizedDeal,
			historicalReturns: getDealHistoricalReturns({
				...deal,
				...normalizedDeal
			})
		};
	});
}
