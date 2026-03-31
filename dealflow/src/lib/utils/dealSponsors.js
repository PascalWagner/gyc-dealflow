export function getDealSponsors(deal) {
	if (!Array.isArray(deal?.sponsors)) return [];
	return deal.sponsors.filter(Boolean);
}

export function getDealOperator(deal) {
	const sponsors = getDealSponsors(deal);
	const managementCompanyName =
		deal?.management_company_name
		|| deal?.managementCompanyName
		|| deal?.management_company?.operator_name
		|| deal?.managementCompany
		|| deal?.management_company
		|| deal?.sponsor_name
		|| deal?.sponsor
		|| '';
	const managementCompanyId =
		deal?.management_company_id
		|| deal?.managementCompanyId
		|| deal?.management_company?.id
		|| '';
	const operator =
		sponsors.find((sponsor) => sponsor?.role === 'operator')
		|| sponsors.find((sponsor) => sponsor?.role === 'sponsor')
		|| sponsors[0]
		|| null;

	return {
		role: operator?.role || 'operator',
		name: operator?.name || operator?.company || managementCompanyName,
		ceo: operator?.ceo || deal?.ceo || '',
		foundingYear: operator?.foundingYear || deal?.mcFoundingYear || null,
		website: operator?.website || deal?.mcWebsite || '',
		managementCompanyId:
			operator?.managementCompanyId
			|| managementCompanyId
			|| operator?.id
			|| '',
		company: operator?.company || operator?.name || managementCompanyName
	};
}

export function getDealOperatorName(deal, fallback = 'the operator') {
	const operator = getDealOperator(deal);
	return operator?.name || fallback;
}
