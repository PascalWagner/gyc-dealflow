import { browser } from '$app/environment';
import { getStoredSessionUser } from '$lib/stores/auth.js';

export async function trackUserEvent(event, data = {}) {
	if (!browser || !event) return { ok: false, skipped: true };

	const session = getStoredSessionUser();
	const email = session?.email;
	if (!email) return { ok: false, skipped: true };

	try {
		const response = await fetch('/api/events', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...(session?.token ? { Authorization: `Bearer ${session.token}` } : {})
			},
			body: JSON.stringify({ email, event, data })
		});

		return { ok: response.ok, skipped: false };
	} catch {
		return { ok: false, skipped: false };
	}
}

export function trackUserEventFireAndForget(event, data = {}) {
	if (!browser || !event) return;
	void trackUserEvent(event, data);
}
