import { XMLParser } from 'fast-xml-parser';
import { buildDealSecSearchContext } from '../src/lib/sec/verification.js';

export const EDGAR_USER_AGENT = 'GYC Research pascal@growyourcashflow.com';
export const EFTS_SEARCH_URL = 'https://efts.sec.gov/LATEST/search-index';
export const EDGAR_ARCHIVE_URL = 'https://www.sec.gov/Archives/edgar/data';

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
	const accessionPath = String(accession || '').replace(/-/g, '');
	const url = `${EDGAR_ARCHIVE_URL}/${cik}/${accessionPath}/primary_doc.xml`;
	const resp = await fetch(url, {
		headers: { 'User-Agent': EDGAR_USER_AGENT }
	});
	if (!resp.ok) throw new Error(`EDGAR filing fetch failed: ${resp.status} for ${url}`);
	return { xml: await resp.text(), url };
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
		minimumInvestment: offering.minimumInvestmentAccepted ? parseFloat(offering.minimumInvestmentAccepted) : null,
		totalOfferingAmount: amounts.totalOfferingAmount ? parseFloat(amounts.totalOfferingAmount) : null,
		totalAmountSold: amounts.totalAmountSold ? parseFloat(amounts.totalAmountSold) : null,
		totalRemaining: amounts.totalRemaining ? parseFloat(amounts.totalRemaining) : null,
		totalInvestors: investors.totalNumberAlreadyInvested ? parseInt(investors.totalNumberAlreadyInvested, 10) : null,
		hasNonAccredited: Boolean(investors.hasNonAccreditedInvestors),
		salesCommissions: (commissions.salesCommissions || {}).dollarAmount
			? parseFloat(commissions.salesCommissions.dollarAmount)
			: null,
		findersFees: (commissions.findersFees || {}).dollarAmount
			? parseFloat(commissions.findersFees.dollarAmount)
			: null,
		grossProceedsUsed: (proceeds.grossProceedsUsed || {}).dollarAmount
			? parseFloat(proceeds.grossProceedsUsed.dollarAmount)
			: null,
		proceedsClarification: proceeds.clarificationOfResponse || '',
		relatedPersons
	};
}

export function nameScore(dealName, edgarName) {
	const deal = normalizeForMatch(dealName);
	const edgar = normalizeForMatch(edgarName);
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

export function pickBestSecMatch(dealName, sponsorName, allHits = []) {
	if (!Array.isArray(allHits) || allHits.length === 0) return null;

	let best = null;
	let bestScore = 0;

	for (const hit of allHits) {
		const dealScore = nameScore(dealName, hit.entityName);
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

		const compositeScore = Math.max(dealScore, sponsorScore) + (Number(hit.score || 0) / 10000);
		if (compositeScore > bestScore) {
			bestScore = compositeScore;
			best = {
				...hit,
				dealScore,
				sponsorScore,
				matchScore: compositeScore
			};
		}
	}

	return best && best.matchScore >= 0.45 ? best : null;
}

function buildDealNameQueries(dealName) {
	const queries = [];
	const seen = new Set();

	function add(value) {
		const cleaned = String(value || '').trim();
		if (cleaned && cleaned.length > 2 && !seen.has(cleaned.toLowerCase())) {
			seen.add(cleaned.toLowerCase());
			queries.push(cleaned);
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

function buildFallbackQueries(dealName, sponsorName, legalEntities = {}) {
	const queries = [];
	const seen = new Set();

	function add(value) {
		const cleaned = String(value || '').trim();
		if (cleaned && cleaned.length > 2 && !seen.has(cleaned.toLowerCase())) {
			seen.add(cleaned.toLowerCase());
			queries.push(cleaned);
		}
	}

	add(legalEntities.issuerEntity);
	add(legalEntities.gpEntity);
	add(legalEntities.sponsorEntity);
	add(legalEntities.operatorLegalEntity);
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

	if (mode === 'deal') return primaryQueries;
	if (mode === 'fallback') return fallbackQueries;
	return [...primaryQueries, ...fallbackQueries.filter((query) => !primaryQueries.includes(query))];
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
	const primaryQueries = generateSecSearchQueries(
		searchContext.dealName,
		searchContext.sponsorName,
		searchContext.legalEntities,
		{ mode: 'deal' }
	).slice(0, maxQueries);
	const fallbackQueries = generateSecSearchQueries(
		searchContext.dealName,
		searchContext.sponsorName,
		searchContext.legalEntities,
		{ mode: 'fallback' }
	).slice(0, maxQueries);

	let hits = [];
	const executedQueries = [];

	for (const query of primaryQueries) {
		const results = await searchEdgar(query);
		hits = dedupeSecHits([...hits, ...results]);
		executedQueries.push(query);
		const earlyMatch = pickBestSecMatch(searchContext.dealName, searchContext.sponsorName, hits);
		if (earlyMatch && earlyMatch.matchScore >= earlyMatchScore) break;
	}

	const primaryBestMatch = pickBestSecMatch(searchContext.dealName, searchContext.sponsorName, hits);

	if (!primaryBestMatch || primaryBestMatch.matchScore < fallbackTriggerScore) {
		for (const query of fallbackQueries) {
			const results = await searchEdgar(query);
			hits = dedupeSecHits([...hits, ...results]);
			executedQueries.push(query);
			const earlyMatch = pickBestSecMatch(searchContext.dealName, searchContext.sponsorName, hits);
			if (earlyMatch && earlyMatch.matchScore >= earlyMatchScore) break;
		}
	}

	const candidates = hits
		.map((hit) => {
			const dealScore = nameScore(searchContext.dealName, hit.entityName);
			const sponsorScore = nameScore(searchContext.sponsorName, hit.entityName);
			return {
				...hit,
				dealScore,
				sponsorScore,
				matchScore: Math.max(dealScore, sponsorScore) + (Number(hit.score || 0) / 10000)
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
		bestMatch: pickBestSecMatch(searchContext.dealName, searchContext.sponsorName, candidates)
	};
}

function buildFilingRow({ opportunityId = null, managementCompanyId = null, accession, cik, parsed, xml, url }) {
	return {
		opportunity_id: opportunityId || null,
		management_company_id: managementCompanyId || null,
		cik: String(parsed.cik || cik || '').replace(/^0+/, ''),
		accession_number: accession,
		filing_date: parsed.dateOfFirstSale || null,
		filing_type: parsed.filingType,
		is_latest_amendment: true,
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
	url
}) {
	const normalizedCik = String(parsed.cik || cik || '').replace(/^0+/, '');

	await supabase
		.from('sec_filings')
		.update({ is_latest_amendment: false })
		.eq('cik', normalizedCik)
		.eq('is_latest_amendment', true);

	const filingRow = buildFilingRow({
		opportunityId,
		managementCompanyId,
		accession,
		cik: normalizedCik,
		parsed,
		xml,
		url
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
		url
	});
}

export function buildDealUpdatesFromSecFiling(deal = {}, filing = {}) {
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

	if (!deal.investment_name && filing.entity_name) updates.investment_name = filing.entity_name;
	if (!deal.instrument) {
		if (filing.is_debt) updates.instrument = 'debt';
		else if (filing.is_equity) updates.instrument = 'equity';
		else if (filing.is_pooled_fund) updates.instrument = 'fund';
	}

	return { updates, is506b };
}

export async function applySecFilingToDeal({
	supabase,
	deal,
	secFilingId,
	filing
}) {
	if (!deal?.id) throw new Error('Deal is required');
	if (!secFilingId) throw new Error('SEC filing ID is required');
	if (!filing) throw new Error('SEC filing payload is required');

	const { updates, is506b } = buildDealUpdatesFromSecFiling(deal, filing);

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
