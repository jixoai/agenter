## Why

`terminal-view` 已经可以镜像 PTY 输出，也已经验证了低延迟交互输入的价值，但当前 transport 仍停留在“少量字符串消息”的补丁式阶段：`input`、`rawInput`、`resize` 各自成立，却还没有形成完整的终端互操作法则。

如果继续沿着 `rawInput` 增量补消息，系统会逐步走向一份越来越长的“特殊 frame 清单”：今天是方向键，明天是粘贴，后天是鼠标、focus、IME、bracketed paste。这样做虽然短期可用，但 transport 的本体会越来越像 feature patch，而不是稳定的平台协议。

用户明确要求的是“完整的、原始互操作性的能力”，并且允许破坏性升级。因此这次 change 应当从“交互式 rawInput 增量”升级为“bytes-first terminal transport v2”：

- transport 的核心变成 PTY 级别的输入/输出字节互操作；
- automation `input` 继续保留在 control-plane / tool API 语义，不再作为 terminal-view live transport 的本体；
- 只有 resize 等天然不属于 stdin/stdout 字节流的控制面，才以 sideband frame 存在。

## What Changes

- 将 terminal websocket transport 从 string-first 输入帧升级为 bytes-first 协议，并以 protobuf message envelope 作为唯一 wire format 真源。
- 废弃 terminal-view 专用的 `rawInput: string` 语义，改为 `inputBytes`/`outputBytes` 一类的原始互操作帧。
- 新增共享协议原子包 `@agenter/terminal-transport-protocol`，统一承载 `.proto`、codegen 产物与 encode/decode wrapper。
- 明确 terminal transport 的本体是：
  - 原始输入字节
  - 原始输出字节
  - 终端几何变更
  - 最小必要的状态/错误/初始化控制面
- 约束 terminal-view 优先把浏览器交互转换为终端原生可理解的输入字节，而不是把浏览器语义事件直接升级成 transport 事件总线。
- 保留 automation `input` 的 durable pending / approval / activity law，但将其限定在 control-plane automation API，而不是 terminal-view live session path。
- 更新真实走查与自动化回归，覆盖 bytes-first 交互、方向键、resize，以及“不产生 automation write facts”。

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `terminal-pty-transport`: 从 string-first websocket 镜像升级为 bytes-first terminal interaction protocol，并保留最小 sideband 控制面。
- `terminal-input-modes`: 明确 live interactive forwarding 的 authoritative form 是 PTY input bytes，而不是 browser semantic events；automation pending truth 继续独立存在。

## Impact

- Affected packages:
  - `packages/terminal-system`
  - `packages/terminal-transport-protocol`
  - `packages/terminal-view`
  - `packages/webui`
- Affected API surface:
  - `TerminalTransportClientMessage`
  - `TerminalTransportServerMessage`
  - terminal websocket parser / transport handling
  - `terminal-view` live transport client frames
- Breaking changes:
  - terminal-view live transport 不再以 `rawInput: string` 作为长期协议真源
  - transport contract 将向 bytes-first 方向升级，旧 string-first live frame 允许直接移除
- Affected tests:
  - terminal-system websocket transport tests
  - terminal-view WebComponent transport tests
  - webui terminal route real walkthrough / browser e2e tests
- Durable docs:
  - `openspec/specs/terminal-pty-transport`
  - `openspec/specs/terminal-input-modes`
  - `packages/terminal-system/SPEC.md`
