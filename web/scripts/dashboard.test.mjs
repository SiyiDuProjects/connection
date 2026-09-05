import test from 'node:test';
import assert from 'node:assert/strict';
import { summarizeUsage } from '../lib/dashboard.ts';

test('dashboard counts successful records without treating failed reveals as completed', () => {
  const result = summarizeUsage([
    { id: 1, action: 'contacts.reveal', status: 'success', createdAt: '2026-09-04T01:00:00Z' },
    { id: 2, action: 'contacts.reveal', status: 'failed', createdAt: '2026-09-04T02:00:00Z' },
    { id: 3, action: 'email.draft', status: 'success', createdAt: '2026-09-03T01:00:00Z' },
    { id: 4, action: 'contacts.search', status: 'success', createdAt: '2026-09-02T01:00:00Z' }
  ]);
  assert.equal(result.reveals, 1);
  assert.equal(result.drafts, 1);
  assert.deepEqual(result.byAction.map(row => row.count), [1, 1, 1]);
  assert.deepEqual(result.daily, [
    { date: '2026-09-03', reveals: 0, drafts: 1 },
    { date: '2026-09-04', reveals: 1, drafts: 0 }
  ]);
});

test('timestamps group in UTC, unknown actions do not become outreach, and empty data stays empty', () => {
  const result = summarizeUsage([
    { id: 1, action: 'email.draft', status: 'success', createdAt: '2026-09-03T23:30:00-07:00' },
    { id: 2, action: 'email.draft', status: 'success', createdAt: '2026-09-04T08:00:00Z' },
    { id: 3, action: 'other', status: 'success', createdAt: '2026-09-04T08:00:00Z' }
  ]);
  assert.deepEqual(result.daily, [{ date: '2026-09-04', reveals: 0, drafts: 2 }]);
  assert.deepEqual(summarizeUsage([]).daily, []);
  assert.equal(summarizeUsage([]).reveals, 0);
});
