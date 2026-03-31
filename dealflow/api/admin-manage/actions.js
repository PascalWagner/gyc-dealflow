import { analyticsActions } from './analytics.js';
import { catalogActions } from './catalog.js';
import { dealsWorkflowActions } from './deals-workflow.js';
import { qualityActions } from './quality.js';
import { schemaActions } from './schema.js';
import { userActions } from './users.js';

export const ACTION_MAP = {
  ...catalogActions,
  ...dealsWorkflowActions,
  ...qualityActions,
  ...userActions,
  ...analyticsActions,
  ...schemaActions
};

export function listAdminActions() {
  return Object.keys(ACTION_MAP);
}
