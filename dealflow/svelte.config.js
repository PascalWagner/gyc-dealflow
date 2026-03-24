import adapter from '@sveltejs/adapter-vercel';

/** @type {import('@sveltejs/kit').Config} */
const config = {
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
