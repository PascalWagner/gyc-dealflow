import { redirect } from '@sveltejs/kit';

// During migration, redirect root to the static landing page
export function load() {
	redirect(302, '/landing.html');
}
