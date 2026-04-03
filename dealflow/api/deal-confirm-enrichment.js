// Vercel Serverless Function: Confirm extracted PPM data
// Called after user reviews Claude-extracted fields in the confirmation wizard.
// Only updates fields that are currently empty in the database.

import { getAdminClient, setCors } from './_supabase.js';
import { DEAL_FIELD_MAP, NUMERIC_DEAL_COLS, sanitizeNumericValue } from './_field-map.js';

// Use shared field map — no longer silently drops confirmed fields
const SUPABASE_FIELD_MAP = DEAL_FIELD_MAP;

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { dealId, confirmedData, userEmail } = req.body;

    if (!dealId || !confirmedData) {
      return res.status(400).json({ error: 'dealId and confirmedData are required' });
    }

    const supabase = getAdminClient();

    // Fetch current record to avoid overwriting human edits
    const { data: currentDeal } = await supabase
      .from('opportunities')
      .select('*')
      .eq('id', dealId)
      .single();

    if (!currentDeal) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const safeUpdate = {};
    const updated = [];

    for (const [jsonKey, val] of Object.entries(confirmedData)) {
      if (val === null || val === undefined || val === '') continue;

      const dbCol = SUPABASE_FIELD_MAP[jsonKey];
      if (!dbCol) continue;

      const current = currentDeal[dbCol];
      const isEmpty = current === null
        || current === undefined
        || current === ''
        || current === 0
        || (Array.isArray(current) && current.length === 0);

      if (isEmpty) {
        // Special handling for fees — Supabase expects text[]
        if (dbCol === 'fees' && typeof val === 'string') {
          safeUpdate[dbCol] = [val];
        } else {
          safeUpdate[dbCol] = val;
        }
        updated.push(dbCol);
      }
    }

    if (Object.keys(safeUpdate).length > 0) {
      safeUpdate.updated_at = new Date().toISOString();
      safeUpdate.enriched_by = userEmail || 'unknown';

      const { error: updateErr } = await supabase
        .from('opportunities')
        .update(safeUpdate)
        .eq('id', dealId);

      if (updateErr) {
        return res.status(500).json({ error: 'Failed to update deal: ' + updateErr.message });
      }
    }

    return res.status(200).json({
      success: true,
      updatedFields: updated,
      updatedCount: updated.length
    });

  } catch (error) {
    console.error('Enrichment confirmation error:', error);
    return res.status(500).json({ error: 'Failed to confirm enrichment' });
  }
}
