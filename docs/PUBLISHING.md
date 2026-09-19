# 发布 jev-readability

包名：`jev-readability`。仓库：`hifizz/jev-readability`。当前源码版本：`0.1.0`。

`npm pack` 只生成安装包，不会上传 registry。GitHub commit、GitHub Release 和 npm 发布是三个不同动作。只有 registry 能查询到相应版本，才算 npm 发布成功。

## 首次发布：维护者本机

```bash
git clone https://github.com/hifizz/jev-readability.git
cd jev-readability
npm install
npm run check
npm test
npm pack --dry-run
npm login --registry=https://registry.npmjs.org/
npm whoami --registry=https://registry.npmjs.org/
npm publish --access public --registry=https://registry.npmjs.org/
npm view jev-readability version --registry=https://registry.npmjs.org/
```

npm 登录在 npm 官方页面完成；按账号设置完成 2FA。不要向聊天或代码仓库发送密码、OTP、npm token 或 `.npmrc`。

发布前核实包名与所有权：`npm view jev-readability name version maintainers --registry=https://registry.npmjs.org/`。返回 404 只说明当时 registry 没有可见版本，不保证名称未被保留或发布一定成功；网络错误不等于包名可用。如果名称已归他人所有，先停止并决定新名称，不覆盖、不冒充其包。

本项目已移除 `private: true`，配置 public access、repository、homepage、bugs、ESM exports、类型声明和 CLI。`prepublishOnly` 执行类型检查、编译和单元测试；`prepack` 再次确保 dist 来自当前源码。`files` 使用白名单，不包含 `.env`、`.npmrc`、node_modules 或测试输出。

发布成功后将 README 的“发布状态”段改为实际版本信息，再提交文档；不要提前宣称安装已经可用。

## 后续版本：GitHub Actions OIDC

首次包存在后，在 npm 的包 Settings → Trusted publishing 中添加 GitHub Actions：

| 配置 | 值 |
| --- | --- |
| Organization or user | `hifizz` |
| Repository | `jev-readability` |
| Workflow filename | `publish.yml` |
| Environment | 留空，与本仓库工作流保持一致 |
| Allowed actions | 明确允许直接 `npm publish` |

发布工作流使用 GitHub-hosted runner、Node 24、npm 11.5.1+ 和 `id-token: write`；不需要保存长期 npm token。npm 的 trust 必须先配置，工作流文件本身不能代替 npm 授权，也不能自动取得新包所有权。

```bash
# 已将修改合入 main，并安装依赖后：
npm version patch
git push origin main
git push origin --tags
```

以 `v` 开头的版本 tag 会触发 `.github/workflows/publish.yml`。工作流验证 tag 与 package.json 一致，检查类型、测试 Node 入口、检查 npm 包，再使用 OIDC 发布。相同 name@version 不能再次发布；失败时先核对 registry，再决定重跑或提升版本。

## 参考

- [发布公开无 scope 包](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/)
- [Trusted publishing](https://docs.npmjs.com/trusted-publishers/)
- [npm Registry API / trusted publisher 要求](https://api-docs.npmjs.com/)
