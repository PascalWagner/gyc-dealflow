export function getDealHeroImage(deal = {}) {
	const text = [
		deal.investmentName,
		deal.investmentStrategy,
		deal.managementCompany,
		deal.assetClass,
		deal.strategy
	].filter(Boolean).join(' ').toLowerCase();

	let hash = 0;
	const seed = deal.investmentName || '';
	for (let i = 0; i < seed.length; i += 1) {
		hash = ((hash << 5) - hash) + seed.charCodeAt(i);
		hash |= 0;
	}
	hash = Math.abs(hash);

	function pick(options) {
		return options[hash % options.length];
	}

	if (/\b(oil|gas|energy|petroleum|petro|drilling|wellhead|pipeline)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1513828583688-c52646db42da?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1532601224476-15c79f2f7a51?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(medical|health|hospital|clinic|pharma|biotech|surgical|healthcare|dental|receivable)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1538108149393-fbbd81895907?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1516549655169-df83a0774514?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(restaurant|dining|food|cafe|brewhouse|kitchen|bj.?s|taco|pizza|burger|chicken|steakhouse)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(car\s*wash|auto\s*wash|express\s*wash)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(aviation|aircraft|airplane|jet|airline|airport|flight)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1517479149777-5f3b1511d5ad?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1474302770737-173ee21bab63?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(solar|renewable|wind\s*farm|clean\s*energy|green\s*energy)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1508514177221-188b1cf16e9d?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(data\s*center|server|tech|digital|cloud|fiber|telecom)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(farm|agriculture|crop|harvest|vineyard|winery|ranch)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1625246333195-78d9c38ad449?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(senior|assisted\s*living|retirement|elder|memory\s*care|nursing)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1582719471384-894fbb16e074?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1559181567-c3190ca9959b?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(student|campus|university|dorm|college)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1498243691581-b145c3f54a5a?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1562774053-701939374585?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(parking|garage|valet)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(marina|boat|yacht|harbor|dock|waterfront)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1559494007-9f5847c49d94?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(life\s*settlem|insurance|annuit|life\s*polic)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=600&h=400&fit=crop'
		]);
	}
	if (/\b(litigation|legal|lawsuit|attorney|court)\b/.test(text)) {
		return pick([
			'https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1505664194779-8beaceb93744?w=600&h=400&fit=crop'
		]);
	}

	const assetClass = (deal.assetClass || '').toLowerCase();
	if (assetClass.includes('multi family') || assetClass.includes('multifamily') || assetClass.includes('multi-family')) {
		return pick([
			'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1460317442991-0ec209397118?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1574362848149-11496d93a7c7?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('industrial')) {
		return pick([
			'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1565610222536-ef125c59da2e?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('self storage') || assetClass.includes('storage')) {
		return pick([
			'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1600585152220-90363fe7e115?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('hotel') || assetClass.includes('hospitality')) {
		return pick([
			'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('short term rental') || assetClass.includes('str') || assetClass.includes('vacation')) {
		return pick([
			'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('rv') || assetClass.includes('mobile home') || assetClass.includes('manufactured')) {
		return pick([
			'https://images.unsplash.com/photo-1520038410233-7141be7e6f97?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1523755231516-e43fd2e8dca5?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('mixed')) {
		return pick([
			'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1486718448742-163732cd1544?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('nnn') || assetClass.includes('net lease') || assetClass.includes('retail')) {
		return pick([
			'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1555636222-cae831e670b3?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('office')) {
		return pick([
			'https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('business') || assetClass.includes('other')) {
		return pick([
			'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop'
		]);
	}
	if (assetClass.includes('lending') || assetClass.includes('credit') || assetClass.includes('debt')) {
		return pick([
			'https://images.unsplash.com/photo-1554224154-26032ffc0d07?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=600&h=400&fit=crop',
			'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?w=600&h=400&fit=crop'
		]);
	}

	return pick([
		'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&h=400&fit=crop',
		'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=400&fit=crop',
		'https://images.unsplash.com/photo-1582407947304-fd86f028f716?w=600&h=400&fit=crop'
	]);
}
