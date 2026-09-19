import { extract, prepare, finalize, emptyUsage } from '/dist/index.js';
import { createJevClassifier } from '/dist/jev.js';
const cases = [];
const test = (name, fn) => cases.push({ name, fn });
const ok = (v, message = 'Assertion failed') => { if (!v) throw new Error(message); };
const equal = (a, b) => { if (a !== b) throw new Error(`Expected ${JSON.stringify(a)} to equal ${JSON.stringify(b)}`); };
const reject = async (fn, regex) => { try { await fn(); } catch (e) { ok(regex.test(e.message), e.message); return; } throw new Error('Expected rejection'); };
const count = (text, needle) => text.split(needle).length - 1;
const run = (html, options = {}) => extract(html, { strategy: 'heuristic', ...options });
const allKeep = async input => ({ method: 'custom', decisions: Object.fromEntries(input.candidates.map(c => [c.id, { keep: true, keepProbability: null, role: null, roleConfidence: null, needsReview: false }])), usage: emptyUsage(), warnings: [] });
const article = await fetch('/fixtures/article.html').then(r => r.text());
const docs = await fetch('/fixtures/documentation.html').then(r => r.text());

test('Chinese primary content survives while site chrome is excluded', async () => {
  const r = await run(article, { url: 'https://example.org/article' });
  ok(r.text.includes('分类器只负责判断，不负责改写。'));
  for (const excluded of ['我们使用 Cookie', '推广信息', '十个你不能错过', '这条评论讨论了文章']) ok(!r.text.includes(excluded), excluded);
  equal(r.method, 'heuristic'); equal(r.usage.requests, 0);
});
test('short headings, code and tables survive', async () => {
  const r = await run(article); ok(r.markdown.includes('## 先分块')); ok(r.markdown.includes('```typescript')); ok(r.markdown.includes('| 内容 | 处理方式 |')); ok(r.html.includes('<table>'));
});
test('title and metadata are read from original elements', async () => {
  const r = await run(article); equal(r.title, '让网页正文回到阅读中'); equal(r.metadata.author, '示例作者'); equal(r.metadata.publishedAt, '2026-09-20'); equal(r.metadata.language, 'zh-CN');
});
test('forum mode retains substantive discussion', async () => { const r = await run(article, { mode: 'forum' }); ok(r.text.includes('这条评论讨论了文章')); });
test('documentation retains link-rich reference lists and callouts', async () => {
  const r = await run(docs, { mode: 'documentation', url: 'https://example.org/guide' }); ok(r.markdown.includes('[extract()](https://example.org/api/extract)')); ok(r.text.includes('Important: your API key belongs on the server'));
});
test('parent and child contents are never duplicated', async () => { const r = await run(docs); equal(count(r.text, 'The nested paragraph must appear exactly once.'), 1); });
test('direct text surrounding child blocks is preserved in source order', async () => {
  const r = await run(docs); const a = r.text.indexOf('Direct introductory'), b = r.text.indexOf('The nested paragraph'), c = r.text.indexOf('Direct closing'); ok(a >= 0 && b > a && c > b);
});
test('one-character headings are candidates', () => { const p = prepare('<main><h2>二</h2><p>正文</p></main>'); equal(p.blocks[0].candidate.text, '二'); });
test('relative URLs are resolved and HTML-escaped correctly', async () => {
  const r = await run('<main><p>Read <a href="../guide?q=1&amp;x=2">the guide</a>.</p></main>', { url: 'https://example.org/a/page' }); ok(r.html.includes('https://example.org/guide?q=1&amp;x=2')); ok(r.markdown.includes('https://example.org/guide?q=1&x=2'));
});
test('active tags, handlers and unsafe URL schemes are not emitted', async () => {
  const r = await run('<main><p onclick="alert(1)">Safe <a href="javascript:alert(1)">link</a><img src="data:text/html,bad" onerror="alert(1)" alt="picture"></p><script>window.__xss=1</script><iframe src="https://bad.example/"></iframe><svg onload="alert(1)"><text>bad</text></svg></main>');
  ok(!/onclick|onerror|javascript:|data:text|<script|<iframe|<svg/.test(r.html)); equal(window.__xss, undefined);
});
test('hidden, aria-hidden and inline display:none blocks are omitted', async () => {
  const r = await run('<main><p>Visible</p><p hidden>HIDDEN1</p><p aria-hidden="true">HIDDEN2</p><div style="display: none !important"><p>HIDDEN3</p></div></main>'); ok(!r.text.includes('HIDDEN')); ok(r.text.includes('Visible'));
});
test('input Documents are cloned instead of mutated', async () => {
  const doc = new DOMParser().parseFromString(article, 'text/html'); const before = doc.documentElement.outerHTML; await extract(doc, { strategy: 'heuristic' }); equal(doc.documentElement.outerHTML, before);
});
test('HTML fragments work without explicit html/body wrappers', async () => { const r = await run('<p>A plain fragment with enough meaningful source text to remain in the local baseline.</p>'); ok(r.text.includes('plain fragment')); });
test('code backticks do not prematurely close Markdown fences', async () => {
  const r = await run('<main><pre><code>const x = `hello`;\n// ```\n  keepIndent();</code></pre></main>'); ok(r.markdown.startsWith('````\n')); ok(r.markdown.includes('  keepIndent();')); ok(r.text.includes('const x = `hello`;'));
});
test('quotes and ordered-list starts survive rendering', async () => {
  const r = await run('<main><blockquote><p>Quoted text.</p></blockquote><ol start="3"><li>Third item</li><li>Fourth item</li></ol></main>'); ok(r.markdown.includes('> Quoted text.')); ok(r.markdown.includes('3. Third item')); ok(r.markdown.includes('4. Fourth item'));
});
test('merged tables retain HTML span attributes and warn about Markdown', async () => {
  const r = await run('<main><table><tr><th colspan="2">Columns</th></tr><tr><td>A</td><td>B</td></tr></table></main>'); ok(r.html.includes('colspan="2"')); ok(r.warnings.some(w => /Merged table/.test(w)));
});
test('block budgets do not silently truncate pages', async () => { await reject(() => run('<main><p>one</p><p>two</p></main>', { maxBlocks: 1 }), /maxBlocks/); });
test('element, depth and HTML-size limits are enforced', async () => {
  await reject(() => run('<main><p>one</p></main>', { maxElements: 1 }), /maxElements/);
  await reject(() => run('<main><section><p>one</p></section></main>', { maxDepth: 2 }), /maxDepth/);
  await reject(() => run('<p>content</p>', { maxHtmlCharacters: 4 }), /maxHtmlCharacters/);
});
test('an unrendered SPA warns without calling the model', async () => {
  let called = false; const r = await extract('<div id="app"></div><script>loadEverything()</script>', { classifier: async () => { called = true; throw new Error('must not run'); } }); equal(called, false); equal(r.text, ''); ok(r.warnings.some(w => /unrendered SPA/.test(w)));
});
test('empty input remains empty', async () => { const r = await run(''); equal(r.text, ''); equal(r.stats.candidateBlocks, 0); });
test('missing classifiers are never silently replaced by local rules', async () => { await reject(() => extract('<main><p>Text</p></main>'), /Provide a classifier/); });
test('classifier failures throw by default', async () => { await reject(() => extract('<main><p>Text</p></main>', { classifier: async () => { throw new Error('API unavailable'); } }), /API unavailable/); });
test('explicit fallback is labeled and retains failed request counts', async () => {
  const r = await extract('<main><p>Source</p></main>', { fallback: 'heuristic', classifier: async () => { const e = new Error('API down'); e.partialUsage = { ...emptyUsage(), requests: 2 }; throw e; } }); equal(r.method, 'heuristic'); equal(r.usage.requests, 2); equal(r.usage.inputTokens, null); ok(r.warnings.some(w => /explicit heuristic fallback/.test(w)));
});
test('cancellation is not swallowed by fallback', async () => {
  const controller = new AbortController(); await reject(() => extract('<main><p>Text</p></main>', { signal: controller.signal, fallback: 'heuristic', classifier: async () => { controller.abort(new Error('USER_CANCELLED')); throw new Error('ignored'); } }), /USER_CANCELLED/);
});
test('missing decisions fail closed', async () => { await reject(() => extract('<main><p>Text</p></main>', { classifier: async () => ({ method: 'custom', decisions: {}, usage: emptyUsage(), warnings: [] }) }), /decision/); });
test('all-rejected results remain empty rather than silently falling back', async () => {
  const r = await extract('<main><p>Text</p></main>', { classifier: async input => { const r = await allKeep(input); Object.values(r.decisions).forEach(d => d.keep = false); return r; } }); equal(r.text, ''); ok(r.warnings.some(w => /Every candidate/.test(w)));
});
test('selected long blocks contain the complete original text', async () => {
  const text = '开头。' + '很长的正文。'.repeat(3000) + '结尾。'; const r = await extract(`<main><p>${text}</p></main>`, { classifier: allKeep }); equal(r.text, text);
});
test('model output cannot inject new nodes or generated text', async () => {
  const p = prepare('<main><p>Original only</p></main>'); const r = await allKeep({ candidates: p.blocks.map(b => b.candidate) }); r.decisions.fake = { keep: true, keepProbability: 1, role: 'main_content', roleConfidence: 1, needsReview: false, text: 'INJECTED' }; equal(finalize(p, r).text, 'Original only');
});
test('credential-holding Jev clients cannot be created in browsers', () => {
  try { createJevClassifier({ apiKey: 'not-a-real-key' }); } catch (e) { ok(/browser code/.test(e.message)); return; } throw new Error('Expected server-only protection');
});
test('offline predictions never contain invented probabilities', async () => { const r = await run(article); ok(r.blocks.every(b => b.keepProbability === null && b.roleConfidence === null)); });
test('metadata favors a main-content heading over branding', async () => { const r = await run('<header><h1>Brand</h1></header><main><h1>The Article</h1><p>Text</p></main>'); equal(r.title, 'The Article'); });

test('unexpected decision fields cannot overwrite source HTML or text', async () => {
  const p = prepare('<main><p>Source preserved</p></main>');
  const r = await allKeep({ candidates: p.blocks.map(b => b.candidate) });
  Object.assign(r.decisions.b0001, { html: '<script>bad()</script>', markdown: 'INJECTED', candidate: { text: 'INJECTED' } });
  const result = finalize(p, r); equal(result.text, 'Source preserved'); equal(result.markdown, 'Source preserved'); ok(!result.html.includes('<script'));
});

const results = [];
for (const item of cases) {
  try { await item.fn(); results.push({ name: item.name, pass: true }); }
  catch (e) { results.push({ name: item.name, pass: false, error: e.stack || e.message }); }
}
window.__TEST_RESULTS__ = { passed: results.filter(r => r.pass).length, failed: results.filter(r => !r.pass).length, tests: results };
document.getElementById('results').textContent = JSON.stringify(window.__TEST_RESULTS__, null, 2);
