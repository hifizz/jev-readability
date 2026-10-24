import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from '../dist/node.js';

const run = html => extract(html, { strategy: 'heuristic' });
const list = start => `<main><ol start="${start}"><li>First item text long enough to survive the local heuristic baseline filter.</li><li>Second item.</li></ol></main>`;

test('malformed ordered-list start attributes do not produce NaN or hex/exponential Markdown numbering', async () => {
  for (const start of ['abc', '0x10', '3e2']) {
    const result = await run(list(start));
    assert.match(result.markdown, /^1\. First item/);
    assert.match(result.markdown, /\n2\. Second item\./);
    assert.ok(!result.markdown.includes('NaN'));
  }
});

test('valid ordered-list start values keep the declared numbering', async () => {
  const result = await run(list('-2'));
  assert.match(result.markdown, /^-2\. First item/);
  assert.match(result.markdown, /\n-1\. Second item\./);
  const third = await run(list('3'));
  assert.match(third.markdown, /^3\. First item/);
  assert.match(third.markdown, /\n4\. Second item\./);
});

test('Markdown start handling matches the renderHtml attribute allowlist', async () => {
  // Six-digit values are dropped by renderHtml; the Markdown fallback must not diverge.
  const result = await run(list('123456'));
  assert.ok(!result.html.includes('start='));
  assert.match(result.markdown, /^1\. First item/);
});
