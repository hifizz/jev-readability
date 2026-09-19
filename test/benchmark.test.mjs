import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, score, aggregate } from '../benchmark/metrics.mjs';
import { cases } from '../benchmark/corpus.mjs';
const example = { keep: ['Required sentence', 'More content'], drop: ['Unrelated promotion'] };
test('benchmark normalizes whitespace without lowercasing', () => {
  assert.equal(normalize('Ａ b\n c'), 'Abc');
  assert.notEqual(normalize('API'), normalize('api'));
});
test('benchmark counts missed content and leaked noise independently', () => {
  const m = score('Required sentence. Unrelated promotion.', example);
  assert.equal(m.tp, 1); assert.equal(m.fp, 1); assert.equal(m.fn, 1);
  assert.equal(m.precision, 0.5); assert.equal(m.recall, 0.5); assert.equal(m.f1, 0.5);
});
test('benchmark empty output has zero recall and undefined precision', () => {
  const m = score('', example);
  assert.equal(m.precision, null); assert.equal(m.recall, 0); assert.equal(m.f1, 0);
});
test('benchmark perfect extraction excludes labeled boilerplate', () => {
  const m = score('Required sentence. More content.', example);
  assert.equal(m.perfect, true); assert.equal(m.f1, 1);
});
test('benchmark aggregation includes failed extractions in recall', () => {
  const m = aggregate([{ status: 'ok', metrics: score('Required sentence More content', example) }, { status: 'error', metrics: score('', example) }]);
  assert.equal(m.total, 2); assert.equal(m.completed, 1); assert.equal(m.errors, 1);
  assert.equal(m.recall, 0.5); assert.equal(m.perfect, 1);
});
test('benchmark corpus is fixed, bilingual, and has independent positive/negative anchors', () => {
  assert.equal(cases.length, 8);
  assert.equal(new Set(cases.map(c => c.id)).size, 8);
  assert.equal(cases.reduce((n,c) => n + c.keep.length, 0), 27);
  assert.equal(cases.reduce((n,c) => n + c.drop.length, 0), 21);
  assert.ok(cases.some(c => c.language === 'zh'));
  for (const c of cases) {
    assert.ok(c.keep.length && c.drop.length);
    assert.equal(new Set([...c.keep, ...c.drop].map(normalize)).size, c.keep.length + c.drop.length);
    assert.ok(!c.html.includes('data-gold'));
  }
});
