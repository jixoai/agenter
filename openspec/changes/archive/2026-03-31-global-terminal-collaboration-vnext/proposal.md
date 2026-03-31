## Why

当前 terminal-system 仍然是“某个 session 拥有一组终端”的模型，既没有全局 terminal catalog，也没有多人协作写入的治理层。要把 `Terminals` 做成真正的全局画布，必须同时重构后端控制面和前端页面契约，而不是只补几个 API。

## What Changes

- **BREAKING** 把现有 terminal system 拆成 `terminal-core` 与 `terminal-system`：
  - `terminal-core` 负责 PTY / snapshot / diff / title / status / write hook。
  - `terminal-system` 负责全局 terminal catalog、grant、approval、lease、presence、focus、transport。
- **BREAKING** terminal durable truth 上移到 `~/.agenter/.terminal`，不再由 session root 持有。
- 引入 auth actor / session actor 两类参与者，以及 `admin | writer | requester | readonly` 四类 terminal grant。
- terminal local admin 改成“单一当前管理员 + 有序候选管理员组”的治理模型，而不是多个并行管理员。
- 引入审批写入与基于时间的 write lease：默认申请写入超时 90s，批准后授予 `30m | 2h | 24h` 的连续写权限。
- 把 `openspecui` 的 PTY title/status、shared controller、双渲染引擎迁移目标写成正式 contract。
- 把 `Terminals` 页面的 Tabs、toolbar、AvatarGroup、badge/border 权限色和多 writer 降级提示写成正式 UI contract。

## Capabilities

### New Capabilities
- `terminal-collaboration-access-control`: terminal grant、approval request、timeboxed write lease。
- `terminal-session-projection`: session 对 terminal activity / approval 的绑定与投影，而不拥有 terminal 真源。

### Modified Capabilities
- `terminal-control-plane`: lifecycle/focus/discovery 改成 global terminal catalog。
- `terminal-pty-transport`: transport endpoint discovery 和输入授权改写为 terminal collaboration contract。
- `runtime-terminal-contract`: runtime 只发布 session 绑定到的 global terminal 视图，而不是 session-private terminal truth。
- `terminal-view-component`: view component 增加 title/status、renderer engine 选择和 shared controller 语义。
- `webui-terminal-surface`: `Terminals` 页面的完整 UI contract 升级为 global terminal surface。

## Impact

- Affected packages: `terminal-system`, future `terminal-core`, `app-server`, `session-system`, `client-sdk`, `webui`.
- Affected storage: `~/.agenter/.terminal`, terminal grant/approval/lease truth, session terminal projection refs.
- Verification: terminal backend tests, transport tests, runtime projection tests, WebUI DOM contracts, browser walkthrough.
