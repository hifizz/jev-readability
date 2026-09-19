import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { platform, arch, cpus } from 'node:os';
import { extract } from '../dist/index.js';
import { createJevClassifier } from '../dist/jev.js';
import { cases } from './corpus.mjs';
import { normalize, score, aggregate } from './metrics.mjs';

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--jev')) throw new Error('Usage: node benchmark/run.mjs [--jev]');
const live = args.includes('--jev');
if (live && (!process.env.TYPESAFE_API_KEY || !process.env.JEV_MODEL)) {
  throw new Error('--jev requires TYPESAFE_API_KEY and an explicit JEV_MODEL. Model calls may incur charges.');
}
let commit = process.env.GITHUB_SHA || 'unknown';
try { commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch {}
const sha256 = text => createHash('sha256').update(text).digest('hex');
const sourceFiles = ['src/dom.ts', 'src/render.ts', 'src/index.ts', 'src/heuristic.ts', 'src/jev.ts', 'src/types.ts', 'benchmark/run.mjs', 'benchmark/metrics.mjs', 'benchmark/corpus.mjs'];
const sourceHashes = Object.fromEntries(await Promise.all(sourceFiles.map(async file => [file, sha256(await readFile(new URL('../' + file, import.meta.url)))])));
const classifier = live ? createJevClassifier({ apiKey: process.env.TYPESAFE_API_KEY, model: process.env.JEV_MODEL, maxRequests: 32, concurrency: 1 }) : null;
const engines = ['mozilla-readability', 'jev-local-heuristic', ...(live ? ['jev-api'] : [])];
const rows = [];
for (const example of cases) {
  // Verify labels refer to input text. Never send gold labels to either extractor.
  const check = new JSDOM(example.html);
  const inputText = normalize(check.window.document.body.textContent || '');
  for (const anchor of [...example.keep, ...example.drop]) {
    if (!inputText.includes(normalize(anchor))) throw new Error(`Invalid gold anchor: ${example.id}`);
  }
  check.window.close();
  for (const engine of engines) {
    // Same fresh parser for both implementations; scripts/resources are disabled.
    const start = performance.now();
    const dom = new JSDOM(example.html, { url: 'https://example.org/' + example.id });
    let result, text, status = 'ok', error = null;
    try {
      if (engine === 'mozilla-readability') {
        result = new Readability(dom.window.document).parse(); // default options
        text = result?.textContent || '';
      } else {
        result = await extract(dom.window.document, {
          mode: example.mode,
          ...(engine === 'jev-local-heuristic' ? { strategy: 'heuristic' } : { classifier }),
        });
        text = result.text;
      }
    } catch (caught) {
      // A failed extraction counts as missing all positive anchors, not as a skipped success.
      status = 'error'; text = ''; error = caught instanceof Error ? caught.name : 'Error';
    }
    const elapsedMs = Number((performance.now() - start).toFixed(3));
    dom.window.close();
    rows.push({
      case: example.id, mode: example.mode, language: example.language, engine,
      status, error, empty: !text.trim(), elapsedMs,
      metrics: score(text, example), text,
      usage: engine === 'mozilla-readability' ? { requests: 0, inputTokens: null, outputTokens: null } : result?.usage ?? null,
    });
  }
}
const report = {
  schemaVersion: 1, generatedAt: new Date().toISOString(), sourceCommit: commit,
  runUrl: process.env.GITHUB_RUN_ID ? `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null,
  environment: { node: process.version, platform: platform(), arch: arch(), cpu: cpus()[0]?.model || 'unknown' },
  versions: { readability: require('@mozilla/readability/package.json').version, jsdom: require('jsdom/package.json').version },
  sourceHashes, corpusHash: sha256(JSON.stringify(cases)),
  corpus: { pages: cases.length, positiveAnchors: cases.reduce((n, c) => n + c.keep.length, 0), negativeAnchors: cases.reduce((n, c) => n + c.drop.length, 0), kind: 'original synthetic development fixtures; not representative or held-out' },
  methodology: { metric: 'micro-averaged labeled text-anchor precision/recall/F1; not token or whole-document accuracy', normalization: 'NFKC, remove whitespace, case-sensitive substring match', readabilityOptions: 'defaults', modes: 'task-specific on JEV side; Readability is article-oriented', timing: 'single pass including DOM parse; diagnostic only, not a speed benchmark', titles: 'not scored', errors: 'count as empty output and missing all positive anchors', selection: 'all 8 cases reported, including failures; no model or rule tuning after this run' },
  jev: live ? { status: 'executed', requestedModel: process.env.JEV_MODEL, billedCost: null } : { status: 'not_run', reason: 'No authenticated JEV evaluation requested; offline rules are not JEV predictions.', accuracy: null, latency: null, billedCost: null },
  summary: Object.fromEntries(engines.map(engine => [engine, aggregate(rows.filter(row => row.engine === engine))])),
  rows,
};
const out = new URL('../docs/benchmarks/', import.meta.url);
await mkdir(out, { recursive: true });
const filename = live ? 'jev-run.json' : 'baseline-run.json';
await writeFile(new URL(filename, out), JSON.stringify(report, null, 2) + '\n');
console.log('BENCHMARK_JSON:' + JSON.stringify(report));
if (rows.some(row => row.status === 'error')) process.exitCode = 1;
