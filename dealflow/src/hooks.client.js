import * as Sentry from '@sentry/sveltekit';

Sentry.init({
	dsn: 'https://6598c8b771023b3232d2f0d554573e70@o4511162432749568.ingest.us.sentry.io/4511162442842112',
	tracesSampleRate: 0.1,
	replaysSessionSampleRate: 0,
	replaysOnErrorSampleRate: 1.0,
	environment: window.location.hostname.includes('dealflow.growyourcashflow.io')
		? 'production'
		: window.location.hostname.includes('sandbox')
			? 'sandbox'
			: 'development'
});

export const handleError = Sentry.handleErrorWithSentry();
