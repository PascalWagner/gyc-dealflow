import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	server: {
		// Proxy API calls to existing Vercel serverless functions during dev
		proxy: {
			'/api': {
				target: process.env.VITE_API_PROXY_TARGET || 'https://dealflow.growyourcashflow.io',
				changeOrigin: true
			}
		}
	}
});
