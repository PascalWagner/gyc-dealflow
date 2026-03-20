// Vercel Serverless Function: GHL Event Pipeline
// Accepts user behavior events from the frontend, updates GHL contact fields and tags
// Reuses patterns from buybox.js (findContact, updateContact)

const GHL_API_KEY = process.env.GHL_API_KEY;

// GHL custom field key mapping for funnel tracking
const EVENT_FIELDS = {
  funnel_status: 'contact.funnel_status',
  last_activity_date: 'contact.last_activity_date',
  deals_viewed_count: 'contact.deals_viewed_count',
  deals_saved_count: 'contact.deals_saved_count',
  income_goal: 'contact.income_goal',
  income_gap: 'contact.income_gap',
  sessions_count: 'contact.sessions_count',
  buy_box_complete: 'contact.buy_box_complete'
};

// Event → tag mapping (tag is added when event fires)
const EVENT_TAGS = {
  wizard_complete: 'wizard-complete',
  goals_complete: 'goals-set',
  academy_cta_clicked: 'academy-interest',
  call_booked: 'call-booked',
  fund_cta_clicked: 'fund-interest'
};

// Events that add tags at thresholds (not on first fire)
const THRESHOLD_TAGS = {
  deal_saved: { tag: 'high-intent', field: 'deals_saved_count', threshold: 3 },
  session_start: { tag: 'engaged-explorer', field: 'sessions_count', threshold: 3 }
};

// Event → funnel_status updates (only upgrades, never downgrades)
const FUNNEL_ORDER = ['new', 'onboarding', 'qualified', 'high-intent', 'call-booked', 'enrolled'];
const EVENT_FUNNEL = {
  wizard_complete: 'qualified',
  deal_saved: 'high-intent', // only at threshold
  call_booked: 'call-booked'
};

async function findContact(email) {
  const resp = await fetch(`https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`, {
    headers: { 'Authorization': `Bearer ${GHL_API_KEY}` }
  });
  if (!resp.ok) throw new Error('GHL lookup failed: ' + resp.status);
  const data = await resp.json();
  return (data.contacts || [])[0] || null;
}

async function getContactFull(contactId) {
  const resp = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
    headers: { 'Authorization': `Bearer ${GHL_API_KEY}` }
  });
  if (!resp.ok) throw new Error('GHL contact fetch failed: ' + resp.status);
  return resp.json();
}

function shouldUpgradeFunnel(currentStatus, newStatus) {
  const currentIdx = FUNNEL_ORDER.indexOf(currentStatus || 'new');
  const newIdx = FUNNEL_ORDER.indexOf(newStatus);
  return newIdx > currentIdx;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!GHL_API_KEY) {
    return res.status(500).json({ error: 'GHL_API_KEY not configured' });
  }

  const { email, event, data } = req.body || {};
  if (!email || !event) {
    return res.status(400).json({ error: 'email and event required' });
  }

  try {
    const contact = await findContact(email);
    if (!contact) {
      return res.status(404).json({ error: 'Contact not found' });
    }

    // Get full contact to read current field values and tags
    const full = await getContactFull(contact.id);
    const contactData = full.contact || full;
    const currentTags = contactData.tags || [];

    // Build custom field updates
    const fieldUpdates = {};
    const tagsToAdd = [];

    // Always update last_activity_date
    fieldUpdates[EVENT_FIELDS.last_activity_date] = new Date().toISOString();

    // Handle counter-based events (use client-side counts from data payload)
    if (event === 'deal_viewed' && data && data.viewCount !== undefined) {
      fieldUpdates[EVENT_FIELDS.deals_viewed_count] = String(data.viewCount);
    }

    if (event === 'deal_saved' && data && data.saveCount !== undefined) {
      fieldUpdates[EVENT_FIELDS.deals_saved_count] = String(data.saveCount);
      // Check threshold for tag
      const threshold = THRESHOLD_TAGS.deal_saved;
      if (data.saveCount >= threshold.threshold && !currentTags.includes(threshold.tag)) {
        tagsToAdd.push(threshold.tag);
      }
    }

    if (event === 'session_start' && data && data.sessionCount !== undefined) {
      fieldUpdates[EVENT_FIELDS.sessions_count] = String(data.sessionCount);
      // Check threshold for tag
      const threshold = THRESHOLD_TAGS.session_start;
      if (data.sessionCount >= threshold.threshold && !currentTags.includes(threshold.tag)) {
        tagsToAdd.push(threshold.tag);
      }
    }

    // Handle wizard completion
    if (event === 'wizard_complete') {
      fieldUpdates[EVENT_FIELDS.buy_box_complete] = 'true';
    }

    // Handle goals completion
    if (event === 'goals_complete' && data) {
      if (data.incomeGoal !== undefined) fieldUpdates[EVENT_FIELDS.income_goal] = String(data.incomeGoal);
      if (data.incomeGap !== undefined) fieldUpdates[EVENT_FIELDS.income_gap] = String(data.incomeGap);
    }

    // Add direct-mapped tags
    if (EVENT_TAGS[event] && !currentTags.includes(EVENT_TAGS[event])) {
      tagsToAdd.push(EVENT_TAGS[event]);
    }

    // Handle funnel status upgrades
    const newFunnelStatus = EVENT_FUNNEL[event];
    if (newFunnelStatus) {
      // For threshold-gated funnel updates, only upgrade if threshold met
      if (event === 'deal_saved') {
        const threshold = THRESHOLD_TAGS.deal_saved;
        if (data && data.saveCount >= threshold.threshold) {
          // Read current funnel status from custom fields
          const currentFunnel = extractFieldValue(contactData.customField, EVENT_FIELDS.funnel_status) || 'new';
          if (shouldUpgradeFunnel(currentFunnel, newFunnelStatus)) {
            fieldUpdates[EVENT_FIELDS.funnel_status] = newFunnelStatus;
          }
        }
      } else {
        const currentFunnel = extractFieldValue(contactData.customField, EVENT_FIELDS.funnel_status) || 'new';
        if (shouldUpgradeFunnel(currentFunnel, newFunnelStatus)) {
          fieldUpdates[EVENT_FIELDS.funnel_status] = newFunnelStatus;
        }
      }
    }

    // Build the GHL update payload
    const updatePayload = {};

    // Custom fields
    if (Object.keys(fieldUpdates).length > 0) {
      updatePayload.customField = fieldUpdates;
    }

    // Tags — merge with existing, don't replace
    if (tagsToAdd.length > 0) {
      updatePayload.tags = [...currentTags, ...tagsToAdd];
    }

    // Only call GHL if we have something to update
    if (Object.keys(updatePayload).length > 0) {
      const updateResp = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${GHL_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updatePayload)
      });

      if (!updateResp.ok) {
        const errText = await updateResp.text();
        throw new Error('GHL update failed: ' + updateResp.status + ' ' + errText);
      }
    }

    return res.status(200).json({
      success: true,
      event,
      fieldsUpdated: Object.keys(fieldUpdates).length,
      tagsAdded: tagsToAdd
    });

  } catch (e) {
    console.error('Event pipeline error:', e);
    return res.status(500).json({ error: e.message });
  }
}

// Helper: extract a custom field value from GHL contact's customField array
function extractFieldValue(customFields, fieldKey) {
  if (!Array.isArray(customFields)) return null;
  for (const f of customFields) {
    if (f.key === fieldKey || f.id === fieldKey) {
      return f.value || null;
    }
  }
  return null;
}
