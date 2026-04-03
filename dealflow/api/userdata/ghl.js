import { ghlFetch } from '../_supabase.js';
import { requireAnyServerEnv } from '../_env.js';

const GHL_GOALS_FIELD_MAP = {
  goal_type: 'contact.primary_investment_objective',
  current_income: 'contact.current_passive_income',
  target_income: 'contact.target_passive_income',
  capital_available: 'contact.capital_12_month',
  timeline: 'contact.investment_timeline',
  tax_reduction: 'contact.tax_offset_target'
};

let ghlCustomFieldMapPromise = null;

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeFieldMatcher(value) {
  return normalizeString(value).toLowerCase();
}

function normalizeFieldValue(value) {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeFieldValue(entry)).filter((entry) => entry !== '');
  }
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  return value;
}

export function hasMeaningfulGhlValue(value) {
  if (Array.isArray(value)) return value.some((entry) => hasMeaningfulGhlValue(entry));
  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;
  return normalizeString(value) !== '';
}

export function hasMeaningfulGoalsRow(goal = null) {
  if (!goal || typeof goal !== 'object') return false;
  return [
    goal.goal_type,
    goal.current_income,
    goal.target_income,
    goal.capital_available,
    goal.timeline,
    goal.tax_reduction
  ].some((value) => hasMeaningfulGhlValue(value));
}

export async function getGhlCustomFieldMap() {
  if (!ghlCustomFieldMapPromise) {
    ghlCustomFieldMapPromise = (async () => {
      const response = await ghlFetch('https://rest.gohighlevel.com/v1/custom-fields/');
      if (!response?.ok) return new Map();

      const payload = await response.json().catch(() => ({}));
      const fields = Array.isArray(payload?.customFields) ? payload.customFields : [];

      return new Map(
        fields
          .filter((entry) => normalizeString(entry?.id))
          .map((entry) => [
            entry.id,
            {
              id: normalizeString(entry.id),
              name: normalizeString(entry.name),
              fieldKey: normalizeString(entry.fieldKey),
              dataType: normalizeString(entry.dataType || entry.type)
            }
          ])
      );
    })().catch((error) => {
      ghlCustomFieldMapPromise = null;
      throw error;
    });
  }

  return ghlCustomFieldMapPromise;
}

export async function getGhlContactByEmail(email, { hydrateFields = false } = {}) {
  const normalizedEmail = normalizeString(email).toLowerCase();
  if (!normalizedEmail) return null;

  const response = await ghlFetch(
    `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(normalizedEmail)}`
  );
  if (!response?.ok) return null;

  const payload = await response.json().catch(() => ({}));
  const contact = (payload?.contacts || []).find(
    (entry) => normalizeString(entry?.email).toLowerCase() === normalizedEmail
  );
  if (!contact) return null;
  if (!hydrateFields) return contact;

  const customFieldMap = await getGhlCustomFieldMap();
  const hydratedFields = (Array.isArray(contact.customFields || contact.customField)
    ? contact.customFields || contact.customField
    : []
  )
    .map((entry) => {
      const definition = customFieldMap.get(entry?.id) || {};
      return {
        id: normalizeString(entry?.id || definition.id),
        name: normalizeString(definition.name),
        fieldKey: normalizeString(definition.fieldKey),
        dataType: normalizeString(definition.dataType),
        value: normalizeFieldValue(entry?.value)
      };
    })
    .filter((entry) => entry.id);

  return {
    ...contact,
    customFieldsHydrated: hydratedFields
  };
}

export function findHydratedGhlFieldValue(contact, matchers = []) {
  const normalizedMatchers = (Array.isArray(matchers) ? matchers : [matchers])
    .map((entry) => normalizeFieldMatcher(entry))
    .filter(Boolean);
  if (normalizedMatchers.length === 0) return '';

  const hydratedFields = Array.isArray(contact?.customFieldsHydrated)
    ? contact.customFieldsHydrated
    : [];

  const match = hydratedFields.find((entry) =>
    normalizedMatchers.includes(normalizeFieldMatcher(entry.fieldKey))
    || normalizedMatchers.includes(normalizeFieldMatcher(entry.name))
    || normalizedMatchers.includes(normalizeFieldMatcher(entry.id))
  );

  return normalizeFieldValue(match?.value);
}

function capitalToRange(num) {
  const n = Number(num);
  if (!n || Number.isNaN(n)) return null;
  if (n < 100000) return '<$100k';
  if (n < 250000) return '$100k - $249k';
  if (n < 500000) return '$249k - $499k';
  if (n < 1000000) return '$500k - $999k';
  return '$1M+';
}

export async function syncGoalsToGhl(email, goalsRow) {
  try {
    const resp = await ghlFetch(
      `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`
    );
    if (!resp?.ok) return;

    const data = await resp.json();
    const contact = (data.contacts || [])[0];
    if (!contact) return;

    const customField = {};
    for (const [column, ghlKey] of Object.entries(GHL_GOALS_FIELD_MAP)) {
      const value = goalsRow[column];
      if (value !== undefined && value !== null && value !== '') {
        if (column === 'capital_available') {
          const rangeLabel = capitalToRange(value);
          if (rangeLabel) customField[ghlKey] = rangeLabel;
        } else {
          customField[ghlKey] = String(value);
        }
      }
    }

    if (goalsRow.target_income && goalsRow.current_income) {
      const gap = Number(goalsRow.target_income) - Number(goalsRow.current_income);
      customField['contact.income_gap'] = String(Math.max(0, gap));
    }

    if (Object.keys(customField).length > 0) {
      await ghlFetch(`https://rest.gohighlevel.com/v1/contacts/${contact.id}`, {
        method: 'PUT',
        body: JSON.stringify({ customField })
      });
    }
  } catch (e) {
    console.warn('GHL goals sync error:', e.message);
  }
}

export async function syncNotifFreqToGhl(email, freq) {
  if (!email) return;

  const TAG_WEEKLY = 'Deal Alerts - Weekly';
  const TAG_OFF = 'Deal Alerts - Off';

  const searchResp = await ghlFetch(
    `https://services.leadconnectorhq.com/contacts/search/duplicate?email=${encodeURIComponent(email)}&locationId=${requireAnyServerEnv(['GHL_LOCATION_ID', 'GHL_LOCATION'])}`,
    { method: 'GET' }
  );

  if (!searchResp || !searchResp.ok) return;
  const searchData = await searchResp.json();
  const contact = searchData.contact;
  if (!contact?.id) return;

  const existingTags = contact.tags || [];
  const addTag = freq === 'weekly' ? TAG_WEEKLY : TAG_OFF;
  const removeTag = freq === 'weekly' ? TAG_OFF : TAG_WEEKLY;

  if (existingTags.includes(removeTag)) {
    await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}/tags`,
      { method: 'DELETE', body: JSON.stringify({ tags: [removeTag] }) }
    ).catch(() => {});
  }

  if (!existingTags.includes(addTag)) {
    await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}/tags`,
      { method: 'POST', body: JSON.stringify({ tags: [addTag] }) }
    );
  }
}

export async function syncAutoRenewToGhl(email, autoRenew) {
  if (!email) return;

  const TAG_ON = 'Auto-Renew - On';
  const TAG_OFF = 'Auto-Renew - Off';

  const searchResp = await ghlFetch(
    `https://services.leadconnectorhq.com/contacts/search/duplicate?email=${encodeURIComponent(email)}&locationId=${requireAnyServerEnv(['GHL_LOCATION_ID', 'GHL_LOCATION'])}`,
    { method: 'GET' }
  );

  if (!searchResp || !searchResp.ok) return;
  const searchData = await searchResp.json();
  const contact = searchData.contact;
  if (!contact?.id) return;

  const existingTags = contact.tags || [];
  const addTag = autoRenew ? TAG_ON : TAG_OFF;
  const removeTag = autoRenew ? TAG_OFF : TAG_ON;

  if (existingTags.includes(removeTag)) {
    await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}/tags`,
      { method: 'DELETE', body: JSON.stringify({ tags: [removeTag] }) }
    ).catch(() => {});
  }

  if (!existingTags.includes(addTag)) {
    await ghlFetch(
      `https://services.leadconnectorhq.com/contacts/${contact.id}/tags`,
      { method: 'POST', body: JSON.stringify({ tags: [addTag] }) }
    );
  }
}

export async function syncProfileToGhl(email, fields) {
  if (!email) return;

  const lookupResp = await ghlFetch(
    `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`
  );

  if (!lookupResp || !lookupResp.ok) return;
  const lookupData = await lookupResp.json();
  const contact = (lookupData.contacts || [])[0];
  if (!contact?.id) return;

  const updates = {};
  if (fields.phone) {
    updates.phone = fields.phone;
  }
  if (fields.full_name) {
    const parts = fields.full_name.trim().split(/\s+/);
    updates.firstName = parts[0] || '';
    updates.lastName = parts.slice(1).join(' ') || '';
  }

  if (Object.keys(updates).length === 0) return;

  await ghlFetch(
    `https://rest.gohighlevel.com/v1/contacts/${contact.id}`,
    { method: 'PUT', body: JSON.stringify(updates) }
  );
}
