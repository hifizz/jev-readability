# Bounded large-page extraction

Large-page support is **opt-in**. The original 500-block DOM/classifier limit remains the default.

```js
import { extract } from 'jev-readability/node';

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

The Node entry point derives the DOM block cap from the explicit `largePage.maxBlocks` setting. The core/browser `extract` entry point also needs `maxBlocks: 5000`; construct the JEV classifier only on your server. Never expose the API key in browser code.

The planner validates the entire page, including duplicate IDs and the shared 2,000,000-character candidate-text bound. It then partitions at heading/layout boundaries where possible, with a hard at-most-500-candidate region fallback. Atomic paragraphs, lists, code and tables are not split. IDs and document order remain global; reconstruction still uses original source nodes.

Each region is turned into the existing request batches (default 24 blocks; existing byte budgets retained). All batches share one request budget, concurrency limit, cancellation signal and total classification deadline. No budget is reset when a new region begins. The plan is constructed before HTTP starts, so an obviously insufficient batch budget fails without model calls.

This is structural partitioning, **not learned semantic segmentation**. It does not make the entire page visible to every model request. The DOM is still held in memory; this is not streaming HTML ingestion. Long atomic blocks are still sampled for classification. HTML-size, element-count and nesting limits remain independent bounds.

The bundled demo/proxy retains its original 500-candidate guard. Large payloads require a deliberately configured authenticated server using the new bounded planner, not disabled validation. The WCXB ablation enables identical large-page settings for Typed and Generic, without page-specific threshold changes.
