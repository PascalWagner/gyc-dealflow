/**
 * JWT helpers for test fixtures.
 * Used by both unit tests (Node) and Playwright smoke tests.
 */

export function base64UrlEncode(value) {
	return Buffer.from(value)
		.toString('base64')
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '');
}

export function fakeJwt(email) {
	const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
	const payload = base64UrlEncode(JSON.stringify({
		sub: `user-${email}`,
		email,
		role: 'authenticated',
		exp: Math.floor(Date.now() / 1000) + 60 * 60
	}));
	return `${header}.${payload}.signature`;
}

export function decodeAuthEmail(authorizationHeader) {
	if (!authorizationHeader?.startsWith('Bearer ')) return '';
	const [, token] = authorizationHeader.split(' ');
	const payload = token.split('.')[1];
	if (!payload) return '';

	try {
		const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
		const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
		const parsed = JSON.parse(Buffer.from(padded, 'base64').toString('utf8'));
		return String(parsed.email || '').toLowerCase();
	} catch {
		return '';
	}
}
