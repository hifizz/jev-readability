import test from 'node:test';
import assert from 'node:assert/strict';
import { anchorScore, wordScore } from '../benchmark/wcxb-metrics.mjs';
test('empty SPA references are separately identifiable, not perfect anchor evidence', () => {
  const a = anchorScore('some text', { with: [], without: [] });
  assert.equal(a.perfect, false);
  assert.equal(a.f1, null);
  assert.equal(wordScore('', '').f1, 1);
  assert.equal(wordScore('skeleton noise', '').f1, 0);
});
