#!/usr/bin/env node
// Health check: test the full Save/Skip email action pipeline
// Usage: node scripts/test-email-actions.mjs

import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'crypto';

const sb = createClient(
  'https://nntzqyufmtypfjpusflm.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5udHpxeXVmbXR5cGZqcHVzZmxtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk3NTY3OSwiZXhwIjoyMDg5NTUxNjc5fQ.Hx5hs5AAE7Rorw4OvyfA4UKDr7zWk0-GfNgToc0eGFw'
);

const EMAIL = 'info@pascalwagner.com';
const SECRET = 'gyc-deal-save-2026';
const BASE = 'https://dealflow.growyourcashflow.io';

let passed = 0, failed = 0;

function ok(label) { console.log(`  ✅ ${label}`); passed++; }
function fail(label, detail) { console.log(`  ❌ ${label}: ${detail}`); failed++; }

async function run() {
  console.log('\n🔍 Testing email action pipeline...\n');

  // 1. Check user exists in user_profiles
  console.log('1. User lookup');
  const { data: user } = await sb.from('user_profiles').select('id, email, notif_frequency').eq('email', EMAIL).single();
  if (user) ok(`User found: ${user.email} (notif: ${user.notif_frequency})`);
  else { fail('User not found', EMAIL); return; }

  // 2. Check DB constraint allows all stages
  console.log('\n2. Stage constraint');
  const stages = ['new', 'interested', 'duediligence', 'diligence', 'decision', 'portfolio', 'passed'];
  // Use a test deal
  const { data: testDeals } = await sb.from('opportunities').select('id, investment_name').eq('is_506b', false).limit(1);
  const testDeal = testDeals[0];
  if (!testDeal) { fail('No test deal found'); return; }

  for (const stage of stages) {
    const { error } = await sb.from('user_deal_stages')
      .upsert({ user_id: user.id, deal_id: testDeal.id, stage, notes: '', updated_at: new Date().toISOString() },
        { onConflict: 'user_id,deal_id' });
    if (error) fail(`Stage '${stage}'`, error.message);
    else ok(`Stage '${stage}' accepted`);
  }
  // Clean up test entry
  await sb.from('user_deal_stages').delete().eq('user_id', user.id).eq('deal_id', testDeal.id);

  // 3. Token generation
  console.log('\n3. Token validation');
  const token = createHmac('sha256', SECRET).update(EMAIL + ':' + testDeal.id).digest('hex').substring(0, 16);
  if (token.length === 16) ok(`Token generated: ${token}`);
  else fail('Token generation', 'wrong length');

  // 4. Test Save endpoint (follow redirect)
  console.log('\n4. Save endpoint');
  const saveUrl = `${BASE}/api/deal-save?id=${testDeal.id}&email=${encodeURIComponent(EMAIL)}&token=${token}`;
  try {
    const resp = await fetch(saveUrl, { redirect: 'manual' });
    const location = resp.headers.get('location') || '';
    if (resp.status === 302 && location.includes('saved=true')) ok(`Save redirects to: ${location.substring(0, 80)}...`);
    else fail('Save redirect', `status=${resp.status} location=${location}`);
  } catch (e) { fail('Save fetch', e.message); }

  // Check DB was updated
  const { data: saveStage } = await sb.from('user_deal_stages')
    .select('stage').eq('user_id', user.id).eq('deal_id', testDeal.id).maybeSingle();
  if (saveStage?.stage === 'interested') ok(`DB stage set to 'interested'`);
  else fail('DB after save', `stage=${saveStage?.stage || 'none'}`);

  // 5. Test Skip endpoint
  console.log('\n5. Skip endpoint');
  const skipUrl = `${saveUrl}&action=skip`;
  try {
    const resp = await fetch(skipUrl, { redirect: 'manual' });
    const location = resp.headers.get('location') || '';
    if (resp.status === 302 && location.includes('skipped=true')) ok(`Skip redirects to: ${location.substring(0, 80)}...`);
    else fail('Skip redirect', `status=${resp.status} location=${location}`);
  } catch (e) { fail('Skip fetch', e.message); }

  // Check DB was updated
  const { data: skipStage } = await sb.from('user_deal_stages')
    .select('stage').eq('user_id', user.id).eq('deal_id', testDeal.id).maybeSingle();
  if (skipStage?.stage === 'passed') ok(`DB stage set to 'passed'`);
  else fail('DB after skip', `stage=${skipStage?.stage || 'none'}`);

  // Clean up
  await sb.from('user_deal_stages').delete().eq('user_id', user.id).eq('deal_id', testDeal.id);

  // 6. Test unsubscribe endpoint
  console.log('\n6. Unsubscribe endpoint');
  try {
    const resp = await fetch(`${BASE}/api/unsubscribe?email=${encodeURIComponent(EMAIL)}`, { redirect: 'manual' });
    const location = resp.headers.get('location') || '';
    if (resp.status === 302 && location.includes('#settings')) ok(`Unsubscribe redirects to settings`);
    else fail('Unsubscribe redirect', `status=${resp.status} location=${location}`);
  } catch (e) { fail('Unsubscribe fetch', e.message); }

  // Check notif_frequency was set to off
  const { data: updated } = await sb.from('user_profiles').select('notif_frequency').eq('email', EMAIL).single();
  if (updated?.notif_frequency === 'off') ok(`notif_frequency set to 'off'`);
  else fail('Unsubscribe DB', `notif_frequency=${updated?.notif_frequency}`);

  // Reset notif_frequency back to weekly
  await sb.from('user_profiles').update({ notif_frequency: 'weekly' }).eq('email', EMAIL);

  // 7. Check deal.html params are handled
  console.log('\n7. deal.html param handlers');
  try {
    const resp = await fetch(`${BASE}/deal.html?id=${testDeal.id}&saved=true`);
    const html = await resp.text();
    if (html.includes('setJourneyStage') && html.includes("get('saved')")) ok('deal.html handles ?saved=true');
    else fail('deal.html saved handler', 'param handler not found in HTML');

    if (html.includes("get('skipped')")) ok('deal.html handles ?skipped=true');
    else fail('deal.html skipped handler', 'param handler not found in HTML');
  } catch (e) { fail('deal.html fetch', e.message); }

  // Summary
  console.log(`\n${'═'.repeat(40)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed === 0) console.log('🎉 All checks passed!');
  else console.log('⚠️  Some checks failed — review above');
  console.log();
}

run().catch(err => { console.error(err); process.exit(1); });
