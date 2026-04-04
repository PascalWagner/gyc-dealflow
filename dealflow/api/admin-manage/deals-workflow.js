import { RequestValidationError } from '../_validation.js';
import {
	buildDealWorkflowRecord,
	buildNewDealDefaults,
	compareDealWorkflowRecords,
	resolveDealWorkflowMutation
} from '../../src/lib/utils/dealWorkflow.js';

// Only return the fields the manage page actually uses.
// Full rows from buildDealWorkflowRecord can exceed 10MB for large deal sets,
// which causes localStorage.setItem to throw QuotaExceededError and break caching.
const WORKFLOW_LIST_KEYS = [
	'id',
	'dealName',
	'sponsorName',
	'slug',
	'lifecycleStatus',
	'isVisibleToUsers',
	'catalogState',
	'catalogStateLabel',
	'submissionIntent',
	'submissionIntentLabel',
	'submissionSurface',
	'submissionSurfaceLabel',
	'submittedByRole',
	'submittedByRoleLabel',
	'submittedByName',
	'submittedByEmail',
	'updatedAt',
	'completenessScore',
	'hasBlockingIssues',
	'readinessLabel',
	'readyToPublish',
	'visibilityDisabledReason'
];

function pickWorkflowListFields(row) {
	const out = {};
	for (const key of WORKFLOW_LIST_KEYS) out[key] = row[key];
	return out;
}

async function listDealsWorkflow(supabase, body) {
	const search = String(body?.search || '').trim();

	const query = supabase
		.from('opportunities')
		.select('*, management_company:management_companies(id, operator_name)')
		.is('parent_deal_id', null);

	const { data, error } = await query;
	if (error) throw error;

	let rows = (data || []).map((deal) =>
		buildDealWorkflowRecord({
			...deal,
			management_company_name: deal.management_company?.operator_name || deal.sponsor_name || '—'
		})
	);

	if (search) {
		const needle = search.toLowerCase();
		rows = rows.filter((row) =>
			[
				row.dealName,
				row.sponsorName,
				row.slug,
				row.status,
				row.lifecycleStatus,
				row.submittedByName,
				row.submittedByEmail,
				row.submittedByRoleLabel,
				row.submissionSurfaceLabel,
				row.submissionIntentLabel
			]
				.some((value) => String(value || '').toLowerCase().includes(needle))
		);
	}

	rows.sort(compareDealWorkflowRecords);

	const projectedRows = rows.map(pickWorkflowListFields);

	return {
		data: projectedRows,
		total: rows.length,
		stats: {
			totalDeals: rows.length,
			draft: rows.filter((row) => row.lifecycleStatus === 'draft').length,
			inReview: rows.filter((row) => row.lifecycleStatus === 'in_review').length,
			approved: rows.filter((row) => row.lifecycleStatus === 'approved').length,
			published: rows.filter((row) => row.lifecycleStatus === 'published' && row.catalogState !== 'archived').length,
			doNotPublish: rows.filter((row) => row.lifecycleStatus === 'do_not_publish').length,
			archived: rows.filter((row) => row.catalogState === 'archived').length,
			missingRequiredFields: rows.filter((row) => row.hasBlockingIssues).length,
			readyToPublish: rows.filter((row) => row.readyToPublish).length
			}
		};
	}

async function updateDealWorkflow(supabase, body) {
	const id = String(body?.id || '').trim();
	if (!id) throw new RequestValidationError('id is required', { field: 'id' });

	const requestedLifecycleStatus =
		body?.lifecycle_status !== undefined ? body.lifecycle_status : body?.lifecycleStatus;
	const requestedVisibility =
		body?.is_visible_to_users !== undefined ? body.is_visible_to_users : body?.isVisibleToUsers;

	if (requestedLifecycleStatus === undefined && requestedVisibility === undefined) {
		throw new RequestValidationError('Provide lifecycleStatus or isVisibleToUsers', { field: 'updates' });
	}

	const { data: currentDeal, error: loadError } = await supabase
		.from('opportunities')
		.select('*, management_company:management_companies(id, operator_name)')
		.eq('id', id)
		.single();

	if (loadError || !currentDeal) throw loadError || new Error('Deal not found');

	const resolution = resolveDealWorkflowMutation(currentDeal, {
		lifecycle_status: requestedLifecycleStatus,
		is_visible_to_users: requestedVisibility
	});

	if (resolution.error) {
		throw new RequestValidationError(resolution.error, { field: 'isVisibleToUsers' });
	}

	const { data: updatedDeal, error: updateError } = await supabase
		.from('opportunities')
		.update({
			lifecycle_status: resolution.lifecycleStatus,
			is_visible_to_users: resolution.isVisibleToUsers
		})
		.eq('id', id)
		.select('*, management_company:management_companies(id, operator_name)')
		.single();

	if (updateError) throw updateError;

	return {
		data: buildDealWorkflowRecord({
			...updatedDeal,
			management_company_name: updatedDeal.management_company?.operator_name || updatedDeal.sponsor_name || '—'
		})
	};
}

export function applyDealCreateDefaults(payload = {}) {
	const defaults = buildNewDealDefaults(payload);
	return {
		...defaults,
		...payload,
		slug: payload.slug || defaults.slug,
		sponsor_name: payload.sponsor_name || payload.sponsor || payload.sponsorName || defaults.sponsor_name
	};
}

export const dealsWorkflowActions = {
	'list-deals-workflow': listDealsWorkflow,
	'update-deal-workflow': updateDealWorkflow
};
