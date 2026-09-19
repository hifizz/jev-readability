# WCXB 140-page evaluation

Canonical external evaluation for jev-readability v0.1.

## Provenance

- Run: https://github.com/hifizz/jev-readability/actions/runs/35464162174
- Source commit: `121f54e465438e3ac477de5186fbce7afa5c1bdc`
- Dataset: WCXB v1.0 public test split
- Dataset commit: `c039d5ee9f5a3a984a0e167e63aacd04e76e78a9`
- Available test pages: 511
- Evaluated: **140 pages = 20 × 7 types**
- Fixed seed: `jev-readability-wcxb-v0.2`
- Requested model: `jev-latest`
- Returned model: `jev-1.13.0`

## Aggregate results

| Engine | Word P | Word R | Word F1 | Anchor P | Anchor R | Anchor F1 | Errors |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Mozilla Readability 0.6.0 | **80.62%** | 74.01% | 72.68% | 92.25% | 69.27% | 79.13% | 0 |
| JEV API / jev-1.13.0 | 72.98% | **94.99%** | **79.97%** | **93.88%** | **92.00%** | **92.93%** | 1 |

Word scores are per-page bag-of-words scores against WCXB `ground_truth.main_content`, macro-averaged. Anchor metrics use WCXB `with[]` / `without[]` snippets and are micro-averaged.

## Word F1 by page type

| Type | Readability | JEV | Delta |
| --- | ---: | ---: | ---: |
| Article | **97.12%** | 95.03% | -2.08 pp |
| Documentation | 86.44% | **93.98%** | +7.54 pp |
| Forum | 62.16% | **77.11%** | +14.95 pp |
| Product | 62.23% | **69.56%** | +7.33 pp |
| Service | **78.79%** | 78.53% | -0.26 pp |
| Listing | 60.28% | **77.41%** | +17.14 pp |
| Collection | 61.77% | **67.56%** | +5.79 pp |

## Failure retained in the score

WCXB page `4351` (collection, johnsonfitness.com) exceeded the current 500 candidate-block safety limit:

```
Error: Page exceeds maxBlocks (500); increase the limit instead of silently losing content
```

It remains in the denominator.

## Usage

- TypeSafe requests: **888**
- Request JSON: **38,351,004 bytes**
- Complete token usage returned for 136 pages
- 3 successful pages omitted token usage
- Known minimum: **10,763,941 input + 1,693,934 output tokens**
- True total: unknown; not estimated
- Mean observed JEV end-to-end time per successful page: **844.9 ms**
- Mean Readability local time: **150.5 ms/page**

These timings include jsdom work and, for JEV, network/API latency. They are not a controlled inference-speed benchmark.

## Fairness

JEV receives page type through this deterministic mode mapping:

| WCXB type | Mode |
| --- | --- |
| article | article |
| documentation | documentation |
| forum | forum |
| product | product |
| service | agent |
| listing | agent |
| collection | agent |

Readability receives no equivalent task hint. This should be disclosed alongside results. WCXB labels are public, so this is reproducible external evaluation, not a secret blind test.

## Reproduce

Run **Actions → WCXB 140-page evaluation**. The Action checks out the pinned WCXB commit and runs both extractors on the same deterministic sample.

Runner: [benchmark/wcxb-run.mjs](../benchmark/wcxb-run.mjs)
