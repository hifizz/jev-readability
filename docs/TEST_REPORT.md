# v0.1.0 测试与发布检查

本报告区分本地功能验证、外部 CI 和真实模型效果，避免把模拟响应或打包成功当作模型验证、发布成功。

## 本次本地执行结果

环境：Node.js v22.16.0、TypeScript 5.8.3、Linux Chromium + Python Playwright。

| 项目 | 结果 | 范围 |
| --- | --- | --- |
| `npm run check` | 通过 | 严格 TypeScript 类型检查 |
| `npm run build` | 通过 | ESM、类型声明和 source map 编译 |
| `npm test` | 34 / 34 通过 | 30 项协议/重试/判断测试 + 4 项 npm 包配置与入口检查 |
| Chromium DOM 测试 | 32 / 32 通过 | 分块、原文重组、短标题/代码/表格、边界和取消处理 |
| UI 操作检查 | 8 / 8 通过 | 示例提取、结果标签、无 key 提示、移动端无横向溢出 |
| `npm pack --dry-run` | 通过 | 文件白名单、已编译入口、CLI、文档，无密钥文件 |
| `npm publish --access public` | 未成功：`ENEEDAUTH` | 已运行发布前检查；当前环境没有 npm 身份认证 |

DOM/UI 检查使用真实 Chromium，通过 `python test/run-browser.py --offline` 在内存中加载编译后的模块，模拟 fixture/config 的网络响应。**这不是浏览器 → 本地后端 → 真实 JEV 的端到端测试。** 测试脚本会将 JSON 结果与截图写入 `test-artifacts/`；该目录不提交源码或 npm 包。

较早的 Demo 交付曾记录 10 项本地 HTTP 检查；本次发布准备没有重新执行这组检查，不把历史结果冒充新增验证。

## 外部 CI

`.github/workflows/ci.yml` 配置 Node 22 / 24 的类型检查、单元测试、安装 `linkedom@0.18.12` 后的真实 Node 解析冒烟检查，以及 npm 打包检查。以仓库 Actions 的实际结果为准，工作流文件存在不等于检查已通过。

CI 最后只读查询 npm registry，输出 `REGISTRY_STATUS`，用于区分尚无可见包、已发布版本与网络/服务错误；它不会发布包。

## 尚未验证

- 真实 JEV 成功调用、模型准确率、延迟和实际账单成本：没有可用 API Key，协议测试使用模拟 HTTP 响应。
- 本地 Node/linkedom 解析运行：本环境未安装这个可选依赖，交由外部 CI 的 `npm run test:node` 验证。
- 真实网页与 Mozilla Readability 对照评测、生产安全审计、复杂页面结构与多租户部署。
- npm registry 首次发布：需要维护者认证及包名权限，打包成功不能证明发布成功。

## 复现

```bash
npm install
npm run check
npm run build
npm test
npm install --no-save --package-lock=false linkedom@0.18.12
npm run test:node
npm pack --dry-run

# Chromium DOM / UI：先在另一个终端启动 npm run demo
pip install playwright
playwright install chromium
npm run test:browser

# 无浏览器网络的本地测试模式
python test/run-browser.py --offline
```

不得根据这些功能测试宣传 JEV 比 Readability 更准、更快或更便宜。先构建真实网页标注集，再做独立质量与成本评测。
