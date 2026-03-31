import { normalizeStage } from '$lib/utils/dealflow-contract.js';
import { getPendingReviewBadgeLabel } from '$lib/utils/dealSubmission.js';

function firstNonEmpty(...values) {
	for (const value of values) {
		if (value === null || value === undefined) continue;
		if (typeof value === 'string' && value.trim() === '') continue;
		return value;
	}
	return '';
}

function populationScore(record = {}) {
	return [
		record.investmentName,
		record.sponsor,
		record.assetClass,
		record.amountInvested,
		record.dateInvested,
		record.targetIRR,
		record.actualYear1CashFlow,
		record.actualYear1Depreciation,
		record.distributionsReceived,
		record.equityMultiple,
		record.investingEntity,
		record.entityInvestedInto,
		record.holdPeriod,
		record.notes
	].filter((value) => value !== null && value !== undefined && String(value).trim?.() !== '').length;
}

function parseCurrencyLike(value) {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}

	const normalized = String(value || '').trim();
	if (!normalized) return null;
	if (!/^-?\$?[\d,\s]+(?:\.\d+)?$/.test(normalized)) return null;
	const parsed = Number(normalized.replace(/[$,\s]/g, ''));
	return Number.isFinite(parsed) ? parsed : null;
}

function resolveProjectedYear1CashFlow(deal = {}, amountInvested = 0) {
	const rateCandidate = firstNonEmpty(
		deal.cashYield,
		deal.cash_yield,
		deal.cashOnCash,
		deal.cash_on_cash,
		deal.preferredReturn,
		deal.preferred_return
	);
	const numericRate = Number(rateCandidate);
	if (!Number.isFinite(numericRate) || numericRate <= 0 || !Number.isFinite(amountInvested) || amountInvested <= 0) {
		return '';
	}
	const rate = numericRate > 1 ? numericRate / 100 : numericRate;
	return Math.round(amountInvested * rate);
}

function resolveProjectedYear1DepreciationText(deal = {}) {
	return firstNonEmpty(deal.firstYrDepreciation, deal.first_yr_depreciation);
}

function buildPortfolioEntry({ detailRecord = null, deal = {}, fallbackDealId = '' } = {}) {
	const lifecycleStatus = firstNonEmpty(detailRecord?.lifecycleStatus, deal.lifecycleStatus, deal.lifecycle_status);
	const status = detailRecord?.status || 'Active';
	const isPendingReview =
		lifecycleStatus
			? lifecycleStatus !== 'published'
			: String(status || '').trim().toLowerCase() === 'pending';
	const displayStatus = isPendingReview ? getPendingReviewBadgeLabel(lifecycleStatus) : status;
	const countsTowardPortfolioMetrics = !isPendingReview && String(displayStatus).trim().toLowerCase() !== 'pending';
	const amountInvested = parseFloat(detailRecord?.amountInvested) || 0;
	const projectedYear1CashFlow = resolveProjectedYear1CashFlow(deal, amountInvested);
	const projectedYear1DepreciationText = resolveProjectedYear1DepreciationText(deal);
	const projectedYear1DepreciationValue = parseCurrencyLike(projectedYear1DepreciationText);
	const actualYear1CashFlow = detailRecord?.actualYear1CashFlow ?? detailRecord?.actual_year_1_cash_flow ?? '';
	const actualYear1Depreciation = detailRecord?.actualYear1Depreciation ?? detailRecord?.actual_year_1_depreciation ?? '';
	const hasActualYear1CashFlow = actualYear1CashFlow !== '' && actualYear1CashFlow !== null && actualYear1CashFlow !== undefined;
	const hasActualYear1Depreciation = actualYear1Depreciation !== '' && actualYear1Depreciation !== null && actualYear1Depreciation !== undefined;

	return normalizePortfolioRecord({
		id: detailRecord?.id || `invested_${fallbackDealId}`,
		_recordId: detailRecord?._recordId || '',
		dealId: detailRecord?.dealId || fallbackDealId || '',
		investmentName: firstNonEmpty(
			detailRecord?.investmentName,
			deal.investmentName,
			deal.investment_name,
			deal.name,
			'Unnamed investment'
		),
		sponsor: firstNonEmpty(
			detailRecord?.sponsor,
			deal.managementCompany,
			deal.management_company,
			deal.sponsor
		),
		assetClass: firstNonEmpty(detailRecord?.assetClass, deal.assetClass, deal.asset_class),
		amountInvested: detailRecord?.amountInvested ?? '',
		dateInvested: detailRecord?.dateInvested || '',
		status,
		targetIRR: detailRecord?.targetIRR ?? firstNonEmpty(deal.targetIRR, deal.target_irr),
		distributionsReceived: detailRecord?.distributionsReceived ?? '',
		equityMultiple: detailRecord?.equityMultiple ?? firstNonEmpty(deal.equityMultiple, deal.equity_multiple),
		actualYear1CashFlow,
		actualYear1Depreciation,
		projectedYear1CashFlow,
		projectedYear1DepreciationValue,
		projectedYear1DepreciationText,
		displayYear1CashFlow: hasActualYear1CashFlow ? actualYear1CashFlow : projectedYear1CashFlow,
		displayYear1CashFlowSource: hasActualYear1CashFlow ? 'actual' : projectedYear1CashFlow !== '' ? 'projected' : '',
		displayYear1Depreciation: hasActualYear1Depreciation ? actualYear1Depreciation : projectedYear1DepreciationValue ?? '',
		displayYear1DepreciationText: hasActualYear1Depreciation ? '' : projectedYear1DepreciationText || '',
		displayYear1DepreciationSource:
			hasActualYear1Depreciation ? 'actual' : projectedYear1DepreciationText ? 'projected' : '',
		investingEntity: detailRecord?.investingEntity || '',
		entityInvestedInto: detailRecord?.entityInvestedInto || '',
		holdPeriod: firstNonEmpty(detailRecord?.holdPeriod, deal.holdPeriod, deal.hold_period),
		notes: detailRecord?.notes || '',
		lifecycleStatus,
		isPendingReview,
		reviewStatusLabel: isPendingReview ? getPendingReviewBadgeLabel(lifecycleStatus) : '',
		countsTowardPortfolioMetrics,
		displayStatus,
		_missingDetails: !detailRecord,
		_source: detailRecord ? 'details' : 'stage'
	});
}

export function normalizePortfolioRecord(record = {}) {
	const normalizedId = record.id || `inv_${Math.random().toString(36).slice(2, 9)}`;
	const resolvedRecordId =
		record._recordId ||
		(
			record.id &&
			!String(record.id).startsWith('inv_') &&
			!String(record.id).startsWith('invested_')
		? record.id
		: ''
		);
	return {
		id: normalizedId,
		_recordId: resolvedRecordId,
		dealId: record.dealId || record.deal_id || '',
		investmentName: record.investmentName || record.investment_name || '',
		sponsor: record.sponsor || '',
		assetClass: record.assetClass || record.asset_class || '',
		amountInvested: record.amountInvested ?? record.amount_invested ?? '',
		dateInvested: record.dateInvested || record.date_invested || '',
		status: record.status || 'Active',
		targetIRR: record.targetIRR ?? record.target_irr ?? '',
		distributionsReceived: record.distributionsReceived ?? record.distributions_received ?? '',
		equityMultiple: record.equityMultiple ?? record.equity_multiple ?? '',
		actualYear1CashFlow: record.actualYear1CashFlow ?? record.actual_year_1_cash_flow ?? '',
		actualYear1Depreciation: record.actualYear1Depreciation ?? record.actual_year_1_depreciation ?? '',
		projectedYear1CashFlow: record.projectedYear1CashFlow ?? '',
		projectedYear1DepreciationValue: record.projectedYear1DepreciationValue ?? '',
		projectedYear1DepreciationText: record.projectedYear1DepreciationText || '',
		displayYear1CashFlow: record.displayYear1CashFlow ?? '',
		displayYear1CashFlowSource: record.displayYear1CashFlowSource || '',
		displayYear1Depreciation: record.displayYear1Depreciation ?? '',
		displayYear1DepreciationText: record.displayYear1DepreciationText || '',
		displayYear1DepreciationSource: record.displayYear1DepreciationSource || '',
		investingEntity: record.investingEntity || record.investing_entity || '',
		entityInvestedInto: record.entityInvestedInto || record.entity_invested_into || '',
		holdPeriod: record.holdPeriod || record.hold_period || '',
		notes: record.notes || '',
		lifecycleStatus: record.lifecycleStatus || record.lifecycle_status || '',
		isPendingReview: Boolean(record.isPendingReview),
		reviewStatusLabel: record.reviewStatusLabel || '',
		countsTowardPortfolioMetrics: record.countsTowardPortfolioMetrics !== false,
		displayStatus: record.displayStatus || record.status || 'Active',
		_missingDetails: Boolean(record._missingDetails),
		_source: record._source || 'details'
	};
}

function comparePortfolioRecords(left, right) {
	const leftDate = left?.dateInvested ? new Date(left.dateInvested).getTime() : 0;
	const rightDate = right?.dateInvested ? new Date(right.dateInvested).getTime() : 0;
	if (leftDate !== rightDate) return rightDate - leftDate;

	const leftAmount = parseFloat(left?.amountInvested) || 0;
	const rightAmount = parseFloat(right?.amountInvested) || 0;
	if (leftAmount !== rightAmount) return rightAmount - leftAmount;

	return String(left?.investmentName || '').localeCompare(String(right?.investmentName || ''));
}

export function buildInvestedPortfolio({ stageMap = {}, deals = [], portfolio = [] } = {}) {
	const normalizedPortfolio = (portfolio || []).map((record) => normalizePortfolioRecord(record));
	const detailsByDealId = new Map();
	const unlinkedEntries = [];

	for (const record of normalizedPortfolio) {
		if (!record.dealId) {
			unlinkedEntries.push(buildPortfolioEntry({ detailRecord: record }));
			continue;
		}
		if (!detailsByDealId.has(record.dealId)) detailsByDealId.set(record.dealId, []);
		detailsByDealId.get(record.dealId).push(record);
	}

	const dealById = new Map(
		(deals || [])
			.map((deal) => [String(deal?.id || ''), deal])
			.filter(([dealId]) => dealId)
	);

	const investedDealIds = Object.entries(stageMap || {})
		.filter(([, stage]) => normalizeStage(stage) === 'invested')
		.map(([dealId]) => dealId);

	const entries = [];

	for (const dealId of investedDealIds) {
		const deal = dealById.get(dealId) || {};
		const detailRecords = detailsByDealId.get(dealId) || [];
		if (detailRecords.length > 0) {
			detailRecords.forEach((record) => {
				entries.push(buildPortfolioEntry({ detailRecord: record, deal, fallbackDealId: dealId }));
			});
			detailsByDealId.delete(dealId);
			continue;
		}

		entries.push(buildPortfolioEntry({ deal, fallbackDealId: dealId }));
	}

	for (const [dealId, detailRecords] of detailsByDealId.entries()) {
		const deal = dealById.get(dealId) || {};
		detailRecords.forEach((record) => {
			entries.push(buildPortfolioEntry({ detailRecord: record, deal, fallbackDealId: dealId }));
		});
	}

	entries.push(...unlinkedEntries);
	entries.sort(comparePortfolioRecords);

	return {
		entries,
		metricEntries: entries.filter((record) => record.countsTowardPortfolioMetrics),
		pendingEntries: entries.filter((record) => record.isPendingReview),
		missingDetails: entries.filter((record) => record._missingDetails),
		investedDealIds
	};
}
