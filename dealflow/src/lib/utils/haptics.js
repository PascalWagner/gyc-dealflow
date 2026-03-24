import { browser } from '$app/environment';

let Haptics = null;
let initialized = false;

function isNativeContext() {
	return browser && !!window.Capacitor?.isNativePlatform?.();
}

async function init() {
	if (initialized || !browser || !isNativeContext()) return;
	initialized = true;

	try {
		const mod = await import('@capacitor/haptics');
		Haptics = mod.Haptics;
	} catch {}
}

function run(action) {
	if (!browser || !isNativeContext()) return;

	if (Haptics) {
		action(Haptics);
		return;
	}

	void init().then(() => {
		if (Haptics && isNativeContext()) action(Haptics);
	});
}

if (browser) {
	void init();
}

export function tapLight() {
	run((plugin) => plugin.impact({ style: 'light' }).catch(() => {}));
}

export function tapMedium() {
	run((plugin) => plugin.impact({ style: 'medium' }).catch(() => {}));
}

export function tapHeavy() {
	run((plugin) => plugin.impact({ style: 'heavy' }).catch(() => {}));
}

export function notifySuccess() {
	run((plugin) => plugin.notification({ type: 'success' }).catch(() => {}));
}

export function notifyWarning() {
	run((plugin) => plugin.notification({ type: 'warning' }).catch(() => {}));
}

export function notifyError() {
	run((plugin) => plugin.notification({ type: 'error' }).catch(() => {}));
}

export function selectionChanged() {
	run((plugin) => plugin.selectionChanged().catch(() => {}));
}
