import { ASSET_MAP } from '../../_supabase.js';

export const DEAL_SELECT = `*,
management_company:management_companies (
	id, operator_name, ceo, website, linkedin_ceo, invest_clearly_profile,
	founding_year, type, asset_classes, total_investors, authorized_emails, booking_url,
	ir_contact_name, ir_contact_email, full_cycle_deals
)`;

export const CHILD_SHARE_CLASS_SELECT = `
	id,
	parent_deal_id,
	share_class_label,
	investment_name,
	target_irr,
	preferred_return,
	investment_minimum,
	hold_period_years,
	lp_gp_split,
	financials,
	cash_on_cash
`;

export const SPONSOR_SELECT = `deal_id, role, is_primary, display_order,
company:management_companies (
	id, operator_name, ceo, website, linkedin_ceo,
	invest_clearly_profile, founding_year, type, asset_classes,
	total_investors, booking_url, full_cycle_deals
)`;

function normalizeKey(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '');
}

export const ASSET_ALIASES = new Map();

for (const [source, target] of Object.entries(ASSET_MAP || {})) {
	ASSET_ALIASES.set(normalizeKey(source), target);
	ASSET_ALIASES.set(normalizeKey(target), target);
}
