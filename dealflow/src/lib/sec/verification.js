import { normalizeOfferingType } from '../utils/dealflow-contract.js';

export const SEC_VERIFICATION_STATUSES = [
	'pending',
	'needs_review',
	'verified',
	'have_not_filed_yet',
	'not_applicable'
];

export const SEC_VERIFICATION_RESOLVED_STATUSES = [
	'verified',
	'have_not_filed_yet',
	'not_applicable'
];

export const SEC_VERIFICATION_LABELS = {
	pending: 'Pending',
	needs_review: 'Needs review',
	verified: 'Verified',
	have_not_filed_yet: "Haven't filed yet",
	not_applicable: 'Not applicable'
};

export const SEC_VERIFICATION_TONES = {
	pending: 'pending',
	needs_review: 'review',
	verified: 'verified',
	have_not_filed_yet: 'waiting',
	not_applicable: 'neutral'
};

function readValue(record, aliases = []) {
	for (const alias of aliases) {
		const value = String(alias || '')
			.split('.')
			.reduce((current, key) => (current === null || current === undefined ? undefined : current[key]), record);
		if (value !== undefined && value !== null && String(value).trim() !== '') {
			return value;
		}
	}
	return '';
}

function normalizeText(value) {
	return String(value || '').trim();
}

function normalizeStatusText(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[\u2018\u2019]/g, "'")
		.replace(/[^a-z0-9]+/g, '_')
		.replace(/^_+|_+$/g, '');
}

function toNumber(value) {
	if (value === null || value === undefined || value === '') return null;
	const numeric = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
	return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeSecVerificationStatus(value, fallback = 'pending') {
	const normalized = normalizeStatusText(value);
	if (SEC_VERIFICATION_STATUSES.includes(normalized)) return normalized;
	if (normalized === 'verified_match') return 'verified';
	if (normalized === 'notapplicable') return 'not_applicable';
	if (normalized === 'have_not_filed' || normalized === 'havent_filed_yet' || normalized === 'have_not_filed_yet') {
		return 'have_not_filed_yet';
	}
	if (normalized === 'review') return 'needs_review';
	const normalizedFallback = normalizeStatusText(fallback);
	return SEC_VERIFICATION_STATUSES.includes(normalizedFallback) ? normalizedFallback : 'pending';
}

export function isResolvedSecVerificationStatus(value) {
	return SEC_VERIFICATION_RESOLVED_STATUSES.includes(normalizeSecVerificationStatus(value));
}

export function buildDealSecSearchContext(deal = {}) {
	return {
		dealName: normalizeText(
			readValue(deal, ['investmentName', 'investment_name', 'name'])
		),
		sponsorName: normalizeText(
			readValue(deal, [
				'sponsorName',
				'sponsor_name',
				'managementCompany',
				'management_company_name',
				'management_company.operator_name',
				'management_company.operatorName',
				'sponsor'
			])
		),
		legalEntities: {
			issuerEntity: normalizeText(readValue(deal, ['issuerEntity', 'issuer_entity', 'secEntityName', 'sec_entity_name', 'entityInvestedInto', 'entity_invested_into'])),
			gpEntity: normalizeText(readValue(deal, ['gpEntity', 'gp_entity'])),
			sponsorEntity: normalizeText(readValue(deal, ['sponsorEntity', 'sponsor_entity'])),
			operatorLegalEntity: normalizeText(
				readValue(deal, [
					'operatorLegalEntity',
					'legal_entity',
					'management_company.legal_entity',
					'management_company.legalEntity'
				])
			)
		}
	};
}

export function deriveSecApplicability(deal = {}) {
	const offeringType = normalizeOfferingType(
		readValue(deal, ['offeringType', 'offering_type']),
		{ empty: '' }
	);
	const offeringStatus = normalizeStatusText(
		readValue(deal, ['offeringStatus', 'offering_status', 'status'])
	);
	const availableTo = normalizeStatusText(readValue(deal, ['availableTo', 'available_to']));
	const secCik = normalizeText(readValue(deal, ['secCik', 'sec_cik']));
	const dateOfFirstSale = normalizeText(readValue(deal, ['dateOfFirstSale', 'date_of_first_sale']));
	const hasFormDSignals = Boolean(
		secCik
		|| dateOfFirstSale
		|| deal?.is506b === true
		|| deal?.is_506b === true
	);

	if (offeringType === 'Regulation A') {
		return {
			isApplicable: false,
			reasonCode: 'offering_type_reg_a',
			reason: 'This deal is marked Regulation A. The current SEC stage is scoped to Form D issuer verification.',
			suggestedStatus: 'not_applicable'
		};
	}

	if (offeringType === 'Other') {
		return {
			isApplicable: false,
			reasonCode: 'offering_type_other',
			reason: 'The deal is marked as Other. Form D issuer verification should be skipped unless a filing is expected.',
			suggestedStatus: 'not_applicable'
		};
	}

	if (offeringType === '506(b)' || offeringType === '506(c)' || offeringType === 'Regulation D' || hasFormDSignals) {
		const suggestedStatus =
			!secCik
			&& !dateOfFirstSale
			&& ['coming_soon', 'paused', 'draft'].includes(offeringStatus)
				? 'have_not_filed_yet'
				: null;
		return {
			isApplicable: true,
			reasonCode: offeringType ? `offering_type_${normalizeStatusText(offeringType)}` : 'form_d_signal',
			reason: 'This deal looks like a Regulation D / Form D offering and should be resolved in SEC issuer verification.',
			suggestedStatus
		};
	}

	if (availableTo === 'accredited_investors' || availableTo === 'both') {
		return {
			isApplicable: true,
			reasonCode: 'audience_signal',
			reason: 'The offering is targeted to accredited investors, so SEC issuer verification should be reviewed before publishing.',
			suggestedStatus:
				!secCik && !dateOfFirstSale && offeringStatus === 'coming_soon'
					? 'have_not_filed_yet'
					: null
		};
	}

	return {
		isApplicable: true,
		reasonCode: 'manual_review_default',
		reason: 'SEC issuer verification has not been resolved yet. Confirm a filing, mark it as not filed yet, or mark it not applicable.',
		suggestedStatus: null
	};
}

export function buildSecVerificationGate(input = {}) {
	const status = normalizeSecVerificationStatus(
		typeof input === 'string' ? input : input?.currentStatus || input?.status
	);
	const isResolved = isResolvedSecVerificationStatus(status);
	return {
		isResolved,
		blocksPublish: !isResolved,
		reason: isResolved ? '' : 'Resolve SEC issuer verification before publishing this deal.'
	};
}

export function formatSecVerificationConfidence(value) {
	const numeric = toNumber(value);
	if (numeric === null) return '';
	const ratio = numeric <= 1 ? numeric : numeric / 100;
	return `${Math.round(Math.max(0, Math.min(1, ratio)) * 100)}%`;
}

export function buildSecVerificationView({
	deal = {},
	record = null,
	filing = null,
	bestMatch = null,
	matches = [],
	searchPerformed = false
} = {}) {
	const applicability = deriveSecApplicability(deal);
	const recordStatus = normalizeSecVerificationStatus(record?.status);
	const currentStatus = filing?.id
		? 'verified'
		: record?.status
			? recordStatus
			: 'pending';
	const currentTone = SEC_VERIFICATION_TONES[currentStatus] || 'pending';
	const label = SEC_VERIFICATION_LABELS[currentStatus] || SEC_VERIFICATION_LABELS.pending;
	const gate = buildSecVerificationGate(currentStatus);
	const hasMatchCandidates = Array.isArray(matches) && matches.length > 0;

	let description = 'Run the SEC issuer check to resolve this stage.';
	if (currentStatus === 'verified') {
		description = filing?.entity_name
			? `Matched to SEC issuer ${filing.entity_name}.`
			: 'Matched to a confirmed SEC filing.';
	} else if (currentStatus === 'have_not_filed_yet') {
		description = record?.reason_note || 'The issuer has not filed yet, so publishing can continue once the rest of the review is complete.';
	} else if (currentStatus === 'not_applicable') {
		description = record?.reason_note || applicability.reason;
	} else if (currentStatus === 'needs_review') {
		description = hasMatchCandidates
			? 'Potential SEC matches were found. Confirm the correct filing or choose a manual state.'
			: 'This deal still needs an SEC issuer verification decision.';
	} else if (applicability.suggestedStatus === 'have_not_filed_yet') {
		description = "This deal appears to be pre-launch. If the issuer hasn't sold yet, mark it as not filed yet.";
	} else if (!applicability.isApplicable) {
		description = `${applicability.reason} Mark the stage not applicable to resolve publishing.`;
	} else {
		description = applicability.reason;
	}

	let suggestedStatus = null;
	if (!gate.isResolved) {
		if (!applicability.isApplicable) suggestedStatus = 'not_applicable';
		else if (bestMatch?.matchScore >= 0.75 || filing?.id) suggestedStatus = 'verified';
		else if (applicability.suggestedStatus) suggestedStatus = applicability.suggestedStatus;
	}

	return {
		currentStatus,
		currentLabel: label,
		currentTone,
		description,
		suggestedStatus,
		suggestedLabel: suggestedStatus ? SEC_VERIFICATION_LABELS[suggestedStatus] : '',
		applicability,
		gate,
		checkedAt: record?.last_checked_at || null,
		verifiedAt: record?.verified_at || null,
		note: normalizeText(record?.reason_note),
		matchConfidence: toNumber(record?.match_confidence),
		matchConfidenceLabel: formatSecVerificationConfidence(record?.match_confidence),
		searchPerformed: Boolean(searchPerformed),
		hasMatchCandidates
	};
}
