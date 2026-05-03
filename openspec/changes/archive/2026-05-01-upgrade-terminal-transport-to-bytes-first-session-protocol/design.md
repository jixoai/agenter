## Context

当前 terminal transport 已经区分了两类输入含义：

- automation `input`：必须保留 pending / approval / activity 的 durable truth；
- live interaction path：为了低延迟，直接通过 policy gate 后写入 PTY；此前的过渡实现曾把它建模为 `rawInput: string`。

这个拆分证明了“automation truth”和“interactive responsiveness”不是一回事。但它仍然停在一个过渡阶段：interactive path 的 authoritative form 还是 `string`，协议本体还是一组 ad-hoc frame，而不是真正的终端互操作协议。

用户要求的是“完整的、原始互操作性的能力”，并允许破坏性升级。因此我们不再把当前 change 当作“再补一种 frame”，而是把 terminal transport 重新定义为：

- **bytes-first**
- **terminal-native**
- **sideband-minimal**

也就是说，transport 优先承载 PTY 输入/输出字节本体；只有 resize、bootstrap、status、error 这类天然不属于字节流的东西，才保留为 sideband 控制。

## Goals / Non-Goals

**Goals:**

- 将 terminal transport 升级为 bytes-first protocol。
- 明确 live transport 的本体是 `inputBytes` / `outputBytes`，而不是 browser semantic events。
- 让 terminal-view 优先把 DOM 键盘/粘贴/鼠标/focus 能力翻译为终端原生输入字节，而不是直接向 transport 暴露语义事件。
- 保留 lifecycle gate 与 collaboration write policy。
- 保留 terminal-view 的 host-agnostic 原子边界。
- 明确 automation `input` 继续留在 tool/control-plane durable path。

**Non-Goals:**

- 不把 transport 演化成通用浏览器事件总线。
- 不把 `paste`、`mouse`、`focus` 默认建模为长期 transport-level semantic event，除非它们无法稳定落成终端字节。
- 不破坏 pending `.raw.txt` / `.mixed.txt` automation law。
- 不允许 view interaction 自动 bootstrap 停止态终端。
- 不在 WebUI feature 层引入 terminal-specific PTY glue。

## Decisions

### Decision: Transport v2 is bytes-first, not event-first

客户端 live session 的 authoritative input form 是原始终端输入字节，而不是语义化按键/粘贴/鼠标事件。服务端 live session 的 authoritative output form 是 PTY 输出字节，而不是“渲染结果事件流”。

推荐的 v2 frame 形式：

- client -> server
  - `inputBytes`
  - `resize`
  - optional `hello`
- server -> client
  - `outputBytes`
  - `bootstrapSnapshot`
  - `status`
  - `error`
  - optional `helloAck`

### Decision: Wire format is protobuf over websocket binary frames

transport v2 的 bytes truth 不是“自定义二进制布局”，也不是“JSON + base64”。共享协议真源固定为 `.proto`，client/server 都通过同一份 codegen 产物读写 binary websocket frame。

这意味着：

- websocket frame payload 是 protobuf binary message
- `inputBytes` / `outputBytes` 仍然保持 opaque terminal bytes 语义
- sideband (`snapshot` / `resize` / `status` / `error`) 也纳入同一 protobuf envelope，而不是另起一套 JSON 协议

Alternative considered: 继续使用手写 binary frame，后续再看情况切 protobuf。Rejected，因为这样只是在“语义上像 protobuf”，没有把长期 contract 真正物化成共享 schema。

Alternative considered: 将 paste / mouse / focus / blur 全部显式提升成 transport semantic events。Rejected，因为这会把协议本体从 terminal-native 重新拉回 browser-event-first，后续会不断增长成一张事件清单。

### Decision: Browser events are local facts, terminal bytes are transport facts

DOM 层确实会观察到：

- keydown / beforeinput / paste
- mouse / wheel
- focus / blur

但 transport 不把它们直接视为协议事实。`terminal-view` / xterm 应优先把这些输入翻译成终端可理解的 bytes / escape sequences：

- Arrow / Ctrl / Alt 等键盘交互 -> input bytes
- paste -> 普通输入字节或 bracketed paste bytes
- mouse -> 若应用启用 mouse reporting，则编码为终端 escape sequences
- focus -> 若应用启用 focus reporting，则编码为终端 sequence

只有某类能力天然不属于 stdin bytes，或当前 terminal stack 无法稳定落成 bytes，才允许引入新的 sideband frame。

Alternative considered: transport 同时暴露“原始 bytes”和“高层 browser event”，由服务端自己选择。Rejected，因为这会让 transport contract 丢失单一真源，重新出现多条输入真相。

### Decision: Automation write remains a separate law

`terminal.write`、pending inbox、approval request、`terminal_write` activity 仍然保留，继续作为 automation-facing truth。

这意味着：

- terminal-view live path 不再复用 automation `input`
- automation path 也不复用 live bytes transport 作为 durable truth

二者共享的是：

- collaboration gate
- lifecycle truth

二者不共享的是：

- authoritative storage
- activity semantics
- pending/approval behavior

Alternative considered: 让 automation path 也复用 `inputBytes` transport，然后由服务端额外 materialize 成 durable truth。Rejected，因为这样会重新把 terminal transport 变成 automation system 的基础真源，破坏分层。

### Decision: Sideband remains minimal and named

以下能力保留为 sideband frame，因为它们不属于 stdin/stdout byte stream 本体：

- `resize`
- `bootstrapSnapshot`
- `status`
- `error`
- 可选 `hello/helloAck`

这些 sideband 不承担高层业务语义，只承担 terminal session control。

Alternative considered: sideband 继续无限扩展承载 paste/mouse/focus。Rejected，因为这会导致 transport 协议重新滑向 feature patch 模式。

### Decision: Break compatibility instead of emulating old frames

用户明确允许破坏性升级，因此 v2 不以兼容 `rawInput: string` 为设计前提。实现上如需临时过渡，可在短期代码中存在转换层，但 spec 与长期 law 不再承认旧 frame 为协议真源。

## Risks / Trade-offs

- [Risk] Binary websocket support may be awkward in current Bun/socket code.  
  Mitigation: spec 先定义 bytes semantics；实现可阶段性用 base64 frame 落地，但必须保持 opaque-byte contract。

- [Risk] Some browser interactions may not naturally fall through xterm into bytes in the exact way we want.  
  Mitigation: default bytes-first；只对无法自然编码的例外能力引入最小 sideband，并把其边界写入 spec。

- [Risk] Breaking compatibility will invalidate current `rawInput` tests and clients.  
  Mitigation: 既然 change 允许破坏性升级，就同步改 transport tests、terminal-view tests、webui e2e，并更新 durable docs。

- [Risk] Teams may blur automation and live session paths again in future work.  
  Mitigation: 在 specs 和 package SPEC 中明确“automation truth”和“interactive bytes”是两条正交法则。

## Migration Plan

1. Rewrite the change artifacts so the authoritative target is bytes-first transport v2.
2. Redefine transport message types around `inputBytes` / `outputBytes`, minimal sideband frames, and a shared protobuf schema package.
3. Update terminal-system parsing and websocket handling to accept bytes-first live input and emit bytes-first live output.
4. Update `terminal-view` to source live interaction from terminal-native bytes rather than string-first raw input semantics.
5. Refresh terminal-system / terminal-view / webui tests to verify:
   - bytes-first interactive input
   - arrow/control sequences still work
   - resize remains sideband
   - no automation write facts are produced
6. Update durable specs and package SPEC before archive.

Rollback strategy is architectural, not incremental: if this v2 direction is rejected, the correct rollback is to abandon the bytes-first rewrite and restore `rawInput` as the scoped feature change. We should not mix both laws long term.
