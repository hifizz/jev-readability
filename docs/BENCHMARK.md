# Extraction evaluation — baseline report

[English README](../README.md) · [中文介绍](../README.zh-CN.md)

**This report is not a JEV model benchmark.** It compares Mozilla Readability with this library's explicitly selected offline heuristic. No TypeSafe request was made. The purpose is to establish auditable fixtures and expose failure modes before measuring JEV.

## Run provenance

| Field | Recorded value |
| --- | --- |
| Evaluated at | 2026-09-19 18:35:29 UTC / 2026-09-20 02:35:29 UTC+08 |
| Source commit | `747e57db4ee71c847e69f4cf3c23d5ef8cd1e58e` |
| Runner | GitHub-hosted Ubuntu 24.04.5, Linux x64 |
| Node | `v22.23.2` |
| CPU reported by runner | AMD EPYC 7763 64-Core Processor; not a dedicated 64-core allocation |
| Readability | `@mozilla/readability@0.6.0`, default options |
| DOM parser for both engines | `jsdom@26.1.0`, new document per page/engine |
| Dataset | 8 original synthetic development fixtures: 7 English, 1 Chinese |
| Labels | 27 positive and 21 negative text anchors |
| Live JEV | Not run; accuracy, latency, and billed cost unknown |

[CI run](https://github.com/hifizz/jev-readability/actions/runs/35461669054) · [Executed job and raw `BENCHMARK_JSON`](https://github.com/hifizz/jev-readability/actions/runs/35461669054/job/105946520990) · [Machine-readable summary](./benchmarks/baseline-summary.json) · [Corpus](../benchmark/corpus.mjs) · [Runner](../benchmark/run.mjs)

The committed summary is a compact transcription of the verified CI output, not the complete raw report. The raw log and a fresh runner execution also include extracted text, warnings about the evaluation scope, diagnostic timings, and source hashes. Top-level benchmark dependencies are pinned; transitive dependencies are not locked in the repository, so bit-for-bit future environment reproducibility is not guaranteed.

## Aggregate results

| Engine | TP | FP | FN | Precision | Recall | F1 | All anchors correct |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mozilla Readability | 26 | 2 | 1 | 92.86% | 96.30% | 94.55% | 6 / 8 |
| jev-readability **local heuristic, not JEV** | 24 | 2 | 3 | 92.31% | 88.89% | 90.57% | 6 / 8 |
| JEV API | — | — | — | Not measured | Not measured | Not measured | Not run |

Both local engines completed all 8 runs without exceptions. Completion is not correctness: the local heuristic returned only the title for the short-body case. Readability has the higher aggregate anchor F1 on this small fixture set. This says nothing about real JEV performance or general web performance.

## Every case, including failures

“Kept” means matched positive anchors, not retained DOM blocks. “Noise” counts matched negative anchors; two negative anchors can belong to one paragraph.

| Case | Intent | Readability kept | Readability noise | Local rules kept | Local rules noise |
| --- | --- | ---: | ---: | ---: | ---: |
| `article-en` | Article | 3 / 3 | 0 | 3 / 3 | 0 |
| `article-zh` | Article | 3 / 3 | 0 | 3 / 3 | 0 |
| `documentation` | Documentation | 3 / 4 | 0 | 4 / 4 | 0 |
| `forum` | Forum | 3 / 3 | 0 | 3 / 3 | 0 |
| `product` | Product | 4 / 4 | 0 | 4 / 4 | 0 |
| `link-directory` | Agent | 4 / 4 | 0 | 4 / 4 | 0 |
| `unmarked-promotion` | Article | 3 / 3 | 2 | 3 / 3 | 2 |
| `short-unmarked-content` | Article | 3 / 3 | 0 | 0 / 3 | 0 |

Readability omitted the warning “Do not retry a completed job with a new idempotency key” from the documentation fixture. The local heuristic omitted all three short-body sentences outside a semantic main/article container. Both engines retained the unmarked promotion, including two negative anchors. We did not patch selection rules, drop cases, or tune thresholds after observing these results.

## Metric definition

Gold annotations live outside the HTML and are never sent to the extractors. A positive anchor is text expected in the result; a negative anchor is unwanted text. The evaluator applies Unicode NFKC normalization, removes whitespace, and uses case-sensitive substring matching.

```text
TP = positive anchors found in extracted text
FN = positive anchors not found
FP = negative anchors found

micro precision = sum(TP) / (sum(TP) + sum(FP))
micro recall    = sum(TP) / (sum(TP) + sum(FN))
micro F1        = 2 * sum(TP) / (2 * sum(TP) + sum(FP) + sum(FN))
```

Precision is `null` when no labeled positive or negative anchor appears; recall and F1 are zero when all positives are missed. Exceptions are recorded and scored as empty output, not removed from the denominator. “All anchors correct” requires no missed positive anchor, no leaked negative anchor, and no exception. Unlabeled text is not scored; titles are excluded to avoid penalizing an extractor that returns the title as metadata.

**These are anchor metrics, not whole-page, token-level, or semantic accuracy.** Matching an anchor does not prove its entire paragraph survived. Noise outside annotated spans, order, duplication, table structure, link fidelity, and metadata correctness are not measured by this score.

## Fairness and limitations

The corpus is small, synthetic, and authored with knowledge of the implementation. It is a development smoke suite, not a held-out benchmark. No confidence interval or population-level claim is justified. It includes intentionally difficult cases and reports every case.

Readability runs with default article-oriented behavior; the local baseline receives a declared task mode. This comparison is about configured behavior on these examples, not equivalent objectives across all page types. The shared jsdom parser removes one environment difference, but does not test the production Node/linkedom adapter here; that adapter has a separate CI check.

The runner records one execution per engine/page with DOM parsing included, fixed engine order, and no warmup/repeated sampling. Timings are diagnostic only: do not advertise a speedup or use them as JEV latency. Both baselines make zero model requests, but local compute is not cost-free. Real JEV billing remains unknown, not zero.

## Reproduce the baseline

```bash
git clone https://github.com/hifizz/jev-readability.git
cd jev-readability
# To reproduce the measured source rather than newer changes:
git checkout 747e57db4ee71c847e69f4cf3c23d5ef8cd1e58e
npm install
npm --prefix benchmark install --ignore-scripts
node benchmark/run.mjs
```

Output: `docs/benchmarks/baseline-run.json` plus the complete `BENCHMARK_JSON` line in stdout. Execution timestamps/timings vary. Check source and corpus hashes before comparing runs.

## Run a real JEV comparison separately

Set `TYPESAFE_API_KEY` and `JEV_MODEL` in an uncommitted `.env`. Use an explicit model version for a report; do not present a moving `jev-latest` alias as a frozen experiment. Keep the returned model identifier and date in the report.

```bash
node --env-file=.env benchmark/run.mjs --jev
```

This sends only the included synthetic page candidates to TypeSafe and may incur fees. The runner does not enable heuristic fallback. It writes `docs/benchmarks/jev-run.json`, including real model usage when supplied by the API. Failed calls are recorded as failures; missing billing data stays unknown. The configured request budget is per page, not a guarantee of a particular bill.

For a publication-quality evaluation, expand to a legally shareable, independently annotated real-page set; freeze corpus/model/options; report inter-annotator disagreements, uncertainty, per-domain failures, repeated end-to-end latency, and measured usage/cost. Keep tuning and final-test pages separate. The existing fixture results cannot substitute for this work.

## Engineering evidence

[CI at the evaluated commit](https://github.com/hifizz/jev-readability/actions/runs/35461669053) passed on Node 22 and 24: TypeScript, protocol/package tests plus the new metric/corpus tests, the Node/linkedom integration, and npm pack checks. Engineering tests verify behavior, not model judgment quality. See [TEST_REPORT.md](./TEST_REPORT.md) for historical browser coverage and remaining gaps.
