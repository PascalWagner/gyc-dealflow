import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canLookupEmail,
  isSandboxPreviewEnvironment,
  normalizeSiteOrigin,
  shouldUseAuthBypass
} from '../api/auth.js';

test('auth bypass only works in preview or development', () => {
  assert.equal(isSandboxPreviewEnvironment({ VERCEL_ENV: 'preview' }), true);
  assert.equal(isSandboxPreviewEnvironment({ NODE_ENV: 'development' }), true);
  assert.equal(isSandboxPreviewEnvironment({ VERCEL_ENV: 'production', NODE_ENV: 'production' }), false);
});

test('auth bypass is limited to the allowlisted sandbox test accounts', () => {
  assert.equal(shouldUseAuthBypass('info@pascalwagner.com', { VERCEL_ENV: 'preview' }), true);
  assert.equal(shouldUseAuthBypass('info@pascalwagner.com', { VERCEL_ENV: 'production' }), false);
  assert.equal(shouldUseAuthBypass('someone@example.com', { VERCEL_ENV: 'preview' }), false);
});

test('sandbox origin is preserved when building auth redirects', () => {
  assert.equal(
    normalizeSiteOrigin('https://sandbox.growyourcashflow.io'),
    'https://sandbox.growyourcashflow.io'
  );
  assert.equal(
    normalizeSiteOrigin('https://sandbox.growyourcashflow.io/login?return=%2Fonboarding'),
    'https://sandbox.growyourcashflow.io'
  );
});

test('lookup is limited to the authenticated user unless the requester is admin', () => {
  assert.equal(
    canLookupEmail({
      requestEmail: 'investor@example.com',
      tokenEmail: 'investor@example.com',
      isAdmin: false
    }),
    true
  );
  assert.equal(
    canLookupEmail({
      requestEmail: 'investor@example.com',
      tokenEmail: 'admin@example.com',
      isAdmin: true
    }),
    true
  );
  assert.equal(
    canLookupEmail({
      requestEmail: 'investor@example.com',
      tokenEmail: 'other@example.com',
      isAdmin: false
    }),
    false
  );
});
