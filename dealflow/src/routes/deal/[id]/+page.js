export async function load({ params, fetch }) {
	const { id } = params;

	try {
		const res = await fetch(`/api/deals?id=${encodeURIComponent(id)}`);
		if (!res.ok) {
			return { deal: null, error: 'Failed to load deal' };
		}
		const data = await res.json();
		const deal = data.deal || null;
		return { deal };
	} catch (err) {
		return { deal: null, error: err.message };
	}
}
