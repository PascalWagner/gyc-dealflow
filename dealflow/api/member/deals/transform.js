import { getDealHistoricalReturns } from '../../../src/lib/utils/dealReturns.js';
import { getDealOperator } from '../../../src/lib/utils/dealSponsors.js';
import { normalizeString } from './query.js';
import { getDealResolvedSlug, resolveDealLifecycleStatus, resolveDealVisibility } from '../../../src/lib/utils/dealWorkflow.js';

const HISTORICAL_RETURN_START_YEAR = 2015;
const HISTORICAL_RETURN_END_YEAR = new Date().getFullYear() - 1;
const HISTORICAL_RETURN_YEARS = Array.from(
	{ length: Math.max(0, HISTORICAL_RETURN_END_YEAR - HISTORICAL_RETURN_START_YEAR + 1) },
	(_, index) => HISTORICAL_RETURN_START_YEAR + index
);
const STATE_CODE_PATTERN = /\b(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY|DC)\b/gi;
const EXPOSURE_KEYWORDS = [
	{ option: 'Single Family', patterns: [/\bsingle[\s-]?family\b/i, /\bresidential\b/i] },
	{ option: 'Commercial Real Estate', patterns: [/\bcommercial\b/i] },
	{ option: 'Multifamily', patterns: [/\bmulti[\s-]?family\b/i, /\bmultifamily\b/i] },
	{ option: 'Land', patterns: [/\bland\b/i] },
	{ option: 'Mixed Portfolio', patterns: [/\bmixed portfolio\b/i] }
];
const RISK_TAG_KEYWORDS = [
	{ option: 'Leverage', patterns: [/\bleverage\b/i, /\bcredit facilit/i] },
	{ option: 'Liquidity', patterns: [/\bliquid/i, /\bredemption\b/i, /\bavailable capital\b/i] },
	{ option: 'Credit Loss', patterns: [/\bcredit loss\b/i, /\bdefault\b/i, /\bforeclos/i, /\breo\b/i] },
	{ option: 'Concentration', patterns: [/\bconcentration\b/i, /\bstate exposure\b/i] },
	{ option: 'Underwriting', patterns: [/\bunderwriting\b/i, /\bcollateral\b/i, /\bltv\b/i] },
	{ option: 'Execution', patterns: [/\bexpansion\b/i, /\bnew market\b/i] },
	{ option: 'Regulatory', patterns: [/\bregulation\b/i, /\bregulatory\b/i, /\b506\(/i] },
	{ option: 'Operational', patterns: [/\bservic/i, /\boperations?\b/i] }
];
const MONTH_INDEX = {
	january: '01',
	february: '02',
	march: '03',
	april: '04',
	may: '05',
	june: '06',
	july: '07',
	august: '08',
	september: '09',
	october: '10',
	november: '11',
	december: '12'
};

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

function inferStateCodesFromText(text) {
	const matches = new Set();
	for (const match of String(text || '').matchAll(STATE_CODE_PATTERN)) {
		matches.add(match[1].toUpperCase());
	}
	return [...matches];
}

function inferExposureTypes(deal) {
	const source = [
		deal?.investment_strategy,
		deal?.short_summary,
		deal?.asset_class,
		deal?.strategy
	].filter(Boolean).join(' ');
	const matches = [];
	for (const candidate of EXPOSURE_KEYWORDS) {
		if (candidate.patterns.some((pattern) => pattern.test(source))) {
			matches.push(candidate.option);
		}
	}
	return matches;
}

function inferRiskTags(deal) {
	const source = [
		...(Array.isArray(deal?.highlighted_risks) ? deal.highlighted_risks : []),
		...(Array.isArray(deal?.source_risk_factors) ? deal.source_risk_factors : []),
		deal?.risk_notes,
		deal?.downside_notes,
		deal?.key_dates
	].filter(Boolean).join(' ');
	const matches = [];
	for (const candidate of RISK_TAG_KEYWORDS) {
		if (candidate.patterns.some((pattern) => pattern.test(source))) {
			matches.push(candidate.option);
		}
	}
	return matches;
}

function inferFundFoundedYear(deal) {
	const explicitYear = deal?.fund_founded_year ?? deal?.founded_year ?? null;
	if (explicitYear) return explicitYear;

	const source = [deal?.key_dates, deal?.operator_background, deal?.primary_source_context]
		.filter(Boolean)
		.join(' ');
	const labeledMatch = source.match(/\b(?:fund founded|fund formed|formed).{0,32}?\b((?:19|20)\d{2})\b/i);
	if (labeledMatch) {
		return Number(labeledMatch[1]);
	}

	const saleYear = String(deal?.date_of_first_sale || '').match(/\b(19|20)\d{2}\b/);
	return saleYear ? Number(saleYear[0]) : null;
}

function formatMonthDayYearToIso(dateLabel) {
	const match = String(dateLabel || '').match(
		/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s*((?:19|20)\d{2})\b/i
	);
	if (!match) return null;

	const month = MONTH_INDEX[match[1].toLowerCase()];
	const day = match[2].padStart(2, '0');
	const year = match[3];
	return `${year}-${month}-${day}`;
}

function inferSnapshotAsOfDate(deal) {
	if (deal?.snapshot_as_of_date) return deal.snapshot_as_of_date;

	const source = [deal?.key_dates, deal?.primary_source_context]
		.filter(Boolean)
		.join(' ');
	const snapshotMatch =
		source.match(/\bsnapshot(?:\s+(?:dated|as of))?.{0,20}?\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(?:19|20)\d{2}\b/i)
		|| source.match(/\b(?:as of|dated)\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},\s+(?:19|20)\d{2}\b/i);

	if (!snapshotMatch) return null;
	const dateText = snapshotMatch[0]
		.replace(/^(?:snapshot(?:\s+(?:dated|as of))?|as of|dated)\s+/i, '')
		.trim();
	return formatMonthDayYearToIso(dateText);
}

function inferCurrentLeverage(deal, currentFundSize) {
	if (deal?.current_leverage != null) return deal.current_leverage;
	if (!currentFundSize) return null;

	const fundAum = Number(deal?.fund_aum);
	if (!Number.isFinite(fundAum) || fundAum <= currentFundSize) return null;

	return Number(((fundAum - currentFundSize) / currentFundSize).toFixed(2));
}

function inferMaxAllowedLeverage(deal, maxAllowedLtv) {
	if (deal?.max_allowed_leverage != null) return deal.max_allowed_leverage;
	const ltv = Number(maxAllowedLtv);
	if (!Number.isFinite(ltv) || ltv <= 0 || ltv >= 1) return null;
	return Number((ltv / (1 - ltv)).toFixed(2));
}

function inferRedemptionFrequency(deal) {
	if (deal?.redemption) return deal.redemption;
	const source = [deal?.short_summary, deal?.primary_source_context, deal?.risk_notes]
		.filter(Boolean)
		.join(' ');
	if (/\bredemption\b/i.test(source) && /\bmonth/i.test(source)) return 'Monthly';
	return '';
}

function inferTaxForm(deal) {
	if (deal?.tax_form) return deal.tax_form;
	const source = [deal?.tax_characteristics, deal?.primary_source_context].filter(Boolean).join(' ');
	if (/\bk-?1\b/i.test(source) || /\bpartnership\b/i.test(source)) return 'K-1';
	return '';
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
			financials: deal.financials || deal.auditing || null,
			auditing: deal.auditing || deal.financials,
			cashOnCash: deal.cash_on_cash
		});
	}

	return (parentDeals || []).map((deal) => {
		const managementCompany = deal.management_company || {};
		const staleness = computeStaleness(deal);
		const normalizedSponsors = sponsorsByDeal[deal.id] || [];
		const inferredInvestingStates = deal.investing_states || inferStateCodesFromText(deal.investing_geography);
		const inferredExposureTypes = deal.underlying_exposure_types || inferExposureTypes(deal);
		const inferredCurrentFundSize = deal.current_fund_size ?? deal.offering_size ?? null;
		const inferredMaxAllowedLtv = deal.max_allowed_ltv ?? deal.loan_to_value ?? null;
		const inferredCurrentAvgLoanLtv = deal.current_avg_loan_ltv ?? deal.avg_loan_ltv ?? deal.loan_to_value ?? null;
		const inferredFundFoundedYear = inferFundFoundedYear(deal);
		const inferredSnapshotAsOfDate = inferSnapshotAsOfDate(deal);
		const inferredRiskTags = deal.risk_tags || inferRiskTags(deal);
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
			dealBranch: deal.deal_branch || '',
			deal_branch: deal.deal_branch || '',
			dealType: deal.deal_type,
			targetIRR: deal.target_irr,
			equityMultiple: deal.equity_multiple,
			preferredReturn: deal.preferred_return,
			investmentMinimum: deal.investment_minimum,
			lpGpSplit: deal.lp_gp_split,
			holdPeriod: deal.hold_period_years,
			fundFoundedYear: inferredFundFoundedYear,
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
			investingStates: inferredInvestingStates,
			investmentStrategy: deal.investment_strategy,
			underlyingExposureTypes: inferredExposureTypes,
			distributions: deal.distributions,
			financials: deal.financials,
			auditing: deal.auditing || deal.financials || deal.audit_status || null,
			availableTo: deal.available_to,
			sponsorInDeal: deal.sponsor_in_deal_pct,
			sponsorName: operator.name || '',
			ceo: operator.ceo || managementCompany.ceo || '',
			managementCompany: operator.name || '',
			managementCompanyId: operator.managementCompanyId || managementCompany.id || '',
			mcWebsite: operator.website || managementCompany.website || '',
			companyWebsite: operator.website || managementCompany.website || '',
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
			redemption: deal.redemption || deal.liquidity_terms || deal.liquidityTerms || inferRedemptionFrequency(deal) || null,
			redemptionNotes: deal.redemption_notes || '',
			fundAUM: deal.fund_aum,
			managerAUM: deal.manager_aum || deal.management_company_aum || deal.fund_aum || null,
			loanCount: deal.loan_count,
			avgLoanLTV: deal.avg_loan_ltv,
			currentLoanCount: deal.current_loan_count || deal.loan_count || null,
			currentAvgLoanLtv: inferredCurrentAvgLoanLtv,
			maxAllowedLtv: inferredMaxAllowedLtv,
			currentLeverage: inferCurrentLeverage(deal, inferredCurrentFundSize),
			maxAllowedLeverage: inferMaxAllowedLeverage(deal, inferredMaxAllowedLtv),
			currentFundSize: inferredCurrentFundSize,
			maxFundSize: deal.max_fund_size || deal.offering_size || null,
			snapshotAsOfDate: inferredSnapshotAsOfDate,
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
			additionalTermNotes: deal.additional_term_notes || '',
			taxForm: inferTaxForm(deal),
			taxCharacteristics: deal.tax_characteristics || '',
			tags: deal.tags || [],
			operatorBackground: deal.operator_background || '',
			keyDates: deal.key_dates || '',
			riskTags: inferredRiskTags,
			firmFoundedYear: managementCompany.founding_year || null,
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
			teamContactsSnapshotSupported: Object.prototype.hasOwnProperty.call(deal, 'team_contacts'),
			teamContacts: deal.team_contacts || [],
			sourceRiskFactors: deal.source_risk_factors || [],
			highlightedRisks: deal.highlighted_risks || [],
			sponsors: normalizedSponsors
		};

		const fallbackHistoricalReturnYear = HISTORICAL_RETURN_YEARS[HISTORICAL_RETURN_YEARS.length - 1] || null;
		const fallbackHistoricalReturnValue = deal.cash_yield ?? deal.cash_on_cash ?? null;
		for (const year of HISTORICAL_RETURN_YEARS) {
			const explicitReturn = deal[`historical_return_${year}`];
			if (explicitReturn != null) {
				normalizedDeal[`historicalReturn${year}`] = explicitReturn;
				continue;
			}

			normalizedDeal[`historicalReturn${year}`] =
				year === fallbackHistoricalReturnYear ? fallbackHistoricalReturnValue : null;
		}

		return {
			...normalizedDeal,
			historicalReturns: getDealHistoricalReturns({
				...deal,
				...normalizedDeal
			})
		};
	});
}
