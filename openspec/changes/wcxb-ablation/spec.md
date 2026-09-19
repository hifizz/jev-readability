# WCXB Typed/Generic and bounded large pages

## Scope frozen before live execution

Use exactly the prior 140-page sample, seed jev-readability-wcxb-v0.2, WCXB commit c039d5ee9f5a3a984a0e167e63aacd04e76e78a9. Selection hash: 79d02e092b2fd1a19ec9e60ae5b33dd576cd8cc92a4543aeef988e2bce01add2.

Run Mozilla Readability defaults, JEV Typed and JEV Generic (always agent) in one job. Pin jev-1.13.0. Except for mode, JEV configurations are identical. Do not tune prompts, thresholds or drop cases after observing results. This previously examined public test subset is a development comparison, not a new untouched holdout.

## Large page contract

Opt-in JevOptions.largePage retains a total page block bound (default 5000), and partitions by heading/layout hints into regions of at most 500 candidates. Global IDs and document order survive. Never split atomic table/code/list blocks, never silently truncate. HTTP batches remain byte/count-bounded; request budget, concurrency and deadline are shared across ALL regions, not reset per region. Existing small-page payloads and default limits remain unchanged.

Node convenience extract sets the DOM maxBlocks from the explicit largePage option. Browser/core users set their bounded DOM maxBlocks explicitly as well. This is structural partitioning, not an AI semantic segmentation model, and does not add cross-batch global reasoning.

## Evaluation acceptance

- Word macro denominator is every scheduled page; error/not-run scores are zero.
- HTTP attempts and known token subtotals include failed extractions; omitted usage remains unknown.
- Global cap: 2400 attempts, 120 MB JSON request bodies. These are not a guaranteed dollar ceiling.
- Checkpoint after every page. Fatal auth/model/budget failures trip a circuit; remaining planned pages are recorded, not omitted.
- Any failed extraction makes the workflow fail after saving the report.
- Publish all per-page metrics, version/config/source/input hashes and paired comparisons. Never publish credentials.
- Do not treat a workflow's presence or a successful mock test as real model evidence.
