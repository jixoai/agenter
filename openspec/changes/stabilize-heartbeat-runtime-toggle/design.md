## Context

真实 daemon 与真实 WebUI 走查表明：

1. `session.start` 的服务端链路是可用的，真实 `default/backend` Avatar 都能被成功启动。
2. `Heartbeat` 桌面端与移动端的基础 toggle 交互链路也是可工作的。
3. 但这条路径仍有两个 contract 空洞：
   - 页面没有显式暴露 runtime toggle 的 action-level failure
   - 仓库没有一条直接锁住 `stopped Heartbeat 首屏 -> Start runtime` 的 route-level 回归

换言之，这不是要推翻 runtime law，而是要把 Heartbeat route 对 runtime lifecycle control 的“可操作、可观测、可验收”补成 durable contract。

## Goals / Non-Goals

**Goals**

- Heartbeat route 的 `Start/Stop runtime` 动作具备显式 pending 状态
- 动作失败时 route 内出现客观错误 notice
- 加入直接覆盖 Heartbeat 首屏 toggle 的真实浏览器回归

**Non-Goals**

- 不改 `AppKernel.startSession` / `SessionRuntime.start` 的底层启动法则
- 不改 Avatar Catalog 的启动语义
- 不重新设计 runtime shell 的整体布局

## Decisions

### 1. Keep lifecycle law in the kernel, add route-local action truth in the shell

底层 session lifecycle 仍然由 `AppKernel` 和 runtime snapshot 提供权威状态；WebUI 不发明自己的 lifecycle 状态机。

本次只补 route-local action truth：

- `runtimeTogglePending`
- `runtimeToggleError`

它们只描述“这一次按钮动作”的临时事实，不替代 durable `session.status` / `session.lastError`。

### 2. Failure must be visible in the route body, not hidden in console noise

当 runtime toggle 失败时，Heartbeat route 必须在页面里渲染 notice。

原因：

- toolbar 本身适合放状态和动作，不适合承载多行错误说明
- route body 已经是这条 runtime 事实的主视图，错误应该在这里被客观看见

### 3. Acceptance must target the exact user complaint path

现有回归已经覆盖 Avatar Catalog 的 `Start avatar`，但用户反馈的是 `Heartbeat 页面无法启动 Avatar`。

因此新增回归必须直接锁住：

1. 打开一个已有 runtime 的 Heartbeat route
2. 通过 API 或 UI 把它置为 stopped
3. 在 Heartbeat 首屏点击 `Start runtime`
4. 验证状态回到 `Running`

移动端也必须覆盖，因为 runtime toolbar 在窄屏会进入 overflow。

## Acceptance Strategy

### 1. Real daemon walkthrough

- 使用真实 daemon 和真实 WebUI 验证 stopped Heartbeat 首屏的 `Start runtime` 动作可用
- 记录 desktop 与 mobile 两端行为

### 2. E2E regression

- 在 `system-surfaces.e2e.ts` 新增 route-level 场景
- 覆盖 `Stop runtime -> page reload -> Start runtime`
- 同时跑 `desktop-chromium` 与 `mobile-iphone14`

### 3. UI behavior verification

- 按钮动作进行中时不可重复触发
- 若动作失败，route body 渲染 warning/destructive notice
- 动作成功后清空 route-local error
