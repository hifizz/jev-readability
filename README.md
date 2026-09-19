# jev-readability

**用 JEV 判断网页正文，用代码保留原文。**

DOM-first content extraction with batched TypeSafe JEV decisions.

一个面向 Reader View、搜索结果清洗、RAG 与 AI Agent 的实验性 TypeScript 库：先把 HTML 切成不重叠的 DOM 块，再由 JEV 判断保留与内容角色，最后从原始节点重组 **正文、HTML 和 Markdown**。模型不生成、不改写正文。

> **v0.1.0 / 实验阶段。** 独立社区项目，非 Mozilla 或 TypeSafe 官方产品。目前没有真实 JEV 准确率、成本或相对 Mozilla Readability 的对照数据。离线规则结果不冒充模型结果。
>
> **发布状态：** 已准备 npm 发布配置，首次 registry 发布仍需维护者的 npm 认证。下面提供发布前即可使用的 GitHub 安装方式；不能把 `npm pack` 生成的文件当成已上线的 npm 包。

## 快速开始

### 运行中文 Demo

需要 **Node.js 22+**、npm 和 Git。

```bash
git clone https://github.com/hifizz/jev-readability.git
cd jev-readability
npm install
npm run demo
```

打开 `http://127.0.0.1:4317`，加载示例、粘贴 HTML 或打开本地 HTML 文件，点击「开始提取」。可以检查正文、Markdown、HTML、JSON、逐块判断及请求统计。

默认使用 **本地规则 · 非 JEV**，无需密钥，不调用模型。它用于验证抽取流程，不是 JEV 的免费推理模式。

开启真实 JEV：

```bash
cp .env.example .env
# 编辑 .env，填写 TYPESAFE_API_KEY；不要提交 .env
npm run demo
```

重启后选择「JEV · 真实 API」。密钥只在服务端使用；候选文本将发往 TypeSafe，可能产生费用。没有密钥或调用失败时明确报错，不自动伪装为离线成功。

### 在 Node.js 项目中安装

**发布前，从 GitHub 安装：**

```bash
npm install github:hifizz/jev-readability linkedom
```

**首次 npm 发布成功后：**

```bash
npm install jev-readability linkedom
```

`linkedom` 是 Node 入口的可选 peer dependency，需显式安装；浏览器核心不依赖它。包为 **ESM**，包含 TypeScript 类型声明。GitHub 安装会通过 `prepare` 编译源码，因此不要禁用安装脚本；克隆项目后也可手动 `npm run build`。

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

将代码保存为 `extract.mjs`，在当前目录的 `.env` 中配置密钥，然后执行：

```bash
node --env-file=.env extract.mjs
```

不调用模型的本地基线：

```js
const result = await extract(html, { strategy: 'heuristic' });
// result.method === 'heuristic'
// result.usage.requests === 0；概率字段为 null
```

### 命令行

安装本包与 `linkedom` 后，项目内可使用以下命令。它只读取本地 HTML，不抓取 URL：

```bash
npx --no-install jev-readability page.html --heuristic

# 真实 JEV：先在当前 shell 中设置 TYPESAFE_API_KEY
npx --no-install jev-readability page.html --mode documentation --format markdown --out result.md
```

`--url` 只用于页面元数据和相对链接解析。CLI 可输出 `markdown`、`text`、`html`、`json`；诊断信息写入 stderr，不污染 stdout 的提取结果。

## 工作方式

```text
HTML / 已渲染的 Document
  → DOM 清理与不重叠切块
  → JEV 批量判断 keep/drop 与内容角色
  → 严格校验返回值
  → 从原始 DOM 重组正文 / HTML / Markdown
```

| 能力 | v0.1 行为 |
| --- | --- |
| 内容结构 | 标题、段落、代码、列表、引用、表格、图片说明 |
| 提取策略 | `article`、`documentation`、`forum`、`product`、`agent` |
| 模型请求 | 原生 TypeSafe `state + questions` 接口；长页分批，有限并发与重试 |
| 可检查性 | 保留每块原文、保留判断、角色、概率和 `needsReview` |
| 故障处理 | 默认抛错；只有显式设置 `fallback: 'heuristic'` 才降级并标记 |
| 成本观测 | 请求/批次/字节计数、服务端返回的 token 用量；未知值保持 `null` |

五种策略是不同的提取标准，不代表五种已经做过准确率评测的模型。JEV 的保留答案读取 `answers.keep_b0001.noul`，不是虚构的 `probability` 字段。参见 [TypeSafe API reference](https://docs.typesafe.ai/api)。

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

`extract(document)` 克隆 DOM，不改原网页。`csrfToken` 应来自你自己的应用认证流程。**不要在浏览器代码里放 TypeSafe API Key**；后端接收候选块并调用 `createJevClassifier`。参考 [本地服务示例](./examples/server.mjs)，公开部署前须增加鉴权、配额、限流与输入保护。

底层接口为 `prepare()` → 自定义 `Classifier` → `finalize()`，可以替换模型或加入自己的规则，而不改 DOM 提取逻辑。

## 配置与返回值

```ts
const result = await extract(html, {
  mode: 'article',
  apiKey: process.env.TYPESAFE_API_KEY,
  jev: {
    model: 'jev-latest',
    maxBlocksPerBatch: 24,
    concurrency: 2,
    timeoutMs: 20_000,
    totalTimeoutMs: 90_000,
    maxRequests: 64,
    keepThreshold: 0.5,
    uncertaintyMargin: 0.15,
    onUncertain: 'keep',
  },
});
```

默认最多 2,000,000 个 HTML 字符、30,000 个 DOM 元素、500 个块。超限报错，不静默截断。长块只发送首尾样本，但保留时仍输出完整原文；采样和分批可能降低判断质量，结果会给出警告。这些是本库的工程保护值，不是 TypeSafe 的官方上下文上限。

结果含 `title`、`metadata`、`text`、`html`、`markdown`、`method`、`blocks`、`warnings`、`usage`、`stats`。详见 [完整指南](./docs/GUIDE.md) 和 [类型定义](./src/types.ts)。

## 边界与安全

**这不是抓取服务。** 不包含 URL 抓取、JS 页面自动渲染、iframe/Shadow DOM 穿透、付费墙或登录绕过。SPA 需先提供渲染后的 DOM；只识别显式隐藏与部分内联样式，不分析外部 CSS 或视觉阅读顺序。

**发送数据前需要授权。** 候选正文可能包含敏感内容；即使 URL 查询参数不进入模型 state，正文也不等于已脱敏。模型输出只决定取舍，不能替换原文；但仍不存在完整的提示注入防护。

**HTML 输出不是通用 sanitizer。** 本库重建有限标签与属性，仍建议在最终展示边界使用成熟 sanitizer、CSP 和外部图片策略。`blocks` 包含被排除的原文；交给下游 Agent 时通常只传 `markdown` 或 `text`。

## 开发与测试

```bash
npm install
npm run check
npm run build
npm test

# Node/linkedom 真实解析冒烟测试
npm install --no-save --package-lock=false linkedom@0.18.12
npm run test:node

# Chromium DOM 与 UI 测试；另开终端先执行 npm run demo
pip install playwright
playwright install chromium
npm run test:browser

# 打包前自动编译；发布前自动类型检查、编译和单元测试
npm pack --dry-run
```

单元测试使用模拟 JEV 响应，不需要 API Key。CI 负责类型检查、协议单测、Node 解析冒烟检查及打包检查；具体历史执行证据与未验证项见 [测试报告](./docs/TEST_REPORT.md)。

## 发布与贡献

首次发布需要维护者完成 npm 登录；后续可配置 GitHub Actions 的 npm Trusted Publishing，避免长期 npm token。完整步骤、首次发布和版本更新方式见 [发布指南](./docs/PUBLISHING.md)。

欢迎通过 [Issues](https://github.com/hifizz/jev-readability/issues) 提交真实网页案例，或通过 PR 改进提取策略与测试。提交案例前请去掉个人信息、私密页面与密钥；不要把模拟结果描述成真实 JEV benchmark。

## License

[MIT](./LICENSE)。Mozilla Readability 与 TypeSafe JEV 的名称仅用于说明用途与兼容关系，不表示官方认可。
