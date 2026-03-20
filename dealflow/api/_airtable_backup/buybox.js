// Vercel Serverless Function: Buy Box Sync with GoHighLevel
// Reads and writes buy box preferences from GHL contact custom fields

const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

// GHL custom field key mapping: wizard/app key → GHL contact field key
const FIELD_MAP = {
  // Wizard fields → GHL unique keys
  trigger: 'contact.investment_trigger_event',
  checkSize: 'contact.investment_amount',
  networth: 'contact.networth',
  capitalReady: 'contact.capital_availability',
  urgency: 'contact.deployment_urgency',
  assetClasses: 'contact.asset_class_preference',
  entity: 'contact.how_will_you_be_making_this_investment',
  minCashYield: 'contact.minimum_1st_year_cash_on_cash_return',
  minIRR: 'contact.minimum_total_return_requirement_irr',
  instruments: 'contact.investing_instrument',
  lockup: 'contact.lockup_period_tolerance',
  dealStructure: 'contact.firm_focus_preference',
  strategies: 'contact.strategy_preference',
  operatorSize: 'contact.operator_size_preference',
  redemption: 'contact.redemptions',
  distributions: 'contact.distribution_frequency_options',
  operatorStrategy: 'contact.diversification_preference',
  financialReporting: 'contact.audited_financials_requirement',
  accreditation: 'contact.accreditation_type',
  goal: 'contact.primary_investment_objective',
  fundSource: 'contact.where_is_the_money_coming_from'
};

// Reverse mapping: GHL key → app key
const REVERSE_MAP = {};
for (const [appKey, ghlKey] of Object.entries(FIELD_MAP)) {
  REVERSE_MAP[ghlKey] = appKey;
}

// Cache for GHL custom field ID → key mapping
let ghlFieldIdToKey = null;

async function loadFieldMapping() {
  if (ghlFieldIdToKey) return ghlFieldIdToKey;
  try {
    const resp = await fetch('https://rest.gohighlevel.com/v1/custom-fields/', {
      headers: { 'Authorization': `Bearer ${GHL_API_KEY}` }
    });
    if (resp.ok) {
      const data = await resp.json();
      const fields = data.customFields || [];
      ghlFieldIdToKey = {};
      for (const f of fields) {
        // Map field ID to the field key (e.g., "contact.investment_amount")
        ghlFieldIdToKey[f.id] = f.fieldKey || f.key || '';
      }
      return ghlFieldIdToKey;
    }
  } catch (e) {
    console.error('Failed to load GHL custom fields:', e.message);
  }
  return {};
}

async function findContact(email) {
  const searchUrl = `https://rest.gohighlevel.com/v1/contacts/lookup?email=${encodeURIComponent(email)}`;
  const resp = await fetch(searchUrl, {
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`
    }
  });
  if (!resp.ok) throw new Error('GHL search failed: ' + resp.status);
  const data = await resp.json();
  // v1 lookup returns { contacts: [...] }
  const contacts = data.contacts || [];
  return contacts[0] || null;
}

async function getContactFull(contactId) {
  const resp = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`
    }
  });
  if (!resp.ok) throw new Error('GHL contact fetch failed: ' + resp.status);
  return resp.json();
}

async function updateContact(contactId, customFields) {
  // v1 API expects customField object { key: value } not array
  const customFieldObj = {};
  for (const cf of customFields) {
    customFieldObj[cf.key] = Array.isArray(cf.field_value) ? cf.field_value.join(', ') : cf.field_value;
  }
  const resp = await fetch(`https://rest.gohighlevel.com/v1/contacts/${contactId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${GHL_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ customField: customFieldObj })
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error('GHL update failed: ' + resp.status + ' ' + errText);
  }
  return resp.json();
}

// Convert GHL custom fields array to our buy box format
function ghlToAppBuyBox(customFields, fieldIdToKey = {}) {
  const buyBox = {};
  if (!Array.isArray(customFields)) return buyBox;

  for (const field of customFields) {
    // Try direct key match first, then resolve ID → key via field mapping
    const resolvedKey = field.key || fieldIdToKey[field.id] || '';
    const appKey = REVERSE_MAP[field.id] || REVERSE_MAP[field.key] || REVERSE_MAP[resolvedKey];
    if (appKey) {
      buyBox[appKey] = field.value;
    }
  }
  return buyBox;
}

// Convert our buy box data to GHL custom fields format
function appToGhlFields(wizardData) {
  const customFields = [];

  for (const [appKey, ghlKey] of Object.entries(FIELD_MAP)) {
    if (wizardData[appKey] !== undefined && wizardData[appKey] !== null && wizardData[appKey] !== '') {
      customFields.push({
        key: ghlKey,
        field_value: Array.isArray(wizardData[appKey])
          ? wizardData[appKey]
          : String(wizardData[appKey])
      });
    }
  }

  return customFields;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    return res.status(500).json({ error: 'GHL_API_KEY or GHL_LOCATION_ID not configured' });
  }

  // GET: Fetch buy box from GHL
  if (req.method === 'GET') {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email required' });

    try {
      const contact = await findContact(email);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found', buyBox: {} });
      }

      // Get full contact and field mapping in parallel
      const [full, fieldIdToKey] = await Promise.all([
        getContactFull(contact.id),
        loadFieldMapping()
      ]);
      const contactData = full.contact || full;

      // v1 API returns customField as array of {id, value} objects
      const customFieldArr = Array.isArray(contactData.customField) ? contactData.customField : [];
      const buyBox = ghlToAppBuyBox(customFieldArr, fieldIdToKey);

      return res.status(200).json({
        success: true,
        contactId: contact.id,
        name: [contactData.firstName, contactData.lastName].filter(Boolean).join(' '),
        buyBox,
        rawFields: customFieldArr
      });
    } catch (e) {
      console.error('Buy box fetch error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  // POST: Save buy box to GHL
  if (req.method === 'POST') {
    const { email, wizardData } = req.body || {};
    if (!email || !wizardData) {
      return res.status(400).json({ error: 'Email and wizardData required' });
    }

    try {
      const contact = await findContact(email);
      if (!contact) {
        return res.status(404).json({ error: 'Contact not found' });
      }

      const customFields = appToGhlFields(wizardData);
      if (customFields.length === 0) {
        return res.status(200).json({ success: true, message: 'No fields to update' });
      }

      await updateContact(contact.id, customFields);

      return res.status(200).json({
        success: true,
        contactId: contact.id,
        fieldsUpdated: customFields.length
      });
    } catch (e) {
      console.error('Buy box save error:', e);
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
