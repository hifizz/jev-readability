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

> **Experimental v0.1.** Independent community project, not an official Mozilla or TypeSafe product. A 140-page external WCXB evaluation is published below; results should not be generalized beyond the tested corpus.

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
| Tradeoffs | No inference bill; mature Firefox integration | Extra network/model cost, sampling and batching; quality varies by page type |
| HTML safety | Use a separate sanitizer at display time | Narrow reconstruction allowlist; still use a sanitizer/CSP at display time |

Readability can also succeed on non-article pages; this is not a claim that it cannot handle documentation, forums, or products. The five JEV modes express intent, not five independently validated quality guarantees. Neither library replaces fetching or browser rendering.

Sources: [Mozilla Readability API and security notes](https://github.com/mozilla/readability#readme) · [TypeSafe typed-decision API](https://docs.typesafe.ai/api). Our behavior is defined by [the source](./src) and [extraction spec](./openspec/specs/extraction/spec.md).

**Practical choice:** start with Readability for an offline article reader. Evaluate this library when you need configurable content-selection criteria, block-level decisions, or direct Markdown output—and measure the real JEV tradeoffs on your own pages first.

## Evaluation

### WCXB: 140 real-world pages across 7 page types

We ran the authenticated JEV pipeline on a **fixed balanced subset of 140 pages** from the public WCXB v1.0 test split: 20 each of article, documentation, forum, product, service, listing, and collection pages. The upstream dataset commit and sampling seed are pinned, so this run is reproducible.

| Engine | Word precision | Word recall | Word F1 | Anchor F1 | Errors |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mozilla Readability `0.6.0` | **80.62%** | 74.01% | 72.68% | 79.13% | 0 / 140 |
| **JEV API (`jev-1.13.0`)** | 72.98% | **94.99%** | **79.97%** | **92.93%** | 1 / 140 |

JEV is much more recall-oriented in this run: it retains substantially more ground-truth content, at the cost of extra non-reference text. Readability remains stronger on precision and on the article-only subset.

| Page type | Readability Word F1 | JEV Word F1 |
| --- | ---: | ---: |
| Article | **97.12%** | 95.03% |
| Documentation | 86.44% | **93.98%** |
| Forum | 62.16% | **77.11%** |
| Product | 62.23% | **69.56%** |
| Service | **78.79%** | 78.53% |
| Listing | 60.28% | **77.41%** |
| Collection | 61.77% | **67.56%** |

One JEV page failed because it produced more than the current **500-block safety limit**; that failure remains in the denominator. The live run made **888 TypeSafe requests**. Complete token usage was returned for 136 pages: at least **10.76M input + 1.69M output tokens** were reported; 3 successful pages omitted usage, so the true total is higher and is not estimated.

**Fairness caveat:** JEV receives the WCXB page type through this library's mode mapping; Readability receives no task-type hint. WCXB labels are public, so this is an external reproducible benchmark rather than a secret blind test.

[WCXB methodology and full tables](./docs/WCXB_BENCHMARK.md) · [Machine-readable summary](./docs/benchmarks/wcxb-summary.json) · [GitHub Actions run](https://github.com/hifizz/jev-readability/actions/runs/35464162174) · [WCXB dataset](https://github.com/Murrough-Foley/web-content-extraction-benchmark)

### Synthetic smoke test

The earlier 8-page synthetic suite remains useful for fast regression testing, but it is not representative of the web. See [the synthetic benchmark report](./docs/BENCHMARK.md).

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
