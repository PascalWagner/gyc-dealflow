export function load({ setHeaders }) {
	setHeaders({
		'cache-control': 'no-store, max-age=0'
	});

	return {};
}
