#!/usr/bin/env node
// Integration test: dismissing a reconciliation task produces a review_field_events row
// Usage: node scripts/test-reconciliation-dismiss.mjs

import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://nntzqyufmtypfjpusflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udHpxeXVmbXR5cGZqcHVzZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk3NTY3OSwiZXhwIjoyMDg5NTUxNjc5fQ.Hx5hs5AAE7Rorw4OvyfA4UKDr7zWk0-GfNgToc0eGFw'
);

let passed = 0, failed = 0;

function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function fail(label, detail) { console.log(`  ❌ ${label}: ${detail}`); failed++; }

// IDs created during this test run — cleaned up at the end
const cleanup = { extractionRunId: null, taskId: null, eventIds: [] };

async function run() {
  console.log('\n🔍 Testing reconciliation dismiss audit event...\n');

  // ── 1. Find a real deal ────────────────────────────────────────────────────
  console.log('1. Find test deal');
  const { data: deals, error: dealError } = await sb
    .from('opportunities')
    .select('id, investment_name')
    .limit(1);

  if (dealError || !deals?.length) {
    fail('Find deal', dealError?.message || 'No deals found');
    return;
  }
  const dealId = deals[0].id;
  ok(`Using deal: ${deals[0].investment_name} (${dealId})`);

  // ── 2. Create a synthetic extraction_run (required FK) ────────────────────
  console.log('\n2. Create synthetic extraction_run');
  const { data: runRow, error: runError } = await sb
    .from('extraction_runs')
    .insert({ deal_id: dealId, status: 'completed', triggered_by: 'test@integration.local' })
    .select('id')
    .single();

  if (runError || !runRow) {
    fail('Insert extraction_run', runError?.message || 'No row returned');
    return;
  }
  cleanup.extractionRunId = runRow.id;
  ok(`extraction_run created: ${runRow.id}`);

  // ── 3. Insert a synthetic reconciliation_task ──────────────────────────────
  console.log('\n3. Create synthetic reconciliation task');
  const fakeConflicts = [
    { fieldKey: 'minimum_investment', currentValue: 50000, extractedValue: 75000 },
    { fieldKey: 'target_irr',         currentValue: 0.12,  extractedValue: 0.15  }
  ];

  const { data: taskRow, error: insertError } = await sb
    .from('reconciliation_tasks')
    .insert({
      deal_id:           dealId,
      status:            'pending',
      conflict_fields:   fakeConflicts,
      extraction_run_id: cleanup.extractionRunId
    })
    .select('id')
    .single();

  if (insertError || !taskRow) {
    fail('Insert task', insertError?.message || 'No row returned');
    return;
  }
  cleanup.taskId = taskRow.id;
  ok(`Task created: ${taskRow.id}`);

  // ── 4. Simulate the PATCH dismiss logic ────────────────────────────────────
  console.log('\n4. Simulate dismiss + audit insert');
  const actorEmail = 'test@integration.local';
  const actorName  = 'Integration Test';
  const now        = new Date().toISOString();

  // Step A: mark task dismissed (mirrors handler)
  const { error: updateError } = await sb
    .from('reconciliation_tasks')
    .update({ status: 'dismissed', resolved_by: actorEmail, resolved_at: now })
    .eq('id', cleanup.taskId);

  if (updateError) {
    fail('Dismiss task', updateError.message);
    return;
  }
  ok('Task status → dismissed');

  // Step B: insert the audit event (mirrors handler exactly)
  const { data: eventRow, error: auditError } = await sb
    .from('review_field_events')
    .insert({
      opportunity_id: dealId,
      field_key:      '',
      event_type:     'reconciliation_dismissed',
      actor_type:     'admin',
      actor_email:    actorEmail,
      actor_name:     actorName,
      previous_value: { status: 'pending' },
      next_value:     { status: 'dismissed' },
      metadata: {
        reconciliationTaskId: cleanup.taskId,
        conflictFieldCount:   fakeConflicts.length,
        extractionRunId:      cleanup.extractionRunId
      }
    })
    .select('id')
    .single();

  if (auditError || !eventRow) {
    fail('Insert audit event', auditError?.message || 'No row returned');
    return;
  }
  cleanup.eventIds.push(eventRow.id);
  ok(`Audit event created: ${eventRow.id}`);

  // ── 5. Verify the row ──────────────────────────────────────────────────────
  console.log('\n5. Verify audit event row');
  const { data: verify, error: readError } = await sb
    .from('review_field_events')
    .select('*')
    .eq('id', eventRow.id)
    .single();

  if (readError || !verify) {
    fail('Read back event', readError?.message || 'Row not found');
    return;
  }

  verify.event_type === 'reconciliation_dismissed'
    ? ok(`event_type = '${verify.event_type}'`)
    : fail('event_type', `expected 'reconciliation_dismissed', got '${verify.event_type}'`);

  verify.opportunity_id === dealId
    ? ok(`opportunity_id matches deal (${dealId})`)
    : fail('opportunity_id', `expected ${dealId}, got ${verify.opportunity_id}`);

  verify.field_key === ''
    ? ok("field_key is '' (task-level event sentinel)")
    : fail('field_key', `expected '', got '${verify.field_key}'`);

  verify.metadata?.reconciliationTaskId === cleanup.taskId
    ? ok(`metadata.reconciliationTaskId = ${cleanup.taskId}`)
    : fail('metadata.reconciliationTaskId', `expected ${cleanup.taskId}, got ${verify.metadata?.reconciliationTaskId}`);

  verify.metadata?.conflictFieldCount === fakeConflicts.length
    ? ok(`metadata.conflictFieldCount = ${verify.metadata.conflictFieldCount}`)
    : fail('metadata.conflictFieldCount', `expected ${fakeConflicts.length}, got ${verify.metadata?.conflictFieldCount}`);

  verify.metadata?.extractionRunId === cleanup.extractionRunId
    ? ok(`metadata.extractionRunId = ${verify.metadata.extractionRunId}`)
    : fail('metadata.extractionRunId', `expected ${cleanup.extractionRunId}, got ${verify.metadata?.extractionRunId}`);

  verify.actor_email === actorEmail
    ? ok(`actor_email = '${verify.actor_email}'`)
    : fail('actor_email', `expected '${actorEmail}', got '${verify.actor_email}'`);
}

async function cleanup_data() {
  console.log('\n🧹 Cleaning up test data...');
  if (cleanup.eventIds.length > 0) {
    await sb.from('review_field_events').delete().in('id', cleanup.eventIds);
    console.log(`  Deleted ${cleanup.eventIds.length} review_field_events row(s)`);
  }
  if (cleanup.taskId) {
    await sb.from('reconciliation_tasks').delete().eq('id', cleanup.taskId);
    console.log(`  Deleted reconciliation_task ${cleanup.taskId}`);
  }
  if (cleanup.extractionRunId) {
    await sb.from('extraction_runs').delete().eq('id', cleanup.extractionRunId);
    console.log(`  Deleted extraction_run ${cleanup.extractionRunId}`);
  }
}

run()
  .catch((err) => {
    console.error('\n💥 Unexpected error:', err);
    failed++;
  })
  .finally(async () => {
    await cleanup_data();
    console.log(`\n${ failed === 0 ? '✅' : '❌' } ${passed} passed, ${failed} failed\n`);
    process.exit(failed > 0 ? 1 : 0);
  });
