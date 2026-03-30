/**
 * Deal Analysis Utilities
 *
 * Summary line builders, risk/compensation/gaps framework,
 * and goal-path projection helpers for the LP deal page.
 */

// ===== Summary Line Builders =====
// Each returns a short factual sentence (no judgments) for accordion headers.

export function buildFitSummary(deal, buyBox) {
	if (!deal) return 'No deal data available.';
	if (!buyBox || !Object.keys(buyBox).length) return 'Set up your Buy Box to see how this deal aligns.';
	const checks = computeBuyBoxMatchCount(deal, buyBox);
	if (checks.total === 0) return 'No matching criteria configured yet.';
	return `${checks.matched} of ${checks.total} Buy Box criteria match this deal.`;
}

export function buildStructureSummary(deal) {
	if (!deal) return 'No deal data available.';
	const parts = [];
	if (deal.offeringType) parts.push(deal.offeringType);
	if (deal.dealType) parts.push(deal.dealType.toLowerCase());
	if (deal.distributions && deal.distributions !== 'Unknown') parts.push(deal.distributions.toLowerCase() + ' distributions');
	if (deal.holdPeriod) parts.push(formatHoldShort(deal.holdPeriod) + ' hold');
	if (parts.length === 0) return 'Structure details have not been added yet.';
	return parts.join(' · ');
}

export function buildSponsorSummary(deal) {
	if (!deal) return 'No sponsor data available.';
	const parts = [];
	if (deal.managementCompany) parts.push(deal.managementCompany);
	if (deal.mcFoundingYear) {
		const years = new Date().getFullYear() - deal.mcFoundingYear;
		parts.push(`${years}+ yr track record`);
	}
	if (deal.fundAUM) parts.push(formatMoneyShort(deal.fundAUM) + ' AUM');
	if (parts.length === 0) return 'Sponsor details have not been structured yet.';
	return parts.join(' · ');
}

export function buildRiskSummary(deal, riskItems) {
	if (!deal) return 'No deal data available.';
	const count = riskItems?.length || 0;
	const gapCount = computeDataGaps(deal).length;
	if (count === 0 && gapCount === 0) return 'No identified risks or data gaps at this time.';
	const parts = [];
	if (count > 0) parts.push(`${count} identified risk${count > 1 ? 's' : ''}`);
	if (gapCount > 0) parts.push(`${gapCount} data gap${gapCount > 1 ? 's' : ''}`);
	return parts.join(' · ');
}

export function buildDeepDiveSummary(deal, ddProgress) {
	if (!deal) return 'No deal data available.';
	const parts = [];
	if (ddProgress?.pct > 0) parts.push(`DD checklist ${ddProgress.pct}% complete`);
	if (deal.secCik) parts.push('SEC filing verified');
	else parts.push('No SEC filing matched');
	return parts.join(' · ');
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

	// Operator track record
	if (deal.mcFoundingYear) {
		const years = new Date().getFullYear() - deal.mcFoundingYear;
		if (years < 3) {
			risks.push({ label: 'Newer Operator', detail: `${deal.managementCompany || 'Sponsor'} has ${years} year${years !== 1 ? 's' : ''} of operating history.` });
		}
	}

	// Fee concerns
	if (deal.fees) {
		const mgmtMatch = String(deal.fees).match(/([\d.]+)\s*%/);
		if (mgmtMatch && parseFloat(mgmtMatch[1]) > 2) {
			risks.push({ label: 'Above-Market Fees', detail: `Management fee of ${mgmtMatch[1]}% exceeds the typical 1-2% range.` });
		}
	}

	// Return benchmarks
	if (deal.targetIRR) {
		const irr = deal.targetIRR > 1 ? deal.targetIRR : deal.targetIRR * 100;
		if (irr < 8) {
			risks.push({ label: 'Below-Benchmark Returns', detail: `Target IRR of ${irr.toFixed(1)}% is below the 8% common threshold for this asset class.` });
		}
	}

	// Low preferred return
	if (deal.preferredReturn) {
		const pref = deal.preferredReturn > 1 ? deal.preferredReturn : deal.preferredReturn * 100;
		if (pref < 6) {
			risks.push({ label: 'Low Preferred Return', detail: `Preferred return of ${pref.toFixed(1)}% is below the common 6-8% hurdle.` });
		}
	}

	// Missing management company
	if (!deal.managementCompanyId && !deal.managementCompany) {
		risks.push({ label: 'Unknown Operator', detail: 'No management company is linked to this deal record.' });
	}

	return risks;
}

function extractCompensation(deal) {
	const items = [];

	if (deal.targetIRR) {
		const irr = deal.targetIRR > 1 ? deal.targetIRR : deal.targetIRR * 100;
		items.push({ label: 'Target IRR', value: `${irr.toFixed(1)}%`, detail: 'Projected total annualized return including distributions and capital gains.' });
	}

	if (deal.preferredReturn) {
		const pref = deal.preferredReturn > 1 ? deal.preferredReturn : deal.preferredReturn * 100;
		items.push({ label: 'Preferred Return', value: `${pref.toFixed(1)}%`, detail: 'LP hurdle rate — LPs are paid this return before GP profit participation.' });
	}

	if (deal.equityMultiple) {
		items.push({ label: 'Equity Multiple', value: `${deal.equityMultiple.toFixed(2)}x`, detail: 'Total cash returned per dollar invested over the life of the deal.' });
	}

	if (deal.cashOnCash) {
		const coc = deal.cashOnCash > 1 ? deal.cashOnCash : deal.cashOnCash * 100;
		items.push({ label: 'Cash-on-Cash', value: `${coc.toFixed(1)}%`, detail: 'Annual cash distributions as a percentage of invested capital.' });
	}

	if (deal.distributions && deal.distributions !== 'Unknown' && deal.distributions !== 'None') {
		items.push({ label: 'Distributions', value: deal.distributions, detail: `Cash is distributed on a ${deal.distributions.toLowerCase()} basis.` });
	}

	if (deal.sponsorInDeal) {
		const pct = deal.sponsorInDeal > 1 ? deal.sponsorInDeal : deal.sponsorInDeal * 100;
		items.push({ label: 'Sponsor Co-Invest', value: `${pct.toFixed(1)}%`, detail: 'Sponsor has skin in the game alongside LPs.' });
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
	const amount = investmentAmount || deal.investmentMinimum || 100000;

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
		detail: `Based on ${formatMoneyShort(amount)} at ${(annualRate * 100).toFixed(1)}% ${deal.distributions ? deal.distributions.toLowerCase() : ''} distributions.`
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
		detail: `Based on ${formatMoneyShort(amount)} investment with ${(depRate * 100).toFixed(0)}% first-year depreciation.`
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
			detail: `${formatMoneyShort(amount)} could grow to ${formatMoneyShort(totalReturn)} at the target ${em.toFixed(2)}x equity multiple.`
		};
	} else if (irr > 0) {
		const totalReturn = amount * Math.pow(1 + irr, hold);
		const gain = totalReturn - amount;
		return {
			type: 'growth',
			headline: `${(irr * 100).toFixed(1)}% target IRR over ${hold} years`,
			totalReturn,
			gain,
			detail: `${formatMoneyShort(amount)} at ${(irr * 100).toFixed(1)}% IRR over ${hold} years = ${formatMoneyShort(totalReturn)}.`
		};
	}

	return { type: 'growth', headline: 'Growth metrics not available', totalReturn: 0, gain: 0, detail: 'No equity multiple or IRR data to project growth.' };
}


// ===== Buy Box Match Count (lightweight) =====

function computeBuyBoxMatchCount(deal, buyBox) {
	let matched = 0, total = 0;

	if (buyBox.assetClasses?.length > 0) {
		total++;
		if (buyBox.assetClasses.includes(deal.assetClass)) matched++;
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


// ===== Formatters (local) =====

function formatMoneyShort(val) {
	if (!val || isNaN(val)) return '$0';
	if (val >= 1e9) return '$' + (val / 1e9).toFixed(1) + 'B';
	if (val >= 1e6) return '$' + (val / 1e6).toFixed(1) + 'M';
	if (val >= 1e3) return '$' + Math.round(val / 1e3) + 'K';
	return '$' + Math.round(val).toLocaleString();
}

function formatHoldShort(val) {
	if (!val) return '---';
	if (typeof val === 'string' && val.toLowerCase().includes('open')) return 'Open-ended';
	const n = parseFloat(val);
	if (isNaN(n)) return String(val);
	if (n === 1) return '1 yr';
	return n + ' yr';
}
