// Vercel Serverless Function: /api/admin-manage
// Admin CRUD operations, analytics, and schema utilities for the back office.

import { getAdminClient, setCors, verifyAdmin } from './_supabase.js';
import { RequestValidationError, sendValidationError } from './_validation.js';
import { ACTION_MAP, listAdminActions } from './admin-manage/actions.js';
import { validateAdminActionInput } from './admin-manage/validation.js';

export default async function handler(req, res) {
  setCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  const auth = await verifyAdmin(req);
  if (!auth.authorized) {
    return res.status(403).json({ success: false, error: auth.error });
  }

  try {
    const { action, ...params } = req.body || {};

    if (!action) {
      return res.status(400).json({ success: false, error: 'Missing action parameter' });
    }

    const actionFn = ACTION_MAP[action];
    if (!actionFn) {
      return res.status(400).json({
        success: false,
        error: `Unknown action: ${action}. Valid actions: ${listAdminActions().join(', ')}`
      });
    }

    validateAdminActionInput(action, params);

    const supabase = getAdminClient();
    const result = await actionFn(supabase, params);

    return res.status(200).json({ success: true, ...result });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return sendValidationError(res, error);
    }
    console.error('Admin manage error:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}
