# Fullstack Review + Plan 2026-04-12

Updated at `2026-04-13 23:40 CST`.

> 目标：把最近一周的 workspace-system / attention / CLI-skills / session-ledger / WebUI 主线，整理成一份“当前真实完成度盘点 + 下一步主线计划”文档。  
> 这份文档已经替代 04-12 晚上的中途版本；当时 still-active 的 OpenSpec changes、Storybook static build 问题、Avatar 页面 blocker 判断，已经在 04-13 收口完成。

---

## 1. 当前结论

一句话判断：

- **这轮主线已经完成了核心范式转移，且所有 active OpenSpec changes 已归档。**
- 现在的状态不是“主线还没做出来”，而是：
  - **后端平台法则已经基本切换完成**
  - **前端主壳层已经切到新模型**
  - **还剩少量 control-plane 对称性缺口与产品面补完项**

当前仓库状态快照：

- `pnpm exec openspec list --json` 返回 `{"changes":[]}`
- 最近收口提交包含：
  - `719e0b4` `docs(spec): archive webui storybook static build change`
  - `f126e28` `fix(webui): stabilize storybook static build`
  - `902acb8` `docs(spec): define webui storybook static build contract`
  - `f4fbfdc` `docs(spec): archive heartbeat compact separator change`
  - `4b5df57` `feat(runtime): render heartbeat compact separators`
  - `b107da3` `docs(spec): archive workspace grant glob rule change`
  - `6fb6ce7` `refactor(workspace-system): enforce ordered grant glob rules`

---

## 2. 证据基线

这份审计主要基于以下事实源：

- 工作交接与 review 文档
  - `.chat/backend-worklog-04-12.md`
  - `.chat/frontend-worklog-04-12.md`
  - `.chat/gemini-review-04-12.md`
  - `.chat/workspace-attention-backend-integration-notes.md`
- Durable OpenSpec
  - `openspec/specs/workspace-system-capabilities/spec.md`
  - `openspec/specs/runtime-skills-cli-surface/spec.md`
  - `openspec/specs/attention-notification-push/spec.md`
  - `openspec/specs/session-ai-call-ledger/spec.md`
  - `openspec/specs/workspace-runtime-shell/spec.md`
  - `openspec/specs/workspace-system-workbench/spec.md`
  - `openspec/specs/svelte-webui-platform/spec.md`
  - `openspec/specs/webui-storybook-static-build/spec.md`
- 关键实现
  - `packages/app-server/src/app-kernel.ts`
  - `packages/app-server/src/runtime-cli.ts`
  - `packages/app-server/src/runtime-tool-descriptors.ts`
  - `packages/app-server/src/session-notifications.ts`
  - `packages/app-server/src/semantic-judge.ts`
  - `packages/webui/src/lib/features/runtime/runtime-shell.svelte`
  - `packages/webui/src/lib/features/runtime/runtime-stage-attention.svelte`
  - `packages/webui/src/lib/features/workspaces/workspaces-route.svelte`
  - `packages/webui/src/lib/features/workspaces/workspace-start-route.svelte`
  - `packages/webui/src/routes/avatars/runtime/[sessionId]/+page.ts`
  - `packages/webui/package.json`
- 关键测试
  - `packages/app-server/test/workspace-system.test.ts`
  - `packages/app-server/test/runtime-cli.test.ts`
  - `packages/app-server/test/real-semantic-judge-provider.test.ts`
  - `packages/app-server/test/session-runtime.attention-system.test.ts`
  - `packages/webui/test/storybook/runtime-stage-heartbeat.stories.test.ts`
  - `packages/webui/playwright.config.ts`

---

## 3. 完成度矩阵

| 主线 | 结论 | 状态 |
| --- | --- | --- |
| Workspace system 正交化 | 独立 mount/grant law、root workspace、public/private asset roots、ordered glob grants 已落地 | 已完成 |
| Attention + notification | focused/background/muted + push projection + runtime shell quick actions 已落地 | 基本完成 |
| Session DB 简化 | `message_parts + ai_call` 成为 Heartbeat durable truth，compact boundary 也已打通 | 已完成 |
| root workspace + CLI/skills | 直接 tools 已收缩到 `root_workspace_list/root_workspace_bash`，JSON-only CLI + `ccski` 已落地 | 基本完成 |
| WebUI 运行时壳层 | `Avatars / Messages / Workspaces / Terminals` 一级导航，以及 `Heartbeat / Attention / Settings` runtime shell 已落地 | 已完成 |
| 测试与工具链 | real semantic judge provider 门槛、Storybook DOM、Storybook static build 已收口 | 已完成 |
| 多焦点 control-plane 对称性 | terminal 已有 `focus` CLI，但 generic attention focus / message focus CLI 还未补齐 | 未完成 |
| notification 原生 quick-reply / defer | 当前是通用 quick actions，不是 source-provided metadata 驱动的原生通知动作 | 未完成 |
| workspace 挂载实例管理 UI | 当前前端偏 root-centric Explorer/Rules/Private，尚未把 mount/detach 作为一等操作面建完整 | 未完成 |

---

## 4. 已经稳定的底层法则

### 4.1 Workspace law 已经成立

这条线现在已经不是“计划”，而是 durable contract：

- Avatar runtime 启动时固定挂一个 avatar root workspace
- project workspace 必须显式 mount + grant
- 一个 runtime 可以同时持有多个 workspace
- grants 使用有序 glob 规则，语义是 `default deny + last match wins`
- workspace 同时暴露 shared public roots 和 avatar-private roots

证据：

- `openspec/specs/workspace-system-capabilities/spec.md`
- `packages/app-server/test/workspace-system.test.ts`
- `packages/app-server/src/app-kernel.ts`

具体看实现，`workspace-system.test.ts` 已经覆盖了：

- runtime 初始无 project mount
- `grantRuntimeWorkspace(...)` 后 mounts 生效
- 同一 runtime 同时挂多个 workspace
- `/src` 只读、`/src/generated` 可写时 later rule override earlier rule
- public/private `skills/memory/tools/archive` roots 暴露

这说明主线第一部分“正交出独立 workspace system”已经做成。

### 4.2 Session durability law 已经切换完成

原始需求里最重要的一刀，是把 `session.db` 从旧的 cycles-heavy/trace-heavy 模型收缩成 AI-call ledger。

目前 durable contract 已明确：

- AI 可见消息落到 `message_parts`
- 每次模型调用落到 `ai_call`
- request-side `systemPrompt/tools/config` 变成 special message parts
- compact 会写出 `partType=compact` 的 Heartbeat boundary
- cold restart 走 ledger 重建，不再依赖 legacy cycle tables

证据：

- `openspec/specs/session-ai-call-ledger/spec.md`
- `packages/app-server/src/session-ledger-view.ts`
- `packages/webui/test/storybook/runtime-stage-heartbeat.stories.test.ts`
- `packages/webui/src/lib/features/runtime/runtime-heartbeat-compact-separator.stories.ts`

这条线对应的前端 Heartbeat 也已经切到“连续 runtime stream”语义，而不是旧 cycle cards。

### 4.3 Root workspace + CLI/skills runtime 已经完成主切换

原始 prompt 最核心的范式转移之一，是：

- LoopBus 不再直接面向 message/workspace/terminal tool 注入
- AI 只直接拿 root workspace primitives
- 其它系统能力通过 CLI + skills progressive disclosure 展开

这条线现在已经是事实：

- direct tool surface 只剩 `root_workspace_list` 和 `root_workspace_bash`
- runtime-local API 存在
- `attention/message/workspace/terminal` CLI 已挂进 shell
- `ccski list/info/search` 已可用
- CLI 只接受 `JSON | --help`

证据：

- `openspec/specs/runtime-skills-cli-surface/spec.md`
- `packages/app-server/src/runtime-cli.ts`
- `packages/app-server/src/runtime-tool-descriptors.ts`
- `packages/app-server/src/runtime-shell-bin.ts`
- `packages/app-server/test/runtime-cli.test.ts`
- `packages/app-server/test/runtime-skills.test.ts`

尤其 `runtime-tool-descriptors.ts` 已把 CLI contract 固化成 descriptor + inputSchema，已经不是临时实现。

### 4.4 Attention + notification 已从“概念”进入产品面

原始架构里，notification 不是独立真相源，而是 attention push 的一个投影。

这部分也已经明显落地：

- 后端有 `push` 型 ingress 和 persisted notification snapshot
- `focused/background/muted` 影响 wake law
- muted context 上 `notification-class push` 可强制唤醒
- 前端 Attention 页有 queued push inbox
- quick actions 已内嵌在 Attention，而不是单独新页

证据：

- `openspec/specs/attention-notification-push/spec.md`
- `openspec/specs/attention-runtime-scheduling/spec.md`
- `packages/app-server/src/session-notifications.ts`
- `packages/app-server/test/session-runtime.attention-system.test.ts`
- `packages/app-server/test/app-kernel.test.ts`
- `packages/webui/src/lib/features/runtime/runtime-stage-attention.svelte`

`runtime-stage-attention.svelte` 已经具备：

- `Open source`
- `Keep in background`
- `Consume push`
- `Promote and open`

这说明“Notification 内置到 Attention”这条主线已经不是纸面设计。

### 4.5 WebUI 一级壳层与 Avatar runtime shell 已切换完成

你要求的几个关键 UI 方向，当前已经明确成型：

- 一级导航是 `Avatars / Messages / Workspaces / Terminals`
- `/avatars/history` 不再保留旧入口，而是重定向到 `/workspaces`
- Avatar runtime 默认落到 `/avatars/runtime/{sessionId}/heartbeat`
- runtime tabs 简化为 `Heartbeat / Attention / Settings`

证据：

- `openspec/specs/svelte-webui-platform/spec.md`
- `openspec/specs/workspace-runtime-shell/spec.md`
- `packages/webui/src/routes/avatars/runtime/[sessionId]/+page.ts`
- `packages/webui/src/lib/features/runtime/runtime-shell.svelte`
- `packages/webui/src/lib/features/runtime/runtime-primary-stage.svelte`

这意味着第二条大主线“强化 attention system，并重构 webui runtime shell”已经完成核心切换。

### 4.6 Workspace workbench 已经具备可用产品面

Workspaces 现在不再只是一个目录下拉，而是明确的 global workbench：

- 固定 start page 先选 root
- detail route 聚焦单 root
- mode 分成 `Explorer / Rules / Private`
- `View as` avatar lens 已存在
- rule 编辑、private asset 创建、preview/drawer/search 都有实现

证据：

- `openspec/specs/workspace-system-workbench/spec.md`
- `packages/webui/src/lib/features/workspaces/workspace-start-route.svelte`
- `packages/webui/src/lib/features/workspaces/workspaces-route.svelte`
- `packages/webui/src/lib/features/workspaces/workspace-content-header.svelte`

这部分已经不只是“页面壳子”，而是可操作的 workspace 权限面板。

### 4.7 测试/tooling 主线已经明显升级

原始需求里你明确要求：

- 语义化检测尽量用真实 AI
- 固定 provider id：`jixoai/agenter/test`
- 没配置就是 CI 门槛错误
- Storybook / Playwright 走官方支持路线

当前这条线的事实是：

- `real-semantic-judge-provider.test.ts` 已覆盖 project/home settings 继承、provider 缺失、env 缺失、suite precondition fail-fast
- `packages/webui/package.json` 已切到 Storybook `10.3.5`
- Storybook DOM contract 和 `storybook:build` 已被当成一个完整工具链 contract

证据：

- `packages/app-server/test/real-semantic-judge-provider.test.ts`
- `packages/app-server/src/semantic-judge.ts`
- `packages/webui/package.json`
- `openspec/specs/webui-storybook-static-build/spec.md`

这意味着“用真实 AI 做语义门槛 + 用官方 Storybook/Playwright 生态做 WebUI contract”这条方向已经进场，而不是停留在建议层。

---

## 5. 还没有完全收口的地方

这些不是否定主线，而是下一阶段最值得补的 control-plane 缺口。

### 5.1 缺一个通用 `attention focus` JSON CLI 面

你的原始想法里很明确：

- `attention list`
- `attention focus '["room-1","terminal-1","workspace-1"]'`

当前 reality 是：

- `attention` CLI 只有 `list/query/commit`
- `terminal` CLI 已有 `focus`
- UI 层和 kernel 层已经有 `focused/background/muted` 状态切换能力
- 但 runtime CLI 还没有 generic attention focus 命令，也没有 message-side focus JSON 命令

证据：

- `packages/app-server/src/runtime-tool-descriptors.ts`
- `packages/app-server/src/runtime-cli.ts`
- `packages/app-server/src/app-kernel.ts`

这说明主线的“多焦点并行 control-plane”还差最后一块正交 CLI 面。

### 5.2 Notification 还不是 source-provided quick-action metadata 模型

现在的 notification 已经有产品面，但还是偏“系统统一 quick action”：

- open
- background
- consume
- promote

还没有做到你说的那种：

- source 自己提供 quick-reply / defer / reminder 之类 metadata
- UI 原生按 metadata 渲染动作

证据：

- `openspec/specs/attention-notification-push/spec.md` 里有 quick-action metadata contract
- `packages/app-server/src/session-notifications.ts` 当前 `SessionNotificationItem` 结构里还没有 quick-action metadata
- `packages/webui/src/lib/features/runtime/runtime-stage-attention.svelte` 当前动作是通用按钮集

所以这里属于“架构方向已定，但 product payload 还没补完”。

### 5.3 Workspace 前端还偏 root-centric，不是完整 mount/detach control plane

现在的 Workspaces workbench 做得已经很像一个系统页了，但它重点是：

- 选 root
- 看 Explorer
- 改 Rules
- 看 Private

它还没有把下面这些做成真正一等 operator workflow：

- 给某个 runtime mount 一个 workspace
- detach/unmount 一个 workspace
- 从 runtime 视角管理多个 mounted workspace 的实例关系

证据：

- `packages/webui/src/lib/features/workspaces/workspaces-route.svelte` 主要是 `grantRuntimeWorkspace(...)`
- 搜索结果里没有对应的 workspace detach/unmount UI surface
- backend/kernel 已经有 mount/grant facts，但前端没有等价的 mount lifecycle 操作面

这部分是下一阶段最自然的 product 补完点。

### 5.4 内部仍残留一层旧式 `/workspace` 执行语义

对 AI 公开的主路径已经切到 root workspace real paths，这条主线是成立的。

但在 backend 内部，`execRuntimeWorkspace(...)` 这类旧式 workspace exec 仍然使用 `/workspace/...` 这种 synthetic root 语义。

证据：

- `packages/app-server/test/workspace-system.test.ts` 仍有 `/workspace/src/generated/out.txt`

这不再是 public surface blocker，因为 AI 主路径已经走 `root_workspace_bash`。  
但从长期平台纯度看，它仍然是一个需要后续收敛的 internal split。

### 5.5 Playwright 双端主链路没有在这次收尾里重新全量验收

当前可以确定的是：

- `packages/webui/playwright.config.ts` 已明确 `desktop-chromium + mobile-iphone14`
- e2e harness 文件还在
- Storybook DOM 与 static build 本轮已验证通过

但这次最终收尾里，我没有重新做一轮完整的 Playwright 双 project 绿灯验收，所以这里不能过度宣称“整条 e2e 主链路已重新证实”。

这不影响本轮 change archive，因为最近补的是 Storybook static build contract。  
但如果下一轮要谈“主线完成度 100%”，这里最好补一轮真实 browser evidence。

---

## 6. 对原始需求的逐条映射

### 6.1 “正交出独立 workspace system”

结论：**已经完成核心实现。**

已满足：

- Avatar root workspace 固定挂载
- project workspace 显式 mount/grant
- 多 workspace 并存
- grant glob 规则
- public/private asset roots
- workspace WebUI 壳层

未完全满足：

- mount/detach 的 operator UI control plane 还不够完整

### 6.2 “强化 attention system 并内置 notification”

结论：**已经完成主线实现，但还没做完原生通知动作生态。**

已满足：

- focus/background/muted
- push ingress
- persisted notification projection
- Attention tab 内嵌通知 quick actions

未完全满足：

- source-provided quick reply / defer / reminder metadata
- 通用 `attention focus` CLI 面

### 6.3 “LoopBus -> rootWorkspace + just-bash + skills/cli”

结论：**主切换已完成。**

已满足：

- direct tools 收缩为 root workspace primitives
- runtime-local API
- JSON-only CLI
- `ccski list/info/search`
- real path shell worldview

未完全满足：

- control-plane 的 focus family 还未完全在 CLI 对称展开

### 6.4 “session.db 大简化”

结论：**已完成。**

已满足：

- `message_parts`
- `ai_call`
- `compact` boundary
- cold restart 走 ledger
- telemetry 不再耦合主 durable truth

### 6.5 “WebUI Avatar detail = Heartbeat / Attention / Settings”

结论：**已完成。**

### 6.6 “语义测试用真实 AI provider”

结论：**已完成主门槛。**

---

## 7. 下一阶段主线计划

按优先级建议这样推进：

### P0. 补齐 generic attention/message focus CLI control plane

目标：

- 给 runtime-local API 和 descriptor surface 补齐通用 `attention focus`
- 同时补 message-side focus/visibility 的 shell CLI 能力
- 保持 `JSON | --help` 形式，不引入另一套 argv 语法

为什么它是 P0：

- 这是一块明显的“架构已经允许，但 public control plane 还不对称”的缺口
- 补完后，多焦点并行的设计会从“半成品”变成完整闭环

### P1. 把 workspace mount/detach 做成一等 operator surface

目标：

- 从 runtime / avatar 视角管理 mounted workspace 实例
- 补显式 attach / detach / inspect 流程
- 让 Workspaces 页不只是一套 root detail，而是也能表达 runtime resource ownership

### P2. 把 notification 升级成 source-provided action metadata

目标：

- push payload 支持 quick reply / defer / reminder / open-source 等结构化 metadata
- UI 根据 metadata 渲染原生动作，不再只有统一按钮组

### P3. 清理内部 `/workspace` synthetic exec split

目标：

- 决定是否继续保留 internal compatibility API
- 若保留，要明确标注它不是 AI public surface
- 若不保留，逐步切到 real-path-only worldview

### P4. 补一轮 desktop + iPhone 14 的 Playwright 主链路验收

目标：

- 不只是配置存在，而是真正跑一轮主系统面回归
- 让“主线已经完成”有更扎实的 browser evidence

---

## 8. 最终判断

如果只问“这次 workspace-system / attention / CLI-skills / session-ledger 主线是不是已经做成了”，我的判断是：

- **是，已经做成了。**

如果问“是不是所有延伸面的产品化与 control-plane 对称性都补齐了”，我的判断是：

- **没有，还差最后一小段。**

更准确地说，当前仓库处于：

- **核心架构重构完成**
- **durable contract 已沉淀**
- **OpenSpec 已全部 archive**
- **剩余任务集中在 operator surface 与 control-plane 对称性补完**

所以接下来的讨论，不应该再围绕“主线架构到底要不要这么做”。  
这个问题已经结束了。下一阶段应该讨论的是：

- 哪些 control-plane 缺口先补
- 哪些产品面要继续扩
- 哪些 internal compatibility 需要继续清理

