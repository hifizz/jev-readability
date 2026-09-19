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

[快速开始](#快速开始) · [Readability 对比](#与-mozilla-readability-对比) · [评测结果](#评测结果) · [浏览器调用](#浏览器与扩展)

> **实验阶段 v0.1。** 独立社区项目，非 Mozilla 或 TypeSafe 官方产品。已实现 JEV 客户端和离线抽取流程，但真实 JEV 的质量、延迟、成本仍待评测。目前不宣称它优于 Readability。

## 快速开始

### 运行本地 Demo：无需密钥

需要 **Node.js 22+**、npm 和 Git。演示界面目前为中文；项目介绍提供中英文切换。

```bash
git clone https://github.com/hifizz/jev-readability.git
cd jev-readability
npm install
npm run demo
```

打开 `http://127.0.0.1:4317`，加载示例、粘贴 HTML 或打开本地 HTML 文件。可查看正文、Markdown、HTML、JSON、逐块判断和请求统计。

默认的**本地规则**不联网、不调用模型；这是开发基线，**不是免费 JEV 推理**。

启用 JEV：把 `.env.example` 复制为 `.env`，填写 `TYPESAFE_API_KEY`，重启 Demo 后选择 **JEV · 真实 API**。密钥只在服务端；采样后的候选正文会发送给 TypeSafe，可能产生费用。调用失败明确报错，不会悄悄伪装成模型成功。

### 安装到项目

首次 npm registry 发布仍需维护者认证；此前从 GitHub 安装：

```bash
npm install github:hifizz/jev-readability linkedom
```

确认 registry 发布成功后可用 `npm install jev-readability linkedom`。参见[发布指南](./docs/PUBLISHING.md)；生成 `.tgz` 或 CI 通过不等于已经发布。

本包为 ESM，附带 TypeScript 类型。Node 的 HTML 字符串入口需要 `linkedom`，浏览器核心不需要。GitHub 安装通过 `prepare` 编译源码，不应禁用该路径的安装脚本。

```js
import { readFile } from 'node:fs/promises';
import { extract } from 'jev-readability/node';

const html = await readFile('./page.html', 'utf8');
const result = await extract(html, {
  url: 'https://example.org/article',
  mode: 'article',
  apiKey: process.env.TYPESAFE_API_KEY,
});

console.log(result.markdown);
console.log(result.usage);
```

保存为 `extract.mjs`，配置 `.env` 后执行 `node --env-file=.env extract.mjs`。离线运行则把参数替换为 `{ strategy: 'heuristic' }`，模型概率保持 `null`。

## 与 Mozilla Readability 对比

两者都是**提取已有内容，不生成新文章**。差异在于选择机制与可观察信息，不是已经证明的准确率优势。

| 维度 | Mozilla Readability | jev-readability v0.1 |
| --- | --- | --- |
| 选择机制 | 本地 DOM / 文本启发式规则 | DOM 分块 + JEV 逐块判断；可选本地基线 |
| 主要用途 | 面向阅读模式的文章提取 | `article`、`documentation`、`forum`、`product`、`agent` 五种标准 |
| 执行方式 | 本地，无需模型 API | JEV 模式需要后端、密钥和网络；规则模式离线 |
| 输出 | 文章 HTML / 文本及元数据 | 正文 / HTML / Markdown、元数据、逐块取舍与角色 |
| 可检查性 | 配置选项与调试日志 | 原始块、概率、`needsReview`、用量和警告 |
| 元数据 | 包含 JSON-LD 支持 | 基础 HTML / meta 字段，覆盖范围不等同 |
| 代价与成熟度 | 无推理费用；已有 Firefox 集成 | 增加网络与模型费用、采样与分批；模型效果待验证 |
| HTML 安全 | 展示时另配 sanitizer | 有限白名单重组；展示时仍需 sanitizer / CSP |

Readability 也可能成功提取文档、论坛和商品页，不能笼统说它“不支持”。JEV 的五种模式是不同判断标准，不代表五种已分别通过质量验证的能力。两者都不能替代抓取或浏览器渲染。

依据：[Mozilla API 与安全说明](https://github.com/mozilla/readability#readme) · [TypeSafe API](https://docs.typesafe.ai/api)。本库行为以[源码](./src)和[提取规范](./openspec/specs/extraction/spec.md)为准。

**选型建议：** 离线文章阅读器优先从 Readability 开始；需要可配置内容标准、逐块决策或直接输出 Markdown 时，再评估本库，并先测真实 JEV 在自己的页面上的收益和代价。

## 评测结果

### 合成页面基线检查，不是 JEV 模型成绩

实际执行 **8 个原创合成页面**：7 个英文、1 个中文；标注 27 个应保留、21 个应排除的文本锚点。两种实现使用相同版本的 `jsdom@26.1.0` 创建新 DOM，Readability 使用默认配置。这是开发样例，不是代表真实网页分布的独立测试集。

| 实际评测对象 | 锚点精确率 | 锚点召回率 | 锚点 F1 | 全部锚点正确的页面 |
| --- | ---: | ---: | ---: | ---: |
| Mozilla Readability `0.6.0` | 92.86% | 96.30% | 94.55% | 6 / 8 |
| 本库：**本地规则，非 JEV** | 92.31% | 88.89% | 90.57% | 6 / 8 |
| **真实 JEV API** | 未测 | 未测 | 未测 | 未运行 |

指标采用微平均，只衡量标注文本片段，**不是整页准确率**。Readability 漏了文档警告块；本库规则漏了没有语义容器的短正文；两者都保留了没有广告标记的促销段落。所有案例和失败项均公开，没有为美化表格而事后调规则。

[完整报告与口径](./docs/BENCHMARK.md) · [机器可读汇总](./docs/benchmarks/baseline-summary.json) · [CI 原始输出](https://github.com/hifizz/jev-readability/actions/runs/35461669054) · [完整语料](./benchmark/corpus.mjs)

```bash
npm install
npm --prefix benchmark install --ignore-scripts
node benchmark/run.mjs
```

脚本输出每页正文、遗漏 / 混入锚点、源码哈希、版本及诊断耗时到 `docs/benchmarks/baseline-run.json`。单次耗时**不能当作速度评测**。报告另有 `--jev` 真实 API 运行说明；基线 CI 不使用密钥。

### 工程验证

类型检查、协议 / 包测试、Node/linkedom 解析和打包检查已在 **Node 22、24** 的 [CI](https://github.com/hifizz/jev-readability/actions/runs/35461669053) 中通过。历史 Chromium 记录为 32 项 DOM、8 项 UI 检查；不是本次重新执行的结果，也不是真实 JEV 端到端验证。详见[测试范围与限制](./docs/TEST_REPORT.md)。

## 工作方式

```text
HTML / 已渲染 Document
  → 清理与 DOM 不重叠分块
  → JEV 批量判断保留 / 排除及角色
  → 校验结构化返回值
  → 从原始内容重组正文 / HTML / Markdown
```

短标题、代码、列表、引用、表格和图片说明可作为候选。支持分批、有限并发与重试、取消、请求上限及不确定性处理。默认保留并标记不确定块，分类失败抛错；只有主动配置 `fallback: 'heuristic'` 才使用明确标记的降级。

使用 TypeSafe 原生 `state + questions` 接口，而非 Chat Completions。`noul` 是模型概率，不是校准过的抽取正确率。通过 `prepare()` → 自定义 `Classifier` → `finalize()` 可替换判断层而保留 DOM 处理。

## 浏览器与扩展

```ts
import { extract, createRemoteClassifier } from 'jev-readability';

const result = await extract(document, {
  mode: 'documentation',
  classifier: createRemoteClassifier({
    endpoint: '/api/classify-content',
    headers: { 'X-CSRF-Token': csrfToken },
  }),
});
```

`extract(document)` 克隆 DOM，不修改原网页。`csrfToken` 来自你的应用认证。**不要在浏览器代码里放 TypeSafe 密钥。** 后端负责认证、配额和 `createJevClassifier`；[Demo 服务端](./examples/server.mjs) 只绑定本机，不能直接当作生产多租户 API。

## CLI 与配置

```bash
# 安装本包与 linkedom 后，离线提取
npx --no-install jev-readability page.html --heuristic

# 真实 JEV：先在 shell 设置 TYPESAFE_API_KEY
npx --no-install jev-readability page.html --mode documentation --out result.md
```

CLI 读取**本地 HTML**，不抓取网址。`--url` 提供元数据并解析相对链接；支持 `markdown`、`text`、`html`、`json` 输出。

返回 `title`、`metadata`、`text`、`html`、`markdown`、`method`、`blocks`、`warnings`、`usage`、`stats`。默认最多 2,000,000 个 HTML 字符、500 个块；超限报错，不静默丢失正文。长块仅采样首尾供判断，输出仍保留完整原文，但采样可能漏掉中间的重要信息。

[完整配置指南](./docs/GUIDE.md) · [返回值类型](./src/types.ts) · [JEV 选项](./src/jev.ts)

## 限制与安全

不是爬虫、浏览器渲染器、通用 sanitizer 或付费墙绕过工具。不展开 Shadow DOM / iframe，不分析外部 CSS 可见性；SPA 需要先提供渲染后的 DOM。

候选正文可能包含隐私信息，发送给 TypeSafe 前需取得授权。提示注入防护有限；展示输出时需使用 sanitizer、CSP 和外部图片策略。调试用的 `blocks` 包含被排除的原文，下游 Agent 通常只接收 `text` 或 `markdown`。

## 开发与贡献

```bash
npm install
npm run check
npm test
npm run test:node
npm pack --dry-run
```

浏览器测试需要 Playwright 与运行中的 Demo，见测试报告。欢迎通过 [Issues](https://github.com/hifizz/jev-readability/issues) 或 PR 提交已脱敏、可合法分享的页面和独立标注。真实网页集、真实 JEV 对照、延迟与费用测量，是后续验证目标，不是已完成成绩。

## License

[MIT](./LICENSE)。Mozilla Readability 与 TypeSafe JEV 的名称仅用于说明，不表示官方关联或认可。
