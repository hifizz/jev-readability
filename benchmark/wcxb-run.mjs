import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { createHash } from 'node:crypto';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { join } from 'node:path';
import { extract } from '../dist/index.js';
import { createJevClassifier } from '../dist/jev.js';

const argv = process.argv.slice(2);
const getArg = (name, fallback = null) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : fallback;
};
const live = argv.includes('--jev');
const datasetDir = getArg('--dataset', 'wcxb/test');
const perType = Number(getArg('--per-type', '20'));
const seed = getArg('--seed', 'jev-readability-wcxb-v0.2');
if (!Number.isSafeInteger(perType) || perType < 1 || perType > 25) throw new Error('--per-type must be an integer from 1 to 25');
if (live && !process.env.TYPESAFE_API_KEY) throw new Error('--jev requires TYPESAFE_API_KEY');
const model = process.env.JEV_MODEL || 'jev-latest';

const TYPES = ['article', 'documentation', 'forum', 'product', 'service', 'listing', 'collection'];
const MODE = {
  article: 'article',
  documentation: 'documentation',
  forum: 'forum',
  product: 'product',
  service: 'agent',
  listing: 'agent',
  collection: 'agent',
};

const hash = value => createHash('sha256').update(value).digest('hex');
const tokenize = text => (text.toLocaleLowerCase().match(/[\p{L}\p{N}_]+/gu) || []);
function multiset(tokens) {
  const map = new Map();
  for (const t of tokens) map.set(t, (map.get(t) || 0) + 1);
  return map;
}
function wordScore(predicted, reference) {
  const p = multiset(tokenize(predicted));
  const r = multiset(tokenize(reference));
  const pN = [...p.values()].reduce((a, b) => a + b, 0);
  const rN = [...r.values()].reduce((a, b) => a + b, 0);
  if (!rN) return { precision: pN ? 0 : 1, recall: 1, f1: pN ? 0 : 1, overlap: 0, predictedWords: pN, referenceWords: rN };
  if (!pN) return { precision: 0, recall: 0, f1: 0, overlap: 0, predictedWords: 0, referenceWords: rN };
  let overlap = 0;
  for (const [word, count] of p) overlap += Math.min(count, r.get(word) || 0);
  const precision = overlap / pN;
  const recall = overlap / rN;
  const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1, overlap, predictedWords: pN, referenceWords: rN };
}
const normalize = value => String(value || '').normalize('NFKC').replace(/\s+/gu, '');
function anchorScore(predicted, gt) {
  const out = normalize(predicted);
  const withList = Array.isArray(gt.with) ? gt.with : [];
  const withoutList = Array.isArray(gt.without) ? gt.without : [];
  const includes = s => out.includes(normalize(s));
  const tp = withList.filter(includes).length;
  const fn = withList.length - tp;
  const fp = withoutList.filter(includes).length;
  const precision = tp + fp ? tp / (tp + fp) : null;
  const recall = tp + fn ? tp / (tp + fn) : null;
  const f1 = precision != null && recall != null && precision + recall ? 2 * precision * recall / (precision + recall) : 0;
  return { tp, fp, fn, precision, recall, f1, perfect: fn === 0 && fp === 0 };
}
function average(rows, path) {
  const vals = rows.map(r => path(r)).filter(Number.isFinite);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}
function aggregate(rows) {
  const ok = rows.filter(r => r.status === 'ok');
  let aTp = 0, aFp = 0, aFn = 0;
  for (const row of rows) {
    aTp += row.anchor?.tp || 0; aFp += row.anchor?.fp || 0; aFn += row.anchor?.fn || 0;
  }
  const ap = aTp + aFp ? aTp / (aTp + aFp) : null;
  const ar = aTp + aFn ? aTp / (aTp + aFn) : null;
  const af = ap != null && ar != null && ap + ar ? 2 * ap * ar / (ap + ar) : 0;
  return {
    pages: rows.length,
    completed: ok.length,
    errors: rows.length - ok.length,
    meanWordPrecision: average(ok, r => r.word.precision),
    meanWordRecall: average(ok, r => r.word.recall),
    meanWordF1: average(ok, r => r.word.f1),
    anchorPrecision: ap,
    anchorRecall: ar,
    anchorF1: af,
    perfectAnchors: rows.filter(r => r.status === 'ok' && r.anchor.perfect).length,
    meanElapsedMs: average(ok, r => r.elapsedMs),
  };
}

const gtDir = join(datasetDir, 'ground-truth');
const htmlDir = join(datasetDir, 'html');
const files = (await readdir(gtDir)).filter(f => f.endsWith('.json')).sort();
const records = [];
for (const file of files) {
  const data = JSON.parse(await readFile(join(gtDir, file), 'utf8'));
  const type = data?._internal?.page_type?.primary;
  if (!TYPES.includes(type)) continue;
  records.push({ file, id: String(data.file_id || file.replace(/\.json$/, '')), type, data });
}
const selected = [];
for (const type of TYPES) {
  const pool = records.filter(r => r.type === type)
    .map(r => ({ ...r, rank: hash(seed + ':' + type + ':' + r.id) }))
    .sort((a, b) => a.rank.localeCompare(b.rank));
  if (pool.length < perType) throw new Error(`WCXB test split has only ${pool.length} ${type} pages; requested ${perType}`);
  selected.push(...pool.slice(0, perType));
}

const classifier = live ? createJevClassifier({
  apiKey: process.env.TYPESAFE_API_KEY,
  model,
  concurrency: 2,
  maxRequests: 64,
  timeoutMs: 30_000,
  totalTimeoutMs: 120_000,
  maxRetries: 2,
}) : null;
const engines = ['mozilla-readability', ...(live ? ['jev-api'] : [])];
const rows = [];
let index = 0;
for (const item of selected) {
  index++;
  const gt = item.data.ground_truth || {};
  const htmlPath = join(htmlDir, item.id + '.html.gz');
  const html = gunzipSync(await readFile(htmlPath)).toString('utf8');
  for (const engine of engines) {
    const started = performance.now();
    let text = '', result = null, status = 'ok', error = null;
    const dom = new JSDOM(html, { url: item.data.url || 'https://example.invalid/' + item.id });
    try {
      if (engine === 'mozilla-readability') {
        text = new Readability(dom.window.document).parse()?.textContent || '';
      } else {
        result = await extract(dom.window.document, {
          url: item.data.url || undefined,
          mode: MODE[item.type],
          classifier,
          maxHtmlCharacters: 8_000_000,
          maxElements: 100_000,
          maxBlocks: 500,
          maxDepth: 150,
        });
        text = result.text;
      }
    } catch (caught) {
      status = 'error';
      error = caught instanceof Error ? `${caught.name}: ${caught.message}` : String(caught);
      text = '';
    } finally {
      dom.window.close();
    }
    const elapsedMs = Number((performance.now() - started).toFixed(1));
    const row = {
      id: item.id,
      type: item.type,
      mode: engine === 'jev-api' ? MODE[item.type] : null,
      url: item.data.url || null,
      engine,
      status,
      error,
      elapsedMs,
      word: wordScore(text, gt.main_content || ''),
      anchor: anchorScore(text, gt),
      outputCharacters: text.length,
      usage: result?.usage || (engine === 'mozilla-readability' ? { requests: 0, inputTokens: null, outputTokens: null } : null),
    };
    rows.push(row);
  }
  console.log(`[${index}/${selected.length}] ${item.id} ${item.type} done`);
}

const summaries = {};
for (const engine of engines) {
  const engineRows = rows.filter(r => r.engine === engine);
  summaries[engine] = {
    overall: aggregate(engineRows),
    byType: Object.fromEntries(TYPES.map(type => [type, aggregate(engineRows.filter(r => r.type === type))])),
  };
}
const usageRows = rows.filter(r => r.engine === 'jev-api' && r.usage);
const usage = {
  requests: usageRows.reduce((n, r) => n + Number(r.usage.requests || 0), 0),
  inputTokens: usageRows.every(r => r.usage.inputTokens != null) ? usageRows.reduce((n, r) => n + Number(r.usage.inputTokens), 0) : null,
  outputTokens: usageRows.every(r => r.usage.outputTokens != null) ? usageRows.reduce((n, r) => n + Number(r.usage.outputTokens), 0) : null,
  requestBytes: usageRows.reduce((n, r) => n + Number(r.usage.requestBytes || 0), 0),
  models: [...new Set(usageRows.flatMap(r => r.usage.models || []))],
};

const report = {
  schemaVersion: 2,
  generatedAt: new Date().toISOString(),
  sourceCommit: process.env.GITHUB_SHA || null,
  runUrl: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  dataset: {
    name: 'WCXB v1.0',
    repository: 'Murrough-Foley/web-content-extraction-benchmark',
    commit: 'c039d5ee9f5a3a984a0e167e63aacd04e76e78a9',
    split: 'test',
    availablePages: 511,
    selectedPages: selected.length,
    perType,
    seed,
    types: TYPES,
    selection: 'SHA-256 rank within each page type; first N per type',
  },
  evaluation: {
    wordMetric: 'macro mean per-page bag-of-words precision/recall/F1 against ground_truth.main_content',
    anchorMetric: 'micro with/without anchor precision/recall/F1',
    readability: '@mozilla/readability 0.6.0 defaults',
    jev: live ? { status: 'executed', requestedModel: model, modeMapping: MODE } : { status: 'not_run' },
    caveats: [
      'WCXB test labels are public; this is a reproducible external benchmark, not a secret blind test.',
      'JEV receives the WCXB page type through a deterministic mode mapping; Readability has no task-mode input.',
      'service/listing/collection map to the generic agent mode because v0.1 has no dedicated modes.',
      'Failures remain in the denominator with zero text scores.',
    ],
  },
  usage,
  summaries,
  selected: selected.map(x => ({ id: x.id, type: x.type, url: x.data.url || null })),
  rows,
};

await mkdir('docs/benchmarks', { recursive: true });
const out = live ? 'docs/benchmarks/wcxb-jev-run.json' : 'docs/benchmarks/wcxb-readability-run.json';
await writeFile(out, JSON.stringify(report, null, 2) + '\n');
console.log('WCXB_SUMMARY:' + JSON.stringify({ dataset: report.dataset, usage, summaries }));
