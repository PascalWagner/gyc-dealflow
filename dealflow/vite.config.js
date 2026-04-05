import { sveltekit } from '@sveltejs/kit/vite';
import { sentrySvelteKit } from '@sentry/sveltekit';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [
		sentrySvelteKit({
			sourceMapsUploadOptions: {
				org: 'pascal-wagner-holdings',
				project: 'javascript-sveltekit',
				authToken: process.env.SENTRY_AUTH_TOKEN
			},
			autoUploadSourceMaps: !!process.env.SENTRY_AUTH_TOKEN
		}),
		sveltekit()
	],
	server: {
		// Proxy API calls to existing Vercel serverless functions during dev
		proxy: {
			'/api': {
				target: process.env.VITE_API_PROXY_TARGET || 'https://sandbox.growyourcashflow.io',
				changeOrigin: true
			}
		}
	}
});
