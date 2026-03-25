import { browser } from '$app/environment';

export function isNativeApp() {
	return browser && !!window.Capacitor?.isNativePlatform?.();
}
