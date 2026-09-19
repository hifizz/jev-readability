import test from 'node:test';
import assert from 'node:assert/strict';
import { buildJevBatches, createJevClassifier, decodeJevResponse, ROLE_CRITERIA, validateClassifyInput, sampleText, JevHttpError } from '../dist/jev.js';
import { heuristicClassifier, finalize, emptyUsage } from '../dist/index.js';
import { createRemoteClassifier } from '../dist/remote.js';

const candidate = (i, text = 'A substantive paragraph explaining the primary page content in enough detail.') => ({
  id: `b${String(i + 1).padStart(4, '0')}`, order: i, kind: 'paragraph', tag: 'p', text,
  ancestorHints: ['p', 'article content', 'main', 'body'], heading: 'The primary page',
  linkDensity: 0, inMain: true, inNavigation: false, inAside: false, inFooter: false, inComments: false,
});
const input = (n = 3) => ({ page: { title: 'Test page', url: 'https://example.org/docs?token=private#secret', author: null, publishedAt: null, language: 'en' }, mode: 'article', candidates: Array.from({ length: n }, (_, i) => candidate(i)) });
function reply(body, probability = 0.96) {
  const answers = {};
  for (const [key, question] of Object.entries(body.questions)) {
    answers[key] = question.type === 'noul' ? { type: 'noul', noul: probability } : {
      type: 'choice', choice: 'main_content', confidence: 0.87,
      probabilities: Object.fromEntries(Object.keys(ROLE_CRITERIA).map(k => [k, k === 'main_content' ? 1 : 0])),
    };
  }
  return { model: 'jev-test-double', answers, usage: { input_tokens: 100, output_tokens: 20 } };
}
const respond = body => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
const fakeFetch = async (_url, init) => respond(reply(JSON.parse(init.body)));
const client = extras => createJevClassifier({ apiKey: 'test-only-not-a-real-key', fetch: fakeFetch, retryBaseMs: 0, ...extras });

test('small pages use one request with two typed questions per block', () => {
  const batches = buildJevBatches(input());
  assert.equal(batches.length, 1); assert.equal(Object.keys(batches[0].body.questions).length, 6);
  assert.equal(batches[0].body.questions.keep_b0001.type, 'noul');
});
test('question instructions explicitly identify the target block', () => {
  const b = buildJevBatches(input())[0];
  for (const [key, q] of Object.entries(b.body.questions)) assert.ok(q.instructions.includes(`state.blocks["${key.split('_').at(-1)}"]`));
});
test('the state URL omits query strings and fragments', () => {
  const b = buildJevBatches(input())[0];
  assert.equal(b.body.state.page.url, 'https://example.org/docs');
  assert.ok(!JSON.stringify(b.body).includes('private'));
});
test('large pages split without dropping or duplicating blocks', () => {
  const batches = buildJevBatches(input(11), { maxBlocksPerBatch: 3 });
  assert.deepEqual(batches.map(b => b.ids.length), [3, 3, 3, 2]);
  assert.equal(new Set(batches.flatMap(b => b.ids)).size, 11);
});
test('byte limits are checked against the serialized payload', () => {
  const value = input(9); value.candidates.forEach(c => c.text = '中文正文'.repeat(500));
  const batches = buildJevBatches(value, { maxStateBytes: 8000, maxRequestBytes: 16000, maxSampleCharacters: 1000 });
  assert.ok(batches.length > 1);
  for (const b of batches) { assert.ok(Buffer.byteLength(JSON.stringify(b.body.state)) <= 8000); assert.ok(b.bytes <= 16000); }
});
test('oversized single blocks fail rather than lose content silently', () => {
  assert.throws(() => buildJevBatches(input(), { maxStateBytes: 100 }), /cannot fit/);
});
test('head/tail sampling retains beginning and end and reports truncation', () => {
  const sample = sampleText('BEGIN ' + '长'.repeat(1000) + ' END', 200);
  assert.ok(sample.text.startsWith('BEGIN')); assert.ok(sample.text.endsWith(' END')); assert.equal(sample.truncated, true); assert.ok(sample.text.length <= 200);
});
test('roles can be disabled to reduce question count', () => {
  const batch = buildJevBatches(input(), { includeRoles: false })[0];
  assert.equal(Object.keys(batch.body.questions).length, 3);
  assert.equal(decodeJevResponse(reply(batch.body), batch).decisions.b0001.role, null);
});
test('API uses official endpoint, bearer header, and native state/questions', async () => {
  const classify = client({ fetch: async (url, init) => {
    assert.equal(url, 'https://api.typesafe.ai/v1/systemone'); assert.equal(init.headers.Authorization, 'Bearer test-only-not-a-real-key');
    assert.equal(init.redirect, 'error'); const body = JSON.parse(init.body);
    assert.equal(body.model, 'jev-latest'); assert.ok(body.state.blocks.b0001); assert.ok(!body.messages);
    return respond(reply(body));
  }});
  const result = await classify(input()); assert.equal(result.method, 'jev'); assert.equal(result.usage.requests, 1);
  assert.equal(result.decisions.b0001.keepProbability, 0.96); assert.equal(result.decisions.b0001.roleConfidence, 0.87);
});
test('missing answers are errors, not negative classifications', () => {
  const batch = buildJevBatches(input())[0]; const response = reply(batch.body); delete response.answers.keep_b0001;
  assert.throws(() => decodeJevResponse(response, batch), /missing noul/);
});
test('noul values must be finite probabilities', () => {
  const batch = buildJevBatches(input())[0];
  for (const invalid of [-1, 2, NaN, '0.9', null]) { const r = reply(batch.body); r.answers.keep_b0001.noul = invalid; assert.throws(() => decodeJevResponse(r, batch)); }
});
test('invalid role distributions fail validation', () => {
  const batch = buildJevBatches(input())[0]; const r = reply(batch.body); r.answers.role_b0001.probabilities.main_content = 0.6;
  assert.throws(() => decodeJevResponse(r, batch), /sum to 1/);
});
test('uncertain blocks are kept and flagged by default', () => {
  const b = buildJevBatches(input())[0]; const d = decodeJevResponse(reply(b.body, 0.48), b).decisions.b0001;
  assert.equal(d.keep, true); assert.equal(d.needsReview, true);
});
test('uncertainty policy is configurable without changing the raw probability', () => {
  const b = buildJevBatches(input())[0]; const r = reply(b.body, 0.48);
  for (const onUncertain of ['drop', 'threshold']) { const d = decodeJevResponse(r, b, { onUncertain }).decisions.b0001; assert.equal(d.keep, false); assert.equal(d.keepProbability, 0.48); }
});
test('transient 429 retries, preserving usage and retry warnings', async () => {
  let attempts = 0;
  const result = await client({ fetch: async (_url, init) => ++attempts === 1 ? new Response('', { status: 429, headers: { 'Retry-After': '0' } }) : respond(reply(JSON.parse(init.body))) })(input());
  assert.equal(attempts, 2); assert.equal(result.usage.requests, 2); assert.equal(result.usage.inputTokens, 100); assert.ok(result.warnings.some(s => /billed/.test(s)));
});
test('529 overload is retryable', async () => {
  let attempts = 0;
  await client({ fetch: async (_u, init) => ++attempts === 1 ? new Response('', { status: 529 }) : respond(reply(JSON.parse(init.body))) })(input());
  assert.equal(attempts, 2);
});
test('authentication failures are not retried or reflected', async () => {
  let count = 0;
  await assert.rejects(() => client({ fetch: async () => { count++; return new Response('secret should not escape', { status: 401 }); } })(input()), e => e instanceof JevHttpError && e.status === 401 && !e.message.includes('secret') && e.partialUsage.requests === 1);
  assert.equal(count, 1);
});
test('an excessive Retry-After is not ignored', async () => {
  let count = 0;
  await assert.rejects(() => client({ maxRetryAfterMs: 2, fetch: async () => { count++; return new Response('', { status: 429, headers: { 'Retry-After': '120' } }); } })(input()), /Retry-After/);
  assert.equal(count, 1);
});
test('caller cancellation interrupts in-flight requests', async () => {
  const controller = new AbortController();
  const promise = client({ fetch: (_u, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })) })(input(), { signal: controller.signal });
  controller.abort(new DOMException('Canceled', 'AbortError'));
  await assert.rejects(() => promise, { name: 'AbortError' });
});
test('per-request timeouts fail as TimeoutError', async () => {
  await assert.rejects(() => client({ timeoutMs: 15, fetch: (_u, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })) })(input()), { name: 'TimeoutError' });
});
test('total timeout bounds a series of retries', async () => {
  await assert.rejects(() => client({ totalTimeoutMs: 15, retryBaseMs: 100, fetch: async () => new Response('', { status: 429 }) })(input()), { name: 'TimeoutError' });
});
test('retry attempts consume the maxRequests budget', async () => {
  let attempts = 0;
  await assert.rejects(() => client({ maxRequests: 2, maxRetries: 5, fetch: async () => { attempts++; return new Response('', { status: 500 }); } })(input()), /maxRequests/);
  assert.equal(attempts, 2);
});
test('worker concurrency is bounded and successful usage is summed', async () => {
  let active = 0, peak = 0;
  const r = await client({ maxBlocksPerBatch: 1, concurrency: 2, fetch: async (_u, init) => {
    active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 5)); active--; return respond(reply(JSON.parse(init.body)));
  }})(input(5));
  assert.equal(peak, 2); assert.equal(r.usage.requests, 5); assert.equal(r.usage.inputTokens, 500); assert.equal(Object.keys(r.decisions).length, 5);
});
test('missing token usage remains null', async () => {
  const r = await client({ fetch: async (_u, init) => { const r = reply(JSON.parse(init.body)); delete r.usage; return respond(r); } })(input());
  assert.equal(r.usage.inputTokens, null); assert.ok(r.warnings.some(w => /unknown/.test(w)));
});
test('invalid mode and duplicate candidate IDs are rejected before HTTP', () => {
  const v = input(); v.mode = 'anything'; assert.throws(() => validateClassifyInput(v), /mode/);
  const d = input(); d.candidates[1].id = d.candidates[0].id; assert.throws(() => buildJevBatches(d), /duplicate/);
});
test('keys and HTTPS endpoint settings are validated immediately', () => {
  assert.throws(() => createJevClassifier({ apiKey: '' }), /API_KEY/);
  assert.throws(() => createJevClassifier({ apiKey: 'x', endpoint: 'http://example.org' }), /HTTPS/);
  assert.throws(() => client({ keepThreshold: -1 }), /keepThreshold/);
  assert.throws(() => client({ maxRetries: -1 }), /maxRetries/);
});
test('the offline baseline never invents probabilities or token counts', async () => {
  const r = await heuristicClassifier(input()); assert.equal(r.method, 'heuristic'); assert.equal(r.usage.requests, 0); assert.equal(r.decisions.b0001.keepProbability, null); assert.equal(r.decisions.b0001.roleConfidence, null);
});
test('remote adapter sends candidates to the configured application endpoint', async () => {
  const response = await heuristicClassifier(input());
  const remote = createRemoteClassifier({ endpoint: '/my-classifier', headers: { 'X-CSRF': 'test' }, fetch: async (u, init) => { assert.equal(u, '/my-classifier'); assert.equal(init.headers['X-CSRF'], 'test'); return respond(response); } });
  assert.deepEqual(await remote(input()), response);
});
test('remote errors do not masquerade as successful empty extraction', async () => {
  const remote = createRemoteClassifier({ endpoint: '/x', fetch: async () => new Response('untrusted HTML', { status: 503 }) });
  await assert.rejects(() => remote(input()), /HTTP 503/);
});
test('finalization rejects incomplete decisions', () => {
  const c = candidate(0);
  const page = { metadata: input().page, mode: 'article', blocks: [{ candidate: c, html: '<p>source</p>', markdown: 'source' }], warnings: [], inputCharacters: 10, prepareMs: 1 };
  assert.throws(() => finalize(page, { method: 'custom', decisions: {}, usage: emptyUsage(), warnings: [] }), /decision/);
});
