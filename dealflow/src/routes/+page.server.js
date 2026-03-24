import { redirect } from '@sveltejs/kit';

// Root route: always redirect to landing.
// Logged-in users who hit / will see landing; the login flow sends them to /app/deals directly.
export function load() {
	redirect(302, '/landing');
}
