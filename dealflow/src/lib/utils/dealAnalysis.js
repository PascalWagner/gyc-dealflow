/**
 * Deal Analysis Utilities
 *
 * Summary line builders, risk/compensation/gaps framework,
 * and goal-path projection helpers for the LP deal page.
 */

import { getDealOperatorName } from './dealSponsors.js';
import { normalizeAssetClassValue } from './dealReviewSchema.js';

// ===== Summary Line Builders =====
// Each returns a short factual sentence (no judgments) for accordion headers.

export function buildLegitimacySummary(deal, secFiling) {
	if (!deal) return 'No deal data available.';
	const parts = [];
	if (secFiling?.hasFiling && secFiling.offeringType) {
		parts.push(`SEC filed (${secFiling.offeringType})`);
	} else if (deal.secCik) {
		parts.push('SEC filed');
	}
	if (deal.addedDate) {
		const months = Math.round((Date.now() - new Date(deal.addedDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
		if (months > 0) parts.push(`In database ${months} month${months !== 1 ? 's' : ''}`);
	}
	if (secFiling?.totalInvestors) {
		parts.push(`${secFiling.totalInvestors} LPs`);
	}
	if (parts.length === 0) return 'Legitimacy data not yet available.';
	return parts.join(' · ');
}

export function buildSponsorSummary(deal) {
	if (!deal) return 'No sponsor data available.';
	const parts = [];
	const operatorName = getDealOperatorName(deal, '');
	if (operatorName) parts.push(operatorName);
	if (deal.mcFoundingYear) {
		parts.push(`Est. ${deal.mcFoundingYear}`);
	}
	if (deal.fundAUM) parts.push(formatMoneyShort(deal.fundAUM) + ' AUM');
	const fullCycleDeals = deal.mcFullCycleExits ?? deal.mcFullCycleDeals;
	if (fullCycleDeals) {
		parts.push(`${fullCycleDeals} full-cycle exit${fullCycleDeals !== 1 ? 's' : ''}`);
	} else if (deal.mcFoundingYear) {
		const years = new Date().getFullYear() - deal.mcFoundingYear;
		if (years >= 5) parts.push(`${years}+ yr track record`);
	}
	if (parts.length === 0) return 'Sponsor details have not been structured yet.';
	return parts.join(' · ');
}

export function buildStructureSummary(deal) {
	if (!deal) return 'No deal data available.';
	const parts = [];
	if (deal.fees) {
		const m = String(deal.fees).match(/([\d.]+)\s*%/);
		if (m) parts.push(`${m[1]}% fee`);
	}
	if (deal.lpGpSplit) parts.push(deal.lpGpSplit);
	if (deal.preferredReturn) {
		const pref = deal.preferredReturn > 1 ? deal.preferredReturn : deal.preferredReturn * 100;
		parts.push(`${pref.toFixed(0)}% pref`);
	}
	if (deal.offeringType) parts.push(deal.offeringType);
	if (parts.length === 0) return 'Structure details have not been added yet.';
	return parts.join(' · ');
}

export function buildReturnsSummary(deal) {
	if (!deal) return 'No deal data available.';
	const parts = [];
	const yieldRate = deal.preferredReturn || deal.cashOnCash;
	if (yieldRate) {
		const pct = yieldRate > 1 ? yieldRate : yieldRate * 100;
		parts.push(`${pct.toFixed(1)}% yield`);
	}
	if (deal.distributions && deal.distributions !== 'Unknown' && deal.distributions !== 'None') {
		parts.push(deal.distributions);
	}
	if (deal.targetIRR) {
		const irr = deal.targetIRR > 1 ? deal.targetIRR : deal.targetIRR * 100;
		parts.push(`${irr.toFixed(1)}% target IRR`);
	}
	if (parts.length === 0) return 'Return data not yet available.';
	return parts.join(' · ');
}

export function buildRiskCompSummary(deal, rcg) {
	if (!deal) return 'No deal data available.';
	const parts = [];
	if (rcg?.risks?.length > 0) parts.push(`${rcg.risks.length} risk${rcg.risks.length > 1 ? 's' : ''}`);
	if (rcg?.compensations?.length > 0) parts.push(`${rcg.compensations.length} compensation`);
	if (rcg?.gaps?.length > 0) parts.push(`${rcg.gaps.length} gap${rcg.gaps.length > 1 ? 's' : ''}`);
	if (parts.length === 0) return 'No identified risks or data gaps at this time.';
	return parts.join(' · ');
}


// ===== Data Completeness =====

const ALL_TRACKED_FIELDS = [
	'targetIRR', 'investmentMinimum', 'holdPeriod', 'offeringType',
	'distributions', 'fees', 'managementCompany', 'investingGeography',
	'deckUrl', 'strategy', 'preferredReturn', 'cashOnCash',
	'equityMultiple', 'sponsorInDeal', 'mcFoundingYear', 'fundAUM',
	'ceo', 'assetClass', 'dealType', 'status', 'secCik',
	'lpGpSplit', 'availableTo', 'offeringSize'
];

export function computeDataCompleteness(deal) {
	if (!deal) return { filled: 0, total: ALL_TRACKED_FIELDS.length, pct: 0 };
	let filled = 0;
	for (const key of ALL_TRACKED_FIELDS) {
		const val = deal[key];
		if (val !== null && val !== undefined && val !== '' && val !== 0) {
			if (key === 'distributions' && (val === 'Unknown' || val === 'None')) continue;
			filled++;
		}
	}
	const total = ALL_TRACKED_FIELDS.length;
	return { filled, total, pct: Math.round((filled / total) * 100) };
}


// ===== Risk / Compensation / Gaps Framework =====

export function buildRiskCompensationGaps(deal) {
	if (!deal) return { risks: [], compensations: [], gaps: [] };

	const risks = buildIdentifiedRisks(deal);
	const compensations = extractCompensation(deal);
	const gaps = computeDataGaps(deal);

	return { risks, compensations, gaps };
}

function buildIdentifiedRisks(deal) {
	const risks = [];

	// Staleness
	const status = (deal.status || '').toLowerCase();
	if (['closed', 'fully funded', 'completed'].includes(status)) {
		risks.push({ label: 'Deal Status', detail: `This deal is listed as "${deal.status}" and may no longer accept new capital.` });
	} else if (deal.addedDate) {
		const months = (Date.now() - new Date(deal.addedDate).getTime()) / (1000 * 60 * 60 * 24 * 30.44);
		const dt = (deal.dealType || '').toLowerCase();
		if (dt === 'syndication' && months > 18) {
			risks.push({ label: 'Aging Deal', detail: `Added ${Math.round(months)} months ago. Syndications typically close within 12-18 months.` });
		} else if (months > 24) {
			risks.push({ label: 'Aging Deal', detail: `Added ${Math.round(months)} months ago. May no longer be actively raising.` });
		}
	}

	// Liquidity
	if (deal.holdPeriod) {
		const hold = parseFloat(deal.holdPeriod);
		if (hold >= 5) {
			risks.push({ label: 'Liquidity risk', detail: `Your capital is locked for ${hold} years. There is no redemption provision for early exit.` });
		}
	}

	// Operator track record
	if (deal.mcFoundingYear) {
		const years = new Date().getFullYear() - deal.mcFoundingYear;
		if (years < 3) {
			risks.push({ label: 'Newer Operator', detail: `${getDealOperatorName(deal, 'Sponsor')} has ${years} year${years !== 1 ? 's' : ''} of operating history.` });
		}
	}

	// Fee concerns
	if (deal.fees) {
		const mgmtMatch = String(deal.fees).match(/([\d.]+)\s*%/);
		if (mgmtMatch && parseFloat(mgmtMatch[1]) > 2) {
			risks.push({ label: 'Above-Market Fees', detail: `Management fee of ${mgmtMatch[1]}% exceeds the typical 1-2% range.` });
		}
	}

	// Execution risk
	const dt = (deal.dealType || '').toLowerCase();
	if (dt.includes('lend') || dt.includes('debt')) {
		risks.push({ label: 'Execution risk', detail: 'Returns depend on the sponsor deploying capital into quality loans on schedule.' });
	} else if (dt.includes('develop')) {
		risks.push({ label: 'Execution risk', detail: 'Development deals carry construction, permitting, and timeline risk.' });
	}

	// Interest rate risk for debt/lending
	if (dt.includes('lend') || dt.includes('debt')) {
		risks.push({ label: 'Interest rate risk', detail: 'Fund yields may fluctuate with changes in the broader interest rate environment.' });
	}

	// Return benchmarks
	if (deal.targetIRR) {
		const irr = deal.targetIRR > 1 ? deal.targetIRR : deal.targetIRR * 100;
		if (irr < 8) {
			risks.push({ label: 'Below-Benchmark Returns', detail: `Target IRR of ${irr.toFixed(1)}% is below the 8% common threshold for this asset class.` });
		}
	}

	// Missing management company
	if (!deal.managementCompanyId && !getDealOperatorName(deal, '')) {
		risks.push({ label: 'Unknown Operator', detail: 'No management company is linked to this deal record.' });
	}

	return risks;
}

function extractCompensation(deal) {
	const items = [];

	if (deal.preferredReturn) {
		const pref = deal.preferredReturn > 1 ? deal.preferredReturn : deal.preferredReturn * 100;
		items.push({ label: 'Preferred return', value: `${pref.toFixed(1)}%`, detail: 'you get paid first' });
	}

	if (deal.lpGpSplit) {
		items.push({ label: deal.lpGpSplit, value: '', detail: 'LP-favorable split after pref hurdle' });
	}

	if (deal.distributions && deal.distributions !== 'Unknown' && deal.distributions !== 'None') {
		items.push({ label: deal.distributions.toLowerCase(), value: '', detail: `${deal.distributions.toLowerCase()} distributions for regular cash` });
	}

	if (deal.sponsorInDeal) {
		const pct = deal.sponsorInDeal > 1 ? deal.sponsorInDeal : deal.sponsorInDeal * 100;
		items.push({ label: `${pct.toFixed(0)}%`, value: '', detail: 'sponsor co-investing alongside LPs' });
	}

	if (deal.targetIRR) {
		const irr = deal.targetIRR > 1 ? deal.targetIRR : deal.targetIRR * 100;
		items.push({ label: 'Target IRR', value: `${irr.toFixed(1)}%`, detail: 'projected total annualized return' });
	}

	if (deal.equityMultiple) {
		items.push({ label: 'Equity Multiple', value: `${deal.equityMultiple.toFixed(2)}x`, detail: 'total cash returned per dollar invested' });
	}

	return items;
}

export function computeDataGaps(deal) {
	if (!deal) return [];
	const gaps = [];
	const criticalFields = [
		{ key: 'targetIRR', label: 'Target IRR' },
		{ key: 'investmentMinimum', label: 'Minimum Investment' },
		{ key: 'holdPeriod', label: 'Hold Period' },
		{ key: 'offeringType', label: 'Offering Type' },
		{ key: 'distributions', label: 'Distribution Frequency' },
		{ key: 'fees', label: 'Fee Schedule' },
		{ key: 'managementCompany', label: 'Management Company' },
		{ key: 'investingGeography', label: 'Investing Geography' },
		{ key: 'deckUrl', label: 'Investment Deck' },
		{ key: 'strategy', label: 'Investment Strategy' }
	];

	for (const field of criticalFields) {
		const val = deal[field.key];
		if (val === null || val === undefined || val === '' || val === 0) {
			gaps.push({ field: field.key, label: field.label });
		} else if (field.key === 'distributions' && (val === 'Unknown' || val === 'None')) {
			gaps.push({ field: field.key, label: field.label });
		}
	}

	return gaps;
}


// ===== Goal-Path Projection Helpers =====

export function buildGoalProjection(deal, goal, investmentAmount) {
	if (!deal || !goal) return null;
	const amount = (investmentAmount != null && investmentAmount > 0) ? investmentAmount : (deal.investmentMinimum || 100000);

	if (goal === 'cashflow') {
		return buildCashflowProjection(deal, amount);
	} else if (goal === 'tax') {
		return buildTaxProjection(deal, amount);
	} else if (goal === 'growth') {
		return buildGrowthProjection(deal, amount);
	}
	return null;
}

function buildCashflowProjection(deal, amount) {
	const rate = deal.preferredReturn || deal.cashOnCash || deal.targetIRR || 0;
	const annualRate = rate > 1 ? rate / 100 : rate;
	if (annualRate <= 0) return { type: 'cashflow', headline: 'Cash flow data not available', monthly: 0, annual: 0, detail: 'This deal does not have enough return data to project income.' };
	const annual = amount * annualRate;
	const monthly = annual / 12;
	return {
		type: 'cashflow',
		headline: `~${formatMoneyShort(monthly)}/mo projected income`,
		monthly,
		annual,
		detail: `Based on ${(annualRate * 100).toFixed(1)}% preferred return at ${formatMoneyShort(amount)} minimum. Actual returns may vary.`
	};
}

function buildTaxProjection(deal, amount) {
	if (!deal.firstYrDepreciation) {
		return { type: 'tax', headline: 'Depreciation data not available', writeOff: 0, detail: 'This deal has not disclosed first-year depreciation estimates.' };
	}
	const depRate = typeof deal.firstYrDepreciation === 'number'
		? (deal.firstYrDepreciation > 1 ? deal.firstYrDepreciation / 100 : deal.firstYrDepreciation)
		: parseFloat(String(deal.firstYrDepreciation).replace('%', '')) / 100;

	if (isNaN(depRate) || depRate <= 0) {
		return { type: 'tax', headline: 'Depreciation data unclear', writeOff: 0, detail: `First-year depreciation listed as "${deal.firstYrDepreciation}" but could not be parsed.` };
	}

	const writeOff = amount * depRate;
	return {
		type: 'tax',
		headline: `~${formatMoneyShort(writeOff)} yr-1 depreciation`,
		writeOff,
		detail: `Based on ${formatMoneyShort(amount)} investment with ${(depRate * 100).toFixed(0)}% first-year depreciation. Actual returns may vary.`
	};
}

function buildGrowthProjection(deal, amount) {
	const em = deal.equityMultiple || 0;
	const irr = deal.targetIRR ? (deal.targetIRR > 1 ? deal.targetIRR / 100 : deal.targetIRR) : 0;
	const hold = deal.holdPeriod || 5;

	if (em > 0) {
		const totalReturn = amount * em;
		const gain = totalReturn - amount;
		return {
			type: 'growth',
			headline: `${em.toFixed(2)}x target over ${hold} years`,
			totalReturn,
			gain,
			detail: `Based on ${formatMoneyShort(amount)} at target ${em.toFixed(2)}x equity multiple. Actual returns may vary.`
		};
	} else if (irr > 0) {
		const totalReturn = amount * Math.pow(1 + irr, hold);
		const gain = totalReturn - amount;
		return {
			type: 'growth',
			headline: `${(irr * 100).toFixed(1)}% target IRR over ${hold} years`,
			totalReturn,
			gain,
			detail: `Based on ${formatMoneyShort(amount)} at ${(irr * 100).toFixed(1)}% IRR over ${hold} years. Actual returns may vary.`
		};
	}

	return { type: 'growth', headline: 'Growth metrics not available', totalReturn: 0, gain: 0, detail: 'No equity multiple or IRR data to project growth.' };
}


// ===== Buy Box Match Count (lightweight) =====

export function computeBuyBoxMatchCount(deal, buyBox) {
	let matched = 0, total = 0;
	const normalizedDealAssetClass = normalizeAssetClassValue(deal?.assetClass || deal?.asset_class);
	const normalizedBuyBoxAssetClasses = normalizeAssetClassList(buyBox?.assetClasses);

	if (normalizedBuyBoxAssetClasses.length > 0) {
		total++;
		if (normalizedBuyBoxAssetClasses.includes(normalizedDealAssetClass)) matched++;
	}
	if (buyBox.checkSize) {
		total++;
		if ((deal.investmentMinimum || 0) <= buyBox.checkSize) matched++;
	}
	if (buyBox.minIRR) {
		total++;
		const bbIRR = parseFloat(buyBox.minIRR);
		const dealIRR = deal.targetIRR || 0;
		const dealIRRpct = dealIRR <= 1 ? dealIRR * 100 : dealIRR;
		const bbIRRpct = bbIRR <= 1 ? bbIRR * 100 : bbIRR;
		if (dealIRRpct >= bbIRRpct) matched++;
	}
	if (buyBox.strategies?.length > 0) {
		total++;
		if (buyBox.strategies.includes(deal.strategy)) matched++;
	}

	return { matched, total };
}

function normalizeAssetClassList(value) {
	if (!value) return [];
	const rawItems = Array.isArray(value)
		? value
		: String(value)
			.split(',')
			.map((item) => item.trim())
			.filter(Boolean);

	return rawItems
		.map((item) => normalizeAssetClassValue(item))
		.filter(Boolean);
}


// ===== Formatters (local) =====

function formatMoneyShort(val) {
	if (!val || isNaN(val)) return '$0';
	if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
	if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
	if (val >= 1e3) return '$' + Math.round(val / 1e3) + 'K';
	return '$' + Math.round(val).toLocaleString();
}
