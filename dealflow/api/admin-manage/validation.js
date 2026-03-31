import {
  RequestValidationError,
  expectBooleanish,
  expectEnum,
  expectNonEmptyString,
  expectOptionalString,
  expectOptionalNumber,
  expectPlainObject
} from '../_validation.js';

const PAGINATED_ACTIONS = new Set([
  'list-deals',
  'list-operators',
  'list-users',
  'browse-table'
]);

const SEARCHABLE_ACTIONS = new Set([
  'list-deals',
  'list-deals-workflow',
  'list-operators',
  'list-users',
  'list-deals-quality',
  'list-operators-quality',
  'list-intros'
]);

export function validateAdminActionInput(action, params) {
  if (PAGINATED_ACTIONS.has(action)) {
    expectOptionalNumber(params.page, 'page', { integer: true, min: 1, fallback: 1 });
    expectOptionalNumber(params.limit, 'limit', { integer: true, min: 1, max: 500, fallback: 50 });
  }

  if (SEARCHABLE_ACTIONS.has(action) && params.search !== undefined) {
    expectOptionalString(params.search, 'search', '');
  }

  switch (action) {
    case 'create-deal': {
      if (params.deal !== undefined) {
        expectPlainObject(params.deal, 'deal', { allowEmpty: false });
      } else {
        const fieldKeys = Object.keys(params || {}).filter((key) => !['page', 'limit', 'search'].includes(key));
        if (fieldKeys.length === 0) {
          throw new RequestValidationError('deal data is required', { field: 'deal' });
        }
      }
      return;
    }
    case 'update-deal':
    case 'update-operator':
    case 'update-user-tier':
      expectNonEmptyString(params.id, 'id');
      expectPlainObject(params.updates, 'updates', { allowEmpty: false });
      return;
    case 'delete-deal':
      expectNonEmptyString(params.id, 'id');
      return;
    case 'toggle-archive':
      expectNonEmptyString(params.id, 'id');
      if (params.archived !== undefined) {
        expectBooleanish(params.archived, 'archived');
      }
      return;
    case 'update-deal-workflow':
      expectNonEmptyString(params.id, 'id');
      if (params.lifecycleStatus === undefined && params.lifecycle_status === undefined
        && params.isVisibleToUsers === undefined && params.is_visible_to_users === undefined) {
        throw new RequestValidationError('lifecycleStatus or isVisibleToUsers is required', { field: 'updates' });
      }
      if (params.lifecycleStatus !== undefined || params.lifecycle_status !== undefined) {
        expectEnum(
          params.lifecycleStatus !== undefined ? params.lifecycleStatus : params.lifecycle_status,
          'lifecycleStatus',
          ['draft', 'in_review', 'published', 'do_not_publish', 'archived']
        );
      }
      if (params.isVisibleToUsers !== undefined || params.is_visible_to_users !== undefined) {
        expectBooleanish(
          params.isVisibleToUsers !== undefined ? params.isVisibleToUsers : params.is_visible_to_users,
          'isVisibleToUsers'
        );
      }
      return;
    case 'create-operator': {
      if (params.operator !== undefined) {
        expectPlainObject(params.operator, 'operator', { allowEmpty: false });
      } else {
        const fieldKeys = Object.keys(params || {}).filter((key) => !['page', 'limit', 'search'].includes(key));
        if (fieldKeys.length === 0) {
          throw new RequestValidationError('operator data is required', { field: 'operator' });
        }
      }
      return;
    }
    case 'user-events':
      expectNonEmptyString(params.email, 'email');
      expectOptionalNumber(params.limit, 'limit', { integer: true, min: 1, max: 500, fallback: 30 });
      return;
    case 'intake-create':
      expectPlainObject(params.deal_data, 'deal_data', { allowEmpty: false });
      if (params.operator_id !== undefined && params.operator_id !== null && params.operator_id !== '') {
        expectNonEmptyString(params.operator_id, 'operator_id');
      }
      if (params.create_operator !== undefined) {
        expectBooleanish(params.create_operator, 'create_operator');
      }
      if (params.create_operator) {
        expectPlainObject(params.operator_data, 'operator_data', { allowEmpty: false });
      }
      return;
    case 'growth-metrics':
    case 'table-counts':
      return;
    case 'list-deals-workflow':
    case 'list-deals-quality':
    case 'list-operators-quality':
    case 'list-intros':
      return;
    case 'browse-table':
      expectNonEmptyString(params.table, 'table');
      return;
    case 'cta-analytics':
      if (params.range !== undefined && params.range !== null && params.range !== '') {
        expectEnum(params.range, 'range', ['7d', '30d', 'all']);
      }
      return;
    default:
      return;
  }
}
