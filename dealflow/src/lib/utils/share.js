import { browser } from '$app/environment';

let Share = null;
let initialized = false;

function isNativeContext() {
	return browser && !!window.Capacitor?.isNativePlatform?.();
}

async function init() {
	if (initialized || !browser || !isNativeContext()) return;
	initialized = true;

	try {
		const mod = await new Function('specifier', 'return import(specifier)')('@capacitor/share');
		Share = mod.Share;
	} catch {}
}

if (browser) {
	void init();
}

export function canShare() {
	if (!browser) return false;
	return isNativeContext() || typeof navigator.share === 'function';
}

export async function shareDeal(deal) {
	if (!browser) return false;

	const title = deal?.investmentName || deal?.name || 'Investment Opportunity';
	const text = `Check out ${title} on Cashflow Academy`;
	const url = `https://dealflow.growyourcashflow.io/deal/${deal?.id}`;

	if (isNativeContext()) {
		await init();
		if (Share) {
			try {
				await Share.share({ title, text, url, dialogTitle: 'Share this deal' });
				return true;
			} catch {}
		}
	}

	if (typeof navigator.share === 'function') {
		try {
			await navigator.share({ title, text, url });
			return true;
		} catch {}
	}

	return false;
}
