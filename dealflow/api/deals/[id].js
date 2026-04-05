// Vercel Serverless Function: GP Deal Update
// PATCH /api/deals/:id — Allows GPs to update their own deal fields
// Auth: Bearer token + authorized_emails check (same pattern as management-companies settings)

import { getAdminClient, setCors, ADMIN_EMAILS } from '../_supabase.js';
import { resolveDealWorkflowMutation, slugify } from '../../src/lib/utils/dealWorkflow.js';
import { normalizeDealReviewPatch } from '../../src/lib/utils/dealReviewSchema.js';
import { transformDeals } from '../member/deals/transform.js';
import {
	applyReviewFieldStateToDeal,
	buildAdminReviewFieldStateEntry,
	clearAdminOverrideReviewFieldStateEntry,
	getReviewFieldDbColumn,
	isReviewFieldKey,
	normalizeReviewFieldStateMap,
	resolveFinalReviewFieldValue
} from '../../src/lib/utils/reviewFieldState.js';
import { getDealFieldMapWithHistoricalReturns } from '../_field-map.js';

const FIELD_MAP = getDealFieldMapWithHistoricalReturns();

const NUMERIC_FIELD_KEYS = new Set([
  'targetIRR',
  'preferredReturn',
  'cashOnCash',
  'cashYield',
  'equityMultiple',
  'investmentMinimum',
  'holdPeriod',
  'offeringSize',
  'purchasePrice',
  'fundAUM',
  'managerAUM',
  'totalLoansUnderMgmt',
  'equityCommitments',
  'avgLoanLTC',
  'performanceFeePct',
  'currentFundSize',
  'sponsorCoinvest',
  'sponsorInDeal',
  'unitCount',
  'yearBuilt',
  'squareFootage',
  'occupancyPct',
  'acquisitionLoan',
  'loanToValue',
  'loanRate',
  'loanTermYears',
  'loanIOYears',
  'capexBudget',
  'closingCosts',
  'acquisitionFeePct',
  'assetMgmtFeePct',
  'propertyMgmtFeePct',
  'capitalEventFeePct',
  'dispositionFeePct',
  'constructionMgmtFeePct',
  'loanCount',
  'totalInvestors',
  'totalAmountSold',
  'currentAvgLoanLtv',
  'maxAllowedLtv',
  'currentLeverage',
  'maxAllowedLeverage',
  'fundFoundedYear',
  'firmFoundedYear',
]);

const JSON_ARRAY_FIELD_KEYS = new Set([
  'teamContacts',
  'sourceRiskFactors',
  'highlightedRisks',
  'investingStates',
  'underlyingExposureTypes',
  'riskTags'
]);

function normalizeStringArray(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || '').trim()).filter(Boolean);
  }
  return String(value || '')
    .split('\n')
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeTeamContacts(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry, index) => ({
      firstName: String(entry?.firstName || '').trim(),
      lastName: String(entry?.lastName || '').trim(),
      email: String(entry?.email || '').trim(),
      phone: String(entry?.phone || '').trim(),
      role: String(entry?.role || '').trim(),
      linkedinUrl: String(entry?.linkedinUrl || '').trim(),
      calendarUrl: String(entry?.calendarUrl || '').trim(),
      isPrimary: entry?.isPrimary === true,
      isInvestorRelations: entry?.isInvestorRelations === true,
      displayOrder: Number.isFinite(entry?.displayOrder) ? entry.displayOrder : index
    }))
    .filter((entry) => entry.firstName || entry.lastName || entry.email || entry.role);
}

function normalizeValue(key, value) {
  if (value === undefined) return value;
  if (key === 'managementCompanyId') {
    const trimmed = String(value || '').trim();
    return trimmed || null;
  }
  if (key === 'secFilingId') {
    const trimmed = String(value || '').trim();
    return trimmed || null;
  }
  if (key === 'tags') {
    if (Array.isArray(value)) {
      return value.map((item) => String(item || '').trim()).filter(Boolean);
    }
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (key === 'teamContacts') {
    return normalizeTeamContacts(value);
  }
  if (key === 'sourceRiskFactors' || key === 'highlightedRisks' || key === 'investingStates' || key === 'underlyingExposureTypes' || key === 'riskTags') {
    return normalizeStringArray(value);
  }
  if (NUMERIC_FIELD_KEYS.has(key)) {
    if (value === null || value === '') return null;
    const numericValue =
      typeof value === 'number' ? value : Number(String(value).replace(/,/g, '').trim());
    return Number.isFinite(numericValue) ? numericValue : null;
  }
  return value;
}

async function insertReviewFieldEvents(supabase, events = []) {
  if (!Array.isArray(events) || events.length === 0) return;
  try {
    const { error } = await supabase
      .from('review_field_events')
      .insert(events);
    if (error) {
      console.warn('[deal-review/events] insert failed', {
        message: error.message,
        count: events.length
      });
    }
  } catch (error) {
    console.warn('[deal-review/events] insert threw', {
      message: error?.message || 'unknown_error',
      count: events.length
    });
  }
}

function isUuid(value) {
  return /^[0-9a-f-]{36}$/i.test(String(value || '').trim());
}

async function loadAuthorizedDealContext(req, id, supabase = getAdminClient()) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return { status: 401, body: { error: 'Missing authorization' } };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { status: 401, body: { error: 'Invalid token' } };
  }

  const { data: deal, error: dealError } = await supabase
    .from('opportunities')
    .select('*')
    .eq('id', id)
    .single();

  if (dealError || !deal) {
    return { status: 404, body: { error: 'Deal not found' } };
  }

  const availableColumns = new Set(Object.keys(deal || {}));
  let currentManagementCompany = null;

  if (deal.management_company_id) {
    const { data: linkedCompany, error: linkedCompanyLookupError } = await supabase
      .from('management_companies')
      .select('*')
      .eq('id', deal.management_company_id)
      .single();

    if (!linkedCompanyLookupError) {
      currentManagementCompany = linkedCompany || null;
    }
  }

  const isAdmin = ADMIN_EMAILS.includes(String(user.email || '').toLowerCase());

  if (!isAdmin) {
    if (!deal.management_company_id) {
      return { status: 403, body: { error: 'Deal has no linked company' } };
    }

    const authorizedEmails = (currentManagementCompany?.authorized_emails || []).map((email) =>
      String(email || '').toLowerCase()
    );

    if (!authorizedEmails.includes(String(user.email || '').toLowerCase())) {
      return { status: 403, body: { error: 'Not authorized for this deal' } };
    }
  }

  return {
    status: 200,
    supabase,
    user,
    isAdmin,
    deal,
    availableColumns,
    currentManagementCompany
  };
}

function serializeDealRecord(deal, {
  currentManagementCompany = null,
  availableColumns = new Set()
} = {}) {
  const stateAwareDeal = applyReviewFieldStateToDeal(deal);
  const modernLendingReviewSchemaSupported = [
    'review_field_evidence',
    'review_field_state',
    'review_state_version',
    'team_contacts',
    'sec_verification_state',
    'current_fund_size',
    'current_avg_loan_ltv',
    'max_allowed_ltv',
    'current_leverage',
    'max_allowed_leverage',
    'fund_founded_year',
    'firm_founded_year',
    'risk_tags'
  ].every((columnName) => availableColumns.has(columnName));
  const transformedDeal = transformDeals(
    [
      {
        ...stateAwareDeal,
        management_company: currentManagementCompany || stateAwareDeal?.management_company || null
      }
    ],
    [],
    []
  )?.[0] || {};
  const resolvedCompanyWebsite = currentManagementCompany?.website || stateAwareDeal?.companyWebsite || stateAwareDeal?.mcWebsite || '';
  const reviewFieldState = normalizeReviewFieldStateMap(
    stateAwareDeal?.review_field_state || stateAwareDeal?.reviewFieldState || {}
  );
  return {
    ...stateAwareDeal,
    ...transformedDeal,
    slug: stateAwareDeal?.slug || slugify(stateAwareDeal?.investment_name || ''),
    sponsorName:
      transformedDeal?.sponsorName
      || stateAwareDeal?.sponsor_name
      || currentManagementCompany?.operator_name
      || '',
    managementCompanyId: transformedDeal?.managementCompanyId || stateAwareDeal?.management_company_id || '',
    dealBranch: transformedDeal?.dealBranch || stateAwareDeal?.deal_branch || '',
    lifecycleStatus: transformedDeal?.lifecycleStatus || stateAwareDeal?.lifecycle_status || '',
    isVisibleToUsers: stateAwareDeal?.is_visible_to_users === true,
    reviewFieldEvidence:
      transformedDeal?.reviewFieldEvidence
      || stateAwareDeal?.review_field_evidence
      || {},
    reviewFieldEvidenceSupported: availableColumns.has('review_field_evidence'),
    reviewFieldState,
    reviewFieldStateSupported: availableColumns.has('review_field_state'),
    reviewStateVersion: Number(stateAwareDeal?.review_state_version || 0),
    teamContacts:
      transformedDeal?.teamContacts
      || stateAwareDeal?.team_contacts
      || [],
    teamContactsSnapshotSupported: availableColumns.has('team_contacts'),
    modernLendingReviewSchemaSupported,
    legacyApprovedReviewCompat:
      (transformedDeal?.dealBranch || stateAwareDeal?.deal_branch || '') === 'lending_fund'
      && String(transformedDeal?.lifecycleStatus || stateAwareDeal?.lifecycle_status || '').trim().toLowerCase() === 'approved'
      && !modernLendingReviewSchemaSupported,
    mcWebsite: transformedDeal?.mcWebsite || resolvedCompanyWebsite,
    companyWebsite: transformedDeal?.companyWebsite || resolvedCompanyWebsite
  };
}

export default async function handler(req, res) {
  setCors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;
  if (!isUuid(id)) {
    return res.status(400).json({ error: 'Invalid deal ID' });
  }
  if (!['GET', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const context = await loadAuthorizedDealContext(req, id);
  if (context.status !== 200) {
    return res.status(context.status).json(context.body);
  }

  const {
    supabase,
    user,
    deal,
    availableColumns
  } = context;
  let currentManagementCompany = context.currentManagementCompany;

  if (req.method === 'GET') {
    // Check for a pending reconciliation task for this deal.
    // Non-fatal: if the table doesn't exist yet (pre-migration) we return false.
    let pendingReconciliation = false;
    let pendingReconciliationId = null;
    try {
      const { data: reconTask } = await supabase
        .from('reconciliation_tasks')
        .select('id')
        .eq('deal_id', id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (reconTask) {
        pendingReconciliation = true;
        pendingReconciliationId = reconTask.id;
      }
    } catch {
      // reconciliation_tasks table may not exist in all environments yet
    }
    const serialized = serializeDealRecord(deal, { currentManagementCompany, availableColumns });
    return res.status(200).json({
      deal: {
        ...serialized,
        pendingReconciliation,
        pendingReconciliationId
      }
    });
  }

  // Build update object from whitelisted fields
  const body = req.body || {};
  const { values: normalizedBody, errors: reviewFieldErrors } = normalizeDealReviewPatch(body);
  if (Object.keys(reviewFieldErrors).length > 0) {
    return res.status(400).json({
      error: 'Invalid deal update',
      fieldErrors: reviewFieldErrors
    });
  }

  const candidateBody = {
    ...body,
    ...normalizedBody
  };
  const reviewFieldStateSupported = availableColumns.has('review_field_state');
  const reviewStateVersionSupported = availableColumns.has('review_state_version');
  const requestedReviewStateVersion =
    body.reviewStateVersion === undefined || body.reviewStateVersion === null
      ? null
      : Number(body.reviewStateVersion);
  const currentReviewStateVersion = Number(deal?.review_state_version || 0);

  if (
    reviewStateVersionSupported
    && requestedReviewStateVersion !== null
    && requestedReviewStateVersion !== currentReviewStateVersion
  ) {
    return res.status(409).json({
      error: 'This deal was updated somewhere else. Reload the latest version before saving again.',
      code: 'review_state_conflict',
      currentVersion: currentReviewStateVersion,
      deal: serializeDealRecord(deal, { currentManagementCompany, availableColumns })
    });
  }

  const reviewFieldAction =
    candidateBody.reviewFieldAction && typeof candidateBody.reviewFieldAction === 'object'
      ? candidateBody.reviewFieldAction
      : null;

  if (reviewFieldAction?.type === 'reset_to_ai') {
    if (!reviewFieldStateSupported) {
      return res.status(409).json({
        error: 'This deal does not support resetting review fields to extracted values yet.'
      });
    }

    const requestedFieldKeys = Array.from(
      new Set(
        [
          reviewFieldAction.fieldKey,
          ...(Array.isArray(reviewFieldAction.fieldKeys) ? reviewFieldAction.fieldKeys : [])
        ].filter((fieldKey) => isReviewFieldKey(fieldKey))
      )
    );

    if (requestedFieldKeys.length === 0) {
      return res.status(400).json({ error: 'No valid review fields were provided for reset.' });
    }

    const actor = {
      email: String(user?.email || '').trim().toLowerCase(),
      name: String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim()
    };
    const reviewFieldState = normalizeReviewFieldStateMap(deal?.review_field_state || {});
    const nextReviewFieldState = { ...reviewFieldState };
    const updates = {};
    const eventRows = [];
    const now = new Date().toISOString();

    for (const fieldKey of requestedFieldKeys) {
      const columnName = getReviewFieldDbColumn(fieldKey);
      const previousEntry = reviewFieldState[fieldKey];
      const previousFinalValue = resolveFinalReviewFieldValue(previousEntry, deal?.[columnName]);
      const nextEntry = clearAdminOverrideReviewFieldStateEntry(previousEntry, {
        fallbackValue: deal?.[columnName],
        at: now
      });
      const nextFinalValue = resolveFinalReviewFieldValue(nextEntry, deal?.[columnName]);
      nextReviewFieldState[fieldKey] = nextEntry;

      if (columnName && availableColumns.has(columnName)) {
        updates[columnName] = nextFinalValue;
      }

      eventRows.push({
        opportunity_id: id,
        field_key: fieldKey,
        event_type: 'reset_to_ai',
        actor_type: 'admin',
        actor_email: actor.email,
        actor_name: actor.name,
        previous_value: previousFinalValue,
        next_value: nextFinalValue,
        metadata: {
          reviewStateVersion: currentReviewStateVersion
        }
      });
    }

    updates.review_field_state = nextReviewFieldState;
    if (reviewStateVersionSupported) {
      updates.review_state_version = currentReviewStateVersion + 1;
    }
    if (availableColumns.has('updated_at')) {
      updates.updated_at = now;
    }

    const { data: updatedDeal, error: updateError } = await supabase
      .from('opportunities')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('[deal-review/reset-to-ai] update failed', {
        id,
        message: updateError.message
      });
      return res.status(500).json({ error: 'Failed to reset the selected review fields.' });
    }

    await insertReviewFieldEvents(supabase, eventRows);

    return res.status(200).json({
      success: true,
      deal: serializeDealRecord(
        {
          ...updatedDeal,
          companyWebsite: currentManagementCompany?.website || '',
          mcWebsite: currentManagementCompany?.website || ''
        },
        {
          currentManagementCompany,
          availableColumns
        }
      )
    });
  }

  const requestedSponsorName = String(candidateBody.sponsorName || '').trim();
  const requestedCompanyWebsite =
    'companyWebsite' in candidateBody ? String(candidateBody.companyWebsite || '').trim() : undefined;
  let touchedManagementCompany = false;
  let resolvedCompanyWebsite = currentManagementCompany?.website || '';

  if (candidateBody.createManagementCompany === true && !candidateBody.managementCompanyId && requestedSponsorName) {
    const { data: createdCompany, error: createCompanyError } = await supabase
      .from('management_companies')
      .insert({
        operator_name: requestedSponsorName,
        website: requestedCompanyWebsite || null
      })
      .select('id, operator_name')
      .single();

    if (createCompanyError || !createdCompany) {
      return res.status(500).json({ error: 'Failed to create sponsor record' });
    }

    candidateBody.managementCompanyId = createdCompany.id;
    candidateBody.sponsorName = createdCompany.operator_name;
    touchedManagementCompany = true;
    resolvedCompanyWebsite = requestedCompanyWebsite || '';

    const operatorPermissionUpsert = await supabase
      .from('operator_permissions')
      .upsert({ management_company_id: createdCompany.id }, { onConflict: 'management_company_id' });

    if (operatorPermissionUpsert.error) {
      console.warn('Operator permissions upsert failed:', operatorPermissionUpsert.error);
    }
  } else if (candidateBody.managementCompanyId) {
    let linkedCompany = currentManagementCompany;
    let linkedCompanyError = null;

    if (!linkedCompany || linkedCompany.id !== candidateBody.managementCompanyId) {
      const linkedCompanyResponse = await supabase
        .from('management_companies')
        .select('id, operator_name, website')
        .eq('id', candidateBody.managementCompanyId)
        .single();
      linkedCompany = linkedCompanyResponse.data;
      linkedCompanyError = linkedCompanyResponse.error;
    }

    if (linkedCompanyError || !linkedCompany) {
      return res.status(400).json({ error: 'Selected sponsor record was not found' });
    }

    const companyPatch = {};
    if (requestedSponsorName && requestedSponsorName !== linkedCompany.operator_name) {
      companyPatch.operator_name = requestedSponsorName;
    }
    if (requestedCompanyWebsite !== undefined) {
      companyPatch.website = requestedCompanyWebsite || null;
    }

    let nextCompany = linkedCompany;
    if (Object.keys(companyPatch).length > 0) {
      const { data: updatedCompany, error: updateCompanyError } = await supabase
        .from('management_companies')
        .update(companyPatch)
        .eq('id', linkedCompany.id)
        .select('id, operator_name, website')
        .single();

      if (updateCompanyError || !updatedCompany) {
        return res.status(500).json({ error: 'Failed to update sponsor record' });
      }

      nextCompany = updatedCompany;
      touchedManagementCompany = true;
    }

    candidateBody.sponsorName = nextCompany.operator_name;
    resolvedCompanyWebsite = nextCompany.website || '';
    currentManagementCompany = {
      ...(currentManagementCompany || {}),
      ...nextCompany
    };
  }

  const updates = {};
  const updated = [];
  const omitted = [];
  const reviewFieldEvents = [];
  const actor = {
    email: String(user?.email || '').trim().toLowerCase(),
    name: String(user?.user_metadata?.full_name || user?.user_metadata?.name || '').trim()
  };
  const existingReviewFieldState = normalizeReviewFieldStateMap(deal?.review_field_state || {});
  let nextReviewFieldState = { ...existingReviewFieldState };
  let reviewFieldStateChanged = false;

  for (const [camelKey, snakeKey] of Object.entries(FIELD_MAP)) {
    if (camelKey in candidateBody) {
      const normalizedNextValue = normalizeValue(camelKey, candidateBody[camelKey]);
      const stateBackedField = reviewFieldStateSupported && isReviewFieldKey(camelKey);

      if (!availableColumns.has(snakeKey) && !stateBackedField) {
        omitted.push(camelKey);
        continue;
      }

      if (availableColumns.has(snakeKey)) {
        updates[snakeKey] = normalizedNextValue;
      }
      updated.push(camelKey);

      if (stateBackedField) {
        const previousEntry = nextReviewFieldState[camelKey];
        const previousFinalValue = resolveFinalReviewFieldValue(previousEntry, deal?.[snakeKey]);
        const nextEntry = buildAdminReviewFieldStateEntry(previousEntry, {
          nextValue: normalizedNextValue,
          fallbackValue: previousFinalValue,
          actor,
          at: new Date().toISOString()
        });
        nextReviewFieldState = {
          ...nextReviewFieldState,
          [camelKey]: nextEntry
        };
        reviewFieldStateChanged = true;
        reviewFieldEvents.push({
          opportunity_id: id,
          field_key: camelKey,
          event_type: 'admin_save',
          actor_type: 'admin',
          actor_email: actor.email,
          actor_name: actor.name,
          previous_value: previousFinalValue,
          next_value: normalizedNextValue,
          metadata: {
            materializedToColumn: availableColumns.has(snakeKey),
            reviewStateVersion: currentReviewStateVersion
          }
        });
      }
    }
  }

  if (reviewFieldStateChanged) {
    updates.review_field_state = nextReviewFieldState;
  }

  if (Object.keys(updates).length === 0 && touchedManagementCompany && availableColumns.has('updated_at')) {
    updates.updated_at = new Date().toISOString();
  }

  if (omitted.length > 0) {
    return res.status(409).json({
      error: `This deal is missing review-schema support for: ${omitted.join(', ')}. The save was blocked to avoid silent data loss.`,
      code: 'review_schema_mismatch',
      omitted
    });
  }

  const hasMeaningfulPersistenceChange =
    updated.length > 0 || reviewFieldStateChanged || touchedManagementCompany;

  if (reviewStateVersionSupported && hasMeaningfulPersistenceChange) {
    updates.review_state_version = currentReviewStateVersion + 1;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  if (updates.investment_name && !updates.slug && availableColumns.has('slug')) {
    updates.slug = slugify(updates.investment_name);
  }
  if (availableColumns.has('sponsor_name') && !updates.sponsor_name && candidateBody.sponsorName !== undefined) {
    updates.sponsor_name = String(candidateBody.sponsorName || '').trim();
  }

  if (updates.lifecycle_status !== undefined || updates.is_visible_to_users !== undefined) {
    const resolution = resolveDealWorkflowMutation(deal, updates);
    if (resolution.error) {
      return res.status(400).json({ error: resolution.error });
    }
    updates.lifecycle_status = resolution.lifecycleStatus;
    updates.is_visible_to_users = resolution.isVisibleToUsers;
  }

  const { data: updatedDeal, error: updateError } = await supabase
    .from('opportunities')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('Deal update failed:', updateError);
    return res.status(500).json({ error: 'Failed to save deal' });
  }

  await insertReviewFieldEvents(supabase, reviewFieldEvents);

  const responseDeal = serializeDealRecord(
    {
      ...updatedDeal,
      companyWebsite: resolvedCompanyWebsite,
      mcWebsite: resolvedCompanyWebsite
    },
    {
      currentManagementCompany: {
        ...(currentManagementCompany || {}),
        website: resolvedCompanyWebsite
      },
      availableColumns
    }
  );

  return res.status(200).json({
    success: true,
    updated,
    omitted,
    deal: responseDeal
  });
}
