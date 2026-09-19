# WCXB evaluation

This benchmark evaluates jev-readability against Mozilla Readability on a fixed, balanced subset of the public **WCXB v1.0** test split.

- Dataset repository: https://github.com/Murrough-Foley/web-content-extraction-benchmark
- Dataset commit: `c039d5ee9f5a3a984a0e167e63aacd04e76e78a9`
- License: CC-BY-4.0 (dataset; see upstream LICENSE)
- Split: `test` (511 available pages)
- Default sample: **140 pages = 20 pages × 7 types**
- Types: article, documentation, forum, product, service, listing, collection
- Selection: deterministic SHA-256 rank within type with seed `jev-readability-wcxb-v0.2`

## Metrics

The primary metric is per-page bag-of-words Precision / Recall / F1 against WCXB `ground_truth.main_content`, macro-averaged across pages. The report also calculates the WCXB `with[]` / `without[]` anchor metric as a secondary diagnostic.

Errors are not dropped: an extraction failure remains in the report with zero text score.

## Important fairness note

Mozilla Readability runs with default settings. JEV uses this project's task modes based on the WCXB page-type label:

- article → `article`
- documentation → `documentation`
- forum → `forum`
- product → `product`
- service / listing / collection → `agent`

That page-type input is useful for evaluating jev-readability as designed, but it is extra task information that Readability does not receive. Results must disclose this asymmetry. A future generic-mode benchmark should remove it.

## Reproduce

Run the GitHub Action **WCXB 140-page evaluation**. It checks out the pinned upstream dataset commit, reads the repository `TYPESAFE_API_KEY` secret, runs JEV and Readability on the exact same sampled HTML files, writes the Action summary, and uploads the complete JSON report.

The Action also supports 1–25 pages/type. The default 20 pages/type is the canonical v0.2 sample.
