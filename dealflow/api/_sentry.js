/**
 * Sentry error capture for Vercel serverless API functions.
 *
 * Usage:
 *   import { captureApiError } from './_sentry.js';
 *
 *   catch (err) {
 *     captureApiError(err, { endpoint: 'POST /api/deals', userId: user?.id });
 *     return res.status(500).json({ error: 'Internal server error' });
 *   }
 */

import * as Sentry from '@sentry/node';

let initialized = false;

function ensureInit() {
	if (initialized) return;
	Sentry.init({
		dsn: 'https://6598c8b771023b3232d2f0d554573e70@o4511162432749568.ingest.us.sentry.io/4511162442842112',
		tracesSampleRate: 0.1,
		environment: process.env.VERCEL_ENV || 'development'
	});
	initialized = true;
}

export function captureApiError(error, context = {}) {
	ensureInit();
	Sentry.withScope((scope) => {
		if (context.endpoint) scope.setTag('api.endpoint', context.endpoint);
		if (context.userId) scope.setUser({ id: context.userId });
		if (context.email) scope.setUser({ email: context.email });
		if (context.method) scope.setTag('api.method', context.method);
		for (const [key, value] of Object.entries(context)) {
			if (!['endpoint', 'userId', 'email', 'method'].includes(key)) {
				scope.setExtra(key, value);
			}
		}
		Sentry.captureException(error);
	});
}

export function captureApiWarning(message, context = {}) {
	ensureInit();
	Sentry.withScope((scope) => {
		scope.setLevel('warning');
		if (context.endpoint) scope.setTag('api.endpoint', context.endpoint);
		if (context.userId) scope.setUser({ id: context.userId });
		if (context.email) scope.setUser({ email: context.email });
		for (const [key, value] of Object.entries(context)) {
			if (!['endpoint', 'userId', 'email'].includes(key)) {
				scope.setExtra(key, value);
			}
		}
		Sentry.captureMessage(message);
	});
}
