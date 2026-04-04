import { XMLParser } from 'fast-xml-parser';
import { buildDealSecSearchContext } from '../src/lib/sec/verification.js';

export const EDGAR_USER_AGENT = 'GYC Research pascal@growyourcashflow.com';
export const EFTS_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';
export const EDGAR_ARCHIVE_URL = 'https://www.sec.gov/Archives/edgar/data';
const EDGAR_INDEX_URL = 'https://www.sec.gov/Archives/edgar/data';

const GENERIC_WORDS =
	/\b(apartments?|fund|capital|group|partners|investments?|properties|holdings|llc|lp|inc|corp|company|co|the|real estate|realty|management|equity|ventures|advisors?|asset|wealth|financial|solutions)\b/gi;
const GENERIC_KEYWORD_SET = new Set([
	'apartments',
	'apartment',
	'fund',
	'capital',
	'group',
	'partners',
	'investment',
	'investments',
	'properties',
	'holdings',
	'llc',
	'lp',
	'inc',
	'corp',
	'company',
	'the',
	'real',
	'estate',
	'realty',
	'management',
	'equity',
	'ventures',
	'advisors',
	'advisor',
	'asset',
	'wealth',
	'financial',
	'solutions',
	'park',
	'plaza',
	'center',
	'village',
	'multiple',
	'associates',
	'strategies',
	'opportunity',
	'series',
	'class',
	'portfolio'
]);

function normalizeForMatch(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function normalizeSecMatchText(value) {
	return normalizeForMatch(value);
}

const ROMAN_NUMERAL_REPLACEMENTS = [
	[' III ', ' 3 '],
	[' II ', ' 2 '],
	[' IV ', ' 4 '],
	[' VI ', ' 6 '],
	[' VII ', ' 7 '],
	[' VIII ', ' 8 '],
	[' IX ', ' 9 '],
	[' X ', ' 10 ']
];

function buildQueryVariants(value) {
	const raw = String(value || '').trim();
	if (!raw) return [];

	const variants = new Set([raw]);
	const commaStripped = raw.replace(/,/g, '').replace(/\s+/g, ' ').trim();
	if (commaStripped) variants.add(commaStripped);

	const padded = ` ${commaStripped || raw} `;
	for (const [roman, digit] of ROMAN_NUMERAL_REPLACEMENTS) {
		if (padded.includes(roman)) {
			variants.add(padded.replace(roman, digit).trim());
		}
		if (padded.includes(digit)) {
			variants.add(padded.replace(digit, roman).trim());
		}
	}

	return [...variants].map((item) => item.trim()).filter(Boolean);
}

function parseFormDNumber(value) {
	if (value === null || value === undefined || value === '') return null;
	const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value).replace(/,/g, '').trim());
	return Number.isFinite(numeric) ? numeric : null;
}

function entitySuffix(value) {
	const normalized = normalizeForMatch(value);
	if (!normalized) return '';
	if (normalized.endsWith(' llc')) return 'llc';
	if (normalized.endsWith(' lp')) return 'lp';
	if (normalized.endsWith(' inc')) return 'inc';
	if (normalized.endsWith(' corp')) return 'corp';
	if (normalized.endsWith(' trust')) return 'trust';
	return '';
}

export function buildEdgarIndexUrl(cik, accession) {
	const normalizedCik = String(cik || '').replace(/^0+/, '');
	const normalizedAccession = String(accession || '').trim();
	if (!normalizedCik || !normalizedAccession) return '';
	const accessionPath = normalizedAccession.replace(/-/g, '');
	return `${EDGAR_INDEX_URL}/${normalizedCik}/${accessionPath}/${normalizedAccession}-index.html`;
}

export async function searchEdgar(companyName) {
	const url = `${EFTS_SEARCH_URL}?q=%22${encodeURIComponent(companyName)}%22&forms=D`;
	const resp = await fetch(url, {
		headers: { 'User-Agent': EDGAR_USER_AGENT }
	});
	if (!resp.ok) throw new Error(`EDGAR search failed: ${resp.status}`);
	const data = await resp.json();

	const hits = (data.hits && data.hits.hits) || [];
	return hits.map((hit) => {
		const source = hit._source || {};
		const cik = (source.ciks && source.ciks[0]) || '';
		return {
			cik: cik.replace(/^0+/, ''),
			cikPadded: cik,
			accession: String(source.adsh || '').trim(),
			form: source.form || 'D',
			fileDate: source.file_date || '',
			entityName: (source.display_names && source.display_names[0]) || '',
			location: (source.biz_locations && source.biz_locations[0]) || '',
			score: hit._score || 0
		};
	});
}

export async function fetchFilingXml(cik, accession) {
	const normalizedCik = String(cik || '').replace(/^0+/, '');
	const accessionPath = String(accession || '').replace(/-/g, '');
	const xmlUrl = `${EDGAR_ARCHIVE_URL}/${normalizedCik}/${accessionPath}/primary_doc.xml`;
	const url = buildEdgarIndexUrl(normalizedCik, accession);
	const resp = await fetch(xmlUrl, {
		headers: { 'User-Agent': EDGAR_USER_AGENT }
	});
	if (!resp.ok) throw new Error(`EDGAR filing fetch failed: ${resp.status} for ${xmlUrl}`);
	return { xml: await resp.text(), url, xmlUrl };
}

export function parseFormD(xmlText) {
	const parser = new XMLParser({
		ignoreAttributes: true,
		isArray: (name) => ['relatedPersonInfo', 'item', 'relationship'].includes(name)
	});
	const doc = parser.parse(xmlText);
	const submission = doc.edgarSubmission || doc;
	const issuer = submission.primaryIssuer || {};
	const offering = submission.offeringData || {};
	const address = issuer.issuerAddress || {};
	const yearOfInc = issuer.yearOfInc || {};
	const filing = offering.typeOfFiling || {};
	const amendment = filing.newOrAmendment || {};
	const amounts = offering.offeringSalesAmounts || {};
	const investors = offering.investors || {};
	const securities = offering.typesOfSecuritiesOffered || {};
	const commissions = offering.salesCommissionsFindersFees || {};
	const proceeds = offering.useOfProceeds || {};
	const exemptions = offering.federalExemptionsExclusions || {};

	const personsList = submission.relatedPersonsList || {};
	const personsRaw = personsList.relatedPersonInfo || [];
	const relatedPersons = personsRaw.map((person) => {
		const name = person.relatedPersonName || {};
		const personAddress = person.relatedPersonAddress || {};
		const relationships = person.relatedPersonRelationshipList || {};
		return {
			firstName: name.firstName || '',
			lastName: name.lastName || '',
			street: personAddress.street1 || '',
			city: personAddress.city || '',
			state: personAddress.stateOrCountry || '',
			zip: personAddress.zipCode || '',
			relationships: Array.isArray(relationships.relationship)
				? relationships.relationship
				: relationships.relationship
					? [relationships.relationship]
					: [],
			clarification: person.relationshipClarification || ''
		};
	});

	const exemptionItems = Array.isArray(exemptions.item)
		? exemptions.item
		: exemptions.item
			? [exemptions.item]
			: [];

	return {
		cik: issuer.cik || '',
		entityName: issuer.entityName || '',
		entityType: issuer.entityType || '',
		jurisdiction: issuer.jurisdictionOfInc || '',
		yearOfInc: yearOfInc.value ? parseInt(yearOfInc.value, 10) : null,
		issuerPhone: issuer.issuerPhoneNumber || '',
		issuerStreet: address.street1 || '',
		issuerCity: address.city || '',
		issuerState: address.stateOrCountry || '',
		issuerZip: address.zipCode || '',
		filingType: submission.submissionType || 'D',
		isAmendment: Boolean(amendment.isAmendment),
		previousAccession: amendment.previousAccessionNumber || null,
		industryGroup: (offering.industryGroup || {}).industryGroupType || '',
		issuerSize: (offering.issuerSize || {}).revenueRange || '',
		federalExemptions: exemptionItems,
		dateOfFirstSale: (filing.dateOfFirstSale || {}).value || null,
		isEquity: Boolean(securities.isEquityType),
		isDebt: Boolean(securities.isDebtType),
		isPooledFund: Boolean(securities.isPooledInvestmentFundType),
		minimumInvestment: parseFormDNumber(offering.minimumInvestmentAccepted),
		totalOfferingAmount: parseFormDNumber(amounts.totalOfferingAmount),
		totalAmountSold: parseFormDNumber(amounts.totalAmountSold),
		totalRemaining: parseFormDNumber(amounts.totalRemaining),
		totalInvestors: investors.totalNumberAlreadyInvested ? parseInt(investors.totalNumberAlreadyInvested, 10) : null,
		hasNonAccredited: Boolean(investors.hasNonAccreditedInvestors),
		salesCommissions: parseFormDNumber((commissions.salesCommissions || {}).dollarAmount),
		findersFees: parseFormDNumber((commissions.findersFees || {}).dollarAmount),
		grossProceedsUsed: parseFormDNumber((proceeds.grossProceedsUsed || {}).dollarAmount),
		proceedsClarification: proceeds.clarificationOfResponse || '',
		relatedPersons
	};
}

export function nameScore(leftName, rightName) {
	const deal = normalizeForMatch(leftName);
	const edgar = normalizeForMatch(rightName);
	if (!deal || !edgar) return 0;
	if (deal === edgar) return 1;
	if (deal.includes(edgar) || edgar.includes(deal)) return 0.85;

	const dealCore = deal.replace(GENERIC_WORDS, '').replace(/\s+/g, ' ').trim();
	const edgarCore = edgar.replace(GENERIC_WORDS, '').replace(/\s+/g, ' ').trim();
	if (dealCore && edgarCore && (dealCore.includes(edgarCore) || edgarCore.includes(dealCore))) {
		return 0.75;
	}

	const dealWords = new Set(deal.split(' ').filter((word) => word.length > 2 && !GENERIC_KEYWORD_SET.has(word)));
	const edgarWords = new Set(edgar.split(' ').filter((word) => word.length > 2 && !GENERIC_KEYWORD_SET.has(word)));
	if (dealWords.size === 0 || edgarWords.size === 0) return 0;

	let overlap = 0;
	for (const word of dealWords) {
		if (edgarWords.has(word)) overlap += 1;
	}
	if (overlap === 0) return 0;
	if (dealWords.size >= 3 && edgarWords.size >= 3 && overlap < 2) return overlap * 0.25;
	return overlap / Math.max(dealWords.size, edgarWords.size);
}

function buildMatchBreakdown(searchContext = {}, hit = {}) {
	const dealName = searchContext.dealName || '';
	const sponsorName = searchContext.sponsorName || '';
	const legalEntities = searchContext.legalEntities || {};
	const dealScore = nameScore(dealName, hit.entityName);
	const issuerScore = nameScore(legalEntities.issuerEntity, hit.entityName);
	const gpScore = nameScore(legalEntities.gpEntity, hit.entityName);
	const sponsorEntityScore = nameScore(legalEntities.sponsorEntity, hit.entityName);
	const operatorLegalEntityScore = nameScore(legalEntities.operatorLegalEntity, hit.entityName);
	let sponsorScore = 0;

	if (sponsorName) {
		const rawSponsorScore = nameScore(sponsorName, hit.entityName);
		if (rawSponsorScore > 0.5) {
			const normalizedEntity = normalizeForMatch(hit.entityName);
			const dealKeywords = normalizeForMatch(dealName)
				.split(' ')
				.filter(
					(word) =>
						word.length > 2
						&& !word.match(/apartments?|fund|llc|lp|the|inc|investment|capital|group|partners/i)
				);
			const dealOverlap = dealKeywords.some((word) => normalizedEntity.includes(word));
			sponsorScore = dealOverlap ? rawSponsorScore * 0.95 : rawSponsorScore * 0.4;
		}
	}

	const normalizedEntityName = normalizeForMatch(hit.entityName);
	const exactIssuerMatch = Boolean(
		legalEntities.issuerEntity && normalizedEntityName === normalizeForMatch(legalEntities.issuerEntity)
	);
	const exactDealMatch = Boolean(dealName && normalizedEntityName === normalizeForMatch(dealName));
	const exactSponsorEntityMatch = Boolean(
		legalEntities.sponsorEntity && normalizedEntityName === normalizeForMatch(legalEntities.sponsorEntity)
	);
	const exactGpMatch = Boolean(
		legalEntities.gpEntity && normalizedEntityName === normalizeForMatch(legalEntities.gpEntity)
	);
	const exactOperatorLegalMatch = Boolean(
		legalEntities.operatorLegalEntity && normalizedEntityName === normalizeForMatch(legalEntities.operatorLegalEntity)
	);

	const hitEntitySuffix = entitySuffix(hit.entityName);
	const issuerEntitySuffix = entitySuffix(legalEntities.issuerEntity);
	const suffixMismatchPenalty =
		hitEntitySuffix && issuerEntitySuffix && hitEntitySuffix !== issuerEntitySuffix ? 0.14 : 0;

	const baseScore = Math.max(
		dealScore,
		sponsorScore,
		issuerScore,
		gpScore * 0.92,
		sponsorEntityScore * 0.88,
		operatorLegalEntityScore * 0.88
	);
	const exactBonus =
		(exactIssuerMatch ? 0.35 : 0)
		+ (!exactIssuerMatch && exactDealMatch ? 0.18 : 0)
		+ (!exactIssuerMatch && (exactGpMatch || exactSponsorEntityMatch || exactOperatorLegalMatch) ? 0.16 : 0);
	const compositeScore = Math.max(0, baseScore + exactBonus - suffixMismatchPenalty + (Number(hit.score || 0) / 10000));

	return {
		dealScore,
		sponsorScore,
		issuerScore,
		gpScore,
		sponsorEntityScore,
		operatorLegalEntityScore,
		exactIssuerMatch,
		exactDealMatch,
		exactGpMatch,
		exactSponsorEntityMatch,
		exactOperatorLegalMatch,
		suffixMismatchPenalty,
		matchScore: compositeScore
	};
}

export function pickBestSecMatch(dealName, sponsorName, allHits = [], legalEntities = {}) {
	if (!Array.isArray(allHits) || allHits.length === 0) return null;

	let best = null;
	let bestScore = 0;
	const searchContext = { dealName, sponsorName, legalEntities };

	for (const hit of allHits) {
		const breakdown = buildMatchBreakdown(searchContext, hit);
		if (breakdown.matchScore > bestScore) {
			bestScore = breakdown.matchScore;
			best = {
				...hit,
				...breakdown
			};
		}
	}

	return best && best.matchScore >= 0.45 ? best : null;
}

function buildDealNameQueries(dealName) {
	const queries = [];
	const seen = new Set();

	function add(value) {
		for (const variant of buildQueryVariants(value)) {
			if (variant && variant.length > 2 && !seen.has(variant.toLowerCase())) {
				seen.add(variant.toLowerCase());
				queries.push(variant);
			}
		}
	}

	add(dealName);

	if (dealName) {
		const stripped = dealName
			.replace(/\b(apartments?|plaza|center|park|village|estates?|towers?|place|court|square|landing|crossing|ridge|hills?)\b/gi, '')
			.trim();
		add(stripped);
	}

	const parenthetical = String(dealName || '').match(/\(([^)]+)\)/);
	if (parenthetical) add(parenthetical[1]);

	return queries;
}

function buildLegalEntityQueries(legalEntities = {}) {
	const queries = [];
	const seen = new Set();

	function add(value) {
		for (const variant of buildQueryVariants(value)) {
			if (variant && variant.length > 2 && !seen.has(variant.toLowerCase())) {
				seen.add(variant.toLowerCase());
				queries.push(variant);
			}
		}
	}

	add(legalEntities.issuerEntity);
	add(legalEntities.gpEntity);
	add(legalEntities.sponsorEntity);
	add(legalEntities.operatorLegalEntity);

	return queries;
}

function buildFallbackQueries(dealName, sponsorName, legalEntities = {}) {
	const queries = [];
	const seen = new Set();

	function add(value) {
		for (const variant of buildQueryVariants(value)) {
			if (variant && variant.length > 2 && !seen.has(variant.toLowerCase())) {
				seen.add(variant.toLowerCase());
				queries.push(variant);
			}
		}
	}

	for (const query of buildLegalEntityQueries(legalEntities)) add(query);
	add(sponsorName);

	if (sponsorName && dealName) {
		const dealCore = dealName
			.replace(/\b(apartments?|fund|llc|lp|inc|the|investment|plaza|center|park)\b/gi, '')
			.trim()
			.split(/\s+/)[0];
		if (dealCore && dealCore.length > 2) add(`${sponsorName} ${dealCore}`);
	}

	return queries;
}

export function generateSecSearchQueries(dealName, sponsorName, legalEntities = {}, options = {}) {
	const mode = String(options.mode || 'all');
	const primaryQueries = buildDealNameQueries(dealName);
	const fallbackQueries = buildFallbackQueries(dealName, sponsorName, legalEntities);
	const legalQueries = buildLegalEntityQueries(legalEntities);

	if (mode === 'deal') return primaryQueries;
	if (mode === 'legal') return legalQueries;
	if (mode === 'fallback') return fallbackQueries;
	return [...legalQueries, ...primaryQueries, ...fallbackQueries.filter((query) => !legalQueries.includes(query) && !primaryQueries.includes(query))];
}

export function dedupeSecHits(hits = []) {
	const seen = new Set();
	const results = [];
	for (const hit of hits) {
		const accession = String(hit?.accession || '').trim();
		if (!accession || seen.has(accession)) continue;
		seen.add(accession);
		results.push(hit);
	}
	return results;
}

export async function findSecMatchesForDeal(
	deal = {},
	{ maxQueries = 6, earlyMatchScore = 0.75, fallbackTriggerScore = 0.72 } = {}
) {
	const searchContext = buildDealSecSearchContext(deal);
	const legalQueries = generateSecSearchQueries(
		searchContext.dealName,
		searchContext.sponsorName,
		searchContext.legalEntities,
		{ mode: 'legal' }
	);
	const dealQueries = generateSecSearchQueries(
		searchContext.dealName,
		searchContext.sponsorName,
		searchContext.legalEntities,
		{ mode: 'deal' }
	);
	const sponsorFallbackQueries = generateSecSearchQueries(
		searchContext.dealName,
		searchContext.sponsorName,
		searchContext.legalEntities,
		{ mode: 'fallback' }
	);
	const useLegalEntityFirst = Boolean(searchContext.legalEntities?.issuerEntity);
	const primaryQueries = (useLegalEntityFirst ? legalQueries : dealQueries).slice(0, maxQueries);
	const fallbackQueries = (useLegalEntityFirst
		? [...dealQueries, ...sponsorFallbackQueries.filter((query) => !dealQueries.includes(query))]
		: [...legalQueries, ...sponsorFallbackQueries.filter((query) => !legalQueries.includes(query))]
	).slice(0, maxQueries);

	let hits = [];
	const executedQueries = [];

	for (const query of primaryQueries) {
		const results = await searchEdgar(query);
		hits = dedupeSecHits([...hits, ...results]);
		executedQueries.push(query);
		const earlyMatch = pickBestSecMatch(searchContext.dealName, searchContext.sponsorName, hits, searchContext.legalEntities);
		if (earlyMatch && earlyMatch.matchScore >= earlyMatchScore) break;
	}

	const primaryBestMatch = pickBestSecMatch(searchContext.dealName, searchContext.sponsorName, hits, searchContext.legalEntities);

	if (!primaryBestMatch || primaryBestMatch.matchScore < fallbackTriggerScore) {
		for (const query of fallbackQueries) {
			const results = await searchEdgar(query);
			hits = dedupeSecHits([...hits, ...results]);
			executedQueries.push(query);
			const earlyMatch = pickBestSecMatch(searchContext.dealName, searchContext.sponsorName, hits, searchContext.legalEntities);
			if (earlyMatch && earlyMatch.matchScore >= earlyMatchScore) break;
		}
	}

	const candidates = hits
		.map((hit) => {
			return {
				...hit,
				...buildMatchBreakdown(searchContext, hit)
			};
		})
		.sort((left, right) => right.matchScore - left.matchScore)
		.slice(0, 8);

	return {
		queries: executedQueries,
		primaryQueries,
		fallbackQueries,
		searchContext,
		candidates,
		bestMatch: pickBestSecMatch(searchContext.dealName, searchContext.sponsorName, candidates, searchContext.legalEntities)
	};
}

function buildFilingRow({ opportunityId = null, managementCompanyId = null, accession, cik, parsed, xml, url, fileDate = null, isLatest = false }) {
	return {
		opportunity_id: opportunityId || null,
		management_company_id: managementCompanyId || null,
		cik: String(parsed.cik || cik || '').replace(/^0+/, ''),
		accession_number: accession,
		filing_date: fileDate || null,
		filing_type: parsed.filingType,
		is_latest_amendment: isLatest,
		entity_name: parsed.entityName,
		entity_type: parsed.entityType,
		jurisdiction: parsed.jurisdiction,
		year_of_inc: parsed.yearOfInc,
		issuer_phone: parsed.issuerPhone,
		issuer_street: parsed.issuerStreet,
		issuer_city: parsed.issuerCity,
		issuer_state: parsed.issuerState,
		issuer_zip: parsed.issuerZip,
		industry_group: parsed.industryGroup,
		issuer_size: parsed.issuerSize,
		federal_exemptions: parsed.federalExemptions,
		date_of_first_sale: parsed.dateOfFirstSale,
		is_equity: parsed.isEquity,
		is_debt: parsed.isDebt,
		is_pooled_fund: parsed.isPooledFund,
		minimum_investment: parsed.minimumInvestment,
		total_offering_amount: parsed.totalOfferingAmount,
		total_amount_sold: parsed.totalAmountSold,
		total_remaining: parsed.totalRemaining,
		total_investors: parsed.totalInvestors,
		has_non_accredited: parsed.hasNonAccredited,
		sales_commissions: parsed.salesCommissions,
		finders_fees: parsed.findersFees,
		gross_proceeds_used: parsed.grossProceedsUsed,
		proceeds_clarification: parsed.proceedsClarification,
		raw_xml: xml,
		edgar_url: url
	};
}

export async function upsertParsedSecFiling({
	supabase,
	opportunityId = null,
	managementCompanyId = null,
	accession,
	cik,
	parsed,
	xml,
	url,
	fileDate = null,
	isLatest = true
}) {
	const normalizedCik = String(parsed.cik || cik || '').replace(/^0+/, '');

	// Only manage the is_latest_amendment flag when explicitly setting this as latest.
	// Bulk loops (fetchAllFilingsForCik) pass isLatest: false and call markLatestFilingForCik
	// once after all filings are stored, so the flag lands on the correct (newest) row.
	if (isLatest) {
		await supabase
			.from('sec_filings')
			.update({ is_latest_amendment: false })
			.eq('cik', normalizedCik)
			.eq('is_latest_amendment', true);
	}

	const filingRow = buildFilingRow({
		opportunityId,
		managementCompanyId,
		accession,
		cik: normalizedCik,
		parsed,
		xml,
		url,
		fileDate,
		isLatest
	});

	const { data: filing, error } = await supabase
		.from('sec_filings')
		.upsert(filingRow, { onConflict: 'accession_number' })
		.select()
		.single();

	if (error) throw error;

	if (Array.isArray(parsed.relatedPersons) && parsed.relatedPersons.length > 0) {
		await supabase.from('related_persons').delete().eq('sec_filing_id', filing.id);

		const personRows = parsed.relatedPersons.map((person) => ({
			sec_filing_id: filing.id,
			management_company_id: managementCompanyId || null,
			first_name: person.firstName,
			last_name: person.lastName,
			street: person.street,
			city: person.city,
			state: person.state,
			zip: person.zip,
			relationships: person.relationships,
			relationship_clarification: person.clarification
		}));

		const { error: personsError } = await supabase.from('related_persons').insert(personRows);
		if (personsError) {
			console.error('Error inserting SEC related persons:', personsError);
		}
	}

	return {
		filing,
		parsed,
		personsCount: Array.isArray(parsed.relatedPersons) ? parsed.relatedPersons.length : 0
	};
}

export async function fetchAndStoreSecFiling({
	supabase,
	match,
	opportunityId = null,
	managementCompanyId = null
}) {
	if (!match?.accession) throw new Error('SEC match accession is required');
	if (!match?.cik && !match?.cikPadded) throw new Error('SEC match CIK is required');

	const { xml, url } = await fetchFilingXml(match.cikPadded || match.cik, match.accession);
	const parsed = parseFormD(xml);
	return upsertParsedSecFiling({
		supabase,
		opportunityId,
		managementCompanyId,
		accession: match.accession,
		cik: parsed.cik || match.cik,
		parsed,
		xml,
		url,
		fileDate: match.fileDate || null
	});
}

function normalizeComparableText(value) {
	return String(value || '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

export function buildDealUpdatesFromSecFiling(deal = {}, filing = {}, options = {}) {
	const forceIdentitySync = options?.forceIdentitySync === true;
	const federalExemptions = Array.isArray(filing.federal_exemptions)
		? filing.federal_exemptions
		: [];
	const is506b = federalExemptions.some((value) => value === '06b');
	const is506c = federalExemptions.some((value) => value === '06c');

	const updates = {};
	if (is506b) updates.offering_type = '506(b)';
	else if (is506c) updates.offering_type = '506(c)';
	updates.is_506b = is506b;
	if (filing.minimum_investment) updates.investment_minimum = filing.minimum_investment;
	if (filing.date_of_first_sale) updates.date_of_first_sale = filing.date_of_first_sale;
	if (filing.total_offering_amount) updates.offering_size = filing.total_offering_amount;
	if (filing.total_amount_sold) updates.total_amount_sold = filing.total_amount_sold;
	if (filing.total_investors) updates.total_investors = filing.total_investors;
	if (filing.cik) updates.sec_cik = filing.cik;
	if (filing.entity_name) {
		const currentIssuerEntity = String(deal.issuer_entity || '').trim();
		const currentSecEntityName = String(deal.sec_entity_name || '').trim();
		const issuerMatchesCurrentSecEntity =
			currentIssuerEntity
			&& currentSecEntityName
			&& normalizeComparableText(currentIssuerEntity) === normalizeComparableText(currentSecEntityName);

		if ('issuer_entity' in deal && (!currentIssuerEntity || (forceIdentitySync && issuerMatchesCurrentSecEntity))) {
			updates.issuer_entity = filing.entity_name;
		}

		if ('sec_entity_name' in deal && (forceIdentitySync || !currentSecEntityName)) {
			updates.sec_entity_name = filing.entity_name;
		}
	}

	if (!deal.investment_name && filing.entity_name) updates.investment_name = filing.entity_name;
	if (!deal.instrument) {
		if (filing.is_debt) updates.instrument = 'debt';
		else if (filing.is_equity) updates.instrument = 'equity';
		else if (filing.is_pooled_fund) updates.instrument = 'fund';
	}

	return { updates, is506b };
}

export async function fetchAllFilingsForCik(cik, opportunityId, supabase) {
	const normalizedCik = String(cik || '').replace(/^0+/, '');
	if (!normalizedCik) throw new Error('CIK is required');

	const searchUrl = `${EFTS_SEARCH_URL}?q=*&forms=D,D/A&ciks=${normalizedCik}`;
	const resp = await fetch(searchUrl, {
		headers: { 'User-Agent': EDGAR_USER_AGENT }
	});
	if (!resp.ok) throw new Error(`EDGAR CIK search failed: ${resp.status}`);
	const data = await resp.json();

	const hits = (data.hits && data.hits.hits) || [];
	if (hits.length === 0) return 0;

	let upsertCount = 0;

	for (const hit of hits) {
		const source = hit._source || {};
		const accession = String(source.adsh || '').trim();
		const hitCik = ((source.ciks && source.ciks[0]) || '').replace(/^0+/, '');
		const fileDate = source.file_date || null;

		if (!accession) continue;

		try {
			const { xml, url } = await fetchFilingXml(hitCik || normalizedCik, accession);
			const parsed = parseFormD(xml);

			await upsertParsedSecFiling({
				supabase,
				opportunityId: opportunityId || null,
				accession,
				cik: parsed.cik || hitCik || normalizedCik,
				parsed,
				xml,
				url,
				fileDate,
				isLatest: false  // Never set the flag in the loop — markLatestFilingForCik handles it once after
			});

			upsertCount += 1;
		} catch (err) {
			console.warn(`Failed to fetch/store filing ${accession} for CIK ${normalizedCik}:`, err.message);
		}

		// EDGAR rate limit: ~10 req/sec, 150ms delay keeps us safe
		if (hits.indexOf(hit) < hits.length - 1) {
			await new Promise((resolve) => setTimeout(resolve, 150));
		}
	}

	// Set is_latest_amendment = true on the single newest filing for this CIK.
	// Done once after all filings are stored, so the flag always lands on the correct row.
	if (upsertCount > 0) {
		await markLatestFilingForCik(normalizedCik, supabase);
	}

	return upsertCount;
}

/**
 * markLatestFilingForCik — idempotent flag repair
 *
 * Finds the filing with the newest filing_date for a given CIK, clears
 * is_latest_amendment on ALL rows for that CIK, then sets is_latest_amendment
 * = true on the single newest row.
 *
 * Safe to call multiple times. Must be called after any bulk upsert loop.
 * Also enforced by the unique partial index: idx_one_latest_per_cik.
 *
 * @param {string} cik
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{id: string, filing_date: string}|null>} The row that was marked latest, or null if no filings exist
 */
export async function markLatestFilingForCik(cik, supabase) {
	const normalizedCik = String(cik || '').replace(/^0+/, '');
	if (!normalizedCik) throw new Error('CIK is required');

	// Find the newest filing by filing_date. Rows without a date sort last.
	const { data: newest, error: fetchError } = await supabase
		.from('sec_filings')
		.select('id, filing_date')
		.eq('cik', normalizedCik)
		.not('filing_date', 'is', null)
		.order('filing_date', { ascending: false })
		.limit(1)
		.maybeSingle();

	if (fetchError) throw fetchError;
	if (!newest) return null;

	// Step 1: Clear ALL flags for this CIK
	const { error: clearError } = await supabase
		.from('sec_filings')
		.update({ is_latest_amendment: false })
		.eq('cik', normalizedCik);
	if (clearError) throw clearError;

	// Step 2: Set only the newest row to true
	const { error: setError } = await supabase
		.from('sec_filings')
		.update({ is_latest_amendment: true })
		.eq('id', newest.id);
	if (setError) throw setError;

	return newest;
}

/**
 * refreshSecFilingsForDeal — canonical idempotent refresh
 *
 * Fetches ALL SEC filings for a deal's CIK from EDGAR, upserts them all,
 * calls markLatestFilingForCik to ensure exactly one is_latest_amendment = true,
 * then pushes the latest filing data to the opportunities row.
 *
 * @param {string} dealId — UUID of the opportunity
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @returns {Promise<{upsertCount: number, latestFiling: object|null}>}
 */
export async function refreshSecFilingsForDeal(dealId, supabase) {
	if (!dealId) throw new Error('dealId is required');

	// Resolve CIK: try deal.sec_cik first, fall back to existing sec_filings row
	const { data: deal, error: dealError } = await supabase
		.from('opportunities')
		.select('id, sec_cik, investment_name, management_company_id, issuer_entity, sec_entity_name, instrument')
		.eq('id', dealId)
		.single();

	if (dealError || !deal) throw new Error(`Deal not found: ${dealId}`);

	let cik = deal.sec_cik;
	if (!cik) {
		const { data: existingFiling } = await supabase
			.from('sec_filings')
			.select('cik')
			.eq('opportunity_id', dealId)
			.limit(1)
			.maybeSingle();
		cik = existingFiling?.cik;
	}

	if (!cik) throw new Error(`No CIK found for deal ${dealId} — set sec_cik on the opportunity first`);

	// Fetch all filings and mark latest
	const upsertCount = await fetchAllFilingsForCik(cik, dealId, supabase);

	// Read back the now-correctly-flagged latest filing
	const normalizedCik = String(cik).replace(/^0+/, '');
	const { data: latestFiling } = await supabase
		.from('sec_filings')
		.select('*')
		.eq('cik', normalizedCik)
		.eq('is_latest_amendment', true)
		.maybeSingle();

	if (latestFiling) {
		const { updates } = buildDealUpdatesFromSecFiling(deal, latestFiling, {});
		if (Object.keys(updates).length > 0) {
			updates.sec_data_refreshed_at = new Date().toISOString();
			const { error: updateError } = await supabase
				.from('opportunities')
				.update(updates)
				.eq('id', dealId);
			if (updateError) throw updateError;
		}
	}

	return { upsertCount, latestFiling: latestFiling || null };
}

export async function applySecFilingToDeal({
	supabase,
	deal,
	secFilingId,
	filing,
	options = {}
}) {
	if (!deal?.id) throw new Error('Deal is required');
	if (!secFilingId) throw new Error('SEC filing ID is required');
	if (!filing) throw new Error('SEC filing payload is required');

	const { updates, is506b } = buildDealUpdatesFromSecFiling(deal, filing, options);

	await supabase.from('sec_filings').update({ opportunity_id: deal.id }).eq('id', secFilingId);

	const { error: dealUpdateError } = await supabase
		.from('opportunities')
		.update(updates)
		.eq('id', deal.id);
	if (dealUpdateError) throw dealUpdateError;

	if (deal.management_company_id) {
		const { data: managementCompany } = await supabase
			.from('management_companies')
			.select('*')
			.eq('id', deal.management_company_id)
			.single();

		const managementCompanyUpdates = {};
		if (managementCompany) {
			if (!managementCompany.hq_city && filing.issuer_city) managementCompanyUpdates.hq_city = filing.issuer_city;
			if (!managementCompany.hq_state && filing.issuer_state) managementCompanyUpdates.hq_state = filing.issuer_state;
			if (!managementCompany.hq_zip && filing.issuer_zip) managementCompanyUpdates.hq_zip = filing.issuer_zip;
			if (!managementCompany.founding_year && filing.year_of_inc) managementCompanyUpdates.founding_year = filing.year_of_inc;

			if (Object.keys(managementCompanyUpdates).length > 0) {
				await supabase
					.from('management_companies')
					.update(managementCompanyUpdates)
					.eq('id', deal.management_company_id);
			}

			await supabase
				.from('sec_filings')
				.update({ management_company_id: deal.management_company_id })
				.eq('id', secFilingId);
		}
	}

	return { success: true, updates, is506b };
}
