export function getDealCreditBadgeLabel(deal = {}) {
	const assetClass = String(deal.assetClass || '').toLowerCase();
	if (assetClass === 'lending') return 'LENDING';
	if (assetClass.includes('credit')) return 'CREDIT';

	const strategy = String(deal.strategy || '').toLowerCase();
	if (strategy === 'lending') return 'LENDING';

	return 'CREDIT';
}

export function getDealHeroSummary(deal = {}) {
	const strategy = String(deal.investmentStrategy || '').trim();
	if (!strategy) return '';

	const sentenceBreak = strategy.indexOf('. ');
	if (sentenceBreak > 0) return strategy.slice(0, sentenceBreak + 1);
	if (strategy.length > 200) return `${strategy.slice(0, 200)}...`;
	return strategy;
}

export function getDealUrl(origin = '', dealOrId = null) {
	const dealId = typeof dealOrId === 'string' ? dealOrId : dealOrId?.id;
	if (!origin || !dealId) return '';
	return `${origin}/deal/${dealId}`;
}

export function buildDealShareMailtoHref(deal = {}, pageUrl = '') {
	const subject = encodeURIComponent(`Check out this deal: ${deal.investmentName || deal.name || 'Deal'}`);
	const body = encodeURIComponent(
		`I found this deal on GYC Dealflow and thought you might be interested:\n\n${deal.investmentName || deal.name || 'Deal'}\n${pageUrl}\n\nYou can sign up for free to see deal details, pitch decks, and more.`
	);
	return `mailto:?subject=${subject}&body=${body}`;
}

export function buildDealShareSmsHref(deal = {}, pageUrl = '') {
	const text = encodeURIComponent(`Check out this deal on GYC Dealflow: ${deal.investmentName || deal.name || 'Deal'} - ${pageUrl}`);
	return `sms:?&body=${text}`;
}

export function buildDealInviteSharePayload({ deal = {}, viewerName = 'Someone', inviteUrl = '' } = {}) {
	const dealName = deal.investmentName || deal.name || '';
	return {
		emailSubject: encodeURIComponent(`${viewerName} shared a deal with you: ${dealName}`),
		emailBody: encodeURIComponent(
			`${viewerName} thinks you might be interested in this deal:\n\n${dealName}\n\n${inviteUrl}\n\nView the full deal details on GYC Dealflow.`
		),
		smsBody: encodeURIComponent(`${viewerName} shared a deal: ${dealName} - ${inviteUrl}`)
	};
}

export function getDeckPreviewUrl(url) {
	if (!url) return null;
	if (url.includes('google.com/file') || url.includes('drive.google.com')) {
		const match = url.match(/\/d\/([a-zA-Z0-9_-]+)/);
		if (match) return `https://drive.google.com/file/d/${match[1]}/preview`;
	}
	if (url.includes('dropbox.com')) {
		return url.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '').replace('?dl=1', '');
	}
	if (url.endsWith('.pdf') || url.includes('.pdf?')) {
		return url;
	}
	return `https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true`;
}
