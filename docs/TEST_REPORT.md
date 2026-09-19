# Tests, live evaluation and limitations

[English README](../README.md) · [简体中文](../README.zh-CN.md)

## Latest verified engineering checks

On source `103a72dac82a8ad9a812428bf08a9017ca0268f3`, the [live evaluation job](https://github.com/hifizz/jev-readability/actions/runs/35465401579/job/105956692603) passed **60 Node tests**, strict TypeScript checking, build, and Node/linkedom integration before the API step. Node was `v22.23.2`; TypeScript `5.8.3` and linkedom `0.18.12` are project development dependencies.

The subsequent manual-trigger cleanup source `99c260c10ce30dcf60292ed7abcdb24a6fb174f3` also passed the [Node 22/24 CI matrix](https://github.com/hifizz/jev-readability/actions/runs/35465679259) and [synthetic baseline workflow](https://github.com/hifizz/jev-readability/actions/runs/35465679263).

Tests include typed response validation, timeout/cancellation/retry bounds, package entry points, metric denominators, missing usage, pinned model checking, opt-in large-page validation, cross-region duplicate IDs, unchanged small-page batches, all-region request limits, 1,201 candidate IDs in order, and reconstruction of 601 original DOM blocks via the Node entry point.

Model responses in unit tests are mocked. Passing them does not prove extraction quality.

## Latest real JEV comparison

The 140-page Typed/Generic run attempted all **420 engine/page combinations**. Readability and Generic completed 140/140 without exceptions; Typed completed 139/140. Typed page 4035 hit a request timeout. The workflow correctly failed after saving every row, the summary and artifact. This is not a green end-to-end result.

Page 4351, which previously exceeded 500 blocks, completed under both variants using 507 candidates partitioned into 2 structural regions. The recovered extraction still has content errors. See [full benchmark methodology and results](./WCXB_BENCHMARK.md), including correction of the previous failed-page denominator bug and sensitivity to two empty SPA references.

## Historical browser evidence, not rerun in this change

The initial demo delivery recorded 32 Chromium DOM checks, 8 UI checks and 10 local HTTP checks. DOM/UI tests used a real Chromium DOM with in-memory module loading and simulated local fixture/config fetches under the environment's browser-network constraints. Those results are not a newly executed browser-to-server-to-JEV test for the latest changes.

## Reproduce

```bash
npm install
npm run check
npm test
npm run test:node
npm pack --dry-run

# Browser checks: start npm run demo in another terminal first
pip install playwright
playwright install chromium
npm run test:browser

# Restricted-network historical test mode
python test/run-browser.py --offline
```

For paid evaluation, use **Actions → WCXB Typed vs Generic**, with the existing `TYPESAFE_API_KEY` repository secret. Current WCXB workflows are manual-only. For old report correction without model calls, run `node benchmark/recalculate.mjs original.json corrected.json`.

## Still unverified

No production security audit, broad browser compatibility guarantee, browser-to-server-to-model regression suite for the latest changes, independent fresh holdout, repeated-model stability experiment or actual invoice reconciliation is claimed. Transitive package dependencies are not locked. The library package version was not published or bumped as part of this benchmark work.
