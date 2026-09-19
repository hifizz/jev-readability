<p align="center">
  <img src="https://raw.githubusercontent.com/hifizz/jev-readability/main/docs/assets/banner.svg" alt="jev-readability：找到正文，保留原文" width="100%" />
</p>

<p align="center"><a href="https://github.com/hifizz/jev-readability#readme">English</a> · <strong>简体中文</strong></p>

# jev-readability

**让 JEV 判断哪些是正文，让代码保留原文。**

面向阅读模式、RAG 和 AI Agent 的 DOM-first TypeScript 库：把 HTML 切成不重叠的块，用 TypeSafe JEV 判断取舍，再从原始内容重组 **正文、HTML 和 Markdown**。模型只负责选择，不生成或改写文章。

[![CI](https://github.com/hifizz/jev-readability/actions/workflows/ci.yml/badge.svg)](https://github.com/hifizz/jev-readability/actions/workflows/ci.yml)
[![Baseline](https://github.com/hifizz/jev-readability/actions/workflows/benchmark.yml/badge.svg)](https://github.com/hifizz/jev-readability/actions/workflows/benchmark.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-315846)](./LICENSE)

[快速开始](#快速开始) · [Readability 对比](#与-mozilla-readability-对比) · [评测结果](#评测结果) · [大页面](#大页面) · [浏览器调用](#浏览器与扩展)

> **实验性开发版本。** 独立社区项目，非 Mozilla 或 TypeSafe 官方产品。最新 140 页 WCXB 对照使用真实 JEV，并保留了一次超时。结果仅适用于这批公开、已检查过的页面，不能泛化为所有网页的准确率承诺。

## 快速开始

### 本地 Demo：无需密钥

需要 **Node.js 22+**、npm 和 Git。演示界面目前为中文；介绍文档提供中英文切换。

```bash
git clone https://github.com/hifizz/jev-readability.git
cd jev-readability
npm install
npm run demo
```

打开 `http://127.0.0.1:4317`，加载示例、粘贴 HTML 或打开本地 HTML 文件，检查正文、Markdown、HTML、JSON、逐块判断和调用统计。

默认**本地规则**不联网、不调用模型，是开发基线，**不是免费 JEV 推理**。启用真实 JEV：复制 `.env.example` 为 `.env`，填写 `TYPESAFE_API_KEY`，重启后选择 **JEV · 真实 API**。密钥只在服务端；候选内容会发送给 TypeSafe，可能产生费用。失败明确报错，不会伪装成模型成功。

### 安装到项目

从 GitHub 安装当前开发代码：

```bash
npm install github:hifizz/jev-readability linkedom
```

本包为 ESM，附带 TypeScript 类型。Node 的 HTML 字符串入口需要 `linkedom`，浏览器核心不需要。GitHub 安装通过 `prepare` 编译源码，不应禁用这条路径的安装脚本。npm 发布步骤见[发布指南](./docs/PUBLISHING.md)；本次评测提交本身不会发布新 npm 版本。

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

保存为 `extract.mjs`，配置 `.env` 后执行 `node --env-file=.env extract.mjs`。离线基线使用 `{ strategy: 'heuristic' }`，模型概率保持 `null`。

可选模式：`article`、`documentation`、`forum`、`product`、`agent`。没有页面类型信息时可显式使用 `agent`。**库的默认模式仍为 `article`**，不会因为示例改用 agent 而隐式改变已有调用。

## 与 Mozilla Readability 对比

两者都提取已有内容，而不是生成新文章。差异是内容选择标准和工程取舍，不是谁在所有场景都更强。

| 维度 | Mozilla Readability | jev-readability |
| --- | --- | --- |
| 选择机制 | 本地 DOM / 文本启发式规则 | DOM 分块 + JEV 逐块判断；可选本地基线 |
| 主要用途 | 面向阅读模式的文章提取 | 五种内容标准，包含通用 agent 模式 |
| 执行方式 | 本地，无模型 API | JEV 需要密钥和网络；规则模式离线 |
| 输出 | 文章 HTML / 文本及元数据 | 正文 / HTML / Markdown、元数据、取舍与角色 |
| 可检查性 | 配置选项与调试日志 | 原始块、概率、needsReview、用量和警告 |
| 元数据 | 包含 JSON-LD 支持 | 基础 HTML / meta 字段，覆盖不等同 |
| 代价 | 无模型推理费用；已有 Firefox 集成 | 增加延迟和费用；本次数据中召回更高、整体精确率更低 |
| HTML 安全 | 展示时另配 sanitizer | 有限白名单重组；展示时仍需 sanitizer / CSP |

Readability 也能在文档、论坛或商品页面上成功，不能笼统说它“不支持”。两者都不能替代网页抓取和浏览器渲染。

依据：[Mozilla API 与安全说明](https://github.com/mozilla/readability#readme)、[TypeSafe API](https://docs.typesafe.ai/api)、[本库规范](./openspec/specs/extraction/spec.md)及[实测报告](./docs/WCXB_BENCHMARK.md)。

## 评测结果

### 同一批 140 页：Readability / Typed / Generic

固定 WCXB 数据版本和抽样，**七类页面各 20 页**，同一轮运行三个引擎。两种 JEV 均固定 `jev-1.13.0`，使用相同大页面设置、相同阈值。**Typed** 获得页面类型提示；**Generic** 全部使用 agent，不传入标注的页面类型。这是之前已经检查过的同一批页面，不是新的盲测集。

| 引擎 | Word 精确率 | Word 召回率 | Word F1 | Anchor F1 | 无异常完成 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Readability `0.6.0` | 80.62% | 74.01% | 72.68% | 79.13% | 140 / 140 |
| JEV Typed | 72.86% | 94.93% | 79.90% | 92.99% | 139 / 140 |
| JEV Generic | 74.08% | 94.76% | 80.64% | 93.01% | 140 / 140 |

Word 指标为每页词袋匹配分数的宏平均，**所有计划页面都在分母中，失败页计零**。它不等于整页正确率，也不衡量顺序或格式。无异常完成不代表内容全部正确。

| 页面类型 | Readability Word F1 | Typed Word F1 | Generic Word F1 |
| --- | ---: | ---: | ---: |
| Article | 97.12% | 95.04% | 94.92% |
| Documentation | 86.44% | 93.95% | 93.73% |
| Forum | 62.16% | 77.20% | 81.60% |
| Product | 62.23% | 69.51% | 69.36% |
| Service | 78.79% | 78.73% | 79.18% |
| Listing | 60.28% | 77.46% | 77.68% |
| Collection | 61.77% | 67.39% | 67.97% |

**能支持的结论：** 去掉外部提供的页面类型提示后，JEV 在这批样本上对 Readability 的优势没有消失。Generic − Readability 为 **+7.95 个百分点**，按页面类型分层的配对 bootstrap 95% 区间为 **+3.49～+12.50**。Generic − Typed 为 **+0.74 个百分点**，区间 **−1.11～+2.51** 跨过零，**不能认定 Generic 比 Typed 更强**。区间未按域名聚类，也不包含模型多次运行的不确定性。Readability 仍具有更高的整体精确率和文章类 F1。

**失败如实保留：** Typed 在页面 `4035` 上发生请求超时，该页计零，所以 Action 整体显示失败；420 条引擎／页面结果仍完整保存。此前超过 500 块的页面 `4351` 已在两个模式下完成：**507 块 → 2 个分区 → 每种模式 27 次请求**，但内容提取仍非满分。

两页 SPA 的参考正文为空或 null。为兼容历史统计，保留其空目标约定；另列 **138 页非空参考正文**的敏感性结果：Readability / Typed / Generic 的 Word F1 为 **72.29% / 79.61% / 80.36%**。空锚点数组不再算作“全部标注正确”。

**历史更正：** 上轮 140 页的 Word 均值误将一页失败样本排除，JEV F1 应为 **79.40%**，不是此前的 79.97%。上表是新一轮真实运行，不是把旧结果更换名称。其余旧指标与用量统计的更正见完整报告。

[完整方法与报告](./docs/WCXB_BENCHMARK.md) · [汇总 JSON](./docs/benchmarks/wcxb-ablation-summary.json) · [140 页逐页分数](./docs/benchmarks/wcxb-ablation-pages.tsv) · [实际运行](https://github.com/hifizz/jev-readability/actions/runs/35465401579) · [更正后的旧汇总](./docs/benchmarks/wcxb-summary.json)

新一轮共 **1,842 次 HTTP 尝试**；成功响应报告 **22,356,322 input tokens + 3,490,889 output tokens**，超时请求的用量未知。这不是账单金额。仍只需原有 `TYPESAFE_API_KEY` 仓库 Secret：**Actions → WCXB Typed vs Generic → Run workflow**。付费 WCXB 工作流现为仅手动触发，并有全轮请求／字节上限。[早期 8 页合成测试](./docs/BENCHMARK.md)仍作为开发回归样例，不代表真实网页分布。

## 工作方式

```text
HTML / 已渲染 Document
  → 清理与不重叠分块
  → JEV 批量判断保留 / 排除及角色
  → 校验结构化返回值
  → 从原始内容重组正文 / HTML / Markdown
```

支持标题、段落、代码、列表、引用、表格和图片说明；请求并发、重试、取消、预算、用量和不确定性均显式处理。默认保留并标记不确定块，分类失败抛错；只有主动设置 `fallback: 'heuristic'` 才进行明确标记的降级。

调用 TypeSafe 原生 `state + questions`，而不是 Chat Completions。`noul` 是模型概率，不是校准过的抽取正确率。通过 `prepare()` → 自定义 `Classifier` → `finalize()` 可替换判断层而保留 DOM 处理。

## 大页面

大页面支持需显式开启，默认安全限制不变：

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

Node 入口从 largePage.maxBlocks 推导 DOM 上限。每个分区最多 500 个候选，尽量沿标题和布局边界划分，保留全局 ID 和原始顺序；所有分区共享页面级请求与超时预算。这是结构分区，不是学习式语义分割，也不是流式 HTML 读取。Demo／代理仍保留原有 500 候选限制。[完整限制与接入说明](./docs/LARGE_PAGES.md)。

## 浏览器与扩展

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

克隆 DOM，不修改原页面。csrfToken 来自你的应用认证。**不要把 TypeSafe 密钥放在浏览器代码里**。后端负责认证、配额和 createJevClassifier；[Demo 服务端](./examples/server.mjs)仅绑定本机，不能直接作为生产多租户 API。大页面浏览器／核心入口需同时显式配置有界 DOM 上限和服务端分类器。

## CLI 与配置

```bash
# 已安装本包与 linkedom；读取本地 HTML，不调用模型
npx --no-install jev-readability page.html --heuristic

# 先在 shell 设置 TYPESAFE_API_KEY
npx --no-install jev-readability page.html --mode documentation --out result.md
```

CLI 不抓取 URL；`--url` 仅提供元数据与相对链接解析。支持 markdown、text、html、json。返回 title、metadata、text、html、markdown、method、blocks、warnings、usage、stats。默认上限包含 2,000,000 HTML 字符和 500 块。长块可能只采样部分文本供判断，但保留后仍输出完整原始块。

[配置指南](./docs/GUIDE.md) · [类型](./src/types.ts) · [JEV 选项](./src/jev.ts)

## 限制与安全

不是爬虫、浏览器渲染器、通用 sanitizer 或付费墙绕过工具。不展开 Shadow DOM / iframe，不分析外部 CSS 可见性；SPA 需要先提供渲染后的 DOM。发送页面内容给 TypeSafe 前需取得授权。提示注入防护有限；展示输出时另配 sanitizer、CSP 和外部图片策略。调试 blocks 包含被排除的原文，下游 Agent 通常只接收 text 或 markdown。

## 开发与贡献

```bash
npm install
npm run check
npm test
npm run test:node
npm pack --dry-run
```

本轮真实评测在调用 JEV 前通过了 60 项 Node 测试。Node 22／24 CI、历史浏览器检查、真实调用超时和剩余验证项分别记录在[测试报告](./docs/TEST_REPORT.md)。欢迎通过 [Issues](https://github.com/hifizz/jev-readability/issues) 提交可合法分享、已脱敏的页面及独立标注。更大且未接触过的数据集、多次重复实验、延迟与账单审计仍是后续验证工作。

## License

[MIT](./LICENSE)。Mozilla Readability 和 TypeSafe JEV 仅用于说明用途，不表示官方关联或认可。
