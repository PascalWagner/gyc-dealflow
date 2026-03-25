export const SESSION_VERSION = 3;
export const ACCESS_TIERS = ['public', 'free', 'member', 'admin'];
export const ACCESS_TIER_LABELS = {
	public: 'Public',
	free: 'Free',
	member: 'Member',
	admin: 'Admin'
};

const ACCESS_TIER_RANK = {
	public: 0,
	free: 1,
	member: 2,
	admin: 3
};

const LEGACY_MEMBER_ACCESS_TIERS = new Set([
	'academy',
	'alumni',
	'investor',
	'paid',
	'founding',
	'inner-circle',
	'family_office',
	'family-office',
	'member'
]);

function normalizeTierValue(tier) {
	return String(tier || '').trim().toLowerCase().replace(/\s+/g, '-');
}

function toBooleanMap(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
	return Object.fromEntries(
		Object.entries(value).map(([key, flag]) => [String(key || '').trim().toLowerCase(), flag === true])
	);
}

function toStringSet(value) {
	if (!Array.isArray(value)) return new Set();
	return new Set(value.map((entry) => String(entry || '').trim().toLowerCase()).filter(Boolean));
}

function normalizeDateValue(value) {
	if (value instanceof Date) {
		return Number.isNaN(value.getTime()) ? null : value.toISOString();
	}

	if (typeof value === 'number' && Number.isFinite(value)) {
		const candidate = new Date(value);
		return Number.isNaN(candidate.getTime()) ? null : candidate.toISOString();
	}

	const normalized = String(value || '').trim();
	if (!normalized) return null;
	return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

function normalizeMembershipWindow(value = {}) {
	const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
	const academyStart = normalizeDateValue(candidate.academyStart || candidate.academy_start);
	const academyEnd = normalizeDateValue(candidate.academyEnd || candidate.academy_end);
	const autoRenew =
		candidate.autoRenew === true ||
		candidate.autoRenew === false
			? candidate.autoRenew
			: candidate.auto_renew === true || candidate.auto_renew === false
				? candidate.auto_renew
				: null;

	return {
		academyStart,
		academyEnd,
		autoRenew
	};
}

function hasPastDate(value) {
	const normalized = normalizeDateValue(value);
	if (!normalized) return false;
	const timestamp = Date.parse(normalized);
	return Number.isFinite(timestamp) && timestamp < Date.now();
}

export function normalizeEmail(email) {
	return String(email || '').trim().toLowerCase();
}

export function normalizeLegacyTier(tier, { isAdmin = false } = {}) {
	if (isAdmin) return 'admin';

	const normalizedTier = normalizeTierValue(tier);
	if (!normalizedTier || normalizedTier === 'explorer') return 'free';
	if (normalizedTier === 'administrator') return 'admin';
	if (normalizedTier === 'family-office') return 'family_office';
	return normalizedTier;
}

export function resolveAccessTier(value, { email = '', tier, isAdmin = false } = {}) {
	if (isAdmin) return 'admin';

	const normalizedValue = normalizeTierValue(value);
	if (ACCESS_TIERS.includes(normalizedValue)) return normalizedValue;
	if (normalizedValue) {
		const legacyValue = normalizeLegacyTier(value, { isAdmin: false });
		if (ACCESS_TIERS.includes(legacyValue)) return legacyValue;
	}

	const legacyTier = normalizeLegacyTier(tier, { isAdmin: false });
	if (!email) return 'public';
	if (legacyTier === 'admin') return 'admin';
	if (legacyTier === 'free') return 'free';
	if (legacyTier === 'public') return 'public';
	if (LEGACY_MEMBER_ACCESS_TIERS.has(legacyTier)) return 'member';
	return 'free';
}

function resolveMembershipStatus({
	storedAccessTier = 'public',
	effectiveAccessTier = 'public',
	academyEnd = null
} = {}) {
	if (effectiveAccessTier === 'admin') return 'active';
	if (storedAccessTier === 'member' || storedAccessTier === 'admin') {
		if (storedAccessTier === 'member' && effectiveAccessTier !== 'member') return 'expired';
		return 'active';
	}
	if (academyEnd && hasPastDate(academyEnd) && effectiveAccessTier === 'free') {
		return 'expired';
	}
	return 'none';
}

export function normalizeManagementCompany(value, fallback = {}) {
	const candidate = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
	const id =
		candidate.id ||
		candidate.managementCompanyId ||
		candidate.management_company_id ||
		fallback.managementCompanyId ||
		fallback.management_company_id ||
		null;
	const name =
		candidate.name ||
		candidate.operatorName ||
		candidate.operator_name ||
		candidate.managementCompanyName ||
		candidate.management_company_name ||
		fallback.managementCompanyName ||
		fallback.management_company_name ||
		'';
	const gpType =
		candidate.gpType ||
		candidate.gp_type ||
		fallback.gpType ||
		fallback.gp_type ||
		null;

	if (!id && !name && !gpType) return null;

	return {
		id: id || null,
		name: name || '',
		gpType: gpType || null
	};
}

export function resolveRoleFlags(value, {
	email = '',
	isAdmin = false,
	gpType = null,
	managementCompany = null
} = {}) {
	const normalizedEmail = normalizeEmail(email);
	const roleMap = toBooleanMap(value);
	const roleSet = toStringSet(value);

	const admin = isAdmin || roleMap.admin === true || roleSet.has('admin');
	const gp =
		roleMap.gp === true ||
		roleSet.has('gp') ||
		!!gpType ||
		!!managementCompany?.id;
	const lp = normalizedEmail ? roleMap.lp !== false : false;

	return {
		lp,
		gp,
		admin
	};
}

export function resolveCapabilities(value, {
	accessTier = 'public',
	roleFlags = { lp: false, gp: false, admin: false }
} = {}) {
	const memberAccess = accessTier === 'member' || accessTier === 'admin';
	const defaultCapabilities = {
		memberContent: memberAccess,
		backgroundChecks: memberAccess,
		gpDashboard: roleFlags.gp || roleFlags.admin,
		gpCompanySettings: roleFlags.gp || roleFlags.admin,
		adminTools: roleFlags.admin,
		impersonateUsers: roleFlags.admin
	};

	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return defaultCapabilities;
	}

	const explicit = toBooleanMap(value);
	const readFlag = (keys, fallback) => {
		for (const key of keys) {
			if (Object.prototype.hasOwnProperty.call(explicit, key)) return explicit[key];
		}
		return fallback;
	};

	return {
		memberContent: readFlag(['membercontent', 'member'], defaultCapabilities.memberContent),
		backgroundChecks: readFlag(['backgroundchecks'], defaultCapabilities.backgroundChecks),
		gpDashboard: readFlag(['gpdashboard', 'gp'], defaultCapabilities.gpDashboard),
		gpCompanySettings: readFlag(['gpcompanysettings'], defaultCapabilities.gpCompanySettings),
		adminTools: readFlag(['admintools', 'admin'], defaultCapabilities.adminTools),
		impersonateUsers: readFlag(['impersonateusers'], defaultCapabilities.impersonateUsers)
	};
}

export function buildAccessModel(value = {}) {
	const input = value && typeof value === 'object' ? value : {};
	const email = normalizeEmail(input.email);
	const managementCompany = normalizeManagementCompany(input.managementCompany, input);
	const membershipWindow = normalizeMembershipWindow(input);
	const roleFlags = resolveRoleFlags(input.roleFlags || input.roles, {
		email,
		isAdmin: input.isAdmin === true || input.is_admin === true,
		gpType: managementCompany?.gpType || input.gpType || input.gp_type || null,
		managementCompany
	});
	const legacyTier = normalizeLegacyTier(input.legacyTier || input.tier, {
		isAdmin: roleFlags.admin
	});
	const storedAccessTier = resolveAccessTier(input.accessTier, {
		email,
		tier: legacyTier,
		isAdmin: roleFlags.admin
	});
	const membershipExpired =
		storedAccessTier === 'member' && !!membershipWindow.academyEnd && hasPastDate(membershipWindow.academyEnd);
	const accessTier = membershipExpired ? 'free' : storedAccessTier;
	const capabilities = resolveCapabilities(input.capabilities, {
		accessTier,
		roleFlags
	});
	const membershipStatus = resolveMembershipStatus({
		storedAccessTier,
		effectiveAccessTier: accessTier,
		academyEnd: membershipWindow.academyEnd
	});

	return {
		isAuthenticated: !!email,
		email,
		legacyTier,
		storedAccessTier,
		accessTier,
		effectiveAccessTier: accessTier,
		membershipStatus,
		membershipExpired,
		academyStart: membershipWindow.academyStart,
		academyEnd: membershipWindow.academyEnd,
		autoRenew: membershipWindow.autoRenew,
		roleFlags,
		capabilities,
		managementCompany
	};
}

export function hasRoleFlag(sessionLike, role) {
	const normalizedRole = String(role || '').trim().toLowerCase();
	return buildAccessModel(sessionLike).roleFlags[normalizedRole] === true;
}

export function hasCapability(sessionLike, capability) {
	const normalizedCapability = String(capability || '').trim();
	return buildAccessModel(sessionLike).capabilities[normalizedCapability] === true;
}

export function hasAccessTier(sessionLike, minimumTier) {
	const accessTier = buildAccessModel(sessionLike).accessTier;
	const normalizedMinimum = String(minimumTier || 'public').trim().toLowerCase();
	return (ACCESS_TIER_RANK[accessTier] || 0) >= (ACCESS_TIER_RANK[normalizedMinimum] || 0);
}

export function formatAccessTierLabel(value) {
	const normalizedValue = String(value || 'free').trim().toLowerCase();
	return ACCESS_TIER_LABELS[normalizedValue] || ACCESS_TIER_LABELS.free;
}

export function formatSessionAccessLabel(sessionLike) {
	const access = buildAccessModel(sessionLike);
	if (access.roleFlags.admin) return 'Admin';
	if (access.roleFlags.gp && access.accessTier === 'member') return 'Member + GP';
	if (access.roleFlags.gp) return 'GP';
	return formatAccessTierLabel(access.accessTier);
}
