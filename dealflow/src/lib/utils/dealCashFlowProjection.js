import { isDebtOrLendingDeal } from './dealReturns.js';

function firstMeaningful(...values) {
	for (const value of values) {
		if (value === null || value === undefined) continue;
		if (typeof value === 'string' && !value.trim()) continue;
		return value;
	}
	return null;
}

function toRate(value) {
	const numericValue = typeof value === 'number'
		? value
		: Number(String(value || '').replace(/[%,$]/g, '').trim());
	if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
	return numericValue > 1 ? numericValue / 100 : numericValue;
}

function toPositiveNumber(value) {
	const numericValue = typeof value === 'number'
		? value
		: Number(String(value || '').replace(/[$,%]/g, '').replace(/,/g, '').trim());
	return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0;
}

function resolveMetricBasis(deal, { isCredit = false } = {}) {
	const candidates = isCredit
		? [
			{ fieldKey: 'cashYield', label: 'cash yield', value: firstMeaningful(deal?.cashYield, deal?.cash_yield) },
			{ fieldKey: 'cashOnCash', label: 'cash-on-cash', value: firstMeaningful(deal?.cashOnCash, deal?.cash_on_cash) },
			{ fieldKey: 'preferredReturn', label: 'preferred return', value: firstMeaningful(deal?.preferredReturn, deal?.preferred_return) }
		]
		: [
			{ fieldKey: 'preferredReturn', label: 'pref return', value: firstMeaningful(deal?.preferredReturn, deal?.preferred_return) },
			{ fieldKey: 'cashOnCash', label: 'cash-on-cash', value: firstMeaningful(deal?.cashOnCash, deal?.cash_on_cash) },
			{ fieldKey: 'cashYield', label: 'cash yield', value: firstMeaningful(deal?.cashYield, deal?.cash_yield) },
			{ fieldKey: 'targetIRR', label: 'target IRR', value: firstMeaningful(deal?.targetIRR, deal?.target_irr) }
		];

	for (const candidate of candidates) {
		const rate = toRate(candidate.value);
		if (rate > 0) {
			return {
				...candidate,
				rate
			};
		}
	}

	return null;
}

export function buildDealCashFlowProjection(deal) {
	if (!deal) {
		return {
			available: false,
			reason: 'missing_deal',
			rows: []
		};
	}

	const isCredit = isDebtOrLendingDeal(deal);
	const basis = resolveMetricBasis(deal, { isCredit });
	const investment = toPositiveNumber(firstMeaningful(deal?.investmentMinimum, deal?.investment_minimum));
	const holdInput = toPositiveNumber(firstMeaningful(deal?.holdPeriod, deal?.hold_period_years));
	const offeringStatus = String(firstMeaningful(deal?.offeringStatus, deal?.offering_status, deal?.status) || '').trim();
	const isEvergreen = /evergreen/i.test(offeringStatus);
	const holdYears = holdInput > 0 ? Math.min(Math.ceil(holdInput), 10) : 0;

	if (!basis) {
		return {
			available: false,
			reason: isCredit ? 'missing_explicit_yield' : 'missing_projection_metric',
			isCredit,
			isEvergreen,
			investment,
			holdYears,
			rows: []
		};
	}

	if (!investment) {
		return {
			available: false,
			reason: 'missing_investment_minimum',
			isCredit,
			isEvergreen,
			basis,
			holdYears,
			rows: []
		};
	}

	if (!holdYears) {
		return {
			available: false,
			reason: 'missing_hold_period',
			isCredit,
			isEvergreen,
			basis,
			investment,
			rows: []
		};
	}

	const equityMultiple = toPositiveNumber(firstMeaningful(deal?.equityMultiple, deal?.equity_multiple));
	const rows = [];
	let cumulativeDistributions = 0;

	for (let year = 1; year <= holdYears; year += 1) {
		let distribution = 0;
		let capitalReturn = 0;
		let note = '';

		if (isCredit) {
				distribution = investment * basis.rate;
				if (!isEvergreen && year === holdYears) {
					capitalReturn = investment;
					note = 'Capital returned';
				}
			} else {
			distribution = year === 1 ? investment * basis.rate * 0.5 : investment * basis.rate;
			if (year === 1) note = 'Partial year (ramp-up)';
			if (year === holdYears && equityMultiple > 0) {
				const targetProceeds = investment * equityMultiple;
				capitalReturn = Math.max(0, targetProceeds - cumulativeDistributions - distribution);
				note = 'Sale / capital event';
			} else if (year === holdYears && !isEvergreen) {
				capitalReturn = investment;
				note = 'Capital returned';
			}
		}

		cumulativeDistributions += distribution;
		rows.push({
			year,
			dist: distribution,
			capReturn: capitalReturn,
			cumDist: cumulativeDistributions,
			note
		});
	}

	const totalCash = rows.length > 0
		? rows[rows.length - 1].cumDist + rows[rows.length - 1].capReturn
		: 0;
	const avgCashOnCashPct = rows.length > 0
		? (rows[rows.length - 1].cumDist / holdYears / investment) * 100
		: 0;
	const maxBar = rows.reduce((maxValue, row) => Math.max(maxValue, row.dist + row.capReturn), 0) || 1;

	return {
		available: true,
		reason: null,
		isCredit,
		isEvergreen,
		basis,
		investment,
		holdYears,
		rows,
		totalCash,
		avgCashOnCashPct,
		maxBar
	};
}
