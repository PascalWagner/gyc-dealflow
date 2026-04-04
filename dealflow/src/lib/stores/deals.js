/**
 * deals.js — Re-export barrel (backward-compatible public API).
 *
 * All 16+ existing import sites continue to work unchanged:
 *   import { dealStages, fetchMemberDeals, compareDealIds, ... } from '$lib/stores/deals.js'
 *
 * The implementation has been split into focused modules:
 *   dealCatalog.js   — deals / dealsLoading / dealsError / fetchDeals
 *   memberDeals.js   — memberDeals* stores / fetchMemberDeals / queryMemberDeals / loadMoreMemberDeals
 *   dealStages.js    — dealStages / stageCounts / hydrate* / browseTotalCount / adjustBrowseCount
 *   dealUiPrefs.js   — compareDealIds / decisionCompareIds / dealFlowViewMode
 *   dealConstants.js — PIPELINE_STAGES / OUTCOME_STAGES / ALL_STAGES / MAX_COMPARE_DEALS / …
 */

export { deals, dealsLoading, dealsError, fetchDeals } from './dealCatalog.js';

export {
	memberDeals, memberDealsLoading, memberDealsLoadingMore,
	memberDealsRefreshing, memberDealsError, memberDealsMeta,
	resetMemberDeals, fetchMemberDeals, queryMemberDeals, loadMoreMemberDeals
} from './memberDeals.js';

export {
	dealStages, stageCounts,
	hydrateDealStagesFromRows, hydrateDealStagesFromMap, hydrateDealStagesFromCache,
	browseTotalCount, adjustBrowseCount,
	STAGE_META, normalizeStage, stageLabel
} from './dealStages.js';

export { compareDealIds, decisionCompareIds, dealFlowViewMode } from './dealUiPrefs.js';

export {
	PIPELINE_STAGES, OUTCOME_STAGES, ALL_STAGES,
	MEMBER_DEALS_PAGE_SIZE, MAX_COMPARE_DEALS, MAX_DECISION_COMPARE, DEAL_FLOW_VIEW_MODES
} from './dealConstants.js';
