# WCXB: Readability vs JEV Typed vs JEV Generic

[English](../README.md) · [简体中文](../README.zh-CN.md) · [Summary JSON](./benchmarks/wcxb-ablation-summary.json) · [All 140 per-page F1 scores](./benchmarks/wcxb-ablation-pages.tsv)

## Latest run and scope

Run [35465401579](https://github.com/hifizz/jev-readability/actions/runs/35465401579) completed the full comparison, **with one recorded Typed timeout**. GitHub correctly marks the job failed because an extraction failed; the benchmark report and all 420 engine/page rows were nevertheless saved. It was not rerun to obtain a green badge or replace an unfavorable observation.

Source: `103a72dac82a8ad9a812428bf08a9017ca0268f3`. Evaluated 2026-09-19 19:47–19:53 UTC (2026-09-20 UTC+08). Requested and returned model: `jev-1.13.0`. Readability: `0.6.0`; jsdom: `26.1.0`; Node: `v22.23.2`.

The sample is exactly the previous **140 WCXB pages**, not 140 new pages: 20 each from article, documentation, forum, product, service, listing and collection. Dataset: [WCXB](https://github.com/Murrough-Foley/web-content-extraction-benchmark), commit `c039d5ee9f5a3a984a0e167e63aacd04e76e78a9`, public test split. Deterministic within-type SHA-256 ranking uses seed `jev-readability-wcxb-v0.2`; selected-ID/type hash is `79d02e092b2fd1a19ec9e60ae5b33dd576cd8cc92a4543aeef988e2bce01add2`.

**Typed** maps the dataset page type to article/documentation/forum/product/agent; service/listing/collection map to agent. **Generic** always uses agent and never passes the supplied page-type annotation into classifier input. Both still see the page's own title, URL and candidate content. Gold body text and anchor annotations are used only for scoring. Except for mode, both JEV settings are identical. Typed/Generic execution order alternates by a fixed ID hash. Readability runs with defaults and no type hint.

## All-140 results, with failures scored zero

Word scores are per-page bag-of-words precision, recall and F1, then macro-averaged. Every scheduled page is included. Anchor scores are micro-averaged normalized substring matches, not whole-document accuracy.

| Engine | Word P | Word R | Word F1 | Anchor F1 | Completed without exception |
| --- | ---: | ---: | ---: | ---: | ---: |
| Readability | 80.62% | 74.01% | 72.68% | 79.13% | 140 / 140 |
| JEV Typed | 72.86% | 94.93% | 79.90% | 92.99% | 139 / 140 |
| JEV Generic | 74.08% | 94.76% | 80.64% | 93.01% | 140 / 140 |

Generic's observed advantage over Readability remains when the supplied page-type hint is removed. Readability has higher overall precision and higher article F1; this does not establish a universal winner. Generic exceeds Readability's per-page Word F1 on 71 pages, ties on 5 and is lower on 64. Aggregate gains are not gains on every page. Completion without exceptions does not imply correct extraction: some successful rows have F1 zero.

## By page type

| Type | Readability Word F1 | Typed Word F1 | Generic Word F1 |
| --- | ---: | ---: | ---: |
| Article | 97.12% | 95.04% | 94.92% |
| Documentation | 86.44% | 93.95% | 93.73% |
| Forum | 62.16% | 77.20% | 81.60% |
| Product | 62.23% | 69.51% | 69.36% |
| Service | 78.79% | 78.73% | 79.18% |
| Listing | 60.28% | 77.46% | 77.68% |
| Collection | 61.77% | 67.39% | 67.97% |

The two variants use the same agent-mode input for service/listing/collection. Differences there must not be attributed to the page-type hint: they reflect separate API executions and, in one case, a timeout. The report preserves them rather than selecting whichever run scored better.

## Paired uncertainty

5,000 paired bootstrap draws within page-type strata, fixed seed 20260920; percentile 95% intervals for all-page Word F1 differences:

| Contrast | Difference | 95% interval |
| --- | ---: | ---: |
| Typed − Readability | +7.21 pp | +2.49 to +11.95 pp |
| Generic − Readability | +7.95 pp | +3.49 to +12.50 pp |
| Generic − Typed | +0.74 pp | −1.11 to +2.51 pp |

The Generic/Typed interval crosses zero. This run does **not** establish that Generic is better than Typed. The intervals describe page-sampling uncertainty conditional on this run, not repeated-model variability. They are not domain-clustered; multiple pages from one site may be correlated. This previously examined public test subset is a development comparison, not a fresh untouched or secret holdout. Equal weighting of seven types is not the prevalence of page types on the web. Public labels also do not establish absence of model-training contamination.

## Empty-reference sensitivity

Two selected SPA pages have empty reference bodies: `4922` is an empty string; `4285` is null and explicitly marked unextractable upstream. For continuity, the all-140 table uses the historical empty-target convention: an empty extraction against an empty target scores one; nonempty output scores zero F1. They are retained, not replaced by easier pages. Empty anchor arrays do not count as evidence of perfectly recovered annotations.

On the **138 pages with nonempty references**, including the failed Typed page:

| Engine | Word F1 |
| --- | ---: |
| Readability | 72.29% |
| JEV Typed | 79.61% |
| JEV Generic | 80.36% |

This secondary view avoids treating empty SPA skeletons as evidence of successful semantic content selection.

## Large-page fix: page 4351

The previous failure had **507 candidates**, exceeding the default 500-block cap. With opt-in structural regions, both variants processed it as **2 regions**, with **27 API requests each**. Typed kept 284 blocks (Word F1 69.51%); Generic kept 291 (70.11%). Readability's Word F1 on this page was 30.49%. Both JEV variants still missed one of four positive anchors, so recovery from a size-limit error does not mean perfect extraction.

The planner preserves global IDs and original order, validates the full page first, then prefers heading/layout boundaries with a hard 500-candidate-region fallback. All regions share the page's request, timeout and concurrency budgets. Existing small-page prompts/batches are unchanged; no thresholds were tuned after observing this run. This is structural partitioning, not a learned semantic-region model. It is still in-memory DOM processing. See [large-page usage and limits](./LARGE_PAGES.md).

## Recorded failure: page 4035

Typed encountered `TimeoutError: Jev request timed out` on collection page `4035`, after 17 attempted requests. Its whole-page text score is zero in the main results. The timeout is unrelated to the former 500-block failure; page 4351 succeeded in both variants. Generic completed page 4035 in its separate execution. No post-hoc retry was substituted into the canonical table.

The benchmark now exits nonzero on any extraction failure after saving all rows and the summary, unlike the older runner which could produce a green job despite an extraction error.

## Usage and bounded execution

| Variant | HTTP attempts | Known input tokens | Known output tokens |
| --- | ---: | ---: | ---: |
| Typed | 915 | 11,106,862 | 1,744,305 |
| Generic | 927 | 11,249,460 | 1,746,584 |
| Total | 1,842 | 22,356,322 | 3,490,889 |

There were 1,841 successful HTTP responses with token usage and one failed/unknown timeout attempt. Known subtotals include successful requests from the page that ultimately failed. Accounting for the timeout is unknown, not zero; these numbers are not a billing invoice. Generic's HTTP usage is complete for this run.

Total JSON request bodies: 79,773,994 bytes. Whole-run limits were 2,400 attempts and 120,000,000 bytes; these are not a guaranteed dollar ceiling. The current paid workflows are manual-only, share a concurrency group, and inject the model secret only into the evaluation step, not dependency installation. Checkpoints are written after every page; fatal credential/model/budget failures record remaining scheduled rows instead of silently dropping them.

Observed mean successful-page elapsed time: Readability 150.7 ms; Typed 1,023.9 ms; Generic 1,057.7 ms. These timings include DOM work, plan construction and network/API time, are single-pass and exclude failed-page elapsed time; they are not controlled inference latency or a production SLA.

## Correction to the previous 140-page report

The old runner used `average(ok, ...)` for Word metrics. Its text claimed failures remained in the denominator, but one failed page was actually excluded from the Word means. Recalculation from the original artifact, without API calls:

| Prior JEV metric | Previously reported | Correct all-140 value |
| --- | ---: | ---: |
| Word precision | 72.98% | 72.46% |
| Word recall | 94.99% | 94.31% |
| Word F1 | 79.97% | 79.40% |
| Collection Word F1 | 67.56% | 64.18% |

The previous Anchor F1 (92.93%) already included the failed page and is unchanged. The earlier missing-usage statement also grouped two zero-request empty SPA pages with one successful API page lacking complete aggregate usage. The distinction is now recorded in [the corrected old summary](./benchmarks/wcxb-summary.json). Do not compare the uncorrected old Word score with the new table. Recalculation script: [benchmark/recalculate.mjs](../benchmark/recalculate.mjs).

## Reproduce and inspect

Use **Actions → WCXB Typed vs Generic → Run workflow**, keep model `jev-1.13.0`. It uses the existing repository secret `TYPESAFE_API_KEY`. No new secret or GitHub Environment is needed. This is a new paid run; result variation is possible.

Runner: [wcxb-run.mjs](../benchmark/wcxb-run.mjs); metrics: [wcxb-metrics.mjs](../benchmark/wcxb-metrics.mjs); metering: [meter.mjs](../benchmark/meter.mjs). The evaluation job passed **60 Node tests**, strict TypeScript checking and Node/linkedom integration before calling JEV. These functional checks are distinct from extraction quality.

The compact JSON and all 140 per-page F1 rows are committed. The full JSON artifact includes all 420 rows, warnings, block statistics, source/input hashes, paired intervals and request accounting, but no API keys or full page text. Artifact ID `10590069100`, 30-day retention, ZIP SHA-256 `b6940550c69d8809af72dac616cf9b8a4f7c869b032a285e8d38545f25df610c`. Download it from the run before expiry for permanent archival. Top-level dependency versions are pinned; transitive dependencies are not locked, so bit-for-bit environment reproducibility is not guaranteed.
