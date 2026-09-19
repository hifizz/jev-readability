import { JSDOM, VirtualConsole } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile, rename } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { extract } from '../dist/index.js';
import { createJevClassifier, buildJevPlan } from '../dist/jev.js';
import { TYPES, MODES, modeFor, wordScore, anchorScore, aggregate, pairedBootstrap } from './wcxb-metrics.mjs';
import { createMeter } from './meter.mjs';

const PIN = 'c039d5ee9f5a3a984a0e167e63aacd04e76e78a9';
const SEED = 'jev-readability-wcxb-v0.2';
const CANONICAL = '79d02e092b2fd1a19ec9e60ae5b33dd576cd8cc92a4543aeef988e2bce01add2';
const sha = x => createHash('sha256').update(x).digest('hex');
const args = new Map();
const booleanFlags = new Set(['--jev', '--large-pages']);
const valueFlags = new Set(['--dataset', '--per-type', '--seed', '--variants', '--max-requests', '--max-bytes']);
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (args.has(arg)) throw new Error('Duplicate option: ' + arg);
  if (booleanFlags.has(arg)) args.set(arg, true);
  else if (valueFlags.has(arg) && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')) args.set(arg, process.argv[++i]);
  else throw new Error('Unknown option or missing value: ' + arg);
}
const integer = (value, min, max) => { const n = Number(value); if (!Number.isSafeInteger(n) || n < min || n > max) throw new Error(`Expected integer ${min}..${max}`); return n; };
const live = args.has('--jev'), largePages = args.has('--large-pages');
const datasetDir = args.get('--dataset') || 'wcxb-repo/test';
const perType = integer(args.get('--per-type') || 20, 1, 25), seed = args.get('--seed') || SEED;
const variants = live ? String(args.get('--variants') || 'typed').split(',') : [];
if (new Set(variants).size !== variants.length || variants.some(v => !['typed', 'generic'].includes(v))) throw new Error('Variants must be typed and/or generic');
const model = process.env.JEV_MODEL || 'jev-1.13.0';
if (!/^jev-(?:\d+\.\d+\.\d+|latest|preview)$/.test(model)) throw new Error('Invalid JEV model');
if (live && !process.env.TYPESAFE_API_KEY?.trim()) throw new Error('TYPESAFE_API_KEY is required');
const actualPin = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: dirname(datasetDir), encoding: 'utf8' }).trim();
if (actualPin !== PIN) throw new Error('Dataset must be checked out at the pinned WCXB revision');
const meter = createMeter({ maxRequests: integer(args.get('--max-requests') || 2400, 1, 5000), maxBytes: integer(args.get('--max-bytes') || 120_000_000, 1, 250_000_000), expectedModel: /^jev-\d/.test(model) ? model : undefined });
const jevOptions = { apiKey: process.env.TYPESAFE_API_KEY || '', model, fetch: meter.fetch, concurrency: 2, maxRequests: largePages ? 128 : 64, timeoutMs: 30_000, totalTimeoutMs: 120_000, maxRetries: 2, ...(largePages ? { largePage: { maxBlocks: 5000, regionBlocks: 500 } } : {}) };
const classifier = live ? createJevClassifier(jevOptions) : null;
const gtDir = join(datasetDir, 'ground-truth'), htmlDir = join(datasetDir, 'html');
const files = (await readdir(gtDir)).filter(f => f.endsWith('.json')).sort();
const records = [];
for (const file of files) {
  const raw = await readFile(join(gtDir, file), 'utf8'), data = JSON.parse(raw);
  const type = data?._internal?.page_type?.primary, id = String(data.file_id || file.replace(/\.json$/, ''));
  if (TYPES.includes(type)) records.push({ id, type, data, goldHash: sha(raw) });
}
const selected = TYPES.flatMap(type => {
  const pool = records.filter(r => r.type === type).map(r => ({ ...r, rank: sha(seed + ':' + type + ':' + r.id) })).sort((a, b) => a.rank.localeCompare(b.rank));
  if (pool.length < perType) throw new Error('Insufficient pages for type ' + type);
  return pool.slice(0, perType);
});
const selectionHash = sha(JSON.stringify(selected.map(({ id, type }) => ({ id, type }))));
if (seed === SEED && perType === 20 && selectionHash !== CANONICAL) throw new Error('Selection differs from the original 140-page cohort');
// Preflight every file/annotation before spending any model quota. Gold never enters classifier input.
for (const item of selected) {
  if (!/^\d+$/.test(item.id)) throw new Error('Unsafe dataset ID');
  const gt = item.data.ground_truth;
  if (!gt || (typeof gt.main_content !== 'string' && !(gt.main_content === null && item.data._internal?.unextractable === true)) || !Array.isArray(gt.with) || !Array.isArray(gt.without) || [...gt.with, ...gt.without].some(s => typeof s !== 'string' || !s.trim())) throw new Error('Invalid ground truth: ' + item.id);
  const compressed = await readFile(join(htmlDir, item.id + '.html.gz'));
  item.html = gunzipSync(compressed, { maxOutputLength: 16_000_000 }).toString('utf8');
  item.htmlHash = sha(item.html);
  item.reference = gt.main_content ?? '';
  item.emptyReference = !item.reference.trim();
}
const engineFor = v => v === 'typed' ? 'jev-api' : 'jev-generic';
const engines = ['mozilla-readability', ...variants.map(engineFor)];
const rows = [];
const require = createRequire(import.meta.url);
const report = {
  schemaVersion: 3, status: 'running', generatedAt: new Date().toISOString(),
  sourceCommit: process.env.GITHUB_SHA || null,
  runUrl: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  versions: { node: process.version, readability: require('@mozilla/readability/package.json').version, jsdom: require('jsdom/package.json').version },
  dataset: { name: 'WCXB v1.0', repository: 'Murrough-Foley/web-content-extraction-benchmark', commit: PIN, split: 'test', availablePages: records.length, selectedPages: selected.length, emptyReferenceIds: selected.filter(r => r.emptyReference).map(r => r.id), perType, seed, types: TYPES, selectionHash },
  evaluation: { variants, requestedModel: live ? model : null, largePages, modeMapping: MODES, wordMetric: 'macro per-page bag-of-words P/R/F1; failed and unrun pages score zero', anchorMetric: 'micro with/without substring matches after NFKC and whitespace removal',
    config: { maxPageBlocks: largePages ? 5000 : 500, regionBlocks: largePages ? 500 : null, pageRequests: jevOptions.maxRequests, batchBlocks: 24, includeRoles: true, sampleCharacters: 1800, keepThreshold: .5, uncertaintyMargin: .15, onUncertain: 'keep' },
    caveats: ['Balanced by seven types, not web-prevalence weighted.', 'Public test pages previously examined; this cohort is no longer an untouched holdout.', 'Typed receives a page-type label. Generic always uses agent; no supplied type label is serialized.', 'One execution per engine/page; timings are diagnostic and not a controlled speed benchmark.', 'No threshold/prompt tuning after observing this run.', 'Two SPA gold references are empty/null; all-140 uses the historical empty-target convention, with a separate nonempty-reference sensitivity view.'] },
  sourceHashes: Object.fromEntries(await Promise.all(['src/dom.ts', 'src/render.ts', 'src/index.ts', 'src/jev.ts', 'src/regions.ts', 'src/types.ts', 'benchmark/wcxb-run.mjs', 'benchmark/wcxb-metrics.mjs', 'benchmark/meter.mjs'].map(async f => [f, sha(await readFile(f))]))),
  selected: selected.map(({ id, type, data, htmlHash, goldHash, emptyReference }) => ({ id, type, url: data.url, htmlHash, goldHash, emptyReference })),
  limits: meter.limits, usage: {}, summaries: {}, paired: [], rows,
};
await mkdir('docs/benchmarks', { recursive: true });
const out = live ? 'docs/benchmarks/wcxb-jev-run.json' : 'docs/benchmarks/wcxb-readability-run.json';
async function checkpoint() {
  report.usage = { ...meter.snapshot(), perEngine: Object.fromEntries(engines.filter(e => e !== 'mozilla-readability').map(e => [e, meter.snapshot(e)])) };
  await writeFile(out + '.tmp', JSON.stringify(report, null, 2) + '\n'); await rename(out + '.tmp', out);
}
await checkpoint();
let circuit = null, consecutiveErrors = 0;
for (const [index, item] of selected.entries()) {
  // Alternate typed/generic ordering without consulting labels or gold scores.
  const order = parseInt(sha(seed + ':order:' + item.id).slice(0, 2), 16) % 2 ? [...variants].reverse() : variants;
  for (const engine of ['mozilla-readability', ...order.map(engineFor)]) {
    const variant = engine === 'jev-api' ? 'typed' : engine === 'jev-generic' ? 'generic' : null;
    const mode = variant ? modeFor(variant, item.type) : null;
    const started = performance.now();
    let dom, result, text = '', status = 'ok', error = null, regions = null;
    const before = meter.snapshot(engine);
    try {
      if (variant && circuit) { status = 'not_run'; throw new Error(circuit); }
      dom = new JSDOM(item.html, { url: item.data.url || 'https://example.invalid/', virtualConsole: new VirtualConsole() });
      if (!variant) text = new Readability(dom.window.document).parse()?.textContent || '';
      else {
        meter.setScope(engine);
        result = await extract(dom.window.document, {
          url: item.data.url, mode, maxHtmlCharacters: 8_000_000, maxElements: 100_000, maxDepth: 150, maxBlocks: largePages ? 5000 : 500,
          classifier: async (input, runtime) => { regions = buildJevPlan(input, jevOptions).regions; return classifier(input, runtime); },
        });
        text = result.text;
        consecutiveErrors = 0;
      }
    } catch (caught) {
      if (status !== 'not_run') status = 'error';
      const message = caught instanceof Error ? `${caught.name}: ${caught.message}` : 'UnknownError';
      error = message.replaceAll(process.env.TYPESAFE_API_KEY || '\u0000', '[redacted]').replace(/[\r\n]/g, ' ').slice(0, 300);
      text = '';
      if (variant && status === 'error') {
        consecutiveErrors++;
        if (['BudgetError', 'ModelMismatchError'].includes(caught?.name) || [401, 402, 403, 404, 422].includes(caught?.status) || consecutiveErrors >= 3) circuit = 'JEV circuit stopped after fatal error/budget or three consecutive failures';
      }
    } finally { dom?.window.close(); }
    const after = meter.snapshot(engine);
    rows.push({ id: item.id, type: item.type, engine, variant, mode, status, error, regions, elapsedMs: Number((performance.now() - started).toFixed(1)),
      emptyReference: item.emptyReference, word: wordScore(text, item.reference), anchor: anchorScore(text, item.data.ground_truth),
      outputCharacters: text.length, outputHash: sha(text), stats: result?.stats || null, warnings: result?.warnings || [], usage: result?.usage || null,
      attempts: after.requests - before.requests, knownInputTokens: after.knownInputTokens - before.knownInputTokens, knownOutputTokens: after.knownOutputTokens - before.knownOutputTokens,
      responsesMissingInputUsage: after.responsesMissingInputUsage - before.responsesMissingInputUsage, responsesMissingOutputUsage: after.responsesMissingOutputUsage - before.responsesMissingOutputUsage });
  }
  await checkpoint();
  console.log(`[${index + 1}/${selected.length}] ${item.id}: ` + rows.slice(-engines.length).map(r => `${r.engine}=${r.status}`).join(' '));
}
for (const engine of engines) {
  const er = rows.filter(r => r.engine === engine);
  report.summaries[engine] = { overall: aggregate(er), nonEmptyReference: aggregate(er.filter(r => !r.emptyReference)), byType: Object.fromEntries(TYPES.map(t => [t, aggregate(er.filter(r => r.type === t))])) };
}
if (!rows.some(r => r.status === 'not_run')) {
  for (const e of engines.slice(1)) report.paired.push(pairedBootstrap(rows, e, 'mozilla-readability'));
  if (variants.length === 2) report.paired.push(pairedBootstrap(rows, 'jev-generic', 'jev-api'));
}
report.status = rows.some(r => r.status === 'not_run') ? 'incomplete' : rows.some(r => r.status === 'error') ? 'completed_with_errors' : 'completed';
report.finishedAt = new Date().toISOString();
await checkpoint();
console.log('WCXB_SUMMARY:' + JSON.stringify({ status: report.status, dataset: report.dataset, usage: report.usage, summaries: report.summaries, paired: report.paired }));
if (rows.some(r => r.status !== 'ok')) process.exitCode = 1;
