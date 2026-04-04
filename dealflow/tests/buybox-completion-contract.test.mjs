import test from 'node:test';
import assert from 'node:assert/strict';
import { applyBuyBoxCompletionMetadata } from '../api/buybox.js';

test('canonical completion keeps _completedAt and marks the source as canonical', () => {
  const result = applyBuyBoxCompletionMetadata(
    {
      goal: 'Cash Flow (income now)',
      _completedAt: '2025-03-01T10:00:00.000Z'
    },
    {
      canonicalCompletedAt: '2025-03-03T21:56:20.000Z'
    }
  );

  assert.equal(result._completedAt, '2025-03-03T21:56:20.000Z');
  assert.equal(result._completionSource, 'canonical');
  assert.equal('_completionCandidateAt' in result, false);
});

test('fallback-only completion no longer masquerades as canonical completion', () => {
  const result = applyBuyBoxCompletionMetadata({
    goal: 'Cash Flow (income now)',
    _completedAt: '2025-03-03T21:56:20.000Z'
  });

  assert.equal('_completedAt' in result, false);
  assert.equal(result._completionCandidateAt, '2025-03-03T21:56:20.000Z');
  assert.equal(result._completionSource, 'fallback');
});

test('missing completion metadata is marked as none', () => {
  const result = applyBuyBoxCompletionMetadata({
    goal: 'Cash Flow (income now)'
  });

  assert.equal('_completedAt' in result, false);
  assert.equal('_completionCandidateAt' in result, false);
  assert.equal(result._completionSource, 'none');
});
