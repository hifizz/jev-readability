<p align="center">
  <img src="https://raw.githubusercontent.com/hifizz/jev-readability/main/docs/assets/banner.svg" alt="jev-readability — Find the content. Keep the original." width="100%" />
</p>

<p align="center"><strong>English</strong> · <a href="https://github.com/hifizz/jev-readability/blob/main/README.zh-CN.md">简体中文</a></p>

# jev-readability

**Read webpages like an agent, not a reader.**

A **semantic content extractor for AI agents**. Mozilla Readability is optimized for turning articles into clean reader views; jev-readability is optimized for **not missing information an agent may need** across documentation, forums, products, listings and long pages. It partitions the DOM, lets TypeSafe JEV decide what belongs, and reconstructs **Markdown, text and HTML from the original source** — the model selects content, it does not rewrite it.

[![CI](https://github.com/hifizz/jev-readability/actions/workflows/ci.yml/badge.svg)](https://github.com/hifizz/jev-readability/actions/workflows/ci.yml)
[![Baseline](https://github.com/hifizz/jev-readability/actions/workflows/benchmark.yml/badge.svg)](https://github.com/hifizz/jev-readability/actions/workflows/benchmark.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-315846)](./LICENSE)

[Benchmark](#benchmark-at-a-glance) · [Quick start](#quick-start) · [Readability migration](#for-mozilla-readability-users) · [Full evaluation](#evaluation) · [Large pages](#large-pages)

> **Experimental development version.** Independent community project, not an official Mozilla or TypeSafe product. The latest 140-page WCXB comparison includes real JEV calls and a recorded timeout. Results are specific to this public, previously examined cohort; they are not universal accuracy guarantees.

## Benchmark at a glance

**140 real-world WCXB pages · 7 page types · real JEV API calls**

| Engine | Word precision | Word recall | Word F1 | Anchor F1 |
| --- | ---: | ---: | ---: | ---: |
| Mozilla Readability `0.6.0` | **80.62%** | 74.01% | 72.68% | 79.13% |
| JEV Typed | 72.86% | **94.93%** | 79.90% | 92.99% |
| **JEV Generic `agent`** | 74.08% | 94.76% | **80.64%** | **93.01%** |

**How to read this:** Readability is more precise and remains excellent on article pages. JEV is much more recall-oriented: it keeps more of the information that appears in the benchmark ground truth, which is useful when missing a warning, forum reply, spec table, code block or listing item is more costly than retaining a little extra text.

The Generic JEV run receives **no supplied page-type label**; every page uses the same `agent` mode. On this fixed cohort, Generic JEV's Word F1 is **+7.95 percentage points** over Readability. A paired, page-type-stratified bootstrap gives a 95% interval of **+3.49 to +12.50 pp** for that observed difference.

This is **not** a claim that JEV is universally better. The dataset is public and previously inspected, page types are equally weighted rather than web-prevalence weighted, one Typed run timed out, and model/API cost and latency are materially higher than local Readability. Article-only pages still favor Readability in this run: **97.12% vs 94.92% Word F1**.

[Read the full benchmark report](./docs/WCXB_BENCHMARK.md) · [140 per-page scores](./docs/benchmarks/wcxb-ablation-pages.tsv) · [Summary JSON](./docs/benchmarks/wcxb-ablation-summary.json) · [GitHub Actions run](https://github.com/hifizz/jev-readability/actions/runs/35465401579)

## Quick start

### Try the local demo — no key required

Requires **Node.js 22+**, npm and Git. The demo interface is currently Chinese; documentation is available in English and Chinese.

```bash
git clone https://github.com/hifizz/jev-readability.git
cd jev-readability
npm install
npm run demo
```

Open `http://127.0.0.1:4317`. Load a fixture, paste HTML or open a local HTML file. Inspect extracted content, Markdown, HTML, JSON, block decisions and request statistics.

The default **local heuristic** is offline and makes no model calls. It is a development baseline, **not free JEV inference**. For real JEV, copy `.env.example` to `.env`, set `TYPESAFE_API_KEY`, restart and select **JEV · 真实 API**. The key stays on the server; candidate content is sent to TypeSafe and may incur charges. Failures are explicit, not silently relabeled as successful model results.

### Install in your project

Install the current development code from GitHub:

```bash
npm install github:hifizz/jev-readability linkedom
```

The package is ESM with TypeScript declarations. `linkedom` is required by the Node HTML-string entry point, not by the browser core. GitHub installs compile through `prepare`; do not disable lifecycle scripts for this path. Registry release instructions are in the [publishing guide](https://github.com/hifizz/jev-readability/blob/main/docs/PUBLISHING.md); these benchmark commits do not themselves publish an npm version.

```js
import { readFile } from 'node:fs/promises';
import { extract } from 'jev-readability/node';

const html = await readFile('./page.html', 'utf8');
const result = await extract(html, {
  url: 'https://example.org/page',
  mode: 'agent',
  apiKey: process.env.TYPESAFE_API_KEY,
});

console.log(result.markdown);
console.log(result.usage);
```

Save as `extract.mjs`, configure `.env` and run `node --env-file=.env extract.mjs`. Use `{ strategy: 'heuristic' }` for an offline baseline; its model probabilities remain `null`.

The modes are `article`, `documentation`, `forum`, `product` and `agent`. Use `agent` when no page-type hint is available. The default library mode remains `article`; the example's explicit mode does not change that default.

## For Mozilla Readability users

If you already use `@mozilla/readability`, the easiest mental model is:

> **Keep your browser/fetch layer. Replace the article-only selection step with an agent-oriented semantic selection step.**

Readability is still an excellent default for clean article reading. jev-readability is aimed at the cases where "main article" is too narrow: API docs, forum answers, product specifications, listings, collections, warnings, code blocks and other information an agent may need.

### Before: Readability

```js
import { Readability } from '@mozilla/readability';

const article = new Readability(document.cloneNode(true)).parse();
console.log(article.textContent);
```

### After: jev-readability

```js
import { extract } from 'jev-readability';

const page = await extract(document, {
  mode: 'agent',
  classifier,
});

console.log(page.markdown);
```

The surrounding architecture can stay the same:

```text
fetch / Playwright / browser
        ↓
     rendered DOM
        ↓
Readability.parse()        → clean article
        or
jev-readability.extract()  → agent-ready semantic Markdown
```

**Use Readability when:** you want a local, zero-inference-cost article reader with high precision.

**Try jev-readability when:** missing a warning, reply, spec table, code example, product field or listing item is more costly than retaining a little extra text.

Migration is incremental: run both extractors side-by-side, compare their output on your own pages, then route article-only workloads to Readability and agent ingestion workloads to jev-readability.

## Comparison with Mozilla Readability

Both approaches extract existing content rather than generate prose. Selection policy and operational tradeoffs differ; neither is universally better.

| Dimension | Mozilla Readability | jev-readability |
| --- | --- | --- |
| Selection | Local DOM/text heuristics | DOM partitioning + JEV block decisions; optional local baseline |
| Main workflow | Article extraction for reader view | Five content-selection criteria, including a generic agent mode |
| Execution | Local, no model API | JEV requires an API key/network; heuristic mode stays local |
| Output | Article HTML/text and metadata | Text/HTML/Markdown, metadata, block keep/role decisions |
| Inspection | Options and debug logging | Original blocks, probabilities, `needsReview`, usage and warnings |
| Metadata | Includes JSON-LD support | Basic HTML/meta fields; not equivalent coverage |
| Tradeoffs | No inference bill; Firefox integration | Extra latency/cost; higher recall but lower overall precision in the measured cohort |
| HTML safety | Separate sanitizer at display time | Narrow reconstruction allowlist; still use sanitizer/CSP at display time |

Readability can succeed on documentation, forums and product pages too; it is not limited to articles by a hard capability boundary. Neither library fetches pages or replaces browser rendering.

Sources: [Mozilla API and security notes](https://github.com/mozilla/readability#readme), [TypeSafe API](https://docs.typesafe.ai/api), [our extraction spec](./openspec/specs/extraction/spec.md) and [measured results](./docs/WCXB_BENCHMARK.md).

## Evaluation

### Same 140 pages: Readability vs Typed vs Generic

**140 WCXB pages, seven types × 20, fixed dataset commit and sample.** All three engines were run together. Both JEV variants used `jev-1.13.0`, identical large-page settings and unchanged thresholds. **Typed** receives the supplied page-type label; **Generic** always uses `agent` without that label. This is the same previously examined cohort, not a new untouched test set.

| Engine | Word precision | Word recall | Word F1 | Anchor F1 | Without exception |
| --- | ---: | ---: | ---: | ---: | ---: |
| Mozilla Readability `0.6.0` | 80.62% | 74.01% | 72.68% | 79.13% | 140 / 140 |
| JEV Typed | 72.86% | 94.93% | 79.90% | 92.99% | 139 / 140 |
| JEV Generic | 74.08% | 94.76% | 80.64% | 93.01% | 140 / 140 |

Word metrics are per-page bag-of-words scores, macro-averaged across **all scheduled pages**, with failed extractions scoring zero. They do not measure whole-document correctness, order or formatting. Completion without exceptions is not an accuracy measure.

| Page type | Readability Word F1 | Typed Word F1 | Generic Word F1 |
| --- | ---: | ---: | ---: |
| Article | 97.12% | 95.04% | 94.92% |
| Documentation | 86.44% | 93.95% | 93.73% |
| Forum | 62.16% | 77.20% | 81.60% |
| Product | 62.23% | 69.51% | 69.36% |
| Service | 78.79% | 78.73% | 79.18% |
| Listing | 60.28% | 77.46% | 77.68% |
| Collection | 61.77% | 67.39% | 67.97% |

**What this supports:** removing the supplied page-type hint did not eliminate the observed advantage over Readability in this cohort. Generic − Readability is **+7.95 percentage points**, with a 95% paired, type-stratified page-bootstrap interval of **+3.49 to +12.50**. Generic − Typed is **+0.74 pp**, interval **−1.11 to +2.51**: this does not establish Generic superiority. Intervals are not domain-clustered and do not cover repeated-model variability. Readability retains higher overall precision and higher article F1.

**What failed:** Typed page `4035` hit a request timeout and is scored zero. The Actions job is therefore red, while all 420 result rows and the report were saved. The old >500-block failure, page `4351`, succeeded in both variants with **507 blocks → 2 regions → 27 requests per variant**. It was not a perfect content extraction.

Two SPA references are empty/null. Keeping the historical empty-target convention gives the all-140 table; the separate **138 nonempty-reference** Word F1 values are **72.29% / 79.61% / 80.36%** for Readability / Typed / Generic. Empty anchor lists are not counted as perfect annotations.

**Correction:** the earlier 140-page JEV Word F1 was overstated as 79.97% because its failed page was excluded from the Word mean. The corrected prior score is **79.40%**. The latest table is a separate run, not a relabeling of that old result. See the report for all corrected metrics and usage distinctions.

[Full methodology and report](./docs/WCXB_BENCHMARK.md) · [Summary JSON](./docs/benchmarks/wcxb-ablation-summary.json) · [All per-page F1 scores](./docs/benchmarks/wcxb-ablation-pages.tsv) · [Actual run](https://github.com/hifizz/jev-readability/actions/runs/35465401579) · [Corrected prior summary](./docs/benchmarks/wcxb-summary.json)

The latest comparison made **1,842 HTTP attempts**. Successful responses reported **22,356,322 input + 3,490,889 output tokens**; the failed timeout attempt's accounting is unknown. These are usage subtotals, not an invoice. The existing `TYPESAFE_API_KEY` repository secret is sufficient: **Actions → WCXB Typed vs Generic → Run workflow**. Paid WCXB workflows are now manual-only and globally request/byte-bounded. The earlier [8-page synthetic suite](./docs/BENCHMARK.md) remains a development smoke test, not a web benchmark.

## How it works

```text
HTML / rendered Document
  → clean and partition the DOM
  → batch keep/drop and role questions to JEV
  → validate typed decisions
  → reconstruct original text / HTML / Markdown
```

Headings, paragraphs, code, lists, quotes, tables and captions remain candidate content. The pipeline supports bounded requests/concurrency/retries, cancellation, usage reporting and explicit uncertainty handling. By default, uncertain blocks are kept and flagged; a classifier failure throws. Set `fallback: 'heuristic'` only for a deliberately labeled fallback.

JEV uses native `state + questions`, not Chat Completions. `noul` is a model probability, not a calibrated extraction-correctness guarantee. `prepare()` → custom `Classifier` → `finalize()` lets you replace the decision layer without replacing DOM processing.

## Large pages

Large-page support is opt-in; default guards remain unchanged.

```js
const result = await extract(html, {
  apiKey: process.env.TYPESAFE_API_KEY,
  mode: 'agent',
  jev: {
    model: 'jev-1.13.0',
    largePage: { maxBlocks: 5000, regionBlocks: 500 },
    maxRequests: 128,
    totalTimeoutMs: 120_000,
  },
});
```

The Node entry point derives the DOM cap from `largePage.maxBlocks`. Structural heading/layout boundaries form regions of at most 500 candidates; IDs/order are preserved and all regions share one page-level request/deadline budget. This is not learned semantic segmentation or streaming HTML ingestion. The demo/proxy retains its original 500-candidate guard. [Full limits and browser/server integration](./docs/LARGE_PAGES.md).

## Browser and extension API

```ts
import { extract, createRemoteClassifier } from 'jev-readability';

const result = await extract(document, {
  mode: 'agent',
  classifier: createRemoteClassifier({
    endpoint: '/api/classify-content',
    headers: { 'X-CSRF-Token': csrfToken },
  }),
});
```

`extract(document)` clones the DOM. Supply `csrfToken` from your own authentication flow. **Never embed a TypeSafe key in browser code.** Your backend handles authentication, quotas and `createJevClassifier`. The [demo server](./examples/server.mjs) is loopback-only, not a production multi-tenant API. Large browser/core inputs require explicit bounded DOM and server-side classifier settings.

## CLI and configuration

```bash
# Installed package + linkedom; local HTML, no model calls
npx --no-install jev-readability page.html --heuristic

# Set TYPESAFE_API_KEY in the shell first
npx --no-install jev-readability page.html --mode documentation --out result.md
```

The CLI reads local HTML, not URLs. `--url` supplies metadata and resolves relative links. Formats: `markdown`, `text`, `html`, `json`. Results include `title`, `metadata`, `text`, `html`, `markdown`, `method`, `blocks`, `warnings`, `usage` and `stats`. Default guards include 2,000,000 HTML characters and 500 blocks. Long blocks may be sampled for classification; retained output still uses the complete original block.

[Configuration guide (中文)](./docs/GUIDE.md) · [Types](./src/types.ts) · [JEV options](./src/jev.ts)

## Limitations and safety

Not a crawler, browser renderer, general sanitizer or paywall bypass. It does not expand Shadow DOM/iframes or infer external-CSS visibility. Provide rendered DOM for SPAs. Obtain authorization before sending candidate content to TypeSafe. Prompt-injection defenses are limited; use a sanitizer, CSP and external-image policy when rendering results. Debug `blocks` include rejected content; normally pass only `text` or `markdown` to downstream agents.

## Development and contribution

```bash
npm install
npm run check
npm test
npm run test:node
npm pack --dry-run
```

The live evaluation job passed 60 Node tests before calling JEV. Node 22/24 CI, historical browser checks, the recorded live timeout and remaining validation gaps are separated in the [test report](./docs/TEST_REPORT.md). Contributions of legally shareable fixtures and independent labels are welcome via [Issues](https://github.com/hifizz/jev-readability/issues). Larger untouched datasets, repeated trials and latency/billing audits remain further validation work.

## License

[MIT](./LICENSE). Mozilla Readability and TypeSafe JEV are referenced descriptively; no affiliation or endorsement is implied.
