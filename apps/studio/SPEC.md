# agenter-app-studio SPEC

> 本文件记录 Studio operator app 的长期职责与边界。

## 1. 角色

`agenter-app-studio` 是 Agenter 的 active SvelteKit operator app：

- 通过 `agenter studio` 由 app command launcher 启动。
- 拥有 Studio-specific CLI grammar、static serving、Vite dev serving、route assets、Storybook workflow 与 browser lifecycle。
- 通过 launcher-provided daemon/auth context 与 `@agenter/client-sdk` 消费平台能力。

## 2. 长期法则

- Studio 是生态产品包，不是 core CLI 内置 web mode；`agenter web` 不再是有效入口。
- `--dev`、`--web-host`、`--web-port` 等 Studio UI host 参数由 Studio 解析；launcher 的 `--host` / `--port` 只表达 daemon authority。
- 默认/static mode 只服务 `apps/studio/build` 或 published package build；静态资源根不再复制进 `@agenter/cli` 作为第二运行时真源。
- dev mode 由 Studio 从自身 package root 启动 Vite，并注入 launcher-provided daemon `/trpc` endpoint。
- Studio startup 不得 import `@agenter/app-server` runtime internals、session-runtime modules、core CLI static-root helpers 或 Icon Studio route internals。
- Active browser storage、diagnostics 与 docs 使用 `studio` / `agenter:studio` 命名；旧 `webui` key 不需要兼容迁移。
- Storybook DOM contract、static Storybook build、unit tests、Playwright route smoke 都属于 Studio package 自己的验证面。
