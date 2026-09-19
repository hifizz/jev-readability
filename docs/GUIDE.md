# 使用与集成指南

入口说明、安装命令与中文 Demo 见 [README](../README.md)。本指南针对 v0.1.0 的接口和工程边界；不包含尚未完成的真实 JEV 性能或准确率测量。

## 入口选择

| 入口 | 使用环境 | 主要导出 |
| --- | --- | --- |
| `jev-readability` | 浏览器、扩展、可提供 DOM 的运行时 | `prepare`、`extract`、`finalize`、`heuristicClassifier`、`createRemoteClassifier`、类型 |
| `jev-readability/node` | Node.js 22+，安装可选 peer `linkedom` | 接受 HTML 字符串的 `extract`、`createJevClassifier`、类型 |
| `jev-readability/jev` | 服务端 | `createJevClassifier`、`buildJevBatches`、`decodeJevResponse`、`validateClassifyInput` |

所有入口为 ESM。核心入口不持有 TypeSafe 密钥；`/jev` 在浏览器内创建客户端会报错，避免把服务端密钥嵌入前端。

## Node.js

```js
import { extract } from 'jev-readability/node';

const result = await extract(html, {
  url: 'https://example.org/docs/page',
  mode: 'documentation',
  apiKey: process.env.TYPESAFE_API_KEY,
  jev: { model: 'jev-latest', concurrency: 2 },
});
console.log(result.markdown);
```

`html` 是调用方已有的网页 HTML；`url` 只用于元数据和相对链接，不触发抓取。没有指定 `apiKey` 时读取 `process.env.TYPESAFE_API_KEY`。可以显式设置 `strategy: 'heuristic'` 完全不调用模型，或传入自己的 `classifier`。

## 组合 prepare / classifier / finalize

```js
import { prepare, finalize } from 'jev-readability';
import { createJevClassifier } from 'jev-readability/jev';
import { parseHTML } from 'linkedom';

const page = prepare(html, {
  mode: 'article',
  url: 'https://example.org/article',
  parseDocument: source => parseHTML(source).document,
});
const classify = createJevClassifier({ apiKey: process.env.TYPESAFE_API_KEY });
const classified = await classify({
  page: page.metadata,
  mode: page.mode,
  candidates: page.blocks.map(block => block.candidate),
});
const result = finalize(page, classified);
```

这个底层示例要求完整 HTML 文档；对于片段，优先使用 `/node` 入口，它会补充文档容器。传入已有 `Document` 时 `prepare` 克隆文档，不修改原网页。自定义 `parseDocument` 应返回独立文档。

`finalize` 校验每个候选是否有合法判断，不接受额外字段覆盖原始 `html`、`markdown` 或 `candidate`。模型可以决定取舍，不能借返回值注入新正文。

## 提取选项

| 选项 | 默认值 | 行为 |
| --- | --- | --- |
| `mode` | `article` | 可选 `documentation`、`forum`、`product`、`agent` |
| `strategy` | JEV / 自定义 classifier | 显式 `heuristic` 才使用本地规则 |
| `fallback` | `error` | 只有 `heuristic` 才在分类失败后明确降级 |
| `signal` | 未设置 | 支持调用方的 AbortSignal |
| `maxHtmlCharacters` | 2,000,000 | 超限报错，不静默截断 |
| `maxElements` | 30,000 | DOM 元素上限 |
| `maxDepth` | 100 | DOM 嵌套深度保护 |
| `maxBlocks` | 500 | 候选块上限；JEV 输入校验也限制 500 块 |

取消和超时不会被包装成成功的启发式降级。全部候选被拒绝时结果保持为空并给出警告，不擅自回退到整页或本地规则。

## JEV 客户端配置

这些参数直接传给 `createJevClassifier`；Node `extract` 则放在 `jev: { ... }` 中。

| 选项 | 默认值 | 含义 |
| --- | --- | --- |
| `model` | `jev-latest` | 对照实验建议固定已验证的版本 |
| `maxBlocksPerBatch` | 24 | 每批候选数量上限 |
| `maxSampleCharacters` | 1,800 | 长块发送首尾样本，输出仍保留完整原文 |
| `maxStateBytes` | 20,000 | state JSON UTF-8 字节预算 |
| `maxRequestBytes` | 48,000 | 完整请求体 JSON 字节预算 |
| `concurrency` | 2 | 单次提取中同时处理的批次数 |
| `maxRequests` | 64 | 包括重试在内的请求预算 |
| `maxRetries` | 2 | 可重试错误最多额外重试两次 |
| `timeoutMs` | 20,000 | 单次请求时限（毫秒） |
| `totalTimeoutMs` | 90,000 | 整体分类时限（毫秒） |
| `retryBaseMs` | 300 | 退避基础时间 |
| `maxRetryAfterMs` | 30,000 | 超过此等待预算时停止，不提前重试 |
| `includeRoles` | `true` | 关闭后每块只问保留问题 |
| `keepThreshold` | 0.5 | 默认保留阈值 |
| `uncertaintyMargin` | 0.15 | 概率距阈值小于此值时标记待检查 |
| `onUncertain` | `keep` | 可选 `drop` 或 `threshold` |

这些是工程保护值，不是经质量评测优化后的最佳参数，也不是 TypeSafe 的官方 token 上限。字节预算不等于 token 数。分批会丢失跨批全页上下文；首尾采样可能漏掉中间的重要信息，结果会提示这一限制。

原生 API 使用 `state + questions`。保留判断来自 `answers.keep_b0001.noul`，角色判断来自 `choice`；每个问题的 instructions 显式引用块 ID。参见 [TypeSafe API](https://docs.typesafe.ai/api)、[Noul](https://docs.typesafe.ai/primitives/noul)。

## 返回结果与观测

`title` 与 `metadata` 来自页面。`text`、`html`、`markdown` 来自被保留的原始块；空白会规范化，不保证与原始 HTML 字节一致。

`blocks` 包含全部候选和判断：`candidate`、`html`、`markdown`、`keep`、`keepProbability`、`role`、`roleConfidence`、`needsReview`。本地规则的概率与置信度均为 `null`。

`usage` 包含 `requests`、`batches`、`questions`、`requestBytes`、`sampledBlocks`、`models`、`inputTokens`、`outputTokens`。缺少服务端 token 用量时返回 `null`；成功响应的合计不包含未知的失败请求费用，不能当作完整账单。

`stats` 包含候选/保留/待检查块数、输入输出字符数和处理耗时。`warnings` 明确指出采样、分批、规则降级、空结果和计费未知项。不返回未经校准的整页准确率。

## 浏览器、扩展与后端

浏览器调用 `createRemoteClassifier({ endpoint, headers })`，后端校验候选并调用 JEV。使用你自己的 session/CSRF 机制，不向浏览器传 TypeSafe API Key。参考 [server.mjs](../examples/server.mjs) 与 [app.js](../examples/app.js)。

本地 Demo 只绑定 loopback，检查 Host、Origin、session token 并限制请求体与并发；它不是可直接公开使用的多租户 API。正式后端还需要用户鉴权、访问权限、配额、全局限流和观测。

## 内容、安全与保真边界

候选正文会发送给配置的模型服务；即使模型 state 去掉 URL 查询参数，正文也未必脱敏。不要发送未经授权的登录页面或个人信息。

输出 HTML 仅重建有限标签和属性，不是通用 sanitizer。展示时应增加成熟清洗器和 CSP，并考虑外部图片请求。Markdown 渲染同样应限制原始 HTML。`blocks` 含被排除原文，下游 Agent 通常只应接收 `markdown` 或 `text`。

不提供远程抓取、浏览器自动渲染、Shadow DOM/iframe 展开或登录/付费墙绕过。仅识别显式隐藏和部分内联样式，不计算外部 CSS 或视觉阅读顺序。复杂表格合并单元格在 HTML 中保留，在 Markdown 中被简化。

提示词明确把网页命令当作数据，返回值校验限制其影响范围，但不承诺解决全部提示注入问题。当前功能测试与真实模型质量评测是不同层次，详见 [测试报告](./TEST_REPORT.md)。
