import test from 'node:test';
import assert from 'node:assert/strict';
import { extract } from '../dist/node.js';
test('Node convenience API reconstructs more than 500 original blocks without duplicates', async () => {
  const texts = Array.from({ length: 600 }, (_, i) => `Original paragraph ${i}.`);
  const html = '<article><h1>Large document</h1>' + texts.map(t => `<p>${t}</p>`).join('') + '</article>';
  await assert.rejects(extract(html, { strategy: 'heuristic' }), /maxBlocks/);
  const result = await extract(html, { apiKey: 'mock', jev: { largePage: {}, includeRoles: false, maxRequests: 100,
    fetch: async (url, init) => { const body = JSON.parse(init.body); return Response.json({ model: 'jev-1.13.0', answers: Object.fromEntries(Object.keys(body.questions).map(k => [k, { type: 'noul', noul: .9 }])), usage: { input_tokens: 1, output_tokens: 1 } }); }
  } });
  assert.equal(result.stats.candidateBlocks, 601);
  assert.equal(result.stats.keptBlocks, 601);
  assert.deepEqual(result.blocks.slice(1).map(b => b.candidate.text), texts);
  assert.equal(new Set(result.blocks.map(b => b.candidate.id)).size, 601);
});
