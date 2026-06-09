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
- Skills workbench 的 catalog 默认页表达当前 runtime-visible `SKILLS_HOME` skill source order，而不是旧的 shared/global 分组推断；每个 visible skill 必须显示后端返回的 source env/path。
- Notes 是 Studio 的一级 system workbench，路由固定为 `/notes`。它只通过 `@agenter/client-sdk` runtime-store 的 NoteSystem facades 读取 catalog/page/search/tags/query projection，显式展示 no-capability、empty、loading、error、search、tags、read-only SQL 和 page-detail 状态；页面 detail 必须展示 stable IDs、MIME、tags 与 references，并通过共享 `filePreviewer` 的 document projection 阅读 Markdown 内容，不在 Studio 中直接读取或编辑 Markdown/frontmatter 文件。
- MCP 是 Studio 的一级 system workbench，路由固定为 `/mcp`。它只通过 `@agenter/client-sdk` runtime-store 的 MCP facades 读取和操作 Avatar-owned global registry、exact-project enablement、lifecycle、project-local snapshots 与 action outcomes；主页必须用 page-toolbar `Configs / Avatars` tabs 分离 config truth 与 Avatar-owned instance ownership。`Configs` 必须是跨 Avatar 的 config-first list-detail：左侧用 `new-item + config rows` 表达 durable globals，list row 只保留单列信息结构并在首行通过标准 avatar affordance 表达 owner，hover 可见 Avatar 名称、点击可跳到 `Avatars` 的对应 owner；右侧 detail 复用同一套 new/edit form，并在新建态选择 owner Avatar、编辑态只读展示可跳转的 owner 与该 config 的 exact-project instances。config form 必须支持 `Form / Code` 两种编辑模式；`Code` 模式直接编辑 JSON draft。detail/new 底部必须提供一个不持久化 truth 的简易 `Inspect` surface，该 surface 由 runtime-store 的 `mcp probe` typed facade 驱动：打开 isolated probe session 后可显示连接 snapshot、ping、工具调用、resource read、prompt get、resource templates 与 MCP apps，并在 Raw 中暴露 CLI-shaped `stdin/stdout/stderr/exitCode` envelope；GUI 不得发明 `mcp probe` 无法表达的轻量调试动作，说明文字应收纳到 HelpHint。若新建态 `Name` 与 owner Avatar 下已有 config id 冲突，Studio 必须明确警告并要求用户在 `Override` 或 `Cancel` 间做显式选择，不得 silent overwrite。`Avatars` 必须是 Avatar-first ownership overview，只读展示每个 Avatar 拥有哪些 configs 与 exact-project instances，并使用标准 avatar affordance 表达 owner，不得把 global config 创建隐式升级为 project enablement 或 server start。
- MCP 页面面向长时间使用 Studio 的 expert operator：默认 surface 展示 Avatar、project、server、lifecycle、snapshot 和 action facts，低频解释通过 `HelpHint`、tooltip、dialog 或 focused empty/error state 收纳；route/detail 不得用持续 introductory copy、嵌套 card stack 或重复 borders 冒充结构。
