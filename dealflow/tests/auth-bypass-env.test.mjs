import test from 'node:test';
import assert from 'node:assert/strict';
import { isSandboxPreviewEnvironment, shouldUseAuthBypass } from '../api/auth.js';

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
