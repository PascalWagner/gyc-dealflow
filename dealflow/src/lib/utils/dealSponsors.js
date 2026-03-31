export function getDealSponsors(deal) {
	if (!Array.isArray(deal?.sponsors)) return [];
	return deal.sponsors.filter(Boolean);
}

export function getDealOperator(deal) {
	const sponsors = getDealSponsors(deal);
	const operator =
		sponsors.find((sponsor) => sponsor?.role === 'operator')
		|| sponsors.find((sponsor) => sponsor?.role === 'sponsor')
		|| sponsors[0]
		|| null;

	return {
		role: operator?.role || 'operator',
		name: operator?.name || operator?.company || deal?.managementCompany || deal?.sponsor || '',
		ceo: operator?.ceo || deal?.ceo || '',
		foundingYear: operator?.foundingYear || deal?.mcFoundingYear || null,
		website: operator?.website || deal?.mcWebsite || '',
		managementCompanyId:
			operator?.managementCompanyId
			|| deal?.managementCompanyId
			|| operator?.id
			|| '',
		company: operator?.company || operator?.name || deal?.managementCompany || deal?.sponsor || ''
	};
}

export function getDealOperatorName(deal, fallback = 'the operator') {
	const operator = getDealOperator(deal);
	return operator?.name || fallback;
}
