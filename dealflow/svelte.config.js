import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	onwarn(warning, defaultHandler) {
		if (warning?.code?.startsWith('a11y_')) return;
		if (warning?.code === 'css_unused_selector') return;
		defaultHandler(warning);
	},
	kit: {
		adapter: adapter({
			// Keep existing API routes as standalone serverless functions
			runtime: 'nodejs20.x'
		}),
		// Don't conflict with existing /api endpoints (Vercel handles these)
		files: {
			assets: 'static'
		}
	}
};

export default config;
