<p align="center">
  <img src="https://raw.githubusercontent.com/hifizz/jev-readability/main/docs/assets/banner.svg" alt="jev-readability — Find the content. Keep the original." width="100%" />
</p>

<p align="center"><strong>English</strong> · <a href="https://github.com/hifizz/jev-readability/blob/main/README.zh-CN.md">简体中文</a></p>

# jev-readability

**Extract the source. Let JEV decide what belongs.**

A DOM-first TypeScript library for reader views, RAG pipelines, and AI agents. Split HTML into non-overlapping blocks, classify them with TypeSafe JEV, and reconstruct **text, HTML, and Markdown from the original content**. The model selects content; it does not write the article.

[![CI](https://github.com/hifizz/jev-readability/actions/workflows/ci.yml/badge.svg)](https://github.com/hifizz/jev-readability/actions/workflows/ci.yml)
[![Baseline](https://github.com/hifizz/jev-readability/actions/workflows/benchmark.yml/badge.svg)](https://github.com/hifizz/jev-readability/actions/workflows/benchmark.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-315846)](./LICENSE)

[Quick start](#quick-start) · [Readability comparison](#comparison-with-mozilla-readability) · [Evaluation](#evaluation) · [Browser API](#browser-and-extension-api)

> **Experimental v0.1.** Independent community project, not an official Mozilla or TypeSafe product. The JEV client and offline extraction pipeline are implemented; a real JEV quality, latency, and cost evaluation is still pending. No claim of superiority over Readability is made.

## Quick start

### Try the local demo — no key required

Requires **Node.js 22+**, npm, and Git. The demo interface is currently Chinese; the documentation has English and Chinese editions.

```bash
git clone https://github.com/hifizz/jev-readability.git
cd jev-readability
npm install
npm run demo
```

Open `http://127.0.0.1:4317`. Load a fixture, paste HTML, or open a local HTML file. Inspect extracted content, Markdown, HTML, JSON, block decisions, and request statistics.

The default **local heuristic** mode is offline and makes no model calls. It is a development baseline, **not free JEV inference**.

To use JEV, copy `.env.example` to `.env`, set `TYPESAFE_API_KEY`, restart the demo, and select **JEV · 真实 API**. The server keeps the key; sampled candidate content is sent to TypeSafe and may incur charges. Failures are reported rather than silently relabeled as successful model results.

### Install in your project

Until the first authenticated npm registry release, install from GitHub:

```bash
npm install github:hifizz/jev-readability linkedom
```

After a registry release is confirmed, the package-name command is `npm install jev-readability linkedom`. See the [publishing guide](https://github.com/hifizz/jev-readability/blob/main/docs/PUBLISHING.md). A local `.tgz` or passing CI is not proof of npm publication.

The package is ESM with TypeScript declarations. `linkedom` is required by the Node HTML-string entry point, but not by the browser core. GitHub installs compile through `prepare`; do not disable lifecycle scripts for that installation path.

```js
import { readFile } from 'node:fs/promises';
import { extract } from 'jev-readability/node';

const html = await readFile('./page.html', 'utf8');
const result = await extract(html, {
  url: 'https://example.org/article',
  mode: 'article',
  apiKey: process.env.TYPESAFE_API_KEY,
});

console.log(result.markdown);
console.log(result.usage);
```

Save as `extract.mjs`, configure `.env`, and run `node --env-file=.env extract.mjs`. For an offline run, replace the options with `{ strategy: 'heuristic' }`; model probabilities remain `null`.

## Comparison with Mozilla Readability

Both approaches **extract existing content rather than generate new prose**. The difference is the selection mechanism and the information exposed to the caller—not a demonstrated quality advantage.

| Dimension | Mozilla Readability | jev-readability v0.1 |
| --- | --- | --- |
| Selection | Local DOM/text heuristics | DOM partitioning + JEV block decisions; optional local baseline |
| Primary workflow | Article extraction for reader view | Configurable `article`, `documentation`, `forum`, `product`, `agent` criteria |
| Execution | Local; no model API required | JEV mode needs a backend, API key, and network; heuristic mode is offline |
| Output | Article HTML/text and metadata | Text/HTML/Markdown, metadata, per-block keep/role decisions |
| Inspectability | Options and debug logging | Original blocks, probabilities, `needsReview`, usage and warnings |
| Metadata | Includes JSON-LD support | Basic HTML/meta fields; not equivalent metadata coverage |
| Tradeoffs | No inference bill; mature Firefox integration | Extra network/model cost, sampling and batching; model quality unverified |
| HTML safety | Use a separate sanitizer at display time | Narrow reconstruction allowlist; still use a sanitizer/CSP at display time |

Readability can also succeed on non-article pages; this is not a claim that it cannot handle documentation, forums, or products. The five JEV modes express intent, not five independently validated quality guarantees. Neither library replaces fetching or browser rendering.

Sources: [Mozilla Readability API and security notes](https://github.com/mozilla/readability#readme) · [TypeSafe typed-decision API](https://docs.typesafe.ai/api). Our behavior is defined by [the source](./src) and [extraction spec](./openspec/specs/extraction/spec.md).

**Practical choice:** start with Readability for an offline article reader. Evaluate this library when you need configurable content-selection criteria, block-level decisions, or direct Markdown output—and measure the real JEV tradeoffs on your own pages first.

## Evaluation

### Synthetic baseline smoke test — not a JEV model benchmark

Executed on **8 original synthetic pages**: 7 English, 1 Chinese; 27 positive and 21 negative text anchors. Both implementations used fresh `jsdom@26.1.0` documents; Readability used default settings. These are development fixtures, not a representative or held-out web dataset.

| Engine actually evaluated | Anchor precision | Anchor recall | Anchor F1 | Pages with all anchors correct |
| --- | ---: | ---: | ---: | ---: |
| Mozilla Readability `0.6.0` | 92.86% | 96.30% | 94.55% | 6 / 8 |
| This library: **local rules, NOT JEV** | 92.31% | 88.89% | 90.57% | 6 / 8 |
| **JEV API** | Not measured | Not measured | Not measured | Not run |

These micro-averaged scores measure selected labeled text spans, **not full-document accuracy**. Readability missed a documentation warning; our local rules missed the short unmarked body; both retained an unmarked promotional paragraph. We report all cases, including regressions, and did not tune extraction rules to improve this table.

[Full report and methodology](https://github.com/hifizz/jev-readability/blob/main/docs/BENCHMARK.md) · [Machine-readable summary](https://github.com/hifizz/jev-readability/blob/main/docs/benchmarks/baseline-summary.json) · [CI run and raw output](https://github.com/hifizz/jev-readability/actions/runs/35461669054) · [Corpus](./benchmark/corpus.mjs)

```bash
npm install
npm --prefix benchmark install --ignore-scripts
node benchmark/run.mjs
```

The runner saves per-page output, missing/leaked anchors, source hashes, versions, and diagnostic timings to `docs/benchmarks/baseline-run.json`. These single-pass timings are **not** a speed benchmark. A separately authenticated `--jev` run is documented in the report; no key is used by baseline CI.

### Engineering checks

TypeScript checks, protocol/package tests, Node/linkedom extraction, and packaging passed on **Node 22 and 24** in [CI](https://github.com/hifizz/jev-readability/actions/runs/35461669053). Historical Chromium results cover 32 DOM checks and 8 UI checks, but are not newly rerun results or real JEV end-to-end evidence. See [test scope and limitations](https://github.com/hifizz/jev-readability/blob/main/docs/TEST_REPORT.md).

## How it works

```text
HTML / rendered Document
  → clean and partition the DOM
  → batch keep/drop and role questions to JEV
  → validate typed decisions
  → reconstruct original text / HTML / Markdown
```

Short headings, code, lists, quotes, tables, and image captions remain candidate content. The pipeline supports bounded batches/concurrency/retries, cancellation, request limits, and explicit uncertainty handling. By default, uncertain blocks are kept and flagged; a classifier failure throws. Set `fallback: 'heuristic'` only when you deliberately want a labeled fallback.

JEV uses TypeSafe's native `state + questions` API, not Chat Completions. Its `noul` value is a model probability, not a calibrated guarantee of extraction correctness. `prepare()` → custom `Classifier` → `finalize()` lets you swap the decision layer without replacing DOM processing.

## Browser and extension API

```ts
import { extract, createRemoteClassifier } from 'jev-readability';

const result = await extract(document, {
  mode: 'documentation',
  classifier: createRemoteClassifier({
    endpoint: '/api/classify-content',
    headers: { 'X-CSRF-Token': csrfToken },
  }),
});
```

`extract(document)` clones the DOM instead of mutating the page. Supply `csrfToken` from your application's authentication flow. **Never embed a TypeSafe key in browser code.** Your backend handles authentication, quotas, and `createJevClassifier`; [the demo server](./examples/server.mjs) is loopback-only, not a production multi-tenant API.

## CLI and configuration

```bash
# After installing this package and linkedom; no model calls
npx --no-install jev-readability page.html --heuristic

# Real JEV: set TYPESAFE_API_KEY in your shell first
npx --no-install jev-readability page.html --mode documentation --out result.md
```

The CLI reads **local HTML files**, not remote URLs. `--url` supplies metadata and resolves relative links. Output formats are `markdown`, `text`, `html`, and `json`.

Node results include `title`, `metadata`, `text`, `html`, `markdown`, `method`, `blocks`, `warnings`, `usage`, and `stats`. Defaults limit HTML to 2,000,000 characters and 500 blocks; oversized input fails rather than silently dropping content. Long-block sampling preserves full source in output but may miss information during classification.

[Full configuration guide (中文)](https://github.com/hifizz/jev-readability/blob/main/docs/GUIDE.md) · [Type definitions](./src/types.ts) · [JEV options](./src/jev.ts)

## Limitations and safety

This is not a crawler, browser renderer, general sanitizer, or paywall bypass. It does not expand Shadow DOM/iframes or infer external-CSS visibility. Provide rendered DOM for SPAs.

Candidate text may contain private information; obtain authorization before sending it to TypeSafe. Prompt-injection defenses are limited. Apply a sanitizer, CSP, and an external-image policy before rendering output. Debug `blocks` include rejected source text; usually pass only `text` or `markdown` to downstream agents.

## Development and contribution

```bash
npm install
npm run check
npm test
npm run test:node
npm pack --dry-run
```

Browser checks require Playwright and a running demo; see the test report. Contribute sanitized, legally shareable page fixtures and independent gold labels through [Issues](https://github.com/hifizz/jev-readability/issues) or a PR. Real-page evaluation, authenticated JEV comparison, and measured latency/cost are the next validation milestones—not completed features.

## License

[MIT](./LICENSE). Mozilla Readability and TypeSafe JEV are referenced descriptively; no affiliation or endorsement is implied.
