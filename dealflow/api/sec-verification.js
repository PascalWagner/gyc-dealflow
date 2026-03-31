import { canViewerAccessDeal, resolveDealViewerContext } from './_deal-access.js';
import { getAdminClient, setCors } from './_supabase.js';
import {
	buildDealSecSearchContext,
	buildSecVerificationView,
	deriveSecApplicability,
	normalizeSecVerificationStatus
} from '../src/lib/sec/verification.js';
import {
	applySecFilingToDeal,
	buildEdgarIndexUrl,
	dedupeSecHits,
	fetchFilingXml,
	fetchAndStoreSecFiling,
	findSecMatchesForDeal,
	parseFormD
} from './_sec-edgar.js';

const DEAL_SELECT = `
	*,
	management_company:management_companies(*)
`;

const FILING_SELECT = `*`;

const VERIFICATION_SELECT = `
	*,
	sec_filing:sec_filings(*)
`;

function isUuid(value) {
	return /^[0-9a-f-]{36}$/i.test(String(value || '').trim());
}

function formatIsoNow() {
	return new Date().toISOString();
}

function toNumber(value) {
	if (value === null || value === undefined || value === '') return null;
	const numericValue = typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
	return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeText(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function formatOfferingTypeFromFiling(filing) {
	const federalExemptions = Array.isArray(filing?.federal_exemptions) ? filing.federal_exemptions : [];
	if (federalExemptions.includes('06b')) return '506(b)';
	if (federalExemptions.includes('06c')) return '506(c)';
	return '';
}

function buildSearchContextSummary(searchContext = {}) {
	const legalEntities = searchContext?.legalEntities || {};
	return {
		dealName: searchContext?.dealName || '',
		sponsorName: searchContext?.sponsorName || '',
		legalEntities: {
			issuerEntity: legalEntities.issuerEntity || '',
			gpEntity: legalEntities.gpEntity || '',
			sponsorEntity: legalEntities.sponsorEntity || '',
			operatorLegalEntity: legalEntities.operatorLegalEntity || ''
		},
		priorityMode: legalEntities.issuerEntity ? 'issuer_first' : 'deal_first'
	};
}

function buildCandidateEdgarUrl(candidate, filing = null) {
	return (
		filing?.edgar_url
		|| buildEdgarIndexUrl(candidate?.cikPadded || candidate?.cik || filing?.cik || '', candidate?.accession || filing?.accession_number || '')
		|| ''
	);
}

function buildSecDiscrepancies({ deal = {}, filing = null, searchContext = {} } = {}) {
	if (!filing) return [];

	const discrepancies = [];
	const expectedIssuer = searchContext?.legalEntities?.issuerEntity || '';
	const expectedOfferingType = String(deal?.offering_type || deal?.offeringType || '').trim();
	const expectedAvailableTo = String(deal?.available_to || deal?.availableTo || '').trim().toLowerCase();
	const expectedMinimum = toNumber(deal?.investment_minimum ?? deal?.investmentMinimum);
	const expectedCik = String(deal?.sec_cik || deal?.secCik || '').trim();
	const filingOfferingType = formatOfferingTypeFromFiling(filing);
	const filingMinimum = toNumber(filing?.minimum_investment);
	const filingCik = String(filing?.cik || '').trim();

	if (expectedIssuer && filing.entity_name && normalizeText(expectedIssuer) !== normalizeText(filing.entity_name)) {
		discrepancies.push({
			label: 'Issuer name differs',
			detail: `PPM/deal says ${expectedIssuer}; SEC filing says ${filing.entity_name}.`
		});
	}

	if (expectedOfferingType && filingOfferingType && expectedOfferingType !== filingOfferingType) {
		discrepancies.push({
			label: 'Offering type differs',
			detail: `Deal says ${expectedOfferingType}; SEC filing says ${filingOfferingType}.`
		});
	}

	if (expectedMinimum !== null && filingMinimum !== null && Math.abs(expectedMinimum - filingMinimum) > 1) {
		discrepancies.push({
			label: 'Minimum investment differs',
			detail: `Deal says $${expectedMinimum.toLocaleString()}; SEC filing says $${filingMinimum.toLocaleString()}.`
		});
	}

	if (expectedAvailableTo === 'accredited investors' && filing?.has_non_accredited === true) {
		discrepancies.push({
			label: 'Investor eligibility differs',
			detail: 'The deal is marked accredited-only, but the SEC filing reports non-accredited investors.'
		});
	}

	if (expectedCik && filingCik && expectedCik !== filingCik) {
		discrepancies.push({
			label: 'CIK differs',
			detail: `Deal says ${expectedCik}; SEC filing says ${filingCik}.`
		});
	}

	return discrepancies;
}

function buildCandidateReasons({ deal = {}, searchContext = {}, candidate = null, filing = null } = {}) {
	if (!candidate) return [];
	const reasons = [];
	const dealMinimum = toNumber(deal?.investment_minimum ?? deal?.investmentMinimum);
	const filingMinimum = toNumber(filing?.minimum_investment);
	const filingOfferingType = formatOfferingTypeFromFiling(filing);
	const dealOfferingType = String(deal?.offering_type || deal?.offeringType || '').trim();

	if (candidate.exactIssuerMatch) reasons.push('Exact issuer legal entity match');
	else if ((candidate.issuerScore || 0) >= 0.75) reasons.push('Issuer legal entity closely matches');

	if (candidate.exactDealMatch) reasons.push('Exact deal name match');
	else if ((candidate.dealScore || 0) >= 0.75) reasons.push('Deal name closely matches');

	if ((candidate.sponsorScore || 0) >= 0.6) reasons.push('Sponsor / management name overlaps');
	if (candidate.exactGpMatch || candidate.exactSponsorEntityMatch || candidate.exactOperatorLegalMatch) {
		reasons.push('Related legal entity matches');
	}

	if (dealOfferingType && filingOfferingType && dealOfferingType === filingOfferingType) {
		reasons.push(`${filingOfferingType} exemption matches`);
	}

	if (dealMinimum !== null && filingMinimum !== null && Math.abs(dealMinimum - filingMinimum) <= 1) {
		reasons.push('Minimum investment matches');
	}

	const jurisdiction = String(filing?.jurisdiction || '').trim();
	if (jurisdiction) reasons.push(`SEC jurisdiction: ${jurisdiction}`);

	return [...new Set(reasons)].slice(0, 4);
}

function buildFilingRelatedPeople(filing = null) {
	const people = Array.isArray(filing?.related_persons) ? filing.related_persons : [];
	return people
		.map((person) => {
			const fullName = [person?.first_name, person?.last_name].filter(Boolean).join(' ').trim();
			const relationship = Array.isArray(person?.relationships) ? person.relationships.join(', ') : '';
			return [fullName, relationship].filter(Boolean).join(' — ').trim();
		})
		.filter(Boolean)
		.slice(0, 4);
}

function buildFilingSummary(filing, deal = null, searchContext = {}) {
	if (!filing?.id) return null;
	return {
		id: filing.id,
		cik: filing.cik || '',
		accessionNumber: filing.accession_number || '',
		filingDate: filing.filing_date || '',
		filingType: filing.filing_type || 'D',
		entityName: filing.entity_name || '',
		entityType: filing.entity_type || '',
		jurisdiction: filing.jurisdiction || '',
		federalExemptions: Array.isArray(filing.federal_exemptions) ? filing.federal_exemptions : [],
		dateOfFirstSale: filing.date_of_first_sale || '',
		totalOfferingAmount: filing.total_offering_amount ?? null,
		totalAmountSold: filing.total_amount_sold ?? null,
		totalInvestors: filing.total_investors ?? null,
		minimumInvestment: filing.minimum_investment ?? null,
		hasNonAccredited: filing.has_non_accredited === true,
		issuerCity: filing.issuer_city || '',
		issuerState: filing.issuer_state || '',
		issuerZip: filing.issuer_zip || '',
		issuerPhone: filing.issuer_phone || '',
		edgarUrl: filing.edgar_url || buildEdgarIndexUrl(filing.cik || '', filing.accession_number || ''),
		relatedPeople: buildFilingRelatedPeople(filing),
		discrepancies: buildSecDiscrepancies({ deal, filing, searchContext })
	};
}

function buildRecordSummary(record) {
	if (!record?.id) return null;
	return {
		id: record.id,
		opportunityId: record.opportunity_id,
		status: record.status,
		reasonCode: record.reason_code || '',
		reasonNote: record.reason_note || '',
		determinationSource: record.determination_source || '',
		matchConfidence: record.match_confidence ?? null,
		matchedCik: record.matched_cik || '',
		matchedAccessionNumber: record.matched_accession_number || '',
		matchedEntityName: record.matched_entity_name || '',
		lastCheckedAt: record.last_checked_at || null,
		verifiedAt: record.verified_at || null,
		secFilingId: record.sec_filing_id || null,
		resolutionSnapshot: record.resolution_snapshot || {},
		createdAt: record.created_at || null,
		updatedAt: record.updated_at || null
	};
}

function buildCandidateSummary(candidate, linkedFiling = null, deal = null, searchContext = {}) {
	if (!candidate) return null;
	return {
		cik: candidate.cik || '',
		cikPadded: candidate.cikPadded || '',
		accession: candidate.accession || '',
		entityName: candidate.entityName || '',
		fileDate: linkedFiling?.filing_date || candidate.fileDate || '',
		location: candidate.location || [linkedFiling?.issuer_city, linkedFiling?.issuer_state].filter(Boolean).join(', '),
		form: linkedFiling?.filing_type || candidate.form || 'D',
		score: candidate.score || 0,
		matchScore: candidate.matchScore || 0,
		dealScore: candidate.dealScore || 0,
		sponsorScore: candidate.sponsorScore || 0,
		issuerScore: candidate.issuerScore || 0,
		existingSecFilingId: linkedFiling?.id || null,
		edgarUrl: buildCandidateEdgarUrl(candidate, linkedFiling),
		entityType: linkedFiling?.entity_type || '',
		jurisdiction: linkedFiling?.jurisdiction || '',
		federalExemptions: Array.isArray(linkedFiling?.federal_exemptions) ? linkedFiling.federal_exemptions : [],
		dateOfFirstSale: linkedFiling?.date_of_first_sale || '',
		minimumInvestment: linkedFiling?.minimum_investment ?? null,
		totalAmountSold: linkedFiling?.total_amount_sold ?? null,
		totalInvestors: linkedFiling?.total_investors ?? null,
		hasNonAccredited: linkedFiling?.has_non_accredited === true,
		issuerState: linkedFiling?.issuer_state || '',
		issuerCity: linkedFiling?.issuer_city || '',
		relatedPeople: buildFilingRelatedPeople(linkedFiling),
		reasons: buildCandidateReasons({ deal, searchContext, candidate, filing: linkedFiling }),
		discrepancies: buildSecDiscrepancies({ deal, filing: linkedFiling, searchContext })
	};
}

async function requireViewerContext(req, res, supabase) {
	const viewerContext = await resolveDealViewerContext(req, { supabase });
	if (!viewerContext?.token || !viewerContext?.user) {
		res.status(401).json({ error: 'You need an active session to use SEC verification.' });
		return null;
	}
	return viewerContext;
}

async function loadDealContext(supabase, dealId, viewerContext) {
	const { data: deal, error } = await supabase
		.from('opportunities')
		.select(DEAL_SELECT)
		.eq('id', dealId)
		.maybeSingle();

	if (error) throw error;
	if (!deal) return { deal: null, record: null, filing: null };
	if (!canViewerAccessDeal(deal, viewerContext)) return { deal: null, record: null, filing: null };

	const { data: record, error: recordError } = await supabase
		.from('deal_sec_verification')
		.select(VERIFICATION_SELECT)
		.eq('opportunity_id', dealId)
		.maybeSingle();
	if (recordError && recordError.code !== 'PGRST116') throw recordError;

	let filing = record?.sec_filing || null;
	if (!filing) {
		const { data: linkedFiling, error: linkedFilingError } = await supabase
			.from('sec_filings')
			.select(FILING_SELECT)
			.eq('opportunity_id', dealId)
			.order('is_latest_amendment', { ascending: false })
			.order('created_at', { ascending: false })
			.limit(1)
			.maybeSingle();
		if (linkedFilingError && linkedFilingError.code !== 'PGRST116') throw linkedFilingError;
		filing = linkedFiling || null;
	}

	if (filing?.id) {
		const { data: relatedPeople, error: relatedPeopleError } = await supabase
			.from('related_persons')
			.select('first_name, last_name, relationships')
			.eq('sec_filing_id', filing.id)
			.order('last_name', { ascending: true });
		if (relatedPeopleError) throw relatedPeopleError;
		filing = {
			...filing,
			related_persons: relatedPeople || []
		};
	}

	return { deal, record: record || null, filing };
}

async function loadFilingsByAccession(supabase, accessions = []) {
	const cleaned = dedupeSecHits(
		(accessions || []).map((accession) => ({ accession }))
	).map((item) => item.accession);
	if (cleaned.length === 0) return {};

	const { data, error } = await supabase
		.from('sec_filings')
		.select(FILING_SELECT)
		.in('accession_number', cleaned);
	if (error) throw error;

	return Object.fromEntries(
		(data || []).map((filing) => [filing.accession_number, filing])
	);
}

async function hydrateCandidateDetails(candidates = []) {
	const detailsByAccession = {};
	await Promise.allSettled(
		(candidates || []).slice(0, 4).map(async (candidate) => {
			if (!candidate?.accession || !candidate?.cik && !candidate?.cikPadded) return;
			const { xml, url } = await fetchFilingXml(candidate.cikPadded || candidate.cik, candidate.accession);
			const parsed = parseFormD(xml);
			detailsByAccession[candidate.accession] = {
				cik: String(parsed.cik || candidate.cik || '').replace(/^0+/, ''),
				accession_number: candidate.accession,
				filing_date: candidate.fileDate || null,
				filing_type: parsed.filingType || candidate.form || 'D',
				entity_name: parsed.entityName || candidate.entityName || '',
				entity_type: parsed.entityType || '',
				jurisdiction: parsed.jurisdiction || '',
				issuer_phone: parsed.issuerPhone || '',
				issuer_city: parsed.issuerCity || '',
				issuer_state: parsed.issuerState || '',
				issuer_zip: parsed.issuerZip || '',
				federal_exemptions: parsed.federalExemptions || [],
				date_of_first_sale: parsed.dateOfFirstSale || null,
				minimum_investment: parsed.minimumInvestment,
				total_offering_amount: parsed.totalOfferingAmount,
				total_amount_sold: parsed.totalAmountSold,
				total_investors: parsed.totalInvestors,
				has_non_accredited: parsed.hasNonAccredited === true,
				is_equity: parsed.isEquity === true,
				is_debt: parsed.isDebt === true,
				is_pooled_fund: parsed.isPooledFund === true,
				related_persons: Array.isArray(parsed.relatedPersons)
					? parsed.relatedPersons.map((person) => ({
						first_name: person.firstName || '',
						last_name: person.lastName || '',
						relationships: person.relationships || []
					}))
					: [],
				edgar_url: url || buildEdgarIndexUrl(candidate.cikPadded || candidate.cik, candidate.accession)
			};
		})
	);
	return detailsByAccession;
}

async function buildResponsePayload({
	supabase,
	deal,
	record,
	filing,
	search = null
}) {
	const searchCandidates = Array.isArray(search?.candidates) ? search.candidates : [];
	const accessions = searchCandidates.map((candidate) => candidate.accession).filter(Boolean);
	const filingsByAccession = await loadFilingsByAccession(supabase, accessions);
	const candidateDetailsByAccession = search?.candidateDetails || {};
	const searchContext = buildSearchContextSummary(search?.searchContext || buildDealSecSearchContext(deal));
	const candidateSummaries = searchCandidates.map((candidate) =>
		buildCandidateSummary(candidate, candidateDetailsByAccession[candidate.accession] || filingsByAccession[candidate.accession], deal, searchContext)
	);
	const bestMatch = search?.bestMatch
		? buildCandidateSummary(search.bestMatch, candidateDetailsByAccession[search.bestMatch.accession] || filingsByAccession[search.bestMatch.accession], deal, searchContext)
		: null;

	return {
		dealId: deal.id,
		record: buildRecordSummary(record),
		filing: buildFilingSummary(filing, deal, searchContext),
		search: {
			hasRun: Boolean(search),
			queries: Array.isArray(search?.queries) ? search.queries : [],
			searchContext,
			searchedAt: search?.searchedAt || null,
			bestMatch,
			candidates: candidateSummaries
		},
		view: buildSecVerificationView({
			deal,
			record,
			filing,
			bestMatch,
			matches: candidateSummaries,
			searchPerformed: Boolean(search)
		})
	};
}

async function upsertVerificationRecord(supabase, payload) {
	const { data, error } = await supabase
		.from('deal_sec_verification')
		.upsert(payload, { onConflict: 'opportunity_id' })
		.select(VERIFICATION_SELECT)
		.single();
	if (error) throw error;
	return data;
}

function buildSearchSnapshot({ search, applicability }) {
	return {
		applicability,
		queries: search.queries,
		bestMatch: search.bestMatch
			? {
				entityName: search.bestMatch.entityName,
				accession: search.bestMatch.accession,
				cik: search.bestMatch.cik,
				matchScore: search.bestMatch.matchScore
			}
			: null,
		candidates: (search.candidates || []).slice(0, 5).map((candidate) => ({
			entityName: candidate.entityName,
			accession: candidate.accession,
			cik: candidate.cik,
			fileDate: candidate.fileDate,
			matchScore: candidate.matchScore
		}))
	};
}

async function handleGet(req, res, supabase, viewerContext) {
	const dealId = String(req.query?.dealId || '').trim();
	if (!isUuid(dealId)) return res.status(400).json({ error: 'dealId is required' });

	const context = await loadDealContext(supabase, dealId, viewerContext);
	if (!context.deal) return res.status(404).json({ error: 'Deal not found' });

	return res.status(200).json(await buildResponsePayload({
		supabase,
		deal: context.deal,
		record: context.record,
		filing: context.filing
	}));
}

async function handleRefreshMatch(req, res, supabase, viewerContext) {
	const dealId = String(req.body?.dealId || '').trim();
	if (!isUuid(dealId)) return res.status(400).json({ error: 'dealId is required' });

	const context = await loadDealContext(supabase, dealId, viewerContext);
	if (!context.deal) return res.status(404).json({ error: 'Deal not found' });

	const search = await findSecMatchesForDeal(context.deal);
	search.candidateDetails = await hydrateCandidateDetails(search.candidates);
	search.searchedAt = formatIsoNow();
	const applicability = deriveSecApplicability(context.deal);
	const currentStatus = normalizeSecVerificationStatus(context.record?.status);
	const nextStatus = context.filing?.id
		? 'verified'
		: context.record?.status
		? currentStatus
		: search.bestMatch
			? 'needs_review'
			: 'pending';

	const nextRecord = await upsertVerificationRecord(supabase, {
		opportunity_id: dealId,
		status: nextStatus,
		reason_code: context.record?.reason_code || (context.filing?.id ? 'existing_sec_filing' : applicability.reasonCode),
		reason_note: context.record?.reason_note || '',
		determination_source: context.record?.determination_source || (context.filing?.id ? 'existing_filing' : 'sec_match_check'),
		sec_filing_id: context.record?.sec_filing_id || context.filing?.id || null,
		match_confidence: context.filing?.id ? 1 : search.bestMatch?.matchScore || null,
		matched_cik: context.filing?.cik || search.bestMatch?.cik || '',
		matched_accession_number: context.filing?.accession_number || search.bestMatch?.accession || '',
		matched_entity_name: context.filing?.entity_name || search.bestMatch?.entityName || '',
		last_checked_at: search.searchedAt,
		verified_at: context.record?.verified_at || (context.filing?.id ? search.searchedAt : null),
		resolution_snapshot: buildSearchSnapshot({ search, applicability })
	});

	return res.status(200).json(await buildResponsePayload({
		supabase,
		deal: context.deal,
		record: nextRecord,
		filing: context.filing,
		search
	}));
}

async function handleSetStatus(req, res, supabase, viewerContext) {
	const dealId = String(req.body?.dealId || '').trim();
	const requestedStatus = normalizeSecVerificationStatus(req.body?.status);
	const note = String(req.body?.note || '').trim();

	if (!isUuid(dealId)) return res.status(400).json({ error: 'dealId is required' });
	if (!['have_not_filed_yet', 'not_applicable'].includes(requestedStatus)) {
		return res.status(400).json({ error: 'status must be have_not_filed_yet or not_applicable' });
	}

	const context = await loadDealContext(supabase, dealId, viewerContext);
	if (!context.deal) return res.status(404).json({ error: 'Deal not found' });
	if (context.filing?.id || context.record?.sec_filing_id) {
		return res.status(400).json({ error: 'This deal is already linked to an SEC filing. Keep it verified instead of using a manual state.' });
	}

	const applicability = deriveSecApplicability(context.deal);
	const reasonNote = note || applicability.reason;
	const nextRecord = await upsertVerificationRecord(supabase, {
		opportunity_id: dealId,
		status: requestedStatus,
		reason_code: requestedStatus === 'not_applicable' ? 'manual_not_applicable' : 'manual_have_not_filed_yet',
		reason_note: reasonNote,
		determination_source: 'manual',
		sec_filing_id: null,
		match_confidence: null,
		matched_cik: '',
		matched_accession_number: '',
		matched_entity_name: '',
		last_checked_at: context.record?.last_checked_at || formatIsoNow(),
		verified_at: null,
		resolution_snapshot: {
			applicability,
			manualStatus: requestedStatus,
			note: reasonNote
		}
	});

	return res.status(200).json(await buildResponsePayload({
		supabase,
		deal: context.deal,
		record: nextRecord,
		filing: null
	}));
}

async function handleConfirmMatch(req, res, supabase, viewerContext) {
	const dealId = String(req.body?.dealId || '').trim();
	const accession = String(req.body?.accession || '').trim();
	const cik = String(req.body?.cik || '').trim();
	const cikPadded = String(req.body?.cikPadded || '').trim();
	const entityName = String(req.body?.entityName || '').trim();
	const note = String(req.body?.note || '').trim();
	const matchScore = Number(req.body?.matchScore || 0);

	if (!isUuid(dealId)) return res.status(400).json({ error: 'dealId is required' });
	if (!accession) return res.status(400).json({ error: 'accession is required' });
	if (!cik && !cikPadded) return res.status(400).json({ error: 'cik is required' });

	const context = await loadDealContext(supabase, dealId, viewerContext);
	if (!context.deal) return res.status(404).json({ error: 'Deal not found' });

	let filing = context.filing?.accession_number === accession ? context.filing : null;
	let filingId = filing?.id || null;

	if (!filingId && context.record?.sec_filing_id && context.record?.matched_accession_number === accession) {
		filingId = context.record.sec_filing_id;
	}

	if (!filingId) {
		const { data: existingFiling, error: existingFilingError } = await supabase
			.from('sec_filings')
			.select('*')
			.eq('accession_number', accession)
			.maybeSingle();
		if (existingFilingError && existingFilingError.code !== 'PGRST116') throw existingFilingError;

		if (existingFiling?.id) {
			filing = existingFiling;
			filingId = existingFiling.id;
		}
	}

	if (!filingId) {
		const stored = await fetchAndStoreSecFiling({
			supabase,
			match: {
				accession,
				cik,
				cikPadded: cikPadded || cik,
				entityName
			},
			opportunityId: context.deal.id,
			managementCompanyId: context.deal.management_company_id || null
		});
		filing = stored.filing;
		filingId = stored.filing.id;
	}

	await applySecFilingToDeal({
		supabase,
		deal: context.deal,
		secFilingId: filingId,
		filing
	});

	const nextRecord = await upsertVerificationRecord(supabase, {
		opportunity_id: dealId,
		status: 'verified',
		reason_code: 'confirmed_sec_match',
		reason_note: note,
		determination_source: 'confirmed_match',
		sec_filing_id: filingId,
		match_confidence: Number.isFinite(matchScore) && matchScore > 0 ? matchScore : null,
		matched_cik: filing.cik || cik || '',
		matched_accession_number: filing.accession_number || accession,
		matched_entity_name: filing.entity_name || entityName,
		last_checked_at: formatIsoNow(),
		verified_at: formatIsoNow(),
		resolution_snapshot: {
			confirmedMatch: {
				accession: filing.accession_number || accession,
				cik: filing.cik || cik || '',
				entityName: filing.entity_name || entityName,
				matchScore: Number.isFinite(matchScore) && matchScore > 0 ? matchScore : null
			}
		}
	});

	const refreshed = await loadDealContext(supabase, dealId, viewerContext);
	return res.status(200).json(await buildResponsePayload({
		supabase,
		deal: refreshed.deal || context.deal,
		record: nextRecord,
		filing: refreshed.filing || filing
	}));
}

export default async function handler(req, res) {
	setCors(res);
	res.setHeader('Cache-Control', 'no-store');

	if (req.method === 'OPTIONS') return res.status(200).end();
	if (!['GET', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });

	const supabase = getAdminClient();
	const viewerContext = await requireViewerContext(req, res, supabase);
	if (!viewerContext) return;

	try {
		if (req.method === 'GET') {
			return await handleGet(req, res, supabase, viewerContext);
		}

		const action = String(req.body?.action || '').trim();
		switch (action) {
			case 'refresh-match':
				return await handleRefreshMatch(req, res, supabase, viewerContext);
			case 'set-status':
				return await handleSetStatus(req, res, supabase, viewerContext);
			case 'confirm-match':
				return await handleConfirmMatch(req, res, supabase, viewerContext);
			default:
				return res.status(400).json({ error: 'Unknown SEC verification action' });
		}
	} catch (error) {
		console.error('SEC verification error:', error);
		return res.status(500).json({ error: error?.message || 'Failed to process SEC verification.' });
	}
}
