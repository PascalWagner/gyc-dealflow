export const config = {
	maxDuration: 120
};

async function relayToLegacyHandler(fetchFn, origin, cronHeader) {
	const target = new URL('/api/ghl-sync', origin);
	if (process.env.SYNC_SECRET) {
		target.searchParams.set('secret', process.env.SYNC_SECRET);
	}

	const response = await fetchFn(target.toString(), {
		method: 'GET',
		headers: {
			'x-vercel-cron': cronHeader || '1',
			'x-sync-secret': process.env.SYNC_SECRET || ''
		}
	});

	const body = await response.text();
	return new Response(body, {
		status: response.status,
		headers: {
			'content-type': response.headers.get('content-type') || 'application/json; charset=utf-8'
		}
	});
}

export async function GET({ fetch, url, request }) {
	return relayToLegacyHandler(fetch, url.origin, request.headers.get('x-vercel-cron'));
}

export async function POST({ fetch, url, request }) {
	return relayToLegacyHandler(fetch, url.origin, request.headers.get('x-vercel-cron'));
}
