// Vercel Serverless Function: CRUD operations for user-specific data in Airtable
// Handles User Deal Stages, User Portfolio, User Goals, and User Tax Docs

const AIRTABLE_BASE_ID = 'appKfcBhhpFJZ28is';
const AIRTABLE_API = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;

const TABLES = {
  stages: 'User Deal Stages',
  portfolio: 'User Portfolio',
  goals: 'User Goals',
  taxdocs: 'User Tax Docs'
};

// Fields expected for each table (used for validation)
const TABLE_FIELDS = {
  stages: ['Email', 'Deal ID', 'Stage', 'Notes', 'Updated At'],
  portfolio: ['Email', 'Deal ID', 'Investment Name', 'Sponsor', 'Asset Class', 'Amount Invested', 'Date Invested', 'Status', 'Target IRR', 'Distributions Received', 'Hold Period', 'Investing Entity', 'Entity Invested Into', 'Notes', 'Updated At'],
  goals: ['Email', 'Goal Type', 'Current Income', 'Target Income', 'Capital Available', 'Timeline', 'Tax Reduction', 'Updated At'],
  taxdocs: ['Email', 'Tax Year', 'Investment Name', 'Investing Entity', 'Entity Invested Into', 'Form Type', 'Upload Status', 'Date Received', 'File URL', 'Portal URL', 'Contact', 'Contact Email', 'Contact Phone', 'Notes', 'Updated At']
};

// Key strategy per table type
const KEY_STRATEGY = {
  stages: 'email+dealId',   // composite key: Email + Deal ID
  portfolio: 'multiple',     // multiple records per user
  goals: 'email',            // one record per user (upsert by email)
  taxdocs: 'multiple'        // multiple records per user
};

// Paginated fetch with optional filterByFormula
async function fetchRecords(tableName, pat, filterFormula = null) {
  const records = [];
  let offset = null;

  do {
    const url = new URL(`${AIRTABLE_API}/${encodeURIComponent(tableName)}`);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    if (filterFormula) url.searchParams.set('filterByFormula', filterFormula);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${pat}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Airtable API error ${response.status}: ${errText}`);
    }

    const data = await response.json();
    records.push(...(data.records || []));
    offset = data.offset || null;
  } while (offset);

  return records;
}

// Create a record in Airtable
async function createRecord(tableName, pat, fields) {
  const response = await fetch(`${AIRTABLE_API}/${encodeURIComponent(tableName)}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records: [{ fields }] })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Airtable create error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.records[0];
}

// Update a record in Airtable
async function updateRecord(tableName, pat, recordId, fields) {
  const response = await fetch(`${AIRTABLE_API}/${encodeURIComponent(tableName)}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ records: [{ id: recordId, fields }] })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Airtable update error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  return data.records[0];
}

// Delete a record in Airtable
async function deleteRecord(tableName, pat, recordId) {
  const url = new URL(`${AIRTABLE_API}/${encodeURIComponent(tableName)}`);
  url.searchParams.set('records[]', recordId);

  const response = await fetch(url.toString(), {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${pat}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Airtable delete error ${response.status}: ${errText}`);
  }

  return await response.json();
}

// Find existing record by composite key (email + dealId) or email only
async function findExistingRecord(tableName, pat, email, dealId = null) {
  let formula;
  if (dealId) {
    formula = `AND({Email}='${escapeAirtableString(email)}',{Deal ID}='${escapeAirtableString(dealId)}')`;
  } else {
    formula = `{Email}='${escapeAirtableString(email)}'`;
  }
  const records = await fetchRecords(tableName, pat, formula);
  return records.length > 0 ? records[0] : null;
}

// Escape single quotes for Airtable formulas
function escapeAirtableString(str) {
  if (!str) return '';
  return str.replace(/'/g, "\\'");
}

// Handle GET requests - fetch records for a user
async function handleGet(req, res, pat) {
  const { type, email } = req.query;

  if (!type || !TABLES[type]) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(TABLES).join(', ')}` });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email parameter is required' });
  }

  const tableName = TABLES[type];
  const formula = `{Email}='${escapeAirtableString(email)}'`;
  const records = await fetchRecords(tableName, pat, formula);

  return res.status(200).json({
    records: records.map(r => ({ id: r.id, ...r.fields })),
    count: records.length,
    type,
    fetchedAt: new Date().toISOString()
  });
}

// Handle POST requests - create or upsert a record
async function handlePost(req, res, pat) {
  const { type, email, data } = req.body;

  if (!type || !TABLES[type]) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(TABLES).join(', ')}` });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: 'Data object is required' });
  }

  const tableName = TABLES[type];
  const strategy = KEY_STRATEGY[type];

  // Always set email and updated timestamp
  const fields = { ...data, Email: email, 'Updated At': new Date().toISOString() };

  let result;

  if (strategy === 'email+dealId') {
    // Upsert by email + Deal ID
    const dealId = data['Deal ID'];
    if (!dealId) {
      return res.status(400).json({ error: 'Deal ID is required for stages' });
    }
    const existing = await findExistingRecord(tableName, pat, email, dealId);
    if (existing) {
      result = await updateRecord(tableName, pat, existing.id, fields);
    } else {
      result = await createRecord(tableName, pat, fields);
    }
  } else if (strategy === 'email') {
    // Upsert by email only (one record per user)
    const existing = await findExistingRecord(tableName, pat, email);
    if (existing) {
      result = await updateRecord(tableName, pat, existing.id, fields);
    } else {
      result = await createRecord(tableName, pat, fields);
    }
  } else {
    // Multiple records allowed - if recordId provided, update; otherwise create
    const recordId = data._recordId;
    if (recordId) {
      const { _recordId, ...cleanFields } = fields;
      result = await updateRecord(tableName, pat, recordId, cleanFields);
    } else {
      const { _recordId, ...cleanFields } = fields;
      result = await createRecord(tableName, pat, cleanFields);
    }
  }

  return res.status(200).json({
    record: { id: result.id, ...result.fields },
    type,
    updatedAt: new Date().toISOString()
  });
}

// Handle DELETE requests
async function handleDelete(req, res, pat) {
  const { type, email, recordId } = req.body;

  if (!type || !TABLES[type]) {
    return res.status(400).json({ error: `Invalid type. Must be one of: ${Object.keys(TABLES).join(', ')}` });
  }
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }
  if (!recordId) {
    return res.status(400).json({ error: 'Record ID is required' });
  }

  const tableName = TABLES[type];

  // Verify the record belongs to the requesting user before deleting
  const formula = `AND(RECORD_ID()='${escapeAirtableString(recordId)}',{Email}='${escapeAirtableString(email)}')`;
  const records = await fetchRecords(tableName, pat, formula);
  if (records.length === 0) {
    return res.status(404).json({ error: 'Record not found or does not belong to this user' });
  }

  const result = await deleteRecord(tableName, pat, recordId);

  return res.status(200).json({
    deleted: true,
    recordId,
    type,
    deletedAt: new Date().toISOString()
  });
}

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const pat = process.env.AIRTABLE_PAT;
  if (!pat) {
    return res.status(500).json({ error: 'AIRTABLE_PAT environment variable not set' });
  }

  try {
    switch (req.method) {
      case 'GET':
        return await handleGet(req, res, pat);
      case 'POST':
        return await handlePost(req, res, pat);
      case 'DELETE':
        return await handleDelete(req, res, pat);
      default:
        return res.status(405).json({ error: `Method ${req.method} not allowed` });
    }
  } catch (err) {
    console.error(`Error in userdata API (${req.method}):`, err);
    return res.status(500).json({ error: 'Internal server error', message: err.message });
  }
}
