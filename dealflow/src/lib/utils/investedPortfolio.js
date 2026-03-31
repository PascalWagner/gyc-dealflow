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
		record.distributionsReceived,
		record.equityMultiple,
		record.investingEntity,
		record.entityInvestedInto,
		record.holdPeriod,
		record.notes
	].filter((value) => value !== null && value !== undefined && String(value).trim?.() !== '').length;
}

function preferPortfolioRecord(currentRecord, nextRecord) {
	if (!currentRecord) return nextRecord;
	if (!nextRecord) return currentRecord;

	const currentScore = populationScore(currentRecord);
	const nextScore = populationScore(nextRecord);

	if (nextScore > currentScore) return nextRecord;
	if (currentScore > nextScore) return currentRecord;

	return String(nextRecord._recordId || nextRecord.id || '').localeCompare(String(currentRecord._recordId || currentRecord.id || '')) >= 0
		? nextRecord
		: currentRecord;
}

export function normalizePortfolioRecord(record = {}) {
	return {
		id: record.id || `inv_${Math.random().toString(36).slice(2, 9)}`,
		_recordId: record._recordId || record.id || '',
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

	for (const record of normalizedPortfolio) {
		if (!record.dealId) continue;
		detailsByDealId.set(record.dealId, preferPortfolioRecord(detailsByDealId.get(record.dealId), record));
	}

	const dealById = new Map(
		(deals || [])
			.map((deal) => [String(deal?.id || ''), deal])
			.filter(([dealId]) => dealId)
	);

	const investedDealIds = Object.entries(stageMap || {})
		.filter(([, stage]) => normalizeStage(stage) === 'invested')
		.map(([dealId]) => dealId);

	const entries = investedDealIds
		.map((dealId) => {
			const detailRecord = detailsByDealId.get(dealId);
			const deal = dealById.get(dealId) || {};
			const lifecycleStatus = firstNonEmpty(detailRecord?.lifecycleStatus, deal.lifecycleStatus, deal.lifecycle_status);
			const isPendingReview =
				lifecycleStatus
					? lifecycleStatus !== 'published'
					: String(detailRecord?.status || '').trim().toLowerCase() === 'pending';
			const displayStatus = isPendingReview ? getPendingReviewBadgeLabel(lifecycleStatus) : (detailRecord?.status || 'Active');
			const countsTowardPortfolioMetrics = !isPendingReview && String(displayStatus).trim().toLowerCase() !== 'pending';

			return normalizePortfolioRecord({
				id: detailRecord?.id || `invested_${dealId}`,
				_recordId: detailRecord?._recordId || '',
				dealId,
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
				status: detailRecord?.status || 'Active',
				targetIRR: detailRecord?.targetIRR ?? firstNonEmpty(deal.targetIRR, deal.target_irr),
				distributionsReceived: detailRecord?.distributionsReceived ?? '',
				equityMultiple: detailRecord?.equityMultiple ?? firstNonEmpty(deal.equityMultiple, deal.equity_multiple),
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
		})
		.sort(comparePortfolioRecords);

	return {
		entries,
		metricEntries: entries.filter((record) => record.countsTowardPortfolioMetrics),
		pendingEntries: entries.filter((record) => record.isPendingReview),
		missingDetails: entries.filter((record) => record._missingDetails),
		investedDealIds
	};
}
