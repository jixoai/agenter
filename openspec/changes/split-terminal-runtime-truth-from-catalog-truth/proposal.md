## Why

当前 terminal surface 仍把几类完全不同的事实混成一个扁平对象：

- `cwd/title` 同时承担 launch config 与 runtime observed identity
- `running/status` 同时承担 process lifecycle 与 live activity
- `kill` 同时承担 stop PTY 与 delete catalog entry
- websocket transport / automation write 会在读取或打开页面时偷偷 auto-start terminal

这套模型已经直接产生错误行为：

- page-toolbar second line 显示固定 `cwd`，但真实 shell 早就可能 `cd` 到别处
- terminal titlebar 用的是配置里的 `title`，不是 runtime 实际观察到的 title
- stopped terminal 一打开页面或一执行 write 就会被隐式启动，破坏显式 bootstrap 边界
- terminal 被 kill 后无法客观显示，因为系统根本没有“terminal 目录项还在，但 PTY 已停止”的状态

这不是某个页面的展示 bug，而是 terminal kernel law 还没有把 catalog truth、runtime observed truth、process lifecycle truth 分层。

## What Changes

- **BREAKING** Split terminal truth into four layers:
  - durable launch/config truth
  - runtime observed identity truth
  - durable process lifecycle truth
  - running-only activity truth
- **BREAKING** Replace mixed `kill` semantics with explicit operations:
  - `stop PTY`
  - `bootstrap PTY`
  - `delete terminal`
- **BREAKING** Remove implicit terminal auto-start from transport open, read-adjacent hydration, and automation write paths.
- Publish authoritative runtime identity and lifecycle through terminal projections so client/WebUI stop treating `cwd/title/running/status` as one flat truth blob.
- Update terminal page-toolbar, titlebar, tab labels, transport affordances, and action composers to consume the new runtime truth directly.
- Add layered BDD coverage plus real browser / real AI walkthrough acceptance for stopped, running, exited, killed, and startup-failed terminals.

## Capabilities

### Modified Capabilities

- `terminal-control-plane`: lifecycle operations become explicit `stop/bootstrap/delete`, and inspection/write paths stop auto-starting terminals.
- `terminal-pty-transport`: transport discovery and websocket lifecycle only represent running PTYs instead of acting as an implicit bootstrap side channel.
- `runtime-terminal-contract`: runtime/client projections expose launch truth, observed identity, and process lifecycle as separate facts.
- `terminal-surface-projection`: one authoritative projection carries the new lifecycle and observed identity model for clients.
- `terminal-system-surface`: toolbar/titlebar/status/actions render from runtime truth rather than fixed catalog `cwd/title` fallback.

## Impact

- `openspec/specs/terminal-control-plane/spec.md`
- `openspec/specs/terminal-pty-transport/spec.md`
- `openspec/specs/runtime-terminal-contract/spec.md`
- `openspec/specs/terminal-surface-projection/spec.md`
- `openspec/specs/terminal-system-surface/spec.md`
- `packages/terminal-system/src/*`
- `packages/app-server/src/*`
- `packages/client-sdk/src/*`
- `packages/webui/src/lib/features/terminals/*`
- targeted BDD tests and real browser / real AI walkthrough evidence
