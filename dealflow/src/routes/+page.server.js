import { redirect } from '@sveltejs/kit';

// During migration, redirect root to the static main app.
// index.html handles its own auth gating (shows landing vs dashboard).
export function load() {
	redirect(302, '/landing');
}
