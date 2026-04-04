/**
 * Deal-related constants and contract re-exports.
 * Import from here (or directly from deals.js barrel) rather than
 * reaching into dealflow-contract.js from routes/components.
 */
import {
	OUTCOME_UI_STAGES,
	PIPELINE_UI_STAGES,
	STAGE_META,
	getUiStage,
	normalizeStage,
	stageLabel
} from '$lib/utils/dealflow-contract.js';

export { STAGE_META, getUiStage, normalizeStage, stageLabel };
export const PIPELINE_STAGES = PIPELINE_UI_STAGES;
export const OUTCOME_STAGES = OUTCOME_UI_STAGES;
export const ALL_STAGES = [...PIPELINE_UI_STAGES, ...OUTCOME_UI_STAGES];
export const MEMBER_DEALS_PAGE_SIZE = 24;
export const MAX_COMPARE_DEALS = 3;
export const MAX_DECISION_COMPARE = MAX_COMPARE_DEALS;
export const DEAL_FLOW_VIEW_MODES = ['grid', 'compare', 'map'];
