## Context

当前 terminal surface 的问题不是“某个字段显示错了”，而是平台法则本身还没有拆层。一个 terminal 同时存在至少四类事实：

1. **durable launch/config truth**
   - terminal id
   - process kind
   - command
   - launch cwd
   - configured title/icon/shortcuts/renderer
2. **runtime observed identity truth**
   - current path
   - current title
   - future extensible observed identity facts
3. **durable process lifecycle truth**
   - not started / running / stopped
   - why it stopped
   - exit code / signal
   - stopped timestamp
4. **running-only activity truth**
   - idle / busy
   - render snapshot seq
   - live transport endpoint

旧模型把这些东西压扁成：

- `cwd`
- `title`
- `running`
- `status`
- `transportUrl`

于是 UI 和 API 只能靠猜：

- `cwd` 究竟是 launch cwd 还是 current cwd
- `title` 究竟是 profile title 还是 runtime observed title
- `running=false` 究竟是还没启动、被 kill、正常退出、还是启动失败
- `transportUrl` 究竟代表 catalog capability 还是当前 live PTY stream

## Goals / Non-Goals

**Goals**

- 把 terminal 的 catalog truth、observed identity、process lifecycle、activity truth 分层
- 明确 stop/bootstrap/delete 三种不同生命周期操作
- 移除 transport open 和 automation write 的 implicit auto-start
- 让 client/WebUI 直接消费 authoritative projection，而不是用 feature 层补丁推断状态
- 用分层 BDD 验证 terminal-system、app-server、client-sdk、WebUI 的边界

**Non-Goals**

- 不重做 terminal collaboration grant / approval / lease 模型
- 不把 terminal catalog 拆成多个 package
- 不为旧的 `kill=delete` 行为保留兼容层
- 不在页面层用额外 cache 或 debounce 掩盖错误法则

## Decisions

### 1. Split terminal truth into launch / observed / lifecycle / activity layers

Control-plane entry and client projections will explicitly expose:

- launch truth
  - `launchCwd`
  - `configuredTitle`
- observed identity
  - `currentPath`
  - `currentTitle`
- lifecycle
  - `processPhase: "not_started" | "running" | "stopped"`
  - `lastStopReason: "killed" | "exited" | "startup_failed" | null`
  - `lastExitCode`
  - `lastExitSignal`
  - `lastStoppedAt`
- activity
  - `status: "IDLE" | "BUSY"`
  - `seq`
  - `snapshot`
  - `transportUrl`

`cwd/title/running` remain insufficient because they mix configured facts with observed facts and force every consumer to reconstruct hidden semantics.

### 2. Lifecycle operations become explicit stop / bootstrap / delete

The control plane will expose three separate operations:

- `stop`: stop the PTY if running, preserve catalog/grants/activity history/lifecycle facts
- `bootstrap`: start a `not_started` or `stopped` PTY from catalog launch truth
- `delete`: remove the terminal catalog entry and its control-plane surface

`kill()` currently deletes the record, which makes “the terminal exists but its PTY is stopped” impossible to represent. That law is structurally wrong and will be removed instead of wrapped.

### 3. No transport or write path may implicitly bootstrap a terminal

The following paths must stop auto-starting terminals:

- websocket `open`
- automation `write`
- automation `input`
- read/snapshot inspection

Bootstrap must be an explicit lifecycle mutation. Otherwise merely opening a route or sending a tool write changes the process lifecycle behind the operator's back.

### 4. Transport endpoint truth belongs to running PTYs only

`transportUrl` will be present only while `processPhase === "running"`.

Reasons:

- `terminal-view` reconnects when `transportUrl` changes; empty -> ws-url is the correct bootstrap edge
- a stopped terminal does not have a live PTY stream to represent
- transport discovery should not be a hidden bootstrap path

Rejected alternative: keep a stable endpoint for stopped terminals and let websocket bootstrap them. Rejected because it preserves the same wrong law: a renderer-side read path would continue mutating lifecycle.

### 5. Observed title/path are collected in terminal core, not inferred in WebUI

Observed identity will be captured near the PTY/xterm bridge:

- `xterm-headless onTitleChange` becomes the primary title signal when available
- raw OSC parsing provides fallback support for title/path observation
- OSC 7 becomes the canonical source for `currentPath`

This keeps observation neutral and reusable for future systems. WebUI must consume the projection, not re-parse terminal output.

### 6. Lifecycle persistence lives in terminal catalog durable storage

`terminal_catalog` will gain lifecycle columns so stopped terminals survive process death with factual reason codes.

Expected durable fields:

- `process_phase`
- `last_stop_reason`
- `last_exit_code`
- `last_exit_signal`
- `last_stopped_at`

Observed identity can stay runtime-managed initially, but lifecycle truth must survive control-plane restarts because it is user-visible system truth, not a transient renderer detail.

### 7. UI truth resolves from one shared terminal display law

WebUI will resolve display text and status from the new projection through one shared helper:

- shared identity title for tabs / toolbar / dialogs: `configuredTitle ?? terminalId`
- terminal window titlebar: `currentTitle ?? configuredTitle ?? terminalId`
- secondary line:
  - running + currentPath => `currentPath`
  - otherwise if shared identity title is not terminal id => `terminalId`
  - otherwise nothing
- status chips:
  - `Provisioned` for `not_started`
  - `Running` + `Busy/Idle`
  - `Stopped` + `Killed/Exited/Failed`
- actions:
  - running => `Kill PTY`
  - stopped/not_started => `Bootstrap PTY`
  - destructive action stays separate as `Delete terminal`

This logic belongs in one shared display/projection helper so tab labels, titlebar, toolbar, and action panels stop drifting.

### 8. Runtime terminal CLI and skill must mirror lifecycle truth

The runtime-local `terminal` shell surface cannot stay on the legacy `kill` vocabulary once the underlying law has moved to `bootstrap / stop / delete`.

Runtime terminal CLI will therefore:

- expose `terminal list` as the status inspection surface for `processPhase`, observed identity, and stop facts
- expose `terminal bootstrap` as the explicit way to start a `not_started` or `stopped` runtime terminal
- expose `terminal stop` as the explicit PTY stop verb
- stop teaching `terminal kill` as the canonical lifecycle action

Built-in terminal skill guidance will therefore:

- teach operators to inspect `terminal list` before guessing lifecycle from stale output
- distinguish `create or recover`, `bootstrap`, `read`, `write/input`, and `stop`
- explain that stopped terminals keep their durable identity while read/write remain disabled until bootstrap

This keeps shell-facing guidance aligned with the same lifecycle truth already used by terminal-system and WebUI, instead of leaving a legacy exception at the CLI boundary.

## Rejected Alternatives

### 1. Keep old `kill()` and add a second delete API later

Rejected.

This would preserve a semantically false public verb and force every caller to memorize a legacy exception. The whole point of this change is to remove that ambiguity.

### 2. Treat missing API key and invalid API key as different terminal lifecycle classes

Rejected for terminal lifecycle.

Those are request/runtime error facts elsewhere. For terminal lifecycle, “startup failed” is the right class; detailed cause can still travel in error surfaces without contaminating terminal process law.

### 3. Let WebUI cache current cwd/title locally from snapshots

Rejected.

The platform already owns terminal observation. Reconstructing identity in the page would create yet another competing truth source.

## Acceptance Strategy

### 1. Terminal-system BDD

- prove `stop` preserves the terminal catalog entry and records lifecycle facts
- prove `delete` removes the terminal catalog entry
- prove `bootstrap` starts only when explicitly invoked
- prove `write/input/read/snapshot/websocket open` do not auto-start a stopped terminal
- prove observed title/path update from xterm/OSC facts
- prove stopped terminals expose no `transportUrl`

### 2. App-server and client-sdk BDD

- prove global terminal list and realtime invalidation publish lifecycle and observed identity separately
- prove `transportUrl` can be cleared on stop and restored on bootstrap
- prove lifecycle changes use explicit catalog-facing invalidation reasons instead of `snapshot/status`

### 3. WebUI DOM / route BDD

- prove toolbar/titlebar/tab labels resolve from runtime display law
- prove second line does not show fixed launch cwd once runtime path is absent or stale
- prove tabs / toolbar stay on terminal instance name while the terminal window titlebar can follow the observed PTY title
- prove stopped terminals show `Bootstrap PTY` and disabled write/read affordances
- prove delete navigates away, but stop keeps the route alive

### 4. Runtime CLI / skill BDD

- prove runtime terminal CLI exposes explicit `bootstrap` and `stop` lifecycle verbs
- prove shell help and generated skill guidance stop teaching legacy `terminal kill` as the primary lifecycle action
- prove built-in terminal skill and lifecycle reference teach status inspection through `terminal list`

### 5. Real walkthrough

- real browser walkthrough for desktop + `iPhone 14`
- real AI walkthrough proving:
  - a terminal can be created in `not_started`
  - bootstrap starts it
  - write/read only work while running
  - stop preserves route + history
  - delete removes it from the catalog

Only after all four layers pass is this change acceptable.
