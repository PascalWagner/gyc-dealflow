/**
 * Time-freezing helper for deterministic date-dependent tests.
 */

export function withFixedNow(isoDate, callback) {
	const originalNow = Date.now;
	Date.now = () => new Date(isoDate).getTime();
	try {
		callback();
	} finally {
		Date.now = originalNow;
	}
}
