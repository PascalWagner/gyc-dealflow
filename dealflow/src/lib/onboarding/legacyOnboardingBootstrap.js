export function resolveLegacyLpOnboardingIntent({
	reviewMode = false,
	onboardingRole = null,
	hasCompletedBuyBox = false
} = {}) {
	if (reviewMode || onboardingRole !== 'lp') return 'none';
	return hasCompletedBuyBox ? 'redirect' : 'resume';
}
